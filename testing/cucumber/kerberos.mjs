import { Given, setDefaultTimeout } from '@cucumber/cucumber';
import * as playwright from '@playwright/test';
import { checkKerberos } from '../teaching/kerberos.mjs';
import { checkKerberosSession } from '../teaching/kerberos-session.mjs';
setDefaultTimeout(120_000);
Given('the Kerberos check {string} passes', async function (name) {
  if (process.env.LAB_AUTH_SUITE === 'kerberos-lifecycle') await checkKerberosSession(playwright, name);
  else await checkKerberos(playwright, name);
});
