import assert from 'node:assert/strict';import test from 'node:test';import {readFileSync} from 'node:fs';
import {retargetFixture,holder,step,stages,failed,verified} from './fixtures/read-authority/project-retarget.mjs';
import {SIMPLE_RULES} from '../scripts/read-authority-simple-plan.mjs';
const fixed=()=>Object.entries(SIMPLE_RULES).map(([key,r])=>({id:'inventory-fixed.'+key.replace(':','.'),bucket:key[0],alias:key.slice(2),actor:r.actor,target:r.target,operation:r.methods[0],units:1}));
function plan(size){const operations=fixed(),browserOperations=operations.filter(o=>!['C','I','J'].includes(o.bucket)&&!['GET','POST','PUT','PATCH','DELETE'].includes(o.operation)).map(o=>({id:'native.'+o.id,key:o.bucket+':'+o.alias,actor:o.actor,target:o.target,operation:['GET','snapshot','read-key-presence'].includes(o.operation)?'snapshot':'submit',units:1,preparation:false}));for(let n=browserOperations.length;n<size;n++)browserOperations.push({id:'future-inventory-route-'+n,key:'N:navigation',actor:'publisher',target:'original-settings',operation:'navigate',units:1,preparation:false});return {operations,browserOperations};}
test('exact99 successor preserves history and completes only four prepaid steps to103 without fake wait',async()=>{
 const s=await retargetFixture(),a=holder(s);await a.withContinuation(async cap=>{
  const start=await cap.inspect();assert.equal(start.combinedSpent,99);assert.equal(start.ownerSelected,true);assert.equal(start.ownerAccountVerified,false);
  for(const stage of stages)await step(cap,s,stage);
  const r=await cap.inspect(),j=s.retarget();assert.equal(r.combinedSpent,103);assert.equal(r.connectionUsed,14);assert.equal(r.connectionFaults,2);
  assert.equal(j.loading.used,20);assert.equal(j.connection.waitSucceeded,false);assert.equal(j.ownerConnection.accountVerified,true);assert.equal(j.projectRetarget.used,4);assert.equal(j.futureOrdinaryUi,36);assert.equal(j.inventoryDiagnostic.used,2);assert.equal(j.inventoryDiagnostic.accountVerified,false);assert.equal(j.holders.length,14);assert.equal(r.uiOrdinaryLimit,86);
  assert.equal(j.w0,null);assert.equal(j.rpc.beganAt,null);assert.equal(j.events.length,50);await cap.pausePreparation();
 });assert.equal(s.retarget().lifecycle,'CLEAN_PAUSE');assert.equal(a.preparationHandoff().minimumEvents,50);
 for(const[p,bytes]of Object.entries(s.retained99))assert.deepEqual(readFileSync(p),bytes);
});
for(const failedStage of stages)test('settled '+failedStage+' failure consumes one step and permanently stops without retry or account credit',async()=>{
 const s=await retargetFixture();let calls=0;await assert.rejects(holder(s).withContinuation(async cap=>{
  for(const stage of stages)await step(cap,s,stage,()=>{calls++;if(stage===failedStage)throw stage==='inventory'?failed():Error('synthetic');return stage==='inventory'?{source:'readonly-project-inventory-v1',status:'VERIFIED',rowCount:1,invalidRows:0,accessors:0,proxies:0,duplicateIds:0,providerIdMissing:0,opaqueIdMissing:0,exactUrlMatches:1,rawValuesRetained:false}:{verified:true};});
 }),/TRIAL_STOPPED/);
 const j=s.retarget();assert.equal(calls,stages.indexOf(failedStage)+1);assert.equal(j.pending,null);assert.equal(j.events.at(-1).settled,true);assert.equal(j.events.at(-1).success,false);assert.equal(j.connection.failures,2);assert.equal(j.ownerConnection.accountVerified,false);assert.equal(j.lifecycle,'HARD_STOP');
 if(failedStage==='inventory')assert.equal(j.events.at(-1).inventoryClassification.status,'API_REJECTED');
 await assert.rejects(holder(s).withContinuation(()=>{calls++;}),/TRIAL_STOPPED/);assert.equal(calls,stages.indexOf(failedStage)+1);
});
for(const size of [36,37])test('future '+size+' actual-map primitives '+(size===36?'fit':'cannot borrow recovery')+' after103',async()=>{
 const s=await retargetFixture(),a=holder(s),run=a.withContinuation(async cap=>{for(const stage of stages)await step(cap,s,stage);await cap.completePlan(plan(size));await cap.pausePreparation();});
 if(size===36){await run;assert.equal(s.retarget().plan.browserOperations.length,36);}else await assert.rejects(run,/TRIAL_STOPPED/);
 assert.equal(s.retarget().events.length,50);assert.equal(s.retarget().w0,null);
});
test('released historical unused ID cannot be reused in a future actual map',async()=>{
 const s=await retargetFixture();await assert.rejects(holder(s).withContinuation(async cap=>{for(const stage of stages)await step(cap,s,stage);const p=plan(36);p.browserOperations.at(-1).id='continuity-settings-navigate';await cap.completePlan(p);}),/TRIAL_STOPPED/);
 assert.equal(s.retarget().events.length,50);assert.equal(s.retarget().plan,null);
});
for(const defect of ['approval','origin-stop','origin-journal','terminal','registry'])test('exact99 import refuses '+defect+' before callbacks',async()=>{
 const s=await retargetFixture(),p=s.cfg.readonlyConnection.repair92.diagnostic93.owner94.inventory97.retarget99;
 if(defect==='registry')s.put(p.origin.registry.path,'{}');else if(defect==='approval')p.decisionHash='0'.repeat(64);else s.put(p.origin[defect==='origin-stop'?'stop':defect==='origin-journal'?'journal':'terminal'].path,'{}');
 let calls=0;await assert.rejects(async()=>holder(s).withContinuation(()=>{calls++;}),/TRIAL_STOPPED/);assert.equal(calls,0);
});
test('partial binding cannot create a clean handoff or identity proof',async()=>{
 const s=await retargetFixture(),a=holder(s);await assert.rejects(a.withContinuation(async cap=>{await step(cap,s,'binding');await cap.pausePreparation();}),/TRIAL_STOPPED/);
 assert.equal(s.retarget().events.length,47);assert.equal(s.retarget().ownerConnection.accountVerified,false);assert.throws(()=>a.preparationHandoff(),/TRIAL_STOPPED/);
});
test('semantically invalid VERIFIED evidence settles false with safe classification instead of leaving pending',async()=>{
 const s=await retargetFixture();await assert.rejects(holder(s).withContinuation(async cap=>{
  await step(cap,s,'binding');await step(cap,s,'inventory',()=>({...verified(),rowCount:0}));
 }),/TRIAL_STOPPED/);
 const j=s.retarget();assert.equal(j.pending,null);assert.equal(j.events.at(-1).settled,true);assert.equal(j.events.at(-1).success,false);
 assert.equal(j.events.at(-1).inventoryClassification.status,'RESULT_UNVERIFIED');assert.equal(j.ownerConnection.accountVerified,false);
});
test('ordinary future UI IDs sharing the preparation prefix still settle normally',async()=>{
 const s=await retargetFixture();await holder(s).withContinuation(async cap=>{
  for(const stage of stages)await step(cap,s,stage);
  const p=plan(36),op=p.browserOperations.at(-1);op.id='loading-retarget99-ordinary-navigation';await cap.completePlan(p);
  for(const identity of p.operations.filter(o=>o.bucket==='P'))await cap.externalRead(()=>true,identity);
  await cap.browserRead(()=>({verified:true}),op);
 });const j=s.retarget();assert.equal(j.pending,null);assert.equal(j.events.at(-1).settled,true);assert.equal(j.events.at(-1).success,true);
 assert.equal(j.events.at(-1).operation.id,'loading-retarget99-ordinary-navigation');assert.equal(j.projectRetarget.used,4);
});
for(const defect of ['origin-claim','result','current-source','approval-bytes'])test('exact99 rejects '+defect+' before admitting callbacks',async()=>{const s=await retargetFixture(),p=s.cfg.readonlyConnection.repair92.diagnostic93.owner94.inventory97.retarget99;if(defect==='current-source')s.cfg.sources.at(-1).sha256='0'.repeat(64);else s.put(defect==='approval-bytes'?p.approval.path:p.origin[defect==='origin-claim'?'claim':'result'].path,'{}');let calls=0;await assert.rejects(async()=>holder(s).withContinuation(()=>{calls++;}),/TRIAL_STOPPED/);assert.equal(calls,0);});
test('only fully proved103 receipt can hand off and reentry preserves old99 bytes',async()=>{const s=await retargetFixture(),a=holder(s);await a.withContinuation(async cap=>{for(const stage of stages)await step(cap,s,stage);await cap.pausePreparation();});const b=holder(s,{resume:a.preparationHandoff()});await b.withContinuation(async cap=>{const r=await cap.inspect();assert.equal(r.combinedSpent,103);assert.equal(r.retargetAccountVerified,true);await cap.pausePreparation();});assert.equal(s.retarget().holders.length,15);for(const[p,bytes]of Object.entries(s.retained99))assert.deepEqual(readFileSync(p),bytes);});
test('predecessor-only inventory enum in new scope is normalized and settled false',async()=>{const s=await retargetFixture();await assert.rejects(holder(s).withContinuation(async cap=>{await step(cap,s,'binding');await step(cap,s,'inventory',()=>({...verified(),status:'ORIGINAL_MATCH_COUNT'}));}),/TRIAL_STOPPED/);const j=s.retarget();assert.equal(j.pending,null);assert.equal(j.events.at(-1).settled,true);assert.equal(j.events.at(-1).success,false);assert.equal(j.events.at(-1).inventoryClassification.status,'RESULT_UNVERIFIED');});
test('synthetic first-write fence preserves existing new claim and every origin before callback',async()=>{const s=await retargetFixture(),fence=s.path+'.simple-project-retarget-claim.json',registry=s.cfg.readonlyConnection.repair92.diagnostic93.owner94.inventory97.retarget99.origin.registry;const before=readFileSync(registry.path);s.put(fence,'SYNTHETIC_FIRST_WRITE_FENCE');let calls=0;await assert.rejects(holder(s).withContinuation(()=>{calls++;}),/TRIAL_STOPPED/);assert.equal(calls,0);assert.equal(readFileSync(fence,'utf8'),'SYNTHETIC_FIRST_WRITE_FENCE');assert.deepEqual(readFileSync(registry.path),before);for(const[p,bytes]of Object.entries(s.retained99))assert.deepEqual(readFileSync(p),bytes);});
