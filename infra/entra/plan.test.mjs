import {test} from 'node:test';
import assert from 'node:assert/strict';
import {entraPlan} from './plan.mjs';
const tenant='12345678-1234-4321-ABCD-123456789ABC';
test('Entra plan confines OIDC and SAML to one explicit tenant and separate broker boundaries',()=>{
 const p=entraPlan(tenant);
 assert.equal(p.oidc.issuer,'https://login.microsoftonline.com/12345678-1234-4321-abcd-123456789abc/v2.0');
 assert.equal(p.oidc.signInAudience,'AzureADMyOrg');
 assert.equal(p.saml.issuer,'https://sts.windows.net/12345678-1234-4321-abcd-123456789abc/');
 assert.equal(p.acceptance,'pending-live-tenant');
 for(const [index,protocol] of ['oidc','saml'].entries()){
  const l=p.lessons[index];assert.equal(l.brokerCallback,`https://shop.magic.test:9643/realms/lesson-entra-${protocol}/broker/entra-${protocol}/endpoint`);
  assert.equal(l.callback,`https://shop.magic.test:8543/teaching/entra-${protocol}/callback`);
  assert.equal(l.audience,`entra-${protocol}-lesson`);
 }
 assert.notEqual(p.lessons[0].brokerEntityId,p.lessons[1].brokerEntityId);
});
test('planning rejects shared authorities, URLs, missing identifiers, and injected endpoint fragments',()=>{
 for(const input of [undefined,null,{},'', 'common','organizations','consumers','contoso.onmicrosoft.com','https://login.microsoftonline.com/common',tenant+'/oauth2',tenant+'?x=1','00000000-0000-0000-0000-000000000000'])assert.throws(()=>entraPlan(input));
});
