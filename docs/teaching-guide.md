# Teaching guide: certificate-authenticated Magic Shop

This prototype keeps the browser, certificate authority, user certificates, PostgreSQL and Keycloak inside Docker. The host needs Docker Compose and a shell; it does not need Node, Go, Python, OpenSSL, a trusted lab CA or a client certificate. The shop and auth origins exist on the Compose front network as `https://shop.magic.test:8443` and `https://auth.magic.test:9443`. Only the optional protected desktop viewer is forwarded to host loopback. Native Linux amd64 execution is still unverified; the results below are from Apple Silicon running amd64 containers under Docker Desktop emulation.

## Start and choose an identity

From the repository root, run `./lab up`. It builds the pinned images, provisions the CA and separate certificate volumes, initializes four database owners, starts the healthy services and idempotently applies the certificate-only Keycloak realm. Repeating `./lab up` keeps the existing realm, certificates and database data. `./lab status` shows the running and completed jobs. A new learner should use a unique `LAB_PROJECT` value to avoid another learner's volumes, for example `LAB_PROJECT=magic-shop-lesson-1 ./lab up` and the same prefix on subsequent commands.

For a manual customer session, run `./lab manual --user customer-waterdeep --browser chrome`, read the one-session password with `./lab viewer-password`, open the printed `http://127.0.0.1:6080/vnc.html` loopback URL and choose **Sign in with certificate** in the remote browser. Use `LAB_VIEWER_PORT=6081` when 6080 is occupied. To teach an administrator journey, recreate the desktop with `./lab manual --user shop-admin --browser msedge`. That recreates HOME, native certificate store, browser profile and viewer password with one selected identity; `./lab manual stop` discards them. The customer and admin selected-user paths passed automated native-store checks on Apple Silicon; the user later confirmed shop-admin in Edge and customer-waterdeep in Chrome through the current Compose viewer. [Manual browser details](manual-browser.md) distinguish this from the earlier human-verified spike viewer.

The seeded user choices are `customer-waterdeep`, `customer-baldur`, `customer-neverwinter`, `shopkeeper`, `shop-admin` and `disabled-customer`. `unknown-user` is a trusted-certificate negative fixture with no Keycloak mapping. `./lab user inspect customer-waterdeep` reads the mapping; `./lab user provision customer-waterdeep` reapplies the selected seeded user. The prototype has no self-enrollment or arbitrary new-user API. The shop does not offer password login.

## Run the lessons and review evidence

Run `./lab test --runner playwright --suite contracts` first. It opens no browser, sends authenticated requests to all three live providers, validates the canonical OpenAPI response schemas and checks every one of the 23 operations and required statuses. Then run `./lab test --runner playwright --suite security` for TLS, token, ownership and boundary checks. The shared customer/admin examples can be run with either `playwright` or `cucumber` and either `chrome` or `msedge`:

```sh
./lab test --runner playwright --browser chrome --user customer-waterdeep
./lab test --runner cucumber --browser msedge --user shop-admin
```

Use `./lab test --runner playwright --browser chrome --user shopkeeper` for the inventory example. Playwright Test teaching runs save local HTML, JUnit and WebM under `artifacts/teaching/<run-id>/`; Cucumber saves JSON, JUnit and scenario telemetry there. `./lab record chrome customer-waterdeep` is a separate local video-focused UI run. The local reports passed a credential-file/text scan, but browser video and HTML/video bundles are intentionally excluded from CI uploads because they show the login flow. The [test matrix](test-plan.md) and [per-ID evidence](teaching-coverage.md) separate observed checks from partial ones.

## Follow a request across the boundaries

The optional [Go operator](operator-guide.md) shows Compose health, bounded local telemetry and public certificate metadata, starts/stops named services, and launches the same Playwright/Cucumber suites. It is built in a container and runs only as a trusted host tool; the APIs and runners receive no Docker socket.

The remote Chrome or Edge browser sends its selected human certificate to HAProxy's shop listener and uses the same identity at Keycloak's auth listener. Keycloak maps the certificate to an immutable `cert_identity` and issues an Authorization Code + PKCE access token. HAProxy strips caller-supplied identity headers, sets the verified identity from its mTLS connection, and presents its own service certificate to the APIs. Go, Node and Python verify the token signature, exact issuer/audience/lifetime, role and equality with the gateway's verified certificate identity. A TLS failure happens before HTTP; a missing/invalid bearer token yields 401, insufficient role/scope 403, and a hidden owned record 404.

