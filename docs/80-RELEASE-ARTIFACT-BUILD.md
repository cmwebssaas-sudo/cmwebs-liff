# Phase 80 — Production Release Artifact Build

## Status

- Artifact status: **BUILT AND LOCALLY VALIDATED**
- Source modification: none; release files are byte-for-byte copies of the current canonical source
- Commit: not performed
- Git push: not performed
- `clasp push`: not performed
- Deployment: not performed

## Artifact Location

```text
release/phase80/
├── apps-script/
│   ├── 30 production JavaScript modules
│   └── appsscript.json
├── frontend/
│   ├── tenant-bind.html
│   ├── tenant-home.html
│   ├── tenant-bills.html
│   └── tenant-message.html
├── APPS-SCRIPT-SHA256SUMS
├── FRONTEND-SHA256SUMS
└── RELEASE-MANIFEST.json
```

The artifact intentionally does not contain `.clasp.json`. Project binding must be supplied and verified separately at deployment time without adding it to Git.

## Included Files

### Apps Script runtime

The backend contains 30 `.js` modules plus `appsscript.json`:

1. `V2_ANNOUNCEMENT_MANAGEMENT.js`
2. `V2_API.js`
3. `V2_AUTO_PAYMENT_REMINDER.js`
4. `V2_BILLING_MANAGEMENT.js`
5. `V2_BILL_NOTIFICATIONS.js`
6. `V2_CONTRACT_REQUESTS.js`
7. `V2_LANDLORD_MANAGEMENT.js`
8. `V2_LANDLORD_ONBOARDING.js`
9. `V2_MANUAL_SETTLEMENT.js`
10. `V2_PAID_BILL_MANAGEMENT.js`
11. `V2_PAYMENT_REVERSAL.js`
12. `V2_PAYMENT_SETTLEMENT.js`
13. `V2_PROPERTY_ROOM_MANAGEMENT.js`
14. `V2_RUNTIME_SNAPSHOT.js`
15. `V2_SETTINGS_INTEGRATION.js`
16. `V2_SYSTEM_SETTINGS.js`
17. `V2_TEAM_MANAGEMENT.js`
18. `V2_TENANT_BINDING_PHONE.js`
19. `V2_TENANT_CHECKIN_MANAGEMENT.js`
20. `V2_TENANT_LEASE_ONBOARDING.js`
21. `V2_TENANT_MESSAGES.js`
22. `V2_TENANT_PAYMENT_REPORTS.js`
23. `V2_TENANT_RUNTIME_RESOLVER.js`
24. `V2_WORKSPACES.js`
25. `V2_WORKSPACE_CREATION.js`
26. `V2_WORKSPACE_DASHBOARD_NATIVE.js`
27. `V2_WORKSPACE_LANDLORD_ACCESS.js`
28. `V2_WORKSPACE_NOTIFICATIONS.js`
29. `V2_WORKSPACE_OPERATION_AUDIT.js`
30. `程式碼.js`
31. `appsscript.json`

`V2_RUNTIME_SNAPSHOT.js` is included as a required production dependency. It owns the request-level snapshot and spreadsheet-handle reuse helpers used by the runtime modules.

### Frontend

1. `tenant-bind.html`
2. `tenant-home.html`
3. `tenant-bills.html`
4. `tenant-message.html`

### Integrity records

- `APPS-SCRIPT-SHA256SUMS`: SHA-256 values for all 31 backend files
- `FRONTEND-SHA256SUMS`: SHA-256 values for all four frontend files
- `RELEASE-MANIFEST.json`: machine-readable included/excluded release boundary

All files covered by these manifests were compared with their canonical repository counterparts and matched byte for byte at build time.

## Excluded Files

The artifact excludes the following classes of files:

- `TESTS.js`
- `V2_TENANT_RUNTIME_DATA_REPAIR.js`
- `V2_TENANT_RUNTIME_VALIDATION.js`
- `V2_LEGACY_BILL_IMPORT.js`
- repair, migration, diagnostic, validation-only, and legacy-only modules
- `.clasp.json` and `.clasprc.json`
- OAuth credentials, tokens, secrets, private keys, local login state, and other credential files
- documentation and development-only release tooling

No excluded module name or forbidden repair/diagnostic entrypoint was found in the artifact tree. Production modules may retain non-route maintenance helpers that are part of their canonical source; Phase 80 did not rewrite module internals because application and business logic changes are outside this phase.

## Dependency Check

### Runtime boundary

