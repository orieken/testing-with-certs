import {createRemoteJWKSet, jwtVerify} from 'jose';
import type {VerifiedUser} from '../domain/identity.js';
const issuer='https://auth.magic.test:9443/realms/magic-shop';
const keys=createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`), {timeoutDuration:5000, cooldownDuration:1000});
export async function verifyAccessToken(token: string): Promise<VerifiedUser> {
  const {payload}=await jwtVerify(token,keys,{issuer,audience:'spike-api',algorithms:['RS256'],requiredClaims:['exp','iat','sub','cert_identity']});
  if (payload.typ !== 'Bearer' || typeof payload.cert_identity !== 'string' || typeof payload.sub !== 'string') throw new Error('invalid_token');
  const access=payload.realm_access;
  const roles=typeof access==='object' && access!==null && 'roles' in access ? access.roles : [];
  if (!Array.isArray(roles) || !roles.every((role:unknown): role is string => typeof role==='string')) throw new Error('invalid_roles');
  return {certIdentity:payload.cert_identity,subject:payload.sub,roles};
}
