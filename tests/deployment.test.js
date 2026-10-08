import test from 'node:test';
import assert from 'node:assert/strict';
import { runStatus } from '../scripts/deployment-status.js';
const commit = 'a'.repeat(40);
const run = { head_sha: commit, head_branch: 'main', event: 'push', html_url: 'https://github.com/example/site/actions/runs/1' };
test('submission, build, deployment success and failure have distinct states', () => {
  assert.equal(runStatus([], commit).state, 'queued');
  assert.equal(runStatus([{ ...run, status: 'in_progress' }], commit).state, 'building');
  assert.equal(runStatus([{ ...run, status: 'completed', conclusion: 'success' }], commit).state, 'deployed');
  assert.equal(runStatus([{ ...run, status: 'completed', conclusion: 'failure' }], commit).state, 'failed');
  assert.equal(runStatus([{ ...run, event: 'pull_request', status: 'completed', conclusion: 'success' }], commit).state, 'queued');
});
