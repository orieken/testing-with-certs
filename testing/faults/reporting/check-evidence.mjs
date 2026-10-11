import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
function find(report,mode,kind){const matches=report.results.filter(r=>r.evidence[0].kind===kind&&r.evidence[0].mode===mode);assert.equal(matches.length,1);return matches[0].evidence[0];}
function timed(e,bound){assert.equal(e.partial,false);assert.equal(e.recovery,200);assert.equal(e.boundMs,bound);assert.ok(Number.isInteger(e.elapsedMs)&&e.elapsedMs>=0&&e.elapsedMs<bound);}
function failures(report,kind){for(const mode of ['conflict','revision','outage','repeat']){const e=find(report,mode,kind);assert.equal(e.status,['conflict','revision'].includes(mode)?409:503);assert.equal(e.calls,2);assert.equal(e.upstreamAuthorization,true);timed(e,10000);}}
function limits(report){for(const [mode,status,calls]of [['exact',200,100],['over',503,101],['loop',503,101]]){const e=find(report,mode,'sales');assert.equal(e.status,status);assert.equal(e.calls,calls);timed(e,30000);}}
function boundary(report){const e=find(report,'tls-schema','boundary');for(const key of ['verifiedTls','invalidFixtureRejectedByAjv','mokapiDoesNotEnforceScriptResponse'])assert.equal(e[key],true);assert.equal(e.negativeTls,4);assert.equal(e.authorizationNegatives,2);}
export function check(report,digests){
 assert.equal(report.source,'real-insights-scripted-dependency-faults');assert.equal(report.mokapi,'0.52.0');assert.deepEqual(report.specDigests,digests);
 assert.equal(report.results.length,19);assert.equal(new Set(report.results.map(x=>x.name)).size,19);
 for(const r of report.results){assert.equal(r.status,'passed');assert.equal(r.evidence.length,1);}
 for(const kind of ['sales','customers','orders']){failures(report,kind);const e=find(report,'empty',kind);assert.equal(e.status,200);assert.equal(e.calls,3);assert.equal(e.partial,false);}
 limits(report);boundary(report);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){check(JSON.parse(readFileSync(`${process.env.LAB_FAULT_REPORT_DIR}/results.json`)),JSON.parse(readFileSync('/work/contracts/bundled/digests.json')).services);console.log('PASS separate TEST-06/09 evidence gate: 19 real insights/scripted dependency cases; no live-provider coverage credit');}
