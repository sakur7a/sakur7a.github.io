import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, readDocument, assertPublic, transformDraft } from './lib/content.js';
import { transact, report } from './lib/transaction.js';

export function parseArgs(argv) {
  const options = {};
  const names = { '--draft': 'draft', '--cover': 'cover', '--cover-position': 'coverPosition', '--date': 'date', '--slug': 'slug', '--slug-override': 'slug', '--vault-root': 'vaultRoot' };
  for (let index = 0; index < argv.length; index++) {
    if (names[argv[index]]) {
      const key = names[argv[index]];
      if (!argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error(`Missing value: ${argv[index]}`);
      options[key] = argv[++index];
    } else if (argv[index] === '--no-push') options.noPush = true;
    else if (argv[index] === '--no-commit') options.noCommit = true;
    else throw new Error(`Unknown option: ${argv[index]}`);
  }
  return options;
}
export async function runPublisher(options, root = ROOT) {
  if (!options.draft) throw new Error('Missing --draft path.');
  const draft = path.resolve(root, options.draft);
  assertPublic(readDocument(draft).data);
  options = { ...options, cover: options.cover ? path.resolve(root, options.cover) : undefined, vaultRoot: options.vaultRoot ? path.resolve(options.vaultRoot) : undefined };
  if (options.noCommit && options.noPush) return { ...(await transformDraft(root, draft, options)), local: true };
  if (options.noCommit) throw new Error('--no-commit must be combined with --no-push for local conversion.');
  return transact(root, worktree => transformDraft(worktree, draft, options), options);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { report(ROOT, await runPublisher(parseArgs(process.argv.slice(2)))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
