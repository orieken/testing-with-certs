import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
export default class SafeFaultReporter {
  results = [];
  onTestEnd(test, result) {
    const evidence = test.annotations.filter(item => item.type === 'checkout-idempotency').map(item => JSON.parse(item.description));
    const group = test.parent.project().name;
    this.results.push({ name: test.title, group, status: result.status, evidence: result.status === 'passed' ? evidence : [] });
    console.log(`${group}: ${test.title}: ${result.status}`);
  }
  onError() { console.error('Checkout test infrastructure failed; no raw credential-bearing errors exported'); }
  onEnd() {
    const dir = process.env.LAB_FAULT_REPORT_DIR;
    mkdirSync(dir, { recursive: true });
    const digests = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../contracts/bundled/digests.json'))).services;
    writeFileSync(`${dir}/results.json`, JSON.stringify({ schemaVersion: 1, source: 'real-provider-checkout-idempotency', specDigests: digests, results: this.results }, null, 2)+'\n', { mode: 0o644 });
    const failures = this.results.filter(item => item.status !== 'passed').length;
    const cases = this.results.map((item, index) => `<testcase name="case-${index+1}" classname="${item.group}">${item.status === 'passed' ? '' : '<failure message="See sanitized results status"/>'}</testcase>`).join('');
    writeFileSync(`${dir}/junit.xml`, `<testsuite name="real-provider-checkout-idempotency" tests="${this.results.length}" failures="${failures}">${cases}</testsuite>\n`, { mode: 0o644 });
  }
}
