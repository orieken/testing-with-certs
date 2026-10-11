# TEST-03: real checkout dependency faults

Run from the repository root. Everything builds and executes in containers:

```sh
./testing/faults/checkout/run.sh
# Optional: record a NEW execution's live output in a no-network Chrome viewer.
./testing/faults/checkout/record.sh
# Explicit disposable name, for repeatable report lookup:
LAB_PROJECT=magic-shop-checkout-fault-example ./testing/faults/checkout/run.sh
# Expected exit 1; verifies cleanup after a deliberately failing harness:
LAB_PROJECT=magic-shop-checkout-fault-failure CHECKOUT_FORCE_FAILURE=1 ./testing/faults/checkout/run.sh
```

Each invocation requires a fresh `magic-shop-checkout-fault-*` project. Existing
project resources are rejected. Reports are local, gitignored and separated under
`artifacts/checkout-faults/<project>/`: sanitized JSON/JUnit, untouched live-status
coverage, runtime/image versions and cleanup evidence. The video is a live output
viewer, **not a browser checkout journey**. No auth credentials are mounted into
its no-network recorder. Manual/browser examples remain separate suites.

The wrapper builds the pinned real stack and runner, provisions fresh synthetic
certificate identities and the real Keycloak realm, and mounts the original
customer database credential. It creates a private TLS fault adapter and discovers
its Docker-assigned IP. Only the disposable Node container's `catalog-api` hosts
entry points to that adapter. HAProxy still routes public catalog calls to the
real Go provider; Vue, Keycloak, contracts and application code are unchanged.
The front, backend, auth and database networks are internal; no port is published.

The adapter uses the disposable catalog server leaf and the Node service caller
leaf from their existing narrow volumes. It verifies the incoming service chain,
CRL and `customer-api` CN, then connects to the real Go catalog using verified
server CA/hostname and Node's service certificate. Go verifies the unchanged
real Keycloak service token, audience, scope and client pairing. Only an authorized
200 quote is eligible for fault injection. No token/header/body is logged or
persisted by the adapter; it has no control HTTP endpoint. Its small atomic mode
file and counter-only audit live in a disposable volume. This trusted test adapter
terminates two TLS connections; it is not end-to-end certificate forwarding or a
production proxy. Never apply this overlay to a retained or deployed project.

| Injected dependency behavior | Real consumer/database assertions |
| --- | --- |
| Unavailable reply: close the authorized quote connection without a response | Canonical structured 503 within 8 seconds; no Location; no order/idempotency result or revision change |
| Hold the authorized reply for 12 seconds | Real Node 5-second dependency abort, measured between 4.5 and 8 seconds; same zero-persistence checks |
| Intentionally invalid JSON with HTTP 200 | Existing Ajv validator rejects the fault; Node returns canonical 503 and persists nothing |
| Intentionally invalid quote types/lines with HTTP 200 | Existing Ajv rejects the fault; Node's domain checks fail closed with 503 and no persistence |
| Restore ordinary forwarding after every fault | Same request/key returns canonical 201 with real Go prices; exactly one completed database order/hash and one revision increment; replay adds no order and calls no quote dependency |

The four checkout cases use fresh real certificate-only PKCE user tokens, call
through the unchanged HAProxy boundary, validate requests and 503/201 responses
with existing strict Ajv tooling, and query the real PostgreSQL database over
verified TLS. The order row itself owns the successful idempotency key/hash;
there is no separate success cache/table. Database assertions compare global order
count, owner/key count and dataset revision before failure, after failure, after
recovery and after replay.

A fifth case proves TLS rejection for wrong server CA/hostname, missing client,
wrong client CA and wrong service CN; upstream CA/hostname negatives use the real
catalog origin. Missing/altered tokens reach real Go and remain 401; they cannot
trigger a fabricated successful quote. These are browserless API/transport checks.

The preceding 17 live/validator cases remain independent provider observations.
The live gate requires all 23 operations and observed business errors including
checkout 409/422; every other documented status has an explicit, reasoned
exclusion in the manifest. Its source check rejects mock/fault reports. Checkout
503 is separately mandatory in `check-evidence.mjs`; it cannot be counted as
untouched catalog-provider behavior. Missing/failed faults, wrong provenance,
missing 503, persistence violations and exceeded timing bounds fail that gate.

The wrapper traps success/failure/signals, tears down only its named project and
checks label-based absence of containers, networks and volumes. Trust-store
initialization is repeatable and bounded to 10 seconds per command. The full
TypeScript/unit/Playwright phase is bounded to 180 seconds. Force-killing Docker
or losing the host can prevent traps; explicit recovery is:

```sh
LAB_PROJECT=magic-shop-checkout-fault-example docker compose \
  -f infra/compose.yaml -f infra/checkout-fault.compose.yaml \
  --profile '*' down --volumes --remove-orphans --timeout 10
```

This proves consumer fail-closed behavior, persistence invariants and manual
same-key recovery against injected quote faults. It does not prove a real catalog
outage, native Linux, concurrent database atomicity/lost-response races, all TLS
revocation paths, a browser UI journey, or mock authentication acceptance by APIs.
No synthetic auth is used by this suite. See [completion 19](../../../docs/completion/19-checkout-dependency-faults.md)
for observed results and exact environment.
