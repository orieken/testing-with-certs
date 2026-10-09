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
