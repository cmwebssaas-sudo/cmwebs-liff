const SCRIPT='601b21...8fa985';
const DEPLOYMENT='ebd027...05a390';
const MINIMUM='2026-07-23T00:00:00.000Z';
const keys=['verification_timestamp','verifier_role','evidence_reference','script','deployment'];
export function validateEvidence(evidence, now=new Date()) {
  const blockers=[];
  if (!evidence || typeof evidence!=='object') return {valid:false,blockers:['HUMAN_EVIDENCE_MISSING']};
  for (const key of keys) if (!evidence[key]) blockers.push(`MISSING_${key.toUpperCase()}`);
  for (const key of ['raw_script_id','raw_deployment_id','token','property_value','line_uid']) if (key in evidence) blockers.push(`PROHIBITED_${key.toUpperCase()}`);
  const s=evidence.script||{}, d=evidence.deployment||{};
  if (s.match_result!=='MATCH'||s.fingerprint_masked!==SCRIPT) blockers.push('SCRIPT_IDENTITY_MISMATCH');
  if (d.match_result!=='MATCH'||d.fingerprint_masked!==DEPLOYMENT) blockers.push('DEPLOYMENT_IDENTITY_MISMATCH');
  if (d.type!=='WEB_APP') blockers.push('NOT_WEB_APP');
  if (!/^\d+$/.test(String(d.immutable_version))||String(d.immutable_version)==='0') blockers.push('IMMUTABLE_VERSION_INVALID');
  if (d.active_confirmed!==true||d.serving_confirmed!==true) blockers.push('SERVING_UNCONFIRMED');
  const stamp=Date.parse(evidence.verification_timestamp); if (!Number.isFinite(stamp)||stamp<Date.parse(MINIMUM)||stamp>now.getTime()) blockers.push('EVIDENCE_STALE_OR_INVALID');
  return {valid:blockers.length===0,blockers};
}
