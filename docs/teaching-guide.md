# Teaching guide: certificate-authenticated Magic Shop

This is a local teaching lab. The host needs Docker Compose and a shell.
Builds, tests, database setup, and certificate operations run in containers.
The host needs no Node, Go, Python, OpenSSL, or installed lab certificate.
Private keys, secrets, and browser profiles stay in Docker volumes.

Read the [plain-language introduction](plain-language/README.md) for a system overview.
This guide follows the [writing guide](writing-guide.md) and [project terminology dictionary](project-terminology.md).
The approximate ASD-STE100 target is a writing preference, not a formal compliance score.

## Choose a project and start the lab

Run commands from the repository root. Use a unique project name to separate your resources from another learner's resources.
Keep the same project name for all commands in your session.

1. Select the project:

   ```sh
   export LAB_PROJECT=magic-shop-lesson-1
   ```

2. Start the lab:

   ```sh
   ./lab up
   ```

3. Check its state:

   ```sh
   ./lab status
   ```

Startup builds pinned images and provisions separate certificate volumes.
It initializes four database owners and applies the certificate-only Keycloak realm.
Repeating startup retains the existing realm, certificates, and database records.
Normal startup does not reset volumes.

The shop origin is `https://shop.magic.test:8443`.
The authentication origin is `https://auth.magic.test:9443`.
These origins are available inside the Compose network.
Only the optional protected desktop viewer is forwarded to host loopback.

## Open a selected-user browser

1. Start a customer session:

   ```sh
   ./lab manual --user customer-waterdeep --browser chrome
   ```

2. Read the one-session viewer password:

   ```sh
   ./lab viewer-password
   ```

3. Open the printed `http://127.0.0.1:6080/vnc.html` URL.
4. Enter the viewer password.
5. Select **Sign in with certificate** in the remote browser.

If port 6080 is occupied, start the viewer on another loopback port:

```sh
LAB_VIEWER_PORT=6081 ./lab manual --user customer-waterdeep --browser chrome
```

For an administrator session, recreate the desktop:

```sh
./lab manual --user shop-admin --browser msedge
```

This action creates a fresh HOME, certificate store, browser profile, and viewer password.
Only the selected user identity is installed.
Read the new viewer password before connecting again.
To discard the manual session, use:

```sh
./lab manual stop
```

The seeded users are `customer-waterdeep`, `customer-baldur`, `customer-neverwinter`,
`shopkeeper`, `shop-admin`, and `disabled-customer`.
The `unknown-user` fixture has a trusted certificate but no Keycloak mapping.
It is a negative fixture, not a usable login account.

Inspect or reapply a selected seeded user with:

```sh
./lab user inspect customer-waterdeep
./lab user provision customer-waterdeep
```

The prototype has no self-enrollment or arbitrary new-user API.
The shop does not offer password login.
See [manual browser details](manual-browser.md) for certificate selection and session boundaries.

## Run real-system tests

Run live contract checks before security and browser checks.
The contract suite opens no browser. It checks all three providers against the canonical OpenAPI contracts.
Its coverage gate requires all 23 business operations and the required statuses.

```sh
./lab test --runner playwright --suite contracts
./lab test --runner playwright --suite security
```

The security suite checks TLS, access tokens, record ownership, and access boundaries.
For a customer or administrator browser journey, use:

```sh
./lab test --runner playwright --browser chrome --user customer-waterdeep
./lab test --runner cucumber --browser msedge --user shop-admin
```

Select `playwright` or `cucumber` as the runner.
Select `chrome` or `msedge` as the browser.
Repeat both identities with both runners and browsers for the eight core selections.
For the shopkeeper inventory example, use:

```sh
./lab test --runner playwright --browser chrome --user shopkeeper
```

Playwright Test saves local HTML, JUnit, and WebM files under `artifacts/teaching/<run-id>/`.
Cucumber saves JSON, JUnit, and scenario telemetry there.
For a separate video-focused customer run, use:

```sh
./lab record chrome customer-waterdeep
```

