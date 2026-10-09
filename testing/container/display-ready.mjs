import { expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
await expect.poll(() => {
  try { execFileSync('xdpyinfo', [], { timeout: 1000, stdio: 'ignore' }); return true; }
  catch { return false; }
}, { timeout: 15_000 }).toBe(true);
