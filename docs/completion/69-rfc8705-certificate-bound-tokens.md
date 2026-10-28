# RFC 8705 certificate-bound token acceptance

Validated locally on 2026-10-27 (America/Chicago). This is controlled Keycloak 26.4.0 and local Docker evidence, not native CI or general provider certification.

## Contract and implementation

The dedicated `shop-spa-rfc8705` public client enables Keycloak's `tls.client.certificate.bound.access.tokens` setting. It retains real certificate login, authorization code flow with PKCE, exact callbacks, identity mapping and the three API audiences. Bootstrap creates the client for existing disposable realms when absent and checks the binding flag, flow, PKCE and origin settings rather than silently accepting configuration drift. The default `shop-spa` client retains its existing behavior.

[HAProxy](../../infra/haproxy/haproxy.cfg) replaces caller-supplied `X-Cert-Thumbprint` with standard-base64 SHA-256 of the verified TLS client leaf's DER. The [Go](../../services/catalog-api/internal/auth/verifier.go), [Node](../../services/customer-api/src/auth.ts) and [Python](../../services/insights-api/server.py) APIs compare the forwarded value to the signed token's canonical base64url `cnf.x5t#S256`, after authenticating the gateway over service mTLS and verifying the JWT. The dedicated client requires confirmation; any present confirmation on an original-client user token is also enforced. Missing/malformed binding or a mismatch returns 401. Existing identity and capability checks still apply.

The dedicated [Compose overlay](../../infra/rfc8705.compose.yaml) exposes only a second valid admin leaf and the original admin leaf to the test runner. The PKI `binding-pair` action requires an isolated-fixture flag and writes a separately keyed certificate with the same CN to an owned private volume. CA signing keys stay in the issuer. The added output directory is owned by the issuer's existing UID. During validation this image was rebuilt after the ownership adjustment and before issuing the second leaf; normal startup builds that final image automatically.

Primary references: [RFC 8705 sections 3, 4 and 6.5](https://www.rfc-editor.org/rfc/rfc8705.html) and the [pinned Keycloak setting](https://github.com/keycloak/keycloak/blob/26.4.0/server-spi-private/src/main/java/org/keycloak/protocol/oidc/OIDCConfigAttributes.java).

## Observed workflow

```sh
LAB_PROJECT=magic-shop-mtls-rfc8705-20261027-01 sh testing/run-oidc-mtls.sh rfc8705
```

The workflow exited **0**. Docker socket access required sandbox escalation.

- Verified transport controls passed: valid customer mTLS before/after missing certificate, wrong CA and wrong hostname rejections.
- Real Chrome customer certificate login passed matching-state authorization, PKCE, real-provider signature, identity, audience, role and lifetime checks.
- **12/12 existing API security tests passed.**
- **3/3 dedicated RFC 8705 request-context tests passed** in [binding.spec.mjs](../../testing/rfc8705/binding.spec.mjs):
  - Independently verified real-provider signature and matching `cnf.x5t#S256`, with HTTP 200 on catalog/customer/insights using the issuing certificate.
  - Two separately valid certificates with the same subject and signed user identity. Both succeed with their own token; cross-presentation in both directions receives HTTP 401 at each API. Spoofing the original fingerprint header still receives 401. Matching controls succeed again after rejection.
  - A real valid bound token without a client certificate cannot pass the shop's TLS gate; matching-certificate controls still succeed.
- Project-labeled containers, networks and volumes, including the extra certificate volume, were absent after teardown.

The temporary local log is `/private/tmp/oidc-rfc8705-workflow.log`; this document retains the durable safe results. Request failures in the new suite suppress raw diagnostics that could contain bearer headers or authorization callback codes. No traces, screenshots or videos are enabled.

All three service builds also passed their unit checks. Node ran **8** tests and Python **14**, including new signed-confirmation tests for match, mismatch, missing/malformed `cnf`, missing/invalid forwarded thumbprints and optional binding on the original client. Go vet and all Go test packages passed, including malformed/missing confirmation and exact-thumbprint authorization checks. Compose configuration, shell syntax, JavaScript/Python syntax and diff whitespace checks passed.

## Limits

This establishes public-client certificate-bound access-token issuance and resource enforcement under RFC 8705, alongside application identity binding. It does not establish OAuth `tls_client_auth`/`self_signed_tls_client_auth`, refresh-token binding/replay semantics, revocation, expiry/renewal orchestration, native OS certificate selection, Edge/Cucumber parity, a full federation matrix, or cloud-provider interoperability. The second same-identity leaf demonstrates certificate substitution and new-leaf token acquisition; no existing leaf is revoked or replaced. Failure/interruption cleanup was not fault-injected in this run.