Review assertions together with recordings. A video alone does not prove hidden API checks.
CI uploads allowlisted text reports. Videos and HTML/video bundles remain local.
Profiles, private keys, secrets, and network captures are not exported.
See the [test matrix](test-plan.md) and [per-ID evidence](teaching-coverage.md) for coverage details.

## Run dependency-replacement examples

The standalone examples use dedicated consumers. They do not reconfigure the shop's Keycloak or real APIs.

```sh
./spikes/mock-auth/run.sh jwt
./spikes/mock-auth/run.sh oidc
./spikes/mock-auth/run.sh api
```

The examples replace signing-key input, an OIDC dependency, or a catalog dependency.
Mock results do not prove real login, certificate pairing, or live-provider authorization.
See the [mock example guide](../spikes/mock-auth/README.md) for checks, limits, and cleanup.
See the [plain-language test guide](plain-language/testing.md) for the independent CI and fault selections.

## Teach certificate and password authentication

The separate lesson is at `/teaching/certificate-password` on the shop origin.
Keycloak checks the certificate-selected account and then requires its password.
Both checks are required. There is no password-only alternative.
A separate client and callback keep the lesson flow separate from the shop flow.
Lesson tokens do not grant business API access. The shop remains certificate-only.

For manual use:

1. Open an interactive terminal.
2. Set the selected account's password:

   ```sh
   ./lab user set-password customer-waterdeep
   ```

3. Enter and confirm the password in the hidden container prompt.
4. Open the lesson in that user's remote Chrome or Edge browser.
5. Supply the account password only on Keycloak's page.

Setting the password ends that account's existing Keycloak sessions.
The account password differs from the desktop viewer password.

For automated verification, use a separate disposable project:

```sh
LAB_PROJECT=magic-shop-password-check ./lab up
LAB_PROJECT=magic-shop-password-check sh testing/run-certificate-password.sh
LAB_PROJECT=magic-shop-password-check sh testing/cleanup-certificate-password.sh
```

