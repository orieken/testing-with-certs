# Matrix video gallery

The existing 28-selection certificate-shop browser matrix now writes `matrix.html` beside `matrix.json` and `matrix.md`, updating all three after each suite. Markdown links to the gallery, and the operator's completion output prints its path. The gallery provides an inline native player and download link for every nonempty WebM/MP4 below each suite report directory, including multiple pages and HTML report copies. It groups by OS/browser/runner/user/suite/run and displays each recording's source path. File counts are not unique scenario counts. Videos use `preload="none"` and do not autoplay.

`./lab matrix-report PATH/TO/matrix.json` rebuilds saved reports without invoking tests or changing their historical statuses. New manifest report paths are relative to the manifest; video paths are relative to their report directory. Preserve the artifacts tree layout when downloading or moving it. Old absolute report paths are rebased to the current checkout when their old folders are absent. Missing folders and absent recordings are labeled. Empty recordings are excluded. HTML escapes labels, URL paths are encoded, and discovery rejects symlinks; the rebuild command refuses report paths outside the artifacts tree. Existing credential scans and recording policies remain in force.

## Observed validation

All operator tests passed in the pinned Go 1.26.0 container, including existing execution/failure/cancellation tests and new gallery coverage for multiple recordings, WebM/MP4 extensions, empty files, moved artifacts, old absolute paths, unsafe symlinks/path escapes, escaped HTML, special-character URLs, and actual emitted-link resolution. Shell syntax and whitespace checks passed. The native operator built successfully.

The saved matrix `20261014T131439-794930000Z-os-all-browser-all-runner-all-user-all-suite-all` was regenerated: all 28 selections and **412 recording links** were independently enumerated and verified against existing files. Its three generated report files passed the existing credential-artifact scanner. The in-app browser rendered the gallery and played a certificate-login recording (media ready state 4, duration 2.8 seconds). No authentication test rerun or new matrix coverage is claimed by rebuilding historical reports.

## Remaining scope

REPORT-VIDEO-01A delivers the saved-matrix gallery. REPORT-VIDEO-01B retains the original broader requirements: exact per-case/scenario/phase metadata and safe integration of the separate authentication/certificate-password acceptance suites. Older recordings lack reliable case metadata, so the gallery explicitly associates them with their suite and shows source paths. Authentication/password acceptance currently disables recording to protect credential material and remains outside these 28 matrix selections; the viewer does not silently enable credential-bearing capture. Those gaps remain unchecked in TODO, rather than being represented as completed video coverage.
