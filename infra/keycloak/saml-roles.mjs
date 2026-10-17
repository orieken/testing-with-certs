const attributeMapper = { name: 'lesson-role-attribute', protocol: 'saml', protocolMapper: 'saml-user-attribute-mapper',
  config: { 'user.attribute': 'lesson_role', 'attribute.name': 'lesson-role', 'attribute.nameformat': 'Basic' } };
const sameConfig = (actual, expected) => Object.entries(expected).every(([key, value]) => actual?.[key] === value) &&
  Object.keys(actual ?? {}).every(key => key in expected);
async function mapper(admin, path, spec, type) {
  const current = await admin('GET', path);
  const found = current.filter(value => value.name === spec.name);
  if (!found.length) await admin('POST', path, spec, 201);
  else if (found.length !== 1 || found[0][type] !== spec[type] || !sameConfig(found[0].config, spec.config)) throw new Error('SAML role mapper drift');
}
export async function ensureSamlRoleMapping(provider, broker, origin) {
  const sources = await provider('GET', `/clients?clientId=${encodeURIComponent(`${origin}/realms/lesson-saml`)}&max=2`);
  const [source] = sources;
  const clients = await broker('GET', '/clients?clientId=saml-spa&max=2');
  if (sources.length !== 1 || clients.length !== 1) throw new Error('SAML role client missing or ambiguous');
  const target = clients[0];
  if (target.fullScopeAllowed !== false) throw new Error('SAML role scope must be explicit');
  const profile = await provider('GET', '/users/profile');
  const attribute = profile.attributes.find(value => value.name === 'lesson_role');
  if (!attribute) await provider('PUT', '/users/profile', { ...profile, attributes: [...profile.attributes,
    { name: 'lesson_role', permissions: { view: ['admin'], edit: ['admin'] } }] });
  else if (JSON.stringify(attribute.permissions?.view) !== '["admin"]' || JSON.stringify(attribute.permissions?.edit) !== '["admin"]') throw new Error('SAML role source must be administrator managed');
  await mapper(provider, `/clients/${source.id}/protocol-mappers/models`, attributeMapper, 'protocolMapper');
  const sourceMappers = await provider('GET', `/clients/${source.id}/protocol-mappers/models`);
  if (sourceMappers.length !== 1 || sourceMappers[0].name !== attributeMapper.name) throw new Error('Unexpected SAML role source mapper');
  const roles = await broker('GET', `/clients/${target.id}/roles?max=1000`);
  if (!roles.some(value => value.name === 'lesson-reviewer')) await broker('POST', `/clients/${target.id}/roles`, { name: 'lesson-reviewer', composite: false }, 201);
  const role = await broker('GET', `/clients/${target.id}/roles/lesson-reviewer`);
  if (role.composite || role.clientRole !== true || role.containerId !== target.id) throw new Error('SAML lesson role must remain non-composite and client scoped');
  const scopesPath = `/clients/${target.id}/scope-mappings/clients/${target.id}`;
  const scopes = await broker('GET', scopesPath);
  if (!scopes.length) await broker('POST', scopesPath, [role], 204);
  else if (scopes.length !== 1 || scopes[0].id !== role.id) throw new Error('SAML lesson role scope drift');
  const path = '/identity-provider/instances/lesson-saml/mappers';
  await mapper(broker, path, { name: 'require-exact-recipient', identityProviderAlias: 'lesson-saml',
    identityProviderMapper: 'lesson-saml-recipient', config: { recipient: `${origin}/realms/lesson-saml/broker/lesson-saml/endpoint`, syncMode: 'INHERIT' } }, 'identityProviderMapper');
  await mapper(broker, path, { name: 'map-lesson-reviewer', identityProviderAlias: 'lesson-saml',
    identityProviderMapper: 'saml-role-idp-mapper', config: { 'attribute.name': 'lesson-role', 'attribute.value': 'reviewer',
      role: 'saml-spa.lesson-reviewer', syncMode: 'FORCE' } }, 'identityProviderMapper');
  const mappers = await broker('GET', path);
  if (mappers.length !== 2 || mappers.some(value => !['require-exact-recipient', 'map-lesson-reviewer'].includes(value.name))) throw new Error('Unexpected SAML broker mapper');
}
