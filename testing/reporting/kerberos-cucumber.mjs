import { Formatter } from '@cucumber/cucumber';
import { safeAuthResult, finishAuthReport } from './auth-lessons.mjs';
export default class KerberosFormatter extends Formatter {
  constructor(options) {
    super(options);
    options.eventBroadcaster.on('envelope', envelope => {
      if (!envelope.testRunFinished) return;
      const cases = this.eventDataCollector.getTestCaseAttempts().map(attempt => {
        const name = attempt.pickle.steps[0]?.text.match(/^the Kerberos check "([^"]+)" passes$/)?.[1];
        const result = safeAuthResult(name, attempt.worstTestStepResult.status);
        if (result.status === 'failed') {
          const location = attempt.worstTestStepResult.message?.match(/kerberos(?:-session)?\.mjs:(\d+):(\d+)/);
          if (location) console.log(`Kerberos check failure at shared model line ${location[1]}:${location[2]}; raw diagnostics withheld.`);
        }
        console.log(`${process.env.LAB_BROWSER} cucumber ${result.name}: ${result.status}`);
        return result;
      });
      finishAuthReport(process.env.LAB_BROWSER, process.env.LAB_AUTH_SUITE === 'kerberos-lifecycle' ? 'kerberos-lifecycle-cucumber' : process.env.LAB_KERBEROS_DISABLED === '1' ? 'kerberos-cucumber-disabled' : 'kerberos-cucumber', cases);
    });
  }
}
