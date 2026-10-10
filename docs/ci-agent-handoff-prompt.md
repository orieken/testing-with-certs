# CI handoff prompt for another agent

Use the following prompt in a new agent task. It describes the existing GitHub
Actions implementation so the agent can finish and verify it without rebuilding
the workflow from scratch.

> Work only in this prototype repository. Read `docs/README.md`,
> `docs/architecture.md`, `docs/workflows.md`, `docs/authentication.md`,
> `docs/test-plan.md`, `docs/api-contracts.md`, `docs/TODO.md`, and
> `docs/completion/12-native-linux-ci.md` before editing. Preserve the three
> business API languages, real Google Chrome and Microsoft Edge, Playwright Test
> and Cucumber, certificate-only Keycloak Authorization Code + PKCE, the two
> exact HTTPS origins, OpenAPI-backed services, and the no-host-certificate
> boundary.
>
> GitHub Actions CI already exists in `.github/workflows/ci.yml`. It has passed
> static checks, isolated stack startup, live OpenAPI contracts, security,
> text-report scan/readability/upload, and cleanup on native Linux. The latest
> [run 37982298695](https://github.com/orieken/testing-with-certs/actions/runs/37982298695)
> failed only in the last Edge/admin Cucumber selection with Node's
> `Http2Session::OnStreamAfterWrite` assertion (exit 134). The previous
> [run 37977595683](https://github.com/orieken/testing-with-certs/actions/runs/37977595683)
> passed all eight browser/runner/identity selections but its report upload
> failed on telemetry permissions; that permission issue is now fixed.
>
> A local candidate sets `QUARKUS_HTTP_HTTP2=false` on Keycloak, preserving
> the auth TLS passthrough and client certificates. A verified TLS probe before
> this setting negotiated `h2`; afterward it negotiated no ALPN protocol and
> still verified `auth.magic.test`. The previously crashing Edge/admin Cucumber
> journey passed locally. `AUTH-ALPN` in the security suite guards that policy.
> This candidate is not yet proven in native GitHub CI.
>
> Complete native Linux CI: verify the protocol change through the full workflow,
> diagnose and fix any remaining failure without disabling TLS verification,
> using password login, or swapping branded browsers for bundled Chromium. Keep
> package installation, builds, tests, database and certificate operations in
> containers; the host wrapper may only invoke Docker Compose. Check all eight
> browser selections, live contracts/security, scanned text artifact upload and
> cleanup. The actual pull-request base-contract comparison needs a PR event;
> do not claim it passed on a push. Do not claim the manual viewer or operator
> TUI was exercised on native Linux if it was not.
>
> Update affected Mermaid diagrams when topology, protocol, origin, port,
> credential boundary or workflow changes, and keep planned versus observed
> status explicit. Record exact commands, environment, results, decisions and
> limitations in `docs/completion/12-native-linux-ci.md`; only check genuinely
> completed `docs/TODO.md` entries. The user authorized committing and pushing
> changes for GitHub Actions verification. Do not publish a package, modify the
> Saturday checkout, copy generated secrets, or manage host certificates.
