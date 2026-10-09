# System and infrastructure workflows

Status: the nine main workflows describe the full-stack design. Prompts 03–10 infrastructure, Keycloak provisioning, local package adapters, all three business providers, the integrated Vue UI and selected-user manual desktop are observed on Apple Silicon amd64 emulation. Prompt 11 shared Saturday customer/admin teaching examples pass in Playwright Test and Cucumber under both real Chrome and Edge; a shopkeeper inventory example passes in Playwright Test under both browsers. Concurrent two-worker customer/admin runs, isolated service-scope and signing-key rotation checks, and the live signed JWT-01 failure matrix passed. Prompt 12's static, live contract, security and eight browser/runner/identity CI-equivalent selections passed locally and in the second native GitHub Linux run. Its credential scan and cleanup passed, but text report upload failed on a file permission and awaits rerun. See [architecture](architecture.md), [authentication](authentication.md), and the [test matrix](test-plan.md) for detailed rules.

Solid arrows describe requests or ordered actions. Dotted arrows in the infrastructure diagram describe credential provisioning/mounts. A box inside a container group is a component or logical database, not an additional container. The shop/auth ports shown are the observed Compose values; the second GitHub Linux workflow passed the test matrix but not artifact upload.

## 1. Containers, routing and persistent storage

The host displays the remote desktop. The actual shop browser and its certificates live in the runner. HAProxy has two listeners in one container: shop traffic terminates there; Keycloak traffic passes through as encrypted TLS.

```mermaid
flowchart TB
  Host["Host: Docker Compose, Go operator and optional loopback viewer"] --> Runner
  Host -->|"trusted Docker control; no service socket mount"| Shop
  subgraph Front["Front network"]
    Runner["Real Chrome or Edge; one selected user in test or manual profile"] -->|"user mTLS shop:8443"| Shop["HAProxy shop termination"]
    Runner -->|"certificate PKCE auth:9443"| Auth["HAProxy auth TLS passthrough"]
    Contracts["Browserless Playwright contracts and security"] --> Shop
  end
  subgraph Private["Private backend and auth networks"]
    Auth --> KC["Certificate-only Keycloak realm"]
    Shop -->|"service mTLS"| UI["Vue shop/admin UI"]
    Shop -->|"paired user token and gateway leaf"| Go["Go catalog API"]
    Shop -->|"paired user token and gateway leaf"| Node["Node customer API"]
    Shop -->|"paired admin token and gateway leaf"| Python["Python insights API"]
    Node -->|"Node leaf and scoped customer-catalog token"| Go
    Python -->|"Python leaf and scoped insights-reporting token"| Node
  end
  subgraph Storage["Isolated volumes and database network"]
    PKI["One-shot PKI, no network"] --> CA[("Signing keys, PKI-only")]
    PKI -.-> Trust[("Public CA roots and CRLs")]
    PKI -.-> User[("Separate user leaves; selected-user alias")]
    PKI -.-> Service[("Separate server and service leaves")]
    SecretJob["One-shot admin and scoped secret jobs"] -.-> Scoped[("Per-consumer secret volumes")]
    DB[("PostgreSQL: four databases and owners")]
    User -.-> Runner
    Trust -.-> Runner
    Trust -.-> Shop
    Trust -.-> KC
    Service -.-> Shop
    Service -.-> KC
    Service -.-> Go
    Service -.-> Node
    Service -.-> Python
    Scoped -.-> KC
    Scoped -.-> Node
    Scoped -.-> Python
  end
  Go -->|"verified DB TLS"| DB
  Node -->|"verified DB TLS"| DB
  Python -->|"verified DB TLS"| DB
  KC -->|"verified DB TLS"| DB
```

The volume nodes summarize separate scoped mounts; they are **not** shared folders exposing all keys to every service. Each runtime gets its own leaf credentials and required public trust. The manual runner gets only the selected user. The browserless contract job mounts two customer certificates, admin, Node and Python caller certificates plus separate scoped token secrets. The separate security job mounts customer, second-customer and shopkeeper leaves only, with no service secrets. No runtime gets CA signing keys. Backend and database ports are not published to the host. Isolated negative-fixture mounts and the bootstrap job appear in the later workflows.

The [canonical OpenAPI contracts](../contracts/openapi/README.md) specify these three private service origins and both internal paths. Go, Node and Python business paths are observed. Python calls Node's bounded reporting feed with its service certificate and scoped token; it never reads Node's database. Prompt 04 directly exercised certificate-only PKCE login and signed token claims with real Chrome and Edge; the Vue shell initiates that flow and holds tokens in memory.

## 2. Startup and user certificate provisioning

Keycloak supplies the user identity and permissions. The local CA supplies the user's certificate. Provisioning is an operator capability, not a public shop endpoint.

```mermaid
flowchart TD
  Start["Operator runs lab up"] --> State{"Existing lab state?"}
  State -->|"No"| Init["PKI job creates trust domains and initial CRLs"]
  State -->|"Yes"| Check["Validate and reuse existing CA state"]
  Init --> InfraCerts["Ensure server and service leaf certificates"]
  Check --> InfraCerts
  InfraCerts --> Issue["Observed Compose PKI issues seed user certificates with stable fixture identities"]
  Issue --> Bundle["Write PEM and PKCS12 to identity-scoped volume"]
  Bundle --> Infra["Start PostgreSQL, HAProxy and Keycloak"]
  Infra --> Health["Wait for health and readiness"]
  Health --> Secrets["One-shot auth-secrets job: separate admin and service secret volumes"]
  Secrets --> Bootstrap["Observed idempotent realm bootstrap: clients, scopes, roles and six seed users"]
  Bootstrap --> Identity["Verify protected unique cert_identity and selected-user certificate mapping"]
  Identity --> Seed["Observed 14 Go items, six Node profiles, nine seed orders and four local Python GeoJSON regions"]
  Seed --> Ready["UI and three APIs ready"]
  Ready --> Mode{"Runner mode?"}
  Mode -->|"Automated"| Context["Observed local package resolves selected cert for both exact origins"]
  Mode -->|"Manual"| Install["Import one user certificate into fresh browser HOME"]
  Context --> Login["Open shop and authenticate through Keycloak"]
  Install --> Login
```

