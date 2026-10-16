import { expect } from '@playwright/test';

export const lessonOrigin = 'https://shop.magic.test:8543';
export async function startLesson(page, method, button) {
  await page.goto(`${lessonOrigin}/teaching/${method}`);
  await page.getByRole('button', { name: button, exact: true }).click();
}

export function captureToken(page, realm = 'magic-shop') {
  const authUrl = ['lesson-oidc', 'lesson-saml'].includes(realm) ? 'https://shop.magic.test:9643' : 'https://auth.magic.test:9443';
  const response = page.waitForResponse(value => value.url() ===
    `${authUrl}/realms/${realm}/protocol/openid-connect/token` &&
    value.request().method() === 'POST' && value.status() === 200);
  void response.catch(() => {});
  return response.then(value => value.json()).then(value => value.access_token);
}

export async function checkLessonToken(playwright, token, method) {
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  expect(claims.azp).toBe(`${method}-spa`);
  expect(claims.iss).toBe(['oidc', 'saml'].includes(method) ?
    `https://shop.magic.test:9643/realms/lesson-${method}` :
    `https://auth.magic.test:9443/realms/${method === 'kerberos' ? 'lesson-kerberos' : 'magic-shop'}`);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  expect(audience).toContain(`${method}-lesson`);
  for (const name of ['catalog-api', 'customer-api', 'insights-api']) expect(audience).not.toContain(name);
  const api = await playwright.request.newContext({ clientCertificates: [{ origin: 'https://shop.magic.test:8443',
    certPath: '/identity-customer/cert.pem', keyPath: '/identity-customer/key.pem' }] });
  try {
    for (const path of ['/api/catalog/items', '/api/customer/me', '/api/insights/sales']) {
      expect((await api.get(`https://shop.magic.test:8443${path}`, { headers: { authorization: `Bearer ${token}` } })).status()).toBe(401);
    }
  } finally { await api.dispose(); }
}

export async function virtualAuthenticator(context, page, credentials = []) {
  const session = await context.newCDPSession(page);
  await session.send('WebAuthn.enable');
  const { authenticatorId } = await session.send('WebAuthn.addVirtualAuthenticator', { options: {
    protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true,
    isUserVerified: true, automaticPresenceSimulation: true,
  } });
  for (const credential of credentials) await session.send('WebAuthn.addCredential', { authenticatorId, credential });
  return { session, authenticatorId, async credentials() {
    return (await session.send('WebAuthn.getCredentials', { authenticatorId })).credentials;
  } };
}