- `V2_RUNTIME_SNAPSHOT.js` is present and provides the runtime snapshot and shared spreadsheet handle required by production readers.
- The Apps Script dispatcher remains `程式碼.js`.
- `V2_API.js` and the tenant runtime modules remain within the same Apps Script global namespace.
- The Phase 79 production path contains no reference to `syncTenantRuntimeViewsForTenant_()` or its repair helpers.
- No runtime reference to `TESTS.js`, the tenant repair module, the runtime validation module, or the legacy bill import module was found.
- No source file in the release artifact directly acquires a spreadsheet outside the consolidated snapshot/handle layer where the canonical source has already been updated to use that layer.

### Static validation of isolated backend

The isolated backend was validated with the repository validator using `release/phase80/apps-script` as its Apps Script source:

- Apps Script files: 30
- Unique `v2_action` routes: 68
- Route handler coverage: 68/68
- Common helper coverage: 7/7
- Duplicate top-level declarations: 0
- Blocking credential findings: 0
- Hardcoded LINE UID findings: 0
- Manifest: PASS
- JavaScript syntax: PASS for all 30 modules
- Overall isolated validation: PASS

Repository HTML was used for link validation because the isolated frontend intentionally contains only the four tenant release pages. Repository link validation found 182 links and 0 missing targets.

## Build Verification

- Backend source equality: PASS, 31/31 files
- Frontend source equality: PASS, 4/4 files
- Backend SHA-256 verification: PASS
- Frontend SHA-256 verification: PASS
- Excluded-file scan: PASS
- Credential-file scan: PASS
- Forbidden repair/diagnostic dependency scan: PASS
- Business logic transformations during packaging: none

## Risks and Manual Review Items

1. The artifact is deliberately unbound. A verified production `.clasp.json` must be supplied outside Git before any future `clasp status` or push.
2. The SHA-256 manifests freeze the exact Phase 80 payload; any later canonical edit requires rebuilding and revalidating the artifact.
3. `V2_RUNTIME_SNAPSHOT.js` contains the request-level diagnostic counters introduced by the performance phases. It is a runtime dependency, not a debug-only module; operators should confirm acceptable logging volume before deployment.
4. Real-device regression and production performance verification remain manual release gates. Local static validation does not replace those checks.
5. The repository working tree contains work from earlier phases. Deployment must use only the isolated artifact, not the entire working `apps-script/` directory.

## Deployment Checklist

### Preflight

- [ ] Obtain explicit deployment approval.
- [ ] Re-run both SHA-256 manifests and confirm every file is unchanged.
- [ ] Re-run isolated validation and `npm run validate`; both must pass.
- [ ] Verify the production Apps Script project binding using the masked ownership records from Phases 49–50.
- [ ] Place the verified, ignored `.clasp.json` only in the isolated Apps Script source directory.
- [ ] Run `clasp status` from the isolated source and confirm the payload is exactly the 30 JavaScript modules plus `appsscript.json`.
- [ ] Confirm that `TESTS.js`, repair, migration, validation, legacy, credential, and backup files are absent.
- [ ] Reconfirm the current immutable production version and rollback deployment target; do not rely solely on historical version notes.
- [ ] Review installable triggers and ensure no trigger depends on an excluded function.

### Backend release — future approved operation only

- [ ] Execute `clasp push` only from the verified isolated tree.
- [ ] Review the Apps Script editor file list after push.
- [ ] Create a new immutable Apps Script version.
- [ ] Update the existing Web App deployment; preserve its URL and access settings.
- [ ] Do not create or modify Sheet data during deployment.
- [ ] Run read-only endpoint, identity, workspace isolation, home, bills, and message smoke tests.

### Frontend release — after backend verification

- [ ] Publish only the four listed tenant HTML files.
- [ ] Preserve the existing LIFF ID, Web App endpoint, and routing behavior.
- [ ] Test `tenant-bind → tenant-home → tenant-bills/tenant-message` in normal and approved test flows.
- [ ] Complete iPhone and Android LINE WebView checks before release acceptance.

### Rollback

- [ ] If backend validation fails, immediately repoint the existing Web App deployment to the recorded prior immutable version.
- [ ] If frontend validation fails, restore the prior four frontend files from Git without changing the Web App URL or LIFF configuration.
- [ ] Re-run the read-only smoke tests after rollback.
- [ ] Preserve failure evidence and do not repair or migrate Sheet data as part of rollback.

## Declaration

Phase 80 created only an isolated release artifact and this build record. It did not modify application logic, push source, create a commit, deploy Apps Script, publish frontend files, write Google Sheets, or send LINE messages.
