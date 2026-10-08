import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './lib/content.js';
import { git, actionsUrl } from './lib/transaction.js';

export function publisherStatus(root = ROOT) {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('发布需要 Node.js 24 或更新版本。');
  if (!fs.existsSync(path.join(root, 'src/content.config.ts'))) throw new Error('请把发布目录设置为统一 Astro 工程。');
  git(root, ['fetch', 'origin', 'main']);
  const commit = git(root, ['rev-parse', 'origin/main']);
  const ready = Boolean(git(root, ['ls-tree', '--name-only', 'origin/main', '--', 'src/content.config.ts']));
  return {
    ready,
    state: ready ? 'ready' : 'migration-pending',
    commit,
    projectRoot: root,
    actionsUrl: actionsUrl(root),
    message: ready
      ? '发布连接正常。文章将提交到统一站点仓库，检查和部署通过后才会上线。'
      : '统一站点还未切换到 main，暂时不能发文。请先完成网站切换，再发布文章。',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(JSON.stringify(publisherStatus())); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
