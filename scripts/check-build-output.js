import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SITE, listPosts, publicFile } from './lib/content.js';
const output = path.join(ROOT, 'dist');
// Keep previously published font URLs while maintaining one font source directory.
fs.cpSync(path.join(output, 'assets/fonts/jinkai'), path.join(output, 'Blog/assets/fonts/jinkai'), { recursive: true });
for (const excluded of ['obsidian', '_posts', 'content', 'scripts', 'tests', 'docs', 'package.json', '.publisher-cache']) {
  if (fs.existsSync(path.join(output, excluded))) throw new Error(`Non-public content in output: ${excluded}`);
}
for (const post of listPosts()) {
  const file = path.join(output, post.relativeUrl.slice(1));
  if (!fs.existsSync(file)) throw new Error(`Missing original route: ${post.relativeUrl}`);
  const html = fs.readFileSync(file, 'utf8');
  if (/(?:src|href)="[^"\n]*(?:\{\{|!\[\[)/.test(html)) throw new Error(`Unconverted image or link reference: ${post.relativeUrl}`);
  if (post.cover && (post.cover.startsWith('/') || post.cover.startsWith(SITE + '/')) && !fs.existsSync(publicFile(ROOT, post.cover))) throw new Error(`Missing cover: ${post.cover}`);
}
console.log(`Public output verified: homepage and ${listPosts().length} posts; source notes excluded.`);
