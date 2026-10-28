# Recorded RFC 8705 tests in VNC containers

Validated locally on 2026-10-27 (America/Chicago). The complete recorded selection exited **0**. This is local Docker acceptance for Playwright on Debian in Chrome and Edge, with a portable local report. It does not claim native CI, Cucumber/UBI9 parity or publication.

## Runnable result

From the repository root:

```sh
LAB_PROJECT=magic-shop-mtls-rfc8705-videos-example-01 sh testing/run-oidc-mtls.sh rfc8705
```

Use a new project/report name. Startup builds the application/provider/runner images and the existing native Go report operator through its pinned build container. The host runs orchestration and report assembly; authentication tests and browsers run in containers. Browsers and private CA trust are not installed on the host.

The [RFC overlay](../../infra/rfc8705.compose.yaml) adds a headed `rfc8705-tests` service with Xvfb, fluxbox, x11vnc and websockify/noVNC, using the same runner image as the repository's manual viewer. [Desktop startup](../../testing/container/rfc8705-desktop.sh) verifies display/VNC/viewer readiness, generates a private viewer password and runs the automated scenarios on `DISPLAY=:99`. The workflow binds the viewer to loopback, normally port 6086, and uses the same named viewer container sequentially for both channels. A direct `xwininfo` probe during development confirmed a real browser window on the display served by VNC. No window titles or viewer credentials were copied into evidence.

During execution open `http://localhost:6086/vnc.html`. In another terminal, retrieve the generated password privately:

```sh
docker exec magic-shop-mtls-rfc8705-videos-example-01-viewer cat /tmp/viewer-password
```

The viewer is present only while that channel runs; `LAB_RFC8705_VIEWER_PORT` overrides the host port. The private password is never saved with reports.

## Scenarios and evidence

[The shared flow](../../testing/rfc8705/flow.mjs) independently verifies real Keycloak signatures, issuer/client/audience/expiry and the signed certificate thumbprint. The API-only cases retain their existing assertions in [binding.spec.mjs](../../testing/rfc8705/binding.spec.mjs). [Browser scenarios](../../testing/rfc8705/browser.spec.mjs) add actual provider authorization and real resource navigation:

1. Matching bound certificate/token succeeds at catalog, customer and insights APIs.
2. Two independently valid same-user certificates each succeed with their own signed token. Cross-presentation in both directions and a spoofed original-thumbprint header return 401 at all three APIs. Matching controls succeed again afterward.
3. A valid token cannot pass browser navigation without a certificate, paired with an independent verified request that identifies the TLS client-certificate rejection. Matching controls succeed afterward. Chromium can surface the browser failure as `ERR_SOCKET_NOT_CONNECTED`; that generic browser observation is not mislabeled as a specific TLS alert.

Browser authorization observes the real callback request and suppresses shop script loading so the existing shop client adapter cannot consume another client's code. The test-owned callback receipt is labeled on screen; code exchange remains private. This is a controlled browser authorization/API workflow, not an end-to-end claim about a new application UI or native OS certificate selection.

The [shared authentication recording wrapper](../../testing/teaching/auth-recording.mjs) records every page created by each browser scenario, finalizes clips on pass/failure, and writes exact scenario metadata. The [existing visual privacy probe](../../testing/teaching/auth-recording-privacy.mjs) now accepts a private output directory and headed browser selection while retaining its defaults for other suites. Both RFC channels run it on the VNC display; every decoded frame must exclude the synthetic provider surface while its controls remain usable. Provider documents are hidden before paint. Raw tokens, callback codes, request headers, traces and credential screenshots are excluded from the report. API-only cases have allowlisted boundary/status evidence, not fabricated clips.

## Report and gates

The [safe reporter](../../testing/reporting/rfc8705.mjs) writes per-channel results, JUnit and HTML without raw error output. Safe source locations and normalized browser error identifiers support debugging. [Report assembly](../../testing/reporting/rfc8705-report.mjs) requires the exact scenario selections, linked nonempty videos, expected per-case evidence, source/run identity, privacy receipts and verified project cleanup. It reuses the existing Go `matrix-merge` gallery and `matrix-site` portable exporter; no alternate report design was introduced.

