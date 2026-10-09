import { strict as assert } from 'node:assert';
import { FileCertificateProvider } from '../dist/index.js';

const root = '/selected';
const ref = { namespace: 'integration', name: 'customer' };
const valid = new FileCertificateProvider(root, { 'integration/customer': { cert: 'customer/cert.pem', key: 'customer/key.pem' } });
const material = await valid.resolve(ref);
assert.ok(material.fingerprint256 && material.serial && material.expiresAt);
const wrong = new FileCertificateProvider(root, { 'integration/customer': { cert: 'customer/cert.pem', key: 'admin/key.pem' } });
await assert.rejects(wrong.resolve(ref), /do not match/);
const expired = new FileCertificateProvider(root, { 'integration/customer': { cert: 'customer/cert.pem', key: 'customer/key.pem' } }, () => Date.parse(material.expiresAt) + 1);
await assert.rejects(expired.resolve(ref), /outside validity window/);
console.log('Mounted certificate files: valid pair accepted, cross-user private key and expired validity rejected');
