import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanArtifacts } from './check-artifacts.mjs';

test('reports reject passkey, OTP and Kerberos credentials before upload', async () => {
  const root = await mkdtemp(join(tmpdir(), 'authentication-artifacts-'));
  try {
    await writeFile(join(root, 'results.json'), JSON.stringify({ name: 'passkeys:enrollment', status: 'passed' }));
    assert.equal(await scanArtifacts(root, { requireMountedPath: false }), 1);
    for (const [name, body] of [['http.keytab', 'binary-fixture'], ['valid-cache', 'binary-fixture'],
      ['auth-users.json', '[]'], ['credentials.json', '{"privateKey":"test-key"}'],
      ['enrollment.json', '{"totpSecret":"test-key"}'], ['token.json', '{"access_token":"test-token"}']]) {
      const path = join(root, name);
      await writeFile(path, body);
      await assert.rejects(scanArtifacts(root, { requireMountedPath: false }), /Credential-like/);
      await rm(path);
    }
    await assert.rejects(scanArtifacts(root), /mounted local/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
