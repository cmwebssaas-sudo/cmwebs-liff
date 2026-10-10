import assert from 'node:assert/strict';
import { runIntake } from '../tools/run-production-identity-evidence-intake.mjs';

const ok = {
  verification_timestamp: '2026-07-23T00:00:01.000Z',
  verifier_role: 'AUTHORIZED_HUMAN',
  evidence_reference: 'shot-01',
  script: { fingerprint_masked: '601b21...8fa985', match_result: 'MATCH' },
  deployment: { fingerprint_masked: 'ebd027...05a390', match_result: 'MATCH', type: 'WEB_APP', immutable_version: '9', active_confirmed: true, serving_confirmed: true },
  script_input: `1${'a'.repeat(24)}`,
  deployment_input: `AKfycb${'b'.repeat(24)}`
};

const bad = { verification_timestamp: '2026-07-23T00:00:01.000Z', verifier_role: 'AUTHORIZED_HUMAN', evidence_reference: 'shot-02', script: { fingerprint_masked: 'bad', match_result: 'MISMATCH' }, deployment: { fingerprint_masked: 'bad', match_result: 'MISMATCH', type: 'WEB_APP', immutable_version: '0', active_confirmed: false, serving_confirmed: false }, script_input: '', deployment_input: '' };

assert.equal(runIntake(ok).gate.RC_FREEZE_READY, 'YES');
assert.equal(runIntake(ok).valid, true);
assert.equal(runIntake(bad).gate.RC_FREEZE_READY, 'NO');
assert.equal(runIntake(bad).valid, false);
console.log('intake-orchestrator: PASS');
