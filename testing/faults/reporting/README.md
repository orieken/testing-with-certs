# TEST-06/09 — Scripted reporting dependency

Build the pinned container runner before the standalone compatibility probe or
recorder (the full consumer wrapper also builds it automatically):

```sh
docker compose -f infra/compose.yaml --profile test build runner-test
./testing/faults/reporting/compatibility.sh
```

```sh
LAB_PROJECT=magic-shop-reporting-fault-example ./testing/faults/reporting/run.sh
```

All installation, builds, provisioning and tests run in pinned containers. The
wrapper creates a fresh private project and removes its containers, networks,
keys, tokens, profiles and databases on exit. Reports contain sanitized results.
Use a new project name for each independent repetition.

Mokapi 0.52.0 scripts revision-pinned pages, revision conflicts, outages, repeated
cursors and empty intermediate pages. Its read-only schema comes from the
canonical customer bundle; existing Ajv checks valid fixtures and the delivered
responses. `wrong-type` is an intentionally invalid fault fixture, checked as
invalid rather than described as a valid mock example.

Only the disposable insights container's customer-api DNS is redirected. Python
still checks server CA/hostname, sends its service certificate and gets its real
Keycloak reporting token. The wrapper checks the certificate identity and asks
the real Node provider to validate that token before delivering a mock page.
The wrapper discards credentials before the private HTTP Mokapi hop. Mokapi has
no route to real services, certificate mounts or published ports; dashboards,
MCP, health and event storage are disabled. No token, request or response body
is logged. CA signing state belongs only to PKI.

The tests prove that the real insights HTTP consumer returns canonical errors
instead of partial sales/customer/order results, supports explicit recovery,
continues through a valid empty page, and terminates at its record/page caps.
They do not prove a real reporting-provider outage or a full live-provider
coverage gate. The application and its normal routes/authentication are unchanged.

To record a **new execution's live output** in a labelled Chrome viewer:

```sh
LAB_PROJECT=magic-shop-reporting-fault-recorded ./testing/faults/reporting/record.sh
```

This video records container test output, not an application browser journey or
native login. The recorder has no network, stores its profile in disposable
volumes and scans the finished report. TEST-07 provides separate actual UI videos.
