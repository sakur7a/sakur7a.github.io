import fs from 'node:fs';
import { BLOG_ASSETS, SITE_ORIGIN, blogPaths, legacyPostPermalink, postPermalinkPattern } from '../../src/config/site.js';
import { outputFile } from './output.js';

// Keep previously published font URLs while maintaining one font source directory.
fs.cpSync(outputFile('/assets/fonts/jinkai'), outputFile(`${BLOG_ASSETS}/fonts/jinkai`), { recursive: true });
for (const excluded of ['obsidian', '_posts', 'content', 'scripts', 'tools', 'tests', 'docs', 'package.json', '.publisher-cache']) {
  if (fs.existsSync(outputFile(excluded))) throw new Error(`Non-public content in output: ${excluded}`);
}
if (!fs.existsSync(outputFile('/index.html'))) throw new Error('Missing homepage');

const entries = JSON.parse(fs.readFileSync(outputFile(blogPaths.search), 'utf8'));
const seen = new Set();
for (const { url } of entries) {
  if (!postPermalinkPattern.test(url) || !url.endsWith('/') || seen.has(url)) {
    throw new Error(`Invalid or duplicate blog route: ${url}`);
  }
  seen.add(url);
  const file = outputFile(url + 'index.html');
  if (!fs.existsSync(file)) throw new Error(`Missing blog route: ${url}`);
  const html = fs.readFileSync(file, 'utf8');
  const canonical = `<link rel="canonical" href="${new URL(url, SITE_ORIGIN).href}`;
  if (!html.includes(canonical)) throw new Error(`Wrong canonical URL: ${url}`);
  const oldUrl = legacyPostPermalink(url);
  const redirect = outputFile(oldUrl);
  if (!fs.existsSync(redirect) || !fs.readFileSync(redirect, 'utf8').includes(canonical)) {
    throw new Error(`Missing compatibility redirect: ${oldUrl}`);
  }
  if (/(?:src|href)="[^"\n]*(?:\{\{|!\[\[)/.test(html)) throw new Error(`Unconverted image or link reference: ${url}`);
  const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  if (image) {
    const cover = new URL(image);
    if (cover.origin === SITE_ORIGIN && !fs.existsSync(outputFile(cover.pathname))) {
      throw new Error(`Missing cover: ${image}`);
    }
  }
}
console.log(`Public output verified: homepage and ${entries.length} posts.`);
