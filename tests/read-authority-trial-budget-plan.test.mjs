import test from 'node:test';
import assert from 'node:assert/strict';
import {planAuthorityTrialBudget} from '../scripts/read-authority-trial-budget-plan.mjs';
const decisionHash='0b382d87214d9d1fbe658b1615176de48917666698e79092218f1691c358a675';
const credentialDecision='5bd83ace54d7af801880798be3460ed9b6f8c8b053b447459e7956b127ff4c72';
const phases=['wrapper-before','wrapper-after'];
function input(){return {stage:'single-wrapper-compatibility',decisionHash,counter:{limit:160,spent:25,kind:'preparation-management-reads',proposal_sha256:'b'.repeat(64),approval_sha256:'a'.repeat(64),prior_limit:40},nativeWindows:phases.flatMap(phase=>['caller','publisher'].map(actor=>({phase,actor,pages:4,setupReads:2,identityReads:1,quotaReads:1,settlementReads:0}))),additionalOperations:[{name:'native-prepare-caller',units:2},{name:'native-prepare-publisher',units:2},{name:'unknown-settlement',units:3}]};}
const plan=v=>planAuthorityTrialBudget(v??input());
test('approved credential purposes keep the same160 history and reserve caller1 publisher3',()=>{
 const v=input();v.decisionHash=credentialDecision;v.additionalOperations[0].units=1;v.additionalOperations[1].units=3;const r=plan(v);
 assert.equal(r.totalReads,160);assert.equal(r.decisionHash,credentialDecision);assert.equal(r.spent,25);assert.equal(r.bucketLimits.P.caller,1);assert.equal(r.bucketLimits.P.publisher,3);assert.equal(r.executionAuthorized,false);assert.equal(r.scopeReviewRequired,false);assert.equal(r.bucketLimits.G.total,32);
});
test('new credential purpose cannot borrow a second caller binding or fourth publisher slot',()=>{
 for(const [caller,publisher] of [[2,3],[1,4]]){const v=input();v.decisionHash=credentialDecision;v.additionalOperations[0].units=caller;v.additionalOperations[1].units=publisher;assert.throws(()=>plan(v),/TRIAL_BUDGET_UNVERIFIED/);}
});
test('approved single wrapper reserves all160 without counting editor restoration twice or granting execution',()=>{
 const v=input(),before=structuredClone(v),r=plan(v);
 assert.equal(r.fixedFutureReads,96);assert.equal(r.spent,25);assert.equal(r.nativeReads,32);assert.equal(r.additionalReads,7);assert.equal(r.totalReads,160);assert.equal(r.reservedTotalReads,160);assert.equal(r.unallocatedReads,0);assert.equal(r.budgetFits,true);assert.equal(r.cleanupReserve,17);assert.equal(r.originalRestoreReserve,2);assert.equal(r.executionAuthorized,false);assert.equal(r.scopeReviewRequired,false);assert.equal(r.decisionHash,decisionHash);assert.deepEqual(r.allowedEntries,['wrapper']);assert.deepEqual(v,before);
 assert.deepEqual(r.phaseReads,{A:9,B:13,C:9,D:10,E:7,F:30,G:32,H:1,I:17,P:4,T:3});
 assert.equal(r.bucketLimits.G.total,32);assert.equal(r.bucketLimits.G.perWindow.pages,4);assert.equal(r.bucketLimits.P.caller,2);assert.equal(r.bucketLimits.P.publisher,2);assert.equal(r.bucketLimits.T,3);assert(Object.isFrozen(r.bucketLimits.G.perWindow));
 assert(!JSON.stringify(r).includes('a'.repeat(64)));assert(!JSON.stringify(r).includes('b'.repeat(64)));
});
test('four full windows retain caller and publisher coverage and do not turn unused page slots into spare ordinary reads',()=>{
 const v=input();v.nativeWindows.forEach(w=>{w.pages=w.actor==='publisher'?3:1;w.setupReads=0;});const r=plan(v);
 assert.equal(r.nativeReads,16);assert.equal(r.totalReads,144);assert.equal(r.reservedTotalReads,160);assert.equal(r.unallocatedReads,0);assert.equal(r.plannedUnusedReads,16);assert.equal(r.budgetFits,true);assert.equal(r.phaseReads.F,30);assert.equal(r.phaseReads.H,1);
});
test('unverified pagination blocks a fitting reserved total rather than assuming the four-page maximum is observed',()=>{
 const v=input();v.nativeWindows[1].pages=null;const r=plan(v);assert.equal(r.nativeReads,null);assert.equal(r.totalReads,null);assert.equal(r.minimumTotalReads,157);assert.equal(r.reservedTotalReads,160);assert.equal(r.unallocatedReads,0);assert.equal(r.budgetFits,false);assert.deepEqual(r.unknownCosts,['wrapper-before.publisher.pages']);assert.equal(r.executionAuthorized,false);
});
test('unverified preparation and terminal costs do not default to zero',()=>{
 const v=input();v.additionalOperations[0].units=null;v.additionalOperations[2].units=null;const r=plan(v);assert.equal(r.additionalReads,null);assert.equal(r.totalReads,null);assert.equal(r.minimumTotalReads,155);assert.equal(r.budgetFits,false);assert.deepEqual(r.unknownCosts,['additional.native-prepare-caller','additional.unknown-settlement']);
});
test('later spent history cannot borrow the individually reserved buckets even when the planned reads look small',()=>{
 const v=input();v.counter.spent=26;v.nativeWindows.forEach(w=>{w.pages=1;w.setupReads=0;});const r=plan(v);assert.equal(r.spent,26);assert.equal(r.totalReads,141);assert.equal(r.reservedTotalReads,161);assert.equal(r.unallocatedReads,-1);assert.equal(r.budgetFits,false);
});
test('window and auxiliary operation order do not alter policy or remaining bucket reserves',()=>{
 const v=input(),a=plan(v);v.nativeWindows.reverse();v.additionalOperations.reverse();assert.deepEqual(plan(v),a);
});
for(const [name,mutate] of [
 ['missing decision hash',v=>delete v.decisionHash],['wrong decision hash',v=>v.decisionHash='f'.repeat(64)],['old two-entry stage',v=>v.stage='compatibility-only'],['qualified window',v=>v.nativeWindows[0].phase='qualified-before'],
 ['missing window',v=>v.nativeWindows.pop()],['duplicate window',v=>v.nativeWindows[3]={...v.nativeWindows[0]}],['extra window',v=>v.nativeWindows.push({...v.nativeWindows[0]})],['page zero',v=>v.nativeWindows[0].pages=0],['fifth page',v=>v.nativeWindows[0].pages=5],['third control',v=>v.nativeWindows[0].setupReads=3],
 ['missing identity reserve',v=>v.nativeWindows[0].identityReads=0],['missing quota reserve',v=>v.nativeWindows[0].quotaReads=0],['settlement in a window',v=>v.nativeWindows[0].settlementReads=1],['unknown terminal borrowing',v=>v.additionalOperations[2].units=4],['caller preparation borrowing',v=>v.additionalOperations[0].units=3],['publisher preparation borrowing',v=>v.additionalOperations[1].units=3],['unknown extra operation',v=>v.additionalOperations.push({name:'extra',units:1})],['missing auxiliary bucket',v=>v.additionalOperations.pop()],['duplicate auxiliary bucket',v=>v.additionalOperations[2]={...v.additionalOperations[0]}],
 ['fractional read',v=>v.nativeWindows[0].quotaReads=0.5],['refund history',v=>v.counter.spent=24],['expanded limit',v=>v.counter.limit=161],['changed ledger shape',v=>v.counter.preparation={}],['authority stage',v=>v.stage='authority']
])test(name+' cannot alter the approved single-entry cost plan',()=>{const v=input();mutate(v);assert.throws(()=>plan(v),/TRIAL_BUDGET_UNVERIFIED/);});
