# Saturday reporting packages

Three coordinated packages extract the report presentation into a Node library usable by ordinary projects:

| Package | Purpose |
| --- | --- |
| `@orieken/saturday-reporting` | Schema v1 types, portable HTML renderer, media export, and merge CLI |
| `@orieken/saturday-playwright-reporter` | Playwright Test results, steps, attempts, annotations, and attachments |
| `@orieken/saturday-cucumber-formatter` | Cucumber features, example rows, hooks, attempts, tags, and attachments |

The packages use TypeScript and ESM with Node 24.x. The adapters declare exact initial peers: Playwright 1.61.0 and Cucumber 12.9.0. Saturday framework packages are optional producers of metadata, not runtime dependencies. The Cucumber adapter uses the Formatter API shipped in 12.9.0, not an unverified later plugin API.

See the package READMEs for [Playwright configuration](../packages/saturday-playwright-reporter/README.md), [Cucumber configuration and video hooks](../packages/saturday-cucumber-formatter/README.md), and [core types, merging, and artifact policy](../packages/saturday-reporting/README.md).

## Build and verify

```sh
pnpm install --frozen-lockfile
pnpm build:reporting
pnpm test:reporting
pnpm --filter @orieken/saturday-playwright-reporter exec playwright install chromium
pnpm test:reporting:browser
```

For an installed Chrome instead of bundled Chromium:

```sh
pnpm --filter @orieken/saturday-playwright-reporter exec playwright install ffmpeg
SATURDAY_BROWSER_CHANNEL=chrome pnpm test:reporting:browser
```

Verification builds and packs all three packages, installs their tarballs into temporary projects outside the workspace, checks shipped declarations and assets, and runs both examples. It compares original attempt statuses with Playwright JSON and Cucumber messages, exercises parallel execution, retries, expected failures, unexpected passes, timeouts, hook failures, undefined/pending/ambiguous/skipped steps, duplicate titles, scenario outline rows, empty runs, graceful Playwright interruption, and successful reruns. Deliberate failures must produce the expected runner exit status; they are test fixtures.

Browser verification records a real page in each runner, merges the reports, relocates the output, plays both recordings, and checks search, metadata filters, themes, heatmap, inspector, playback speed, theater mode, and hostile-title rendering. No authentication services are needed. Core tests additionally cover missing/disabled media, schema rejection, duplicate inputs, media deduplication, path escapes, symlinks, safe replacement, and failed-write rollback.

The output under `artifacts/saturday-reporting/` contains three tarballs, a combined example report, a screenshot when browser checks run, and `verification.json`. Example reports deliberately include failing scenarios; a failed run label is expected. The dedicated [CI workflow](../.github/workflows/saturday-reporting.yml) verifies standalone packages with pinned Node 24.10 and bundled Chromium, and runs a separate native live-authentication job with real Chrome and Edge. Its output is a CI artifact, not a GitHub Pages publication.

