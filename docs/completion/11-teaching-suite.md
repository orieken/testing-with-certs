# 11 — Shared Saturday teaching suite and security evidence

Observed 2026-10-08 UTC on macOS arm64 with Docker Desktop (`aarch64` server), using pinned linux/amd64 Bookworm runner images under emulation. Real Google Chrome 154.0.8037.97 and Microsoft Edge 154.0.4258.62, Playwright Test 1.61.0, Cucumber 11.3.0 and Node 24.10.0 were exercised. Native Linux amd64 remains deferred at the user's request. **This is a completed teaching and contract increment; Prompt 11's full negative matrix remains open.**

## Changes

- Updated the imported `MagicShop` to shared Saturday `BaseSite`, `BasePage`, `BaseElement` and `BaseFlow` models for live certificate login, account, cart, widget and admin reporting interactions. The runner image compiles the site models for both TypeScript Playwright and JavaScript Cucumber use. Business assertions remain in each runner's examples.
- Added live customer and administrator examples in `testing/playwright/teaching.spec.ts` and `testing/cucumber/features/teaching.feature` with package-backed selected identity and both exact certificate origins. They include cart add/remove before checkout and logout/revisit through a fresh certificate login. Role-inapplicable examples are explicitly skipped/tag-filtered. The imported preview feature text remains reference material.
- Added `./lab test --runner playwright|cucumber --browser chrome|msedge --user SEED_USER`, `./lab test --runner playwright --suite contracts|security|package`. The contract command runs validator and live provider projects, then enforces all 23 operations' required status coverage. The package command packs and installs into an independent consumer without publishing.
- The package's Playwright certificate-context fixture now honors `video: 'on'` and attaches WebM recordings. Playwright reports include HTML/JUnit; Cucumber reports include JSON/JUnit and local scenario timing/status metadata. A containerized post-run scan rejects credential-like files and report text; traces, HAR and browser storage state stay off.
- Added a focused browserless live security suite for missing user certificates, wrong server hostname and missing private CA, ID-token rejection, forged identity headers, human-cert backend bypass, parallel customer identities, second-customer order ownership and shopkeeper write permission. A separate `runner-security` profile mounts only the three needed human identity leaves and public trust. Added an explicit one-byte deployed OpenAPI artifact drift rejection check. The [per-ID matrix](../teaching-coverage.md) distinguishes observed, partial and open cases.
- Extended that isolated security suite with missing/truncated/unsigned/unknown-key bearer probes at each of the three business APIs, plus certificate/token mismatch, self-profile resolution and guessed cross-user profile/layout paths. These checks do not require or mount service credentials.
- Added the reverse private-service pairing probe in the catalog contract suite: a valid catalog service token accompanied by the reporting service certificate is rejected. The existing customer reporting probe tests the converse with a valid reporting token and catalog certificate.
- Bounded teaching runs to one through four Playwright workers; `fullyParallel` lets independent examples use those workers even though they share one spec file. Concurrent customer and admin jobs use unique report IDs.
- Added browser-level MAP-01 cases for the local Locations map. In real Chrome and Edge they verify three markers and two enabled overlays while offline, no external requests, an allowed geolocation pan, and a denied-permission fallback that leaves the map usable. Allowed and denied permissions use separate fresh contexts.

## Exact commands and observed results

All builds, package installation, browser runs and tests used containers. The host wrapper only invoked Docker Compose, created local report directories and validated shell syntax. No host Node, Go, Python, OpenSSL or certificate installation was used.

```sh
docker compose -f infra/compose.yaml --profile test build runner-test
docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-test sh -c 'cd /work/testing && /work/testing/node_modules/.bin/tsc --noEmit'
./lab test --runner playwright --browser chrome --user customer-waterdeep
./lab test --runner playwright --browser msedge --user customer-waterdeep
./lab test --runner playwright --browser chrome --user shop-admin
./lab test --runner playwright --browser msedge --user shop-admin
./lab test --runner cucumber --browser chrome --user customer-waterdeep
./lab test --runner cucumber --browser msedge --user customer-waterdeep
./lab test --runner cucumber --browser chrome --user shop-admin
./lab test --runner cucumber --browser msedge --user shop-admin
./lab test --runner playwright --suite contracts
./lab test --runner playwright --suite security
./lab test --runner playwright --suite package
LAB_TEST_WORKERS=2 ./lab test --runner playwright --browser chrome --user customer-waterdeep
LAB_TEST_WORKERS=2 ./lab test --runner playwright --browser msedge --user shop-admin
./lab test --runner playwright --browser chrome --user shop-admin
./lab test --runner playwright --browser msedge --user shop-admin
LAB_TEST_WORKERS=2 ./lab test --runner playwright --browser chrome --user customer-waterdeep
LAB_TEST_WORKERS=2 ./lab test --runner playwright --browser msedge --user shop-admin
```

The final strict TypeScript check passed. The teaching matrix passed as follows; role-inapplicable Playwright cases were expected skips. Each listed Playwright report has WebM files and passed the credential-artifact scan. Cucumber reports contain JSON, JUnit and limited local telemetry; all were scanned.

