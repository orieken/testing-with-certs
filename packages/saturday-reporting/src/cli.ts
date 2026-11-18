#!/usr/bin/env node
import { mergeReports } from './index.js';
const args = process.argv.slice(2);
try {
  if (args.shift() !== 'merge') throw new Error('Usage: saturday-report merge --output DIR [--title TITLE] report.json ...');
  const files: string[] = [];
  let outputDir = 'saturday-merged-report', title: string | undefined;
  while (args.length) {
    const arg = args.shift()!;
    if (arg === '--output' || arg === '--title') {
      const value = args.shift();
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      if (arg === '--output') outputDir = value; else title = value;
    } else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}`);
    else files.push(arg);
  }
  console.log(mergeReports(files, { outputDir, title }));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Report merge failed');
  process.exitCode = 1;
}
