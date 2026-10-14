# OS-labeled browser reports and Go matrix CLI

Implemented on October 14, 2026. `./lab matrix` dispatches through the shell
launcher to the compiled Go operator. The operator uses argument-array child
process execution with bounded timeouts; its existing TUI uses Bubble Tea,
Bubbles and Lip Gloss. It remains a native host binary built in the pinned Go
container, with browser/test runtimes inside Docker.

## Resulting behavior

New teaching, recorded UI and contract run directories include the runner OS.
The browser reports also include OS in Playwright project names and metadata,
Cucumber telemetry, and an allowlisted `environment.json` with actual OS/browser
versions. Supplied matrix run IDs are validated and preserved. Historical report
paths remain unchanged.

Cucumber certificate hooks accept optional video recording configuration without
allowing trust or client-certificate overrides. Existing context cleanup finalizes
videos, including failed scenario cleanup. The teaching adapter enables saved
WebM videos for named runs and does not embed binary recordings in Cucumber JSON.
The CLI uses Cucumber's completed-run exit option to avoid waiting on idle
network handles after hooks and formatters finish.

The Go matrix command supports OS, browser, runner, user and suite filters.
`--plan` enumerates selections without starting tests or writing reports. Default
coverage is 28 suite runs: 20 teaching and 8 recorded UI, or 14 per OS. Explicit
unsupported selections fail validation. The Bubble Tea menu exposes previews and
all/one-OS matrix actions. Root package alias: `pnpm run test:matrix`.

Execution is serial against the existing live lab. A selection passes only when
its command succeeds and nonempty videos exist. Failures remain recorded and
later selections continue. The incremental JSON manifest and Markdown table
include selection, image, report path, status, duration, recognized sanitized
summary and video-file count. Failure/cancellation cleanup targets only the
selection's generated container name with a fresh bounded cleanup context.

## Verification

- Go operator tests passed in the pinned Go container, including plan/filter
  validation, supplied OS/image arguments, continuation after failures, missing
  recordings, exact-name cancellation cleanup, and safe JSON/Markdown output.
- All 11 certificate package tests passed, including recording opt-in, enforced
  certificate trust and context closure on initialization/cleanup failure.
- Seven wrapper/container regression checks passed, including existing all-service
  orchestration tests and new report-name/matrix-ID tests.
- UBI9 runner TypeScript checking passed. Shell syntax, Compose/architecture and
  whitespace checks passed.
- Actual CLI preview produced 28 full-matrix rows, 14 UBI9 rows, and exactly one
  explicitly selected UBI9 Edge/Cucumber/admin teaching row.
- Preflight UBI9 Cucumber and Debian Playwright runs passed with persistent videos,
  OS-labeled directories and actual runtime metadata.

Full browser execution command:

```sh
./lab matrix --os all
```

## Scope

The browser matrix covers the teaching and recorded UI suites, including saved
Cucumber videos. It does not expand CI, fault probes, API security/contracts or
the separate certificate-plus-password lesson into a new OS matrix. The broader
`testing/run-all.sh` workflow retains its existing scope. Test browser containers
are disposable, but they use the running lab's application data.

UBI9 remains an experimental UBI9/Stream/EPEL package combination with unpinned
RPM/browser resolution. Local verification uses Docker Desktop linux/amd64
emulation on Apple Silicon; it is not native Linux evidence. Video-file counts
include HTML-report copies and recordings for skipped Playwright fixtures, so
they are not unique executed-test counts.

See [commands and report locations](../browser-matrix.md).

## Observed full-matrix outcome

The full run exited 0: **28 passed, 0 failed, 0 pending**. Debian/Chrome,
Debian/Edge, UBI9/Chrome and UBI9/Edge each passed all seven suite selections.
All 28 environment records match their OS/browser/user/run ID and every saved
WebM is nonempty. JUnit totals are 112 passed, 60 expected role-specific skips and 0 failures.
Each combination saved 103 WebM files including report copies, for 412 files
across the matrix; these are not 412 unique executed tests.

The local result table is at
`artifacts/matrix/20261014T131439-794930000Z-os-all-browser-all-runner-all-user-all-suite-all/matrix.md`,
with the detailed JSON manifest beside it. The run used approximately 835 seconds
of serial suite execution, including the earlier Debian Edge/Cucumber idle-exit
delays. UBI9 Cucumber used the completed-run exit option and preserved its videos.
