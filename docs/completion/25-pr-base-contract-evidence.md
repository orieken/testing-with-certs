# TEST-04 — Actual PR-base contract evidence and reconciliation

Observed 2026-10-10 America/Chicago; GitHub timestamps are 2026-10-11 UTC.
Local host: macOS arm64 Docker Desktop. Contract mutation/generation used the
existing linux/amd64 workspace container; actual PR comparisons ran on native
GitHub-hosted Ubuntu 24.04 (runner image 20261004.327.1). All builds/tests and
schema generation ran in containers. No app, TLS, identity, auth, routing,
production contract, workflow or Saturday checkout was changed.

## Actual PR-event controls

All three use committed main **86166d6d36db1d18e35fabadedf539b48392dac4**.
The base contains all three bundles; the first-baseline skip did not apply.
The workflow archives that exact base's `contracts/bundled` and passes it to
`infra/check-openapi-breaking.mjs`. Default checkout tests the simulated PR merge,
not an assumed local HEAD. This matches [GitHub's documented pull-request event
semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).
Run/job/step metadata and job logs were inspected using the
[workflow jobs API](https://docs.github.com/en/rest/actions/workflow-jobs).

| Control | PR / head / simulated merge | Native comparison evidence |
| --- | --- | --- |
| Unchanged canonical contracts | [Draft PR 1](https://github.com/orieken/testing-with-certs/pull/1); head `d637aa7176ba1d90a13ff55a79edfd40ffed9018`; merge `ed8614356a7b8dc18775f1466341de837f1ae5c6` | [Run 38112441452, workspace job 114390624735](https://github.com/orieken/testing-with-certs/actions/runs/38112441452/job/114390624735): comparison success at 04:43:16Z |
| Add unused `Test04AdditiveProbe` component schema | [PR 2](https://github.com/orieken/testing-with-certs/pull/2); head `6fe255f86916444941b1b4db4ec67663f018574e`; merge `52c851a04f5d5c6a6266a1514a9b433ab7510a33` | [Run 38112498737, workspace job 114390794026](https://github.com/orieken/testing-with-certs/actions/runs/38112498737/job/114390794026): comparison success at 04:44:26Z; entire workspace job success |
| **Intentionally breaking** Item.name maxLength 120 →119 | [PR 3](https://github.com/orieken/testing-with-certs/pull/3); head `11d590b699a94a749bc2c5a6030006b6fc3d5b02`; merge `4722f8eb720705b775930f2805ceb339fe45356d` | [Run 38112499878, workspace job 114390797178](https://github.com/orieken/testing-with-certs/actions/runs/38112499878/job/114390797178): build/test success, comparison failure at 04:44:23Z, exit 1: `catalog: schema Item changed or removed` |

The two successful logs contain the comparator's three-service PASS statement and
exact `BASE_SHA`. The negative control reached the comparison after the pinned
workspace build, typechecks, canonical drift/inventory/validator and unit checks
passed. Thus stale generation or another static failure did not substitute for
breaking-change rejection. Bundles/types/digests were regenerated for each probe.
The added schema claims no new endpoint/provider capability; it only proves this
additive component case. The comparator is deliberately conservative: changes to
existing structural schemas are flagged, not classified with a complete semantic
compatibility algorithm. Existing comparator units additionally test additive
operations, authentication/origin changes and removed responses; those units are
not credited as additional native PR controls.

## Commands, pins and local isolation

Repository root, unchanged control:

```sh
git fetch origin main
git diff origin/main -- contracts
gh pr create --draft --base main --head codex/test-02-native-certificate-password \
  --title 'TEST-04: unchanged PR-base contract control' --body-file /tmp/test04-pr-body.md
git worktree add -b codex/test-04-additive /private/tmp/test04-additive d637aa7
git worktree add -b codex/test-04-breaking /private/tmp/test04-breaking d637aa7
```

Bodies described each mutation/expected result, required no merge and clearly
labelled the breaking control. The two experiment worktrees were independent of
the active checkout. They contained source only, no generated PKI or credentials.
Each generator invocation was `docker run --rm --platform linux/amd64 --network
none --entrypoint node --mount type=bind,source=<worktree>,target=/experiment
magic-shop-ci-workspace:12 --input-type=module -e '<mutation and generation>'`.
Exact mutation/generation code (run once with each recorded mode/worktree):

```js
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const p='/experiment/contracts/openapi/catalog.yaml';
const s=JSON.parse(readFileSync(p));
// Additive control:
s.components.schemas.Test04AdditiveProbe={type:'object',additionalProperties:false,
  required:['label'],properties:{label:{type:'string',maxLength:40}}};
// Breaking control instead of the additive line (deliberately invalid compatibility):
// s.components.schemas.Item.properties.name.maxLength=119;
writeFileSync(p,JSON.stringify(s,null,2)+'\n');
const r=spawnSync('node',['/experiment/infra/contracts-tooling.mjs','generate'],{
  env:{...process.env,PATH:'/work/contracts/node_modules/.bin:'+process.env.PATH},
  stdio:'inherit'});
process.exit(r.status??1);
```

Both generation commands returned `PASS: generate three bundles, three TypeScript
declarations and digests`. Local image exact ID:
`sha256:0ee8a031c176972fbe2c925bada58f24c222eef98b1ff5ed49a6c344c5023522`.
Verified Node 24.10.0, Redocly CLI 2.58.1 and openapi-typescript 7.13.0;
base `node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9`.
Native workflow uses the same pinned Node base and pnpm 12.9.1.
No installation/build/test ran on the host. No test network, tokens or profiles
were needed for the offline generators; ordinary native regression jobs retained
the existing volume/private-network/verified-TLS boundaries.

```sh
git -C /private/tmp/test04-additive add contracts
git -C /private/tmp/test04-additive commit -m 'test: additive contract schema PR-base probe'
git -C /private/tmp/test04-breaking add contracts
git -C /private/tmp/test04-breaking commit -m 'test: breaking Item name limit PR-base probe'
git -C /private/tmp/test04-additive push -u origin codex/test-04-additive
git -C /private/tmp/test04-breaking push -u origin codex/test-04-breaking
gh pr create --draft --base main --head codex/test-04-additive \
  --title 'TEST-04: additive contract PR-base control' --body-file /tmp/test04-additive-body.md
gh pr create --draft --base main --head codex/test-04-breaking \
  --title 'TEST-04: deliberate breaking contract PR-base control' --body-file /tmp/test04-breaking-body.md
# Metadata and logs, repeated for all three run/job IDs in the table:
gh run view 38112441452 --json jobs,conclusion,url
gh api repos/orieken/testing-with-certs/pulls/1 \
  --jq '{number,head:.head.sha,base:.base.sha,merge_commit_sha,draft}'
gh api --allow-escape-sequences repos/orieken/testing-with-certs/actions/jobs/114390624735/logs \
  > /tmp/test04-unchanged-job.log
```

API access initially failed under restricted network execution and succeeded with
authorized network execution. An early attempt to read an unfinished job log
returned 404; a completed-job retrieval succeeded. Escape-sequence output required
the CLI's explicit flag. These attempts are not acceptance evidence. Raw job logs
were kept in temporary files, not exported as project test artifacts.

## Remove deliberate mutations and verify cancellation cleanup

After the completed comparison jobs were captured, redundant broad regression
runs on the disposable controls were stopped. These are **cancelled runs**, not
full green workflows. The breaking PR run completed with failure as intended;
both downstream live jobs were skipped by the existing dependency ordering.

```sh
gh run cancel 38112498737
gh run cancel 38112488702
gh run cancel 38112489458
gh pr close 2
gh pr close 3
git -C /private/tmp/test04-additive revert --no-commit 6fe255f
git -C /private/tmp/test04-additive commit -m 'test: remove additive contract probe [skip ci]'
git -C /private/tmp/test04-breaking revert --no-commit 11d590b
git -C /private/tmp/test04-breaking commit -m 'test: remove breaking contract probe [skip ci]'
git -C /private/tmp/test04-additive push
git -C /private/tmp/test04-breaking push
git diff --exit-code d637aa7 codex/test-04-additive -- contracts
git diff --exit-code d637aa7 codex/test-04-breaking -- contracts
```

Restore commits are `fa9409b` and `7b11c6b`; both final branch trees equal `d637aa7`
for contracts. PRs 2/3 are closed, never merged. PR 1 remains draft for review.
Existing integration disposal steps and both certificate/password project resource
verification steps succeeded after cancellation in all three cancelled runs
(04:45:21–26Z). Integration's disposal command is successful down/volume cleanup;
it is not an independently enumerated remote-resource audit. Certificate/password
cleanup explicitly verifies no scoped containers, networks or volumes remain.
The cancellation probes do not establish new consumer/fault CI coverage.

## Reconcile current evidence without rewriting history

[Existing native workflow 38097316475](https://github.com/orieken/testing-with-certs/actions/runs/38097316475)
at `ef3207e` passed all static/build jobs, live contracts/security, eight branded
browser/customer-admin selections, the separate 36-case certificate/password
matrix, approved readable/scanned text upload and cleanup. Its PR comparison was
skipped because the event was push; it cannot replace the controls above.
The broader push run 38112269311 and unchanged PR run were still in progress when
these comparison observations were recorded; no new full green result is inferred.

Current TODO, checklist, coverage matrix and workflow explanation now cite this
native evidence instead of repeating earlier failed-upload/HTTP2 or deferred-login
claims. Earlier completion notes and the original audit table remain historical.
CONTRACT-03 and TEST-04 are observed; required-status coverage has explicit
exclusions, not an assertion that every possible response was executed. OPS-01 is
partial: fresh volumes/repeat startup are observed, literal clean-checkout repeat
is not. Manual Linux viewer/operator, TEST-11 consumer/fault native gates, separate
local-only regional/fault scenarios and timestamp precision follow-up remain open.
No mock success is credited as authentication, API authorization or live provider
conformance, and no PR was merged or application deployed.

Final documentation checks: 118 local links passed in the pinned offline workspace
container; the updated CI Mermaid block `workflows-10` rendered with
`ghcr.io/mermaid-js/mermaid-cli/mermaid-cli@sha256:a6fb0574dded4086888b5e38476899c9aff8963196f689f11a0f8fceee588ce1`.
The first render selected the unchanged ninth block; the corrected tenth-block
render also passed. `git diff --check` passed and the diff over apps/packages/
services/infra/workflows/contracts is empty. Both clean temporary worktrees were
removed with `git worktree remove`; restored remote probe branches retain the
recorded history. Reconciliation documentation remains local until committed.
