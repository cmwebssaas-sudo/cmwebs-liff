import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGED_RESUME_POLICY} from '../scripts/read-authority-continuation-plan.mjs';
const simple=await import('../scripts/read-authority-simple-plan.mjs').catch(()=>({}));
const fixed=()=>Object.entries(STAGED_RESUME_POLICY.operations).map(([key,r])=>({id:key.replaceAll(':','.'),bucket:key[0],alias:key.slice(2),actor:r.actor,target:key==='A:original-cloud-backup'?'original-settings':r.target,operation:key==='A:original-cloud-backup'?'snapshot':r.methods[0],units:1}));
const input=()=>({decisionHash:'eccdb919d865327e3b5922231b253266e9084afe33305e12a32e64501efa39b2',history:{spent:53,limit:160},mapComplete:true,operations:fixed(),browserOperations:[]});
test('separate accounts admit fixed safety work while protecting21 cleanup plus2 unused',()=>{
 assert.equal(typeof simple.compileAuthoritySimplePlan,'function');
 const r=simple.compileAuthoritySimplePlan(input());
 assert.equal(r.mainReserved,155);assert.equal(r.mainSpent,53);assert.equal(r.uiSpent,0);assert.equal(r.combinedLimit,232);assert.equal(r.cleanupReserve,21);assert.equal(r.credentialRpcEligible,true);
 const p=input();p.operations.find(o=>o.alias==='original-cloud-backup').target='original-project';p.operations.find(o=>o.alias==='original-cloud-backup').operation='GET';assert.throws(()=>simple.compileAuthoritySimplePlan(p),/UNVERIFIED/);
});
test('missing or unknown cost never authorizes credential RPC or claims complete map',()=>{
 assert.equal(typeof simple.compileAuthoritySimplePlan,'function');const p=input();p.operations.pop();assert.equal(simple.compileAuthoritySimplePlan(p).credentialRpcEligible,false);
 p.operations=fixed();p.operations[0].units=null;assert.equal(simple.compileAuthoritySimplePlan(p).credentialRpcEligible,false);
 p.operations=fixed();p.history.spent=52;assert.throws(()=>simple.compileAuthoritySimplePlan(p),/UNVERIFIED/);
});

