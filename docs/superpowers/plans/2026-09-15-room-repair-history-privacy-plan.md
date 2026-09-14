# 房間報修工單歷史與個資隔離 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不讓現任房客取得前房客個資的前提下，建立以房間為主體、可跨租約延續的報修工單與處理歷史。

**Architecture:** 保留既有 `V2_tenant_messages` 作為房客訊息／報修入口與相容來源，新增報修工單主資料與 append-only 事件資料。房東後台使用完整 Workspace/RBAC projection；房客 API 在伺服器端以目前已驗證的 `workspace_id`、`room_id`、`tenant_id` 先篩選，再只回傳自己的工單或去識別化房屋摘要。

**Tech Stack:** Google Apps Script、Google Sheets、既有 JSONP/HTML bridge、靜態 HTML、Node.js test runner、GitHub Pages。

**Spec:** `docs/superpowers/specs/2026-09-15-room-repair-history-privacy-design.md`

## Global Constraints

- Gate 0 完成且取得報修功能實作授權前，不修改正式程式、不做 Google Sheets migration、不發送 LINE、不部署 Production。
- `workspace_id + room_id` 是房間報修歷史主鍵；`tenant_id + lease_id` 只保存建立當下的責任與歷史關聯。
- 房客 projection 必須由伺服器端查詢集合直接限制，不可先回傳完整房間資料再由前端隱藏。
- 所有新增 Google Sheets 欄位採 append-only，不重排、不刪除既有欄位。
- 保留既有 `V2_tenant_messages` 與 `message_id`；遷移不得刪除或覆寫既有報修資料。
- 不把 Email、電話、LINE User ID、附件 ID、永久下載 URL 或內部備註放入房客回應。
- 每個 Apps Script top-level function/const 只能有一個正式宣告；新增 route 必須同步更新 `docs/04-API-ROUTES.md` 與測試。
- 每個實作 task 都必須先寫 failing test，再以最小變更通過；完成後執行 `npm run validate`、受影響 Apps Script 測試、完整 Node 測試與 `git diff --check`。
- 真實房東／房客身份、LINE、附件與正式資料驗收標記 `HUMAN_REQUIRED`，不得以靜態測試代替。

## File Map

- Create: `apps-script/V2_REPAIR_TICKETS.js` — 報修工單主資料、事件、projection 與受控 migration helper。
- Modify: `apps-script/V2_TENANT_MESSAGES.js` — 維持既有房客報修入口，對 `repair` 類型建立相容工單關聯。
- Modify: `apps-script/V2_LANDLORD_MANAGEMENT.js` — 房東後台報修工單讀取與狀態／回覆操作。
- Modify: `apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js` — Workspace/RBAC proxy 與房東工單權限。
- Modify: `apps-script/V2_RUNTIME_SNAPSHOT.js` — 將新的只讀房客工單 action 納入既有 runtime snapshot 邊界。
- Modify: `apps-script/程式碼.js` — 集中新增 API dispatcher branches。
- Modify: `landlord-messages.html` — 房東工單篩選、房間歷史時間軸、原租約與責任標示。
- Modify: `tenant-message.html` — 只呈現目前房客自己的報修與安全的去識別化房屋摘要。
- Modify: `docs/04-API-ROUTES.md` — 實作後記錄實際 route、權限與回應 projection。
- Modify: `docs/05-DATA-MODEL.md` — 記錄正式 headers、事件表與相容欄位。
- Modify: `docs/09-TEST-MATRIX.md` — 記錄報修工單與個資隔離驗收矩陣。
- Create: `tests/phase262-repair-ticket-contract.test.mjs` — schema、projection 與 route contract tests。
- Create: `tests/phase263-repair-ticket-runtime.test.mjs` — Apps Script runtime、事件與權限 tests。
- Create: `tests/phase264-repair-ticket-migration.test.mjs` — legacy repair backfill、去重與缺房間資料 tests。
- Create: `tests/phase265-repair-ticket-privacy.ui.test.mjs` — tenant/landlord HTML projection and UI assertions。

---

