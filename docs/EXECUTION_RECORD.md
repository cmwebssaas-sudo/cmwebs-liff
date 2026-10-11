# CMWebs Execution Record

This ledger records bounded execution evidence; it does not authorize a release.
Read `AGENTS.md`, `CMWEBS_CODEX_HANDOFF.md`, and its authoritative document set
before the next task. Historical root-checkout records are user WIP and were
not copied into this worktree.

## 2026-10-12 — R0 production records reconciliation

Recommended model/speed: `gpt-5.6-terra` / `medium`.
Classification: V2 documentation and source reconciliation. Runtime unchanged.
Branch: `codex/r0-production-records-20261012`; clean worktree created from
fresh `origin/main` `2a5779f47505ba1c665b2cd172c9ca0b503fc839`.

The root checkout remains `codex/checkpoint-rental-wip-20261010`, HEAD
`be2cefe9e0cfbf575bc8e72e256b4c64f33e7b63`. Its three modified handoff
files and existing untracked files were preserved, with no staging or commit.
The root's execution record and handoff index are absent from current main;
this new ledger records R0 only, without importing stale root history.

### Current evidence

- Authenticated `clasp list-deployments` readback matched the recorded project
  and formal deployment SHA-256 fingerprints. The original Web App serves
  immutable **232**. All five deployment entries were identical before and
  after export; no deployment was changed.
- A fresh immutable v232 export contains **68 files**, all byte-identical to
  `apps-script/` at the main revision above. Its tree SHA-256 is
  `ebf03d14512a3b5767b80b3f4c2d0c31f8ff28d1de74efae9037a791d35e3326`.
  `verify-production-source.mjs --export` passed project, source-count and
  fingerprint checks. Historical backend source commit `1fe0e33` remains
  valid for this unchanged source; the prior UNKNOWN serving note is resolved
  by this fresh readback.
- Immutable versions **229** and **232** are present. The previous release's
  backend rollback is **229**; the baseline for the next backend release is
  current serving **232**. The top-level stale rollback value **228** was
  corrected to **229**, consistent with the existing release rollback record.
