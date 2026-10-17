import { Formatter } from '@cucumber/cucumber';
import { safeAuthResult, finishAuthReport } from './auth-lessons.mjs';
export default class SamlFormatter extends Formatter {
  constructor(options) {
    super(options);
    options.eventBroadcaster.on('envelope', envelope => {
      if (!envelope.testRunFinished) return;
      const cases = this.eventDataCollector.getTestCaseAttempts().map(attempt => {
        const name = attempt.pickle.steps[0]?.text.match(/^the SAML check "([^"]+)" passes$/)?.[1];
        const result = safeAuthResult(name, attempt.worstTestStepResult.status);
        if (result.status === 'failed') {
          const location = attempt.worstTestStepResult.message?.match(/saml\.mjs:(\d+):(\d+)/);
          if (location) console.log(`Saml check failure at shared model line ${location[1]}:${location[2]}; raw diagnostics withheld.`);
        }
        console.log(`${process.env.LAB_BROWSER} cucumber ${result.name}: ${result.status}`);
        return result;
      });
      finishAuthReport(process.env.LAB_BROWSER, 'saml-cucumber', cases);
    });
  }
}