### Task 1: Freeze the schema and privacy contract

**Files:**
- Modify: `docs/05-DATA-MODEL.md`
- Modify: `docs/04-API-ROUTES.md`
- Modify: `docs/09-TEST-MATRIX.md`
- Create: `tests/phase262-repair-ticket-contract.test.mjs`

**Interfaces:**
- Consumes: `V2_tenant_messages` headers and the approved privacy design.
- Produces: exact sheet headers, projection allowlists, status values, and route contract that later tasks must implement.

- [ ] **Step 1: Write failing contract tests**

  Add tests that assert:

  ```js
  assert.deepEqual(REPAIR_TICKET_HEADERS.slice(0, 6), [
    'workspace_id',
    'repair_ticket_id',
    'source_message_id',
    'property_id',
    'room_id',
    'room_name_snapshot'
  ]);

  assert.equal(TENANT_REPAIR_ALLOWED_FIELDS.includes('tenant_name_snapshot'), false);
  assert.equal(TENANT_REPAIR_ALLOWED_FIELDS.includes('tenant_line_user_id'), false);
  assert.equal(TENANT_REPAIR_ALLOWED_FIELDS.includes('description'), true);
  assert.equal(TENANT_REPAIR_ALLOWED_FIELDS.includes('status'), true);
  ```

  Also assert that the documented actions are exactly `tenant_repair_tickets_init`,
  `landlord_repair_tickets_init`, and `landlord_repair_ticket_update` once they are
  implemented; no undocumented query-string action is accepted.

- [ ] **Step 2: Run the focused test and verify it fails**

  Run:

  ```bash
  node --test tests/phase262-repair-ticket-contract.test.mjs
  ```

  Expected: FAIL because the canonical header/projection constants and route contract do not yet exist.

- [ ] **Step 3: Record the contract in the data and API documents**

  Add the append-only `V2_repair_tickets` and `V2_repair_events` tables to
  `docs/05-DATA-MODEL.md`. Record the three actions, required identity checks,
  landlord/tenant response projections, and the rule that tenant reads are filtered
  before serialization in `docs/04-API-ROUTES.md`. Add the privacy and cross-tenant
  acceptance cases to `docs/09-TEST-MATRIX.md`.

- [ ] **Step 4: Run the focused contract test again**

  Run the same command. Expected: the documentation contract parser passes for all
  declared headers, allowed fields, statuses, and actions.

- [ ] **Step 5: Commit the contract**

  ```bash
  git add docs/05-DATA-MODEL.md docs/04-API-ROUTES.md docs/09-TEST-MATRIX.md tests/phase262-repair-ticket-contract.test.mjs
  git commit -m "docs: freeze repair ticket privacy contract"
  ```

### Task 2: Add canonical repair ticket and append-only event storage

**Files:**
- Create: `apps-script/V2_REPAIR_TICKETS.js`
- Modify: `apps-script/V2_TENANT_MESSAGES.js`
- Create: `tests/phase263-repair-ticket-runtime.test.mjs`

**Interfaces:**
- Consumes: `resolveCanonicalTenantRuntimeByLineUid_()`, existing `V2_tenant_messages` rows, and Task 1 headers.
- Produces: `repairTicketEnsureSheets_()`, `repairTicketCreateFromMessage_()`,
  `repairTicketAppendEvent_()`, `repairTicketToLandlordProjection_()`, and
  `repairTicketToTenantProjection_()`.

- [ ] **Step 1: Write failing runtime tests for the room-level identity**

  Cover these cases:

  ```js
  const ticket = repairTicketCreateFromMessage_(message, identity);
  assert.equal(ticket.room_id, 'ROOM-101');
  assert.equal(ticket.tenant_id, 'TENANT-A');
  assert.equal(ticket.lease_id, 'LEASE-A');

  const currentTenantB = { tenant_id: 'TENANT-B', workspace_id: 'WS-1', room_id: 'ROOM-101' };
  const afterMove = repairTicketToTenantProjection_(ticket, currentTenantB);
  assert.equal(afterMove, null);

  const landlordView = repairTicketToLandlordProjection_(ticket);
  assert.equal(landlordView.tenant_name_snapshot, '房客 A');
  ```

  Also assert that an event append never mutates or replaces the original tenant or
  lease snapshot, and that an existing `source_message_id` cannot create a duplicate ticket.

