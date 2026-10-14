# All-service build and test command

Verified on October 13, 2026 (America/Chicago), from `main` based on merge commit `1880cc9`.
This work adds orchestration and documentation. It does not change service behavior or authentication.

## Commands

Run from the repository root:

```sh
sh testing/run-all.sh all
```

Root package aliases, when host pnpm is available:

```sh
pnpm run build:all
pnpm run test:all
pnpm run build:test
```

`build:all` runs builds and unit/static checks. `test:all` and `build:test` build the required images and run the complete real-system sequence.
The shell wrapper requires only Docker Compose and a shell; it does not require host pnpm.
Package aliases perform host orchestration only. Dependency installation, builds, and tests execute in containers.

The wrapper builds the workspace and feasibility checks, all default/test-profile images, and quality checks.
It freshly executes the Go, Node, and Python unit suites even when Docker reuses build layers.
It creates a new `magic-shop-all-*` project rather than adopting the caller's `LAB_PROJECT`.
It verifies PKI and database TLS/isolation, then runs packed-package, contract, security, and browser checks.
Both Chrome and Edge run customer/admin under both runners and shopkeeper under Playwright.
The separate certificate-password matrix runs last with allowlisted reports.
Failure stops later suites. Exit and signal traps invoke scoped cleanup and preserve a failing exit status.
Host loss, SIGKILL, or an unavailable Docker daemon can prevent a trap; use the printed project name for recovery.

```sh
LAB_PROJECT=magic-shop-all-REPLACE-WITH-PRINTED-ID sh testing/cleanup-certificate-password.sh
```

## Exact verification invocations

```sh
sh testing/run-all.sh all > /tmp/testing-with-certs-all-services.log 2>&1
sh testing/check-service-units.sh > /tmp/testing-with-certs-service-units.log 2>&1
sh testing/run-all.sh build > /tmp/testing-with-certs-final-build.log 2>&1

docker run --rm --platform linux/amd64 --network none --entrypoint node \
  --mount type=bind,source="$PWD",target=/work,readonly \
  magic-shop-diagram-node:12 --test /work/testing/run-all.test.mjs

docker run --rm --platform linux/amd64 --network none --entrypoint node \
  --mount type=bind,source="$PWD/testing",target=/work/testing,readonly \
  --mount type=bind,source="$PWD/artifacts/certificate-password-ci/magic-shop-all-20261013151207-64790",target=/work/artifacts/certificate-password-ci,readonly \
  magic-shop-diagram-node:12 /work/testing/reporting/check-password-matrix.mjs

docker run --rm --platform linux/amd64 --network none --entrypoint node \
  --mount type=bind,source="$PWD",target=/work,readonly \
  magic-shop-diagram-node:12 /work/testing/container/check-artifacts.mjs \
  /work/artifacts/certificate-password-ci/magic-shop-all-20261013151207-64790
```

Raw build/test output remains under `/tmp`; it is not committed or exported as a sanitized report.
The all-service run exited 0 and verified cleanup of project `magic-shop-all-20261013151207-64790`.
Independent Docker label queries found no containers, networks, or volumes for that project.
The retained `magic-shop-lab`, other pre-existing projects, and Saturday checkout were not reset or modified.

The full live sequence ran before the fresh-unit helper was wired into the build phase.
The fresh unit invocation then passed independently, and the final `build` mode passed with the helper and orchestration tests integrated.
The live sequence and provider code did not change after the successful run.

The first independent Node invocation lacked `/work/contracts/bundled/customer.json`, which its existing contract-equivalence test expects.
The helper now mounts that canonical file read-only. The corrected invocation passed all seven tests.
This was a test-harness setup correction, not an application or contract change.

## Observed results