Each dependency waits on a concrete readiness or completed-job result, not a fixed sleep. An already valid user certificate is reused; issuance/renewal does not occur blindly on every startup. Reset remains a separate explicit project-scoped operation.

The seed files and [independent reporting oracle](../seed/README.md) pass an offline container check. The Keycloak realm, users and service clients are **observed** after repeat startup. Go's 14 catalog items persist in `catalog_db`; Node's six profiles and nine initial orders persist in `customer_db`. Python packages four local GeoJSON regions and stores follow-up records in `insights_db`; a restart retained four contract-created notes.

## 3. Certificate login and authorized API access

The browser proves certificate possession twice: to the shop gateway and directly to Keycloak through the tunnel. The resulting user token carries permissions; the APIs also ensure that token identity matches the gateway's verified certificate identity.

```mermaid
sequenceDiagram
  autonumber
  participant B as Chrome or Edge with selected certificate
  participant H as HAProxy shop listener
  participant U as Vue sign-in shell
  participant T as HAProxy auth TLS tunnel
  participant K as Keycloak
  participant A as Business API
  B->>H: TLS connection with user certificate
  alt Missing, untrusted, expired or revoked certificate
    H--xB: Reject TLS connection before serving application
  else Certificate passes gateway validation
    H->>U: Fetch UI assets over service mTLS
    U-->>B: Vue shell via HAProxy with Sign in with certificate
    B->>T: OIDC authorization request with PKCE challenge
    T->>K: Tunnel browser TLS including user certificate
    Note over B,K: TLS terminates at Keycloak, not at the auth listener
    K->>K: Check user issuer, certificate, enabled user and identity mapping
    alt No valid mapped user or certificate flow fails
      K-->>B: Observed disabled and unmapped-user denial with no code or password fallback
      Note over B,U: Observed no signed-in identity or business API request in Chrome and Edge
    else Certificate user authenticated
      K-->>B: Redirect to exact shop callback with authorization code
      B->>T: Exchange code with PKCE verifier
      T->>K: Tunnel token request
      K-->>B: Access and refresh tokens via tunnel
      Note over K,A: Observed isolated rotation: new Keycloak RS256 kid triggers JWKS refresh in Go, Node and Python
      Note over B,K: Observed through Vue in real Chrome and Edge with Go and Node authorization
      Note over B: Vue holds tokens in memory and displays selected role
      B->>H: Observed catalog/customer/insights API requests
      H->>H: Strip supplied identity headers and set verified cert identity
      H->>A: Service mTLS, user token and verified identity header
      A->>A: Validate gateway caller, JWT, identity match and permissions
      alt Authorized for requested resource
        A-->>B: Scoped result via HAProxy
      else Invalid token, identity mismatch or insufficient access
        A-->>B: Rejection via HAProxy
      end
    end
  end
```

Return arrows abbreviate the proxy path; they do not imply direct backend access. Cached Keycloak cookies cannot substitute for the required certificate identity. A trusted certificate for an unknown/disabled user can load the non-sensitive UI shell, but cannot obtain authenticated business data.

## 4. Checkout and service-to-service authentication

The user's token authorizes creating their order. A different token identifies Node when it requests authoritative prices from Go. The browser never receives that service token.

```mermaid
sequenceDiagram
  autonumber
  participant B as Customer browser
  participant H as HAProxy
  participant N as Node customer API
  participant K as Keycloak through auth tunnel
  participant G as Go catalog API
  participant D as Customer database
  B->>H: Observed item IDs, quantities and idempotency key with user token
  H->>N: Observed service mTLS plus user token and verified certificate identity
  N->>N: Validate token pairing, ownership, input and prior idempotency result
  N->>K: Client credentials with scoped secret over verified TLS and no service cert requested
  K-->>N: Token with catalog audience and quote scope
  N->>G: Observed private batch quote over Node mTLS with service token
  G->>G: Check caller, token client, audience and scope
  G-->>N: Validated items and authoritative prices
  N->>D: Atomically persist completed order, immutable lines and idempotency hash
  D-->>N: Stored order or matching previous result
  N-->>B: Own order confirmation via HAProxy
```

Any failed transport or token check stops the call before business processing. Node does not forward its user's token as its service identity, and it does not accept browser-supplied prices. This is simulated checkout without real payment or atomic stock reservation.

An isolated Prompt 11 fixture removed `catalog.quote` from the default scopes of the `customer-catalog` client. Keycloak then issued a correctly signed, correctly addressed token without that scope; the same Node service certificate and catalog quote request changed from HTTP 200 to 403. The fixture never ran against the retained realm.

## 5. Regional sales, users and follow-up workflow

The Vue customer and administrator screens call the public catalog, customer and insights paths through the shop origin with bearer tokens. Shop search/details, cart/checkout, account/orders/widgets, inventory maintenance, admin lists, regional sales/map and local follow-up controls are implemented. All three providers pass live Playwright contracts. Both Chrome and Edge passed customer checkout/widget and admin reporting/follow-up journeys. Admin region selection reloads the same region across sales, customer/order tables and follow-up list.

