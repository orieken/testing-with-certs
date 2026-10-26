import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { checkLessonToken, lessonOrigin } from './auth-lessons.mjs';

const origin = 'https://shop.magic.test:9643';
const applicationCallback = `${lessonOrigin}/teaching/oidc/callback`;
const brokerCallback = `${origin}/realms/lesson-oidc/broker/lesson-oidc/endpoint`;
const callbackMatches = callback => url => `${url.origin}${url.pathname}` === callback;

// Browser routing does not intercept later requests in a redirect chain.
// Capture the credential POST's real response, then follow bounded, trusted
// redirects privately until the intended callback is about to be delivered.
export async function interceptProviderCallback(page, callback, handle) {
  const matches = url => url.origin === origin && url.pathname === '/realms/lesson-provider/login-actions/authenticate';
  let handled = false;
  const intercept = async route => {
    if (handled || route.request().method() !== 'POST') return route.continue();
    handled = true;
    let response = await route.fetch({ maxRedirects: 0 });
    for (let hop = 0; hop < 5; hop++) {
      expect([302, 303].includes(response.status())).toBe(true);
      const location = response.headers().location;
      expect(typeof location).toBe('string');
      const url = new URL(location, response.url());
      expect([origin, lessonOrigin].includes(url.origin)).toBe(true);
      if (callbackMatches(callback)(url)) return handle(route, url, response);
      response = await page.context().request.get(url.href, { maxRedirects: 0 });
    }
    throw new Error('OIDC callback redirect limit exceeded');
  };
  await page.route(matches, intercept);
}

