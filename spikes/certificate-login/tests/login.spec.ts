import {test,expect} from '@orieken/saturday-playwright';
import {certificates,identifiers} from './certificates.js';
import {LandingSite,shop,auth} from './site.js';
import type {Page} from 'playwright';
import {expectTlsDenied} from './tls-denial.js';
import {readFileSync,readdirSync} from 'node:fs';
async function login(page:Page, expected:string) {
  page.on('response',response=>console.log(`HTTP ${response.status()} ${new URL(response.url()).hostname}${new URL(response.url()).pathname}`));
  page.on('requestfailed',request=>console.log(`Request failed: ${new URL(request.url()).hostname}${new URL(request.url()).pathname} ${request.failure()?.errorText??''}`));
  const tokenResponse=page.waitForResponse(response=>response.url()===`${auth}/realms/magic-shop/protocol/openid-connect/token` && response.request().method()==='POST',{timeout:20000});
  await new LandingSite(page).login();
  const response=await tokenResponse;
  expect(response.status()).toBe(200);
  const tokens:unknown=await response.json();
  if (typeof tokens!=='object'||tokens===null||!('access_token' in tokens)||typeof tokens.access_token!=='string') throw new Error('missing_access_token');
  await expect(page.locator('#status')).toHaveText(`Authenticated: ${expected}`);
  return tokens.access_token;
}
for (const identity of ['customer','admin'] as const) {
  test(`prompt01 AUTH-01/02: ${identity} certificate PKCE login`,async({browser})=>{
    const context=await browser.newContext({clientCertificates:certificates(identity)});
    try {
      const page=await context.newPage();
      const token=await login(page,identity);
      const parts=token.split('.');
      const claims:unknown=JSON.parse(Buffer.from(parts[1]??'','base64url').toString());
      expect(claims).toMatchObject({cert_identity:identifiers[identity],preferred_username:identity,typ:'Bearer'});
      expect(await page.locator('#identity').textContent()).toContain(identity==='admin'?'shop-admin':'customer');
      expect(await page.locator('input[type=password]').count()).toBe(0);
    } finally {await context.close();}
  });
}
test('prompt01 AUTH-11: saved admin cookies cannot override customer certificate',async({browser})=>{
  const admin=await browser.newContext({clientCertificates:certificates('admin')});
  try {
    const token=await login(await admin.newPage(),'admin');
    const customer=await browser.newContext({clientCertificates:certificates('customer'),storageState:await admin.storageState()});
    try {
      const page=await customer.newPage();
      let issuedToken=false;
      page.on('response',response=>{if(response.url().endsWith('/protocol/openid-connect/token')&&response.status()===200)issuedToken=true;});
      await new LandingSite(page).login();
      await expect(page.locator('body')).toContainText(/Invalid user|authentication.*failed|error/i);
      expect(page.url().startsWith(auth)).toBe(true);
      expect(issuedToken).toBe(false);
      expect(await page.locator('input[type=password]').count()).toBe(0);
      const response=await customer.request.get(`${shop}/api/identity`,{headers:{authorization:`Bearer ${token}`,'x-cert-identity':identifiers.admin},timeout:10000});
      expect(response.status()).toBe(403);
      expect(await response.json()).toEqual({error:'identity_mismatch'});
    } finally {await customer.close();}
    const fresh=await browser.newContext({clientCertificates:certificates('customer')});
    try{
      const token=await login(await fresh.newPage(),'customer');
      const claims:unknown=JSON.parse(Buffer.from(token.split('.')[1]??'','base64url').toString());
      expect(claims).toMatchObject({cert_identity:identifiers.customer,preferred_username:'customer'});
    }finally{await fresh.close();}
  } finally {await admin.close();}
});
test('prompt01 AUTH-05: unknown user receives no token or password fallback',async({browser})=>{
  const context=await browser.newContext({clientCertificates:certificates('unknown')});
  try {
    const page=await context.newPage();
    await new LandingSite(page).login();
    await expect(page.locator('body')).toContainText(/Invalid user|authentication.*failed/i);
    expect(await page.locator('input[type=password]').count()).toBe(0);
    expect(page.url().startsWith(auth)).toBe(true);
  } finally {await context.close();}
});
test('prompt01 AUTH-03: missing user certificate rejects shop',async({browser})=>{
  const context=await browser.newContext();
  try {await expect((await context.newPage()).goto(shop,{timeout:10000})).rejects.toThrow();}
  finally {await context.close();}
});
for (const identity of ['untrusted','collision'] as const) {
  test(`prompt01 AUTH-04: ${identity} issuer rejects shop`,async({browser})=>{
    const context=await browser.newContext({clientCertificates:certificates(identity)});
    try {await expectTlsDenied(await context.newPage(),shop,/certificate|alert|socket|ECONNRESET|ERR_HTTP2_PROTOCOL_ERROR/i);}
    finally {await context.close();}
  });
}
test('prompt01 TRUST-01: wrong server hostname rejects',async({browser})=>{
  const context=await browser.newContext({clientCertificates:certificates('customer').map(cert=>({...cert,origin:'https://wrong.magic.test:8443'}))});
  try {await expectTlsDenied(await context.newPage(),'https://wrong.magic.test:8443',/certificate|Hostname|hostname|altnames/i);}
  finally {await context.close();}
});
test('prompt01 exact origins: shop-only certificate cannot authenticate at auth',async({browser})=>{
  const context=await browser.newContext({clientCertificates:certificates('customer').filter(cert=>cert.origin===shop)});
  try {
    const page=await context.newPage();
    await new LandingSite(page).login();
    await expect(page.locator('body')).toContainText(/Invalid|error|unexpected|authentication/i);
    expect(page.url().startsWith(auth)).toBe(true);
  } finally {await context.close();}
});
for(const identity of ['untrusted','collision','revocable'] as const){
  test(`prompt01 AUTH-04/AUTH-07: independent Keycloak ${identity} boundary`,async({browser})=>{
    const context=await browser.newContext({clientCertificates:[...certificates('customer').filter(cert=>cert.origin===shop),...certificates(identity).filter(cert=>cert.origin===auth)]});
    try{
      const page=await context.newPage();
      if(identity==='revocable'&&process.env.EXPECT_REVOKED!=='true'){
        // Keycloak authenticates revocable, then the API must reject its mismatch with shop customer.
        const tokens=page.waitForResponse(response=>response.url().endsWith('/protocol/openid-connect/token')&&response.request().method()==='POST',{timeout:20000});
        await new LandingSite(page).login();
        expect((await tokens).status()).toBe(200);
        await expect(page.locator('#status')).toHaveText('Authentication failed');
        return;
      }
      let issuedToken=false;
      let authRequested=false;
      page.on('request',request=>{if(request.url().startsWith(`${auth}/realms/magic-shop/protocol/openid-connect/auth`))authRequested=true;});
      page.on('response',response=>{if(response.url().endsWith('/protocol/openid-connect/token')&&response.status()===200)issuedToken=true;});
      await new LandingSite(page).login();
      await expect(page.locator('body')).toContainText(/client-certificate error|Certificate.*failed|Certificate revoked|authentication.*failed|Invalid username or password|ERR_HTTP2_PROTOCOL_ERROR/i);
      expect(issuedToken).toBe(false);
      expect(authRequested).toBe(true);
    }finally{await context.close();}
  });
}
test('prompt01 real branded binary and absence of TLS bypass flags',async({browser},testInfo)=>{
  const session=await browser.newBrowserCDPSession();
  try{
    const version=await session.send('Browser.getVersion');
    const executable=testInfo.project.name==='chrome'?'/opt/google/chrome/chrome':'/opt/microsoft/msedge/msedge';
    const commands=readdirSync('/proc').filter(name=>/^\d+$/.test(name)).flatMap(name=>{
      try{return [readFileSync(`/proc/${name}/cmdline`).toString().split('\0').filter(Boolean)];}
      catch{return [];}
    });
    const browserCommand=commands.find(args=>args[0]===executable&&args.some(arg=>arg==='--remote-debugging-pipe'));
    expect(browserCommand).toBeDefined();
    expect(browserCommand?.some(argument=>/ignore-certificate-errors|allow-insecure-localhost/.test(argument))).toBe(false);
    expect(version.product).toContain(testInfo.project.name==='chrome'?'Chrome':'Edg');
    console.log(`${testInfo.project.name} reported browser version: ${browser.version()}`);
  }finally{await session.detach();}
});
