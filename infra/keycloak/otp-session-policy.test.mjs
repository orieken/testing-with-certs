import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lessonSessionPolicy } from './lesson-session-policy.mjs';
async function fixture(run, clientId) {
  const directory = mkdtempSync(join(tmpdir(), 'otp-policy-'));
  const path = join(directory, 'policy.json');
  const state = { id: 'otp-client', clientId, attributes: { 'pkce.code.challenge.method': 'S256' } };
  const original = structuredClone(state);
  let fail = false;
  async function admin(method, endpoint, body) {
    if (endpoint === `/clients?clientId=${clientId}&max=2`) return [{ id: state.id }];
    assert.equal(endpoint, '/clients/otp-client');
    if (method === 'PUT') {
      if (fail) throw new Error('Intentional mutation failure');
      const attributes = { ...state.attributes };
      for (const [key,value] of Object.entries(body.attributes)) { if (value === null) delete attributes[key]; else attributes[key] = value; }
      Object.assign(state, structuredClone(body), { attributes });
    }
    return structuredClone(state);
  }
  try { await run({ admin, path, state, original, fail: value => { fail = value; } }); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}
for (const clientId of ['password-otp-spa', 'passkeys-spa', 'oidc-spa', 'saml-spa']) {
const { start: startOtpSessionPolicy, finish: finishOtpSessionPolicy, verify: verifyOtpSessionPolicy } = lessonSessionPolicy(clientId);
test(`${clientId} short lifetimes are client scoped, privately recorded and completely restored`, () => fixture(async ({admin,path,state,original}) => {
  await startOtpSessionPolicy(admin,path);
  assert.equal(statSync(path).mode & 0o777,0o600);
  assert.equal(state.attributes['access.token.lifespan'],'20');
  assert.equal(state.attributes['client.session.max.lifespan'],'45');
  assert.equal(state.attributes['pkce.code.challenge.method'],'S256');
  await assert.rejects(() => verifyOtpSessionPolicy(admin,path));
  await finishOtpSessionPolicy(admin,path);
  assert.deepEqual(state,original); assert.equal(existsSync(path),false);
  await finishOtpSessionPolicy(admin,path); await verifyOtpSessionPolicy(admin,path);
}, clientId));
test(`${clientId} policy setup refuses existing settings and recovers a partial mutation`, () => fixture(async ({admin,path,state,fail}) => {
  state.attributes['access.token.lifespan']='99';
  await assert.rejects(() => startOtpSessionPolicy(admin,path)); assert.equal(existsSync(path),false);
  delete state.attributes['access.token.lifespan']; fail(true);
  await assert.rejects(() => startOtpSessionPolicy(admin,path)); assert.equal(existsSync(path),true);
  fail(false); await finishOtpSessionPolicy(admin,path); await verifyOtpSessionPolicy(admin,path);
}, clientId));
test(`${clientId} policy restoration refuses unrelated client lifetime drift`, () => fixture(async ({admin,path,state}) => {
  await startOtpSessionPolicy(admin,path); state.attributes['access.token.lifespan']='99';
  await assert.rejects(() => finishOtpSessionPolicy(admin,path)); assert.equal(existsSync(path),true);
}, clientId));
}
