# Prompt 11 increment — local Playwright Test videos

## Changes and decisions

Added a separate browser Playwright Test configuration and two recorded UI examples. The browserless OpenAPI contract configuration remains unchanged. The recorded examples launch the actual installed `chrome` or `msedge` channel, present the selected user's certificate at both exact HTTPS origins, and retain server verification. The first test exercises real Keycloak certificate login and the observed 503 business-service boundary. The second signs in through the same real path, then uses Playwright route fixtures to exercise the catalog, cart, simulated checkout and, for admin, regional sales screens. That second test demonstrates UI behavior only, not a live Go/Node/Python result.

`./lab record chrome customer-waterdeep` and `./lab record msedge shop-admin` build/run the containerized test profile and print a unique local `artifacts/playwright/<run-id>/` path. Every test records a WebM video, including passing tests. The run also writes HTML and JUnit reports; screenshots are limited to failures and authentication traces stay off. The artifact bind mount contains reports/videos only, while certificate PEMs remain in the selected-user Docker volume. Reports are gitignored and not uploaded. Playwright 1.61.0 installs its pinned FFmpeg revision 1011 in the image; the real browser packages remain separately pinned. No host Node, certificate store or browser installation was needed.

The workflow runner diagram and architecture overview now show this observed local video path, while the full Saturday Playwright/Cucumber suites remain planned. The test plan and testing README explain viewing and sharing limits. This work does not mark the complete Prompt 11 testing matrix finished.

## Exact commands and observed results

Environment: macOS arm64 host with Apple Silicon linux/amd64 emulation, retained `magic-shop-lab` Docker Compose project, Chrome 154.0.8037.97, Edge 154.0.4258.62, Node 24.10.0, Playwright 1.61.0 and Playwright FFmpeg 1011. Native Linux amd64 remains deferred at the user's request.

```sh
sh -n lab
docker compose -f infra/compose.yaml config --quiet
docker compose -f infra/compose.yaml --profile test build runner-test
docker compose -f infra/compose.yaml --profile test run --rm --no-deps runner-test /work/testing/node_modules/.bin/tsc --noEmit -p /work/testing/tsconfig.json
./lab record chrome customer-waterdeep
./lab record msedge shop-admin
rg --files artifacts/playwright | sort
file artifacts/playwright/*/test-results/*/*.webm
```

The shell and Compose checks passed. Runner typechecking passed. Both recorded runs exited zero with **2/2 Playwright tests passing**: Chrome/customer in `artifacts/playwright/20261007T002833Z-chrome-customer-waterdeep-40676/` and Edge/shop-admin in `artifacts/playwright/20261007T002855Z-msedge-shop-admin-40843/`. Each directory contains two nonempty WebM test videos, an HTML report and `junit.xml` reporting zero failures. The generated videos were identified as WebM. This validates the recording path and test outcomes on emulated amd64, not the entire planned browser matrix.

The first build attempt invalidated the pinned browser package layer and failed because Google no longer listed `google-chrome-stable=154.0.8037.97-1` in its current apt index. Moving the new video-path environment declaration after the browser installation retained the existing verified pinned browser layer; the subsequent build succeeded without substituting a floating Chrome version. The Playwright binary belongs to `testing/node_modules/.bin`, not the workspace root; correcting that path allowed FFmpeg 1011 to download into the image. A clean image rebuild without the retained apt layer still needs a reviewed, pinned browser package refresh or a retained package mirror.

## Limits and next dependency

Videos show synthetic identities and are for local review; they are excluded from source control and should be reviewed before sharing. The fixture-backed video is clearly labeled and does not prove business API behavior. Cucumber recording and the full Saturday-backed Playwright browser suite still need implementation. Prompts 06–08 must deliver the three OpenAPI-backed APIs before live checkout, regional reporting, API authorization and contract videos can be claimed. No native Linux amd64 run was attempted at the user's request.
