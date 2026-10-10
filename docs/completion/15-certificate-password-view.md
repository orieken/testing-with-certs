# 15 — Separate certificate + password teaching view

Date: 2026-10-09, America/Chicago. Local environment: macOS arm64 with Docker
Desktop (`docker info` reported `aarch64`); browser runners explicitly
`linux/amd64` under emulation. Keycloak is the digest-pinned 26.4.0 image.
Observed runner versions: Chrome 155.0.8059.39, Edge 154.0.4258.62, Node 24.19.0,
Playwright Test 1.61.0 and Cucumber 12.9.0. Bootstrap/UI builders retain pinned
Node 24.10.0. These feature results are local emulation evidence, not native Linux.

## Decisions and implementation

The user confirmed that both factors are required, the existing shop stays
certificate-only, and password provisioning should be interactive inside a
container. That choice was obtained before implementing password provisioning.
No documented fixture password or password-only fallback was added.

The lesson is at `https://shop.magic.test:8443/teaching/certificate-password`.
Its separate public client, `certificate-password-spa`, binds to
`certificate-password-browser`: REQUIRED X.509 first, REQUIRED
`auth-password-form` second. There are no cookie, username/password alternative,
or conditional executions. The certificate selects the protected, enabled
Keycloak account; the password form validates that account's password. Keycloak
collects the password on the auth origin; Vue has no password input or password
submission endpoint. Seed users still have no password unless an operator
explicitly sets one. Normal bootstrap preserves credentials.

The existing realm default and `shop-spa` remain bound to the one-execution
certificate-only flow. Bootstrap now checks that boundary as well as the new
flow's ordering, requirements, X.509 configuration and separate client binding.
It adds the new flow/client to an existing realm without recreating that realm.
Fresh realm import and repeat provisioning both passed.

The Vue entry point selects one adapter before initialization: lesson and exact
lesson callback paths load only the teaching adapter. Shop paths load the shop
adapter and router. This prevents the pre-router `keycloak-js` initializer from
consuming the other client's callback. The exact new callback is
`https://shop.magic.test:8443/teaching/certificate-password/callback`; the two HTTPS
origins, HAProxy auth passthrough and Code + PKCE S256 remain unchanged.

The lesson displays account, subject and certificate identity from an access
token held in adapter memory. It is an authentication lesson: business APIs
retain their existing `shop-spa` authorized-party allowlist and gateway/token
identity comparison. A lesson token returns 403 at the customer API. The new
token includes the same identity/audience mappers, but this does not override the
API client allowlist. No API contract or provider implementation was changed.
The cookie test separately proves a valid shop token returns 200 with its own
certificate and 403 with the shopkeeper certificate.

## Pinned Keycloak behavior

