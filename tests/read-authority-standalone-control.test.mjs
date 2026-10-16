import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {fixture,clock} from './fixtures/read-authority/standalone-budget.mjs';
import {operation,research} from './fixtures/read-authority/continuation-budget.mjs';
import * as mod from '../scripts/read-authority-continuation-control.mjs';
function setup(){
 const s=fixture(),oldHome=process.env.HOME;process.env.HOME=s.home;
 const {now,ownerNonce,...config}=s.cfg;let time=clock,control;const pauses=[];
 try{
   assert.equal(typeof mod.createAuthorityStandaloneControl,'function');
   control=mod.createAuthorityStandaloneControl({config,now:()=>time,pause:async ms=>{pauses.push(ms);time+=ms;},guard:()=>{}});
 }finally{if(oldHome===undefined)delete process.env.HOME;else process.env.HOME=oldHome;}
 return {...s,control,config,pauses,setTime:v=>{time=v;}};
}
function lock(path){
 const r=spawnSync('python3',['-c',"import fcntl,sys\nf=open(sys.argv[1],'r+')\ntry:fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB);print('FREE')\nexcept BlockingIOError:print('HELD')",path+'.lock'],{encoding:'utf8',timeout:3000});
 assert.equal(r.status,0);return r.stdout.trim();
}
test('standalone constructor is inert and callback follows cumulative32 durable UNKNOWN under original flock',async()=>{
 const s=setup(),old=readFileSync(s.path),prior=readFileSync(s.path+'.continuation.json');
 assert.equal(existsSync(s.path+'.standalone.json'),false);
 const value=await s.control.withContinuation(async cap=>{
   assert.equal((await cap.inspect()).spent,31);
   return cap.externalRead(()=>{
     assert.equal(s.journal().spent,1);assert.equal(s.journal().events[0].outcome,'UNKNOWN');
     assert.equal(lock(s.path),'HELD');return 'ACTUAL_CALLBACK';
   },operation('P:caller-bind'));
 });
 assert.equal(value,'ACTUAL_CALLBACK');assert.equal(s.journal().finished,true);
 assert.deepEqual(readFileSync(s.path),old);assert.deepEqual(readFileSync(s.path+'.continuation.json'),prior);
 assert.equal(lock(s.path),'FREE');
});
test('standalone failure is not refunded and original independent cleanup debits same cumulative budget',async()=>{
 const s=setup();let forbidden=0;
 await assert.rejects(s.control.withContinuation(async cap=>{
   await assert.rejects(cap.externalRead(()=>{throw Error('TRANSPORT_UNKNOWN');},operation('P:caller-bind')),/TRIAL_STOPPED/);
   await assert.rejects(cap.externalRead(()=>{forbidden++;},operation('P:publisher-bind')),/TRIAL_STOPPED/);
   await cap.cleanup('close-deployment',()=>{});assert.equal((await cap.inspect()).spent,33);
 }),/TRIAL_STOPPED/);
 assert.equal(forbidden,0);assert.equal(s.get().spent,28);assert.equal(s.journal().spent,1);
 assert.deepEqual(s.get().preparation.iActions,['close-deployment']);
});
test('standalone rolling minute includes prior continuation and diagnostic reads',async()=>{
 const s=setup();
 await s.control.withContinuation(async cap=>{
   for(const name of ['caller-bind','publisher-bind'])await cap.externalRead(()=>{},operation('P:'+name));
   for(let n=1;n<=5;n++)await cap.externalRead(()=>{},research(n));
   assert.equal((await cap.inspect()).spent,38);
 });
 assert.deepEqual(s.pauses,[51000]);
});
test('standalone owner stop drains entered IO before releasing original flock and leaves old STOP bytes intact',async()=>{
 const s=setup(),oldStop=readFileSync(s.path+'.continuation-stop.json');let enter,release,drained=false;
 const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});
 const scope=s.control.withContinuation(cap=>cap.externalRead(async()=>{enter();await gate;},operation('P:caller-bind')));
 void scope.catch(()=>{});await entered;
 const drain=s.control.stopAndDrain().then(value=>{drained=true;return value;});
 for(let n=0;n<100&&!existsSync(s.path+'.standalone-stop.json');n++)await delay(10);
 assert.equal(existsSync(s.path+'.standalone-stop.json'),true);assert.equal(drained,false);assert.equal(lock(s.path),'HELD');
 release();await assert.rejects(scope,/TRIAL_STOPPED/);const receipt=await drain;
 assert.equal(receipt.ordinaryScopeClosed,true);assert.equal(receipt.remoteExecutionSettled,false);
 assert.equal(lock(s.path),'FREE');assert.deepEqual(readFileSync(s.path+'.continuation-stop.json'),oldStop);
});
test('standalone cannot restart ordinary IO through another controller after its single durable claim',async()=>{
 const s=setup();await s.control.withContinuation(async()=>{});
 const home=process.env.HOME;process.env.HOME=s.home;let second;
 try{second=mod.createAuthorityStandaloneControl({config:s.config,now:()=>clock,guard:()=>{}});}finally{if(home===undefined)delete process.env.HOME;else process.env.HOME=home;}
 let entered=0;await assert.rejects(second.withContinuation(async()=>{entered++;}),/TRIAL_STOPPED/);assert.equal(entered,0);
});
test('standalone rejects old decision or missing linked history before startup',()=>{
 const s=setup();
 for(const config of [{...s.config,decisionHash:s.cfg.original.decisionHash},Object.fromEntries(Object.entries(s.config).filter(([k])=>k!=='history'))])
   assert.throws(()=>mod.createAuthorityStandaloneControl({config,guard:()=>{}}),/TRIAL_STOPPED/);
 assert.equal(existsSync(s.path+'.standalone.json'),false);
});

