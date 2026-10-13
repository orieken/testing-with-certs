# TEST-10 / REGION-02 — Real regional reporting boundaries

Observed locally on macOS arm64 Docker Desktop, 2026-10-10 (America/Chicago),
with linux/amd64 Node/browser runners under emulation and arm64 service containers.
All installation, builds, PKI, database fixture work and tests run in containers.
No new native Linux-host, CI, deployment or publication evidence is claimed.

## Semantics and independent oracle

Canonical insights documentation and the domain implementation define a half-open
UTC interval `[from, to)` on **completedAt**, with only completed orders grouped
by their immutable saved **order.regionId**. Profile region/location reflects the
customer now; it does not move historical sales. Distinct customer counts are by
subject within the selected historical region.

The separate November dataset leaves seed files and the September oracle unchanged.
It contains 114 canonical-valid orders, independently Ajv-checked before insertion
using the scoped customer database owner over verified PostgreSQL TLS:

| Fixture | Completed time/status | Expected in November Waterdeep |
| --- | --- | --- |
| Before start | 2026-10-31 23:59:59.999Z, 400 copper | Excluded |
| Exactly at start | 2026-11-01 00:00:00Z, 100 copper | Included |
| 108 middle orders | November 15, 100 copper each | Included |
| Immediately before end | 2026-11-30 23:59:59.999Z, 200 copper | Included |
| Exactly at end | 2026-12-01 00:00:00Z, 300 copper | Excluded; included in adjacent window |
| Pending/cancelled | November creation, null completion, 90,000/80,000 copper | Excluded |

The hand-written oracle is **110 orders, 2 customers, 11,100 copper**:
108×100 +100 +200. Owner A has 55 orders /5,500 copper; owner B 55 /5,600.
The entire ordered set of 110 IDs is asserted, not just a count or timing estimate.
Narrow one-second windows independently isolate the lower and upper records.

After insertion, owner A is genuinely moved through its real authenticated profile
PATCH from seeded Neverwinter to Baldur's Gate, location `[-119.5,42]`. Database
snapshots assert no saved order changes. Waterdeep sales/customer membership remain
historical. The admin Customers filter also uses saved order membership, while
its row displays current residence. Baldur's Gate has zero November completed sales despite current profiles.

## Real provider and browser path

Nothing is mocked: real Vue, certificate-only PKCE, Keycloak, gateway, Node,
Python and PostgreSQL are used. The separate teaching certificate-plus-password
view is untouched. There is no dependency DNS redirection or mock authentication.
All server CA/hostname and certificate identity/API authorization checks remain.

- Provider assertions cover exact bounds/completed-only totals, genuine profile
  move, seven public order pages (limit 17), two public customer pages (limit 1),
  preserved September overall **124,000 copper** and each region's oracle, empty
  region, and two real private reporting pages (**100 +10**) sharing a revision.
  Scoped service credentials/certificate fetch those private pages over verified
  TLS; valid responses pass existing canonical Ajv checks.
- The browser uses the same four shared journeys in real Chrome and Edge through
  Playwright and Cucumber: November multi-page totals, moved profile/current versus
  historical tables, empty region and the preserved September Waterdeep result
  (**570 gp, 3 orders, 2 customers**). Map tooltip copper agrees with the summary.
  Regional customer rows agree with API totals; no external network request occurs.
- The current regional order UI shows only the first **25** records and has no
  regional load-more control. Tests assert those exact IDs; the map/summary and
  customer totals include all 110. Exhaustive API pagination proves the remainder.
  This does not claim all 110 orders are rendered in the UI or change its behavior.
- A separate mutation-tested gate requires all provider cases, unique browser
  selections, verified TLS, no mock flags/external requests, canonical validation
  and actual video files. It does not replace the existing full contract gate.

## Commands and observed results

```sh
LAB_PROJECT=magic-shop-regional-24a ./testing/regional/run.sh
LAB_PROJECT=magic-shop-regional-24b ./testing/regional/run.sh
LAB_PROJECT=magic-shop-regional-24c ./testing/regional/run.sh
LAB_PROJECT=magic-shop-regional-24d ./testing/regional/run.sh
```

The wrapper builds runner and unchanged service/UI images, starts a fresh private
project with 120-second startup bounds, provisions the real realm and scoped
fixtures, runs provider tests (180-second command bound), then each browser/runner
selection (240 seconds), the evidence gate, profile restoration/fixture deletion
and artifact scan. Tests have 60-second deadlines and zero retries. Every exit
removes project containers, networks and all credential/database/profile volumes;
existing projects are refused. Shell source is frozen during execution.

The Python image build passes **13 domain/reporting/auth/equivalence tests**, adding
exact millisecond-record bounds, completed-only status and 110-row aggregation
with current-location differences. Production application source is unchanged.

24a passed historical/pagination/September checks but failed the mixed-precision
endpoint probe described below; it is not counted as passing. 24b passed all five
provider acceptance cases, but its Chrome map test counted SVG control icons as
regions (seven paths). The empty-region journey passed; the matrix was incomplete.
The selector was corrected to four actual interactive overlay polygons. 24c passed all six provider checks, but a browser assertion incorrectly expected
the moved customer to disappear from the historical-region customer filter. That
filter intentionally uses saved order membership and displays current residence;
the assertion now requires the customer to remain with Baldur's Gate displayed.
24a also used an unchanged initial profile; 24b onward perform a genuine move. Cleanup
was verified after all three failed projects. Their failed statuses/videos remain explicit.

