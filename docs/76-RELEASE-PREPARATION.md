# Phase 76 — Release Preparation Audit

日期：2026-07-21

狀態：**AUDIT COMPLETE — RELEASE NOT YET APPROVED**

## 1. Audit boundary

本文件以目前 branch `chore/v2-production-consolidation` 的實際 Git 狀態、程式內容與
Phase 文件為依據，整理 Phase 66–75 的 release boundary。本階段只新增本文件，沒有
修改功能、架構、route、HTML、Apps Script、Sheet、manifest 或 deployment。

Repository 中沒有 `docs/66-*` 或 `docs/67-*`，也沒有可由 Git 單獨歸屬於 Phase 66／67
的 source diff。這兩階段若曾執行 deployment 操作，屬 repository 外部狀態；正式
release 前仍須重新從 Apps Script 管理部署介面確認現況，不得只依舊對話或歷史文件。

## 2. Git status summary

稽核時工作樹不是 clean：

- 36 個 tracked files 有修改。
- 72 個 untracked files（以 `git status --porcelain -uall` 展開計數）。
- 其中 34 個 Apps Script files 有修改或為新檔。
- 4 個 repository frontend HTML 有修改。
- 34 個 untracked Phase documents，另有 `docs/39-*` tracked modification。
- `release/phase54` 與 `release/phase57` 保留為 untracked release artifacts。

這些變更跨越 Phase 40–75，不是純粹的 Phase 66–75 diff。尤其：

- `V2_API.js` 與 `程式碼.js` 同時包含 tenant runtime 修正和 Phase 69–71 performance
  integration。
- `tenant-home.html` 同時包含較早的 test query 修正與 Phase 74 lazy loading。
- Phase 71B 將 31 個模組的 Spreadsheet acquisition 改成共同 helper dependency。

因此目前不能把整個 dirty worktree 不經拆分直接視為單一 performance release。

## 3. Release scope

### 3.1 Phase 66–75 intended release units

| Unit | Intended content | Status |
|---|---|---|
| Backend performance | Phase 69 Home read profile、Phase 70 request snapshot、Phase 71B Spreadsheet handle reuse | Implemented locally; not isolated into a current release tree |
| Tenant Home frontend | Phase 74 staged primary/optional render | Implemented locally; not committed/published |
| Audit and verification docs | Phase 68, 69, 69B, 70, 71A, 71B, 72, 73, 74, 75, 76 | Local documentation |
| Phase 66/67 repository files | None identifiable | External deployment state must be checked manually |

### 3.2 Mandatory backend dependency set

These files form one dependency boundary and cannot be partially pushed:

- `apps-script/V2_RUNTIME_SNAPSHOT.js`
- `apps-script/程式碼.js`
- `apps-script/V2_API.js`
- `apps-script/V2_TENANT_RUNTIME_RESOLVER.js`
- Every production module changed to call `runtimeSpreadsheet_()`

`runtimeSpreadsheet_()` has 148 call sites plus its definition in the current canonical source.
Deploying any converted caller without `V2_RUNTIME_SNAPSHOT.js` causes a production
`ReferenceError` before the underlying Spreadsheet operation can execute.

## 4. Changed component classification

### 4.1 API and dispatcher

| File | Phase 69–75 relevance | Release classification |
|---|---|---|
| `apps-script/程式碼.js` | Calls `runtimeSnapshotBegin_(v2Action)` at request start; also contains earlier security/runtime changes | Required backend dependency; mixed-phase review required |
| `apps-script/V2_API.js` | Home read profile, snapshot-aware readers, output finalization; also contains substantial earlier tenant/API changes and manual test helpers | Required backend dependency; mixed-phase review required |

No changed route declaration was detected in the current `程式碼.js` diff, and the validator still
finds 68 unique routes with 68/68 handler coverage.

### 4.2 Runtime modules

Phase 71B modified the following production modules to use `runtimeSpreadsheet_()`:

