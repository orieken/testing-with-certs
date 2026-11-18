import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import type { Report, ReportOptions, Step } from './model.js';
import { inside, portableAttachment, rejectSymlinks } from './artifacts.js';
import { renderReport } from './render.js';
import { validateReport } from './validate.js';
export * from './model.js';
export { renderReport, validateReport };

function portableStep(step: Step): Step {
  return { title: step.title, status: step.status, durationMs: step.durationMs, category: step.category, steps: step.steps?.map(portableStep) };
}

/** Writes a complete portable report; only replaces directories owned by Saturday. */
export function writeReport(report: Report, options: ReportOptions = {}): string {
  validateReport(report);
  const destination = resolve(options.outputDir ?? 'saturday-report');
  rejectSymlinks(destination);
  const marker = join(destination, '.saturday-report');
  if (existsSync(destination) && (!existsSync(marker) || readFileSync(marker, 'utf8') !== 'saturday-report-v1\n')) {
    throw new Error('Output directory already exists and is not owned by Saturday reporting');
  }
  mkdirSync(dirname(destination), { recursive: true });
  const stage = mkdtempSync(join(dirname(destination), `.${basename(destination)}-`));
  const backup = `${stage}-previous`;
  try {
    const portable: Report = {
      schemaVersion: 1, title: options.title ?? report.title,
      runs: report.runs.map(run => ({
        id: run.id, shard: run.shard, runner: run.runner, status: run.status,
        startedAt: run.startedAt, durationMs: run.durationMs, metadata: run.metadata,
        tests: run.tests.map(test => ({
          id: test.id, title: test.title, suite: test.suite, metadata: test.metadata,
          location: test.location ? { file: test.location.file, line: test.location.line } : undefined,
          expectedStatus: test.expectedStatus, outcome: test.outcome,
          attempts: test.attempts.map(attempt => ({
            index: attempt.index, status: attempt.status, rawStatus: attempt.rawStatus,
            durationMs: attempt.durationMs, steps: attempt.steps.map(portableStep),
            attachments: attempt.attachments.map(a => portableAttachment(a, stage, options.artifactRoots ?? [process.cwd()])),
          })),
        })),
      })),
    };
    writeFileSync(join(stage, 'report.json'), JSON.stringify(portable, null, 2) + '\n');
    writeFileSync(join(stage, 'index.html'), renderReport(portable));
    writeFileSync(join(stage, '.saturday-report'), 'saturday-report-v1\n');
    if (existsSync(destination)) renameSync(destination, backup);
    try { renameSync(stage, destination); }
    catch (error) { if (existsSync(backup)) renameSync(backup, destination); throw error; }
    rmSync(backup, { recursive: true, force: true });
    return join(destination, 'index.html');
  } finally { rmSync(stage, { recursive: true, force: true }); }
}

/** Merge completed portable reports, rejecting duplicate runner/run/shard identities. */
export function mergeReports(files: string[], options: ReportOptions = {}): string {
  if (!files.length) throw new Error('At least one report.json input is required');
  const merged: Report = { schemaVersion: 1, title: options.title ?? 'Saturday test report', runs: [] };
  const roots: string[] = [];
  for (const file of files) {
    rejectSymlinks(file);
    const report: unknown = JSON.parse(readFileSync(file, 'utf8'));
    validateReport(report);
    const root = dirname(resolve(file));
    roots.push(root);
    for (const run of report.runs) for (const test of run.tests) for (const attempt of test.attempts) for (const attachment of attempt.attachments) {
      if (attachment.body !== undefined) throw new Error('Portable input must not contain attachment bodies');
      if (attachment.path !== undefined) {
        if (isAbsolute(attachment.path) || !inside(root, resolve(root, attachment.path))) throw new Error('Portable attachment path escapes report directory');
        attachment.path = resolve(root, attachment.path);
      }
    }
    merged.runs.push(...report.runs);
  }
  validateReport(merged);
  return writeReport(merged, { ...options, artifactRoots: roots });
}
export function newRunId(): string { return randomUUID(); }
