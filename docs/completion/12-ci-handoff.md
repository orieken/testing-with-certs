# 12 — CI gate increment and handoff status

Observed 2026-10-08 on macOS arm64 with Docker Desktop running pinned linux/amd64 images under emulation. The new GitHub workflow is written for `ubuntu-24.04`, but no GitHub or native Linux run occurred. The repository's `main` branch has no commits, so an actual pull-request base revision is not yet available. No deployment, package publication, commit or host certificate/trust-store command occurred. A before/after host trust inventory was not captured.

## Changes

- Added a conservative three-service OpenAPI base-bundle comparator with containerized mutation tests. It permits new paths/operations and statuses, but flags changes to existing origins, security, schemas, operations, request/response shapes and authorization metadata for review. CI uses the real PR base bundle when one exists; a first baseline without bundles is explicitly skipped.
- Extended CI from static image/Compose checks to an isolated `LAB_PROJECT`: healthy stack and realm bootstrap, live Playwright OpenAPI contracts and operation/status coverage before browser suites, live security checks, all Chrome/Edge × Playwright Test/Cucumber × customer/admin selections, then credential-artifact scan before any report upload. Upload is restricted to JUnit, Cucumber JSON/telemetry and coverage JSON; local WebM and HTML/video bundles are excluded. The CI-only `LAB_CI_REPORTS=1` path makes disposable report directories writable by the non-root container UID when the Linux host UID differs. Cleanup always targets only the CI project's containers and volumes. CI host Docker control does not mount certificate volumes into the host; jobs receive scoped mounts.
- Repaired container-only static CI build permissions and removed an unsupported pnpm install option. Corrected the catalog private quote contract metadata to identify `customer-catalog` as the token client while retaining `customer-api` as the certificate caller. The Python reporting path likewise checks `insights-reporting` as token client and `insights-api` as certificate caller. Regenerated checked-in contract bundles, digests and types in the pinned container.
- Updated architecture and workflow diagrams at the point the CI control/report boundary was added. Planned Linux execution and upload remain labeled separately from the local observations.
- Added a learner [teaching guide](../teaching-guide.md) and updated the root and contract README handoff text. It covers selected-user login, both runners, three API auth boundaries, regional reporting, renewal/revocation, reset and layered troubleshooting.
- Added a normalized Compose/source architecture check for the three API owners and their scoped mounts, PKI-only signing keys, private networks, loopback-only viewer, amd64 browser runners, host-wrapper command boundary and absence of TLS bypass flags. Its final local container run passed across 126 authored source files; CI now runs it after Compose validation.
- Added a pinned UBI9 Python/Lizard complexity gate. It counts authored Go, TypeScript/JavaScript and Python source, excludes generated/vendor files and tests, and caps new functions at cyclomatic complexity 50 and function NLOC 180. Two existing transport handlers retain exact non-increasing baselines of 70 (Node) and 62 (Python), so the check does not disguise that debt.
- Added `infra/render-diagrams.sh`, which extracts all Mermaid blocks from their Markdown sources and renders them with the official Mermaid CLI 11.17.0 image at digest `sha256:a6fb0574dded4086888b5e38476899c9aff8963196f689f11a0f8fceee588ce1`. The renderer's bundled Chromium needs `--no-sandbox` in Docker Desktop's namespace; this flag is confined to documentation rendering and does not affect the real test browsers or TLS verification. Simplified the two crowded topology overviews after visual inspection and corrected sequence syntax found by the parser.

## Exact commands and observed results

All builds, package installation, certificate issuance, database setup and tests ran in containers. The host invoked Docker/Compose and the `lab` shell wrapper only.

```sh
docker build --platform linux/amd64 --target base -t magic-shop-ci-base:12 -f infra/ci/Containerfile .
docker run --rm --platform linux/amd64 --entrypoint sh -v "$PWD:/work" -w /work magic-shop-ci-base:12 infra/contract-tooling-container.sh generate
docker build --platform linux/amd64 --target workspace -t magic-shop-ci-workspace:12 -f infra/ci/Containerfile .
docker run --rm --platform linux/amd64 --entrypoint sh magic-shop-ci-workspace:12 -c 'mkdir -p /tmp/base && cp /work/contracts/bundled/*.json /tmp/base/ && node /work/infra/check-openapi-breaking.mjs /tmp/base'
docker compose -f infra/compose.yaml --profile '*' config --format json | docker run -i --rm --platform linux/amd64 --entrypoint node -v "$PWD:/work:ro" magic-shop-ci-base:12 /work/infra/check-architecture.mjs
```

