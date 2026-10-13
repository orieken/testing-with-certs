import { safeResult, finishReport } from './password-results.mjs';
export default class PasswordReporter {
  cases = [];
  printsToStdio() { return true; }
  onTestEnd(test, result) {
    const entry = safeResult(test.title.replace('Certificate and password: ', ''), result.status);
    this.cases.push(entry);
    console.log(`Certificate/password ${process.env.LAB_BROWSER} playwright ${entry.kind}: ${entry.status}`);
  }
  onEnd() { finishReport('playwright', this.cases); }
  onError() { console.error('Certificate/password runner error; raw diagnostics withheld.'); }
}
