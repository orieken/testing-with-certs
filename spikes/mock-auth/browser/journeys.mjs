import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash, sign, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { writeFile, appendFile, rename, mkdir } from 'node:fs/promises';
import { apiFixture, checked, validateJsonRequest, item } from './fixtures.mjs';
const require=createRequire('/work/testing/package.json');
const {expect,chromium}=require('@playwright/test');
export const scenarios=['customer','admin','auth-denied','wrong-state','invalid-claims','refresh-failure','checkout-403','checkout-503','checkout-delay','checkout-malformed','oidc-success','oidc-discovery-failure','oidc-token-failure','oidc-signature-failure'];
const shop='https://shop.magic.test:8443',auth='https://auth.magic.test:9443',issuer=`${auth}/realms/magic-shop`;
const identity={cert:readFileSync('/identity/cert.pem'),key:readFileSync('/identity/key.pem')};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
export async function launch(){return chromium.launch({channel:process.env.LAB_BROWSER,headless:true,slowMo:120,timeout:30000});}
export async function journey(browser,scenario,runner){
  assert.ok(scenarios.includes(scenario),'Known scenario');
  const dir=`/reports/${runner}-${process.env.LAB_BROWSER}`;
  await mkdir(dir,{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:900},ignoreHTTPSErrors:false,serviceWorkers:'block',clientCertificates:[{origin:shop,...identity},{origin:auth,...identity}],recordVideo:{dir,size:{width:1440,height:900}}});
  const page=await context.newPage();
  const state={widgetIds:['recent-orders'],created:0,apiCalls:0,codeExchanges:0,pkce:false,refreshes:0,blocked:[],violations:[],checkoutKeys:[],fault:scenario.startsWith('checkout-')?scenario:null,oidcExchanges:0};
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  await writeFile(`/state/${runner}-${process.env.LAB_BROWSER}-${scenario}-signer.pem`,privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});
  const signed=claims=>{const input=`${encode({alg:'RS256',typ:'JWT',kid:'browser-ephemeral'})}.${encode(claims)}`;return `${input}.${sign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url')}`;};
  let transaction;
  await context.addInitScript(()=>{
    document.addEventListener('DOMContentLoaded',()=>{const badge=document.createElement('div');badge.textContent='MOCK AUTH · MOCK API · UI CONSUMER EVIDENCE';badge.style.cssText='position:fixed;bottom:8px;right:8px;background:#382700;color:#ffe49b;padding:8px;font:14px Arial;z-index:99999;pointer-events:none';document.body.appendChild(badge);});
  });
  await context.route('**/*',async route=>{
    try{
      const request=route.request(),url=new URL(request.url()),path=url.pathname;
      if(![shop,auth,'https://oidc:8080'].includes(url.origin)){state.blocked.push(url.hostname);await route.abort('blockedbyclient');return;}
      if(url.origin==='https://oidc:8080'){
        if(!scenario.startsWith('oidc-'))throw new Error('Unexpected issuer access');
        if(path.endsWith('/.well-known/openid-configuration')&&state.fault==='discovery'){await route.fulfill({status:503,contentType:'application/json',body:'{"error":"test_outage"}'});return;}
        if(path.endsWith('/authorize')){
          assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.ok(url.searchParams.get('code_challenge'),'PKCE challenge present');
          transaction={challenge:url.searchParams.get('code_challenge'),nonce:url.searchParams.get('nonce')};state.pkce=true;
        }
        if(path.endsWith('/token')){
          const fields=new URLSearchParams(request.postData());assert.equal(fields.get('grant_type'),'authorization_code');
          assert.ok(createHash('sha256').update(fields.get('code_verifier')??'').digest('base64url')===transaction?.challenge,'OIDC consumer sends matching verifier');
          state.oidcExchanges++;
          if(state.fault==='token'){await route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':shop,'access-control-allow-credentials':'true'},body:'{"error":"invalid_grant"}'});return;}
          if(state.fault==='signature'){
            // Explicit fault mutation of a real mock-server response; no real provider involved.
            const response=await route.fetch();const body=await response.json();const parts=body.id_token.split('.');const sig=Buffer.from(parts[2],'base64url');sig[0]^=1;parts[2]=sig.toString('base64url');body.id_token=parts.join('.');
            await route.fulfill({response,body:JSON.stringify(body)});return;
          }
        }
        await route.continue();return;
      }
      if(url.origin===auth){
        if(path.endsWith('/auth')){
          assert.equal(url.searchParams.get('client_id'),'shop-spa');assert.equal(url.searchParams.get('response_type'),'code');assert.equal(url.searchParams.get('redirect_uri'),`${shop}/callback`);assert.equal(url.searchParams.get('code_challenge_method'),'S256');
          transaction={state:url.searchParams.get('state'),nonce:url.searchParams.get('nonce'),challenge:url.searchParams.get('code_challenge'),code:randomUUID()};
          const redirect=new URL(`${shop}/callback`);redirect.searchParams.set('state',scenario==='wrong-state'?randomUUID():transaction.state);
          if(scenario==='auth-denied')redirect.searchParams.set('error','access_denied');else redirect.searchParams.set('code',transaction.code);
          await route.fulfill({status:302,headers:{location:redirect.href}});return;
        }
        if(path.endsWith('/token')){
          const fields=new URLSearchParams(request.postData());
          if(fields.get('grant_type')==='refresh_token'){state.refreshes++;await route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':shop,'access-control-allow-credentials':'true'},body:'{"error":"invalid_grant"}'});return;}
          assert.equal(fields.get('grant_type'),'authorization_code');assert.equal(fields.get('client_id'),'shop-spa');assert.ok(fields.get('code')===transaction?.code,'Expected mock code');
          assert.ok(createHash('sha256').update(fields.get('code_verifier')??'').digest('base64url')===transaction.challenge,'Shop adapter sends S256 verifier matching challenge');state.pkce=true;state.codeExchanges++;
          const now=Math.floor(Date.now()/1000),admin=scenario==='admin';
          const claims={iss:issuer,sub:admin?'synthetic-admin':'synthetic-customer',preferred_username:admin?'synthetic-admin':'synthetic-customer',cert_identity:'synthetic-customer',realm_access:{roles:scenario==='invalid-claims'?[]:[admin?'shop-admin':'customer']},aud:['catalog-api','customer-api','insights-api'],azp:'shop-spa',iat:now,exp:now+120,nonce:transaction.nonce};
          const body={access_token:signed(claims),id_token:signed({...claims,aud:'shop-spa'}),refresh_token:signed({...claims,typ:'Refresh'}),token_type:'Bearer',expires_in:120};
          await writeFile(`/state/${runner}-${process.env.LAB_BROWSER}-${scenario}-tokens.json`,JSON.stringify(body),{mode:0o600});
          await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':shop,'access-control-allow-credentials':'true'},body:JSON.stringify(body)});return;
        }
        if(path.endsWith('/logout')){await route.fulfill({status:302,headers:{location:shop}});return;}
        throw new Error(`Unexpected mock auth path ${path}`);
      }
      if(path.startsWith('/api/')){
        assert.ok(request.headers().authorization?.startsWith('Bearer '),'UI supplies bearer shape to mock');state.apiCalls++;
        const method=request.method(),body=request.postData()?request.postDataJSON():undefined;
        if(path==='/api/customer/orders'&&method==='POST'){
          validateJsonRequest('customer','createOrder',body);assert.ok(request.headers()['idempotency-key'],'Checkout idempotency key supplied');state.checkoutKeys.push(request.headers()['idempotency-key']);
          if(state.fault){
            const fault=state.fault;state.fault=null;
            if(fault==='checkout-delay'){await new Promise(r=>setTimeout(r,11000));await route.abort('timedout').catch(()=>{});return;}
            if(fault==='checkout-malformed'){await route.fulfill({status:201,contentType:'application/json',body:'{ INTENTIONALLY_INVALID_JSON'});return;}
            const status=fault==='checkout-403'?403:503;
            await route.fulfill(checked('customer','createOrder',status,{code:status===403?'forbidden':'dependency_unavailable',message:'Synthetic mock dependency fault'}));return;
          }
        }
        await route.fulfill(apiFixture(path,method,url,state,body));return;
      }
      // Do not allow credentials to reach any unmocked business/auth endpoint.
      await route.continue();
    }catch(error){state.violations.push(error.message.split("Call log:")[0]);await route.abort('blockedbyclient').catch(()=>{});}
  });
  let passed=false;
  try{
    // Actual TLS checks; interception does not establish server trust or mTLS.
    const probe=await context.request.get(`${shop}/harness-audit`);assert.equal(probe.status(),200);
    if(scenario==='refresh-failure')await page.clock.install();
    if(scenario.startsWith('oidc-')){
      state.fault=scenario==='oidc-discovery-failure'?'discovery':scenario==='oidc-token-failure'?'token':scenario==='oidc-signature-failure'?'signature':null;
      await page.goto(`${shop}/oidc-consumer`);await page.getByRole('button',{name:'Begin mock OIDC'}).click();
      if(scenario==='oidc-success')await expect(page.getByRole('status')).toContainText('Verified mock identity: synthetic-client',{timeout:20000});
      else{
        await expect(page.getByRole('status')).toContainText(scenario==='oidc-discovery-failure'?'Mock OIDC dependency failed':'Mock OIDC callback or token rejected',{timeout:20000});
        await expect(page.getByRole('status')).not.toContainText('Verified mock identity');state.fault=null;
        await page.getByRole('button',{name:'Begin mock OIDC'}).click();await expect(page.getByRole('status')).toContainText('Verified mock identity: synthetic-client',{timeout:20000});
      }
      assert.ok(state.pkce,'OIDC browser PKCE emitted');assert.ok(state.oidcExchanges>0,'OIDC authorization code exchanged');assert.equal(state.apiCalls,0);
      const retained=await page.evaluate(()=>Object.values(sessionStorage).some(value=>/eyJ[A-Za-z0-9_-]{30}|verifier/.test(value)));assert.ok(!retained,'OIDC transaction/token not retained after callback');
    }else{
      await page.goto(shop,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Sign in with certificate'}).click();
      if(['auth-denied','wrong-state','invalid-claims'].includes(scenario)){
        await expect(page.getByRole('alert')).toContainText(scenario==='invalid-claims'?'no valid shop identity':scenario==='wrong-state'?'not completed':'could not be completed');
        await expect(page.getByTestId('signed-in-user')).toHaveCount(0);assert.equal(state.apiCalls,0);
        assert.equal(state.codeExchanges,scenario==='invalid-claims'?1:0);
      }else{
        await expect(page.getByTestId('signed-in-user')).toContainText(scenario==='admin'?'synthetic-admin':'synthetic-customer');
        await expect(page.getByTestId('item-card')).toContainText(item.name);assert.ok(state.pkce,'Adapter PKCE checked');
        if(scenario==='refresh-failure'){
          await page.clock.fastForward(121000);await expect(page.getByRole('alert')).toContainText('Your session ended');await expect(page.getByTestId('signed-in-user')).toHaveCount(0);assert.ok(state.refreshes>0);
        }else if(scenario==='admin'){
          await page.getByRole('link',{name:'Admin',exact:true}).click();await expect(page.getByRole('heading',{name:'Shop administration'})).toBeVisible();await expect(page.getByText('Mock Adventurer',{exact:true})).toBeVisible();await expect(page.getByLabel('Regional sales map')).toBeVisible();await expect(page.getByText('1 orders',{exact:false})).toBeVisible();
        }else{
          await expect(page.getByRole('link',{name:'Admin',exact:true})).toHaveCount(0);
          await page.getByTestId('item-card').getByRole('button',{name:'Add to Cart'}).click();await page.getByRole('link',{name:/Cart/}).click();
          await expect(page.getByLabel('Order region')).toHaveValue('waterdeep');
          await page.getByRole('button',{name:'Place simulated order'}).click();
          if(scenario.startsWith('checkout-')){
            await expect(page.getByRole('alert')).toContainText('Your cart is still here',{timeout:14000});await expect(page.getByTestId('cart-item')).toHaveCount(1);await expect(page.getByRole('status').filter({hasText:'created. Total:'})).toHaveCount(0);assert.equal(state.created,0);
            await page.getByRole('button',{name:'Place simulated order'}).click();
          }
          await expect(page.getByRole('status').filter({hasText:'created. Total:'})).toContainText('order-mock-1');await expect(page.getByTestId('cart-empty')).toBeVisible();assert.equal(state.created,1);assert.equal(state.checkoutKeys.length,scenario.startsWith('checkout-')?2:1);
          if(state.checkoutKeys.length===2)assert.ok(state.checkoutKeys[0]===state.checkoutKeys[1],'Manual retry reuses key');
          await page.getByRole('link',{name:'Account',exact:true}).click();await expect(page.getByLabel('Display name')).toHaveValue('Mock Adventurer');await expect(page.getByText('order-mock-1',{exact:true})).toBeVisible();
          if(scenario==='customer'){
            await page.getByRole('checkbox',{name:'Recent orders'}).uncheck();await page.getByRole('button',{name:'Save widgets'}).click();await expect(page.getByText('Widget layout saved.')).toBeVisible();assert.deepEqual(state.widgetIds,[]);
            await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('button',{name:'Sign in with certificate'})).toBeVisible();await expect(page.getByTestId('signed-in-user')).toHaveCount(0);
          }
        }
      }
      const retained=await page.evaluate(()=>[...Object.values(localStorage),...Object.values(sessionStorage)].some(value=>/eyJ[A-Za-z0-9_-]{30}/.test(value)));assert.ok(!retained,'Tokens absent from browser persistent storage');
    }
    assert.deepEqual(state.blocked,[],'No external destinations');assert.deepEqual(state.violations,[],'All mock operation assertions passed');
    const audit=await context.request.get(`${shop}/harness-audit`);assert.deepEqual(await audit.json(),{apiLeaks:0,authLeaks:0},'No auth/API requests escaped interception to static server');
    await page.waitForTimeout(800);passed=true;
  }finally{
    if(!passed)console.log('Safe diagnostic',JSON.stringify({violations:state.violations,body:(await page.locator('body').innerText().catch(()=>''))}));
    await context.close();const video=page.video();await rename(await video.path(),`${dir}/${scenario}.webm`);
    await appendFile(`${dir}/observations.jsonl`,JSON.stringify({evidence:'mock-browser-consumer',runner,browser:process.env.LAB_BROWSER,scenario,passed,apiCalls:state.apiCalls,codeExchanges:state.codeExchanges,pkce:state.pkce,refreshes:state.refreshes,oidcExchanges:state.oidcExchanges,simulatedOrders:state.created})+'\n');
  }
}
