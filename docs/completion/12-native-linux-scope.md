# 12 — Native Linux verification scope decision

Date: 2026-10-09. The user explicitly chose to skip native Linux amd64 verification. This changes the acceptance scope, not the observed platform evidence. No Linux test, deployment, commit or package publication was performed for this decision.

## Changes

The remaining native Linux checkboxes in [the TODO list](../TODO.md) stay unchecked and are labeled **skipped by user; unverified**. The architecture and workflow diagrams now label the GitHub Linux job as configured but unrun, while retaining the observed Apple Silicon amd64-emulation results. Current handoff documents no longer describe a native Linux run as the next required step.

## Commands and observed environment

The read-only context inventory from the preceding continuation was:

```sh
docker context ls --format '{{.Name}} {{.DockerEndpoint}} {{.Current}}'
docker info --format '{{.OSType}} {{.Architecture}} {{.Name}}'
docker --context default info --format '{{.OSType}} {{.Architecture}} {{.Name}}'
```

Only `default` and `desktop-linux` were configured; both engine queries returned `linux aarch64 docker-desktop`. No native amd64 Docker engine was available. All passing browser, PKI, API, operator and CI-equivalent results remain scoped to Apple Silicon running linux/amd64 images under emulation.

```sh
./infra/render-diagrams.sh
```

The digest-pinned Mermaid container extracted and rendered all 21 architecture/workflow blocks after their Linux labels changed. No application build or test was repeated for this documentation-only decision.

## Decision, limits and next dependency

The written GitHub workflow stays in the repository as an unexecuted reference. Its actual Linux behavior, report upload and PR-base contract comparison are unverified. This repository also has no initial commit, and the user prohibited committing as a side effect, so a literal clean clone or real pull-request base comparison was not run. No further native Linux work is scheduled under the current request. The local prototype and its completion evidence are the delivered scope; platform claims must continue to say **unverified** unless the user later reopens native Linux testing.
