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
