import fs from 'node:fs';
import path from 'node:path';
import { ROOT, listPosts, inside, removeTree } from './lib/content.js';
import { git } from './lib/transaction.js';

let posts = listPosts();
if (process.argv.includes('--remote')) {
  git(ROOT, ['fetch', 'origin', 'main']);
  if (!git(ROOT, ['ls-tree', '--name-only', 'origin/main', '--', 'src/content.config.ts'])) throw new Error('统一站点还未切换到 main，暂时无法管理已发布文章。');
  const cache = inside(ROOT, '.publisher-cache');
  const files = git(ROOT, ['ls-tree', '-r', '--name-only', 'origin/main', '--', '_posts', 'obsidian/Published']).split('\n').filter(Boolean);
  // Refresh only this ignored, reproducible read cache; never change the development content.
  removeTree(cache);
  for (const relative of files) {
    const destination = path.join(cache, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, git(ROOT, ['show', `origin/main:${relative}`]) + '\n');
  }
  posts = listPosts(cache).map(post => ({ ...post, sourcePath: post.sourcePath ? `.publisher-cache/${post.sourcePath}` : '' }));
}
process.stdout.write(JSON.stringify(posts.map(({ data, body, ...post }) => post), null, 2));
