import { jwksCaseNames } from './cases.mjs';
export const jwksModes = ['healthy', 'unavailable', 'malformed', 'empty'];
export const isJwksLease = lease => jwksCaseNames.includes(lease?.kind);
export function createLease(owner, kind) {
  return { owner, kind, applied: 0, originalVerified: false, mode: 'healthy',
    tokenResponses: 0, providerKids: new Set(), jwksRequests: 0, jwksFailures: 0, jwksSuccesses: 0 };
}
export function leaseStatus(lease) {
  if (!isJwksLease(lease)) return { kind: lease.kind, applied: lease.applied, originalVerified: lease.originalVerified };
  return { kind: lease.kind, tokenResponses: lease.tokenResponses, distinctProviderKids: lease.providerKids.size,
    originalVerified: lease.originalVerified, mode: lease.mode, jwksRequests: lease.jwksRequests,
    jwksFailures: lease.jwksFailures, jwksSuccesses: lease.jwksSuccesses };
}
export function recordOriginal(lease, token) {
  const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url'));
  if (typeof header.kid !== 'string' || !header.kid) throw new Error('Provider key ID missing');
  lease.tokenResponses++; lease.providerKids.add(header.kid); lease.originalVerified = true;
}
export function setJwksMode(lease, mode) {
  if (!isJwksLease(lease) || !jwksModes.includes(mode)) return false;
  lease.mode = mode; return true;
}