- `V2_ANNOUNCEMENT_MANAGEMENT.js`
- `V2_AUTO_PAYMENT_REMINDER.js`
- `V2_BILLING_MANAGEMENT.js`
- `V2_BILL_NOTIFICATIONS.js`
- `V2_CONTRACT_REQUESTS.js`
- `V2_LANDLORD_MANAGEMENT.js`
- `V2_LANDLORD_ONBOARDING.js`
- `V2_MANUAL_SETTLEMENT.js`
- `V2_PAID_BILL_MANAGEMENT.js`
- `V2_PAYMENT_REVERSAL.js`
- `V2_PAYMENT_SETTLEMENT.js`
- `V2_PROPERTY_ROOM_MANAGEMENT.js`
- `V2_SETTINGS_INTEGRATION.js`
- `V2_SYSTEM_SETTINGS.js`
- `V2_TEAM_MANAGEMENT.js`
- `V2_TENANT_BINDING_PHONE.js`
- `V2_TENANT_CHECKIN_MANAGEMENT.js`
- `V2_TENANT_LEASE_ONBOARDING.js`
- `V2_TENANT_MESSAGES.js`
- `V2_TENANT_PAYMENT_REPORTS.js`
- `V2_WORKSPACES.js`
- `V2_WORKSPACE_CREATION.js`
- `V2_WORKSPACE_DASHBOARD_NATIVE.js`
- `V2_WORKSPACE_LANDLORD_ACCESS.js`
- `V2_WORKSPACE_NOTIFICATIONS.js`
- `V2_WORKSPACE_OPERATION_AUDIT.js`

New or major runtime foundation modules:

| File | Purpose | Release decision |
|---|---|---|
| `V2_RUNTIME_SNAPSHOT.js` | Request-local Sheet snapshot, Spreadsheet handle reuse, counters | Mandatory with every converted caller |
| `V2_TENANT_RUNTIME_RESOLVER.js` | Canonical tenant/workspace/contract/property/room resolver | Required by Home and Messages; mixed with earlier Phase 53 work |

### 4.3 Admin, test, migration, and diagnostic modules

| File | Classification | Production runtime release |
|---|---|---|
| `TESTS.js` | Tests and manual diagnostics | Exclude from isolated production payload unless explicitly approved |
| `V2_TENANT_RUNTIME_DATA_REPAIR.js` | Admin repair/view-sync tooling with Sheet writers | Exclude |
| `V2_TENANT_RUNTIME_VALIDATION.js` | Manual read-only validation entrypoint | Exclude from ordinary runtime payload; retain in canonical source if desired |
| `V2_LEGACY_BILL_IMPORT.js` | Migration/import tooling | Exclude |

These files were also mechanically changed to use `runtimeSpreadsheet_()`. Their canonical source
therefore depends on `V2_RUNTIME_SNAPSHOT.js`, but that does not make them necessary in the Web App
runtime release payload.

### 4.4 Frontend

| File | Scope | Phase 66–75 release decision |
|---|---|---|
| `tenant-home.html` | Phase 74 primary render decoupling plus earlier test-query fixes | Candidate frontend release; mixed-phase review required |
| `tenant-bills.html` | Earlier tenant identity/API compatibility work | Not a Phase 66–75 change; separate approval required |
| `tenant-bind.html` | Earlier test identity navigation work | Not a Phase 66–75 change; separate approval required |
| `tenant-message.html` | Earlier test query/API work | Not a Phase 66–75 change; separate approval required |

Phase 74 does not add `tenant_bills` or `tenant_message_init` requests to Home. Those routes remain
independently loaded by their own pages.

### 4.5 Documentation

Phase 66–75 scope documents:

- `docs/68-RUNTIME-PERFORMANCE-AUDIT.md`
- `docs/69-RUNTIME-PERFORMANCE-OPTIMIZATION.md`
- `docs/69B-SHEET-READ-AUDIT.md`
- `docs/70-RUNTIME-SNAPSHOT-CONSOLIDATION.md`
- `docs/71A-RUNTIME-PERFORMANCE-VERIFICATION.md`
- `docs/71B-SPREADSHEET-HANDLE-REUSE.md`
- `docs/72-PAYLOAD-LAZY-LOADING-AUDIT.md`
- `docs/73-CRITICAL-PATH-LAZY-LOADING-DESIGN.md`
- `docs/74-TENANT-LAZY-LOADING-IMPLEMENTATION.md`
- `docs/75-PRODUCTION-PERFORMANCE-VERIFICATION.md`
- `docs/76-RELEASE-PREPARATION.md`

Untracked `docs/40-*` through `docs/61C-*` and modified `docs/39-*` belong to earlier incident,
resolver, deployment, and rollback work. They may be valid canonical documentation, but must not be
silently attributed to the Phase 66–75 performance release.

### 4.6 Configuration and release artifacts

| Path | Finding | Decision |
|---|---|---|
| `.gitignore` | Earlier change broadens `.clasp.json` ignore rule from one directory to `**/.clasp.json` | Safe configuration change, but outside Phase 66–75 scope |
| `apps-script/appsscript.json` | No current Git modification | Keep unchanged |
| `apps-script/.clasp.json` | Present locally and correctly ignored; ID not included in this report | Never commit |
| `release/phase54/` | 33 files; isolated tree predates Phases 69–74 | Stale; do not push |
| `release/phase57/` | Two rollback metadata/checksum files referenced by Phase 57 docs | Preserve as rollback evidence; not runtime source |

