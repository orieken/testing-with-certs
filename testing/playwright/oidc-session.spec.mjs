import { test } from '@playwright/test';
import { checkOidc } from '../teaching/oidc.mjs';
import { oidcSessionCaseNames } from '../teaching/auth-matrix.mjs';
for (const name of oidcSessionCaseNames) test(name, async ({ browser, playwright }) => checkOidc(browser, name, playwright));
