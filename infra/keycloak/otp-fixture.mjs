import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { lessonAdmin } from './lesson-admin.mjs';

const action = process.argv[2];
if (!['start', 'finish', 'verify'].includes(action)) throw new Error('Expected start, finish or verify');
if (!/^magic-shop-otp-[a-z0-9-]+$/.test(process.env.LAB_PROJECT ?? '')) throw new Error('OTP fixtures require a disposable magic-shop-otp-* project');
const statePath = '/test-secrets/otp.json';
const names = ['otp-test-user', 'otp-test-disabled', 'otp-test-enroll'];
const admin = await lessonAdmin();
const find = name => admin('GET', `/users?username=${name}&exact=true&max=2`);
if (action === 'start') {
  if (existsSync(statePath)) throw new Error('Prior OTP fixture state remains');
  for (const name of names) if ((await find(name)).length) throw new Error('Existing OTP fixture user retained; use a fresh disposable project');
  const entries = names.map(username => ({ username, password: randomBytes(32).toString('base64url') }));
  // Persist names before any mutation so partial setup can be removed safely.
  writeFileSync(statePath, JSON.stringify(entries), { mode: 0o600, flag: 'wx' });
  for (const entry of entries) {
    await admin('POST', '/users', { username: entry.username, enabled: entry.username !== 'otp-test-disabled',
      requiredActions: ['CONFIGURE_TOTP'], credentials: [{ type: 'password', temporary: false, value: entry.password }] }, 201);
  }
  console.log('Dedicated OTP fixtures created; secrets remain inside the test volume.');
} else if (action === 'finish') {
  if (existsSync(statePath)) {
    const entries = JSON.parse(readFileSync(statePath, 'utf8'));
    if (entries.length !== names.length || entries.some((value, index) => value.username !== names[index])) throw new Error('Unexpected fixture state');
    for (const name of names) {
      const users = await find(name);
      if (users.length > 1) throw new Error('Fixture user ambiguous');
      if (users.length) await admin('DELETE', `/users/${users[0].id}`, undefined, 204);
    }
    unlinkSync(statePath);
  }
  console.log('OTP fixture users and secret file removed.');
} else {
  if (existsSync(statePath)) throw new Error('OTP secret file remains');
  for (const name of names) if ((await find(name)).length) throw new Error('OTP fixture user remains');
  console.log('OTP fixture cleanup verified.');
}
