import { lessonAdmin } from './lesson-admin.mjs';
import { lessonSpecs, ensureClient, ensureFlow } from './lessons.mjs';

const root = await lessonAdmin({ realm: null });
const realms = await root('GET', '/realms');
const flow = lessonSpecs.authenticationFlows.find(value => value.alias === 'kerberos-browser');
const client = lessonSpecs.clients.find(value => value.clientId === 'kerberos-spa');
if (!realms.some(value => value.realm === 'lesson-kerberos')) await root('POST', '/realms', {
  realm: 'lesson-kerberos', enabled: true, sslRequired: 'all', registrationAllowed: false,
  resetPasswordAllowed: false, accessTokenLifespan: 120, ssoSessionIdleTimeout: 300, ssoSessionMaxLifespan: 600,
  browserFlow: flow.alias, authenticationFlows: [flow], clients: [client],
  components: { 'org.keycloak.userprofile.UserProfileProvider': [{ providerId: 'declarative-user-profile',
    config: { 'kc.user.profile.config': [JSON.stringify({ attributes: [{ name: 'username',
      permissions: { view: ['admin', 'user'], edit: ['admin'] } }, { name: 'email',
      permissions: { view: ['admin', 'user'], edit: ['admin'] } }] })] } }] },
}, 201);
const admin = await lessonAdmin({ realm: 'lesson-kerberos' });
const realm = await admin('GET', '');
if (realm.browserFlow !== flow.alias) throw new Error('Kerberos realm flow drift');
await ensureClient(admin, client, await ensureFlow(admin, flow));
const spec = { name: 'lesson-kerberos', providerId: 'kerberos',
  providerType: 'org.keycloak.storage.UserStorageProvider', parentId: realm.id,
  config: { enabled: ['true'], priority: ['100'], cachePolicy: ['DEFAULT'],
    kerberosRealm: ['MAGIC.TEST'], serverPrincipal: ['HTTP/auth.magic.test@MAGIC.TEST'],
    keyTab: ['/kerberos/http.keytab'], allowPasswordAuthentication: ['false'],
    editMode: ['READ_ONLY'], updateProfileFirstLogin: ['false'], debug: ['false'] } };
const providers = await admin('GET', '/components?type=org.keycloak.storage.UserStorageProvider');
const found = providers.filter(value => value.name === spec.name);
if (found.length > 1) throw new Error('Kerberos storage provider ambiguous');
if (!found.length) await admin('POST', '/components', spec, 201);
else {
  const current = await admin('GET', `/components/${found[0].id}`);
  if (current.providerId !== spec.providerId ||
      !Object.entries(spec.config).every(([key, value]) => JSON.stringify(current.config?.[key]) === JSON.stringify(value))) {
    throw new Error('Kerberos storage configuration drift');
  }
}
console.log('Kerberos storage configured for the isolated lab realm; password fallback disabled.');
