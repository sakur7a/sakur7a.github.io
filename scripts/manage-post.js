import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, inside, listPosts, ASSETS, removeTree } from './lib/content.js';
import { transact, report } from './lib/transaction.js';
export function deletePost(root, postPath, options = {}) {
  const file = inside(root, postPath, '_posts/');
  if (!file.endsWith('.md')) throw new Error('Only Markdown posts may be deleted.');
  const basename = path.basename(file, '.md');
  const assetPath = `${ASSETS}/images/posts/${basename}`;
  const url = `/Blog/assets/images/posts/${basename}/`;
  const shared = options.deleteAssets && listPosts(root).some(post => post.postPath !== postPath && (post.body.includes(url) || post.cover.startsWith(url)));
  if (shared) throw new Error('Other posts reference these images; delete the post without its assets.');
  fs.unlinkSync(file);
  const paths = [postPath];
  if (options.deleteAssets) { removeTree(inside(root, assetPath, `${ASSETS}/images/posts/`)); paths.push(assetPath); }
  return { title: `delete ${basename}`, paths, removed: paths };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args[0] !== 'delete' || !args.includes('--post')) throw new Error('Usage: manage-post.js delete --post _posts/FILE.md [--assets]');
    const options = { deleteAssets: args.includes('--assets'), noPush: args.includes('--no-push') };
    const operation = root => deletePost(root, args[args.indexOf('--post') + 1], options);
    report(ROOT, args.includes('--no-commit') && options.noPush ? operation(ROOT) : await transact(ROOT, operation, options));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
