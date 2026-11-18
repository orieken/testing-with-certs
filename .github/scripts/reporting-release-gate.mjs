import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { assertPublishingContext, repository } from './reporting-release.mjs';

export function checkedRun(runs, sha, workflow) {
  const matching = runs.filter(run => run.head_sha === sha && run.head_branch === 'main' && run.event === 'push' && run.path === `.github/workflows/${workflow}`);
  const latest = matching.sort((a, b) => b.id - a.id)[0];
  if (!latest || latest.status !== 'completed') return 'pending';
  assert.equal(latest.conclusion, 'success', `${workflow} must pass on the exact release commit`);
  return 'success';
}
async function main() {
  assertPublishingContext(process.env);
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  execFileSync('git', ['merge-base', '--is-ancestor', sha, 'origin/main']);
  const workflows = ['ci.yml', 'saturday-reporting.yml'];
  const deadline = Date.now() + 90 * 60_000;
  while (Date.now() < deadline) {
    const states = await Promise.all(workflows.map(async workflow => {
      const url = `https://api.github.com/repos/${repository}/actions/workflows/${workflow}/runs?head_sha=${sha}&branch=main&event=push&per_page=100`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(30000) });
      assert.equal(response.status, 200, 'Cannot read source CI runs');
      return checkedRun((await response.json()).workflow_runs, sha, workflow);
    }));
    if (states.every(state => state === 'success')) { console.log(`PASS: both source workflows passed on main commit ${sha}`); return; }
    console.log('Waiting for both source workflows to pass on the release commit');
    await delay(30000);
  }
  throw new Error('Timed out waiting for successful source CI on the release commit');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
