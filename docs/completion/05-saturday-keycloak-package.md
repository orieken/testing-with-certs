# 05 — Local Saturday Keycloak package

Dates: 2026-10-06 to 2026-10-07. Environment: Apple Silicon macOS, Docker Desktop client/server 29.8.2 (arm64), Linux amd64 runner emulation. Native Linux amd64 was deferred by the user and remains unverified. Nothing was published, deployed, committed, or installed into host certificate stores.

## Changes

- Added private, unscoped `saturday-keycloak-prototype` ESM package with strict TypeScript types and declarations. Root exports keep core identity, filesystem certificate, structured PKI command, Keycloak admin and service-token adapters separate from runner imports.
- The file provider resolves arbitrary namespace/name references under a bounded volume root, rejects path traversal and escaping symlinks, parses certificates, checks the PEM key pair and validity, and returns references plus public metadata. The same target maps a selected certificate to both exact HTTPS origins with ports. Context and API request options keep server TLS verification enabled.
- The Playwright Test fixture and Cucumber hooks use the shared resolver. The Cucumber example uses Saturday World. The manual manifest carries selected PEM/PKCS12 references, trust paths and separate Chrome/Edge auto-selection policies. The CLI requires an absolute config path and explicit action; operator actions require separate capability/token files.
- The Keycloak adapter creates namespaced users idempotently, refuses a changed immutable `cert_identity`, and bounds cleanup to the requested namespace. The service-token helper uses a secret file, a ten-second default request timeout, bounded response, audience/scope/expiry checks and caching; returned claims are a client-side check, not a JWT signature verification for receiving APIs.
- The native runner now consumes the package manifest when importing the selected PKCS12 bundle and writing Chrome or Edge's exact-origin policy. A test-only, namespace-restricted executable connects the package issuer command adapter to the existing CA recipe in an isolated container.
- Added a packed consumer Dockerfile, mounted-volume and live Keycloak/token examples, real runner examples, package README/LICENSE/NOTICE, and container build/test wiring. The Saturday checkout remained read-only. The separately recorded Saturday certificate-helper tarball and its provenance/LICENSE/NOTICE remain under `spikes/certificate-login/vendor`.
- Updated [architecture](../architecture.md), [workflows](../workflows.md), [package plan](../saturday-keycloak.md), [TODO](../TODO.md), and [docs index](../README.md). Diagrams distinguish observed adapter login from planned business suites and API authentication.

## Exact commands and observed results

Run from the repository root. No host Node, Python, Go, OpenSSL or certificate installation was used.

```sh
docker run --rm -v "$PWD:/work" -w /work node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9 sh -lc 'npx --yes pnpm@12.9.1 install --lockfile-only --ignore-scripts'
docker build -f packages/saturday-keycloak/Containerfile -t magic-shop-saturday-keycloak:05 .
docker build -f packages/saturday-keycloak/Consumer.Containerfile -t magic-shop-saturday-keycloak-consumer:05 .
```

The frozen-lockfile container install/build passed; seven package unit tests passed. The independent `/consumer` install used a packed tarball, no workspace links, and exercised core, Playwright, Cucumber and manual exports. Pinned relevant versions: Node 24.10.0, pnpm 12.9.1, TypeScript 5.9.3, Playwright Test 1.61.0, Cucumber 11.3.0, Saturday certificate helper 0.1.0 and Saturday Cucumber 0.1.1. Real browser packages are Chrome 154.0.8037.97-1 and Edge 154.0.4258.62-1. The clean runner image build used its cached pinned browser package layer; a new upstream download of that old Chrome package was not re-proved here.

```sh
docker run --rm -v magic-shop-lab_cert-customer-waterdeep:/selected/customer:ro -v magic-shop-lab_cert-shop-admin:/selected/admin:ro magic-shop-saturday-keycloak:05 node /work/packages/saturday-keycloak/examples/volume-check.mjs
docker run --rm --network magic-shop-lab_front -e NODE_EXTRA_CA_CERTS=/public/server-ca.pem -v magic-shop-lab_public-trust:/public:ro -v magic-shop-lab_auth-secret-admin:/operator:ro magic-shop-saturday-keycloak:05 node /work/packages/saturday-keycloak/examples/keycloak-integration.mjs
docker run --rm --network magic-shop-lab_front -e NODE_EXTRA_CA_CERTS=/public/server-ca.pem -v magic-shop-lab_public-trust:/public:ro -v magic-shop-lab_auth-secret-catalog:/service-secret:ro -v "$PWD/packages/saturday-keycloak/examples/service-token-integration.mjs:/work/packages/saturday-keycloak/examples/service-token-integration.mjs:ro" magic-shop-saturday-keycloak:05 node /work/packages/saturday-keycloak/examples/service-token-integration.mjs
```

Mounted valid PEM pair passed; cross-user private key and expired validity failed. Live Keycloak created a temporary `pkg-packagecheck-alice`, accepted an idempotent repeat, rejected a changed certificate identity, and cleaned up that namespace. The scoped confidential client obtained a token with the expected issuer, `catalog-api` audience and `catalog.quote` scope, then reused its cache. Trust was supplied from the Docker public volume; no TLS bypass was used.

