import { recordCheck } from './evidence.mjs';
import { test, request } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { api, tokenFor, thumbprint, context, shop } from './flow.mjs';

function safeTest(name, run) {
  test(name, async () => {
    try { await run(); }
    catch (error) {
      if (error instanceof assert.AssertionError) throw error;
      // Playwright request failures can contain authorization headers and callback codes.
      throw new Error('RFC 8705 request or fixture failed; raw credential-bearing diagnostics withheld');
    }
  });
}

safeTest('RFC8705 signed cnf and matching-certificate access across all APIs', async () => {
  const { token } = await tokenFor('/identity-admin');
  await api('/identity-admin', token, 200);
});

safeTest('RFC8705 same-identity different valid leaf rejected; spoofed thumbprint replaced', async () => {
  const firstCert = new X509Certificate(readFileSync('/identity-admin/cert.pem'));
  const secondCert = new X509Certificate(readFileSync('/identity-renewed/cert.pem'));
  assert.ok(firstCert.subject === secondCert.subject && thumbprint('/identity-admin') !== thumbprint('/identity-renewed'), 'Same identity with different leaf fingerprints required');
  const first = await tokenFor('/identity-admin');
  const second = await tokenFor('/identity-renewed');
  assert.ok(first.claims.sub === second.claims.sub && first.claims.cert_identity === second.claims.cert_identity, 'Same signed user identity required');
  await api('/identity-admin', first.token, 200);
  await api('/identity-renewed', second.token, 200); // Proves alternate leaf is valid at every resource.
  await api('/identity-renewed', first.token, 401);
  await api('/identity-renewed', first.token, 401, true);
  await api('/identity-admin', second.token, 401);
  await api('/identity-admin', first.token, 200);
  await api('/identity-renewed', second.token, 200);
});

safeTest('RFC8705 valid bound token cannot pass the shop without a client certificate', async () => {
  const { token } = await tokenFor('/identity-admin');
  const ctx = await context();
  try {
    const denied = await ctx.get(`${shop}/api/customer/me`, { headers: { authorization: `Bearer ${token}` } }).then(() => false, error => /certificate|tls|ssl/i.test(String(error)));
    if (denied) recordCheck('/api/customer/me', 'tls-error', 'tls-error');
    assert.ok(denied, 'Missing client certificate must produce a TLS rejection');
  } finally { await ctx.dispose(); }
  await api('/identity-admin', token, 200);
});
