// Offline cost compiler for the approved compatibility-only schedule.
// Explicit planned counts are not native freshness/coverage or authorization.
const stop=()=>{throw Error('TRIAL_BUDGET_UNVERIFIED');};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const count=(v,min=0)=>Number.isSafeInteger(v)&&v>=min&&v<=1000000;
// Immutable text presented to, and explicitly approved by, the owner on2026-10-15.
// A matching hash selects this cost model; it is not an execution/credential grant.
export const SINGLE_WRAPPER_TRIAL_DECISION_HASH='0b382d87214d9d1fbe658b1615176de48917666698e79092218f1691c358a675';
export const CREDENTIAL_READBACK_DECISION_HASH='5bd83ace54d7af801880798be3460ed9b6f8c8b053b447459e7956b127ff4c72';
const phases=['wrapper-before','wrapper-after'],actors=['caller','publisher'];
const windowLimits={pages:4,setupReads:2,identityReads:1,quotaReads:1,settlementReads:0};
const nativeCosts=['pages','setupReads','identityReads','quotaReads','settlementReads'];
const releaseItems=['original-project','original-editor','original-versions','original-deployments','library-content','thin-content','thin-deployments','synthetic-acl','original-acl','original-settings','original-triggers','thin-settings','oauth-audience','oauth-client','caller-sheets-metadata'];
const schedule={
 A:['original-project','original-editor','original-versions','original-deployments','original-v1-content','original-cloud-backup','original-triggers-backup','original-properties-backup','original-container-acl'],
 B:['fixture-import','fixture-file-readback','original-acl-fresh','synthetic-acl-baseline','caller-permission-id','reader-create','reader-acl-readback','fixture-native','auth-tab-users','auth-tab-workspaces','auth-tab-members','auth-tab-email','auth-tab-settings'],
 C:['library-source-put','library-version-create','library-fixed-content','restore-editor','read-restored-editor','library-versions-inventory','library-deployments-inventory','original-properties-write','original-properties-readback'],
 D:['thin-project-backup','thin-source-backup','thin-gcp-link','thin-source-put','thin-version-create','thin-fixed-content','thin-deployment-create','thin-deployments-inventory','thin-properties-write','thin-properties-readback'],
 E:['testing-user-write','testing-user-readback','client-create','client-readback','oauth-response','token-exchange','caller-userinfo'],
 F:phases.flatMap(p=>releaseItems.map(i=>p+'.'+i)),
 H:['wrapper-compatibility-rpc'],
 I:['close-deployment','verify-closed-deployment','remove-reader','verify-reader-removed','restore-original-guard','verify-original-guard','restore-thin-guard','verify-thin-guard','remove-testing-user','verify-testing-user-removed','revoke-token','verify-token-revoked','read-original-editor','read-original-versions','read-original-deployments','read-original-project','read-original-triggers']
};
export const SINGLE_WRAPPER_TRIAL_OPERATIONS=freeze(schedule);
const fixedFutureReads=Object.values(schedule).reduce((n,ops)=>n+ops.length,0);
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
export const SINGLE_WRAPPER_TRIAL_POLICY=freeze({decisionHash:SINGLE_WRAPPER_TRIAL_DECISION_HASH,
 stage:'single-wrapper-compatibility',allowedEntries:['wrapper'],phases:[...phases],
 bucketLimits:{A:9,B:13,C:9,D:10,E:7,F:30,H:1,I:17,
  G:{total:32,perWindowTotal:8,perWindow:{...windowLimits}},P:{total:4,caller:2,publisher:2},T:3},
 fixedFutureReads,importedReads:25,limit:160,cleanupReserve:17,originalRestoreReserve:2,
 executionAuthorized:false});
export const CREDENTIAL_READBACK_POLICY=freeze({...SINGLE_WRAPPER_TRIAL_POLICY,decisionHash:CREDENTIAL_READBACK_DECISION_HASH,priorDecisionHash:SINGLE_WRAPPER_TRIAL_DECISION_HASH,
 bucketLimits:{...SINGLE_WRAPPER_TRIAL_POLICY.bucketLimits,P:{total:4,caller:1,publisher:3}},
 preparationPurposeAliases:['caller-bind','publisher-bind','publisher-refresh','publisher-userinfo'],identityReadMethod:'google-userinfo-same-token'});
