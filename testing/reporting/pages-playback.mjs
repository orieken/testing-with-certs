import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
import{chromium}from'@playwright/test';
import{pagesURL,waitForPublication}from'./pages-release.mjs';
const matrix=JSON.parse(readFileSync(process.argv[2]));
const expected={runId:Number(process.env.GITHUB_RUN_ID),sourceCommit:process.env.GITHUB_SHA,publicationAttempt:Number(process.env.GITHUB_RUN_ATTEMPT)};
await waitForPublication(expected);
for(const channel of ['chrome','msedge']){
 const browser=await chromium.launch({channel,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const key=`${expected.runId}-${expected.publicationAttempt}`;
  const provenance=await page.request.get(`${pagesURL}test-run.json?verify=${key}`);assert.equal(provenance.status(),200);
  const actual=await provenance.json();for(const [name,value]of Object.entries(expected))assert.equal(actual[name],value);
  const response=await page.goto(`${pagesURL}?verify=${key}`,{waitUntil:'domcontentloaded',timeout:60000});assert.equal(response.status(),200);
  assert.equal(await page.locator('.selection').count(),matrix.rows.length);
  const videos=matrix.rows.reduce((n,r)=>n+r.video_count,0);assert.equal(await page.locator('.video-card').count(),videos);
  await page.locator('#auth').selectOption('saml');assert.ok(await page.locator('.selection:not([hidden])').count()>0);
  assert.equal(await page.locator('.selection:not([hidden]):not([data-auth="saml"])').count(),0);await page.locator('#auth').selectOption('');
  const rfcRows=matrix.rows.filter(row=>row.suite==='rfc8705-baseline');
  assert.deepEqual(rfcRows.map(row=>row.browser).sort(),['chrome','msedge']);
  const rfcSections=page.locator('.selection').filter({hasText:'rfc8705-baseline'});assert.equal(await rfcSections.count(),2);
  const clips=await rfcSections.locator('video').all();assert.equal(clips.length,rfcRows.reduce((n,row)=>n+row.video_count,0));
  for(const video of [page.locator('.video-card video').first(),...clips]){
  const played=await video.evaluate(async el=>{el.muted=true;el.load();await el.play();await new Promise((resolve,reject)=>{const deadline=setTimeout(()=>reject(Error('Video did not advance')),20000);const check=()=>{if(el.currentTime>0.1){clearTimeout(deadline);resolve();}else setTimeout(check,100);};check();});return {time:el.currentTime,src:el.currentSrc};});
  assert.ok(played.time>0.1);assert.ok(played.src.includes(`/reports/${matrix.id}/`));}
  assert.equal(errors.length,0);
  console.log(JSON.stringify({channel,version:browser.version(),...expected,selections:matrix.rows.length,videos,authFilter:'passed',rfc8705ClipsPlayed:clips.length,playback:'passed',pageErrors:errors.length}));
 }finally{await browser.close();}
}
