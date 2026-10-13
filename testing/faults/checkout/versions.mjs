import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
const require = createRequire('/work/testing/package.json');
const report = {
  evidence: 'local-container-runtime; browserless API tests', node: process.version,
  platform: process.platform, architecture: process.arch, kernel: os.release(),
  distribution: readFileSync('/etc/os-release', 'utf8'),
  playwright: require('@playwright/test/package.json').version,
  ajv: require('ajv/package.json').version,
  pg: createRequire('/work/services/customer-api/package.json')('pg/package.json').version,
  installedChrome: execFileSync('google-chrome', ['--version'], { encoding: 'utf8', timeout: 5000 }).trim(),
  installedEdge: execFileSync('microsoft-edge', ['--version'], { encoding: 'utf8', timeout: 5000 }).trim()
};
writeFileSync(`${process.env.LAB_FAULT_REPORT_DIR}/environment.json`, JSON.stringify(report, null, 2)+'\n', { mode: 0o644 });
console.log(`Checkout runner: ${report.node} ${report.platform}/${report.architecture}; Playwright ${report.playwright}; Ajv ${report.ajv}; pg ${report.pg}`);
