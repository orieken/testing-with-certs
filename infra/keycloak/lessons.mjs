import { readFileSync } from 'node:fs';

export const lessonSpecs = JSON.parse(readFileSync(new URL('./lessons.json', import.meta.url)));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, canonical(entry)]));
  return value;
}
const same = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));

export async function ensureFlow(admin, spec) {
  let flows = await admin('GET', '/authentication/flows');
  if (!flows.some(value => value.alias === spec.alias)) {
    await admin('POST', '/authentication/flows', {
      alias: spec.alias, providerId: 'basic-flow', topLevel: true, builtIn: false,
    }, 201);
    for (const execution of spec.authenticationExecutions) {
      await admin('POST', `/authentication/flows/${spec.alias}/executions/execution`,
        { provider: execution.authenticator }, 201);
    }
    const executions = await admin('GET', `/authentication/flows/${spec.alias}/executions`);
    for (const [index, execution] of executions.entries()) {
      await admin('PUT', `/authentication/flows/${spec.alias}/executions`,
        { ...execution, requirement: 'REQUIRED' }, 204);
      const configAlias = spec.authenticationExecutions[index].authenticatorConfig;
      if (configAlias) {
        await admin('POST', `/authentication/executions/${execution.id}/config`,
          lessonSpecs.authenticatorConfig.find(value => value.alias === configAlias), 201);
      }
    }
    flows = await admin('GET', '/authentication/flows');
  }
  const executions = await admin('GET', `/authentication/flows/${spec.alias}/executions`);
  assert(executions.length === spec.authenticationExecutions.length && executions.every((value, index) =>
    value.requirement === 'REQUIRED' && value.providerId === spec.authenticationExecutions[index].authenticator),
  `Lesson flow drift: ${spec.alias}`);
  for (const [index, execution] of executions.entries()) {
    const configAlias = spec.authenticationExecutions[index].authenticatorConfig;
    if (configAlias) {
      const config = await admin('GET', `/authentication/config/${execution.authenticationConfig}`);
      assert(same(config.config, lessonSpecs.authenticatorConfig.find(value => value.alias === configAlias).config),
        `Lesson redirect configuration drift: ${spec.alias}`);
    }
  }
  return flows.find(value => value.alias === spec.alias).id;
}

export async function ensureClient(admin, spec, flowId) {
  const listing = await admin('GET', `/clients?clientId=${spec.clientId}&max=2`);
  assert(listing.length <= 1, 'Lesson client ambiguous');
  if (!listing.length) {
    await admin('POST', '/clients', { ...spec, authenticationFlowBindingOverrides: { browser: flowId } }, 201);
    return;
  }
  const current = await admin('GET', `/clients/${listing[0].id}`);
  const fields = ['publicClient', 'standardFlowEnabled', 'directAccessGrantsEnabled', 'implicitFlowEnabled',
    'serviceAccountsEnabled', 'redirectUris', 'webOrigins'];
  assert(fields.every(key => same(current[key], spec[key])) &&
    current.authenticationFlowBindingOverrides?.browser === flowId &&
    Object.entries(spec.attributes).every(([key, value]) => current.attributes?.[key] === value),
  `Lesson client drift: ${spec.clientId}`);
  const mappers = current.protocolMappers ?? [];
  const expectedMapper = spec.protocolMappers[0].config;
  const mapperConfig = mappers[0]?.config ?? {};
  assert(mappers.length === 1 && mappers[0].protocolMapper === 'oidc-audience-mapper' &&
    Object.entries(expectedMapper).every(([key, value]) => mapperConfig[key] === value) &&
    Object.entries(mapperConfig).every(([key, value]) => key in expectedMapper || (key === 'userinfo.token.claim' && value === 'false')),
  `Lesson audience drift: ${spec.clientId}`);
  let defaults = await admin('GET', `/clients/${current.id}/default-client-scopes`);
  if (defaults.length === 1 && defaults[0].name === 'profile') {
    const scopes = await admin('GET', '/client-scopes');
    const basic = scopes.find(value => value.name === 'basic');
    assert(basic, 'Keycloak basic identity scope missing');
    await admin('PUT', `/clients/${current.id}/default-client-scopes/${basic.id}`, undefined, 204);
    defaults = await admin('GET', `/clients/${current.id}/default-client-scopes`);
  }
  const optional = await admin('GET', `/clients/${current.id}/optional-client-scopes`);
  assert(same(defaults.map(value => value.name).sort(), ['basic', 'profile']) && optional.length === 0,
    `Lesson scope drift: ${spec.clientId}`);
}

export async function ensureLessons(admin) {
  const realm = await admin('GET', '');
  if (Object.entries(lessonSpecs.realmPolicy).some(([key, value]) => !same(realm[key], value))) {
    await admin('PUT', '', lessonSpecs.realmPolicy, 204);
  }
  const actions = await admin('GET', '/authentication/required-actions');
  const registration = actions.find(value => value.alias === 'webauthn-register-passwordless');
  assert(registration, 'Passwordless WebAuthn registration action must be available');
  if (!registration.enabled) await admin('PUT', '/authentication/required-actions/webauthn-register-passwordless',
    { ...registration, enabled: true, defaultAction: false }, 204);
  for (const spec of lessonSpecs.authenticationFlows) {
    if (['oidc-browser', 'saml-browser', 'kerberos-browser'].includes(spec.alias)) continue;
    const id = await ensureFlow(admin, spec);
    const client = lessonSpecs.clients.find(value => value.authenticationFlowBindingOverrides.browser === spec.alias);
    await ensureClient(admin, client, id);
  }
  console.log('Separate passkey enrollment and login clients verified.');
}