- [ ] **Step 2: Run the runtime test and verify it fails**

  ```bash
  node --test tests/phase263-repair-ticket-runtime.test.mjs
  ```

  Expected: FAIL because `V2_REPAIR_TICKETS.js` and its helpers are not present.

- [ ] **Step 3: Implement append-only sheet creation and ticket creation**

  In `V2_REPAIR_TICKETS.js`, implement one unique `repairTicket*` namespace:

  ```js
  function repairTicketEnsureSheets_() {}
  function repairTicketCreateFromMessage_(messageRecord, canonicalIdentity) {}
  function repairTicketAppendEvent_(ticketId, eventInput, actor) {}
  function repairTicketFindBySourceMessageId_(sourceMessageId) {}
  ```

  `repairTicketCreateFromMessage_()` must require `workspace_id`, `room_id`,
  `tenant_id`, and the source message ID; it must copy the original tenant and lease
  snapshot once and set status to `pending`. `repairTicketAppendEvent_()` must append
  an event row and update only the current ticket status/reply summary, never the
  original tenant/lease snapshot.

- [ ] **Step 4: Link repair intake without changing general messages**

  In `submitTenantMessageByLineUid_()`, keep the existing validation and notification
  behavior. For `messageCategory === 'repair'`, call
  `repairTicketCreateFromMessage_()` after the message row is created and store the
  returned `repair_ticket_id` in the additive message column. For `general`, `payment`,
  `contract`, and `other`, do not create a repair ticket.

- [ ] **Step 5: Implement landlord and tenant projections**

  `repairTicketToLandlordProjection_()` may include the original tenant/lease snapshot,
  internal note, cost, responsibility, and event summary after Workspace authorization.
  `repairTicketToTenantProjection_()` may include only the ticket owner's safe fields;
  it must return `null` when the requested ticket tenant does not equal the currently
  authenticated tenant.

- [ ] **Step 6: Run the runtime test and verify it passes**

  ```bash
  node --test tests/phase263-repair-ticket-runtime.test.mjs
  ```

  Expected: PASS with duplicate prevention, original-tenant preservation, and tenant
  projection exclusion covered.

- [ ] **Step 7: Commit the canonical storage unit**

  ```bash
  git add apps-script/V2_REPAIR_TICKETS.js apps-script/V2_TENANT_MESSAGES.js tests/phase263-repair-ticket-runtime.test.mjs
  git commit -m "feat: add room repair ticket history model"
  ```

### Task 3: Add server-authorized routes and Workspace/RBAC enforcement

**Files:**
- Modify: `apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js`
- Modify: `apps-script/V2_RUNTIME_SNAPSHOT.js`
- Modify: `apps-script/程式碼.js`
- Modify: `apps-script/V2_LANDLORD_MANAGEMENT.js`
- Modify: `apps-script/V2_TENANT_MESSAGES.js`
- Extend: `tests/phase263-repair-ticket-runtime.test.mjs`

**Interfaces:**
- Consumes: Task 2 ticket helpers and existing landlord Workspace proxy.
- Produces: `tenant_repair_tickets_init`, `landlord_repair_tickets_init`, and
  `landlord_repair_ticket_update` with explicit allowlisted responses.
- Test-only adapter: `invokeTenantRepairRoute_(lineUserId, query)` invokes the same
  dispatcher branch as `tenant_repair_tickets_init` while supplying a forged browser
  query, so the test can prove that query identity is not treated as authority.

