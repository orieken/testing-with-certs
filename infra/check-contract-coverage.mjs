import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const manifest = read('testing/api/contracts/coverage-manifest.json');
const digests = read('contracts/bundled/digests.json');
const names = ['catalog', 'customer', 'insights'];
const serviceIndex = process.argv.indexOf('--service');
const selectedService = serviceIndex < 0 ? null : process.argv[serviceIndex + 1];
if (selectedService !== null && !names.includes(selectedService)) throw new Error('Expected --service catalog|customer|insights');
const expected = new Map();
for (const name of names) {
  const doc = read(`contracts/bundled/${name}.json`);
  for (const [path, pathItem] of Object.entries(doc.paths)) for (const [method, operation] of Object.entries(pathItem)) {
    const id = operation.operationId;
    if (!id || expected.has(id)) throw new Error(`Missing/duplicate operationId ${id}`);
    const success = Object.keys(operation.responses).map(Number).find((status) => status >= 200 && status < 300);
    if (!success) throw new Error(`${id}: missing success status`);
    expected.set(id, { service: name, method, path, requiredStatuses: [success, 400, 401, 403], documented: new Set(Object.keys(operation.responses).map(Number)) });
  }
}
if (expected.size !== 23 || manifest.operations.length !== expected.size) throw new Error(`Operation count mismatch: ${manifest.operations.length}/${expected.size}`);
const seen = new Set();
for (const entry of manifest.operations) {
  const wanted = expected.get(entry.operationId);
  if (!wanted || seen.has(entry.operationId)) throw new Error(`Unknown/duplicate manifest operation ${entry.operationId}`);
  seen.add(entry.operationId);
  if (entry.service !== wanted.service || entry.method !== wanted.method || entry.path !== wanted.path || JSON.stringify(entry.requiredStatuses) !== JSON.stringify(wanted.requiredStatuses)) throw new Error(`${entry.operationId}: manifest differs from canonical spec`);
}
if (process.argv.includes('--inventory')) {
  const required = manifest.operations.reduce((total, entry) => total + entry.requiredStatuses.length, 0);
  console.log(`PASS: coverage manifest lists all ${seen.size} canonical operations and ${required} required status scenarios`);
  process.exit(0);
}
let report;
try { report = read('artifacts/contract-coverage.json'); }
catch { throw new Error('No executed Playwright contract coverage report; live provider suites have not run'); }
if (report.source !== 'playwright-contracts' || report.schemaVersion !== 1 || JSON.stringify(report.specDigests) !== JSON.stringify(digests.services)) throw new Error('Contract coverage report source or expected-spec digests differ');
const covered = new Set();
for (const result of report.results) {
  const wanted = expected.get(result.operationId);
  if (!wanted || result.service !== wanted.service || !wanted.documented.has(result.status) || typeof result.testId !== 'string' || result.testId.length < 4) throw new Error(`Invalid executed scenario ${result.operationId}:${result.status}`);
  covered.add(`${result.operationId}:${result.status}`);
}
const requiredOperations = manifest.operations.filter((entry) => selectedService === null || entry.service === selectedService);
const uncovered = requiredOperations.flatMap((entry) => entry.requiredStatuses.filter((status) => !covered.has(`${entry.operationId}:${status}`)).map((status) => `${entry.operationId}:${status}`));
if (uncovered.length) throw new Error(`Live contract coverage incomplete (${uncovered.length} required statuses): ${uncovered.slice(0, 12).join(', ')}${uncovered.length > 12 ? ', ...' : ''}`);
console.log(`PASS: all ${requiredOperations.length} ${selectedService ?? 'cross-service'} operations have required executed Playwright status coverage`);
