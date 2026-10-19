import {mkdirSync,writeFileSync} from 'node:fs';
import {authentikCaseNames} from '../teaching/provider-matrix.mjs';
export function finishAuthentik(browser,runner,cases){
 if(!['chrome','msedge'].includes(browser)||!['playwright','cucumber'].includes(runner))throw new Error('Unknown authentik selection');
 if(cases.some(c=>!authentikCaseNames.includes(c.name)||!['passed','failed'].includes(c.status)))throw new Error('Unknown authentik result');
 const directory=`/work/artifacts/auth-lessons/${browser}-${runner}`;mkdirSync(directory,{recursive:true});
 writeFileSync(`${directory}/results.json`,JSON.stringify({evidence:'live-authentik-broker',browser,runner,cases},null,2));
 writeFileSync(`${directory}/junit.xml`,`<testsuite name="authentik-${browser}-${runner}" tests="${cases.length}" failures="${cases.filter(c=>c.status!=='passed').length}">${cases.map(c=>`<testcase name="${c.name}">${c.status==='passed'?'':'<failure message="Authentik check failed; raw diagnostics withheld"/>'}</testcase>`).join('')}</testsuite>`);
}
export default class AuthentikReporter{
 cases=[];
 onTestEnd(test,result){const value={name:test.title,status:result.status==='passed'?'passed':'failed'};if(!authentikCaseNames.includes(value.name))throw new Error('Unknown authentik case');this.cases.push(value);console.log(`${process.env.LAB_BROWSER} ${value.name}: ${value.status}`);if(value.status==='failed'){const stage=result.error?.message?.match(/Authentik stage (lesson-open|provider-username|provider-password|provider-submit|lesson-identity|claims|api-denial|provider-rejection|callback-rejection|callback-reached|callback-alert|callback-identity|callback-token|signature-rejection|logout|lifecycle-(?:access-expiry-clears-identity|refresh-preserves-identity|logout-invalidates-refresh|refresh-client-binding|session-expiry-rejects-refresh|group-withdrawal))$/);if(stage)console.log(`Authentik stage: ${stage[1]}`);const match=result.error?.stack?.match(/authentik.mjs:(\d+):(\d+)/);if(match)console.log(`Shared model location ${match[1]}:${match[2]}; raw diagnostics withheld.`);}}
 onError(){console.log('Authentik runner failed; raw diagnostics withheld.');}
 onEnd(){finishAuthentik(process.env.LAB_BROWSER,'playwright',this.cases);}
}
