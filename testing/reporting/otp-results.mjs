import { mkdirSync, writeFileSync } from 'node:fs';
import { otpCaseNames, otpSessionCaseNames } from '../teaching/auth-matrix.mjs';
export function safeOtpResult(name, status) {
  if (![...otpCaseNames, ...otpSessionCaseNames].includes(name)) throw new Error('Unknown OTP scenario');
  return { name, status: status === 'passed' || status === 'PASSED' ? 'passed' : 'failed' };
}
export function otpReport(browser, runner, cases, phase = 'baseline') {
  if (!['chrome', 'msedge'].includes(browser) || !['playwright', 'cucumber'].includes(runner)) throw new Error('Unknown OTP report selection');
  if (!['baseline', 'lifecycle'].includes(phase)) throw new Error('Unknown OTP report phase');
  // Export only allowlisted names and normalized outcomes, never Cucumber error objects or attachments.
  cases = cases.map(value => safeOtpResult(value.name, value.status));
  return { evidence: 'live-password-otp', browser, runner, phase, cases };
}
export function finishOtpReport(runner, cases) {
  const phase = process.env.LAB_OTP_LIFECYCLE === '1' ? 'lifecycle' : 'baseline';
  const report = otpReport(process.env.LAB_BROWSER, runner, cases, phase);
  const { browser } = report; cases = report.cases;
  const directory = `/work/artifacts/password-otp/${browser}-${runner}${phase === 'lifecycle' ? '-lifecycle' : ''}`;
  mkdirSync(directory, { recursive: true });
  const failed = cases.filter(value => value.status !== 'passed').length;
  console.log(`Password/OTP ${browser} ${runner} ${phase}: ${cases.length - failed}/${cases.length} passed`);
  writeFileSync(`${directory}/results.json`, JSON.stringify(report, null, 2), { mode: 0o644 });
  writeFileSync(`${directory}/junit.xml`, `<testsuite name="password-otp-${browser}-${runner}-${phase}" tests="${cases.length}" failures="${failed}">${cases.map(value =>
    `<testcase name="${value.name}">${value.status === 'passed' ? '' : '<failure message="Scenario failed; raw diagnostics withheld"/>'}</testcase>`).join('')}</testsuite>\n`, { mode: 0o644 });
  writeFileSync(`${directory}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><title>Password and OTP</title><h1>${browser} ${runner} ${phase}</h1><ul>${cases.map(value =>
    `<li>${value.name}: ${value.status}</li>`).join('')}</ul></html>`, { mode: 0o644 });
}
