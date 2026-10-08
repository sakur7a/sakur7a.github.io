import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import sharp from 'sharp';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { git } from '../scripts/lib/transaction.js';
import { readDocument, writeDocument, removeTree, ASSETS } from '../scripts/lib/content.js';
const require = createRequire(import.meta.url);
const source = fs.readFileSync('obsidian/.obsidian/plugins/sakura-blog-publisher/main.js', 'utf8');

function loadPlugin(settings = { blogRoot: 'X:/nonexistent-test-root' }) {
  const commands = [];
  const opened = [];
  const notices = [];
  const saved = [];
  class Modal { constructor(app) { this.app = app; } open() { opened.push(this); } close() { this.closed = true; } }
  class FuzzySuggestModal extends Modal { setPlaceholder(value) { this.placeholder = value; } }
  class Plugin {
    async loadData() { return settings; }
    async saveData(value) { saved.push({ ...value }); }
    addCommand(command) { commands.push(command); }
    addRibbonIcon() {}
    addSettingTab() {}
  }
  const module = { exports: {} };
  const obsidian = { parseYaml: parse, Modal, FuzzySuggestModal, Plugin, PluginSettingTab: class {}, Setting: class {}, MarkdownRenderer: {}, Component: class {}, Notice: class { constructor(message) { notices.push(message); } } };
  vm.runInNewContext(source, { module, require: name => name === 'obsidian' ? obsidian : name === 'electron' ? { shell: null } : require(name), console: { log() {}, warn() {}, error() {} }, Buffer, URL, setTimeout, clearTimeout });
  const plugin = new module.exports();
  return { plugin, commands, opened, notices, saved };
}

test('Hearth command opens the picker and carries the selected note into the publish modal', async () => {
  const { plugin, commands, opened } = loadPlugin();
  const file = { path: '学习/待发布.md', basename: '待发布' };
  plugin.app = { vault: { getMarkdownFiles: () => [file] } };
  plugin.injectStyles = () => {};
  await plugin.onload();
  const choose = commands.find(command => command.id === 'select-post-to-publish');
  assert.ok(choose);
  assert.ok(commands.find(command => command.id === 'manage-content'));
  assert.equal(commands.some(command => command.id.includes('private-site')), false);
  choose.callback();
  const picker = opened.at(-1);
  assert.equal(picker.getItems()[0], file);
  picker.onChooseItem(file);
  const modal = opened.at(-1);
  assert.equal(modal.constructor.name, 'ManageContentModal');
  assert.equal(modal.selectedFile, file);
  assert.equal(modal.activeTab, 'publish');
  commands.find(command => command.id === 'manage-content').callback();
  assert.equal(opened.at(-1).activeTab, 'posts');
});

test('private submission does not edit the note or invoke a publisher', async () => {
  const { plugin, notices } = loadPlugin();
  plugin.settings = { blogRoot: 'X:/nonexistent-test-root' };
  plugin.app = { vault: { modify: () => assert.fail('Private note was edited') } };
  plugin.runNode = () => assert.fail('Private content reached the CLI');
  await plugin.publishDraft({}, { visibility: 'private', coverPath: '' });
  assert.ok(notices.some(message => String(message).includes('不会提交')));
});

test('public submission uses the existing node interface and reports submission separately from deployment', async () => {
  const { plugin } = loadPlugin();
  plugin.settings = { blogRoot: 'X:/nonexistent-test-root' };
  let args;
  let message;
  let modified;
  plugin.app = { vault: { adapter: { getBasePath: () => 'C:/vault' }, read: async () => '---\ntitle: Demo\n---\nlatest body', modify: async (_file, content) => { modified = content; } } };
  plugin.runNode = async value => {
    if (value[0] === 'scripts/publisher-status.js') return JSON.stringify({ ready: true });
    args = value;
    return 'Content submitted.\nGitHub Actions: https://github.com/sakur7a/sakur7a.github.io/actions/workflows/pages.yml';
  };
  plugin.showDeploymentNotice = (_output, text) => { message = text; };
  await plugin.publishDraft({ file: {}, content: '---\ntitle: Demo\n---\nbody', publishPath: 'C:/vault/demo.md' }, { title: 'Demo', visibility: 'public', category: '学习', summary: 'summary', slug: 'demo', coverPath: '' });
  assert.equal(args[0], 'scripts/obsidian-publish.js');
  assert.ok(args.includes('--vault-root'));
  assert.ok(message.includes('已提交'));
  assert.ok(message.includes('正在检查'));
  assert.match(modified, /latest body$/);
});

