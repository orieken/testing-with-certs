export const lessons = [
  { id: 'password-otp', title: 'Password + authenticator code',
    description: 'Enter your password, then a six-digit code from your authenticator app. Keycloak helps you enroll on first login.',
    button: 'Sign in with password and code' },
  { id: 'passkeys', title: 'Passkeys',
    description: 'Use your enrolled passkey to sign in. Your device may ask you to unlock it or touch a security key.',
    button: 'Sign in with a passkey' },
  { id: 'passkeys-enroll', title: 'Enroll a passkey', path: '/teaching/passkeys/enroll',
    description: 'Use your dedicated lesson account password to confirm your identity, then create a passkey on Keycloak’s page.',
    button: 'Enroll a passkey' },
  { id: 'oidc', title: 'External OpenID Connect',
    description: 'Continue to the lesson identity provider. It checks your account and returns you to this lesson.',
    button: 'Sign in with OpenID Connect' },
  { id: 'saml', title: 'SAML single sign-on',
    description: 'Continue to the lesson SAML provider. Keycloak checks its signed response before returning you here.',
    button: 'Sign in with SAML' },
  { id: 'kerberos', title: 'Kerberos integrated login',
    description: 'Use the Kerberos ticket in your lab browser session. This lesson requires the Kerberos runner and has no password fallback.',
    button: 'Sign in with Kerberos' },
].map(value => ({ ...value, path: value.path ?? `/teaching/${value.id}`, clientId: `${value.id}-spa`,
    audience: value.id === 'password-otp' ? 'password-otp-lesson' : `${value.id}-lesson`,
    realm: ['oidc', 'saml', 'kerberos'].includes(value.id) ? `lesson-${value.id}` : 'magic-shop',
    authUrl: ['oidc', 'saml'].includes(value.id) ? 'https://shop.magic.test:9643' : 'https://auth.magic.test:9443' }));

export function lessonForPath(path: string) {
  return lessons.find(value => path === value.path || path === `${value.path}/callback`);
}
