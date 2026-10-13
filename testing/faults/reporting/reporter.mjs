import { readFileSync, writeFileSync } from 'node:fs';
function evidence(test,result){
 if(result.status!=='passed')return [];
 return test.annotations.filter(item=>item.type==='reporting-fault').map(item=>JSON.parse(item.description));
}
function location(result){return result.errors[0]?.stack?.match(/reporting.spec.mjs:\d+:\d+/)?.[0]??'infrastructure';}
export default class Reporter{
 results=[];
 onTestEnd(test,result){
  this.results.push({name:test.title,status:result.status,evidence:evidence(test,result)});
  console.log(`${test.title}: ${result.status}`);
  if(result.status!=='passed')console.log('Failure location: '+location(result));
 }
 onError(){console.error('Reporting test failed; raw credential-bearing diagnostics remain in volume');}
 onEnd(){writeFileSync(`${process.env.LAB_FAULT_REPORT_DIR}/results.json`,JSON.stringify({source:'real-insights-scripted-dependency-faults',mokapi:'0.52.0',specDigests:JSON.parse(readFileSync('/work/contracts/bundled/digests.json')).services,results:this.results},null,2));}
}
