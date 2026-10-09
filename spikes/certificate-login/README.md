# Certificate login feasibility spike

**Apple Silicon emulation and a human selected-customer viewer login passed;
native Linux amd64 remains unverified.** Read
[compatibility](../../docs/compatibility.md) and [completion 01](../../docs/completion/01-certificate-login-feasibility.md)
for observed checks and blockers. This is the bounded thin slice; no full UI migration.

Only Docker/Compose and a POSIX shell are required on the host. Source and sanitized
evidence are host files. All keys, certificates, trust databases, browser homes and
Keycloak state stay in containers or Docker volumes. Never install the lab CA on the host.

## Local operation

```sh
cd spikes/certificate-login
./lab build
./lab up
./lab unit
./lab test
LAB_BROWSER=chrome ./lab cucumber
LAB_BROWSER=msedge ./lab cucumber
LAB_USER=customer LAB_BROWSER=chrome ./lab native
LAB_USER=admin LAB_BROWSER=msedge ./lab native
LAB_USER=customer LAB_BROWSER=chrome ./lab manual
./lab viewer-password
```

Open [the loopback viewer](http://127.0.0.1:6080/vnc.html), enter the generated VNC
password, then use **Sign in with certificate**. Host browser trust is irrelevant
to the remote browser. Switch users/browsers by rerunning `manual`: it recreates the
container, including HOME. Test all four customer/admin × Chrome/Edge combinations.
`native` is headed native-store automation with no context certificates; it does
not replace the human viewer check.

`./lab down` stops the project and retains issued credentials and Keycloak state.
There is deliberately no implicit delete-volumes/reset command. Ordinary startup
reuses CA/leaf identities; Keycloak import skips an existing realm. Changes to the
realm fixture require a new explicitly named Compose project, not an unnoticed reset.

## Revocation experiment

The `revocable` identity is dedicated to this destructive experiment:

```sh
./lab test --project transport --grep AUTH-07
./lab revoke
docker compose run --rm -e EXPECT_REVOKED=true tests npm test -- --project transport --grep AUTH-07
```

This publishes an updated user CRL then restarts both HAProxy and Keycloak to drain
connections and clear Keycloak's CRL cache. The local emulated run completed the
operation in 29.79 seconds, then rejected the leaf on fresh shop and auth connections.
The <=60-second bound remains unverified on native Linux amd64. Restarting does
not revoke already issued JWTs: the access-token lifetime is 120 seconds. The initial
CRL has already passed a container-only OpenSSL check; that is not network rejection proof.
A repeated `revoke` can report already revoked; use a fresh project for an independent run.

## Remote native amd64 Docker context

This workflow is prepared but unexecuted; no remote endpoint was supplied. Use a
trusted Linux amd64 Docker host with SSH access and enough disk. Docker Compose
builds send this spike's filtered build context; runtime uses named volumes and
baked configuration, without local path mounts. Certificates never cross back to Mac.

```sh
docker context create cert-amd64 --docker host=ssh://USER@HOST
DOCKER_CONTEXT=cert-amd64 ./lab build
DOCKER_CONTEXT=cert-amd64 ./lab up
DOCKER_CONTEXT=cert-amd64 ./lab test
DOCKER_CONTEXT=cert-amd64 LAB_BROWSER=chrome ./lab cucumber
DOCKER_CONTEXT=cert-amd64 LAB_BROWSER=msedge ./lab cucumber
DOCKER_CONTEXT=cert-amd64 LAB_USER=customer LAB_BROWSER=chrome ./lab manual
DOCKER_CONTEXT=cert-amd64 ./lab viewer-password
ssh -N -L 127.0.0.1:6080:127.0.0.1:6080 USER@HOST
```

Open the same local viewer URL. Only loopback port 6080 is published on the remote
host; SSH provides the encrypted hop. Raw VNC, debugging, shop, auth and backend
ports are not published. Do not expose port 6080 on a public interface. Run native
checks for each user/browser via the same context. Record `docker info` architecture,
image/package inventories and safe test output before claiming native support.

## Dependencies and provenance

See [dependency strategy](../../docs/dependency-strategy.md). Builds consume exact
image digests, `container/apt.lock`, pinned vendor keys and `package-lock.json`.
Unavailable versions fail the build. `resolve-metadata.*` is an explicit maintenance
probe, not an implicit upgrade step. It uses signed repositories and bounded fetches.
No bundled Chromium is installed or used. Browser sandbox disabling in the native
Docker launch is distinct from TLS verification; no TLS bypass flag is provided.

Keycloak is an official UBI-based candidate, PKI uses UBI9, and the browser/Node
candidate uses Bookworm. HAProxy's official image is a spike packaging exception;
the full-stack UBI9 service choices remain planned. Keycloak file storage is also
spike-only. There are no passwords on the seeded users or bootstrap admin credentials.
