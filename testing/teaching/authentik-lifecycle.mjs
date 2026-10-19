import {readFileSync} from 'node:fs';
import {expect} from '@playwright/test';
import {checkShortAccessLifetime} from './lesson-token-lifetime.mjs';
const claims=token=>JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());

export async function checkAuthentikLifecycle({kind,method,page,context,user,login,validate,logout,counters,recorded}){
 const endpoint=`https://shop.magic.test:9643/realms/lesson-${method}/protocol/openid-connect/token`;
 const refresh=(tokens,client=`${method}-spa`)=>context.request.post(endpoint,{form:{grant_type:'refresh_token',client_id:client,refresh_token:tokens.refresh_token}});
 async function rejected(tokens,client){
  const response=await refresh(tokens,client);expect(response.status()).toBe(400);expect((await response.json()).error).toBe('invalid_grant');
 }
 async function refreshed(tokens,role=true){
  const before=counters.provider;const response=await refresh(tokens);expect(response.status()).toBe(200);
  const next=await response.json();expect(next.access_token!==tokens.access_token).toBe(true);
  expect(claims(next.access_token).sub).toBe(claims(tokens.access_token).sub);
  await validate(next,role);expect(counters.provider).toBe(before);return next;
 }
 const tokens=await login();checkShortAccessLifetime(tokens);
 expect(Number.isInteger(tokens.refresh_expires_in)&&tokens.refresh_expires_in>0&&tokens.refresh_expires_in<=45).toBe(true);
 const before=counters.provider;
 switch(kind){
  case 'access-expiry-clears-identity':{
   const remaining=claims(tokens.access_token).exp*1000-Date.now();expect(remaining>5000).toBe(true);
   await page.waitForTimeout(Math.max(0,remaining-3000));await expect(page.getByTestId('lesson-user')).toHaveText(user.username);
   await expect(page.getByTestId('lesson-user')).toHaveCount(0,{timeout:10000});
   expect(Date.now()>=claims(tokens.access_token).exp*1000).toBe(true);
   // Re-entry may reuse the broker's SSO session. Do not claim provider reauthentication.
   const next=await login(true);expect(claims(next.access_token).sub).toBe(claims(tokens.access_token).sub);break;
  }
  case 'refresh-preserves-identity':await refreshed(tokens);await expect(page.getByTestId('lesson-user')).toHaveText(user.username);break;
  case 'refresh-client-binding':await rejected(tokens,'account-console');await refreshed(tokens);break;
  case 'session-expiry-rejects-refresh':
   await page.waitForTimeout(tokens.refresh_expires_in*1000+1500);await rejected(tokens);await expect(page.getByTestId('lesson-user')).toHaveCount(0);expect(counters.provider).toBe(before);break;
  case 'logout-invalidates-refresh':{
   await logout();await rejected(tokens);await page.reload();await expect(page.getByTestId('lesson-user')).toHaveCount(0);
   const isolated=await recorded.newContext();try{const other=await isolated.newPage();await other.goto(`https://shop.magic.test:8543/teaching/${method}`);await expect(other.getByTestId('lesson-user')).toHaveCount(0);}finally{await isolated.close();}break;
  }
  case 'group-withdrawal':{
   const mark=value=>console.log(`Authentik group lifecycle: ${value}`);
   mark('initial-session');
   const providerMethod=method.replace('authentik-','');
   async function membership(action){
    const response=await context.request.post(`http://authentik-control:9100/${providerMethod}/${action}`,{headers:{Authorization:`Bearer ${readFileSync('/ak-fixture/control-secret','utf8')}`}});
    expect(response.status()).toBe(200);expect(await response.json()).toEqual({ok:true,member:action==='restore'});
   }
   expect((await context.request.post(`http://authentik-control:9100/${providerMethod}/withdraw`)).status()).toBe(403);mark('unauthorized-rejected');
   const denied=await context.request.post('http://authentik-control:9100/unknown/restore',{headers:{Authorization:`Bearer ${readFileSync('/ak-fixture/control-secret','utf8')}`}});expect(denied.status()).toBe(404);mark('unknown-target-rejected');
   try{
    await membership('withdraw');mark('withdrawn');
    // Broker refresh uses its cached role; withdrawal is enforced at the next provider login.
    await refreshed(tokens,true);mark('cached-role-verified');await logout();await rejected(tokens);mark('provider-logout-returned');
    const previous=counters.provider;const next=await login(true,false);expect(counters.provider>previous).toBe(true);expect(claims(next.access_token).sub).toBe(claims(tokens.access_token).sub);mark('new-provider-session-verified');
   }finally{await membership('restore');mark('restored');}
   break;
  }
  default:throw new Error('Unknown authentik lifecycle case');
 }
 expect(counters.browserRefresh).toBe(0);
}
