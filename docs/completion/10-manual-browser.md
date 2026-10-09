# 10 — Selected-user manual browser mode

Observed 2026-10-08 UTC on macOS arm64 with Docker Desktop running pinned linux/amd64 Bookworm runner containers under emulation. Chrome 154.0.8037.97, Edge 154.0.4258.62, Node 24.10.0 and Playwright 1.61.0 were the installed versions. Native Linux amd64 remains deferred at the user's request.

## Changes

- `./lab manual --user SEED_USER --browser chrome|msedge` now starts the selected non-root desktop and prints its local viewer URL and password retrieval/stop instructions. Positional arguments still work. `./lab manual stop` removes the container and ephemeral HOME/profile without resetting PKI volumes.
- The manual session generates its VNC password inside the container. The old interactive `x11vnc -storepasswd` prompt failed without a TTY; its explicit noninteractive form now lets Compose health reach healthy. The credential is not printed by startup; `./lab viewer-password` retrieves it deliberately.
- Native import checks that all four bundle files exist and the leaf certificate subject matches the requested seed identity before importing PKCS#12. This prevents a Compose environment override from silently mounting one user's certificate while labeling the session as another.
- The [operator guide](../manual-browser.md), [authentication notes](../authentication.md), [architecture](../architecture.md) and [workflows](../workflows.md) describe the current commands, ports, identity boundary, shutdown and lifecycle behavior.

## Exact commands and observed results

All builds, native imports, certificate operations and browser tests ran in containers. The host shell invoked Docker/Compose wrappers only; the read-only keychain query below checked that no lab certificate had been installed. The main lab viewer used port 6081 because another local viewer used the default 6080.

```sh
LAB_VIEWER_PORT=6081 ./lab manual --user customer-waterdeep --browser chrome
docker compose -f infra/compose.yaml --profile manual exec -T runner-manual sh -c 'id; google-chrome --version; microsoft-edge --version; certutil -L -d sql:$HOME/.local/share/pki/nssdb; cat /etc/opt/chrome/policies/managed/magic-shop.json'
LAB_USER=customer-waterdeep LAB_BROWSER=chrome docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_UI_FLOW=1 runner-test sh /work/testing/container/native-login.sh
LAB_VIEWER_PORT=6081 ./lab manual --user shop-admin --browser msedge
LAB_USER=shop-admin LAB_BROWSER=msedge docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_UI_FLOW=1 runner-test sh /work/testing/container/native-login.sh
LAB_USER=customer-waterdeep LAB_BROWSER=msedge docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_USER=shop-admin runner-test sh /work/testing/container/native-login.sh
docker run --rm --user 1000:1000 -e LAB_USER=customer-waterdeep -e LAB_BROWSER=chrome --tmpfs /identity --entrypoint node magic-shop-runner:03 /work/testing/container/native-identity.mjs
security find-certificate -a -c 'Magic Shop' -Z "$HOME/Library/Keychains/login.keychain-db" /Library/Keychains/System.keychain
```

Chrome/customer and Edge/admin manual containers both became healthy, launched the correct branded browser at `https://shop.magic.test:8443`, and used UID 1000. Each mounted only its selected identity and public trust read-only. Their NSS databases contained the public server CA and exactly the selected user leaf; the other brand's managed policy was absent. Policies listed only `shop.magic.test:8443` and `auth.magic.test:9443`, with the selected subject and user CA issuer. Docker published only `127.0.0.1:6081->6080`; a container-local VNC probe saw password authentication as the sole offered security type. The viewer password file remained in the container with restrictive permissions. No raw VNC/debug port or Docker socket was mounted.

Both headed native-store Vue sign-in/sign-out checks passed without Playwright certificate options or auth-state injection. A deliberate mismatch between `LAB_USER=shop-admin` and the mounted customer volume failed before browser launch with `Selected certificate identity does not match shop-admin`. An empty identity mount failed with `Selected certificate bundle is incomplete: /identity/cert.pem`. A marker placed in the customer browser profile disappeared after the Edge/admin recreate; the new NSS store had only the admin leaf and its policy. The host login and system keychain query returned no `Magic Shop` certificate.

