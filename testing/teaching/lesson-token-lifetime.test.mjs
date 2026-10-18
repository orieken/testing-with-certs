import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkShortAccessLifetime } from './lesson-token-lifetime.mjs';
const token = (remaining, lifetime = 20) => ({ expires_in: remaining, access_token: `header.${Buffer.from(JSON.stringify({iat:100,exp:100+lifetime})).toString('base64url')}.signature` });
test('issued lifetime is exact while remaining seconds may decrease', () => {
 for(const remaining of [20,19,1]) checkShortAccessLifetime(token(remaining));
 for(const remaining of [0,-1,21,1.5,undefined]) assert.throws(()=>checkShortAccessLifetime(token(remaining)));
 for(const lifetime of [19,21,45]) assert.throws(()=>checkShortAccessLifetime(token(19,lifetime)));
});
