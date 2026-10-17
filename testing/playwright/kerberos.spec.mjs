import { test } from '@playwright/test';
import { checkKerberos } from '../teaching/kerberos.mjs';
import { kerberosCaseNames } from '../teaching/auth-matrix.mjs';

const disabled = process.env.LAB_KERBEROS_DISABLED === '1';
for (const name of kerberosCaseNames.filter(name => (name === 'kerberos:disabled-user') === disabled)) {
  test(name, async ({ playwright }) => checkKerberos(playwright, name));
}
