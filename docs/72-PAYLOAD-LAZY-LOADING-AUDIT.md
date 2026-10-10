# Phase 72 — Payload Lazy Loading Audit

日期：2026-07-21

狀態：**ANALYSIS ONLY — NO PRODUCTION CODE CHANGE**

## 1. Scope and method

本階段交叉比對四個 tenant backend response builders 與 repository frontend 的實際
欄位存取：

- `tenant_home`
- `tenant_bills`
- `tenant_contract_init`
- `tenant_message_init`

本輪沒有呼叫 production tenant routes。這些 routes 會寫 access log，且 Phase 70/71
尚未部署；因此 size 採 compact `JSON.stringify()` UTF-8 bytes 的 representative
fixture 估算，不冒充 production network capture。

估算使用目前已知的一位 tenant、一筆 bill、一筆 contract request 或一筆 message
的 schema 形狀與一般長度字串。實際大小會隨姓名、地址、訊息正文、申請說明、
帳單與歷史筆數變動。估算不含 JSONP callback 名稱與 `callback(...);` wrapper。

## 2. Size estimation summary

| Route | Empty/minimal collection | One collection item | Approximate growth per item | Main driver |
|---|---:|---:|---:|---|
| `tenant_home` | N/A | **414 B** representative response | fixed | 13-field Home projection |
| `tenant_bills` | **640 B** with zero bills | **2,554 B** with one bill | about **1,914 B/bill** under current triple wrapping | `bills`, `items`, `data.bills` duplicate the same array |
| `tenant_contract_init` | **1,069 B** with zero requests | **2,408 B** with one request | about **1,339 B/request** | full request workflow/audit fields |
| `tenant_message_init` | **294 B** with zero messages | **824 B** with one message | about **530 B/message** | complete message identity and lifecycle fields |

These values are estimates, not measured production payload sizes.

## 3. `tenant_home`

### Current payload structure

```text
{
  success,
  code,
  message,
  data: {
    line_user_id,
    user_id,
    tenant_id,
    tenant_name,
    room_list,
    latest_bill_month,
    latest_due_date,
    latest_total_amount,
    latest_payment_status,
    unpaid_bill_count,
    unpaid_total_amount,
    account_status,
    updated_at
  }
}
```

### Frontend usage

`tenant-home.html` uses tenant/room identity, latest bill month/due date/amount/payment status,
unpaid summary, account status and updated time. It does not directly use:

- `line_user_id`
- `user_id`

`tenant_id` is used for page metadata/display logic and should be considered active contract.

### Over-fetch assessment

The Home response itself is compact, estimated around 414 B, and is not the primary payload
problem. Backend Sheet I/O is larger than the returned JSON, but that is a read-latency issue,
not payload over-fetch.

The page-level problem is that `tenant-home.html` sends and waits for both:

```text
tenant_home
tenant_contract_init
```

through one `Promise.allSettled()` barrier. The Home primary content can render from
`tenant_home`, but it waits for the substantially larger contract/request response.

### Lazy-loading candidate

- **Primary:** tenant/room identity, bill summary, account status.
- **Optional:** contract banner and latest active renewal/termination request.
- Render Home immediately after `tenant_home`; load the contract banner later.
- A future summary projection should include only contract dates/amounts and the latest active
  request. It should not return bank details or complete request history to the Home page.

This would require frontend flow or API projection changes and is not implemented here.

## 4. `tenant_bills`

### Current payload structure

```text
{
  success,
  ok,
  code,
  message,
  tenant,
  bills,
  items,
  count,
  source,
  identity_match,
  data: {
    tenant,
    bills,
    count
  }
}
```

The same tenant object is serialized twice. The same bill array is serialized three times:

1. top-level `bills`
2. top-level `items`
3. `data.bills`

JavaScript object references do not reduce serialized JSON size; `JSON.stringify()` emits each
copy in full.

Representative one-bill estimate:

| Shape | Approximate size |
|---|---:|
| Current compatibility payload | 2,554 B |
| One canonical `data: {tenant,bills,count}` wrapper | 958 B |
| List-only projected example | 374 B |

The smaller alternatives are comparison estimates only. Removing wrappers or fields would
change the current compatibility contract and is prohibited in this phase.