| Runner / role / browser | Result | Local report directory under `artifacts/teaching/` |
| --- | --- | --- |
| Playwright / customer / Chrome | 4 passed, 1 skipped | `20261008T041906Z-playwright-chrome-customer-waterdeep-52491` |
| Playwright / customer / Edge | 4 passed, 1 skipped | `20261008T042008Z-playwright-msedge-customer-waterdeep-52963` |
| Playwright / admin / Chrome | 3 passed, 2 skipped | `20261008T042103Z-playwright-chrome-shop-admin-53415` |
| Playwright / admin / Edge | 3 passed, 2 skipped | `20261008T042151Z-playwright-msedge-shop-admin-53818` |
| Cucumber / customer / Chrome | 4 scenarios, 14 steps passed | `20261008T041938Z-cucumber-chrome-customer-waterdeep-52742` |
| Cucumber / customer / Edge | 4 scenarios, 14 steps passed | `20261008T042038Z-cucumber-msedge-customer-waterdeep-53203` |
| Cucumber / admin / Chrome | 3 scenarios, 11 steps passed | `20261008T042128Z-cucumber-chrome-shop-admin-53618` |
| Cucumber / admin / Edge | 3 scenarios, 11 steps passed | `20261008T042217Z-cucumber-msedge-shop-admin-54029` |

`./lab test --runner playwright --suite contracts` passed 17 tests: six offline validator/drift cases and eleven live provider cases. The independent coverage gate reported all 23 canonical operations and their required executed success/400/401/403 scenarios. Latest report: `artifacts/contracts/20261008T043855Z-contracts-61326`; the HTML/JUnit directory passed the artifact scan. `./lab test --runner playwright --suite security` passed eleven focused live cases after its dedicated runner profile was added, including the two new credential/ownership matrices. The strict TypeScript check passed after the additions. The package build passed seven unit tests; its packed consumer installed independently and verified core, Playwright, Cucumber and manual exports. No package was published.

The two-worker customer Chrome and admin Edge jobs above ran at the same time. Playwright reported `Running 5 tests using 2 workers` in each job: customer 4 passed/1 skipped in 13.2 s; admin 3 passed/2 skipped in 14.2 s. The distinct report directories were `20261008T042837Z-playwright-chrome-customer-waterdeep-56959` and `20261008T042837Z-playwright-msedge-shop-admin-56950`. Both artifact scans passed (36 entries each), and both directories have their own JUnit, HTML and WebM files. An earlier concurrent run had separate passing jobs but one worker per job because Playwright normally parallelizes by spec file; enabling `fullyParallel` supplied the missing worker evidence.

After the MAP-01 additions, the full admin teaching suite passed in Chrome (5 passed, 2 role skips; `20261008T044733Z-playwright-chrome-shop-admin-65283`) and Edge (5 passed, 2 role skips; `20261008T044731Z-playwright-msedge-shop-admin-65247`). Both reports passed the artifact scan (48 entries each). A fresh packed-package consumer build succeeded. Concurrent two-worker customer Chrome (`20261008T044810Z-playwright-chrome-customer-waterdeep-65587`, 4 passed/3 role skips) and admin Edge (`20261008T044810Z-playwright-msedge-shop-admin-65579`, 5 passed/2 role skips) also passed, each with its own 48-entry scanned HTML/JUnit/WebM report. The offline case begins after certificate login and loaded scripts; it proves SPA map usability without network, not a cold-start offline login. The geolocation allow/deny checks run with connectivity restored.

An earlier Playwright teaching run had no videos because the package's custom context fixture did not inherit Playwright's video option. After the fixture fix, the four final Playwright report directories each contained recordings and the tests passed again. No TLS verification bypass or sleep-based synchronization was added. A file inventory and containerized scan of every generated teaching report found no key, PKCS#12, certificate, HAR, storage state or token-like text artifact.

## Decisions, limitations and next dependency

The teaching examples share navigation and interaction methods, while assertions state the business outcome directly in Playwright or Cucumber. The contract suite remains browserless and independent from UI fixtures. Security probes use separate verified API request contexts with explicit 5–10 second network timeouts. The parallel probe verifies two concurrent certificate/token contexts and different subjects; the simultaneous two-worker teaching jobs additionally verify separate worker execution and non-colliding reports.

The [coverage matrix](../teaching-coverage.md) maps every required test-plan ID. A later [isolated security-matrix increment](11-security-matrix.md) added signed-token verifier cases, controlled-date user/service certificates, fresh revoked-service TLS checks, live missing-scope checks for both service paths, live Keycloak signing-key rotation across all three APIs, shopkeeper UI coverage and broader ownership checks. At the time of this teaching-suite run, live signed negative JWT claims and a fresh elapsed user-revocation bound were still open; subsequent isolated continuations in the security-matrix note closed both on Apple Silicon emulation. Native Linux amd64 remains deferred; the current Compose viewer's human click-through is deferred until the rest of the build is complete at the user's request. Prompt 12 CI/clean-start work is the next dependency. No commit, external deployment, host certificate change or package publication occurred.
