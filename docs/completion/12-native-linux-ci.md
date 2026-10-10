# 12 — Native Linux GitHub CI continuation

Date: 2026-10-09. The user authorized committing and pushing the prototype so GitHub Actions could verify it on native Linux amd64. This supersedes the earlier [skip decision](12-native-linux-scope.md) for CI verification. The local development host is macOS arm64 with Docker Desktop; the GitHub runner is `ubuntu-24.04` amd64.

## Changes and first-run evidence

- Initial source commit `1c86d5920b364cbf27aa46e0e3d3c6ed2de5fde4` was pushed to `origin/main`. [GitHub Actions run 37976084152](https://github.com/orieken/testing-with-certs/actions/runs/37976084152) passed Compose configuration/architecture, workspace/spike checks, Go/Python service builds and isolated Compose stack/realm startup on Linux.
- The runner image then failed while installing `google-chrome-stable=154.0.8037.97-1`: Google's current **signed** apt index no longer listed that exact package. The secondary report-scan failure reflected missing reports because the browser runner never built. Live contracts, security, browser matrix and artifact upload were skipped; the isolated project's cleanup step succeeded. A push run does not exercise the pull-request base-contract comparator.
- Updated only the full-stack runner lock to signed-index Chrome `155.0.8059.39-1`; Edge stays `154.0.4258.62-1`. The original spike lock and historical evidence remain unchanged. Updated current compatibility, dependency, architecture, workflow and TODO descriptions. No TLS validation, certificate boundary, origin, service implementation or browser channel changed.

## Exact commands and observed results

```sh
git push -u origin main
gh run list --repo orieken/testing-with-certs --branch main --limit 5 --json databaseId,headSha,status,conclusion,workflowName,url,createdAt
gh run view 37976084152 --repo orieken/testing-with-certs --log-failed
docker compose -f infra/compose.yaml --profile test build --no-cache runner-test
docker run --rm --platform linux/amd64 --entrypoint sh magic-shop-runner:03 -c 'google-chrome --version && microsoft-edge --version && node --version'
./lab test --runner playwright --browser chrome --user customer-waterdeep
./lab test --runner playwright --browser msedge --user shop-admin
docker compose -f infra/compose.yaml --profile '*' config --quiet
./infra/render-diagrams.sh
git diff --check
```

The fresh no-cache amd64 runner build completed with the new Chrome package and the remaining exact apt closure. The image reported Chrome `155.0.8059.39`, Edge `154.0.4258.62` and Node `v24.10.0`. Real Chrome/customer Playwright teaching passed four applicable tests with four role skips; real Edge/admin passed five applicable tests with three role skips. Both report scans passed (54 entries each). Compose configuration and `git diff --check` passed; all 21 Mermaid blocks rendered with the updated native-CI observed/planned distinction. These two targeted browser runs occurred under local Apple Silicon amd64 emulation, not native Linux. The native integration rerun is the next dependency and must be recorded separately before checking the platform boxes.

## Decisions and limits

Retaining an unavailable browser pin would make a clean CI rebuild impossible; refreshing the exact version from signed package metadata preserves real Chrome and deterministic installation at the time of verification. The package repository may retire this version later, so long-term reproducibility needs a reviewed immutable package mirror or another content-addressed source. No floating browser installation or TLS bypass was used. No host certificate store or Saturday checkout was changed. A manual noVNC viewer and operator TUI were not exercised in the GitHub job; those native-platform paths remain unverified even if the automated CI matrix later passes. The actual PR base comparison requires a pull-request event.

## Second GitHub run and report-upload correction

[GitHub Actions run 37977595683](https://github.com/orieken/testing-with-certs/actions/runs/37977595683) used commit `07d349a74e0838cb6a5367b49d66da9e72d62477`. All five static/build jobs passed. The native amd64 integration job passed isolated startup, exact real Chrome/Edge version recording, live Playwright OpenAPI contracts and coverage, TLS/token/identity/ownership security, all eight Chrome/Edge × Playwright Test/Cucumber × customer/admin selections, the credential-artifact scan and project cleanup. The workflow's sole failure was the final text-artifact upload: the GitHub host runner received `EACCES` opening `scenario-telemetry.jsonl`, which Cucumber created with explicit mode `0600` under container UID 1000. The report scan ran inside that container and therefore could read it; the host runner had a different UID. No certificate or test failure was hidden by this error.

The Cucumber telemetry contains synthetic scenario title, status, duration, selected browser and fixture user, not credentials. It now uses mode `0644` so the host runner can read only this approved text report. The workflow checks host readability **after** the credential scan and **before** upload; upload still requires both checks to succeed. Local Chrome/customer Cucumber passed four scenarios and 14 steps with a safe artifact scan, and `stat` reported the new telemetry as `-rw-r--r--` (`644`). The new workflow path has not yet run on GitHub.

```sh
gh run view 37977595683 --repo orieken/testing-with-certs --log-failed
./lab test --runner cucumber --browser chrome --user customer-waterdeep
stat -f '%Sp %OLp %u:%g %N' artifacts/teaching/20261009T191554Z-cucumber-chrome-customer-waterdeep-29929/scenario-telemetry.jsonl
docker run --rm --platform linux/amd64 --entrypoint node -v "$PWD:/repo:ro" magic-shop-runner:03 -e 'const fs=require("fs"); const YAML=require("/work/node_modules/.pnpm/yaml@2.9.1/node_modules/yaml"); const doc=YAML.parse(fs.readFileSync("/repo/.github/workflows/ci.yml","utf8")); if(!doc.jobs?.integration?.steps?.some(s=>s.id==="readable")) process.exit(1); process.stdout.write("CI workflow parsed; readability gate present\n")'
./infra/render-diagrams.sh
git diff --check
```

The edited workflow parsed with its pinned YAML dependency, all 21 updated Mermaid blocks rendered and `git diff --check` passed. This closes the native automated stack/test-matrix check, but not the full CI workflow: approved text upload still requires a passing rerun. Manual noVNC and operator TUI behavior on Linux, literal clean-clone/repeat-startup, and the pull-request-only base comparison also remain unverified.

## Third GitHub run and pinned runner candidate

[GitHub Actions run 37979583499](https://github.com/orieken/testing-with-certs/actions/runs/37979583499) used commit `fef27b32abdec9ba3e9dcf25f1505c6766b0f6ac`. Five static/build jobs, isolated stack startup, real browser version recording, live OpenAPI contracts, security and the Chrome/customer selections passed. At the Chrome/admin Cucumber selection, Node `v24.10.0` aborted with `node::http2::Http2Session::OnStreamAfterWrite` assertion `is_write_in_progress()` and exit 134. This was a native runtime crash, not a test assertion. The workflow did not reach report upload. It is a regression in reliability despite the previous run's passing matrix; no Linux completion is inferred for the corrected upload path.

The runner now pins Node `24.19.0` Bookworm slim at verified index digest `sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df`. Cucumber is pinned to `12.9.0`, whose published `enginesTested` includes Node 24, instead of 11.3.0's untested-Node-24 warning. The private package's optional peer range accepts both Cucumber 11.3 and 12.9; its own dev tests and independent packed consumer now use 12.9. The Saturday Cucumber adapter's published peer range is `>=10.0.0`. Playwright 1.61.0, exact Chrome `155.0.8059.39-1`, exact Edge `154.0.4258.62-1`, both HTTPS origins and strict TLS remain unchanged. The historical spike dependency lock and completion evidence remain unchanged. [Node issue 61304](https://github.com/nodejs/node/issues/61304) documents the same assertion in a different HTTP/2/TLS race; it does not prove this patch release fixes our crash.

```sh
gh run view 37979583499 --repo orieken/testing-with-certs --log-failed
docker buildx imagetools inspect node:24.19.0-bookworm-slim
docker run --rm --platform linux/amd64 --entrypoint npm node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df view @cucumber/cucumber@12.9.0 version engines enginesTested --json --fetch-timeout=30000 --fetch-retries=1
docker run --rm --platform linux/amd64 -v "$PWD:/work" -w /work node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df sh -c 'npm install --global pnpm@12.9.1 --fetch-timeout=30000 --fetch-retries=1 >/dev/null && pnpm install --lockfile-only --ignore-scripts --fetch-timeout=30000 && pnpm peers check'
docker compose -f infra/compose.yaml --profile test build --no-cache runner-test
docker compose -f infra/compose.yaml --profile test build runner-test
./lab test --runner cucumber --browser chrome --user shop-admin
./lab test --runner cucumber --browser msedge --user customer-waterdeep
./lab test --runner playwright --browser chrome --user customer-waterdeep
docker build --platform linux/amd64 -t magic-shop-saturday-keycloak:05 -f packages/saturday-keycloak/Containerfile .
docker build --platform linux/amd64 -f packages/saturday-keycloak/Consumer.Containerfile .
docker build --platform linux/amd64 --target workspace -f infra/ci/Containerfile .
docker compose -f infra/compose.yaml --profile '*' config --quiet
./infra/render-diagrams.sh
git diff --check
```

On local Apple Silicon amd64 emulation, the fresh runner build resolved the signed exact apt closure, reported Node `v24.19.0`, Chrome `155.0.8059.39` and Edge `154.0.4258.62`, and completed the frozen workspace install and TypeScript build. Chrome/admin Cucumber passed 3 scenarios/11 steps; Edge/customer passed 4 scenarios/14 steps; both safe artifact scans passed. Chrome/customer Playwright passed four applicable tests with four role skips and a safe 54-entry artifact scan. The private package image passed seven unit tests, and the independent packed consumer loaded core, Playwright, Cucumber and manual exports. The CI-equivalent workspace image passed typechecks, seven private-package unit tests, OpenAPI lint/drift, the 23-operation/92-status inventory, six contract-validator tests and seed validation. Compose configuration and `git diff --check` passed; all 21 Mermaid blocks rendered. An initial mixed Cucumber 12 runner/Cucumber 11 private package build failed with the expected duplicate-instance `PENDING` hook error; aligning both installations removed it. No host runtime or certificate store was changed. The next dependency is a full native GitHub rerun, including the host readability gate and text-only artifact upload. Native manual viewer/operator and a real PR comparator still require separate evidence.

## Fourth GitHub run and Keycloak protocol candidate

[GitHub Actions run 37982298695](https://github.com/orieken/testing-with-certs/actions/runs/37982298695) used commit `a2d1faafe1206173c7451321379439f36c0ede42`. All five static/build jobs passed. The isolated Linux amd64 stack, real browser version check, live OpenAPI contracts and security passed. Chrome/customer and Chrome/admin passed under both Playwright Test and Cucumber; Edge/customer and Edge/admin passed under Playwright Test; Edge/customer Cucumber passed. The final Edge/admin Cucumber process aborted with the same Node `Http2Session::OnStreamAfterWrite` assertion (`is_write_in_progress()`, exit 134), this time under Node 24.19.0. The runtime upgrade and Cucumber 12.9.0 therefore did **not** fix that race. The report credential scan, GitHub host readability gate, text-only artifact upload and project-scoped cleanup all passed in this run. There is still no single green full workflow.

The auth listener was measured from the certificate-mounted runner with normal hostname and CA validation: Keycloak selected ALPN `h2` before the change, and `No ALPN negotiated` with `Verify return code: 0 (ok)` after setting `QUARKUS_HTTP_HTTP2=false` in its Compose environment. HAProxy remains TLS passthrough at `auth.magic.test:9443`; TLS validation and the user certificate remain active. [Quarkus documents this HTTP/2 setting](https://quarkus.io/version/3.27/guides/http-reference/#http2-support). The focused Playwright security check `AUTH-ALPN` confirms the auth endpoint cannot select `h2` on verified TLS. The formerly failing Edge/admin Cucumber selection passed locally with three scenarios and 11 steps and a safe artifact scan. This is a protocol candidate, not a proven root cause or native Linux fix until the next full CI run.

```sh
gh run view 37982298695 --repo orieken/testing-with-certs --log-failed
docker compose -f infra/compose.yaml --profile test run --rm --no-deps --entrypoint sh runner-test -c "printf '' | openssl s_client -connect auth.magic.test:9443 -servername auth.magic.test -alpn h2,http/1.1 -cert /identity/cert.pem -key /identity/key.pem -CAfile /public/server-ca.pem 2>&1 | grep -aEi 'ALPN|Verify return code'"
docker compose -f infra/compose.yaml up -d --no-deps keycloak
docker compose -f infra/compose.yaml up -d --wait --no-deps keycloak
docker compose -f infra/compose.yaml --profile test build runner-test
docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_SECURITY_RUN=1 runner-security sh -c 'cd /work/testing && /work/testing/node_modules/.bin/playwright test --config playwright.config.ts --project=security --grep AUTH-ALPN'
./lab test --runner cucumber --browser msedge --user shop-admin
./lab test --runner playwright --suite security
docker compose -f infra/compose.yaml --profile '*' config --quiet
./infra/render-diagrams.sh
git diff --check
```

The retained local Apple Silicon project had accumulated enough orders from repeated teaching tests that the original security traversal (20 pages × 2 orders) failed one of 12 prior checks. Increasing only the page size to 20, within the OpenAPI maximum of 100, retains the 20-request bound while covering up to 400 orders. The complete local suite then passed 13/13, including the new ALPN check, no-cert, wrong hostname, missing trust, signed-token negatives and ownership. Compose configuration, `git diff --check` and rendering all 21 updated Mermaid blocks passed. The isolated GitHub security suite on the previous configuration passed; the changed configuration awaits a new isolated run. A [new-agent CI handoff prompt](../ci-agent-handoff-prompt.md) records the current setup and evidence. The next dependency is the full native Linux CI matrix and artifact path, with the pull-request base comparison and native manual viewer/operator still separate.

## Fifth GitHub run and automated-browser protocol candidate

[GitHub Actions run 38011861891](https://github.com/orieken/testing-with-certs/actions/runs/38011861891) used commit `7395693`. All five static/build jobs, isolated stack bootstrap, exact branded-browser version check, live OpenAPI contracts, and the security suite including `AUTH-ALPN` passed. Chrome/customer Cucumber then aborted with the same Node HTTP/2 assertion. Credential scan, host readability, text artifact upload and scoped cleanup passed. Keycloak's verified HTTP/1.1 fallback therefore did **not** prevent the crash; the Keycloak override and its temporary ALPN test were removed. The underlying race has not been conclusively diagnosed.

Inspection of the installed Playwright 1.61.0 `socksClientCertificatesInterceptor` found that its context-certificate proxy parses browser ALPN and may start a Node HTTP/2 server for a browser-facing upstream error. The next bounded candidate passes Chromium's `--disable-http2` launch option to the real Chrome/Edge automated browser in both Playwright Test and Cucumber. This asks the browser to use HTTP/1.1 on the TLS connection handled by Playwright's certificate proxy; it does not disable certificate verification or change the two exact origins, selected identity, Keycloak flow or manual native-store browser. [Chromium documents the switch](https://chromium.googlesource.com/chromium/src/+/8f718e9a/components/network_session_configurator/switches.cc). The fifth failure makes the Keycloak-side change an observed unsuccessful attempt, not evidence for the new browser-side candidate.

```sh
gh run view 38011861891 --json status,conclusion,jobs,url
./lab test --runner cucumber --browser chrome --user customer-waterdeep
./lab test --runner cucumber --browser msedge --user shop-admin
./lab test --runner playwright --browser chrome --user customer-waterdeep
docker compose -f infra/compose.yaml --profile '*' config --quiet
./infra/render-diagrams.sh
git diff --check
```

On local Apple Silicon amd64 emulation, real Chrome/customer Cucumber passed 4 scenarios/14 steps, real Edge/admin Cucumber passed 3 scenarios/11 steps, and real Chrome/customer Playwright Test passed its four applicable tests (four role skips). All three safe artifact scans passed. Compose configuration and `git diff --check` passed, and all 21 Mermaid blocks rendered. The native Linux workflow rerun is the immediate next verification step. This local passing result does not prove the intermittent native race is fixed. The actual PR base comparison, native manual viewer/operator, and literal clean-clone/repeat-startup checks remain separate open dependencies.
