import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
export function lessonSessionPolicy(clientId) {
  if (!['password-otp-spa', 'passkeys-spa'].includes(clientId)) throw new Error('Unknown lifecycle client');
  const policy = { 'access.token.lifespan': '20', 'client.session.max.lifespan': '45' };
  async function client(admin) {
    const found = await admin('GET', `/clients?clientId=${clientId}&max=2`);
    if (found.length !== 1) throw new Error('Lesson session fixture client missing or ambiguous');
    return admin('GET', `/clients/${found[0].id}`);
  }
  async function start(admin, path) {
    const current = await client(admin);
    if (Object.keys(policy).some(key => current.attributes?.[key] !== undefined)) throw new Error('Lesson session fixture requires an unmodified client lifetime policy');
    // Record ownership before mutation so the exit trap can recover partial setup.
    writeFileSync(path, JSON.stringify({ clientId: current.id }), { mode: 0o600, flag: 'wx' });
    await admin('PUT', `/clients/${current.id}`, { ...current, attributes: { ...current.attributes, ...policy } }, 204);
    const updated = await client(admin);
    if (Object.entries(policy).some(([key, value]) => updated.attributes?.[key] !== value)) throw new Error('Lesson session fixture policy was not applied');
  }
  async function finish(admin, path) {
    if (!existsSync(path)) return;
    const state = JSON.parse(readFileSync(path, 'utf8'));
    const current = await client(admin);
    if (state.clientId !== current.id) throw new Error('Lesson session fixture ownership changed');
    const attributes = { ...current.attributes };
    for (const [key, value] of Object.entries(policy)) {
      if (attributes[key] !== undefined && attributes[key] !== value) throw new Error('Lesson session fixture policy drift');
      // Keycloak merges client attributes; null explicitly removes an owned override.
      attributes[key] = null;
    }
    await admin('PUT', `/clients/${current.id}`, { ...current, attributes }, 204);
    await verify(admin);
    unlinkSync(path);
  }
  async function verify(admin, path) {
    if (path && existsSync(path)) throw new Error('Lesson session fixture policy state remains');
    const current = await client(admin);
    if (Object.keys(policy).some(key => current.attributes?.[key] !== undefined)) throw new Error('Lesson session fixture policy remains');
  }

  return { start, finish, verify };
}
