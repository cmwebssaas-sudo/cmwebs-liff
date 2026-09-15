# Task 4 report — idempotent repair-ticket legacy backfill

## Scope

- Modified `apps-script/V2_REPAIR_TICKETS.js`.
- Added `tests/phase264-repair-ticket-migration.test.mjs`.
- Updated `docs/05-DATA-MODEL.md` with the preview-to-rollback operator runbook.

## Local verification

- `node --test tests/phase264-repair-ticket-migration.test.mjs`
- `node --test tests/phase263-repair-ticket-runtime.test.mjs`
- `node --check apps-script/V2_REPAIR_TICKETS.js`
- `npm run validate`
- `git diff --check`

## Commit

- Local commit: `feat: add idempotent repair ticket backfill`

## Remaining boundaries

- `HUMAN_REQUIRED`: an authorized operator must inspect preview output, take a
  verified backup, and explicitly authorize any `apply` run in the correct
  Apps Script context.
- No real Sheet migration, deployment, push, merge, LINE notification, or
  authenticated browser acceptance was performed by this task.
