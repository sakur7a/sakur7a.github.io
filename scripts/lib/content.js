import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import sharp from 'sharp';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const SITE = 'https://sakur7a.github.io';
export const ASSETS = 'public/Blog/assets';
// unlink/rmdir also handle CJK paths on the installed Windows Node runtime.
export function removeTree(file) {
  if (!fs.existsSync(file)) return;
  if (fs.lstatSync(file).isDirectory()) {
    for (const name of fs.readdirSync(file)) removeTree(path.join(file, name));
    fs.rmdirSync(file);
  } else fs.unlinkSync(file);
}
export function inside(root, relative, prefix = '') {
  if (!relative || path.isAbsolute(relative)) throw new Error(`Expected a repository-relative path: ${relative}`);
  const full = path.resolve(root, relative);
  const normalized = path.relative(root, full).replaceAll('\\', '/');
  if (normalized.startsWith('../') || normalized === '..' || (prefix && !normalized.startsWith(prefix))) throw new Error(`Path escapes permitted directory: ${relative}`);
  return full;
}
export function readDocument(file) {
  const content = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)/);
  return { data: match ? parse(match[1]) || {} : {}, body: match ? match[2] : content };
}
export function writeDocument(file, data, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `---\n${stringify(data, { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' })}---\n\n${body.trimStart()}`, 'utf8');
}
export function assertPublic(data) {
  if (data.visibility != null && String(data.visibility).trim().toLowerCase() !== 'public') throw new Error('Private notes cannot be published to the public blog.');
}
export function localDate(value = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid publication date: ${value}`);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function nowStamp() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()) + ' +0800';
}
export function slugFor(value) {
  const slug = String(value).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).slice(0, 6).join('-');
  return slug || `post-${crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 6)}`;
}
export function safeSlug(value) {
  if (!/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(value) || value.length > 100) throw new Error(`Invalid slug: ${value}`);
  return value;
}
export function postInfo(root, filename) {
  const postPath = `_posts/${filename}`;
  const { data, body } = readDocument(inside(root, postPath, '_posts/'));
  const date = filename.slice(0, 10);
  const slug = filename.slice(11, -3);
  const title = data.title || slug.replaceAll('-', ' ');
  const sourceName = data.source_file || `${title}.md`;
  const sourcePath = path.basename(sourceName) === sourceName && fs.existsSync(path.join(root, 'obsidian/Published', sourceName)) ? `obsidian/Published/${sourceName}` : '';
  return { title, date, dateValue: data.date || date, category: Array.isArray(data.categories) ? data.categories[0] : data.categories || '随笔', summary: data.summary || '', slug, cover: data.cover || '', coverPosition: data.cover_position || '', postPath, assetPath: `${ASSETS}/images/posts/${filename.slice(0, -3)}`, sourcePath, url: SITE + (data.permalink || `/Blog/${date}/${slug}.html`), relativeUrl: data.permalink || `/Blog/${date}/${slug}.html`, data, body };
}
export function listPosts(root = ROOT) {
  if (!fs.existsSync(path.join(root, '_posts'))) return [];
  return fs.readdirSync(path.join(root, '_posts')).filter(file => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(file)).map(file => postInfo(root, file)).sort((a, b) => new Date(b.dateValue) - new Date(a.dateValue));
}
export function publicFile(root, url) {
  const parsed = new URL(url, SITE);
  if (parsed.origin !== SITE) throw new Error('Expected a local site asset.');
  return inside(root, `public${decodeURIComponent(parsed.pathname)}`, 'public/');
}
function assetName(reference) {
  const normalized = reference.replaceAll('\\', '/');
  const leaf = path.posix.basename(normalized);
  const ext = path.extname(leaf).toLowerCase();
  const stem = path.basename(leaf, path.extname(leaf)).replace(/[^\p{L}\p{N}._ -]+/gu, '-').replace(/^[ .-]+|[ .-]+$/g, '') || 'image';
  const base = stem + ext;
  const hash = normalized.includes('/') || base !== leaf ? '-' + crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 8) : '';
  return stem + hash + ext;
}
function findImage(reference, draft, vaultRoot, existingAsset) {
  const candidates = [path.resolve(path.dirname(draft), reference), ...(vaultRoot ? [path.resolve(vaultRoot, reference)] : [])];
  if (existingAsset) for (const name of [assetName(reference), path.basename(reference)]) {
    candidates.push(path.join(existingAsset, name), path.join(existingAsset, name.replace(/\.(png|jpe?g)$/i, '.webp')));
  }
  let found = candidates.find(file => fs.existsSync(file) && fs.statSync(file).isFile());
  if (!found && vaultRoot) {
    const files = fs.readdirSync(vaultRoot, { recursive: true }).filter(file => path.basename(file) === path.basename(reference)).map(file => path.join(vaultRoot, file)).filter(file => fs.statSync(file).isFile());
    if (files.length > 1) throw new Error(`Ambiguous attachment: ${reference}; use its vault-relative path.`);
    found = files[0];
  }
  if (!found) throw new Error(`Attachment not found: ${reference}`);
  return found;
}
export async function copyImage(source, directory, filename) {
  const extension = path.extname(source).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(extension)) throw new Error(`Unsupported image type: ${extension}`);
  fs.mkdirSync(directory, { recursive: true });
  const output = filename.replace(/\.(png|jpe?g)$/i, '.webp');
  const destination = path.join(directory, output);
  if (source === destination) return output;
  if (/\.(png|jpe?g)$/i.test(extension)) await sharp(source).resize({ width: 2000, withoutEnlargement: true }).webp({ quality: 80 }).toFile(destination);
  else fs.copyFileSync(source, destination);
  return output;
}
export async function transformDraft(root, draft, options = {}) {
  const input = readDocument(draft);
  assertPublic(input.data);
  const sourceName = path.basename(draft);
  const title = input.data.title || path.basename(draft, '.md');
  const existing = listPosts(root).find(post => post.data.source_file === sourceName || (!post.data.source_file && post.title === title));
  const date = existing?.dateValue || options.date || input.data.date || nowStamp();
  const day = existing?.date || localDate(date);
  const slug = safeSlug(options.slug || input.data.slug || existing?.slug || slugFor(title));
  const basename = `${day}-${slug}`;
  if (fs.existsSync(path.join(root, '_posts', `${basename}.md`)) && existing?.postPath !== `_posts/${basename}.md`) throw new Error('A different post already uses this publication date and slug.');
  const assetPath = `${ASSETS}/images/posts/${basename}`;
  const assetDir = inside(root, assetPath, `${ASSETS}/images/posts/`);
  const existingDir = existing ? inside(root, existing.assetPath, `${ASSETS}/images/posts/`) : null;
  const data = { ...input.data, title, date, slug, categories: input.data.categories || existing?.data.categories || ['随笔'], source_file: sourceName, visibility: 'public', permalink: `/Blog/${day}/${slug}.html` };
  if (!data.summary) data.summary = input.body.replace(/!\[\[[^\]]*\]\]|!\[[^\]]*\]\([^)]*\)/g, '').split(/\r?\n/).find(line => line.trim())?.replace(/^[#>* ]+/, '').slice(0, 80) || title;
  if (existing?.cover) data.cover = existing.cover;
  if (data.cover?.startsWith('/assets/')) data.cover = '/Blog' + data.cover;
  if (data.image?.startsWith('/assets/')) data.image = '/Blog' + data.image;
  data.cover_position = options.coverPosition || existing?.coverPosition || data.cover_position || '50% 50%';
  if (existingDir && existingDir !== assetDir && fs.existsSync(existingDir)) {
    fs.cpSync(existingDir, assetDir, { recursive: true });
    if (data.cover) data.cover = data.cover.replace(`/images/posts/${path.basename(existingDir)}/`, `/images/posts/${basename}/`);
  }
  if (options.cover) {
    const filename = await copyImage(options.cover, assetDir, `cover${path.extname(options.cover).toLowerCase()}`);
    data.cover = `/Blog/assets/images/posts/${basename}/${filename}`;
    data.cover_position = options.coverPosition || data.cover_position;
  }
  const imagePattern = /!\[\[([^\]]+)\]\]|!\[([^\]]*)\]\((<[^>]+>|[^)]+)?\)/g;
  let body = input.body.replace(/\{\{\s*['"](\/assets\/[^'"]+)['"]\s*\|\s*relative_url\s*\}\}/g, (_match, reference) => `/Blog${reference}`);
  const matches = [...body.matchAll(imagePattern)];
  for (const match of matches.reverse()) {
    let reference = (match[1] ? match[1].split('|')[0] : match[3] || '').trim().replace(/^<|>$/g, '').replace(/\s+["'][^"']*["']$/, '');
    if (/^(?:https?:|data:)/i.test(reference)) continue;
    reference = decodeURIComponent(reference).replaceAll('\\', '/');
    let url;
    if (reference.startsWith('/Blog/assets/')) url = reference;
    else if (reference.startsWith('/assets/')) url = `/Blog${reference}`;
    else {
      const image = findImage(reference, draft, options.vaultRoot, existingDir);
      const filename = await copyImage(image, assetDir, assetName(reference));
      url = `/Blog/assets/images/posts/${basename}/${filename}`;
    }
    body = body.slice(0, match.index) + `![${match[2] || ''}](<${url}>)` + body.slice(match.index + match[0].length);
  }
  const postPath = `_posts/${basename}.md`;
  const sourcePath = `obsidian/Published/${sourceName}`;
  writeDocument(inside(root, postPath, '_posts/'), data, body);
  writeDocument(inside(root, sourcePath, 'obsidian/Published/'), data, input.body);
  const paths = [postPath, sourcePath, assetPath];
  if (existing && existing.postPath !== postPath) {
    fs.unlinkSync(inside(root, existing.postPath, '_posts/'));
    paths.push(existing.postPath);
  }
  return { title, paths, postPath, sourcePath, assetPath, permalink: data.permalink };
}
