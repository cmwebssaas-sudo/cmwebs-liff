# CMWebs Current State

Last updated: 2026-07-27 (Asia/Taipei)

Status convention: values below are the **last verified serving state**, not a
claim that a new live inspection occurred during this documentation-only change.

## Serving Production baseline

| Surface | Last verified state | Evidence |
| --- | --- | --- |
| Apps Script Web App | Immutable **Version 82** serving through the existing Web App deployment. | Verified operational-filter deployment evidence, 2026-07-25; current documentation does not duplicate its sensitive deployment identifiers. |
| Apps Script rollback | Immutable **Version 81** retained as the rollback version. | Same 2026-07-25 verified deployment evidence. |
| GitHub Pages | GitHub Pages remains the verified `main` root build; the last repository-contained verified successful revision is `3b48e9b2421a...9a3e`. | [124-CMWEBS-V2-CONTROLLED-PRODUCTION-RELEASE.md](124-CMWEBS-V2-CONTROLLED-PRODUCTION-RELEASE.md) and [release result manifest](../release-manifests/cmwebs-v2-production-release-result.json). |
| GitHub Pages rollback | Previous verified successful revision: `28767ded0f5c...1fee`. | Same Phase 124 release evidence. |
| Version 82 frontend relation | No GitHub Pages publication accompanied the Version 82 backend update. | Verified operational-filter deployment evidence, 2026-07-25. |

Before any release, rollback, support conclusion, or Production change, repeat
the appropriate authenticated, read-only verification. Historical values in
this file must never be treated as authority to deploy.

## Current product baseline and next approved phase

- **Current baseline:** V2.0 internal Production operations, with completed
  rental-management, billing, arrears, reminders, repair, contract, team,
  RBAC, Workspace isolation, and LINE flows.
- **Next approved phase:** V2.1 Internal Operations Completion. Its scope is
  performance consolidation, fixed graphical operational reporting, a standard
  digital contract workflow, and defined operational-stability completion.
- **Entry condition:** V2.1 is planned, not an authorization to begin feature
  implementation. The current Production Consolidation/Gate 0 requirements in
  `AGENTS.md` remain the engineering entry gate.
- **Exit condition:** after approved V2.1 scope is complete,
  `V2_FEATURE_FREEZE = FINAL`; later V2 work is only genuine Production
  blockers, correctness fixes, and stability repairs.

## Latest verified operational result

The last manual landlord UI verification after Version 82 recorded:

- 18 managed rooms and 18 active tenants;
- 15 paid tenants and 3 arrears tenants;
- 0 pending contract requests; and
- inactive room 603 removed from operational views while its historical record
  was retained.

The underlying correction retired the synthetic room-603 termination request;
it did not send a LINE notification. This is an operational release result, not
a replacement for current UI or data verification.

## Outstanding operational issues and work boundaries

1. **Production Consolidation/Gate 0 remains the entry gate.** No V2.1 feature
   implementation begins until its requirements are met and work is separately
   authorized.
2. **V2.1 performance consolidation is planned.** Follow the authoritative
   roadmap: instrumentation, safe LIFF-initialization reduction, intentional
   page bootstrap requests, short Workspace caching, stable release-version
   cache keys, and fewer full-Sheet scans. See
   [68-RUNTIME-PERFORMANCE-AUDIT.md](68-RUNTIME-PERFORMANCE-AUDIT.md).
3. **Tenant real-device evidence is historical and incomplete.** The older
   report contains unretested P0 failures/blockers; it must be reconciled with
   the Version 82 serving identity before it is used as a present release
   blocker. See [39-TENANT-REAL-DEVICE-RESULTS.md](39-TENANT-REAL-DEVICE-RESULTS.md).
4. **Production facts are time-sensitive.** Apps Script version, Page revision,
   Sheet state, deployment binding, triggers, Properties, and LINE state must
   be independently rechecked before action.

## Repository state at this documentation update

This repository has pre-existing, unrelated dirty runtime and documentation
changes. This documentation task neither classifies nor incorporates them. The
local documentation commit for these five files is deliberately path-scoped.

## New-conversation handoff

```text
Project: CMWebs 智能租管 / cmwebs-liff
Read AGENTS.md plus docs/CMWEBS_{PRODUCT_ROADMAP,CURRENT_STATE,
ARCHITECTURE_DECISIONS,RELEASE_RULES,CHANGELOG}.md first.

Known last-verified serving state: Apps Script v82, rollback v81; Pages last
repository-contained verified revision 3b48e9b... (no Pages publish with v82).
Treat these as historical evidence and re-verify before any Production action.
Classify the request V2.0/V2.1/V3/V4. V2.1 needs Gate 0 completion and separate
authorization; V2.0 accepts only blockers, correctness, and stability repairs.
Recommend a Codex model and speed before beginning work.
```
