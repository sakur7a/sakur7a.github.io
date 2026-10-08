import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { readDocument, writeDocument, transformDraft, listPosts, ASSETS, removeTree } from '../scripts/lib/content.js';
import { replaceCover } from '../scripts/replace-cover.js';
import { deletePost } from '../scripts/manage-post.js';
import { createPage, setHeaderImage, deletePage, removePage, pushPages } from '../scripts/manage-pages.js';
import { runPublisher } from '../scripts/obsidian-publish.js';
import { transact, git } from '../scripts/lib/transaction.js';

function temporary(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sakura-test-'));
  t.after(() => { assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)); removeTree(root); });
  return root;
}
async function image(file, color = 'red') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp({ create: { width: 8, height: 8, channels: 4, background: color } }).png().toFile(file);
}
function repository(t) {
  const directory = temporary(t);
  const root = path.join(directory, 'development');
  const remote = path.join(directory, 'remote.git');
  fs.mkdirSync(root);
  git(root, ['init', '-b', 'main']);
  git(root, ['config', 'user.name', 'Test']);
  git(root, ['config', 'user.email', 'test@example.com']);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/content.config.ts'), '// unified fixture\n');
  fs.mkdirSync(path.join(root, 'content/pages'), { recursive: true });
  writeDocument(path.join(root, 'content/pages/about.md'), { title: 'About' }, 'About\n');
  fs.writeFileSync(path.join(root, '.gitignore'), '.publisher-cache/\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'Initial unified site']);
  git(root, ['init', '--bare', '-b', 'main', remote]);
  git(root, ['remote', 'add', 'origin', remote]);
  git(root, ['push', '-u', 'origin', 'main']);
  git(root, ['switch', '-c', 'codex/development']);
  fs.writeFileSync(path.join(root, 'src/content.config.ts'), '// uncommitted development\n');
  fs.writeFileSync(path.join(root, 'private-untracked.md'), 'DO NOT PUBLISH');
  return { root, directory, remote };
}

test('new publication converts nested Chinese images and preserves TeX and source', async t => {
  const root = temporary(t);
  const vault = path.join(root, 'vault');
  const draft = path.join(vault, '中文稿.md');
  await image(path.join(vault, 'a/图.png'));
  await image(path.join(vault, 'b/图.png'), 'blue');
  const formula = '\\frac{x_i}{n} + \\text{中文}';
  writeDocument(draft, { title: '中文稿', date: '2026-06-12 00:30:00 +0800', slug: '2026-6-12', categories: ['学习'] }, `![[a/图.png]]\n\n![[b/图.png|200]]\n\n$$\n${formula}\n$$\n`);
  const result = await transformDraft(root, draft, { vaultRoot: vault });
  assert.equal(result.permalink, '/Blog/2026-06-12/2026-6-12.html');
  const post = readDocument(path.join(root, result.postPath));
  assert.equal(post.data.slug, '2026-6-12');
  assert.ok(post.body.includes(formula));
  assert.doesNotMatch(post.body, /!\[\[/);
  const files = fs.readdirSync(path.join(root, result.assetPath));
  assert.equal(files.length, 2);
  assert.notEqual(files[0], files[1]);
  assert.ok(files.every(file => file.endsWith('.webp')));
  assert.match(readDocument(path.join(root, result.sourcePath)).body, /!\[\[a\/图.png\]\]/);
});

test('republish keeps first date, existing cover, and existing compressed attachments', async t => {
  const root = temporary(t);
  const draft = path.join(root, 'vault/source.md');
  const cover = path.join(root, 'cover.png');
  await image(cover);
  await image(path.join(root, 'vault/photo.png'));
  writeDocument(draft, { title: 'Original', date: '2026-05-06 20:00:00 +0800', slug: 'demo', categories: ['学习'] }, '![[photo.png]]\n');
  const first = await transformDraft(root, draft, { cover });
  fs.rmSync(path.join(root, 'vault/photo.png'));
  writeDocument(draft, { title: 'Updated title', date: '2026-10-07 12:00:00 +0800', slug: 'demo' }, '![[photo.png]]\n');
  const second = await transformDraft(root, draft, { date: '2026-10-07 12:00:00 +0800' });
  const post = readDocument(path.join(root, second.postPath));
  assert.equal(first.postPath, second.postPath);
  assert.equal(post.data.date, '2026-05-06 20:00:00 +0800');
  assert.match(post.data.cover, /cover.webp$/);
  assert.match(post.body, /photo.webp/);
  assert.equal(listPosts(root).length, 1);
});

test('private content is rejected before creating public files or fetching Git', async t => {
  const root = temporary(t);
  const draft = path.join(root, 'private.md');
  writeDocument(draft, { title: 'Private', visibility: 'private' }, 'secret');
  const before = fs.readFileSync(draft);
  await assert.rejects(runPublisher({ draft }, root), /Private notes cannot/);
  assert.equal(fs.existsSync(path.join(root, '_posts')), false);
  assert.deepEqual(fs.readFileSync(draft), before);
});

test('publish uses remote main and leaves dirty and staged development files unchanged', async t => {
  const { root, directory, remote } = repository(t);
  const draft = path.join(directory, 'source.md');
  writeDocument(draft, { title: 'Published', date: '2026-10-07 12:00:00 +0800', slug: 'published' }, 'public content');
  fs.writeFileSync(path.join(root, 'staged-private.md'), 'staged secret');
  git(root, ['add', 'staged-private.md']);
  const before = git(root, ['status', '--porcelain']);
  const head = git(root, ['rev-parse', 'HEAD']);
  const result = await runPublisher({ draft }, root);
  assert.equal(result.pushed, true);
  assert.equal(git(root, ['status', '--porcelain']), before);
  assert.equal(git(root, ['rev-parse', 'HEAD']), head);
  assert.equal(git(remote, ['ls-tree', '-r', '--name-only', 'main']).includes('private'), false);
  assert.ok(git(remote, ['show', 'main:_posts/2026-10-07-published.md']).includes('public content'));
  assert.equal(git(root, ['worktree', 'list', '--porcelain']).match(/^worktree /gm).length, 1);
  const again = await runPublisher({ draft }, root);
  assert.equal(again.pushed, false);
});

test('failed worktree operation cleans up and cannot damage the development tree', async t => {
  const { root } = repository(t);
  const before = git(root, ['status', '--porcelain']);
  await assert.rejects(transact(root, worktree => { fs.writeFileSync(path.join(worktree, 'oops.md'), 'temporary'); throw new Error('Conversion failed'); }), /Conversion failed/);
  assert.equal(git(root, ['status', '--porcelain']), before);
  assert.equal(git(root, ['worktree', 'list', '--porcelain']).match(/^worktree /gm).length, 1);
});

test('cover replacement and deletion publish only their content paths', async t => {
  const { root, directory, remote } = repository(t);
  const draft = path.join(directory, 'article.md');
  writeDocument(draft, { title: 'Article', date: '2026-10-07 12:00:00 +0800', slug: 'article' }, 'body');
  const first = await runPublisher({ draft }, root);
  const cover = path.join(directory, 'new-cover.png');
  await image(cover);
  const before = git(root, ['status', '--porcelain']);
  await transact(root, worktree => replaceCover(worktree, first.postPath, cover, { coverPosition: '25% 50%' }));
  assert.match(git(remote, ['show', `main:${first.postPath}`]), /25% 50%/);
  assert.match(git(remote, ['show', 'main:obsidian/Published/article.md']), /25% 50%/);
  await transact(root, worktree => deletePost(worktree, first.postPath, { deleteAssets: true }));
  assert.equal(git(remote, ['ls-tree', '--name-only', 'main', '--', first.postPath]), '');
  assert.equal(git(root, ['status', '--porcelain']), before);
  assert.throws(() => deletePost(root, '../private-untracked.md'), /escapes/);
});

test('page management publishes pages and images without including unrelated staged files', async t => {
  const { root, remote } = repository(t);
  const page = createPage(root, '中文 页面');
  setHeaderImage(root, page.path, '/Blog/assets/images/site/header.webp', '20% 30%');
  const siteImage = path.join(root, ASSETS, 'images/site/header.webp');
  fs.mkdirSync(path.dirname(siteImage), { recursive: true });
  fs.writeFileSync(siteImage, 'fixture');
  const before = git(root, ['status', '--porcelain']);
  const result = await pushPages(root);
  assert.equal(result.pushed, true);
  assert.match(git(remote, ['show', `main:${page.path}`]), /中文 页面/);
  assert.equal(git(root, ['status', '--porcelain']), before);
  const deletion = await transact(root, worktree => {
    assert.ok(git(worktree, ['ls-files', '--', page.path]), `Expected tracked page; index: ${git(worktree, ['ls-files'])}`);
    const result = deletePage(worktree, page.path);
    assert.equal(fs.existsSync(path.join(worktree, page.path)), false);
    assert.match(git(worktree, ['-c', 'core.fsmonitor=false', 'status', '--porcelain']), /D /);
    return result;
  });
  assert.equal(deletion.pushed, true, JSON.stringify(deletion));
  assert.equal(git(remote, ['ls-tree', '--name-only', 'main', '--', page.path]), '');
  assert.throws(() => createPage(root, 'archive'), /reserved/);
});

test('slug change replaces the original post and keeps its first publication date', async t => {
  const root = temporary(t);
  const draft = path.join(root, 'draft.md');
  writeDocument(draft, { title: 'Rename', date: '2026-05-06 20:00:00 +0800', slug: 'old' }, 'body');
  const old = await transformDraft(root, draft);
  const changed = await transformDraft(root, draft, { slug: 'new' });
  assert.equal(fs.existsSync(path.join(root, old.postPath)), false);
  assert.equal(listPosts(root).length, 1);
  assert.equal(changed.permalink, '/Blog/2026-05-06/new.html');
});

test('a different source cannot overwrite an existing date and slug', async t => {
  const root = temporary(t);
  const first = path.join(root, 'first.md');
  const second = path.join(root, 'second.md');
  writeDocument(first, { title: 'First', slug: 'same', date: '2026-10-07 12:00:00 +0800' }, 'first content');
  const post = await transformDraft(root, first);
  const bytes = fs.readFileSync(path.join(root, post.postPath));
  writeDocument(second, { title: 'Second', slug: 'same', date: '2026-10-07 12:00:00 +0800' }, 'second content');
  await assert.rejects(transformDraft(root, second), /different post already uses/);
  assert.deepEqual(fs.readFileSync(path.join(root, post.postPath)), bytes);
});

test('concurrent publishing refreshes remote main and retains the other update', async t => {
  const { root, directory, remote } = repository(t);
  const peer = path.join(directory, 'peer');
  git(root, ['clone', remote, peer]);
  git(peer, ['config', 'user.name', 'Peer']);
  git(peer, ['config', 'user.email', 'peer@example.com']);
  let attempts = 0;
  const before = git(root, ['status', '--porcelain']);
  const result = await transact(root, worktree => {
    attempts++;
    writeDocument(path.join(worktree, '_posts/2026-10-07-retry.md'), { title: 'Retry' }, 'retried publication');
    if (attempts === 1) {
      writeDocument(path.join(peer, 'content/pages/peer.md'), { title: 'Peer' }, 'concurrent change');
      git(peer, ['add', 'content/pages/peer.md']);
      git(peer, ['commit', '-m', 'Concurrent page']);
      git(peer, ['push', 'origin', 'main']);
    }
    return { title: 'retry', paths: ['_posts/2026-10-07-retry.md'] };
  });
  assert.equal(result.pushed, true);
  assert.equal(attempts, 2);
  assert.match(git(remote, ['show', 'main:content/pages/peer.md']), /concurrent change/);
  assert.match(git(remote, ['show', 'main:_posts/2026-10-07-retry.md']), /retried publication/);
  assert.equal(git(root, ['status', '--porcelain']), before);
});

test('deleting a local page draft updates the manager without publishing unrelated changes', async t => {
  const { root, remote } = repository(t);
  const head = git(remote, ['rev-parse', 'main']);
  const page = createPage(root, 'Local draft');
  const result = await removePage(root, page.path);
  assert.equal(result.localDeleted, true);
  assert.equal(result.pushed, false);
  assert.equal(fs.existsSync(path.join(root, page.path)), false);
  assert.equal(git(remote, ['rev-parse', 'main']), head);
  assert.equal(fs.readFileSync(path.join(root, 'private-untracked.md'), 'utf8'), 'DO NOT PUBLISH');
});

test('all migrated posts retain explicit original sources', () => {
  const posts = listPosts();
  assert.equal(posts.length, 12);
  assert.equal(new Set(posts.map(post => post.data.source_file)).size, 12);
  for (const post of posts) {
    assert.ok(post.data.source_file, post.postPath);
    assert.ok(post.sourcePath, post.postPath);
  }
});
