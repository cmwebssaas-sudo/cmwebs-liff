# Phase 122A — RC Scope Classification

Date: 2026-07-23  
Status: **UNKNOWN**  
Decision support: **Production Consolidation only**

## 1. Purpose

This document classifies the current release-candidate scope based on the
read-only repository audit and the currently available release evidence. It does
not authorize deployment, push, commit, or Production mutation.

## 2. Evidence snapshot

- Current branch: `codex/cmwebs-project-autopilot`
- Root worktree HEAD: `d4dd7a861ee315ee858572c7835fbfebc07f53da`
- Release worktree: `/private/tmp/cmwebs-v2-rc1`
- Release branch: `release/cmwebs-v2-rc1`
- Release HEAD: `50182b7846903b11155442912eaea2589eac5d0f`
- Dirty worktree counts: modified `37`, staged `0`, untracked `258`, conflicted `0`
- Existing Phase 80 release evidence:
  - `release/phase80/RELEASE-MANIFEST.json`
  - `release/phase80/APPS-SCRIPT-SHA256SUMS`
  - `release/phase80/FRONTEND-SHA256SUMS`
- Existing runtime and release evidence:
  - `release/phase54/RUNTIME-CALL-GRAPH.md`
  - `docs/117-PRODUCTION-RELEASE-CANDIDATE.md`
  - `docs/118-PRODUCTION-ARTIFACT-FREEZE.md`
  - `docs/119-PRODUCTION-ENVIRONMENT-EVIDENCE.md`

## 3. Classification

### 3.1 Current RC scope result

**UNKNOWN**

Reason:

1. The repository contains a large dirty worktree with many pre-existing
   modified and untracked items.
2. A candidate scope can be inferred from the historical Phase 80 boundary, but
   the current worktree has not yet produced a clean, immutable RC artifact.
3. Production environment evidence remains human-required and cannot be inferred
   from local files alone.

### 3.2 What is safe to plan now

The following are safe to plan as RC-preparation work only:

- RC scope classification and manifest drafting
- Read-only reconciliation of existing release evidence
- Exclusion lists for tests, diagnostics, repair, staging, credentials, and
  migration-only modules
- SHA manifest preparation for the exact approved candidate tree once it exists

### 3.3 What remains human-required

- Production Apps Script deployment/version evidence
- Production frontend hosting evidence
- Production trigger inventory and ownership evidence
- Production credential existence/scope evidence
- Schema backup / rollback / migration approval

## 4. Candidate scope basis

The tentative candidate scope is the historical Phase 80 release boundary plus
runtime dependencies that are already evidenced in the current repository
artifacts.

### 4.1 Candidate backend modules

- `程式碼.js`
- `V2_API.js`
- `V2_RUNTIME_SNAPSHOT.js`
- `V2_TENANT_RUNTIME_RESOLVER.js`
- `V2_TENANT_BINDING_PHONE.js`
- `V2_TENANT_LEASE_ONBOARDING.js`
- `V2_TENANT_MESSAGES.js`
- `V2_TENANT_PAYMENT_REPORTS.js`
- `V2_TENANT_CHECKIN_MANAGEMENT.js`
- `V2_BILLING_MANAGEMENT.js`
- `V2_BILL_NOTIFICATIONS.js`
- `V2_AUTO_PAYMENT_REMINDER.js`
- `V2_PAID_BILL_MANAGEMENT.js`
- `V2_PAYMENT_SETTLEMENT.js`
- `V2_PAYMENT_REVERSAL.js`
- `V2_MANUAL_SETTLEMENT.js`
- `V2_CONTRACT_REQUESTS.js`
- `V2_PROPERTY_ROOM_MANAGEMENT.js`
- `V2_SYSTEM_SETTINGS.js`
- `V2_SETTINGS_INTEGRATION.js`
- `V2_WORKSPACES.js`
- `V2_WORKSPACE_CREATION.js`
- `V2_WORKSPACE_LANDLORD_ACCESS.js`
- `V2_WORKSPACE_DASHBOARD_NATIVE.js`
- `V2_WORKSPACE_NOTIFICATIONS.js`
- `V2_WORKSPACE_OPERATION_AUDIT.js`
- `V2_TEAM_MANAGEMENT.js`
- `V2_LANDLORD_MANAGEMENT.js`
- `V2_LANDLORD_ONBOARDING.js`
- `V2_ANNOUNCEMENT_MANAGEMENT.js`
- `appsscript.json`

### 4.2 Candidate frontend modules

- `tenant-bind.html`
- `tenant-home.html`
- `tenant-bills.html`
- `tenant-message.html`

### 4.3 Explicit exclusions

- `TESTS.js`
- `V2_TENANT_RUNTIME_DATA_REPAIR.js`
- `V2_TENANT_RUNTIME_VALIDATION.js`
- `V2_LEGACY_BILL_IMPORT.js`
- staging modules and fixtures
- local clasp credentials and all tokens / secrets

## 5. Recommended next verification

If the candidate scope is accepted, the next step is to produce a frozen
candidate file list and SHA manifest from the approved isolated tree, then
reconcile it against this classification document.

