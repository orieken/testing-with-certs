import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { request, json, ready } from './http.mjs';
import { checkToken, altered } from './jwt.mjs';
export async function runOidc() {
  const clientSecret=randomBytes(24).toString('base64url');
  writeFileSync('/state/client-secret',clientSecret,{mode:0o600});
  const issuer='https://oidc:8080/default';
  await ready(`${issuer}/.well-known/openid-configuration`);
  const discovery=json(await request(`${issuer}/.well-known/openid-configuration`));
  assert.equal(discovery.issuer,issuer);
  for(const field of ['jwks_uri','token_endpoint']) assert.equal(new URL(discovery[field]).origin,new URL(issuer).origin);
  const jwks=json(await request(discovery.jwks_uri));
  assert.ok(jwks.keys.length>0);
  const getToken=async(endpoint,scope='teaching-consumer')=>{
    const response=await request(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:'teaching-consumer',client_secret:clientSecret,scope}).toString()});
    assert.equal(response.status,200); const result=json(response); assert.equal(result.token_type.toLowerCase(),'bearer'); return result.access_token;
  };
  const token=await getToken(discovery.token_endpoint);
  writeFileSync('/state/oidc-token',token,{mode:0o600});
  assert.equal(checkToken(token,jwks.keys,issuer,'teaching-consumer').sub,'synthetic-client');
  assert.throws(()=>checkToken(token,jwks.keys,issuer,'wrong-audience'),/audience/);
  assert.throws(()=>checkToken(token,jwks.keys,'https://other.test','teaching-consumer'),/issuer/);
  assert.throws(()=>checkToken(altered(token),jwks.keys,issuer,'teaching-consumer'),/signature/);
  assert.throws(()=>checkToken(token,[] ,issuer,'teaching-consumer'),/known key/);
  const expired=await getToken('https://oidc:8080/expired/token');
  const expiredKeys=json(await request('https://oidc:8080/expired/jwks'));
  assert.throws(()=>checkToken(expired,expiredKeys.keys,'https://oidc:8080/expired','teaching-consumer'),/expiry/);
  const missingSecret=await request(discovery.token_endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials&client_id=teaching-consumer'});
  assert.equal(missingSecret.status,401); assert.equal(json(missingSecret).error,'invalid_client');
  const invalid=await request(discovery.token_endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'unsupported',client_id:'teaching-consumer',client_secret:clientSecret}).toString()});
  assert.equal(invalid.status,400); assert.equal(json(invalid).error,'invalid_grant');
  await assert.rejects(()=>request(discovery.jwks_uri,{ca:[]}),/certificate|issuer|self-signed/i);
  await assert.rejects(()=>request(discovery.jwks_uri,{servername:'wrong.test'}),/Hostname|altnames/i);
  await assert.rejects(()=>request('https://oidc:1/default/jwks',{timeout:500}),/ECONNREFUSED/);
  assert.equal(checkToken(await getToken(discovery.token_endpoint),jwks.keys,issuer,'teaching-consumer').sub,'synthetic-client');
  console.log('MOCK-CONSUMER FEATURE-02: discovery/JWKS/token, 10 fail-closed cases and recovery passed');
}