The manifest difference between canonical and Phase 54 is only end-of-file newline formatting, but
the JavaScript content differs broadly and Phase 54 lacks the new snapshot helper.

## 5. Unreferenced and dead-code audit

### Confirmed references

- All nine top-level functions in `V2_RUNTIME_SNAPSHOT.js` have at least one caller beyond their
  own definition.
- Every top-level function in `V2_TENANT_RUNTIME_RESOLVER.js` has at least one caller beyond its
  definition.
- Direct `SpreadsheetApp.getActiveSpreadsheet()` and `SpreadsheetApp.openById()` acquisitions in
  `apps-script/*.js` now exist only inside `runtimeSpreadsheet_()`.
- `V2_RUNTIME_SNAPSHOT.js` is not optional: converted production modules directly reference it.

### Definition-only findings

- `tenantRuntimeDiagnosticRow_()` in `V2_TENANT_RUNTIME_DATA_REPAIR.js` has no static reference
  outside its definition. It is a dead-code candidate, not proof of runtime dead code. The entire
  repair module is already excluded from the production runtime payload, so no cleanup is required
  for this release.
- Functions such as `validateProductionTenantResolverReadOnly()` and multiple `test*`, `diagnose*`,
  `preview*`, `install*`, or trigger entrypoints appear definition-only by ordinary call search
  because Apps Script invokes them manually or by stored function name. They must not be deleted
  based only on reference count.

### Stale/unreferenced release material

- `release/phase54` is referenced by historical Phase 54–60 documentation but is not compatible
  with the current source. It must not be selected as the Phase 76 push tree.
- No `package.json` command currently builds or validates a refreshed isolated performance release
  tree. A release operator must explicitly rebuild and validate it before clasp operations.

## 6. Debug and logging audit

### Runtime instrumentation

`runtimeSnapshotFinish_()` writes one structured `[V2_RUNTIME_SNAPSHOT]` Logger record when the
route is snapshot-enabled **or whenever a Spreadsheet handle was created/reused**. Because Phase
71B routes most Spreadsheet acquisition through this helper, the condition can log many production
requests, triggers, and manual executions—not only the four performance routes.

The log contains counters and action name only; it does not include UID, Spreadsheet ID, Sheet
values, token, or credential, and it is not added to API payloads. Nevertheless, always-on log
volume is a **P1 release decision**:

- Keep temporarily only if Phase 75 measurements require it and expected log volume is accepted.
- Otherwise gate or remove the instrumentation in a separately reviewed change before release.
- Do not silently remove it during this audit because Phase 76 prohibits functional changes.

### Frontend console

Phase 74 adds one `console.warn()` for rejected optional contract loading. Existing contract parse
and JSONP load failures also warn. These are error-only messages, not normal success-path noise,
and do not contain tenant payload, UID, token, or credential.

### Existing manual diagnostics

`V2_API.js` contains manual `test*` helpers that call `Logger.log()`, including payload diagnostic
functions. They are not routes and do not log during ordinary Web App requests, but they are mixed
into a required runtime file. This is not newly introduced solely by Phase 69–75 and should be
reviewed as part of the mixed-phase boundary before release.

No added `debugger`, `TODO`, `FIXME`, temporary debug flag, or counter field in API responses was
found. Validator credential and hardcoded LINE UID scans remain clean.

## 7. Release blockers and risk assessment

| Risk | Severity | Status / required action |
|---|---:|---|
| Stale Phase 54 release tree omits `V2_RUNTIME_SNAPSHOT.js` | P0 | Block push from `release/phase54`; rebuild from reviewed canonical files |
| Converted modules pushed without snapshot helper | P0 | Treat helper and all callers as one atomic backend release |
| Dirty worktree mixes Phase 40–75 changes | P0 | Create an exact reviewed manifest or commits before any push |
| Admin/repair/migration modules included by pushing the whole `apps-script/` root | P1 | Use a refreshed isolated source tree and explicit exclude list |
| Always-on snapshot Logger volume | P1 | Human decision before release; retain temporarily only for approved verification |
| Phase 69–74 production performance not measured | P1 | Execute Phase 75 after an approved after build exists |
| Phase 74 optional update rebuilds Home markup | P1 | Real-device scroll/focus and stale-generation tests before publication |
| Other frontend incident fixes bundled with Home file | P1 | Review complete `tenant-home.html` diff, not only Phase 74 hunk |
| Contract request remains 9–11 full reads and separate execution | P2 | Known remaining bottleneck; not a release blocker |
| `.clasp.json` local files | P0 if tracked | Currently ignored and absent from tracked file list; recheck immediately before commit/push |