## Concrete existing limitation: endpoint timestamp precision

A chronologically valid interval from `2026-11-01T00:00:00Z` to
`2026-11-01T00:00:00.001Z` reaches the unchanged Node reporting range check, which
compares timestamp strings lexically. Its rejection becomes Python's canonical
503 `dependency_unavailable`; the API does not support that mixed-precision
interval correctly. The final suite records this with a separate known-limitation
probe; it is **not** credited as supported fractional endpoint behavior.

The required midnight/day-window boundaries use whole-second UTC endpoints while
before-boundary records retain millisecond precision. Their inclusion/exclusion,
complete IDs and adjacent-window behavior are proved independently. No timestamp
implementation was changed to obtain passing evidence. A separate production fix
would need chronological comparison plus its own regression verification.

## Pins and environment

The existing Compose files and lockfiles retain pinned images/dependencies. Python
and quality base: `registry.access.redhat.com/ubi9/python-312@sha256:d3a5322122fd7efd5d5a2486c8c221f4785c364199f27e50a33aced417047e6a`.
Runner Node 24.19.0 / Debian 12 / linux x64, Playwright 1.61.0, Ajv 8.20.0,
pg 8.23.1, real Chrome 155.0.8059.39 and Edge 154.0.4258.62, Docker 29.8.2,
Compose v5.5.1 and LinuxKit 7.0.14-linuxkit. The runner base is
`node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df`;
service Node uses 24.10.0 with its existing locked dependencies. Each execution
records exact image IDs in `images.txt`, runtime in `environment.json`, Docker and
Compose versions and canonical contract digests in `provider.json`.

Actual UI WebM files are under `artifacts/regional/<project>/<runner>-<browser>/`.
Browser keys, profiles and private failure diagnostics stay in volumes; trace,
HAR and storageState are not exported. Videos carry a visible real-auth/real-API
local-container label and require visual review before sharing. The
[copyable example](../../testing/regional/README.md) explains proof and limitations.

## Final verified execution

Project **magic-shop-regional-24d** passed two evidence mutation tests, all six
provider checks (five acceptance cases plus the explicit unsupported-precision
probe), and **16/16** actual UI journeys: four each in Chrome/Edge with
Playwright/Cucumber, zero retries. The independent evidence gate passed.
The original profile was restored through the real API and all synthetic orders
were deleted before disposal. The safe artifact scan passed (27 entries, including
the reviewed frame); project cleanup is recorded in `cleanup.txt`. Failed projects
24a–c also verified disposal. These failed attempts are not credited as full runs.

Representative `playwright-chrome/november-pages.webm` was visually reviewed via
a container-extracted final frame: 111.00 gp /110 orders /2 customers and
Waterdeep map tooltip 11,100 copper, with the real-auth/local evidence badge.
The browser captures no login passwords, tokens or private profiles.

Additional exact checks from repository root:

```sh
docker run --rm --platform linux/arm64 --network none --entrypoint sh \
  --mount type=bind,source="$PWD",target=/work,readonly magic-shop-insights-api:03 \
  -c 'cd /work/services/insights-api && PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -v'
docker run --rm --platform linux/amd64 --network none \
  --mount type=bind,src="$PWD",dst=/work,readonly magic-shop-quality:15
docker compose -f infra/compose.yaml --profile '*' config --format json | \
  docker run --rm -i --platform linux/amd64 --network none --entrypoint node \
  --mount type=bind,source="$PWD",target=/work,readonly magic-shop-runner:03 \
  /work/infra/check-architecture.mjs
docker run --rm --platform linux/amd64 --network none --entrypoint sh \
  --mount type=bind,source="$PWD",target=/work,readonly magic-shop-runner:03 \
  -c 'for source in /work/testing/regional/*.mjs; do node --check "$source" || exit; done; sh -n /work/testing/regional/run.sh'
```

Results: all 13 Python tests passed; quality passed at 165 authored files /948
functions with the two existing capped transport baselines; architecture and syntax
guards passed. The new runtime functions previously checked at CCN ≤6/NLOC ≤30.
An initial extra unit-test invocation mistakenly requested amd64 for the arm64
service image (no tests ran), then named a nonexistent `test_auth` module. Corrected
native container discovery above passed all 13; neither failed invocation is credited.
Production/security source diff and `git diff --check` are clean. Work remains local.

Exact built image IDs for 24d:

```text
[magic-shop-runner:03] sha256:717901063bba82814dc23af762202e4f21deafd7aff227879a886dc0bfe8d4f1
[magic-shop-customer-api:03] sha256:7d1b7d38353f4d1677d6831a1d85f9e913e29b7ef7ec3b284d79b042c064e18c
[magic-shop-catalog-api:03] sha256:c1c9974407333a64e0a33908171ab08db893754c9da1c661d86fb023b26b9445
[magic-shop-insights-api:03] sha256:4f08f769473b1f2d08a14ab7084507b85ceb888b8180d8f8e99abeb1baf5ca14
[magic-shop-keycloak:03] sha256:f0842753c27fd8cfdad11c8c66033f542a7a656ec2d6b6fd4f54df622c76b907
[magic-shop-gateway:03] sha256:87f8a3592e22e1cf86a60b8e93c35da5a9ea785957f2e9a165cbb0b861cda80d
[magic-shop-postgres:03] sha256:4509022c8e0b54d4acec0c15976508888bdaf10ac131827d61da3b04b985ea0f
```

No full fractional-query support, all-row UI rendering, native Linux-host run,
GitHub CI, publishing or deployment is claimed.
