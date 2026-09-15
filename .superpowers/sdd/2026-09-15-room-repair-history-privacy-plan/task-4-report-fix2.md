# Task 4 fix round 2 report

## Findings addressed

- Same-batch normalized `source_message_id` values are deduplicated during the
  locked scan. Only the first source row creates a ticket and appends the
  `legacy_backfill` event. Duplicate rows are exposed by
  `duplicate_source_message_ids` and receive the ticket's additive source link
  without another event or `created_count` increment.
- `writes` now counts every migration-initiated Sheet cell mutation call:
  `appendRow`, `setValue`, and `setValues`. It includes first-run header
  provisioning, ticket/event rows, status projection, and source links; it
  excludes reads and `insertSheet` tab creation. Regression tests compare the
  returned number directly to the fake Sheet write log for first-run,
  reconciliation, and rerun paths.

## Files

- `apps-script/V2_REPAIR_TICKETS.js`
- `tests/phase264-repair-ticket-migration.test.mjs`
- `docs/05-DATA-MODEL.md`

## Verification

- `node --test tests/phase264-repair-ticket-migration.test.mjs`
- `node --test tests/phase262-repair-ticket-contract.test.mjs tests/phase263-repair-ticket-runtime.test.mjs`
- `node --check apps-script/V2_REPAIR_TICKETS.js`
- `npm run validate`
- `git diff --check`

## Commit and boundaries

- Local commit: `fix: harden repair ticket backfill accounting`.
- `HUMAN_REQUIRED`: preview inspection, backup verification, and explicit
  operator authorization remain required before any real apply.
- No real Sheet apply, deployment, push, merge, or LINE operation was run.
