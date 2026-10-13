# Certificate testing: project pitch and current gaps

## Elevator pitch

Magic Shop makes certificate-based testing repeatable without installing test certificates on your computer. Docker provisions separate user, service, and server certificates, then runs real Chrome and Edge against Keycloak and three business APIs. The browser proves its selected identity with a certificate; each API validates the access token, permissions, and matching certificate identity. Shared Playwright and Cucumber examples test successful journeys and rejection cases. Separate mocks and fault suites teach failure handling without weakening the real login path. You get assertions, local recordings, and distinct CI reports that show what passed—and what remains unverified. It's a teaching lab, not a production enrollment or payment system.

## What you can demonstrate

- Real certificate-only shop login with verified TLS and PKCE.
- Separate certificate-and-password authentication, with the password collected by Keycloak.
- API rejection of selected invalid tokens, wrong identities, insufficient permissions, and cross-customer access.
- Canonical OpenAPI checks against the three real providers.
- Controlled dependency failures, checkout races, response loss, and recovery with separate evidence.
- Browser mock-consumer behavior without sending synthetic authentication to real APIs.

For a first run, use the [getting-started guide](getting-started.md).
For the exact identity and routing boundaries, see [authentication](authentication.md) and [architecture](architecture.md).

## Current gaps

Status reviewed against recorded repository evidence on October 13, 2026.
This documentation work doesn't claim new application test results.

| Gap | What it means | Evidence or next step |
| --- | --- | --- |
| Reporting timestamp precision | A valid mixed whole/fractional-second range can return canonical 503 because endpoints are compared lexically. | [Completion 24](completion/24-regional-reporting-boundaries.md) records the limitation. Add chronological comparison and regression coverage in a separately authorized fix. |
| Regional UI row limit | The affected view displays the first 25 rows without a load-more control. Exhaustive API coverage doesn't make the UI exhaustive. | [Completion 24](completion/24-regional-reporting-boundaries.md) distinguishes provider and browser scope. |
| Native Linux manual operation | Automated Linux CI doesn't prove the interactive viewer or host operator works there. | [Backlog](TODO.md) and [operator completion](completion/13-operator-tui.md) retain these checks as unverified. |
| Literal clean-checkout/repeat-startup evidence | New-volume startup checks aren't a recorded test of every step from a literal clean checkout followed by repeated startup. | [Backlog](TODO.md) retains that distinction. |
| Standalone JWT and OIDC platform scope | The examples retain recorded local results; the later native consumer gate isn't blanket Linux evidence for those examples. | [Mock completion](completion/16-mocking-examples.md) and [CI completion](completion/26-independent-ci-evidence.md) define the scopes. |
| Recording coverage | The 36-case certificate-password matrix doesn't record video. Its opt-in recorder executes a new passing login. Native CI exports text, not videos. | [Lesson instructions](../testing/README.md#certificate--password-lesson) describe the separate recorder. |
| Package release readiness | The Saturday Keycloak adapter is private. The independent packed-consumer setup still installs a local certificate-helper tarball. | [Package guide](../packages/saturday-keycloak/README.md) and [packed-consumer build](../packages/saturday-keycloak/Consumer.Containerfile) describe the current setup. Prepare a release artifact and dedicated installation gate before publication. |
| Long-term browser reproducibility | Signed upstream browser repositories can remove an exact package version. Pins don't guarantee indefinite availability. | [Native CI history](completion/12-native-linux-ci.md) records a retired Chrome pin. A reviewed immutable package source remains future work. |

Inventory reservation, real payments, public certificate enrollment, and external customer messages are outside the current teaching scope.
Don't present them as implemented features.
The [backlog](TODO.md) separates those product ideas from test evidence gaps.

## Evidence you can cite

Native Linux push run `38115515064` and PR run `38115518115` passed all 13 expanded jobs at the implementation revision recorded in completion 26.
Intentional-failure run `38115560267` rejected the selected checkout job and final gate while preserving cleanup and failed-report evidence.
See [completion 26](completion/26-independent-ci-evidence.md) for exact versions, commands, results, and limitations.

These are historical observed runs, not fresh results from the latest documentation commit.
A mock pass isn't real-login evidence. A fault pass isn't normal live-provider coverage.
A successful recording or report upload doesn't override failed assertions.

## Documentation approach

The pitch uses direct, concrete language following [Google's voice and tone guidance](https://developers.google.com/style/tone).
Technical terms follow the shared [project terminology dictionary](project-terminology.md).
