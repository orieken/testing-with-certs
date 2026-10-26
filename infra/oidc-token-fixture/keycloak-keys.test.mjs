import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { keycloakKeyAction, restoreOwnedKeycloakKey } from './keycloak-keys.mjs';
function fixture() {
  const components=[], removed=[], state={active:'original-key',partial:false};
  async function admin(method,path,body) {
    if(path==='/keys')return {active:{RS256:state.active},keys:[{kid:'original-key'},...components.map(c=>({kid:c.id}))]};
    if(path==='')return {id:'owned-realm'};
    if(path.startsWith('/components?'))return structuredClone(components);
    if(method==='POST'&&path==='/components') {
      assert.equal(body.parentId,'owned-realm');assert.equal(body.config.priority[0],'20000');
      const value={...body,id:'new-key'};components.push(value);state.active=value.id;
      if(state.partial)throw new Error('Interrupted create response');return;
    }
    if(method==='DELETE') {
      const id=path.split('/').at(-1);removed.push(id);components.splice(components.findIndex(c=>c.id===id),1);state.active='original-key';return;
    }
    throw new Error('Unexpected administration request');
  }
  return {admin,components,removed,state};
}
async function withDirectory(run) {
  const directory=mkdtempSync(join(tmpdir(),'native-oidc-keys-'));
  try {await run(directory);}finally{rmSync(directory,{recursive:true,force:true});}
}
test('native Keycloak rotation journals ownership, preserves old publication and restores the exact original key',async()=>withDirectory(async directory=>{
 const f=fixture();await keycloakKeyAction(f.admin,directory,'start','owner-a');
 assert.equal(statSync(join(directory,'native-key-state.json')).mode&0o777,0o600);
 assert.deepEqual(await keycloakKeyAction(f.admin,directory,'rotate','owner-a'),{idle:false,rotated:true,originalPublished:true,activePublished:true});
 for(const action of ['start','rotate','status','restore'])await assert.rejects(()=>keycloakKeyAction(f.admin,directory,action,'owner-b'));
 await assert.rejects(()=>keycloakKeyAction(f.admin,directory,'verify'));
 assert.deepEqual(await keycloakKeyAction(f.admin,directory,'restore','owner-a'),{idle:true,restored:true});
 assert.deepEqual(f.removed,['new-key']);assert.equal(f.state.active,'original-key');assert.ok(!existsSync(join(directory,'native-key-state.json')));
}));
test('cleanup recovers a key created before a failed administration response without adopting other components',async()=>withDirectory(async directory=>{
 const f=fixture();await keycloakKeyAction(f.admin,directory,'start','owner-a');f.state.partial=true;
 await assert.rejects(()=>keycloakKeyAction(f.admin,directory,'rotate','owner-a'));
 assert.deepEqual(await restoreOwnedKeycloakKey(f.admin,directory),{idle:true,restored:true});
 assert.deepEqual(f.removed,['new-key']);assert.deepEqual(await restoreOwnedKeycloakKey(f.admin,directory),{idle:true,restored:true});
}));
test('restoration refuses key-ownership drift and keeps its journal for recovery',async()=>withDirectory(async directory=>{
 const f=fixture();await keycloakKeyAction(f.admin,directory,'start','owner-a');await keycloakKeyAction(f.admin,directory,'rotate','owner-a');
 f.components[0].providerId='unrelated-provider';await assert.rejects(()=>restoreOwnedKeycloakKey(f.admin,directory));
 assert.deepEqual(f.removed,[]);assert.ok(existsSync(join(directory,'native-key-state.json')));
}));
test('native setup refuses pre-existing rotation components and an unexpected active baseline key',async()=>withDirectory(async directory=>{
 const f=fixture();f.components.push({name:'oidc-native-rotation-unowned',id:'unowned'});
 await assert.rejects(()=>keycloakKeyAction(f.admin,directory,'start','owner-a'));f.components.length=0;
 await keycloakKeyAction(f.admin,directory,'start','owner-a');await restoreOwnedKeycloakKey(f.admin,directory);f.state.active='unrelated-key';
 await assert.rejects(()=>keycloakKeyAction(f.admin,directory,'start','owner-a'));assert.deepEqual(f.removed,[]);
}));