import {fixture as baseFixture,hash,compact,wrapped,clock} from './fixtures/read-authority/continuation-budget.mjs';
import {readFileSync,writeFileSync,openSync,closeSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
function fixture(){
 const s=baseFixture(),past=join(s.home,'stopped53.json'),drain=join(s.home,'drain.json'),approval=join(s.home,'approved232.json');
 s.put(past,compact({state:'stopped',spent:3,events:[1,2,3].map(n=>({time:clock-70000+n,outcome:'UNKNOWN'})),finished:true,rpc:{beganAt:null,complete:false},chargedUpperBoundMs:0}));
 s.put(drain,compact({stopAcknowledged:true,ordinaryScopeClosed:true,ownedScope:{state:'SETTLED'}}));
 s.put(approval,compact({source:'direct-human-approval',recordedAt:'2026-10-19',ownerAnswer:'同意232次方案，繼續執行（建議）',decisionSha256:input().decisionHash,importedSpent:53,mainLimit:160,uiLimit:72,combinedLimit:232,executionStarted:false}));
 const pin=p=>({path:p,sha256:hash(readFileSync(p))});
 s.cfg={path:s.path,epoch:s.cfg.epoch,binding:'8'.repeat(64),decisionHash:input().decisionHash,approval:pin(approval),history:{journal:pin(past),drain:pin(drain),files:[]},baseline:s.cfg.baseline,original:s.cfg.original,legacyBudget:s.cfg.legacyBudget,sources:['read-authority-simple-budget.py','read-authority-simple-plan.mjs','read-authority-simple-control.mjs','read-authority-continuation-budget.py','read-authority-continuation-plan.mjs','read-authority-trial-budget-plan.mjs'].map(n=>pin(resolve('scripts',n))),now:clock,ownerNonce:'f'.repeat(64)};
 s.journal=()=>JSON.parse(readFileSync(s.path+'.simple.json'));return s;
}
function session(s,patch={}){
 const fd=openSync(s.path+'.lock','r+'),child=spawn('python3',[resolve('scripts/read-authority-simple-budget.py')],{stdio:['pipe','pipe','pipe',fd],env:{...process.env,HOME:s.home}});let buffer='',ended=false;const rows=[],waiters=[];
 const push=x=>waiters.length?waiters.shift()(x):rows.push(x);
 child.stdout.on('data',v=>{buffer+=v;while(buffer.includes('\n')){const i=buffer.indexOf('\n');push(JSON.parse(buffer.slice(0,i)));buffer=buffer.slice(i+1);}});child.stderr.resume();child.on('close',()=>{ended=true;while(waiters.length)waiters.shift()({ok:false,code:'CLOSED'});});child.stdin.on('error',()=>{});
 const read=()=>rows.length?Promise.resolve(rows.shift()):ended?Promise.resolve({ok:false,code:'CLOSED'}):new Promise(r=>waiters.push(r));
 child.stdin.write(JSON.stringify({...s.cfg,...patch})+'\n');return {ready:read(),send:q=>{child.stdin.write(JSON.stringify(q)+'\n');return read();},close:async()=>{if(!ended){child.stdin.end();await new Promise(r=>child.once('close',r));}closeSync(fd);}};
}
const ui=(n,extra={})=>({id:'ui-'+n,key:'N:preparation',actor:'publisher',target:'original-settings',operation:'snapshot',units:1,preparation:true,...extra});
const good=r=>assert.equal(r.ok,true,JSON.stringify(r));
async function debit(h,operation,now=clock,lane='ui'){let r=await h.send({op:'wait',lane,operation,now});good(r);now+=r.waitMs;r=await h.send({op:'debit',lane,operation,now});good(r);return r;}
const settle=(h,id,success=true,now=clock)=>h.send({op:'settle',id,success,now});
test('durable browser debit preserves imported53 and fixes one midnight-capped window before IO',async()=>{
 const s=fixture(),h=session(s);try{const first=await h.ready;good(first);assert.equal(first.mainSpent,53);assert.equal(first.uiSpent,0);assert.equal(first.w0,null);
 good(await h.send({op:'wait',lane:'ui',operation:ui(1),now:clock}));assert.equal(s.journal().w0,null);
 const r=await debit(h,ui(1));assert.equal(r.mainSpent,53);assert.equal(r.uiSpent,1);assert.equal(r.combinedSpent,54);assert.equal(s.journal().pending,'ui-1');assert.equal(r.w0,clock);assert.equal(r.expiresAt,clock+21600000);assert.equal(s.journal().events[0].outcome,'UNKNOWN');good(await settle(h,'ui-1'));
 }finally{await h.close();}
 const again=session(s);try{assert.equal((await again.ready).ok,false);}finally{await again.close();}
});
test('single pending IO prevents a second debit and permanently closes ordinary scope',async()=>{const s=fixture(),h=session(s);try{good(await h.ready);await debit(h,ui(1));assert.equal((await h.send({op:'debit',lane:'ui',operation:ui(2),now:clock})).ok,false);assert.equal(s.journal().state,'stopped');assert.equal(s.journal().events.length,1);}finally{await h.close();}});
test('two charged read-only preflight retries keep UNKNOWN history; third failure stops without refund',async()=>{const s=fixture(),h=session(s);try{good(await h.ready);for(let n=1;n<=3;n++){await debit(h,ui(n));const r=await settle(h,'ui-'+n,false);good(r);assert.equal(r.uiSpent,n);assert.equal(r.state,n<3?'ready':'stopped');}assert.equal(s.journal().events.filter(e=>e.outcome==='UNKNOWN').length,3);}finally{await h.close();}});
test('preflight cannot silently consume the seventeenth preparation operation',async()=>{const s=fixture(),h=session(s);try{good(await h.ready);let now=clock;for(let n=1;n<=16;n++){const r=await debit(h,ui(n),now);now=r.lastAt;good(await settle(h,'ui-'+n,true,now));}assert.equal((await h.send({op:'debit',lane:'ui',operation:ui(17),now})).ok,false);assert.equal(s.journal().events.length,16);}finally{await h.close();}});
test('source or history drift stops before any debit and cannot reuse a new binding',async()=>{for(const key of ['journal','drain']){const s=fixture(),h=session(s);try{good(await h.ready);s.put(s.cfg.history[key].path,'{}');assert.equal((await h.send({op:'debit',lane:'ui',operation:ui(1),now:clock})).ok,false);assert.equal(s.journal().events.length,0);}finally{await h.close();}}});
test('expiry never renews window and cleanup stays independent of damaged ordinary journal',async()=>{const s=fixture(),h=session(s);try{good(await h.ready);await debit(h,ui(1));good(await settle(h,'ui-1'));assert.equal((await h.send({op:'debit',lane:'ui',operation:ui(2),now:clock+21600000})).ok,false);s.put(s.path+'.simple.json','{');good(await h.send({op:'cleanup-start',now:clock+21660000}));const op=fixed().find(o=>o.alias==='script-remove');const r=await debit(h,op,clock+21660000,'main');assert.equal(r.mainSpent,54);assert.equal(r.state,'stopped');good(await settle(h,op.id,true,clock+21660000));}finally{await h.close();}});

test('native fixed stages ground GCP settings without pretending Script API returns the project number',async()=>{
 const s=fixture(),h=session(s);try{good(await h.ready);const operations=fixed().filter(o=>simple.SIMPLE_STAGES.baseline.includes(o.bucket+':'+o.alias));const browser=[ui(1,{key:'A:original-cloud-backup',preparation:false})];
 good(await h.send({op:'stage-ready',stage:'baseline',operations,browserOperations:browser,futureCaps:Object.fromEntries(Object.entries(simple.SIMPLE_STAGES).filter(([k])=>k!=='baseline').map(([k,v])=>[k,v.length])),now:clock}));
 await debit(h,browser[0]);good(await settle(h,browser[0].id));good(await h.send({op:'ui-complete',key:'A:original-cloud-backup',now:clock}));assert.equal(s.journal().completed.includes('A:original-cloud-backup'),true);
 }finally{await h.close();}
});
test('original C/I recovery uses original durable debit exactly once while preserving stopped53 evidence',async()=>{
 const s=fixture(),old=readFileSync(s.cfg.history.journal.path),h=session(s);try{good(await h.ready);good(await h.send({op:'stop'}));good(await h.send({op:'cleanup-start',now:clock}));
 const op={id:'original-recovery',bucket:'C',alias:'restore-editor',actor:'publisher',target:'original-project',operation:'PUT',units:1};const r=await debit(h,op,clock,'main');assert.equal(r.mainSpent,54);assert.equal(s.get().spent,28);assert.deepEqual(s.get().preparation.cActions,['restore-editor']);good(await settle(h,op.id));assert.deepEqual(readFileSync(s.cfg.history.journal.path),old);
 }finally{await h.close();}
});
test('UI recovery requires its own protected main reservation before any native primitive',async()=>{
 const s=fixture(),h=session(s);try{good(await h.ready);good(await h.send({op:'stop'}));good(await h.send({op:'cleanup-start',now:clock}));const op=ui(1,{key:'I:restore-original-guard',operation:'click',preparation:false});assert.equal((await h.send({op:'debit',lane:'ui',operation:op,now:clock})).ok,false);assert.equal(s.journal().events.length,0);
 }finally{await h.close();}
});
test('a UI write failure never receives the preflight read retry exception',async()=>{
 const s=fixture(),h=session(s);try{good(await h.ready);const p=input(),op=ui(1,{key:'D:thin-gcp-link',target:'thin-settings',operation:'click',preparation:false});p.browserOperations=[op];good(await h.send({op:'plan-ready',plan:{operations:p.operations,browserOperations:p.browserOperations},now:clock}));for(const po of p.operations.filter(o=>o.bucket==='P')){await debit(h,po,clock,'main');good(await settle(h,po.id));}await debit(h,op);const r=await settle(h,op.id,false);good(r);assert.equal(r.state,'stopped');assert.equal(r.uiSpent,1);assert.equal(r.mainSpent,55);
 }finally{await h.close();}
});

const controlModule=await import('../scripts/read-authority-simple-control.mjs').catch(()=>({}));
function controlFixture(extra={}){const s=fixture();let time=clock;const {now:ignored,ownerNonce,...config}=s.cfg;const home=process.env.HOME;process.env.HOME=s.home;try{s.control=controlModule.createAuthoritySimpleControl({config,now:()=>time,pause:async ms=>{time+=ms;},guard:()=>{},assertStage:()=>{},...extra});}finally{process.env.HOME=home;}s.now=()=>time;return s;}
test('live holder durably charges each primitive before callback and drains a failed observation without reopening',async()=>{
 assert.equal(typeof controlModule.createAuthoritySimpleControl,'function');const s=controlFixture();assert.equal(existsSync(s.path+'.simple.json'),false);let calls=0;
 await s.control.withContinuation(async cap=>{
  await assert.rejects(cap.browserRead(async()=>{calls++;assert.equal(s.journal().pending,'ui-1');assert.equal(s.journal().events.length,1);throw Error('SAFE_READ_FAILED');},ui(1)),/READ_FAILED/);
  const r=await cap.browserRead(async admitted=>{calls++;assert.equal(admitted.uiSpent,2);assert.equal(s.journal().pending,'ui-2');return 'safe';},ui(2));assert.equal(r,'safe');
 });assert.equal(calls,2);assert.equal(s.journal().state,'stopped');const drain=await s.control.stopAndDrain();assert.equal(drain.stopAcknowledged,true);assert.equal(drain.ordinaryScopeClosed,true);assert.equal(drain.ownedScope.state,'SETTLED');await assert.rejects(s.control.withContinuation(()=>{}),/TRIAL_STOPPED/);
});
test('owner retains canonical lock until an outstanding IO callback actually settles',async()=>{
 assert.equal(typeof controlModule.createAuthoritySimpleControl,'function');const s=controlFixture();let release,entered;const wait=new Promise(r=>{entered=r;});const run=s.control.withContinuation(async cap=>{await cap.browserRead(async()=>{entered();return new Promise(r=>{release=r;});},ui(1));});await wait;
 let drained=false;const d=s.control.stopAndDrain().then(v=>{drained=true;return v;});await new Promise(r=>setTimeout(r,25));assert.equal(drained,false);release('returned');await assert.rejects(run,/TRIAL_STOPPED/);assert.equal((await d).ownedScope.state,'SETTLED');assert.equal(s.journal().events.length,1);
});
test('unawaited IO cannot release holder or authorize cleanup early',async()=>{
 assert.equal(typeof controlModule.createAuthoritySimpleControl,'function');const s=controlFixture();let returned=false,entered;const wait=new Promise(r=>{entered=r;});
 await assert.rejects(s.control.withContinuation(async cap=>{void cap.browserRead(async()=>{entered();await new Promise(r=>setTimeout(r,30));returned=true;},ui(1));await wait;}),/TRIAL_STOPPED/);
 assert.equal(returned,true);assert.equal((await s.control.stopAndDrain()).ownedScope.state,'SETTLED');
});
test('stage guard rejection and proxy descriptors cause zero remote callbacks',async()=>{
 assert.equal(typeof controlModule.createAuthoritySimpleControl,'function');for(const bad of ['guard','proxy']){const s=controlFixture(bad==='guard'?{assertStage:()=>{throw Error('NO_ACTUAL_MAP');}}:{});let calls=0;
 await assert.rejects(s.control.withContinuation(cap=>cap.browserRead(()=>{calls++;},bad==='proxy'?new Proxy(ui(1),{}):ui(1))),/TRIAL_STOPPED/);assert.equal(calls,0);assert.equal(s.journal().events.length,0);}
});

test('API mutation cannot precede publisher refresh and identity even when a full map is supplied',async()=>{const s=fixture(),h=session(s);try{good(await h.ready);good(await h.send({op:'plan-ready',plan:{operations:fixed(),browserOperations:[]},now:clock}));const op=fixed().find(o=>o.alias==='fixture-import');assert.equal((await h.send({op:'debit',lane:'main',operation:op,now:clock})).ok,false);assert.equal(s.journal().events.length,0);}finally{await h.close();}});
test('browser ordinary56 cannot borrow its cleanup16 even when main account has space',async()=>{const s=fixture(),h=session(s);try{good(await h.ready);const browser=Array.from({length:56},(_,i)=>ui(i+1,{key:'N:navigation',preparation:false}));good(await h.send({op:'plan-ready',plan:{operations:fixed(),browserOperations:browser},now:clock}));let now=clock;for(const op of browser){const r=await debit(h,op,now);now=r.lastAt;good(await settle(h,op.id,true,now));}const denied=await h.send({op:'debit',lane:'ui',operation:ui(57,{key:'N:navigation',preparation:false}),now});assert.equal(denied.ok,false);assert.equal(s.journal().events.length,56);}finally{await h.close();}});

async function readyRpc(s,h){
 const operations=fixed(),browser=operations.filter(o=>!['GET','POST','PUT','DELETE'].includes(o.operation)&&!['I','J'].includes(o.bucket)).map((o,i)=>ui(i+1,{key:o.bucket+':'+o.alias,actor:o.actor,target:o.target,operation:o.operation,preparation:false}));
 browser.push(...['before','after'].map((v,i)=>ui(80+i,{key:'N:thin-triggers-'+v,target:'thin-triggers',preparation:false})));
 good(await h.send({op:'plan-ready',plan:{operations,browserOperations:browser},now:clock}));let now=clock;
 const run=async o=>{const key=o.bucket+':'+o.alias,row=browser.find(v=>v.key===key);const r=await debit(h,row??o,now,row?'ui':'main');now=r.lastAt;good(await settle(h,(row??o).id,true,now));if(row)good(await h.send({op:'ui-complete',key,now}));};
 for(const bucket of ['P','A','B','D','E'])for(const o of operations.filter(o=>o.bucket===bucket))await run(o);
 for(const o of operations.filter(o=>o.alias.startsWith('wrapper-before.')))await run(o);
 const row=browser.find(o=>o.key==='N:thin-triggers-before'),r=await debit(h,row,now);now=r.lastAt;good(await settle(h,row.id,true,now));
 return {now,operation:operations.find(o=>o.bucket==='H'),operations,browser,run};
}
test('RPC requires full successful prechecks and a live credential beyond its360s nonrefundable charge',async()=>{
 for(const valid of [false,true]){const s=fixture(),h=session(s);try{good(await h.ready);const p=await readyRpc(s,h);const q={op:'rpc-begin',lane:'main',operation:p.operation,now:p.now,credentialExpiresAt:valid?clock+21600000:p.now+360000};const wait=await h.send({...q,op:'rpc-wait'});
 if(!valid){assert.equal(wait.ok,false);assert.equal(s.journal().chargedUpperBoundMs,0);continue;}good(wait);q.now+=wait.waitMs;const r=await h.send(q);good(r);assert.equal(r.chargedUpperBoundMs,360000);assert.equal(s.journal().pending,p.operation.id);good(await settle(h,p.operation.id,false,q.now));assert.equal(s.journal().state,'stopped');assert.equal(s.journal().chargedUpperBoundMs,360000);
 const term=p.operations.find(o=>o.alias==='terminal-1');const tr=await h.send({op:'terminal-debit',lane:'main',operation:term,now:q.now});good(tr);good(await settle(h,term.id,true,q.now));assert.equal(s.journal().state,'stopped');
 }finally{await h.close();}}
});

import {setup as driverBase} from './fixtures/read-authority/standalone-driver.mjs';
import * as drivers from '../scripts/read-authority-continuation-driver.mjs';
async function driverRun(response,failTransport=false){
 assert.equal(typeof drivers.createAuthoritySimpleDriver,'function');const s=controlFixture(),base=driverBase(),operations=fixed(),browser=operations.filter(o=>!['GET','POST','PUT','DELETE'].includes(o.operation)&&!['I','J'].includes(o.bucket)).map((o,i)=>ui(i+1,{key:o.bucket+':'+o.alias,actor:o.actor,target:o.target,operation:o.operation,preparation:false}));browser.push(...['before','after'].map((v,i)=>ui(80+i,{key:'N:thin-triggers-'+v,target:'thin-triggers',preparation:false})));let dispatched=0,terminal=0;
 const result=s.control.withContinuation(async cap=>{
  await cap.completePlan({operations,browserOperations:browser});
  for(const bucket of ['P','A','B','D','E'])for(const op of operations.filter(o=>o.bucket===bucket)){const row=browser.find(v=>v.key===op.bucket+':'+op.alias);if(row){await cap.browserRead(()=>{},row);await cap.completeBrowserOperation(row.key);}else await cap.externalRead(()=>{},op);}
  const expected={...base.options.expected,trialEpoch:s.cfg.epoch};
  return drivers.createAuthoritySimpleDriver({...base.options,decisionHash:input().decisionHash,continuationBinding:s.cfg.binding,expected,expiresAt:clock+21600000,now:s.now,operations,browserOperations:browser,
   credential:()=>({...base.options.credential(),expiresAt:clock+21600000}),publisherCredential:()=>({...base.options.publisherCredential(),expiresAt:clock+21600000}),
   readRelease:async rc=>{await cap.browserRead(()=>{},browser.find(o=>o.key==='N:thin-triggers-'+(rc.phase==='wrapper-before'?'before':'after')));for(const alias of Object.keys(STAGED_RESUME_POLICY.operations).filter(k=>k.startsWith('F:wrapper-before.')).map(k=>k.slice(17)))await rc.externalRead(()=>{},alias);return {...base.release(),...expected,observedAt:s.now()};},
   readIdentity:async(actor,token,context)=>({source:'google-userinfo-same-token',actor,phase:context.phase,accountHash:expected[actor+'Hash'],observedAt:s.now(),credentialExpiresAt:clock+21600000}),
   signRequest:()=>({...base.options.signRequest(),timestamp:s.now()}),transport:async()=>{dispatched++;assert.equal(s.journal().chargedUpperBoundMs,360000);if(failTransport)throw Error('UNKNOWN_TRANSPORT');return response;},
   readTerminal:async()=>{terminal++;return {terminalKnown:true};}
  }).run(cap);
 });return {s,result,counts:()=>({dispatched,terminal})};
}
test('existing full safety driver uses separate native debits and accepts only complete compatible readback',async()=>{const run=await driverRun({done:true,response:{result:{compatible:true}}});assert.deepEqual(await run.result,{compatible:true});assert.equal(run.counts().dispatched,1);assert.equal(run.s.journal().chargedUpperBoundMs,360000);assert.equal(run.s.journal().rpc.complete,true);assert.equal(run.s.journal().events.filter(e=>e.key.startsWith('F:')).length,32);});
test('RPC transport UNKNOWN permanently stops ordinary reads but retains bounded terminal verification',async()=>{const run=await driverRun(null,true);await assert.rejects(run.result,/TRIAL_STOPPED/);assert.deepEqual(run.counts(),{dispatched:1,terminal:1});assert.equal(run.s.journal().rpc.complete,false);assert.equal(run.s.journal().events.filter(e=>e.key.startsWith('F:wrapper-after')).length,0);assert.equal(run.s.journal().chargedUpperBoundMs,360000);});

test('real-owner cleanup survives expiry and mirror damage with dual main/UI reservation and no repeated native alias',async()=>{
 const s=controlFixture();await s.control.withContinuation(async cap=>{await cap.browserRead(()=>{},ui(1));await cap.completeRecoveryPlan([ui(2,{key:'I:restore-original-guard',operation:'click',preparation:false})]);});s.put(s.path+'.simple.json','{');let calls=0;
 await s.control.withCleanup(async cap=>{const op=fixed().find(o=>o.alias==='restore-original-guard');await cap.reserveNativeCleanup(op);await cap.browserRead(()=>{calls++;},ui(2,{key:'I:restore-original-guard',operation:'click',preparation:false}));});assert.equal(calls,1);assert.equal(s.get().spent,28);assert.deepEqual(s.get().preparation.iActions,['restore-original-guard']);
 await assert.rejects(s.control.withCleanup(cap=>cap.reserveNativeCleanup(fixed().find(o=>o.alias==='restore-original-guard'))),/TRIAL_STOPPED/);
});
test('literal JS and Python fixed policies agree on the native GCP source and every safety operation',async()=>{
 const child=spawn('python3',[resolve('scripts/read-authority-simple-budget.py'),'--policy']);let text='';child.stdout.on('data',v=>{text+=v;});await new Promise(r=>child.once('close',r));const p=JSON.parse(text);delete p['C:restore-editor'];delete p['C:read-restored-editor'];assert.deepEqual(p,simple.SIMPLE_RULES);
});

test('unknown native cleanup write cannot be retried under a different primitive ID or new cleanup scope',async()=>{
 const s=controlFixture(),op=fixed().find(o=>o.alias==='restore-original-guard'),rows=[ui(2,{key:'I:restore-original-guard',operation:'click',preparation:false}),ui(3,{key:'I:restore-original-guard',operation:'click',preparation:false})];
 await s.control.withContinuation(async cap=>{const plan={operations:fixed(),browserOperations:rows};await cap.completePlan(plan);});let calls=0;
 await assert.rejects(s.control.withCleanup(async cap=>{await cap.reserveNativeCleanup(op);await cap.browserRead(()=>{calls++;throw Error('WRITE_UNKNOWN');},rows[0]);}),/TRIAL_STOPPED/);
 await assert.rejects(s.control.withCleanup(cap=>cap.browserRead(()=>{calls++;},rows[1])),/TRIAL_STOPPED/);assert.equal(calls,1);assert.equal(s.get().spent,28);
});
test('actual owner exposes the reserved original C2 path without adding C into the ordinary map',async()=>{
 const s=controlFixture();await s.control.withContinuation(cap=>cap.browserRead(()=>{},ui(1)));let calls=0;
 await s.control.withCleanup(cap=>cap.externalRead(()=>{calls++;},{id:'original-C-restore',bucket:'C',alias:'restore-editor',actor:'publisher',target:'original-project',operation:'PUT',units:1}));
 assert.equal(calls,1);assert.equal(s.get().spent,28);assert.deepEqual(s.get().preparation.cActions,['restore-editor']);
 const p=input();p.operations.push({id:'extra-C',bucket:'C',alias:'restore-editor',actor:'publisher',target:'original-project',operation:'PUT',units:1});assert.throws(()=>simple.compileAuthoritySimplePlan(p),/UNVERIFIED/);
});

test('rejected mutation callbacks remain UNKNOWN failures even with undefined null false or zero reasons',async()=>{
 for(const reason of [undefined,null,false,0]){const s=controlFixture(),row=ui(1,{key:'D:thin-gcp-link',target:'thin-settings',operation:'submit',preparation:false});await assert.rejects(s.control.withContinuation(async cap=>{await cap.completePlan({operations:fixed(),browserOperations:[row]});for(const po of fixed().filter(o=>o.bucket==='P'))await cap.externalRead(()=>{},po);await cap.browserRead(()=>Promise.reject(reason),row);}),/TRIAL_STOPPED/);const e=s.journal().events.at(-1);assert.equal(e.success,false);assert.equal(e.outcome,'UNKNOWN');assert.equal(s.journal().state,'stopped');}
});

test('incomplete or malformed RPC replies cannot run ordinary postchecks before terminal verification',async()=>{
 for(const response of [{done:false},null,{notAnOperation:true}]){const run=await driverRun(response);await assert.rejects(run.result,/TRIAL_STOPPED/);assert.equal(run.counts().dispatched,1);assert.equal(run.counts().terminal,1);assert.equal(run.s.journal().events.filter(e=>e.key.startsWith('F:wrapper-after')).length,0);assert.equal(run.s.journal().rpc.complete,false);}
});

import {symlinkSync} from 'node:fs';
test('any visible STOP marker including a dangling symlink vetoes ordinary IO and remains intact for recovery',async()=>{
 const s=controlFixture();let calls=0;await assert.rejects(s.control.withContinuation(async cap=>{await cap.browserRead(()=>{calls++;},ui(1));symlinkSync(join(s.home,'missing-stop-target'),s.path+'.simple-stop.json');await cap.browserRead(()=>{calls++;},ui(2));}),/TRIAL_STOPPED/);assert.equal(calls,1);assert.equal((await s.control.stopAndDrain()).stopAcknowledged,true);
});
