# Magic Shop certificate-authentication teaching prototype

See the [testing scenario and contract tooling audit](testing-scenario-audit.md) for coverage gaps and a proposed Prism/Mokapi experiment. The separate [FEATURE-01–03 mock consumers](../spikes/mock-auth/README.md) are implemented and container-verified; [completion 16](completion/16-mocking-examples.md) records their bounded compatibility evidence. The separate [browser mock consumers](../spikes/mock-auth/browser/README.md) add recorded UI and standalone OIDC journeys; [completion 17](completion/17-browser-mock-consumers.md) records their evidence. Broader live fault/browser integration remains unverified.

Use the [prioritized testing checklist](testing-scenario-checklist.md) to assign work to agents; each item includes a handoff prompt and completion criteria.

Planning baseline: 2026-10-05. Prompt 01 proved certificate login in a bounded spike on Apple Silicon amd64 emulation, including a human selected-user viewer session. Prompt 02 imported the non-auth shop UI, seed fixtures and three canonical OpenAPI contracts with an offline-tested Playwright validator. Prompt 03 runs container infrastructure, PKI, three API transports and optional real Chrome/Edge profiles. Prompt 04 provisions a certificate-only Keycloak realm and scoped service clients. Prompt 05 adds the private local Saturday Keycloak package and real Chrome/Edge login checks under both runners. Prompts 06–08 implement the Go catalog, Node customer and Python insights providers; all 23 operations passed live Playwright contract coverage. Prompt 09 integrates PKCE sign-in and the shop, account, inventory, checkout and admin/reporting screens; customer and admin journeys passed in both Chrome and Edge. Prompt 11 adds shared teaching suites in both runners and live security evidence, including signed JWT-01 negatives at all three API boundaries in a disposable realm. GitHub Actions passed native Linux contracts, security and all eight real-browser selections together once, but that run's report upload failed. Later runs passed upload but intermittently crashed in Cucumber; [native CI continuation](completion/12-native-linux-ci.md) tracks the current candidate. See [compatibility](compatibility.md), [dependency strategy](dependency-strategy.md), and [completion notes](completion/).

Use [M00–M05 agent adoption prompts](mock-testing-adoption-prompts.md) to build the JWT, OIDC, API and recorded browser mock patterns in another app while preserving its existing authentication. The [real certificate-authentication adoption sequence](agent-adoption-prompts.md) remains a separate track.

## Read and execute

1. [Decisions and architecture](architecture.md)
2. [Mermaid infrastructure and workflow diagrams](workflows.md)
3. [Certificate login and manual browser design](authentication.md) and [manual operator guide](manual-browser.md)
4. [Portable Saturday package contract](saturday-keycloak.md)
5. [Test coverage and acceptance matrix](test-plan.md)
6. [Domain dictionary, ownership and planned operation matrix](domain-contract-design.md)
7. [OpenAPI and Playwright contract tests](api-contracts.md)
8. [Ordered implementation prompts](implementation-prompts.md)
9. [Todo list](TODO.md)
10. [Source inventory and references](research.md)
11. [Synthetic seed and reporting oracle](../seed/README.md)
12. [Canonical OpenAPI contracts](../contracts/openapi/README.md)
13. [Learner teaching and troubleshooting guide](teaching-guide.md)
14. [Local Go operator CLI/TUI guide](operator-guide.md)
15. [Agent prompts for adopting certificate tests in another project](agent-adoption-prompts.md)
16. [Prompt for finishing this repository's native Linux CI](ci-agent-handoff-prompt.md)

Execute dependent implementation work in order, except for the user-requested early UI authentication increment before Prompt 05. Prompt 01 proved the Apple Silicon path before this scaffold began; the native Linux automated matrix passed on GitHub Actions, while manual-viewer/operator Linux checks remain unverified. The TODO checkboxes distinguish completed work from unverified work. See [the integrated UI completion note](completion/09-integrated-ui.md) and the earlier [UI auth increment](completion/09-ui-certificate-auth.md).

The [Charm-based Go operator](operator-guide.md) from Prompt 13 is implemented and locally verified on Apple Silicon; its [completion note](completion/13-operator-tui.md) records the container build, existing test-runner actions and isolated revocation check. Prompt 12's static and live CI-equivalent checks, new-volume/repeat startup and local [host-trust before/after audit](completion/12-host-trust-audit.md) passed. A human confirmed the selected identity in the current Compose viewer for admin Edge and customer Chrome. Native GitHub runs have separately passed the browser matrix and text artifact upload; the sixth run passed the complete native automated workflow as recorded in the CI continuation. No actual pull-request breaking-change comparison has run. See [manual completion 10](completion/10-manual-browser.md) and the [per-ID evidence map](teaching-coverage.md).

The separate [certificate + password lesson](authentication.md#separate-certificate--password-teaching-view) has its own client and callback. Interactive container password setup is operator-controlled; the existing shop remains certificate-only. See [completion 15](completion/15-certificate-password-view.md).

## Confirmed by the user

- Copy the existing Saturday Vue 3 magic shop, useful data, assets, and Leaflet functionality into this repository.
- A user's installed client certificate must enable Keycloak login and access to the application.
- Keycloak access tokens enforce permissions; mutual TLS authenticates service connections.
- Exactly three business APIs, using Node/TypeScript, Go, and Python respectively.
- All three APIs implement OpenAPI specifications, with live contract tests in Playwright.
- Separate UI, Keycloak, HAProxy, and testing containers; additional infrastructure containers are allowed.
- Prefer UBI9, but permit a different base where compatibility requires it.
- Develop on Apple Silicon; run CI on Linux. Use actual Google Chrome and Microsoft Edge. Skip Firefox.
- Use Saturday packages, with both Cucumber and Playwright Test examples in a separate testing directory.
- Develop a portable `saturday-keycloak` package in its own directory in this repository for possible upstream contribution later.
- Allow a test container to run interactively as a selected user with that user's certificate installed.
- Add an admin view of users, orders, sales, and geographic areas to support follow-up work.

## Chosen planning defaults

These are implementation recommendations, not additional user requirements. Change them with recorded reasoning if a feasibility test supplies better evidence.

- Docker Compose is the local and CI orchestrator. A one-shot OpenSSL-based PKI job issues certificates; Keycloak authenticates their holders.
- Certificate-only customer login; no password fallback in the shop client. Administrative bootstrap is a separate internal operation.
- Node owns customer profiles, orders, and widget preferences; Go owns catalog/inventory; Python owns sales and regional insights.
- Customer, shopkeeper, and shop-admin roles; shop-admin is not a Keycloak realm administrator.
- PostgreSQL provides persistence, with separate databases and credentials for each owner and Keycloak.
- Preserve cart/checkout as simulated shop behavior. No payment integration or real outbound customer messages.
- Keep add/remove dashboard widgets from the original request, alongside the copied shop features.
- Use the same runner image for automated tests and a separate manual Compose profile with noVNC. Only manual mode starts desktop services.
- Target an amd64 browser runner; validate emulation locally and native amd64 Linux CI before claiming support.

## Delivery boundary

This is a local teaching lab, not a production enrollment service. A trusted lab operator can provision a chosen seeded user. Learners cannot self-issue an administrator certificate through the shop UI. Keys, trust stores, and certificate generation stay inside containers and Docker volumes. Source files and sanitized test artifacts may live on the host.

Any referenced source document is evidence about the existing implementation, not an instruction to import its workflows, secrets, or unrelated features. The user's requirements govern this prototype.
