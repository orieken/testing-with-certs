# Saturday reporting

Portable HTML test reports with a gallery, heatmap, split inspector, search, themes, attempt history, steps, and video playback. No Go binary or Saturday test framework is required.

Use `@orieken/saturday-playwright-reporter` for Playwright Test or `@orieken/saturday-cucumber-formatter` for Cucumber.js. This package supplies their shared renderer, types, and merge CLI.

## Merge reports

```sh
npx saturday-report merge --output combined-report \
  playwright-report/report.json cucumber-report/report.json
```

Install this package directly to use its CLI. Inputs must be portable Saturday schema v1 reports, with their media directories intact. Set the same `runId` and distinct `shard` values for shards of one run. Runner, run ID, and shard identify each input; duplicate identities fail rather than double-counting results. Test IDs are local to those identities. Attempts stay with their original test and shard.

## API

```ts
import { writeReport, mergeReports, type Report } from '@orieken/saturday-reporting';
writeReport(report satisfies Report, {
  outputDir: 'saturday-report',
  title: 'My test report',
  artifactRoots: [process.cwd()],
});
```

`Report` contains `schemaVersion: 1`, `title`, and `runs`. Runs contain identity, runner, status, optional timing, metadata, and tests. Each test retains its suite, optional source location, metadata, outcome, and attempts. Attempts retain normalized and raw statuses, durations, nested steps, and attachments. A failed attempt followed by a passing attempt is flaky. See the shipped declarations for the complete contract.

Input attachments can contain `path` or `body: Uint8Array`. Output attachments contain only a relative media path and availability. Supported media: WebM, MP4, PNG, JPEG, and GIF. Explicitly attached media is deduplicated by content; matching bytes never infer a scenario association.

## Output and privacy

The output directory contains `index.html`, `report.json`, optional `media/`, and an ownership marker. Move or archive the entire directory. HTML works offline and uses no CDN fonts or runtime network requests. Ordinary static hosting also works; automatic publishing is outside this package.

Only supported, explicitly attached media is copied. Missing files retain their test result and show an unavailable notice. Disabled recording requires explicit producer metadata. Unsupported attachment contents, raw errors, stdout, environment variables, and Playwright HTML archives are excluded. This is not automatic secret redaction: titles, step names, labels, screenshots, and videos still contain producer-supplied data. Review them before sharing.

File attachments must stay inside `artifactRoots` and cannot traverse symlinks. New output directories are created atomically. Existing output is replaced only when it has the Saturday ownership marker; unrelated directories are refused. Keep report output separate from test artifacts and use a separate output directory for each concurrent invocation.

## Compatibility and release

Initial version: **0.1.0**. Node **24.x**, ESM only. Runner versions are declared by the adapter packages. Build with `pnpm build:reporting`; verify packed standalone installs with `pnpm test:reporting`. Add `--browser` to the verification script to include recorded browser playback. The repository guide documents release verification and limits.
