# Recording availability and future Cucumber associations

2026-10-18 (America/Chicago).

The gallery can rebuild partial recording bundles. Indexed cases retain exact spec/name/result when a video disappears, display “Missing or expired recording” without a broken player or download, and become playable after restoration. Saved manifest paths survive rebuilds. Available file counts exclude missing entries. Test results remain historical results; missing evidence is not new acceptance. Indexed paths reject traversal and duplicates.

Future certificate-shop Cucumber captures write `video-cases.json` from the actual scenario ID and its page's Playwright video object. The index is finalized after browser closure, with exact feature URI, scenario name and Cucumber result. It does not infer associations from timestamps or file ordering.

Validation: full pinned Go operator tests passed; added missing/restored case rendering and unsafe-index-path checks. The Cucumber hook test passed with duplicate scenario names, distinct IDs, distinct outcomes, and video paths unavailable until browser closure. JavaScript syntax passed. This is hook-level validation; no new live certificate-browser acceptance run is claimed.

The 28 historical Cucumber recordings have no stored scenario-to-video mapping. Their scenario telemetry and feature results contain names but no video filenames. These clips remain explicitly unlinked. A fresh capture can produce new mapped clips; it cannot retroactively establish which historical clip belongs to which scenario. Disabled recording is not inferred from absent files; explicit disabled-state producer metadata remains a follow-up.
