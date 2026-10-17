import { test } from '@playwright/test';
import { checkPasswordOtp } from '../teaching/password-otp.mjs';
import { otpSessionCaseNames } from '../teaching/auth-matrix.mjs';
for (const name of otpSessionCaseNames) test(name, async ({ browser, playwright }) => checkPasswordOtp(browser, name, playwright));
