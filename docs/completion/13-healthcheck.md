# 13 — Operator healthcheck follow-up

Date: 2026-10-09. Environment: macOS arm64 host with Docker Desktop and the existing linux/amd64-emulated lab. Native Linux amd64 was skipped by the user and remains unverified.

## Changes

- Added `./lab operator healthcheck` and a matching TUI action; `./lab operator health` remains an alias.
- The healthcheck uses one bounded Compose status snapshot. It requires the seven long-running core services to be both `running` and `healthy`, and now fails if a present manual Chrome/Edge viewer is unhealthy. An absent viewer is optional. The one-shot test runner is evaluated by its test exit status, not as a long-running container.
- Updated the operator guide, TODO and architecture/workflow Mermaid diagrams. No services, ports, credentials, certificate stores or volumes were changed.

## Exact commands and observed results

```sh
./lab operator health
docker run --rm -v "$PWD/operator:/src" -w /src golang:1.26.0-bookworm@sha256:2a0ba12e116687098780d3ce700f9ce3cb340783779646aafbabed748fa6677c go test ./...
docker run --rm -v "$PWD/operator:/src" -w /src golang:1.26.0-bookworm@sha256:2a0ba12e116687098780d3ce700f9ce3cb340783779646aafbabed748fa6677c go vet ./...
docker run --rm -v "$PWD/operator:/src" -w /src golang:1.26.0-bookworm@sha256:2a0ba12e116687098780d3ce700f9ce3cb340783779646aafbabed748fa6677c gofmt -l main.go main_test.go
./lab operator healthcheck
./infra/render-diagrams.sh
```

The original `health` command returned the seven core services and manual viewer as `running/healthy`. Containerized Go tests and vet passed; `gofmt -l` returned no files. The new test fixture verified that a healthy core stack passes, an unhealthy active viewer fails, and the `health` alias still succeeds. The rebuilt live `healthcheck` exited 0 and reported all seven core services and the existing manual viewer healthy. The final diagram render extracted and rendered all 21 Mermaid blocks with exit code 0.

## Decisions, limitations and next dependency

This is a readiness check based on the services' Compose health probes, not a fresh certificate login or cross-service transaction. Run `./lab operator diagnose` or the selected browser suites when that deeper evidence is needed. No host certificate management, commit, deployment or package publication occurred. There is no remaining healthcheck dependency; native Linux evidence remains intentionally unverified.
