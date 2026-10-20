# Browser container matrix

The [public report](https://orieken.github.io/testing-with-certs/) contains 92 fresh selections and 952 videos from the successful 19-job native run; [completion 59](completion/59-public-video-matrix.md) records acceptance and expected skips. For a new complete run and portable export, follow the [Pages publication guide](pages-report.md).

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

Use a fresh disposable project name for each run. The current inventory requires 212 protocol executions (128 baseline plus 20 passkey, 20 OIDC, 24 SAML, and 20 Kerberos lifecycle executions) and 48 password/TOTP executions (28 baseline + 20 session/refresh) across Chrome/Edge and Playwright/Cucumber. Both commands check exact case completeness before credential scans. Password/TOTP Cucumber parity passed locally and natively in [completion 37](completion/37-password-otp-cucumber.md); passkey parity also passed in [completion 38](completion/38-passkey-cucumber.md). OIDC parity also passed in [completion 39](completion/39-oidc-cucumber.md). SAML parity also passed in [completion 40](completion/40-saml-cucumber.md). Kerberos parity also passed in [completion 41](completion/41-kerberos-cucumber.md), completing both-runner evidence for all five methods. [Completion 42](completion/42-saml-role-mapping.md) adds four scoped SAML role-mapping cases in each runner/browser. [Completion 43](completion/43-password-otp-session-refresh.md) adds five shared OTP lifecycle cases in each runner/browser, using disposable client-specific lifetimes and verified restoration; browser expiry clears sign-in, while refresh is tested privately at the protocol level. [Completion 44](completion/44-passkey-session-refresh.md) records five shared passkey lifecycle cases passing locally and natively in separate Playwright/Cucumber phases, with virtual credential isolation, private refresh checks, and client-policy restoration. [Completion 45](completion/45-oidc-session-refresh.md) records controlled external OIDC broker lifecycle checks passing locally and natively in separate runner phases, including provider re-entry, private broker refresh, identity/audience/API boundaries, and policy restoration. [Completion 46](completion/46-saml-session-refresh.md) records six SAML broker lifecycle checks passing locally and natively in separate runner phases, including mapped/no-role refresh controls and verified policy restoration. [Completion 47](completion/47-kerberos-session-refresh.md) records five Kerberos token/session checks passing in each runner/browser, with owned cache/profile cleanup and verified client-policy restoration. The current native inventory passed 260/260, including 40/40 Kerberos executions, with all 15 jobs green. UBI9 parity is not established by these Bookworm lesson runners. The [authentication protocol matrix](teaching-coverage.md#authentication-protocol-matrix) records local versus native passes and remaining acceptance; cached-image versions are identified in each completion note.

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
artifacts/matrix/<same-selection>/matrix.html
artifacts/teaching/<timestamp>-os-<os>-<runner>-<browser>-<user>-teaching-<row>/
artifacts/playwright/<timestamp>-os-<os>-playwright-<browser>-<user>-recorded-<row>/
```

The JSON manifest, readable Markdown table, and HTML video gallery are updated after each suite. Open `matrix.html` to play or download every nonempty WebM/MP4 under each selection, including multiple pages and HTML report copies. The gallery groups recordings by OS, browser, runner, user, suite, and run ID. Cards show spec filenames, test titles, and result badges from the saved Playwright report. Byte-identical copies inherit those labels only when the association is unambiguous. Search and authentication-type/browser/runner/result filters narrow the gallery. Auth-type options include saved-video counts, and each selection displays its auth label. The existing 28 certificate-shop selections use Certificate / mTLS; zero-count methods have no saved videos in this report. New manifests carry an explicit `auth_type` field so future method-specific selections need no title-based guessing. Source paths sit behind a disclosure. Legacy Cucumber videos show their feature file and an explicit unlinked result rather than a guessed scenario; suite status remains separate. Videos load only when played.

Rebuild a gallery from an existing manifest without rerunning tests:

```sh
./lab matrix-report artifacts/matrix/<selection>/matrix.json
```

New manifest report paths are relative to the manifest, and video paths are relative to each suite report directory. To move or download artifacts, retain the `artifacts/matrix`, `artifacts/teaching`, and `artifacts/playwright` relative layout. Historical absolute paths are rebased onto the current checkout's artifacts tree when their original folders are absent. Missing folders and selections without recordings are labeled; rebuilding refreshes their availability. Symlinks and paths outside the artifact tree are rejected by the rebuild command. The report works as local HTML or through a local static server; copying only `matrix.html` does not include its videos.

Authentication and certificate/password capture now uses the shared browser-context recorder in both runners, including popup pages and Kerberos persistent profiles. Credential-provider documents appear as a neutral privacy screen; the shop and lesson UI remain visible. Private API refresh requests are represented by their case result and surrounding browser journey, not filmed token bodies. Recording does not enable traces or raw failure attachments. The 28 original certificate-shop selections stay separate from imported auth selections.

The capture commands require every expected case, a nonempty recording, exact case/runner/phase metadata, and the existing credential-artifact scan. Successful runs export `recording-matrix.json` and per-selection `video-cases.json`. The certificate/password recording command uses `LAB_PASSWORD_REPORTS=1`. After downloading CI artifacts, rebuild and verify their indexes using the same source, then merge them into a saved gallery:

```sh
node testing/reporting/auth-recording-index.mjs auth-lessons artifacts/auth-lessons/RUN
node testing/reporting/auth-recording-index.mjs password-otp artifacts/password-otp/RUN
node testing/reporting/auth-recording-index.mjs certificate-password artifacts/certificate-password-ci/RUN
./lab matrix-merge artifacts/matrix/SELECTION/matrix.json artifacts/auth-lessons/RUN/recording-matrix.json artifacts/password-otp/RUN/recording-matrix.json artifacts/certificate-password-ci/RUN/recording-matrix.json
```

Merging replaces an already-imported report directory instead of duplicating it. Keep all referenced auth artifact folders when moving the combined gallery. New auth recordings carry exact case metadata for Playwright and Cucumber; legacy certificate-shop Cucumber videos remain explicitly unlinked. [Completion 51](completion/51-authentication-recordings.md) tracks capture acceptance and earlier partial runs. [Completion 49](completion/49-matrix-report-style-spec-results.md) records the styled report and verified Playwright associations. [Completion 48](completion/48-matrix-video-gallery.md) records validation against the saved matrix.

The manifest records each selection and its available video paths. It also records report path,
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
`sh testing/run-all.sh all` for the existing broader all-service workflow. Ordinary CI retains its existing OS coverage. An explicit `full_evidence=true`
dispatch adds both complete Debian/UBI9 certificate-shop recording matrices;
the separate authentication lesson jobs retain their Debian runners.

UBI9 remains experimental: it adds CentOS Stream/EPEL desktop packages and uses
live RPM/browser versions. Debian uses the existing locked package set. See
[manual desktops](manual-browser.md#ubi9-browser-containers) for VNC setup.


Certificate-shop Cucumber captures now save exact scenario/video associations. Successful runs verify these against the final Cucumber results, including hook outcomes. To deliberately omit video while retaining explicit per-case evidence, use `LAB_CUCUMBER_RECORD_VIDEO=0 ./lab test --runner cucumber --browser chrome --user shop-admin --suite teaching`. The default is `1`; other values are rejected. The gallery shows intentionally disabled cases separately from missing or expired files, without a player or download link. A disabled case never increases the available video count. `./lab matrix` continues to require recordings for its normal recording acceptance gate; use the direct test command for deliberate disabled-policy validation. [Completion 53](completion/53-live-cucumber-recording-metadata.md) records 28 fresh mapped clips and six live disabled cases.
