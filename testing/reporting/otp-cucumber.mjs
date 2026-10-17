import { Formatter } from '@cucumber/cucumber';
import { safeOtpResult, finishOtpReport } from './otp-results.mjs';
export default class OtpFormatter extends Formatter {
  constructor(options) {
    super(options);
    options.eventBroadcaster.on('envelope', envelope => {
      if (!envelope.testRunFinished) return;
      const cases = this.eventDataCollector.getTestCaseAttempts().map(attempt => {
        const name = attempt.pickle.steps[0]?.text.match(/^the password and authenticator check "([^"]+)" passes$/)?.[1];
        const result = safeOtpResult(name, attempt.worstTestStepResult.status);
        if (result.status === 'failed') {
          const location = attempt.worstTestStepResult.message?.match(/password-otp\.mjs:(\d+):(\d+)/);
          if (location) console.log(`Cucumber OTP failure at shared model line ${location[1]}:${location[2]}; raw diagnostics withheld.`);
        }
        return result;
      });
      finishOtpReport('cucumber', cases);
    });
  }
}
