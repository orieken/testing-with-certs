import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
const policy = { 'access.token.lifespan': '20', 'client.session.max.lifespan': '45' };
async function client(admin) {
  const found = await admin('GET', '/clients?clientId=password-otp-spa&max=2');
  if (found.length !== 1) throw new Error('OTP session fixture client missing or ambiguous');
  return admin('GET', `/clients/${found[0].id}`);
}
export async function startOtpSessionPolicy(admin, path) {
  const current = await client(admin);
  if (Object.keys(policy).some(key => current.attributes?.[key] !== undefined)) throw new Error('OTP session fixture requires an unmodified client lifetime policy');
  // Record ownership before mutation so the exit trap can recover partial setup.
  writeFileSync(path, JSON.stringify({ clientId: current.id }), { mode: 0o600, flag: 'wx' });
  await admin('PUT', `/clients/${current.id}`, { ...current, attributes: { ...current.attributes, ...policy } }, 204);
  const updated = await client(admin);
  if (Object.entries(policy).some(([key, value]) => updated.attributes?.[key] !== value)) throw new Error('OTP session fixture policy was not applied');
}
export async function finishOtpSessionPolicy(admin, path) {
  if (!existsSync(path)) return;
  const state = JSON.parse(readFileSync(path, 'utf8'));
  const current = await client(admin);
  if (state.clientId !== current.id) throw new Error('OTP session fixture ownership changed');
  const attributes = { ...current.attributes };
  for (const [key, value] of Object.entries(policy)) {
    if (attributes[key] !== undefined && attributes[key] !== value) throw new Error('OTP session fixture policy drift');
    delete attributes[key];
  }
  await admin('PUT', `/clients/${current.id}`, { ...current, attributes }, 204);
  await verifyOtpSessionPolicy(admin);
  unlinkSync(path);
}
export async function verifyOtpSessionPolicy(admin, path) {
  if (path && existsSync(path)) throw new Error('OTP session fixture policy state remains');
  const current = await client(admin);
  if (Object.keys(policy).some(key => current.attributes?.[key] !== undefined)) throw new Error('OTP session fixture policy remains');
}
