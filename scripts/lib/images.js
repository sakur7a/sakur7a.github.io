import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { BLOG_ASSETS, BLOG_PREFIX } from '../../src/config/site.js';

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

export async function rewriteImages(markdown, { draft, vaultRoot, existingDir, assetDir, publicAssetDir }) {
  const imagePattern = /!\[\[([^\]]+)\]\]|!\[([^\]]*)\]\((<[^>]+>|[^)]+)?\)/g;
  let body = markdown.replace(/\{\{\s*['"](\/assets\/[^'"]+)['"]\s*\|\s*relative_url\s*\}\}/g, (_match, reference) => BLOG_PREFIX + reference);
  const matches = [...body.matchAll(imagePattern)];
  for (const match of matches.reverse()) {
    let reference = (match[1] ? match[1].split('|')[0] : match[3] || '').trim().replace(/^<|>$/g, '').replace(/\s+["'][^"']*["']$/, '');
    if (/^(?:https?:|data:)/i.test(reference)) continue;
    reference = decodeURIComponent(reference).replaceAll('\\', '/');
    let url;
    if (reference.startsWith(BLOG_ASSETS + '/')) url = reference;
    else if (reference.startsWith('/assets/')) url = BLOG_PREFIX + reference;
    else {
      const image = findImage(reference, draft, vaultRoot, existingDir);
      const filename = await copyImage(image, assetDir, assetName(reference));
      url = `${publicAssetDir}/${filename}`;
    }
    body = body.slice(0, match.index) + `![${match[2] || ''}](<${url}>)` + body.slice(match.index + match[0].length);
  }
  return body;
}
