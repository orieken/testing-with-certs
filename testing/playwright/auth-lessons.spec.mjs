import { test } from '@playwright/test';
import { checkPasskey } from '../teaching/passkeys.mjs';
import { checkOidc } from '../teaching/oidc.mjs';
import { checkSaml } from '../teaching/saml.mjs';
import { passkeyCaseNames, oidcCaseNames, samlCaseNames } from '../teaching/auth-matrix.mjs';

for (const [names, check] of [[passkeyCaseNames, checkPasskey], [oidcCaseNames, checkOidc], [samlCaseNames, checkSaml]]) {
  for (const name of names) test(name, async ({ browser, playwright }) => check(browser, name, playwright));
}
