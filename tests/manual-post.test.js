import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const project = path.resolve(import.meta.dirname, '..');

test('a handwritten Markdown post builds in a site-only checkout', t => {
  const temporary = path.resolve(os.tmpdir());
  const root = fs.mkdtempSync(path.join(temporary, 'sakura-manual-post-'));
  const links = ['node_modules', 'public'];
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), temporary);
    for (const name of links) {
      const link = path.join(root, name);
      if (fs.existsSync(link)) fs.unlinkSync(link);
    }
    fs.rmSync(root, { recursive: true, force: true });
  });

  for (const name of ['src', 'astro.config.mjs', 'content', 'scripts/site']) {
    fs.cpSync(path.join(project, name), path.join(root, name), { recursive: true });
  }
  for (const name of links) {
    fs.symlinkSync(path.join(project, name), path.join(root, name), 'junction');
  }
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
  fs.mkdirSync(path.join(root, '_posts'));
  fs.writeFileSync(path.join(root, '_posts/2026-11-18-manual-example.md'), [
    '---',
    'title: Handwritten article',
    'date: 2026-11-18',
    'slug: manual-example',
    '---',
    '',
    'A directly committed Markdown article.',
  ].join('\n'));

  const astroPackage = path.join(project, 'node_modules/astro');
  const astro = JSON.parse(fs.readFileSync(path.join(astroPackage, 'package.json'), 'utf8'));
  execFileSync(process.execPath, [path.join(astroPackage, astro.bin.astro), 'build'], { cwd: root });
  execFileSync(process.execPath, ['scripts/site/check-build-output.js'], { cwd: root });

  const url = '/Blog/2026-11-18/manual-example.html';
  const read = file => fs.readFileSync(path.join(root, 'dist', file), 'utf8');
  assert.match(read(url), /A directly committed Markdown article/);
  for (const file of ['Blog/index.html', 'Blog/archive.html', 'Blog/search.json', 'Blog/feed.xml', 'Blog/sitemap.xml', 'sitemap.xml']) {
    assert.ok(read(file).includes(url), file);
  }
});
