import { validateEvidence } from './validate-production-identity-evidence.mjs';
export function evaluateGate(evidence, now) { const check=validateEvidence(evidence,now); const yes=check.valid; return {REMOTE_VERIFICATION:yes?'VERIFIED':'HUMAN_REQUIRED',IDENTITY_MATCH:yes?'MATCH':'UNVERIFIED',SERVING_STATUS:yes?'CONFIRMED':'UNCONFIRMED',IMMUTABLE_VERSION:yes?'VALID':'UNVERIFIED',EVIDENCE_FRESHNESS:yes?'CURRENT':'UNVERIFIED',RC_FREEZE_READY:yes?'YES':'NO',blockers:check.blockers}; }
if (import.meta.url===new URL(process.argv[1],'file:').href) console.log(JSON.stringify(evaluateGate()));
