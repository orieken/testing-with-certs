import {readFileSync} from 'node:fs';
import {expect} from '@playwright/test';
import {withAuthRecording} from './auth-recording.mjs';
import {checkAuthentikLifecycle} from './authentik-lifecycle.mjs';
import {checkUpstreamSessions} from './oidc-sessions.mjs';
import {upstreamSessionCases} from './oidc-session-cases.mjs';
import {checkRefreshRotation} from './oidc-refresh.mjs';
import {refreshCaseNames} from './oidc-refresh-cases.mjs';
import {authorizeAuthentik} from './authentik-boundaries.mjs';
import {checkJwksLifecycle} from './oidc-jwks.mjs';
import {jwksCaseNames} from '../../infra/oidc-token-fixture/cases.mjs';
import {checkUpstreamIdToken} from './oidc-upstream.mjs';
import {checkOidcRecovery} from './oidc-recovery.mjs';
import {oidcRecoveryKinds} from './oidc-recovery-cases.mjs';
import {checkAuthentikBoundary,captureCallback} from './authentik-boundaries.mjs';
import {authentikCaseNames,authentikLifecycleCaseNames} from './provider-matrix.mjs';
const shop='https://shop.magic.test:8543', broker='https://shop.magic.test:9643';

export async function checkAuthentik(browser,name,playwright){
 if(!authentikCaseNames.includes(name))throw new Error('Unknown authentik check');
 const [method,kind]=name.split(':');
 const lifecycle=authentikLifecycleCaseNames.includes(name);
 return withAuthRecording(browser,playwright,name,method,async recorded=>{
  const context=await recorded.newContext({ignoreHTTPSErrors:false});
  const page=await context.newPage();
  const accountKind=lifecycle||upstreamSessionCases.includes(kind)?kind:kind==='no-group'?'no-group':kind==='disabled-user'?'disabled':'member';
  const user=JSON.parse(readFileSync('/ak-fixture/users.json')).find(u=>u.method===method.replace('authentik-','')&&u.kind===accountKind);
  if(!user)throw new Error('Missing owned authentik account');
  const endpoint=`${broker}/realms/lesson-${method}/protocol/openid-connect/token`;
  let captured,providerRejected=false,signatureChanged=false,logoutObserved=false,stage='lesson-open';
  const counters={provider:0,browserRefresh:0};
  page.on('request',r=>{const u=new URL(r.url());if(u.origin==='https://shop.magic.test:9743'&&['/application/o/authorize/','/application/saml/lesson-saml/sso/binding/post/'].includes(u.pathname))counters.provider++;if(r.url()===endpoint&&new URLSearchParams(r.postData()??'').get('grant_type')==='refresh_token')counters.browserRefresh++;});
  const external=new Set();page.on('request',r=>{const u=new URL(r.url());if(u.origin==='https://shop.magic.test:9743'&&(u.pathname.endsWith('/end-session/')||u.pathname.endsWith('/slo/binding/post/')))logoutObserved=true;if(['http:','https:'].includes(u.protocol)&&![shop,broker,'https://shop.magic.test:9743','https://shop.magic.test:8443','https://auth.magic.test:9443'].includes(u.origin))external.add(u.origin);});
  page.on('response',async r=>{if(!r.url().startsWith('https://shop.magic.test:9743/api/v3/flows/executor/')||r.status()!==200)return;try{const v=await r.json();if(Object.keys(v.field_errors??{}).length||Object.keys(v.response_errors??{}).length)providerRejected=true;}catch{}});
  page.on('response',response=>{if(response.url()===endpoint&&response.status()===200)captured=response;});
  async function begin(){await page.goto(`${shop}/teaching/${method}`);await page.getByRole('button',{name:`Sign in with authentik ${method.endsWith('oidc')?'OIDC':'SAML'}`,exact:true}).click();}
  async function identify(){stage='provider-username';await page.locator('input[name="uidField"]').fill(user.username);await page.getByRole('button',{name:'Log in',exact:true}).click();stage='provider-password';if(kind==='disabled-user'){await expect.poll(async()=>providerRejected||await page.locator('ak-stage-password input[type="password"]').count()>0).toBe(true);if(providerRejected)return;}await page.locator('ak-stage-password input[type="password"]').fill(kind==='wrong-password'?'intentionally-incorrect-password':user.password);stage='provider-submit';await page.getByRole('button',{name:'Continue',exact:true}).click();}
  async function validate(tokens,role=true){
   const token=tokens.access_token;
   stage='claims';const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
   expect(claims.iss).toBe(`${broker}/realms/lesson-${method}`);expect(claims.azp).toBe(`${method}-spa`);expect(claims.preferred_username).toBe(user.username);
   const audience=Array.isArray(claims.aud)?claims.aud:[claims.aud];expect(audience).toContain(`${method}-lesson`);for(const name of ['catalog-api','customer-api','insights-api'])expect(audience).not.toContain(name);
   const roles=claims.lesson_roles??[];if(!role)expect(roles).not.toContain('lesson-member');else expect(roles).toContain('lesson-member');
   expect(typeof tokens.refresh_token).toBe('string');
   stage='api-denial';const api=await playwright.request.newContext({clientCertificates:[{origin:'https://shop.magic.test:8443',certPath:'/identity-customer/cert.pem',keyPath:'/identity-customer/key.pem'}]});
   try{for(const path of ['/api/catalog/items','/api/customer/me','/api/insights/sales'])expect((await api.get(`https://shop.magic.test:8443${path}`,{headers:{authorization:`Bearer ${token}`}})).status()).toBe(401);}finally{await api.dispose();}
  }
  async function accepted(role=kind!=='no-group'){
   stage='lesson-identity';await expect(page.getByTestId('lesson-user')).toHaveText(user.username,{timeout:30000});
   await expect.poll(()=>Boolean(captured)).toBe(true);
   const tokens=await captured.json();await validate(tokens,role);return tokens;
  }
  async function login(allowSso=false,role=true){
   captured=undefined;await begin();
   if(allowSso)await expect(page.locator('input[name="uidField"]').or(page.getByTestId('lesson-user')).first()).toBeVisible({timeout:30000});
   if(!allowSso||!await page.getByTestId('lesson-user').isVisible())await identify();
   return accepted(role);
  }
  async function logout(){
   stage='logout';logoutObserved=false;await page.getByRole('button',{name:'Sign out of lesson',exact:true}).click();
   await expect(page.getByTestId('lesson-user')).toHaveCount(0);
   await expect(page.getByRole('button',{name:`Sign in with authentik ${method.endsWith('oidc')?'OIDC':'SAML'}`,exact:true})).toBeVisible({timeout:30000});
   expect(new URL(page.url()).origin).toBe(shop);expect(logoutObserved).toBe(true);await expect(page.getByRole('alert')).toHaveCount(0);
  }
  try{
   if(lifecycle){
    await checkAuthentikLifecycle({kind,method,page,context,user,login,validate,logout,counters,recorded});
    expect([...external]).toEqual([]);return;
   }
   if(method==='authentik-oidc'&&upstreamSessionCases.includes(kind)){
    await checkUpstreamSessions({kind,provider:'authentik',page,context,username:user.username,
     authorize:()=>authorizeAuthentik({page,identify,upstream:true,mark:()=>{},refresh:true}),
     login:()=>login(),validateBroker:tokens=>validate(tokens),mark:value=>{stage=`session-${value}`;}});
    expect([...external]).toEqual([]);return;
   }
   if(method==='authentik-oidc'&&refreshCaseNames.includes(kind)){
    await checkRefreshRotation({kind,provider:'authentik',page,context,
     authorize:upstream=>authorizeAuthentik({page,identify,upstream,mark:()=>{},refresh:true}),
     validate:async(tokens,upstream)=>{
      if(!upstream)return validate(tokens);
      const value=JSON.parse(Buffer.from(tokens.id_token.split('.')[1],'base64url').toString());
      expect(value.iss).toBe('https://shop.magic.test:9743/application/o/lesson-oidc/');
      expect([value.aud].flat()).toContain('authentik-oidc-broker');expect(value.preferred_username).toBe(user.username);
      const response=await context.request.get('https://shop.magic.test:9743/application/o/userinfo/',{headers:{authorization:`Bearer ${tokens.access_token}`}});
      expect(response.status()).toBe(200);expect((await response.json()).sub===value.sub).toBe(true);
     },mark:value=>{stage=`refresh-${value}`;}});
    expect([...external]).toEqual([]);return;
   }
   if(method==='authentik-oidc'&&jwksCaseNames.includes(kind)){
    await checkJwksLifecycle({kind,page,context,provider:'authentik',tokenEndpoint:endpoint,login:()=>login(),
     attempt:async()=>{await begin();await identify();},mark:value=>{stage=`keys-${value}`;}});
    expect([...external]).toEqual([]);return;
   }
   if(method==='authentik-oidc'&&kind.startsWith('upstream-id-token-')){
    await checkUpstreamIdToken({kind,page,context,provider:'authentik',tokenEndpoint:endpoint,login:()=>login(),
     attempt:async()=>{await begin();await identify();},mark:value=>{stage=`upstream-${value}`;}});
    expect([...external]).toEqual([]);return;
   }
   if(method==='authentik-oidc'&&oidcRecoveryKinds.includes(kind)){
    await checkOidcRecovery({kind,page,method,tokenEndpoint:endpoint,attempt:async()=>{await begin();await identify();},
     recover:()=>login(true),capture:handle=>captureCallback(page,`${shop}/teaching/${method}/callback`,handle),
     mark:value=>{stage=`recovery-${value}`;}});
    expect([...external]).toEqual([]);return;
   }
   if(method==='authentik-oidc'&&(['callback-state','broker-state'].includes(kind)||/^(app|upstream)-/.test(kind))){
    await checkAuthentikBoundary({kind,page,context,user,begin,identify,login,logout,accepted,validate,mark:value=>{stage=`boundary-${value}`;}});
    expect([...external]).toEqual([]);return;
   }
   if(kind==='invalid-signature')await page.route('**/realms/lesson-authentik-saml/broker/authentik-saml/endpoint',async route=>{
    const body=new URLSearchParams(route.request().postData()??'');
    if(body.has('SAMLResponse')){const xml=Buffer.from(body.get('SAMLResponse'),'base64').toString('utf8');const changed=xml.replace(/(<(?:[\w]+:)?SignatureValue[^>]*>)([A-Za-z0-9+/])([\s\S]*?<\/(?:[\w]+:)?SignatureValue>)/g,(_,open,first,rest)=>{signatureChanged=true;return open+(first==='A'?'B':'A')+rest;});body.set('SAMLResponse',Buffer.from(changed).toString('base64'));await route.continue({postData:body.toString()});}else await route.continue();
   });
   if(kind==='callback-state'||kind==='broker-state'){
    stage='callback-alert';
    if(kind==='callback-state'){await page.goto(`${shop}/teaching/${method}/callback?code=invalid-fixture-code&state=unmatched-fixture-state`);await expect(page.getByRole('alert')).toBeVisible();}
    else{await page.goto(`${broker}/realms/lesson-${method}/broker/${method}/endpoint?code=invalid-fixture-code&state=unmatched-fixture-state`);await expect(page.locator('#kc-error-message')).toBeVisible();}
    await expect(page.getByTestId('lesson-user')).toHaveCount(0);expect(captured).toBeUndefined();expect([...external]).toEqual([]);return;
   }
   await begin();await identify();
   if(['wrong-password','disabled-user'].includes(kind)){
    stage='provider-rejection';await expect.poll(()=>providerRejected,{timeout:20000}).toBe(true);await expect(page.getByTestId('lesson-user')).toHaveCount(0);expect(captured).toBeUndefined();
   }else if(kind==='invalid-signature'){
    stage='signature-rejection';await expect.poll(()=>signatureChanged).toBe(true);await expect(page.locator('#kc-error-message')).toBeVisible({timeout:30000});await expect(page.getByTestId('lesson-user')).toHaveCount(0);expect(captured).toBeUndefined();
   }else{
    await accepted();
    if(kind==='logout-isolation'){
     await logout();
     const isolated=await recorded.newContext();try{const other=await isolated.newPage();await other.goto(`${shop}/teaching/${method}`);await expect(other.getByTestId('lesson-user')).toHaveCount(0);}finally{await isolated.close();}
    }
   }
   expect([...external]).toEqual([]);
  }catch{throw new Error(`Authentik stage ${lifecycle?'lifecycle-'+kind:stage}`);}finally{await context.close();}
 });
}
