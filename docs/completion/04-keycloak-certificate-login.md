# Prompt 04 — Keycloak certificate-only realm (Apple Silicon emulation)

## Changes and decisions

`./lab up` now starts the healthy Prompt 03 stack, runs a no-network secret job, and applies an idempotent Keycloak realm bootstrap through the verified `auth.magic.test:9443` route. The realm has an X.509-only browser flow, public `shop-spa` Authorization Code + S256 PKCE client with exact callback/origin, six fixed users, customer/shopkeeper/shop-admin roles, a protected unique `cert_identity` attribute and token claim, three SPA API audiences, and two confidential service clients with distinct generated secrets, audiences and narrow `catalog.quote` or `reporting.read` scopes. Password login and direct grant are not configured for the shop client. The bootstrap admin is a service account in the master realm, separate from the shop-admin user; the operator and bootstrap jobs mount its secret, while each business service mounts only its own future service-client secret. All generated secrets stay in scoped Docker volumes, not source or images.

The trusted operator command `./lab user provision|inspect|disable|enable SEED_USER` verifies the selected certificate CN and Keycloak identity, or changes enabled state. Disable also logs out the user's sessions. The seed manifest remains the source of fixed identities; repeat bootstrap validates them without resetting users or re-enabling a disabled user. The unknown-user certificate is a trusted-CA negative fixture and has no Keycloak record. Provisioning arbitrary new users remains a later operator feature.

Real Chrome and Edge used Playwright context certificates for **both exact origins**, strict server TLS, and direct Authorization Code + PKCE. The tests exchanged the code, verified the access-token RSA signature against realm JWKS, and checked issuer, subject, username, `cert_identity`, role, all three user API audiences and at most 120 seconds of token lifetime. These are direct runner login tests against the live realm; the copied Vue UI still does not start OIDC or call implemented business APIs. Service token probes verified signed JWT audience, scope, authorized party and lack of peer capability. The service token endpoint currently uses a generated confidential-client secret over verified TLS; it does not require a service certificate. Later private API calls must pair those tokens with service mTLS certificates, as the architecture requires. This narrower observed boundary is recorded in `docs/authentication.md` and `docs/workflows.md` rather than claiming certificate-bound OAuth tokens.

The retained `magic-shop-lab` Keycloak database predated the new bootstrap-admin service account. With Keycloak stopped, the pinned Keycloak container ran its official offline `bootstrap-admin service --optimized` command using the already generated admin secret and existing database password. `./lab up` then created the realm without resetting PostgreSQL or CA volumes; `./lab user provision shop-admin` verified its selected certificate. The first offline attempt omitted `--optimized`, failed during re-augmentation before changing the database, and was corrected. Compose `up --wait` treated an already completed one-shot realm job as a repeat-start failure despite exit 0, so the wrapper now runs health-gated infrastructure startup followed by `docker compose run --rm --no-deps realm-bootstrap`. Repeat startup passed and preserved a disabled user.

No Saturday checkout was modified and no package was published. No host certificate, Node, Go, Python or OpenSSL installation was used for the work. The host shell only invokes Compose. Existing LICENSE/NOTICE and source provenance remain unchanged.

## Exact significant commands and observed results

Environment: macOS arm64 with Docker Desktop; browser runner explicitly `linux/amd64` under Apple Silicon emulation. Keycloak 26.4.0, Node 24.10.0, Playwright 1.61.0, Chrome 154.0.8037.97 and Edge 154.0.4258.62 are pinned as recorded in `docs/compatibility.md`. Native Linux amd64 is unavailable and unverified. The isolated project was `magic-shop-auth-check`.

