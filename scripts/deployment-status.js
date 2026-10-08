import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './lib/content.js';
import { actionsUrl } from './lib/transaction.js';
export function runStatus(runs, commit) {
  const run = runs.find(run => run.head_sha === commit && run.head_branch === 'main' && run.event !== 'pull_request');
  if (!run) return { state: 'queued', message: '内容已提交，等待构建。' };
  if (run.status !== 'completed') return { state: 'building', message: '正在检查和构建，尚未上线。', url: run.html_url };
  return run.conclusion === 'success'
    ? { state: 'deployed', message: '部署已完成，新内容已上线。', url: run.html_url }
    : { state: 'failed', message: '构建或部署未成功，线上保留上一次成功版本。', url: run.html_url };
}
export async function deploymentStatus(root, commit, fetcher = fetch) {
  if (!/^[a-f0-9]{40}$/i.test(commit || '')) throw new Error('Expected a full commit SHA.');
  const url = actionsUrl(root);
  const repository = url.match(/github\.com\/(.+)\/actions\//)?.[1];
  if (!repository) throw new Error('Deployment status requires a GitHub origin.');
  const response = await fetcher(`https://api.github.com/repos/${repository}/actions/workflows/pages.yml/runs?head_sha=${commit}&per_page=10`, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`GitHub status request failed: ${response.status}; view the Actions page.`);
  return { ...runStatus((await response.json()).workflow_runs || [], commit), actionsUrl: url };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    process.stdout.write(JSON.stringify(await deploymentStatus(ROOT, args[args.indexOf('--commit') + 1])));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