test('a quoted private marker with a YAML comment remains private in the modal', async () => {
  const { plugin } = loadPlugin();
  plugin.settings = { blogRoot: 'X:/nonexistent-test-root' };
  const file = { path: 'private.md', extension: 'md' };
  plugin.app = { vault: { adapter: { getBasePath: () => 'C:/vault' }, read: async () => '---\ntitle: Private\nvisibility: "private" # keep local\n---\nprivate text' } };
  const draft = await plugin.getActiveDraft(file);
  assert.equal(draft.metadata.visibility, 'private');
});

test('old default project settings migrate once while custom settings stay intact', async () => {
  const old = loadPlugin({ blogRoot: 'd:/MyBlog/', lastSubmission: 'a'.repeat(40), customSetting: 'keep' });
  old.plugin.injectStyles = () => {};
  await old.plugin.onload();
  assert.equal(old.plugin.settings.blogRoot, 'D:\\MyHomepage\\sakur7a.github.io');
  assert.equal(old.plugin.settings.lastSubmission, undefined);
  assert.equal(old.plugin.settings.customSetting, 'keep');
  assert.equal(old.saved.length, 1);
  const custom = loadPlugin({ blogRoot: 'X:/my-custom-project', lastSubmission: 'b'.repeat(40) });
  custom.plugin.injectStyles = () => {};
  await custom.plugin.onload();
  assert.equal(custom.plugin.settings.blogRoot, 'X:/my-custom-project');
  assert.equal(custom.plugin.settings.lastSubmission, 'b'.repeat(40));
  assert.equal(custom.saved.length, 0);
});

test('a BOM does not hide private front matter from the plugin', async () => {
  const { plugin } = loadPlugin();
  plugin.settings = { blogRoot: 'X:/nonexistent-test-root' };
  plugin.runNode = () => assert.fail('Private note reached Git');
  const file = { path: 'private.md', extension: 'md' };
  plugin.app = { vault: { adapter: { getBasePath: () => 'C:/vault' }, read: async () => '\uFEFF---\nvisibility: private\n---\nsecret' } };
  const draft = await plugin.getActiveDraft(file);
  assert.equal(draft.metadata.visibility, 'private');
});

test('publishing rechecks a note marked private while the modal was open', async () => {
  const { plugin } = loadPlugin();
  plugin.settings = { blogRoot: 'X:/nonexistent-test-root' };
  plugin.runNode = async args => {
    assert.equal(args[0], 'scripts/publisher-status.js');
    return JSON.stringify({ ready: true });
  };
  plugin.app = { vault: { read: async () => '---\nvisibility: private\n---\nsecret', modify: () => assert.fail('A private update was overwritten') } };
  const draft = { file: { path: 'changed.md' }, metadata: { visibility: 'public' } };
  assert.equal(await plugin.publishDraft(draft, { visibility: 'public' }), false);
});

test('legacy draft selection recovers the published slug before a republish', async () => {
  const { plugin } = loadPlugin();
  plugin.settings = { blogRoot: 'X:/nonexistent-test-root' };
  plugin.listPublishedPosts = async () => [{ sourcePath: '.publisher-cache/obsidian/Published/2026.6.12.md', slug: '2026-6-12' }];
  plugin.app = { vault: { adapter: { getBasePath: () => 'C:/vault' }, read: async () => '---\ncategories: [moments]\n---\noriginal body' } };
  const draft = await plugin.getActiveDraft({ path: '博客/Moments/2026.6.12.md', extension: 'md' });
  assert.equal(draft.metadata.slug, '2026-6-12');
});

test('new untitled Moments use their note names to get distinct slugs', async () => {
  const { plugin, opened } = loadPlugin();
  const slugs = [];
  plugin.publishDraft = async (_draft, metadata) => { slugs.push(metadata.slug); return true; };
  for (const filename of ['2026.10.8.md','2026.10.9.md']) {
    plugin.openPublishModal({ path: filename });
    const modal = opened.at(-1);
    modal.draft = { file: { path: filename } };
    modal.publishMeta = { category: 'moments', title: '', summary: '', slug: '' };
    modal.publishButton = { disabled: false };
    await modal.submitPublish();
  }
  assert.notEqual(slugs[0], slugs[1]);
});

test('pending migration blocks publishing before any vault edit', async () => {
  const { plugin, notices } = loadPlugin();
  plugin.settings = { blogRoot: 'X:/nonexistent-test-root' };
  plugin.app = { vault: { modify: () => assert.fail('Pending migration changed a note'), read: () => assert.fail('Publishing started') } };
  plugin.runNode = async args => {
    assert.equal(args[0], 'scripts/publisher-status.js');
    return JSON.stringify({ ready: false, message: '等待网站切换' });
  };
  assert.equal(await plugin.publishDraft({}, { visibility: 'public' }), false);
  assert.ok(notices.some(message => String(message).includes('等待网站切换')));
});

