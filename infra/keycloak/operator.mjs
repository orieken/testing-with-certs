import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';

const action = process.argv[2];
const name = process.argv[3];
const identities = JSON.parse(readFileSync('/app/identities.json', 'utf8'));
const selected = identities.find(value => value.username === name);
if (!['provision', 'inspect', 'disable', 'enable'].includes(action) || !selected) {
  throw new Error('Usage: operator.mjs provision|inspect|disable|enable SEED_USER');
}
const origin = 'https://auth.magic.test:9443';
const realm = 'magic-shop';
const adminSecret = readFileSync('/secrets/admin/client-secret', 'utf8').trim();

async function json(response, expected) {
  if (!expected.includes(response.status)) throw new Error(`Keycloak returned ${response.status}`);
  const length = Number(response.headers.get('content-length') ?? '0');
  if (length > 1_048_576) throw new Error('Keycloak response too large');
  const text = await response.text();
  if (text.length > 1_048_576) throw new Error('Keycloak response too large');
  return text ? JSON.parse(text) : undefined;
}
const tokenResponse = await fetch(`${origin}/realms/master/protocol/openid-connect/token`, {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_id: 'lab-bootstrap', client_secret: adminSecret }),
  signal: AbortSignal.timeout(10_000),
});
const adminToken = (await json(tokenResponse, [200]))?.access_token;
if (typeof adminToken !== 'string') throw new Error('Admin token missing');
async function admin(method, path, body, expected) {
  const response = await fetch(`${origin}/admin/realms/${realm}${path}`, {
    method,
    headers: { authorization: `Bearer ${adminToken}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  return json(response, expected);
}
const found = await admin('GET', `/users?username=${encodeURIComponent(name)}&exact=true&max=2`, undefined, [200]);
if (!Array.isArray(found) || found.length !== 1) throw new Error('Seed user missing or ambiguous');
const user = await admin('GET', `/users/${encodeURIComponent(found[0].id)}`, undefined, [200]);
if (user.id !== selected.sub || user.attributes?.cert_identity?.[0] !== selected.certIdentity) {
  throw new Error('Certificate identity does not match selected Keycloak user');
}
if (action === 'provision') {
  const cert = new X509Certificate(readFileSync('/identity/cert.pem'));
  if (cert.subject !== `CN=${selected.certIdentity}`) throw new Error('Issued certificate CN does not match Keycloak identity');
  const now = Date.now();
  if (Date.parse(cert.validFrom) > now || Date.parse(cert.validTo) <= now) throw new Error('Selected certificate outside validity window');
  console.log(`${name}: issued certificate and protected Keycloak identity match`);
} else if (action === 'inspect') {
  console.log(JSON.stringify({ username: name, sub: user.id, certIdentity: selected.certIdentity, enabled: user.enabled }));
} else {
  const enabled = action === 'enable';
  if (enabled && name === 'disabled-customer') throw new Error('disabled-customer is a reserved negative fixture');
  if (user.enabled !== enabled) await admin('PUT', `/users/${encodeURIComponent(user.id)}`, { enabled }, [204]);
  if (!enabled) await admin('POST', `/users/${encodeURIComponent(user.id)}/logout`, undefined, [204]);
  console.log(`${name}: ${enabled ? 'enabled' : 'disabled and sessions terminated'}`);
}