```mermaid
flowchart LR
  B[Observed Vue shop/account/admin screens] -->|observed bearer + shop mTLS /api/catalog/*| H[HAProxy shop origin :8443]
  B -->|observed bearer + shop mTLS /api/customer/*| H
  B -->|observed bearer + shop mTLS /api/insights/*| H
  H -->|observed authorized catalog responses| G[Go catalog provider]
  H -->|observed authorized customer responses| N[Node customer provider]
  H -->|observed admin-only insights responses| P[Python insights provider]
  G -->|observed OpenAPI-backed catalog responses| B
  N -->|observed OpenAPI-backed customer responses| B
  P -->|observed OpenAPI-backed reports and follow-ups| B
```

Python checks the requesting administrator before using its own reporting credentials. Region membership comes from historical orders, which can differ from a customer's current address.

```mermaid
flowchart TD
  Admin["Admin selects region and date range on map or table"] --> Edge["HAProxy checks user certificate and forwards token over service mTLS"]
  Edge --> Verify["Python validates gateway, user token and certificate identity"]
  Verify --> Allowed{"Admin permission?"}
  Allowed -->|"No"| Deny["Deny without fetching report data"]
  Allowed -->|"Yes"| Token["Obtain or reuse Python reporting service token"]
  Token --> Feed["Observed Python call to Node reporting feed with Python mTLS and token"]
  Feed --> Pair["Observed Node caller/token pairing, audience and scope"]
  MissingScope["Observed isolated signed token: correct Python caller and audience, no reporting.read"] --> Pair
  Pair --> Scope{"Required reporting.read?"}
  Scope -->|"No: observed 403"| ScopeDenied["Reject before reporting data"]
  Scope -->|"Yes: observed 200"| Pages["Observed bounded pages and revision conflict response"]
  Pages --> Compute["Observed bounded aggregation of completed orders by historical region and UTC interval"]
  Compute --> Unique["Deduplicate customers who ordered in that region"]
  Unique --> Result["Return sales, users, orders and map data via HAProxy"]
  Result --> Render["Observed Vue selection refreshes sales, map, customer/order tables and follow-ups"]
  Render --> Note["Admin creates a note or updates local follow-up status"]
  Note --> Recheck["Observed Python reauthorization of POST/PATCH and persistence in insights database"]
  Render -->|"Select another region in Chrome or Edge"| Admin
```

No cross-service database reads or external messages occur. A changing dataset revision produces explicit retriable HTTP 409 rather than mixed totals; the synchronous aggregation caps input at 10,000 orders. The add/remove-widget action follows the user's authenticated API path to Node and persists only that user's permitted widget layout.
The reporting missing-scope check likewise used a disposable realm and the correct Python service certificate; a normal token returned HTTP 200 before its default scope was removed, and a newly issued token without `reporting.read` returned 403.

## 6. Automated tests and selected-user manual mode

Both modes use the same container image and authentication configuration, but differ in how the browser selects its certificate. Native installation is exercised by manual mode; automated tests use Playwright's context certificate support. Prompt 04 also ran headed native-store PKCE checks in both Chrome and Edge without context certificates, against the Compose realm.

```mermaid
flowchart TD
  Operator["Operator or Linux CI selects mode and identity"] --> Config["Observed package file provider resolves selected identity"]
  Config --> Origins["Observed mapping to exact shop:8443 and auth:9443 origins"]
  Origins --> Mode{"Mode?"}
  Mode -->|"Manual: lab manual --user --browser"| Home["Fresh container HOME; mount one user's bundle"]
  Home --> Manifest["Observed package manifest: selected bundle, trust and exact origins"]
  Manifest --> Import["Import identity into native browser certificate store"]
  Import --> Policy["Apply narrow certificate-selection policy for both lab origins"]
  Policy --> Desktop["Start Xvfb, desktop and protected noVNC"]
  Desktop --> ManualBrowser["Launch selected actual Chrome or Edge"]
  ManualBrowser --> Human["Human uses host loopback viewer to operate remote browser"]
  Human --> RealLogin["Real certificate login and app interactions"]
  Human --> Stop["lab manual stop removes container and ephemeral HOME/profile"]
  Mode -->|"Automated"| Fixtures["Observed shared package resolver and exact-origin identity fixtures"]
  Mode -->|"Isolated negative matrix"| NegativeRunner["Observed browserless user-validity and service-leaf runners; one negative leaf per job, public trust, scoped secret only where needed"]
  NegativeRunner --> NegativeTLS["Observed fresh TLS rejection or no authorization code; no browser profile or host trust change"]
  Mode -->|"Isolated user CRL timing"| TimedCRL["Observed selected customer leaf and public trust in disposable project"]
  TimedCRL --> TimedResult["Observed shop rejection by 31.4 s and Keycloak no-code by 31.9 s after publication/reload"]
  Mode -->|"Isolated service-scope matrix"| ScopeAdmin["Observed admin-only fixture removes one default grant in disposable Keycloak realm"]
  ScopeAdmin --> ScopeRunner["Observed separate Node/Python caller runners; each has one leaf, matching service secret and public trust"]
  ScopeRunner --> ScopeResult["Observed signed correct-caller/audience tokens: normal 200, missing required scope 403"]
  Mode -->|"Isolated signing-key matrix"| KeyAdmin["Observed admin-only fixture adds a higher-priority generated RSA provider in disposable realm"]
  KeyAdmin --> KeyRunner["Observed selected shop-admin certificate and public trust only"]
  KeyRunner --> KeyResult["Observed original and new signed tokens accepted by all three long-running APIs after JWKS refresh"]
  Mode -->|"Isolated JWT-01 signed-claim matrix"| ClaimAdmin["Observed admin-only fixture imports temporary RSA signer into disposable Keycloak realm"]
  ClaimAdmin --> ClaimRunner["Observed separate shop-admin runner receives private signer volume and selected certificate"]
  ClaimRunner --> ClaimResult["Observed Go/Node/Python 200 baseline and 401 for nine negative variants through strict TLS"]
  Fixtures --> Runner{"Test runner?"}
  Runner -->|"Playwright Test; bounded 1–4 workers"| PW["Observed package fixture in Chrome and Edge; concurrent two-worker jobs passed"]
  Runner -->|"Cucumber"| BDD["Observed package hooks with Saturday World in Chrome and Edge"]
  PW --> Site["Observed shared Saturday site/page/element/login flow: order, widget, region, map and shopkeeper inventory"]
  BDD --> Site
  PW --> Offline["Observed MAP-01: local Locations layers and markers while offline; allowed and denied geolocation in separate contexts"]
  Offline --> Evidence
  PW --> Context["Observed fresh Chrome or Edge context with exact-origin client certificates"]
  BDD --> Context
  Site -.-> Context
  Context --> RealLogin
  RealLogin --> Evidence["Assertions or manual observations"]
  Evidence --> Reports["Observed unique per-run HTML/JUnit/WebM or Cucumber JSON/JUnit/telemetry; simultaneous job isolation passed"]
  Reports --> Scan["Observed container credential-artifact scan"]
  Scan --> Cleanup["Close browser and remove ephemeral session state"]
```

