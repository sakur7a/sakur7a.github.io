import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { ROOT } from './lib/content.js';
const args = process.argv.slice(2);
const target = args.includes('--target') ? path.resolve(args[args.indexOf('--target') + 1]) : path.join(os.homedir(), 'Documents/Obsidian Vault/.obsidian/plugins/sakura-blog-publisher');
const source = path.join(ROOT, 'obsidian/.obsidian/plugins/sakura-blog-publisher');
fs.mkdirSync(target, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css']) {
  const data = fs.readFileSync(path.join(source, file));
  fs.writeFileSync(path.join(target, file), data);
  if (crypto.createHash('sha256').update(fs.readFileSync(path.join(target, file))).digest('hex') !== crypto.createHash('sha256').update(data).digest('hex')) throw new Error(`Plugin file mismatch: ${file}`);
}
console.log(`Synced plugin to ${target}. Reload it in Obsidian. Existing settings were preserved.`);
