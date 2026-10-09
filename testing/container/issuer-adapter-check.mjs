import { strict as assert } from 'node:assert';
import { X509Certificate } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { PkiCommandAdapter } from 'saturday-keycloak-prototype';
import { runCli } from 'saturday-keycloak-prototype/cli';

const outputNames = ['shop', 'auth', 'ui', 'customer-api', 'catalog-api', 'insights-api', 'postgres', 'gateway-client', 'customer-client', 'catalog-client', 'insights-client', 'customer-waterdeep', 'customer-baldur', 'customer-neverwinter', 'shopkeeper', 'shop-admin', 'disabled-customer', 'unknown-user'];
for (const name of outputNames) await mkdir(`/out/${name}`, { recursive: true });
await mkdir('/tmp/operator', { recursive: true });
await writeFile('/tmp/operator/capability', 'isolated-issuer-check\n', { mode: 0o600 });
const adapter = new PkiCommandAdapter('/work/testing/container/issuer-command.mjs', '/tmp/operator/capability', 120_000);
const ref = { namespace: 'lab', name: 'customer-waterdeep' };
await adapter.run('provision', ref);
const configPath = '/tmp/issuer-package-config.json';
await writeFile(configPath, JSON.stringify({
  root: '/out', identities: {},
  target: { origins: ['https://store.example.test:8443'], issuer: 'https://identity.example.test:9443/realms/lab' },
  trustFiles: ['/public/user-ca.pem'],
  pki: { executable: '/work/testing/container/issuer-command.mjs', capabilityFile: '/tmp/operator/capability' }
}), { mode: 0o600 });
const first = new X509Certificate(await readFile('/out/customer-waterdeep/cert.pem'));
assert.equal(JSON.parse(await runCli([configPath, 'renew', ref.namespace, ref.name])).status, 'ok');
const renewed = new X509Certificate(await readFile('/out/customer-waterdeep/cert.pem'));
assert.notEqual(renewed.serialNumber, first.serialNumber);
assert.equal(renewed.subject, first.subject);
assert.equal(JSON.parse(await runCli([configPath, 'revoke', ref.namespace, ref.name])).status, 'ok');
await assert.rejects(promisify(execFile)('/usr/bin/openssl', [
  'verify', '-purpose', 'sslclient', '-CAfile', '/public/user-ca.pem',
  '-CRLfile', '/public/user.crl.pem', '-crl_check', '/out/customer-waterdeep/cert.pem'
], { timeout: 10_000, maxBuffer: 16_384 }));
console.log('Isolated CA through package adapter and CLI: provision, same-identity renewal, CRL publication and revoked-leaf rejection passed');
