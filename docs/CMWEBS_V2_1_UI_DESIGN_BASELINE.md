# CMWebs V2.1 Mobile Contract-Signing UI Baseline

**Scope:** `tenant-contract.html` native signing workflow only. This document
does not authorize a deployment or change the V2.1 product boundary.

## Design rules

- Mobile first: light neutral surface, clear type hierarchy, generous space,
  restrained borders and rounded corners; no dashboard density, gradients, or
  decorative motion.
- Keep one primary action per signing state. Details use progressive disclosure;
  all interactive controls remain at least 44px and the sticky action sits
  above the existing safe-area and bottom navigation.
- `new_tenant` presents contract summary, full contract, identity-front and
  identity-back upload states, signature, consent, then submission.
- `renewal` presents only renewal state, linked-contract differences, full
  contract, signature, consent, and submission. It never renders or calls the
  identity-upload flow.
- The UI is honest about state: it distinguishes verification, loading,
  unavailable contract content or renewal lineage, upload progress/failure,
  empty signature, retry, submitted-for-review, and final contract activation.
  “Submitted” never means approved, active, or completed.

## Safety boundary

The backend session and backend-derived `signing_mode` remain authoritative.
Tokens, images, signatures, Drive identifiers, and internal metadata must not
enter a URL, browser storage, or console. Missing required backend data or
schema remains fail-closed rather than being invented by the UI.
