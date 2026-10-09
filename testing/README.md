# Testing workspace

The live teaching examples use one Saturday `MagicShop` site with page, element and certificate-login flow models in `site/`. Playwright Test and Cucumber call the same setup/interactions, while each runner keeps its own readable business assertions. The local `saturday-keycloak-prototype` fixture/hooks select one mounted identity and both exact HTTPS origins. Only real Chrome and Edge are configured; server validation remains on.

Run from the repository root after `./lab up`:

```sh
./lab test --runner playwright --browser chrome --user customer-waterdeep
./lab test --runner cucumber --browser chrome --user customer-waterdeep
./lab test --runner playwright --browser msedge --user shop-admin
./lab test --runner cucumber --browser msedge --user shop-admin
./lab test --runner playwright --suite contracts
./lab test --runner playwright --suite security
./lab test --runner playwright --suite package
```

Repeat each role with the other browser to complete the eight teaching combinations. The customer scenarios exercise certificate login, account, simulated server-priced order, widget persistence and direct admin denial. The administrator scenarios exercise certificate login, account, September Waterdeep totals and local map. The imported `cart.feature`, `inventory-list.feature` and `item-details.feature` remain source-reference examples and are not selected by this live suite.

Playwright teaching runs write HTML, JUnit, per-test WebM and failure-only screenshots under `artifacts/teaching/<run-id>/`. Cucumber writes JSON, JUnit and a small local scenario telemetry JSONL with title, result, duration, browser and selected synthetic user only. Its hooks do not record tokens, certificate data or browser state. Contracts run without a browser and write HTML/JUnit plus `artifacts/contract-coverage.json`; the wrapper rejects missing operation/status coverage across the three live OpenAPI providers. The package suite builds and independently executes a packed consumer, without publishing.

The browserless security suite checks missing certificates/private CA, wrong hostname, ID-token misuse, forged identity headers, private backend bypass, parallel user contexts, cross-customer order ownership and shopkeeper writes. Its separate Compose profile mounts only three human identity leaves and public trust. Reports are local and gitignored. A containerized artifact scanner rejects credential-like filenames and text after teaching/contract runs. Review videos before sharing; they show synthetic shop data and may show an authorization redirect in the browser. Traces, HAR, `storageState`, private keys, PKCS#12 and secrets are not exported. See [coverage status](../docs/teaching-coverage.md) for test-plan IDs and remaining negative/parallel checks.
