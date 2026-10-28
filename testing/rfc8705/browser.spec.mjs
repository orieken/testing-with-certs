import { recordCheck } from './evidence.mjs';
import { test } from '@playwright/test';
import assert from 'node:assert/strict';
import { withAuthRecording } from '../teaching/auth-recording.mjs';
import { tokenFor, shop, context as requestContext } from './flow.mjs';
import { browserCases } from './cases.mjs';

const paths = ['/api/catalog/items', '/api/customer/me', '/api/insights/regions'];
async function visit(flow, token, status, spoof = false) {
  await flow.page.setExtraHTTPHeaders({ authorization: `Bearer ${token}`,
    ...(spoof ? { 'x-cert-thumbprint': Buffer.from(flow.claims.cnf['x5t#S256'], 'base64url').toString('base64') } : {}) });
  for (const path of paths) {
    const response = await flow.page.goto(`${shop}${path}`);
    recordCheck(path, response.status(), status);
    assert.equal(response.status(), status, `Actual browser resource navigation at ${path}`);
    // Let real response documents remain visible in the recording.
    await flow.page.waitForTimeout(300);
  }
}
for (const [index, name] of browserCases.entries()) {
  test(name, async ({ browser }) => {
    try {
      await withAuthRecording(browser, undefined, name, 'rfc8705', async recorded => {
        const first = await tokenFor('/identity-admin', recorded);
        await visit(first, first.token, 200);
        if (index === 1) {
          const second = await tokenFor('/identity-renewed', recorded);
          assert.ok(first.claims.sub === second.claims.sub && first.claims.cert_identity === second.claims.cert_identity, 'Same signed user identity required');
          assert.ok(first.claims.cnf['x5t#S256'] !== second.claims.cnf['x5t#S256'], 'Different bound leaves required');
          await visit(second, second.token, 200);
          await visit(second, first.token, 401);
          // Attempt to spoof the ORIGINAL certificate fingerprint, not the presenting leaf.
          await second.page.setExtraHTTPHeaders({ authorization: `Bearer ${first.token}`, 'x-cert-thumbprint': Buffer.from(first.claims.cnf['x5t#S256'], 'base64url').toString('base64') });
          for (const path of paths) {
            const response = await second.page.goto(`${shop}${path}`);
            recordCheck(path, response.status(), 401);
            assert.equal(response.status(), 401, 'Spoofed fingerprint must fail');
            await second.page.waitForTimeout(300);
          }
          await visit(first, second.token, 401);
          await visit(first, first.token, 200);
          await visit(second, second.token, 200);
        } else if (index === 2) {
          const absent = await recorded.newContext({ ignoreHTTPSErrors: false });
          const page = await absent.newPage();
          await page.setExtraHTTPHeaders({ authorization: `Bearer ${first.token}` });
          const outcome = await page.goto(`${shop}/api/customer/me`).then(
            response => ({ status: response?.status() }),
            error => ({ network: String(error.message).match(/net::ERR_[A-Z_]+/)?.[0] ?? 'unknown' }));
          // Chromium can expose a TLS client-auth alert as an empty response.
          // Keep that browser observation distinct from the private TLS proof.
          const allowed = ['net::ERR_BAD_SSL_CLIENT_AUTH_CERT', 'net::ERR_SSL_CLIENT_AUTH_CERT_NEEDED', 'net::ERR_SSL_PROTOCOL_ERROR', 'net::ERR_EMPTY_RESPONSE', 'net::ERR_CONNECTION_CLOSED', 'net::ERR_CONNECTION_RESET', 'net::ERR_SOCKET_NOT_CONNECTED'];
          assert.ok(allowed.includes(outcome.network), `Browser must reject the navigation (${outcome.network ?? outcome.status})`);
          recordCheck('browser-transport', 'rejected', 'rejected');
          const probe = await requestContext();
          try {
            const tlsRejected = await probe.get(`${shop}/api/customer/me`, { headers: { authorization: `Bearer ${first.token}` } }).then(() => false, error => /certificate|tls|ssl/i.test(String(error)));
            assert.ok(tlsRejected, 'Independent verified request must identify the TLS certificate rejection');
            recordCheck('/api/customer/me', 'tls-error', 'tls-error');
          } finally { await probe.dispose(); }
          await page.waitForTimeout(400);
          await visit(first, first.token, 200);
        }
        if (process.env.LAB_RFC8705_FORCE_FAILURE === '1' && index === 0) assert.fail('Intentional recording-retention validation');
      });
    } catch (error) {
      if (error instanceof assert.AssertionError) throw error;
      const location = String(error.stack ?? '').match(/(?:browser\.spec|flow)\.mjs:\d+:\d+/)?.[0] ?? 'unknown-location';
      const network = String(error.message ?? '').match(/net::ERR_[A-Z_]+/)?.[0] ?? 'request-error';
      throw new Error(`Browser scenario failed at ${location} (${network}); credential-bearing diagnostics withheld`);
    }
  });
}
