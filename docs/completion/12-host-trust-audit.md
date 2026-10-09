# 12 — Host-trust audit continuation

Observed 2026-10-09 on macOS arm64 with Docker Desktop running the lab's linux/amd64 containers. This is a bounded local host-trust before/after audit, not evidence of native Linux or GitHub CI execution.

## Changes

- Expanded the containerized architecture check to scan the new `operator/` source for TLS-bypass flags, require its Go builder to use a digest-pinned container, and reject direct host certificate-tool calls in that builder. It still checks Compose volumes, PKI-only CA state, private networks, the loopback viewer and the absence of a Docker socket in services/runners.
- Updated the handoff documents to describe the implemented Prompt 13 operator and the observed local trust result.

## Exact commands and observed results

Before the containerized run, the following **read-only** macOS inventories were collected. No certificate was imported, exported, deleted or trusted on the host. The trust-setting streams were hashed without printing their contents.

```sh
security dump-trust-settings | shasum -a 256
security dump-trust-settings -d | shasum -a 256
security find-certificate -a -c 'Magic Shop' -Z "$HOME/Library/Keychains/login.keychain-db" /Library/Keychains/System.keychain | wc -l
shasum -a 256 "$HOME/Library/Keychains/login.keychain-db" /Library/Keychains/System.keychain
```

Baseline fingerprints: user trust `9a4a387a9aba4237dfe3c717fee7fd7f07002f001ee3feadc8a3a55217445ad9`; administrator trust `fcc21aa471cfb036c872a7b7a92bef0d1a8c4437ee06a7fbc1a28a2a0711a77e`; login keychain `7df828d94ff692d692efb85f121fac18aaec5015ba1af30a0352ecbfc2d8be72`; System keychain `4f571c0b82603bb372aafbfc44b456cb74c224819934c9c811b05e3f1af711b7`. The `Magic Shop` certificate query returned **0** entries. The read-only trust query needed access outside the normal sandbox; no trust-setting write was requested.

```sh
docker build --platform linux/amd64 --target base -t magic-shop-ci-base:local -f infra/ci/Containerfile .
docker compose -f infra/compose.yaml --profile '*' config --format json | docker run -i --rm --platform linux/amd64 --entrypoint node -v "$PWD:/work:ro" magic-shop-ci-base:local /work/infra/check-architecture.mjs
./lab pki verify
./lab operator test security
```

The architecture check passed across **129** authored source files. PKI verification passed chain, EKU, hostname, trust-domain negatives and initial CRLs inside the network-isolated PKI container. The existing Playwright security suite passed **12/12** inside the test runner. The same four read-only host inventory commands then returned **identical fingerprints and zero `Magic Shop` certificates**. No host Node, Go, Python, OpenSSL, certificate install or trust-setting write was used. The retained lab was not reset.

## Decision and limits

This demonstrates that the audited macOS user/admin trust settings and login/System keychain files did not change during these local certificate and security checks. It does not prove the state of every possible third-party certificate store, nor does it replace a native Linux run. The current Compose viewer's human click-through was confirmed later for both admin Edge and customer Chrome. Linux CI and the actual pull-request base comparison remain separate open evidence.
