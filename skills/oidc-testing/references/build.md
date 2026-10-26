# Build missing OIDC testing

Begin with the assessment inventory. Reuse existing application flows, provider tooling, containers, test runners, and reporting conventions. For a new project, choose a small runnable baseline and explain any assumed framework/provider choices.

## Establish the environment

- Give browser-visible issuer and callback origins consistent DNS and TLS inside the container network. Internal service addresses may differ; do not substitute them into issuer checks.
- Supply trusted CA material to every participating runtime, including the browser and server-side setup/request clients. Keep private credentials out of the source tree and reports.
- Provision a test client with exact callback and logout URLs. Use authorization code flow with PKCE for a public browser client. Keep confidential credentials on the server side.
- Add a controlled upstream provider only when testing brokered federation. Document both clients, both callbacks, and token ownership.
- Make readiness observable before provisioning and running tests. Do not rely only on a listening port or arbitrary sleeps.

## Establish owned fixtures

Create unique test users and private generated credentials. Use separate accounts where session changes could affect another scenario. Record fixture ownership before partial setup can fail, refuse ambiguous ownership, and delete provider and imported broker users as applicable.

For short expiry checks, prefer scoped client policy in a disposable environment over realm-wide policy changes. Verify applied policy and server-reported lifetimes. Save enough original state to restore the actual target configuration; do not assume every project begins with absent overrides. The reference lab deliberately refuses pre-existing lifetime overrides.

Use real time for expiry checks, with bounded waits based on returned lifetimes. Avoid fabricated claims or clock changes for live acceptance.

## Add coverage appropriate to the application

| Behavior | Assertion and useful control |
| --- | --- |
| Successful login | Real provider interaction reaches the application with expected identity and token contract. |
| Disabled account | Disabled owned identity cannot establish application identity. |
| Application callback rejection | Unmatched state/invalid code is rejected without identity. Add more precise independent probes if claiming state-only coverage. |
| Broker callback/provider isolation | For federation, reject invalid broker callbacks and unintended providers where routing policy supports the check. |
| API authorization | Expected audiences and permissions work; inappropriate issuer/client/audience tokens fail with otherwise valid transport credentials. |
| Access expiry | Browser behavior matches product policy: clear identity, refresh, or re-enter authorization. Observe requests to distinguish these outcomes. |
| Refresh identity | Real refresh preserves intended subject and claims and produces a usable token; verify at server boundaries where applicable. |
| Refresh client binding | Wrong valid client is rejected; correct-client use of the same token succeeds when rotation rules permit. |
| Logout | Local identity clears; captured refresh token is rejected if provider/session semantics promise that behavior. |
| Session expiry | Actual session expiry rejects refresh; use the provider's defined timing and error contract. |

Adapt assertions to provider semantics, including refresh-token rotation and revocation. Do not force Keycloak's exact `400 invalid_grant` contract onto unrelated providers without verification. Do not require a changed token string unless that behavior is part of the target contract.

Keep the behavior implementation shared if multiple runners are requested. Each scenario owns a fresh context and can run independently. Separate baseline and lifecycle phases so reports cannot satisfy the wrong selection. Use sequential execution where fixtures or timing require it; do not add retries that conceal failures.

## Complete the runnable result

Add one supported orchestration entrypoint covering build, startup, fixtures, tests, reporting, and teardown. Preserve the original failing status and fail if cleanup cannot be verified. Include normal and interrupted-run recovery instructions scoped to the disposable project.

Filter reports to safe case identifiers and outcomes. Treat token endpoint responses and browser/network traces as credential-bearing. If recording real journeys, hide provider documents before capture or omit credential screens. Verify the privacy mechanism as well as the tests.

Run meaningful source checks and live selections as available. For a claimed full matrix, require every expected case, browser, runner, and phase with matching provenance. Document exact commands, prerequisites, expected output, artifact location, and limits. If external credentials or unavailable infrastructure block live execution, finish the implementation and report that limitation explicitly.
