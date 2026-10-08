import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { inside, removeTree } from './content.js';

export const git = (root, args) => execFileSync('git', ['-c', 'core.quotePath=false', ...args], { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
export function actionsUrl(root) {
  const remote = git(root, ['remote', 'get-url', 'origin']);
  const match = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  return match ? `https://github.com/${match[1]}/actions/workflows/pages.yml` : '';
}
export function assertUnified(root) {
  if (!fs.existsSync(path.join(root, 'src/content.config.ts'))) throw new Error('The unified site is not on origin/main yet. Deploy the migration before enabling publishing.');
}
export async function transact(root, operation, options = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sakura-content-'));
    const worktree = path.join(temporary, 'worktree');
    try {
      git(root, ['fetch', 'origin', 'main']);
      git(root, ['worktree', 'add', '--detach', worktree, 'origin/main']);
      assertUnified(worktree);
      const result = await operation(worktree);
      const paths = [...new Set(result.paths)];
      for (const relative of paths) {
        inside(worktree, relative);
        if (!/^(?:_posts\/|obsidian\/Published\/|content\/pages\/|public\/Blog\/assets\/images\/)/.test(relative)) throw new Error(`Unexpected publish path: ${relative}`);
      }
      const selected = paths.filter(relative => fs.existsSync(path.join(worktree, relative)) || git(worktree, ['ls-files', '--', relative]));
      if (!selected.length) return { ...result, pushed: false };
      git(worktree, ['add', '-A', '--', ...selected]);
      if (!git(worktree, ['diff', '--cached', '--name-only'])) return { ...result, pushed: false };
      git(worktree, ['commit', '-m', options.message || `post: ${result.title || 'update content'}`, '--', ...selected]);
      const commit = git(worktree, ['rev-parse', 'HEAD']);
      if (!options.noPush) {
        try { git(worktree, ['-c', 'http.sslBackend=openssl', 'push', 'origin', 'HEAD:main']); }
        catch (error) {
          if (attempt === 0 && /non-fast-forward|fetch first|rejected/.test(String(error.stderr))) continue;
          throw error;
        }
      }
      return { ...result, commit, pushed: !options.noPush };
    } finally {
      if (fs.existsSync(worktree)) git(root, ['worktree', 'remove', '--force', worktree]);
      // Only the known temporary directory created above is removed.
      removeTree(temporary);
    }
  }
  throw new Error('Publishing failed after refreshing origin/main.');
}
export function report(root, result) {
  console.log(result.pushed ? 'Content submitted. GitHub Actions is validating and deploying it.' : result.localDeleted ? 'Local page draft deleted; nothing was pushed.' : result.local ? 'Content converted locally; nothing was committed or pushed.' : result.commit ? 'Content prepared; no push was requested.' : 'No content changes to publish.');
  if (result.commit) console.log(`Commit: ${result.commit}`);
  const url = actionsUrl(root);
  if (url) console.log(`GitHub Actions: ${url}`);
}
