# Magic Shop certificate prototype

[Published video matrix](https://orieken.github.io/testing-with-certs/): **20 CI jobs passed**, including automatic publication after all 19 native gates, with 92 fresh selections, 952 videos, spec/result labels and authentication filters. [Publication evidence](docs/completion/60-automatic-pages.md) records the accepted retry, public Chrome/Edge playback, expected skips and remaining scope.

Start with [Get started with certificate tests](docs/getting-started.md) for setup and copyable container test commands. Use the [project pitch and current gaps](docs/project-pitch.md) to explain the approach and its limits.

For hosted identity-provider preparation, use the [external account setup guides](docs/providers/README.md). Entra ID, Auth0, Okta, Cognito, and optional ZITADEL Cloud are documented; account creation and live integration are deferred.

To build all services and run the real-system verification in a fresh disposable lab, run `sh testing/run-all.sh all`.
The root package aliases are `pnpm run build:all`, `pnpm run test:all`, and `pnpm run build:test`.
Run `./lab matrix --plan` to preview, or `./lab matrix` to record the complete Debian/UBI9 Chrome/Edge browser matrix. See [matrix selections and reports](docs/browser-matrix.md).
Only the aliases need host pnpm; the shell command needs Docker Compose and a shell. All builds and tests execute in containers.

For a plain-language explanation, read [Understand this project](docs/plain-language/README.md). The three guides explain the system, certificate login, and test evidence with Mermaid diagrams and ASD-STE100-inspired writing.

This repository is a local teaching prototype. Start with the [teaching guide](docs/teaching-guide.md) for container-only startup, selected-user certificate login, tests, troubleshooting and reset. The [implementation guide](docs/README.md) tracks the three-language, OpenAPI-backed shop and acceptance evidence. The [agent adoption prompts](docs/agent-adoption-prompts.md) explain how another project can adapt the certificate tests. The [CI agent handoff prompt](docs/ci-agent-handoff-prompt.md) describes the existing GitHub workflow and remaining native Linux check. The [certificate-login spike](spikes/certificate-login/README.md) and all three live business providers passed on Apple Silicon using amd64 emulation. One GitHub Actions run passed the native Linux certificate, contract and browser matrix; a later run passed report upload, but its last Cucumber selection crashed in Node HTTP/2. Run 38012708736 subsequently passed the full prior native automated workflow. The certificate/password lesson also has recorded native Linux evidence; see [completion 18](docs/completion/18-native-certificate-password-ci.md).

The root pnpm workspace contains the certificate-authenticated Vue shop, a
private local Keycloak package, Go catalog, Node customer and Python insights
services, infrastructure, seed data and browser/test runners. All 23 business
operations passed live Playwright contract coverage on Apple Silicon emulation.
Generated reports belong under `artifacts/`; credentials and host trust never do.

Start the full stack with `./lab up`; use `./lab status` to inspect it. The [Go operator CLI/TUI](docs/operator-guide.md) is available through `./lab operator` and is built in a pinned container. The wrapper needs Docker Compose and a shell, with no host language runtime or certificate installation. The workspace can also be listed without host Node or pnpm:

```sh
docker run --rm --platform linux/amd64 -v "$PWD:/work" -w /work \
  node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9 \
  npm exec --yes --package=pnpm@12.9.1 -- pnpm -r list --depth -1
```

Package installation, builds, database setup, certificate operations and tests run in containers. See [TODO](docs/TODO.md) and the [Prompt 12 completion note](docs/completion/12-ci-handoff.md) for precise completed and pending scope.

## Continuous integration

The GitHub Actions workflow runs on pushes, pull requests and manual dispatch on Linux amd64. It uses read-only repository permissions and pinned actions. All dependency installation, builds and tests run in containers with pinned images. The [first native run](https://github.com/orieken/testing-with-certs/actions/runs/37976084152) stopped at an unavailable old Chrome pin. The [second run](https://github.com/orieken/testing-with-certs/actions/runs/37977595683) passed static jobs, isolated startup, real Chrome/Edge, live contracts/security, all eight browser selections, credential scan and cleanup, but report upload could not read one Cucumber file. The [third run](https://github.com/orieken/testing-with-certs/actions/runs/37979583499) reached Cucumber and hit a Node HTTP/2 assertion. The [fourth run](https://github.com/orieken/testing-with-certs/actions/runs/37982298695) passed text upload but hit the same assertion in Edge/admin Cucumber. The [fifth run](https://github.com/orieken/testing-with-certs/actions/runs/38011861891) proved disabling HTTP/2 at Keycloak did not resolve it. The [sixth run](https://github.com/orieken/testing-with-certs/actions/runs/38012708736) passed the complete prior workflow with automated browsers using HTTP/1.1.

The workflow gates on static builds, OpenAPI lint/generated drift and a PR base comparison, then starts an isolated healthy Compose project. It runs live Playwright contracts and security checks before the real Chrome/Edge × Playwright Test/Cucumber × customer/admin matrix, scans artifacts and uploads text-only JUnit/Cucumber/coverage results. Ordinary jobs upload approved evidence; an explicit `full_evidence=true` dispatch additionally records and uploads the complete supported Debian/UBI9 browser matrix. The [Pages publication guide](docs/pages-report.md) describes verified video export and public deployment. The equivalent static and live matrix passed on Apple Silicon amd64 emulation; the sixth native run passed the complete prior workflow. The PR base comparison only runs on pull requests.

Run the same checks locally from the repository root:

```sh
docker build --platform linux/amd64 --target workspace -f infra/ci/Containerfile .
docker build --platform linux/amd64 --target spike -f infra/ci/Containerfile .
docker build --platform linux/amd64 -f services/catalog-api/Containerfile .
docker build --platform linux/amd64 -f services/insights-api/Containerfile .
docker compose -f infra/compose.yaml --profile '*' config --quiet
```

No repository secrets are required by the CI workflow. [Completion 25](docs/completion/25-pr-base-contract-evidence.md) records actual committed-base PR comparisons. [Completion 26](docs/completion/26-independent-ci-evidence.md) records subsequent native live, lesson, consumer, fault, and regional jobs with separate evidence.

## Separate certificate + password lesson

The shop remains certificate-only. A separate teaching view requires its selected
client certificate **and** the account password, collected directly by Keycloak.
[Testing instructions](testing/README.md#certificate--password-lesson) cover the
36-check Chrome/Edge × Playwright/Cucumber workflow, temporary credential cleanup
and opt-in local video recording. [Completion 15](docs/completion/15-certificate-password-view.md)
records local evidence and the remaining manual/native Linux dependencies.

Password/TOTP and passkey baseline/session/refresh acceptance each passed 48/48 locally and natively across Chrome/Edge and Playwright/Cucumber. Controlled OIDC baseline/session/refresh acceptance passed 40/40. SAML baseline/session/refresh acceptance passed 84/84. Kerberos baseline/session/refresh acceptance passed 40/40. The full native authentication matrix passed 260/260, with all 15 workflow jobs green at the corrected source. See [completion 47](docs/completion/47-kerberos-session-refresh.md) and the [authentication matrix](docs/teaching-coverage.md#authentication-protocol-matrix) for evidence and remaining scope.

Authentication recordings now cover every implemented method across both browsers and runners, with credential-provider pages hidden from video. The matrix gallery imports verified case/result metadata and filters by auth type. See [recording acceptance](docs/completion/51-authentication-recordings.md) and the [matrix report guide](docs/browser-matrix.md).
