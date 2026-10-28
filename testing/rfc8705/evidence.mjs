import { test } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { apiCases, browserCases } from './cases.mjs';
export function recordCheck(boundary, actual, expected) {
  if (!((Number.isInteger(actual) && actual >= 100 && actual <= 599) || ['verified', 'tls-error', 'rejected'].includes(actual)) || ![200, 401, 'verified', 'tls-error', 'rejected'].includes(expected) ||
      !['browser-transport', 'signed-binding', '/api/catalog/items', '/api/customer/me', '/api/insights/regions'].includes(boundary)) throw new Error('Unsafe evidence field');
  const names = [...apiCases, ...browserCases], index = names.indexOf(test.info().title);
  if (index < 0 || !['chrome', 'msedge'].includes(process.env.LAB_BROWSER)) throw new Error('Unknown evidence selection');
  const directory = `/work/artifacts/rfc8705/${process.env.LAB_BROWSER}/checks`;
  mkdirSync(directory, { recursive: true });
  const path = `${directory}/case-${index + 1}.json`;
  const checks = existsSync(path) ? JSON.parse(readFileSync(path)).checks : [];
  checks.push({ boundary, actual, expected });
  writeFileSync(path, JSON.stringify({ name: names[index], checks }, null, 2));
}
