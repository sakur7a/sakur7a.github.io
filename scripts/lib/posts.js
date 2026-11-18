import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { POSTS_DIRECTORY, SOURCES_DIRECTORY } from '../../src/config/content.js';
import { SITE_ORIGIN, SITE_TIME_ZONE, postPermalink } from '../../src/config/site.js';
import { readDocument } from './markdown.js';
import { ASSETS, ROOT, inside } from './repository.js';

export function localDate(value = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid publication date: ${value}`);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: SITE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function nowStamp() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: SITE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()) + ' +0800';
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
  const postPath = `${POSTS_DIRECTORY}/${filename}`;
  const { data, body } = readDocument(inside(root, postPath, `${POSTS_DIRECTORY}/`));
  const date = filename.slice(0, 10);
  const slug = filename.slice(11, -3);
  const title = data.title || slug.replaceAll('-', ' ');
  const sourceName = data.source_file || `${title}.md`;
  const sourcePath = path.basename(sourceName) === sourceName && fs.existsSync(path.join(root, SOURCES_DIRECTORY, sourceName)) ? `${SOURCES_DIRECTORY}/${sourceName}` : '';
  const relativeUrl = data.permalink || postPermalink(date, slug);
  return {
    title,
    date,
    dateValue: data.date || date,
    category: Array.isArray(data.categories) ? data.categories[0] : data.categories || '随笔',
    summary: data.summary || '',
    slug,
    cover: data.cover || '',
    coverPosition: data.cover_position || '',
    postPath,
    assetPath: `${ASSETS}/images/posts/${filename.slice(0, -3)}`,
    sourcePath,
    url: SITE_ORIGIN + relativeUrl,
    relativeUrl,
    data,
    body,
  };
}
export function listPosts(root = ROOT) {
  if (!fs.existsSync(path.join(root, POSTS_DIRECTORY))) return [];
  return fs.readdirSync(path.join(root, POSTS_DIRECTORY)).filter(file => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(file)).map(file => postInfo(root, file)).sort((a, b) => new Date(b.dateValue) - new Date(a.dateValue));
}