- [ ] **Step 1: Add failing authorization tests**

  Test that:

  ```js
  const tenantResult = getTenantRepairTicketsInitByLineUid('TENANT-B-LINE');
  assert.deepEqual(tenantResult.data.tickets, onlyTenantBRecords);
  const forgedResult = invokeTenantRepairRoute_('TENANT-B-LINE', {
    tenant_id: 'TENANT-A',
    room_id: 'ROOM-A',
    ticket_id: 'TICKET-A'
  });
  assert.equal(forgedResult.code, 'TENANT_ACCESS_DENIED');
  assert.equal(
    getWorkspaceLandlordRepairTicketsInitByLineUid_('LANDLORD-LINE', {}).success,
    true
  );
  assert.equal(
    getWorkspaceLandlordRepairTicketsInitByLineUid_('OTHER-LANDLORD-LINE', {}).code,
    'WORKSPACE_ACCESS_DENIED'
  );
  ```

  The assertions must inspect response keys and confirm that tenant responses never
  contain `tenant_name_snapshot`, `tenant_line_user_id`, `tenant_user_id`, `lease_id`,
  `internal_note`, or attachment storage identifiers.

- [ ] **Step 2: Run the focused authorization test and verify it fails**

  ```bash
  node --test tests/phase263-repair-ticket-runtime.test.mjs
  ```

  Expected: FAIL because the new dispatcher actions and Workspace proxy functions do not exist.

- [ ] **Step 3: Add the landlord Workspace proxy**

  Add uniquely named wrappers in `V2_WORKSPACE_LANDLORD_ACCESS.js`:

  ```js
  function getWorkspaceLandlordRepairTicketsInitByLineUid_(lineUserId, filters) {}
  function updateWorkspaceLandlordRepairTicketByLineUid_(lineUserId, ticketId, input) {}
  ```

  The read wrapper requires the existing landlord read permission; the update wrapper
  requires the existing message-write/operations permission and passes the resolved
  principal into the canonical update function. Neither wrapper accepts a client-supplied
  workspace or landlord ID as authority.

- [ ] **Step 4: Add the tenant-owned read path**

  Add `getTenantRepairTicketsInitByLineUid(lineUserId)` in
  `V2_TENANT_MESSAGES.js`. It must resolve the canonical tenant runtime from the LINE
  identity, query by that resolved `workspace_id`, `room_id`, and `tenant_id`, and only
  then call `repairTicketToTenantProjection_()`. Do not accept `tenant_id` or `room_id`
  from the browser as an authorization input.

- [ ] **Step 5: Add the centralized dispatcher branches**

  In `apps-script/程式碼.js`, add branches for the three documented actions. Preserve
  JSONP and HTML bridge output behavior. `landlord_repair_ticket_update` must pass only
  `ticket_id`, status, public reply, responsibility, and cost fields allowed by the
  server validator; internal actor identity comes from the authenticated landlord.

- [ ] **Step 6: Add runtime snapshot and API documentation entries**

  Include `tenant_repair_tickets_init` in the read-only runtime snapshot allowlist if
  its response is safe to cache. Do not cache landlord writes. Record exact parameters,
  permissions, error codes, and field allowlists in `docs/04-API-ROUTES.md`.

- [ ] **Step 7: Run the authorization tests and verify they pass**

  ```bash
  node --test tests/phase263-repair-ticket-runtime.test.mjs
  ```

  Expected: PASS for same-tenant reads, cross-tenant denial, Workspace isolation,
  landlord update authorization, and response-field exclusion.

- [ ] **Step 8: Commit the route unit**

  ```bash
  git add apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js apps-script/V2_RUNTIME_SNAPSHOT.js apps-script/程式碼.js apps-script/V2_LANDLORD_MANAGEMENT.js apps-script/V2_TENANT_MESSAGES.js docs/04-API-ROUTES.md tests/phase263-repair-ticket-runtime.test.mjs
  git commit -m "feat: enforce repair ticket workspace and tenant projections"
  ```

### Task 4: Backfill existing repair messages idempotently

**Files:**
- Modify: `apps-script/V2_REPAIR_TICKETS.js`
- Create: `tests/phase264-repair-ticket-migration.test.mjs`
- Modify: `docs/05-DATA-MODEL.md`

