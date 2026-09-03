# CMWebs V2 API Routes

## Canonical baseline

This inventory is generated from the verified, immutable Production Apps Script
**Version 85** source snapshot. It is a local Gate 0 canonical-source candidate,
not a deployment instruction and not evidence that the repository has been
deployed.

- Dispatcher: `apps-script/程式碼.js`
- Route count: **83** unique `v2Action` routes
- Source tree SHA-256: `c24e33ee91dec312d288fab508e09d8b4c9fefcc3c8eb84ab8b2486a4b2930d0`
- Scope: read/write route definitions only; every write route still requires its
  existing Workspace, role, and authorization checks.

The older Gate 0 checklist value of 68 routes is superseded for this Version 85
candidate by this evidence-backed inventory. Any later route change must update
this document and its static validation.

## Route inventory

```text
landlord_announcement_retry
landlord_announcement_send
landlord_announcements_init
landlord_arrears
landlord_bill_manual_settle
landlord_bill_notifications_init
landlord_bill_notifications_send
landlord_bill_reopen
landlord_billing_init
landlord_bills_generate
landlord_contract_signing_review_auth_init
landlord_contract_signing_review_auth_status
landlord_contract_signing_review_update
landlord_contract_signing_review_update_status
landlord_contract_signing_review_update_submit
landlord_contract_signing_reviews_fetch
landlord_contract_signing_reviews_fetch_status
landlord_contract_signing_reviews_init
landlord_contract_document_download
landlord_contract_documents_init
landlord_contract_request_update
landlord_contract_requests_init
landlord_entry_status
landlord_home
landlord_home_bootstrap
landlord_invitation_accept
landlord_invitation_init
landlord_line_logs
landlord_message_update
landlord_messages_init
landlord_notification_mark_read
landlord_notifications_init
landlord_notifications_mark_all_read
landlord_onboarding_complete
landlord_onboarding_init
landlord_onboarding_save
landlord_paid_bills_init
landlord_payment_report_settle
landlord_payment_report_update
landlord_payment_reports_init
landlord_revenue_dashboard_init
landlord_properties_init
landlord_property_archive
landlord_property_save
landlord_register_submit
landlord_room_archive
landlord_room_save
landlord_room_account_toggle
landlord_send_tenant_message
landlord_settings_init
landlord_settings_save_payment
landlord_settings_save_preferences
landlord_settings_save_profile
landlord_settings_save_workspace
landlord_team_init
landlord_team_invite_cancel
landlord_team_invite_create
landlord_team_member_remove
landlord_team_member_update
landlord_tenant_checkin_save
landlord_tenant_checkin_send_welcome
landlord_tenant_checkins_init
landlord_tenant_create
landlord_tenant_create_init
landlord_tenants
landlord_workspace_activity_init
landlord_workspace_context
landlord_workspace_create
landlord_workspace_switch
tenant_bills
tenant_bind_submit
tenant_binding_status
tenant_contract_init
tenant_contract_auth_init
tenant_contract_auth_status
tenant_contract_artifact_upload_submit
tenant_contract_artifact_upload_status
tenant_contract_sign_submit
tenant_contract_sign_status
tenant_contract_request_cancel
tenant_contract_request_submit
tenant_contract_requests
tenant_contract_renewal_intent
tenant_home
tenant_message_init
tenant_message_submit
tenant_payment_report_init
tenant_payment_report_submit
```

## Payment-report and bill-display contracts

## Landlord revenue dashboard

| Route | Transport | Required authority | Purpose |
|---|---|---|---|
| `landlord_revenue_dashboard_init` | JSONP / bridge | Active Workspace landlord read access | Returns Workspace-scoped revenue KPIs, monthly receivable/collected/outstanding aggregates, payment-status distribution, overdue ratio/ageing, occupancy, contract-expiry distribution, property aggregates, and range metadata. It never returns raw bills, payments, tenant names, LINE IDs, or bank data. |

- Required filters are `range` (`month`, `3m`, or `12m`) or an explicit
  `from_month`/`to_month` pair. `property_id` is optional and cannot expand the
  authenticated Workspace scope.
- Receivable uses valid canonical bills; collected uses confirmed payments first
  and a paid canonical-bill fallback when no payment rows exist. Outstanding is
  `max(receivable - collected, 0)` and collection rate is `null` when receivable
  is zero.
