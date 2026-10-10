// Transient test passwords only. Refuse to replace an operator's existing password.
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const origin = 'https://auth.magic.test:9443';
const statePath = '/test-secrets/passwords.json';
const action = process.argv[2];
if (!['start', 'finish', 'verify'].includes(action)) throw new Error('Expected start, finish or verify');
async function responseJson(response, expected) {
  if (response.status !== expected) throw new Error(`Fixture API returned ${response.status}`);
  const text = await response.text();
  if (text.length > 1_048_576) throw new Error('Fixture response exceeds bound');
  return text ? JSON.parse(text) : undefined;
}
const token = (await responseJson(await fetch(`${origin}/realms/master/protocol/openid-connect/token`, {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_id: 'lab-bootstrap', client_secret: readFileSync('/secrets/admin/client-secret', 'utf8').trim() }),
  signal: AbortSignal.timeout(10_000),
}), 200)).access_token;
async function admin(method, path, body, expected = 200) {
  return responseJson(await fetch(`${origin}/admin/realms/magic-shop${path}`, {
    method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000),
  }), expected);
}
if (action === 'start') {
  if (existsSync(statePath)) throw new Error('Finish the prior teaching fixture first');
  const entries = [];
  for (const username of ['customer-waterdeep', 'shopkeeper', 'disabled-customer']) {
    const users = await admin('GET', `/users?username=${username}&exact=true&max=2`);
    if (users.length !== 1) throw new Error('Fixture user missing or ambiguous');
    const credentials = await admin('GET', `/users/${users[0].id}/credentials`);
    if (credentials.some(value => value.type === 'password')) throw new Error('Existing operator password retained; use an isolated lab project for tests');
    entries.push({ username, id: users[0].id, password: randomBytes(32).toString('base64url') });
  }
  writeFileSync(statePath, JSON.stringify(entries), { mode: 0o600, flag: 'wx' });
  for (const entry of entries) await admin('PUT', `/users/${entry.id}/reset-password`, { type: 'password', temporary: false, value: entry.password }, 204);
  console.log('Transient random test passwords created in Docker volume; no values logged.');
} else if (action === 'verify') {
  if (existsSync(statePath)) throw new Error('Transient password file remains');
  for (const username of ['customer-waterdeep', 'shopkeeper', 'disabled-customer']) {
    const users = await admin('GET', `/users?username=${username}&exact=true&max=2`);
    if (users.length !== 1) throw new Error('Fixture user missing or ambiguous');
    const credentials = await admin('GET', `/users/${users[0].id}/credentials`);
    if (credentials.some(value => value.type === 'password')) throw new Error('Transient account password remains');
  }
  console.log('Transient password file and account credentials verified absent.');
} else {
  const entries = JSON.parse(readFileSync(statePath, 'utf8'));
  for (const entry of entries) {
    const credentials = await admin('GET', `/users/${entry.id}/credentials`);
    for (const credential of credentials.filter(value => value.type === 'password')) await admin('DELETE', `/users/${entry.id}/credentials/${credential.id}`, undefined, 204);
    await admin('POST', `/users/${entry.id}/logout`, undefined, 204);
  }
  unlinkSync(statePath);
  console.log('Transient passwords removed and fixture sessions terminated.');
}
