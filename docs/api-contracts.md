# OpenAPI and Playwright contract tests

Status: three canonical OpenAPI 3.1.0 documents and shared schemas are authored. A locked Redocly/openapi-typescript toolchain produces expected bundles, digests and TypeScript declarations; six browserless Playwright validator tests pass, including one-byte deployed-spec drift rejection. Go implements six catalog operations, Node ten customer operations and Python seven insights operations. All package authenticated resolved specs and pass live Playwright provider contracts; `./lab test --runner playwright --suite contracts` passed 17 tests and the full 23-operation/status gate on Apple Silicon emulation. This adds detail to the [test plan](test-plan.md).

The [domain and contract design](domain-contract-design.md) records vocabulary,
ownership and role/scope rationale. The [three authored YAML
specifications](../contracts/openapi/README.md) are now canonical.

## One contract per service

Canonical inputs authored during prompt 02:

```text
contracts/openapi/
  catalog.yaml
  customer.yaml
  insights.yaml
  shared/                 # referenced error, pagination and other shared schemas
```

OpenAPI 3.1.0 is the initial compatibility target. Redocly CLI 2.58.1 and openapi-typescript 7.13.0 are exact workspace dependencies in `pnpm-lock.yaml`; Ajv 8.20.0 and ajv-formats 3.0.1 validate JSON Schema 2020-12 response bodies. Generated bundles, declarations and SHA-256 digests are checked for drift, and generated declarations compile under strict TypeScript. Unit cases prove required fields, unknown fields, status/media type, tuple bounds and UTC pattern failures. This is a deliberate baseline, not a claim that it is the latest release. The [OpenAPI specification](https://spec.openapis.org/oas/v3.1.0.html) defines the document and security semantics.

Each operation defines a stable `operationId`, method/path, parameters and serialization, request media type/schema, explicit success/error statuses, response headers/media types/schemas, and security requirements. Include all business endpoints, including internal catalog quotes and reporting feeds. Document health/readiness/spec-serving endpoints in a separate operational inventory if excluded from business coverage; do not silently exclude application routes.

Specify required versus optional fields, nullability, format validation, enums, numeric/string bounds, unknown-field policy, pagination, idempotency, integer money and UTC timestamps. Preserve a common structured error format. Do not use an unconstrained object or broad default response to conceal unspecified behavior.

Describe the public gateway server and private service server distinctly. Internal operations override the server/visibility metadata and are never published through HAProxy. The gateway-facing contract requires a user certificate plus user bearer token; internal operations require the appropriate service certificate plus service token. Put both schemes in the **same security requirement object** to express AND; separate objects express alternatives. Role, audience, caller-identity pairing and ownership rules need descriptions/test metadata and behavioral tests as well as schema validation.

## How services use the specifications

- Author/review the canonical contract before implementing an endpoint. Generate transport DTOs, request validators and/or server interfaces where the selected tool supports them; keep generated transport code at the adapter boundary.
- Node, Go and Python each validate requests against the contract and produce conforming responses. If a framework produces OpenAPI from code, compare its normalized output with the canonical input; it must not become an independent source of truth. Handwritten schemas require an explicit equivalence check, not just a promise to keep them synchronized.
- Package the resolved contract artifact and its digest with each service image. Make it available at an authenticated internal `/openapi.json` endpoint. Retrieval must use an allowed identity; do not add a public unauthenticated bypass merely for tests.
- Tests load the repository's expected contract artifact, not only the running service's own document. Compare the deployed artifact's digest with the expected bundle before testing. A service must not be able to change both its implementation and its self-reported schema and still pass against an older expected contract.
- Pin bundling and code generation; CI fails on invalid references, invalid examples, stale generated artifacts or unexplained differences. Compare proposed API changes with the recorded base revision to flag breaking changes; the first revision establishes the baseline.

## Dedicated Playwright suite

`testing/api/contracts/` contains `catalog.contract.spec.ts`, `customer.contract.spec.ts`, `insights.contract.spec.ts`, shared validator/fixtures and a 23-operation coverage manifest. All three run live. The `contracts-validator` Playwright project runs offline schema tests; the separate `contracts` project runs browserless live HTTP checks. [Playwright API testing](https://playwright.dev/docs/api-testing) supplies HTTP request contexts. The Ajv-backed validator reads repository-expected bundles and rejects unsupported references, status/media/header/body drift and malformed schema data without coercion.

Use isolated `APIRequestContext` instances with exact-origin client certificates, server CA trust, per-identity bearer tokens and explicit timeouts. Dispose of contexts after tests. Public operations go through HAProxy with a user certificate/token; internal operations use a private service origin and the correct service certificate/token. The test job receives only its declared credential fixtures. Playwright supports client-certificate configuration on [API request contexts](https://playwright.dev/docs/api/class-apirequest).

`createContractContext` enforces exact-origin certificate paths, bearer input,
10-second request timeout and `ignoreHTTPSErrors: false`. The catalog contract
runner mounts only its declared customer, admin and Node caller credentials and
public trust, obtains user tokens by certificate-only PKCE and a scoped private
service token through the local package, and disposes every request context.
Catalog, customer and insights success/error bodies, headers, deployed digests,
pagination, pricing, ownership, idempotency, historical-region aggregation and
authorization are checked live. The contract job mounts the second customer and
Python service identities for isolation and private reporting. Python's
authenticated private artifact is compared with the repository digest.

Reuse the local Keycloak package for identity/token setup. Reuse the established API fixture, client and matcher abstractions where compatible, backed by Playwright HTTP requests. Any Zod transport schemas must be derived from or checked against OpenAPI; they must not replace it with a second handwritten contract. Evaluate `@orieken/saturday-swagger` for scaffolding after verifying its actual OpenAPI 3.1 capabilities; generated example tests alone are not contract validation.

For every operation:

1. Prepare a deterministic valid fixture, validate its request against the expected operation, then call the real service.
2. Assert the scenario's exact expected status, documented headers and media type, then validate the untouched response body against the matching schema. Do not coerce types, strip unknown fields or fill defaults to make responses pass. Handle bodyless statuses explicitly.
3. Assert useful domain semantics separately: ownership, pricing, pagination, idempotency and regional totals are not proved by JSON shape alone.
4. Exercise applicable invalid inputs and authorization errors; assert the specified status and error schema. Intentionally invalid requests bypass client-side prevalidation so the service itself is tested. TLS handshake failures remain transport tests, not JSON/HTTP response tests.
5. Record coverage by `operationId`, scenario and response status. Require a successful scenario for every operation plus applicable input/auth failures; list any deferred rare responses with an explicit rationale. An untested new operation fails the coverage gate.

Prove the validator catches deliberately malformed sample responses (missing required field, wrong type, unexpected status/media type) and does not silently skip unsupported schema keywords or unresolved references. This is a check of the test harness, not a substitute for exercising all three live services.

These are provider conformance tests against OpenAPI, not a separate consumer-driven contract broker. Keep hand-authored business assertions alongside generated schema checks. No mock API should substitute for the running provider in this suite.

## Execution and CI

Target command to implement: `./lab test --runner playwright --suite contracts`. Run inside the existing testing container. Browserless contracts run once per API build; they are not repeated under Chrome/Edge projects. The separate UI suites retain both real browser channels and Cucumber/Playwright examples.

CI order: lint/bundle specs and check generated output, detect breaking changes, start healthy services, verify deployed contract digests, run Playwright contracts, then run browser acceptance suites. A contract failure blocks a passing build. Export safe Playwright HTML/JUnit and an operation/status coverage report with service/spec versions; exclude tokens, private keys and unfiltered request dumps.

Acceptance: all three APIs have reviewed specs, their deployed contract artifacts match the expected versions, each operation has required coverage, and deliberate schema violations cause the harness to fail. Add service-specific contract tests during prompts 06–08 rather than deferring all contract testing to prompt 11.

The certificate + password lesson adds no business operation or password endpoint.
Keycloak owns its form. Business providers retain the `shop-spa` authorized-party
allowlist and existing certificate/token identity comparison. Lesson tokens are
not accepted as business API credentials; completion 15 records that boundary.
