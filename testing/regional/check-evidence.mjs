import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export const scenarios=['november-pages','moved-profile','empty-region','september-oracle'];
function selected(provider,mode){const rows=provider.results.filter(r=>r.evidence[0].mode===mode);assert.equal(rows.length,1);return rows[0].evidence[0];}
function providerCases(provider){
 const utc=selected(provider,'utc-boundaries');assert.equal(utc.orderCount,110);assert.equal(utc.salesCopper,11100);
 const moved=selected(provider,'moved-profile');assert.equal(moved.historicalRegion,'waterdeep');assert.equal(moved.currentRegion,'baldurs-gate');assert.equal(moved.pages,2);
 const pages=selected(provider,'pagination');assert.equal(pages.pages,7);assert.equal(pages.orderCount,110);assert.equal(pages.salesCopper,11100);
 const feed=selected(provider,'reporting-feed');assert.equal(feed.pages,2);assert.equal(feed.orderCount,110);assert.equal(feed.revisionPinned,true);
 const seed=selected(provider,'seed-empty');assert.equal(seed.septemberCopper,124000);assert.equal(seed.emptyCopper,0);
 const gap=selected(provider,'mixed-precision-limitation');assert.equal(gap.status,503);assert.equal(gap.supported,false);
}
function browserCase(row,videoExists){
 assert.equal(row.source,'live-regional-ui');assert.equal(row.passed,true);assert.equal(row.verifiedTls,true);assert.equal(row.mockAuth,false);assert.equal(row.mockApi,false);assert.equal(row.externalRequests,0);assert.ok(row.validatedResponses>0);assert.ok(videoExists(row.video));
}
function selection(browsers,browser,runner,videoExists){for(const scenario of scenarios){const rows=browsers.filter(r=>r.browser===browser&&r.runner===runner&&r.scenario===scenario);assert.equal(rows.length,1);browserCase(rows[0],videoExists);}}
export function check(provider,browsers,digests,videoExists){
 assert.equal(provider.source,'live-regional-provider');assert.deepEqual(provider.specDigests,digests);assert.equal(provider.results.length,6);assert.equal(new Set(provider.results.map(r=>r.name)).size,6);
 for(const r of provider.results){assert.equal(r.status,'passed');assert.equal(r.evidence.length,1);}providerCases(provider);
 assert.equal(browsers.length,16);for(const browser of ['chrome','msedge'])for(const runner of ['playwright','cucumber'])selection(browsers,browser,runner,videoExists);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const dir=process.env.LAB_REGIONAL_REPORT_DIR;check(JSON.parse(readFileSync(`${dir}/provider.json`)),readFileSync(`${dir}/browser.jsonl`,'utf8').trim().split('\n').map(line=>JSON.parse(line)),JSON.parse(readFileSync('/work/contracts/bundled/digests.json')).services,path=>existsSync(`${dir}/${path}`));console.log('PASS TEST-10 gate: five live provider boundaries, one known limitation and 16 recorded Chrome/Edge Playwright/Cucumber journeys');}
