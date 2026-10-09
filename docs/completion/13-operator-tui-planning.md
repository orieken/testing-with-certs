# 13 — Operator CLI/TUI planning addition

Date: 2026-10-05. **Planning entry only; no CLI/TUI implementation is claimed.**

## Changes

Added Prompt 13 at the end of the active implementation TODO list and to
`docs/implementation-prompts.md`. It specifies a Go terminal interface using
[Bubble Tea](https://github.com/charmbracelet/bubbletea),
[Bubbles](https://github.com/charmbracelet/bubbles) and
[Lip Gloss](https://github.com/charmbracelet/lipgloss). The operator tool is
deliberately separate from the exactly three business APIs and follows the core
stack, certificate flows and test suites. No source from those projects was copied.

The planned operator interface will control named Compose services, show actual
readiness rather than process-only state, gather bounded/redacted local telemetry,
run certificate and inter-service communication diagnostics with TLS verification,
and launch the existing Playwright contract/browser and Cucumber suites. Its Go
binary will be built in a container. A thin host wrapper may invoke Docker
Compose but must not require host Go, Node, Python, OpenSSL or certificates. Any
Docker control privilege belongs only to the trusted operator process, never a
business service or test/manual runner. Reset and other data-affecting actions
remain explicit. The eventual implementation must update affected diagrams as
its actual control path and privilege boundary become known.

## Observed checks and environment

Read the current TODO, architecture/workflows and the end of the implementation
prompts in this prototype repository on the macOS arm64 development host. Consulted
the three official Charm repositories to identify the requested stack. Exact
read-only inspection commands run from the repository root:

```sh
tail -80 docs/TODO.md
tail -100 docs/implementation-prompts.md
rg -n '^## 13|^- \[[ x]\]' docs/TODO.md | tail -13
```

The new Prompt 13 has eight unchecked TODO entries; none was marked complete.
This was a documentation-only change. No Go build, package installation, Docker
service operation, certificate operation, health check or test was run. No origin,
port, credential mount or running component changed, so no Mermaid implementation
overlay was altered for this planning entry. The full-stack diagrams still mark
unimplemented behavior as planned.

## Decisions, limitations and next dependency

Use the Charm stack as requested, but choose and pin exact Go/Charm versions when
implementation begins and verify their compatibility in containers. The TUI
should reuse the existing `lab`/Compose and test paths rather than create a
fourth API, a replacement test runner or host certificate-management path.
Telemetry is local and redacted; no external reporting destination is planned.

Prompt 13 depends on the healthy Compose stack, operational health endpoints,
containerized certificate/communication diagnostics, safe test artifacts and both
runner modes. The next **current** implementation item remains Prompt 02's pinned
OpenAPI tooling and Playwright contract harness. Native Linux amd64 is still
unverified. No commit, deployment, package publication, Saturday checkout edit or
host certificate change occurred.
