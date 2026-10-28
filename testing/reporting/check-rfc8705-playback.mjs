import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { checkPages } from './pages-evidence.mjs';
const root = process.argv[2];
const gate = await checkPages(`${root}/site`, 2);
const results = [];
for (const channel of ['chrome', 'msedge']) {
  const browser = await chromium.launch({ channel, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', () => errors.push('page-error'));
    await page.goto(`file://${root}/site/index.html`);
    assert.equal(await page.locator('.selection').count(), 2);
    assert.equal(await page.locator('.video-card').count(), gate.videos);
    await page.locator('#auth').selectOption('certificate');
    assert.equal(await page.locator('.selection:not([hidden])').count(), 2);
    const clips = page.locator('.video-card video');
    for (let index = 0; index < await clips.count(); index++) {
      await clips.nth(index).evaluate(async video => {
        video.muted = true; video.load();
        await video.play();
        await new Promise((resolve, reject) => {
          const deadline = setTimeout(() => reject(new Error('Clip did not advance')), 15000);
          const poll = () => {
            if (video.currentTime > 0.1) { clearTimeout(deadline); video.pause(); resolve(); }
            else setTimeout(poll, 50);
          }; poll();
        });
      });
    }
    assert.equal(errors.length, 0);
    results.push({ channel, version: browser.version(), clipsDecodedAndAdvanced: gate.videos, filters: 'passed', pageErrors: 0 });
  } finally { await browser.close(); }
}
writeFileSync(`${root}/playback.json`, JSON.stringify({ status: 'passed', ...gate, results }, null, 2));
writeFileSync(`${root}/site/evidence/playback.json`, JSON.stringify({ status: 'passed', ...gate, results }, null, 2));
console.log(`PASS: report links, filters and all ${gate.videos} clips decoded and advanced in Chrome and Edge`);