The isolated `magic-shop-auth-check` project supplied the destructive lifecycle exercise:

```sh
LAB_PROJECT=magic-shop-auth-check ./lab pki revoke customer-waterdeep previous
LAB_PROJECT=magic-shop-auth-check ./lab pki retire customer-waterdeep
LAB_PROJECT=magic-shop-auth-check ./lab pki renew customer-waterdeep
LAB_PROJECT=magic-shop-auth-check LAB_USER=customer-waterdeep LAB_BROWSER=chrome docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-test node /work/testing/container/login.mjs
LAB_PROJECT=magic-shop-auth-check ./lab pki revoke customer-waterdeep
LAB_PROJECT=magic-shop-auth-check docker compose -f infra/compose.yaml restart gateway keycloak
LAB_PROJECT=magic-shop-auth-check docker compose -f infra/compose.yaml up -d --no-deps --wait --wait-timeout 120 gateway keycloak
LAB_PROJECT=magic-shop-auth-check LAB_USER=customer-waterdeep LAB_BROWSER=chrome docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-test node /work/testing/container/revoked-shop.mjs
LAB_PROJECT=magic-shop-auth-check LAB_USER=customer-waterdeep LAB_BROWSER=chrome docker compose -f infra/compose.yaml --profile test run --rm --no-deps -e LAB_EXPECT_REVOKED=1 runner-test node /work/testing/container/login.mjs
LAB_PROJECT=magic-shop-auth-check ./lab manual stop
```

The renewed leaf completed a fresh Chrome certificate-only PKCE login with the signed selected identity, audience and role. After CRL publication and healthy reloads, a new verified shop TLS connection failed with `ERR_SSL_SSL/TLS_ALERT_CERTIFICATE_REVOKED`; a fresh Keycloak authorization obtained no code or password fallback. `manual stop` removed the isolated manual container, while its issued certificate volume remained. The main lab's Edge/admin viewer remains running for operator inspection; the isolated project's customer leaf is deliberately revoked.

## Decisions, limitations and next dependency

Compose's selected-user volume name is resolved from the **host** `LAB_USER`; passing only `-e LAB_USER=...` to `docker compose run` changes the container label but not the mount. The new subject guard makes this fail closed. The manual wrapper exports both values together. The VNC protocol uses only the first eight password characters, so the per-session random credential is eight base64url characters. It protects a loopback-only local teaching viewer, not a publicly exposed desktop.

A human previously completed customer certificate login in the Prompt 01 spike viewer. At this earlier Prompt 10 checkpoint, the current Compose viewer's healthy desktop, auth requirement and native browser were verified alongside headed native-store UI login for both roles; human click-through was still pending then and was later confirmed in the continuation below. Native Linux amd64 and a remote Docker-context SSH viewer tunnel remain unverified. No TLS verification bypass, host certificate installation, commit, deployment or package publication occurred.

At that checkpoint, the next dependency was Prompt 11 shared Saturday examples and the failure matrix. The later continuation below closes the Compose viewer human evidence; native Linux remains open.

## Current Compose viewer human continuation, 2026-10-09

After the non-Linux build and host-trust audit were complete, the retained `magic-shop-lab` manual viewer was inspected at `127.0.0.1:6081`; it was healthy with `LAB_BROWSER=msedge` and `LAB_USER=shop-admin`. The user replied “looks good” to the specific request to verify the signed-in shop-admin identity in that viewer. This records the admin Edge human click result. No password or certificate bundle was copied into this note.

The operator then ran `LAB_VIEWER_PORT=6081 ./lab manual --user customer-waterdeep --browser chrome`. Compose rebuilt/recreated only `runner-manual`; it became healthy with `LAB_BROWSER=chrome`, `LAB_USER=customer-waterdeep`, and the same loopback-only `127.0.0.1:6081->6080` viewer mapping. The new viewer was opened in the app. The user clicked through and confirmed that it showed `customer-waterdeep`. Both current Compose viewer human selections are now observed on Apple Silicon emulation; the combined TODO box is complete. No database or certificate volume was reset.