- PR [#261](https://github.com/cmwebssaas-sudo/cmwebs-liff/pull/261) merged as
  `4885a0e`; Pages run
  [38121570901](https://github.com/cmwebssaas-sudo/cmwebs-liff/actions/runs/38121570901)
  completed successfully. PR
  [#262](https://github.com/cmwebssaas-sudo/cmwebs-liff/pull/262) merged as
  `2a5779f`; Pages run
  [38151775414](https://github.com/cmwebssaas-sudo/cmwebs-liff/actions/runs/38151775414)
  completed successfully.
- `npm run verify:production` matched **61/61 existing manifest assets** to
  current main, byte-for-byte. The manifest was not expanded to legacy assets,
  and this check does not cover all publicly hosted documents or URLs.
  Current frontend release is **20261011-fast-navigation-v1**; the recorded
  old tag/revision/workflow were updated. Next frontend rollback reference is
  main **2a5779f**.

### Validation and remaining boundaries

- `npm test`: **822 pass / 1 fail / 4 skip**. The sole failure is
  `commercial-subscription.roundtrip.test.mjs`, requiring
  `PLATFORM_CORE_TEST_WORKTREE`. Cross-repository Core/PostgreSQL integration
  was not configured or run; no external database was connected.
- `npm run test:unit`: **822 pass / 0 fail / 0 skip**.
- `npm run validate`, immutable export verification, public readback and
  `git diff --check`: PASS.
- Cloud Apps Script test functions: NOT_RUN; this is documentation-only and
  does not authorize executing a formal function or writing test data.
- Physical LINE, current-build authenticated acceptance, latency/render
  measurement and capacity acceptance: **HUMAN_REQUIRED**. Historical
  measurements remain historical; this task provides no new speed result.
- No merge, deployment, version creation/deletion, Script Properties, trigger,
  Sheets, Cloudflare or LINE change was performed.

### Next work and release control

The plan was read from local branch
`codex/cloudflare-read-path-plan-20261011`, commit
`aeebf7bf2a4893173f1af175ed8a0ade855acbe6`, paths
`docs/CODEX-WORKPLAN-2026-10-12.md` and
`docs/CLOUDFLARE-READ-PATH-PLAN.md`; those files are not yet in main.
Follow **R0 → S1 → C0 → C1…**, with one isolated worktree and PR per work order.
S1 uses privately supplied instructions; no private content belongs in this
ledger, Git, PR descriptions or commit messages.

This R0 PR changes records only. Before merging, obtain the user's action-time
approval: a main merge may run the normal Pages workflow and publish these
records. No Apps Script or Cloudflare release is needed. To undo the record
change, revert this PR through a separately approved main update; do not roll
back runtime or business data for a documentation correction. Recheck the
serving/export/Pages baseline before any later release.

## 2026-10-12 — S1 request compatibility candidate

Recommended model/speed: `GPT-6.1 Sol` / high, as specified by the work plan
for identity and authorization changes. One clean worktree from R0 merge
`37b362c`, branch `codex/s1-verified-identity-20261012`. Root WIP is preserved.

The owner's current batch authorization supersedes the earlier action-time
approval rule for plan-scoped commit/push/PR/merge, deployment and configuration.
New costs, deleting production data, scope expansion and owner-only login,
payment or physical acceptance still require owner action. Private instructions
and owner account checks are kept outside Git.

Candidate: shared LIFF credential transport, corresponding dispatcher
compatibility and stable frontend tag `20261012-line-identity-v1`. Email bridge
and native exchange protocols remain covered by regression tests. No Schema or
route addition. The public asset manifest includes `liff-request-auth.js`; its
serving readback is pending. Existing serving backend remains v232 until a
verified deployment is recorded.

Release order: review and CI, merge this work order's PR, then confirm Pages
bytes. Wait at least 15 minutes after publication and obtain physical LINE
acceptance of the compatible frontend. Export the still-serving backend and
confirm the immutable rollback version before publishing the backend to the
original deployment. Read back editor and immutable version, then verify LINE
and Email reads plus the plan's harmless operation. Until those checks finish,
S1 remains incomplete. Independent C0 preparation may proceed while the
physical gate is pending; it does not satisfy that gate.

Rollback: restore the verified prior Apps Script serving version (currently
v232) on the same deployment; the compatible frontend can remain. If the
frontend itself needs reversal, revert this PR through a reviewed PR and
confirm Pages readback. Do not delete or rewrite business data for rollback.

Independent review required additional credential coverage for existing LINE
POST consumers. The shared principal resolver and direct POST consumers now
use verified identity; their frontend POST data and Email-session compatibility
are covered by real-function synthetic tests. No route or Schema addition.

Local release checks: `npm run validate` passes (69 backend files parsed,
40 endpoint references, stable navigation cache checks). `npm run test:unit`
passes 835/835, no skip. `npm test`: 840 total, 835 pass, 1 known environment
failure and 4 skips; the sole failure is the pre-existing cross-repository
commercial roundtrip requiring `PLATFORM_CORE_TEST_WORKTREE` and a disposable
Core/PostgreSQL environment. No production database was used to replace that
integration fixture. Focused identity tests execute 13 policies, including all
31 standalone JSONP transports and existing LINE POST consumers.

The tenant mutation inventory includes contract-request cancellation and
renewal-intent compatibility alongside submission routes; native exchanges
retain their independent verified protocol. Review remediation and deployment
acceptance remain separate from these synthetic test results.

Independent review completed after remediation: original findings resolved,
no remaining actionable major finding. Reviewer reran 40 relevant tests
(including 13 identity policies), validate and diff-check successfully.
This is source/synthetic acceptance only; staged production checks remain.
