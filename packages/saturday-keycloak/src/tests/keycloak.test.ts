import { strict as assert } from 'node:assert';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { KeycloakAdminAdapter, ServiceTokenClient } from '../keycloak.js';

const issuer = 'https://auth.example.test:9443/realms/lesson';
test('service token client requests exact audience and scopes, then caches without logging secret', async () => {
  const root = await mkdtemp(join(tmpdir(), 'saturday-token-')); const secretFile = join(root, 'secret'); await writeFile(secretFile, 'hidden-secret');
  let calls = 0;
  const token = ['e30', Buffer.from(JSON.stringify({ iss: issuer, aud: ['catalog'], scope: 'quote', exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url'), 'sig'].join('.');
  const fetcher: typeof fetch = async (_url, init) => {
    calls++;
    assert.ok(String(init?.body).includes('client_secret=hidden-secret'));
    return new Response(JSON.stringify({ access_token: token, expires_in: 600 }), { status: 200 });
  };
  const client = new ServiceTokenClient({ target: { issuer, origins: ['https://auth.example.test:9443'] }, clientId: 'service', secretFile, audience: 'catalog', scopes: ['quote'], fetcher });
  assert.equal(await client.getToken(), token); assert.equal(await client.getToken(), token); assert.equal(calls, 1);
  const wrong = new ServiceTokenClient({ target: { issuer, origins: ['https://auth.example.test:9443'] }, clientId: 'service', secretFile, audience: 'wrong', scopes: ['quote'], fetcher });
  await assert.rejects(wrong.getToken(), /capability/);
});
test('admin adapter is idempotent, refuses changed cert mapping and scopes cleanup', async () => {
  const root = await mkdtemp(join(tmpdir(), 'saturday-admin-')); const operatorTokenFile = join(root, 'token'); await writeFile(operatorTokenFile, 'operator-token');
  let user: { id: string; username: string; attributes: { cert_identity: string[] } } | undefined;
  let deleted = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); const method = init?.method ?? 'GET';
    if (url.pathname.endsWith('/users') && method === 'GET') return new Response(JSON.stringify(user ? [user] : []));
    if (url.pathname.endsWith('/users') && method === 'POST') { const body = JSON.parse(String(init?.body)); user = { ...body, id: 'id-1' }; return new Response('', { status: 201 }); }
    if (url.pathname.endsWith('/users/id-1') && method === 'GET') return new Response(JSON.stringify(user));
    if (url.pathname.endsWith('/users/id-1') && method === 'DELETE') { deleted++; user = undefined; return new Response(null, { status: 204 }); }
    throw new Error('Unexpected admin request');
  };
  const adapter = new KeycloakAdminAdapter({ issuer, operatorTokenFile, namespacePrefix: 'test-', fetcher });
  const ref = { namespace: 'suite', name: 'alice' };
  await adapter.upsert(ref, 'cert-alice'); await adapter.upsert(ref, 'cert-alice');
  assert.equal(user?.username, 'test-suite-alice');
  await assert.rejects(adapter.upsert(ref, 'cert-other'), /differs/);
  assert.equal(await adapter.cleanupNamespace('suite'), 1); assert.equal(deleted, 1);
  assert.throws(() => adapter.username({ namespace: '../other', name: 'x' }));
});
