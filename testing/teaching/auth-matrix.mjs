// One source for expected browser/report cases. Add new scenarios here with their tests.
export const passkeyCaseNames = ['enrollment', 'login-and-logout', 'missing-credential', 'invalid-signature', 'disabled-user', 'unconfigured-user', 'account-isolation'].map(value => `passkeys:${value}`);
export const passkeySessionCaseNames = ['access-expiry-requires-passkey', 'refresh-preserves-identity', 'logout-invalidates-refresh', 'refresh-client-binding', 'session-expiry-rejects-refresh'].map(value => `passkeys:${value}`);
export const oidcCaseNames = ['login-audience-and-logout', 'disabled-provider-user', 'callback-state-rejection', 'cross-protocol-provider-rejection', 'broker-state-rejection'].map(value => `oidc:${value}`);
export const oidcSessionCaseNames = ['access-expiry-reenters-federation', 'refresh-preserves-identity', 'logout-invalidates-refresh', 'refresh-client-binding', 'session-expiry-rejects-refresh'].map(value => `oidc:${value}`);
export const samlCaseNames = [
  ...['mapped', 'absent', 'unrecognized', 'withdrawn-on-login'].map(value => `saml:role-${value}`),
  ...['saml'].flatMap(method => ['login-audience-and-logout', 'disabled-provider-user',
      'callback-state-rejection', 'cross-protocol-provider-rejection', 'broker-state-rejection'].map(value => `${method}:${value}`)),
    'saml:modified-signed-response', 'saml:response-replay',
    ...['control', 'wrong-audience', 'wrong-recipient', 'expired'].map(value => `saml:signed-${value}`),
];
export const kerberosCaseNames = ['valid-ticket', 'missing-ticket', 'expired-ticket', 'wrong-service-ticket', 'disabled-user'].map(value => `kerberos:${value}`);
export const authPhases = {
  'passkeys-federation': [
    ...passkeyCaseNames,
    ...oidcCaseNames,
    ...samlCaseNames,
  ],
  'passkeys-cucumber': passkeyCaseNames,
  'passkeys-lifecycle': passkeySessionCaseNames,
  'passkeys-lifecycle-cucumber': passkeySessionCaseNames,
  'oidc-cucumber': oidcCaseNames,
  'oidc-lifecycle': oidcSessionCaseNames,
  'oidc-lifecycle-cucumber': oidcSessionCaseNames,
  'saml-cucumber': samlCaseNames,
  kerberos: kerberosCaseNames.filter(name => name !== 'kerberos:disabled-user'),
  'kerberos-cucumber': kerberosCaseNames.filter(name => name !== 'kerberos:disabled-user'),
  'kerberos-cucumber-disabled': ['kerberos:disabled-user'],
  'kerberos-disabled': ['kerberos:disabled-user'],
};
export const otpCaseNames = ['certificate-free entrance and route boundaries', 'enrollment and lesson audience denied at business APIs',
  'wrong password', 'incorrect and expired codes', 'disabled user',
  'successful login, logout and cookie cannot skip factors', 'fresh profile and second account isolation'];

export const otpRunners = ['playwright', 'cucumber'];

export const otpSessionCaseNames = ['access-token expiry clears lesson and requires both factors',
  'refresh preserves identity and lesson audience', 'logout invalidates refresh token',
  'refresh token cannot be used by another client', 'expired session rejects refresh'];
export const otpPhases = Object.fromEntries(otpRunners.flatMap(runner => [
  [runner, otpCaseNames], [`${runner}-lifecycle`, otpSessionCaseNames],
]));
