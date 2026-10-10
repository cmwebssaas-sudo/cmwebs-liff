# Phase 43 — Tenant Production Data Diagnosis Runbook

Date: 2026-07-20

Purpose: safely make the read-only `diagnoseTenantDataConsistency()` test available in Apps Script and run it manually without deploying a new Web App version or changing production Sheet data.

## Current readiness result

Current branch: `chore/v2-production-consolidation`

Current validation:

- `npm run validate`: PASS
- Routes: 68 unique
- Handler coverage: 68/68
- Duplicate top-level declarations: 0
- Blocking credentials: 0
- Hardcoded LINE UID findings: 0
- `git diff --check`: PASS
- `apps-script/TESTS.js` JavaScript syntax: PASS

Current clasp configuration:

- `apps-script/.clasp.json` exists;
- it is ignored by `.gitignore` and is not tracked by Git;
- its identifier must remain confidential;
- `rootDir` is empty relative to `apps-script/`, so the Apps Script source root is the complete `apps-script/` directory;
- JavaScript, Apps Script, HTML, and JSON extensions are enabled;
- subdirectories are not skipped;
- `apps-script/.claspignore` does not currently exist.

Current decision: **DO NOT RUN `clasp push` yet.**

The `apps-script/` directory contains several modified or untracked modules in addition to `TESTS.js`. Because clasp pushes the project source rather than one selected function, a push from this working tree would include Phase 40/41 backend changes outside the Phase 42 diagnosis-only scope. The absence of `.claspignore` provides no additional local exclusion boundary.

## Phase 42 manual diff review

The Phase 42 addition is `diagnoseTenantDataConsistency()` in `apps-script/TESTS.js`.

Review result:

- reads `TEST_TENANT_LINE_UID` through `getRequiredScriptProperty_()`;
- reads exactly these Sheets: `V2_users`, `V2_tenants`, `V2_contracts`, `V2_bills`, `V2_tenant_home_view`, `V2_tenant_bill_view`, and `V2_landlord_tenant_list_view`;
- uses only `getSheetByName()`, `getDataRange()`, and `getValues()` for Spreadsheet access;
- outputs only through `Logger.log()` and the function return value;
- does not call a route, production API handler, repair function, migration function, LINE helper, or notification function;
- contains no `setValue`, `setValues`, `appendRow`, row insertion/deletion, Sheet creation/deletion, or formatting mutation;
- does not hardcode the test LINE UID;
- preserves the physical Sheet row number in each result;
- emits a detailed JSON result followed by `RESULT: PASS` or `RESULT: FAIL`.

No route, handler, HTML, API, Sheet schema, or deployment file is part of the Phase 42 change.

## Pre-`clasp push` checklist

Do not continue unless every item is confirmed.

- [ ] Human approval to change Apps Script project source has been given.
- [ ] Branch is `chore/v2-production-consolidation`.
- [ ] `npm run validate` is PASS.
- [ ] `git diff --check` is PASS.
- [ ] `apps-script/.clasp.json` exists, is ignored, and is not tracked.
- [ ] The configured Script ID has been verified privately against the intended production Apps Script project; do not paste it into a ticket, log, or document.
- [ ] A rollback source or Apps Script version/source snapshot has been recorded.
- [ ] `git status --short apps-script` contains only files explicitly approved for the source update.
- [ ] The complete output of `clasp status` has been reviewed from the `apps-script/` directory.
- [ ] The push set contains no `.clasp.json`, credential file, local backup, OAuth token, or unrelated module.
- [ ] No Web App deploy command is included in the operation.

For a diagnosis-only push, the safe push set must be the approved production source plus the Phase 42 `TESTS.js` addition only. If other backend changes remain in `apps-script/`, stop and use a separately reviewed clean source tree or obtain explicit approval for the complete backend diff. Do not create ad-hoc ignore rules that could accidentally omit required production modules.

Important: `clasp push` changes the Apps Script project's editable source even when `clasp deploy` is not run. Treat it as a production-source mutation and require the same backup and review discipline.

## Manual Apps Script execution

Perform these steps only after the source update has been separately approved and completed.

