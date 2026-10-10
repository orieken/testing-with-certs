# TEST-02 — Native certificate-plus-password CI

Date: 2026-10-10, America/Chicago. Native acceptance pending at implementation
handoff; this note will record the observed workflow before TEST-02 is checked.

## Changes and boundaries

Added a separate Ubuntu 24.04 job to the existing CI workflow, after the pinned
static/service/Compose checks. It runs the existing nine live scenarios under
Chrome/Edge and Playwright/Cucumber (36 cases), including certificate-only shop
regression. It provisions random temporary passwords in a scoped Docker volume;
human demo provisioning remains interactive and separate.

Custom reporter/formatter adapters export only allowlisted case names and status
as mode-0644 JUnit/JSON. Raw assertion errors, token/credential data, attachments
and captured stdout/stderr are excluded. A completeness gate requires all 36
cases, without skipped/missing/duplicate cases. Existing credential scanning and
host readability checks precede pinned text-only artifact upload. Browser HOME
and /tmp use disposable volumes, refreshed between selections; no video, trace,
HAR or saved storage state is exported by this CI job.

The fixture trap is installed before temporary password creation. Cleanup removes
passwords/sessions, verifies both the password file and Keycloak credentials are
absent, and removes profile volumes. A separate script removes only the named
project and verifies no labelled containers, volumes or networks remain. CI uses
bounded `always()` cleanup for both successful and failing projects, including
cancellation. Runner/host forced termination can prevent fixture traps; whole
project teardown remains the fallback. No actual cancellation observation is
claimed until separately recorded.

A second fresh stack injects a deterministic failing runner after fixture start.
The job requires exit 1 and the explicit intentional-failure marker, then verifies
credential cleanup and whole-project cleanup. This control is separate from the
36 passing browser cases and cannot manufacture a green authentication result.

No Vue, realm flow/client, HAProxy routing, PKCE, certificate mapping, token/API
authorization, canonical contract or Saturday checkout changes are made. Lesson
tokens remain rejected by business APIs; the shop remains certificate-only.

## Commands and environment

Local verification uses macOS arm64 Docker Desktop with linux/amd64 browser
emulation; it cannot close native acceptance:

```sh
LAB_PROJECT=magic-shop-password-local-18 ./lab up
LAB_PROJECT=magic-shop-password-local-18 LAB_PASSWORD_REPORTS=1 sh testing/run-certificate-password.sh
LAB_PROJECT=magic-shop-password-local-18 sh testing/cleanup-certificate-password.sh
```

Native CI selects `magic-shop-password-ci-<run-id>-<attempt>` for the full matrix
and `magic-shop-password-failure-<run-id>-<attempt>` for failure cleanup. The job
runs the same wrapper with `LAB_PASSWORD_REPORTS=1`, checks completeness using
`testing/reporting/check-password-matrix.mjs`, scans reports using
`testing/container/check-artifacts.mjs`, verifies approved report files are readable,
uploads only `*/junit.xml` and `*/results.json`, and invokes the cleanup script.
The failure project uses `LAB_PASSWORD_REPORTS=0 LAB_PASSWORD_FORCE_FAILURE=1`.

Existing pinned runtime/browser packages are retained: Node 24.19.0,
Playwright 1.61.0, Cucumber 12.9.0, Chrome 155.0.8059.39 and Edge 154.0.4258.62.
Runner base digest is
`sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df`.
Keycloak remains 26.4.0 at the existing Compose image digest. Checkout and upload
use existing full-SHA pins. Exact native host/tool versions and results will be
added from that run, rather than inferred from local packages.

Primary references: [Playwright reporter API](https://playwright.dev/docs/api/class-reporter),
[Cucumber formatter interface](https://github.com/cucumber/cucumber-js/blob/v12.9.0/docs/custom_formatters.md),
and [GitHub cancellation semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-cancellation).
The installed pinned Cucumber formatter/event collector source was also inspected
inside the runner before implementing its adapter.

## Local verification

The local Docker matrix exited 0 with 9/9 in each of the four selections (36/36).
The complete-case gate passed and credential artifact scanning passed at 12
entries. Fixture finish and verification both passed; passwords/sessions were
removed and no transient password file or account password remained. Compose
configuration and shell/JavaScript syntax checks passed in containers. A premature
completeness probe while the final Cucumber selection was still running correctly
rejected its missing report; the completed matrix passed the gate. This is a
missing-evidence negative control, not a failed authentication scenario.
