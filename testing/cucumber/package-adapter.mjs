import { BeforeAll, AfterAll, Given, When, Then, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium, expect } from '@playwright/test';
import { installSaturdayWorld } from '@orieken/saturday-cucumber';
import { FileCertificateProvider } from 'saturday-keycloak-prototype';
import { installCertificateCucumberHooks } from 'saturday-keycloak-prototype/cucumber';

const selected = process.env.LAB_USER;
const channel = process.env.LAB_BROWSER;
if (!selected || !['chrome', 'msedge'].includes(channel)) throw new Error('Selected user and real browser channel required');
setDefaultTimeout(20_000);
const provider = new FileCertificateProvider('/identity', { [`lab/${selected}`]: { cert: 'cert.pem', key: 'key.pem' } });
let browser;
installSaturdayWorld();
BeforeAll(async () => { browser = await chromium.launch({ channel, headless: true, args: ['--disable-http2'], timeout: 30_000 }); });
AfterAll(async () => { await browser?.close(); });
installCertificateCucumberHooks({
  browser: () => { if (!browser) throw new Error('Browser not started'); return browser; },
  provider,
  target: { origins: ['https://shop.magic.test:8443', 'https://auth.magic.test:9443'], issuer: 'https://auth.magic.test:9443/realms/magic-shop' },
  resolveIdentity: () => ({ namespace: 'lab', name: selected })
});
Given('I open the certificate shop', async function () { await this.page.goto('https://shop.magic.test:8443', { waitUntil: 'domcontentloaded' }); });
When('I sign in with my selected certificate', async function () { await this.page.getByRole('button', { name: 'Sign in with certificate' }).click(); });
Then('the selected identity is shown', async function () { await expect(this.page.getByTestId('signed-in-user')).toContainText(selected, { timeout: 15_000 }); });
