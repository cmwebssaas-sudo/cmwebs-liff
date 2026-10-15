// Offline cost compiler for the approved compatibility-only schedule.
// Explicit planned counts are not native freshness/coverage or authorization.
const stop=()=>{throw Error('TRIAL_BUDGET_UNVERIFIED');};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const count=(v,min=0)=>Number.isSafeInteger(v)&&v>=min&&v<=1000000;
const phases=['wrapper-before','wrapper-after','qualified-before','qualified-after'],actors=['caller','publisher'];
const nativeCosts=['pages','setupReads','identityReads','quotaReads','settlementReads'];
const releaseItems=['original-project','original-editor','original-versions','original-deployments','library-content','thin-content','thin-deployments','synthetic-acl','original-acl','original-settings','original-triggers','thin-settings','oauth-audience','oauth-client','caller-sheets-metadata'];
const schedule={
 A:['original-project','original-editor','original-versions','original-deployments','original-v1-content','original-cloud-backup','original-triggers-backup','original-properties-backup','original-container-acl'],
 B:['fixture-import','fixture-file-readback','original-acl-fresh','synthetic-acl-baseline','caller-permission-id','reader-create','reader-acl-readback','fixture-native','auth-tab-users','auth-tab-workspaces','auth-tab-members','auth-tab-email','auth-tab-settings'],
 C:['library-source-put','library-version-create','library-fixed-content','restore-editor','read-restored-editor','library-versions-inventory','library-deployments-inventory','original-properties-write','original-properties-readback'],
 D:['thin-project-backup','thin-source-backup','thin-gcp-link','thin-source-put','thin-version-create','thin-fixed-content','thin-deployment-create','thin-deployments-inventory','thin-properties-write','thin-properties-readback'],
 E:['testing-user-write','testing-user-readback','client-create','client-readback','oauth-response','token-exchange','caller-userinfo'],
 F:phases.flatMap(p=>releaseItems.map(i=>p+'.'+i)),
 H:['wrapper-compatibility-rpc','qualified-compatibility-rpc'],
 I:['close-deployment','verify-closed-deployment','remove-reader','verify-reader-removed','restore-original-guard','verify-original-guard','restore-thin-guard','verify-thin-guard','remove-testing-user','verify-testing-user-removed','revoke-token','verify-token-revoked','read-original-editor','read-original-versions','read-original-deployments','read-original-project','read-original-triggers']
};
const fixedFutureReads=Object.values(schedule).reduce((n,ops)=>n+ops.length,0);
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
export function planAuthorityTrialBudget(input){
 try{
  if(!exact(input,['stage','counter','nativeWindows','additionalOperations'])||input.stage!=='compatibility-only')stop();
  const {counter,nativeWindows,additionalOperations}=input;
  if(!exact(counter,['limit','spent','kind','proposal_sha256','approval_sha256','prior_limit'])||counter.limit!==160||counter.prior_limit!==40||counter.kind!=='preparation-management-reads'||!count(counter.spent,25)||counter.spent>160||!['proposal_sha256','approval_sha256'].every(k=>typeof counter[k]==='string'&&/^[a-f0-9]{64}$/.test(counter[k])))stop();
  if(!Array.isArray(nativeWindows)||nativeWindows.length!==8||!Array.isArray(additionalOperations)||additionalOperations.length>50)stop();
  const windows=new Map();
  for(const w of nativeWindows){if(!exact(w,['phase','actor',...nativeCosts])||!phases.includes(w.phase)||!actors.includes(w.actor))stop();const key=w.phase+'.'+w.actor;if(windows.has(key))stop();for(const k of nativeCosts)if(w[k]!==null&&!count(w[k],k==='pages'?1:0))stop();windows.set(key,{...w});}
  const unknownCosts=[],windowReads={};let nativeMinimum=0;
  for(const phase of phases)for(const actor of actors){const key=phase+'.'+actor,w=windows.get(key);if(!w)stop();let lower=0,known=true;for(const k of nativeCosts){if(w[k]===null){unknownCosts.push(key+'.'+k);known=false;lower+=k==='pages'?1:0;}else lower+=w[k];}nativeMinimum+=lower;windowReads[key]={minimum:lower,total:known?lower:null};}
  let additionalMinimum=0;const names=new Set();
  for(const op of additionalOperations){if(!exact(op,['name','units'])||typeof op.name!=='string'||!/^[-a-z0-9]{1,80}$/.test(op.name)||names.has(op.name)||(op.units!==null&&!count(op.units,1)))stop();names.add(op.name);if(op.units===null)unknownCosts.push('additional.'+op.name);else additionalMinimum+=op.units;}
  const known=unknownCosts.length===0,minimumTotalReads=counter.spent+fixedFutureReads+nativeMinimum+additionalMinimum;
  if(!Number.isSafeInteger(minimumTotalReads))stop();
  const nativeKnown=Object.values(windowReads).every(w=>w.total!==null),phaseReads=Object.fromEntries(Object.entries(schedule).map(([p,ops])=>[p,ops.length]));phaseReads.G=nativeKnown?nativeMinimum:null;
  return freeze({source:'authority-trial-budget-plan',stage:'compatibility-only',limit:160,spent:counter.spent,fixedFutureReads,nativeReads:nativeKnown?nativeMinimum:null,additionalReads:additionalOperations.some(o=>o.units===null)?null:additionalMinimum,minimumTotalReads,totalReads:known?minimumTotalReads:null,unallocatedReads:known?160-minimumTotalReads:null,budgetFits:known&&minimumTotalReads<=160,cleanupReserve:17,originalRestoreReserve:2,phaseReads,windowReads,unknownCosts,scopeReviewRequired:additionalOperations.length>0,executionAuthorized:false});
 }catch(_){stop();}
}
