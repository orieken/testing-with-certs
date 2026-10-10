import { mkdirSync, writeFileSync } from 'node:fs';
export const checks = ['success', 'wrong-password', 'missing', 'wrong', 'disabled', 'unknown', 'unconfigured', 'cookies', 'shop'];
export function safeResult(kind, status) {
  if (!checks.includes(kind)) throw new Error('Unknown certificate/password report case');
  return { kind, status: status === 'passed' || status === 'PASSED' ? 'passed' : 'failed' };
}
export function finishReport(runner, cases) {
  const browser = process.env.LAB_BROWSER;
  if (!['chrome', 'msedge'].includes(browser)) throw new Error('Unknown report browser');
  const failed = cases.filter(entry => entry.status !== 'passed').length;
  console.log(`Certificate/password ${browser} ${runner}: ${cases.length - failed}/${cases.length} passed`);
  if (!process.env.LAB_PASSWORD_REPORTS) return;
  const directory = `/work/artifacts/certificate-password-ci/${browser}-${runner}`;
  mkdirSync(directory, { recursive: true });
  const report = { evidence: 'live-certificate-password', browser, runner, cases };
  writeFileSync(`${directory}/results.json`, JSON.stringify(report, null, 2), { mode: 0o644 });
  const tests = cases.map(entry => `<testcase name="${entry.kind}">${entry.status === 'passed' ? '' : '<failure message="Scenario failed; credential-bearing diagnostics omitted"/>'}</testcase>`).join('');
  writeFileSync(`${directory}/junit.xml`, `<testsuite name="certificate-password-${browser}-${runner}" tests="${cases.length}" failures="${failed}">${tests}</testsuite>\n`, { mode: 0o644 });
}
