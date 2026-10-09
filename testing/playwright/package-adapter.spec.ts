import { expect } from '@playwright/test';
import { FileCertificateProvider } from 'saturday-keycloak-prototype';
import { createCertificateTest } from 'saturday-keycloak-prototype/playwright';

const selected = process.env.LAB_USER;
if (!selected) throw new Error('Selected identity required');
const provider = new FileCertificateProvider('/identity', { [`lab/${selected}`]: { cert: 'cert.pem', key: 'key.pem' } });
const test = createCertificateTest(provider, { namespace: 'lab', name: selected }, {
  origins: ['https://shop.magic.test:8443', 'https://auth.magic.test:9443'],
  issuer: 'https://auth.magic.test:9443/realms/magic-shop'
});

test('Saturday Keycloak Playwright adapter signs in with selected certificate', async ({ page }) => {
  await page.goto('https://shop.magic.test:8443', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Sign in with certificate' }).click();
  await expect(page.getByTestId('signed-in-user')).toContainText(selected);
  await expect(page).toHaveURL('https://shop.magic.test:8443/');
});
