import path from 'node:path';
import { POSTS_DIRECTORY } from '../../src/config/content.js';
import { BLOG_ASSETS } from '../../src/config/site.js';
import { ROOT, inside, ASSETS, SOURCES_DIRECTORY } from './lib/repository.js';
import { copyImage } from './lib/images.js';
import { readDocument, writeDocument, assertPublic } from './lib/markdown.js';
import { transact, report } from './lib/transaction.js';
export async function replaceCover(root, postPath, coverPath, options = {}) {
  const file = inside(root, postPath, POSTS_DIRECTORY + '/');
  const { data, body } = readDocument(file);
  assertPublic(data);
  const basename = path.basename(file, '.md');
  const assetPath = `${ASSETS}/images/posts/${basename}`;
  const filename = await copyImage(coverPath, inside(root, assetPath, `${ASSETS}/images/posts/`), `cover${path.extname(coverPath).toLowerCase()}`);
  data.cover = `${BLOG_ASSETS}/images/posts/${basename}/${filename}`;
  data.cover_position = options.coverPosition || data.cover_position || '50% 50%';
  writeDocument(file, data, body);
  const paths = [postPath, assetPath];
  if (data.source_file && path.basename(data.source_file) === data.source_file) {
    const sourcePath = `${SOURCES_DIRECTORY}/${data.source_file}`;
    const source = inside(root, sourcePath, SOURCES_DIRECTORY + '/');
    try { const original = readDocument(source); writeDocument(source, { ...original.data, cover: data.cover, cover_position: data.cover_position }, original.body); paths.push(sourcePath); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return { title: `replace cover: ${data.title}`, paths, postPath, cover: data.cover };
}
export async function main(args) {
  const value = flag => args[args.indexOf(flag) + 1];
  try {
    if (!args.includes('--post') || !args.includes('--cover')) throw new Error('Missing --post or --cover.');
    const options = { coverPosition: args.includes('--cover-position') ? value('--cover-position') : undefined, noPush: args.includes('--no-push') };
    const cover = path.resolve(ROOT, value('--cover'));
    const operation = root => replaceCover(root, value('--post'), cover, options);
    const result = args.includes('--no-commit') && options.noPush ? await operation(ROOT) : await transact(ROOT, operation, options);
    report(ROOT, result);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
