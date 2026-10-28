# Assess an existing project

Inspect repository instructions, authentication code, provider configuration, container definitions, test entrypoints, and CI. Start with local source. If provider details need external verification, use current official documentation. Do not request secret values to fill inventory gaps.

## Build an evidence-backed inventory

For each item, give a source location and a status: present, partial, missing, unknown, or not applicable. Separate configuration found in source from behavior observed in a live run.

| Area | Questions to resolve |
| --- | --- |
| Topology | Which application and provider participate? Is there a broker? Which service owns each realm or tenant? |
| Client contract | Public or confidential client? Code flow and PKCE? Exact callbacks, allowed origins, and logout redirects? Who holds client credentials? |
| Application | Which adapter handles state, code exchange, token storage, identity display, expiry, refresh, and logout? |
| Provider | How are clients, signing keys, users, mappings, disabled users, and sessions provisioned? Is a disposable provider available? |
| Token enforcement | Expected issuer, authorized client, audiences, subject, roles, signature verification, and API rejection boundaries? |
| Containers and trust | Build/start commands, image architecture, internal DNS, browser-visible origins, CA trust, certificates, secret mounts, health checks, and readiness? |
| Tests | Real browser channels, runners, shared assertions, isolated contexts, and baseline/lifecycle coverage? |
| Fixtures | Owned identities, generated credentials, session policy, controls for negative tests, restoration, and interrupted-run recovery? |
| Evidence | Failure exit codes, selection/count checks, safe reports and recordings, scans, artifact destinations, and CI gates? |

Use the reference repository to recognize useful patterns, then map them onto the target. For example, business-API rejection is applicable when lesson or alternate-client tokens must be excluded; a customer certificate is specific to the reference lab.

## Produce the assessment

Deliver:

1. A concise description of the actual login and refresh topology.
2. The inventory with source evidence and uncertainty made explicit.
3. A gap list ordered by prerequisites: environment/trust, provisioning, successful login, rejection boundaries, lifecycle, evidence, cleanup/CI.
4. A proposed coverage matrix, explaining which checks apply and which require provider support.
5. Existing runnable commands, or the precise missing dependencies that prevent execution.

For an empty project, mark framework/provider choices unresolved and propose a minimal disposable setup. Ask only for choices that materially affect implementation; continue inspection and independent preparation while waiting.

For a folder of projects, follow [project-folder assessment](project-folder-assessment.md). For requested VNC/video/report parity, use [recorded container requirements](recorded-container-tests.md) and include the existing suite's missing evidence in the gap list.
