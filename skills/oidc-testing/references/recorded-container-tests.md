# Reference-style containers, recordings and reports

Use when the user asks for the `testing-with-certs` style of testing, VNC/noVNC containers, all scenario videos or its report experience. Treat these as delivery requirements when requested. A console-only/headless smoke run may inform development but cannot complete that requested evidence deliverable.

## Plan and build the whole experience

- Run applications, test providers, owned fixtures and browser runners in disposable container networks. Preserve existing external provider choices; identify which require a test tenant or credentials. Use pinned, reproducible runtime/browser dependencies and verified trust. Avoid host-installed browser/CA prerequisites.
- Provide a headed desktop runner with a ready virtual display, window manager, actual requested browser channels and VNC/noVNC viewing. The reference uses Xvfb, x11vnc and websockify. Bind the viewer to loopback with generated private access credentials. Give CI the same display/browser environment; a live viewer need not be exposed in CI.
- Treat VNC viewing and video recording as separate capabilities. Ensure automated journeys run in the intended container/display. Native OS certificate selection and Playwright certificate injection require separately labeled evidence.
- Record every executed browser scenario, both passed and failed, across requested browsers/runners/personas/phases. Retain recordings from every page/popup where relevant, finalize on normal/failure cleanup and map each clip to its exact scenario and outcome. Do not rely on failure-only or retry-only video retention. Report skipped and never-started scenarios accurately; do not invent videos for them.
- Preserve credentials visually: use the existing pre-paint provider-document hiding approach or an equivalent verified mechanism, adapted to the target's origins and sensitive screens. Omit raw bearer headers, codes, private keys and sensitive trace attachments. Text scans do not establish visual privacy. Keep outcomes visible through credential-safe evidence.
- API/protocol-only cases need structured request/assertion evidence, not invented browser recordings. Label them API-only in the report. Plan a real recorded UI companion when a user-visible journey can demonstrate the same feature; do not claim a video proves a private server assertion by itself.
- Produce local browsable HTML with a scenario/spec results view, matrix filters, pass/fail/skip status, embedded playable clips and safe evidence links. Include JSON and JUnit results for automation. Record source revision (and dirty state/content identity where applicable), run ID, attempt, project, scenario, auth mechanism, browser, runner, persona and phase. Include fixture/cleanup receipts and distinguish proposed, inspected and executed results.
- Gate completeness against the declared selection, not historical fixed counts. Require all expected results, all required browser videos, valid provenance, privacy scans, cleanup receipts and report-link/video playback checks. A partial selection cannot satisfy the full matrix. Preserve test failure if report finalization or cleanup also fails. Record any unrecoverable clip finalization as an evidence failure.
- Deliver startup, interactive-viewer, test, report-viewing and scoped interruption-recovery commands. Build the portable local report first. Publication/deployment follows only when requested or already authorized.

## Sources in the reference checkout

Read only the files needed to adapt the design:

| Concern | Reference source |
| --- | --- |
| Desktop, readiness and actual browser launch | `testing/container/manual.sh`, `testing/container/auth-manual.sh`, `testing/container/display-ready.mjs` |
| Runner images, networks, mounts and loopback viewer ports | `testing/container/Runner.Containerfile`, `infra/compose.yaml`, `infra/auth-lessons.compose.yaml` |
| Scenario videos, context closure, metadata and visual privacy | `testing/teaching/auth-recording.mjs`, `testing/teaching/auth-recording-privacy.mjs` |
| Completeness and artifact gates | `testing/reporting/auth-recording-index.mjs`, `testing/reporting/check-auth-matrix.mjs`, `testing/container/check-artifacts.mjs` |
| Local portable gallery, provenance and playback | `testing/reporting/prepare-pages.mjs`, `testing/reporting/pages-evidence.mjs`, `testing/reporting/pages-playback.mjs`, `docs/pages-report.md` |

The reference's manual viewer and automated recording harness are separate implementations. Inspect the automated launch settings before claiming it already shares a VNC desktop. Adapt and verify that connection when building the requested workflow. Do not copy the report's fixed counts, ports, origin allowlists or publication policy into another project.
