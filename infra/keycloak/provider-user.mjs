import { lessonAdmin } from './lesson-admin.mjs';
import { readPassword } from './password-input.mjs';

const method = process.argv[2];
if (!['oidc', 'saml'].includes(method)) throw new Error('Choose oidc or saml');
const admin = await lessonAdmin({ origin: 'https://shop.magic.test:9643', realm: 'lesson-provider' });
const username = `lesson-${method}`;
const found = await admin('GET', `/users?username=${username}&exact=true&max=2`);
if (found.length > 1) throw new Error('Provider lesson account ambiguous');
const password = await readPassword(`New ${username} provider password: `);
const confirmation = await readPassword('Confirm password: ');
if (password !== confirmation || password.length < 12) throw new Error('Passwords must match and contain at least 12 characters');
if (!found.length) await admin('POST', '/users', { username, enabled: true, email: `${username}@lesson.invalid` }, 201);
const [user] = await admin('GET', `/users?username=${username}&exact=true&max=2`);
await admin('PUT', `/users/${user.id}/reset-password`, { type: 'password', temporary: false, value: password }, 204);
await admin('POST', `/users/${user.id}/logout`, undefined, 204);
console.log(`${username}: provider password set; enter it on the lesson provider page.`);