- Missing required reporting sheets fail closed with
  `REPORTING_SCHEMA_NOT_READY`.
- The legacy `kpis` envelope remains limited to `receivable`, `collected`,
  `outstanding`, and `collection_rate`. Additional visual aggregates are
  returned under `metrics`, `status_distribution`, `overdue_aging`,
  `monthly_status`, `occupancy`, and `contract_expiry` so existing consumers
  remain compatible.
- `metrics.overdue_ratio` is outstanding amount past the canonical due date
  divided by receivable; partial payments past due remain visible as partial in
  the status distribution but are included in overdue metrics.
- Room status is read from `V2_rooms`; an explicit room status takes priority
  over a conflicting active contract. Occupancy excludes inactive rooms from
  its rate denominator and reports unknown states separately.

### Native contract document response

The tenant signing session and landlord signing-review list return a complete
`terms_document`/`contract_document` view from the configured fixed Google Docs
template (`CMWEBS_CONTRACT_TEMPLATE_DOCUMENT_ID`). The server replaces the
template placeholders with canonical contract, room, property, landlord and
tenant fields; it does not generate a different standard contract when the
template is unavailable. Missing template configuration or unreadable template
content fails closed. On submission, the server copies the fixed template into
the private signing folder (`CMWEBS_CONTRACT_SIGNING_DRIVE_ROOT_FOLDER_ID`),
writes the tenant fields and signature image into that copy, promotes the
template's pending-signature evidence, and records the resulting document in
`V2_contract_signing_documents` and `tenant_signed_document_record_id`. The
tenant must read the document, complete required artifacts, draw a signature,
and submit consent; landlord review remains the activation boundary.

### Existing paid-settlement view synchronization

- No API route is added or renamed by paid-settlement view synchronization.
  The existing `landlord_payment_report_settle` and
  `landlord_bill_manual_settle` routes retain their public request and response
  envelopes.
- After either existing settlement path changes a canonical `V2_bills` row, it
  synchronizes that exact bill's `V2_tenant_bill_view` row from canonical bill
  truth. Tenant-home and landlord-tenant-list `latest_*` fields are selected
  from the latest scoped canonical bill for that tenant, so settling an older
  bill cannot regress a newer bill's summary.
- Outstanding totals are derived only from canonical unpaid, non-voided bills;
  paid, cancelled, and voided bills remain excluded.
- A bill with a nonblank `workspace_id` must exactly match the authenticated
  Workspace. A blank-workspace legacy bill is compatible only when its nonblank
  `landlord_id` matches an authorized principal in that authenticated access
  context; the legacy fallback never bypasses Workspace or role authorization.
- If a post-write projection failure prevents the settlement flow from
  verifying a consistent canonical bill/payment pair, the existing route may
  return `SETTLEMENT_COMPENSATION_UNVERIFIED`. It makes no speculative repair
  write; the exceptional state remains available to existing audit handling for
  controlled follow-up.

### `tenant_payment_report_submit`

- Resolves the requesting tenant, active contract, room, workspace, and
  landlord context through the canonical tenant runtime resolver before reading
  the requested bill.
- The optional landlord/tenant-list compatibility view is non-authoritative for
  this submit path. A missing or malformed compatibility-view row does not
  reject an otherwise valid canonical tenant identity.
- A canonical identity failure is returned as that resolver's explicit error
  envelope. If the requested bill does not link to the same requesting
  identity, tenant, contract, room, and workspace, the route returns the
  existing `BILL_NOT_FOUND` error envelope.
- This preserves the existing route name, request fields, success response, and
  the existing validation and bill-status error contracts.

### Tenant bill rate presentation

- Bill totals and other monetary amounts continue to use whole Taiwan-dollar
  currency formatting.
- Per-unit electricity and equipment rates preserve stored fractional precision
  for display (for example, `NT$ 3.5`); integer rates remain unpadded (for
  example, `NT$ 3`). This display rule does not change the stored rate or the
  existing whole-dollar calculation of bill amounts.

## V2.1 native landlord signing-review candidate routes

These routes are local-candidate additions after the immutable Version 85
baseline above. They are not deployment evidence. The immutable baseline has
69 routes; with the contract, revenue-dashboard, and document-management
candidates the current source inventory has 83 JSONP routes.

