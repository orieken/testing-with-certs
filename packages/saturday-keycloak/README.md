# Saturday Keycloak prototype package

This private ESM package connects selected certificate identities to Keycloak test
flows. It has no shop-specific roles, origins, pages or Compose names. It is not
published. Saturday's certificate helper is an optional peer; its recorded
source tarball and LICENSE/NOTICE stay separate from this package.

The root export provides `IdentityRef`, `FileCertificateProvider`,
`PkiCommandAdapter`, `ServiceTokenClient`, and `KeycloakAdminAdapter`. The
`/playwright` export creates exact-origin context and API request options and a
Playwright Test fixture. `/cucumber` installs hooks on a consumer-installed
Saturday World without installing Saturday's default context hook. `/manual`
returns a selected-user manifest for Chrome/Edge native certificate setup;
the runner performs the installation. `/cli` requires an explicit absolute
configuration path and operation. Core imports do not load either test runner.

A consumer maps an identity such as `{ namespace: 'test', name: 'customer-a' }`
to a selected-user volume's `cert.pem` and `key.pem`. The same resolver can
supply exact origins such as `https://store.example.test:8443` and
`https://identity.example.test:9443`. Origins and identities belong to consumer
configuration. Both runner adapters have been exercised through a real
Keycloak redirect in installed Chrome and Edge with server validation enabled.

Provision, renew, revoke and cleanup are explicit operator actions. The PKI
adapter spawns a configured container executable with structured arguments and
requires a capability file. The Keycloak admin adapter requires a token file,
uses bounded calls, refuses to overwrite an existing certificate identity and
deletes only users bearing the configured namespace prefix. The service-token
helper checks returned audience/scope/expiry for caller mistakes but does not
verify the JWT signature; receiving APIs must do that. No token or private key
is written to package metadata or test artifacts.

`pnpm build` emits ESM and declarations under `dist`. Unit tests compile
separately under `dist-tests`, excluded from the packed file set. The package
is developed and packed inside containers. A clean packed installation is
checked by `Consumer.Containerfile`; no workspace links are used there.

This prototype currently pins Playwright Test 1.61.0 and Cucumber 12.9.0.
The earlier Cucumber 11.3.0 integration was exercised with Chrome
154.0.8037.97 and Edge 154.0.4258.62 on Apple Silicon amd64 emulation;
the refreshed runner and independent packed consumer pass with Cucumber 12.9.0.
The Saturday certificate-helper peer uses the recorded local 0.1.0 tarball;
Saturday Cucumber uses 0.1.1. Native Linux validation of this update is pending.
