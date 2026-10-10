# CMWebs local WIP checkpoint — 2026-10-10

The user explicitly authorized saving the existing mixed working changes in one local Git commit. This supersedes older handoff prohibitions on committing this aggregate for this checkpoint only.

This commit preserves existing work; it does not integrate subscriptions, establish a current Production baseline, or authorize a push, merge, deployment, or data change. The parent checkout is 6a691bb and contains historical work. More recent isolated worktrees exist and must be reconciled before selecting an integration baseline.

## Verification

- `npm run validate`: PASS; 71 unique routes, 71 handlers, no duplicate declarations, no blocking credential findings, no missing HTML links.
- `node --test tests/*.test.mjs`: PASS; 9 test files.
- `git diff --check`: PASS for previously tracked changes before staging. The full staged snapshot reports pre-existing trailing whitespace/blank EOF lines in newly added historical documents and release copies. Those files are preserved byte-for-byte; a check with only those two whitespace rules disabled passes.
- `node --test release/staging/tests/*.test.js`: 10 pass, 4 fail.
- Staging failures: phase83a3 retained-source hash mismatch; phase92 and phase93 missing `workspaceLandlordResolveCanonicalScopedAccess_` in their test context; phase94 move-out settlement assertion failure. These were observed before any source modification in this checkpoint task and are preserved without changing tests or application logic.
- Added/untracked files were scanned for private keys and common token formats. The only literal-secret pattern was a synthetic security-test fixture. Previously tracked LINE test identities remain unchanged; newly untracked files containing raw test identities are excluded.
- No real Apps Script test invocation or live Production acceptance was performed.

## Preserved outside this commit

Excluded files remain untouched on disk. No secrets or originals were deleted.

- 49: temporary deployment copy.
- 5: contains raw LINE test identity; preserved locally.
- 1: separate Git repository already committed.

Raw-identity files excluded:

- `landlord-contract-documents.html`
- `release/phase80/frontend/tenant-bills.html`
- `release/phase80/frontend/tenant-bind.html`
- `release/phase80/frontend/tenant-home.html`
- `release/phase80/frontend/tenant-message.html`

The separate `release/staging-hosting` repository is clean at its own commit `5547a07` and is not added as an accidental gitlink.