import {successorFixture} from './fixtures/read-authority/standalone-budget.mjs';
async function closedControl(){
 const s=setup();await assert.rejects(s.control.withContinuation(async cap=>{
  await cap.externalRead(()=>{}, {...operation('P:caller-bind'),id:'preflight-caller-bind'});
  await cap.externalRead(()=>{throw Error('PRIVATE_API_ERROR');},{...operation('P:publisher-bind'),id:'preflight-publisher-bind'});
 }),/TRIAL_STOPPED/);
 successorFixture(s);const home=process.env.HOME;process.env.HOME=s.home;const {now,ownerNonce,...config}=s.cfg;
 let handoff,successorTime=clock+1;const create=(extra={})=>{const prev=process.env.HOME;process.env.HOME=s.home;try{return mod.createAuthorityStandaloneControl({config,predecessorHandoff:Object.hasOwn(extra,'predecessorHandoff')?extra.predecessorHandoff:(handoff??=mod.createAuthorityClosedPreflightHandoff({current:{control:s.control}})),now:()=>successorTime,pause:async ms=>{successorTime+=ms;},guard:()=>{},...extra});}finally{if(prev===undefined)delete process.env.HOME;else process.env.HOME=prev;}};
 if(home===undefined)delete process.env.HOME;else process.env.HOME=home;
 return {...s,create};
}
test('closed preflight requires captured actual owner and shares its original cleanup lane',async()=>{
 const s=await closedControl();assert.throws(()=>s.create({predecessorOwner:{ordinaryScopeClosed:true}}),/TRIAL_STOPPED/);
 const successor=s.create();let enter,release;const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});
 const run=successor.withContinuation(async cap=>{assert.equal((await cap.inspect()).spent,33);return cap.externalRead(async()=>{enter();await gate;},operation('P:publisher-bind'));});
 await entered;assert.equal(lock(s.path),'HELD');await assert.rejects(s.control.withOriginalCleanup(()=>{}),/TRIAL_STOPPED/);
 assert.throws(()=>s.create(),/TRIAL_STOPPED/);
 release();await run;assert.equal(lock(s.path),'FREE');assert.equal(s.successorJournal().spent,1);
});
for(const fault of ['api-rejection','post-return-guard'])test('closed preflight preserves safe '+fault+' stage with one debit and drained holder',async()=>{
 const s=await closedControl(),stages=[];let drift=false;
 const successor=s.create({guard:()=>{if(drift)throw Error('PRIVATE_TOKEN_MUST_NEVER_ESCAPE');},onReadStage:v=>{stages.push(v);}});
 await assert.rejects(successor.withContinuation(cap=>cap.externalRead(()=>{if(fault==='api-rejection')throw Error('PRIVATE_TOKEN_MUST_NEVER_ESCAPE');drift=true;return 'value';},operation('P:publisher-bind'))),/TRIAL_STOPPED/);
 assert.equal(s.successorJournal().spent,1);assert.equal(lock(s.path),'FREE');assert.equal((await successor.stopAndDrain()).ordinaryScopeClosed,true);
 assert.deepEqual(stages.map(v=>v.stage),fault==='api-rejection'?['entered','api-rejected']:['entered','api-returned','post-return-guard-rejected']);
 assert.equal(JSON.stringify(stages).includes('PRIVATE_TOKEN'),false);
});

