import { mkdirSync, writeFileSync } from 'node:fs';

const names = new Set([
  ...['enrollment', 'login-and-logout', 'missing-credential', 'invalid-signature', 'disabled-user', 'unconfigured-user', 'account-isolation'].map(value => `passkeys:${value}`),
  ...['oidc', 'saml'].flatMap(method => ['login-audience-and-logout', 'disabled-provider-user',
    'callback-state-rejection', 'cross-protocol-provider-rejection', 'broker-state-rejection'].map(value => `${method}:${value}`)),
  'saml:modified-signed-response',
  'saml:response-replay',
  ...['control', 'wrong-audience', 'wrong-recipient', 'expired'].map(value => `saml:signed-${value}`),
  ...['valid-ticket', 'missing-ticket', 'expired-ticket', 'disabled-user'].map(value => `kerberos:${value}`),
]);

export default class AuthenticationLessonReporter {
  cases = [];
  printsToStdio() { return true; }
  onTestEnd(test, result) {
    if (!names.has(test.title)) throw new Error('Unknown authentication lesson report case');
    const entry = { name: test.title, status: result.status === 'passed' ? 'passed' : 'failed' };
    this.cases.push(entry);
    console.log(`${process.env.LAB_BROWSER} ${entry.name}: ${entry.status}`);
    if (entry.status === 'failed') {
      const location = result.error?.stack?.match(/(?:auth-lessons|kerberos)\.spec\.mjs:(\d+):(\d+)/);
      if (location) console.log(`Failure at test line ${location[1]}:${location[2]}; credential-bearing diagnostics withheld.`);
    }
  }
  onError() { console.error('Authentication lesson runner error; credential-bearing diagnostics withheld.'); }
  onEnd() {
    const browser = process.env.LAB_BROWSER;
    if (!['chrome', 'msedge'].includes(browser)) throw new Error('Unknown report browser');
    const phase = process.env.LAB_AUTH_SUITE === 'kerberos' ?
      (process.env.LAB_KERBEROS_DISABLED === '1' ? 'kerberos-disabled' : 'kerberos') : 'passkeys-federation';
    const directory = `/work/artifacts/auth-lessons/${browser}-${phase}`;
    mkdirSync(directory, { recursive: true });
    const failed = this.cases.filter(value => value.status !== 'passed').length;
    writeFileSync(`${directory}/results.json`, JSON.stringify({ evidence: 'live-authentication-lessons', browser, phase, cases: this.cases }, null, 2), { mode: 0o644 });
    writeFileSync(`${directory}/junit.xml`, `<testsuite name="${browser}-${phase}" tests="${this.cases.length}" failures="${failed}">${this.cases.map(value =>
      `<testcase name="${value.name}">${value.status === 'passed' ? '' : '<failure message="Scenario failed; raw diagnostics withheld"/>'}</testcase>`).join('')}</testsuite>\n`, { mode: 0o644 });
    writeFileSync(`${directory}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><title>Authentication lessons</title><h1>${browser} ${phase}</h1><ul>${this.cases.map(value =>
      `<li>${value.name}: ${value.status}</li>`).join('')}</ul></html>`, { mode: 0o644 });
  }
}