| Route / POST action | Transport | Required authority | Purpose |
| --- | --- | --- | --- |
| `landlord_contract_signing_review_auth_init` | `doPost` | A LINE `id_token` verified server-side against `CMWEBS_LINE_LOGIN_CHANNEL_ID` | Starts a short-lived, one-time exchange for an HMAC-signed landlord review session. |
| `landlord_contract_signing_review_auth_status` | JSONP `v2_action` | The authentication exchange `request_id` and secret | Redeems the one-time authentication exchange; it never accepts a raw landlord LINE UID as a review credential. |
| `landlord_contract_signing_reviews_fetch` | `doPost` | `review_session_token` in the POST body, active Workspace membership, read policy | Creates a short-lived result exchange for submitted native-signing contracts in the session's Workspace; when `contract_id` is supplied, returns that same-Workspace contract version for read-only complete-contract/signature viewing, optionally constrained by `tenant_id`. |
| `landlord_contract_signing_reviews_fetch_status` | JSONP `v2_action` | The result exchange `request_id` and `poll_secret` | Redeems the one-time list result. The URL contains no review session token. |
| `landlord_contract_signing_review_update_submit` | `doPost` | `review_session_token` in the POST body, active Workspace membership, `contract_write` policy | Creates a short-lived result exchange for an approval or rejection of one in-Workspace submitted native-signing contract. Approval revalidates required stored artifacts and is serialized with `ScriptLock`. |
| `landlord_contract_signing_review_update_status` | JSONP `v2_action` | The result exchange `request_id` and `poll_secret` | Redeems the one-time update result. The URL contains no review session token. |
| `landlord_contract_signing_reviews_init` / `landlord_contract_signing_review_update` | JSONP `v2_action` compatibility routes | None | Reject with `LANDLORD_REVIEW_POST_EXCHANGE_REQUIRED`; they no longer accept a review credential through a URL. |

- `review_session_token` is a short-lived HMAC-signed server credential. It is
  bound to the verified LINE subject, V2 user, membership, and Workspace; it
  is sent only in the `doPost` body. It must not be placed in a URL, replaced
  by a URL `line_user_id`, stored in the browser, or replaced by a
  client-supplied Workspace/user/member identifier.
- The JSONP result exchange carries only a one-time `request_id` and
  `poll_secret`; its cached result expires after 60 seconds and is removed on
  successful redemption.
- The review update is idempotent only for the same already-final decision. An
  opposite decision after finalization returns an error and does not overwrite
  the audit record.
- These routes are native V2 signing-review routes only. They do not invoke the
  legacy signed-contract integration bridge or reinterpret
  `V2_contract_requests` rows as native signing submissions.

## V2.1 landlord Email OTP candidate routes

These routes are an approved local contract for the desktop landlord Email OTP
slice. This section is not deployment evidence. The runtime and dispatcher
implementation are intentionally absent in this RED-only task.

| Route / POST action | Transport | Required authority | Request fields | Contracted response codes | Purpose |
| --- | --- | --- | --- | --- | --- |
| `landlord_email_verify_request` | `doPost` JSON body + controlled bridge | Current verified LINE landlord principal resolved server-side | `action`, `request_id`, `email` | Existing envelope with shared auth/session failures including `AUTH_REQUIRED`, `SESSION_EXPIRED`, `WORKSPACE_FORBIDDEN` | Start or resend Email verification for the currently logged-in landlord. |
| `landlord_email_verify_code` | `doPost` JSON body + controlled bridge | Current verified LINE landlord principal resolved server-side | `action`, `request_id`, `challenge_id`, `code` | Existing envelope with shared auth/session failures including `AUTH_REQUIRED`, `SESSION_EXPIRED`, `WORKSPACE_FORBIDDEN` | Verify the submitted Email code and write `email_verified_at`. |
| `landlord_email_login_request` | `doPost` JSON body + controlled bridge | Public desktop entry; server resolves the matching active landlord account | `action`, `request_id`, `email` | Existing envelope with shared auth/session failures including `AUTH_REQUIRED`, `SESSION_EXPIRED`, `WORKSPACE_FORBIDDEN` | Create or resend an Email OTP login challenge without revealing account existence. |
| `landlord_email_login_verify` | `doPost` JSON body + controlled bridge | Challenge-scoped verification only | `action`, `request_id`, `challenge_id`, `code` | Existing envelope with shared auth/session failures including `AUTH_REQUIRED`, `SESSION_EXPIRED`, `WORKSPACE_FORBIDDEN` | Verify the submitted challenge code and mint an Email session bound to the server-resolved Workspace and role. |
| `landlord_email_session_status` | `doPost` JSON body + controlled bridge | Opaque Email session token resolved server-side | `action`, `request_id`, `session_token` | Existing envelope with shared auth/session failures including `AUTH_REQUIRED`, `SESSION_EXPIRED`, `WORKSPACE_FORBIDDEN` | Re-validate the current Email session and return the active auth context. |
| `landlord_email_session_revoke` | `doPost` JSON body + controlled bridge | Opaque Email session token resolved server-side | `action`, `request_id`, `session_token` | Existing envelope with shared auth/session failures including `AUTH_REQUIRED`, `SESSION_EXPIRED`, `WORKSPACE_FORBIDDEN` | Revoke the current Email session and require a new login. |

