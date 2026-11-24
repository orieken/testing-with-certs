# Publish Saturday reporting packages to npm

The [release workflow](../.github/workflows/publish-saturday-npm.yml) prepares and publishes these packages together:

- `@orieken/saturday-reporting`
- `@orieken/saturday-playwright-reporter`
- `@orieken/saturday-cucumber-formatter`

All three share one version. The renderer publishes before its adapters. The Keycloak prototype is outside this release group.

## Validate a release without publishing

Run **Publish Saturday packages to npm** manually in GitHub Actions. Manual runs only prepare and dry-run the release; the publish job runs on version-tag pushes.

```sh
gh workflow run publish-saturday-npm.yml --ref main
```

Preparation runs release-policy tests, builds the pinned verification image, tests standalone tarball installs and browser playback, validates package contents and coordinated versions, and calls `npm publish --dry-run` for each verified tarball. The uploaded artifact `saturday-npm-COMMIT_SHA` contains the tarballs, `release-plan.json`, and `publish-results.json`.

The release plan records the exact tarball SHA-512 integrity. Publishing downloads those artifacts, verifies them against the same source checkout, and does not rebuild them. Publication uses npm 11.15.0, GitHub OIDC, public access, and provenance.

## Configure npm once

Trusted publishing is configured separately for each npm package. The package must already exist on npm, and publisher configuration requires package write access and interactive two-factor authentication. See [npm trust prerequisites](https://docs.npmjs.com/cli/v11/commands/npm-trust/#prerequisites) and [trusted publishing](https://docs.npmjs.com/trusted-publishers/).

The initial package-registration step needs an authenticated maintainer. Download the verified release-preparation artifact and publish its initial tarballs in dependency order:

```sh
npm login --registry=https://registry.npmjs.org
npm publish PATH/orieken-saturday-reporting-0.1.0.tgz --access public --ignore-scripts
npm publish PATH/orieken-saturday-playwright-reporter-0.1.0.tgz --access public --ignore-scripts
npm publish PATH/orieken-saturday-cucumber-formatter-0.1.0.tgz --access public --ignore-scripts
```

These initial maintainer publications use the verified tarballs; subsequent tagged CI releases generate provenance through trusted publishing. Do not place npm credentials in this repository or paste them into a chat.

Then add a trusted publisher to each package using npm's settings or npm CLI 11.15.0 or newer:

| Field | Value |
| --- | --- |
| GitHub owner | `orieken` |
| Repository | `testing-with-certs` |
| Workflow filename | `publish-saturday-npm.yml` |
| Environment | `npm` |
| Allowed action | Direct `npm publish` |

```sh
npm trust github @orieken/saturday-reporting --repo orieken/testing-with-certs --file publish-saturday-npm.yml --env npm --allow-publish --yes
npm trust github @orieken/saturday-playwright-reporter --repo orieken/testing-with-certs --file publish-saturday-npm.yml --env npm --allow-publish --yes
npm trust github @orieken/saturday-cucumber-formatter --repo orieken/testing-with-certs --file publish-saturday-npm.yml --env npm --allow-publish --yes
```

npm may require a browser/2FA confirmation. A new trusted-publisher configuration must complete a successful publication within two days; configure it when the next release is ready. The GitHub environment `npm` permits only `saturday-reporting-v*` tags. This workflow uses no persistent npm token.

## Publish a coordinated version

1. Update all three package versions and each adapter's `workspace:VERSION` core dependency. Update the pnpm lockfile and submit the change through normal CI.
2. Merge the version change to `main`. Wait for **CI** and **Saturday reporting packages** to pass on the exact commit being tagged.
3. Tag that tested main commit and push the tag:

```sh
git tag -a saturday-reporting-v0.1.1 TESTED_MAIN_COMMIT -m 'Saturday reporting 0.1.1'
git push origin saturday-reporting-v0.1.1
```

Use the version from the package manifests. Stable versions publish with npm's `latest` tag; prerelease versions publish with `next`.

The publishing gate requires that the tag matches the manifests, the commit belongs to `main`, and both source workflows succeeded on that exact main push. It waits for in-progress checks, accounting for the repository's 75-minute authentication jobs. PRs, branches, forks, and manual validation runs cannot enter the publish step.

## Verify published npm consumers

Every successful tag publication automatically runs **Clean npm consumer smoke tests** in a separate job without publishing credentials. It waits up to ten minutes for all three exact versions to become visible on npm, then creates three temporary projects outside the checkout with an empty npm cache: Playwright Test, plain Cucumber without Playwright, and browser-backed Cucumber using Playwright's browser library. Runner versions come from the published adapters' exact peer dependencies. Lockfile checks require registry URLs, coordinated package versions, and integrity hashes matching the release plan. Local tarballs, workspace links, and Saturday framework dependencies cannot satisfy the check; the plain Cucumber project also must not install Playwright.

The smoke tests check passing runs, retries, deliberate failures, PNG attachments, recordings and playback in both browser-backed runners, report merging, and offline HTML rendering without JavaScript errors or network requests. Browser Cucumber captures a real 640×360 checkout screenshot and a finalized WebM on every attempt, including failed attempts. Producer SHA-256 receipts must match each scenario/attempt's exported media before and after merging. Every screenshot must decode, and every video must play with valid dimensions and advancing time in its standalone and merged report. The plain Cucumber project retains its lightweight PNG fixture and no browser dependency.

Expected failing fixtures must produce nonzero runner exits, while separate successful runs must exit cleanly. The merged report contains all ten tests from the three projects. The workflow retains consumer sources, lockfiles, command logs, HTML/JSON reports, producer media receipts, media, screenshots, and `summary.json` as `saturday-npm-smoke-RUN_ID-ATTEMPT`, including diagnostic artifacts on failure. A smoke failure makes the release workflow fail even though publication has already completed; it does not remove published versions.

To recheck an existing version without preparing or publishing packages:

```sh
gh workflow run publish-saturday-npm.yml --ref main -f smoke_version=0.1.2
```

For a local run with Node 24 and browser-install permissions, use `SATURDAY_SMOKE_VERSION=0.1.2 node .github/scripts/reporting-release-smoke.mjs`. It installs Chromium and its system dependencies. Set `SATURDAY_SMOKE_SKIP_BROWSER_INSTALL=1` only when a compatible browser runtime is already provisioned. This manual mode verifies registry integrity against the clean install; automatic tagged releases additionally compare it with the verified release-plan artifact.

## Recover a partial release

Rerun the failed tag workflow after resolving the reported problem. It checks all three registry versions before publishing anything. Already-published versions are skipped only if their registry integrity equals the verified tarball; differing bytes fail the release. Network or registry errors also fail instead of being interpreted as an absent package. Published npm versions are immutable: make a new coordinated version for changed contents.
