// Dedicated browser auth interception only. Never connects to a real identity provider/API.
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash, sign, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { profile } from '../fixtures.mjs';
export const shop='https://shop.magic.test:8443', auth='https://auth.magic.test:9443';
const issuer=`${auth}/realms/magic-shop`;
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
export async function authMock(state, name) {
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  await writeFile(`/state/${name}-key.pem`,privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});
  const signed=claims=>{const input=`${encode({alg:'RS256',typ:'JWT',kid:'prism-browser-ephemeral'})}.${encode(claims)}`;return `${input}.${sign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url')}`;};
  let transaction;
  return async(route,url)=>{
    if(url.pathname.endsWith('/auth')) {
      assert.equal(url.searchParams.get('client_id'),'shop-spa'); assert.equal(url.searchParams.get('response_type'),'code');
      assert.equal(url.searchParams.get('redirect_uri'),`${shop}/callback`); assert.equal(url.searchParams.get('code_challenge_method'),'S256');
      transaction={state:url.searchParams.get('state'),nonce:url.searchParams.get('nonce'),challenge:url.searchParams.get('code_challenge'),code:randomUUID()};
      const callback=new URL(`${shop}/callback`);callback.searchParams.set('state',transaction.state);callback.searchParams.set('code',transaction.code);
      await route.fulfill({status:302,headers:{location:callback.href}});return;
    }
    if(!url.pathname.endsWith('/token'))throw new Error('Unexpected synthetic auth operation');
    const fields=new URLSearchParams(route.request().postData());
    assert.equal(fields.get('grant_type'),'authorization_code');assert.equal(fields.get('client_id'),'shop-spa');assert.equal(fields.get('code'),transaction.code);
    assert.equal(createHash('sha256').update(fields.get('code_verifier')??'').digest('base64url'),transaction.challenge);state.pkce=true;state.codeExchanges++;
    const now=Math.floor(Date.now()/1000),claims={iss:issuer,sub:profile.sub,preferred_username:'prism-customer',cert_identity:'synthetic-customer',realm_access:{roles:['customer']},aud:['catalog-api','customer-api','insights-api'],azp:'shop-spa',iat:now,exp:now+600,nonce:transaction.nonce};
    const tokens={access_token:signed(claims),id_token:signed({...claims,aud:'shop-spa'}),refresh_token:signed({...claims,typ:'Refresh'}),token_type:'Bearer',expires_in:600};
    await writeFile(`/state/${name}-tokens.json`,JSON.stringify(tokens),{mode:0o600});
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':shop,'access-control-allow-credentials':'true'},body:JSON.stringify(tokens)});
  };
}
