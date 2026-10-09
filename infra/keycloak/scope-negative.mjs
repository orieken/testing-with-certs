const origin = 'https://auth.magic.test:9443';
const realm = 'magic-shop';
const target = {
  'customer-catalog': 'catalog.quote',
  'insights-reporting': 'reporting.read'
}[process.env.LAB_SCOPE_CLIENT];
if (process.env.LAB_SCOPE_FIXTURE !== 'yes' || !/^magic-shop-matrix-[a-z0-9-]+$/.test(process.env.LAB_PROJECT ?? '')) {
  throw new Error('Scope mutation requires an explicitly named isolated matrix project');
}
if (!target) throw new Error('Expected an allowlisted service client');

const { readFileSync } = await import('node:fs');
const adminSecret = readFileSync('/secrets/admin/client-secret', 'utf8').trim();
if (!adminSecret) throw new Error('Bootstrap secret missing');

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
async function admin(method, path, token) {
  return bounded(await fetch(`${origin}/admin/realms/${realm}${path}`, {
    method, headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000)
  }), method === 'DELETE' ? [204] : [200]);
}
const token = await bounded(await fetch(`${origin}/realms/master/protocol/openid-connect/token`, {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_id: 'lab-bootstrap', client_secret: adminSecret }),
  signal: AbortSignal.timeout(10_000)
}), [200]);
if (typeof token?.access_token !== 'string') throw new Error('Admin access token missing');
const clients = await admin('GET', `/clients?clientId=${process.env.LAB_SCOPE_CLIENT}&max=2`, token.access_token);
if (!Array.isArray(clients) || clients.length !== 1 || clients[0].clientId !== process.env.LAB_SCOPE_CLIENT) throw new Error('Service client ambiguous');
const clientId = clients[0].id;
const scopes = await admin('GET', `/clients/${clientId}/default-client-scopes`, token.access_token);
if (!Array.isArray(scopes)) throw new Error('Default scope listing invalid');
const scope = scopes.find(value => value.name === target);
if (!scope || typeof scope.id !== 'string') throw new Error(`Expected ${target} default scope missing`);
await admin('DELETE', `/clients/${clientId}/default-client-scopes/${scope.id}`, token.access_token);
const after = await admin('GET', `/clients/${clientId}/default-client-scopes`, token.access_token);
if (!Array.isArray(after) || after.some(value => value.name === target)) throw new Error('Service scope remained linked');
console.log(`Isolated ${process.env.LAB_SCOPE_CLIENT} default ${target} scope removed; retained realm unchanged.`);
