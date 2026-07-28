# CMWebs Codex Handoff

**Status: AUTHORITATIVE**

Before work, read `AGENTS.md` and:

- `docs/CMWEBS_PRODUCT_ROADMAP.md`
- `docs/CMWEBS_CURRENT_STATE.md`
- `docs/CMWEBS_ARCHITECTURE_DECISIONS.md`
- `docs/CMWEBS_RELEASE_RULES.md`
- `docs/CMWEBS_CHANGELOG.md`

Start every handoff with a recommended model and speed. Default:
`gpt-5.6-terra`, `medium`.

## Current handoff state

- Gate 0 source consolidation: PASS.
- Canonical V2 internal-beta backend baseline: Version 85 in GitHub `main`.
- Verified Apps Script rollback: Version 75.
- V2.1 may begin only with a separate, explicit scope authorization.
- No historical document proves present Production state; re-verify the
  relevant release surface before action.

## Non-negotiable product rules

One standardized core and upgrade stream serve all customers. Branding can be
configured; functionality cannot be customized. V3 uses each landlord's own
BYO LINE OA; CMWebs does not operate a shared OA for landlord messages.

For V2.1 native contract signing, trust only the backend-derived
`signing_mode`. Normal renewal is signature-only and must not re-run
new-tenant identity onboarding or binding. Treat missing signing-session,
artifact, or final-submit actions as separate backend scope; do not fake a
completed signing result.

## Safe execution contract

Use an isolated worktree, preserve unrelated dirty work, stage only in-scope
files, and test proportionately. Do not deploy, push, merge, change Production
data, Properties, triggers, LINE, LIFF, GitHub Pages, or external accounts
without specific authorization. Never store or reveal secret values.
