import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, readFile, writeFile } from 'node:fs/promises';
import { FileCertificateProvider } from 'saturday-keycloak-prototype';
import { manualBrowserManifest } from 'saturday-keycloak-prototype/manual';

const run = promisify(execFile);
const selected = process.env.LAB_USER;
const browser = process.env.LAB_BROWSER;
const home = process.env.HOME;
if (!selected || !home || (browser !== 'chrome' && browser !== 'msedge')) throw new Error('Selected user, browser and container HOME required');
for (const file of ['cert.pem', 'key.pem', 'identity.p12', 'password']) {
  try { await access(`/identity/${file}`); }
  catch { throw new Error(`Selected certificate bundle is incomplete: /identity/${file}`); }
}

const provider = new FileCertificateProvider('/identity', {
  [`lab/${selected}`]: { cert: 'cert.pem', key: 'key.pem', pfx: 'identity.p12', passphrase: 'password' }
});
const material = await provider.resolve({ namespace: 'lab', name: selected });
const identities = JSON.parse(await readFile('/work/seed/identities.json', 'utf8'));
const expected = identities.find(identity => identity.username === selected)?.certIdentity
  ?? (selected === 'unknown-user' ? '88888888-8888-4888-8888-888888888888' : undefined);
const actual = material.subject.match(/(?:^|\n)CN=([^\n]+)/)?.[1];
if (!expected || actual !== expected) throw new Error(`Selected certificate identity does not match ${selected}`);
const manifest = manualBrowserManifest(browser, material, {
  origins: ['https://shop.magic.test:8443', 'https://auth.magic.test:9443'],
  issuer: 'https://auth.magic.test:9443/realms/magic-shop'
}, ['/public/server-ca.pem']);
for (const path of [...manifest.trustFiles, manifest.pfxPath, manifest.passphraseFile]) await access(path);

try {
  await run('pk12util', ['-i', manifest.pfxPath, '-d', `sql:${home}/.local/share/pki/nssdb`, '-w', manifest.passphraseFile], { timeout: 10_000, maxBuffer: 16_384 });
} catch { throw new Error('Selected certificate import failed'); }
const policyPath = browser === 'chrome'
  ? '/etc/opt/chrome/policies/managed/magic-shop.json'
  : '/etc/opt/edge/policies/managed/magic-shop.json';
await writeFile(policyPath, JSON.stringify(manifest.policy), { mode: 0o600 });
console.log(`Native ${browser} identity and exact-origin policy installed for ${selected}`);
