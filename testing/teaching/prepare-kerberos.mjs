import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function prepareKerberosProfile(profile, channel) {
  if (!['chrome', 'msedge'].includes(channel)) throw new Error('Unsupported Kerberos browser');
  mkdirSync(profile, { recursive: true });
  const path = join(profile, 'Local State');
  const state = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  // Chromium on Linux otherwise discovers GSSAPI only after the first failed challenge and a network-service restart.
  state.net = { ...state.net, received_http_auth_negotiate_headers: true };
  writeFileSync(path, JSON.stringify(state), { mode: 0o600 });
  const directory = channel === 'chrome' ? '/etc/opt/chrome/policies/managed' : '/etc/opt/edge/policies/managed';
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'lesson-kerberos.json'), JSON.stringify({
    AuthServerAllowlist: 'auth.magic.test', AuthSchemes: 'negotiate', DisableAuthNegotiateCnameLookup: true,
    AuthNegotiateDelegateAllowlist: '',
  }), { mode: 0o644 });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) prepareKerberosProfile(process.argv[2], process.argv[3]);
