import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export const scenarios=['catalog-populated','catalog-empty','catalog-wrong-type','checkout-409','checkout-422','checkout-503','checkout-403','checkout-malformed-json','checkout-oversized','checkout-delay','checkout-disconnect'];
function checkCheckout(row){
  assert.equal(row.deliveredMockOrders,1);assert.equal(row.checkoutRequests,2);assert.equal(row.sameKeyReplay,true);assert.equal(row.injectedFaults,1);
  if(row.scenario==='checkout-delay')assert.ok(row.faultElapsedMs>=9500&&row.faultElapsedMs<14000);
  if(/^checkout-(403|409|422|503)$/.test(row.scenario))assert.ok(row.observedStatuses.includes(Number(row.scenario.slice(9))));
}
function checkRow(row,runner,browser) {
  assert.equal(row.runner,runner);assert.equal(row.browser,browser);
  assert.equal(row.evidence,'prism-mock-browser-consumer');assert.equal(row.passed,true);assert.equal(row.pkce,true);assert.equal(row.noLeaks,true);assert.ok(row.prismCalls>0);
  if(row.scenario.startsWith('checkout-'))checkCheckout(row);
  else assert.equal(row.deliveredMockOrders,0);
  if(row.scenario==='catalog-wrong-type')assert.equal(row.injectedFaults,1);
}
export function checkSelection(rows,runner,browser,hasVideo) {
  assert.equal(rows.length,scenarios.length);
  for(const scenario of scenarios){
    const matches=rows.filter(row=>row.scenario===scenario);assert.equal(matches.length,1);
    checkRow(matches[0],runner,browser);assert.equal(hasVideo(scenario),true);
  }
  return rows;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const observed=[];
  for(const runner of ['playwright','cucumber'])for(const browser of ['chrome','msedge']){
    const dir=`/reports/${runner}-${browser}`;
    const rows=readFileSync(`${dir}/observations.jsonl`,'utf8').trim().split('\n').map(JSON.parse);
    observed.push(...checkSelection(rows,runner,browser,scenario=>existsSync(`${dir}/${scenario}.webm`)));
  }
  writeFileSync('/reports/browser-evidence.json',JSON.stringify({schemaVersion:1,source:'prism-mock-browser-consumer',cases:observed.length,specDigests:JSON.parse(readFileSync('/work/contracts/bundled/digests.json')).services,results:observed},null,2)+'\n');
  console.log('PASS: separate TEST-07 Prism consumer gate: 44 actual Chrome/Edge Playwright/Cucumber cases with videos; no live-provider coverage claim');
}
