// One source for expected browser/report cases. Add new scenarios here with their tests.
export const authPhases = {
  'passkeys-federation': [
    ...['enrollment', 'login-and-logout', 'missing-credential', 'invalid-signature', 'disabled-user', 'unconfigured-user', 'account-isolation'].map(value => `passkeys:${value}`),
    ...['oidc', 'saml'].flatMap(method => ['login-audience-and-logout', 'disabled-provider-user',
      'callback-state-rejection', 'cross-protocol-provider-rejection', 'broker-state-rejection'].map(value => `${method}:${value}`)),
    'saml:modified-signed-response', 'saml:response-replay',
    ...['control', 'wrong-audience', 'wrong-recipient', 'expired'].map(value => `saml:signed-${value}`),
  ],
  kerberos: ['valid-ticket', 'missing-ticket', 'expired-ticket', 'wrong-service-ticket'].map(value => `kerberos:${value}`),
  'kerberos-disabled': ['kerberos:disabled-user'],
};
export const otpCaseNames = ['certificate-free entrance and route boundaries', 'enrollment and lesson audience denied at business APIs',
  'wrong password', 'incorrect and expired codes', 'disabled user',
  'successful login, logout and cookie cannot skip factors', 'fresh profile and second account isolation'];

export const otpRunners = ['playwright', 'cucumber'];
