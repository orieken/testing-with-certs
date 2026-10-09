import { strict as assert } from 'node:assert';
import { readFile, writeFile } from 'node:fs/promises';
import { KeycloakAdminAdapter } from '../dist/index.js';

const origin = 'https://auth.magic.test:9443';
const secret = (await readFile('/operator/client-secret', 'utf8')).trim();
const response = await fetch(`${origin}/realms/master/protocol/openid-connect/token`, {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_id: 'lab-bootstrap', client_secret: secret }),
  signal: AbortSignal.timeout(10_000)
});
if (!response.ok) throw new Error(`Operator token request failed (${response.status})`);
const result = await response.json();
if (typeof result.access_token !== 'string') throw new Error('Operator token missing');
await writeFile('/tmp/operator-token', result.access_token, { mode: 0o600 });
const adapter = new KeycloakAdminAdapter({ issuer: `${origin}/realms/magic-shop`, operatorTokenFile: '/tmp/operator-token', namespacePrefix: 'pkg-' });
const ref = { namespace: 'packagecheck', name: 'alice' };
try {
  await adapter.upsert(ref, 'packagecheck-alice');
  await adapter.upsert(ref, 'packagecheck-alice');
  await assert.rejects(adapter.upsert(ref, 'packagecheck-other'), /differs/);
  console.log('Live Keycloak adapter: namespaced create, idempotent repeat and immutable identity passed');
} finally {
  const count = await adapter.cleanupNamespace(ref.namespace);
  assert.equal(count, 1);
  console.log('Live Keycloak adapter: namespace-only cleanup passed');
}
