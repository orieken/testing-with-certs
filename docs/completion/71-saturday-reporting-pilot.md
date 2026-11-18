# Saturday reporting — live authentication and native CI

Date: 2026-11-17, America/Chicago.

[GitHub Actions run 44225962468](https://github.com/orieken/testing-with-certs/actions/runs/44225962468) passed both `standalone` and `live-authentication` at source revision `063ec9e6150850b15a1f898959d03e7ec038938c`. The uploaded pilot provenance records a clean checkout at that revision.

## Observed acceptance

| Browser | Runner | Live cases passed | Attached clips played |
| --- | --- | --- | --- |
| Chrome | Playwright | 9/9 | 17 |
| Chrome | Cucumber | 9/9 | 17 |
| Edge | Playwright | 9/9 | 17 |
| Edge | Cucumber | 9/9 | 17 |

All **36 live cases and 68 recording attachments** passed. The pilot uses the existing certificate/password suite against real Keycloak and the shop. Its successful controls and wrong/missing/disabled/unknown/unconfigured credential checks retain their existing TLS, PKCE, signature, identity, session, and API-boundary assertions.

The independent comparison required the exact nine-case inventory per selection, a single successful attempt per case, matching legacy statuses, correct scenario-outline source rows, and recording hashes matching the producer’s case-specific receipts. The combined Saturday report contains four runs and 36 tests. Chrome and Edge each played every clip in their corresponding Playwright/Cucumber selections.

Both browser channels also passed the existing decoded-frame privacy probe. Runner steps are omitted in this credential-sensitive pilot; test names, statuses, timing, and privacy-screened media remain available. Exported text was checked against the actual transient passwords before fixture removal, and both evidence trees passed the existing credential scanner.

Fixture finish and verification succeeded. The cleanup receipt confirms that all project-labelled containers, networks, and volumes were removed. GitHub’s separate cleanup step independently repeated that check before artifact upload.

## Integration fixes verified

- The recording harness now optionally exposes finalized video paths to a producer callback. Playwright and Cucumber attach those exact clips after their browser contexts close.
- `includeSteps: false` prevents credential-bearing runner step titles from entering the pilot report.
- Cucumber needs distinct output destinations for simultaneous formatters. The silent Saturday formatter has its own temporary sink, preserving the legacy baseline formatter.
- Standalone CI returns its container-owned artifact directory to the host user before upload, preserving private report-directory defaults.
- Google’s rolling repository no longer supplied the previous Chrome pin. The exact available signed package is now `158.0.8127.36-1`; Edge remains pinned at `154.0.4258.62-1`. Clean native builds and the live pilot passed with these pins.

## Artifacts and independent inspection

The successful run uploaded `saturday-reporting-packages` and `saturday-live-authentication-44225962468-1`. The former contains all three package tarballs and standalone verification output; the latter contains the four live reports, merged report, privacy-probe screenshots, provenance, verification, and cleanup receipts.

Both artifacts were downloaded independently. The live evidence is retained locally under `artifacts/saturday-auth-native/44225962468/`. Inspection confirmed five report JSON files, all 136 media references across the individual and merged reports, valid media content hashes, existing local HTML links, clean source provenance, and successful cleanup. The downloaded artifact passed the credential scanner at 163 entries; hidden ownership markers are excluded by GitHub’s artifact uploader.

Standalone native verification covered eight core tests, four pilot-comparison controls, twelve Playwright fixture cases, twelve Cucumber fixture scenarios, three packed consumers, real recording playback, empty runs, and graceful interruption. Fixture failures are intentional and checked against each runner’s native results. The repository source-complexity gate also passed.

## Reproduce

```sh
LAB_PROJECT=magic-shop-saturday-UNIQUE sh testing/run-saturday-auth-pilot.sh
```

Use a fresh lowercase suffix. The command starts the real stack, executes both runners and browsers, checks reports and playback, restores its fixture, and removes only its owned project resources. Local Apple Silicon execution uses Linux amd64 emulation; the successful GitHub job used native Ubuntu amd64.

Earlier local attempts are retained separately: the first executed all 36 cases successfully but exposed the missing legacy Cucumber output; the second hit Docker ENOSPC during fixture creation. Both attempts removed their owned resources and retained failure status. Unused BuildKit cache was reclaimed before the final local retry. These failed attempts do not supply the accepted native gate result above.

The final local retry, `magic-shop-saturday-local-20261117-attempt3`, exited 0. It independently passed all 36 cases, all 68 media comparisons and playback checks, both decoded-frame privacy probes, text privacy, fixture finish/verification, and complete project cleanup. Its combined report is retained at `artifacts/saturday-auth-pilot/magic-shop-saturday-local-20261117-attempt3/report/index.html`. This was Linux amd64 emulation on Apple Silicon; the native GitHub result remains separately recorded above.

The branch is `codex/saturday-reporting-pilot`. Packages remain unpublished, and adoption beyond the certificate/password pilot remains separate work.
