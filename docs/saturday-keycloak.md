# Portable `saturday-keycloak` package

Status after Prompt 05: the private `saturday-keycloak-prototype` package exists in this repository. Its core/file/PKI-command/Keycloak/token adapters, Playwright Test fixture, Cucumber hooks, manual manifest and CLI have been built and tested in containers. Real selected-certificate logins passed in Chrome and Edge under both runners and through package-driven native installation on Apple Silicon amd64 emulation. The issuer adapter and CLI passed renewal and revocation against an isolated in-memory CA using the lab's issuer recipe; the retained lab still uses its existing Compose PKI job. The broader Saturday site/page/flow suite and native Linux validation remain open. See [completion 05](completion/05-saturday-keycloak-package.md).

## Purpose and boundary

Create `packages/saturday-keycloak` here, with an upstream-ready package name such as `@orieken/saturday-keycloak` once ownership/naming is verified. Do not publish it during this prototype. It coordinates Keycloak test identities, certificate material, and runner adapters without depending on magic-shop pages, application roles, Docker Compose service names, or hardcoded origins.

Use Saturday as installed packages. The local checkout already contains `@orieken/saturday-core`, `@orieken/saturday-playwright`, `@orieken/saturday-cucumber`, `@orieken/saturday-playwright-certs`, and Leaflet support. Verify available versions and compatibility before assuming they are published. If an intended version is unavailable, build a versioned tarball from a recorded source revision inside a build container and vendor the tarball/provenance, not another nested copy of Saturday's source packages.

## Reuse versus new work

The existing certificate package provides PEM path helpers, Chrome/Edge project generation, basic file-existence fixtures, and artifact metadata. Its `createCertProject` helper currently assumes one origin and three named identities (`admin`, `user`, `unauthorized`). Its fixtures do not provision Keycloak or issue certificates. Reuse lower-level helpers where appropriate and add a local adapter supporting arbitrary identities and multiple origins. Do not modify the Saturday checkout as part of this plan.

Separate responsibilities inside the new package:

| Module/export | Responsibility | Dependency rule |
| --- | --- | --- |
| Core identity/config types | Validate identities, exact origins, paths, lifetimes, metadata | No Playwright/Cucumber import |
| `CertificateProvider` port | Resolve, inspect, issue/renew/revoke via an explicit provider | No implicit host trust changes; provisioning is opt-in |
| Filesystem provider | Read existing runtime-mounted credentials and safe public metadata | Reject missing keys, mismatches, unsafe paths and unreadable files |
| PKI command adapter | Invoke the container's installed issuer helper with structured arguments | No shell interpolation; never execute merely on import |
| Keycloak admin adapter | Idempotent test realm/client/user/role mapping and cleanup | Explicit operator capability and namespace required |
| Token client | Confidential service token acquisition with timeout/caching | Audience/scope aware; secrets supplied by file/provider |
| Playwright adapter | Context certificate options and fixtures composed with Saturday | Peer dependency on compatible Playwright/Saturday |
| Cucumber adapter | Scenario identity configuration and context lifecycle hooks | Reuses common options; no duplicate issuer logic |
| Manual-browser manifest | Selected cert bundle, trust paths, exact-origin policy inputs | Browser installation remains a runner concern |
| CLI | Explicit inspect/provision/renew/revoke/bootstrap commands | Clear exit codes; public metadata output only |

Proposed public concepts (names can change after tests):

```ts
type IdentityRef = { namespace: string; name: string };
type BrowserChannel = 'chrome' | 'msedge';
type CertificateMaterial = {
  certPath: string;
  keyPath: string;
  pfxPath?: string;
  passphraseFile?: string;
  serial: string;
  fingerprint: string;
  expiresAt: string;
};
type AuthenticationTarget = {
  shopOrigin: string;
  authOrigin: string;
  issuer: string;
  realm: string;
};
```

Prefer returning file references and serializable public metadata to returning private-key bytes. Different trust domains may have distinct trust files. Browser client-certificate options must include both exact origins, including ports; a redirect to the auth origin must not drop the identity.

The fixture reads a declared test identity rather than parsing role names from the project title. One browser context equals one identity. Browser storageState alone is insufficient: each authenticated context still needs the appropriate certificate. Contexts and API clients close on failure as well as success.

Also expose reusable certificate/token options for isolated Playwright API request contexts used by the [OpenAPI contract suite](api-contracts.md). Support public user identities and explicitly provisioned private service identities without launching a browser. OpenAPI loading, schema validation and business operation coverage belong to the testing layer, not this authentication package.

## Proposed directory structure

```text
packages/saturday-keycloak/
  src/core/
  src/certificates/
  src/keycloak/
  src/adapters/playwright/
  src/adapters/cucumber/
  src/manual/
  src/cli/
  tests/unit/
  tests/integration/
  examples/
  README.md
  package.json
```

Provide typed exports for the core, `/playwright`, `/cucumber`, and `/cli`. Loading core exports must not load Cucumber or start a browser. Generate declarations and choose ESM/CJS support to match the verified Saturday packages. Keep the monorepo's strict TypeScript and pnpm conventions.

## Required validation

- Unit tests for exact-origin mapping, certificate inspection, unknown identity, path traversal, key/cert mismatch, missing files, expiry, configuration, metadata redaction, and namespace-scoped cleanup.
- Integration tests against the actual local Keycloak/CA for idempotent setup, existing-user mapping, duplicate identity prevention, token audience/scopes, renewal and revocation.
- Do not generate a token by inventing a signature or bypassing the certificate login in acceptance tests. Programmatic token helpers are appropriate for explicitly labeled service/API tests.
- Pack and install into an independent consumer fixture with no workspace links. Run a minimal Playwright consumer and a minimal Cucumber consumer using the same generic identity config.
- Verify no magic-shop strings, absolute developer paths, private keys, generated certs, session state, or bootstrap secrets enter the published file list.
- Document required peer versions based on exercised features. Existing cert package peer ranges are broader than some certificate capabilities; a declared peer range alone does not establish compatibility.

## Deferred upstream work

Keep a short upstream proposal identifying generic certificate improvements versus Keycloak-specific adapters. Do not fork the complete certificate package or request upstream changes merely to unblock the prototype. Publishing, moving code into Saturday, and changing its release workflow are separate future actions.