Local implementation verification passed on macOS with Node 24.11.1 and installed Chrome, and in a clean Linux arm64 container with Node 24.10.0 and bundled Chromium. Each run verified all three tarballs, eight core tests, twelve Playwright cases, twelve Cucumber scenarios, both recordings, graceful interruption, and empty runs. Seven existing recording/naming/cleanup regressions and the repository source-complexity check also passed. Native GitHub amd64 verification subsequently passed both standalone and live-authentication jobs in [run 44225962468](https://github.com/orieken/testing-with-certs/actions/runs/44225962468): 36/36 live cases, 68 attached clips played, fixture restoration, and independent project cleanup. See [completion 71](completion/71-saturday-reporting-pilot.md) for source revision, artifacts, fixes, and observed limits.

## Existing-suite pilot

The certificate/password Playwright config accepts `SATURDAY_REPORT_DIR` to add the package beside its existing sanitized reporter. The equivalent Cucumber pilot is `testing/cucumber.saturday.mjs`. Run the complete disposable pilot from the repository root:

```sh
LAB_PROJECT=magic-shop-saturday-UNIQUE sh testing/run-saturday-auth-pilot.sh
```

The wrapper starts the real stack, runs all 36 Chrome/Edge × Playwright/Cucumber cases, compares the new results and clip hashes with existing producer receipts, verifies playback and text privacy, restores fixtures, and independently verifies removal of its project resources. Use a new lowercase project suffix for every attempt. Reports are retained in `artifacts/saturday-auth-pilot/PROJECT/`; legacy evidence is in `artifacts/certificate-password-ci/PROJECT/`.

For an already provisioned teaching test environment, from the testing directory:

```sh
LAB_BROWSER=chrome SATURDAY_REPORT_DIR=/home/runner/saturday-password-playwright \
  ./node_modules/.bin/playwright test --config playwright.password.config.mjs
LAB_BROWSER=chrome SATURDAY_REPORT_DIR=/home/runner/saturday-password-cucumber \
  ./node_modules/.bin/cucumber-js --config cucumber.saturday.mjs
```

Run inside the existing teaching container with its fixture, trust, identity mounts, and cleanup procedure. An output path under `/home/runner` is writable there. Mount a separate destination when retaining pilot artifacts. Do not treat this as a host-only command or use a retained interactive project for automated acceptance.

Both pilots keep the original results producer active. Compare their nine named certificate/password checks with the new report’s nine tests, original statuses, and browser/runner labels. With `LAB_PASSWORD_REPORTS=1`, the existing recording harness hides provider documents before paint and attaches each finalized clip to its exact test in both reporters. The pilot disables runner step export (`includeSteps: false`) because Playwright API step titles can contain entered values. Its comparison scans exported text for the actual temporary passwords while the fixture still exists. Standalone package checks and live provider acceptance remain separate evidence.

The Go operator, provider-specific validators, CI inventories, sanitization gates, and public Pages publisher retain their current behavior. The packages neither assert that the full authentication protocol inventory passed nor publish reports automatically. Expanding adoption across the remaining suites follows a successful provider-backed pilot comparison.

## Release checklist

The [npm deployment guide](saturday-npm-publishing.md) describes tagged publishing, manual dry-runs, coordinated versions, and the one-time npm trusted-publisher setup.

- [x] REPORT-PKG-01–05: three package scaffolds, versioned shared model, ported gallery, generic metadata filters, portable artifact export.
- [x] REPORT-PKG-06–10: runner adapters, Cucumber recording example, optional Saturday labels, merge CLI.
- [x] REPORT-PKG-11–13: standalone tarball consumers, runner baseline comparisons, edge cases, browser and artifact checks.
- [x] REPORT-PKG-14: opt-in existing-suite pilots and container package/build integration.
- [x] REPORT-PKG-15–17: integration documentation, exact initial compatibility declarations, and publishable tarball preparation.
- [x] Run the provider-backed certificate/password pilot in both runners: all 36 cases and 68 attached clips passed in native CI; legacy results, producer media hashes, text privacy, fixture restoration, and project cleanup were independently checked.
- [x] Observe both new Linux workflow jobs passing on GitHub in run 44225962468; download and independently inspect their uploaded artifacts.
- [ ] Publish core first, then adapters, after reviewing the release tarballs and confirming npm scope ownership. Registry publication is a separate action.

To prepare release artifacts without publishing:

```sh
pnpm build:reporting
pnpm --filter @orieken/saturday-reporting pack --pack-destination ../../artifacts/saturday-reporting
pnpm --filter @orieken/saturday-playwright-reporter pack --pack-destination ../../artifacts/saturday-reporting
pnpm --filter @orieken/saturday-cucumber-formatter pack --pack-destination ../../artifacts/saturday-reporting
```

Use pnpm to pack: it rewrites workspace dependencies into registry versions. The adapters depend on the matching core version; the tarball integration checks ensure no workspace paths leak into the installed package manifests. Only claim additional Node or runner version ranges after adding and observing their compatibility jobs.