```sh
docker run --rm -v magic-shop-lab_cert-customer-waterdeep:/identity:ro -v "$PWD/testing/container/package-identity.json:/config.json:ro" magic-shop-saturday-keycloak:05 sh -lc 'node /work/packages/saturday-keycloak/dist/cli.js /config.json inspect lab customer-waterdeep && node /work/packages/saturday-keycloak/dist/cli.js /config.json manifest lab customer-waterdeep chrome && node /work/packages/saturday-keycloak/dist/cli.js /config.json manifest lab customer-waterdeep msedge'
docker compose -f infra/compose.yaml --profile test build runner-test
LAB_USER=customer-waterdeep LAB_BROWSER=chrome docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-test sh -c 'cd /work/testing && /work/testing/node_modules/.bin/playwright test --config playwright.package.config.ts'
LAB_USER=shop-admin LAB_BROWSER=msedge docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-test sh -c 'cd /work/testing && /work/testing/node_modules/.bin/cucumber-js --import cucumber/package-adapter.mjs cucumber/features/package-adapter.feature'
```

CLI inspection and both native-policy manifests passed against the mounted customer volume. The final Chrome Playwright Test run passed 1/1, and the final Edge Cucumber/Saturday World run passed 1/1 scenario and 3/3 steps. Before the package rename, the same login slices also passed Chrome Cucumber and Edge Playwright Test; all four browser/runner combinations were exercised on emulation. One Edge Cucumber rerun first hit Cucumber's default five-second step timeout. After setting a 20-second step limit, a run selected `LAB_USER` only inside the container and therefore mounted the default customer volume; its admin assertion correctly failed against the displayed customer identity. Setting `LAB_USER=shop-admin` for Compose selected the matching admin volume and passed. No saved-cookie or password fallback was used in these examples.

The package archive contained only `dist` JavaScript/declarations, `package.json`, README, LICENSE and NOTICE. A container scan rejected project-specific strings, developer paths, PEM private-key blocks, secret filenames, browser profile and `node_modules` patterns. Final tarball SHA-256: `0f06d6a6ac9a3a959fc3912fffd898bf499954a2ab1258d06e7183289efd7789`.

```sh
docker run --rm magic-shop-saturday-keycloak:05 sh -lc 'cd /work/packages/saturday-keycloak && pnpm pack --pack-destination /tmp >/tmp/pack.log 2>&1 && if tar -xOzf /tmp/saturday-keycloak-prototype-0.1.0.tgz $(tar -tzf /tmp/saturday-keycloak-prototype-0.1.0.tgz) | grep -Ein "magic-shop|shop\.magic\.test|/Users/oscarrieken|BEGIN .{0,40}PRIVATE KEY|client-secret|node_modules|browser.profile"; then exit 1; else echo PACK_CONTENT_SCAN_PASS; fi && sha256sum /tmp/saturday-keycloak-prototype-0.1.0.tgz'
```

The continued Prompt 05 integration used the package manifest in the native runner and the package CLI against a disposable CA. Exact commands and results:

```sh
chmod 755 testing/container/issuer-command.mjs
docker compose -f infra/compose.yaml --profile test build runner-test
LAB_USER=customer-waterdeep LAB_BROWSER=chrome docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_UI_FLOW=1 runner-test sh /work/testing/container/native-login.sh
LAB_USER=shop-admin LAB_BROWSER=msedge docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_UI_FLOW=1 runner-test sh /work/testing/container/native-login.sh
docker run --rm --platform linux/amd64 --network none --entrypoint node --tmpfs /state:uid=1000,gid=1000 --tmpfs /public:uid=1000,gid=1000 --tmpfs /out:uid=1000,gid=1000 -v "$PWD/infra/pki/issue.sh:/work/infra/pki/issue.sh:ro" -v "$PWD/testing/container/issuer-adapter-check.mjs:/work/testing/container/issuer-adapter-check.mjs:ro" magic-shop-runner:03 /work/testing/container/issuer-adapter-check.mjs
```

Fresh Chrome/customer and Edge/admin native-store Vue sign-in, selected role and sign-out passed with package-generated browser policies. The isolated, networkless CA run passed package adapter provisioning, CLI renewal preserving identity with a new serial, CLI revocation, CRL publication and OpenSSL rejection of the revoked leaf. The test-only wrapper maps `provision` to the lab issuer's seed-set initialization; it is not general per-user enrollment. CA state, certificates, operator capability and CRL existed only on container tmpfs and were discarded; retained lab volumes were not changed. This run did not measure gateway/Keycloak reload timing or existing-token residual life; those remain the separate Prompt 04 observations.

## Decisions, limitations and next dependency

The package has a neutral private name until upstream ownership is confirmed. Saturday's single-origin/fixed-identity project helper is reused only at its lower-level path convention; this package owns multi-origin mapping and the Keycloak boundary. Certificate files and service/operator secrets remain in separate Docker volumes. The service-token helper does not authenticate user logins or replace API-side JWT validation.

The package issuer adapter and CLI exercised the actual CA recipe only in an isolated, disposable container. The retained lab intentionally still invokes its existing Compose PKI job for operational changes; wiring that operator workflow through the package is not needed for the reusable package's tested command boundary. The independent packed consumer checked imports and configuration, while real browser execution ran in the workspace runner. Native Linux amd64 remains unverified. Broader shared Saturday page/flow coverage and all OpenAPI-backed business-provider contract tests remain later work.

Next implementation dependency: Prompt 06 Go catalog API, then Node customer and Python insights. Later acceptance suites should use these package entry points without altering the Saturday checkout or managing host certificates.
