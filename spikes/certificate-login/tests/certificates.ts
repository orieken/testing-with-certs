import {createClientCertConfig} from '@orieken/saturday-playwright-certs';
import {shop,auth} from './site.js';
export type Identity='customer'|'admin'|'unknown'|'untrusted'|'collision'|'revocable';
export const certificates=(identity:Identity)=>[shop,auth].map(origin=>createClientCertConfig(origin,'/fixtures',identity));
export const identifiers={customer:'11111111-1111-4111-8111-111111111111',admin:'22222222-2222-4222-8222-222222222222'} as const;
