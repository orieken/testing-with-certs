# Local operator guide

The operator is a trusted host-side Go program. `./lab operator` builds the host's binary in a pinned Go container when needed and opens a Bubble Tea/Bubbles/Lip Gloss menu in a terminal. Docker is the only required host tool. The app, business APIs, Keycloak, and test/manual runners do not mount a Docker socket. The operator is a fourth *tool*, not a fourth business API.

The menu can filter actions by typing, select with Enter, refresh status with `r`, and quit with `q`. Stop actions require `y` in the menu. Closing the menu cancels its active command. Without a terminal, `./lab operator` prints status. Actions use bounded process time and at most 64 KiB of captured output.

Noninteractive examples:

```sh
./lab operator status
./lab operator healthcheck
./lab operator health
./lab operator telemetry
./lab operator certs
./lab operator logs gateway
./lab operator start catalog-api
./lab operator stop catalog-api --yes
./lab operator manual chrome customer-waterdeep
./lab operator manual stop
./lab operator test contracts
./lab operator test security
./lab operator test playwright chrome customer-waterdeep
./lab operator test cucumber msedge shop-admin
./lab operator diagnose
./lab operator diagnose-revoked --yes
```

Test actions display source-controlled test names, pass/fail totals and local report paths. Unexpected runner output is withheld from the terminal so a failed test cannot print a token in the operator view. The underlying local report remains available for investigation.

`diagnose-revoked --yes` uses a fixed, dedicated `magic-shop-matrix-user-crl-operator-13` project. It refuses to start if that project already has volumes, verifies Chrome login before revocation, publishes the user CRL in the PKI container, reloads HAProxy and Keycloak, waits for health and tests fresh connections at both exact origins. It then removes only that disposable project's volumes. A cleanup failure is reported. The retained project and its certificates are not changed.

`status` lists named services, Compose state, health and dependencies. `healthcheck` (also available as `health`) fails unless all seven core services are `running` and `healthy`. It also fails if an existing manual viewer is unhealthy; an absent viewer is optional. It prints a passing summary only after those checks. The one-shot test runner is judged by its exit status when invoked, rather than as a standing service. `telemetry` shows recent local report IDs. `logs SERVICE` counts up to 30 recent lines, warnings and failures but withholds message bodies. `certs` invokes OpenSSL **inside the network-isolated PKI container** to read selected public leaf metadata and CRL dates. It does not copy certificates, keys or trust settings to the host. Reports stay under the local `artifacts/` directory.

`diagnose` runs the existing Playwright security suite followed by all three providers' OpenAPI contract suite. Those tests cover exact shop/auth origins, missing client certificate, wrong hostname, missing server CA, private-route rejection, JWT/certificate identity, gateway/backend transport, and scoped Node→Go and Python→Node calls. TLS verification stays enabled. Revoked-leaf fresh-connection tests require CRL publication and service reload in a **separate disposable Compose project**; the single diagnostic action does not alter the retained lab's CRLs. The [security matrix](completion/11-security-matrix.md) records the isolated commands and observed evidence. Re-run `./lab operator healthcheck` after any local service restart.

Start/stop only accept named services; `manual` accepts a named browser and seed identity. Normal start/stop does not remove volumes. Volume destruction is a separate, explicit `./lab operator reset PROJECT --yes` and requires `LAB_PROJECT=PROJECT`. Do not use that command against a project whose certificates, orders, notes or reports must be retained.

The binary and reports are local ignored artifacts. Package installation, Go compilation, certificate operations and all tests occur in containers. Apple Silicon was checked with the amd64 application/runner images under Docker emulation. The user later confirmed both selected identities in the current Compose manual viewer. Native Linux amd64 remains unverified.
