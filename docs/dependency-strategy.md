# Feasibility dependency strategy

The spike uses installed Saturday packages and a single packed certificate helper.
The Saturday checkout is read-only reference material; it has not been modified.
No package is published. No framework source directories, node_modules, browser
profiles or generated credentials were copied into this repository.

## Exact dependency inputs

The bounded spike uses `package-lock.json` and container-only `npm ci`. The planned
workspace/package extraction can adopt the existing Saturday pnpm conventions in
prompt 02; this spike is not a nested Saturday workspace.

| Dependency | Selected version / source |
| --- | --- |
| Node | 24.10.0, digest-pinned official Bookworm slim |
| Playwright + Playwright Test | 1.61.0, same exact version |
| Cucumber | 11.3.0 |
| Saturday core | 0.1.3, npm registry |
| Saturday Playwright | 0.1.1, npm registry |
| Saturday Cucumber | 0.1.1, npm registry |
| Saturday certificate helpers | 0.1.0, recorded local-source tarball |
| TypeScript / tsup / tsx | 5.9.3 / 8.5.1 / 4.20.6 |
| esbuild browser bundler | 0.27.7 |
| Vitest + V8 coverage | 3.2.7 |
| jose / Keycloak JS | 6.1.0 / 26.2.0 |
| Chrome | 154.0.8037.97-1, signed Google apt metadata |
| Edge | 154.0.4258.62-1, signed Microsoft apt metadata |

The registry returned 404 for `@orieken/saturday-playwright-certs`; all other listed
Saturday versions were available. `container/pack-saturday.sh` copies only declared
helper source files into an ephemeral container directory, builds there, and packs
built outputs. It includes the applicable LICENSE/NOTICE. Exact source file hashes,
source HEAD, toolchain, adaptations and tarball hash are in
[provenance](../spikes/certificate-login/vendor/provenance.json). HEAD does not assert
that the entire Saturday working tree is clean; hashes identify the actual inputs.
The certificate package is untracked in that checkout, so the HEAD revision alone
does not contain those inputs. Retain the tarball and hash manifest; do not claim
that rebuilding solely from HEAD reproduces this package.

The helper's broad >=1.40 peers are not the compatibility gate. The spike exercises
1.61.0's exact-origin context/API certificates and uses the lower-level
`createClientCertConfig` twice, rather than the single-origin project helper.
The published Saturday Cucumber hooks are not installed globally: the spike uses
its World with explicit certificate-aware lifecycle hooks. Both test runners call
the same Saturday site/page/element/flow interactions.

## System package locking

`container/apt.lock` pins all 310 packages in the signed dependency-resolution plan,
including the branded browsers. Google and Microsoft ASCII public signing keys
are checked against recorded SHA-256 values. Debian Release files and package
metadata retain normal signature validation. Download operations have explicit
30-second timeouts. No dependency-bypassing RPM installation, unsigned repositories,
floating browser installer, or downloaded shell installer appears in the build.

The table above records the original spike. On 2026-10-09 the first native Linux
GitHub run found that Google no longer listed Chrome `154.0.8037.97-1` in its
signed apt index. The full-stack `testing/container/apt.lock` now pins Chrome
`155.0.8059.39-1`, confirmed in the signed index and a fresh no-cache amd64
runner build; Edge remains `154.0.4258.62-1`. The refreshed image reported
both exact binaries and passed local real Chrome/customer and Edge/admin
teaching smoke runs. A second GitHub Linux run built this refreshed runner and
passed live contracts, security and the eight browser selections; its report
upload failed on a Cucumber file permission unrelated to package resolution.
The isolated spike lock and its historical result are unchanged. See
[native CI continuation](completion/12-native-linux-ci.md).

