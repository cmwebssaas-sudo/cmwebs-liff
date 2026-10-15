import test from 'node:test';
import assert from 'node:assert/strict';
import {BOUNDED_CONTINUATION_DECISION_HASH,BOUNDED_CONTINUATION_POLICY,compileAuthorityContinuationPlan} from '../scripts/read-authority-continuation-plan.mjs';
import {getAuthorityTrialPolicy} from '../scripts/read-authority-trial-budget-plan.mjs';

// Each row is exactly one low-level IO. These fixtures exercise the offline
// contract only; they are not observed UI costs or actual execution permission.
function input(){
 const operations=Object.entries(BOUNDED_CONTINUATION_POLICY.operations).map(([key,rule],i)=>({
  id:'step-'+i,bucket:key.split(':')[0],alias:key.slice(key.indexOf(':')+1),
  actor:rule.actor,target:rule.target,operation:rule.methods[0],units:1
 }));
 for(let n=1;n<=24;n++)operations.push({id:'navigation-'+n,bucket:'N',alias:'navigation-'+n,
  actor:'publisher',target:'original-settings',operation:n<=8?'snapshot':'navigate',units:1,
  stage:n<=8?'research':'preparation'});
 return {decisionHash:BOUNDED_CONTINUATION_DECISION_HASH,history:{spent:27,limit:160},mapComplete:true,operations};
}
const plan=v=>compileAuthorityContinuationPlan(v??input());
const find=(v,key)=>v.operations.find(o=>o.bucket+':'+o.alias===key);

test('synthetic native metadata retains the actual readonly caller actor',()=>{
 // Retained createAuthorityTrialMetadataSource synthetic-tabs uses caller,
 // charged under B:fixture-native by the preparation composition.
 const v=input();find(v,'B:fixture-native').actor='caller';
 assert.equal(plan(v).budgetFits,true);
 find(v,'B:fixture-native').actor='publisher';
 assert.throws(()=>plan(v),/CONTINUATION_PLAN_UNVERIFIED/);
});
test('changing operations getter cannot produce eligible arithmetic from different maps',()=>{
 const v=input(),rows=v.operations;let reads=0;
 Object.defineProperty(v,'operations',{enumerable:true,get:()=>++reads<=3?rows:[]});
 assert.throws(()=>plan(v),/CONTINUATION_PLAN_UNVERIFIED/);
 assert.equal(reads,0);
});
test('nested accessors and proxies are rejected without running supplied code',()=>{
 for(const kind of ['history','operation','proxy']){
  const v=input();let reads=0;
  if(kind==='history')Object.defineProperty(v.history,'spent',{enumerable:true,get:()=>{reads++;return 27;}});
  else if(kind==='operation')Object.defineProperty(v.operations[0],'units',{enumerable:true,get:()=>{reads++;return 1;}});
  else v.operations=new Proxy(v.operations,{ownKeys:()=>{reads++;return [];}});
  assert.throws(()=>plan(v),/CONTINUATION_PLAN_UNVERIFIED/);assert.equal(reads,0);
 }
});

