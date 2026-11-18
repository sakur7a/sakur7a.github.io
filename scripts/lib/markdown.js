import fs from 'node:fs';
import path from 'node:path';
import { parse, stringify } from 'yaml';

export function readDocument(file) {
  const content = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)/);
  return { data: match ? parse(match[1]) || {} : {}, body: match ? match[2] : content };
}
export function writeDocument(file, data, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `---\n${stringify(data, { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' })}---\n\n${body.trimStart()}`, 'utf8');
}
export function assertPublic(data) {
  if (data.visibility != null && String(data.visibility).trim().toLowerCase() !== 'public') throw new Error('Private notes cannot be published to the public blog.');
}
