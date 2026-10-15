import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {readFileSync,existsSync,writeFileSync,unlinkSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {fixture,operation,research,clock} from './fixtures/read-authority/continuation-budget.mjs';
import {BOUNDED_CONTINUATION_POLICY as policy} from '../scripts/read-authority-continuation-plan.mjs';
const mod=await import('../scripts/read-authority-continuation-control.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
function setup(){
 const s=fixture(),home=process.env.HOME;process.env.HOME=s.home;
 let time=clock,guards=0;const pauses=[];
 const {now,ownerNonce,...config}=s.cfg;
 assert.equal(typeof mod.createAuthorityContinuationControl,'function');
 let control;
 try{control=mod.createAuthorityContinuationControl({config,now:()=>time,pause:async ms=>{pauses.push(ms);time+=ms;},guard:()=>{guards++;}});}finally{if(home===undefined)delete process.env.HOME;else process.env.HOME=home;}
 return {...s,control,pauses,setTime:v=>{time=v;},guards:()=>guards};
}
function lock(path){const r=cp.spawnSync('python3',['-c',"import fcntl,sys\nf=open(sys.argv[1],'r+')\ntry:fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB);print('FREE')\nexcept BlockingIOError:print('HELD')",path+'.lock'],{encoding:'utf8',timeout:3000});assert.equal(r.status,0);return r.stdout.trim();}
test('construction is inert; real IO follows durable UNKNOWN and holds original flock',async()=>{
 const s=setup(),before=readFileSync(s.path);assert.equal(existsSync(s.path+'.continuation.json'),false);let calls=0;
 const result=await s.control.withContinuation(async cap=>{
  const initial=await cap.inspect();assert.equal(initial.spent,27);assert.equal(initial.chargedUpperBoundMs,0);
  assert.equal(cap.identity.epoch,s.cfg.epoch);assert.equal(cap.identity.binding,s.cfg.binding);assert.equal(cap.identity.expiresAt,s.cfg.expiresAt);assert.equal(Object.isFrozen(cap.identity),true);
  return cap.externalRead(()=>{calls++;assert.equal(s.journal().events[0].outcome,'UNKNOWN');assert.equal(s.journal().spent,1);assert.equal(lock(s.path),'HELD');return 'VALUE';},operation('P:caller-bind'));
 });
 assert.equal(result,'VALUE');assert.equal(calls,1);assert.deepEqual(readFileSync(s.path),before);assert.equal(s.journal().finished,true);assert.equal(lock(s.path),'FREE');assert.ok(s.guards()>3);
 await assert.rejects(s.control.withContinuation(async()=>{}),/TRIAL_STOPPED/);
 const drained=await s.control.stopAndDrain();assert.equal(drained.ownedScope.state,'SETTLED');assert.equal(drained.ownedScope.serial,1);assert.equal(drained.stopAcknowledged,true);
});
test('failed IO stays charged, closes ordinary admission and permits original C/I once',async()=>{
 const s=setup();let forbidden=0;
 await assert.rejects(s.control.withContinuation(async cap=>{
  await assert.rejects(cap.externalRead(()=>{throw Error('PRIVATE_VALUE');},operation('P:caller-bind')),/^Error: TRIAL_STOPPED$/);
  await assert.rejects(cap.externalRead(()=>{forbidden++;},operation('P:publisher-bind')),/TRIAL_STOPPED/);
  await cap.restoreOriginalEditor('restore-editor',()=>{});await cap.restoreOriginalEditor('read-restored-editor',()=>{});await cap.cleanup('close-deployment',()=>{});
 }),/TRIAL_STOPPED/);
 assert.equal(forbidden,0);assert.equal(s.journal().spent,1);assert.equal(s.get().spent,30);assert.deepEqual(s.get().preparation.cActions,['restore-editor','read-restored-editor']);
});
test('union rolling minute waits before original cleanup and keeps all charges',async()=>{
 const s=setup();await assert.rejects(s.control.withContinuation(async cap=>{
  for(const name of ['caller-bind','publisher-bind'])await cap.externalRead(()=>{},operation('P:'+name));
  for(let n=1;n<=8;n++)await cap.externalRead(()=>{},research(n));
  await cap.cleanup('close-deployment',()=>{});
 }),/TRIAL_STOPPED/);assert.deepEqual(s.pauses,[60000]);assert.equal(s.journal().spent,10);assert.equal(s.get().spent,28);
});
test('captured stop waits for entered IO and preserves old markers',async()=>{
 const s=setup();let enter,release,settled=false;const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});
 const scope=s.control.withContinuation(cap=>cap.externalRead(async()=>{enter();await gate;},operation('P:caller-bind')));void scope.catch(()=>{});await entered;
 const drain=s.control.stopAndDrain().then(v=>{settled=true;return v;});
 for(let n=0;n<100&&!existsSync(s.path+'.continuation-stop.json');n++)await delay(10);
 assert.equal(existsSync(s.path+'.continuation-stop.json'),true);assert.equal(settled,false);assert.equal(lock(s.path),'HELD');release();
 await assert.rejects(scope,/TRIAL_STOPPED/);const receipt=await drain;assert.equal(receipt.stopAcknowledged,true);assert.equal(receipt.ownedScope.state,'SETTLED');assert.equal(receipt.remoteExecutionSettled,false);assert.equal(lock(s.path),'FREE');
 assert.equal(existsSync(s.path+'.preparation-stop.json'),true);assert.equal(existsSync(s.path+'.preparation-owner-stop.json'),true);
});
for(const failure of ['EOF','SIGKILL'])test('parent holds lock after '+failure+' until unawaited entered IO settles',async()=>{
 const s=setup(),spawn=cp.spawn;let child,enter,release,settled=false;
 const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});let scope;
 try{
  cp.spawn=(...args)=>{const c=spawn(...args);if(args[1]?.some(v=>String(v).endsWith('/read-authority-continuation-budget.py'))&&args[1].includes('--inherited-lock'))child=c;return c;};syncBuiltinESMExports();
  scope=s.control.withContinuation(async cap=>{void cap.externalRead(async()=>{enter();await gate;},operation('P:caller-bind'));await entered;});void scope.then(()=>{settled=true;},()=>{settled=true;});await entered;
  const closed=new Promise(r=>child.once('close',r));if(failure==='EOF')child.stdin.end();else child.kill('SIGKILL');await closed;
  assert.equal(lock(s.path),'HELD');assert.equal(settled,false);release();await assert.rejects(scope,/TRIAL_STOPPED/);assert.equal(lock(s.path),'FREE');
 }finally{release?.();await scope?.catch(()=>{});cp.spawn=spawn;syncBuiltinESMExports();}
});
test('source guard change prevents callback even after durable debit',async()=>{
 const s=fixture(),home=process.env.HOME;process.env.HOME=s.home;let checks=0,io=0;const {now,ownerNonce,...config}=s.cfg;
 let control;try{control=mod.createAuthorityContinuationControl({config,now:()=>clock,pause:async()=>{},guard:()=>{if(existsSync(s.path+'.continuation.json')&&s.journal().spent>0)throw Error('DRIFT');checks++;}});}finally{if(home===undefined)delete process.env.HOME;else process.env.HOME=home;}
 await assert.rejects(control.withContinuation(cap=>cap.externalRead(()=>{io++;},operation('P:caller-bind'))),/^Error: TRIAL_STOPPED$/);
 assert.equal(io,0);assert.equal(s.journal().spent,1);assert.ok(checks>0);assert.equal(lock(s.path),'FREE');
});
test('typed IO descriptor is snapshotted before asynchronous wait',async()=>{
 const s=setup(),descriptor=operation('P:caller-bind');let actual;
 await s.control.withContinuation(async cap=>{const p=cap.externalRead(()=>{actual=s.journal().events[0].operation.alias;},descriptor);descriptor.alias='publisher-bind';await p;});assert.equal(actual,'caller-bind');
});
test('accessors cannot run while accepting config or operation descriptors',async()=>{
 let reads=0;assert.throws(()=>mod.createAuthorityContinuationControl({get config(){reads++;return {};}}),/TRIAL_STOPPED/);assert.equal(reads,0);
 const s=setup();await assert.rejects(s.control.withContinuation(cap=>cap.externalRead(()=>{},Object.defineProperty({},'id',{enumerable:true,get(){reads++;return 'hidden';}}))),/TRIAL_STOPPED/);assert.equal(reads,0);
});
test('second original owner entry bridges durable new veto before forwarding old stop',async()=>{
 const s=setup();let oldStops=0;
 const bridge=s.control.bridgeOriginalStopControl({requestStop:async()=>{assert.equal(existsSync(s.path+'.continuation-stop.json'),true);oldStops++;return {stopRequested:true};},stopAndDrain:async()=>({stopAcknowledged:true})});
 await assert.rejects(s.control.withContinuation(async cap=>{await cap.externalRead(()=>{},operation('P:caller-bind'));await bridge.requestStop();await cap.externalRead(()=>{},operation('P:publisher-bind'));}),/TRIAL_STOPPED/);assert.equal(oldStops,1);assert.equal(s.journal().spent,1);
});
const fullMap=()=>Object.entries(policy.operations).map(([key,rule])=>{const i=key.indexOf(':');return {id:key.replaceAll(':','.'),bucket:key.slice(0,i),alias:key.slice(i+1),actor:rule.actor,target:rule.target,operation:rule.methods[0],units:1};});
async function prepareRpc(cap,map){
 await cap.completePlan(map);
 for(const bucket of ['P','A','B','C','D','E','F','G'])for(const op of map.filter(v=>v.bucket===bucket&&!v.alias.startsWith('wrapper-after.')&&!['restore-editor','read-restored-editor'].includes(v.alias)))await cap.externalRead(()=>{},op);
 await cap.restoreOriginalEditor('restore-editor',()=>{});await cap.restoreOriginalEditor('read-restored-editor',()=>{});
}
test('sole RPC is precharged360000, requires all postchecks and never reports measured native runtime',async()=>{
 const s=setup(),map=fullMap();let calls=0;
 await s.control.withContinuation(async cap=>{
  await prepareRpc(cap,map);
  const response=await cap.dispatchCompatibility({operation:map.find(v=>v.bucket==='H'),credentialExpiresAt:s.cfg.expiresAt},startedAt=>{
   calls++;assert.equal(s.journal().chargedUpperBoundMs,360000);assert.equal(s.journal().rpc.beganAt,startedAt);assert.equal(s.journal().events.at(-1).outcome,'UNKNOWN');return {done:true,response:{result:{compatible:true}}};
  });assert.equal(response.response.result.compatible,true);
  for(const op of map.filter(v=>['F','G'].includes(v.bucket)&&v.alias.startsWith('wrapper-after.')))await cap.externalRead(()=>{},op);
  const result=await cap.finishCompatibility();assert.equal(result.rpc.complete,true);assert.equal(result.nativeMs,undefined);assert.equal(result.quotaAccepted,undefined);
 });assert.equal(calls,1);assert.equal(s.journal().rpc.complete,true);assert.equal(s.journal().chargedUpperBoundMs,360000);
});
test('callback return cannot finish a pending RPC without postchecks',async()=>{
 const s=setup(),map=fullMap();let calls=0;
 await assert.rejects(s.control.withContinuation(async cap=>{
  await prepareRpc(cap,map);await cap.dispatchCompatibility({operation:map.find(v=>v.bucket==='H'),credentialExpiresAt:s.cfg.expiresAt},()=>{calls++;return {done:false};});
 }),/TRIAL_STOPPED/);assert.equal(calls,1);assert.equal(s.journal().rpc.complete,false);assert.equal(s.journal().chargedUpperBoundMs,360000);
});
test('false or asynchronous source guard cannot authorize a claim',async()=>{
 for(const guard of [()=>false,async()=>{}]){
  const s=fixture(),home=process.env.HOME;process.env.HOME=s.home;const {now,ownerNonce,...config}=s.cfg;let control;
  try{control=mod.createAuthorityContinuationControl({config,now:()=>clock,guard});}finally{if(home===undefined)delete process.env.HOME;else process.env.HOME=home;}
  await assert.rejects(control.withContinuation(async()=>{}),/TRIAL_STOPPED/);assert.equal(existsSync(s.path+'.continuation-claim.json'),false);
 }
});
test('partial stop bytes remain negative while the actual drained owner releases its lock',async()=>{
 const s=setup(),marker=s.path+'.continuation-stop.json';
 await assert.rejects(s.control.withContinuation(async cap=>{await cap.externalRead(()=>{},operation('P:caller-bind'));writeFileSync(marker,'',{mode:0o600});}),/TRIAL_STOPPED/);
 const drain=s.control.stopAndDrain(),watchdog=new AbortController();let result;
 try{result=await Promise.race([drain,delay(5000,null,{signal:watchdog.signal})]);}
 finally{watchdog.abort();if(!result){unlinkSync(marker);await s.control.requestStop();await drain;}}
 assert.notEqual(result,null,'captured owner must settle after real IO/child drain');
 assert.equal(result.stopAcknowledged,false);assert.equal(result.ordinaryScopeClosed,true);assert.equal(result.ownedScope.state,'SETTLED');assert.equal(lock(s.path),'FREE');assert.equal(readFileSync(marker).length,0);
 await assert.rejects(s.control.withContinuation(async()=>{}),/TRIAL_STOPPED/);
});
