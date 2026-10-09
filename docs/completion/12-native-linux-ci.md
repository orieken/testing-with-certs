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
