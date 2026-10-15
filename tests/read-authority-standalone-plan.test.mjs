import test from 'node:test';
import assert from 'node:assert/strict';
import * as plans from '../scripts/read-authority-continuation-plan.mjs';
function input(){
 assert.equal(typeof plans.compileAuthorityStandalonePlan,'function');
 const p=plans.STANDALONE_TRIAL_POLICY;
 const operations=Object.entries(p.operations).map(([key,rule],i)=>({id:'step-'+i,
   bucket:key.split(':')[0],alias:key.slice(key.indexOf(':')+1),actor:rule.actor,
   target:rule.target,operation:rule.methods[0],units:1}));
 for(let n=1;n<=21;n++)operations.push({id:'navigation-'+n,bucket:'N',alias:'navigation-'+n,
   actor:'publisher',target:'thin-settings',operation:'snapshot',units:1,stage:n<=8?'research':'preparation'});
 return {decisionHash:plans.STANDALONE_TRIAL_DECISION_HASH,history:{spent:31,limit:160},mapComplete:true,operations};
}
const plan=v=>plans.compileAuthorityStandalonePlan(v??input());
test('standalone map includes31 historical debits and reserves cleanup without charging a library mutation',()=>{
 const v=input(),r=plan(v);
 assert.equal(r.spent,31);assert.equal(r.fixedFutureUnits,93);assert.equal(r.totalUnits,156);
 assert.equal(r.reservedTotalUnits,160);assert.equal(r.cleanupReserve,17);assert.equal(r.originalRestoreReserve,2);
 assert.equal(r.scriptCleanupReserve,2);
 assert.equal(r.budgetFits,true);assert.equal(r.executionAuthorized,false);
 assert.equal(r.externalPrerequisitesVerified,false);assert.equal(r.bucketUnits.C,0);
 assert.equal(r.stage,'standalone-compatibility');assert.equal(Object.isFrozen(r),true);
});
test('extra script grant, phase observations and independent removal are required and individually counted',()=>{
 const v=input(),keys=['D:standalone-acl-baseline','D:standalone-reader-create','F:wrapper-before.standalone-acl','F:wrapper-after.standalone-acl','J:script-remove','J:script-verify'];
 for(const key of keys){const row=v.operations.find(o=>o.bucket+':'+o.alias===key);assert(row,key);const without={...v,operations:v.operations.filter(o=>o!==row)};assert.equal(plan(without).budgetFits,false);assert(plan(without).missingOperations.includes(key));}
 v.operations.push({id:'navigation-22',bucket:'N',alias:'navigation-22',actor:'publisher',target:'thin-triggers',operation:'snapshot',units:1,stage:'preparation'});
 assert.equal(plan(v).budgetFits,false);assert.equal(plan(v).executionAuthorized,false);
});
test('standalone source observation is pinned to isolated project instead of original library',()=>{
 const v=input(),row=v.operations.find(o=>o.alias==='wrapper-before.library-content');
 assert.equal(row.target,'thin-project');assert.equal(plan(v).budgetFits,true);
 row.target='original-project';assert.throws(()=>plan(v),/CONTINUATION_PLAN_UNVERIFIED/);
});
test('standalone cannot refund the stopped continuation or diagnostic debits',()=>{
 for(const spent of [25,27,28,30,32]){const v=input();v.history.spent=spent;assert.throws(()=>plan(v),/CONTINUATION_PLAN_UNVERIFIED/);}
});
test('standalone decision cannot silently select original continuation policy',()=>{
 const v=input();assert.throws(()=>plans.compileAuthorityContinuationPlan(v),/CONTINUATION_PLAN_UNVERIFIED/);
 v.decisionHash=plans.BOUNDED_CONTINUATION_DECISION_HASH;assert.throws(()=>plan(v),/CONTINUATION_PLAN_UNVERIFIED/);
});
test('unknown actual UI cost blocks credential/RPC eligibility',()=>{
 const v=input();v.operations.find(o=>o.bucket==='N').units=null;
 const r=plan(v);assert.equal(r.totalUnits,null);assert.equal(r.budgetFits,false);
 assert.equal(r.credentialRpcEligible,false);assert.equal(r.executionAuthorized,false);
});
test('standalone rejects original-library mutation and duplicate low-level IO',()=>{
 for(const extra of [
   {id:'library-write',bucket:'C',alias:'library-source-put',actor:'publisher',target:'original-project',operation:'PUT',units:1},
   {...input().operations[0],id:'duplicate'}
 ]){const v=input();v.operations.push(extra);assert.throws(()=>plan(v),/CONTINUATION_PLAN_UNVERIFIED/);}
});
test('standalone getters cannot supply approval or history arithmetic',()=>{
 const v=input();let calls=0;Object.defineProperty(v.history,'spent',{enumerable:true,get(){calls++;return 31;}});
 assert.throws(()=>plan(v),/CONTINUATION_PLAN_UNVERIFIED/);assert.equal(calls,0);
});
test('standalone still requires each source/privacy pre/post observation',()=>{
 for(const key of ['F:wrapper-before.original-acl','F:wrapper-after.library-content','I:revoke-token']){
   const v=input();v.operations=v.operations.filter(o=>o.bucket+':'+o.alias!==key);
   const r=plan(v);assert.equal(r.credentialRpcEligible,false);assert(r.missingOperations.includes(key));
 }
});
test('standalone may observe its own triggers without widening the original navigation policy',()=>{
 const v=input(),row=v.operations.find(o=>o.bucket==='N');row.target='thin-triggers';
 assert.equal(plan(v).budgetFits,true);
 row.operation='click';assert.throws(()=>plan(v),/CONTINUATION_PLAN_UNVERIFIED/);
 const old={decisionHash:plans.BOUNDED_CONTINUATION_DECISION_HASH,history:{spent:27,limit:160},mapComplete:false,
   operations:[{...row,operation:'snapshot'}]};
 assert.throws(()=>plans.compileAuthorityContinuationPlan(old),/CONTINUATION_PLAN_UNVERIFIED/);
});
