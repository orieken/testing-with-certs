import {createHash,randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect} from '@playwright/test';

const shop='https://shop.magic.test:8543',broker='https://shop.magic.test:9643',provider='https://shop.magic.test:9743';
const appCallback=`${shop}/teaching/authentik-oidc/callback`;
const brokerCallback=`${broker}/realms/lesson-authentik-oidc/broker/authentik-oidc/endpoint`;
const brokerToken=`${broker}/realms/lesson-authentik-oidc/protocol/openid-connect/token`;
const matches=(url,target)=>`${url.origin}${url.pathname}`===target;

async function redirect(response){
 if([302,303].includes(response.status()))return response.headers().location;
 if(response.status()===200&&response.headers()['content-type']?.includes('application/json')){
  const value=await response.json();
  if(['ak-stage-redirect','xak-flow-redirect'].includes(value.component)&&typeof value.to==='string')return value.to;
 }
}

// Authentik can finish authentication through a flow-executor JSON redirect.
// Inspect that response or the authorization response before browser redirects,
// then follow only the real provider/broker exchanges up to the target callback.
export async function captureCallback(page,target,handle){
 let handled=false;
 await page.route(url=>url.origin===provider&&(url.pathname==='/application/o/authorize/'||url.pathname.startsWith('/api/v3/flows/executor/')),async route=>{
  if(handled)return route.continue();
  const original=await route.fetch({maxRedirects:0});
  let response=original,next=await redirect(response);
  if(!next)return route.fulfill({response:original});
  for(let hop=0;hop<8;hop++){
   const url=new URL(next,response.url());
   expect([provider,broker,shop].includes(url.origin)).toBe(true);
   if(matches(url,target)){
    handled=true;
    const deliver=async destination=>{
     if(original.headers()['content-type']?.includes('application/json')){
      const value=await original.json();
      await route.fulfill({response:original,json:{...value,to:destination}});
     }else await route.fulfill({response:original,status:302,headers:{...original.headers(),location:destination},body:''});
    };
    return handle(url,deliver);
   }
   const exchange=url.origin===provider&&url.pathname==='/application/o/authorize/'||
    url.origin===broker&&url.pathname.startsWith('/realms/lesson-authentik-oidc/');
   if(!exchange)return route.fulfill({response:original});
   response=await page.context().request.get(url.href,{maxRedirects:0});
   next=await redirect(response);
   expect(typeof next).toBe('string');
  }
  throw new Error('Authentik callback redirect limit exceeded');
 });
}

