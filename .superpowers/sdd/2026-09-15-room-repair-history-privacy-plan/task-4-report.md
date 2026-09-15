# Task 4 report — idempotent repair-ticket legacy backfill

## Scope

- Modified `apps-script/V2_REPAIR_TICKETS.js`.
- Added `tests/phase264-repair-ticket-migration.test.mjs`.
- Updated `docs/05-DATA-MODEL.md` with the preview-to-rollback operator runbook.

## Local verification

- `node --test tests/phase264-repair-ticket-migration.test.mjs`
- `node --test tests/phase262-repair-ticket-contract.test.mjs`
- `node --test tests/phase263-repair-ticket-runtime.test.mjs`
- `node --check apps-script/V2_REPAIR_TICKETS.js`
- `npm run validate`
- `git diff --check`

## Commit

- Local commit: `feat: add idempotent repair ticket backfill`
- Fix round 1 local commit: `fix: serialize repair ticket backfill`.

## Fix round 1

- Apply now acquires one `ScriptLock` before a fresh scan and retains it through
  ticket/event creation and source-link reconciliation. The normal ticket-intake
  helper retains its independent locking path; migration uses a lock-held helper
  to avoid nested lock deadlock.
- Existing tickets with blank source `repair_ticket_id` are reported in preview
  and reconciled with one source-link write in apply, without a second
  `legacy_backfill` event.

## Remaining boundaries

- `HUMAN_REQUIRED`: an authorized operator must inspect preview output, take a
  verified backup, and explicitly authorize any `apply` run in the correct
  Apps Script context.
- No real Sheet migration, deployment, push, merge, LINE notification, or
  authenticated browser acceptance was performed by this task.
