import assert from 'node:assert/strict';import test from 'node:test';import {readFileSync} from 'node:fs';
import {inventoryFixture,holder,inventoryStep,inventoryStages,failedInventory,verifiedInventory} from './fixtures/read-authority/inventory-diagnostic.mjs';
import {SIMPLE_RULES} from '../scripts/read-authority-simple-plan.mjs';
const fixed=()=>Object.entries(SIMPLE_RULES).map(([key,r])=>({id:'inventory-fixed.'+key.replace(':','.'),bucket:key[0],alias:key.slice(2),actor:r.actor,target:r.target,operation:r.methods[0],units:1}));
function plan(size){const operations=fixed(),browserOperations=operations.filter(o=>!['C','I','J'].includes(o.bucket)&&!['GET','POST','PUT','PATCH','DELETE'].includes(o.operation)).map(o=>({id:'native.'+o.id,key:o.bucket+':'+o.alias,actor:o.actor,target:o.target,operation:['GET','snapshot','read-key-presence'].includes(o.operation)?'snapshot':o.operation,units:1,preparation:false}));for(let n=browserOperations.length;n<size;n++)browserOperations.push({id:'future-inventory-route-'+n,key:'N:navigation',actor:'publisher',target:'original-settings',operation:'navigate',units:1,preparation:false});return {operations,browserOperations};}
test('exact97 successor preserves history and completes only four prepaid steps to101 without fake wait',async()=>{
 const s=await inventoryFixture(),a=holder(s);await a.withContinuation(async cap=>{
  const start=await cap.inspect();assert.equal(start.combinedSpent,97);assert.equal(start.ownerSelected,true);assert.equal(start.ownerAccountVerified,false);
  for(const stage of inventoryStages)await inventoryStep(cap,s,stage);
  const r=await cap.inspect(),j=s.inventory();assert.equal(r.combinedSpent,101);assert.equal(r.connectionUsed,12);assert.equal(r.connectionFaults,2);
  assert.equal(j.loading.used,18);assert.equal(j.connection.waitSucceeded,false);assert.equal(j.ownerConnection.accountVerified,true);assert.equal(j.inventoryDiagnostic.used,4);assert.equal(j.futureOrdinaryUi,36);
  assert.equal(j.w0,null);assert.equal(j.rpc.beganAt,null);assert.equal(j.events.length,48);await cap.pausePreparation();
 });assert.equal(s.inventory().lifecycle,'CLEAN_PAUSE');assert.equal(a.preparationHandoff().minimumEvents,48);
 for(const[p,bytes]of Object.entries(s.retained97))assert.deepEqual(readFileSync(p),bytes);
});
for(const failed of inventoryStages)test('settled '+failed+' failure consumes one step and permanently stops without retry or account credit',async()=>{
 const s=await inventoryFixture();let calls=0;await assert.rejects(holder(s).withContinuation(async cap=>{
  for(const stage of inventoryStages)await inventoryStep(cap,s,stage,()=>{calls++;if(stage===failed)throw stage==='inventory'?failedInventory():Error('synthetic');return stage==='inventory'?{source:'readonly-tab-inventory-v1',status:'VERIFIED',rowCount:1,invalidRows:0,accessors:0,proxies:0,duplicateIds:0,providerIdMissing:0,originalMatches:1,exactUrlMatches:1,rawValuesRetained:false}:{verified:true};});
 }),/TRIAL_STOPPED/);
 const j=s.inventory();assert.equal(calls,inventoryStages.indexOf(failed)+1);assert.equal(j.pending,null);assert.equal(j.events.at(-1).settled,true);assert.equal(j.events.at(-1).success,false);assert.equal(j.connection.failures,2);assert.equal(j.ownerConnection.accountVerified,false);assert.equal(j.lifecycle,'HARD_STOP');
 if(failed==='inventory')assert.equal(j.events.at(-1).inventoryClassification.status,'API_REJECTED');
 await assert.rejects(holder(s).withContinuation(()=>{calls++;}),/TRIAL_STOPPED/);assert.equal(calls,inventoryStages.indexOf(failed)+1);
});
for(const size of [36,37])test('future '+size+' actual-map primitives '+(size===36?'fit':'cannot borrow recovery')+' after101',async()=>{
 const s=await inventoryFixture(),a=holder(s),run=a.withContinuation(async cap=>{for(const stage of inventoryStages)await inventoryStep(cap,s,stage);await cap.completePlan(plan(size));await cap.pausePreparation();});
 if(size===36){await run;assert.equal(s.inventory().plan.browserOperations.length,36);}else await assert.rejects(run,/TRIAL_STOPPED/);
 assert.equal(s.inventory().events.length,48);assert.equal(s.inventory().w0,null);
});
test('released historical unused ID cannot be reused in a future actual map',async()=>{
 const s=await inventoryFixture();await assert.rejects(holder(s).withContinuation(async cap=>{for(const stage of inventoryStages)await inventoryStep(cap,s,stage);const p=plan(36);p.browserOperations.at(-1).id='continuity-settings-navigate';await cap.completePlan(p);}),/TRIAL_STOPPED/);
 assert.equal(s.inventory().events.length,48);assert.equal(s.inventory().plan,null);
});
for(const defect of ['approval','origin-stop','origin-journal','terminal','registry'])test('exact97 import refuses '+defect+' before callbacks',async()=>{
 const s=await inventoryFixture(),p=s.cfg.readonlyConnection.repair92.diagnostic93.owner94.inventory97;
 if(defect==='registry')s.put(p.origin.registry.path,'{}');else if(defect==='approval')p.decisionHash='0'.repeat(64);else s.put(p.origin[defect==='origin-stop'?'stop':defect==='origin-journal'?'journal':'terminal'].path,'{}');
 let calls=0;await assert.rejects(async()=>holder(s).withContinuation(()=>{calls++;}),/TRIAL_STOPPED/);assert.equal(calls,0);
});
test('partial binding cannot create a clean handoff or identity proof',async()=>{
 const s=await inventoryFixture(),a=holder(s);await assert.rejects(a.withContinuation(async cap=>{await inventoryStep(cap,s,'binding');await cap.pausePreparation();}),/TRIAL_STOPPED/);
 assert.equal(s.inventory().events.length,45);assert.equal(s.inventory().ownerConnection.accountVerified,false);assert.throws(()=>a.preparationHandoff(),/TRIAL_STOPPED/);
});
test('semantically invalid VERIFIED evidence settles false with safe classification instead of leaving pending',async()=>{
 const s=await inventoryFixture();await assert.rejects(holder(s).withContinuation(async cap=>{
  await inventoryStep(cap,s,'binding');await inventoryStep(cap,s,'inventory',()=>({...verifiedInventory(),rowCount:0}));
 }),/TRIAL_STOPPED/);
 const j=s.inventory();assert.equal(j.pending,null);assert.equal(j.events.at(-1).settled,true);assert.equal(j.events.at(-1).success,false);
 assert.equal(j.events.at(-1).inventoryClassification.status,'RESULT_UNVERIFIED');assert.equal(j.ownerConnection.accountVerified,false);
});
test('ordinary future UI IDs sharing the preparation prefix still settle normally',async()=>{
 const s=await inventoryFixture();await holder(s).withContinuation(async cap=>{
  for(const stage of inventoryStages)await inventoryStep(cap,s,stage);
  const p=plan(36),op=p.browserOperations.at(-1);op.id='loading-inventory97-ordinary-navigation';await cap.completePlan(p);
  for(const identity of p.operations.filter(o=>o.bucket==='P'))await cap.externalRead(()=>true,identity);
  await cap.browserRead(()=>({verified:true}),op);
 });const j=s.inventory();assert.equal(j.pending,null);assert.equal(j.events.at(-1).settled,true);assert.equal(j.events.at(-1).success,true);
 assert.equal(j.events.at(-1).operation.id,'loading-inventory97-ordinary-navigation');assert.equal(j.inventoryDiagnostic.used,4);
});
