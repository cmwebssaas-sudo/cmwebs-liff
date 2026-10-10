# Phase 122F - Offline Human Verification Session Bundle Freeze & Dry Run

This runbook packages the Phase 122D and Phase 122E offline artifacts into a
single handoff bundle for authorized human console review. It never connects to
Production, never reads `.clasp.json`, and never accepts raw Script ID or
Deployment ID values.

Bundle contents:

- `docs/122D-PRODUCTION-IDENTITY-MANUAL-VERIFICATION-PACKET.md`
- `docs/122E-MANUAL-EVIDENCE-INTAKE-AND-RC-GATE.md`
- `release-manifests/cmwebs-v2-production-identity-verification-template.json`
- `release-manifests/cmwebs-v2-human-verification-session-bundle.json`
- `tools/verify-production-identity-fingerprint.mjs`
- `tools/validate-production-identity-evidence.mjs`
- `tools/evaluate-rc-freeze-gate.mjs`
- `tools/run-production-identity-evidence-intake.mjs`
- `tests/verify-production-identity-fingerprint.test.mjs`
- `tests/validate-production-identity-evidence.test.mjs`
- `tests/evaluate-rc-freeze-gate.test.mjs`
- `tests/run-production-identity-evidence-intake.test.mjs`

Run sequence:

1. Confirm human identity and read-only Console access.
2. Capture masked evidence only.
3. Validate evidence schema.
4. Verify fingerprints.
5. Evaluate RC freeze gate.
6. Store only sanitized evidence JSON and evidence references.

Expected current-state output:

- `REMOTE_VERIFICATION=HUMAN_REQUIRED`
- `RC_FREEZE_READY=NO`
- `HUMAN_EVIDENCE_MISSING`

The bundle rehearsal may pass on dummy fixtures, but it cannot replace the
authorized Console verification step.