The package manifest drives selected PKCS12 import and exact-origin Chrome and Edge policy generation in the manual runner. Prompt 10 verified one selected identity mount, the loaded native store and brand policy in each browser, and a fresh HOME after switching customer Chrome to admin Edge. A mismatched mounted certificate now fails before browser launch. Both native-store Vue sign-in paths passed in headed checks without injected state. The loopback viewer requires a one-session VNC password; `lab manual stop` removes the container profile while retaining issued certificate volumes. A human later confirmed `shop-admin` in the current Edge viewer and `customer-waterdeep` in the recreated Chrome viewer. No certificate was installed on the host; a read-only before/after trust audit also found unchanged macOS keychain/trust fingerprints. Native Linux amd64 remains unverified.

## 7. Renewal, revocation and existing sessions

Renewal and revocation are separate operations. Revocation affects new TLS handshakes after publication/reload; existing connections and already issued tokens have separate lifetimes.

```mermaid
flowchart TD
  Operator["Operator selects user and certificate operation"] --> Action{"Operation?"}
  Operator -.-> Package["Observed local package CLI: explicit capability and structured issuer command"]
  Package -.->|"Observed in isolated CA; retained lab still uses Compose PKI"| Action
  Action -->|"Renew"| Renew["Issue new key and serial for same protected identity"]
  Renew --> Install["Update selected-user bundle and recreate browser session"]
  Install --> TestNew["Verify new certificate logs in as same user"]
  TestNew --> Retire{"Retire old certificate now?"}
  Retire -->|"Yes"| Revoke["Mark selected old serial revoked in issuer state"]
  Retire -->|"No"| Overlap["Record bounded overlap until expiry or later revocation"]
  Action -->|"Revoke"| Revoke
  Action -->|"Isolated service revoke"| ServiceRevoke["Observed: revoke customer-to-catalog leaf in separate Compose project"]
  ServiceRevoke --> ServiceCRL["Publish service CRL and recreate catalog TLS consumer"]
  ServiceCRL --> ServiceFresh["Observed fresh connection rejects revoked caller despite valid scoped token"]
  Action -->|"Isolated negative validity fixture"| Dated["Observed: user/service CA signs expired or future leaf into Docker-only volume"]
  Dated --> DatedProbe["Observed: shop or catalog TLS rejects; Keycloak gives no code for invalid user leaf"]
  Revoke --> Publish["Publish CRL and reload enforcing components"]
  Publish --> Fresh["Open fresh TLS connection and clear browser sessions"]
  Fresh --> Denied["Observed isolated user CRL: shop rejection by 31.4 s, Keycloak no-code by 31.9 s; 60 s target"]
  Publish --> Existing["Existing connections and tokens may still be active"]
  Existing --> Policy["Drain connections for immediate lab demonstration; apply token TTL policy"]
  Policy --> Verify["Measure residual access rather than claiming instant invalidation"]
```

