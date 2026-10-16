import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { generateKeyPairSync, createPrivateKey, createPublicKey, X509Certificate } from 'node:crypto';

// This key belongs only to the disposable lesson IdP; never to the shop realm or CA.
export async function ensureSamlFixtureKey(provider) {
  const root = '/saml-fixture';
  const path = `${root}/private.pem`;
  if (!existsSync(path)) {
    const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    writeFileSync(path, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
  }
  const privateKey = readFileSync(path, 'utf8');
  const realm = await provider('GET', '');
  const components = await provider('GET', '/components?type=org.keycloak.keys.KeyProvider');
  const name = 'lesson-saml-fixture-rsa';
  if (!components.some(value => value.name === name)) {
    await provider('POST', '/components', { name, parentId: realm.id, providerId: 'rsa',
      providerType: 'org.keycloak.keys.KeyProvider', config: { priority: ['10000'], enabled: ['true'],
        active: ['true'], algorithm: ['RS256'], privateKey: [privateKey] } }, 201);
  }
  const keys = await provider('GET', '/keys');
  const signing = keys.keys.find(value => value.kid === keys.active.RS256 && value.certificate);
  if (!signing || !components.concat(await provider('GET', '/components?type=org.keycloak.keys.KeyProvider'))
    .some(value => value.name === name && value.id === signing.providerId)) throw new Error('Lesson fixture signing key is not active');
  const certificate = `-----BEGIN CERTIFICATE-----\n${signing.certificate}\n-----END CERTIFICATE-----\n`;
  const expected = createPublicKey(createPrivateKey(privateKey)).export({ type: 'spki', format: 'der' });
  if (!new X509Certificate(certificate).publicKey.export({ type: 'spki', format: 'der' }).equals(expected)) {
    throw new Error('Lesson fixture certificate does not match its key');
  }
  writeFileSync(`${root}/certificate.pem`, certificate, { mode: 0o644 });
  return signing;
}
