# Automatic settlement completion notification repair

Recommended model/speed: gpt-5.6-terra / medium. User reported the last visible LINE message still requested landlord approval after email auto settlement.

The auto path returned the settlement result envelope instead of the persisted receipt; notification selection only included pending/unmatched receipts. Successful auto settlement therefore emitted no completion notice. Fix returns authoritative receipt and marks new automatic completion for a separate stable notification event. Wording states automatic reconciliation complete, bill settled, no further confirmation required. Pending/unmatched retains manual review wording. Canonical payment/report/bill evidence is required; no settlement-label-only success. Failed and partial deliveries retry with the same provider idempotency key. Previously sent pending messages cannot be rewritten. Existing settled history is not bulk re-notified.

No matching/amount/payment rules, triggers, scopes, Properties, schema or frontend change. No manual production scan, financial mutation or real notification test. Rollback: existing Web App/editor HEAD224; frontend unchanged. Private original HEAD/immutable224 exports: /Users/hans/CMWebs/cmwebs-auto-notice-u1xl343v;61 files matched fresh main b96499a.

Validation:729 full tests,42 bank runtime tests, validate/diff-check. Independent review repaired partial-delivery retry. Production publication evidence follows.
