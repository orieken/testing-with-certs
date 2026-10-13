import { Formatter } from '@cucumber/cucumber';
import { safeResult, finishReport } from './password-results.mjs';
export default class PasswordFormatter extends Formatter {
  constructor(options) {
    super(options);
    options.eventBroadcaster.on('envelope', envelope => {
      if (!envelope.testRunFinished) return;
      const cases = this.eventDataCollector.getTestCaseAttempts().map(attempt => {
        const text = attempt.pickle.steps[0].text;
        const kind = text.match(/check "([a-z-]+)" passes$/)?.[1];
        return safeResult(kind, attempt.worstTestStepResult.status);
      });
      finishReport('cucumber', cases);
    });
  }
}