```sh
LAB_PROJECT=magic-shop-auth-check ./lab up
LAB_PROJECT=magic-shop-auth-check LAB_USER=customer-waterdeep LAB_BROWSER=chrome docker compose -f infra/compose.yaml --profile test run --rm runner-test node /work/testing/container/login.mjs
LAB_PROJECT=magic-shop-auth-check LAB_USER=shop-admin LAB_BROWSER=msedge docker compose -f infra/compose.yaml --profile test run --rm runner-test node /work/testing/container/login.mjs
LAB_PROJECT=magic-shop-auth-check LAB_USER=disabled-customer LAB_BROWSER=chrome docker compose -f infra/compose.yaml --profile test run --rm runner-test node /work/testing/container/login.mjs
LAB_PROJECT=magic-shop-auth-check ./lab pki init
LAB_PROJECT=magic-shop-auth-check LAB_USER=unknown-user LAB_BROWSER=msedge docker compose -f infra/compose.yaml --profile test run --rm runner-test node /work/testing/container/login.mjs
LAB_PROJECT=magic-shop-auth-check LAB_BROWSER=chrome docker compose -f infra/compose.yaml --profile test run --rm --no-deps -v magic-shop-auth-check_cert-customer-client:/service-identity:ro runner-test node /work/testing/container/service-login-denial.mjs
LAB_PROJECT=magic-shop-auth-check LAB_BROWSER=chrome docker compose -f infra/compose.yaml --profile test run --rm --no-deps -v magic-shop-auth-check_cert-shop-admin:/admin:ro -v magic-shop-auth-check_cert-customer-waterdeep:/customer:ro runner-test node /work/testing/container/cookie-mismatch.mjs
LAB_PROJECT=magic-shop-auth-check LAB_USER=customer-neverwinter LAB_BROWSER=chrome docker compose -f infra/compose.yaml --profile test run --rm --no-deps -v magic-shop-auth-check_auth-secret-admin:/secrets/admin:ro runner-test node /work/testing/container/disable-session.mjs
LAB_PROJECT=magic-shop-auth-check ./lab up
LAB_PROJECT=magic-shop-auth-check ./lab user inspect customer-neverwinter
LAB_PROJECT=magic-shop-auth-check ./lab user provision customer-waterdeep
LAB_PROJECT=magic-shop-auth-check ./lab pki renew customer-waterdeep
LAB_PROJECT=magic-shop-auth-check LAB_USER=customer-waterdeep LAB_BROWSER=chrome docker compose -f infra/compose.yaml --profile test run --rm runner-test node /work/testing/container/login.mjs
LAB_PROJECT=magic-shop-auth-check LAB_USER=customer-baldur LAB_BROWSER=chrome docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-test node /work/testing/container/login.mjs
LAB_PROJECT=magic-shop-auth-check ./lab pki revoke customer-baldur
LAB_PROJECT=magic-shop-auth-check docker compose -f infra/compose.yaml restart gateway keycloak
LAB_PROJECT=magic-shop-auth-check docker compose -f infra/compose.yaml up -d --no-deps --wait --wait-timeout 120 gateway keycloak
LAB_PROJECT=magic-shop-auth-check LAB_USER=customer-baldur LAB_BROWSER=chrome docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_EXPECT_REVOKED=1 runner-test node /work/testing/container/login.mjs
LAB_PROJECT=magic-shop-auth-check LAB_USER=customer-baldur docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-test node /work/testing/container/revoked-shop.mjs
LAB_PROJECT=magic-shop-auth-check ./lab user disable shopkeeper
LAB_PROJECT=magic-shop-auth-check ./lab user enable disabled-customer # expected nonzero: reserved negative fixture
docker compose -f infra/compose.yaml run --rm --no-deps auth-secrets
docker compose -f infra/compose.yaml stop keycloak
docker compose -f infra/compose.yaml run --rm --no-deps --entrypoint /bin/bash keycloak -c 'set -euo pipefail; export KC_DB_PASSWORD="$(cat /secrets/service-password)"; export KC_BOOTSTRAP_ADMIN_CLIENT_SECRET="$(cat /bootstrap-secret/client-secret)"; exec /opt/keycloak/bin/kc.sh bootstrap-admin service --client-id lab-bootstrap --client-secret:env KC_BOOTSTRAP_ADMIN_CLIENT_SECRET --no-prompt --optimized'
./lab up
./lab user provision shop-admin
docker compose -f infra/compose.yaml config --quiet
./lab status
```

