import { mkdirSync, writeFileSync } from 'node:fs';

import { otpCaseNames as names } from '../teaching/auth-matrix.mjs';

export default class OtpReporter {
  cases = [];
  printsToStdio() { return true; }
  onTestEnd(test, result) {
    if (!names.includes(test.title)) throw new Error('Unknown OTP scenario');
    const entry = { name: test.title, status: result.status === 'passed' ? 'passed' : 'failed' };
    this.cases.push(entry);
    console.log(`Password/OTP ${process.env.LAB_BROWSER}: ${entry.name}: ${entry.status}`);
  }
  onError() { console.error('Password/OTP runner error; credential-bearing diagnostics withheld.'); }
  onEnd() {
    const browser = process.env.LAB_BROWSER;
    if (!['chrome', 'msedge'].includes(browser)) throw new Error('Unknown OTP report browser');
    const directory = `/work/artifacts/password-otp/${browser}`;
    mkdirSync(directory, { recursive: true });
    const failed = this.cases.filter(value => value.status !== 'passed').length;
    writeFileSync(`${directory}/results.json`, JSON.stringify({ evidence: 'live-password-otp', browser, cases: this.cases }, null, 2), { mode: 0o644 });
    const cases = this.cases.map(value => `<testcase name="${value.name}">${value.status === 'passed' ? '' : '<failure message="Scenario failed; raw diagnostics withheld"/>'}</testcase>`).join('');
    writeFileSync(`${directory}/junit.xml`, `<testsuite name="password-otp-${browser}" tests="${this.cases.length}" failures="${failed}">${cases}</testsuite>\n`, { mode: 0o644 });
    writeFileSync(`${directory}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><title>Password and OTP — ${browser}</title><h1>Password and OTP — ${browser}</h1><ul>${this.cases.map(value => `<li>${value.name}: ${value.status}</li>`).join('')}</ul></html>`, { mode: 0o644 });
  }
}
