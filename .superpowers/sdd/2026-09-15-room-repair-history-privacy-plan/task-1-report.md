# Task 1 report — Freeze room repair-ticket schema and privacy contract

## Status

DONE_WITH_CONCERNS

## TDD evidence

RED was written first in `tests/phase262-repair-ticket-contract.test.mjs` and
run with:

```text
node --test tests/phase262-repair-ticket-contract.test.mjs
```

The expected failure was observed: both tests failed because the canonical
`V2_repair_tickets` headers/statuses/actions contracts did not exist. An
initial parser syntax error was corrected before accepting the RED result; the
final RED failure was an assertion for missing canonical headings.

GREEN was verified with the same command:

```text
✔ freezes repair ticket headers and tenant privacy projection
✔ freezes repair ticket statuses and documented actions
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

Relevant validation:

```text
npm run validate
PASS: 56 backend files parsed; 37 endpoint references match the recorded deployment.
Static release cache validation passed: safe version uses=66, API anti-cache keys=42, fallback tests=4, URL tests=8, static cache bust remaining=0.

git diff --check
PASS (no output)
```

## Changed files

- `docs/05-DATA-MODEL.md`: appended canonical `V2_repair_tickets` and
  `V2_repair_events` headers, ticket statuses, and tenant-safe projection
  allowlist; documented server-side filtering before serialization.
- `docs/04-API-ROUTES.md`: documented the three repair-ticket actions, required
  identity/Workspace checks, landlord and tenant projection boundaries, and
  rejection of undocumented query-string actions.
- `docs/09-TEST-MATRIX.md`: added Phase 262 privacy, cross-tenant, append-only
  history, status, and action acceptance cases.
- `tests/phase262-repair-ticket-contract.test.mjs`: added the focused parser
  contract tests for exact headers, privacy fields, statuses, and actions.

No Apps Script, UI, migration, deployment, or Production files were changed.

## Commit

`cc4d5a312699575ae51860cea3607c6a14e190fc` —
`docs: freeze repair ticket privacy contract`

Branch remains `codex/repair-ticket-implementation-20260915`; working tree is
clean and is ahead of `origin/main` by three commits.

## Concerns and boundaries

- `docs/EXECUTION_RECORD.md` and `docs/00-HANDOFF-INDEX.md`, required by the
  repository instructions, are absent from this worktree; this is recorded as
  a documentation baseline concern and was not fabricated or modified.
- This task intentionally did not run the full Node suite or any Apps Script
  runtime test because the brief limits the change to documentation and the
  contract test. Production and authenticated real-device acceptance remain
  outside this task.

## Review-fix report — 2026-09-15

### Findings fixed

- Added the complete tenant response denylist for identity data, email, phone,
  LINE IDs, original message content, internal notes, attachment IDs and
  identifiers, filenames, private metadata, and permanent download URLs; the
  focused test now asserts every denied field is absent.
- Changed the contract test from partial checks to exact complete ticket
  headers, exact complete tenant allowlist, and exact three action names.
- Explicitly defined `source_message_id` as the preserved
  `V2_tenant_messages.message_id` link and prohibited overwriting or deleting
  the original message row.
- Moved the repair-ticket API section out from under the signed legacy webhook
  section into a standalone `## Repair-ticket actions` section.

### Changed files

- `docs/05-DATA-MODEL.md`
- `docs/04-API-ROUTES.md`
- `tests/phase262-repair-ticket-contract.test.mjs`
- This report file

### RED / GREEN and validation commands

RED after tightening the test was verified with:

```text
node --test tests/phase262-repair-ticket-contract.test.mjs
✔ freezes repair ticket headers and tenant privacy projection
✖ freezes repair ticket statuses and documented actions
AssertionError: missing ### Repair-ticket actions section
```

The failure was expected from the test/document heading mismatch introduced by
the standalone-section correction; the test was then aligned to the canonical
`## Repair-ticket actions` heading.

GREEN and required validation were run with:

```text
node --test tests/phase262-repair-ticket-contract.test.mjs
✔ freezes repair ticket headers and tenant privacy projection
✔ freezes repair ticket statuses and documented actions
ℹ tests 2
ℹ pass 2
ℹ fail 0

npm run validate
PASS: 56 backend files parsed; 37 endpoint references match the recorded deployment.
Static release cache validation passed: safe version uses=66, API anti-cache keys=42, fallback tests=4, URL tests=8, static cache bust remaining=0.

git diff --check
PASS (no output)
```

### Fix commit

`2f29562590ef3ccc15fee7be4c946ebcc45f58cf` —
`docs: tighten repair ticket privacy contract`
