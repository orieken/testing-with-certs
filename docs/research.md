# Research and reuse inventory

Inspected 2026-10-05. Local source repository: `/Users/oscarrieken/Projects/Rieken/saturday-monorepo`. Observed HEAD: `b5d3b1e45e4e45ffd0384958c9159298ae4395ca`. Files were read from the working tree; this does not assert that it was clean or identical to HEAD. Capture actual copied file hashes during implementation.

## Local findings

| Source relative to Saturday root | Observed behavior | Prototype treatment |
| --- | --- | --- |
| `apps/ye-olde-magic-shop/package.json` | Vue 3, Pinia, router, Leaflet, Cucumber and Playwright scripts; some local framework copies | Reuse UI; replace copied framework packages with real dependencies |
| `apps/ye-olde-magic-shop/src/views/` | Shop, item, cart, account, login, locations | Copy/adapt; add dashboards and widgets |
| `apps/ye-olde-magic-shop/src/views/LocationsView.vue` | Leaflet branches, polygon, layer toggles, geolocation, external OSM tiles; test exposure uses loose typing | Retain interactions; deterministic local map; typed test hooks |
| `apps/ye-olde-magic-shop/src/stores/authStore.ts` | Mock username/password login and localStorage tokens | Replace with Keycloak certificate/OIDC flow |
| `apps/ye-olde-magic-shop/src/api/orders.ts` | Client-supplied total and localStorage Authorization token | Server-computed pricing, new API boundary and token provider |
| `apps/mock-api/data/{items,orders,users}.json` | Available seed files | Transform synthetic business data; remove credentials and remap user IDs |
| `apps/mock-api/public/images/` | Existing magical-item image assets | Copy with license/notice provenance |
| `apps/mock-api/server.js` | Mock auth includes plaintext password handling | Do not reuse auth implementation |
| `apps/ye-olde-magic-shop/lib/site/` | Saturday site/page models | Adapt as common test interactions |
| `apps/ye-olde-magic-shop/features/`, `tests/` | Existing BDD and native Playwright examples | Select useful examples; update expectations and auth |
| `apps/ye-olde-magic-shop/Dockerfile` | Alpine Node app image | Rebuild for preferred UBI9 layout |
| `apps/ye-olde-magic-shop/Dockerfile.runner` | Official Playwright Jammy image | Not the UBI9 runner the user recalled |
| `packages/saturday-playwright-certs/example/Dockerfile` | Actual UBI9 example, Chrome/Edge RPMs, Xvfb, NSS tools | Primary browser-runner starting point |
| `packages/saturday-playwright-certs/example/docker-compose.yml` | Explicit `linux/amd64` platform | Local emulation and Linux amd64 feasibility gate |
| `packages/saturday-playwright-certs/src/` | Small certificate config and fixture helpers | Reuse with adapter for multiple origins/arbitrary users |
| `packages/saturday-playwright/src/index.ts` | Playwright fixtures for Saturday managers/logs | Compose with new auth fixtures |
| `packages/saturday-cucumber/src/world/saturday-world.ts` | Browser/context managers and cleanup | Reuse from installed package |
| App, mock API, and root `LICENSE`/`NOTICE` | Attribution files exist | Preserve applicable notices and verify asset provenance |

The UBI9 example is evidence of an existing recipe, not proof of a currently passing build. It uses a floating UBI tag, additional CentOS repositories with signature checking disabled, dependency-bypassing RPM installation, mixed package-management assumptions, and host certificate bind mounts. Adapt deliberately: verified package sources, pinned versions, validated dependencies, non-root browser operation, project-owned certificate volumes, and explicit container resource limits. Its README also enables `ignoreHTTPSErrors`; this prototype must instead install and verify trust.

## External primary references

- [Playwright browsers](https://playwright.dev/docs/browsers): real Chrome/Edge channels; stock Firefox restriction. Firefox is excluded by user choice.
- [Playwright system requirements](https://playwright.dev/docs/intro#system-requirements): supported Linux distributions do not include UBI9; a custom runner requires validation.
- [Keycloak X.509 user authentication](https://www.keycloak.org/docs/latest/server_admin/#_x509): certificate mapping and flow configuration; use a separate lab issuer.
- [Keycloak reverse proxy](https://www.keycloak.org/server/reverseproxy): choose passthrough for the auth listener; keep forwarded certificate identity out of that path.
- [Keycloak container guide](https://www.keycloak.org/server/containers): validate selected tag, build options, trust configuration and base image rather than assuming all tags are UBI9.
- [Keycloak JavaScript adapter](https://www.keycloak.org/securing-apps/javascript-adapter): SPA integration and memory-held tokens.
- [Chromium Linux certificate management](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/linux/cert_management.md): NSS trust/identity storage and version-sensitive paths.
- [Edge certificate auto-selection policy](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/AutoSelectCertificateForUrls): native browser certificate selection configuration.
- [noVNC](https://novnc.com/info.html): remote browser desktop transport.

Do not treat documentation examples, especially old Keycloak server/container terminology, as tested settings for the chosen version. Prompt 01 records exact effective settings and evidence.

## Remaining technical validation, not unanswered product questions

1. Build/run the existing UBI9 browser approach on native amd64 and Apple Silicon emulation; determine whether a remote Linux runner is needed for manual work.
2. Pin compatible Saturday/Playwright/Cucumber versions and confirm package availability or a reproducible packed-source path.
3. Verify installed-certificate login and narrow auto-selection policies for both Chrome and Edge; verify server trust rather than ignoring errors.
4. Confirm certificate-required Keycloak flow, protected unique identity mapping, token claim, existing-cookie behavior, and revocation configuration.
5. Verify multi-origin certificate behavior and canonical issuer through HAProxy passthrough.
6. Verify per-service TLS identity checks and pair them with token audience/client validation across all three languages.

No container builds or runtime authentication checks were performed while writing this plan.
