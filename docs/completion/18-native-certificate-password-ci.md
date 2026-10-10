# TEST-02 — Native certificate-plus-password CI

Date: 2026-10-10, America/Chicago. Native matrix, report upload and successful/intentional-failure cleanup observed in run 38027680587. The separate cancellation control is recorded below after execution.

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
project teardown remains the fallback. Cancellation is tested in a separate workflow run; its result is recorded separately from the passing matrix.

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
use existing full-SHA pins. Native host/tool versions and results are recorded below.

Primary references: [Playwright reporter API](https://playwright.dev/docs/api/class-reporter),
[Cucumber formatter interface](https://github.com/cucumber/cucumber-js/blob/main/docs/custom_formatters.md),
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

The local intentional-failure control exited 1 with its explicit marker, then
fixture finish/verify passed. Whole-project cleanup verified all local labelled
containers/networks/volumes absent. Existing container quality checks passed
(105 authored files, 541 functions), all 23 Mermaid blocks rendered, and 20
affected documentation links passed. A no-network reporter failure control kept
the failure status while discarding credential-shaped raw errors, stdout and
attachments; its exported artifact scan passed at three entries.

## Observed native acceptance

[Run 38027680587](https://github.com/orieken/testing-with-certs/actions/runs/38027680587)
completed with **success** at code revision
`a314de16722a5d539af617ff4b49af6d80ea3147` on branch
`codex/test-02-native-certificate-password`. All seven jobs passed, including the
existing live contract/security/eight browser-selection regression job and the
new teaching job. This is a native run, not Apple Silicon emulation evidence.

Native teaching job `114142124102` used GitHub-hosted Ubuntu 24.04.5 LTS,
`ubuntu-24.04` runner image `20261004.327.1`, Actions runner 2.337.0, and
linux/amd64 containers. Browser version output in the same native workflow
confirmed Chrome 155.0.8059.39, Edge 154.0.4258.62 and Node 24.19.0. Playwright
1.61.0 and Cucumber 12.9.0 remain frozen-lockfile dependencies. Keycloak 26.4.0
uses `sha256:5f3fb534cde6bf006d79f5912473e5d2c828c707cdfc52e16972803aca9d43dd`.
Checkout pin is `d23441a48e516b6c34aea4fa41551a30e30af803`; artifact upload pin
is `ea165f8d65b6e75b540449e92b4886f43607fa02`.

| Native runner | Chrome | Edge |
| --- | ---: | ---: |
| Playwright | 9/9 | 9/9 |
| Cucumber | 9/9 | 9/9 |

The completeness gate passed all 36 required case names and statuses. Credential
scanning passed (12 entries), all eight text report files were host-readable and
artifact upload succeeded. Fixture credentials/sessions were removed and verified.
Cleanup verified no project-labelled resources for
`magic-shop-password-ci-38027680587-1` and
`magic-shop-password-failure-38027680587-1`. The failure control's expected exit 1
and marker were observed, followed by credential verification and final cleanup.
No retry, mock authentication or TLS bypass was used.

Uploaded artifact `certificate-password-38027680587-1`, ID `11660788405`, is 2,506
bytes with archive digest
`sha256:d70106ce9e9f1c224b583350096c639f3ba9b7c89ecdcabdb4a97b70b562c1fb`.
It contains only the four JUnit and four safe results JSON files. Downloaded
reports independently passed the completeness gate and scanner. Native job logs
are local review artifacts, separate from the uploaded report allowlist.

```sh
gh run view 38027680587 --json status,conclusion,jobs,url
gh run download 38027680587 --name certificate-password-38027680587-1 --dir artifacts/native-certificate-password/38027680587
gh api --allow-escape-sequences repos/orieken/testing-with-certs/actions/jobs/114142124102/logs > artifacts/native-certificate-password/38027680587/native-job.txt
gh api --allow-escape-sequences repos/orieken/testing-with-certs/actions/jobs/114142124060/logs > artifacts/native-certificate-password/38027680587/regression-job.txt
```

The downloaded-report checks ran in the existing local runner container with
`--network none`, `--entrypoint node`, a read-only bind to
`/work/artifacts/certificate-password-ci`, and respectively
`/work/testing/reporting/check-password-matrix.mjs` and
`/work/testing/container/check-artifacts.mjs /work/artifacts/certificate-password-ci`.
The native job itself ran the new completeness gate from the tested revision.

Human password provisioning/manual lesson demonstration, native manual viewer,
PR-base mutation acceptance and TEST-01/03–11 remain separate open items. No
Saturday checkout, production deployment or publishing action occurred.

## Observed native cancellation cleanup

[Run 38028333657](https://github.com/orieken/testing-with-certs/actions/runs/38028333657)
was explicitly dispatched from the same code revision, then deliberately cancelled
after its live teaching stack became healthy. The teaching matrix step was in its
runner build when cancelled. It is cancellation-control evidence, not another
passing matrix. The complete-matrix/report gates failed on absent evidence,
upload was skipped, and both `always()` cleanup steps **passed**. Job
`114143998937` and the workflow correctly concluded `cancelled`.

Native logs verified no remaining project-labelled containers/networks/volumes
for `magic-shop-password-ci-38028333657-1` and
`magic-shop-password-failure-38028333657-1`. The latter failure-control stack had
not started; its absence assertion is idempotent cleanup evidence, not an
intentional-failure test. The intentional-failure control passed separately in
run 38027680587. This cancellation occurred during runner build, not mid-password
entry; no universal guarantee against abrupt runner/daemon loss is claimed.

```sh
gh workflow run ci.yml --ref codex/test-02-native-certificate-password
gh run view 38028333657 --json status,conclusion,jobs
gh run cancel 38028333657
gh api --allow-escape-sequences repos/orieken/testing-with-certs/actions/jobs/114143998937/logs > artifacts/native-certificate-password/38028333657/cancellation-job.txt
```

TEST-02 acceptance is complete: native 36/36, scanned/readable uploaded text
reports, successful and intentional-failure credential/resource cleanup, and a
separate observed cancellation cleanup. Documentation-only evidence updates are
committed after these runs; the runtime/workflow code tested is revision a314de1.

Final downloaded native reports/logs passed the credential scanner (17 entries).
The final observed CI diagram was rendered again in the pinned no-network Mermaid
container; all 80 affected documentation file links and `git diff --check` passed.
Only documentation differs from the native-tested runtime/workflow revision in
the closeout commit. Session logout and password removal do not establish instant
revocation of already issued access tokens; existing lifetime limits still apply.
