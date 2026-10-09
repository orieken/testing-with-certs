import {request,expect} from '@playwright/test';
import {certificates} from './certificates.js';
const context=await request.newContext({timeout:10000,clientCertificates:certificates('customer')});
try{
  for(const origin of ['https://shop.magic.test:8443','https://auth.magic.test:9443']){
    await expect(context.get(origin)).rejects.toThrow(/certificate|issuer|self.signed/i);
  }
}
finally{await context.dispose();}
