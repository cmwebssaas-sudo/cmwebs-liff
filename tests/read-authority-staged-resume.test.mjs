import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {stagedFixture,session,clock,hash} from './fixtures/read-authority/standalone-budget.mjs';
import * as plans from '../scripts/read-authority-continuation-plan.mjs';
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r));
const N=(n,target='original-settings')=>({id:'staged-publisher-'+n,bucket:'N',alias:'publisher-'+n,actor:'publisher',target,operation:'snapshot',units:1,stage:'publisher'});
const mapped=()=>Object.entries(plans.STAGED_RESUME_POLICY.operations).map(([k,r])=>({id:k.replaceAll(':','.'),bucket:k[0],alias:k.slice(2),actor:r.actor,target:r.target,operation:r.methods[0],units:1}));
const full=()=>({decisionHash:plans.STAGED_RESUME_DECISION_HASH,history:{spent:42,limit:160},mapComplete:true,operations:[...mapped(),...Array.from({length:12},(_,i)=>N(i+1)),...['enter','observe'].map((v,i)=>({id:'caller-'+v,bucket:'N',alias:'caller-oauth-'+v,actor:'caller',target:'caller-oauth',operation:i?'snapshot':'navigate',units:1,stage:'caller-oauth'})),...['before','after'].map(v=>({id:'thin-'+v,bucket:'N',alias:'thin-triggers-'+v,actor:'publisher',target:'thin-triggers',operation:'snapshot',units:1,stage:'thin-trigger'}))]});
test('named policy preserves42, exact98 future and16 partition, all32 privacy observations, cleanup and unused2',()=>{
 assert.equal(typeof plans.compileAuthorityStagedResumePlan,'function');const p=plans.compileAuthorityStagedResumePlan(full());assert.equal(p.totalUnits,156);assert.equal(p.reservedTotalUnits,160);assert.equal(p.budgetFits,true);assert.equal(Object.keys(plans.STAGED_RESUME_POLICY.operations).filter(k=>k[0]==='F').length,32);assert.equal(plans.STANDALONE_TRIAL_POLICY.operations['B:auth-tabs-batch'],undefined);
});
test('no N borrowing, legacy header aliases, unknown costs or fake imported history',()=>{
 for(const mutate of [v=>v.operations.push(N(13)),v=>v.operations.find(x=>x.bucket==='N').actor='caller',v=>v.operations.find(x=>x.alias==='auth-tabs-batch').alias='auth-tab-users',v=>v.history.spent=41]){const v=full();mutate(v);assert.throws(()=>plans.compileAuthorityStagedResumePlan(v),/CONTINUATION_PLAN_UNVERIFIED/);}
 const v=full();v.operations.find(x=>x.bucket==='E').units=null;assert.equal(plans.compileAuthorityStagedResumePlan(v).budgetFits,false);
});
test('local claim and inspect leave W0 unset; actual debit starts durable bounded window preserving all predecessor bytes',async()=>{
 const s=await stagedFixture(),old=readFileSync(s.cfg.stagedResume.journal.path),h=session(s);try{let r=await h.ready;ok(r);assert.equal(r.spent,42);assert.equal(r.w0,null);assert.equal(r.expiresAt,null);ok(await h.send({op:'inspect'}));assert.equal(s.stagedJournal().w0,null);
 const now=s.cfg.now+10000;ok(await h.send({op:'wait',operation:N(1),now}));assert.equal(s.stagedJournal().w0,null);r=await h.send({op:'debit',operation:N(1),now});ok(r);assert.equal(r.spent,43);assert.equal(r.w0,now);assert.equal(r.expiresAt-now,21600000);assert.equal(s.stagedJournal().events[0].outcome,'UNKNOWN');assert.deepEqual(readFileSync(s.cfg.stagedResume.journal.path),old);
 }finally{await h.close();}const duplicate=session(s);try{assert.equal((await duplicate.ready).ok,false);}finally{await duplicate.close();}
});
test('mapless submission/refresh/RPC and borrowed readonly targets deny without debit',async()=>{
 for(const operation of [N(13),{...N(1),target:'publisher-executions'}, {id:'refresh',bucket:'P',alias:'publisher-refresh',actor:'publisher',target:'publisher-oauth',operation:'POST',units:1}]){const s=await stagedFixture(),h=session(s);try{ok(await h.ready);assert.equal((await h.send({op:'debit',operation,now:s.cfg.now})).ok,false);assert.equal(s.stagedJournal().spent,0);}finally{await h.close();}}
});
test('predecessor drift, repayment, partial claims and chaining cannot import42',async()=>{
 for(const fault of ['drift','refund','chain','partial']){const s=await stagedFixture();if(fault==='drift')s.put(s.cfg.stagedResume.journal.path,readFileSync(s.cfg.stagedResume.journal.path,'utf8')+' ');if(fault==='refund')s.cfg.stagedResume.approval.sha256='f'.repeat(64);if(fault==='chain')s.cfg.stagedResume.journal.path=s.path+'.staged-resume.json';if(fault==='partial')s.put(s.path+'.staged-resume-claim.json','{');const h=session(s);try{assert.equal((await h.ready).ok,false);}finally{await h.close();}}
});
import * as controls from '../scripts/read-authority-continuation-control.mjs';
async function stagedControl(extra={}){
 const s=await stagedFixture(),home=process.env.HOME;process.env.HOME=s.home;let time=s.cfg.now;const stages=[],pauses=[];
 // Actual retained owner is mandatory; this synthetic owner models its narrow
 // settled cleanup lane, never disk booleans or a serialized drain receipt.
 const owner=Object.freeze({withContinuation:async()=>{},requestStop:async()=>{},stopAndDrain:async()=>({}),withOriginalCleanup:async fn=>fn(),withScriptCleanup:async()=>{}});
 const {now,ownerNonce,...config}=s.cfg;
 try{
  assert.equal(typeof controls.createAuthorityStagedResumeControl,'function');
  s.control=controls.createAuthorityStagedResumeControl({config,predecessorHandoff:controls.createAuthorityClosedPreflightHandoff({current:{control:owner}}),now:()=>time,pause:async ms=>{pauses.push(ms);time+=ms;},guard:()=>{},assertStage:proof=>{stages.push(proof.stage);},...extra});
 }finally{if(home===undefined)delete process.env.HOME;else process.env.HOME=home;}
 return {...s,stages,pauses,now:()=>time,setTime:v=>{time=v;}};
}
const stageInput=(name,prior=[])=>({stage:name,operations:mapped().filter(o=>plans.STAGED_RESUME_STAGES[name].includes(o.bucket+':'+o.alias)),futureCaps:Object.fromEntries(Object.entries(plans.STAGED_RESUME_STAGES).filter(([k])=>k!==name&&!prior.includes(k)).map(([k,v])=>[k,v.length]))});
test('staged controller is inert, single IO owns original lock and first UNKNOWN is visible inside callback',async()=>{
 const s=await stagedControl();assert.equal(existsSync(s.path+'.staged-resume.json'),false);
 let open,release;const entered=new Promise(r=>open=r),gate=new Promise(r=>release=r);let capRef;
 const scope=s.control.withContinuation(async cap=>{capRef=cap;assert.equal(cap.identity.expiresAt,null);assert.equal((await cap.inspect()).w0,null);await cap.externalRead(async()=>{assert.equal(s.stagedJournal().w0,s.now());assert.equal(s.stagedJournal().spent,1);open();await gate;},N(1));});
 await entered;await assert.rejects(capRef.externalRead(()=>{},N(2)),/TRIAL_STOPPED/);release();await assert.rejects(scope,/TRIAL_STOPPED/);assert.equal(s.stagedJournal().spent,1);assert.equal((await s.control.stopAndDrain()).ordinaryScopeClosed,true);
});
test('current stage requires actual synchronous guard and exact full future caps; no callbacks or W0 on failed guard',async()=>{
 const s=await stagedControl({assertStage:()=>{throw Error('UNVERIFIED_CURRENT_CALLBACK');}});let calls=0;
 await assert.rejects(s.control.withContinuation(async cap=>{await cap.completeStage(stageInput('baseline'));await cap.externalRead(()=>{calls++;},mapped().find(o=>o.alias==='publisher-refresh'));}),/TRIAL_STOPPED/);assert.equal(calls,0);assert.equal(s.stagedJournal().w0,null);
});
test('stage admission permits fixed current callbacks without full future map; missing reserves and repeat stages deny',async()=>{
 for(const fault of ['none','missing-reserve','repeat']){const s=await stagedFixture(),h=session(s);try{ok(await h.ready);const input=stageInput('baseline');if(fault==='missing-reserve')delete input.futureCaps.recovery;let r=await h.send({op:'stage-ready',now:s.cfg.now,...input});if(fault==='missing-reserve'){assert.equal(r.ok,false);continue;}ok(r);assert.equal(r.w0,null);if(fault==='repeat'){assert.equal((await h.send({op:'stage-ready',now:s.cfg.now,...input})).ok,false);continue;}
 const refresh=input.operations.find(o=>o.alias==='publisher-refresh');ok(await h.send({op:'debit',now:s.cfg.now,operation:refresh}));assert.equal(s.stagedJournal().plan,null);const H=mapped().find(o=>o.bucket==='H');assert.equal((await h.send({op:'rpc-begin',now:s.cfg.now,operation:H,credentialExpiresAt:s.cfg.now+2000000})).ok,false);assert.equal(s.stagedJournal().chargedUpperBoundMs,0);
 }finally{await h.close();}}
});
test('late Taipei first IO uses same-day final millisecond; too little RPC reserve denies before first debit',async()=>{
 for(const remaining of [360001,360000]){const s=await stagedFixture();s.cfg.now=Date.parse('2026-10-16T16:00:00Z')-remaining-1;const h=session(s);try{ok(await h.ready);const r=await h.send({op:'debit',operation:N(1),now:s.cfg.now});assert.equal(r.ok,remaining>360000);if(r.ok){assert.equal(r.expiresAt,Date.parse('2026-10-16T16:00:00Z')-1);assert.equal(r.expiresAt-r.w0,remaining);}else assert.equal(s.stagedJournal().w0,null);}finally{await h.close();}}
});
test('readonly partitions cannot replace caller/thin allowances and post thin observation waits for RPC',async()=>{
 for(const operation of [{...N(1),alias:'caller-oauth-enter',stage:'caller-oauth',actor:'publisher',target:'caller-oauth',operation:'navigate'},{id:'thin-after',bucket:'N',alias:'thin-triggers-after',actor:'publisher',target:'thin-triggers',operation:'snapshot',units:1,stage:'thin-trigger'}]){const s=await stagedFixture(),h=session(s);try{ok(await h.ready);assert.equal((await h.send({op:'debit',operation,now:s.cfg.now})).ok,false);assert.equal(s.stagedJournal().spent,0);}finally{await h.close();}}
});
test('UNKNOWN callback rejection is charged once, cannot retry and independent J2/C/I remain after damaged ordinary journal',async()=>{
 const s=await stagedControl();let calls=0;
 await assert.rejects(s.control.withContinuation(cap=>cap.externalRead(()=>{calls++;throw Error('PRIVATE_TRANSPORT_ERROR');},N(1))),/TRIAL_STOPPED/);
 assert.equal(calls,1);assert.equal(s.stagedJournal().spent,1);s.put(s.path+'.staged-resume.json','{');
 await s.control.withScriptCleanup(async cap=>{await cap.cleanup('script-remove',()=>{calls++;});await cap.cleanup('script-verify',()=>{calls++;});});
 const checkpoint=JSON.parse(readFileSync(s.cfg.stagedResume.registry.path.replace('.standalone-successor.json','.staged-resume.json'))).value.checkpoint;assert.equal(checkpoint.spent,3);assert.equal(checkpoint.events[0].outcome,'UNKNOWN');assert.equal(calls,3);assert.equal(s.get().spent,27);assert.equal(readFileSync(s.path+'.staged-resume.json','utf8'),'{');
 await s.control.withOriginalCleanup(async()=>{calls++;});assert.equal(calls,4);
});
test('complete plan requires reserved caller entry/observe and before/after thin observations',()=>{
 for(const alias of ['caller-oauth-enter','caller-oauth-observe','thin-triggers-before','thin-triggers-after']){const v=full();v.operations=v.operations.filter(o=>o.alias!==alias);assert.equal(plans.compileAuthorityStagedResumePlan(v).credentialRpcEligible,false);}
 const all=Object.values(plans.STAGED_RESUME_STAGES).flat();assert.equal(all.length,98);assert.equal(new Set(all).size,98);
});
test('all42 historical calls remain in rate union; inspect and wait never start W0 or refund history',async()=>{
 const s=await stagedFixture();const predecessor=JSON.parse(readFileSync(s.cfg.stagedResume.journal.path));s.cfg.now=predecessor.events.at(-1).time;const h=session(s);try{ok(await h.ready);let now=s.cfg.now;
 for(let n=1;n<=2;n++){const r=await h.send({op:'wait',operation:N(n),now});ok(r);if(n===2)assert(r.waitMs>0);assert.equal(s.stagedJournal().spent,n-1);if(n===1)assert.equal(s.stagedJournal().w0,null);now+=r.waitMs;ok(await h.send({op:'debit',operation:N(n),now}));}
 assert.equal((await h.send({op:'debit',operation:N(1),now})).ok,false);assert.equal(s.stagedJournal().spent,2);
 }finally{await h.close();}
});
test('full synthetic RPC route keeps all privacy observations, one360s charge, after navigation and global C/I/J/unused reserves',async()=>{
 const s=await stagedFixture(),h=session(s),operations=full().operations;let now=s.cfg.now;
 const advance=async operation=>{let r=await h.send({op:'wait',operation,now});ok(r);now+=r.waitMs;r=await h.send({op:'debit',operation,now});ok(r);return r;};
 try{ok(await h.ready);ok(await h.send({op:'plan-ready',operations,now}));assert.equal(s.stagedJournal().w0,null);
 for(const bucket of ['P','A','B','D','E'])for(const o of operations.filter(o=>o.bucket===bucket))await advance(o);
 for(const o of operations.filter(o=>o.bucket==='N'&&!['thin-triggers-after','publisher-12'].includes(o.alias)||['F','G'].includes(o.bucket)&&o.alias.startsWith('wrapper-before.')))await advance(o);
 const H=operations.find(o=>o.bucket==='H');let r=await h.send({op:'rpc-wait',operation:H,credentialExpiresAt:s.cfg.now+2000000,now});ok(r);now+=r.waitMs;ok(await h.send({op:'rpc-begin',operation:H,credentialExpiresAt:s.cfg.now+2000000,now}));assert.equal(s.stagedJournal().chargedUpperBoundMs,360000);
 await advance(operations.find(o=>o.alias==='publisher-12'));await advance(operations.find(o=>o.alias==='thin-triggers-after'));
 for(const o of operations.filter(o=>['F','G'].includes(o.bucket)&&o.alias.startsWith('wrapper-after.')||o.bucket==='T'))await advance(o);
 ok(await h.send({op:'rpc-finish',now}));
 for(const [kind,actions] of [['C',['restore-editor','read-restored-editor']],['I',operations.filter(o=>o.bucket==='I').map(o=>o.alias)]])for(const action of actions){r=await h.send({op:'oldcleanup-wait',kind,action,now});ok(r);now+=r.waitMs;ok(await h.send({op:'oldcleanup-debit',kind,action,now}));}
 const final=await h.send({op:'inspect'});ok(final);assert.equal(final.spent,156);assert.equal(final.cleanup.cActions.length,2);assert.equal(final.cleanup.iActions.length,17);assert.equal(s.stagedJournal().events.filter(e=>e.operation.bucket==='F').length,32);assert.equal(s.stagedJournal().rpc.complete,true);ok(await h.send({op:'finish',now}));
 }finally{await h.close();}
 const recovery=session(s,{...s.cfg,now:now+60000,minimumNewSpent:s.stagedJournal().spent},null,true);try{ok(await recovery.ready);for(const action of ['script-remove','script-verify'])ok(await recovery.send({op:'scriptcleanup-debit',action,now:now+60000}));const final=JSON.parse(readFileSync(s.cfg.stagedResume.registry.path.replace('.standalone-successor.json','.staged-resume.json'))).value.checkpoint;assert.equal(s.get().spent+15+final.spent,158);assert.equal(final.chargedUpperBoundMs,360000);assert.equal(final.events.filter(e=>e.operation.bucket==='J').length,2);}finally{await recovery.close();}
});
import {setup as driverFixture} from './fixtures/read-authority/standalone-driver.mjs';
import * as drivers from '../scripts/read-authority-continuation-driver.mjs';
test('staged driver uses raw null identity plus actual inspected deadline and all real cap debits for one synthetic RPC',async()=>{
 const s=await stagedControl(),base=driverFixture(),operations=full().operations;let dispatched=0;
 await s.control.withContinuation(async cap=>{
  await cap.externalRead(()=>{},operations.find(o=>o.alias==='publisher-1'));const state=await cap.inspect();assert.equal(cap.identity.expiresAt,null);await cap.completePlan(operations);
  for(const bucket of ['P','A','B','D','E'])for(const o of operations.filter(o=>o.bucket===bucket))await cap.externalRead(()=>{},o);
  for(const o of operations.filter(o=>o.bucket==='N'&&!['publisher-1','publisher-12','thin-triggers-after'].includes(o.alias)))await cap.externalRead(()=>{},o);
  const expected={...base.options.expected,trialEpoch:s.cfg.epoch};
  const options={...base.options,decisionHash:plans.STAGED_RESUME_DECISION_HASH,continuationBinding:s.cfg.binding,expected,expiresAt:state.expiresAt,now:s.now,operations,
   closedPreflight:{pins:s.cfg.closedPreflight,callerSelection:s.predecessor.events[0].operation},stagedResume:s.cfg.stagedResume,
   credential:()=>({...base.options.credential(),expiresAt:state.expiresAt}),publisherCredential:()=>({...base.options.publisherCredential(),expiresAt:state.expiresAt}),
   readRelease:async readCap=>{if(readCap.phase==='wrapper-after')for(const alias of ['publisher-12','thin-triggers-after'])await cap.externalRead(()=>{},operations.find(o=>o.alias===alias));for(const alias of plans.STAGED_RESUME_STAGES.readbacks.filter(k=>k.startsWith('F:wrapper-before.')).map(k=>k.slice('F:wrapper-before.'.length)))await readCap.externalRead(()=>{},alias);return {...base.release(),...expected,observedAt:s.now()};},
   readIdentity:async(actor,_token,context)=>({source:'google-userinfo-same-token',actor,phase:context.phase,accountHash:expected[actor+'Hash'],observedAt:s.now(),credentialExpiresAt:state.expiresAt}),
   signRequest:()=>({...base.options.signRequest(),timestamp:s.now()}),
   transport:async()=>{dispatched++;assert.equal(s.stagedJournal().chargedUpperBoundMs,360000);assert.equal(s.stagedJournal().events.at(-1).operation.bucket,'H');return {done:true,response:{result:{compatible:true}}};}
  };
  assert.equal(typeof drivers.createAuthorityStagedResumeDriver,'function');assert.deepEqual(await drivers.createAuthorityStagedResumeDriver(options).run(cap),{compatible:true});assert.equal(dispatched,1);
 });assert.equal(s.stagedJournal().events.filter(e=>e.operation.bucket==='F').length,32);assert.equal(s.stagedJournal().rpc.complete,true);assert.equal(s.stagedJournal().finished,true);
});
test('stage map cannot underreserve, widen cost, change admitted descriptors or replay a debit',async()=>{
 for(const fault of ['underreserve','unknown-cost','descriptor-drift','duplicate-debit']){const s=await stagedFixture(),h=session(s);try{ok(await h.ready);const input=stageInput('baseline');if(fault==='underreserve')input.futureCaps.recovery--;if(fault==='unknown-cost')input.operations[0].units=null;const r=await h.send({op:'stage-ready',...input,now:s.cfg.now});if(['underreserve','unknown-cost'].includes(fault)){assert.equal(r.ok,false);assert.equal(s.stagedJournal().spent,0);continue;}ok(r);const op=input.operations.find(o=>o.alias==='publisher-refresh');ok(await h.send({op:'debit',operation:op,now:s.cfg.now}));if(fault==='duplicate-debit')assert.equal((await h.send({op:'debit',operation:op,now:s.cfg.now})).ok,false);else{const operations=full().operations;operations.find(o=>o.alias==='publisher-refresh').id='changed-mapping';assert.equal((await h.send({op:'plan-ready',operations,now:s.cfg.now})).ok,false);}assert.equal(s.stagedJournal().spent,1);
 }finally{await h.close();}}
});
test('staged expiry cannot restart from later wait/inspect or admit cross-day IO',async()=>{
 const s=await stagedFixture(),h=session(s);try{ok(await h.ready);const r=await h.send({op:'debit',operation:N(1),now:s.cfg.now});ok(r);const expiry=r.expiresAt;ok(await h.send({op:'inspect'}));assert.equal((await h.send({op:'wait',operation:N(2),now:expiry})).ok,false);assert.equal(s.stagedJournal().w0,s.cfg.now);assert.equal(s.stagedJournal().expiresAt,expiry);assert.equal(s.stagedJournal().spent,1);
 }finally{await h.close();}
});