The final workspace image passed strict builds/types, Saturday package tests, OpenAPI lint and regenerated-artifact drift, the comparator's unchanged/additive/changed cases, 23-operation inventory, 92-status coverage inventory, six offline validator tests and seed validation. The same-bundle comparator check passed. The final architecture check passed its ownership, volume, network, browser-platform, host-wrapper and TLS flags across 126 authored source files. An earlier build found pnpm 12 did not accept the old `--fetch-retries` install option and a non-root write-permission issue; both were fixed before the passing build. The container subsequently had a writable Playwright reporter home, removing an otherwise noisy EACCES warning.

```sh
LAB_PROJECT=magic-shop-ci-local-12 ./lab up
LAB_PROJECT=magic-shop-ci-local-12 ./lab test --runner playwright --suite contracts
LAB_PROJECT=magic-shop-ci-local-12 ./lab test --runner playwright --suite security
export LAB_PROJECT=magic-shop-ci-local-12
for browser in chrome msedge; do
  for runner in playwright cucumber; do
    for user in customer-waterdeep shop-admin; do
      ./lab test --runner "$runner" --browser "$browser" --user "$user"
    done
  done
done
```

The isolated stack became healthy and bootstrapped its certificate-only realm. Contracts passed 17 Playwright tests and the 23-operation/status gate; its report is [`20261008T191938Z-contracts-5505`](../../artifacts/contracts/20261008T191938Z-contracts-5505). Security passed 12 tests. Both Chrome and Edge Playwright customer runs passed four applicable tests; their admin runs passed five. Both browsers' Cucumber customer runs passed four scenarios/14 steps; their admin runs passed three scenarios/11 steps. The other Playwright examples were role-filtered skips, not failures. The eight report directories are the `20261008T192023Z` through `20261008T192251Z` entries under [`artifacts/teaching`](../../artifacts/teaching). Every `lab test` run passed its per-run credential scan. Cucumber printed its preexisting Node 24 compatibility warning while the scenarios passed.

```sh
LAB_PROJECT=magic-shop-ci-local-12 docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-test sh -c 'google-chrome --version && microsoft-edge --version && node --version'
docker run --rm --platform linux/amd64 --entrypoint node -v "$PWD/artifacts:/work/artifacts:ro" magic-shop-runner:03 /work/testing/container/check-artifacts.mjs /work/artifacts/.
LAB_PROJECT=magic-shop-ci-local-12 ./lab reset --project magic-shop-ci-local-12
docker volume ls --format '{{.Name}}' --filter name=magic-shop-ci-local-12
docker ps --format '{{.Names}}' --filter name=magic-shop-ci-local-12
LAB_PROJECT=magic-shop-lab ./lab status
```

The runner contained Google Chrome 154.0.8037.97, Microsoft Edge 154.0.4258.62 and Node 24.10.0. The exact CI-style aggregate artifact scan passed 1,853 existing entries. Reset removed the disposable project's containers and volumes; the volume/container filters returned no names. The retained `magic-shop-lab` gateway, UI, Keycloak, PostgreSQL and three business APIs remained healthy, as did its existing manual runner.

```sh
docker build --platform linux/amd64 -t magic-shop-quality:12 -f infra/quality/Containerfile .
docker run --rm --platform linux/amd64 -v "$PWD:/work:ro" magic-shop-quality:12
./infra/render-diagrams.sh
```

The final complexity gate passed over 91 authored files and 478 functions. The largest measured CCN was 70 in the explicitly capped Node transport handler; Python's existing handler was capped at 62. All 20 Mermaid blocks rendered to gitignored SVGs from the Markdown sources. The first rendering attempt exposed semicolons that Mermaid parsed as sequence separators, which were corrected. A second attempt found the official renderer's Chromium path and Docker namespace requirement; the final digest-pinned command passed. PNG inspection of the architecture, infrastructure and CI diagrams showed the first two overviews were too crowded, so they were simplified and all 20 blocks rendered again. The inspected final PNGs are in `artifacts/diagrams/`; editable Markdown remains the source of truth.

