# Room 603 signing fixture runbook

Scope: only the approved internal fixture `W000001 / R000019 / 603 / T000020 / C000019`.

- `previewRoom603NewTenantSigningFixture()` is read-only and defaults to no write.
- `activateRoom603NewTenantSigningFixture()` opens the fixture only after exact-ID, active tenant/user, cancelled historic bill, no competing signable contract, schema, and owner/admin checks pass.
- Opening uses `new_tenant`, clears prior signing-submission fields, and marks any prior stored fixture artifacts `superseded`; it never sends LINE or restores the cancelled bill.
- `closeRoom603NewTenantSigningFixture()` returns this fixture to terminated/vacant. It is for the normal manual close after testing.
- Each execution writes a scoped Workspace operation-audit entry. If preflight fails, do not edit the Sheet manually; correct the reported guard through a separately approved recovery procedure.

Rollback: run the close function only if the fixture was opened by this tool. For a source rollback, repoint the existing Apps Script Web App deployment to the recorded immutable rollback version; do not change its URL.
