import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { POSTS_DIRECTORY } from '../../../src/config/content.js';
import { SITE_ORIGIN, SITE_TIME_ZONE, blogDateLabel, canonicalPostPermalink, postPermalink, postSlugPattern } from '../../../src/config/site.js';
import { readDocument } from './markdown.js';
import { ASSETS, ROOT, SOURCES_DIRECTORY, inside } from './repository.js';

export function localDate(value = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid publication date: ${value}`);
  return blogDateLabel(date);
}
export function nowStamp() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: SITE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()) + ' +0800';
}
export function slugFor(value) {
  const slug = String(value).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).slice(0, 6).join('-');
  return slug || `post-${crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 6)}`;
}
export function safeSlug(value) {
  if (!postSlugPattern.test(value) || value.length > 100) throw new Error(`Invalid slug: ${value}`);
  return value;
}
export function postInfo(root, filename) {
  const postPath = `${POSTS_DIRECTORY}/${filename}`;
  const { data, body } = readDocument(inside(root, postPath, `${POSTS_DIRECTORY}/`));
  const stem = filename.slice(0, -'.md'.length);
  const datedName = /^(\d{4}-\d{2}-\d{2})-(.+)$/.exec(stem);
  const dateValue = data.date || datedName?.[1];
  const date = datedName?.[1] || localDate(dateValue);
  const slug = data.slug || datedName?.[2] || stem;
  const title = data.title || slug.replaceAll('-', ' ');
  const sourceName = data.source_file || `${title}.md`;
  const sourcePath = path.basename(sourceName) === sourceName && fs.existsSync(path.join(root, SOURCES_DIRECTORY, sourceName)) ? `${SOURCES_DIRECTORY}/${sourceName}` : '';
  const relativeUrl = data.permalink ? canonicalPostPermalink(data.permalink) : postPermalink(localDate(dateValue), slug);
  return {
    title,
    date,
    dateValue,
    category: Array.isArray(data.categories) ? data.categories[0] : data.categories || '随笔',
    summary: data.summary || '',
    slug,
    cover: data.cover || '',
    coverPosition: data.cover_position || '',
    postPath,
    assetPath: `${ASSETS}/images/posts/${stem}`,
    sourcePath,
    url: SITE_ORIGIN + relativeUrl,
    relativeUrl,
    data,
    body,
  };
}
export function listPosts(root = ROOT) {
  const directory = path.join(root, POSTS_DIRECTORY);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => postInfo(root, entry.name))
    .sort((a, b) => new Date(b.dateValue) - new Date(a.dateValue));
}
