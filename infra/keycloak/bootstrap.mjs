import { readFileSync } from 'node:fs';

const origin = 'https://auth.magic.test:9443';
const realmName = 'magic-shop';
const maxBytes = 1_048_576;
const template = JSON.parse(readFileSync('/app/realm.json', 'utf8'));
const identities = JSON.parse(readFileSync('/app/identities.json', 'utf8'));
const adminSecret = readFileSync('/secrets/admin/client-secret', 'utf8').trim();
const catalogSecret = readFileSync('/secrets/catalog/client-secret', 'utf8').trim();
const reportingSecret = readFileSync('/secrets/reporting/client-secret', 'utf8').trim();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function boundedJson(response) {
  const reader = response.body?.getReader();
  if (!reader) return undefined;
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new Error('Keycloak response exceeded bound'); }
    chunks.push(value);
  }
  if (size === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function call(method, path, token, body, allowed = [200]) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!allowed.includes(response.status)) {
    throw new Error(`Keycloak ${method} ${path.split('?')[0]} returned ${response.status}`);
  }
  return { status: response.status, data: await boundedJson(response) };
}

async function adminToken() {
  const response = await fetch(`${origin}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: 'lab-bootstrap',
      client_secret: adminSecret,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status !== 200) throw new Error(`Bootstrap credential rejected: ${response.status}`);
  const result = await boundedJson(response);
  assert(typeof result?.access_token === 'string', 'Bootstrap token missing');
  return result.access_token;
}

function validateManifest() {
  assert(Array.isArray(identities) && identities.length === 6, 'Expected six seed identities');
  const names = new Set();
  const certs = new Set();
  const subjects = new Set();
  for (const entry of identities) {
    assert(typeof entry.username === 'string' && /^[a-z][a-z0-9-]+$/.test(entry.username), 'Invalid seed username');
    assert(typeof entry.sub === 'string' && /^[0-9a-f-]{36}$/.test(entry.sub), 'Invalid seed subject');
    assert(typeof entry.certIdentity === 'string' && /^[0-9a-f-]{36}$/.test(entry.certIdentity), 'Invalid certificate identity');
    assert(['customer', 'shopkeeper', 'shop-admin'].includes(entry.role), 'Invalid seed role');
    assert(typeof entry.enabled === 'boolean', 'Invalid enabled flag');
    assert(!names.has(entry.username) && !certs.has(entry.certIdentity) && !subjects.has(entry.sub), 'Duplicate seed identity');
    names.add(entry.username); certs.add(entry.certIdentity); subjects.add(entry.sub);
  }
}

function serviceClient(clientId, secret, audience, scope) {
  return {
    clientId,
    name: clientId,
    enabled: true,
    protocol: 'openid-connect',
    clientAuthenticatorType: 'client-secret',
    publicClient: false,
    secret,
    serviceAccountsEnabled: true,
    standardFlowEnabled: false,
    directAccessGrantsEnabled: false,
    implicitFlowEnabled: false,
    defaultClientScopes: [scope],
    protocolMappers: [{
      name: `${audience}-audience`, protocol: 'openid-connect',
      protocolMapper: 'oidc-audience-mapper',
      config: { 'included.custom.audience': audience, 'access.token.claim': 'true', 'id.token.claim': 'false' },
    }],
  };
}

async function ensureRealm(token) {
  const path = `/admin/realms/${realmName}`;
  const existing = await call('GET', path, token, undefined, [200, 404]);
  if (existing.status === 404) {
    const users = identities.map(entry => ({
      id: entry.sub,
      username: entry.username,
      enabled: entry.enabled,
      attributes: { cert_identity: [entry.certIdentity] },
      realmRoles: [entry.role],
    }));
    await call('POST', '/admin/realms', token, { ...template, users }, [201]);
    console.log('Realm created with certificate-only flow and six seed users.');
  } else {
    assert(existing.data?.browserFlow === 'certificate-browser', 'Realm browser flow drift');
    assert(existing.data?.accessTokenLifespan === 120, 'Realm access token lifespan drift');
    console.log('Existing realm retained.');
  }
}

async function ensureUsers(token) {
  const root = `/admin/realms/${realmName}`;
  const listing = await call('GET', `${root}/users?first=0&max=100`, token);
  assert(Array.isArray(listing.data) && listing.data.length < 100, 'User query bound reached');
  const remoteCerts = new Map();
  for (const summary of listing.data) {
    const detail = (await call('GET', `${root}/users/${encodeURIComponent(summary.id)}`, token)).data;
    const cert = detail?.attributes?.cert_identity;
    if (Array.isArray(cert) && cert.length > 0) {
      assert(cert.length === 1 && typeof cert[0] === 'string', 'Invalid remote certificate identity');
      assert(!remoteCerts.has(cert[0]), 'Duplicate remote certificate identity');
      remoteCerts.set(cert[0], detail.username);
    }
  }
  for (const entry of identities) {
    let user = listing.data.find(value => value.username === entry.username);
    if (!user) {
      await call('POST', `${root}/users`, token, {
        id: entry.sub, username: entry.username, enabled: entry.enabled,
        attributes: { cert_identity: [entry.certIdentity] },
      }, [201]);
      const result = await call('GET', `${root}/users?username=${encodeURIComponent(entry.username)}&exact=true&max=2`, token);
      assert(result.data?.length === 1, 'Created user lookup ambiguous');
      user = result.data[0];
    }
    const detail = (await call('GET', `${root}/users/${encodeURIComponent(user.id)}`, token)).data;
    assert(detail.id === entry.sub, `Subject mismatch for ${entry.username}`);
    assert(detail.attributes?.cert_identity?.[0] === entry.certIdentity, `Certificate mapping drift for ${entry.username}`);
    assert(remoteCerts.get(entry.certIdentity) === undefined || remoteCerts.get(entry.certIdentity) === entry.username, 'Certificate identity collision');
    if (entry.username === 'disabled-customer') assert(detail.enabled === false, 'Disabled fixture enabled unexpectedly');
    const role = (await call('GET', `${root}/roles/${entry.role}`, token)).data;
    const roles = (await call('GET', `${root}/users/${encodeURIComponent(user.id)}/role-mappings/realm`, token)).data;
    assert(Array.isArray(roles), 'Role mapping response invalid');
    if (!roles.some(value => value.name === entry.role)) {
      await call('POST', `${root}/users/${encodeURIComponent(user.id)}/role-mappings/realm`, token, [role], [204]);
    }
  }
  console.log('Seed user IDs, unique certificate mappings and roles verified.');
}

async function ensureScopesAndClients(token) {
  const root = `/admin/realms/${realmName}`;
  const scopes = (await call('GET', `${root}/client-scopes`, token)).data;
  assert(Array.isArray(scopes), 'Client scope listing invalid');
  for (const name of ['catalog.quote', 'reporting.read']) {
    if (!scopes.some(value => value.name === name)) {
      await call('POST', `${root}/client-scopes`, token, {
        name, protocol: 'openid-connect',
        attributes: { 'include.in.token.scope': 'true', 'display.on.consent.screen': 'false' },
      }, [201]);
    }
  }
  const specs = [
    serviceClient('customer-catalog', catalogSecret, 'catalog-api', 'catalog.quote'),
    serviceClient('insights-reporting', reportingSecret, 'customer-api', 'reporting.read'),
  ];
  for (const spec of specs) {
    const listing = (await call('GET', `${root}/clients?clientId=${encodeURIComponent(spec.clientId)}&max=2`, token)).data;
    assert(Array.isArray(listing) && listing.length <= 1, `Ambiguous client ${spec.clientId}`);
    if (listing.length === 0) {
      await call('POST', `${root}/clients`, token, spec, [201]);
    } else {
      const current = listing[0];
      assert(current.serviceAccountsEnabled === true && current.standardFlowEnabled === false && current.directAccessGrantsEnabled === false, `Service client drift: ${spec.clientId}`);
      const secret = (await call('GET', `${root}/clients/${current.id}/client-secret`, token)).data;
      assert(secret?.value === spec.secret, `Service client secret drift: ${spec.clientId}`);
    }
  }
  const spa = (await call('GET', `${root}/clients?clientId=shop-spa&max=2`, token)).data;
  assert(spa?.length === 1 && spa[0].publicClient === true && spa[0].directAccessGrantsEnabled === false, 'SPA client drift');
  const spaDetail = (await call('GET', `${root}/clients/${spa[0].id}`, token)).data;
  assert(spaDetail.attributes?.['pkce.code.challenge.method'] === 'S256' &&
    spaDetail.redirectUris?.length === 1 && spaDetail.redirectUris[0] === 'https://shop.magic.test:8443/callback' &&
    spaDetail.webOrigins?.length === 1 && spaDetail.webOrigins[0] === 'https://shop.magic.test:8443', 'SPA PKCE or exact origin drift');
  if (spaDetail.attributes?.['post.logout.redirect.uris'] !== 'https://shop.magic.test:8443/') {
    await call('PUT', `${root}/clients/${spa[0].id}`, token, {
      ...spaDetail,
      attributes: { ...spaDetail.attributes, 'post.logout.redirect.uris': 'https://shop.magic.test:8443/' },
    }, [204]);
  }
  console.log('SPA and scoped service clients verified.');
}

validateManifest();
const token = await adminToken();
await ensureRealm(token);
await ensureUsers(token);
await ensureScopesAndClients(token);
console.log('Keycloak bootstrap complete.');
