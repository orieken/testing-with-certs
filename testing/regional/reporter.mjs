import { readFileSync,writeFileSync } from 'node:fs';
function evidence(test,result){if(result.status!=='passed')return [];return test.annotations.filter(a=>a.type==='regional').map(a=>JSON.parse(a.description));}
function location(result){return result.errors[0]?.stack?.match(/provider.spec.mjs:\d+:\d+/)?.[0]??'infrastructure failure';}
export default class Reporter{
 results=[];
 onTestEnd(test,result){this.results.push({name:test.title,status:result.status,evidence:evidence(test,result)});console.log(`${test.title}: ${result.status}`);if(result.status!=='passed')console.log(location(result));}
 onEnd(){writeFileSync(`${process.env.LAB_REGIONAL_REPORT_DIR}/provider.json`,JSON.stringify({source:'live-regional-provider',specDigests:JSON.parse(readFileSync('/work/contracts/bundled/digests.json')).services,results:this.results},null,2));}
}
