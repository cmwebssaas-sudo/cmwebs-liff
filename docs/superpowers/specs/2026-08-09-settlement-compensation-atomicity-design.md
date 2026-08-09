# Settlement Compensation Atomicity Design

## Goal

Eliminate the remaining local-candidate failure mode where a view-sync error
can leave a paid bill and its payment record in contradictory states. The
change applies only to the two landlord settlement flows and does not add a
route, schema field, background worker, or Production migration.

## Root cause

The existing settlement update helpers apply an object one header at a time
with `setValue`. A failed multi-field compensation can therefore partially
write `status`, `updated_at`, or `note`. If a later read-back fails, the
current compensation logic guesses whether to reapply the paid bill state.
That guess can make a paid bill point at a void payment, or an unpaid bill
point at a confirmed payment.

## Chosen design

### Atomic row writes

Both settlement modules will replace their object-update helpers with a
single-row read-modify-write operation:

1. Read the complete header row and target row once.
2. Build the updated row in memory, retaining every unmentioned cell.
3. Write the complete row in one `setValues([[...]])` call.
4. Read the complete row back and compare the requested fields exactly.

The helper returns either a verified success snapshot or throws a typed local
write-verification error. It never treats an unknown read-back as success.

### Compensation state machine

Before canonical settlement writes, preserve full bill and payment snapshots.
If projection synchronization fails before canonical completion:

1. Restore the full original bill row with the verified row helper.
2. Void the newly appended payment row with the verified row helper.
3. Verify the stable pair is either `unpaid bill + void payment` or, only if
   the bill restoration could not be verified and the payment is verified
   confirmed, `paid bill + confirmed payment`.
4. If neither stable pair can be verified, do not guess or apply another
   compensating write. Throw a distinct `SETTLEMENT_COMPENSATION_UNVERIFIED`
   error after recording the existing failure audit context.

This explicitly avoids claiming cross-row database transactions. It makes
each row write and each compensation transition verifiable, and preserves a
deterministic fail-closed result when Google Sheets cannot establish the final
state.

### Scope and compatibility

- `billingPreflightBillViews_` and Workspace-first authorization remain before
  canonical writes.
- Existing authorized success and rejection response envelopes remain
  unchanged. The new compensation error is only for an already exceptional,
  unverified post-write failure state.
- Exact bill-view synchronization, latest-summary selection, canonical
  outstanding calculation, and legacy projection isolation are unchanged.
- No new Properties, sheet columns, triggers, notifications, LINE calls, or
  payment actions are introduced.

## Tests

The focused runtime harness will first reproduce and assert failure for:

- a payment void whose requested multi-field update partially writes;
- a failed payment-row read-back during compensation;
- a failed bill-row restoration verification.

After implementation, each case must prove that either a verified stable
payment/bill pair remains or the new explicit unverified-compensation error
is returned without a speculative repair write. Existing cross-Workspace,
legacy projection, old-bill latest-summary, and paid/cancelled/voided
regressions must continue to pass.

## Non-goals

- No historical data repair or migration.
- No deployment, Git push, Production Sheet mutation, LINE delivery, or real
  payment action.
- No new asynchronous reconciliation queue or V3/V4 functionality.
