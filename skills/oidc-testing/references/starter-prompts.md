# Starter prompts

## Assess

> Use $oidc-testing in Assess mode. Inventory this project's OIDC flow, provider/client configuration, containers, trust, fixtures, tests, reporting, and cleanup. Identify missing pieces with source evidence and prioritize a plan. Explain existing container run commands and blockers. Use orieken/testing-with-certs as a working reference where applicable. Distinguish verified behavior from proposed work.

## Build

> Use $oidc-testing in Build mode. Assess this project, then implement the missing pieces for repeatable real OIDC tests in containers. Preserve its authentication design and adapt the working reference to its topology. Cover applicable login, callback rejection, token/API boundaries, expiry, refresh, logout, isolated fixtures, safe evidence, and failure cleanup. Run available checks and document exact commands and remaining limitations.

## Run

> Use $oidc-testing in Run mode. Find and run this project's supported container-based OIDC suite. Check prerequisites and isolation, troubleshoot failures, and report completed selections, artifact locations, gates, and cleanup. Distinguish focused results from full-suite acceptance.

For instructions without execution, replace “Find and run” with “Explain how to run” in the Run prompt.
