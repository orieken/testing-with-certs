# Publish the verified video matrix

[Public report](https://orieken.github.io/testing-with-certs/) · [Initial deployment evidence](completion/59-public-video-matrix.md)

## Automatic publication

Dispatch `ci.yml` with `full_evidence=true` on `codex/publish-video-matrix`, or on `main` after the workflow has been merged there:

```sh
gh workflow run ci.yml --ref codex/publish-video-matrix -f full_evidence=true
```

The 19 native build/test/evidence jobs must succeed before the twentieth job, **Publish verified video matrix**, can start. Ordinary pushes, pull requests, partial runs and other branches do not publish. The publisher uses the repository's built-in token and Pages identity permissions; no personal token or external account is required.

The publisher downloads exactly 12 evidence families from its own run and source commit. When failed jobs are retried, it selects the latest artifact attempt for each family, retaining earlier successful artifacts from the same run. Missing, expired, wrong-source or incomplete evidence fails publication. Exact authentication inventories, both 14-selection browser matrices, cleanup receipts, credential scans and the portable export are independently rechecked.

The public report has 92 supported recording selections: 28 certificate-shop combinations and 64 authentication combinations. Spec/scenario names, result statuses and authentication filters are preserved. Multiple pages, HTML-report copies and expected persona skips retain their own labels; video count is not a count of unique passed scenarios.

Publication is serialized across approved branches. A run or publication attempt older than the currently published report cannot replace it. Video paths include the run and publication attempt, preventing a new recording from reusing an old clip's URL. Verified artifacts are deployed with the pinned official Pages actions, rather than pushing credentials or videos from CI into a branch.

After deployment, real Chrome and Edge check the exact public run/source/attempt, selection and video counts, SAML filtering, video decoding and advancing playback, and page errors. A bounded propagation wait rejects stale provenance rather than accepting the previous report as the new deployment. Verification results are uploaded as `pages-verification-RUN-ATTEMPT` and linked in the job summary. Failures before deployment preserve the current report; post-deployment verification failures make the publishing job red.

## Repository settings

Pages uses **GitHub Actions** as its publishing source. The `github-pages` environment permits the `main` and `codex/publish-video-matrix` branches. The existing `gh-pages` policy and initial static branch remain available for recovery; automatic publication does not rewrite that history. Only the publishing job has `pages: write` and `id-token: write`; native test jobs retain read-only repository permissions.

The publisher validates all 19 completed native gates while its own job is still running. This mode is bound to the current GitHub run ID, source SHA, approved branch and publication attempt. No unfinished native job is accepted. Completed-run validation still requires a successful workflow, including the publisher when present. Public provenance lists the 19 native gates; the linked workflow also records the publishing outcome.

## Export limits and privacy

The exporter copies only nonempty verified videos and allowlisted case/selection metadata. Raw Playwright HTML archives, arbitrary logs, credentials and private source diagnostics are excluded. The finalizer copies approved text evidence and generates the public evidence index and provenance.

The final check verifies every local HTML link, the exact selection/video inventory, file types, absence of symlinks, credential-safe text and size limits: 95 MB per file, 900 MB of video and 950 MB total. Provider documents are hidden before paint by the recording harness; text scans alone do not establish visual privacy. Public evidence and clips remain accessible for the current deployment after CI artifact retention expires; the site is a snapshot of the latest accepted run.

## Manual export and recovery

A completed full run can still be exported locally. Save its metadata and download its 12 evidence families, each into its own artifact-name directory:

```sh
gh run view RUN --json databaseId,event,headSha,headBranch,status,conclusion,url,jobs > run.json
gh run download RUN --dir artifacts/full-evidence/RUN
./lab operator status
node testing/reporting/prepare-pages.mjs artifacts/full-evidence/RUN run.json artifacts/operator/bin/magic-shop-operator artifacts/pages/RUN
```

The operator command builds the native operator in its pinned Go container. Run the Node command in the pinned Node runtime from CI, using a Linux operator binary when running inside that container. The evidence directory must contain exactly one selected artifact per family; `pages-artifacts.mjs` selects the latest valid attempts for automation. Export destinations must be new. `PAGES_ACTIVE_RUN` is left unset for completed-run exports.

For manual branch recovery, commit a validated export to `gh-pages` without force and change Pages back to branch publication at `/`. Restore workflow publication before the next automated deployment. The initial accepted snapshot remains in commit `11b2fed3333e48340267c467944ccfe72b2483c6`.

External-account providers, physical authenticators, manual-only checks and unrelated product TODOs remain outside this automatic acceptance. Mock consumer evidence keeps its original source labels and cannot replace live-provider results.