async function checkState({kind,page,begin,identify,login,logout,accepted,mark}){
 const upstream=kind==='broker-state',target=upstream?brokerCallback:appCallback;
 if(upstream){mark('control');await login();await logout();await page.context().clearCookies();}
 let original,mutated,observed=false,captures=0,exchanges=0;
 page.on('request',request=>{
  if(request.url()===brokerToken&&request.method()==='POST')exchanges++;
  const url=new URL(request.url());
  if(matches(url,target)&&url.searchParams.get('state')===mutated)observed=true;
 });
 await captureCallback(page,target,async(url,deliver)=>{
  expect(url.searchParams.has('error')).toBe(false);
  expect(Boolean(url.searchParams.get('code'))).toBe(true);
  const state=url.searchParams.get('state');expect(Boolean(state)).toBe(true);
  original=url.href;mutated=`${state[0]==='A'?'B':'A'}${state.slice(1)}`;
  url.searchParams.set('state',mutated);captures++;
  await deliver(url.href);
 });
 mark('capture');await begin();await identify();
 mark('state');await expect.poll(()=>captures).toBe(1);
 await expect.poll(()=>observed).toBe(true);
 if(upstream){
  await expect(page.locator('#loginRestartLink')).toBeVisible();
  await expect(page.locator('#loginContinueLink')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/realms/lesson-authentik-oidc/login-actions/authenticate');
 }else await expect(page.getByRole('alert')).toBeVisible();
 expect(exchanges).toBe(0);await expect(page.getByTestId('lesson-user')).toHaveCount(0);
 if(!upstream){
  mark('control');await page.goto(original);await accepted();expect(exchanges).toBe(1);
 }
}

export async function authorizeAuthentik({page,identify,upstream,mark,badRedirect=false,refresh=false}){
 const client=upstream?'authentik-oidc-broker':'authentik-oidc-spa';
 const callback=upstream?brokerCallback:appCallback;
 const state=randomBytes(24).toString('base64url'),verifier=randomBytes(32).toString('base64url');
 const url=new URL(upstream?`${provider}/application/o/authorize/`:`${broker}/realms/lesson-authentik-oidc/protocol/openid-connect/auth`);
 url.search=new URLSearchParams({client_id:client,response_type:'code',scope:upstream?`openid profile email lesson${refresh?' offline_access':''}`:'openid profile',
  redirect_uri:badRedirect?`${callback}/not-registered`:callback,state,code_challenge_method:'S256',
  code_challenge:createHash('sha256').update(verifier).digest('base64url')}).toString();
 let code;
 if(!badRedirect)await captureCallback(page,callback,async(captured,deliver)=>{
  expect(captured.searchParams.get('state')===state).toBe(true);
  expect(captured.searchParams.has('error')).toBe(false);
  code=captured.searchParams.get('code');expect(Boolean(code)).toBe(true);
  // Keep the code out of the browser URL and away from either callback handler.
  await deliver(`${shop}/teaching/authentik-oidc`);
 });
 mark(badRedirect?'redirect':'authorize');await page.goto(url.href);
 if(badRedirect){
  if(upstream){
   await expect(page.getByText('Redirect URI Error',{exact:true})).toBeVisible();
   expect(new URL(page.url()).origin).toBe(provider);
  }else await expect(page.locator('#kc-error-message')).toBeVisible();
  await expect(page.locator('input[name="uidField"]')).toHaveCount(0);
  return;
 }
 await identify();await expect.poll(()=>Boolean(code),{timeout:30000}).toBe(true);
 const form={grant_type:'authorization_code',client_id:client,redirect_uri:callback,code,code_verifier:verifier};
 if(upstream)form.client_secret=readFileSync('/ak-fixture/oidc-client-secret','utf8');
 return {endpoint:upstream?`${provider}/application/o/token/`:brokerToken,form};
}

async function controlExchange({context,transaction,upstream,user,validate,mark}){
 mark('exchange');const response=await context.request.post(transaction.endpoint,{form:transaction.form});
 expect(response.status()).toBe(200);const tokens=await response.json();
 expect(typeof tokens.access_token).toBe('string');
 if(!upstream)await validate(tokens);
 else{
  const claims=JSON.parse(Buffer.from(tokens.id_token.split('.')[1],'base64url').toString());
  expect(claims.iss).toBe(`${provider}/application/o/lesson-oidc/`);
  const audiences=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  expect(audiences).toContain('authentik-oidc-broker');expect(claims.preferred_username).toBe(user.username);
 }
}

export async function checkAuthentikBoundary(options){
 const {kind,page,context,mark}=options;
 if(['callback-state','broker-state'].includes(kind))return checkState(options);
 const match=kind.match(/^(app|upstream)-(wrong-verifier|missing-verifier|replay|redirect)$/);
 if(!match)throw new Error('Unknown authentik boundary');
 const upstream=match[1]==='upstream',fault=match[2];
 const control=await authorizeAuthentik({...options,upstream});
 await controlExchange({...options,transaction:control,upstream});
 // Fresh browser cookies force another owned login without relying on the
 // provider-specific prompt=login behavior. Keep the consumed control code
 // private for replay; verifier negatives will receive a newly issued code.
 if(fault!=='replay')await context.clearCookies();
 if(fault==='redirect'){await authorizeAuthentik({...options,upstream,badRedirect:true});return;}
 const transaction=fault==='replay'?control:await authorizeAuthentik({...options,upstream});
 const form={...transaction.form};
 if(fault==='wrong-verifier')form.code_verifier=randomBytes(32).toString('base64url');
 if(fault==='missing-verifier')delete form.code_verifier;
 mark('rejection');const response=await context.request.post(transaction.endpoint,{form});
 expect(response.status()).toBe(400);expect((await response.json()).error).toBe('invalid_grant');
 await expect(page.getByTestId('lesson-user')).toHaveCount(0);
}
