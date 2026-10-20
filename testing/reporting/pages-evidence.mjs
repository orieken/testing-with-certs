import assert from 'node:assert/strict';
import{readdirSync,lstatSync,readFileSync,writeFileSync,mkdirSync,copyFileSync}from'node:fs';
import{resolve,join,relative,dirname,extname}from'node:path';
import{pathToFileURL}from'node:url';
import{scanArtifacts}from'../container/check-artifacts.mjs';
export const fullJobNames=['workspace checks','spike checks','catalog-api build','insights-api build','Compose configuration','Native Go operator tests','Complete recorded browser matrix (debian)','Complete recorded browser matrix (ubi9)','Isolated contracts, security and real-browser suites','Native certificate and password teaching matrix','Contract-derived mock consumers (Prism)','Dependency faults (checkout)','Dependency faults (reporting)','Dependency faults (idempotency)','Real-provider regional boundaries','Password and OTP in Chrome/Edge and both runners','All authentication protocols in both runners','Authentik OIDC and SAML in both runners','Require independent live, consumer and fault gates'];
export function verifyFullRun(run){
 assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');assert.equal(run.event,'workflow_dispatch');assert.match(run.headSha,/^[a-f0-9]{40}$/);assert.ok(Number.isSafeInteger(run.databaseId));
 assert.equal(run.url,`https://github.com/orieken/testing-with-certs/actions/runs/${run.databaseId}`);
 assert.deepEqual(run.jobs.map(j=>j.name).sort(),[...fullJobNames].sort());
 for(const job of run.jobs){assert.equal(job.status,'completed');assert.equal(job.conclusion,'success');}
 return {evidence:'verified-full-native-test-run',sourceCommit:run.headSha,runId:run.databaseId,runUrl:run.url,jobs:run.jobs.map(j=>({name:j.name,status:j.conclusion,url:j.url})),deferred:['external-account providers','physical authenticators and manual-only desktop checks']};
}
function walk(root){return readdirSync(root).flatMap(name=>{const path=join(root,name),stat=lstatSync(path);assert.ok(!stat.isSymbolicLink(),'Site/evidence symlink');return stat.isDirectory()?walk(path):[path];});}
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
export async function finalizePages(site,evidence,run){
 const provenance=verifyFullRun(run);site=resolve(site);evidence=resolve(evidence);
 const allowed=new Set(['junit.xml','results.json','environment.json','cleanup.txt','lifecycle-cleanup.txt','matrix-cleanup.txt','contract-coverage.json','coverage.json','browser-evidence.json','evidence.json']);
 const entries=[];
 for(const file of walk(evidence)){
  if(!allowed.has(file.split('/').at(-1)))continue;
  const path=join('evidence',relative(evidence,file));const target=join(site,path);mkdirSync(dirname(target),{recursive:true});copyFileSync(file,target);entries.push(path);
 }
 provenance.evidenceFiles=entries.length;
 writeFileSync(join(site,'test-run.json'),JSON.stringify(provenance,null,2)+'\n');
 const links=entries.map(path=>`<li><a href="../${path.split('/').map(encodeURIComponent).join('/')}">${escape(path)}</a></li>`).join('\n');
 mkdirSync(join(site,'evidence'),{recursive:true});
 writeFileSync(join(site,'evidence/index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><title>Test evidence</title><style>body{font:16px system-ui;max-width:1000px;margin:40px auto;padding:20px;line-height:1.6}a{color:#245fbc}</style><h1>Verified native test evidence</h1><p><a href="../index.html">Video matrix</a> · <a href="../test-run.json">Run provenance and job results</a></p><p>All 19 required jobs passed. This publication contains fresh automated evidence; external-account and manual-only scenarios remain deferred.</p><ul>${links}</ul></html>`);
 for(const name of ['index.html','matrix.html']){
  const path=join(site,name);let html=readFileSync(path,'utf8');html=html.replace('<body>','<body><nav style="padding:12px 24px;background:#14213b;color:white"><a style="color:white" href="evidence/index.html">Test evidence and CI provenance ↗</a></nav>');writeFileSync(path,html);
 }
 return checkPages(site);
}
export async function checkPages(site,expectedSelections=92){
 site=resolve(site);const files=walk(site);let bytes=0;
 for(const file of files){const stat=lstatSync(file);assert.ok(stat.isFile());assert.ok(stat.size<=95_000_000,'Oversized Pages file');bytes+=stat.size;assert.ok(['.html','.json','.md','.webm','.mp4','.xml','.txt',''].includes(extname(file)),'Unapproved Pages file type');}
 assert.ok(bytes<950_000_000,'Pages site exceeds budget');
 const matrix=JSON.parse(readFileSync(join(site,'matrix.json')));assert.equal(matrix.status,'passed');assert.equal(matrix.rows.length,expectedSelections);assert.ok(matrix.rows.every(r=>r.status==='passed'));
 const videos=files.filter(p=>/\.(webm|mp4)$/.test(p));assert.equal(videos.length,matrix.rows.reduce((n,r)=>n+r.video_count,0));
 for(const file of files.filter(p=>p.endsWith('.html'))){
  const html=readFileSync(file,'utf8');assert.ok(!html.includes('/Users/')&&!html.includes('/work/artifacts/'),'Private absolute path');
  for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
   const value=match[1];if(/^(https:|data:|blob:|#)/.test(value))continue;
   const target=resolve(dirname(file),decodeURIComponent(value.split('#')[0]));const rel=relative(site,target);assert.ok(rel&&!rel.startsWith('..'),'Public link escapes site');assert.ok(lstatSync(target).isFile(),'Missing public file');
  }
 }
 const scanned=await scanArtifacts(site,{requireMountedPath:false});return {selections:matrix.rows.length,videos:videos.length,bytes,scanned};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv[2]==='finalize')console.log(await finalizePages(process.argv[3],process.argv[4],JSON.parse(readFileSync(process.argv[5]))));
 else if(process.argv[2]==='check')console.log(await checkPages(process.argv[3]));
 else throw Error('Usage: pages-evidence.mjs finalize SITE EVIDENCE RUN.json | check SITE');
}
