import fs from 'node:fs';
import path from 'node:path';
import { PAGES_DIRECTORY } from '../../src/config/content.js';
import { BLOG_ASSETS, pagePermalink } from '../../src/config/site.js';
import { ROOT, inside, ASSETS } from './lib/repository.js';
import { slugFor } from './lib/posts.js';
import { readDocument, writeDocument, assertPublic } from './lib/markdown.js';
import { transact, git, report } from './lib/transaction.js';
const directory = PAGES_DIRECTORY + '/';
function pageFile(root, relative) {
  const file = inside(root, relative, directory);
  if (!file.endsWith('.md')) throw new Error('Only Markdown pages may be managed.');
  return file;
}
export function listPages(root = ROOT) {
  return fs.readdirSync(path.join(root, directory)).filter(file => file.endsWith('.md')).map(file => {
    const { data } = readDocument(path.join(root, directory, file));
    return {
      title: data.title,
      path: directory + file,
      headerImage: data.header_image || data.cover || '',
      coverPosition: data.header_position || data.cover_position || '',
      url: pagePermalink(file.slice(0, -'.md'.length)),
    };
  });
}
export function createPage(root, title) {
  const slug = slugFor(title);
  if (['index', 'archive', 'moments', '404', 'search', 'feed', 'sitemap'].includes(slug)) throw new Error('This page name is reserved.');
  const relative = `${directory}${slug}.md`;
  const file = pageFile(root, relative);
  if (fs.existsSync(file)) throw new Error('Page already exists.');
  writeDocument(file, { title, visibility: 'public' }, '在这里编写内容。\n');
  return { title, path: relative };
}
export function setHeaderImage(root, relative, image, position) {
  if (!/^https?:\/\//.test(image) && !image?.startsWith(BLOG_ASSETS + '/')) {
    throw new Error(`Expected an HTTP image URL or ${BLOG_ASSETS}/ path.`);
  }
  const file = pageFile(root, relative);
  const { data, body } = readDocument(file);
  assertPublic(data);
  data.header_image = image;
  if (position) data.header_position = position;
  writeDocument(file, data, body);
  return { path: relative, headerImage: image };
}
export function deletePage(root, relative) {
  const file = pageFile(root, relative);
  fs.unlinkSync(file);
  return { title: `delete page ${path.basename(file, '.md')}`, paths: [relative], deleted: relative };
}
export async function removePage(root, relative, options = {}) {
  const localFile = pageFile(root, relative);
  const original = fs.existsSync(localFile) ? fs.readFileSync(localFile) : null;
  const result = await transact(root, worktree => {
    if (fs.existsSync(pageFile(worktree, relative))) return deletePage(worktree, relative);
    if (original) return { title: 'delete local page draft', paths: [], localDeleted: true };
    throw new Error('Page does not exist.');
  }, options);
  // The explicitly selected page is removed locally only if it was not edited during the operation.
  if (!options.noPush && original && fs.existsSync(localFile) && fs.readFileSync(localFile).equals(original)) fs.unlinkSync(localFile);
  return result;
}
export async function pushPages(root, options = {}) {
  const changed = [...new Set([...git(root, ['diff', '--name-only', 'HEAD', '--', directory, `${ASSETS}/images/site/`]).split('\n'), ...git(root, ['ls-files', '--others', '--exclude-standard', '--', directory, `${ASSETS}/images/site/`]).split('\n')].filter(Boolean))];
  const snapshots = changed.map(relative => ({ relative, bytes: fs.existsSync(inside(root, relative)) ? fs.readFileSync(inside(root, relative)) : null }));
  for (const item of snapshots) if (item.bytes && item.relative.endsWith('.md')) assertPublic(readDocument(inside(root, item.relative)).data);
  return transact(root, worktree => {
    for (const item of snapshots) {
      const file = inside(worktree, item.relative);
      if (item.bytes) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, item.bytes); }
      else if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    return { title: 'update pages', paths: changed };
  }, options);
}
export async function main(args) {
  try {
    const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
    if (args[0] === 'list') process.stdout.write(JSON.stringify(listPages()));
    else if (args[0] === 'create') { if (!value('--title')) throw new Error('Missing --title.'); process.stdout.write(JSON.stringify(createPage(ROOT, value('--title')))); }
    else if (args[0] === 'set-header-image') process.stdout.write(JSON.stringify(setHeaderImage(ROOT, value('--page'), value('--image'), value('--position'))));
    else if (args[0] === 'delete') report(ROOT, await removePage(ROOT, value('--page'), { noPush: args.includes('--no-push') }));
    else if (args[0] === 'push') report(ROOT, await pushPages(ROOT, { noPush: args.includes('--no-push') }));
    else throw new Error('Unknown page management command.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