Initial isolated bootstrap created the realm and six users. Repeat bootstrap reported “Existing realm retained,” verified the same mappings/roles/clients, and left `customer-neverwinter` disabled. Chrome/customer and Edge/admin received signed tokens for exactly the selected identity; disabled and unknown users got no code or password fallback. A service certificate could not obtain a human authorization code. A saved admin cookie with a customer certificate obtained no code, while a fresh customer login succeeded. Scoped service-client tokens had only their intended audience and scope. The session-disable test rejected the existing refresh token, denied a fresh login, and observed at most 120 seconds left on the already issued access token. Renewal of `customer-waterdeep` produced a new certificate that still logged in as the same user. Before revocation `customer-baldur` logged in; after CRL publication and gateway/Keycloak reload, Chrome got no authorization code and a new shop TLS connection failed with `ERR_SSL_SSL/TLS_ALERT_CERTIFICATE_REVOKED`. The direct operator disable command for `shopkeeper` succeeded. The retained project's `./lab up` and admin certificate check passed after the non-destructive bootstrap-admin upgrade.

The reserved `disabled-customer` fixture also rejected an operator enable attempt. The retained project's `./lab status` showed seven long-running services healthy and the bootstrap job exited 0; the preexisting manual viewer remained running on loopback port 6081.

## Limits and next dependency

The full Vue UI login, protected API data, business-service mTLS/token pairing and both Saturday runner integrations remain for Prompts 05–11. Prompt 01 previously observed a human native-certificate login in its viewer. This increment now verifies native-store login against the Compose realm in both Chrome and Edge, and confirms the Compose noVNC desktop displays the selected Chrome shop session, but the static Vue preview has no sign-in control for a human to click. CRL rejection requires explicit reload; a second timed isolated run measured shop rejection 45 seconds after publication completed, including reload and health checks. Keycloak rejection was confirmed later and was not separately timed against the 60-second target. Issued access tokens remain valid until expiry unless a future API adds an online revocation check. Native Linux amd64 and CI remain unverified. Prompt 05 can now implement the portable local Saturday identity/auth adapters against this proven realm without modifying or publishing the Saturday checkout.

## Final native-store and CRL timing check

`testing/container/native-login.sh` uses the same native PKCS#12 import and brand-specific managed policy as the manual profile, starts a headed persistent Chrome or Edge profile, and performs PKCE without passing Playwright `clientCertificates`. It verifies the shop's TLS connection, Keycloak callback, signed access token and selected identity. The manual runner now passes `LAB_USER` explicitly to this check. The isolated noVNC viewer at loopback `127.0.0.1:6082` connected and displayed the selected customer's Chrome shop page; it was stopped after inspection. No browser debugging port or certificate was exposed on the host.

```sh
LAB_PROJECT=magic-shop-auth-check docker compose -f infra/compose.yaml --profile manual build runner-manual
LAB_PROJECT=magic-shop-auth-check LAB_BROWSER=chrome LAB_USER=customer-waterdeep docker compose -f infra/compose.yaml --profile manual run --rm --no-deps runner-manual sh /work/testing/container/native-login.sh
LAB_PROJECT=magic-shop-auth-check LAB_BROWSER=msedge LAB_USER=shop-admin docker compose -f infra/compose.yaml --profile manual run --rm --no-deps runner-manual sh /work/testing/container/native-login.sh
LAB_PROJECT=magic-shop-auth-check LAB_VIEWER_PORT=6082 ./lab manual chrome customer-waterdeep
LAB_PROJECT=magic-shop-auth-check ./lab viewer-password
LAB_PROJECT=magic-shop-auth-check ./lab pki revoke shop-admin
LAB_PROJECT=magic-shop-auth-check docker compose -f infra/compose.yaml restart gateway keycloak
LAB_PROJECT=magic-shop-auth-check docker compose -f infra/compose.yaml up -d --no-deps --wait --wait-timeout 120 gateway keycloak
LAB_PROJECT=magic-shop-auth-check LAB_USER=shop-admin docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-test node /work/testing/container/revoked-shop.mjs
LAB_PROJECT=magic-shop-auth-check LAB_USER=shop-admin LAB_BROWSER=msedge docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_EXPECT_REVOKED=1 runner-test node /work/testing/container/login.mjs
LAB_PROJECT=magic-shop-auth-check docker compose -f infra/compose.yaml --profile manual stop runner-manual
```

Both native-store jobs passed with the intended identity. The second isolated CRL run recorded publication completion at 17:00:02 UTC and a passing fresh shop TLS rejection at 17:00:47 UTC, a 45-second observed upper bound including the explicit reload and Compose health wait. Edge later obtained no Keycloak authorization code with that revoked admin certificate. These measurements are from the macOS arm64 Docker Desktop emulation environment only.