test('ambiguous visibility cannot be converted into public metadata', async () => {
  const { plugin } = loadPlugin();
  plugin.settings = { blogRoot: 'X:/nonexistent-test-root' };
  plugin.app = { vault: { modify: () => assert.fail('Unknown visibility changed a note') } };
  plugin.runNode = () => assert.fail('Unknown visibility reached Git');
  assert.equal(await plugin.publishDraft({}, { visibility: 'unknown' }), false);
});

test('the publish modal stays open after failure and prevents duplicate submissions', async () => {
  const { plugin, opened } = loadPlugin();
  plugin.openPublishModal({ path: 'draft.md' });
  const modal = opened.at(-1);
  modal.draft = { file: { path: 'draft.md' } };
  modal.publishMeta = { category: '学习', title: 'Draft', summary: 'Summary', slug: 'draft' };
  modal.publishButton = { disabled: false };
  modal.updatePublishReadiness = () => { modal.publishButton.disabled = false; };
  let finish;
  let attempts = 0;
  plugin.publishDraft = () => { attempts++; return new Promise(resolve => { finish = resolve; }); };
  const first = modal.submitPublish();
  assert.equal(modal.publishButton.disabled, true);
  await modal.submitPublish();
  assert.equal(attempts, 1);
  finish(false);
  await first;
  assert.equal(modal.submitted, false);
  assert.equal(modal.closed, undefined);
  assert.equal(modal.publishButton.disabled, false);
  plugin.publishDraft = async () => true;
  await modal.submitPublish();
  assert.equal(modal.submitted, true);
  assert.equal(modal.closed, true);
});

function publisherFixture(t, unified = true) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sakura-plugin-flow-'));
  const root = path.join(directory, 'development');
  const remote = path.join(directory, 'remote.git');
  const vault = path.join(directory, 'writing-vault');
  const project = fileURLToPath(new URL('../', import.meta.url));
  const modules = path.join(root, 'node_modules');
  t.after(() => {
    assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
    if (fs.existsSync(modules)) fs.unlinkSync(modules);
    removeTree(directory);
  });
  fs.mkdirSync(root);
  fs.mkdirSync(vault);
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules/\n.publisher-cache/\n.obsidian-cover-upload/\n');
  fs.cpSync(path.join(project, 'scripts'), path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src'));
  if (unified) fs.writeFileSync(path.join(root, 'src/content.config.ts'), '// unified site\n');
  writeDocument(path.join(root, 'content/pages/about.md'), { title: 'About' }, 'About\n');
  git(root, ['init', '-b', 'main']);
  git(root, ['config', 'user.name', 'Plugin Test']);
  git(root, ['config', 'user.email', 'plugin-test@example.com']);
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'Initial site']);
  git(root, ['init', '--bare', '-b', 'main', remote]);
  git(root, ['remote', 'add', 'origin', remote]);
  git(root, ['push', '-u', 'origin', 'main']);
  git(root, ['switch', '-c', 'codex/development']);
  fs.writeFileSync(path.join(root, 'src/content.config.ts'), '// local development\n');
  fs.writeFileSync(path.join(root, 'private-development.md'), 'DO NOT PUBLISH');
  git(root, ['add', 'private-development.md']);
  fs.symlinkSync(path.join(project, 'node_modules'), modules, 'junction');
  const runtime = loadPlugin({ blogRoot: root });
  runtime.plugin.injectStyles = () => {};
  runtime.plugin.app = { vault: {
    adapter: { getBasePath: () => vault },
    read: async file => fs.readFileSync(path.join(vault, file.path), 'utf8'),
    modify: async (file, content) => fs.writeFileSync(path.join(vault, file.path), content),
  } };
  return { ...runtime, root, remote, vault, directory };
}

