import { readFileSync } from 'node:fs';
const response = await fetch('http://127.0.0.1:9103/keycloak', { method: 'POST',
  headers: { authorization: `Bearer ${readFileSync('/state/client-secret', 'utf8')}`, 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'verify' }), signal: AbortSignal.timeout(15000) });
if (!response.ok || !(await response.json()).idle) throw new Error('Native signing-key fixture remains');
console.log('Original Keycloak signing key active; owned rotation keys absent.');

for (const target of ['keycloak', 'broker', 'authentik-broker']) {
  // The authentik realm exists only in its overlay; the controller checks journals
  // separately below, so an unused target is not queried during base teardown.
  const { existsSync } = await import('node:fs');
  const journal = `/state/refresh-${target}.json`;
  if (!existsSync(journal)) continue;
  const result = await fetch(`http://127.0.0.1:9103/refresh/${target}`, { method: 'POST',
    headers: { authorization: `Bearer ${readFileSync('/state/client-secret', 'utf8')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'verify' }), signal: AbortSignal.timeout(15000) });
  if (!result.ok || !(await result.json()).idle) throw new Error('Owned refresh policy remains');
}
console.log('Owned Keycloak refresh policies restored; journals absent.');
