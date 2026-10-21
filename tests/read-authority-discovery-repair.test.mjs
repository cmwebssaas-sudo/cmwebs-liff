import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {discoveryFixture,holder,fault,repairStep,methods} from './fixtures/read-authority/discovery-repair.mjs';
async function finish(cap,s){while(s.discovery().connection.stage!=='complete')await repairStep(cap,s,s.discovery().connection.stage);}
test('exact92 one-time repair retains history and six separately charged steps reach98, preserving future36',async()=>{
 const s=await discoveryFixture(),a=holder(s);await a.withContinuation(async cap=>{
  assert.equal((await cap.inspect()).combinedSpent,92);const before=s.connection();await finish(cap,s);const j=s.discovery();assert.equal((await cap.inspect()).combinedSpent,98);assert.deepEqual(j.events.slice(0,39),before.events);assert.equal(j.connection.used,9);assert.equal(j.connection.maximum,9);assert.equal(j.connection.failures,2);assert.equal(j.loading.used,15);assert.equal(j.loading.maximum,15);assert.equal(j.futureOrdinaryUi,36);assert.equal(j.events.some(e=>e.operation.id==='continuity-settings-navigate'),false);assert.deepEqual(j.loading.grounded,['thin-settings','oauth-audience']);assert.equal(j.w0,null);assert.equal(j.rpc.beganAt,null);await cap.pausePreparation();
 });for(const[p,b]of Object.entries(s.retained92))assert.deepEqual(readFileSync(p),b);await assert.rejects(holder(s).withContinuation(()=>{}),/TRIAL_STOPPED/);
 const b=holder(s,{resume:a.preparationHandoff()});await b.withContinuation(async cap=>{assert.equal((await cap.inspect()).combinedSpent,98);assert.equal(s.discovery().connection.stage,'complete');await cap.pausePreparation();});
});
for(const stage of Object.keys(methods))test('new '+stage+' failure permanently stops with settled debit; no new retry credit',async()=>{
 const s=await discoveryFixture(),a=holder(s);await assert.rejects(a.withContinuation(async cap=>{for(const next of Object.keys(methods)){await repairStep(cap,s,next,()=>{if(next===stage)throw next==='snapshot'?{source:'settled-preparation',kind:'NOT_READY',phase:'READY',targetVerified:true,accountVerified:true,bindingVerified:true,pureRead:true,terminal:true,fieldsRead:false}:fault(next);return {verified:true};});}}),/TRIAL_STOPPED/);
 const j=s.discovery();assert.equal(j.lifecycle,'HARD_STOP');assert.equal(j.pending,null);assert.equal(j.events.at(-1).settled,true);assert.equal(j.events.at(-1).success,false);assert.equal(j.connection.used,4+Object.keys(methods).indexOf(stage));assert.equal(j.rpc.beganAt,null);assert.equal(j.futureOrdinaryUi,36);await assert.rejects(holder(s).withContinuation(()=>{}),/TRIAL_STOPPED/);
});
for(const defect of ['approval','changed-stop','stale-registry','changed-history','wrong-import','partial-pause','skip-wait'])test('92 repair denies '+defect+' before unapproved IO',async()=>{
 const s=await discoveryFixture();let calls=0;const p=s.cfg.readonlyConnection.repair92;
 if(defect==='approval')p.decisionHash='0'.repeat(64);if(defect==='changed-stop')s.put(s.path+'.simple-connection-stop.json','{}');if(defect==='stale-registry')s.put(p.origin.registry.path,'{}');if(defect==='changed-history')s.put(p.origin.journal.path,'{}');if(defect==='wrong-import')s.cfg.resume={connectionIncident:true};
 await assert.rejects(async()=>holder(s).withContinuation(async cap=>{if(defect==='partial-pause'){await cap.pausePreparation();return;}if(defect==='skip-wait'){for(const n of ['discovery','binding','inventory','claim'])await repairStep(cap,s,n);await repairStep(cap,s,'snapshot',()=>{calls++;});return;}calls++;}),/TRIAL_STOPPED/);assert.equal(calls,0);
});

async function completeMap(size,reuse=false){
 const {SIMPLE_RULES}=await import('../scripts/read-authority-simple-plan.mjs');
 const operations=Object.entries(SIMPLE_RULES).map(([key,r])=>({id:'map-'+key.replace(':','.'),bucket:key[0],alias:key.slice(2),actor:r.actor,target:r.target,operation:r.methods[0],units:1}));
 const browserOperations=operations.filter(o=>!['C','I','J'].includes(o.bucket)&&!['GET','POST','PUT','PATCH','DELETE'].includes(o.operation)).map(o=>({id:'ui.'+o.id,key:o.bucket+':'+o.alias,actor:o.actor,target:o.target,operation:['GET','snapshot','read-key-presence'].includes(o.operation)?'snapshot':'submit',units:1,preparation:false}));
 while(browserOperations.length<size)browserOperations.push({id:'future-nav-'+browserOperations.length,key:'N:navigation',actor:'publisher',target:'original-settings',operation:'navigate',units:1,preparation:false});
 if(reuse==='main')operations.find(o=>o.bucket+':'+o.alias==='P:publisher-refresh').id='continuity-settings-navigate';else if(reuse)browserOperations.at(-1).id='continuity-settings-navigate';return {operations,browserOperations};
}
for(const [size,reuse]of [[36,false],[37,false],[36,true],[36,'main']])test('after98 complete map '+size+' / reserved ID reuse '+reuse+' preserves future36 and oldunused1',async()=>{
 const s=await discoveryFixture(),a=holder(s);let observed=false;
 const work=a.withContinuation(async cap=>{await finish(cap,s);const j=s.discovery(),used=new Set(j.events.map(e=>e.operation.id)),unspent=Object.values(j.preparationStages).flatMap(p=>p.operations).filter(o=>!used.has(o.id)&&!j.loading.superseded.includes(o.id));assert.deepEqual(unspent.map(o=>o.id),['continuity-settings-navigate']);const plan=await completeMap(size,reuse);await cap.completePlan(plan);observed=true;assert.equal((await cap.inspect()).planReady,true);assert.equal((await cap.inspect()).combinedSpent,98);});
 if(size===36&&!reuse){await work;assert.equal(observed,true);}else{await assert.rejects(work,/TRIAL_STOPPED/);assert.equal(observed,false);}assert.equal(s.discovery().events.some(e=>e.operation.id==='continuity-settings-navigate'),false);
});
