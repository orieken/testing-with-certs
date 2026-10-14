import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const directory = process.argv[2];
const os = process.env.LAB_RUNNER_OS ?? 'debian';
const browser = process.env.LAB_BROWSER;
if (!directory?.startsWith('/work/artifacts/') || directory.split('/').includes('..')) throw new Error('Expected mounted artifact directory');
if (!['debian', 'ubi9'].includes(os) || !['chrome', 'msedge'].includes(browser)) throw new Error('Expected OS and browser selection');
const release = readFileSync('/etc/os-release', 'utf8');
const releaseField = name => release.match(new RegExp(`^${name}="?([^"\\n]+)`, 'm'))?.[1];
const browserVersion = execFileSync(browser === 'chrome' ? 'google-chrome' : 'microsoft-edge', ['--version'], { encoding: 'utf8', timeout: 10_000 }).trim();
mkdirSync(directory, { recursive: true });
writeFileSync(join(directory, 'environment.json'), JSON.stringify({
  runId: process.env.LAB_RUN_ID, os, distribution: releaseField('ID'), distributionVersion: releaseField('VERSION_ID'),
  browser, browserVersion, nodeVersion: process.version, architecture: process.arch, selectedUser: process.env.LAB_USER,
}, null, 2) + '\n', { mode: 0o644 });
