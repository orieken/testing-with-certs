# Browser container matrix

Start the app with `./lab up`. Preview or execute the browser matrix:

```sh
./lab matrix --plan
./lab matrix
./lab matrix --os ubi9
./lab matrix --os debian
./lab matrix --os ubi9 --browser msedge
./lab matrix --os ubi9 --browser chrome --runner cucumber --user shop-admin --suite teaching
```

`pnpm run test:matrix` is an optional alias for `./lab matrix`. The direct command
requires Docker Compose and a shell. The Go operator is built in a pinned Go
container and runs as a native host binary. Its Bubble Tea menu also includes
preview, full-matrix, Debian and UBI9 actions.

Every filter defaults to `all`:

| Flag | Values |
| --- | --- |
| `--os` | `debian`, `ubi9`, `all` |
| `--browser` | `chrome`, `msedge`, `all` |
| `--runner` | `playwright`, `cucumber`, `all` |
| `--user` | `customer-waterdeep`, `shop-admin`, `shopkeeper`, `all` |
| `--suite` | `teaching`, `recorded`, `all` |
| `--plan` | Print selections without executing tests or writing reports |

The default matrix contains 28 suite runs, or 14 per OS:

| Suite | Runner | Users per browser | Runs across both OSes/browsers |
| --- | --- | --- | --- |
| Teaching | Playwright | customer, admin, shopkeeper | 12 |
| Teaching | Cucumber | customer, admin | 8 |
| Recorded UI | Playwright | customer, admin | 8 |

Unsupported combinations are omitted when using `all`. Explicit Cucumber plus
shopkeeper or recorded-UI requests are rejected. To select exactly one suite run,
provide OS, browser, runner, user and suite. For example, the final command above
selects one UBI9 Chrome Cucumber teaching run.

## Authentication lessons

The protocol-specific lessons use separate commands and are not included in the 28 `./lab matrix` certificate-shop selections above:

```sh
LAB_PROJECT=magic-shop-auth-NAME sh testing/run-auth-lessons.sh
LAB_PROJECT=magic-shop-otp-NAME sh testing/run-password-otp.sh
```

Use a fresh disposable project name for each run. The current inventory requires 212 protocol executions (128 baseline plus 20 passkey, 20 OIDC, 24 SAML, and 20 Kerberos lifecycle executions) and 48 password/TOTP executions (28 baseline + 20 session/refresh) across Chrome/Edge and Playwright/Cucumber. Both commands check exact case completeness before credential scans. Password/TOTP Cucumber parity passed locally and natively in [completion 37](completion/37-password-otp-cucumber.md); passkey parity also passed in [completion 38](completion/38-passkey-cucumber.md). OIDC parity also passed in [completion 39](completion/39-oidc-cucumber.md). SAML parity also passed in [completion 40](completion/40-saml-cucumber.md). Kerberos parity also passed in [completion 41](completion/41-kerberos-cucumber.md), completing both-runner evidence for all five methods. [Completion 42](completion/42-saml-role-mapping.md) adds four scoped SAML role-mapping cases in each runner/browser. [Completion 43](completion/43-password-otp-session-refresh.md) adds five shared OTP lifecycle cases in each runner/browser, using disposable client-specific lifetimes and verified restoration; browser expiry clears sign-in, while refresh is tested privately at the protocol level. [Completion 44](completion/44-passkey-session-refresh.md) records five shared passkey lifecycle cases passing locally and natively in separate Playwright/Cucumber phases, with virtual credential isolation, private refresh checks, and client-policy restoration. [Completion 45](completion/45-oidc-session-refresh.md) records controlled external OIDC broker lifecycle checks passing locally and natively in separate runner phases, including provider re-entry, private broker refresh, identity/audience/API boundaries, and policy restoration. [Completion 46](completion/46-saml-session-refresh.md) records six SAML broker lifecycle checks passing locally and natively in separate runner phases, including mapped/no-role refresh controls and verified policy restoration. UBI9 parity is not established by these Bookworm lesson runners. The [authentication protocol matrix](teaching-coverage.md#authentication-protocol-matrix) records local versus native passes and remaining acceptance; cached-image versions are identified in each completion note.

## Reports and recordings

New teaching and recorded-UI report names include OS, runner, browser and user.
The OS also appears in Playwright project names, report metadata, Cucumber
scenario telemetry and the matrix manifest. Each run writes `environment.json`
with its actual distribution, browser version, Node version and architecture.
Historical artifacts keep their original names.

Playwright and Cucumber teaching runs now both save browser videos. Cucumber
stores WebM files under its report's `videos/` folder and closes each scenario
context to finish recording. Cucumber exits after its completed run and cleanup,
rather than waiting for idle networking handles. It does not embed video data in Cucumber JSON.
Playwright HTML reports link to their saved recordings.

Matrix results live under:

```text
artifacts/matrix/<timestamp>-os-<selection>-browser-<selection>-.../matrix.json
artifacts/matrix/<same-selection>/matrix.md
artifacts/teaching/<timestamp>-os-<os>-<runner>-<browser>-<user>-teaching-<row>/
artifacts/playwright/<timestamp>-os-<os>-playwright-<browser>-<user>-recorded-<row>/
```

The JSON manifest and its readable Markdown table are updated after each suite. It records each selection, report path,
status, duration, recognized test summary and nonempty video-file count. A suite
counts as successful only when its command passes and saved videos exist. Counts
include report copies of video files and do not equal unique scenario counts.
Execution is serial so both OSes share the live app without racing mutable user
settings. Failures remain in the manifest and later selections continue. The
command exits unsuccessfully if any suite fails or has missing recordings.
Ctrl-C stops the current selection and leaves remaining selections pending.

## CLI implementation and scope

`./lab` is a shell entry point. `./lab matrix` dispatches to the compiled Go
operator, as does `./lab operator matrix`. The operator uses `os/exec` with
argument arrays and timeouts to run the existing lab/container commands. Its TUI
uses Charm's Bubble Tea, Bubbles and Lip Gloss. Test/browser runtimes stay inside
containers. There is no migration of the entire shell wrapper to Go in this change.

The matrix exercises teaching and recorded browser suites against the running
lab. It uses disposable browser containers but shares the live lab's application
data; checkout tests create orders and inventory/widget tests change and restore
selected settings. API contracts, security probes, fault suites and the separate
certificate-plus-password lesson are outside this browser command. Use
`sh testing/run-all.sh all` for the existing broader all-service workflow. That
workflow and CI keep their existing OS coverage; this change does not silently
expand CI or the separate password lesson.

UBI9 remains experimental: it adds CentOS Stream/EPEL desktop packages and uses
live RPM/browser versions. Debian uses the existing locked package set. See
[manual desktops](manual-browser.md#ubi9-browser-containers) for VNC setup.
