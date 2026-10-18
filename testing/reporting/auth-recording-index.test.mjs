import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { indexAuthRecordings } from './auth-recording-index.mjs';
import { checks } from './password-results.mjs';
test('recording gate requires every exact case and verified nonempty file', () => {
 const root = mkdtempSync(join(tmpdir(), 'recording-gate-'));
 try {
  for (const browser of ['chrome','msedge']) for (const runner of ['playwright','cucumber']) {
   const directory=join(root,`${browser}-${runner}`);mkdirSync(directory);
   writeFileSync(join(directory,'results.json'),JSON.stringify({evidence:'live-certificate-password',browser,runner,cases:checks.map(kind=>({kind,status:'passed'}))}));
   for (const name of checks) {
    const path=join(root,'recordings',`${browser}-${runner}-baseline`,'certificate-password',name);mkdirSync(path,{recursive:true});
    writeFileSync(join(path,'page-1.webm'),'synthetic video fixture');
    writeFileSync(join(path,'recording.json'),JSON.stringify({evidence:'live-authentication-recording',auth_type:'certificate-password',name,browser,runner,phase:'baseline',status:'passed',spec:'teaching/certificate-password.mjs',privacy:'provider-document-hidden-before-paint',videos:[`${path.slice(root.length+1)}/page-1.webm`]}));
   }
  }
  assert.deepEqual(indexAuthRecordings('certificate-password',root),{cases:36,videos:36,selections:4});
  const file=join(root,'recordings/chrome-playwright-baseline/certificate-password/success/page-1.webm');
  writeFileSync(file,'');assert.throws(()=>indexAuthRecordings('certificate-password',root));
 } finally {rmSync(root,{recursive:true,force:true});}
});
