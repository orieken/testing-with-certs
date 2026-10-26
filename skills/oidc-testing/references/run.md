# Run and troubleshoot container tests

Discover the target project's supported entrypoint before composing commands. Read its scripts and Compose definitions to identify the real project selector, environment variables, build dependencies, report paths, and cleanup behavior.

## Explain or execute a run

Provide the working directory, prerequisites, exact command, suite scope, expected success signal, artifact directory, and cleanup behavior. State whether the command runs OIDC alone or a larger authentication suite.

When executing, verify the container engine is available, project isolation is correct, and no existing user environment will be overwritten. Use the supported entrypoint. Do not install browsers or trust material on the host when the intended workflow keeps them inside containers.

For a focused run, preserve the complete setup contract: trust, DNS, provider/client provisioning, correct fixture phase, private secrets, report mounts, and browser channel. A filtered pass cannot substitute for a full inventory gate.

Keep requested explanations separate from execution evidence. If the user asks only how to run a suite, provide instructions without starting an expensive stack unnecessarily.

## Diagnose by boundary

| Failure | Inspect next |
| --- | --- |
| Container engine unavailable | Engine state, socket access, and required execution permissions. |
| Existing disposable resources | Project selector and ownership; use a fresh name rather than deleting unrelated resources. |
| DNS/TLS/navigation | Browser-visible origins, network aliases, CA mounts, certificate names, and server health. |
| Provisioning drift | Exact clients, redirects, flows, provider configuration, secret pairing, and partial fixture state. |
| Login/callback failure | Which exchange failed, callback owner, state handling, PKCE, and actual form structure. |
| Missing fixture/wrong phase | Startup action paired with the selected baseline or lifecycle suite. |
| Unexpected refresh rejection | Issuer endpoint, client binding, rotation, session lifetime, logout, and timing. |
| Expected rejection succeeds | The negative input and policy actually reached the intended real boundary; verify successful controls. |
| Missing or unsafe evidence | Reporter phase, filtered case names, mounted destination, expected selections, scan, and recording privacy. |
| Cleanup failure | Ownership records, original policy, retained identities/sessions, and project resources. |

Use safe source locations and structural diagnostics instead of dumping passwords, token responses, authorization headers, callback URLs containing codes, or private keys. Preserve bounded failure evidence while fixing the underlying cause.

After execution, report exit status, completed selections, gates, cleanup result, and artifact location. Keep local emulation and native execution distinct. On interruption, follow the project's ownership-aware restoration procedure before removing its disposable volumes where possible.
