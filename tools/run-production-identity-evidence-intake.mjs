import { readFileSync } from 'node:fs';
import { validateEvidence } from './validate-production-identity-evidence.mjs';
import { verifyIdentifier } from './verify-production-identity-fingerprint.mjs';
import { evaluateGate } from './evaluate-rc-freeze-gate.mjs';

export function runIntake(evidenceJson, now = new Date()) {
  let evidence;
  try {
    evidence = typeof evidenceJson === 'string' ? JSON.parse(evidenceJson) : evidenceJson;
  } catch {
    return { valid: false, blockers: ['INVALID_EVIDENCE_JSON'], gate: evaluateGate(undefined, now) };
  }
  const validated = validateEvidence(evidence, now);
  const script = verifyIdentifier('script', evidence?.script_input ?? '');
  const deployment = verifyIdentifier('deployment', evidence?.deployment_input ?? '');
  const gate = evaluateGate(evidence, now);
  return {
    valid: validated.valid && script.result !== 'INVALID_INPUT' && deployment.result !== 'INVALID_INPUT',
    blockers: [...validated.blockers, ...(script.blockers ?? []), ...(deployment.blockers ?? [])],
    gate
  };
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const input = readFileSync(0, 'utf8');
  console.log(JSON.stringify(runIntake(input)));
}
