import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sign, verify, createPublicKey } from 'node:crypto';
import { createSigner, alterIdToken, verifyOriginal, decode } from './tokens.mjs';
import { upstreamIdTokenKinds } from './cases.mjs';
const provider = createSigner(), relay = createSigner();
const claims = { iss: 'https://provider.test', aud: 'broker', azp: 'broker', sub: 'owned-subject',
  nonce: 'owned-authorization-nonce', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 120 };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function token(value = claims) {
  const body = `${encode({alg:'RS256',kid:provider.jwk.kid,typ:'JWT'})}.${encode(value)}`;
  return `${body}.${sign('RSA-SHA256',Buffer.from(body),provider.privateKey).toString('base64url')}`;
}
function signatureValid(value) {
  const [header,payload,signature] = value.split('.');
  return verify('RSA-SHA256',Buffer.from(`${header}.${payload}`),createPublicKey({key:relay.jwk,format:'jwk'}),Buffer.from(signature,'base64url'));
}
test('relay controls preserve all provider claims while changing only the signing key', () => {
  const original = token();
  assert.deepEqual(verifyOriginal(original,[provider.jwk],claims.iss,'broker'),claims);
  const control = alterIdToken(original,'signed-control',relay);
  assert.deepEqual(decode(control),claims);assert.ok(signatureValid(control));
  assert.deepEqual(verifyOriginal(control,[relay.jwk],claims.iss,'broker'),claims);
  assert.throws(()=>verifyOriginal(control,[provider.jwk],claims.iss,'broker'));
});
test('semantic negatives remain validly signed and isolate exactly their intended field', () => {
  const fields = {issuer:'iss',audience:'aud','authorized-party':'azp',expired:'exp','not-yet-valid':'nbf',nonce:'nonce','missing-nonce':'nonce'};
  for (const [kind,field] of Object.entries(fields)) {
    const changed=alterIdToken(token(),kind,relay),value=decode(changed);
    assert.ok(signatureValid(changed),kind);
    const keys=new Set([...Object.keys(claims),...Object.keys(value)]);
    assert.deepEqual([...keys].filter(key=>JSON.stringify(claims[key])!==JSON.stringify(value[key])),[field]);
    if(kind==='expired')assert.ok(value.exp<Math.floor(Date.now()/1000));
    if(kind==='not-yet-valid')assert.ok(value.nbf>Math.floor(Date.now()/1000)+240);
    if(kind==='missing-nonce')assert.ok(!Object.hasOwn(value,'nonce'));
  }
});
test('bad signature and unknown-key inputs have intact claims and distinct trust failures', () => {
  for(const kind of ['signature','unknown-key']) {
    const changed=alterIdToken(token(),kind,relay);assert.deepEqual(decode(changed),claims);
    const header=JSON.parse(Buffer.from(changed.split('.')[0],'base64url'));
    assert.equal(signatureValid(changed),kind==='unknown-key');
    assert.equal(header.kid===relay.jwk.kid,kind==='signature');
    assert.throws(()=>verifyOriginal(changed,[relay.jwk],claims.iss,'broker'));
  }
  assert.throws(()=>alterIdToken(token(),'unrecognized',relay));
  assert.equal(upstreamIdTokenKinds.length,10);
});
test('relay refuses invalid originals instead of presenting them as isolated mutations', () => {
  for(const value of [{...claims,iss:'https://other.test'},{...claims,aud:'other'},{...claims,nonce:''},{...claims,exp:1}]) {
    assert.throws(()=>verifyOriginal(token(value),[provider.jwk],claims.iss,'broker'));
  }
  assert.throws(()=>verifyOriginal(token(),[relay.jwk],claims.iss,'broker'));
});
