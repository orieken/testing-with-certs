import { checkShortAccessLifetime } from './lesson-token-lifetime.mjs';
import { withAuthRecording } from './auth-recording.mjs';
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { startLesson, captureToken, checkLessonToken, lessonOrigin } from './auth-lessons.mjs';
import { samlCaseNames, samlSessionCaseNames } from './auth-matrix.mjs';

const checks = new Map();
const defineCheck = (name, check) => checks.set(name, check);
const passwordFor = name => {
  const users = JSON.parse(readFileSync('/test-secrets/auth-users.json', 'utf8'));
  const account = users.find(value => value.username === name);
  if (!account) throw new Error('Missing SAML fixture account');
  return account.password;
};

async function providerLogin(page, method, kind = 'user', allowSso = false) {
  const title = method === 'oidc' ? 'Sign in with OpenID Connect' : 'Sign in with SAML';
  await startLesson(page, method, title);
  if (allowSso) {
    await expect(page.locator('#username:visible, #password:visible').or(page.getByTestId('lesson-user')).first()).toBeVisible();
    if (await page.getByTestId('lesson-user').isVisible()) return;
  }
  await expect(page).toHaveURL(/^https:\/\/shop\.magic\.test:9643\/realms\/lesson-provider\//);
  const username = `${method}-test-${kind}`;
  if (!allowSso || await page.locator('#username').isVisible()) await page.locator('#username').fill(username);
  else {
    await expect(page.locator('#kc-attempted-username')).toHaveAttribute('readonly', '');
    await expect(page.locator('#kc-attempted-username')).toHaveValue(username);
  }
  await page.locator('#password').fill(passwordFor(username));
  await page.locator('#kc-login').click();
}

for (const method of ['saml']) {
  defineCheck(`${method}:login-audience-and-logout`, async ({ page, playwright }) => {
    const token = captureToken(page, `lesson-${method}`);
    await providerLogin(page, method);
    await expect(page.getByTestId('lesson-user')).toHaveText(`${method}-test-user`);
    await checkLessonToken(playwright, await token, method);
    await page.getByRole('button', { name: 'Sign out of lesson' }).click();
    await expect(page.getByRole('button', { name: method === 'oidc' ? 'Sign in with OpenID Connect' : 'Sign in with SAML' })).toBeVisible();
  });
  defineCheck(`${method}:disabled-provider-user`, async ({ page }) => {
    await providerLogin(page, method, 'disabled');
    await expect(page.getByText('Account is disabled, contact your administrator.', { exact: true })).toBeVisible();
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);
  });
  defineCheck(`${method}:callback-state-rejection`, async ({ page }) => {
    await page.goto(`${lessonOrigin}/teaching/${method}/callback?code=invalid-fixture-code&state=unmatched-fixture-state`);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);
  });
  defineCheck(`${method}:cross-protocol-provider-rejection`, async ({ page }) => {
    const url = new URL(`https://shop.magic.test:9643/realms/lesson-${method}/protocol/openid-connect/auth`);
    url.search = new URLSearchParams({ client_id: `${method}-spa`, response_type: 'code', scope: 'openid',
      redirect_uri: `${lessonOrigin}/teaching/${method}/callback`, state: 'isolated-provider-test',
      code_challenge_method: 'S256', code_challenge: 'a'.repeat(43), kc_idp_hint: method === 'oidc' ? 'lesson-saml' : 'lesson-oidc' }).toString();
    await page.goto(url.toString());
    await expect(page.locator('#kc-error-message')).toBeVisible();
    expect(new URL(page.url()).origin).toBe('https://shop.magic.test:9643');
  });
  defineCheck(`${method}:broker-state-rejection`, async ({ page }) => {
    await page.goto(`https://shop.magic.test:9643/realms/lesson-${method}/broker/lesson-${method}/endpoint?state=unmatched-fixture-state&code=invalid-fixture-code`);
    await expect(page.locator('#kc-error-message')).toBeVisible();
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);
  });
}