The third GitHub run reached Cucumber but a Node 24.10.0 HTTP/2/TLS assertion
aborted its Chrome/admin process. The full-stack browser runner now pins
Node 24.19.0 Bookworm slim at index digest
`sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df`
and Cucumber 12.9.0, whose published `enginesTested` includes Node 24. The
private certificate adapter's peer range accepts both the historical 11.3
and current 12.9 majors; its dev and independent packed-consumer checks use
12.9.0. The signed browser apt closure and Playwright 1.61.0 are unchanged.
Local Chrome/admin and Edge/customer Cucumber journeys, frozen workspace
build and independent package consumption passed. This is a candidate until
the native Linux workflow and artifact upload pass; the Node assertion's exact
race has not been proven fixed by the patch release.

Resolution is an explicit maintenance task (`container/resolve-metadata.*`), not a
build-time upgrade. Repository retention can make an old pinned version unavailable;
a build must fail in that case. Before long-lived CI adoption, archive the signed
package closure in an approved immutable artifact store or digest-pin the verified
built runner. No remote artifact publication has been performed in this prompt.

## Audit and limitations

The initial audit found 13 issues including high/critical development dependencies.
Cucumber, tsup and Vitest were moved to then-compatible fixes. The current audit in
`spikes/certificate-login/evidence/npm-audit-current.json` reports ten findings:
one low, seven moderate and two critical, with the critical advisories in
Vitest/tinypool development tooling. These are a recorded limitation, not a passing
security gate. Resolving them requires a separately tested major-version update.
No automatic major-version changes or package publication was performed.

Apple Silicon emulation now passes the Chrome/Edge, Cucumber and Playwright runtime
checks, and a human completed customer login through the manual viewer. Native
Linux amd64 remains absent.

## Prompt 02 OpenAPI toolchain

The prototype's separate pnpm workspace now locks Redocly CLI 2.58.1 for OpenAPI
3.1 lint/bundling, openapi-typescript 7.13.0 for derived TypeScript transport
declarations, Ajv 8.20.0 in draft-2020-12 mode, ajv-formats 3.0.1, Playwright
Test 1.61.0, TypeScript 5.9.3, pnpm 12.9.1 and Node 24.10.0. Redocly and the
type generator are tooling, not runtime validation in the Go or Python services.
Python's operation inventory and mutation fields are checked against the
canonical bundle during its image build; no independent framework-generated
schema is treated as canonical.

## Prompt 07 Node customer provider

The Node service pins `pg@8.23.1`, `jose@6.2.12` and `@types/pg@8.23.1`
in the workspace lockfile. The pinned Node 24.10.0 Bookworm image installs
them with frozen pnpm resolution, typechecks, builds and runs meaningful domain
and canonical-contract equivalence tests, then deploys only production
dependencies into its non-root runtime stage. The resolved customer OpenAPI
bundle is packaged with the image; browserless Playwright tests compare its
served digest and live responses against the repository bundle. Package
resolution and installation occurred entirely in containers. No package was
published or copied from the read-only Saturday checkout.

The lockfile resolution was run in a container. pnpm's supply-chain check passed
and added one exact `minimumReleaseAgeExclude` entry for the newly published
`@redocly/cli@2.58.1`; there is no wildcard or floating installation. Package
installation and all checks use ephemeral container volumes, leaving no copied
workspace `node_modules`. The code generator and bundler produce deterministic
checked-in artifacts and a SHA-256 digest manifest from the authored OpenAPI
files. The validator tests exercise `prefixItems`, extra-field rejection and
UTC/date formats rather than trusting peer/version declarations alone.

The toolchain check alone does not establish live API conformance. Go, Node and
Python subsequently passed provider contracts and the execution-derived
23-operation/92-status gate on Apple Silicon emulation.

## Prompt 08 Python insights provider

The Python image uses the pinned UBI9 Python 3.12 base. `requirements.txt` pins
the full observed pip closure: PyJWT 2.15.1, psycopg and psycopg-binary 3.2.13,
cryptography 50.0.2, cffi 2.1.1, pycparser 3.0 and typing_extensions 4.16.0.
Installation, bytecode compilation and three domain/contract-equivalence tests
run during the container build. The resolved insights OpenAPI bundle and local
GeoJSON fixture are packaged in the image. The authenticated private served
bundle digest and live responses are compared with repository-expected artifacts
by Playwright. No host Python installation or package publication is required.
