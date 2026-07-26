# CMWebs Release Rules

Last updated: 2026-07-27 (Asia/Taipei)

Applies to: all CMWebs V2–V4 source, configuration, and Production releases.

## Product release boundary

- V2 releases may address only internal Production operations, blockers,
  performance, reliability, security/isolation verification, regression
  coverage, and operational QA.
- V3/V4 work must not be slipped into a V2 release.
- No release may create customer-specific feature, workflow, field, layout, or
  code branches.
- V3 messaging automation uses each landlord's BYO LINE OA. A shared CMWebs OA
  must never impersonate or send landlord messages; personal LINE is manual
  communication only.

## Required release discipline

1. Start from a feature branch; preserve unrelated dirty worktree changes.
2. State the V2/V3/V4 classification, impact scope, and recommended Codex model
   and speed in the handoff/release plan.
3. Validate source and affected behavior, including `npm run validate` and
   relevant Apps Script tests when code changes.
4. Record immutable backend version, frontend revision, schema scope, and
   rollback targets before Production action.
5. Keep the existing Web App URL when updating Apps Script; create a new
   immutable Apps Script version for each approved Web App redeploy.
6. Keep GitHub Pages and Apps Script release identity separately traceable.
7. Verify Workspace, role, and authorization for every write path.
8. Publish only intentional files; never include tokens, identifiers, bank
   details, personal data, test identities, or Properties in release evidence.
9. Complete read-only smoke/operational verification and capture concise
   evidence before declaring success.

## V2 performance-release rules

Performance changes must be measurable, isolated, and reversible. They must
not weaken RBAC or Workspace isolation. Prioritize instrumentation, one
bootstrap request per page, short Workspace caching, stable build-version cache
keys, and reduced full-Sheet scans. A cache requires an explicit key, scope,
TTL, invalidation rule, and stale-data risk assessment.

## Prohibited without explicit authorization

- Production data, Properties, triggers, LINE settings, credentials, or LINE
  sends;
- deployment, GitHub Pages publication, push, rollback, migration, or external
  account changes;
- destructive schema changes or broad Sheet rewrites; and
- a release conclusion derived only from old documentation or chat history.

## Rollback

- **Apps Script:** repoint the existing verified Web App deployment to its
  recorded immutable rollback version; do not create an arbitrary new URL.
- **GitHub Pages:** restore the recorded prior known-good source revision using
  the approved repository workflow.
- **Data:** preserve evidence and use a scoped, approved recovery plan; do not
  overwrite Production Sheets as a generic rollback.
- **LINE:** stop the authorized worker/notification path first if a release
  creates unintended outbound messaging, then reconcile retained events.

See [08-DEPLOYMENT-RUNBOOK.md](08-DEPLOYMENT-RUNBOOK.md) for the detailed V2
runbook and [CMWEBS_CURRENT_STATE.md](CMWEBS_CURRENT_STATE.md) for last
verified versions. These rules supersede any conflicting informal release plan.
