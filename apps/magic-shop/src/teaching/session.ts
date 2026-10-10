import Keycloak from 'keycloak-js';
import { ref, readonly } from 'vue';

const origin = 'https://shop.magic.test:8443';
const path = '/teaching/certificate-password';
const keycloak = new Keycloak({ url: 'https://auth.magic.test:9443', realm: 'magic-shop', clientId: 'certificate-password-spa' });
const identity = ref<{ username: string; subject: string; certificateIdentity: string } | null>(null);
const error = ref<string | null>(null);
const busy = ref(true);

function sync(): void {
  const claims = keycloak.tokenParsed;
  if (!keycloak.authenticated || claims?.azp !== 'certificate-password-spa' ||
      claims.iss !== 'https://auth.magic.test:9443/realms/magic-shop' ||
      typeof claims.sub !== 'string' || typeof claims.preferred_username !== 'string' ||
      typeof claims.cert_identity !== 'string') {
    keycloak.clearToken();
    identity.value = null;
    return;
  }
  identity.value = { username: claims.preferred_username, subject: claims.sub, certificateIdentity: claims.cert_identity };
}

export async function initializeTeaching(): Promise<void> {
  keycloak.onAuthSuccess = sync;
  keycloak.onAuthLogout = () => { identity.value = null; };
  keycloak.onTokenExpired = () => { keycloak.clearToken(); identity.value = null; };
  try {
    await keycloak.init({ checkLoginIframe: false, pkceMethod: 'S256', responseMode: 'query', flow: 'standard', enableLogging: false, messageReceiveTimeout: 10_000 });
    sync();
    if (location.pathname.endsWith('/callback') && !identity.value) error.value = 'Both certificate and password sign-in must succeed.';
  } catch {
    keycloak.clearToken();
    error.value = 'Sign-in could not be completed.';
  } finally {
    if (location.pathname.endsWith('/callback')) history.replaceState({}, '', path);
    busy.value = false;
  }
}

export async function signInTeaching(): Promise<void> {
  busy.value = true;
  await keycloak.login({ redirectUri: `${origin}${path}/callback`, scope: 'openid profile', prompt: 'login' });
}

export async function signOutTeaching(): Promise<void> {
  await keycloak.logout({ redirectUri: `${origin}${path}` });
}

export const teaching = { identity: readonly(identity), error: readonly(error), busy: readonly(busy) };