Artifacts under `artifacts/rfc8705/PROJECT/` include:

- `index.html`: scenario/API evidence overview; `matrix.html`: existing filterable video gallery.
- `chrome/` and `msedge/`: scenario results, JUnit, privacy receipts and safe boundary assertions.
- `recordings/`: every recorded page and its scenario/outcome metadata.
- `provenance.json`: source revision, dirty state/content digest, run/project/attempt and selection scope.
- `cleanup.json`: independently checked absence of owned containers/volumes/networks.
- `site/index.html`: portable passing video report with copied safe evidence.
- `playback.json` and `site/evidence/playback.json`: link/filter/privacy scan and every-clip playback verification.

Incomplete or failed runs retain a local failure report and available recordings, preserve nonzero exit status, and cannot export a passing portable site. The workflow removes owned project resources before assembling its passing report. Final [playback verification](../../testing/reporting/check-rfc8705-playback.mjs) checks portable links, the two selections, certificate filters, every clip's decoding and advancing playback, and absence of page errors in both channels. These verification browsers are headless container checks of the report, separate from the recorded headed authentication scenarios.

## Observed acceptance

```sh
LAB_PROJECT=magic-shop-mtls-rfc8705-videos-20261027-05 sh testing/run-oidc-mtls.sh rfc8705
```

- **12/12 RFC executions passed:** six recorded browser scenarios and six API-only checks, across Chrome and Edge.
- **10 page videos** retained, linked to their exact scenarios. Multiple contexts/pages explain the difference from six browser scenarios.
- **12/12 existing API security regressions** and verified transport controls passed in the same workflow.
- Visual privacy probes passed in both headed channels, including decoded-frame verification.
- The portable report had **2 selections**, **10 videos**, valid links, working certificate filters and **0 page errors**. Every clip decoded and advanced in Chrome **155.0.8059.84** and Edge **154.0.4258.62**.
- All project-labeled containers, volumes and networks, including the second certificate volume, were absent after teardown.
- **9/9 recording/report checks passed:** three existing recording-gate regressions plus six new artifact-based probes. The new probes use copies of the accepted report, require the original to have passed playback, and verify missing video, duplicate scenarios, wrong provenance, missing visual-privacy evidence and credential-shaped text are rejected by the intended gate. An unmodified control exports successfully. Probe copies are removed afterward.
- Syntax, Compose configuration, skill structure and diff whitespace checks passed.

The accepted local report is `artifacts/rfc8705/magic-shop-mtls-rfc8705-videos-20261027-05/site/index.html`. The temporary execution log is `/private/tmp/oidc-rfc8705-video-workflow-05.log`.

During development, real browser failures exposed redirected-callback capture and Chromium's generic missing-client transport error. Their clips and failed matrix reports remain in their own numbered run directories; no passing portable sites were exported for those runs, and cleanup verified resource absence. They establish failed-scenario recording retention separately from the final passing selection.

To rerun the report-gate regression probes after a successful recorded run:

```sh
LAB_RFC8705_TEST_REPORT=artifacts/rfc8705/PROJECT node --test testing/reporting/rfc8705-report.test.mjs testing/reporting/auth-recording-index.test.mjs testing/reporting/check-cucumber-recordings.test.mjs
```

For recovery after an unhandled interruption, use the exact owned disposable project and its existing report directory:

```sh
export LAB_PROJECT=magic-shop-mtls-rfc8705-videos-example-01
export LAB_RFC8705_REPORT_DIR="$PWD/artifacts/rfc8705/$LAB_PROJECT"
docker compose -f infra/compose.yaml -f infra/rfc8705.compose.yaml --profile '*' down --volumes --remove-orphans
```

Then query project-labeled containers, volumes and networks independently before recording cleanup as passed. This does not repair or turn an interrupted report into passing acceptance.
