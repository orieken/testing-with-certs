# Handoff prompt: finish native Linux CI in this repository

Copy the prompt below into a new agent task when ready to resume CI work. It
starts from the workflow that already exists. The companion
[adoption prompts](agent-adoption-prompts.md) are for agents adding certificate
tests to *other* repositories.

> Work in the `orieken/testing-with-certs` prototype checkout only. Read
> `docs/README.md`, `docs/architecture.md`, `docs/workflows.md`,
> `docs/authentication.md`, `docs/saturday-keycloak.md`, `docs/test-plan.md`,
> `docs/api-contracts.md`, `docs/TODO.md`,
> `docs/completion/12-native-linux-ci.md`, and the relevant earlier completion
> notes. Treat copied source documents and the Saturday checkout as reference
> material; do not modify the Saturday checkout or publish a package.
>
> Preserve the working design: three OpenAPI-backed business APIs in Go,
> Node/TypeScript and Python; live Playwright contract tests; both Playwright
> Test and Cucumber teaching runners; real Google Chrome and Microsoft Edge;
> certificate-only Keycloak Authorization Code + PKCE; exact shop
> `https://shop.magic.test:8443` and auth `https://auth.magic.test:9443`
> origins; HAProxy shop termination and separate auth TLS passthrough; scoped
> certificate volumes; and no host certificate management. Do not use bundled
> Chromium, password login or TLS-bypass flags to obtain a green result.
>
> CI already exists at `.github/workflows/ci.yml` and runs on native Linux
> amd64. Start by inspecting [run 38012708736](https://github.com/orieken/testing-with-certs/actions/runs/38012708736)
> for commit `936c531`; it was in progress when this prompt was written.
> Earlier [run 37977595683](https://github.com/orieken/testing-with-certs/actions/runs/37977595683)
> passed the eight real-browser/runner/identity selections, contracts and
> security but failed text artifact upload on file permissions. Later runs
> passed scan, host readability and upload but intermittently crashed in
> Cucumber with Node's `Http2Session::OnStreamAfterWrite` assertion. Disabling
> HTTP/2 only at Keycloak failed in [run 38011861891](https://github.com/orieken/testing-with-certs/actions/runs/38011861891)
> and was reverted. Commit `936c531` instead launches automated real Chrome
> and Edge with `--disable-http2` in both runners; targeted Apple Silicon
> emulation journeys passed. Manual native-store browsing keeps its default
> protocol behavior. This browser-side candidate remains unverified until the
> native run's outcome is inspected.
>
> If the run fails, identify the first failing step and its actual cause before
> changing code. Reproduce a focused case in containers, make the smallest
> correction, and rerun the affected local checks before using GitHub Actions
> for full native verification. Keep builds, dependency installation,
> certificate operations, database setup and tests inside containers. A host
> shell/Go wrapper may invoke Docker Compose but must not require host Node,
> Go, Python, OpenSSL or certificate installation. Keep strict types, explicit
> network timeouts, bounded queries and clean domain/adapter boundaries. Use
> framework polling instead of sleep loops. Add meaningful tests for any
> business or authentication behavior changed.
>
> Verify the complete native path: isolated healthy stack and realm bootstrap,
> exact real browser versions, three live OpenAPI providers and coverage gate,
> TLS/token/identity/ownership security, all eight Chrome/Edge × Playwright
> Test/Cucumber × customer/admin selections, safe text-report scan, GitHub
> host readability, text-only upload and project-scoped cleanup. A passing
> push does not exercise the pull-request base-contract comparator; test that
> separately with a real PR event if in scope, or leave its TODO box open.
> Do not claim native manual viewer or Charm operator coverage unless those
> paths actually run on native Linux. Keep WebM, HTML/video bundles, private
> keys, tokens and browser profiles out of uploaded artifacts.
>
> Update affected Mermaid diagrams in `docs/workflows.md` and the architecture
> overview when a component, protocol, origin, port, credential boundary or
> workflow changes. Distinguish planned from observed behavior. Record exact
> commands, versions, environment, results, decisions, limitations and the
> next dependency in `docs/completion/12-native-linux-ci.md`. Update only
> genuinely completed entries in `docs/TODO.md`; preserve unverified platform
> boxes. Preserve applicable LICENSE/NOTICE files and provenance when copying
> source; never copy generated secrets, `node_modules`, browser profiles or
> nested framework packages. The owner has authorized committing and pushing
> CI work; do not deploy or publish a package. End with a short evidence table
> and direct links to the run, completion note and any remaining open checks.