**Interfaces:**
- Consumes: existing `V2_tenant_messages` rows and Task 2 source-message lookup.
- Produces: `repairTicketBackfillLegacyMessages_({mode, limit})`, where `mode` is
  exactly `'preview'` or `'apply'`; preview never writes and apply is not called from a public HTTP route.

- [ ] **Step 1: Write failing migration tests**

  Cover duplicate reruns, rows with no `room_id`, existing `repair_ticket_id`, and rows
  whose category is not `repair`:

  ```js
  const preview = repairTicketBackfillLegacyMessages_({ mode: 'preview', limit: 100 });
  assert.equal(preview.writes, 0);
  assert.equal(preview.missing_room_count, 1);

  const first = repairTicketBackfillLegacyMessages_({ mode: 'apply', limit: 100 });
  const second = repairTicketBackfillLegacyMessages_({ mode: 'apply', limit: 100 });
  assert.equal(second.created_count, 0);
  assert.equal(first.created_ids.length, 1);
  ```

- [ ] **Step 2: Run migration tests and verify they fail**

  ```bash
  node --test tests/phase264-repair-ticket-migration.test.mjs
  ```

  Expected: FAIL because the controlled migration helper is not present.

- [ ] **Step 3: Implement preview/apply behavior**

  Scan only `message_category === 'repair'`. In preview, return counts and unresolved
  source IDs without writes. In apply, create one ticket per source message, preserve
  original fields, append a `legacy_backfill` event, and skip rows already linked by
  `source_message_id`. Rows missing `room_id` remain untouched and appear in the
  manual-review report.

- [ ] **Step 4: Run migration tests and verify they pass**

  ```bash
  node --test tests/phase264-repair-ticket-migration.test.mjs
  ```

  Expected: PASS with zero duplicate tickets after a second apply run.

- [ ] **Step 5: Document the migration runbook**

  Add the exact preview, review, backup, apply, count reconciliation, and rollback
  sequence to `docs/05-DATA-MODEL.md`. The runbook must state that apply is an operator
  action after backup and authorization, not a web request parameter.

- [ ] **Step 6: Commit the migration unit**

  ```bash
  git add apps-script/V2_REPAIR_TICKETS.js tests/phase264-repair-ticket-migration.test.mjs docs/05-DATA-MODEL.md
  git commit -m "feat: add idempotent repair ticket backfill"
  ```

### Task 5: Build landlord room-history and tenant-safe UI

**Files:**
- Modify: `landlord-messages.html`
- Modify: `tenant-message.html`
- Create: `tests/phase265-repair-ticket-privacy.ui.test.mjs`
- Modify: `docs/09-TEST-MATRIX.md`

**Interfaces:**
- Consumes: Task 3 response shapes and existing bridge helpers in both HTML pages.
- Produces: landlord room grouping/timeline and tenant-owned repair list without client-side privacy filtering.

- [ ] **Step 1: Write failing static UI tests**

  Assert that the landlord page has room/status filters and a history renderer, while
  the tenant page renders only allowlisted fields:

  ```js
  assert.match(landlordHtml, /renderRepairTimeline/);
  assert.match(landlordHtml, /landlord_repair_tickets_init/);
  assert.match(tenantHtml, /tenant_repair_tickets_init/);
  assert.doesNotMatch(tenantProjectionFixture, /tenant_name_snapshot/);
  assert.doesNotMatch(tenantProjectionFixture, /internal_note/);
  ```

- [ ] **Step 2: Run the UI test and verify it fails**

  ```bash
  node --test tests/phase265-repair-ticket-privacy.ui.test.mjs
  ```

  Expected: FAIL because the existing message pages do not contain the new repair-ticket
  route and timeline functions.

- [ ] **Step 3: Add landlord room grouping and timeline**

  In `landlord-messages.html`, call `landlord_repair_tickets_init`, group tickets by
  `room_id`, and render current status, priority, original tenant/lease snapshot,
  responsibility, cost, and append-only event timeline. Keep existing general-message
  cards and filters working. Status updates must call the new update action once and
  show busy/success/error feedback.

