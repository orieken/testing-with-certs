import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { lessonSessionPolicy } from './lesson-session-policy.mjs';
import { lessonAdmin } from './lesson-admin.mjs';

const action = process.argv[2];
if (!['start', 'start-passkeys-lifecycle', 'finish', 'verify', 'kerberos-disable', 'kerberos-enable'].includes(action)) throw new Error('Unknown authentication lesson fixture action');
if (!/^magic-shop-auth-[a-z0-9-]+$/.test(process.env.LAB_PROJECT ?? '')) throw new Error('Use a disposable magic-shop-auth-* project');
const local = await lessonAdmin();
const kerberos = await lessonAdmin({ realm: 'lesson-kerberos' });
const provider = await lessonAdmin({ origin: 'https://shop.magic.test:9643', realm: 'lesson-provider' });
const oidc = await lessonAdmin({ origin: 'https://shop.magic.test:9643', realm: 'lesson-oidc' });
const saml = await lessonAdmin({ origin: 'https://shop.magic.test:9643', realm: 'lesson-saml' });
const admins = { local, provider, oidc, saml };
const policy = lessonSessionPolicy('passkeys-spa');
const policyPath = '/test-secrets/passkey-session-policy.json';
const statePath = '/test-secrets/auth-users.json';
const specs = [
  ...['mapped', 'absent', 'unrecognized', 'withdrawn'].map(kind => ({ username: `saml-test-role-${kind}`, target: 'provider',
    attributes: kind === 'absent' ? {} : { lesson_role: [kind === 'unrecognized' ? 'administrator' : 'reviewer'] } })),
  ...['enrollment', 'login', 'missing', 'signature', 'isolation', 'second', 'expiry', 'refresh', 'logout', 'binding', 'session-expiry'].map(name => ({ username: `passkeys-test-${name}`, target: 'local', requiredActions: ['webauthn-register-passwordless'] })),
  { username: 'passkeys-test-other', target: 'local', requiredActions: ['webauthn-register-passwordless'] },
  { username: 'passkeys-test-disabled', target: 'local', enabled: false },
  ...['oidc', 'saml'].flatMap(method => [
    { username: `${method}-test-user`, target: 'provider' },
    { username: `${method}-test-disabled`, target: 'provider', enabled: false },
  ]),
];
const find = (admin, username) => admin('GET', `/users?username=${encodeURIComponent(username)}&exact=true&max=2`);

if (action.startsWith('kerberos-')) {
  const users = await find(kerberos, 'lesson-kerberos');
  if (users.length !== 1) throw new Error('Authenticate Kerberos fixture once before toggling its imported account');
  await kerberos('PUT', `/users/${users[0].id}`, { enabled: action === 'kerberos-enable' }, 204);
  await kerberos('POST', `/users/${users[0].id}/logout`, undefined, 204);
} else if (action === 'start' || action === 'start-passkeys-lifecycle') {
  if (existsSync(statePath)) throw new Error('Prior authentication fixture remains');
  for (const spec of specs) if ((await find(admins[spec.target], spec.username)).length) throw new Error('Existing lesson account retained');
  if (action === 'start-passkeys-lifecycle') await policy.start(local, policyPath);
  const entries = specs.map(value => ({ ...value, password: randomBytes(32).toString('base64url') }));
  writeFileSync(statePath, JSON.stringify(entries), { mode: 0o600, flag: 'wx' });
  for (const entry of entries) await admins[entry.target]('POST', '/users', {
    username: entry.username, email: `${entry.username}@lesson.invalid`, enabled: entry.enabled !== false,
    requiredActions: entry.requiredActions ?? [], attributes: entry.attributes ?? {},
    credentials: [{ type: 'password', temporary: false, value: entry.password }],
  }, 201);
  console.log('Dedicated passkey and provider fixture accounts created; values withheld.');
} else if (action === 'finish') {
  await policy.finish(local, policyPath);
  if (existsSync(statePath)) {
    const entries = JSON.parse(readFileSync(statePath, 'utf8'));
    if (entries.length !== specs.length || entries.some((value, index) => value.username !== specs[index].username || value.target !== specs[index].target)) throw new Error('Fixture state drift');
    for (const spec of specs) {
      const targets = spec.target === 'provider' ? [provider, spec.username.startsWith('oidc-') ? oidc : saml] : [local];
      for (const admin of targets) {
        const users = await find(admin, spec.username);
        if (users.length > 1) throw new Error('Fixture account ambiguous');
        if (users.length) await admin('DELETE', `/users/${users[0].id}`, undefined, 204);
      }
    }
    unlinkSync(statePath);
  }
  console.log('Passkey/provider fixture accounts and secret file removed.');
} else {
  await policy.verify(local, policyPath);
  if (existsSync(statePath)) throw new Error('Fixture secret file remains');
  for (const spec of specs) if ((await find(admins[spec.target], spec.username)).length) throw new Error('Fixture account remains');
  for (const spec of specs.filter(value => value.target === 'provider')) {
    const broker = spec.username.startsWith('oidc-') ? oidc : saml;
    if ((await find(broker, spec.username)).length) throw new Error('Broker fixture user remains');
  }
  console.log('Authentication lesson fixture cleanup verified.');
}
