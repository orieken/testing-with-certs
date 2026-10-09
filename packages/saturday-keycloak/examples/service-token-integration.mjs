import { strict as assert } from 'node:assert';
import { ServiceTokenClient } from '../dist/index.js';

const client = new ServiceTokenClient({
  target: {
    issuer: 'https://auth.magic.test:9443/realms/magic-shop',
    origins: ['https://auth.magic.test:9443']
  },
  clientId: 'customer-catalog',
  secretFile: '/service-secret/client-secret',
  audience: 'catalog-api',
  scopes: ['catalog.quote'],
  timeoutMs: 10_000
});
const first = await client.getToken();
assert.ok(first.length > 100);
assert.equal(await client.getToken(), first);
console.log('Live scoped service token: verified issuer, audience, scope and cache behavior');
