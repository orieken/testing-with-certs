import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import SafeFaultReporter from './reporter.mjs';
// TEST-03 / AC: failed tests export safe status without error/stdout attachments.
test('reporter excludes credential-shaped diagnostic fields', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'fault-report-'));
  const previous = process.env.LAB_FAULT_REPORT_DIR;
  process.env.LAB_FAULT_REPORT_DIR = dir;
  try {
    const reporter = new SafeFaultReporter();
    reporter.onTestEnd({ title: 'safe fixed case', parent: { project: () => ({ name: 'checkout-faults' }) }, annotations: [] },
      { status: 'failed', error: { message: 'Bearer eyJsynthetic-do-not-export', stack: 'sensitive diagnostic' }, stdout: ['secret-shaped-output'], attachments: [{ body: Buffer.from('private-shaped-attachment') }] });
    reporter.onEnd();
    const json = readFileSync(`${dir}/results.json`, 'utf8'); const xml = readFileSync(`${dir}/junit.xml`, 'utf8');
    assert.equal(JSON.parse(json).results[0].status, 'failed');
    assert.ok(!/Bearer|sensitive diagnostic|secret-shaped-output|private-shaped-attachment/.test(json + xml));
    assert.match(xml, /failures="1"/);
  } finally { if (previous === undefined) delete process.env.LAB_FAULT_REPORT_DIR; else process.env.LAB_FAULT_REPORT_DIR = previous; rmSync(dir, { recursive: true, force: true }); }
});
