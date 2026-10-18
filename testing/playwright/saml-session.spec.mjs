import { test } from '@playwright/test';
import { checkSaml } from '../teaching/saml.mjs';
import { samlSessionCaseNames } from '../teaching/auth-matrix.mjs';
for (const name of samlSessionCaseNames) test(name, async ({ browser, playwright }) => checkSaml(browser, name, playwright));
