import { strict as assert } from 'node:assert';
import { identityKey, publicMetadata } from 'saturday-keycloak-prototype';
import { certificateContextOptions, saturdayConvention } from 'saturday-keycloak-prototype/playwright';
import { createCertificateCucumberHooks } from 'saturday-keycloak-prototype/cucumber';
import { manualBrowserManifest } from 'saturday-keycloak-prototype/manual';

const ref = { namespace: 'consumer', name: 'one' };
const target = { origins: ['https://shop.example.test:8443', 'https://auth.example.test:9443'], issuer: 'https://auth.example.test:9443/realms/consumer' };
const material = { ref, cert: '/identity/cert.pem', key: '/identity/key.pem', pfx: '/identity/cert.p12', passphrase: '/identity/passphrase', serial: '01', fingerprint256: 'AA', subject: 'CN=one', issuer: 'CN=Consumer CA', expiresAt: '2030-01-01T00:00:00Z' };
const provider = { resolve: async () => material };
assert.equal(identityKey(ref), 'consumer/one');
assert.equal((await certificateContextOptions(provider, ref, target)).clientCertificates.length, 2);
assert.equal(saturdayConvention('https://shop.example.test:8443', '/certs', 'one').keyPath, '/certs/clients/one.key.pem');
assert.equal(manualBrowserManifest('chrome', material, target, ['/trust/ca.pem']).policy.AutoSelectCertificateForUrls.length, 2);
assert.equal(typeof createCertificateCucumberHooks({ browser: () => { throw new Error('not launched'); }, provider, target, resolveIdentity: () => ref }).before, 'function');
assert.ok(!JSON.stringify(publicMetadata(material)).includes('key.pem'));
console.log('Independent packed consumer: core, Playwright, Cucumber and manual exports passed');
