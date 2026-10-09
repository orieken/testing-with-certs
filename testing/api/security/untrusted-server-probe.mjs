import { request } from '@playwright/test';

const origin = 'https://shop.magic.test:8443';
const context = await request.newContext({
  baseURL: origin,
  clientCertificates: [{ origin, certPath: '/identity-customer/cert.pem', keyPath: '/identity-customer/key.pem' }],
  ignoreHTTPSErrors: false,
  timeout: 5_000
});
let rejected = false;
try {
  try { await context.get('/'); }
  catch (error) {
    if (!/certificate|self.signed|unknown ca|unable to verify/i.test(String(error))) throw error;
    rejected = true;
  }
} finally { await context.dispose(); }
if (!rejected) throw new Error('Shop succeeded without its private server CA');
console.log('Untrusted shop server CA rejected');