- All six Email auth actions are POST-only. `doGet` / JSONP routes stay
  compatible for existing flows but do not carry Email, OTP code, challenge ID,
  session token, `workspace_id`, or `role`.
- The desktop request body cannot override the server-resolved `workspace_id`
  or `role`. Every protected landlord action must continue to resolve the
  active Workspace membership and authorization on the server.
- `landlord_email_login_request` and `landlord_email_login_verify` must return
  the same outward account-discovery-safe failure surface for unknown, inactive,
  and unverified accounts. This Task 1 contract does not invent additional
  action-specific `code` strings before the runtime slice lands.
- The future Email auth module is expected to publish these fixed action names:

```text
landlord_email_verify_request
landlord_email_verify_code
landlord_email_login_request
landlord_email_login_verify
landlord_email_session_status
landlord_email_session_revoke
```

## V2.1 landlord-initiated contract candidate routes

These routes implement the approved flow for new vacant-room contracts and
landlord-initiated renewals. The date-correction action was deployed with the
existing Web App as immutable Apps Script Version 139; the existing Web App
URL was preserved and Version 138 is the rollback target. Public routing was
verified, while authenticated LINE/mobile contract interaction remains
`HUMAN_REQUIRED`.

| Route / POST action | Transport | Required authority | Purpose |
| --- | --- | --- | --- |
| `landlord_contract_initiated_init` | `doPost` exchange | Landlord review session, Workspace read policy | Lists the session Workspace's pending landlord-initiated contracts without exposing confirmation codes. |
| `landlord_contract_initiate_new` | `doPost` exchange | Landlord review session, Workspace `contract_write` policy | Creates a pending new-tenant contract, provisional tenant identity, one-time invite and short confirmation code; it does not activate a room. The simplified landlord entry sends `simple_flow=true` with `room_id`, `start_date`, `term_months`, `rent_amount` and `deposit_amount`; the server computes the inclusive `end_date` (`start + term - 1 day`) and fills omitted management/payment/electricity/equipment defaults from the selected room. |
| `landlord_contract_initiate_renewal` | `doPost` exchange | Landlord review session, Workspace `contract_write` policy | Creates a new `pending_landlord_review` renewal version linked by `previous_contract_id`; it does not overwrite, invite the tenant, or activate the predecessor. |
| `landlord_contract_initiate_renewal_direct` | `doPost` exchange | Landlord review session, Workspace `contract_write` policy | Creates an append-only renewal version from an active, expired, approved or completed predecessor, records direct landlord confirmation, creates one signing invite immediately, and moves the new version to `pending_tenant_signature`. |
| `landlord_contract_renewal_draft_update` | `doPost` exchange | Landlord review session, Workspace `contract_write` policy | Updates dates, amounts, payment day, optional 30-day clause and regenerated full text of an unsigned `pending_landlord_review` renewal draft; it rejects sent/signed versions and never changes the predecessor. |
| `landlord_contract_renewal_review_confirm` | `doPost` exchange | Landlord review session, Workspace `contract_write` policy | Re-reads the selected Workspace-scoped renewal draft under `ScriptLock`, records landlord review confirmation, and automatically sends the tenant renewal inquiry before recording `renewal_inquiry_status=sent`. |
| `landlord_contract_renewal_inquiry_send` | `doPost` exchange compatibility action | Landlord review session, Workspace `contract_write` policy | Retained for older clients; sends the reviewed renewal inquiry once and is idempotent after the inquiry is already sent. The new UI does not require a second click. |
| `landlord_contract_renewal_send` | `doPost` exchange compatibility action | Landlord review session, Workspace `contract_write` policy | Retained for older accepted records; the current tenant-intent path creates one signing invite and sends it automatically after `accepted`. |
| `landlord_contract_checkout_init` | `doPost` exchange | Landlord review session, Workspace read policy | Loads one same-Workspace predecessor contract, tenant, room, immutable original end date, and checkout eligibility for the landlord-only checkout page. |
| `landlord_contract_checkout_settlement_init` | `doPost` exchange | Landlord review session, Workspace read policy | Loads the selected move-out date, prior-month unpaid electricity/equipment components, contract rent/deposit/rates, and settlement period without appending a settlement. |
| `landlord_contract_checkout_settlement_preview` | `doPost` exchange | Landlord review session, Workspace read policy | Server-calculates inclusive rent days, meter-based current utilities, deposit offset/refund, and tenant balance due without writing a bill or settlement. |
| `landlord_contract_checkout_evidence_upload` | `doPost` exchange | Landlord review session, Workspace `contract_write` policy | Stores one `checkout_start_meter` or `checkout_end_meter` JPG/PNG through the existing private Drive document path; client landlord/Workspace identifiers are not authority. |
| `landlord_contract_checkout_complete` | `doPost` exchange | Landlord review session, Workspace `contract_write` policy | Requires a server-recomputed settlement, both stored meter-photo document IDs, meter readings, and deposit fields; appends one `V2_checkout_settlements` snapshot, then idempotently marks the predecessor `terminated`, vacates and clears room/tenant/view pointers, preserves original dates/content and sends no tenant LINE notification. |
| `landlord_contract_invite_cancel` | `doPost` exchange | Landlord review session, Workspace `contract_write` policy | Cancels an unclaimed invite and its pending contract. |
| `landlord_contract_invite_reissue` | `doPost` exchange | Landlord review session, Workspace `contract_write` policy | Invalidates the current unclaimed invite, appends a replacement invite, updates the contract pointer, and returns the new QR/link payload with the one-time confirmation code only in that response. |
| `landlord_contract_initiated_status` | JSONP `v2_action` | One-time HMAC-bound request exchange | Redeems the POST result; the session token and confirmation code are not placed in the URL. |
| `tenant_contract_invite_auth_init` | `doPost` exchange | LINE `id_token`, invite ID, confirmation code and tenant data | Verifies the LINE identity, atomically claims a new-tenant or renewal invite once, and returns a short-lived invite signing session with mode-specific artifact requirements. |
| `tenant_contract_invite_auth_status` | JSONP `v2_action` | One-time HMAC-bound authentication exchange | Redeems the invite signing session result without exposing the session token in the URL. |
| `tenant_contract_invite_submit` | `doPost` exchange | Verified invite signing session, required artifacts and consent | Submits the new-tenant or renewal signing package for landlord review; it does not activate the contract. |

