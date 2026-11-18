import { relative, resolve } from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase as PlaywrightTest, TestResult, TestStep } from '@playwright/test/reporter';
import { labelMetadata, metadata, newRunId, normalizeStatus, writeReport } from '@orieken/saturday-reporting';
import type { Attempt, ReportOptions, Run, Step, TestCase } from '@orieken/saturday-reporting';

function step(item: TestStep): Step {
  return {
    title: item.title, status: item.error ? 'failed' : 'passed', category: item.category,
    durationMs: Math.max(0, item.duration), steps: item.steps.map(step),
  };
}
function attempt(result: TestResult): Attempt {
  return {
    index: result.retry, status: normalizeStatus(result.status), rawStatus: result.status,
    durationMs: Math.max(0, result.duration), steps: result.steps.map(step),
    attachments: result.attachments.map(a => ({ name: a.name, contentType: a.contentType, path: a.path, body: a.body })),
  };
}
function optionalMetadata(value: unknown) { return value === undefined ? {} : metadata(value); }
export default class SaturdayPlaywrightReporter implements Reporter {
  private config?: FullConfig;
  private suite?: Suite;
  constructor(private options: ReportOptions = {}) {}
  printsToStdio(): boolean { return false; }
  onBegin(config: FullConfig, suite: Suite): void { this.config = config; this.suite = suite; }
  private test(test: PlaywrightTest): TestCase {
    const project = test.parent.project();
    const root = this.config?.rootDir ?? process.cwd();
    const attempts = test.results.map(attempt);
    if (this.options.includeSteps === false) for (const item of attempts) item.steps = [];
    const annotations = test.annotations.map(a => a.type === 'saturday' ? `saturday:${a.description ?? ''}` : a.type);
    const labels = labelMetadata([...test.tags, ...annotations]);
    if (labels.recording === 'disabled') for (const item of attempts) {
      if (!item.attachments.some(a => a.contentType.startsWith('video/'))) item.attachments.push({ name: 'Video', contentType: 'video/webm', availability: 'disabled' });
    }
    const result = test.outcome();
    return {
      id: test.id, title: test.title, suite: test.titlePath().slice(1, -1).filter(Boolean),
      location: { file: relative(root, test.location.file).replaceAll('\\', '/'), line: test.location.line },
      metadata: {
        os: process.platform, ...(project?.name ? { project: project.name } : {}),
        ...(project ? { browser: String(project.use.channel ?? project.use.browserName ?? 'chromium') } : {}),
        ...optionalMetadata(project?.metadata?.saturday), ...labels,
      },
      expectedStatus: test.expectedStatus,
      outcome: result === 'flaky' ? 'flaky' : result === 'skipped' ? 'skipped' : result === 'expected' ? 'passed' : attempts.at(-1)?.status === 'passed' ? 'failed' : attempts.at(-1)?.status ?? 'unknown',
      attempts,
    };
  }
  async onEnd(result: FullResult): Promise<{ status?: FullResult['status'] }> {
    try {
      const run: Run = {
        id: this.options.runId ?? newRunId(), shard: this.options.shard ?? String(this.config?.shard?.current ?? '1'),
        runner: 'playwright', status: normalizeStatus(result.status), startedAt: result.startTime.toISOString(), durationMs: result.duration,
        metadata: { ...optionalMetadata(this.config?.metadata?.saturday), ...optionalMetadata(this.options.metadata) },
        tests: this.suite?.allTests().map(test => this.test(test)) ?? [],
      };
      writeReport({ schemaVersion: 1, title: this.options.title ?? 'Saturday Playwright report', runs: [run] }, {
        ...this.options,
        artifactRoots: [process.cwd(), this.config?.rootDir ?? process.cwd(), ...(this.config?.projects.map(p => resolve(p.outputDir)) ?? []), ...(this.options.artifactRoots ?? [])],
      });
      return {};
    } catch (error) {
      console.error('Saturday report generation failed:', error instanceof Error ? error.message : 'Unknown error');
      return { status: 'failed' };
    }
  }
}
export type { ReportOptions } from '@orieken/saturday-reporting';
