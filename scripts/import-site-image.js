import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, ASSETS, inside, copyImage } from './lib/content.js';
try {
  const args = process.argv.slice(2);
  const flag = args.includes('--source') ? '--source' : args.includes('--image') ? '--image' : '--file';
  if (!args.includes(flag)) throw new Error('Missing --image path.');
  const source = path.resolve(ROOT, args[args.indexOf(flag) + 1]);
  const name = `${path.basename(source, path.extname(source)).replace(/[^\p{L}\p{N}._-]+/gu, '-')}-${crypto.randomBytes(4).toString('hex')}${path.extname(source)}`;
  const filename = await copyImage(source, inside(ROOT, `${ASSETS}/images/site/`, `${ASSETS}/images/`), name);
  process.stdout.write(JSON.stringify({ url: `/Blog/assets/images/site/${filename}`, image: `/Blog/assets/images/site/${filename}` }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