- New vacant-room initiation accepts blank tenant prefill data, but the tenant
  must provide a name and Taiwan mobile number before the invite can be claimed.
- New-tenant signing requires identity front, identity back and signature;
  renewal signing requires signature only.
- The direct renewal route is the short manual path for an existing or expired
  contract: the landlord confirms the new dates, amounts and optional 30-day
  clause on one page, then hands the generated invite link and confirmation
  code to the tenant. It records `renewal_inquiry_status=manual_direct` and
  does not send a separate tenant-consent inquiry.
- Checkout settlement uses the first day of the move-out month through the
  move-out date inclusively. A 9/1–9/7 checkout therefore has seven occupied
  days; current rent is prorated by calendar days, while current electricity and
  equipment fees use the meter difference. Only the immediately prior month's
  unpaid electricity and equipment components carry forward; prior rent,
  management fee and other fixed charges do not.
- Settlement snapshots are append-only in `V2_checkout_settlements`. The
  contract and existing `V2_bills` rows remain immutable. A positive deposit
  deduction requires a note and cannot exceed the contract deposit snapshot.
  Missing settlement fields or meter evidence fail closed with
  `CHECKOUT_SETTLEMENT_REQUIRED`.
- Meter evidence uses the private `V2_contract_documents` Drive path with
  `checkout_start_meter` and `checkout_end_meter` document types. The two files
  must be stored, same-Workspace, same-contract records before checkout can
  complete. These POST actions do not change the 83-route JSONP inventory.
