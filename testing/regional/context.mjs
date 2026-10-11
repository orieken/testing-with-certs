import { request } from '@playwright/test';
import { userToken } from '../api/contracts/user-token.ts';
export const shop='https://shop.magic.test:8443',auth='https://auth.magic.test:9443';
export async function context(identity){const certificate={certificatePath:`/${identity}/cert.pem`,privateKeyPath:`/${identity}/key.pem`};return request.newContext({baseURL:shop,ignoreHTTPSErrors:false,timeout:10000,clientCertificates:[{origin:shop,certPath:certificate.certificatePath,keyPath:certificate.privateKeyPath}],extraHTTPHeaders:{Authorization:`Bearer ${await userToken(certificate)}`}});}
