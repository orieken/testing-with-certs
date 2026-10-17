# Kerberos wrong-service ticket rejection — 2026-10-16

Subsequent [completion 36](36-native-expanded-authentication.md) records the expanded 70-case native pass, including the recipient guard, wrong-service ticket case, and exact-count gates. The local evidence and limitations below remain historical.

The expanded Kerberos matrix passed 10/10 cases in real Chrome and Edge on a fresh local Apple Silicon lab with Linux amd64 browser emulation. Each browser passed valid, missing, expired, wrong-service, and disabled-user cases. This is new local evidence; native CI for the added wrong-service case remains pending. The original eight native cases retain their evidence in completion 31.

## What the negative case proves

The KDC provisions `HTTP/wrong.magic.test@MAGIC.TEST` with an independent service key. Ticket setup acquires a legitimate ticket for that principal, verifies it against the corresponding keytab inside the KDC container, and exports it into a service-only credential cache. Setup verifies that the cache contains neither a TGT nor a ticket for `HTTP/auth.magic.test@MAGIC.TEST`; cached-only lookup cannot satisfy the real endpoint. The wrong-service keytab stays in the KDC's private keytab volume.

A small Python standard-library helper calls the installed MIT GSSAPI library to produce an actual SPNEGO initiation token targeted at the wrong service using only that cache. Playwright submits the token in the Negotiate header to the real lesson realm. The test tracks that specific overridden request and requires its HTTP 400 rejection, no authorization code, no lesson identity, and no password fallback. It does not treat the mere absence of a suitable browser ticket as server rejection. The valid-ticket control still checks the intended user, issuer/client/audience, business-API denials, and logout.

Initial test development expected a repeat 401 challenge. Sanitized status-only debugging showed the presented wrong-service token instead produces a tracked HTTP 400 error. The final test accepts that explicit rejection. Temporary debug instrumentation was removed before the passing matrix and its private temporary volume was deleted.

## Reproducible scope and environment

Project: `magic-shop-auth-kerberos-20261016`.

Package access was intermittent: fresh runner builds could not obtain browser repository metadata reliably, and workspace package fetches retried. Validation used already-built application/browser images with the current fixture provisioning. Current `kerberos.spec.mjs`, `wrong-service-token.py`, and `reporting/auth-lessons.mjs` were mounted read-only at their normal runner paths. This validates the current test behavior with cached runtimes, not a clean runner-image build.

The exact browser versions were Chrome `155.0.8059.39` and Edge `154.0.4258.62`, Playwright `1.61.0`. The cached runner image was `sha256:5a628cd1a73aee67b030f6c66f899aaba7ef72f69cc1de9e784d48be614531f1`. It predates the source lock's Chrome `155.0.8059.84-1` update. Keycloak remains `26.4.0`; the KDC remains MIT Kerberos `1.20.1-2+deb12u5`.

Setup used the base and authentication Compose files, built `realm-bootstrap` and `lesson-kdc`, then started `gateway` and `lesson-provider` with `--no-build --wait`. Realm bootstrap and authentication setup completed. Before each browser, `lesson-kdc` ran `/app/tickets.sh`. Each browser ran `playwright test --config playwright.auth-lessons.config.mjs` with `LAB_AUTH_SUITE=kerberos`, then repeated with `LAB_KERBEROS_DISABLED=1` after the fixture disabled/logged-out the imported user. The fixture re-enabled the user afterward. Fresh browser home/tmp volumes separated the browser selections.

## Reports and cleanup

- [Chrome four-case report](../../artifacts/auth-lessons/magic-shop-auth-kerberos-20261016/chrome-kerberos/index.html)
- [Chrome disabled-user report](../../artifacts/auth-lessons/magic-shop-auth-kerberos-20261016/chrome-kerberos-disabled/index.html)
- [Edge four-case report](../../artifacts/auth-lessons/magic-shop-auth-kerberos-20261016/msedge-kerberos/index.html)
- [Edge disabled-user report](../../artifacts/auth-lessons/magic-shop-auth-kerberos-20261016/msedge-kerberos-disabled/index.html)

JSON and JUnit reports sit beside the HTML files. Independent JSON validation required the exact four main case names and single disabled case for each browser, with all ten statuses passed. Credential scanning passed with 16 entries. The artifact scanner now additionally rejects wrong-service cache filenames and Negotiate credential headers; its credential-rejection test passed. Runner cleanup/source tests also passed.

Fixture finish/verify and Compose teardown removed the disposable stack. Independent label queries verified zero containers, volumes, and networks for the project. Ticket caches, browser profiles, service keytabs, and temporary sanitized diagnostics were removed with their volumes. Raw Negotiate tokens were transported only within the test process/browser request and were not exported to reports.

Native CI and the complete expanded authentication matrix still need repetition. Signed SAML negatives remain separately tracked; this Kerberos run makes no new SAML browser-acceptance claim.
