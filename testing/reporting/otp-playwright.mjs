import { safeOtpResult, finishOtpReport } from './otp-results.mjs';
export default class OtpReporter {
  cases = [];
  printsToStdio() { return true; }
  onTestEnd(test, result) {
    const entry = safeOtpResult(test.title, result.status);
    this.cases.push(entry);
    console.log(`Password/OTP ${process.env.LAB_BROWSER}: ${entry.name}: ${entry.status}`);
    if (entry.status === 'failed') {
      const location = result.error?.stack?.match(/password-otp\.mjs:(\d+):(\d+)/);
      if (location) console.log(`Failure at shared model line ${location[1]}:${location[2]}; raw diagnostics withheld.`);
    }
  }
  onError() { console.error('Password/OTP runner error; raw diagnostics withheld.'); }
  onEnd() { finishOtpReport('playwright', this.cases); }
}
