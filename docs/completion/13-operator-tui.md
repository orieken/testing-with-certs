# 13 — Operator CLI/TUI implementation

Date: 2026-10-09. Environment: macOS arm64 host, Docker Desktop linux/amd64 application runners. Native Linux amd64 remains unverified at the user's request.

## Changes

- Added `operator/`, a host Go CLI/TUI using Bubble Tea v2.0.10, Bubbles v2.2.1 and Lip Gloss v2.0.6, compiled in `golang:1.26.0-bookworm@sha256:2a0ba12e116687098780d3ce700f9ce3cb340783779646aafbabed748fa6677c`. The lockfile is `operator/go.sum`; the output stays under ignored `artifacts/operator/bin/`. The Go 1.25.3 image could not compile the pinned Charm v2 packages because Bubble Tea requires Go 1.26.0. The three business APIs and their runtimes did not change.
- Added `./lab operator` with named Compose start/stop, state/readiness, selected-user manual viewer, certificate metadata, bounded log summaries, report IDs, and existing Playwright/Cucumber test actions. `reset PROJECT --yes` remains separate. The TUI requests `y` for stop. Commands use explicit argv, allowlists, timeouts and bounded captured output; no service or runner Docker socket mount was added.
- `diagnose` invokes the existing security and OpenAPI contract suites. The separate, confirmed `diagnose-revoked --yes` action creates an empty disposable project, verifies Chrome login, publishes the user CRL, tests fresh shop/auth rejection and removes that project's volumes. Added architecture and workflow operator control diagrams; rendered all Mermaid blocks.

## Exact commands and observed results

```sh
docker pull golang:1.26.0-bookworm
docker run --rm -v "$PWD/operator:/src" -w /src golang:1.26.0-bookworm@sha256:2a0ba12e116687098780d3ce700f9ce3cb340783779646aafbabed748fa6677c sh -c 'go mod tidy && go test ./...'
docker run --rm -v "$PWD/operator:/src" -w /src golang:1.26.0-bookworm@sha256:2a0ba12e116687098780d3ce700f9ce3cb340783779646aafbabed748fa6677c sh -c 'gofmt -w main.go main_test.go && go test ./... && go vet ./...'
./lab operator status
./lab operator health
./lab operator certs
./lab operator telemetry
./lab operator stop gateway
./lab operator test security
./lab operator test contracts
docker compose -f infra/compose.yaml up -d --build --no-deps --wait --wait-timeout 120 catalog-api
./lab operator test contracts
./lab operator test playwright chrome customer-waterdeep
./lab operator test cucumber msedge shop-admin
./lab operator logs gateway
./lab operator
./lab operator diagnose-revoked --yes
docker volume ls --filter label=com.docker.compose.project=magic-shop-matrix-user-crl-operator-13 --format '{{.Name}}'
./infra/render-diagrams.sh
```

The Go unit suite and vet passed. All seven long-running services and the existing manual viewer were observed `running/healthy`; the ephemeral test runner is judged by its exit. The metadata command read selected public certificate issuer/serial/expiry and the three published CRL dates/ages inside the PKI container. Unconfirmed `stop gateway` exited 1 before Docker mutation. The Playwright security suite passed 12/12 live tests. The first contracts run found one deployed catalog OpenAPI digest mismatch while 16 tests passed; rebuilding only the local catalog image without changing volumes corrected its stale packaged bundle. The rerun passed 17/17 and the 23-operation coverage gate. The operator's real Chrome/customer Playwright selection passed 4 selected tests (4 other role tests skipped), and Edge/admin Cucumber passed 3 scenarios/11 steps. Safe artifact scans passed.

The unit suite also checked command rejection, redaction, output bounds, TUI refresh, failure display and cancellation context. The TUI opened in a terminal, selected status and exited with `q`. The first noninteractive fallback incorrectly tried to open a TTY; after checking for a controlling `/dev/tty`, redirected `./lab operator` produced nine status lines. `logs gateway` returned only bounded counts with message bodies withheld.

The final operator filters unexpected runner output, showing only test names, counts and local report locations. A second security run through that filtered path passed 12/12. The final cancellation change waits for command completion and disposable-project cleanup before the TUI exits; containerized Go tests and vet passed again, and the retained lab remained healthy.

The first isolated revocation attempt used a disposable project name outside the existing probe's required pattern and failed at the final probe; the operator cleaned its volumes. After aligning the name, Chrome login passed before revocation and fresh connections to both exact shop/auth origins rejected the revoked user certificate within the probe's 60-second bound. The isolated volume listing was empty afterward, and the retained lab's seven core services plus manual viewer remained healthy. No retained CRL was changed.

Reports: `artifacts/contracts/20261009T131514Z-contracts-86366`, `artifacts/teaching/20261009T131537Z-playwright-chrome-customer-waterdeep-86560`, and `artifacts/teaching/20261009T131605Z-cucumber-msedge-shop-admin-86786`.

## Decisions, limitations and next dependency

The operator uses existing lab commands for tests, so it preserves real Chrome/Edge, both test runners, original reports and OpenAPI-backed service contracts. Telemetry shows log counts rather than raw messages to avoid exposing credentials. No host Go, Node, Python, OpenSSL, certificate store operation, commit, package publication or external deployment was used.

The TUI status selection was observed in a terminal; other interactive selections and stop confirmation have code and unit coverage but have not each been clicked through. User-certificate revocation is automated in the operator; service-client revocation remains a separately documented Prompt 11 isolated command sequence. The user later confirmed both current Compose manual-viewer identities in [completion 10](10-manual-browser.md). Native Linux amd64 remains unverified; no native amd64 Docker context is configured on this host.

The user subsequently chose to [skip native Linux verification](12-native-linux-scope.md). The operator's native-platform TODO box remains unchecked; its Apple Silicon checks remain the only observed runtime evidence.
