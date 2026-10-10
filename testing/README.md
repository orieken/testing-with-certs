# Testing workspace

The live teaching examples use one Saturday `MagicShop` site with page, element and certificate-login flow models in `site/`. Playwright Test and Cucumber call the same setup/interactions, while each runner keeps its own readable business assertions. The local `saturday-keycloak-prototype` fixture/hooks select one mounted identity and both exact HTTPS origins. Only real Chrome and Edge are configured; server validation remains on.

Run from the repository root after `./lab up`:

```sh
./lab test --runner playwright --browser chrome --user customer-waterdeep
./lab test --runner cucumber --browser chrome --user customer-waterdeep
./lab test --runner playwright --browser msedge --user shop-admin
./lab test --runner cucumber --browser msedge --user shop-admin
./lab test --runner playwright --suite contracts
./lab test --runner playwright --suite security
./lab test --runner playwright --suite package
```

Repeat each role with the other browser to complete the eight teaching combinations. The customer scenarios exercise certificate login, account, simulated server-priced order, widget persistence and direct admin denial. The administrator scenarios exercise certificate login, account, September Waterdeep totals and local map. The imported `cart.feature`, `inventory-list.feature` and `item-details.feature` remain source-reference examples and are not selected by this live suite.

Playwright teaching runs write HTML, JUnit, per-test WebM and failure-only screenshots under `artifacts/teaching/<run-id>/`. Cucumber writes JSON, JUnit and a small local scenario telemetry JSONL with title, result, duration, browser and selected synthetic user only. Its hooks do not record tokens, certificate data or browser state. Contracts run without a browser and write HTML/JUnit plus `artifacts/contract-coverage.json`; the wrapper rejects missing operation/status coverage across the three live OpenAPI providers. The package suite builds and independently executes a packed consumer, without publishing.

The browserless security suite checks missing certificates/private CA, wrong hostname, ID-token misuse, forged identity headers, private backend bypass, parallel user contexts, cross-customer order ownership and shopkeeper writes. Its separate Compose profile mounts only three human identity leaves and public trust. Reports are local and gitignored. A containerized artifact scanner rejects credential-like filenames and text after teaching/contract runs. Review videos before sharing; they show synthetic shop data and may show an authorization redirect in the browser. Traces, HAR, `storageState`, private keys, PKCS#12 and secrets are not exported. See [coverage status](../docs/teaching-coverage.md) for test-plan IDs and remaining negative/parallel checks.

## Certificate + password lesson

This is a separate authentication lesson at
`https://shop.magic.test:8443/teaching/certificate-password`. Keycloak checks the
certificate-selected account's password on its own page. The normal shop remains
certificate-only; lesson tokens do not grant business API access.

Run the full matrix in a disposable project, from the repository root:

```sh
LAB_PROJECT=magic-shop-password-check ./lab up
LAB_PROJECT=magic-shop-password-check LAB_PASSWORD_REPORTS=1 sh testing/run-certificate-password.sh
LAB_PROJECT=magic-shop-password-check sh testing/cleanup-certificate-password.sh
```

The wrapper runs nine shared checks under Playwright Test and Cucumber in both
real Chrome and Edge (36 checks). They cover successful signed token identity,
wrong password, missing/wrong certificate, disabled/unmapped user, an account
without a password, saved-cookie/account mismatch, and certificate-only shop
login/logout. TLS verification remains enabled. A temporary container fixture
creates random passwords in a Docker volume, refuses existing operator passwords,
and removes the passwords and fixture sessions on exit. Both wrappers refuse the
retained `magic-shop-lab` project. After an interrupted fixture, recover with:

```sh
LAB_PROJECT=magic-shop-password-check docker compose -f infra/compose.yaml -f infra/teaching.compose.yaml run --rm --no-deps teaching-fixture finish
```

The full matrix records no video, screenshots, traces, HAR or storageState and
exports no secrets/profiles. With `LAB_PASSWORD_REPORTS=1`, each browser/runner
exports allowlisted case names and pass/fail status in JUnit and JSON at
`artifacts/certificate-password-ci/<project>/<browser>-<runner>/`. Raw assertion
messages, attachments, stdout/stderr, tokens and passwords are omitted. CI requires
all nine cases in all four selections, scans the reports and checks host readability
before text-only upload. Every selection gets fresh Docker-volume HOME/tmp; the
exit trap removes temporary passwords/sessions and verifies credentials are gone.
`cleanup-certificate-password.sh` removes and verifies only the named project's
containers, networks and volumes. GitHub uses `always()` cleanup for failures and
cancellation; forced runner termination or host loss can prevent traps, so retain
the explicit cleanup command. The CI job also starts a second disposable stack,
injects a runner failure after provisioning, and verifies credential/resource
cleanup. See [completion 18](../docs/completion/18-native-certificate-password-ci.md)
for observed native results and limits. For an opt-in
**new passing login recording**, use a separate disposable project:

```sh
LAB_PROJECT=magic-shop-password-video ./lab up
LAB_PROJECT=magic-shop-password-video sh testing/record-certificate-password.sh chrome
LAB_PROJECT=magic-shop-password-video docker compose -f infra/compose.yaml -f infra/teaching.compose.yaml --profile '*' down --volumes --remove-orphans
```

Use `msedge` instead of `chrome` for Edge. The recorder reuses the successful
login test's signature, issuer/client, subject, certificate claim, expiry,
audience, browser-storage and API-boundary assertions. It captures only the page
viewport with the password masked, slows browser actions for readability, and
writes `artifacts/certificate-password/<run-id>/certificate-password-<browser>.webm`.
Browser profiles, credentials and token/network captures remain inside containers;
no trace, screenshot, HAR or storageState is exported. Videos are local review
artifacts, excluded from CI uploads. A new recording does not retroactively add
video to the earlier 36-check matrix.

For human use in the retained lab, set the actual demo password with
`./lab user set-password customer-waterdeep`, entering it only in the hidden
container prompt. Automated random test credentials are separate from that choice.
See [authentication](../docs/authentication.md) and
[completion 15](../docs/completion/15-certificate-password-view.md) for evidence,
exact commands and native Linux/manual limitations.

Latest observed recording: [passing Chrome login](../artifacts/certificate-password/20261010T020527Z-chrome-40435/certificate-password-chrome.webm),
a new single-test pass recorded after the original unrecorded matrix. Local
videos are gitignored and this link is available only where the artifact exists.
