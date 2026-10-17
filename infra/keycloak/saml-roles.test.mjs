import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureSamlRoleMapping } from './saml-roles.mjs';
function fixture() {
  const state = { profile: { attributes: [{ name: 'username' }] }, source: [], mappers: [], scopes: [], role: null, writes: 0, fullScopeAllowed: false };
  const copy = value => structuredClone(value);
  async function provider(method, path, body) {
    if (method !== 'GET') state.writes++;
    if (path.startsWith('/clients?')) return [{ id: 'source' }];
    if (path === '/users/profile') { if (method === 'PUT') state.profile = copy(body); return copy(state.profile); }
    if (path === '/clients/source/protocol-mappers/models') {
      if (method === 'POST') state.source.push(copy(body)); return copy(state.source);
    }
    throw new Error('Unexpected provider request');
  }
  async function broker(method, path, body) {
    if (method !== 'GET') state.writes++;
    if (path.startsWith('/clients?')) return [{ id: 'target', fullScopeAllowed: state.fullScopeAllowed }];
    if (path === '/clients/target/roles?max=1000') return state.role ? [copy(state.role)] : [];
    if (path === '/clients/target/roles' && method === 'POST') { state.role = { ...copy(body), id: 'role', clientRole: true, containerId: 'target' }; return; }
    if (path === '/clients/target/roles/lesson-reviewer') return copy(state.role);
    if (path === '/clients/target/scope-mappings/clients/target') {
      if (method === 'POST') state.scopes = copy(body); return copy(state.scopes);
    }
    if (path === '/identity-provider/instances/lesson-saml/mappers') {
      if (method === 'POST') state.mappers.push(copy(body)); return copy(state.mappers);
    }
    throw new Error('Unexpected broker request');
  }
  return { state, ensure: () => ensureSamlRoleMapping(provider, broker, 'https://shop.magic.test:9643') };
}
test('SAML role bootstrap is idempotent, admin managed, exact value, forced sync, and scoped to one client role', async () => {
  const {state, ensure} = fixture(); await ensure();
  assert.deepEqual(state.profile.attributes[1].permissions, { view: ['admin'], edit: ['admin'] });
  assert.equal(state.source[0].config['user.attribute'], 'lesson_role');
  assert.deepEqual(state.scopes.map(value => value.name), ['lesson-reviewer']);
  const mapper = state.mappers.find(value => value.name === 'map-lesson-reviewer');
  assert.equal(mapper.config['attribute.value'], 'reviewer');
  assert.equal(mapper.config.role, 'saml-spa.lesson-reviewer');
  assert.equal(mapper.config.syncMode, 'FORCE');
  const writes = state.writes; await ensure(); assert.equal(state.writes, writes);
});
test('SAML role bootstrap rejects broader scope, self-editable attributes, composite roles and mapper drift', async () => {
  for (const mutate of [s => { s.fullScopeAllowed = true; },
    s => { s.profile.attributes[1].permissions.edit = ['user']; },
    s => { s.role.composite = true; },
    s => { s.scopes.push({ id: 'unrelated' }); },
    s => { s.mappers[1].config['attribute.value'] = '*'; },
    s => { s.mappers[1].config.syncMode = 'IMPORT'; }]) {
    const {state, ensure} = fixture(); await ensure(); mutate(state); await assert.rejects(ensure);
  }
});
