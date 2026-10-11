# TEST-08: real checkout races and a lost response

From the repository root:

```sh
./testing/faults/idempotency/run.sh
./testing/faults/idempotency/record.sh
# Deliberate failure after provisioning; expected exit 1 and verified cleanup:
IDEMPOTENCY_FORCE_FAILURE=1 ./testing/faults/idempotency/run.sh
```

Every command creates a fresh `magic-shop-checkout-idempotency-*` project. It
refuses existing containers/volumes, builds with pinned container dependencies,
provisions ephemeral certificates and a real Keycloak/PostgreSQL/API stack,
checks contracts with strict Ajv, and removes project containers, networks and
volumes on success or failure. The front, backend, authentication and database
networks are private. There are no published ports. Browser profiles, temporary
files, receipt state, private keys and secrets stay in volumes; tokens stay in
container memory. Safe reports land under `artifacts/checkout-idempotency/`.

The original 17 live/schema cases run first. Four separate TEST-08 cases follow;
a dedicated evidence gate rejects missing/failed cases, wrong provenance,
missing observed database waiters and persistence/replay violations. This suite
adds no mock results to the existing live contract coverage report.

| Case | What is replaced or controlled | What the test proves |
| --- | --- | --- |
| Four identical requests, one key | A test connection holds an `orders` SHARE lock until four actual inserts wait | All four receive the same canonical 201/order/Location; one row and one revision increment; request hash and stable replay match |
| Two different bodies, one key | The same lock holds two actual inserts | Either body may win; exactly one 201 and one canonical 409; winning body/hash/price match storage; winner replay stable, losing replay remains 409 |
| Response lost after commit | A test-only TLS intermediary consumes the real API's full 201 and closes the client socket before headers | Client observes ECONNRESET; a private receipt and real database prove commit; direct HAProxy retry returns the same order, with no extra row/revision; changed body still gets 409 |
| Trust/identity controls | Negative inputs to that intermediary | Wrong server CA/hostname, absent/wrong-CA client certificates, wrong selected customer and missing/invalid real API tokens remain rejected with no persistence |

The race barrier reads `pg_locks` joined to `pg_stat_activity`, selecting real
`customer-api` INSERT waiters in this isolated database. It uses a bounded
Playwright poll, not a sleep-based guess. SHARE permits the preceding SELECTs
but blocks RowExclusive insert locks. Four requests match the provider's existing
pool size. The test releases the lock in `finally`, settles pending requests and
closes pools; whole-project removal supplies deterministic fixture cleanup.
The 2.5-second barrier is shorter than the unchanged 5-second database statement
timeout. Failures are defects/evidence failures, not reasons to loosen limits.

The loss intermediary is selected only by the test client's DNS lookup; the URL,
SNI and hostname remain `shop.magic.test`. Ordinary races/retries go directly to
HAProxy. The intermediary verifies user CA/CRL and the selected certificate CN,
then presents that same disposable customer's certificate and forwards the
unchanged real user token to the real gateway, verifying server CA/hostname.
It reuses only this disposable project's shop leaf and customer leaf; this is
**two verified TLS connections**, not certificate passthrough. It cannot mint
tokens, change realm clients/flows or bypass provider authorization. Only a
canonical successful response is held as a receipt in the private state volume;
request headers, tokens and keys are never recorded there or exported.

These browserless tests prove this implementation's bounded races and one
controlled committed-response loss. They do not prove browser UI behavior,
password login, real network outages, general load capacity or native Linux.
The optional video is a **new run's live output viewer**, not a browser checkout
journey. A no-network Chrome container has only the safe output directory;
recording profiles and temporary files are disposable volumes.

The application, API contracts, authentication flows, certificate identity
pairing, PKCE and authorization remain unchanged. See the exact observed commands,
versions, results and limitations in [completion 20](../../../docs/completion/20-checkout-idempotency.md).

Design references: [PostgreSQL 16 locking](https://www.postgresql.org/docs/16/explicit-locking.html),
[`pg_locks`](https://www.postgresql.org/docs/16/view-pg-locks.html),
[`pg_stat_activity`](https://www.postgresql.org/docs/16/monitoring-stats.html),
[Playwright bounded polling](https://playwright.dev/docs/test-assertions#expectpoll).
