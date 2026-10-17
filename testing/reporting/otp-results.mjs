import { mkdirSync, writeFileSync } from 'node:fs';
import { otpCaseNames } from '../teaching/auth-matrix.mjs';
export function safeOtpResult(name, status) {
  if (!otpCaseNames.includes(name)) throw new Error('Unknown OTP scenario');
  return { name, status: status === 'passed' || status === 'PASSED' ? 'passed' : 'failed' };
}
export function otpReport(browser, runner, cases) {
  if (!['chrome', 'msedge'].includes(browser) || !['playwright', 'cucumber'].includes(runner)) throw new Error('Unknown OTP report selection');
  // Export only allowlisted names and normalized outcomes, never Cucumber error objects or attachments.
  cases = cases.map(value => safeOtpResult(value.name, value.status));
  return { evidence: 'live-password-otp', browser, runner, cases };
}
export function finishOtpReport(runner, cases) {
  const report = otpReport(process.env.LAB_BROWSER, runner, cases);
  const { browser } = report; cases = report.cases;
  const directory = `/work/artifacts/password-otp/${browser}-${runner}`;
  mkdirSync(directory, { recursive: true });
  const failed = cases.filter(value => value.status !== 'passed').length;
  console.log(`Password/OTP ${browser} ${runner}: ${cases.length - failed}/${cases.length} passed`);
  writeFileSync(`${directory}/results.json`, JSON.stringify(report, null, 2), { mode: 0o644 });
  writeFileSync(`${directory}/junit.xml`, `<testsuite name="password-otp-${browser}-${runner}" tests="${cases.length}" failures="${failed}">${cases.map(value =>
    `<testcase name="${value.name}">${value.status === 'passed' ? '' : '<failure message="Scenario failed; raw diagnostics withheld"/>'}</testcase>`).join('')}</testsuite>\n`, { mode: 0o644 });
  writeFileSync(`${directory}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><title>Password and OTP</title><h1>${browser} ${runner}</h1><ul>${cases.map(value =>
    `<li>${value.name}: ${value.status}</li>`).join('')}</ul></html>`, { mode: 0o644 });
}
