# Paid bill view-sync review fix

## Purpose

Correct the two review findings in the paid-bill view synchronization candidate
without changing Production data or deployment state.

## Scope

1. A payment settlement for an older bill must not replace a newer bill in the
   tenant-home or landlord-tenant-list `latest_*` fields.
2. A legacy bill with an empty `workspace_id` remains eligible when its
   `landlord_id` belongs to the authenticated Workspace principals, matching
   the existing billing read compatibility rule.

## Design

`billingSyncBillViews_` remains the single view-sync entry point. It will
continue to upsert the exact tenant-bill-view row for the settled bill and
recompute unpaid totals from the canonical formal bills.

For tenant-home and landlord-tenant-list summary rows, it will select the
latest formal bill for the affected tenant within the same authorised scope
before writing the `latest_*` fields. The comparison uses normalized bill
months, with a deterministic existing-row fallback when month values are
equal or unavailable. A settlement for an older bill therefore updates totals
but preserves a newer bill's latest fields.

Settlement access validation will use the same Workspace-first, authorised
principal fallback used by `billingGetWorkspaceRows_`: a populated
`workspace_id` must match the resolved Workspace; an empty `workspace_id` is
allowed only when the bill `landlord_id` is one of the resolved principals.

## Safety and error handling

- Access validation happens before payment, bill, view, summary, audit, or
  notification writes.
- A bill outside the resolved Workspace/principal scope returns an explicit
  error and performs no write.
- The targeted Room 506 correction still requires one canonical formal bill,
  one matching view row, paid formal status, fixed meter guards, and dry-run
  no-write behaviour.
- No LINE message, Apps Script deployment, GitHub Pages publication, or
  Production data mutation belongs to this change.

## Tests

- Settlement source paths invoke the view synchronization before flush.
- A stale unpaid view for an otherwise paid Room 506 bill is accepted by the
  dry-run preflight without a write.
- A later bill remains the latest summary bill when an earlier paid bill is
  synchronized.
- A legacy bill with an empty `workspace_id` is accepted only for an
  authorised principal and rejected otherwise.

## Out of scope

- Bulk repair of historical bill views.
- Changes to payment amounts, payment records, LINE notifications, or schema.
- Production deployment or data correction.
