# Authentication recording acceptance

Recording is implemented for every shared protocol baseline/lifecycle case in Chrome/Edge and Playwright/Cucumber, including fresh contexts, popup pages, and Kerberos persistent profiles. The inventory is unchanged: 260 authentication executions plus 36 separate certificate/password executions. All 296 required authentication/certificate-password executions now have accepted recordings across Chrome/Edge and Playwright/Cucumber.

The context-level helper records 1280×720 WebM pages and exports allowlisted case, auth type, browser, runner, phase, spec, normalized result, and relative video paths. Provider documents are hidden with a pre-paint privacy stylesheet; a neutral screen replaces credential pages while real locators and protocols remain active. Shop/lesson UI stays visible. Browser video contains no browser chrome or network inspector. Private API refresh checks remain represented by their surrounding browser journey and case result, not by filmed request/token bodies. The manual certificate/password command retains its existing non-report mode; automated recording uses `LAB_PASSWORD_REPORTS=1`.

A real-browser privacy probe uses a synthetic bright-red provider document containing a fake private value. Its input stays actionable, and every decoded frame is checked for leaked provider pixels using the bundled Playwright video decoder and PNG reconstruction. This check passed locally and is required before the full protocol runner. Initial attempts to locate/use the pinned decoder failed without producing acceptance credit; the working probe uses its installed FFmpeg PNG output. No real credentials are used by this probe.

The recording index gate requires every expected test result to have exactly one recording manifest and at least one nonempty video. It checks actual result provenance, browser/runner/phase/method/name, privacy metadata, duplicate/missing entries, and confined regular file paths. Successful gates write per-case video indexes and a portable recording matrix. The gallery reads these exact associations. `./lab operator matrix-merge TARGET.json RECORDING-MATRIX.json [...]` merges selections without rerunning tests or duplicating already-imported report directories. Existing report scans remain required.

The final accepted recording source is `907c3279b9be6fd25192215df0a363d79bc12872`; counts, provenance, and earlier partial-run history are recorded below.

The first local recording run stopped after 78 passes at the OIDC refresh case’s exact `expires_in === 20` assertion. It is partial evidence only; cleanup and teardown completed. The shared lifecycle check now separately requires an exact 20-second JWT `exp - iat` lifetime and a positive integer reported remaining lifetime no greater than 20. Unit controls reject wrong issued lifetimes, expired responses, and oversized/noninteger remaining values. This avoids treating an elapsed response second as a changed server policy; raw token values were not exported, so the original response value is not claimed as observed. The initial native run at `6fc15e6` is retained as pre-correction history; final acceptance uses the subsequent source.

## Accepted capture evidence

Native [run 39100485175](https://github.com/orieken/testing-with-certs/actions/runs/39100485175) passed all **15 jobs** at `907c327`: **212/212 protocol**, **48/48 Password/TOTP**, and **36/36 separate certificate/password** executions. Downloaded protocol reports independently passed the exact-count gate, recording gate (**212 cases, 296 videos, 36 selections**), and credential-artifact scan (935 entries). Downloaded Password/TOTP reports passed their case/recording gates (**48 cases, 56 videos, eight selections**) and scan (210 entries).

The native certificate/password tests and recording gate passed, but the old upload step retained only 12 text reports. Its videos are not claimed as downloadable evidence. The current report uses the independently verified local run `magic-shop-password-video-20261018`: **36/36 cases, 68 videos, four selections**, with the recording gate and scan (166 entries) passed. Its runner and teardown exited successfully; independent Docker queries found no remaining project containers, volumes, or networks. The workflow upload path is corrected to retain the complete scanned folder on future runs; that upload-path edit is separate from the accepted runtime source above.

The corrected ordinary local protocol run `magic-shop-auth-video-fixed-20261018` also passed **212/212 cases**, the recording gate (**296 videos / 36 selections**), and scan (935 entries). Policy/account/session restoration passed after each group and on exit. The runner exited successfully, and independent Docker queries found no remaining project resources. Its recordings are included as a separate accepted run, not additional distinct test behaviors.

Both Chrome and Edge passed the real-browser, all-decoded-frames privacy probe against the same masking helper. The Edge probe used a private local variant of the Chrome script with only the channel changed. No privacy implementation change was needed. A separate numeric frame analysis of an actual captured OTP enrollment video decoded 52 frames and confirmed 14 full privacy-screen frames, without displaying or exporting its provider frames. Twenty-two focused Node checks and all operator tests passed; the native operator built, shell syntax and whitespace checks passed. No retries or authentication bypasses were added.

## Combined report

The existing gallery now has **112 selections and 1,128 video files**. This is 412 legacy files plus 716 newly imported files: 296 native protocol, 296 repeated local protocol, 56 OTP, and 68 local certificate/password recordings. Counts include multiple pages, repeated runs, report copies, and skipped legacy recordings; they are not unique case counts. The required new capture inventory remains 296 executions, all represented by accepted recordings.

| Authentication type | Combined video files |
| --- | ---: |
| Certificate / mTLS | 412 |
| Certificate + password | 68 |
| Password + TOTP | 56 |
| Passkeys / WebAuthn | 176 |
| External OIDC | 80 |
| SAML | 176 |
| Kerberos / SPNEGO | 160 |

Every emitted video link was independently resolved to a real saved file, and the generated report passed its credential-artifact scan (three report files). Browser checks confirmed every auth filter has recordings, new Cucumber SAML recordings have exact associations with zero unlinked cases, and an imported 47.08-second SAML session recording reaches media ready state 4 and plays. The refreshed gallery was left open; preview `/private/tmp/all-auth-recordings-report.jpg`.

Accepted artifacts are under `artifacts/auth-lessons/native-video-39100485175/`, `artifacts/auth-lessons/magic-shop-auth-video-fixed-20261018/`, `artifacts/password-otp/native-video-39100485175/`, and `artifacts/certificate-password-ci/magic-shop-password-video-20261018/`. The combined report remains at `artifacts/matrix/20261014T131439-794930000Z-os-all-browser-all-runner-all-user-all-suite-all/matrix.html`.

Legacy certificate-shop Cucumber recordings still lack exact scenario associations. Per-case unavailable/expired-file presentation also remains a follow-up; current capture gates reject missing recordings rather than presenting them as complete. Virtual-passkey, controlled-provider, Linux-browser, and manual/platform limits from earlier completions remain unchanged.
