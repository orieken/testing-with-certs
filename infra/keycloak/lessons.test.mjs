import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ensureLessons, ensureClient, lessonSpecs } from './lessons.mjs';

function fixture() {
  const state = { realm: {}, flows: [], executions: new Map(), clients: [], writes: 0, registration: false };
  const copy = value => structuredClone(value);
  async function admin(method, path, body) {
    if (method !== 'GET') state.writes++;
    if (path === '') {
      if (method === 'PUT') Object.assign(state.realm, body);
      return copy(state.realm);
    }
    if (path === '/authentication/required-actions') return [{ alias: 'webauthn-register-passwordless', enabled: state.registration }];
    if (path.startsWith('/authentication/required-actions/') && method === 'PUT') { state.registration = body.enabled; return; }
    if (path === '/authentication/flows') {
      if (method === 'POST') {
        state.flows.push({ ...body, id: `${body.alias}-generated` });
        state.executions.set(body.alias, []);
      }
      return copy(state.flows);
    }
    const flow = /^\/authentication\/flows\/([^/]+)\/executions(\/execution)?$/.exec(path);
    if (flow) {
      const executions = state.executions.get(flow[1]);
      if (method === 'POST') executions.push({ id: `${flow[1]}-${executions.length}`, providerId: body.provider, requirement: 'DISABLED' });
      if (method === 'PUT') Object.assign(executions.find(value => value.id === body.id), body);
      return copy(executions);
    }
    if (path.startsWith('/clients?')) return copy(state.clients.filter(value => value.clientId === new URLSearchParams(path.split('?')[1]).get('clientId')));
    if (path === '/clients' && method === 'POST') { state.clients.push(copy({ ...body, id: body.clientId })); return; }
    const client = /^\/clients\/([^/]+)(.*)$/.exec(path);
    if (client) {
      const value = state.clients.find(entry => entry.id === client[1]);
      if (!client[2]) { if (method === 'PUT') Object.assign(value, body); return copy(value); }
      if (client[2] === '/protocol-mappers/models' && method === 'POST') { value.protocolMappers.push(copy(body)); return; }
      if (client[2] === '/default-client-scopes') return [{ name: 'basic' }, { name: 'profile' }];
      if (client[2] === '/optional-client-scopes') return [];
    }
    throw new Error(`Unexpected lesson request: ${method} ${path}`);
  }
  return { state, admin };
}

test('passkey bootstrap isolates enrollment, leaves other protocols separate, and is idempotent', async () => {
  const { state, admin } = fixture();
  await ensureLessons(admin);
  assert.equal(state.registration, true);
  assert.deepEqual(state.clients.map(value => value.clientId), ['passkeys-spa', 'passkeys-enroll-spa']);
  const passkeys = state.executions.get('passkeys-browser');
  assert.deepEqual(passkeys.map(value => value.providerId), ['auth-username-form', 'webauthn-authenticator-passwordless']);
  assert(passkeys.every(value => value.requirement === 'REQUIRED'));
  assert.deepEqual(lessonSpecs.authenticationFlows.find(value => value.alias === 'kerberos-browser')
    .authenticationExecutions.map(value => value.authenticator), ['auth-spnego']);
  const login = state.clients.find(value => value.clientId === 'passkeys-spa');
  const enroll = state.clients.find(value => value.clientId === 'passkeys-enroll-spa');
  assert.notDeepEqual(login.redirectUris, enroll.redirectUris);
  assert.notEqual(login.protocolMappers[0].config['included.custom.audience'], enroll.protocolMappers[0].config['included.custom.audience']);
  const writes = state.writes;
  // Keycloak can return mapper maps in a different JSON property order.
  state.clients[0].protocolMappers[0].config = Object.fromEntries(Object.entries(state.clients[0].protocolMappers[0].config).reverse());
  state.clients[0].protocolMappers[0].config['userinfo.token.claim'] = 'false';
  await ensureLessons(admin);
  assert.equal(state.writes, writes);
});

test('a cookie alternative or changed lesson audience fails closed', async () => {
  const { state, admin } = fixture();
  await ensureLessons(admin);
  state.executions.get('passkeys-browser').push({ providerId: 'auth-cookie', requirement: 'ALTERNATIVE' });
  await assert.rejects(ensureLessons(admin), /flow drift/);
  state.executions.get('passkeys-browser').pop();
  state.clients[0].protocolMappers[0].config['included.custom.audience'] = 'catalog-api';
  await assert.rejects(ensureLessons(admin), /mapper drift/);
});

test('every lesson callback is exact, routed, and has no business audience', () => {
  const haproxy = readFileSync(new URL('../haproxy/haproxy.cfg', import.meta.url), 'utf8');
  const teaching = haproxy.split('frontend teaching\n')[1].split('\nbackend ui')[0];
  assert.match(teaching, /bind :8543 ssl crt \/shop\/combined.pem\n/);
  assert.doesNotMatch(teaching, /use_backend (catalog|customer|insights)/);
  for (const client of lessonSpecs.clients) {
    assert.equal(client.redirectUris.length, 1);
    const callback = new URL(client.redirectUris[0]);
    assert.equal(callback.origin, 'https://shop.magic.test:8543');
    assert(teaching.includes(callback.pathname));
    assert.equal(client.directAccessGrantsEnabled, false);
    assert.deepEqual(client.defaultClientScopes, ['basic', 'profile']);
    assert.deepEqual(client.optionalClientScopes, []);
    const audiences = client.protocolMappers.filter(value => value.protocolMapper === 'oidc-audience-mapper');
    assert.equal(audiences.length, 1);
    assert(audiences[0].config['included.custom.audience'].endsWith('-lesson'));
    if (client.clientId === 'saml-spa') {
      assert.equal(client.fullScopeAllowed, false);
      assert.equal(client.protocolMappers[1].config['usermodel.clientRoleMapping.clientId'], 'saml-spa');
      assert.equal(client.protocolMappers[1].config['claim.name'], 'lesson_roles');
    } else assert.equal(client.protocolMappers.length, 1);
  }
});

test('SAML client migration tightens scope and adds only the explicit lesson role claim idempotently', async () => {
  const {state, admin} = fixture();
  const spec = lessonSpecs.clients.find(value => value.clientId === 'saml-spa');
  state.clients.push({ ...structuredClone(spec), id: 'saml-spa', fullScopeAllowed: true,
    protocolMappers: [structuredClone(spec.protocolMappers[0])], authenticationFlowBindingOverrides: { browser: 'flow' } });
  await ensureClient(admin, spec, 'flow');
  assert.equal(state.clients[0].fullScopeAllowed, false);
  assert.equal(state.clients[0].protocolMappers.length, 2);
  const writes = state.writes; await ensureClient(admin, spec, 'flow'); assert.equal(state.writes, writes);
});
