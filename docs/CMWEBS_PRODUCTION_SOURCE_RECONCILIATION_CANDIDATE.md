# CMWebs Production Source Reconciliation Candidate

Status: **candidate only — not yet approved for Production deployment**

## Purpose

This branch starts from the Apps Script source obtained by a read-only pull
from the actual CMWebs Production project on 2026-08-02 (Asia/Taipei). It then
re-integrates only the native tenant-contract signing core that was already
reviewed and merged into GitHub `main`.

## Candidate identity

- Serving-source base: the read-only clone of the verified CMWebs Production
  Apps Script project; local clasp metadata is deliberately excluded.
- Candidate branch: `codex/production-signing-reconciliation-20260802`.
- Re-integrated files: `V2_TENANT_LIFF_SIGNING_SESSION.js`,
  `V2_CONTRACT_ARTIFACT_STORAGE.js`,
  `V2_TENANT_CONTRACT_SIGNING_SUBMISSION.js`,
  `V2_ROOM_603_SIGNING_FIXTURE.js`, and the minimal route additions in
  `程式碼.js`.
- Existing API documentation already records all six tenant-contract actions;
  no API contract was renamed or expanded.

## Why this is not automatically canonical

The serving source and `origin/main` have materially diverged. This candidate
preserves the serving source and avoids overwriting it with an unrelated full
`main` snapshot. It is a reviewed integration candidate, not authorization to
discard serving-only source or deploy it without the Production preflight.

## Required acceptance decision

Before any Apps Script deployment from this branch, an authorized reviewer must
confirm the live Production preflight: required Properties are present, the
artifact sheet and contract signing columns exist, and the private Drive root is
valid. The same existing Web App deployment must then be updated through a new
immutable Apps Script version; no new Web App URL is created.

The Room 603 signing fixture is included only because its prerequisite signing
session, private artifact upload, and signing submission primitives are also
included. It remains a separately invoked, guarded internal tool and is not a
Web App route.

## Focused validation

- Phase 130 static and runtime signing-session tests: pass.
- Phase 131 artifact-storage runtime tests: pass.
- Phase 132 signing-submission runtime tests: pass.
- Phase 136 Room 603 fixture runtime tests: pass.
- `git diff --check`: pass.
- `npm run validate`: not applicable; this repository baseline has no
  `package.json`.

## Non-actions

This candidate does not deploy Apps Script, modify Sheets, Properties,
triggers, LINE, LIFF, or GitHub Pages, and does not send messages.
