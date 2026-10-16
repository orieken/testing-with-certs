import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ensurePasswordOtp } from './password-otp.mjs';

const template = JSON.parse(readFileSync(new URL('./realm.json', import.meta.url)));
function fixture() {
  const state = { flow: null, executions: [], client: null, policy: {}, mutations: [] };
  const root = '/admin/realms/magic-shop';
  async function call(method, path, token, body) {
    assert.equal(token, 'test-token');
    if (method !== 'GET') state.mutations.push({ method, path });
    let data;
    if (path === `${root}/authentication/flows`) {
      if (method === 'POST') state.flow = { ...body, id: 'generated-flow-id' };
      else data = state.flow ? [state.flow] : [];
    } else if (path.endsWith('/executions/execution') && method === 'POST') {
      state.executions.push({ id: String(state.executions.length), providerId: body.provider, requirement: 'DISABLED' });
    } else if (path.endsWith('/executions')) {
      if (method === 'PUT') state.executions[Number(body.id)] = body;
      else data = state.executions;
    } else if (path === root) {
      if (method === 'PUT') Object.assign(state.policy, body);
      else data = state.policy;
    } else if (path.endsWith('/authentication/required-actions')) {
      data = [{ alias: 'CONFIGURE_TOTP', enabled: true }];
    } else if (path.includes('/clients?')) data = state.client ? [state.client] : [];
    else if (path.endsWith('/clients') && method === 'POST') state.client = { ...body, id: 'client-id' };
    else if (path.endsWith('/clients/client-id')) data = state.client;
    else if (path.endsWith('/clients/client-id/default-client-scopes')) data = [{ name: 'basic' }, { name: 'profile' }];
    else throw new Error(`Unexpected bootstrap request: ${method} ${path}`);
    return { data: structuredClone(data) };
  }
  return { state, call };
}

test('retained realm adds isolated mandatory flow and client; repeat bootstrap performs no writes', async () => {
  const { state, call } = fixture();
  await ensurePasswordOtp('test-token', template, call);
  assert.deepEqual(state.executions.map(value => [value.providerId, value.requirement]),
    [['auth-username-password-form', 'REQUIRED'], ['auth-otp-form', 'REQUIRED']]);
  assert.equal(state.client.authenticationFlowBindingOverrides.browser, 'generated-flow-id');
  assert.deepEqual(state.client.redirectUris, ['https://shop.magic.test:8543/teaching/password-otp/callback']);
  assert.equal(state.policy.browserFlow, undefined);
  state.mutations.length = 0;
  await ensurePasswordOtp('test-token', template, call);
  assert.equal(state.mutations.length, 0);
});

test('flow weakening and unexpected callback fail closed', async () => {
  const { state, call } = fixture();
  await ensurePasswordOtp('test-token', template, call);
  state.executions[1].requirement = 'ALTERNATIVE';
  await assert.rejects(ensurePasswordOtp('test-token', template, call), /must require/);
  state.executions[1].requirement = 'REQUIRED';
  state.client.redirectUris = ['https://untrusted.example/callback'];
  await assert.rejects(ensurePasswordOtp('test-token', template, call), /client drift/);
});
