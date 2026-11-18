import type { Report } from './model.js';
const statuses = ['passed', 'failed', 'skipped', 'pending', 'undefined', 'ambiguous', 'timedOut', 'interrupted', 'unknown'];
type ObjectValue = Record<string, unknown>;
function object(value: unknown): asserts value is ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid report object');
}
function text(value: unknown): asserts value is string {
  if (typeof value !== 'string') throw new Error('Invalid report text');
}
function list(value: unknown): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new Error('Invalid report list');
}
function number(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Invalid report number');
}
function labels(value: unknown) {
  object(value);
  Object.values(value).forEach(text);
}
function status(value: unknown, flaky = false) {
  if (!statuses.includes(String(value)) && !(flaky && value === 'flaky')) throw new Error('Invalid report status');
}
function steps(value: unknown) {
  list(value);
  for (const step of value) {
    object(step); text(step.title); status(step.status); number(step.durationMs);
    if (step.category !== undefined) text(step.category);
    if (step.steps !== undefined) steps(step.steps);
  }
}
function attachment(value: unknown) {
  object(value); text(value.name); text(value.contentType);
  if (value.path !== undefined) text(value.path);
  if (value.body !== undefined && !(value.body instanceof Uint8Array)) throw new Error('Invalid attachment body');
  if (value.availability !== undefined) {
    text(value.availability);
    if (!['available', 'missing', 'disabled', 'omitted'].includes(value.availability)) throw new Error('Invalid attachment availability');
  }
}
export function runKey(run: { runner: string; id: string; shard: string }): string {
  return JSON.stringify([run.runner, run.id, run.shard]);
}
export function validateReport(value: unknown): asserts value is Report {
  object(value);
  if (value.schemaVersion !== 1) throw new Error('Unsupported Saturday report schemaVersion');
  text(value.title); list(value.runs);
  const runs = new Set<string>();
  for (const run of value.runs) {
    object(run); text(run.id); text(run.shard); text(run.runner); status(run.status); labels(run.metadata); list(run.tests);
    if (run.startedAt !== undefined) text(run.startedAt);
    if (run.durationMs !== undefined) number(run.durationMs);
    if (!['playwright', 'cucumber'].includes(run.runner)) throw new Error('Invalid report runner');
    const key = runKey({ runner: run.runner, id: run.id, shard: run.shard });
    if (runs.has(key)) throw new Error(`Duplicate report run/shard: ${key}`);
    runs.add(key);
    const ids = new Set<string>();
    for (const test of run.tests) {
      object(test); text(test.id); text(test.title); list(test.suite); test.suite.forEach(text);
      labels(test.metadata); status(test.outcome, true); list(test.attempts);
      if (test.expectedStatus !== undefined) text(test.expectedStatus);
      if (test.location !== undefined) { object(test.location); text(test.location.file); number(test.location.line); }
      if (ids.has(test.id)) throw new Error('Duplicate test identity within run/shard');
      ids.add(test.id);
      const indices = new Set<number>();
      for (const attempt of test.attempts) {
        object(attempt); number(attempt.index); status(attempt.status); text(attempt.rawStatus); number(attempt.durationMs);
        if (!Number.isInteger(attempt.index) || indices.has(attempt.index)) throw new Error('Duplicate or invalid attempt index');
        indices.add(attempt.index); steps(attempt.steps); list(attempt.attachments); attempt.attachments.forEach(attachment);
      }
    }
  }
}
