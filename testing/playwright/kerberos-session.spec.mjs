import { test } from '@playwright/test';
import { checkKerberosSession } from '../teaching/kerberos-session.mjs';
import { kerberosSessionCaseNames } from '../teaching/auth-matrix.mjs';
for (const name of kerberosSessionCaseNames) test(name, async ({ playwright }) => checkKerberosSession(playwright, name));
