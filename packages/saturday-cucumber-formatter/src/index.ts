import { relative, resolve } from 'node:path';
import { Formatter, formatterHelpers } from '@cucumber/cucumber';
import type { IFormatterOptions } from '@cucumber/cucumber';
import { labelMetadata, metadata, newRunId, normalizeStatus, outcome, writeReport } from '@orieken/saturday-reporting';
import type { Attachment, ReportOptions, Run, TestCase } from '@orieken/saturday-reporting';

type CollectedAttempt = ReturnType<formatterHelpers.EventDataCollector['getTestCaseAttempts']>[number];
type CucumberAttachment = CollectedAttempt['stepAttachments'][string][number];
function millis(duration?: { seconds: number; nanos: number }): number {
  return duration ? duration.seconds * 1000 + duration.nanos / 1_000_000 : 0;
}
function attachment(item: CucumberAttachment): Attachment {
  return {
    name: item.fileName ?? item.mediaType, contentType: item.mediaType,
    body: Buffer.from(item.body, item.contentEncoding === 'BASE64' ? 'base64' : 'utf8'),
  };
}
export default class SaturdayCucumberFormatter extends Formatter {
  private options: ReportOptions;
  private run: Run;
  private readonly planned = new Set<string>();
  constructor(options: IFormatterOptions) {
    super(options);
    this.options = options.parsedArgvOptions.saturday ?? {};
    this.run = {
      id: this.options.runId ?? newRunId(), shard: this.options.shard ?? '1', runner: 'cucumber',
      status: 'unknown', metadata: { os: process.platform, ...metadata(this.options.metadata ?? {}) }, tests: [],
    };
    options.eventBroadcaster.on('envelope', envelope => {
      if (envelope.testCase) this.planned.add(envelope.testCase.pickleId);
      if (envelope.testRunStarted) {
        const stamp = envelope.testRunStarted.timestamp;
        this.run.startedAt = new Date(stamp.seconds * 1000 + stamp.nanos / 1_000_000).toISOString();
      }
      if (envelope.testRunFinished) this.run.status = envelope.testRunFinished.success ? 'passed' : 'failed';
    });
  }
  private test(item: CollectedAttempt): TestCase {
    const locations = formatterHelpers.GherkinDocumentParser.getGherkinScenarioLocationMap(item.gherkinDocument);
    const location = item.pickle.astNodeIds.map(id => locations[id]).filter(Boolean).at(-1);
    return {
      id: item.pickle.id, title: item.pickle.name, suite: [item.gherkinDocument.feature?.name ?? item.pickle.uri],
      location: { file: relative(this.cwd, resolve(this.cwd, item.pickle.uri)).replaceAll('\\', '/'), line: location?.line ?? 0 },
      metadata: labelMetadata(item.pickle.tags.map(tag => tag.name)), outcome: 'unknown', attempts: [],
    };
  }
  private collect(): void {
    const tests = new Map<string, TestCase>();
    for (const item of this.eventDataCollector.getTestCaseAttempts()) {
      const test = tests.get(item.pickle.id) ?? this.test(item);
      tests.set(item.pickle.id, test);
      const attachments = Object.values(item.stepAttachments).flat().map(attachment);
      if (test.metadata.recording === 'disabled' && !attachments.some(a => a.contentType.startsWith('video/'))) {
        attachments.push({ name: 'Video', contentType: 'video/webm', availability: 'disabled' });
      }
      test.attempts.push({
        index: item.attempt, rawStatus: item.worstTestStepResult.status,
        status: normalizeStatus(item.worstTestStepResult.status),
        durationMs: Object.values(item.stepResults).reduce((sum, result) => sum + millis(result.duration), 0),
        attachments,
        steps: item.testCase.testSteps.map(step => {
          const result = item.stepResults[step.id];
          const pickleStep = item.pickle.steps.find(pickle => pickle.id === step.pickleStepId);
          return {
            title: pickleStep?.text ?? 'Hook', category: pickleStep ? 'step' : 'hook',
            status: normalizeStatus(result?.status ?? 'UNKNOWN'), durationMs: millis(result?.duration),
          };
        }),
      });
    }
    for (const [id, test] of tests) {
      test.attempts.sort((a, b) => a.index - b.index);
      test.outcome = outcome(test.attempts);
      this.planned.delete(id);
    }
    for (const id of this.planned) {
      const pickle = this.eventDataCollector.getPickle(id);
      tests.set(id, { id, title: pickle.name, suite: [pickle.uri], metadata: labelMetadata(pickle.tags.map(tag => tag.name)), outcome: 'unknown', attempts: [] });
    }
    this.run.tests = [...tests.values()];
    if (this.options.includeSteps === false) for (const test of this.run.tests) for (const attempt of test.attempts) attempt.steps = [];
    this.run.durationMs = this.run.tests.reduce((sum, test) => sum + test.attempts.reduce((total, attempt) => total + attempt.durationMs, 0), 0);
  }
  override async finished(): Promise<void> {
    try {
      this.collect();
      writeReport({ schemaVersion: 1, title: this.options.title ?? 'Saturday Cucumber report', runs: [this.run] }, {
        ...this.options, artifactRoots: [this.cwd, ...(this.options.artifactRoots ?? [])],
      });
    } finally { await super.finished(); }
  }
}
export type { ReportOptions } from '@orieken/saturday-reporting';