test('complete one-unit map retains27 historical units and independent reserves within160',()=>{
 const v=input(),before=structuredClone(v),r=plan(v);
 assert.equal(r.budgetFits,true);assert.equal(r.credentialRpcEligible,true);
 assert.equal(r.spent,27);assert.equal(r.fixedFutureUnits,96);assert.equal(r.totalUnits,158);
 assert.equal(r.reservedTotalUnits,160);assert.equal(r.unusedReserve,2);
 assert.deepEqual(r.bucketUnits,{A:9,B:13,C:9,D:10,E:7,F:30,H:1,I:17,P:4,G:4,T:3,N:24});
 assert.equal(r.cleanupReserve,17);assert.equal(r.originalRestoreReserve,2);
 assert.equal(r.executionAuthorized,false);assert.equal(r.externalPrerequisitesVerified,false);
 assert.deepEqual(v,before);assert(Object.isFrozen(r));assert(Object.isFrozen(r.bucketUnits));
 assert(Object.isFrozen(BOUNDED_CONTINUATION_POLICY.operations['C:restore-editor']));
});
test('runtime charge never claims native runtime quota or later acceptance',()=>{
 const r=plan();assert.equal(r.chargedUpperBoundMs,360000);
 assert.equal(r.nativeRuntimeMs,null);assert.equal(r.quotaRemainingMs,null);
 assert.equal(r.actualDailyRuntimeAccepted,false);assert.equal(r.backgroundExecutionAccepted,false);
});
test('unknown and missing UI costs block credentials yet leave bounded readonly preflight conditional',()=>{
 const v=input();find(v,'D:thin-source-put').units=null;v.mapComplete=false;
 const r=plan(v);assert.equal(r.budgetFits,false);assert.equal(r.credentialRpcEligible,false);
 assert.equal(r.totalUnits,null);assert.equal(r.unknownCosts.length,1);assert.equal(r.bucketUnits.D,null);
 assert.equal(r.preflightMapEligible,true);assert.equal(r.executionAuthorized,false);
 v.operations=v.operations.filter(o=>o.bucket==='P'&&o.alias.endsWith('-bind')||o.bucket==='N'&&o.stage==='research');
 const incomplete=plan(v);assert.equal(incomplete.preflightMapEligible,true);
 assert.equal(incomplete.credentialRpcEligible,false);assert(incomplete.missingOperations.includes('H:wrapper-compatibility-rpc'));
 assert.equal(incomplete.bucketUnits.H,null);assert.equal(incomplete.minimumTotalUnits,142);
});
test('zero is not an unknown cost and unknown preflight cannot be admitted',()=>{
 const v=input();find(v,'P:caller-bind').units=null;const r=plan(v);
 assert.equal(r.preflightMapEligible,false);assert.equal(r.credentialRpcEligible,false);
 find(v,'P:caller-bind').units=0;assert.throws(()=>plan(v),/CONTINUATION_PLAN_UNVERIFIED/);
});
test('all fixed aliases including both C restores and every pre/post check are required',()=>{
 for(const key of ['C:restore-editor','C:read-restored-editor','F:wrapper-before.original-settings','F:wrapper-after.caller-sheets-metadata','I:revoke-token','G:wrapper-after.publisher']){
  const v=input();v.operations=v.operations.filter(o=>o.bucket+':'+o.alias!==key);
  const r=plan(v);assert.equal(r.budgetFits,false);assert.equal(r.credentialRpcEligible,false);
  assert(r.missingOperations.includes(key));
 }
});
test('unallocated navigation remains reserved and cannot pay for extra fixed purposes',()=>{
 const v=input();v.operations=v.operations.filter(o=>o.bucket!=='N');const r=plan(v);
 assert.equal(r.totalUnits,134);assert.equal(r.reservedTotalUnits,160);assert.equal(r.budgetFits,true);
 const extra={...find(v,'A:original-editor'),id:'extra-editor'};v.operations.push(extra);
 assert.throws(()=>plan(v),/CONTINUATION_PLAN_UNVERIFIED/);
});
test('map ordering does not alter admission and missing complete-map declaration fails closed',()=>{
 const v=input(),a=plan(v);v.operations.reverse();assert.deepEqual(plan(v),a);
 v.mapComplete=false;assert.equal(plan(v).credentialRpcEligible,false);
});
test('new decision is never silently selected by the old trial policy dispatcher',()=>{
 assert.throws(()=>getAuthorityTrialPolicy(BOUNDED_CONTINUATION_DECISION_HASH),/TRIAL_BUDGET_UNVERIFIED/);
});
for(const [name,mutate] of [
 ['wrong decision',v=>v.decisionHash='f'.repeat(64)],
 ['old selector',v=>v.decisionHash='3701527108376e07470bc920336fbbd0f78015cb1e55dbfe35090ee059130cb9'],
 ['refunded history',v=>v.history.spent=26],['new independent budget',v=>v.history.limit=161],
 ['spent history drift',v=>v.history.spent=28],
 ['missing history',v=>delete v.history],
 ['missing cost',v=>delete v.operations[0].units],
 ['bundled cost',v=>v.operations[0].units=2],
 ['fractional cost',v=>v.operations[0].units=.5],
 ['duplicate low-level id',v=>v.operations[1].id=v.operations[0].id],
 ['duplicate fixed alias',v=>v.operations.push({...v.operations[0],id:'duplicate'})],
 ['wrong actor',v=>find(v,'C:library-source-put').actor='caller'],
 ['arbitrary target',v=>find(v,'C:library-source-put').target='other-project'],
 ['write paid by N',v=>v.operations.find(o=>o.bucket==='N').operation='PUT'],
 ['account inventory paid by N',v=>v.operations.find(o=>o.bucket==='N').target='publisher-executions'],
 ['ninth research',v=>v.operations.find(o=>o.bucket==='N'&&o.stage==='preparation').stage='research'],
 ['seventeenth control',v=>v.operations.find(o=>o.bucket==='N'&&o.stage==='research').stage='preparation'],
 ['twenty-fifth N',v=>v.operations.push({id:'extra-n',bucket:'N',alias:'navigation-25',actor:'publisher',target:'thin-settings',operation:'navigate',stage:'preparation',units:1})],
 ['N caller mismatch',v=>v.operations.find(o=>o.bucket==='N').actor='caller'],
 ['same-token identity replaced by UI snapshot',v=>find(v,'G:wrapper-before.caller').operation='snapshot'],
 ['second bind alias',v=>v.operations.push({...find(v,'P:caller-bind'),id:'rebind',alias:'caller-rebind'})],
 ['retired window alias',v=>v.operations.push({id:'old',bucket:'G',alias:'wrapper-before.caller.pages',actor:'caller',target:'caller-purpose-page',operation:'GET',units:1})],
 ['reserved T borrowed for RPC',v=>find(v,'T:terminal-1').operation='POST'],
 ['runtime proof claim',v=>v.actualDailyRuntimeAccepted=true],
 ['aggregated child calls',v=>v.operations[0].operations=['GET','GET']],
 ['secret read instead of presence check',v=>find(v,'F:wrapper-before.original-settings').operation='read-secret'],
 ['new execution authority',v=>v.executionAuthorized=true]
])test(name+' fails closed',()=>{const v=input();mutate(v);assert.throws(()=>plan(v),/CONTINUATION_PLAN_UNVERIFIED/);});