Go owns catalog and inventory, Node owns profiles, orders and widgets, and Python owns regional reporting and local follow-up notes. Node's private quote request presents the `customer-api` certificate with a `customer-catalog` token carrying `catalog.quote`. Python's private feed request presents the `insights-api` certificate with an `insights-reporting` token carrying `reporting.read`. Those two private routes have no public HAProxy route. The [architecture overview](architecture.md) and [workflow diagrams](workflows.md) show the infrastructure/volumes, provisioning, login, service requests, reporting, both runner modes, certificate lifecycle, CI gate and operator control path. The [canonical OpenAPI contracts](../contracts/openapi/README.md) are the interface source of truth.

As an exercise, add a permitted dashboard widget with a customer session, sign out and sign in again, and observe the persisted layout. Add a scenario to `testing/playwright/` or `testing/cucumber/` using the shared Saturday site/page/flow models and the selected identity fixture; do not embed certificate files or tokens in a test. A new seeded user requires a unique immutable `certIdentity` in `seed/identities.json`, a PKI user-volume mapping, Keycloak provisioning and a selected-user runner mapping; this is a source change, not a runtime free-form enrollment command. The September Waterdeep admin report provides a fixed teaching oracle: 570 gp, three completed orders and two customers. Its map uses local GeoJSON without external tiles, and follow-up notes never send outbound messages.

## Renew, revoke, stop and reset

`./lab pki renew customer-waterdeep` rotates the selected certificate key/serial while retaining its immutable identity; recreate a manual browser to import the new bundle. `./lab pki revoke customer-waterdeep` publishes a CRL. Restart the gateway and Keycloak through Compose so both reload it, then use a fresh connection to test rejection. Existing TLS connections and issued access tokens have separate lifetimes; a token can remain valid for at most its 120-second configured lifetime. Use a disposable `LAB_PROJECT` for revocation lessons because the action affects that project's learner session. [Authentication and lifecycle rules](authentication.md) give the full distinction between certificate and account disablement.

`./lab down` stops the selected project without deleting its data. `./lab reset --project magic-shop-lesson-1` removes that named project's containers and volumes, including its CA and database; run it only when that project can be discarded. No routine startup should reset volumes. UBI9 is retained for PKI, Go runtime and Python; the real-browser runner uses pinned amd64 Bookworm because verified UBI9 repositories lacked the required desktop packages. PostgreSQL uses its maintained pinned image. See [compatibility and exact versions](compatibility.md) and [dependency strategy](dependency-strategy.md).

## Troubleshoot by layer

| Layer | Check | Likely boundary |
| --- | --- | --- |
| DNS/origin | Use the exact `shop.magic.test:8443` and `auth.magic.test:9443` origins inside the runner; check `./lab status`. | A container name, `localhost` or wrong port changes issuer/SAN validation. |
| TLS/trust | Run `./lab pki verify` and `./lab db verify`; use a fresh connection after CRL reload. | Wrong CA, hostname, expired/revoked leaf or missing certificate fails before HTTP. Never bypass TLS verification. |
| Certificate selection | Recreate manual mode with the intended `--user` and `--browser`; check the selected identity message. | Chrome and Edge have separate native stores/policies; old profiles must not carry the other user. |
| Keycloak mapping | Run `./lab user inspect USER`; compare the certificate's immutable mapping to the enabled seed account. | Unknown or disabled users receive no authorization code; no password fallback exists. |
| Token | Check that a fresh PKCE access token has the API audience, issuer and current lifetime. | Missing/altered/expired/wrong-audience tokens return 401 even with a valid certificate. |
| Role/ownership | Compare customer, shopkeeper and shop-admin examples and the per-ID matrix. | Valid identity with insufficient role/scope returns 403; another customer's owned record is hidden as 404. |
| Application | Run contracts before UI tests, then inspect the named local JUnit/HTML report. | A healthy transport alone does not prove business response or OpenAPI conformance. |

The local [`saturday-keycloak` package](../packages/saturday-keycloak/) remains private to this repository. Future upstream work could generalize the identity resolver, exact-origin browser policy and isolated issuer adapter after independent API and credential-boundary review; no package has been published or copied into Saturday.
