# August Billing Payment-Report Resilience Design

## Goal

Allow a tenant with a valid canonical identity and active contract to submit a
payment report even when the optional landlord/tenant list read-model has a
spreadsheet `#REF!` failure; display decimal equipment rates faithfully in the
tenant bill page.

## Scope

This candidate changes only the payment-report server path and the tenant bill
rate presentation. It adds regression coverage and the required API behaviour
documentation. It does not create a route, change a sheet schema, repair a
spreadsheet formula, change an existing bill, send LINE, deploy, publish, or
push Git.

The small resolver adjustment is within this scope only because the canonical
payment-report projection sets `include_landlord_tenant_list_view: false`:
that makes the compatibility view optional for this projection while retaining
the existing master-chain and fail-closed checks. It is not a broader resolver
or data-model expansion.

The incorrect August room-506 bill is deliberately excluded. It is already
marked paid, so any data correction needs a separately authorised,
auditable Production procedure after payment facts are confirmed.

## Root Cause

`submitTenantPaymentReportByLineUid_()` first successfully obtains Tenant Home
data, then independently requires a matching row in
`V2_landlord_tenant_list_view`. The live read-model has a `#REF!` row and no
usable tenant relation. Consequently the submit path returns
`TENANT_LANDLORD_LINK_NOT_FOUND` before it checks the target bill.

The tenant bill page uses its integer currency formatter for
`equipment_fee_rate`; this applies `Math.round(3.5)` and renders `NT$ 4` even
though the stored rate and the computed equipment amount remain 3.5-based.

## Design

### Payment-report context

Add a small private helper in `V2_TENANT_PAYMENT_REPORTS.js` that calls
`resolveCanonicalTenantRuntimeByLineUid_(lineUserId, {
include_bill_master: false
})`. It returns only the fields the submit path needs:

- `tenant_id`, `tenant_user_id`, `tenant_name`
- `workspace_id`, `landlord_id`, `landlord_line_user_id`
- `contract_id`, `property_id`, `room_id`, `room_name`

The helper propagates the canonical resolver's explicit failure envelope. It
does not treat a missing or malformed landlord-list view row as a successful
identity by itself; the canonical resolver must still prove one tenant, one
active contract, one property, one room, one workspace, and a consistent
landlord ID.

`submitTenantPaymentReportByLineUid_()` will use that context for report and
notification metadata. The bill lookup will require the same tenant ID,
workspace ID, contract ID, room ID, and the requesting LINE identity. A bill
from another tenant or workspace remains `BILL_NOT_FOUND`. The notification
worker continues to receive the canonical workspace and landlord IDs; an
available canonical landlord LINE ID remains only a fallback.

The legacy list view is no longer read by this submit path. Its repair remains
a separate data-quality operation.

### Decimal rate presentation

Add a rate-specific formatter in `tenant-bills.html` that:

- returns `NT$ 0` for zero;
- preserves up to the supported stored precision for non-integers (for example
  `NT$ 3.5`);
- keeps integer rates rendered as integers (for example `NT$ 3`).

Use it only for per-unit electricity/equipment rates and their explanatory
calculation text. Continue using `money()` for actual monetary amounts,
including rounded equipment fees and total amount.

## Contracts Preserved

- The existing `tenant_payment_report_submit` action and response fields do
  not change.
- Existing invalid input, duplicate pending report, paid bill, voided bill,
  and notification-worker handling remain unchanged.
- No new frontend API URL, LIFF identity, route, or schema is introduced.
- Tenant identity, active-contract, workspace, room, and bill ownership checks
  are stricter than the current optional-view lookup, not looser.

## Test Matrix

1. A valid canonical tenant with a malformed/empty landlord-list view can
   submit its own unpaid bill and receives the normal success envelope.
2. A bill owned by a different tenant or workspace remains rejected.
3. An inactive/missing contract or inconsistent workspace stays rejected by
   the canonical resolver.
4. A duplicate pending report, paid bill, and cancelled bill retain their
   existing error codes.
5. A rate of 3.5 renders as `NT$ 3.5`, while 239 units at 3.5 still yields the
   pre-existing rounded amount of `NT$ 837`.
6. An integer rate still renders without an unnecessary decimal fraction.

## Verification

Run the focused payment-report and tenant-bill presentation tests, the
repository validator, Apps Script syntax checks, and `git diff --check`. Scan
the candidate diff for tokens, raw LINE IDs, spreadsheet IDs, and production
record IDs. No test may call a live URL or a Production Apps Script function.

## Rollback

No Production state changes occur in this candidate. If later deployed, the
rollback is the prior immutable Apps Script version plus the prior GitHub Pages
commit; the candidate does not require a migration or a data rollback.