| Selection | Result |
| --- | --- |
| Go fresh unit tests | Three tested packages passed with `go test -count=1 ./...`; store has no unit test files |
| Node fresh unit tests | 7 passed |
| Python fresh unit tests | 13 passed |
| Workspace and package | Typechecks/builds passed; 7 package unit tests; 6 Ajv validator tests |
| Feasibility unit suite | 4 passed |
| Comparator, CI evidence, orchestration | 7 combined tests passed in the final workspace build |
| Packed consumer | Independent core, Playwright, Cucumber, and manual imports/checks passed |
| PKI/database | Certificate verification and four-owner verified-TLS isolation checks passed |
| Live contracts and validators | 17 passed; all 23 operations and 100 required status scenarios covered |
| Live security | 12 passed |
| Customer/admin Playwright | Chrome and Edge: 4 customer and 5 admin tests per browser passed |
| Customer/admin Cucumber | Chrome and Edge: 4 customer and 3 admin scenarios per browser passed |
| Shopkeeper Playwright | Chrome and Edge: 3 tests per browser passed |
| Certificate-password lesson | 36/36 passed; independent completeness gate passed; safe scan passed 12 entries |
| Quality and architecture | Passed; 169 authored files / 976 functions; existing two capped transport exceptions retained |
| Disposable cleanup | Passed; no labeled containers, networks, or volumes remained |

Role-filtered browser cases were skipped as intended; they are not counted as passes.
All ten teaching report scans passed: six Playwright reports with 54 entries each and four Cucumber reports with three entries each.
The live contract report scan passed three entries.

The two new orchestration tests use stub commands, not real-login evidence.
They verify failure stops later suites, status 17 is preserved, the retained project is never adopted,
all ten browser selections and the lesson run, and cleanup failure makes the command fail.
They run in the existing workspace container checks.

## Environment and pins

The host was macOS Apple Silicon with Docker's Linux aarch64 engine and Compose `v5.5.1`.
The browser runner was Linux amd64 under local emulation: Node `v24.19.0`, Chrome `155.0.8059.39`, Edge `154.0.4258.62`.
Business runtime images were Linux arm64; Python reported `3.12.14`.
The separately executed Go unit builder was Linux amd64, using the pinned Go `1.25.3` build stage.
These are local results, not a new native Linux CI run.

Pins remain the existing Containerfile/lockfile values:

- Workspace and Node service base: Node `24.10.0`, digest `b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9`; pnpm `12.9.1`.
- Go builder: `1.25.3`, digest `4f43b271f9673eb7bd0cb3a49cc17b08d8d6ee110277e26dbacc93c43a5a7793`.
- Python base: UBI9 Python 3.12, digest `d3a5322122fd7efd5d5a2486c8c221f4785c364199f27e50a33aced417047e6a`.
- Playwright `1.61.0`, Cucumber `12.9.0`, Keycloak `26.4.0`, HAProxy `3.2.6`, PostgreSQL `16.15`.

Runtime image IDs captured during the full live run:

| Image | ID |
| --- | --- |
| Browser runner | `ffc8f5cf100f3674ebcbe537940d6da258e997e0d36662089bef79ef753b7b6c` |
| Catalog API | `07a756a64807cc4f5b25af04ee935f223260b3d2c7044f05ad518e572ac65bc5` |
| Customer API | `8ef64438f9fbbbbc295ae6bb050ead2e36b90fe42b2a02342ea52fd58bc5b466` |
| Insights API | `a5e9221b1b79001dd812ceb7498fa6bcf6685cb621d1256447ffdbc6181bdb19` |

## Reports and limits

Contract results: `artifacts/contracts/20261013T151403Z-contracts-67947/`.
Teaching results are the ten directories dated `20261013T151424Z` through `20261013T151739Z` under `artifacts/teaching/`.
Lesson results: `artifacts/certificate-password-ci/magic-shop-all-20261013151207-64790/`.
Applicable Playwright recordings remain local; the lesson matrix does not record video.

The command covers all real services and core teaching selections. It does not run every separate expansion suite.
Mock consumers, dependency-fault/idempotency expansions, and regional boundary expansions retain their own wrappers and evidence.
They cannot replace normal live-provider or real-login results.
The known reporting timestamp precision and regional UI row-limit issues remain unchanged.
Manual Linux viewer/operator, production enrollment, payments, and package publication are not established by this run.
No commit, push, deployment, or package publication was performed by this verification task.
