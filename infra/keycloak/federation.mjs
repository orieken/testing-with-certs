import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { ensureSamlFixtureKey } from './saml-fixture-key.mjs';
import { ensureSamlRoleMapping } from './saml-roles.mjs';
import { lessonAdmin } from './lesson-admin.mjs';
import { lessonSpecs, ensureClient, ensureFlow } from './lessons.mjs';

const providerOrigin = 'https://shop.magic.test:9643';
const brokerOrigin = providerOrigin;
const providerRealm = 'lesson-provider';
const secretPath = '/test-secrets/federation-client';
if (!existsSync(secretPath)) writeFileSync(secretPath, randomBytes(32).toString('base64url'), { mode: 0o600, flag: 'wx' });
const clientSecret = readFileSync(secretPath, 'utf8');
const remote = await lessonAdmin({ origin: providerOrigin, realm: null });
const local = await lessonAdmin({ origin: brokerOrigin, realm: null });
const components = { 'org.keycloak.userprofile.UserProfileProvider': [{ providerId: 'declarative-user-profile',
  config: { 'kc.user.profile.config': [JSON.stringify({ attributes: [
    { name: 'username', permissions: { view: ['admin', 'user'], edit: ['admin'] } },
    { name: 'email', permissions: { view: ['admin', 'user'], edit: ['admin'] } },
  ] })] } }] };

async function createRealm(admin, spec) {
  const realms = await admin('GET', '/realms');
  if (!realms.some(value => value.realm === spec.realm)) await admin('POST', '/realms', spec, 201);
}
await createRealm(remote, { realm: providerRealm, enabled: true, sslRequired: 'all', registrationAllowed: false,
  resetPasswordAllowed: false, accessTokenLifespan: 120, ssoSessionIdleTimeout: 300, ssoSessionMaxLifespan: 600, components });
const provider = await lessonAdmin({ origin: providerOrigin, realm: providerRealm });

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
async function client(spec) {
  const found = await provider('GET', `/clients?clientId=${encodeURIComponent(spec.clientId)}&max=2`);
  if (found.length > 1) throw new Error('Provider client ambiguous');
  if (!found.length) await provider('POST', '/clients', spec, 201);
  else {
    const current = await provider('GET', `/clients/${found[0].id}`);
    for (const key of ['post.logout.redirect.uris', 'saml_single_logout_service_url_post']) {
      if (spec.attributes[key] && current.attributes?.[key] === undefined) {
        current.attributes = { ...current.attributes, [key]: spec.attributes[key] };
        await provider('PUT', `/clients/${current.id}`, current, 204);
      }
    }
    for (const key of ['protocol', 'publicClient', 'standardFlowEnabled', 'directAccessGrantsEnabled', 'redirectUris']) {
      if (!same(current[key], spec[key])) throw new Error(`Provider client drift: ${spec.clientId}`);
    }
    if (!Object.entries(spec.attributes).every(([key, value]) => current.attributes?.[key] === value)) throw new Error('Provider client attribute drift');
    if (spec.secret) {
      const secret = await provider('GET', `/clients/${current.id}/client-secret`);
      if (secret.value !== spec.secret) throw new Error('Provider secret drift');
    }
  }
}
await client({ clientId: 'lesson-oidc-broker', protocol: 'openid-connect', publicClient: false,
  secret: clientSecret, standardFlowEnabled: true, directAccessGrantsEnabled: false, implicitFlowEnabled: false,
  serviceAccountsEnabled: false, redirectUris: [`${brokerOrigin}/realms/lesson-oidc/broker/lesson-oidc/endpoint`],
  attributes: { 'pkce.code.challenge.method': 'S256',
    'post.logout.redirect.uris': `${brokerOrigin}/realms/lesson-oidc/broker/lesson-oidc/endpoint/logout_response` } });
await client({ clientId: `${brokerOrigin}/realms/lesson-saml`, protocol: 'saml', publicClient: true,
  standardFlowEnabled: true, directAccessGrantsEnabled: false,
  redirectUris: [`${brokerOrigin}/realms/lesson-saml/broker/lesson-saml/endpoint`],
  attributes: { 'saml.assertion.signature': 'true', 'saml.server.signature': 'true',
    'saml.signature.algorithm': 'RSA_SHA256', 'saml.force.post.binding': 'true',
    'saml_name_id_format': 'username', 'saml.force.name.id.format': 'true',
    'saml_single_logout_service_url_post': `${brokerOrigin}/realms/lesson-saml/broker/lesson-saml/endpoint`,
    'saml.client.signature': 'false' } });
