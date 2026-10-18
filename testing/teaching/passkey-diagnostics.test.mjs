import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PasskeyDiagnosticLines, safePasskeyDiagnostic, diagnosticPrefix } from './passkey-diagnostics.mjs';
import Reporter from '../reporting/auth-lessons.mjs';
const event = { name: 'passkeys:invalid-signature', stage: 'rejection-failed', signatureChanged: false, focused: true };
const selected = { id: 'one', title: event.name };

test('allowlist rejects credential-bearing or unknown values', () => {
  assert.deepEqual(safePasskeyDiagnostic(event), event);
  for (const value of [{ ...event, token: 'PRIVATE_CANARY' }, { ...event, focused: 'PRIVATE_CANARY' }, { ...event, name: 'PRIVATE_CANARY' }, { ...event, stage: 'PRIVATE_CANARY' }, []]) assert.equal(safePasskeyDiagnostic(value), null);
});
test('split output is buffered per case and raw output never forwarded', () => {
  const parser = new PasskeyDiagnosticLines();
  const line = diagnosticPrefix + JSON.stringify(event) + '\n';
  assert.deepEqual(parser.read('PRIVATE_CANARY\n' + line.slice(0, 30), selected), []);
  assert.deepEqual(parser.read(line.slice(30), selected), [event]);
  assert.deepEqual(parser.read(line, { id: 'other', title: 'passkeys:enrollment' }), []);
  assert.deepEqual(parser.read(line, undefined), []);
  assert.deepEqual(parser.read('x'.repeat(17000), selected), []);
  assert.deepEqual(parser.read(diagnosticPrefix + '{broken}\n', selected), []);
});
test('Playwright reporter forwards only validated Boolean diagnostics', () => {
  const reporter = new Reporter(), printed = [], original = console.log;
  console.log = value => printed.push(value);
  try {
    reporter.onStdOut('PRIVATE_CANARY\n', selected);
    reporter.onStdOut(diagnosticPrefix + JSON.stringify({ ...event, password: 'PRIVATE_CANARY' }) + '\n', selected);
    reporter.onStdOut(diagnosticPrefix + JSON.stringify(event) + '\n', selected);
  } finally { console.log = original; }
  assert.deepEqual(reporter.diagnostics, [event]);
  assert.equal(printed.length, 1);
  assert.ok(!printed.join('').includes('PRIVATE_CANARY'));
});