**Current release readiness: NOT READY.** This verdict is caused by release-boundary and payload
selection risks, not by validator failure.

## 8. Rollback plan

### Backend

1. Before deployment, record the current live project, masked deployment ID, Web App URL, current
   version, and previous known-good version from the Apps Script UI.
2. Export the exact current live source and calculate SHA-256 checksums.
3. Preserve existing `release/phase57` metadata as historical evidence, but re-confirm it against
   the current deployment because Phase 66/67 external state is not represented by Git.
4. If smoke tests fail, update the existing Web App deployment back to the verified prior version;
   do not change the Web App URL.
5. Confirm endpoint, identity, Home, Bills, and Message read paths after rollback.

### Frontend

1. Record the published GitHub Pages commit before Phase 74 publication.
2. Roll back by republishing the previous `tenant-home.html` commit.
3. Do not roll back unrelated tenant HTML unless it was intentionally included in the same reviewed
   frontend release.

No Sheet rollback or migration is expected because Phases 69–74 do not alter Sheet schema or data.

## 9. Deployment checklist

### A. Release boundary

- [ ] Freeze a clean reviewed baseline or stage an exact manifest; do not use all dirty files.
- [ ] Decide whether earlier Phase 40–65 tenant fixes are part of this release.
- [ ] Review full diffs of `程式碼.js`, `V2_API.js`, `V2_TENANT_RUNTIME_RESOLVER.js`,
      `V2_TENANT_MESSAGES.js`, and `tenant-home.html`.
- [ ] Record all approved files and SHA-256 hashes.
- [ ] Confirm `.clasp.json`, `.clasprc.json`, credentials, tokens, and secrets are absent from Git.

### B. Rebuild isolated backend source

- [ ] Do not reuse `release/phase54` as-is.
- [ ] Build a fresh isolated tree from the approved canonical source.
- [ ] Include `V2_RUNTIME_SNAPSHOT.js`, dispatcher, API, resolver, and every converted production
      module required by the runtime dependency graph.
- [ ] Include the unchanged `appsscript.json`.
- [ ] Exclude `TESTS.js`, `V2_TENANT_RUNTIME_DATA_REPAIR.js`,
      `V2_TENANT_RUNTIME_VALIDATION.js`, and `V2_LEGACY_BILL_IMPORT.js` unless separately approved.
- [ ] Confirm no runtime or trigger references an excluded function.
- [ ] Decide and document whether snapshot Logger instrumentation remains enabled.

### C. Validation

- [ ] Run `npm run validate` on canonical source.
- [ ] Run JavaScript syntax checks on every isolated Apps Script file.
- [ ] Validate 68 unique routes and 68/68 handlers.
- [ ] Run duplicate declaration, secret, UID, manifest, and `.clasp.json` tracking checks.
- [ ] Run snapshot mocks: enabled read reuse, disabled write-route non-reuse, handle key isolation.
- [ ] Run Phase 74 local render fixture and real-device Home loading checks.
- [ ] Compare isolated tree file list and SHA-256 manifest to the reviewed list.
- [ ] Run isolated `clasp status`; inspect every file that would be pushed.

### D. Deployment — requires separate approval

- [ ] Re-confirm canonical Apps Script project binding without exposing IDs.
- [ ] Re-confirm current production version and rollback target.
- [ ] Perform `clasp push` only from the refreshed isolated tree.
- [ ] Create a new immutable Apps Script version.
- [ ] Update only the existing approved Web App deployment; preserve URL and access settings.
- [ ] Smoke-test endpoint, tenant identity, Home, Bills, Contract, and Message reads.
- [ ] Publish only the reviewed frontend files after backend smoke tests pass.
- [ ] Do not execute repair, migration, billing, payment, notification, or LINE actions.

### E. Post-release verification

- [ ] Execute the Phase 75 before/after plan with exact build identifiers.
- [ ] Confirm Home first render no longer waits for slower contract completion.
- [ ] Compare warm p50/p95 and runtime counters without exposing user identifiers.
- [ ] Monitor snapshot Logger volume if instrumentation was retained.
- [ ] Roll back on any P0 isolation, identity, routing, or runtime failure.

## 10. Audit conclusion

- Static dependency audit found no missing reference inside the current canonical source.
- The existing isolated release tree is stale and would be unsafe for Phase 69–74.
- The current canonical worktree is validatable but not release-isolated.
- The major pre-release decisions are mixed-phase scope, admin-tool exclusion, refreshed release
  manifest, and the lifetime of always-on snapshot Logger instrumentation.
- This Phase 76 audit did not commit, push, clasp push, deploy, or modify production behavior.
