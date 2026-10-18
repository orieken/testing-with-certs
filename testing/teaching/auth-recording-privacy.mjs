import { chromium, expect } from '@playwright/test';
import { installRecordingPrivacy } from './auth-recording.mjs';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const directory = mkdtempSync('/tmp/privacy-recording-');
try {
  const context = await browser.newContext({ viewport: { width: 640, height: 360 }, recordVideo: { dir: directory, size: { width: 640, height: 360 } } });
  await context.addInitScript(installRecordingPrivacy);
  await context.route('https://auth.magic.test:9443/**', route => route.fulfill({ contentType: 'text/html', body:
    '<html><body style="margin:0;background:rgb(255,0,0);height:100vh"><input aria-label="Probe credential"><p>synthetic-private-value</p></body></html>' }));
  const page = await context.newPage(); const video = page.video();
  await page.goto('https://auth.magic.test:9443/privacy-probe');
  await page.getByLabel('Probe credential').fill('synthetic-private-value');
  await expect(page.getByLabel('Probe credential')).toHaveValue('synthetic-private-value');
  await expect(page.locator('body')).toHaveCSS('opacity', '0');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/work/artifacts/auth-lessons/privacy-screen.png' });
  await context.close();
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const decoders = readdirSync(cache).filter(value => value.startsWith('ffmpeg-'));
  expect(decoders.length).toBe(1);
  const decoder = join(cache, decoders[0], 'ffmpeg-linux');
  execFileSync(decoder, ['-i', await video.path(), '-pix_fmt', 'rgb24', join(directory, 'frame-%03d.png')], { stdio: ['ignore', 'pipe', 'pipe'] });
  const frames = readdirSync(directory).filter(value => value.endsWith('.png'));
  expect(frames.length).toBeGreaterThan(0);
  for (const frame of frames) {
    const png = readFileSync(join(directory, frame)); let width, height; const chunks = [];
    for (let offset = 8; offset < png.length;) {
      const size = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8), data = png.subarray(offset + 8, offset + 8 + size);
      if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); expect(data[8]).toBe(8); expect(data[9]).toBe(2); }
      if (type === 'IDAT') chunks.push(data);
      offset += size + 12;
    }
    const raw = inflateSync(Buffer.concat(chunks)), stride = width * 3; let previous = Buffer.alloc(stride), offset = 0;
    for (let y = 0; y < height; y++) {
      const filter = raw[offset++], row = Buffer.from(raw.subarray(offset, offset + stride)); offset += stride;
      for (let x = 0; x < stride; x++) {
        const left = x >= 3 ? row[x - 3] : 0, up = previous[x], upperLeft = x >= 3 ? previous[x - 3] : 0;
        const p = left + up - upperLeft, a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - upperLeft);
        const paeth = a <= b && a <= c ? left : b <= c ? up : upperLeft;
        row[x] = (row[x] + [0, left, up, Math.floor((left + up) / 2), paeth][filter]) & 255;
      }
      for (let x = 0; x < stride; x += 3) if (row[x] > 180 && row[x + 1] < 90 && row[x + 2] < 90) throw new Error('Provider pixels leaked into recording');
      previous = row;
    }
  }
  console.log('Privacy probe passed: real controls remained actionable; all decoded frames excluded the synthetic provider surface.');
} finally { await browser.close(); rmSync(directory, { recursive: true, force: true }); }
