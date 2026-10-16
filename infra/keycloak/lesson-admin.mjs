import { readFileSync } from 'node:fs';

async function json(response, expected) {
  if (response.status !== expected) throw new Error(`Lesson administration returned ${response.status}`);
  const text = await response.text();
  if (text.length > 1_048_576) throw new Error('Lesson response exceeds bound');
  return text ? JSON.parse(text) : undefined;
}

export async function lessonAdmin({ origin = 'https://auth.magic.test:9443', realm = 'magic-shop' } = {}) {
  const token = (await json(await fetch(`${origin}/realms/master/protocol/openid-connect/token`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: 'lab-bootstrap',
      client_secret: readFileSync('/secrets/admin/client-secret', 'utf8').trim() }),
    signal: AbortSignal.timeout(10_000),
  }), 200)).access_token;
  if (typeof token !== 'string') throw new Error('Lesson admin token missing');
  const root = realm === null ? '/admin' : `/admin/realms/${realm}`;
  return async (method, path, body, expected = 200) => json(await fetch(`${origin}${root}${path}`, {
    method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000),
  }), expected);
}
