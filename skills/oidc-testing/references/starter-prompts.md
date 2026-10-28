# Starter prompts

## Assess

> Use $oidc-testing in Assess mode. Inventory this project's OIDC flow, provider/client configuration, containers, trust, fixtures, tests, reporting, and cleanup. Identify missing pieces with source evidence and prioritize a plan. Explain existing container run commands and blockers. Use orieken/testing-with-certs as a working reference where applicable. Distinguish verified behavior from proposed work.

## Build

> Use $oidc-testing in Build mode. Assess this project, then implement the missing pieces for repeatable real OIDC tests in containers. Preserve its authentication design and adapt the working reference to its topology. Cover applicable login, callback rejection, token/API boundaries, expiry, refresh, logout, isolated fixtures, safe evidence, and failure cleanup. Run available checks and document exact commands and remaining limitations.

## Run

> Use $oidc-testing in Run mode. Find and run this project's supported container-based OIDC suite. Check prerequisites and isolation, troubleshoot failures, and report completed selections, artifact locations, gates, and cleanup. Distinguish focused results from full-suite acceptance.

For instructions without execution, replace “Find and run” with “Explain how to run” in the Run prompt.

## OIDC and mTLS

Use $oidc-testing to map this project’s certificate and token boundaries, add focused tests with real successful controls and isolated negatives, and run a disposable workflow with verified cleanup. Distinguish browser certificate login, service mTLS, OAuth client authentication, application identity binding and RFC 8705 thumbprint binding. Report only observed coverage.

## Folder-wide authentication assessment and recording plan

Assess every project under `<PROJECTS_ROOT>` using [project-folder assessment](project-folder-assessment.md). Identify the actual authentication mechanisms with source evidence and confidence, then propose a per-project plan preserving its providers. Require the [recorded container workflow](recorded-container-tests.md): VNC/noVNC desktop, automated container browsers, every executed browser scenario recorded with visual privacy, and a local scenario/matrix report with embedded clips, JSON/JUnit, provenance and completeness/cleanup gates. Label API-only evidence separately. Return a cross-project comparison, concrete proposed files/commands, blockers and prioritized pilot. Assessment only: do not modify projects, execute stacks or publish reports.

The reference repository's `docs/auth-project-folder-prompt.md` contains the full reusable prompt.
