import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLOG_ASSETS, SITE_ORIGIN } from '../../src/config/site.js';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const ASSETS = `public${BLOG_ASSETS}`;
export const ASTRO_CONTENT_CONFIG = 'src/content.config.ts';

// unlink/rmdir also handle CJK paths on the installed Windows Node runtime.
export function removeTree(file) {
  if (!fs.existsSync(file)) return;
  if (fs.lstatSync(file).isDirectory()) {
    for (const name of fs.readdirSync(file)) removeTree(path.join(file, name));
    fs.rmdirSync(file);
  } else fs.unlinkSync(file);
}
export function inside(root, relative, prefix = '') {
  if (!relative || path.isAbsolute(relative)) throw new Error(`Expected a repository-relative path: ${relative}`);
  const full = path.resolve(root, relative);
  const normalized = path.relative(root, full).replaceAll('\\', '/');
  if (normalized.startsWith('../') || normalized === '..' || (prefix && !normalized.startsWith(prefix))) throw new Error(`Path escapes permitted directory: ${relative}`);
  return full;
}

export function publicFile(root, url) {
  const parsed = new URL(url, SITE_ORIGIN);
  if (parsed.origin !== SITE_ORIGIN) throw new Error('Expected a local site asset.');
  return inside(root, `public${decodeURIComponent(parsed.pathname)}`, 'public/');
}
