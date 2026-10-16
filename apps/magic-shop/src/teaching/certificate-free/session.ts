import Keycloak from 'keycloak-js';
import { readonly, ref } from 'vue';
import { lessonForPath } from './lessons';

export const lessonOrigin = 'https://shop.magic.test:8543';
export const activeLesson = lessonForPath(location.pathname);
export const lessonPath = activeLesson?.path ?? '/teaching';
const clientId = activeLesson?.clientId ?? 'password-otp-spa';
const realm = activeLesson?.realm ?? 'magic-shop';
const authUrl = activeLesson?.authUrl ?? 'https://auth.magic.test:9443';
const issuer = `${authUrl}/realms/${realm}`;
const keycloak = new Keycloak({ url: authUrl, realm, clientId });
const identity = ref<{ username: string; subject: string } | null>(null);
const error = ref<string | null>(null);
const busy = ref(true);

function clear(): void {
  keycloak.clearToken();
  identity.value = null;
}

function sync(): void {
  const claims = keycloak.tokenParsed;
  const audiences = Array.isArray(claims?.aud) ? claims.aud : [claims?.aud];
  if (!keycloak.authenticated || claims?.azp !== clientId || claims.iss !== issuer ||
      !activeLesson || !audiences.includes(activeLesson.audience) || typeof claims.sub !== 'string' ||
      typeof claims.preferred_username !== 'string') {
    clear();
    return;
  }
  identity.value = { username: claims.preferred_username, subject: claims.sub };
}

export async function initializeLesson(): Promise<void> {
  const enrollmentOutcome = new URL(location.href).searchParams.get('kc_action_status');
  keycloak.onAuthSuccess = sync;
  keycloak.onAuthLogout = () => { identity.value = null; };
  keycloak.onTokenExpired = clear;
  try {
    await keycloak.init({ checkLoginIframe: false, pkceMethod: 'S256', responseMode: 'query',
      flow: 'standard', enableLogging: false, messageReceiveTimeout: 10_000 });
    sync();
    if (activeLesson?.id === 'passkeys-enroll' && location.pathname.endsWith('/callback') && enrollmentOutcome !== 'success') {
      clear();
      error.value = 'Passkey enrollment was cancelled or could not be completed.';
    }
    if (location.pathname.endsWith('/callback') && !identity.value) error.value = 'The lesson sign-in could not be verified. Start a new sign-in.';
  } catch {
    clear();
    error.value = 'Sign-in could not be completed. Start a new sign-in to try again.';
  } finally {
    if (location.pathname.endsWith('/callback')) history.replaceState({}, '', lessonPath);
    busy.value = false;
  }
}

export async function signIn(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    await keycloak.login({ redirectUri: `${lessonOrigin}${lessonPath}/callback`, scope: 'openid profile', prompt: 'login',
      ...(activeLesson?.id === 'passkeys-enroll' ? { action: 'webauthn-register-passwordless' } : {}) });
  } catch {
    busy.value = false;
    error.value = 'Sign-in could not be started.';
  }
}

export async function signOut(): Promise<void> {
  try {
    await keycloak.logout({ redirectUri: `${lessonOrigin}${lessonPath}` });
  } catch {
    clear();
    error.value = 'Local sign-in cleared. The identity provider could not confirm logout.';
  }
}

export const lesson = { identity: readonly(identity), error: readonly(error), busy: readonly(busy) };
