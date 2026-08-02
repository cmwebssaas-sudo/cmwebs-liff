# CMWebs Production Source Reconciliation Candidate

Status: **candidate only — not yet the canonical repository source**

## Purpose

This branch records the Apps Script source obtained by a read-only pull from the
currently serving CMWebs Production project on 2026-08-02 (Asia/Taipei).  It is
an auditable candidate for resolving the serving-source mismatch before any new
Apps Script feature deployment.

## Candidate identity

- Repository base: `origin/main` at `f35a9fa3afb63e9eb0d1d90fa0fa416dc413f69c`.
- Candidate branch: `codex/production-source-reconciliation-20260802`.
- Candidate content: 32 Apps Script source files plus `appsscript.json`, copied
  exactly from the serving project; local clasp metadata is deliberately not
  included.
- Baseline verification: commit `3ac97f0` has an `apps-script/` tree that is
  byte-for-byte identical to the read-only serving-source snapshot, excluding
  local clasp metadata.

## Why this is not automatically canonical

The serving source and `origin/main` have materially diverged.  Adopting this
candidate without review would remove source files that currently exist in
`origin/main`, including the native tenant-contract signing session, artifact
storage, and signing-submission modules.  The candidate is therefore the one
**serving-source baseline candidate**, not an approval to discard main-only
work.

## Required acceptance decision

Before any Apps Script deployment from this branch, an authorized reviewer must
select one of these paths:

1. Accept the candidate as the canonical serving baseline, then re-integrate
   the required main-only modules in a reviewed release candidate; or
2. Reconcile the serving project to the reviewed `origin/main` source in a
   separate immutable deployment, preserving the required signing modules.

The Room 603 signing fixture must not be deployed until the selected canonical
source contains the existing tenant-contract signing session, private artifact
upload, and signing-submission primitives.  The serving snapshot currently does
not contain them, so a fixture-only deployment could change data without making
the test contract signable.

## Signing-core reintegration candidate

This descendant branch retains the verified serving-source baseline and adds
only the required native tenant-contract signing session, private artifact
storage, final signing submission, dispatcher exchange routes, and the guarded
Room 603 test-fixture tool. It is a reviewed deployment candidate, not evidence
that the serving source has already changed. Its preflight must confirm the
required Properties, private Drive root, and contract-artifact schema before an
immutable deployment is created.

## Non-actions

This candidate does not deploy Apps Script, modify Sheets, Properties,
triggers, LINE, LIFF, or GitHub Pages, and does not send messages.
