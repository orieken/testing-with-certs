#!/bin/sh
set -eu
case "$LAB_BROWSER" in chrome) policy=/etc/opt/chrome/policies/managed/spike.json;; msedge) policy=/etc/opt/edge/policies/managed/spike.json;; *) exit 2;; esac
pk12util -i /identity/identity.p12 -d "sql:$HOME/.local/share/pki/nssdb" -w /identity/password
export POLICY_PATH="$policy"
node --input-type=module <<'NODE'
import {X509Certificate} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const cert=new X509Certificate(readFileSync('/identity/cert.pem'));
const subject=cert.subject.replace(/^CN=/,'');
const patterns=['https://shop.magic.test:8443','https://auth.magic.test:9443'];
const entries=patterns.map(pattern=>JSON.stringify({pattern,filter:{ISSUER:{CN:'Spike user CA'},SUBJECT:{CN:subject}}}));
writeFileSync(process.env.POLICY_PATH,JSON.stringify({AutoSelectCertificateForUrls:entries,BrowserSignin:0}));
NODE