Read the requested architecture/authentication/test/package/API documents,
TODOs, existing realm/bootstrap/Vue code and relevant completion notes (04,
09 UI authentication, 11 teaching and 12 native CI). Consulted the supplied
[26.5.7 administration guide](https://www.keycloak.org/docs/26.5.7/server_admin/index.html),
then fetched the exact 26.4.0 sources inside the installed runner container:
[PasswordForm](https://github.com/keycloak/keycloak/blob/26.4.0/services/src/main/java/org/keycloak/authentication/authenticators/browser/PasswordForm.java),
[PasswordFormFactory](https://github.com/keycloak/keycloak/blob/26.4.0/services/src/main/java/org/keycloak/authentication/authenticators/browser/PasswordFormFactory.java)
and the tagged X.509 implementation. The password form requires an already
selected user and validates that user's password; the factory ID is
`auth-password-form` and user setup is not allowed. Runtime checks below verify
composition, missing credentials and cookie behavior rather than treating the
newer guide as proof of this version.

```sh
docker run --rm --platform linux/amd64 --entrypoint node magic-shop-runner:03 -e 'for (const name of ["PasswordForm","PasswordFormFactory"]) { const r=await fetch(`https://raw.githubusercontent.com/keycloak/keycloak/26.4.0/services/src/main/java/org/keycloak/authentication/authenticators/browser/${name}.java`,{signal:AbortSignal.timeout(10000)}); console.log(name,r.status,await r.text()); }'
```

Both source requests returned 200. Initial diagnostic attempts used nonexistent
local bootstrap image names and failed before starting a container; the existing
runner image supplied the successful inspection.

## Exact verification commands

All builds, provisioning, PKI and browser/test execution used containers.
The fresh project's ordinary startup generated its own PKI/secrets in scoped
Docker volumes. No new certificate operation was needed in the retained lab.
Source/document edits and sanitized diagram images are the only host files
created by this increment; no host trust installation, secrets or browser
profiles were created.

```sh
docker compose -f infra/compose.yaml build realm-bootstrap ui
docker compose -f infra/compose.yaml --profile test build runner-test
docker compose -f infra/compose.yaml run --rm --no-deps realm-bootstrap
docker compose -f infra/compose.yaml up -d --wait --no-deps ui
LAB_PROJECT=magic-shop-password-15 ./lab up
LAB_PROJECT=magic-shop-password-15 sh testing/run-certificate-password.sh
docker run --rm --platform linux/amd64 --entrypoint sh magic-shop-runner:03 -c 'google-chrome --version && microsoft-edge --version && node --version'
docker info --format '{{.Architecture}}'
docker compose -f infra/compose.yaml --profile operator run --rm --no-deps -T realm-user set-password customer-waterdeep
docker build --platform linux/amd64 -t magic-shop-quality:15 -f infra/quality/Containerfile .
docker run --rm --platform linux/amd64 -v "$PWD:/work:ro" magic-shop-quality:15
docker compose -f infra/compose.yaml -f infra/teaching.compose.yaml --profile '*' config --quiet
./infra/render-diagrams.sh
docker run --rm --platform linux/amd64 -v "$PWD/artifacts/diagrams:/data" -v "$PWD/infra/mermaid-puppeteer.json:/config.json:ro" --entrypoint sh ghcr.io/mermaid-js/mermaid-cli/mermaid-cli@sha256:a6fb0574dded4086888b5e38476899c9aff8963196f689f11a0f8fceee588ce1 -c 'mmdc -p /config.json -i /data/architecture-04.mmd -o /data/architecture-04.png && mmdc -p /config.json -i /data/workflows-19.mmd -o /data/workflows-19.png'
git diff --check
sh -n lab testing/run-certificate-password.sh
```

The wrapper builds both tools, repeats provisioning, starts a temporary credential
fixture, runs these two commands for each `LAB_BROWSER=chrome|msedge`, and removes
the temporary passwords and fixture sessions with an exit trap:

```sh
docker compose -f infra/compose.yaml -f infra/teaching.compose.yaml run --rm --no-deps teaching-fixture start
docker compose -f infra/compose.yaml -f infra/teaching.compose.yaml run --rm --no-deps -e LAB_BROWSER=chrome teaching-tests sh -c 'cd /work/testing && ./node_modules/.bin/playwright test --config playwright.password.config.mjs'
docker compose -f infra/compose.yaml -f infra/teaching.compose.yaml run --rm --no-deps -e LAB_BROWSER=chrome teaching-tests sh -c 'cd /work/testing && ./node_modules/.bin/cucumber-js --import cucumber/certificate-password.mjs cucumber/features/certificate-password.feature --format summary'
docker compose -f infra/compose.yaml -f infra/teaching.compose.yaml run --rm --no-deps teaching-fixture finish
```

Use the same commands with `LAB_BROWSER=msedge`. The project environment is
inherited from the wrapper invocation. The wrapper requires an explicit
disposable project and refuses `magic-shop-lab`. The fixture refuses to replace
existing operator passwords. Random test passwords are stored only in a
mode-0600 Docker-volume file and Keycloak; runner mounts are read-only and contain
no admin secret. The original full matrix has no video, screenshots, trace, HAR or saved
storageState export. The later user-requested opt-in recording is documented below. Results are terminal status/assertions, not host credential
artifacts. `finish` can be run explicitly after an interrupted fixture.

## Observed results

| Runner | Chrome | Edge |
| --- | --- | --- |
| Playwright Test | 9 passed, 28.9 s | 9 passed, 31.7 s |
| Cucumber | 9 scenarios / 9 steps passed, 25.951 s | 9 scenarios / 9 steps passed, 29.726 s |

All 36 checks passed in `magic-shop-password-15`, with no retries or TLS bypass:

1. Correct certificate/password completed the separate Vue callback. The test
   verified the RSA signature against live JWKS, exact issuer and client,
   subject, selected `cert_identity`, expiry and three audiences. Displayed
   identity matched the seed; tokens were absent from local/session storage.
2. Wrong password remained on Keycloak with `Invalid password.` and no code.
3. Missing certificate produced no code/password form and failed the shop TLS gate.
4. A service-CA certificate produced no human code/password form and failed shop TLS.
5. The disabled user's trusted certificate produced no code/password form.
6. A trusted unmapped certificate produced no code/password form.
7. A certificate-mapped account without a password did not obtain a code or form
   that could enroll a password or skip the requirement.
8. A saved valid cookie with the same certificate still received the password
   form even on a direct authorization request without `prompt=login`. With the
   shopkeeper certificate, the original customer's password failed; the correct
   shopkeeper password was also denied because the existing session belonged to
   another user. Keycloak displayed “You are already authenticated as different
   user 'customer-waterdeep' in this session. Please sign out first.” A fresh
   shopkeeper context then authenticated as shopkeeper. Saved cookies without a
   certificate received no code/password form. Separately, the original shop
   token returned 200 with its own certificate and 403 with shopkeeper's.
9. The original shop signed in with the certificate alone, displayed the selected
   customer, had no password form and completed logout.

The UI typecheck/build, runner TypeScript build, source formatting, shell syntax,
Compose configuration and authored complexity check passed. Complexity reported
99 files / 524 functions, with the two existing transport baselines retained.
Updated Mermaid sources cover the separate adapter, credential boundary and
Keycloak password exchange; 23 blocks were rendered, and the two new diagram PNGs
were visually inspected.

Initial retained-lab diagnostics used temporary passwords only after checking
that the three fixtures had no existing password; all were removed and their
sessions ended afterward. The first Chrome run had three assertion failures:
the test mistakenly expected business API access for the lesson client, and
used a nonexistent password-error selector. Later cookie assertions were refined
to Keycloak's actual account-mismatch denial. No API allowlist was widened to make
those tests pass. Final diagnostic selections passed nine checks under each
runner/browser. Editing the wrapper while an earlier invocation was reading it
caused an EOF shell error; its cleanup trap ran. The final stable disposable
wrapper invocation exited 0 and completed all four selections plus cleanup.
The first new Mermaid render failed on a semicolon in a sequence message;
the message was corrected before final rendering.

The noninteractive password command deliberately exited 1 with “Password setup
requires an interactive container terminal,” before resetting any credential.
No real user-selected demo password was entered during this work.

## Prior native CI, separately inspected

```sh
gh run view 38012708736 --repo orieken/testing-with-certs --json status,conclusion,jobs,url
```

[Run 38012708736](https://github.com/orieken/testing-with-certs/actions/runs/38012708736)
completed with `success`: five static/build jobs and the native Linux integration
job passed, including contracts, security, all eight existing browser selections,
credential scan, readability, text upload and cleanup. The push run skipped the
PR-base comparison. Completion 12 records this separately. It contains no
certificate/password feature tests and proves nothing about this feature on Linux.

## Remaining dependency and limits

The user's next local step is to choose and enter their actual demo account
password using hidden container input:

```sh
docker compose -f infra/compose.yaml build realm-bootstrap
./lab user set-password customer-waterdeep
```

Enter/confirm at least 12 characters. This terminates the account's existing
Keycloak sessions. Open the lesson in the selected-user container Chrome/Edge
viewer and supply that password only on Keycloak's page. This human provisioning
and manual lesson demonstration remain unrun; no secret was requested in chat.
The automated random test passwords were temporary and have been removed.

The new feature has no native Linux CI evidence or new native-store manual
lesson evidence. Expired/future/revoked certificate cases remain covered by the
existing certificate suites; this increment reran missing, wrong-CA,
disabled/unmapped and cookie cases, not the entire certificate lifecycle matrix.
No new token refresh/revocation timing claim is made; existing issued-token TTL
limitations apply. The new suite is a separate local command, not newly wired
into CI. Saturday checkout, packages/releases and external deployment were not
modified. No commit or push was made.

Disposable cleanup after the final suite:

```sh
LAB_PROJECT=magic-shop-password-15 docker compose -f infra/compose.yaml -f infra/teaching.compose.yaml --profile '*' down --volumes --remove-orphans
docker volume rm magic-shop-lab_teaching-passwords
```

Only this task's disposable project and its earlier empty temporary password
volume were removed; the retained lab, certificate volumes and manual viewer
remain available.

## Follow-up: testing guide and a new passing video

The user requested documentation of this workflow and a link to the last passing
video. The original 36-check matrix had recording disabled and generated no
video. Added explicit disposable-project matrix/recovery/cleanup instructions to
the root README, testing README and teaching guide, plus a separate opt-in recorder.
No original matrix result is relabeled as a recorded run.

```sh
LAB_PROJECT=magic-shop-password-video ./lab up
docker compose -f infra/compose.yaml --profile test build runner-test
LAB_PROJECT=magic-shop-password-video sh testing/record-certificate-password.sh chrome
LAB_PROJECT=magic-shop-password-video docker compose -f infra/compose.yaml -f infra/teaching.compose.yaml --profile '*' down --volumes --remove-orphans
git diff --check
sh -n testing/record-certificate-password.sh
```

The fresh Chrome Playwright recording test passed: **1 passed, 6.7 seconds**
(test body 4.5 seconds), on the same local Apple Silicon amd64-emulation environment
and pinned browser/runtime versions. It reuses the original success check's live
signature/JWKS, issuer/client, subject/certificate identity, expiry/audience,
browser-storage and business API rejection assertions. Browser actions use
450 ms slow motion for readability; TLS verification stays enabled.

Local video:
[Passing Chrome certificate + password login](../../artifacts/certificate-password/20261010T020527Z-chrome-40435/certificate-password-chrome.webm).
The filename timestamp is UTC; this run occurred on October 9 in America/Chicago.
The WebM is 1280 × 720, VP8, 3.72 seconds. Selected frames were decoded with the
container's bundled Playwright FFmpeg and inspected: lesson entry, Keycloak
password form and authenticated account/subject/certificate identity. The
password remains a password input; no show-password control was clicked. The
video captures the page viewport without the browser address bar, tokens,
network headers or console. It is a local gitignored review artifact, not a CI
upload, and uses removable random test credentials rather than the user's actual
password. The fixture removed its passwords/sessions and disposable-project
cleanup removed its certificate, secret and database volumes.

The full matrix still exports no videos/screenshots/traces/HAR/storageState.
Only `record-certificate-password.sh` selects the new recording config/spec;
`run-certificate-password.sh` retains its nine tests per runner/browser. No Edge
recording or new full matrix/native Linux run was claimed in this follow-up.
