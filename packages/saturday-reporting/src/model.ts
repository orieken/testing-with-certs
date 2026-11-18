/** Portable report format. Paths in saved reports are relative to report.json. */
export type Status = 'passed' | 'failed' | 'skipped' | 'pending' | 'undefined' | 'ambiguous' | 'timedOut' | 'interrupted' | 'unknown';
export type Outcome = Status | 'flaky';
export type Metadata = Record<string, string>;
export interface Attachment {
  name: string;
  contentType: string;
  path?: string;
  /** Input only; never serialized. */
  body?: Uint8Array;
  availability?: 'available' | 'missing' | 'disabled' | 'omitted';
}
export interface Step {
  title: string;
  status: Status;
  durationMs: number;
  category?: string;
  steps?: Step[];
}
export interface Attempt {
  index: number;
  status: Status;
  rawStatus: string;
  durationMs: number;
  steps: Step[];
  attachments: Attachment[];
}
export interface TestCase {
  id: string;
  title: string;
  suite: string[];
  location?: { file: string; line: number };
  metadata: Metadata;
  expectedStatus?: string;
  outcome: Outcome;
  attempts: Attempt[];
}
export interface Run {
  id: string;
  shard: string;
  runner: 'playwright' | 'cucumber';
  status: Status;
  startedAt?: string;
  durationMs?: number;
  metadata: Metadata;
  tests: TestCase[];
}
export interface Report {
  schemaVersion: 1;
  title: string;
  runs: Run[];
}
export interface ReportOptions {
  outputDir?: string;
  title?: string;
  /** Reuse across shards of one run; generated automatically otherwise. */
  runId?: string;
  shard?: string;
  metadata?: Metadata;
  /** Set false for credential-sensitive suites whose runner step titles may contain input values. */
  includeSteps?: boolean;
  /** Additional directories from which explicitly attached media may be copied. */
  artifactRoots?: string[];
}
export function normalizeStatus(value: string): Status {
  const key = value.toLowerCase();
  if (key === 'timedout') return 'timedOut';
  const statuses: Status[] = ['passed', 'failed', 'skipped', 'pending', 'undefined', 'ambiguous', 'interrupted'];
  return statuses.find(status => status === key) ?? 'unknown';
}
export function outcome(attempts: Attempt[]): Outcome {
  const last = attempts.at(-1)?.status ?? 'unknown';
  return last === 'passed' && attempts.some(a => a.status !== 'passed' && a.status !== 'skipped') ? 'flaky' : last;
}
export function metadata(value: unknown): Metadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Metadata must be a string map');
  const entries = Object.entries(value);
  if (entries.some(([key, item]) => !key || typeof item !== 'string')) throw new Error('Metadata must be a string map');
  return Object.fromEntries(entries);
}
/** Opt-in annotations/tags use saturday:key=value; ordinary projects need none. */
export function labelMetadata(labels: string[]): Metadata {
  return Object.fromEntries(labels.flatMap(label => {
    const match = label.match(/^@?saturday:([^=]+)=(.*)$/);
    return match ? [[match[1], match[2]]] : [];
  }));
}
