import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

const root = resolve(import.meta.dirname, '../../../');
const reportPath = resolve(process.env.LAB_CONTRACT_REPORT_DIR ?? resolve(root, 'artifacts'), 'contract-coverage.json');
const digests = JSON.parse(readFileSync(resolve(root, 'contracts/bundled/digests.json'), 'utf8')) as { services: Record<string, { sha256: string; operations: number }> };

export default class ContractCoverageReporter implements Reporter {
  private results: Array<{ service: string; operationId: string; status: number; testId: string }> = [];

  onBegin(): void {
    rmSync(reportPath, { force: true });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status !== 'passed') return;
    for (const annotation of test.annotations) {
      if (annotation.type !== 'contract-status') continue;
      const match = /^(catalog|customer|insights):([A-Za-z0-9]+):([1-5]\d\d)$/.exec(annotation.description ?? '');
      if (!match) throw new Error(`Invalid contract-status annotation on ${test.id}`);
      this.results.push({ service: match[1], operationId: match[2], status: Number(match[3]), testId: test.id });
    }
  }

  onEnd(): void {
    mkdirSync(resolve(reportPath, '..'), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify({ schemaVersion: 1, source: 'playwright-contracts', specDigests: digests.services, results: this.results }, null, 2)}\n`);
  }
}
