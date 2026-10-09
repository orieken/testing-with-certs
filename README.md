# Magic Shop certificate prototype

This repository is a local teaching prototype. Start with the [teaching guide](docs/teaching-guide.md) for container-only startup, selected-user certificate login, tests, troubleshooting and reset. The [implementation guide](docs/README.md) tracks the three-language, OpenAPI-backed shop and acceptance evidence. The [agent adoption prompts](docs/agent-adoption-prompts.md) explain how another project can adapt the certificate tests. The [certificate-login spike](spikes/certificate-login/README.md) and all three live business providers passed on Apple Silicon using amd64 emulation; native Linux GitHub Actions verification has begun and remains incomplete.

The root pnpm workspace contains the certificate-authenticated Vue shop, a
private local Keycloak package, Go catalog, Node customer and Python insights
services, infrastructure, seed data and browser/test runners. All 23 business
operations passed live Playwright contract coverage on Apple Silicon emulation.
Generated reports belong under `artifacts/`; credentials and host trust never do.

Start the full stack with `./lab up`; use `./lab status` to inspect it. The [Go operator CLI/TUI](docs/operator-guide.md) is available through `./lab operator` and is built in a pinned container. The wrapper needs Docker Compose and a shell, with no host language runtime or certificate installation. The workspace can also be listed without host Node or pnpm:

```sh
docker run --rm --platform linux/amd64 -v "$PWD:/work" -w /work \
  node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9 \
  npm exec --yes --package=pnpm@12.9.1 -- pnpm -r list --depth -1
```

Package installation, builds, database setup, certificate operations and tests run in containers. See [TODO](docs/TODO.md) and the [Prompt 12 completion note](docs/completion/12-ci-handoff.md) for precise completed and pending scope.

## Continuous integration

The GitHub Actions workflow runs on pushes, pull requests and manual dispatch on Linux amd64. It uses read-only repository permissions and pinned actions. All dependency installation, builds and tests run in containers with pinned images. The [first native run](https://github.com/orieken/testing-with-certs/actions/runs/37976084152) passed static/service checks and isolated stack startup, then stopped before contracts and browsers because Google removed the old pinned Chrome version from its signed apt index. The browser pin has been refreshed and the full rerun is pending.

The workflow gates on static builds, OpenAPI lint/generated drift and a PR base comparison, then starts an isolated healthy Compose project. It runs live Playwright contracts and security checks before the real Chrome/Edge × Playwright Test/Cucumber × customer/admin matrix, scans artifacts and uploads text-only JUnit/Cucumber/coverage results. Local WebM videos remain on the developer machine. The equivalent static and live matrix passed on Apple Silicon amd64 emulation; the GitHub integration matrix has not yet completed.

Run the same checks locally from the repository root:

```sh
docker build --platform linux/amd64 --target workspace -f infra/ci/Containerfile .
docker build --platform linux/amd64 --target spike -f infra/ci/Containerfile .
docker build --platform linux/amd64 -f services/catalog-api/Containerfile .
docker build --platform linux/amd64 -f services/insights-api/Containerfile .
docker compose -f infra/compose.yaml --profile '*' config --quiet
```

No repository secrets are required by the CI workflow. The initial commit establishes a source baseline. The actual pull-request base comparison has not been run because this was a push, not a pull request.