const signing = await ensureSamlFixtureKey(provider);

for (const method of ['oidc', 'saml']) {
  const flow = lessonSpecs.authenticationFlows.find(value => value.alias === `${method}-browser`);
  const spec = lessonSpecs.clients.find(value => value.clientId === `${method}-spa`);
  const firstBroker = { alias: 'lesson-first-broker', id: `${method}-lesson-first-broker`, providerId: 'basic-flow',
    topLevel: true, builtIn: false, authenticationExecutions: [{ authenticator: 'idp-create-user-if-unique',
      requirement: 'REQUIRED', priority: 10, authenticatorFlow: false, userSetupAllowed: false }] };
  const protocol = `${providerOrigin}/realms/${providerRealm}/protocol`;
  const config = method === 'oidc' ? {
    clientId: 'lesson-oidc-broker', clientSecret, authorizationUrl: `${protocol}/openid-connect/auth`,
    tokenUrl: `${protocol}/openid-connect/token`, userInfoUrl: `${protocol}/openid-connect/userinfo`,
    logoutUrl: `${protocol}/openid-connect/logout`, issuer: `${providerOrigin}/realms/${providerRealm}`,
    jwksUrl: `${protocol}/openid-connect/certs`, validateSignature: 'true', useJwksUrl: 'true',
    pkceEnabled: 'true', pkceMethod: 'S256', defaultScope: 'openid profile email',
  } : {
    singleSignOnServiceUrl: `${protocol}/saml`, singleLogoutServiceUrl: `${protocol}/saml`,
    idpEntityId: `${providerOrigin}/realms/${providerRealm}`,
    validateSignature: 'true', signingCertificate: signing.certificate,
    postBindingResponse: 'true', postBindingAuthnRequest: 'true', postBindingLogout: 'true',
    wantAssertionsSigned: 'true', wantAuthnRequestsSigned: 'false',
    nameIDPolicyFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
  };
  const idp = { alias: `lesson-${method}`, providerId: method, enabled: true, trustEmail: false,
    firstBrokerLoginFlowAlias: firstBroker.alias, config: { ...config, syncMode: 'IMPORT' } };
  await createRealm(local, { realm: `lesson-${method}`, enabled: true, sslRequired: 'all',
    registrationAllowed: false, resetPasswordAllowed: false, accessTokenLifespan: 120,
    ssoSessionIdleTimeout: 300, ssoSessionMaxLifespan: 600, browserFlow: flow.alias,
    components,
    authenticationFlows: [flow, firstBroker], clients: [spec], identityProviders: [idp],
    authenticatorConfig: lessonSpecs.authenticatorConfig.filter(value => value.alias === `${method}-lesson-redirect`) });
  const broker = await lessonAdmin({ origin: brokerOrigin, realm: `lesson-${method}` });
  const currentRealm = await broker('GET', '');
  if (currentRealm.browserFlow !== flow.alias) throw new Error('Broker browser flow drift');
  await ensureClient(broker, spec, await ensureFlow(broker, flow));
  if (method === 'saml') await ensureSamlRoleMapping(provider, broker, brokerOrigin);
  const firstExecutions = await broker('GET', '/authentication/flows/lesson-first-broker/executions');
  if (firstExecutions.length !== 1 || firstExecutions[0].providerId !== 'idp-create-user-if-unique' ||
      firstExecutions[0].requirement !== 'REQUIRED') throw new Error('Broker first-login flow drift');
  const providers = await broker('GET', '/identity-provider/instances');
  if (providers.length !== 1 || providers[0].alias !== idp.alias) throw new Error('Broker must have exactly its designated provider');
  const current = await broker('GET', `/identity-provider/instances/${idp.alias}`);
  // Keycloak deliberately masks broker secrets on readback. Live federation verifies the credential pairing.
  if (current.providerId !== method || !current.enabled || current.firstBrokerLoginFlowAlias !== firstBroker.alias ||
      !Object.entries(idp.config).every(([key, value]) => current.config[key] === value ||
        (key === 'clientSecret' && /^\*+$/.test(current.config[key] ?? '')))) throw new Error('Broker identity-provider drift');
}
console.log('Real OIDC and SAML federation configured in separate broker realms; no provider credentials logged.');
