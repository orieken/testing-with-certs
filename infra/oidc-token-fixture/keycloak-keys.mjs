import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
const type = 'org.keycloak.keys.KeyProvider', prefix = 'oidc-native-rotation-';
function save(path, value) {
  writeFileSync(`${path}.next`, JSON.stringify(value), { mode: 0o600 });
  renameSync(`${path}.next`, path);
}
const load = path => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined;
async function keys(admin) {
  const metadata = await admin('GET', '/keys');
  if (!metadata.active?.RS256) throw new Error('Owned provider signing key missing');
  return metadata;
}
async function components(admin) {
  return (await admin('GET', `/components?type=${type}`)).filter(value => value.name.startsWith(prefix));
}
export async function keycloakKeyAction(admin, directory, action, owner) {
  const statePath = `${directory}/native-key-state.json`, baselinePath = `${directory}/native-key-baseline.json`;
  let state = load(statePath), baseline = load(baselinePath);
  const current = await keys(admin);
  if (action === 'start') {
    if (state || (await components(admin)).length) throw new Error('Native signing-key fixture already owned');
    if (!baseline) { baseline = { kid: current.active.RS256 }; save(baselinePath, baseline); }
    if (baseline.kid !== current.active.RS256) throw new Error('Original signing key drift');
    state = { owner, originalKid: baseline.kid, name: `${prefix}${owner}` };
    save(statePath, state);
  } else if (action === 'verify') {
    if (state || (await components(admin)).length || baseline && baseline.kid !== current.active.RS256) throw new Error('Native signing-key state remains');
    return { idle: true, restored: true };
  } else if (!state || state.owner !== owner) throw new Error('Native signing-key owner mismatch');
  if (action === 'rotate') {
    if ((await components(admin)).some(value => value.name === state.name)) throw new Error('Owned key already rotated');
    const realm = await admin('GET', '');
    await admin('POST', '/components', { name: state.name, parentId: realm.id, providerId: 'rsa-generated',
      providerType: type, config: { priority: ['20000'], enabled: ['true'], active: ['true'],
        algorithm: ['RS256'], keySize: ['2048'] } }, 201);
  }
  if (action === 'restore') {
    const owned = (await components(admin)).filter(value => value.name === state.name);
    if (owned.length > 1 || owned.some(value => value.providerId !== 'rsa-generated')) throw new Error('Native key ownership drift');
    for (const value of owned) await admin('DELETE', `/components/${value.id}`, undefined, 204);
    if ((await keys(admin)).active.RS256 !== state.originalKid) throw new Error('Original signing key not restored');
    unlinkSync(statePath);
    return keycloakKeyAction(admin, directory, 'verify');
  }
  if (!['start', 'rotate', 'status'].includes(action)) throw new Error('Unknown native-key action');
  const next = await keys(admin), rotated = next.active.RS256 !== state.originalKid;
  if (action === 'rotate' && !rotated) throw new Error('Native signing key did not rotate');
  return { idle: false, rotated, originalPublished: next.keys.some(value => value.kid === state.originalKid),
    activePublished: next.keys.some(value => value.kid === next.active.RS256) };
}
export async function restoreOwnedKeycloakKey(admin, directory) {
  const state = load(`${directory}/native-key-state.json`);
  if (state) await keycloakKeyAction(admin, directory, 'restore', state.owner);
  return keycloakKeyAction(admin, directory, 'verify');
}
