import assert from 'node:assert/strict';
import{readdirSync,readFileSync,realpathSync}from'node:fs';
import{resolve,join,relative}from'node:path';
import{pathToFileURL}from'node:url';
export function checkBrowserMatrix(root,os){
 assert.ok(['debian','ubi9'].includes(os));root=realpathSync(root);
 const paths=readdirSync(join(root,'matrix')).map(name=>join(root,'matrix',name,'matrix.json'));
 assert.equal(paths.length,1,'One fresh matrix expected');
 const manifest=JSON.parse(readFileSync(paths[0]));assert.equal(manifest.status,'passed');assert.equal(manifest.passed,14);assert.equal(manifest.failed,0);assert.equal(manifest.rows.length,14);
 const examples=['playwright|customer-waterdeep|teaching','playwright|shop-admin|teaching','playwright|shopkeeper|teaching','cucumber|customer-waterdeep|teaching','cucumber|shop-admin|teaching','playwright|customer-waterdeep|recorded','playwright|shop-admin|recorded'];
 const expected=new Set(['chrome','msedge'].flatMap(browser=>examples.map(e=>`${browser}|${e}`)));
 for(const row of manifest.rows){
  assert.equal(row.os,os);assert.equal(row.status,'passed');assert.ok(row.video_count>0);
  const key=[row.browser,row.runner,row.user,row.suite].join('|');assert.ok(expected.delete(key),'Unknown/duplicate browser selection');
  const report=realpathSync(resolve(paths[0],'..',row.report));const rel=relative(root,report);assert.ok(rel&&!rel.startsWith('..'),'Report escapes artifact root');
  const environment=JSON.parse(readFileSync(join(report,'environment.json')));assert.equal(environment.os,os);assert.equal(environment.browser,row.browser);assert.equal(environment.architecture,'x64');assert.ok(environment.browserVersion);
 }
 assert.equal(expected.size,0);return {selections:14,manifest:paths[0]};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(checkBrowserMatrix(process.argv[2],process.argv[3]));
