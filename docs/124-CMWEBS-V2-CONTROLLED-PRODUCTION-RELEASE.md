# Phase 124 - CMWebs V2 Controlled Production Release

## Release baseline verification

Verification timestamp: 2026-07-24 (Asia/Taipei)

### Apps Script baseline

- Production account: `cmwebs.saas@gmail.com`.
- The serving Web App deployment fingerprint matches the Phase 122G fingerprint.
- The active serving immutable version is `75`; execution identity and access mode match the Phase 122G record.
- Version `75` is described as the existing Phase 66 clean Web App deployment, was created on 2026-07-21 by the Production account, and is the current project version.
- Version `74` remains available as a historical fallback.
- Version 75 source checksum: `4eb4705728b1...`.
- Version 74 source checksum: `2fdf7e9f23d3...`.
- Version 75 differs from version 74 and equals the current Production source checksum.
- Version 75 differs from the final RC source package as expected for the pending RC promotion.

Classification: `VERSION_75_KNOWN_PREEXISTING_BASELINE`.

The pre-release baseline is version `75`; it is the primary rollback target. Version `74` remains the secondary historical fallback. No rollback action was performed during this verification.

### Production frontend baseline

- Hosting provider: GitHub Pages.
- Repository target: `cmwebssaas-sudo/cmwebs-liff`.
- Build mode: legacy branch build from `main` at repository root.
- HTTPS enforcement is enabled and no custom domain is configured.
- The current GitHub Pages build is successful and matches `main`.
- Current frontend revision: `3b48e9b2421a...9a3e`.
- Immediately previous successful rollback revision: `28767ded0f5c...1fee`.

The target and both build references are uniquely identified. No site, domain, branch, permission, or frontend deployment was changed during baseline verification.

### Frozen release source

- Final RC commit: `a04a0f8c49e98551dbb27e8d895841ac65e51864`.
- Final RC tree: `6f447a3211753d9059f278e272c92e959326a46f`.
- Release worktree: clean before Production release actions.
- Git push: not performed.

## Controlled release outcome

- The final RC source package was pushed to the verified Production Apps Script project and re-pulled with an exact 32-file checksum match.
- The additive-only Production migration completed twice through the Apps Script IDE without error. The second execution completed without an unsafe schema delta, satisfying the idempotency gate.
- Immutable version `76` was created and the existing Web App deployment was temporarily updated to it. No new deployment ID was created.
- The GitHub Pages frontend could not be published because its verified legacy target only builds from `main`, while this release explicitly prohibits Git push. No frontend deploy or production smoke was attempted.
- Per the approved rollback rule, the existing Web App deployment was immediately restored to primary baseline version `75`. The serving rollback state was read-only verified.
- The Production trigger inventory remains `2`; no trigger or Property mutation was performed.

Release result: **FAILED SAFELY - FRONTEND PUBLICATION BLOCKED BY THE NO-GIT-PUSH RELEASE CONSTRAINT.**

## Approved frontend publication and final cutover

Following explicit approval for a fast-forward-only frontend release, the frozen RC
branch history was not pushed directly because its inherited history contained files
outside the frozen allowlist. A clean worktree based on the then-current `main` was
used instead. It contained only the four frozen frontend candidates, each verified
byte-for-byte against the frozen RC artifact:

- `tenant-bills.html`
- `tenant-bind.html`
- `tenant-home.html`
- `tenant-message.html`

The resulting single frontend publication commit is
`2b62a07b34ebd28f94910220aa6b76d3342214ef`. It fast-forwarded `main` without
force push and GitHub Pages successfully built that same commit.

After GitHub Pages completed, the existing verified Production Web App deployment
was updated from version `75` to immutable version `76`. The deployment identifier,
execution identity, and access mode were preserved; no new deployment was created.

HTTP-only smoke checks returned `200` for the tenant entrypoint, landlord entrypoint,
and GitHub Pages infrastructure entrypoint. These checks did not execute page
scripts, sign in, call Apps Script, send LINE, or initiate a payment.

Final result: **CMWEBS V2 PRODUCTION RELEASE SUCCESS.**

## Safety boundary

This evidence contains no raw Script ID, deployment ID, Spreadsheet ID, Property value, token, LINE UID, or customer data. Trigger and Property inventories remain unchanged by this verification.
