# Phase 122D - Production Identity Manual Verification Packet

Date: 2026-07-23

## Purpose and gate

This packet prepares an authorized reviewer for a future **read-only** identity
comparison in the serving Apps Script project. It does not open, query, or
change any Production resource.

```text
OFFLINE_VERIFIER: PASS
MANUAL_PACKET_READY: YES
REMOTE_VERIFICATION: HUMAN_REQUIRED
RC_FREEZE_READY: NO
```

The packet is based only on Phase 122A-122C evidence. Phase 122C identified
one historical local candidate, but that result cannot establish that a
deployment is currently active or serving.

## Offline verifier

Use `tools/verify-production-identity-fingerprint.mjs` only on an authorized
local machine. It reads exactly two newline-separated values from standard
input, in this order: Script ID, then Web App deployment ID. It has no prompts,
does not accept identifiers as command-line arguments, and emits only a result
and masked SHA-256 fingerprint for each value.

```sh
node tools/verify-production-identity-fingerprint.mjs
```

The reviewer must paste each value only to the running local process. Do not
put an identifier in a shell command, terminal history, document, screenshot,
or repository file. The tool trims leading and trailing whitespace only; a
value with altered internal characters is invalid or mismatched.

Expected output categories are `MATCH`, `MISMATCH`, and `INVALID_INPUT`. A
`MATCH` for both values shows correspondence with the unique historical local
candidate only. It does not prove the deployment remains active, accessible,
or serving.

The verifier contains only the following canonical SHA-256 values, never a raw
Script ID or deployment ID:

| Identity | Canonical fingerprint |
| --- | --- |
| Script project | `601b21...8fa985` |
| Web App deployment | `ebd027...05a390` |

The current local clasp binding is expected to return `MISMATCH`; it is a
different local project and cannot be used as Production evidence.

## Authorized read-only UI procedure

1. Open the already-authorized serving Apps Script project. Do not use the
   current local clasp binding as a shortcut or evidence source.
2. In **Project Settings**, view **Script ID**. Copy it only to the running
   verifier as the first standard-input line. Record the verifier result and
   fingerprint mask, not the raw ID.
3. Open **Deploy -> Manage deployments**, select the serving Web App detail
   without saving or updating it, and view its deployment ID. Copy it only to
   the running verifier as the second standard-input line.
4. In the same deployment detail, record only the immutable version, execute-as
   category, access category, and rollback-version reference. Do not change,
   save, delete, or redeploy anything.
5. Capture evidence that masks each identifier: show no more than the first six
   and last six identifier characters, or redact the identifier entirely while
   retaining the verifier's fingerprint mask and result.
6. Record the allowed fields in
   `release-manifests/cmwebs-v2-production-identity-verification-template.json`.
   The record must not include raw identifiers, secrets, Property values, LINE
   UIDs, tokens, or personal data.

If either result is `MISMATCH` or `INVALID_INPUT`, stop this verification path.
Do not change the local binding, deployment, Properties, triggers, spreadsheet,
frontend, or release branch to compensate.

## Evidence requirements

The reviewer may preserve only:

- verification timestamp;
- verifier role/category;
- `MATCH`, `MISMATCH`, or `INVALID_INPUT` result;
- masked identifier or redacted screenshot;
- masked fingerprint;
- evidence reference, such as an approved internal ticket or screenshot ID.

The following remain excluded: raw identifiers, credentials, Property values,
LINE UIDs, user information, spreadsheet content, and deployment-edit actions.

After both fingerprints match, the remaining Phase 122B presence-only checks
for Properties, triggers, spreadsheet metadata, and hosting are still required.
No check in this packet changes the `HUMAN_REQUIRED` remote-verification gate.
