# Automatic publication after full native runs

2026-10-20 (America/Chicago).

Runtime source `50107501153e867c28a0d8b044c97d214e23245c` adds a twentieth CI job, **Publish verified video matrix**, after the 19 native gates. It runs only for an explicit `full_evidence=true` dispatch on `main` or `codex/publish-video-matrix`. Ordinary pushes, pull requests and partial runs cannot publish. [Run 39371444928](https://github.com/orieken/testing-with-certs/actions/runs/39371444928) passed all **20 jobs in attempt 2**, including automatic deployment and public browser verification.

The [public report](https://orieken.github.io/testing-with-certs/) now contains **92 selections, 952 videos and 224 approved evidence files** from this accepted run. The 19 native gates include the exact **400/400 dedicated authentication executions**; the twentieth job independently packages and publishes their evidence.

## Publication boundaries

The publisher checks exact native job names and successful conclusions while binding its active-job validation to the current run ID, source SHA, approved branch and publication attempt. It selects the newest valid artifact from each of 12 evidence families, independently checks inventories and cleanup, scans evidence, merges 92 supported recording selections and exports only approved public files. It rejects missing or expired evidence, wrong-source bundles and duplicate or future attempts.

Pages uses GitHub Actions with pinned official upload/deploy actions. Only the publishing job receives Pages and identity-token write permissions; no personal token or additional account is needed. The deployment environment allows the two approved source branches. The old `gh-pages` snapshot remains available for manual recovery.

Publication is serialized, with an additional public-provenance check preventing an older run or attempt from replacing a newer one. Video paths include the report's run and attempt. A real Chrome/Edge probe waits for matching public provenance, checks selection/video counts and SAML filtering, and verifies decoding and advancing playback with no page errors. Its evidence is retained in a dedicated verification artifact. A post-deployment verification failure makes the job fail; automatic rollback is not implemented.

## Verification

Six focused Node tests passed, covering native-gate enforcement, source/run binding, retry selection, stale-publication rejection, propagation checks and public-file validation. Operator tests cover safe report IDs, relocated links and distinct video paths across exports. A full offline replay of the previous accepted run's actual evidence passed with 92 selections and 952 videos; this replay is separate from native deployment acceptance.

Attempt 1 of the acceptance run encountered Docker Hub HTTP 502 while resolving Authentik's pinned Node image, before its tests started. Seventeen native jobs passed, the final gate failed and publication was skipped. Anonymous retrieval confirmed the previous accepted report stayed live. A failed-job retry at the unchanged source passed Authentik and the final gate, then automatically published. The publisher successfully combined the earlier successful evidence with Authentik's second-attempt bundle from the same run and source.

The live publisher passed artifact selection/download, all independent inventory/cleanup/scanning checks, sanitized export, stale-publication protection, official Pages upload/deployment and public browser verification. Its final site check recorded **103,448,793 bytes** and **1,485 scanned entries**, with all 92 selections and 952 media files accounted for.

Chrome **155.0.8059.84** and Edge **154.0.4258.62** each verified run `39371444928`, source `50107501153e867c28a0d8b044c97d214e23245c` and publication attempt `2`; both counted 92 selections/952 video cards, passed SAML filtering, decoded and advanced a video under the new report-specific path, and recorded zero page errors. Independent anonymous retrieval of `test-run.json` confirmed the same identity, 19 successful native gate entries and 224 evidence files.

GitHub retains `site-check.json` and `public-playback.jsonl` in artifact **pages-verification-39371444928-2**. The downloaded evidence and completed run metadata are saved locally under `artifacts/pages-automation-acceptance/39371444928/`. Publication required no manual export or branch push. The successful retry is observed acceptance, not a claim that the first attempt passed.

See the [publication guide](../pages-report.md) for dispatch, configuration, verification artifacts and manual recovery. External-account providers, physical authenticators and manual-only scenarios remain deferred. Expected persona skips keep their labels and are not counted as unique passed scenarios.