test('one-way predecessor handoff retires stale legacy J references before successor entry',async()=>{
 const s=await closedControl();assert.equal(typeof mod.createAuthorityClosedPreflightHandoff,'function');
 const slot={current:{control:s.control}},handoff=mod.createAuthorityClosedPreflightHandoff(slot),staleJ=handoff.legacy.withScriptCleanup;
 assert.equal(slot.current,null);assert.equal(handoff.withScriptCleanup,undefined);
 const successor=s.create({predecessorHandoff:handoff});
 let entered=0;await assert.rejects(staleJ(cap=>cap.cleanup('script-remove',()=>{entered++;})),/TRIAL_STOPPED/);assert.equal(entered,0);
 await successor.withContinuation(cap=>cap.externalRead(()=>{},operation('P:publisher-bind')));
 await successor.withScriptCleanup(async cap=>{await cap.cleanup('script-remove',()=>{entered++;});await cap.cleanup('script-verify',()=>{entered++;});});
 const old=readFileSync(s.path+'.standalone.json');
 await assert.rejects(staleJ(cap=>cap.cleanup('script-remove',()=>{entered++;})),/TRIAL_STOPPED/);assert.equal(entered,2);assert.deepEqual(readFileSync(s.path+'.standalone.json'),old);
 await successor.withOriginalCleanup(async()=>{assert.equal((await successor.stopAndDrain()).ordinaryScopeClosed,true);});
});

test('handoff refuses raw owners, fabricated capsules, duplicate moves and transfer during active legacy lane',async()=>{
 const s=await closedControl(),slot={current:{control:s.control}},handoff=mod.createAuthorityClosedPreflightHandoff(slot);
 assert.throws(()=>mod.createAuthorityClosedPreflightHandoff({current:{control:s.control}}),/TRIAL_STOPPED/);
 assert.throws(()=>s.create({predecessorOwner:s.control,predecessorHandoff:handoff}),/TRIAL_STOPPED/);
 assert.throws(()=>s.create({predecessorHandoff:Object.freeze({legacy:handoff.legacy})}),/TRIAL_STOPPED/);
 let entered,release;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 const work=handoff.legacy.withOriginalCleanup(async()=>{entered();await gate;});await ready;
 assert.throws(()=>s.create({predecessorHandoff:handoff}),/TRIAL_STOPPED/);release();await work;
 const successor=s.create({predecessorHandoff:handoff});await successor.withContinuation(async()=>{});
 assert.throws(()=>s.create({predecessorHandoff:handoff}),/TRIAL_STOPPED/);
});
