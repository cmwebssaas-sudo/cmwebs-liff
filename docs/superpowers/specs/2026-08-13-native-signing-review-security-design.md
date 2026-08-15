# V2.1 Native Contract Signing Review Security Design

**Status:** Approved for isolated local implementation only
**Date:** 2026-08-13 (Asia/Taipei)
**Scope:** Landlord review of native tenant contract submissions

## Goal

Make the landlord-side native contract review flow fail closed at the three
security and correctness boundaries identified in the review:

1. a browser-supplied `line_user_id` must not authorize a landlord read or
   write;
2. opposite final decisions must be serialized so approval and rejection
   cannot both win; and
3. approval must revalidate the required stored signing artifacts immediately
   before activating the contract.

## Design

- The browser exchanges a LINE ID token for a short-lived, HMAC-signed server
  session. Review reads and writes accept that session only; URL or request
  body `line_user_id` values are never authorization input.
- Session claims are checked against the active V2 user, active Workspace
  membership, landlord role, and `workspace_id` on every review operation.
- The final approve/reject operation obtains the Apps Script document lock,
  re-reads the canonical `V2_contracts` row inside the lock, checks Workspace,
  permission, signing mode, and final-decision state, then writes one outcome.
- Approval checks the mode-specific required artifact rows inside the same
  serialized section. Missing, removed, malformed, cross-contract, or
  cross-Workspace artifacts fail closed and do not activate the contract.
- Rejection leaves the existing signable contract status intact and records a
  rejected submission. The existing verified tenant submission path may clear
  the review audit fields for a later resubmission.

## Explicit non-goals

- No Production Apps Script deployment, GitHub Pages publication, Spreadsheet
  migration, Properties/trigger change, LINE message, push, PR, merge, or
  external account action.
- No change to the legacy signed-contract bridge or V3/V4 behavior.

## Acceptance checks

- Spoofed landlord identity is denied even when the target contract exists.
- A valid session for another Workspace cannot read or mutate this review.
- Repeated same-outcome requests are idempotent; opposite final outcomes are
  rejected after the first committed decision.
- Approval with missing or invalid required artifacts is denied without
  changing `contract_status` to `active`.
- Existing native signing Phase 129–132 coverage and Phase 138 review
  coverage remain green.
