import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
const runId = process.env.LAB_PROJECT;
if (!/^magic-shop-mtls-[a-z0-9-]+$/.test(runId)) throw new Error('Invalid run ID');
const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z', '--', 'testing', 'infra', 'operator', 'apps', 'services', 'contracts', 'package.json', 'pnpm-lock.yaml']).toString().split('\0').filter(Boolean).sort();
const hash = createHash('sha256');
for (const path of new Set(files)) if (lstatSync(path).isFile()) hash.update(path).update('\0').update(readFileSync(path));
const dirty = execFileSync('git', ['status', '--porcelain']).length > 0;
writeFileSync(`${process.env.LAB_RFC8705_REPORT_DIR}/provenance.json`, JSON.stringify({
  evidence: 'local-rfc8705-recorded-run', runId, project: runId, attempt: 1,
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(), sourceDirty: dirty,
  sourceContent: hash.digest('hex'), startedAt: new Date().toISOString(),
  selections: ['chrome', 'msedge'], runner: 'playwright', persona: 'shop-admin', phase: 'baseline',
  scope: 'real-provider browser authorization with test-owned callback capture; real API navigation; separate API checks',
}, null, 2));
