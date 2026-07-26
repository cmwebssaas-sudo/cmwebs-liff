# CMWebs Release Rules

Last updated: 2026-07-27 (Asia/Taipei)

Applies to: all CMWebs V2–V4 source, configuration, and Production releases.

## Product release boundary

- V2.0 releases may address only genuine internal-Production blockers,
  correctness fixes, and stability repairs.
- V2.1 work requires Gate 0/Production Consolidation completion and separate
  authorization. Its permitted scope is performance consolidation, the fixed
  standard reporting set, the standard digital contract workflow, and defined
  operational-stability completion—never customer-specific extensions.
- After `V2_FEATURE_FREEZE = FINAL`, V2 returns to blocker, correctness, and
  stability work only.
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

## V2.1 reporting and contract release rules

- Reporting is one fixed standard set. Do not add custom report builders,
  customer-specific dashboards, or per-customer metrics/layouts.
- Digital contracts must retain the standard generation, review, immutable PDF,
  signed-document upload, version/timestamp/audit history, and billing-
  activation boundaries.
- Do not build a legal electronic-signature evidence system from scratch in
  V2.1. Any e-signature provider integration is a separately approved V3 scope.
- Backups/restore, controlled data correction, incident runbook, and the
  required real operational-flow verification need explicit evidence before
  recording the V2.1 feature freeze.

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