- [ ] **Step 4: Add tenant-owned repair rendering**

  In `tenant-message.html`, call `tenant_repair_tickets_init` for the authenticated
  tenant. Render only the safe projection. If the room-maintenance summary is enabled,
  render only category, dates, status, and public note; never interpolate raw message
  rows, tenant snapshots, internal notes, or attachment IDs.

- [ ] **Step 5: Add negative privacy fixtures**

  Add fixtures for tenant A and tenant B in the UI test. Assert tenant B's rendered DOM
  and serialized bridge payload contain none of tenant A's name, phone, Email, LINE ID,
  original message, private attachment name, or lease ID.

- [ ] **Step 6: Run the UI test and verify it passes**

  ```bash
  node --test tests/phase265-repair-ticket-privacy.ui.test.mjs
  ```

  Expected: PASS for landlord history rendering, tenant-owned rendering, and negative
  PII assertions.

- [ ] **Step 7: Commit the UI unit**

  ```bash
  git add landlord-messages.html tenant-message.html tests/phase265-repair-ticket-privacy.ui.test.mjs docs/09-TEST-MATRIX.md
  git commit -m "feat: add room repair history and tenant-safe views"
  ```

### Task 6: Complete verification and prepare, but do not publish

**Files:**
- Modify: `docs/09-TEST-MATRIX.md`
- Modify: `docs/04-API-ROUTES.md`
- Modify: `docs/05-DATA-MODEL.md`

**Interfaces:**
- Consumes: all previous task commits and the approved design.
- Produces: a release candidate with reproducible checks and an explicit Production
  acceptance boundary.

- [ ] **Step 1: Run focused tests**

  ```bash
  node --test tests/phase262-repair-ticket-contract.test.mjs tests/phase263-repair-ticket-runtime.test.mjs tests/phase264-repair-ticket-migration.test.mjs tests/phase265-repair-ticket-privacy.ui.test.mjs
  ```

  Expected: all repair-ticket tests pass with zero failures.

- [ ] **Step 2: Run project validation and syntax checks**

  ```bash
  npm run validate
  node --check apps-script/V2_REPAIR_TICKETS.js
  node --check apps-script/V2_TENANT_MESSAGES.js
  node --check apps-script/V2_LANDLORD_MANAGEMENT.js
  node --check apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js
  node --check apps-script/程式碼.js
  git diff --check
  ```

  Expected: validation, syntax, and whitespace checks pass. If the canonical validator
  reports a pre-existing baseline mismatch, record the exact mismatch and do not mark
  the repair feature as the cause.

- [ ] **Step 3: Run the full test suite**

  ```bash
  npm test
  ```

  Expected: existing regression tests and all repair-ticket tests pass.

- [ ] **Step 4: Run non-mutating preview and inspect the migration report**

  Execute `repairTicketBackfillLegacyMessages_({mode: 'preview', limit: 1000})` in the
  authorized Apps Script test context only. Confirm `writes === 0`, unresolved room
  IDs are listed, and the source-message count matches the read-only backup report.

- [ ] **Step 5: Record release and rollback boundaries**

  Update the three project docs with test counts, exact commit, migration preview
  evidence, known `HUMAN_REQUIRED` items, and the rollback method: revert frontend/API
  commits, disable the new tenant summary route if necessary, and retain all ticket/event
  rows. Do not run apply migration, Apps Script deployment, Pages deployment, or LINE
  notifications in this task.

- [ ] **Step 6: Commit the verification record**

  ```bash
  git add docs/04-API-ROUTES.md docs/05-DATA-MODEL.md docs/09-TEST-MATRIX.md
  git commit -m "test: record repair ticket release checks"
  ```

## Execution Gate After This Plan

The plan is ready for implementation only after both conditions are true:

1. Gate 0 Production Consolidation is completed and its authoritative repository,
   Apps Script, Sheet schema, and release evidence are reconciled.
2. The user explicitly authorizes implementation and the required staging/Production
   scope.

Until then, the approved design and this plan are documentation only. No report ticket
data, existing tenant message, Google Sheet, Apps Script deployment, LINE message, or
formal website is changed by this plan.