defineCheck('saml:modified-signed-response', async ({ page }) => {
  let modified = false;
  await page.route('**/realms/lesson-saml/broker/lesson-saml/endpoint*', async route => {
    const body = new URLSearchParams(route.request().postData() ?? '');
    if (body.has('SAMLResponse')) {
      let xml = Buffer.from(body.get('SAMLResponse'), 'base64').toString();
      // Alter signed content while retaining its original signature.
      xml = xml.replace(/(<(?:\w+:)?NameID\b[^>]*>)[^<]+/, '$1tampered-fixture-user');
      body.set('SAMLResponse', Buffer.from(xml).toString('base64'));
      modified = true;
      await route.continue({ postData: body.toString() });
    } else await route.continue();
  });
  await providerLogin(page, 'saml');
  await expect.poll(() => modified).toBe(true);
  await expect(page.locator('#kc-error-message')).toBeVisible();
  await expect(page.getByTestId('lesson-user')).toHaveCount(0);
});

defineCheck('saml:response-replay', async ({ page }) => {
  let assertion;
  page.on('request', request => {
    if (request.url().includes('/realms/lesson-saml/broker/lesson-saml/endpoint') &&
        request.method() === 'POST' && new URLSearchParams(request.postData() ?? '').has('SAMLResponse')) {
      assertion = { url: request.url(), body: request.postData() };
    }
  });
  await providerLogin(page, 'saml');
  await expect(page.getByTestId('lesson-user')).toHaveText('saml-test-user');
  expect(typeof assertion?.body).toBe('string');
  const replay = await page.request.post(assertion.url, { data: assertion.body,
    headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  expect(replay.status()).toBe(400);
});

for (const variant of ['control', 'wrong-audience', 'wrong-recipient', 'expired']) {
  defineCheck(`saml:signed-${variant}`, async ({ page, playwright }) => {
    const { resignSamlResponse } = await import('./saml-fixture.mjs');
    const key = { privateKey: readFileSync('/saml-fixture/private.pem', 'utf8'),
      certificate: readFileSync('/saml-fixture/certificate.pem', 'utf8') };
    let transformed = 0;
    let tokenIssued = false;
    page.on('response', response => {
      if (response.url().includes('/realms/lesson-saml/protocol/openid-connect/token') && response.status() === 200) tokenIssued = true;
    });
    await page.route('**/realms/lesson-saml/broker/lesson-saml/endpoint*', async route => {
      const body = new URLSearchParams(route.request().postData() ?? '');
      if (body.has('SAMLResponse')) {
        // Neither the assertion nor signing material enters assertions or reporter diagnostics.
        const xml = resignSamlResponse(Buffer.from(body.get('SAMLResponse'), 'base64').toString(), variant, key);
        body.set('SAMLResponse', Buffer.from(xml).toString('base64'));
        transformed++;
        await route.continue({ postData: body.toString() });
      } else await route.continue();
    });
    const token = variant === 'control' ? captureToken(page, 'lesson-saml') : undefined;
    await providerLogin(page, 'saml');
    await expect.poll(() => transformed).toBe(1);
    if (variant === 'control') {
      await expect(page.getByTestId('lesson-user')).toHaveText('saml-test-user');
      await checkLessonToken(playwright, await token, 'saml');
    } else {
      await expect(page.locator('#kc-error-message')).toBeVisible();
      await expect(page.getByTestId('lesson-user')).toHaveCount(0);
      expect(new URL(page.url()).pathname).toBe('/realms/lesson-saml/broker/lesson-saml/endpoint');
      expect(tokenIssued).toBe(false);
    }
  });
}

const roleClaims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).lesson_roles ?? [];
for (const kind of ['mapped', 'absent', 'unrecognized']) {
  defineCheck(`saml:role-${kind}`, async ({ page, playwright }) => {
    const token = captureToken(page, 'lesson-saml');
    await providerLogin(page, 'saml', `role-${kind}`);
    await expect(page.getByTestId('lesson-user')).toHaveText(`saml-test-role-${kind}`);
    const value = await token;
    expect(roleClaims(value)).toEqual(kind === 'mapped' ? ['lesson-reviewer'] : []);
    await checkLessonToken(playwright, value, 'saml');
  });
}
defineCheck('saml:role-withdrawn-on-login', async ({ page, playwright, browser }) => {
  const token = captureToken(page, 'lesson-saml');
  await providerLogin(page, 'saml', 'role-withdrawn');
  await expect(page.getByTestId('lesson-user')).toHaveText('saml-test-role-withdrawn');
  expect(roleClaims(await token)).toEqual(['lesson-reviewer']);
  const next = await browser.newContext();
  try {
    const second = await next.newPage();
    const { resignSamlResponse } = await import('./saml-fixture.mjs');
    const key = { privateKey: readFileSync('/saml-fixture/private.pem', 'utf8'), certificate: readFileSync('/saml-fixture/certificate.pem', 'utf8') };
    let transformed = 0;
    await second.route('**/realms/lesson-saml/broker/lesson-saml/endpoint*', async route => {
      const body = new URLSearchParams(route.request().postData() ?? '');
      if (body.has('SAMLResponse')) {
        const xml = resignSamlResponse(Buffer.from(body.get('SAMLResponse'), 'base64').toString(), 'without-lesson-role', key);
        body.set('SAMLResponse', Buffer.from(xml).toString('base64')); transformed++;
        await route.continue({ postData: body.toString() });
      } else await route.continue();
    });
    const updated = captureToken(second, 'lesson-saml');
    await providerLogin(second, 'saml', 'role-withdrawn');
    await expect(second.getByTestId('lesson-user')).toHaveText('saml-test-role-withdrawn');
    expect(transformed).toBe(1);
    const value = await updated;
    expect(roleClaims(value)).toEqual([]);
    await checkLessonToken(playwright, value, 'saml');
  } finally { await next.close(); }
});

async function checkSamlLifecycle({ page, context, playwright }, name) {
  const tokenEndpoint = 'https://shop.magic.test:9643/realms/lesson-saml/protocol/openid-connect/token';
  const assertionEndpoint = 'https://shop.magic.test:9643/realms/lesson-saml/broker/lesson-saml/endpoint';
  let assertions = 0;
  let browserRefreshes = 0;
  page.on('request', request => {
    const body = new URLSearchParams(request.postData() ?? '');
    if (request.url().startsWith(assertionEndpoint) && request.method() === 'POST' && body.has('SAMLResponse')) assertions++;
    if (request.url() === tokenEndpoint && body.get('grant_type') === 'refresh_token') browserRefreshes++;
  });
  const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  const roles = kind => kind === 'refresh-without-role' ? [] : ['lesson-reviewer'];
  async function verifyToken(token, kind) {
    expect(claims(token).preferred_username).toBe(`saml-test-life-${kind}`);
    expect(roleClaims(token)).toEqual(roles(kind));
    await checkLessonToken(playwright, token, 'saml');
  }
  async function session(kind, allowSso = false) {
    const pending = page.waitForResponse(value => value.url() === tokenEndpoint && value.request().method() === 'POST' && value.status() === 200);
    void pending.catch(() => {});
    const before = assertions;
    await providerLogin(page, 'saml', `life-${kind}`, allowSso);
    await expect(page.getByTestId('lesson-user')).toHaveText(`saml-test-life-${kind}`);
    expect(assertions > before).toBe(true);
    const tokens = await (await pending).json();
    expect(typeof tokens.access_token).toBe('string');
    expect(typeof tokens.refresh_token).toBe('string');
    checkShortAccessLifetime(tokens);
    expect(tokens.refresh_expires_in > 0 && tokens.refresh_expires_in <= 45).toBe(true);
    await verifyToken(tokens.access_token, kind);
    return tokens;
  }
  const refresh = (tokens, clientId = 'saml-spa') => context.request.post(tokenEndpoint, {
    form: { grant_type: 'refresh_token', client_id: clientId, refresh_token: tokens.refresh_token },
  });
  async function refreshed(tokens, kind) {
    const before = assertions;
    const response = await refresh(tokens);
    expect(response.status()).toBe(200);
    const next = await response.json();
    expect(typeof next.access_token).toBe('string');
    expect(next.access_token !== tokens.access_token).toBe(true);
    expect(claims(next.access_token).sub === claims(tokens.access_token).sub).toBe(true);
    await verifyToken(next.access_token, kind);
    // Broker refresh uses the last imported mapping; it does not solicit a new SAML assertion.
    expect(assertions).toBe(before);
  }
  async function rejectedRefresh(tokens, clientId) {
    const response = await refresh(tokens, clientId);
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe('invalid_grant');
  }
  switch (name) {
    case 'saml:access-expiry-reenters-federation': {
      const tokens = await session('expiry');
      const remaining = claims(tokens.access_token).exp * 1000 - Date.now();
      expect(remaining > 5000).toBe(true);
      await page.waitForTimeout(Math.max(0, remaining - 3000));
      await expect(page.getByTestId('lesson-user')).toHaveText('saml-test-life-expiry');
      await expect(page.getByTestId('lesson-user')).toHaveCount(0, { timeout: 10_000 });
      await expect(page.getByRole('button', { name: 'Sign in with SAML' })).toBeVisible();
      expect(browserRefreshes).toBe(0);
      // Preserve provider cookies, but require a new accepted SAML response on re-entry.
      const next = await session('expiry', true);
      expect(claims(next.access_token).sub === claims(tokens.access_token).sub).toBe(true);
      break;
    }
    case 'saml:refresh-preserves-role':
    case 'saml:refresh-without-role': {
      const kind = name === 'saml:refresh-preserves-role' ? 'refresh' : 'refresh-without-role';
      const tokens = await session(kind);
      await refreshed(tokens, kind);
      await expect(page.getByTestId('lesson-user')).toHaveText(`saml-test-life-${kind}`);
      break;
    }
    case 'saml:logout-invalidates-refresh': {
      const tokens = await session('logout');
      await page.getByRole('button', { name: 'Sign out of lesson' }).click();
      await expect(page.getByRole('button', { name: 'Sign in with SAML' })).toBeVisible();
      await rejectedRefresh(tokens);
      await page.reload(); await expect(page.getByTestId('lesson-user')).toHaveCount(0);
      break;
    }
    case 'saml:refresh-client-binding': {
      const tokens = await session('binding');
      await rejectedRefresh(tokens, 'account-console');
      // Same-token successful control excludes expiry as the mismatch rejection cause.
      await refreshed(tokens, 'binding');
      break;
    }
    case 'saml:session-expiry-rejects-refresh': {
      const tokens = await session('session-expiry');
      await page.waitForTimeout(tokens.refresh_expires_in * 1000 + 1500);
      await rejectedRefresh(tokens);
      await expect(page.getByTestId('lesson-user')).toHaveCount(0);
      break;
    }
  }
  expect(browserRefreshes).toBe(0);
}
for (const name of samlSessionCaseNames) defineCheck(name, args => checkSamlLifecycle(args, name));

// Every invocation owns its browser context, assertions, and signing material.
async function runcheckSaml(browser, name, playwright) {
  if (![...samlCaseNames, ...samlSessionCaseNames].includes(name) || !checks.has(name)) throw new Error('Unknown SAML check');
  if (samlSessionCaseNames.includes(name) !== (process.env.LAB_AUTH_SUITE === 'saml-lifecycle')) throw new Error('Wrong SAML fixture phase');
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await checks.get(name)({ page, context, playwright, browser });
  } finally { await context.close(); }
}

export async function checkSaml(browser, name, playwright) {
  return withAuthRecording(browser, playwright, name, 'saml', (recorded, runtime) => runcheckSaml(recorded, name, runtime));
}
