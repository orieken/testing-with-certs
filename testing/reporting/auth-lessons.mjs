import { mkdirSync, writeFileSync } from 'node:fs';

import { authPhases } from '../teaching/auth-matrix.mjs';
const names = new Set(Object.values(authPhases).flat());

export function safeAuthResult(name, status) {
  if (!names.has(name)) throw new Error('Unknown authentication lesson report case');
  return { name, status: ['passed', 'PASSED'].includes(status) ? 'passed' : 'failed' };
}

export function finishAuthReport(browser, phase, cases) {
  if (!['chrome', 'msedge'].includes(browser) || !Object.hasOwn(authPhases, phase)) throw new Error('Unknown authentication report selection');
  cases = cases.map(value => safeAuthResult(value.name, value.status));
  const directory = `/work/artifacts/auth-lessons/${browser}-${phase}`;
  mkdirSync(directory, { recursive: true });
  const failed = cases.filter(value => value.status !== 'passed').length;
  writeFileSync(`${directory}/results.json`, JSON.stringify({ evidence: 'live-authentication-lessons', browser, phase, cases }, null, 2), { mode: 0o644 });
  writeFileSync(`${directory}/junit.xml`, `<testsuite name="${browser}-${phase}" tests="${cases.length}" failures="${failed}">${cases.map(value =>
    `<testcase name="${value.name}">${value.status === 'passed' ? '' : '<failure message="Scenario failed; raw diagnostics withheld"/>'}</testcase>`).join('')}</testsuite>\n`, { mode: 0o644 });
  writeFileSync(`${directory}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><title>Authentication lessons</title><h1>${browser} ${phase}</h1><ul>${cases.map(value =>
    `<li>${value.name}: ${value.status}</li>`).join('')}</ul></html>`, { mode: 0o644 });
}

export default class AuthenticationLessonReporter {
  cases = [];
  printsToStdio() { return true; }
  onTestEnd(test, result) {
    if (!names.has(test.title)) throw new Error('Unknown authentication lesson report case');
    const entry = { name: test.title, status: result.status === 'passed' ? 'passed' : 'failed' };
    this.cases.push(entry);
    console.log(`${process.env.LAB_BROWSER} ${entry.name}: ${entry.status}`);
    if (entry.status === 'failed') {
      const location = result.error?.stack?.match(/(?:(?:auth-lessons|kerberos)\.spec|passkeys|oidc|saml|kerberos)\.mjs:(\d+):(\d+)/);
      if (location) console.log(`Failure at test line ${location[1]}:${location[2]}; credential-bearing diagnostics withheld.`);
    }
  }
  onError() { console.error('Authentication lesson runner error; credential-bearing diagnostics withheld.'); }
  onEnd() {
    const browser = process.env.LAB_BROWSER;
    if (!['chrome', 'msedge'].includes(browser)) throw new Error('Unknown report browser');
    const phase = process.env.LAB_AUTH_SUITE === 'kerberos' ?
      (process.env.LAB_KERBEROS_DISABLED === '1' ? 'kerberos-disabled' : 'kerberos') : process.env.LAB_AUTH_SUITE === 'passkeys-lifecycle' ? 'passkeys-lifecycle' : process.env.LAB_AUTH_SUITE === 'oidc-lifecycle' ? 'oidc-lifecycle' : 'passkeys-federation';
    finishAuthReport(browser, phase, this.cases);
  }
}
