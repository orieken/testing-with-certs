import {Formatter} from '@cucumber/cucumber';
import {finishAuthentik} from './authentik.mjs';
export default class AuthentikFormatter extends Formatter{
 constructor(options){super(options);options.eventBroadcaster.on('envelope',e=>{if(!e.testRunFinished)return;const cases=this.eventDataCollector.getTestCaseAttempts().map(a=>({name:a.pickle.steps[0]?.text.match(/^the authentik check "([^"]+)" passes$/)?.[1],status:a.worstTestStepResult.status==='PASSED'?'passed':'failed'}));finishAuthentik(process.env.LAB_BROWSER,'cucumber',cases);for(const c of cases)console.log(`${process.env.LAB_BROWSER} cucumber ${c.name}: ${c.status}`);});}
}
