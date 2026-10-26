import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
const policy = { revokeRefreshToken: true, refreshTokenMaxReuse: 0 };
const load = path => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined;
export async function refreshPolicy(admin, path, action, owner) {
  const current = await admin('GET', '');
  const state = load(path);
  if (action === 'verify') {
    if (state) throw new Error('Refresh policy journal remains');
    return { idle: true, restored: true };
  }
  if (action === 'start') {
    if (state) throw new Error('Refresh policy already owned');
    const original = Object.fromEntries(Object.keys(policy).map(key => [key, current[key]]));
    writeFileSync(`${path}.next`, JSON.stringify({ owner, realm: current.realm, original }), { mode: 0o600, flag: 'wx' });
    renameSync(`${path}.next`, path);
    await admin('PUT', '', policy, 204);
  } else {
    if (!state || state.owner !== owner || state.realm !== current.realm) throw new Error('Refresh policy owner mismatch');
    if (Object.entries(policy).some(([key, value]) => current[key] !== value && current[key] !== state.original[key])) throw new Error('Refresh policy drift');
    if (action !== 'restore') throw new Error('Unknown refresh policy action');
    await admin('PUT', '', state.original, 204);
    const restored = await admin('GET', '');
    if (Object.entries(state.original).some(([key, value]) => restored[key] !== value)) throw new Error('Refresh policy restoration failed');
    unlinkSync(path);
    return { idle: true, restored: true };
  }
  const updated = await admin('GET', '');
  if (Object.entries(policy).some(([key, value]) => updated[key] !== value)) throw new Error('Refresh policy not applied');
  return { idle: false, rotation: true, maxReuse: 0 };
}
export async function restoreRefreshPolicy(admin, path) {
  const state = load(path);
  if (state) await refreshPolicy(admin, path, 'restore', state.owner);
  return refreshPolicy(admin, path, 'verify');
}
