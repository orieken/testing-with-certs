# Project terminology dictionary

Use this dictionary when you write or revise project documentation.
Use the preferred term for the stated meaning. Explain a technical term at its first use.
Preserve exact names in commands, contracts, code, and recorded results.

This dictionary supports our approximate ASD-STE100 writing target.
It does not replace the official ASD-STE100 dictionary or certify compliance.
Use the [writing guide](writing-guide.md) with this dictionary.

## Sources and authority

The [domain and contract design](domain-contract-design.md#domain-dictionary-and-ownership)
defines business ownership and invariants. Its original design statements retain their historical context.
The [canonical OpenAPI contracts](../contracts/openapi/README.md) define API requests and responses.
The [authentication document](authentication.md) defines the identity and access boundaries.
The [completion notes](completion/) record observed results and limitations.

This dictionary supplies writing terms and plain-language explanations.
It does not change a contract, permission, implementation, or acceptance criterion.
If sources disagree, check the relevant implementation and evidence before you revise the explanation.
Do not change a technical fact to make a sentence simpler.

## Identity and access

| Preferred term | Meaning | Writing rule or example |
| --- | --- | --- |
| Authentication | A check of identity. | “Keycloak checks the user's identity.” Do not use it to mean permission checks. |
| Authorization | A check of the actions an identity can do. | “The API checks permission to change an item.” |
| User identity | The human account identified by Keycloak `sub`. | Use “user” for a human. Do not call a service a user. |
| Certificate identity | The protected user mapping named `cert_identity`, or the specified service certificate identity. | State whether the identity belongs to a user or service. A display name is not an identity key. |
| Service identity | A service client and its certificate identity. | “The customer API uses its service identity to request a quote.” |
| Certificate | A signed record that connects an identity to a public key. | Specify the certificate type when its purpose matters. |
| User certificate | A certificate issued for a human user. | A certificate alone does not grant business API permission. |
| Service certificate | A certificate issued for a service client. | Do not describe it as a human login certificate. |
| Server certificate | A certificate used to check server identity during TLS. | Keep it distinct from client certificates. |
| Certificate authority (CA) | The issuer that signs certificates in its trust domain. | “The lab certificate authority issues user certificates.” Keycloak does not issue these user certificates. |
| Private key | Secret material used to prove control of an identity or create a signature. | Specify “certificate private key” or “token signing key” when the distinction matters. |
| Access token | A signed token that a caller presents for API access. | Use this term instead of the general word “token” in API instructions. |
| ID token | A signed token that tells an OIDC client about an authenticated user. | An ID token is not an API access token. |
| Refresh token | A token used to request new tokens under the configured session rules. | Do not describe it as an access token. |
| Issuer | The identity provider identified by the exact token issuer value. | State the expected issuer when describing validation. |
| Audience | The intended recipient named in a token. | “The catalog API rejects a token for the wrong audience.” |
| Role | A named set of user permissions, such as `shop-admin`. | Shop-admin is not a Keycloak realm administrator. |
| Scope | A named permission carried by a service token. | Preserve exact scope strings from the contract or configuration. |
| TLS | Protection for a network connection, with server identity checks. | Do not say “secure connection” when you need to specify the actual checks. |
| Mutual TLS (mTLS) | TLS that also checks the client certificate. | Explain the abbreviation once. State which connection uses it. |
| TLS passthrough | Routing that passes the TLS connection to the destination without terminating it at the router. | “Keycloak receives the browser certificate directly.” |
| OpenID Connect (OIDC) | The identity protocol used for login and token information. | Keep OIDC distinct from certificate issuance. |
| Proof Key for Code Exchange (PKCE) | A check that connects the code exchange to the client that started authorization. | Preserve `S256` when the exact method matters. |
| JSON Web Token (JWT) | A token format that carries claims. These examples use signed JWTs. | The format alone does not prove a valid signature or permission. |
| JSON Web Key Set (JWKS) | A document that supplies public keys for signature checks. | “The consumer gets signing public keys from the issuer's JWKS.” |
| Certificate-only shop login | The shop flow that requires the user certificate without a password alternative. | Do not describe it as a password login or password fallback. |
| Certificate and password lesson | The separate teaching flow that requires both checks. | Its client, callback, and tokens remain separate from the shop. |

## Business terms

The ownership table remains in [domain and contract design](domain-contract-design.md#domain-dictionary-and-ownership).
Use these explanations when the reader does not need the full invariant.

| Preferred term | Plain-language meaning | Important distinction |
| --- | --- | --- |
| Item | A catalog record for a product in the simulated shop. | An archived item can remain in historical orders. |
| Category | A display group for catalog items. | A category does not grant permission. |
| Customer profile | A customer's editable account record owned by the customer API. | The profile does not own login identity or roles. |
| Current region | The region in the customer's current profile. | It can differ from an order's historical region. |
| Historical region | The region recorded with an order. | Changing a profile does not rewrite this value. |
| Order | A record of simulated checkout owned by the customer API. | An order is not a real payment. |
| Order line | A saved item, price, and quantity within an order. | It is a historical snapshot. |
| Price quote | Current item prices and availability returned by the catalog API. | The browser's total is not the authoritative price. |
| Copper | The integer unit used to store money. | Do not replace integer totals with floating-point currency. |
| Checkout key | The `(owner sub, Idempotency-Key)` pair used to identify a repeated checkout. | The same key with a different payload conflicts. |
| Idempotency | Repeating an equivalent request has no additional business effect under the specified rules. | Do not promise automatic retries or exactly-once network delivery. |
| Widget layout | The saved order of permitted dashboard widgets. | Available widgets depend on the user's role. |
| Reporting page | A bounded page of records with a dataset revision and cursor. | It is not a direct cross-service database query. |
| Cursor | An opaque value used to request another page. | Do not describe it as a page number. |
| Dataset revision | A value that identifies the reporting snapshot. | A report must not mix incompatible revisions. |
| Sales summary | Totals for completed orders in a region and time interval. | Use the orders' historical regions. |
| Half-open interval | A time range that includes `from` and excludes `to`: `[from, to)`. | Keep the endpoint rule explicit. |
| Follow-up | A local customer note and its status. | It does not send email, SMS, or another external message. |

## Tests, tools, and evidence

| Preferred term | Meaning | Writing rule or example |
| --- | --- | --- |
| Application programming interface (API) | An interface that accepts requests and returns results. | Use the exact service name when the distinction matters. |
| Container | An isolated environment that runs a program. | Builds and tests run in containers. |
| Docker volume | Storage that Docker provides to containers. | Specify the named project when discussing cleanup. |
| API contract | The specified API requests and responses. | Use “canonical OpenAPI contract” for the source specification. |
| Consumer | A program that calls a dependency. | State which consumer is under test. |
| Dependency | A program or interface that the consumer uses. | Name the dependency that is replaced or disturbed. |
| Mock | A substitute that supplies controlled dependency behavior in a test. | A mock pass is not real-provider evidence. |
| Fixture | Prepared test input or system state. | Specify valid fixtures and intentionally invalid fault fixtures separately. |
| Fault fixture | Prepared behavior or input used to test a failure. | State the intended fault and expected rejection. |
| Schema validation | A check of data against a schema. | Ajv checks valid canonical fixtures. This does not prove authorization. |
| Live-provider test | A test that calls the actual provider implementation in the lab. | State whether another dependency is replaced. |
| Real-login test | A test that uses actual Keycloak and the configured identity checks. | Synthetic browser authentication cannot supply this evidence. |
| Mock-consumer test | A test of a consumer with a replaced dependency. | Name what is mocked and what remains real. |
| Dependency fault test | A test of a real consumer with a controlled dependency failure. | Its results remain separate from normal live-provider results. |
| Recovery | A successful operation after the tested failure ends. | State whether recovery uses a fresh request. Do not imply an automatic retry. |
| Browser journey | The actions and assertions for one browser scenario. | Specify browser, runner, identity, and environment. |
| Assertion | A check that compares an observed result with an expected result. | A recording does not replace assertions. |
| Recording | A video of visible test steps. | A video alone does not prove hidden API or database checks. |
| Artifact | A generated report or recording retained after a run. | Identify which files can be exported. |
| Continuous integration (CI) | Automated checks for a code change. | Build success does not imply test success. |
| Gate | A required result that must succeed before the combined workflow passes. | Upload success is not a test gate pass. |
| Native Linux evidence | A result observed on a Linux host without host CPU emulation for that run. | Record the actual host and container platform. |
| Local emulation evidence | A result observed locally with a container platform that requires CPU emulation. | Do not label it native Linux evidence. |
| Cleanup | Removal and verification of the named disposable test resources. | Host loss or forced termination can prevent cleanup traps. |
| Known limitation | A recorded behavior that the implementation does not support correctly. | An expected limitation result is not acceptance of the missing behavior. |

## Exact technical names

Keep these spellings: Vue, Keycloak, HAProxy, PostgreSQL, Docker, Docker Compose,
OpenAPI, Ajv, Prism, Mokapi, Playwright Test, Cucumber, Google Chrome, and Microsoft Edge.
Keep code identifiers and path names unchanged, including `cert_identity`, `sub`,
`Idempotency-Key`, `priceCopper`, `regionId`, `from`, and `to`.

Use “customer API” in an introduction. Use `customer-api` when naming the exact service.
Apply the same rule to “catalog API” / `catalog-api` and “insights API” / `insights-api`.
Do not invent a new name for an existing contract field, client, role, or scope.

## Words that need a more precise term

| Avoid when ambiguous | Use instead |
| --- | --- |
| Credentials | Specify password, client secret, access token, private key, or certificate bundle. |
| Token | Specify access token, ID token, refresh token, or service access token. |
| Certificate | Specify user, service, server, or certificate-authority certificate when needed. |
| Login works | State the actual successful flow, identity, browser, and checks. |
| Secure | State verified TLS, certificate validation, signature validation, or permission checks. |
| End-to-end | State the actual request path and any replaced dependencies. |
| Production-ready | State the observed acceptance scope and remaining limitations. |
| Tests passed | Name the suite, environment, count when relevant, and recorded result. |
| Real data | Use synthetic lab records or actual provider responses, as applicable. |
| Sync | State whether records were read, copied, aggregated, or updated. |

## Keep this dictionary current

Before you add a term, check whether an existing term has the same meaning.
Add the preferred term, its definition, and any important distinction together.
Update the related guide when the technical meaning changes.
Retain the original wording in historical logs, quoted errors, and recorded commands.
