# Prompt: build a recorded test evidence report for your test suite

Give this prompt to Claude (or another coding agent) in your own repository. The agent builds a
single-page HTML report of your test runs: a matrix heatmap, a split inspector, and a video gallery.
The report uses the same design as the testing-with-certs browser matrix report
([live example](https://orieken.github.io/testing-with-certs/)).

Send two files to the agent:

1. This prompt, with the dispatch values filled in.
2. The design reference, [`operator/matrix_gallery.html`](../operator/matrix_gallery.html). It is the
   Go `html/template` file that the operator renders into `matrix.html`. Send the file at a fixed
   commit, so the design does not change while the agent works.

---

## Dispatch values

Fill in these values before you send the prompt. Write `unknown` when you do not know a value.

```text
TARGET_REPO       = <absolute path of the repository that gets the report>
REPORT_TITLE      = <brand text for the header, for example "Payments / Test evidence">
RESULT_SOURCES    = <where results are written: Playwright JSON or HTML report, Cucumber JSON, JUnit XML, other>
VIDEO_SOURCE      = <where recordings are written, or "none">
MATRIX_AXES       = <the dimensions of one run, for example os, browser, runner, user, suite>
GROUP_AXIS        = <the heatmap row dimension, for example auth type, feature area, or tenant>
GENERATOR_LANG    = <language for the generator: match the repository, for example TypeScript, Go, Python>
OUTPUT_DIR        = <folder for the report, inside the build artifacts folder>
PUBLISH_TARGET    = <none, CI artifact, or GitHub Pages>
```

---

## The prompt

> You work only in `TARGET_REPO`. Build a generator that reads saved test results and writes one
> self-contained `report.html` to `OUTPUT_DIR`. Also write `report.json` (the manifest) and
> `report.md` (a plain table with a link to the HTML page).
>
> ### 1. Keep the design
>
> Use the design reference file (`matrix_gallery.html`) as the design. Keep its look as it is. Specifically:
>
> - Copy the `:root` and `[data-theme="light"]` CSS custom properties without changes: colors,
>   status colors (`--pass`, `--fail`, `--skip`), radii, and the Inter / JetBrains Mono font stack.
> - Keep dark as the default theme. Keep the theme toggle and its saved choice.
> - Keep the layout: sticky header with brand, view tabs, and links; eyebrow, title, and intro;
>   four KPI stat cards; sticky filter toolbar; one section per matrix selection; card grid; the
>   "About this evidence" disclosure; the theater dialog.
> - Keep the three views and their tab names: **Heatmap & Triage**, **Split Inspector**, and
>   **Visual Gallery**. Keep the view in the URL hash.
> - Keep the video card: spec file, test name, result badge, player with `preload="none"`, speed
>   buttons (1x, 1.5x, 2x), Theater Mode, "Source file" disclosure, and download link.
> - Keep the badge classes `passed`, `failed`, `skipped`, and `unlinked`.
> - Keep the responsive rules: at 800px and below, stack the header, use two stat columns, and hide
>   the inspector.
>
> Change only the content that belongs to the certificate lab:
>
> - Replace the brand text "Certificate lab / Test evidence" with `REPORT_TITLE`.
> - Replace the eyebrow, `<h1>`, and intro with neutral text about this project's test runs. You
>   MAY keep "Every run. A closer look."
> - Do not hard-code the heatmap columns. The reference hard-codes eight columns (Debian/UBI9 ×
>   Chrome/Edge × Playwright/Cucumber). Build the column headers and cells from the `MATRIX_AXES`
>   values that exist in the manifest.
> - Replace the "Authentication Protocol" row axis, the auth pills, and the auth filter with
>   `GROUP_AXIS`. If `GROUP_AXIS` is `none`, use one row named "All tests" and hide the pills.
> - Build the toolbar filters from the axes in the data, not from a fixed list.
> - Rewrite the "About this evidence" text for this project. Keep its honesty statements (see
>   section 3).
>
> ### 2. Data model
>
> The manifest MUST hold, for each selection: every `MATRIX_AXES` value, the `GROUP_AXIS` value,
> the suite status, a run ID, the duration, a link to the native suite report, and a list of cases.
> Each case MUST hold: spec file, test or scenario name, result, video path (or none), and an
> availability state (`available`, `missing`, or `disabled`).
>
> Map raw results to the four report results:
>
> | Raw status | Report result |
> |---|---|
> | passed | `passed` |
> | failed, timedOut, interrupted, ambiguous, undefined | `failed` |
> | skipped, pending | `skipped` |
> | anything else, or no verified link | `unlinked` |
>
> Use the result of each test. Do not copy the suite status to its tests. A passed suite does not
> make a skipped test pass.
>
> ### 3. Honesty rules
>
> - Link a video to a test only from metadata the runner wrote: a Playwright attachment path, a
>   Cucumber embedding, or an equivalent. Do not link by file order, file name similarity, or time.
> - A byte-identical copy (same SHA-256) MAY inherit a link only when exactly one test matches.
>   Otherwise show it as `unlinked`.
> - `unlinked` means "no verified association". It does not mean "failed". Say this in the page.
> - Count video files as video files. Do not show a file count as a test count.
> - Show a missing or expired video as a notice with no player. Keep its saved result.
> - Show "recording disabled" only when the producer wrote an explicit policy file. A missing
>   file alone is not proof that recording was disabled.
> - Rebuilding a report from saved results MUST NOT rerun tests or change saved statuses.
>
> ### 4. Safety rules
>
> - Escape every label in its context (HTML text, attribute, URL, script). Use `textContent` in
>   scripts, never `innerHTML` with test data.
> - Encode video and report links as relative URLs. Reject paths that leave `OUTPUT_DIR` and
>   reject symlinks.
> - Read only the fields in section 2 from runner reports. Do not render raw error text, step
>   logs, traces, other attachments, headers, cookies, or tokens.
> - Do not publish raw native reports. A Playwright HTML report embeds a ZIP of all attachments.
>   For a published site, copy only the video files and an allowlisted cases file per selection.
> - Wrap every `localStorage` read and write in `try`/`catch`. The page MUST work without storage.
> - Put a size limit on each parsed metadata file and on each published video.
>
> ### 5. Fix these defects in the reference
>
> The reference has these defects at the time of writing. Do not copy them.
>
> - The heatmap cell shows "✓" for a failed selection. Show the count with a fail mark and the
>   fail colors. Add a `.heat-cell.fail` style that uses `--fail-bg`, `--fail-border`, and
>   `--fail`, the same pattern as `.heat-cell.pass`.
> - The heatmap counts video cards, not results. Show passed, failed, and skipped counts in the
>   cell title.
> - The inspector status dot uses the skip color for every result that is not `passed`. Use the
>   color of each result.
> - The inspector builds rows with `innerHTML` and test names. Use DOM nodes and `textContent`.
> - The Theater Mode button puts the test name in an inline `onclick` string. Use a `data-`
>   attribute and one event listener.
> - The toolbar uses `top: 59px`. Set it from the header height, or use a CSS variable.
> - Fonts come from Google Fonts. Keep the link, but the page MUST stay readable offline with the
>   fallback font stack.
>
> ### 6. Generator
>
> - Write the generator in `GENERATOR_LANG`. Put the HTML in one template file, not in string
>   concatenation.
> - Give it two commands: build the report after a run, and rebuild a report from a saved
>   `report.json`.
> - Write `report.html` to a temporary file first, then rename it, so a failed build does not leave
>   a half-written page.
> - If `PUBLISH_TARGET` is GitHub Pages, add an export command. It publishes only passing
>   selections, writes `index.html` and `.nojekyll`, and refuses a site over 900 MB.
> - Use the repository's own lint, type, and complexity rules.
>
> ### 7. Tests
>
> Write tests that can fail. Cover, at minimum:
>
> - Exact video-to-test links from runner metadata.
> - A copied video with one match (linked) and with two matches (`unlinked`).
> - A timed-out test shows `failed`. A skipped test in a passed suite shows `skipped`.
> - A missing video shows a notice and keeps its result.
> - A test name with `<script>`, quotes, and `&` renders as text.
> - A path with spaces and `#` produces a working link.
> - A symlink and a `../` path are rejected.
> - The heatmap columns match the axes in a sample manifest with axes other than the reference's.
>
> For each test, state the defect it catches. Break the code on purpose once per test and show
> that the test fails.
>
> ### 8. Visual check
>
> Run the generator on a real saved run. Open `report.html` in a browser at 1440px and 390px
> width, in dark and light themes. Take screenshots. Compare them with the reference design. Play
> one video in each view. Filter by result and confirm that only matching cards show.
>
> ### 9. Completion note
>
> Write a completion note with: files changed, exact commands, the run used, the counts the page
> shows (selections, videos, passed, failed, skipped, unlinked), screenshot paths, and what you did
> not verify. Do not commit, push, or publish unless the repository owner tells you to.

---

## Notes for the person sending the prompt

- The honesty rules come from [completion 48](completion/48-matrix-video-gallery.md) and
  [completion 49](completion/49-matrix-report-style-spec-results.md). The publication rules come
  from the [Pages publication guide](pages-report.md).
- The reference reads the Playwright HTML report's embedded ZIP to find video attachments. A
  Playwright JSON reporter (`reporter: [['json', { outputFile: ... }]]`) is easier to read and
  gives the same attachment paths. Prefer it if you can change the Playwright config.
- Turn on video for the runs you want in the report (`use: { video: 'on' }` or
  `'retain-on-failure'`). With no video, the report still shows results, but every card shows a
  notice instead of a player.
- Turn off recording for tests that show passwords or other secrets, and write the explicit
  "recording disabled" policy file for them.
