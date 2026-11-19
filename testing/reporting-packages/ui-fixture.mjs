import { readFileSync } from 'node:fs';
import { writeReport } from '../../packages/saturday-reporting/dist/index.js';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const video = readFileSync(new URL('./fixtures/ui.webm', import.meta.url));
const attempt = (status, index = 0, attachments = []) => ({ index, status, rawStatus: status, durationMs: 12, attachments, steps: [{ title: 'Submit order', status, durationMs: 12 }] });
export function writeUiFixture(outputDir) {
  return writeReport({ schemaVersion: 1, title: 'Saturday UI regression report', runs: [
    { id: 'checkout', shard: '1', runner: 'playwright', status: 'passed', metadata: { browser: 'chromium', team: 'checkout' }, tests: [
      { id: 'checkout-success', title: 'Checkout completes', suite: ['Checkout'], location: { file: 'checkout.spec.mjs', line: 12 }, metadata: { persona: 'member' }, expectedStatus: 'passed', outcome: 'passed', attempts: [attempt('passed', 0, [{ name: 'Receipt', contentType: 'image/png', body: png }])] },
      { id: 'checkout-retry', title: 'Payment retries successfully', suite: ['Checkout'], metadata: {}, expectedStatus: 'passed', outcome: 'flaky', attempts: [attempt('failed'), attempt('passed', 1, [{ name: 'Retry recording', contentType: 'video/webm', body: video }])] },
    ] },
    { id: 'payments', shard: '1', runner: 'cucumber', status: 'failed', metadata: { team: 'payments' }, tests: [
      { id: 'payment-declined', title: 'Declined payment is explained', suite: ['Payments'], location: { file: 'payments.feature', line: 8 }, metadata: { persona: 'guest' }, outcome: 'failed', attempts: [attempt('failed')] },
    ] },
  ] }, { outputDir });
}