export function getAuthorityTrialPolicy(decisionHash){
 if(decisionHash===SINGLE_WRAPPER_TRIAL_DECISION_HASH)return SINGLE_WRAPPER_TRIAL_POLICY;
 if(decisionHash===CREDENTIAL_READBACK_DECISION_HASH)return CREDENTIAL_READBACK_POLICY;
 stop();
}
export function planAuthorityTrialBudget(input){
 try{
  if(!exact(input,['stage','decisionHash','counter','nativeWindows','additionalOperations']))stop();
  const policy=getAuthorityTrialPolicy(input.decisionHash);if(input.stage!==policy.stage)stop();
  const additionalLimits={'native-prepare-caller':policy.bucketLimits.P.caller,'native-prepare-publisher':policy.bucketLimits.P.publisher,'unknown-settlement':3};
  const {counter,nativeWindows,additionalOperations}=input;
  if(!exact(counter,['limit','spent','kind','proposal_sha256','approval_sha256','prior_limit'])||counter.limit!==160||counter.prior_limit!==40||counter.kind!=='preparation-management-reads'||!count(counter.spent,25)||counter.spent>160||!['proposal_sha256','approval_sha256'].every(k=>typeof counter[k]==='string'&&/^[a-f0-9]{64}$/.test(counter[k])))stop();
  if(!Array.isArray(nativeWindows)||nativeWindows.length!==4||!Array.isArray(additionalOperations)||additionalOperations.length!==3)stop();
  const windows=new Map();
  for(const w of nativeWindows){
   if(!exact(w,['phase','actor',...nativeCosts])||!phases.includes(w.phase)||!actors.includes(w.actor))stop();
   const key=w.phase+'.'+w.actor;if(windows.has(key))stop();
   for(const k of nativeCosts){
    const value=w[k];
    if(k==='settlementReads'){if(value!==0)stop();continue;}
    const minimum=['pages','identityReads','quotaReads'].includes(k)?1:0;
    if(value!==null&&(!count(value,minimum)||value>windowLimits[k]))stop();
   }
   windows.set(key,{...w});
  }
  const unknownCosts=[],windowReads={};let nativeMinimum=0;
  for(const phase of phases)for(const actor of actors){
   const key=phase+'.'+actor,w=windows.get(key);if(!w)stop();let lower=0,known=true;
   for(const k of nativeCosts){
    if(w[k]===null){unknownCosts.push(key+'.'+k);known=false;lower+=['pages','identityReads','quotaReads'].includes(k)?1:0;}
    else lower+=w[k];
   }
   nativeMinimum+=lower;windowReads[key]={minimum:lower,total:known?lower:null,limit:8};
  }
  const operations=new Map();
  for(const op of additionalOperations){
   if(!exact(op,['name','units'])||!Object.hasOwn(additionalLimits,op.name)||operations.has(op.name)||(op.units!==null&&(!count(op.units)||op.units>additionalLimits[op.name])))stop();
   operations.set(op.name,op.units);
  }
  let additionalMinimum=0;const extra={};
  for(const name of Object.keys(additionalLimits)){
   if(!operations.has(name))stop();const units=operations.get(name);extra[name]=units;
   if(units===null)unknownCosts.push('additional.'+name);else additionalMinimum+=units;
  }
  const known=unknownCosts.length===0,minimumTotalReads=counter.spent+fixedFutureReads+nativeMinimum+additionalMinimum;
  // Every unused sub-bucket remains reserved, not spare ordinary admission.
  // The worst-case approved39 is retained even when planned counts are smaller.
  const reservedTotalReads=counter.spent+fixedFutureReads+32+4+3;
  if(!Number.isSafeInteger(minimumTotalReads)||!Number.isSafeInteger(reservedTotalReads))stop();
  const nativeKnown=Object.values(windowReads).every(w=>w.total!==null),phaseReads=Object.fromEntries(Object.entries(schedule).map(([p,ops])=>[p,ops.length]));
  phaseReads.G=nativeKnown?nativeMinimum:null;
  phaseReads.P=extra['native-prepare-caller']===null||extra['native-prepare-publisher']===null?null:extra['native-prepare-caller']+extra['native-prepare-publisher'];
  phaseReads.T=extra['unknown-settlement'];
  return freeze({source:'authority-trial-budget-plan',stage:input.stage,decisionHash:policy.decisionHash,allowedEntries:['wrapper'],
   limit:160,spent:counter.spent,fixedFutureReads,nativeReads:nativeKnown?nativeMinimum:null,
   additionalReads:additionalOperations.some(o=>o.units===null)?null:additionalMinimum,
   minimumTotalReads,totalReads:known?minimumTotalReads:null,reservedTotalReads,
   unallocatedReads:160-reservedTotalReads,plannedUnusedReads:known?160-minimumTotalReads:null,
   budgetFits:known&&reservedTotalReads<=160,cleanupReserve:17,originalRestoreReserve:2,
   bucketLimits:policy.bucketLimits,phaseReads,windowReads,unknownCosts,
   scopeReviewRequired:false,executionAuthorized:false});
 }catch(_){stop();}
}
