import {test,expect} from '@playwright/test';
import {request} from 'playwright';
import {certificates} from './certificates.js';
import {shop,auth} from './site.js';
for(const origin of [shop,auth]){
  test(`prompt01 TRUST-01 validated TLS at ${origin}`,async()=>{
    const context=await request.newContext({clientCertificates:certificates('customer'),timeout:10000,ignoreHTTPSErrors:false});
    try {
      const response=await context.get(origin===shop?origin:`${auth}/realms/magic-shop/.well-known/openid-configuration`);
      expect(response.ok()).toBe(true);
      if(origin===auth)expect((await response.json()).issuer).toBe(`${auth}/realms/magic-shop`);
    }finally{await context.dispose();}
  });
}
for(const identity of ['untrusted','collision'] as const){
  test(`prompt01 AUTH-04 raw TLS refuses ${identity}`,async()=>{
    const context=await request.newContext({clientCertificates:certificates(identity),timeout:10000});
    try{await expect(context.get(shop)).rejects.toThrow(/certificate|alert|socket|ECONNRESET/i);}
    finally{await context.dispose();}
  });
}
test('prompt01 AUTH-07 dedicated certificate lifecycle',async()=>{
  const context=await request.newContext({clientCertificates:certificates('revocable'),timeout:10000});
  try{
    if(process.env.EXPECT_REVOKED==='true')await expect(context.get(shop)).rejects.toThrow(/certificate|alert|socket|ECONNRESET/i);
    else expect((await context.get(shop)).ok()).toBe(true);
  }finally{await context.dispose();}
});
