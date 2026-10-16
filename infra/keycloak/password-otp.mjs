// Used by bootstrap for both new and retained realms. Never replaces user credentials.
export async function ensurePasswordOtp(token, template, call) {
  const root = '/admin/realms/magic-shop';
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const spec = template.authenticationFlows.find(value => value.alias === 'password-otp-browser');
  let flows = (await call('GET', `${root}/authentication/flows`, token)).data;
  if (!flows.some(value => value.alias === spec.alias)) {
    await call('POST', `${root}/authentication/flows`, token,
      { alias: spec.alias, providerId: 'basic-flow', topLevel: true, builtIn: false }, [201]);
    for (const execution of spec.authenticationExecutions) {
      await call('POST', `${root}/authentication/flows/${spec.alias}/executions/execution`, token,
        { provider: execution.authenticator }, [201]);
    }
    const executions = (await call('GET', `${root}/authentication/flows/${spec.alias}/executions`, token)).data;
    for (const execution of executions) {
      await call('PUT', `${root}/authentication/flows/${spec.alias}/executions`, token,
        { ...execution, requirement: 'REQUIRED' }, [204]);
    }
    flows = (await call('GET', `${root}/authentication/flows`, token)).data;
  }
  const flow = flows.find(value => value.alias === spec.alias);
  const executions = (await call('GET', `${root}/authentication/flows/${spec.alias}/executions`, token)).data;
  assert(executions.length === 2 && executions.every(value => value.requirement === 'REQUIRED') &&
    executions[0].providerId === 'auth-username-password-form' && executions[1].providerId === 'auth-otp-form',
  'Password/OTP flow must require password then OTP without cookie alternatives');
  const policy = Object.fromEntries(Object.entries(template).filter(([key]) => key.startsWith('otpPolicy')));
  const realm = (await call('GET', root, token)).data;
  // Explicit policy migration for retained realms, without changing the default browser flow.
  if (Object.entries(policy).some(([key, value]) => realm[key] !== value)) {
    await call('PUT', root, token, policy, [204]);
  }
  const actions = (await call('GET', `${root}/authentication/required-actions`, token)).data;
  assert(actions.some(value => value.alias === 'CONFIGURE_TOTP' && value.enabled), 'Configure OTP action must be enabled');
  const client = template.clients.find(value => value.clientId === 'password-otp-spa');
  const listing = (await call('GET', `${root}/clients?clientId=${client.clientId}&max=2`, token)).data;
  assert(listing.length <= 1, 'Password/OTP client ambiguous');
  if (listing.length === 0) {
    await call('POST', `${root}/clients`, token,
      { ...client, authenticationFlowBindingOverrides: { browser: flow.id } }, [201]);
  } else {
    const current = (await call('GET', `${root}/clients/${listing[0].id}`, token)).data;
    assert(current.authenticationFlowBindingOverrides?.browser === flow.id && current.publicClient === true &&
      current.standardFlowEnabled === true && current.directAccessGrantsEnabled === false &&
      current.implicitFlowEnabled === false && current.serviceAccountsEnabled === false &&
      current.attributes?.['pkce.code.challenge.method'] === 'S256' &&
      current.attributes?.['post.logout.redirect.uris'] === client.attributes['post.logout.redirect.uris'] &&
      JSON.stringify(current.redirectUris) === JSON.stringify(client.redirectUris) &&
      JSON.stringify(current.webOrigins) === JSON.stringify(client.webOrigins), 'Password/OTP client drift');
    const mappers = current.protocolMappers ?? [];
    assert(mappers.length === 1 && mappers[0].protocolMapper === 'oidc-audience-mapper' &&
      mappers[0].config?.['included.custom.audience'] === 'password-otp-lesson', 'Password/OTP audience mapper drift');
  }
  const created = listing[0] ?? (await call('GET', `${root}/clients?clientId=${client.clientId}&max=2`, token)).data[0];
  const defaults = (await call('GET', `${root}/clients/${created.id}/default-client-scopes`, token)).data;
  if (!defaults.some(value => value.name === 'basic')) {
    const scopes = (await call('GET', `${root}/client-scopes`, token)).data;
    const basic = scopes.find(value => value.name === 'basic');
    assert(basic, 'Keycloak basic identity scope missing');
    await call('PUT', `${root}/clients/${created.id}/default-client-scopes/${basic.id}`, token, undefined, [204]);
  }
  console.log('Separate certificate-free password/OTP client verified.');
}
