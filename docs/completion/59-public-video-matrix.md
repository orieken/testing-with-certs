# Complete native evidence and public video matrix

2026-10-19 (America/Chicago).

The [public video matrix](https://orieken.github.io/testing-with-certs/) is deployed from publication commit `11b2fed3333e48340267c467944ccfe72b2483c6`. Full native [run 39357933655](https://github.com/orieken/testing-with-certs/actions/runs/39357933655) passed **all 19 jobs in attempt 1** at runtime source `1d8efddba2bd5cd179e6fea1c71c2739c40335f2` on `codex/publish-video-matrix`.

The fresh report contains **92 recording selections, 952 videos and 224 approved evidence files**, with spec/scenario names, result badges, authentication filters and CI provenance. It excludes the accumulated historical local gallery. Its [evidence index](https://orieken.github.io/testing-with-certs/evidence/index.html) and [run provenance](https://orieken.github.io/testing-with-certs/test-run.json) remain available after native artifact retention expires.

## Observed acceptance

| Suite | Executions | Recording selections | Videos |
| --- | ---: | ---: | ---: |
| Passkey/OIDC/SAML/Kerberos protocols | 212 passed | 36 | 296 |
| Password/TOTP | 48 passed | 8 | 56 |
| Authentik OIDC/SAML baseline and lifecycle | 104 passed | 16 | 120 |
| Separate certificate/password lesson | 36 passed | 4 | 68 |
| Debian certificate-shop browser matrix | Applicable persona cases passed; expected skips labeled | 14 | 206 |
| UBI9 certificate-shop browser matrix | Applicable persona cases passed; expected skips labeled | 14 | 206 |

The dedicated authentication inventory passed **400/400 executions**. Build/unit, contract/security, fault, mock-consumer, regional and ordinary shop-browser checks are additional. The final gate requires both OS recording jobs and the independent evidence jobs; an ordinary push-only or partial run cannot satisfy publication acceptance.

The 952 media files comprise **784 passed and 168 skipped result associations**. Teaching tests that do not apply to the selected persona retain their explicit skipped result, including any saved clips. Multiple pages and byte-identical HTML-report copies also remain separate files. These numbers are not a count of unique scenarios or 952 distinct passes.

## Independent evidence and public verification

All 12 artifact families were downloaded under `artifacts/full-evidence/39357933655`. Exact protocol/OTP/certificate/password inventories and all 104 authentik cases were independently rechecked. Browser inventories verify exactly 14 supported selections per OS, environment metadata, statuses and recordings. Authentik receipts confirm restored provider-group membership and removal of users, keys, database and project resources. Both browser bundles include independently verified disposal receipts. All five consumer/fault/regional manifests retain successful primary and intentional-failure cleanup outcomes with their original source labels; mock results cannot substitute for live authentication evidence.

Independent scans checked **2,770 raw artifact entries**. The portable site contains **1,275 files**, **98,035,546 video bytes** and **102,224,168 total bytes**; its largest file is 1,792,788 bytes. The final pinned-container check verified 92 passing selections, all 952 video files, every local HTML link, approved file types, size limits, credential-safe text and absence of symlinks. It scanned **1,484 site entries**. Gallery HTML/JSON contain no private host paths.

`matrix-site` copies only verified media and allowlisted case/selection fields. Raw source HTML archives, arbitrary logs, credentials and source diagnostic strings are excluded. `pages-evidence.mjs` requires the exact successful 19-job inventory before adding approved text evidence and provenance. Provider documents are hidden before paint by the recording harness; text scanning alone does not establish visual privacy.

GitHub Pages reports the expected publication commit as built, from `gh-pages` at `/`, with HTTPS enforced. Anonymous HTTPS retrieval returned the correct run ID, runtime commit, 19 job results and 224 evidence files. Real Chrome **155.0.8059.84** and Edge **154.0.4258.62** each loaded the public report, verified 92 selections/952 cards, filtered SAML correctly, decoded a public video and advanced playback, with zero page errors. Local verification records are in `artifacts/pages-verification/`; the report is staged in `artifacts/pages/39357933655`.

## Corrections found by full-run testing

Initial [run 39354987750](https://github.com/orieken/testing-with-certs/actions/runs/39354987750), source `5d16876`, failed one of 14 Debian selections, all UBI9 selections and integration contracts. Its protocol, OTP, authentik, certificate/password and independent fault/consumer jobs passed, but that run is not publication acceptance. Success-only recording upload did not retain the first failed Debian selection's detailed report; its underlying cause remains unestablished. Later fresh complete passes do not establish historical causality. Integration failure context triggered the credential scanner and was correctly blocked from upload.

Diagnostic [run 39356478914](https://github.com/orieken/testing-with-certs/actions/runs/39356478914), source `92d5235`, exposed a fresh native package conflict: CentOS Stream OpenSSL attempted to overwrite the pinned Red Hat FIPS provider. Stream repositories now exclude `openssl*`, retaining the Red Hat OpenSSL/FIPS package set while preserving package signatures and TLS checks. A fresh local rebuild and the accepted native UBI9 matrix passed. UBI9 remains experimental and records its rolling package/browser versions.

The same run showed that database verification recreated PostgreSQL immediately before contracts, disrupting API connections. Verification now uses `--no-deps`; CI requires an unchanged database container ID and healthy services afterward. Moving package builds ahead of startup alone had not fixed that issue. Runner builds now also precede live startup, exposing dependency failures directly.

[Run 39357206195](https://github.com/orieken/testing-with-certs/actions/runs/39357206195), source `4c35bb4`, verified the repaired native UBI9 build, all 14 Debian selections and unchanged database identity, then exposed two new CI invocation errors. The health command needed `./lab operator healthcheck`, and the scanner needed `/work/artifacts/.`. Both were corrected without weakening the checks. Superseded diagnostic workflows were cancelled; their partial recordings are excluded. The final source passed the entire workflow without a failed-job retry.

External-account providers, physical authenticators and manual-only checks remain deferred. The PR-only committed-base comparison is not applicable to this manual dispatch; historical acceptance is recorded in completion 25. Existing product and reporting-precision TODOs remain open. Suggested next increment: automate publication after a successful full-evidence run.