### Bill fields used by current page

The list and detail sheet use:

- `bill_id`
- `bill_month`
- `due_date`
- `room_name`
- `rent_amount`
- `management_fee`
- `previous_meter`
- `current_meter_reading`
- `electricity_usage`
- `electricity_fee_rate`
- `equipment_fee_rate`
- `electricity_amount`
- `equipment_amount`
- `other_amount`
- `total_amount`
- `payment_status` / `bill_status`

### Unused or redundant fields for this page

Per-bill identity fields are redundant because the response already has a tenant object:

- `user_id`
- `tenant_id`
- `tenant_name`
- `workspace_id`
- `contract_id`
- `property_id`
- `room_id`

Other fields not used by current `tenant-bills.html` rendering:

- `discount_amount`
- `sent_status`
- bill `updated_at`

The top-level tenant object itself contains fields not used by this page beyond tenant name and
room name, including tenant user ID, contract/workspace/property/room IDs and account status.

These fields may have external/legacy consumers; static inspection of this one page is not
sufficient authority to remove them.

### Lazy-loading candidate

- **Primary list:** bill ID, month, room, due date, total, payment status and compact preview.
- **Optional detail:** meter readings, rates and charge breakdown after opening a bill.
- **Optional payment reports:** the page currently also waits for
  `tenant_payment_report_init`; report badges can load after the bill list.
- Most immediate payload win is eliminating triple serialization, but this requires a versioned
  compatibility decision because the frontend intentionally accepts old and new wrappers.

## 5. `tenant_contract_init`

### Current payload structure

```text
{
  success,
  code,
  message,
  data: {
    tenant,
    contract,
    requests: [...],
    permissions: {
      can_request_renewal,
      can_request_termination
    }
  }
}
```

The contract object contains identity, property, dates, amounts, payment-bank data, status and
supplement fields. Every request contains identity, requested/approved terms, termination and
penalty details, audit actors/timestamps, notification state and notes.

### Fields used by standalone contract page

The page actively uses tenant name/ID/room; contract ID, room, landlord, dates, remaining days,
rent, management fee, deposit, payment day, masked bank data and status. Request cards use the
request ID/type/status, requested and approved financial/term fields, termination/penalty fields,
reason/notes and created time.

### Unused contract fields in current frontend

- `landlord_id`
- `property_id`
- `property_name`
- `property_address`
- `room_id`
- contract-level `tenant_id`
- contract-level `tenant_name`
- `bank_raw_text`
- contract `updated_at`

The tenant projection returns many fields while the page uses only tenant ID/name/room:

- tenant LINE UID and internal user ID
- phone/email
- landlord ID/name/LINE UID
- account status

### Unused request fields in current frontend

The current request cards do not use several internal identity/audit fields:

- landlord ID and landlord LINE UID
- tenant ID, user ID, LINE UID and tenant name
- room ID/name and contract ID
- `request_type_label`, `termination_type_label`, `penalty_status_label`, `status_label`
- `requested_date`
- `is_early_termination`
- approval/rejection/cancellation/completion/close actor fields and several lifecycle timestamps
- `applied_contract_id`
- `tenant_notified_at`

Some lifecycle fields may be required by other pages or future display. They are optimization
candidates, not approved removals.

### Lazy-loading candidate

- **Primary:** tenant summary + current contract hero/content.
- **Secondary:** request permissions and latest active request.
- **Lazy history:** completed/rejected/cancelled historical requests after the user opens the
  history section.
- **Home projection:** Home should not request full bank and full request-history payload merely
  to show a banner.

The standalone contract page uses most current contract details, so splitting current contract
from request history is safer than aggressively trimming the contract object.

## 6. `tenant_message_init`

### Current payload structure

```text
{
  success,
  code,
  message,
  data: {
    tenant: {
      line_user_id,
      user_id,
      tenant_id,
      tenant_name,
      room_list,
      landlord_id,
      landlord_name,
      landlord_line_user_id
    },
    messages: [...]
  }
}
```

Each message returns about 20 fields covering tenant/landlord identity, room, content, status,
reply lifecycle and notes.

### Fields used by current page

Tenant header:

