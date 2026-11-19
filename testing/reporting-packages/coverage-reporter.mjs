import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { evaluateCoverage } from './coverage-policy.mjs';

export default async function* coverageReporter(source) {
  let observed = false;
  for await (const event of source) {
    if (event.type !== 'test:coverage') continue;
    observed = true;
    const result = evaluateCoverage(event.data.summary);
    const directory = resolve(process.env.SATURDAY_COVERAGE_DIR ?? 'artifacts/saturday-reporting/coverage');
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'summary.json'), JSON.stringify(result, null, 2) + '\n');
    for (const row of result.results) yield `${row.file}: ${JSON.stringify(row.measured)}\n`;
    if (!result.passed) throw new Error(result.results.filter(row => !row.passed).map(row => `${row.file}: ${row.failures.join(', ')}`).join('\n'));
  }
  if (!observed) throw new Error('Adapter coverage data was not emitted');
}
