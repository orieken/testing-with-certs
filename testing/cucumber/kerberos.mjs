import { Given, setDefaultTimeout } from '@cucumber/cucumber';
import * as playwright from '@playwright/test';
import { checkKerberos } from '../teaching/kerberos.mjs';
setDefaultTimeout(120_000);
Given('the Kerberos check {string} passes', async function (name) {
  await checkKerberos(playwright, name);
});
