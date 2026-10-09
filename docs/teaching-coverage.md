# Teaching and security matrix evidence

Status after the Prompt 11 teaching increment on 2026-10-08: the shared Playwright Test/Cucumber customer and admin journeys passed in real Chrome and Edge on Apple Silicon amd64 emulation. The Playwright Test shopkeeper inventory journey also passed in both branded browsers. The browserless contract command passed 17 tests and all 23 required operation/status entries. **Observed** means the named requirement was checked at its designated level; **partial** means at least one required variant remains; **open** means this increment has no passing acceptance result. Historical spike results are identified as such rather than promoted to a full-stack pass.

| ID | Status | Evidence or missing check |
| --- | --- | --- |
| CONTRACT-01 | Observed | `testing/api/contracts/{catalog,customer,insights}.contract.spec.ts`; live 23-operation gate. |
| CONTRACT-02 | Observed | Same three suites; required 400/401/403 scenarios per operation. |
| CONTRACT-03 | Partial | All three deployed authenticated specs match expected bytes; one-byte drift rejection passes. Containerized generation/reproducibility and a conservative base comparator with mutation tests pass locally. Actual comparison against a committed PR base and Linux CI execution remain unverified. |
| CONTRACT-04 | Observed | `infra/check-contract-coverage.mjs` requires every operation and status; 23 passed. |
| CONTRACT-05 | Observed | `testing/api/contracts/validator.spec.ts` rejects malformed fields, types, status, media and date/tuple data. |
| AUTH-01 | Observed | Shared teaching customer login/account/order passed in both runners and browsers. |
| AUTH-02 | Observed | Shared teaching admin login/account/report/map passed in both runners and browsers. |
| AUTH-03 | Observed | Live `testing/api/security/security.spec.ts` rejects shop TLS without a client certificate. |
| AUTH-04 | Observed | Prompt 01 wrong-CA checks passed. In the isolated Prompt 11 project, user-CA-signed expired and future leaves failed OpenSSL validity checks, the live shop TLS gate, and Keycloak returned no authorization code. |
| AUTH-05 | Observed | Live Vue sign-in with disabled and unmapped user certificates was rejected in real Chrome and Edge: no authorization code, password field, signed-in identity or business API request. |
| AUTH-06 | Observed | Prompt 10 isolated renewed leaf completed fresh real-Chrome PKCE login with same identity/role. |
| AUTH-07 | Observed | In a disposable Prompt 11 realm, real Chrome customer login passed before revocation. After CRL publication and explicit HAProxy/Keycloak reload, a fresh shop connection rejected the leaf by 31,418 ms and Keycloak issued no code by 31,860 ms, both within the 60-second target on Apple Silicon emulation. `testing/container/revoked-user-bound.mjs` checks the published CRL, strict server TLS and both fresh boundaries. |
| AUTH-08 | Observed | Shared Playwright/Cucumber examples sign out, revisit, and complete fresh certificate login without password in both browsers. |
| AUTH-09 | Observed | Prompt 10 manual customer-to-admin recreate removed old profile/certificate/policy. |
| AUTH-10 | Observed | Catalog/customer/insights contracts reject user token/certificate mismatch. |
| AUTH-11 | Observed | Prompt 04 saved-cookie mismatch and API token pairing checks. |
| JWT-01 | Observed | In disposable `magic-shop-matrix-jwt01`, Keycloak published an imported temporary RSA key and issued a valid admin PKCE token; Go, Node and Python each returned 200 for it. The separate runner signed expired, not-yet-valid, wrong-issuer, wrong-audience, wrong-algorithm and unknown-key variants with that same key, verified fixture signatures, and sent them through strict user mTLS. All three APIs returned 401 for every variant and for missing bearer, altered signature and Keycloak ID token. The signer existed only in a project-scoped Docker volume and was removed with the realm. |
| JWT-02 | Observed | Go, Node and Python verifier tests reject unknown signed keys and accept a second published test key. In a disposable live realm, all three APIs accepted an admin token signed by the original Keycloak key, then accepted a fresh token after a higher-priority generated RSA key became active. The `kid` changed, both public keys remained in JWKS, and the long-running APIs refreshed their cached keys. |
| JWT-03 | Observed | Prompt 04 disabled account/session; refresh and fresh login denied within short token TTL. |
| ROLE-01 | Observed | Teaching customer direct insights request returns 403; contracts exercise all admin business routes. |
| ROLE-02 | Observed | Both live customer certificates see only their own profile, widget layout, order detail and every bounded order-list page; the other customer's known order returns 404, guessed cross-user profile/layout routes return 404, and admin routes return 403. Response bodies contain no other customer subject. |
| ROLE-03 | Observed | The certificate-backed shopkeeper UI created and archived a synthetic item in real Chrome and Edge; the admin link was absent. Live customer catalog write returned 403. |
| MTLS-01 | Observed | Catalog/customer private routes reject missing cert. Both service routes reject the other caller's leaf/token pairing. In an isolated project, a revoked customer-to-catalog leaf and CA-signed expired/future service leaves failed local certificate verification and fresh catalog TLS despite a valid scoped token. |
| MTLS-02 | Observed | Node-to-Go and Python-to-Node routes reject a valid service token paired with the other service leaf; both routes also reject a correct caller leaf with the other service's signed token. |
| MTLS-03 | Observed | Customer reporting rejects a live wrong-audience token. In a disposable Keycloak realm, both service clients first received correctly scoped tokens and their own certificate/API pairing returned 200. After removing only each required default scope, newly issued, signature-verified tokens retained the correct caller and audience; the same paired catalog and reporting requests returned 403. |
| EDGE-01 | Observed | Live security suite sends forged forwarding/certificate/user headers with a customer cert/token; both admin APIs return 403. |
| EDGE-02 | Observed | Live security suite sees public internal 404 and rejects direct human-cert connections to Node and Go service origins. |
| SHOP-01 | Observed | Teaching live browse, recorded item detail, add two/remove one cart line, server-priced checkout and own account order passed. |
| SHOP-02 | Observed | Customer/catalog contracts reject client totals, invalid quantity/item and duplicate order key. |
| WIDGET-01 | Observed | Teaching widget toggle persists after fresh sign-in and is restored; role denial in contracts. |
| REGION-01 | Observed | Teaching September Waterdeep result/map and contract oracle agree on 570 gp, 3 orders, 2 customers. |
| REGION-02 | Partial | Python/provider seed and date checks exist; empty region and moved-customer boundary matrix remains. |
| MAP-01 | Observed | Real Chrome and Edge admin runs loaded the local Locations map while the browser context was offline: three markers, both checked layers and no external requests. Allowed geolocation panned to the seeded coordinates after connectivity was restored; a fresh denied-permission context showed the fallback message and retained three markers. The regional sales map also made no external requests. |
| FOLLOW-01 | Observed | Recorded UI and insights contracts create/update persistent local follow-up; no outbound messaging. |
| TRUST-01 | Observed | Live security suite rejects wrong hostname and, in a fresh process without the private CA, rejects verified shop TLS. |
| PKG-01 | Observed | `./lab test --runner playwright --suite package`; independent packed consumer imports core, Playwright, Cucumber and manual exports. |
| OPS-01 | Open | Clean volumes and repeat-start exercise belongs to Prompt 12. |
| OPS-02 | Observed | Live security suite verified distinct subjects in two concurrent customer certificate/token contexts. Separate customer Chrome and admin Edge teaching jobs each used two Playwright workers concurrently, passed, and wrote distinct scanned report directories with WebM/JUnit artifacts. |

Run identifiers and exact commands are recorded in [teaching completion 11](completion/11-teaching-suite.md) and [security matrix completion 11](completion/11-security-matrix.md). Native Linux amd64 remains deferred by the user. An observed historical check does not replace a missing live variant in rows marked partial.
