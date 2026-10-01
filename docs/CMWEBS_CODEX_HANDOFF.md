# CMWebs Codex Handoff

**Status: AUTHORITATIVE**

Before work, read `AGENTS.md` and:

- `docs/CMWEBS_PRODUCT_ROADMAP.md`
- `docs/CMWEBS_CURRENT_STATE.md`
- `docs/CMWEBS_V2_1_CODEX_EXECUTION_RECORD.md`
- `docs/CMWEBS_ARCHITECTURE_DECISIONS.md`
- `docs/CMWEBS_RELEASE_RULES.md`
- `docs/CMWEBS_CHANGELOG.md`

Start every handoff with a recommended model and speed. Default:
`gpt-5.6-terra`, `medium`.

## Current handoff state

- Latest verified source/deployment reconciliation: [PRODUCTION-DELIVERY.md](PRODUCTION-DELIVERY.md), 2026-10-01. Apps Script Version 200 exports 59 files byte-identical to reviewed `3e5ba45` (PR #187); existing deployment reads back v200, URL unchanged. Only paper backfill differs from v198. Scoped read-only 506 linkage/status checks confirmed its existing global user was incorrectly looked up as Workspace-owned; canonical global identity reuse and common invitation claim/room guards are repaired. Full tests 313/313, validate and source export pass. Frontend unchanged; 17 public assets match via sequential curl fallback after Node fetch network failure. Real-file upload, paper conversion, tenant binding and real-device acceptance remain unverified. No business rows, private files, Properties, triggers or LINE were mutated during publication. Rollback: Apps Script 198; unserved v199 is superseded and must not be released. The old v160 endpoint in the dirty root is not the current public target. Start from current remote `main`, not the historical dirty root; preserve its WIP and do not create another cloud project. Do not open the unrelated ChatGPT project discussion; the user explicitly removed it from this repair workflow.

- Gate 0 / Production Consolidation: PASS for canonical source reconciliation
  on 2026-08-03.
- Canonical V2 source baseline: immutable Apps Script Version 89 source is
  byte-identical to approved commit `9a17c4b`; PR #12 merged the same tree to
  GitHub `main` as `747b484`.
- This is source-reconciliation evidence only. It does not assert a current
  serving version, deployment state, or rollback version.
- Re-verify the Production account, target project, existing deployment,
  serving version, and rollback target for every Production action.
- Recorded V2.1 local work includes documentation-baseline synchronization and
  an unpushed `landlord_home_bootstrap` request-local snapshot candidate. Both
  remain review candidates, not canonical or deployed source.
- V2.1 integration, push, deployment, Production access, and any external
  operation still need separate explicit scopes.

## Non-negotiable product rules

One standardized core and upgrade stream serve all customers. Branding can be
configured; functionality cannot be customized. V3 uses each landlord's own
BYO LINE OA; CMWebs does not operate a shared OA for landlord messages.

For V2.1 native contract signing, trust only the backend-derived
`signing_mode`. Normal renewal is signature-only and must not re-run
new-tenant identity onboarding or binding. A final submission may record only
the verified, mode-specific signing evidence and must preserve
`contract_status`; it cannot fake approval, activation, or a completed signing
result. Missing session, artifact, content, predecessor-linkage, or explicit
signing-audit schema must fail closed.

## Safe execution contract

Use an isolated worktree, preserve unrelated dirty work, stage only in-scope
files, and test proportionately. Do not deploy, push, merge, change Production
data, Properties, triggers, LINE, LIFF, GitHub Pages, or external accounts
without specific authorization. Never store or reveal secret values.
