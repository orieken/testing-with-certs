# Publish the verified video matrix

[Current public report](https://orieken.github.io/testing-with-certs/) · [Accepted run and deployment evidence](completion/59-public-video-matrix.md)

The public report is a static, portable copy of one complete native CI run. It includes authentication and shop recordings, spec and scenario names, result statuses, authentication filters, and links to safe machine-readable evidence. It does not require a running lab or an external provider account.

## Produce fresh evidence

Dispatch `ci.yml` on the source branch with `full_evidence=true`. This adds the complete Debian/UBI9 recording jobs to the ordinary workflow. All 19 expanded jobs must finish successfully, including the final independent evidence gate. A push-only run, partial run, skipped job, or historical capture cannot substitute for this publication run.

```sh
gh workflow run ci.yml --ref YOUR_SOURCE_BRANCH -f full_evidence=true
gh run view RUN --json databaseId,event,headSha,status,conclusion,url,jobs > run.json
gh run download RUN --dir artifacts/full-evidence/RUN
```

Keep the download in its per-artifact directories. Verify both 14-selection browser inventories with `testing/reporting/check-browser-matrix.mjs`. Independently rerun the protocol/OTP inventories and recording indexers, the certificate/password recording indexer, and `testing/reporting/check-authentik.mjs` against their downloaded roots. Confirm project and lifecycle cleanup markers. Scan each downloaded artifact with `scanArtifacts` from `testing/container/check-artifacts.mjs` using `requireMountedPath:false`.

Create an empty passing matrix manifest under `artifacts/`, then use `./lab matrix-merge` to combine the two browser manifests and four authentication recording manifests. The complete configured inventory is 92 selections: 28 shop/browser selections and 64 authentication selections. Multiple videos can belong to one scenario or selection; video count is not a count of unique test behaviors.

## Export and validate

```sh
./lab matrix-site artifacts/full-evidence/RUN/combined/matrix.json artifacts/pages/RUN
node testing/reporting/pages-evidence.mjs finalize artifacts/pages/RUN artifacts/full-evidence/RUN run.json
node testing/reporting/pages-evidence.mjs check artifacts/pages/RUN
```

Run the Node commands in the pinned Node container used by CI when following the repository's container-only workflow. Mount the repository at `/work` and use `/work/...` paths. The operator itself is built in a pinned Go container.

`matrix-site` requires a new destination and copies only nonempty verified video files plus allowlisted spec, scenario, status and selection metadata. It does not copy raw Playwright HTML, embedded report archives, arbitrary logs, credentials, or source machine paths. The finalizer requires exactly the successful full-run job inventory and copies only approved text evidence names. It adds a public provenance record and evidence index.

The final check verifies every local HTML link, exact selection count, video count, file types, absence of symlinks, credential-safe contents and size limits. Limits are 95 MB per file, 900 MB of video and 950 MB for the whole site. Provider login documents are hidden before paint by the recording harness; file scanning alone cannot establish visual privacy.

## Publish

Commit the validated site contents to `gh-pages` using a separate Git work tree. Preserve the existing publication branch history and push without force. Configure repository Pages to build from `gh-pages` at `/`. Wait for the Pages build to succeed, then verify the public index and video playback over HTTPS. The report uses relative links so it works under the repository project path.

Record the source commit, workflow run/attempts, publication commit, actual counts, scan results, public URL and explicit exclusions in the completion note. Generated videos stay on the publication branch; runtime source changes belong on the source branch.

External-account providers and physical-authenticator/manual-only checks remain deferred. Mock consumer evidence remains labeled separately from live provider evidence. A successful full automated run does not close those acceptance items.