```sh
LAB_PROJECT=magic-shop-repeat-12 ./lab up
LAB_PROJECT=magic-shop-repeat-12 docker compose -f infra/compose.yaml run --rm --no-deps --entrypoint bash db-bootstrap -c 'set -euo pipefail; PGPASSWORD=$(cat /secrets/customer/postgres-password); export PGPASSWORD; psql -X -q -At -v ON_ERROR_STOP=1 "host=postgres port=5432 dbname=customer_db user=customer_app sslmode=verify-full sslrootcert=/public/server-ca.pem connect_timeout=5" -c "CREATE TABLE IF NOT EXISTS ci_repeat_marker (value text PRIMARY KEY); INSERT INTO ci_repeat_marker(value) VALUES ('\''kept-after-up'\'') ON CONFLICT DO NOTHING; SELECT value FROM ci_repeat_marker;"'
LAB_PROJECT=magic-shop-repeat-12 ./lab up
LAB_PROJECT=magic-shop-repeat-12 docker compose -f infra/compose.yaml run --rm --no-deps --entrypoint bash db-bootstrap -c 'set -euo pipefail; PGPASSWORD=$(cat /secrets/customer/postgres-password); export PGPASSWORD; psql -X -q -At -v ON_ERROR_STOP=1 "host=postgres port=5432 dbname=customer_db user=customer_app sslmode=verify-full sslrootcert=/public/server-ca.pem connect_timeout=5" -c "SELECT value FROM ci_repeat_marker;"'
LAB_PROJECT=magic-shop-repeat-12 ./lab db verify
LAB_PROJECT=magic-shop-repeat-12 ./lab pki verify
LAB_PROJECT=magic-shop-repeat-12 ./lab reset --project magic-shop-repeat-12
```

This second new-volume project created the realm on its first start; the second reported `Existing realm retained`. The marker returned `kept-after-up` before and after restart. Four database owners passed verified TLS, cross-database isolation, plaintext, wrong-CA and wrong-hostname negatives after repeat startup. PKI verification passed chain, EKU, hostname, trust-domain negatives and initial CRLs. Reset removed only that disposable project's resources. This proves a new project and repeated startup, not a literal clone from a committed clean checkout.

## Decisions, limitations and next dependency

The comparator is deliberately conservative: even an optional change to an existing schema requires review. The repo has no committed base revision, so only comparator unit/mutation cases and a same-bundle invocation could be exercised locally. The final workflow parsed as YAML with four jobs and nine integration steps in the pinned Node container; GitHub/action semantics, PR base comparison, native Linux amd64 browser execution, CI artifact upload and retention remain unverified. The combined CI TODO gate and native Linux checkbox therefore stay open. The containerized local runs do not prove GitHub runner behavior.

The subsequent [host-trust continuation](12-host-trust-audit.md) captured matching macOS user/admin trust and keychain fingerprints before and after containerized PKI/security checks, with zero `Magic Shop` certificates in the login/System keychains. The Prompt 13 Charm operator is now implemented; see its [completion note](13-operator-tui.md). The user later confirmed both current Compose manual-viewer identities in [completion 10](10-manual-browser.md). The remaining Prompt 12 dependencies are a literal clean checkout after an initial committed baseline and a native Linux workflow run.

## Native Linux availability recheck, 2026-10-09

```sh
docker context ls --format '{{.Name}} {{.DockerEndpoint}} {{.Current}}'
docker info --format '{{.OSType}} {{.Architecture}} {{.Name}}'
docker --context default info --format '{{.OSType}} {{.Architecture}} {{.Name}}'
```

Only `default` and `desktop-linux` contexts were configured. Both engine queries returned `linux aarch64 docker-desktop`; the default context is not a separate amd64 host. No native Linux amd64 run was attempted or claimed. The Linux CI and Prompt 13 native-platform TODO boxes remain unchecked. A future run requires an actual native amd64 Docker context or a committed repository baseline that can trigger the written GitHub workflow. Neither was created here.

The user subsequently chose to skip native Linux verification. The [scope decision](12-native-linux-scope.md) records the unverified result and keeps those boxes unchecked without treating a skipped run as a passing run.