- `tenant_name`
- `room_list`
- `landlord_name`

Message history:

- `message_id`
- `created_at`
- `message_category`
- `message_title`
- `message_body`
- `priority`
- `preferred_contact_time`
- `status`
- `landlord_reply`

### Unused fields in current page

Tenant projection:

- `line_user_id`
- `user_id`
- `tenant_id`
- `landlord_id`
- `landlord_line_user_id`

Per message:

- `updated_at`
- `landlord_id`
- `landlord_line_user_id`
- `tenant_id`
- `tenant_user_id`
- `tenant_line_user_id`
- `tenant_name`
- `room_id`
- `room_name`
- `replied_at`
- `closed_at`
- `note`

### Lazy-loading candidate

- **Primary:** tenant/room/landlord display summary and message form.
- **Secondary:** recent message history.
- **Lazy history:** older messages, ideally paginated or limited.
- Current response growth is approximately 530 B per representative message and has no explicit
  page/limit policy. Long message bodies can make actual growth materially larger.

## 7. Primary versus optional content

| Page | Primary content | Optional/lazy content | Current blocking behavior |
|---|---|---|---|
| Home | identity, room, latest/unpaid bill summary | contract banner, request status | waits for full `tenant_contract_init` |
| Bills | bill list and status | full detail breakdown, payment reports | waits for bills + payment-report init |
| Contract | tenant/current contract | full request history | returns all together |
| Message | tenant/landlord summary and form | message history, especially older messages | returns all together |

The strongest current lazy-loading candidate is Home: the primary response is only about 414 B,
but rendering waits for a 1–2.4 KB representative contract payload and its additional Sheet reads.

## 8. Optimization candidates

### P0 — Contract compatibility first

Do not remove `tenant_bills` top-level/data compatibility fields until every frontend and external
consumer is inventoried. The current duplication is inefficient but was added to tolerate old and
new response shapes.

### P1 — Primary render without optional request barrier

1. Home renders after `tenant_home`; contract banner fills later.
2. Bills renders after `tenant_bills`; payment-report state fills later.
3. Message form/header renders before history completes.

This reduces perceived latency even when payload bytes remain unchanged, but requires frontend
changes and is outside this phase.

### P1 — Summary/detail projections

1. Contract summary for Home, separate from full contract screen payload.
2. Bill list projection, with bill detail fetched only when opened.
3. Message recent-history limit with explicit pagination.
4. Contract request history loaded separately from current contract.

These require a route/query/versioning decision to preserve the current API contract.

### P2 — Field trimming after consumer inventory

Remove repeated identity/audit fields only after confirming GitHub Pages, LIFF, admin tools,
external integrations and legacy clients do not depend on them.

## 9. Risk assessment

| Risk | Severity | Reason / control |
|---|---|---|
| Remove compatibility wrappers from Bills | P0 | Can break clients reading `bills`, `items` or `data.bills`; requires versioned migration |
| Lazy-load changes ordering/error UX | P1 | Primary may render while optional content fails; UI must show independent states |
| Detail route weakens tenant isolation | P0 | Any bill/message/contract detail lookup must validate tenant + workspace, never ID alone |
| Pagination hides active workflow item | P1 | Pending/approved requests and unreplied messages must remain discoverable |
| Bank data projection exposes raw values | P0 | Keep existing masking/authorization; never return `bank_raw_text` unnecessarily |
| Size estimate mistaken for production measurement | P2 | All estimates explicitly labeled; production capture requires approved deployment/test |
| Extra HTTP requests offset byte savings | P1 | Lazy loading must compare total requests, Apps Script startup and Sheet-read costs |

## 10. Recommendation

Recommended order for a future implementation phase:

1. Remove frontend `Promise.allSettled` primary-content barriers without changing existing API
   schemas.
2. Add measured payload-byte instrumentation that logs only action, byte count and item count.
3. Define a compatibility/version policy for Bills before removing duplicate wrappers.
4. Introduce contract-summary, bill-detail and paginated-message projections only with Workspace
   isolation tests and rollback coverage.

This Phase only adds this audit document. It does not modify production code, frontend, API
schema, Sheet schema, runtime configuration or deployment, and does not commit, push,
`clasp push` or deploy.
