# V2.1 Native Signing Review Security Implementation Plan

## Context

The isolated candidate already contains the initial native landlord review
implementation and the three intended hardening mechanisms. This plan turns
the approved design into an auditable candidate by adding focused regression
coverage for the authorization, serialization, and artifact fail-closed
boundaries, then recording the validation evidence.

## Steps

1. Inspect the candidate handlers and existing Phase 138/140 fixtures against
   the approved design. Add a regression case for cross-Workspace session
   mismatch and strengthen the opposite-decision serialization assertion if
   the fixture does not exercise it.
2. Keep production source changes minimal. If a regression exposes a real
   source gap, patch only the canonical V2.1 file and add the corresponding
   test before retesting.
3. Run the Phase 138 review runtime test, Phase 140 session test, Phase
   129–132 native signing tests, JavaScript syntax checks, and `git diff
   --check`. Run `npm run validate` once and record that it is unavailable if
   this isolated checkout does not provide `package.json`.
4. Update the local V2.1 execution record with the authorized scope and
   evidence. Do not make any claim about Production or deployment state.

## Verification gates

- No raw `line_user_id` review authorization path remains.
- The final decision lock is acquired before canonical row read/write and is
  always released.
- Artifact checks occur inside the final decision critical section before
  activation.
- Tests pass and no secret, token, personal data, or deployment metadata is
  added to the candidate.