test('installed plugin interface publishes, republishes, replaces covers and manages content in an isolated repository', async t => {
  const { plugin, saved, root, remote, vault, directory } = publisherFixture(t);
  await plugin.onload();
  const before = git(root, ['status', '--porcelain']);
  const head = git(root, ['rev-parse', 'HEAD']);
  const file = { path: 'article.md', extension: 'md' };
  const sourceFile = path.join(vault, file.path);
  const image = path.join(vault, 'attachment.png');
  await sharp({ create: { width: 8, height: 8, channels: 4, background: 'red' } }).png().toFile(image);
  writeDocument(sourceFile, { title: 'Plugin Article', slug: 'plugin-article', date: '2026-10-08 12:00:00 +0800', visibility: 'public' }, 'First body\n\n$$x^2$$\n\n![[attachment.png]]\n');
  const draft = await plugin.getActiveDraft(file);
  assert.equal(await plugin.publishDraft(draft, { ...draft.metadata, summary: 'A real plugin flow' }), true);
  let posts = await plugin.listPublishedPosts();
  assert.equal(posts.length, 1);
  assert.match(posts[0].sourcePath, /^\.publisher-cache\//);
  assert.equal(plugin.settings.lastSubmission, git(remote, ['rev-parse', 'main']));
  assert.match(git(remote, ['show', `main:${posts[0].postPath}`]), /\$\$x\^2\$\$/);
  fs.writeFileSync(path.join(root, posts[0].sourcePath), fs.readFileSync(path.join(root, posts[0].sourcePath), 'utf8').replace('First body', 'Republished body'));
  await plugin.republishManagedPost(posts[0]);
  assert.match(git(remote, ['show', `main:${posts[0].postPath}`]), /Republished body/);
  assert.equal(plugin.settings.lastSubmission, git(remote, ['rev-parse', 'main']));
  const cover = path.join(directory, 'cover.png');
  await sharp({ create: { width: 8, height: 8, channels: 4, background: 'blue' } }).png().toFile(cover);
  await plugin.replaceCoverForPost(posts[0], cover, '25% 50%');
  const covered = parse(git(remote, ['show', `main:${posts[0].postPath}`]).split('---')[1]);
  assert.equal(covered.cover_position, '25% 50%');
  assert.equal(covered.date, '2026-10-08 12:00:00 +0800');
  const page = await plugin.createPage('临时页面');
  await plugin.setPageHeaderImage(page.path, '/Blog/assets/images/site/header.webp', '20% 30%');
  const headerFile = path.join(root, ASSETS, 'images/site/header.webp');
  fs.mkdirSync(path.dirname(headerFile), { recursive: true });
  fs.copyFileSync(cover, headerFile);
  const beforePagePush = git(root, ['status', '--porcelain']);
  await plugin.showDeploymentNotice(await plugin.pushPages(), '页面已提交');
  assert.equal(git(root, ['status', '--porcelain']), beforePagePush);
  assert.match(git(remote, ['show', `main:${page.path}`]), /20% 30%/);
  await plugin.deletePage(page.path, page.title);
  assert.equal(git(remote, ['ls-tree', '--name-only', 'main', '--', page.path]), '');
  await plugin.deleteManagedPost(posts[0], { deleteAssets: true });
  assert.equal(git(remote, ['ls-tree', '--name-only', 'main', '--', posts[0].postPath]), '');
  assert.equal(plugin.settings.lastSubmission, git(remote, ['rev-parse', 'main']));
  assert.equal(saved.at(-1).lastSubmission, plugin.settings.lastSubmission);
  assert.equal(git(remote, ['ls-tree', '-r', '--name-only', 'main']).includes('private-development.md'), false);
  assert.equal(git(root, ['rev-parse', 'HEAD']), head);
  assert.equal(git(root, ['status', '--porcelain']), before + '\n?? public/');
  assert.deepEqual(fs.readFileSync(headerFile), fs.readFileSync(cover));
  const privateFile = { path: 'private.md', extension: 'md' };
  writeDocument(path.join(vault, privateFile.path), { title: 'Private', visibility: 'private' }, 'secret');
  const privateBefore = fs.readFileSync(path.join(vault, privateFile.path));
  const remoteBefore = git(remote, ['rev-parse', 'main']);
  const privateDraft = await plugin.getActiveDraft(privateFile);
  assert.equal(await plugin.publishDraft(privateDraft, privateDraft.metadata), false);
  await assert.rejects(plugin.runNode(['scripts/obsidian-publish.js', '--draft', path.join(vault, privateFile.path)]), /Private notes cannot/);
  assert.deepEqual(fs.readFileSync(path.join(vault, privateFile.path)), privateBefore);
  assert.equal(git(remote, ['rev-parse', 'main']), remoteBefore);
  assert.equal(git(root, ['worktree', 'list', '--porcelain']).match(/^worktree /gm).length, 1);
});

test('plugin preflight uses remote main instead of a locally migrated development branch', async t => {
  const { plugin, root, remote, vault } = publisherFixture(t, false);
  await plugin.onload();
  const status = JSON.parse(await plugin.runNode(['scripts/publisher-status.js']));
  assert.equal(status.state, 'migration-pending');
  const file = { path: 'waiting.md', extension: 'md' };
  writeDocument(path.join(vault, file.path), { title: 'Waiting', visibility: 'public' }, 'waiting body');
  const before = fs.readFileSync(path.join(vault, file.path));
  const remoteHead = git(remote, ['rev-parse', 'main']);
  const draft = await plugin.getActiveDraft(file);
  assert.equal(await plugin.publishDraft(draft, draft.metadata), false);
  assert.deepEqual(fs.readFileSync(path.join(vault, file.path)), before);
  assert.equal(git(remote, ['rev-parse', 'main']), remoteHead);
  assert.equal(git(root, ['worktree', 'list', '--porcelain']).match(/^worktree /gm).length, 1);
});
