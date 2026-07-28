# CMWebs Release Rules

**Status: AUTHORITATIVE**
**Last updated: 2026-07-29 (Asia/Taipei)**

## Scope and authorization

- V2.0 releases contain only Production blockers, correctness fixes, or
  stability repairs.
- V2.1 work requires completed Gate 0 plus separate authorization. It is
  restricted to its roadmap scope; V3/V4 work is prohibited.
- A documentation change, Git merge, or test pass does not authorize deploy,
  data changes, triggers, Properties, LINE configuration, LIFF configuration,
  or GitHub Pages publication.

## Required release discipline

1. Use an isolated worktree and feature branch; preserve unrelated dirty work.
2. Declare product version, scope, recommended model, and speed.
3. Validate affected code and tests; run `git diff --check`; run `npm run
   validate` once when the repository provides it.
4. Record immutable backend version, frontend revision, schema scope, and
   rollback target before a Production change.
5. Create a new immutable Apps Script version for an approved redeploy while
   preserving the existing Web App URL.
6. Treat Apps Script and GitHub Pages as separate release surfaces.
7. Verify Workspace, role, and authorization for every write path.
8. Never include secret values, raw identifiers, bank information, user data,
   tokens, test identities, or Properties in Git or release evidence.
9. Capture a proportionate read-only verification before declaring success.

## Rollback rules

- **Apps Script:** repoint the existing verified Web App deployment to its
  recorded immutable rollback version; do not create a new arbitrary URL.
- **GitHub Pages:** restore the recorded known-good source revision through the
  approved repository workflow.
- **Data:** use a scoped approved recovery plan; do not bulk overwrite Sheets.
- **LINE:** stop the authorized notification path first when an approved
  release causes unintended outbound messages.

## Product rules

Branding is configurable; functionality is not customizable. Every customer
uses the same shared core and upgrade stream. Landlord messaging automation in
V3 uses that landlord's own LINE OA.
