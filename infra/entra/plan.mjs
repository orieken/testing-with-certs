import {pathToFileURL} from 'node:url';

// Planning only: this module never authenticates, fetches, or provisions resources.
export function entraPlan(tenantId){
 if(typeof tenantId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)||/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(tenantId))throw new Error('A nonzero dedicated tenant GUID is required');
 const tenant=tenantId.toLowerCase(),authority=`https://login.microsoftonline.com/${tenant}`;
 const lessons=['oidc','saml'].map(protocol=>{
  const id=`entra-${protocol}`,realm=`lesson-${id}`,broker=`https://shop.magic.test:9643/realms/${realm}`;
  return {protocol,realm,clientId:`${id}-spa`,audience:`${id}-lesson`,lesson:`https://shop.magic.test:8543/teaching/${id}`,callback:`https://shop.magic.test:8543/teaching/${id}/callback`,brokerCallback:`${broker}/broker/${id}/endpoint`,brokerEntityId:broker};
 });
 return {status:'planned-not-provisioned',tenant,cloud:'AzurePublic',topology:'Entra → Keycloak → app',oidc:{signInAudience:'AzureADMyOrg',issuer:`${authority}/v2.0`,discovery:`${authority}/v2.0/.well-known/openid-configuration`,scopes:['openid','profile','email'],flow:'authorization-code-with-PKCE',clientType:'confidential-web-broker'},saml:{issuer:`https://sts.windows.net/${tenant}/`,metadata:'Obtain the application-specific federation metadata URL from the owned enterprise application',requireSignedAssertions:true,requireExactRecipient:true},lessons,acceptance:'pending-live-tenant'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(entraPlan(process.argv[2]),null,2));}
 catch{console.error('Usage: node infra/entra/plan.mjs <dedicated-tenant-guid>');process.exitCode=2;}
}
