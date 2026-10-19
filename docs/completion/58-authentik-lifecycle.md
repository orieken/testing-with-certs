# Authentik lifecycle acceptance

2026-10-19 (America/Chicago).

Native Ubuntu CI [run 39316975644](https://github.com/orieken/testing-with-certs/actions/runs/39316975644) passed all **16 jobs** at runtime source `c86489c361e9416248fa45ef181642e347702816`. The authentik job passed **104/104 executions**: 56 baseline plus **48 new lifecycle executions**, using real Chrome/Edge and Playwright/Cucumber. Each protocol has seven baseline and six lifecycle scenarios per browser/runner, for 52 executions per protocol. Existing protocol, OTP, certificate/password, integration, and final evidence jobs also passed. The combined authentication inventory is 364 executions; the separate certificate/password regression adds another 36.

## Observed lifecycle behavior

- Exact 20-second access tokens expire and clear the lesson identity without automatic browser refresh. Sign-in establishes the same subject again; broker SSO may be reused, so this case does not establish upstream reauthentication.
- Manual broker refresh produces a new access token with the same subject, username, issuer, client and intended audience. Scoped lesson roles and denial at all three business APIs remain enforced. No new provider browser navigation occurs.
- Provider logout returns cleanly to the lesson, invalidates the saved broker refresh token, survives page reload without identity, and leaves a fresh browser context signed out.
- The wrong client cannot refresh a saved token. A successful correct-client request using that same token excludes expiry as the reason for rejection.
- After the observed maximum client-session lifetime (bounded at 45 seconds), refresh fails with `invalid_grant`; the browser identity is absent. This uses an actual wait rather than a changed clock or malformed token.
- Removing the actual provider group preserves the broker's cached role during refresh. After logout and a new provider roundtrip, the same subject receives a new token without that role. Provider SSO is permitted; a credential prompt is not required. Membership is restored in `finally` and independently verified after all selections.

These prove **authentik → Keycloak → app** broker behavior. They do not prove global logout across other provider applications, immediate revocation of all issued tokens after group withdrawal, direct provider adapters, or physical-authenticator behavior.

The short lifetime attributes belong only to newly created disposable broker clients. Each lifecycle case has its own provider account. A private control service uses pinned provider management models to mutate only the two owned group-withdrawal accounts. It has no host port, requires a private random secret, rejects unauthorized requests and unknown targets, and emits no request logs. Its secret and all provider credentials remain in private Docker volumes. Those volumes, databases, users, keys, networks, and containers are removed at teardown.

## Independent evidence checks

Downloaded bundle: `artifacts/authentik/native-video-39316975644`.

Rerunning `testing/reporting/check-authentik.mjs` independently verified **104 cases, 120 videos and 16 indexed selections**, with exact case inventory, phase/spec/privacy labels, statuses, provenance, and nonempty uniquely indexed files. The credential-safe scanner checked **386 entries**. `lifecycle-cleanup.txt` confirms restored provider membership; `cleanup.txt` confirms independently verified project-resource removal. Native logs independently retain eight complete group-stage sequences: **64 safe events**, eight of each allowlisted stage. The reporter's redaction unit check rejects unknown messages, extra values, prefixes, and ANSI/credential-like suffixes.

Environment evidence records Linux x64, Node v24.19.0, Chrome 155.0.8059.84 and Edge 154.0.4258.62. The real-browser privacy probe precedes cases, and provider documents are hidden before rendering in recordings. The shared evidence gate separates baseline and lifecycle specs and rejects mislabeled phase/spec/privacy records. Both runners enumerate all 26 scenario names exactly once per browser; Cucumber retains randomized ordering.

All 120 videos are imported into the combined matrix report with spec, case name, result status, and OIDC/SAML grouping. The gallery now contains **206 selections and 1,872 videos**, plus the existing six explicitly disabled case entries. All 1,872 video source links resolve; the gallery credential scan passed. Repeated baseline captures remain separate evidence and add no new unique behaviors.

## Earlier failures and corrections

[Run 39312127946](https://github.com/orieken/testing-with-certs/actions/runs/39312127946), source `50435b6`, failed control-service startup before browser cases. Its service definition omitted the private database network; that connection was added. [Run 39313547372](https://github.com/orieken/testing-with-certs/actions/runs/39313547372), source `b4b28b5`, then failed with Docker's shared-volume `/data/media` symlink-copy collision while creating the server/worker concurrently. The harness now initializes the server volume before creating the worker. Their authentik cleanup steps succeeded; the superseded workflows were cancelled when corrected source was pushed. Neither run is credited as acceptance.

[Run 39314291538](https://github.com/orieken/testing-with-certs/actions/runs/39314291538), source `7e3a1cf`, passed all 14 Chrome Playwright baseline cases and ten of its twelve lifecycle cases. Both group-withdrawal cases timed out. The test's second login assumed an interactive identification form after logout. It now permits SSO while still requiring a fresh provider roundtrip, unchanged subject, and the absent role. Fixed allowlisted group-stage diagnostics were added, and Playwright now stops after the first failure. The full corrected matrix subsequently passed in run 39316975644. The earlier partial Chrome run is not imported or credited as a complete matrix.

A fresh full local attempt failed during base-lab startup with Docker Desktop internal API 500 responses, before authentik browser acceptance. Owned resources were later removed and independent container/volume/network queries were empty. An initial provider-only probe also encountered the shared-volume startup collision; it is uncredited. A clean sequential provider-only probe subsequently became healthy and passed real unauthorized/unknown-target rejection, group withdrawal and restoration for both protocols, and an independent membership check. Its owned resources were removed and independently verified absent. These targeted local controls do not substitute for full local browser acceptance; native CI provides the complete browser evidence.

Targeted evidence/redaction unit checks, Node/Python syntax checks, Compose validation, and complexity checks passed during implementation. The corrected source's native workspace job and all other required jobs passed. Remaining account-based providers stay deferred under the external setup documentation. Suggested next account-free increment: authentication cancellation and recovery tests.
