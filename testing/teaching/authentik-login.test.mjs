import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completeAuthentikSignIn } from './authentik-login.mjs';
for (const challenge of ['identity', 'password', 'identification']) test(`recovery completes a ${challenge} challenge without resetting the session`, async () => {
  const calls = [];
  const result = await completeAuthentikSignIn({
    identityVisible: async () => challenge === 'identity', passwordVisible: async () => challenge === 'password',
    identify: async () => { calls.push('identify'); }, submitPassword: async () => { calls.push('password'); },
    accepted: async () => { calls.push('validate'); return 'validated-identity'; }, onChallenge: value => calls.push(value),
  });
  assert.equal(result, 'validated-identity');
  assert.deepEqual(calls, challenge === 'identity' ? ['identity', 'validate'] : challenge === 'password' ? ['password', 'password', 'validate'] : ['identification', 'identify', 'validate']);
});
for (const password of [true, false]) test(`a rejected ${password ? 'password' : 'identification'} challenge cannot become successful recovery`, async () => {
  const failure = new Error('credential submission failed'); let validated = false;
  await assert.rejects(completeAuthentikSignIn({ identityVisible: async () => false, passwordVisible: async () => password,
    identify: async () => { throw failure; }, submitPassword: async () => { throw failure; },
    accepted: async () => { validated = true; },
  }), error => error === failure);
  assert.equal(validated, false);
});
