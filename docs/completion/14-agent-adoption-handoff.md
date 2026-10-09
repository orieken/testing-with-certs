# 14 — Agent adoption prompts and source baseline

Date: 2026-10-09. Environment: macOS arm64 prototype repository; no native Linux amd64 or GitHub CI execution in this continuation.

## Changes

- Added [agent adoption prompts](../agent-adoption-prompts.md): a reference architecture explanation, a dispatch contract for another repository, seven staged copyable prompts (00–06), acceptance gates and source entry points.
- Linked the guide from both README entry points. The prompts tell target agents to adapt existing IdP, service and runner boundaries, use container-only certificate operations, test real browser identity and security failures, and keep unrun evidence open.
- The user explicitly authorized committing this repository. The initial source commit establishes a baseline for later comparison; it does not itself run the GitHub workflow or prove a clean-clone build.

## Exact commands and observed results

```sh
git ls-files --others --exclude-standard | wc -l
rg -n --hidden --glob '!artifacts/**' --glob '!.git/**' --glob '!*.tgz' -e '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----' -e 'Authorization: Bearer [A-Za-z0-9._-]{20,}' -e 'AKIA[0-9A-Z]{16}' .
tar -tzf spikes/certificate-login/vendor/orieken-saturday-playwright-certs-0.1.0.tgz
git check-ignore -v artifacts/operator/bin/magic-shop-operator artifacts/diagrams/architecture-01.svg apps/magic-shop/node_modules/foo.key
git add -A
git diff --cached --name-only | wc -l
git diff --cached --check -- README.md docs/README.md docs/TODO.md docs/compatibility.md docs/agent-adoption-prompts.md docs/completion/14-agent-adoption-handoff.md
docker compose -f infra/compose.yaml --profile '*' config --quiet
```

The pre-handoff inventory found 382 eligible source/reference files before this guide was added; the final staged set contains 384 files. The private-key search found only a literal redaction fixture in `operator/main_test.go`; no generated PEM/PKCS#12 material or long bearer token appeared among source files or spike logs. The vendored tarball contains package license/notice, distributable modules, declarations and README, with no certificate files. Git ignore rules exclude generated artifacts and nested `node_modules`; only `artifacts/README.md` is staged from that tree. The changed handoff/current-status documents passed `git diff --cached --check`, and the Compose configuration parsed successfully. A repository-wide whitespace check still reports trailing spaces in historical copied Vue files and captured spike logs; those reference files were left unchanged to preserve provenance. The final commit identity and clean working-tree check are reported in the handoff response.

## Decisions, limitations and next dependency

The prompts are for adoption, not proof that another project supports certificate login. Their first step inventories the target IdP and exact origins, and later steps require observed browser, TLS, token and contract results. The Magic Shop's Go/Node/Python split and Keycloak realm are reference choices, not mandatory target architecture. The local `saturday-keycloak` package remains private; no package was published and no Saturday checkout was modified. Native Linux verification was skipped at the user's request; the written GitHub CI workflow and a real pull-request base comparison remain unverified. The next dependency is a target repository plus its exact origins, IdP and runner constraints.
