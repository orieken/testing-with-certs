import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { passkeyCaseNames } from '../teaching/auth-matrix.mjs';

test('repeat gate requires complete selections, safe diagnostics and recordings', async () => {
  const root = await mkdtemp(join(tmpdir(), 'passkey-repeat-'));
  const write = async (path, data) => { await mkdir(join(path, '..'), { recursive: true }); await writeFile(path, JSON.stringify(data)); };
  const run = () => spawnSync(process.execPath, [new URL('./check-passkey-reliability.mjs', import.meta.url).pathname, root], { encoding: 'utf8' });
  try {
    for (const round of [1, 2]) for (const browser of ['chrome', 'msedge']) for (const runner of ['playwright', 'cucumber']) {
      const folder = join(root, `round-${round}`), phase = runner === 'playwright' ? 'passkeys-federation' : 'passkeys-cucumber';
      const report = join(folder, `${browser}-${phase}`);
      await write(join(report, 'results.json'), { cases: passkeyCaseNames.map(name => ({ name, status: 'passed' })) });
      await write(join(report, 'diagnostics.json'), { evidence: 'allowlisted-passkey-diagnostics', events: [
        { name: 'passkeys:enrollment', stage: 'enrollment-passed', moduleDelayed: true },
        { name: 'passkeys:invalid-signature', stage: 'rejection-passed', signatureChanged: true, moduleDelayed: true, identity: false }
      ] });
      for (const [i, name] of passkeyCaseNames.entries()) {
        const directory = `recordings/${browser}-${runner}/${i}`;
        await write(join(folder, directory, 'recording.json'), { evidence: 'live-authentication-recording', browser, runner, name, phase: 'baseline', status: 'passed', privacy: 'provider-document-hidden-before-paint', videos: [`${directory}/page.webm`] });
        await writeFile(join(folder, directory, 'page.webm'), 'fixture');
      }
    }
    assert.equal(run().status, 0);
    const report = join(root, 'round-1/chrome-passkeys-federation');
    const original = await readFile(join(report, 'diagnostics.json'));
    await write(join(report, 'diagnostics.json'), { evidence: 'allowlisted-passkey-diagnostics', events: [{ name: 'passkeys:enrollment', stage: 'enrollment-passed', moduleDelayed: true, password: 'PRIVATE_CANARY' }] });
    assert.notEqual(run().status, 0);
    await writeFile(join(report, 'diagnostics.json'), original);
    await rm(join(root, 'round-2/msedge-passkeys-cucumber/results.json'));
    assert.notEqual(run().status, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
