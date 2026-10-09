import { readFileSync } from 'node:fs';

const action = process.argv[2];
const project = process.env.LAB_PROJECT ?? '';
if (!/^magic-shop-matrix-[a-z0-9-]+$/.test(project) || !['inspect', 'rotate'].includes(action)) {
  throw new Error('Use inspect|rotate only in a named isolated matrix project');
}
if (action === 'rotate' && process.env.LAB_KEY_ROTATION !== 'yes') throw new Error('Explicit isolated rotation flag required');
const origin = 'https://auth.magic.test:9443';
const realm = 'magic-shop';
const secret = readFileSync('/secrets/admin/client-secret', 'utf8').trim();
if (!secret) throw new Error('Admin secret missing');

async function bounded(response, allowed) {
  if (!allowed.includes(response.status)) throw new Error(`Keycloak returned ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) return undefined;
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1_048_576) { await reader.cancel(); throw new Error('Keycloak response exceeded bound'); }
    chunks.push(value);
  }
  return size ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
}
async function call(method, path, token, body, allowed = [200]) {
  return bounded(await fetch(`${origin}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000)
  }), allowed);
}
const session = await bounded(await fetch(`${origin}/realms/master/protocol/openid-connect/token`, {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_id: 'lab-bootstrap', client_secret: secret }),
  signal: AbortSignal.timeout(10_000)
}), [200]);
if (typeof session?.access_token !== 'string') throw new Error('Admin token missing');
const admin = session.access_token;
const path = `/admin/realms/${realm}`;
const before = await call('GET', `${path}/keys`, admin);
const oldKid = before?.active?.RS256;
if (typeof oldKid !== 'string' || !oldKid) throw new Error('Active RS256 key missing');
const beforeKeys = Array.isArray(before.keys) ? before.keys : [];
if (beforeKeys.length > 20) throw new Error('Key list exceeded bound');
console.log(`Before rotation: active RS256 kid ${oldKid}; ${beforeKeys.length} published keys.`);
if (action === 'inspect') process.exit(0);

const realmDetail = await call('GET', path, admin);
if (typeof realmDetail?.id !== 'string') throw new Error('Realm ID missing');
const existing = await call('GET', `${path}/components?type=org.keycloak.keys.KeyProvider`, admin);
if (!Array.isArray(existing) || existing.length > 20) throw new Error('Key provider list invalid');
if (existing.some(value => value.name === 'matrix-rsa-rotation')) throw new Error('Matrix rotation provider already exists');
const oldPriorities = existing.map(value => Number(value.config?.priority?.[0])).filter(Number.isFinite);
const priority = Math.max(1000, ...oldPriorities.map(value => value + 1));
await call('POST', `${path}/components`, admin, {
  name: 'matrix-rsa-rotation', providerId: 'rsa-generated', providerType: 'org.keycloak.keys.KeyProvider', parentId: realmDetail.id,
  config: { priority: [String(priority)], enabled: ['true'], active: ['true'], keySize: ['2048'], algorithm: ['RS256'] }
}, [201, 204]);
const after = await call('GET', `${path}/keys`, admin);
const newKid = after?.active?.RS256;
if (typeof newKid !== 'string' || !newKid || newKid === oldKid) throw new Error('RS256 active key did not change');
const jwks = await bounded(await fetch(`${origin}/realms/${realm}/protocol/openid-connect/certs`, { signal: AbortSignal.timeout(10_000) }), [200]);
const published = new Set(Array.isArray(jwks?.keys) ? jwks.keys.map(value => value.kid) : []);
if (!published.has(oldKid) || !published.has(newKid)) throw new Error('Old and new public keys not both published');
console.log(`After rotation: active RS256 kid ${newKid}; old and new public keys published.`);