// Callback URLs, codes, verifiers and responses remain private to the scenario.
export async function checkCallbackState({ page, providerLogin, playwright, broker }) {
  const callback = broker ? brokerCallback : applicationCallback;
  const tokenEndpoint = `${origin}/realms/lesson-oidc/protocol/openid-connect/token`;
  if (broker) {
    // Keycloak invalidates the pending action when its action-code component
    // is corrupted. Prove an untouched transaction first, then own a fresh
    // real transaction for the mutation rather than replaying a consumed one.
    const control = page.waitForResponse(value => value.url() === tokenEndpoint && value.status() === 200);
    void control.catch(() => {});
    await providerLogin();
    await expect(page.getByTestId('lesson-user')).toHaveText('oidc-test-user');
    await checkLessonToken(playwright, (await (await control).json()).access_token, 'oidc');
    await page.getByRole('button', { name: 'Sign out of lesson' }).click();
    await expect(page.getByRole('button', { name: 'Sign in with OpenID Connect' })).toBeVisible();
  }
  let original, mutatedState, mutationObserved = false, mutations = 0, exchanges = 0;
  const observe = request => {
    if (request.url() === tokenEndpoint && request.method() === 'POST') exchanges++;
    const url = new URL(request.url());
    if (callbackMatches(callback)(url) && url.searchParams.get('state') === mutatedState) mutationObserved = true;
  };
  page.on('request', observe);
  await interceptProviderCallback(page, callback, async (route, url, response) => {
    expect(url.searchParams.has('error')).toBe(false);
    expect(Boolean(url.searchParams.get('code'))).toBe(true);
    expect(Boolean(url.searchParams.get('state'))).toBe(true);
    original = url.href;
    const state = url.searchParams.get('state');
    // Mutate the existing value in place. Appending data can leave a broker's
    // encoded transaction identifier intact and is not a reliable state fault.
    mutatedState = `${state[0] === 'A' ? 'B' : 'A'}${state.slice(1)}`;
    url.searchParams.set('state', mutatedState);
    mutations++;
    // Redirect without processing the valid callback, preserving its real code.
    await route.fulfill({ response, status: 302, headers: { ...response.headers(), location: url.href }, body: '' });
  });
  await providerLogin();
  expect(mutations).toBe(1);
  expect(mutationObserved).toBe(true);
  if (broker) {
    await expect(page.locator('#loginRestartLink')).toBeVisible();
    await expect(page.locator('#loginContinueLink')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/realms/lesson-oidc/login-actions/authenticate');
  }
  else await expect(page.getByRole('alert')).toBeVisible();
  expect(exchanges).toBe(0);
  await expect(page.getByTestId('lesson-user')).toHaveCount(0);
  if (broker) { page.off('request', observe); return; }
  // Same untouched callback succeeds: code validity, cookies and pending state
  // cannot independently explain rejection of the state-only mutation.
  const response = page.waitForResponse(value => value.url() === tokenEndpoint && value.status() === 200);
  void response.catch(() => {});
  await page.goto(original);
  await expect(page.getByTestId('lesson-user')).toHaveText('oidc-test-user');
  expect(exchanges).toBe(1);
  await checkLessonToken(playwright, (await (await response).json()).access_token, 'oidc');
  page.off('request', observe);
}

export async function authorizeCode(page, upstream, badRedirect = false, accountKind = 'user') {
  const realm = upstream ? 'lesson-provider' : 'lesson-oidc';
  const clientId = upstream ? 'lesson-oidc-broker' : 'oidc-spa';
  const redirectUri = upstream ? brokerCallback : applicationCallback;
  const verifier = randomBytes(32).toString('base64url');
  const state = randomBytes(24).toString('base64url');
  const url = new URL(`${origin}/realms/${realm}/protocol/openid-connect/auth`);
  url.search = new URLSearchParams({ client_id: clientId, response_type: 'code', scope: 'openid profile',
    redirect_uri: badRedirect ? `${redirectUri}/not-registered` : redirectUri,
    state, prompt: 'login', code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(verifier).digest('base64url') }).toString();
  let code;
  const intercept = async (route, callback) => {
    expect(callback.searchParams.get('state') === state).toBe(true);
    expect(callback.searchParams.has('error')).toBe(false);
    code = callback.searchParams.get('code');
    expect(Boolean(code)).toBe(true);
    await route.fulfill({ contentType: 'text/html', body: '<p>Private code exchange under test</p>' });
  };
  if (!badRedirect) await interceptProviderCallback(page, redirectUri, intercept);
  await page.goto(url.href);
  if (badRedirect) {
    await expect(page.locator('#kc-error-message')).toBeVisible();
    expect(new URL(page.url()).origin).toBe(origin);
    await expect(page.locator('#password')).toHaveCount(0);
    return;
  }
  const user = JSON.parse(readFileSync('/test-secrets/auth-users.json', 'utf8'))
    .find(value => value.username === `oidc-test-${accountKind}`);
  await expect(page).toHaveURL(/^https:\/\/shop\.magic\.test:9643\/realms\/lesson-provider\//);
  await expect(page.locator('#password')).toBeVisible();
  if (await page.locator('#username').isVisible()) await page.locator('#username').fill(user.username);
  else {
    await expect(page.locator('#kc-attempted-username')).toHaveAttribute('readonly', '');
    await expect(page.locator('#kc-attempted-username')).toHaveValue(user.username);
  }
  await page.locator('#password').fill(user.password);
  await page.locator('#kc-login').click();
  await expect.poll(() => Boolean(code)).toBe(true);
  await page.waitForLoadState('domcontentloaded');
  const form = { grant_type: 'authorization_code', client_id: clientId, redirect_uri: redirectUri,
    code, code_verifier: verifier };
  if (upstream) form.client_secret = readFileSync('/test-secrets/federation-client', 'utf8');
  return { endpoint: `${origin}/realms/${realm}/protocol/openid-connect/token`, form };
}

async function successfulExchange(context, transaction, upstream, playwright) {
  const response = await context.request.post(transaction.endpoint, { form: transaction.form });
  expect(response.status()).toBe(200);
  const tokens = await response.json();
  expect(typeof tokens.access_token).toBe('string');
  if (!upstream) await checkLessonToken(playwright, tokens.access_token, 'oidc');
  else {
    const claims = JSON.parse(Buffer.from(tokens.access_token.split('.')[1], 'base64url').toString());
    expect(claims.iss).toBe(`${origin}/realms/lesson-provider`);
    expect(claims.azp).toBe('lesson-oidc-broker');
    expect(claims.preferred_username).toBe('oidc-test-user');
  }
}

export async function checkCodeBoundary({ context, page, playwright, upstream, kind }) {
  // A real, successful control proves the client, callback, secret (upstream),
  // account and S256 implementation work before exercising one changed input.
  const control = await authorizeCode(page, upstream);
  await successfulExchange(context, control, upstream, playwright);
  if (kind === 'redirect') {
    await authorizeCode(page, upstream, true);
    return;
  }
  const transaction = kind === 'replay' ? control : await authorizeCode(page, upstream);
  const form = { ...transaction.form };
  if (kind === 'wrong-verifier') form.code_verifier = randomBytes(32).toString('base64url');
  if (kind === 'missing-verifier') delete form.code_verifier;
  const response = await context.request.post(transaction.endpoint, { form });
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toBe('invalid_grant');
  await expect(page.getByTestId('lesson-user')).toHaveCount(0);
}