The wrapper runs nine checks under both runners and both browsers: 36 checks in total.
Temporary random passwords stay in Docker volumes.
The exit procedure removes the temporary passwords and fixture sessions.
The matrix records no video.
See [testing instructions](../testing/README.md#certificate--password-lesson) for interrupted-fixture recovery.

For a new passing-login recording, use another disposable project:

```sh
LAB_PROJECT=magic-shop-password-video ./lab up
LAB_PROJECT=magic-shop-password-video sh testing/record-certificate-password.sh chrome
LAB_PROJECT=magic-shop-password-video sh testing/cleanup-certificate-password.sh
```

Use `msedge` for Edge. The local WebM shows the page viewport with masked password input.
It does not add recordings to an earlier unrecorded matrix.
[Completion 18](completion/18-native-certificate-password-ci.md) records the native lesson results and cleanup checks.

## Follow a request through the system

The browser sends its user certificate to the shop listener.
The authentication listener passes browser TLS directly to Keycloak.
Keycloak maps the certificate to the protected `cert_identity` attribute.
Vue uses Authorization Code with PKCE to obtain tokens.

HAProxy removes caller-supplied identity headers and sets the verified certificate identity.
It presents its own service certificate to the business APIs.
Each API checks the access token's signature, issuer, audience, lifetime, and role.
It also checks that token identity matches the gateway's verified user certificate identity.

A TLS rejection occurs before HTTP.
A missing or invalid access token returns 401.
Insufficient role or scope returns 403.
Another customer's owned record is hidden with 404.

The catalog API owns items and inventory.
The customer API owns profiles, orders, and widgets.
The insights API owns regional reporting and local follow-up notes.

The customer API uses its `customer-api` certificate and a `customer-catalog` service access token for private quotes.
That request requires `catalog.quote`.
The insights API uses its `insights-api` certificate and an `insights-reporting` service access token for private reporting pages.
That request requires `reporting.read`.
Neither private operation has a public HAProxy route.

See the [architecture](architecture.md), [workflow diagrams](workflows.md), and
[canonical OpenAPI contracts](../contracts/openapi/README.md) for exact interfaces and boundaries.

The optional [Go operator](operator-guide.md) shows health, bounded telemetry, and public certificate metadata.
It starts named services and launches the existing suites.
The operator is built in a container and runs as a trusted host tool.
The APIs and test runners receive no Docker socket.

## Try a teaching exercise

Use a customer session to add a permitted dashboard widget.
Sign out, sign in again, and check the saved layout.

Add scenarios in `testing/playwright/` or `testing/cucumber/` with the shared Saturday page and flow models.
Use the selected identity fixture. Do not embed certificates or access tokens in tests.

A new seeded user needs a unique `certIdentity` in `seed/identities.json`.
It also needs a PKI volume mapping, Keycloak provisioning, and a selected-user runner mapping.
This is a source change. It is not a runtime self-enrollment command.

The September Waterdeep report has an independent expected result:
570 gp, three completed orders, and two customers.
Its map uses local GeoJSON without external tiles.
Follow-up notes do not send external messages.

## Renew and revoke certificates

Use a disposable project for certificate lifecycle exercises.
Renewal changes the certificate key and serial while retaining the stable identity:

```sh
./lab pki renew customer-waterdeep
```

Recreate the manual browser to import the new certificate bundle.
To revoke the selected certificate, use:

```sh
./lab pki revoke customer-waterdeep
```

Restart the gateway and Keycloak so both reload the certificate revocation list:

```sh
docker compose -f infra/compose.yaml restart gateway keycloak
```

Use a fresh connection to check rejection.
Existing TLS connections and issued access tokens have separate lifetimes.
An access token can remain valid for at most its configured 120-second lifetime.
See [authentication and lifecycle rules](authentication.md) for certificate revocation and account disablement.

## Stop or discard the project

To stop the selected project and retain its data, use:

```sh
./lab down
```

To discard the example project's containers and volumes, use:

```sh
./lab reset --project magic-shop-lesson-1
```

Reset removes that project's certificate authority and database records.
Run reset only when that named project can be discarded.
Do not use reset during routine startup.

The PKI job, Go runtime, and Python use UBI9.
The branded-browser runner uses pinned amd64 Bookworm because verified UBI9 repositories lacked required desktop packages.
PostgreSQL uses its pinned image.
See [compatibility](compatibility.md) and [dependency strategy](dependency-strategy.md) for exact versions and decisions.

## Troubleshoot by layer

| Layer | Check | Interpretation |
| --- | --- | --- |
| Origin | Use the exact shop and authentication origins inside the runner. Check `./lab status`. | A wrong hostname or port can invalidate server identity or issuer checks. |
| TLS | Run `./lab pki verify` and `./lab db verify`. Use a fresh connection after revocation-list reload. | Wrong trust, hostname, validity, or certificate can fail before HTTP. Keep TLS verification active. |
| Certificate selection | Recreate manual mode with the intended user and browser. | A previous user's certificate or profile must not remain. |
| User mapping | Run `./lab user inspect USER`. Check the protected mapping and enabled account. | Unknown or disabled users cannot log in. The shop has no password fallback. |
| Access token | Run the security suite and inspect sanitized results. | Missing, altered, expired, or wrong-audience tokens return 401. Do not export tokens for diagnosis. |
| Permission | Compare customer, shopkeeper, and shop-admin checks. | Insufficient permissions return 403. Another customer's owned record returns 404. |
| Application | Run contracts before browser tests. Review the named local report. | A healthy connection does not prove correct business results. |

## Read the evidence and remaining limits

Native push run `38115515064` and PR run `38115518115` passed all 13 expanded CI jobs.
The results include the live matrix, lesson, and separate consumer, fault, and regional jobs.
[Completion 26](completion/26-independent-ci-evidence.md) records their exact commands, environments, and cleanup results.
These are prior observed runs. This documentation revision does not claim a new run.

A human confirmed customer Chrome and administrator Edge in the Apple Silicon manual viewer.
Native Linux manual viewer and operator checks remain unverified.
The regional timestamp precision issue and affected 25-row UI limit remain recorded limitations.
Standalone JWT and OIDC examples retain their recorded local evidence.

The local [Saturday Keycloak package](../packages/saturday-keycloak/) remains private to this repository.
No package has been published or copied into the Saturday checkout.
The [backlog](TODO.md) distinguishes completed checks, remaining evidence, and separate product expansion ideas.
