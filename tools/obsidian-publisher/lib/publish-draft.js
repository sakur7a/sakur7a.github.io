import fs from 'node:fs';
import path from 'node:path';
import { POSTS_DIRECTORY } from '../../../src/config/content.js';
import { BLOG_ASSETS, BLOG_PREFIX, postPermalink } from '../../../src/config/site.js';
import { copyImage, rewriteImages } from './images.js';
import { assertPublic, readDocument, writeDocument } from './markdown.js';
import { listPosts, localDate, nowStamp, safeSlug, slugFor } from './posts.js';
import { ASSETS, SOURCES_DIRECTORY, inside } from './repository.js';

export async function transformDraft(root, draft, options = {}) {
  const input = readDocument(draft);
  assertPublic(input.data);
  const sourceName = path.basename(draft);
  const title = input.data.title || path.basename(draft, '.md');
  const sourcePath = `${SOURCES_DIRECTORY}/${sourceName}`;
  const posts = listPosts(root);
  const existing = posts.find(post => post.data.source_file === sourceName)
    || posts.find(post => !post.data.source_file && post.title === title && post.sourcePath === sourcePath);
  const date = existing?.dateValue || options.date || input.data.date || nowStamp();
  const day = existing?.date || localDate(date);
  const slug = safeSlug(options.slug || input.data.slug || existing?.slug || slugFor(title));
  const basename = `${day}-${slug}`;
  const postPath = `${POSTS_DIRECTORY}/${basename}.md`;
  const permalink = postPermalink(day, slug);
  if ((existing?.postPath !== postPath && fs.existsSync(path.join(root, postPath)))
    || posts.some(post => post !== existing && post.relativeUrl === permalink)) {
    throw new Error('A different post already uses this publication date and slug.');
  }
  const publicAssetDir = `${BLOG_ASSETS}/images/posts/${basename}`;
  const assetPath = `public${publicAssetDir}`;
  const assetDir = inside(root, assetPath, `${ASSETS}/images/posts/`);
  const existingDir = existing ? inside(root, existing.assetPath, `${ASSETS}/images/posts/`) : null;
  const data = {
    ...input.data,
    title,
    date,
    slug,
    categories: input.data.categories || existing?.data.categories || ['随笔'],
    source_file: sourceName,
    visibility: 'public',
    permalink,
  };
  if (!data.summary) data.summary = input.body.replace(/!\[\[[^\]]*\]\]|!\[[^\]]*\]\([^)]*\)/g, '').split(/\r?\n/).find(line => line.trim())?.replace(/^[#>* ]+/, '').slice(0, 80) || title;
  if (existing?.cover) data.cover = existing.cover;
  if (data.cover?.startsWith('/assets/')) data.cover = BLOG_PREFIX + data.cover;
  if (data.image?.startsWith('/assets/')) data.image = BLOG_PREFIX + data.image;
  data.cover_position = options.coverPosition || existing?.coverPosition || data.cover_position || '50% 50%';
  if (existingDir && existingDir !== assetDir && fs.existsSync(existingDir)) {
    fs.cpSync(existingDir, assetDir, { recursive: true });
    if (data.cover) data.cover = data.cover.replace(`/images/posts/${path.basename(existingDir)}/`, `/images/posts/${basename}/`);
  }
  if (options.cover) {
    const filename = await copyImage(options.cover, assetDir, `cover${path.extname(options.cover).toLowerCase()}`);
    data.cover = `${publicAssetDir}/${filename}`;
    data.cover_position = options.coverPosition || data.cover_position;
  }
  const body = await rewriteImages(input.body, {
    draft,
    vaultRoot: options.vaultRoot,
    existingDir,
    assetDir,
    publicAssetDir,
  });
  writeDocument(inside(root, postPath, `${POSTS_DIRECTORY}/`), data, body);
  writeDocument(inside(root, sourcePath, `${SOURCES_DIRECTORY}/`), data, input.body);
  const paths = [postPath, sourcePath, assetPath];
  if (existing && existing.postPath !== postPath) {
    fs.unlinkSync(inside(root, existing.postPath, `${POSTS_DIRECTORY}/`));
    paths.push(existing.postPath);
  }
  return { title, paths, postPath, sourcePath, assetPath, permalink: data.permalink };
}
