import { test } from '@playwright/test';
import { checkPasskey } from '../teaching/passkeys.mjs';
import { passkeySessionCaseNames } from '../teaching/auth-matrix.mjs';
for (const name of passkeySessionCaseNames) test(name, async ({ browser, playwright }) => checkPasskey(browser, name, playwright));
