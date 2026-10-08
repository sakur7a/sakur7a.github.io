import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, inside, readDocument, writeDocument, copyImage, ASSETS, assertPublic } from './lib/content.js';
import { transact, report } from './lib/transaction.js';
export async function replaceCover(root, postPath, coverPath, options = {}) {
  const file = inside(root, postPath, '_posts/');
  const { data, body } = readDocument(file);
  assertPublic(data);
  const basename = path.basename(file, '.md');
  const assetPath = `${ASSETS}/images/posts/${basename}`;
  const filename = await copyImage(coverPath, inside(root, assetPath, `${ASSETS}/images/posts/`), `cover${path.extname(coverPath).toLowerCase()}`);
  data.cover = `/Blog/assets/images/posts/${basename}/${filename}`;
  data.cover_position = options.coverPosition || data.cover_position || '50% 50%';
  writeDocument(file, data, body);
  const paths = [postPath, assetPath];
  if (data.source_file && path.basename(data.source_file) === data.source_file) {
    const sourcePath = `obsidian/Published/${data.source_file}`;
    const source = inside(root, sourcePath, 'obsidian/Published/');
    try { const original = readDocument(source); writeDocument(source, { ...original.data, cover: data.cover, cover_position: data.cover_position }, original.body); paths.push(sourcePath); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return { title: `replace cover: ${data.title}`, paths, postPath, cover: data.cover };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
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
