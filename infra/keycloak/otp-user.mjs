import { lessonAdmin } from './lesson-admin.mjs';
import { readPassword } from './password-input.mjs';

// Dedicated manual lesson user, with no certificate attribute or business roles.
const admin = await lessonAdmin();
const username = 'lesson-otp';
const users = await admin('GET', `/users?username=${username}&exact=true&max=2`);
if (users.length > 1) throw new Error('Lesson user ambiguous');
const password = await readPassword('New lesson-otp password: ');
const confirmation = await readPassword('Confirm password: ');
if (password !== confirmation || password.length < 12) throw new Error('Passwords must match and contain at least 12 characters');
if (users.length === 0) {
  await admin('POST', '/users', { username, enabled: true, requiredActions: ['CONFIGURE_TOTP'] }, 201);
}
const [user] = await admin('GET', `/users?username=${username}&exact=true&max=2`);
if (!user || user.attributes?.cert_identity?.length) throw new Error('Expected a dedicated certificate-free lesson user');
const roles = await admin('GET', `/users/${user.id}/role-mappings/realm/composite`);
if (roles.some(value => ['customer', 'shopkeeper', 'shop-admin'].includes(value.name))) throw new Error('Lesson user has business roles');
await admin('PUT', `/users/${user.id}/reset-password`, { type: 'password', temporary: false, value: password }, 204);
await admin('POST', `/users/${user.id}/logout`, undefined, 204);
console.log('lesson-otp password set; enroll your authenticator during first login at https://shop.magic.test:8543/teaching/password-otp');
