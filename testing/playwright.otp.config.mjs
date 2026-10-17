import { defineConfig } from '@playwright/test';
const channel = process.env.LAB_BROWSER;
if (!['chrome', 'msedge'].includes(channel)) throw new Error('Real Chrome or Edge required');
export default defineConfig({ testDir: './playwright', testMatch: process.env.LAB_OTP_LIFECYCLE === '1' ? 'password-otp-session.spec.mjs' : 'password-otp.spec.mjs',
  outputDir: '/tmp/otp-results', timeout: 90_000, workers: 1, retries: 0,
  reporter: './reporting/otp-playwright.mjs',
  use: { channel, headless: true, ignoreHTTPSErrors: false,
    launchOptions: { args: ['--disable-http2'] }, trace: 'off', screenshot: 'off', video: 'off' },
});