- The expiry scheduler uses the same append-only renewal object: at 60 days it
  prepares `pending_landlord_review` and records a landlord notification; at
  30 days it sends one reminder if the draft remains unconfirmed. It never
  creates the signing invite or mutates the predecessor automatically.
- Before review confirmation, the landlord may update dates, amounts, payment
  day, and whether the 30-day expiry non-renewal offer is included; the server
  regenerates the complete contract text and leaves the previous version
  unchanged.
- After review confirmation, the system automatically sends the tenant inquiry；
  房東確認後自動詢問房客。
  A tenant cannot create a renewal request through the legacy request route; the
  tenant can only accept or decline a reviewed inquiry. An accepted inquiry
  automatically creates one signing invite and sends its URL and one-time code
  through LINE; a declined inquiry records `checkout_status=pending` and
  `checkout_source=tenant_declined` for landlord checkout.
- Checkout fields are additive-only: `checkout_status`, `checkout_source`,
  `checkout_requested_at`, `checkout_completed_at`, `checkout_move_out_date`,
  `checkout_note`, `checkout_idempotency_key`, and `terminated_at`. Completing
  checkout never overwrites the original contract dates or `contract_content`;
  原合約日期與全文不會被覆寫，且不發送房客 LINE 通知。
- After an invite is created, the draft is immutable and a new correction
  renewal version is required.
- An authorized release must explicitly run
  `installContractExpiryRenewalDailyTrigger` once. It delegates to the
  idempotent internal installer and creates (but never
  deletes or replaces) the single daily `contractExpiryRenewalRunDaily_`
  trigger, targeted for the script's 09:00 hour.
- Landlord approval is the activation boundary. It activates the new tenant,
  contract, room pointers and compatibility views, or activates a renewal while
  archiving the predecessor as renewed. All write operations re-read scoped
  rows and use `ScriptLock`, except finalization which is called inside the
  existing review update lock to avoid nested lock acquisition.
- The one-time confirmation code is returned only in the immediate create or
  reissue response for on-site handoff. It is hashed in the invite sheet and
  never returned by the list route. The list route always joins the contract's
  current `invite_id`, so a landlord can retrieve the current QR/link after
  leaving the create page.

## Landlord contract document routes

These routes are the authenticated document-management surface used by the
landlord tenant-detail page. They are included in this local repair candidate
so the frontend does not call a route that is absent from the Apps Script
dispatcher.

| Route / POST action | Transport | Required authority | Purpose |
| --- | --- | --- | --- |
| `landlord_contract_documents_init` | JSONP / bridge | Bound landlord identity and owned contract scope | Lists the landlord's owned contracts and stored contract documents, optionally filtered by `contract_id` and `tenant_id`. |
| `landlord_contract_document_download` | JSONP / bridge | Bound landlord identity and owned document scope | Returns a scoped stored document download payload without exposing Drive identifiers. |
| `landlord_contract_document_upload` | JSON POST | Bound landlord identity and owned contract scope | Stores an idempotent JPG, PNG, or PDF landlord contract document in the configured private folder. |

## Landlord paper-contract backfill（房東紙本合約補登）

This is a landlord-only V2.1 POST action. It does not add a JSONP route, so the
canonical `83`-route inventory above remains unchanged. The current Production
release serves it from Apps Script Version 153 and the published `main` Pages
build at release commit `a14262f`.

| Route / POST action | Transport | Required authority | Purpose |
| --- | --- | --- | --- |
| `landlord_contract_paper_backfill` | JSON POST | Landlord review session with Workspace `contract_write` policy; server-side room, tenant, property and overlap scope | Records a paper-signed contract（紙本簽署合約）directly as an active or upcoming append-only contract. The signed paper contract file is required; identity front/back files are optional and can be uploaded later. It does not create a contract application, electronic invite, signing session, confirmation code, or LINE message. |

- The server validates the Taiwan mobile number, dates, amounts, room vacancy,
  existing-tenant ownership, duplicate phone, and idempotency payload before any
  Sheet or private Drive write.
