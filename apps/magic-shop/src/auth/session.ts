import Keycloak from 'keycloak-js';
import { readonly, ref } from 'vue';

const issuer = 'https://auth.magic.test:9443';
const realm = 'magic-shop';
const clientId = 'shop-spa';
const callback = 'https://shop.magic.test:8443/callback';

export type ShopRole = 'customer' | 'shopkeeper' | 'shop-admin';
export type ShopIdentity = Readonly<{
  subject: string;
  username: string;
  certificateIdentity: string;
  role: ShopRole;
}>;

const keycloak = new Keycloak({ url: issuer, realm, clientId });
const identity = ref<ShopIdentity | null>(null);
const authError = ref<string | null>(null);
const authBusy = ref(true);
let initialized = false;

function deriveIdentity(): ShopIdentity | null {
  const claims: unknown = keycloak.tokenParsed;
  if (!keycloak.authenticated || !keycloak.token || typeof claims !== 'object' || claims === null) return null;
  const record = claims as Record<string, unknown>;
  const realmAccess = record.realm_access;
  const roles = typeof realmAccess === 'object' && realmAccess !== null && 'roles' in realmAccess
    ? (realmAccess as Record<string, unknown>).roles : undefined;
  const roleList = Array.isArray(roles) && roles.every(role => typeof role === 'string') ? roles as string[] : [];
  const role = (['shop-admin', 'shopkeeper', 'customer'] as const).find(candidate => roleList.includes(candidate));
  if (record.iss !== `${issuer}/realms/${realm}` || typeof record.sub !== 'string' ||
      typeof record.preferred_username !== 'string' || typeof record.cert_identity !== 'string' ||
      !role || typeof record.exp !== 'number' || record.exp <= Math.floor(Date.now() / 1000)) return null;
  return { subject: record.sub, username: record.preferred_username, certificateIdentity: record.cert_identity, role };
}

function syncIdentity(): void {
  identity.value = deriveIdentity();
  if (keycloak.authenticated && !identity.value) {
    keycloak.clearToken();
    authError.value = 'The signed-in account has no valid shop identity.';
  }
}

export async function initializeAuth(): Promise<void> {
  if (initialized) return;
  initialized = true;
  keycloak.onAuthSuccess = syncIdentity;
  keycloak.onAuthRefreshSuccess = syncIdentity;
  keycloak.onAuthRefreshError = () => {
    keycloak.clearToken();
    identity.value = null;
    authError.value = 'Your session ended. Sign in again with your certificate.';
  };
  keycloak.onAuthLogout = () => { identity.value = null; };
  keycloak.onTokenExpired = () => {
    void keycloak.updateToken(30).then(syncIdentity).catch(() => {
      keycloak.clearToken();
      identity.value = null;
      authError.value = 'Your session ended. Sign in again with your certificate.';
    });
  };
  try {
    await keycloak.init({
      checkLoginIframe: false,
      pkceMethod: 'S256',
      responseMode: 'query',
      flow: 'standard',
      enableLogging: false,
      messageReceiveTimeout: 10_000,
    });
    syncIdentity();
    if (window.location.pathname === '/callback') {
      window.history.replaceState({}, '', '/');
      if (!identity.value && !authError.value) authError.value = 'Certificate sign-in was not completed.';
    }
  } catch {
    keycloak.clearToken();
    identity.value = null;
    authError.value = 'Certificate sign-in could not be completed. Please try again.';
    if (window.location.pathname === '/callback') window.history.replaceState({}, '', '/');
  } finally {
    authBusy.value = false;
  }
}

export async function signIn(): Promise<void> {
  authError.value = null;
  authBusy.value = true;
  try {
    await keycloak.login({ redirectUri: callback, scope: 'openid profile' });
  } catch {
    authError.value = 'Could not open certificate sign-in.';
    authBusy.value = false;
  }
}

export async function signOut(): Promise<void> {
  authBusy.value = true;
  try {
    await keycloak.logout({ redirectUri: 'https://shop.magic.test:8443/' });
  } catch {
    keycloak.clearToken();
    identity.value = null;
    authError.value = 'Signed out of this page. The identity server could not end its session.';
    authBusy.value = false;
  }
}

export async function getAccessToken(): Promise<string> {
  if (!identity.value) throw new Error('Certificate sign-in required');
  try {
    await keycloak.updateToken(30);
    syncIdentity();
  } catch {
    keycloak.clearToken();
    identity.value = null;
    authError.value = 'Your session ended. Sign in again with your certificate.';
  }
  if (!identity.value || !keycloak.token) throw new Error('Certificate sign-in required');
  return keycloak.token;
}

export const auth = {
  identity: readonly(identity),
  error: readonly(authError),
  busy: readonly(authBusy),
};
