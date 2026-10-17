import { test } from '@playwright/test';
import { checkPasswordOtp } from '../teaching/password-otp.mjs';
import { otpCaseNames } from '../teaching/auth-matrix.mjs';

for (const name of otpCaseNames) {
  test(name, async ({ browser, playwright }) => { await checkPasswordOtp(browser, name, playwright); });
}
