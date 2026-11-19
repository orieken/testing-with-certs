import {Formatter} from '@cucumber/cucumber';
import {finishAuthentik,safeAuthentikStage} from './authentik.mjs';
export default class AuthentikFormatter extends Formatter{
 constructor(options){super(options);options.eventBroadcaster.on('envelope',e=>{if(!e.testRunFinished)return;const attempts=this.eventDataCollector.getTestCaseAttempts();const cases=attempts.map(a=>({name:a.pickle.steps[0]?.text.match(/^the authentik check "([^"]+)" passes$/)?.[1],status:a.worstTestStepResult.status==='PASSED'?'passed':'failed'}));finishAuthentik(process.env.LAB_BROWSER,'cucumber',cases);for(const [i,c] of cases.entries()){console.log(`${process.env.LAB_BROWSER} cucumber ${c.name}: ${c.status}`);if(c.status==='failed'){const stage=safeAuthentikStage(attempts[i].worstTestStepResult.message);if(stage)console.log(`Authentik stage: ${stage}`);}}});}
}
