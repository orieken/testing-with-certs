import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
function run(options={}) {
  const root=mkdtempSync(join(tmpdir(),'otp-runner-'));
  try {
    mkdirSync(join(root,'testing'));mkdirSync(join(root,'bin'));
    writeFileSync(join(root,'testing/run-password-otp.sh'),readFileSync(new URL('./run-password-otp.sh',import.meta.url)));
    writeFileSync(join(root,'lab'),'#!/bin/sh\necho startup >> "$PROBE_ROOT/calls"\n',{mode:0o755});
    writeFileSync(join(root,'bin/docker'),`#!/bin/sh
echo "$*" >> "$PROBE_ROOT/calls"
case "$*" in
  "ps -aq "*|"volume ls -q "*|"network ls -q "*) if [ "\${PROBE_EXISTING:-0}" = 1 ]; then echo existing; fi;;
  *"cucumber-js"*) exit "\${PROBE_FAILURE:-0}";;
esac
`,{mode:0o755});
    const result=spawnSync('/bin/sh',[join(root,'testing/run-password-otp.sh')],{encoding:'utf8',timeout:10000,
      env:{...process.env,PATH:`${root}/bin:/usr/bin:/bin`,LAB_PROJECT:'magic-shop-otp-probe',PROBE_ROOT:root,...options}});
    return {status:result.status,calls:existsSync(join(root,'calls'))?readFileSync(join(root,'calls'),'utf8'):''};
  } finally {rmSync(root,{recursive:true,force:true});}
}
test('existing OTP resources are refused without startup or teardown',()=>{
  const result=run({PROBE_EXISTING:'1'});assert.equal(result.status,1);
  assert.doesNotMatch(result.calls,/startup|down|fixture/);
});
test('Cucumber failure preserves status, skips later selections, and cleans the disposable OTP project',()=>{
  const result=run({PROBE_FAILURE:'17'});assert.equal(result.status,17);
  assert.match(result.calls,/cucumber-js/);assert.match(result.calls,/otp-fixture finish/);assert.match(result.calls,/otp-fixture verify/);
  assert.match(result.calls,/--profile \* down --volumes --remove-orphans/);assert.doesNotMatch(result.calls,/LAB_BROWSER=msedge/);
});
