import { lessonAdmin } from './lesson-admin.mjs';
import { readPassword } from './password-input.mjs';

const admin = await lessonAdmin();
const username = 'lesson-passkeys';
const users = await admin('GET', `/users?username=${username}&exact=true&max=2`);
if (users.length > 1) throw new Error('Passkey lesson user ambiguous');
const password = await readPassword('New lesson-passkeys enrollment password: ');
const confirmation = await readPassword('Confirm password: ');
if (password !== confirmation || password.length < 12) throw new Error('Passwords must match and contain at least 12 characters');
if (!users.length) await admin('POST', '/users', { username, enabled: true,
  requiredActions: ['webauthn-register-passwordless'] }, 201);
const [user] = await admin('GET', `/users?username=${username}&exact=true&max=2`);
const roles = await admin('GET', `/users/${user.id}/role-mappings/realm/composite`);
if (user.attributes?.cert_identity?.length || roles.some(value => ['customer', 'shopkeeper', 'shop-admin'].includes(value.name))) {
  throw new Error('Expected a dedicated passkey lesson user without business access');
}
await admin('PUT', `/users/${user.id}/reset-password`, { type: 'password', temporary: false, value: password }, 204);
await admin('POST', `/users/${user.id}/logout`, undefined, 204);
console.log('Enrollment account ready at https://shop.magic.test:8543/teaching/passkeys/enroll; existing passkeys retained.');
