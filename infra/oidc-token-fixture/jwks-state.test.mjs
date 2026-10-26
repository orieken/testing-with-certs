import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLease,leaseStatus,setJwksMode,recordOriginal } from './jwks-state.mjs';
const token=kid=>`${Buffer.from(JSON.stringify({alg:'RS256',kid})).toString('base64url')}.private-payload.private-signature`;
test('JWKS monitoring counts native key changes without retaining tokens or exposing key IDs',()=>{
 const lease=createLease('private-owner','jwks-uncached-key-outage');
 recordOriginal(lease,token('old-key'));recordOriginal(lease,token('new-key'));recordOriginal(lease,token('new-key'));
 assert.equal(leaseStatus(lease).distinctProviderKids,2);assert.equal(leaseStatus(lease).tokenResponses,3);
 assert.equal(leaseStatus(lease).originalVerified,true);
 for(const value of ['private-owner','old-key','new-key','private-payload','private-signature'])assert.ok(!JSON.stringify(leaseStatus(lease)).includes(value));
 assert.ok(!Object.values(lease).some(v=>typeof v==='string'&&v.includes('private-payload')));
});
test('JWKS phases are bounded to the owned lifecycle modes and preserve existing ID-token status contracts',()=>{
 const lease=createLease('owner','jwks-cached-key-outage');
 for(const mode of ['unavailable','malformed','empty','healthy']){assert.equal(setJwksMode(lease,mode),true);assert.equal(leaseStatus(lease).mode,mode);}
 assert.equal(setJwksMode(lease,'unrecognized'),false);assert.equal(lease.mode,'healthy');
 const original=createLease('owner','issuer');assert.equal(setJwksMode(original,'unavailable'),false);
 assert.deepEqual(leaseStatus(original),{kind:'issuer',applied:0,originalVerified:false});
});
