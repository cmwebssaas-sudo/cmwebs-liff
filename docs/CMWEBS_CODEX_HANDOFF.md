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

- Gate 0 / Production Consolidation: PASS for canonical source reconciliation
  on 2026-08-03.
- Canonical V2 source baseline: immutable Apps Script Version 89 source is
  byte-identical to approved commit `9a17c4b`; PR #12 merged the same tree to
  GitHub `main` as `747b484`.
- This is source-reconciliation evidence only. It does not assert a current
  serving version, deployment state, or rollback version.
- Re-verify the Production account, target project, existing deployment,
  serving version, and rollback target for every Production action.
- The only recorded V2.1 authorization is a local documentation-baseline
  synchronization. V2.1 implementation and any external operation still need
  separate explicit scopes.

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