1. Open the intended Apps Script project and verify the project identity privately.
2. Confirm `TESTS.js` contains `diagnoseTenantDataConsistency()`.
3. Open Project Settings → Script Properties.
4. Confirm `TEST_TENANT_LINE_UID` exists. Do not copy its value into this repository, screenshots, filenames, chat, or tickets.
5. Return to the editor and select only `diagnoseTenantDataConsistency` from the function selector.
6. Confirm no function whose name contains `repair`, `migration`, `create`, `submit`, `send`, `push`, or `sync` is selected.
7. Run `diagnoseTenantDataConsistency()` once.
8. Complete the normal Apps Script authorization prompt only if it refers to the expected project and account.
9. Open Execution log and wait for the function to finish.
10. Save the diagnostic JSON in an access-controlled location. Redact the full LINE UID before copying results into repository documentation.
11. Record only the execution time, final status, mismatch types, Sheet names, and row numbers needed for human review.
12. Do not execute any repair based solely on this output.

This manual run reads production Sheets but does not write them. It does not call the five public API routes; it compares their underlying data sources directly.

## Expected Logger output

The first Logger entry is a JSON object with this structure:

```json
{
  "diagnostic": "diagnoseTenantDataConsistency",
  "read_only": true,
  "test_tenant_line_uid": "[REDACTED]",
  "sheets_checked": [
    "V2_users",
    "V2_tenants",
    "V2_contracts",
    "V2_bills",
    "V2_tenant_home_view",
    "V2_tenant_bill_view",
    "V2_landlord_tenant_list_view"
  ],
  "rows": [
    {
      "sheet": "V2_tenants",
      "row": 2,
      "workspace_id": "...",
      "tenant_id": "...",
      "contract_id": "...",
      "bill_id": "...",
      "line_uid": "[REDACTED]",
      "tenant_code": "...",
      "room_id": "..."
    }
  ],
  "checks": {
    "missing_data": [],
    "duplicate": [],
    "workspace_id": [],
    "tenant_id": [],
    "line_uid": [],
    "contract_id": []
  },
  "mismatches": [],
  "status": "PASS"
}
```

The final Logger entry is exactly one of:

```text
RESULT: PASS
```

```text
RESULT: FAIL
```

The actual output may contain multiple rows per Sheet. Never infer PASS from row counts alone; use the final status and inspect every mismatch.

## PASS criteria

`PASS` is emitted only when all of the following hold:

- all seven Sheets exist;
- every Sheet has at least one row related to the test tenant identity chain;
- no canonical row key is missing;
- no canonical key is duplicated within a Sheet;
- all non-empty `workspace_id` values resolve to one value;
- all non-empty `tenant_id` values resolve to one value;
- all non-empty `contract_id` values resolve to one value;
- every exposed tenant LINE UID matches `TEST_TENANT_LINE_UID`;
- at least one canonical `bill_id` exists;
- at least one canonical `room_id` exists;
- `mismatches` is empty.

## FAIL criteria

`FAIL` is emitted when one or more mismatch objects exist. Possible mismatch types include:

- `MISSING_SHEET`: a required Sheet does not exist;
- `MISSING_RELATED_ROW`: the Sheet exists but no related test-tenant row is found;
- `MISSING_CANONICAL_KEY`: a related row lacks the Sheet's canonical key;
- `MISSING_CANONICAL_VALUE`: a required cross-Sheet identifier is absent;
- `DUPLICATE_ROW`: the same canonical key occurs more than once in a Sheet;
- `WORKSPACE_ID_MISMATCH`: related rows contain different Workspace IDs;
- `TENANT_ID_MISMATCH`: related rows contain different tenant IDs;
- `CONTRACT_ID_MISMATCH`: related rows contain different contract IDs;
- `LINE_UID_MISMATCH`: a related row exposes a different tenant LINE UID.

A known duplicate in `V2_landlord_tenant_list_view` should remain a FAIL result if both rows have the same canonical Workspace/tenant/contract key. The diagnosis must not delete or consolidate either row.

## Strictly prohibited during diagnosis

- Do not run any function containing `repair` or `migration`.
- Do not run binding, onboarding, bill creation, payment, settlement, reversal, notification, or LINE test functions.
- Do not use `setValue`, `setValues`, `appendRow`, row insertion/deletion, or direct Sheet editing.
- Do not send LINE messages.
- Do not change Script Properties.
- Do not run `clasp deploy`.
- Do not create a new Web App version or change the Web App URL.
- Do not commit or push Git changes without separate human approval.
- Do not mark data as repaired after a diagnostic-only run.

## After a FAIL result

Stop after recording the mismatches. Review the reported Sheet names, physical row numbers, and identifier differences with a human. Create a separate repair plan and rollback plan if correction is authorized. Do not execute any repair, migration, synchronization, deletion, or LINE notification as part of Phase 43.
