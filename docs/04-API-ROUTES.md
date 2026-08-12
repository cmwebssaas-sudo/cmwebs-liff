# CMWebs V2 API Routes

## Canonical baseline

This inventory is generated from the verified, immutable Production Apps Script
**Version 85** source snapshot. It is a local Gate 0 canonical-source candidate,
not a deployment instruction and not evidence that the repository has been
deployed.

- Dispatcher: `apps-script/程式碼.js`
- Route count: **69** unique `v2Action` routes
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
landlord_properties_init
landlord_property_archive
landlord_property_save
landlord_register_submit
landlord_room_archive
landlord_room_save
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
tenant_home
tenant_message_init
tenant_message_submit
tenant_payment_report_init
tenant_payment_report_submit
```

## Payment-report and bill-display contracts

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
