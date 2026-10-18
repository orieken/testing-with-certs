import { writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { BeforeAll, AfterAll, Before, After, Given, When, Then, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium, expect } from '@playwright/test';
import { installSaturdayWorld } from '@orieken/saturday-cucumber';
import { FileCertificateProvider } from 'saturday-keycloak-prototype';
import { installCertificateCucumberHooks } from 'saturday-keycloak-prototype/cucumber';

const selected = process.env.LAB_USER;
const channel = process.env.LAB_BROWSER;
const runId = process.env.LAB_RUN_ID;
const recordVideo = process.env.LAB_CUCUMBER_RECORD_VIDEO ?? '1';
if (!['0', '1'].includes(recordVideo)) throw new Error('LAB_CUCUMBER_RECORD_VIDEO must be 0 or 1');
if (runId && !/^[A-Za-z0-9_-]+$/.test(runId)) throw new Error('Invalid LAB_RUN_ID');
if (!selected || !['chrome', 'msedge'].includes(channel)) throw new Error('Selected user and real browser channel required');
setDefaultTimeout(20_000);
const provider = new FileCertificateProvider('/identity', { [`lab/${selected}`]: { cert: 'cert.pem', key: 'key.pem' } });
let browser;
const recordings = new Map();
installSaturdayWorld();
BeforeAll(async () => { browser = await chromium.launch({ channel, headless: true, args: ['--disable-http2'], timeout: 30_000 }); });
AfterAll(async () => {
  await browser?.close();
  if (!runId) return;
  const root = `/work/artifacts/teaching/${runId}`;
  if (recordVideo === '0') {
    const cases = [...recordings.values()].map(({ name, spec, status }) => ({ name, spec, status }));
    await writeFile(`${root}/recording-policy.json`, JSON.stringify({ evidence: 'explicit-recording-policy', recording: 'disabled', cases }, null, 2));
    return;
  }
  const cases = [];
  for (const recording of recordings.values()) {
    if (!recording.video) continue;
    const path = relative(root, await recording.video.path());
    if (path.startsWith('../') || path.startsWith('/')) throw new Error('Recording outside report');
    cases.push({ path, name: recording.name, spec: recording.spec, status: recording.status });
  }
  await writeFile(`${root}/video-cases.json`, JSON.stringify({ evidence: 'verified-authentication-video-cases', cases }, null, 2));
});
installCertificateCucumberHooks({
  browser: () => { if (!browser) throw new Error('Browser not started'); return browser; },
  provider,
  ...(runId && recordVideo === '1' ? { recordVideo: { dir: `/work/artifacts/teaching/${runId}/videos` } } : {}),
  target: { origins: ['https://shop.magic.test:8443', 'https://auth.magic.test:9443'], issuer: 'https://auth.magic.test:9443/realms/magic-shop' },
  resolveIdentity: () => ({ namespace: 'lab', name: selected })
});
// Registered after the context hook: capture the actual page, never infer from file order.
Before(function (scenario) {
  recordings.set(scenario.testCaseStartedId, { video: this.page.video(), name: scenario.pickle.name, spec: scenario.pickle.uri, status: 'unknown' });
});
After(function (scenario) {
  const recording = recordings.get(scenario.testCaseStartedId);
  if (recording) recording.status = scenario.result?.status ?? 'unknown';
});
Given('I open the certificate shop', async function () { await this.page.goto('https://shop.magic.test:8443', { waitUntil: 'domcontentloaded' }); });
When('I sign in with my selected certificate', async function () { await this.page.getByRole('button', { name: 'Sign in with certificate' }).click(); });
Then('the selected identity is shown', async function () { await expect(this.page.getByTestId('signed-in-user')).toContainText(selected, { timeout: 15_000 }); });
