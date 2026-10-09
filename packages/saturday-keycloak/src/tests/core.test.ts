import { strict as assert } from 'node:assert';
import { mkdtemp, writeFile, symlink, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { identityKey, exactOrigin, validateTarget, publicMetadata, type CertificateMaterial } from '../core.js';
import { FileCertificateProvider } from '../files.js';
import { PkiCommandAdapter } from '../pki.js';
import { certificateContextOptions, saturdayConvention } from '../playwright.js';
import { manualBrowserManifest } from '../manual.js';

const ref = { namespace: 'lesson', name: 'arbitrary-user' };
const target = { origins: ['https://shop.example.test:8443', 'https://auth.example.test:9443'], issuer: 'https://auth.example.test:9443/realms/lesson' };
const material: CertificateMaterial = { ref, cert: '/identity/cert.pem', key: '/identity/key.pem', pfx: '/identity/user.p12', passphrase: '/identity/passphrase', serial: '01', fingerprint256: 'AA', subject: 'CN=arbitrary-user', issuer: 'CN=Example user CA', expiresAt: '2030-01-01T00:00:00.000Z' };

test('validates arbitrary refs and exact multiple HTTPS origins', () => {
  assert.equal(identityKey(ref), 'lesson/arbitrary-user');
  for (const bad of ['https://shop.example.test:8443/', 'https://shop.example.test:8443/path', 'http://shop.example.test:8443', 'https://u:p@shop.example.test:8443']) assert.throws(() => exactOrigin(bad));
  assert.throws(() => identityKey({ namespace: '../other', name: 'x' }));
  assert.throws(() => validateTarget({ ...target, origins: [target.origins[0], target.origins[0]] }));
  assert.deepEqual(validateTarget(target), target);
});
test('same resolver supplies two Playwright origins, API options and public-only metadata', async () => {
  const provider = { resolve: async () => material };
  const options = await certificateContextOptions(provider, ref, target);
  assert.equal(options.ignoreHTTPSErrors, false);
  assert.deepEqual(options.clientCertificates.map(item => item.origin), target.origins);
  assert.deepEqual(options.clientCertificates.map(item => item.certPath), [material.cert, material.cert]);
  assert.equal(saturdayConvention('https://example.test', '/certs', 'any').certPath, '/certs/clients/any.crt.pem');
  const publicView = JSON.stringify(publicMetadata(material));
  assert.ok(!publicView.includes('cert.pem') && !publicView.includes('key.pem') && !publicView.includes('p12'));
});
test('manual manifest has exact brand policies and references only', () => {
  const manifest = manualBrowserManifest('msedge', material, target, ['/trust/user-ca.pem']);
  assert.equal(manifest.policy.AutoSelectCertificateForUrls.length, 2);
  assert.deepEqual(manifest.origins, target.origins);
  assert.equal(JSON.parse(manifest.policy.AutoSelectCertificateForUrls[0]).filter.SUBJECT.CN, 'arbitrary-user');
  assert.throws(() => manualBrowserManifest('chromium' as 'chrome', material, target, ['/trust/user-ca.pem']));
  assert.throws(() => manualBrowserManifest('chrome', { ...material, pfx: undefined }, target, ['/trust/user-ca.pem']));
});
test('filesystem provider rejects missing, traversal and symlink escape before key reading', async () => {
  const root = await mkdtemp(join(tmpdir(), 'saturday-files-'));
  await mkdir(join(root, 'safe'));
  await writeFile(join(root, 'safe', 'cert.pem'), 'invalid');
  await writeFile(join(root, 'safe', 'key.pem'), 'invalid');
  await symlink('/etc/passwd', join(root, 'safe', 'outside'));
  await assert.rejects(new FileCertificateProvider(root, {}).resolve(ref), /Unknown identity/);
  await assert.rejects(new FileCertificateProvider(root, { [identityKey(ref)]: { cert: '../escape', key: 'safe/key.pem' } }).resolve(ref), /Unsafe certificate path/);
  await assert.rejects(new FileCertificateProvider(root, { [identityKey(ref)]: { cert: 'safe/outside', key: 'safe/key.pem' } }).resolve(ref), /escapes root/);
  await assert.rejects(new FileCertificateProvider(root, { [identityKey(ref)]: { cert: 'safe/cert.pem', key: 'safe/key.pem' } }).resolve(ref), /cannot be parsed/);
});
test('PKI adapter requires explicit capability and uses structured arguments', async () => {
  const root = await mkdtemp(join(tmpdir(), 'saturday-pki-'));
  const script = join(root, 'issuer'); const capability = join(root, 'capability'); const output = join(root, 'args');
  await writeFile(script, `#!/bin/sh\nprintf '%s\\n' "$1" "$2" "$3" > ${output}\n`, { mode: 0o700 });
  await writeFile(capability, 'operator-only\n');
  await new PkiCommandAdapter(script, capability).run('renew', ref);
  const { readFile } = await import('node:fs/promises');
  assert.equal(await readFile(output, 'utf8'), 'renew\nlesson\narbitrary-user\n');
  await writeFile(capability, '');
  await assert.rejects(new PkiCommandAdapter(script, capability).run('revoke', ref), /capability/);
});
