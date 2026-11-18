import fs from 'node:fs';
import path from 'node:path';
import { POSTS_DIRECTORY } from '../../src/config/content.js';
import { BLOG_ASSETS } from '../../src/config/site.js';
import { ROOT, inside, ASSETS, removeTree } from './lib/repository.js';
import { listPosts } from './lib/posts.js';
import { transact, report } from './lib/transaction.js';
export function deletePost(root, postPath, options = {}) {
  const file = inside(root, postPath, POSTS_DIRECTORY + '/');
  if (!file.endsWith('.md')) throw new Error('Only Markdown posts may be deleted.');
  const basename = path.basename(file, '.md');
  const assetPath = `${ASSETS}/images/posts/${basename}`;
  const url = `${BLOG_ASSETS}/images/posts/${basename}/`;
  const shared = options.deleteAssets && listPosts(root).some(post => post.postPath !== postPath && (post.body.includes(url) || post.cover.startsWith(url)));
  if (shared) throw new Error('Other posts reference these images; delete the post without its assets.');
  fs.unlinkSync(file);
  const paths = [postPath];
  if (options.deleteAssets) { removeTree(inside(root, assetPath, `${ASSETS}/images/posts/`)); paths.push(assetPath); }
  return { title: `delete ${basename}`, paths, removed: paths };
}
export async function main(args) {
  try {
    if (args[0] !== 'delete' || !args.includes('--post')) throw new Error('Usage: manage-post.js delete --post _posts/FILE.md [--assets]');
    const options = { deleteAssets: args.includes('--assets'), noPush: args.includes('--no-push') };
    const operation = root => deletePost(root, args[args.indexOf('--post') + 1], options);
    report(ROOT, args.includes('--no-commit') && options.noPush ? operation(ROOT) : await transact(ROOT, operation, options));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
