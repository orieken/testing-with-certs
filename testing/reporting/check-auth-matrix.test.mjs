import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkAuthMatrix } from './check-auth-matrix.mjs';
import { authPhases, otpCaseNames, otpRunners } from '../teaching/auth-matrix.mjs';

test('authentication gates require every case, browser, phase and correct provenance', () => {
  for (const suite of ['auth-lessons', 'password-otp']) {
    const root = mkdtempSync(join(tmpdir(), 'auth-matrix-'));
    const reports = [];
    try {
      const phases = suite === 'auth-lessons' ? authPhases : Object.fromEntries(otpRunners.map(runner => [runner, otpCaseNames]));
      for (const browser of ['chrome', 'msedge']) for (const [phase, names] of Object.entries(phases)) {
        const directory = join(root, `${browser}-${phase}`);
        mkdirSync(directory);
        const data = { browser, phase, runner:phase, evidence: suite === 'auth-lessons' ? 'live-authentication-lessons' : 'live-password-otp',
          cases: names.map(name => ({ name, status: 'passed' })) };
        const path = join(directory, 'results.json');
        writeFileSync(path, JSON.stringify(data)); reports.push({ path, data });
      }
      assert.equal(checkAuthMatrix(suite, root), suite === 'auth-lessons' ? 112 : 28);
      for (const {path, data} of reports) {
        for (const mutate of [value => value.cases.pop(), value => value.cases.push(value.cases[0]),
          value => { value.cases[0].name = 'unknown'; }, value => { value.cases[0].status = 'skipped'; },
          value => { value.cases[0].status = 'failed'; }, value => { value.browser = 'wrong'; },
          value => { value.evidence = 'mock'; }]) {
          const changed = structuredClone(data); mutate(changed);
          writeFileSync(path, JSON.stringify(changed)); assert.throws(() => checkAuthMatrix(suite, root));
        }
        if (data.cases.length > 1) {
          const duplicate = structuredClone(data); duplicate.cases[0] = duplicate.cases[1];
          writeFileSync(path, JSON.stringify(duplicate)); assert.throws(() => checkAuthMatrix(suite, root));
        }
        if (suite === 'auth-lessons') {
          writeFileSync(path, JSON.stringify({...data, phase:'wrong'})); assert.throws(() => checkAuthMatrix(suite, root));
        }
        if (suite === 'password-otp') {
          writeFileSync(path, JSON.stringify({...data, runner:'wrong'})); assert.throws(() => checkAuthMatrix(suite, root));
        }
        writeFileSync(path, JSON.stringify(data));
      }
      rmSync(reports.at(-1).path); assert.throws(() => checkAuthMatrix(suite, root));
    } finally { rmSync(root, {recursive:true,force:true}); }
  }
});
