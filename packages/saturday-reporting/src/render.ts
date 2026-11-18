import { readFileSync } from 'node:fs';
import type { Attachment, Report, Run, Step, TestCase } from './model.js';
import { validateReport } from './validate.js';

export const escapeHTML = (value: unknown): string => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!);
const e = escapeHTML;
function steps(items: Step[]): string {
  return `<ol class="steps">${items.map(step => `<li><span class="badge ${e(step.status)}">${e(step.status)}</span> ${e(step.title)} <small>${step.durationMs.toFixed(0)} ms</small>${step.steps?.length ? steps(step.steps) : ''}</li>`).join('')}</ol>`;
}
function media(attachment: Attachment): string {
  const name = e(attachment.name);
  if (attachment.availability !== 'available' || !attachment.path) {
    const notices = { missing: 'Missing or expired recording', disabled: 'Recording intentionally disabled', omitted: 'Attachment omitted from portable output' };
    return `<p class="notice">${name}: ${notices[attachment.availability as keyof typeof notices] ?? 'Attachment unavailable'}</p>`;
  }
  // Only publisher-generated relative media paths may become links, never arbitrary URLs.
  if (!/^media\/[a-f0-9]{64}\.(webm|mp4|png|jpg|gif)$/.test(attachment.path)) throw new Error('Unsafe portable media path');
  const url = e(attachment.path);
  if (attachment.contentType.startsWith('video/')) return `<div class="recording"><video controls preload="none" playsinline aria-label="${name}"><source src="${url}" type="${e(attachment.contentType)}"></video><div class="card-playback-bar"><div class="speed-btn-group"><button data-speed="1">1×</button><button data-speed="1.5">1.5×</button><button data-speed="2">2×</button></div><button class="btn-theater" data-theater="${url}" data-title="${name}">Theater ⤢</button><a href="${url}" download>Download</a></div></div>`;
  return `<figure><img loading="lazy" src="${url}" alt="${name}"><figcaption><a href="${url}" download>${name}</a></figcaption></figure>`;
}
function card(test: TestCase, run: Run, index: number): string {
  const metadata = { ...run.metadata, ...test.metadata, runner: run.runner, status: test.outcome };
  const suite = test.suite.join(' / ');
  const attachments = test.attempts.flatMap(attempt => attempt.attachments);
  return `<article class="video-card" data-card="${index}" data-labels="${e(JSON.stringify(metadata))}" data-suite="${e(suite)}" data-name="${e(test.title)}">
    <div class="card-info"><div class="card-top"><span class="spec">${e(suite || run.runner)}</span><span class="badge ${e(test.outcome)}">${e(test.outcome)}</span></div><h3 class="case-name">${e(test.title)}</h3><p class="meta">${e(test.location ? `${test.location.file}:${test.location.line}` : '')}</p><p class="meta">${Object.entries(metadata).filter(([key]) => !['runner', 'status'].includes(key)).map(([key, value]) => `<span class="chip">${e(key)}: ${e(value)}</span>`).join('')}</p></div>
    ${attachments.length ? test.attempts.filter(a => a.attachments.length).map(a => `<div class="attempt-media"><p class="media-label">Attempt ${a.index + 1} attachments</p>${a.attachments.map(media).join('')}</div>`).join('') : '<p class="notice">No recording attached. The saved test result is unchanged.</p>'}
    <details class="attempts"><summary>${test.attempts.length} attempt${test.attempts.length === 1 ? '' : 's'} · ${test.attempts.reduce((sum, a) => sum + a.durationMs, 0).toFixed(0)} ms${test.expectedStatus ? ` · expected ${e(test.expectedStatus)}` : ''}</summary>${test.attempts.map(attempt => `<section><h4>Attempt ${attempt.index + 1} · ${e(attempt.rawStatus)} · ${attempt.durationMs.toFixed(0)} ms</h4>${steps(attempt.steps)}</section>`).join('')}</details>
    <p class="run">${e(run.runner)} · run ${e(run.id)} · shard ${e(run.shard)} · ${e(test.id)}</p>
  </article>`;
}
function filters(report: Report): string {
  const values = new Map<string, Set<string>>([['runner', new Set()], ['status', new Set()]]);
  for (const run of report.runs) for (const test of run.tests) {
    for (const [key, value] of Object.entries({ ...run.metadata, ...test.metadata, runner: run.runner, status: test.outcome })) {
      if (!values.has(key)) values.set(key, new Set());
      values.get(key)!.add(value);
    }
  }
  return [...values].map(([key, options]) => `<label class="filter-label">${e(key)}<select data-filter="${e(key)}" aria-label="${e(key)}"><option value="">All</option>${[...options].sort().map(value => `<option value="${e(value)}">${e(value)}</option>`).join('')}</select></label>`).join('');
}
export function renderReport(report: Report): string {
  validateReport(report);
  const css = readFileSync(new URL('./ui/gallery.css', import.meta.url), 'utf8');
  const js = readFileSync(new URL('./ui/gallery.js', import.meta.url), 'utf8');
  const tests = report.runs.flatMap(run => run.tests);
  let index = 0;
  return `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(report.title)}</title><style>${css}</style></head><body>
  <header><div class="brand"><span class="brand-icon">▶</span><strong>Saturday <span class="muted">/ Test reports</span></strong></div><nav class="view-mode-tabs" aria-label="Report views"><button class="view-tab active" data-view="gallery" aria-pressed="true">Visual gallery</button><button class="view-tab" data-view="heatmap" aria-pressed="false">Heatmap &amp; triage</button><button class="view-tab" data-view="inspector" aria-pressed="false">Split inspector</button></nav><div class="nav-links"><a href="report.json">Report JSON ↗</a><button id="theme-btn" class="theme-btn" aria-label="Toggle theme">◐</button></div></header>
  <main><div class="eyebrow">Saturday · Test evidence</div><h1>${e(report.title)}</h1><p class="intro">Scenario results, attempts, steps, and recordings across your test runs.</p><div class="stats"><div class="stat"><span>Tests</span><strong>${tests.length}</strong></div><div class="stat good"><span>Passed</span><strong>${tests.filter(t => t.outcome === 'passed').length}</strong></div><div class="stat bad"><span>Failed / unresolved</span><strong>${tests.filter(t => !['passed', 'skipped', 'flaky'].includes(t.outcome)).length}</strong></div><div class="stat"><span>Flaky</span><strong>${tests.filter(t => t.outcome === 'flaky').length}</strong></div></div>
  <p class="run-status">${report.runs.map(run => `${e(run.runner)} run ${e(run.id)} / ${e(run.shard)}: <span class="badge ${e(run.status)}">${e(run.status)}</span>`).join(' · ') || 'No runs'}</p>
  <div class="toolbar" role="search" aria-label="Filter tests"><input id="search" type="search" aria-label="Search tests" placeholder="Search tests, specs, or metadata…">${filters(report)}<span id="shown" class="shown" role="status" aria-live="polite"></span></div>
  <p class="empty" id="empty" hidden>No tests match these filters.</p><section id="heatmap-view" hidden><div class="heatmap-table-wrap"><table class="heatmap-table" aria-label="Coverage heatmap"><thead><tr><th>Suite</th><th>Runner / platform</th><th>Passed</th><th>Flaky</th><th>Failed / unresolved</th><th>Skipped</th></tr></thead><tbody id="heatmap-body"></tbody></table></div></section>
  <section id="inspector-view" hidden><div class="saturday-inspector"><div id="inspector-rail" class="inspector-rail"></div><div id="inspector-drawer" class="inspector-drawer"></div></div></section>
  <div id="selection-stream" class="grid">${report.runs.map(run => run.tests.map(test => card(test, run, index++)).join('')).join('')}</div>
  <details class="notes"><summary>About this report</summary><p>Test counts represent scenarios, not video files or attempts. Flaky tests passed after an unsuccessful attempt. Each attempt retains its original runner status. Missing recordings retain their test results. Only explicitly attached supported media is copied; raw logs and errors are excluded. Titles, labels, steps, and media are supplied by your tests: review their contents before sharing.</p></details></main>
  <dialog id="theater-modal"><div class="modal-head"><h3 id="theater-title">Recording</h3><button id="close-theater" aria-label="Close recording">✕</button></div><div class="modal-body"><video id="theater-player" controls playsinline></video></div></dialog><script>${js}</script></body></html>`;
}
