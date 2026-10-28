import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { apiCases, browserCases } from '../rfc8705/cases.mjs';
const root = '/work/artifacts/rfc8705';
const names = [...apiCases, ...browserCases];
export default class Rfc8705Reporter {
  cases = [];
  onTestEnd(test, result) {
    if (!names.includes(test.title)) throw new Error('Unknown RFC 8705 case');
    const name = test.title;
    const status = ['passed', 'skipped'].includes(result.status) ? result.status : 'failed';
    this.cases.push({ name, status, evidence: browserCases.includes(name) ? 'browser-recording' : 'api-only', durationMs: result.duration });
    console.log(`${process.env.LAB_BROWSER}: ${name}: ${status}`);
    if (status === 'failed') {
      const text = String(result.error?.message ?? '') + String(result.error?.stack ?? '');
      const location = text.match(/(?:browser\.spec|flow)\.mjs:\d+:\d+/)?.[0] ?? 'unknown-location';
      const network = text.match(/net::ERR_[A-Z_]+/)?.[0] ?? 'assertion-or-request-error';
      console.log(`Safe failure location: ${location}; ${network}`);
    }
  }
  onError() { console.error('RFC 8705 runner error; raw diagnostics withheld'); }
  printsToStdio() { return true; }
  onEnd() {
    const browser = process.env.LAB_BROWSER;
    if (!['chrome', 'msedge'].includes(browser)) throw new Error('Unsupported browser');
    const directory = `${root}/${browser}`;
    mkdirSync(directory, { recursive: true });
    const cases = names.map(name => this.cases.find(entry => entry.name === name) ?? { name, status: 'not-run', evidence: browserCases.includes(name) ? 'browser-recording' : 'api-only' });
    const provenance = JSON.parse(readFileSync(`${root}/provenance.json`));
    writeFileSync(`${directory}/results.json`, JSON.stringify({ evidence: 'live-rfc8705', browser, runner: 'playwright', persona: 'shop-admin', phase: 'baseline', runId: provenance.runId, sourceContent: provenance.sourceContent, cases }, null, 2));
    writeFileSync(`${directory}/junit.xml`, `<testsuite name="rfc8705-${browser}" tests="${cases.length}" failures="${cases.filter(c => c.status === 'failed').length}">${cases.map(c => `<testcase name="${c.name}">${c.status === 'passed' ? '' : ['skipped', 'not-run'].includes(c.status) ? '<skipped/>' : '<failure message="Credential-safe scenario failure"/>'}</testcase>`).join('')}</testsuite>`);
    writeFileSync(`${directory}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><title>RFC 8705 results</title><h1>${browser} scenario results</h1><p><a href="../index.html">Evidence overview</a> · <a href="../matrix.html">Video matrix</a></p><ul>${cases.map(c => `<li>${c.name}: ${c.status} (${c.evidence})</li>`).join('')}</ul>`);
  }
}