The package issuer adapter and CLI passed provision, renewal, CRL publication and revoked-leaf rejection against an isolated in-memory CA. The retained lab still invokes its existing Compose PKI job for operational lifecycle changes. Observed Prompt 04: renewal retained the protected identity; after CRL publication and explicit HAProxy/Keycloak reload, a new shop TLS connection rejected the revoked certificate and Keycloak issued no code. An earlier isolated run measured shop rejection by 45 seconds without separately timing Keycloak. A later disposable Prompt 11 run measured fresh shop rejection by 31.4 seconds and Keycloak no-code denial by 31.9 seconds from CRL publication completion, including reload and health checks; both met the 60-second target. Prompt 11 also rejected a revoked service leaf and expired/future user and service leaves. Account disable terminated a Keycloak session and rejected refresh and fresh login. An already issued access token had at most 120 seconds remaining. These are Apple Silicon amd64-emulation results, not a native Linux timing bound. Account disable is not interchangeable with revoking a specific certificate. See [revocation expectations](authentication.md#revocation-and-lifetime-expectations).

## 8. OpenAPI implementation and Playwright contract gate

The three canonical specifications pass pinned OpenAPI 3.1 lint, reference
bundling, type generation and offline validator tests. Go, Node and Python
provider responses pass live Playwright contracts and the full 23-operation
coverage gate on Apple Silicon emulation. See [API contract requirements](api-contracts.md).

```mermaid
flowchart TD
  Specs["Authored OpenAPI: catalog, customer and insights"] --> Lint["Observed: pinned lint, bundle, type generation, offline validator tests"]
  Lint --> Change["Observed comparator unit tests and same-bundle check; planned PR base-revision gate"]
  Change --> Transport["Generate or equivalence-check transport types and validators"]
  Transport --> Services["Observed Go/Node/Python images with versioned specs"]
  Services --> Ready["Start healthy providers in isolated Compose project"]
  Specs --> Expected["Observed: bundles, digests and all 23 operations live"]
  Expected --> Suite["Browserless Playwright contracts project"]
  Ready --> Suite
  Auth["Selected user or service certificate and matching token"] --> Suite
  Suite --> Public["Public operations through HAProxy"]
  Suite --> Private["Private operations through allowed service identities"]
  Public --> Check["Check spec digest, expected status, headers, media type and schema"]
  Private --> Check
  Check --> Rules["Assert ownership, pricing, pagination and other business rules"]
  Rules --> Gate{"Contract and operation coverage pass?"}
  Gate -->|"No"| Fail["Fail build with safe operation-specific diagnostics"]
  Gate -->|"All three providers passed"| UI["Observed customer/admin recordings in both Chrome and Edge under both runners"]
```

The request contexts use the real providers and exact-origin client certificates. They do not launch a browser. Invalid-input cases intentionally reach the provider, and TLS handshake failures are checked separately from HTTP error schemas.

## 9. Isolated CI gate and report boundary

The workflow is implemented in `.github/workflows/ci.yml`. Its static checks, live contracts/security suite and all eight customer/admin combinations passed in a disposable Compose project on Apple Silicon amd64 emulation and in the second GitHub Linux push. The native scan and cleanup passed; upload failed because the Cucumber telemetry file was mode `0600` and the GitHub host runner could not read it. The file now uses mode `0644` for synthetic, scanner-approved metadata, with an explicit host-readability gate before upload; that final CI path is pending rerun. The actual pull-request base comparison remains unobserved because this was a push. The CI host controls Docker while signing keys, user leaves and service credentials stay in project-scoped volumes and scoped containers.

```mermaid
flowchart TD
  Trigger["Observed GitHub Linux push; full workflow upload pending"] --> Static["Observed on Linux: pinned builds, types, units, OpenAPI drift, architecture and complexity gates"]
  Static --> Base{"Pull request with existing base bundles?"}
  Base -->|"Yes: planned live PR check"| Compare["Conservative existing-operation, schema, origin and auth comparator"]
  Base -->|"No first baseline"| Compose
  Compare --> Compose["Observed on Linux: unique LAB_PROJECT, one-shot PKI/secrets/DB/realm jobs, healthy stack"]
  Compose --> Certs[("Isolated Docker volumes: CA key PKI-only; per-runner leaves and scoped secrets")]
  Compose --> Contracts["Observed on Linux: browserless Playwright live contracts, 23 operations and status gate"]
  Contracts --> Security["Observed on Linux: TLS, token, ownership and identity checks"]
  Security --> Matrix["Observed on Linux: real Chrome and Edge; Playwright Test and Cucumber; customer and admin"]
  Certs -.->|"selected mounts only"| Contracts
  Certs -.->|"selected mounts only"| Security
  Certs -.->|"one selected identity per job"| Matrix
  Matrix --> Scan["Observed on Linux: container credential-artifact scan"]
  Scan --> Readable["Pending rerun: GitHub host can read approved text files"]
  Readable -->|"success only"| Upload["Pending rerun: text-only JUnit, Cucumber and coverage artifact; WebM/HTML remain local"]
  Compose --> Cleanup["Always: remove this CI project's containers and volumes"]
  Scan --> Cleanup
  Readable --> Cleanup
  Upload --> Cleanup
```

No manual viewer is launched in this CI matrix. The operator's selected-user viewer and certificate lifecycle remain the workflows above; CI's isolated stack uses the same issuance and two exact HTTPS origins, `shop.magic.test:8443` and `auth.magic.test:9443`. No host certificate store is written.

## Prompt 03 PKI overlay (observed on Apple Silicon Docker)

The PKI portion of infrastructure and provisioning is running in
`infra/compose.yaml`. This diagram records the observed certificate order and
credential boundary; shop, service and browser transport now run, while the
realm login and business paths in the main diagrams remain planned. The PKI job has no network or
published port.

```mermaid
flowchart TD
  Op["Operator: ./lab pki command"] --> Job["Observed: one-shot non-root UBI9 PKI job"]
  Job --> Lock["Exclusive lock on persistent issuer state"]
  Lock --> Init{"Operation"}
  Init -->|"init / observed"| Roots["Reuse or create server, user, service CAs"]
  Roots --> Leaves["Issue SAN/EKU leaves for exact DNS and six seed cert identities"]
  Leaves --> Outputs["Separate Docker volumes: one per server, service caller or user; user PEM plus PKCS12"]
  Roots --> Public["Public roots plus initial CRLs"]
  Init -->|"renew user / observed"| New["New serial and key; preserve one previous serial"]
  New --> Outputs
  Init -->|"revoke user serial / observed"| Index["Mark serial revoked in persistent CA index"]
  Index --> CRL["Atomically publish updated user CRL"]
  Public --> Check["Container OpenSSL trust, purpose and hostname checks"]
  CRL --> Check
  Check --> Result["Observed: current renewed leaf accepted; previous revoked leaf rejected"]
  CRL --> Reload["Observed: restart HAProxy; reject revoked user on fresh shop TLS"]
  Init -->|"revoke service client / observed"| ServiceCRL["Publish signed service CRL; restart three API TLS listeners"]
  ServiceCRL --> ServiceReject["Observed: Node, Go and Python reject revoked caller on fresh TLS"]
  Outputs --> Runners["Observed: mount only one selected user's volume per runner instance"]
```

The default project retained its certificates across repeated `init` runs with
the same serial and fingerprint. Isolated projects demonstrated user renewal,
user and service revocation, live gateway/API rejection on fresh connections,
and explicit reset. Prompt 04 subsequently observed Keycloak realm-level user CRL enforcement. Server certificates exist for
`shop.magic.test`, `auth.magic.test`, `ui`, three API DNS names and `postgres`.
PostgreSQL uses the `postgres` server leaf; the shop and three API listeners
now use their exact DNS leaves.

## Prompt 03 database overlay (observed on Apple Silicon Docker)

The database runs on a private Compose network with no host-published port.
The secret job is isolated from that network. The root entrypoint copies the
server key into a postgres-owned runtime path, then PostgreSQL runs as UID 999.
Bootstrap is a repeatable job, not a fixed-time delay.

```mermaid
flowchart TD
  PKI["Completed PKI job"] --> Cert[("Postgres-only server leaf volume")]
  Secrets["Completed no-network secret job"] --> Admin[("Admin password volume")]
  Secrets --> Apps[("One scoped password volume per current API/Keycloak consumer")]
  Cert --> PG["PostgreSQL 16.15: private database network :5432 / TLS + SCRAM"]
  Admin --> PG
  PG -->|"Healthy"| Boot["Repeatable bootstrap job; verify-full TLS to postgres SAN"]
  Admin --> Boot
  Apps --> Boot
  Boot --> Four[("keycloak_db, customer_db, catalog_db, insights_db / distinct owners")]
  Four --> Check["Observed: each owner reaches its own DB with TLS"]
  Check --> Negative["Observed: cross-DB, plaintext, wrong CA, wrong hostname rejected"]
  PKI --> AuthCert[("Observed: auth.magic.test server leaf")]
  AuthCert --> KC["Observed: Keycloak 26.4.0 private auth :8443"]
  Apps -->|"keycloak password only"| KC
  KC -->|"keycloak_app / verified PostgreSQL TLS"| PG
  Four --> GoDB["Observed: Go migrates, seeds and queries catalog_db over verified TLS"]
  Four --> NodeDB["Added in Prompt 07: bounded Node customer queries over verified TLS"]
  Four --> PythonDB["Added in Prompt 08: Python follow-up queries over verified TLS"]
```

`./lab db init` succeeded on first and repeat runs without replacing the
database. `./lab db verify` checked all four owners and negative boundaries.
Only the intended `:5432` container listener exists; it is not published on the
host. Keycloak is healthy on the private auth network and uses TLS connections
to `keycloak_db`; a container probe validated its direct `auth.magic.test:8443`
server certificate and rejected wrong CA/hostname. The passthrough is observed
in the next overlay. Prompt 04 subsequently implemented the certificate-login realm; Prompts 06–08 added bounded catalog, customer and insights queries. Python uses only `insights_db` for follow-ups and Node's private feed for order reports.

## Prompt 03 gateway and initial static UI overlay (historical Apple Silicon observation)

At the Prompt 03 stage, the UI was a built copy of the imported Vue preview served behind HAProxy; its
business requests are not yet wired to conforming providers. HAProxy has two exact-origin
listeners in one container and no host-published port. The front network has
both `shop.magic.test` and `auth.magic.test` aliases; the private backend also
has `auth.magic.test` for future service token/JWKS calls through the same
issuer origin. The auth and database networks remain private.

```mermaid
flowchart LR
  Probe["Disposable container with one user certificate"] -->|"shop.magic.test:8443 / user mTLS"| Shop["HAProxy shop termination"]
  Browser["Observed: Chrome and Edge test profile / exact-origin context certs"] -->|"verified shop and auth TLS"| Shop
  Probe -->|"auth.magic.test:9443 / TLS tunnel"| Auth["HAProxy auth TCP passthrough"]
  Shop -->|"gateway-only service mTLS :8443"| UI["Static Vue UI / private backend"]
  Auth -->|"untouched browser TLS :8443"| KC["Keycloak / private auth"]
  Shop -->|"/internal/*"| Hidden["Observed 404"]
  Shop -->|"/api/customer/* / gateway mTLS"| Node["Historical Node transport placeholder: 503"]
  Shop -->|"/api/catalog/* / gateway mTLS"| Go["Go transport placeholder: 503 at Prompt 03"]
  Shop -->|"/api/insights/* / gateway mTLS"| Python["Historical Python transport placeholder: 503"]
  Shop -->|"unknown /api/*"| Pending["Observed 404"]
  NoCert["Missing user certificate"] -->|"shop handshake"| Reject["Observed TLS rejection"]
  WrongCaller["Other service certificate"] -->|"direct UI mTLS"| Deny["Observed 403"]
  Revoke["Isolated project: revoke user + reload HAProxy"] --> Fresh["Fresh shop TLS connection"]
  Fresh -->|"revoked leaf"| Reject
  Fresh -->|"different valid leaf"| UI
```

Both exact origins returned HTTP 200 with server verification result zero from
the container probe. Shop no-cert and wrong server CA checks failed. The UI
rejected a missing or wrong service caller on its private HTTPS listener.
After the API placeholders were added, each named `/api/*` prefix returned 503
from its corresponding language container. Direct private probes established
that only `customer-api` transport may reach Go's internal quote placeholder
and only `insights-api` transport may reach Node's internal reporting
placeholder; other trusted service CNs got 403. Those probes are transport
checks, not service-token or OpenAPI contract tests.
Prompt 06 replaced the Go placeholder with a seeded, authorized provider and
live catalog contracts. Prompt 07 did the same for Node and added dynamic Docker
DNS refresh to HAProxy after backend recreation. Prompt 08 then replaced the
Python placeholder with the live insights provider.
The Prompt 03 revocation experiment used a disposable Compose project and removed it with explicit reset afterward. Prompt 04 then configured Keycloak's X.509 realm and tested its CRL rejection in a separate isolated project. The Prompt 03 test profile passed actual Chrome/Edge transport checks, and the manual profile launched both native browsers with a selected-user certificate. Prompt 04 direct runner PKCE login passed in both channels; later Prompt 10 human viewer checks confirmed both selected roles on Apple Silicon emulation.

## Prompt 03 runner profile overlay (observed on Apple Silicon Docker)

The `test` and `manual` profiles use the same pinned Bookworm amd64 image with
Chrome 155.0.8059.39-1, Edge 154.0.4258.62-1 and Playwright 1.61.0. The
browser image runs as UID 1000. Its signed package dependency closure is pinned
in `testing/container/apt.lock`; the public server CA enters its NSS database,
and Node's Playwright request client uses the same CA through
`NODE_EXTRA_CA_CERTS`. The observed recorded Playwright Test slice uses the
Playwright 1.61.0-pinned FFmpeg revision 1011 to produce local WebM videos and
HTML/JUnit reports. No TLS verification bypass is configured.

```mermaid
flowchart LR
  PKI["Completed no-network PKI job"] --> U[("Separate user certificate volumes: PEM, PKCS12, password")]
  U --> Select["Compose selected-user alias / one whitelisted volume"]
  Select --> Test["Test profile: real Chrome or Edge / Playwright context certificates"]
  Test -->|"record command: Playwright Test, video on; local only"| Report[("Host project artifacts/playwright/run-id: WebM, HTML, JUnit")]
  Select --> Manual["Manual profile: fresh HOME / selected identity check / PKCS12 import / narrow brand policy"]
  Trust[("Public roots and CRLs; no signer key")] --> Test
  Trust --> Manual
  Test -->|"exact shop/auth origins; strict TLS"| Gateway["HAProxy front :8443 and :9443"]
  Manual -->|"starts browser at shop"| Gateway
  Manual --> Viewer["Password-protected noVNC / loopback :6080 or override; stop removes profile"]
  Viewer --> Host["Host viewer only; no host certificate install"]
  Gateway --> Backend["Private UI and three live business providers / service mTLS"]
```

Both browser channels returned 200 at the shop and Keycloak's master realm
discovery endpoint with a selected user certificate, 503 for a placeholder API
and 404 for public `/internal/*`. Missing client certificates and wrong server
hostnames failed. The manual Chrome store held the customer certificate; a
recreated Edge desktop held only the admin certificate. The native policy and
browser process were verified. The manual viewer was bound to `127.0.0.1:6081`
because the older spike viewer still occupies the default 6080. Human login
against this Compose realm remains unverified, though Prompt 04 direct Chrome/Edge PKCE tests passed. Prompt 11's shared Saturday Playwright Test and Cucumber customer/admin journeys now pass against the live stack in Chrome and Edge. The earlier recorded UI slice was fixture-backed and remains separate evidence; the broader negative matrix is still open.

## Early Prompt 09 UI authentication overlay (observed on Apple Silicon Docker)

The Vue shell now initiates the same certificate-only PKCE flow proven in Prompt 04. The authentication adapter starts before the router so it can process and clear the callback. Tokens remain in adapter memory; only the transient PKCE callback state uses browser storage. The user-facing role is derived from the returned token, while eventual business API permission checks remain server responsibilities. A signed-in catalog request now reaches the Go provider, which validates the signed token and gateway certificate identity.

```mermaid
flowchart LR
  Browser["Real Chrome or Edge with selected certificate"] -->|"Shop mTLS :8443"| Gateway["HAProxy shop listener"]
  Gateway -->|"Gateway service mTLS"| Vue["Vue sign-in shell"]
  Vue -->|"Sign in button; Code + PKCE S256"| Browser
  Browser -->|"Certificate over auth passthrough :9443"| Keycloak["Keycloak certificate-only realm"]
  Keycloak -->|"Exact /callback authorization code"| Browser
  Browser -->|"PKCE code exchange over verified TLS"| Keycloak
  Keycloak -->|"Access and refresh tokens"| Memory["Browser adapter memory only"]
  Memory -->|"Selected username and role"| Vue
  Memory -->|"Bearer token; catalog audience"| Pending["Observed Go catalog response after identity pairing"]
  Vue -->|"Sign out; exact post-logout redirect"| Keycloak
  Memory -.->|"No tokens"| Storage["Browser storage: subject-scoped preview cart only"]
```

Observed tests covered Chrome/customer and Edge/shop-admin sign-in and sign-out with context certificates and with native NSS installation/policies, disabled-user rejection, token absence from browser storage, catalog bearer propagation and customer-to-admin preview-cart isolation. All three business providers subsequently passed live contracts; the final Prompt 09 UI matrix covered customer and admin journeys in both browser brands.

## Prompt 13 operator control

Prompt 13 adds a local operator. The trusted host runs its binary and Docker CLI; the UI, three business APIs, Keycloak and both runner modes receive no Docker socket. The operator's `status`, `healthcheck` (`health` alias), `certs` and `telemetry` views were observed on Apple Silicon. Healthcheck requires all seven core services healthy and also checks the manual viewer when present. Its test and diagnostic actions call the existing containerized suites. The separate `diagnose-revoked --yes` action passed in a disposable project and removed only its own volumes; the ordinary `diagnose` action does not change CRLs.

```mermaid
flowchart TD
  Human["Local operator"] --> TUI["Host Go CLI/TUI; Bubble Tea, Bubbles, Lip Gloss"]
  TUI -->|"allowlisted, bounded Docker Compose calls"| Compose["Trusted host Docker CLI"]
  Compose -->|"healthcheck: require running and healthy"| Core["HAProxy, Keycloak, UI, PostgreSQL, Go, Node, Python"]
  Compose -->|"manual profile; check if present; selected user and browser"| Manual["Real Chrome or Edge in runner-manual"]
  Compose -->|"test profile; ephemeral exit status"| Tests["Playwright contracts/security/browser and Cucumber"]
  Compose -->|"metadata-only OpenSSL in PKI container"| Certs["Issuer, serial, expiry and CRL publication age"]
  TUI -->|"log counts and recent report IDs"| Telemetry["Local redacted telemetry"]
  TUI -->|"explicit --yes and named project"| Reset["Separate volume reset; never implicit"]
  Tests -->|"exact shop :8443 and auth :9443, verified TLS"| Core
  Revoked["Observed operator action: disposable project, CRL publication, fresh shop/auth rejection"] --> Tests
```

## Keeping the diagrams accurate

- After prompt 01, reconcile actual browser/base/architecture choices and both authentication origins.
- After prompts 03–04, reconcile Compose services, ports, networks, credential mounts, startup dependencies and Keycloak flow behavior.
- After prompts 06–11, reconcile API routes, OpenAPI contract gates, service-token scopes, reporting logic, runner adapters and manual desktop lifecycle.
- During prompt 12, render every Mermaid block, check legibility, and trace each arrow to implemented configuration or an observed test. Keep unimplemented behavior explicitly labeled as planned.
- Maintain editable Mermaid blocks in Markdown as the source of truth. If exported SVG/PNG figures are added for teaching, generate them from these blocks with a pinned containerized renderer and check them for drift.

## Prompt 01 implementation overlay (Apple Silicon runtime proof)

The eight diagrams above remain the full-stack plan. The spike presently uses the
following smaller workflow. No regional reporting, service client-credentials flow,
PostgreSQL, portable Keycloak package or full UI has been implemented by this overlay.
Their planned diagrams and three-language/OpenAPI requirements still apply.

```mermaid
flowchart TD
  P["UBI9 one-shot PKI: user / service / server roots and initial CRLs"] --> V["Isolated Docker volumes; CA keys only in PKI"]
  V --> K["Import fixed synthetic users, protected cert_identity and REQUIRED X509 flow"]
  K --> G["HAProxy: shop termination 8443 / auth passthrough 9443"]
  Mode{"Runner mode"} -->|"Context certificates / observed"| A["Playwright and Cucumber: Chrome and Edge, both exact origins"]
  Mode -->|"Native installation / observed in headed tests"| M["Fresh HOME + one selected bundle + brand policy + loopback viewer"]
  G --> A
  G --> M
  A --> Login["PKCE login without cookie/password execution"]
  M --> Login
  Login --> API["Landing identity endpoint: gateway mTLS + JWT + certificate identity equality"]
  API --> Negative["Mismatched saved cookies, token/certificate mismatch and negative TLS checks"]
  Negative --> CRL["Observed: revoke dedicated leaf; publish CRL; restart HAProxy and Keycloak"]
  CRL --> Fresh["Observed: fresh shop and Keycloak rejection; 29.79 s operation"]
```

Customer and admin PKCE login passed in both branded browsers under both runners.
All four headed native-store user/browser pairings passed, and a human completed
customer login through the loopback viewer. Native Linux amd64 remains unverified;
completion note 01 records the bounds.

## Prompt 02 import overlay (build-time observation)

This diagram records the imported component without implying that it is deployed
behind HAProxy or authenticated by Keycloak yet. The full-stack diagrams above
remain the intended runtime workflow.

```mermaid
flowchart LR
  Source["Saturday shop source, read-only"] -->|"Selected files + SHA-256 provenance"| Vue["Vue shop preview: theme, cart display, Leaflet"]
  Images["Mock API item images + LICENSE/NOTICE"] -->|"Copied local assets"| Vue
  Data["Mock API items; no user/password file"] -->|"14 illustrated items, local paths, integer copper"| Seed["Sanitized catalog seed"]
  Models["Saturday page models and feature text"] -->|"Selected models; installed core package"| Tests["Testing workspace; scenarios not yet wired"]
  Vue -->|"Observed: strict typecheck + Vite build in Docker"| Dist["Static preview artifact"]
  Vue -.->|"Planned at Prompt 02: same-origin bounded catalog request"| Go["Go OpenAPI catalog API; implemented at Prompt 06"]
  Vue -.->|"Planned: Keycloak login and server checkout"| Future["Authenticated full-stack UI; not implemented"]
```