- The normal POST does not add Sheet headers or run migration. Missing required
  `V2_contracts` backfill headers returns `PAPER_BACKFILL_SCHEMA_NOT_READY` and
  requires a separately authorized additive migration before retrying.
- The release migration entry point is
  `runV2LandlordPaperContractBackfillProductionMigration`. It only appends the
  missing `paper_backfill_idempotency_key` and `paper_backfill_payload_hash`
  headers to the existing `V2_contracts` header row, is idempotent, and never
  creates a sheet or changes contract rows.
- The required contract file and optional identity files are stored through the
  private `V2_contract_documents` path. Public responses contain document
  summaries only and never expose Drive file IDs or file bytes.
- The action appends the contract and, for a new paper tenant, the tenant/user
  rows; it updates room and compatibility-view pointers under the existing
  landlord contract `ScriptLock`. Existing contracts, bills and historical
  documents are not overwritten.
- An optional `supersede_contract_id` is accepted only for the same Workspace,
  room and tenant when the target is an unclaimed `landlord_initiated` contract
  in `pending_tenant_signature` or `awaiting_tenant_signature`. The target
  electronic contract row and its pending invite remain in the audit trail and
  are marked `cancelled`; the new paper row links back through
  `previous_contract_id`, activates the existing pending tenant account as
  `unbound`, and does not create a replacement electronic invite or send LINE.
  Claimed, completed, mismatched, or otherwise active contracts remain blocked.
- A legacy pending contract with the same Workspace, room and existing tenant,
  but blank `contract_origin` and `invite_id`, is also eligible when it has no
  LINE identity. The paper row reuses that tenant/user, closes the legacy
  pending row as `cancelled`, links through `previous_contract_id`, and keeps
  the operation LINE-free.
- A separate orphan-recovery form of `supersede_contract_id` is accepted only
  when the same-Workspace source contract has no matching `V2_tenants` row and
  no LINE identity. The source contract is retained and marked `cancelled`, an
  optional pending invite is also closed, and the new paper row links through
  `previous_contract_id`; a source contract with an existing tenant or LINE
  binding remains blocked.

The landlord tenant-create initialization route also accepts the optional
`supersede_contract_id` query parameter so the paper form reads the selected
electronic contract directly, including explicit zero-valued fee fields.

## Signed legacy contract integration webhook

| POST action | Module | Purpose |
| --- | --- | --- |
| `legacy_contract_signed_sync` | `V2_LEGACY_CONTRACT_SIGNED_SYNC.js` | Accepts only the legacy signed-contract integration's HMAC-authenticated JSON body, verifies its existing V1/V2 contract, tenant LINE UID, Workspace write access, and updates metadata on an existing V2 contract. |

- This is a `doPost` integration action, not a LIFF `v2_action`; the 69 JSONP
  route count does not change.
- `timestamp` remains in the body and `signature` is an HMAC-SHA256 of the raw
  body passed as a query parameter. The secret is read only from Script
  Property `CMWEBS_LEGACY_CONTRACT_SYNC_HMAC_SECRET`.
- The bridge does not create contracts or schema columns. A missing optional
  contract field returns `V2_CONTRACT_SYNC_SCHEMA_NOT_READY` before any write.
- Private document and identity metadata must never be included in tenant or
  general-message API responses.

## Version 102 payment-reconciliation candidate — 2026-08-12

This section records a local reconciliation candidate only. It is not the
canonical source, a deployment record, or authorization to change Production.

- `tenant_payment_report_init` reads the canonical tenant runtime bill rows and
  excludes rows without a nonblank `bill_id`, preventing blank payment-report
  cards from being rendered.
- `tenant_payment_report_submit` uses the same canonical bill-row source and
  preserves the existing tenant, contract, room, Workspace, duplicate-report,
  paid-bill, and voided-bill checks.
- `landlord_payment_reports_init` derives an effective report status from the
  matching `V2_bills` row. A legacy `pending`/`payment_reported` report whose
  bill is already `paid` is returned as `confirmed`, so it is excluded from
  pending-review counts without mutating either sheet.
- `landlord_payment_report_settle` rejects a report without `bill_id` before
  any settlement write and continues to require authorized landlord access and
  bill Workspace scope.

The route names and public request envelopes are unchanged. Any Production
release still requires a separate immutable-version, rollback, schema, and
authenticated runtime verification packet.
