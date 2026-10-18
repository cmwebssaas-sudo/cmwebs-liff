// One original-lock owner for the entire bounded continuation. Construction is
// inert; trusted orchestration must pin sources/recovery before entering W0.
import {spawn} from 'node:child_process';
import {constants,lstatSync,openSync,fstatSync,closeSync} from 'node:fs';
import {dirname,isAbsolute} from 'node:path';
import {homedir,userInfo} from 'node:os';
import {types} from 'node:util';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {BOUNDED_CONTINUATION_DECISION_HASH,STANDALONE_TRIAL_DECISION_HASH,STAGED_RESUME_DECISION_HASH,READONLY_RECOVERY_DECISION_HASH,READONLY_RECOVERY_WINDOW,CONNECTION_REPAIR_WINDOW} from './read-authority-continuation-plan.mjs';
const stop=()=>{throw Error('TRIAL_STOPPED');},integer=Number.isSafeInteger;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
function data(value){
 let count=0;const seen=new Set();
 function copy(v,depth){
  if(++count>3000||depth>12)stop();
  if(v===null||typeof v==='string'||typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v)))return v;
  if(typeof v!=='object'||types.isProxy(v)||seen.has(v)||(!Array.isArray(v)&&![Object.prototype,null].includes(Object.getPrototypeOf(v))))stop();
  seen.add(v);const ds=Object.getOwnPropertyDescriptors(v),out=Array.isArray(v)?[]:Object.create(null);
  for(const key of Reflect.ownKeys(ds)){
   if(Array.isArray(v)&&key==='length')continue;
   const d=ds[key];if(typeof key!=='string'||!d.enumerable||!Object.hasOwn(d,'value')||(Array.isArray(v)&&!/^\d+$/.test(key)))stop();
   Object.defineProperty(out,key,{value:copy(d.value,depth+1),enumerable:true});
  }
  if(Array.isArray(v)&&Object.keys(out).length!==v.length)stop();seen.delete(v);return Object.freeze(out);
 }return copy(value,0);
}
function options(value){
 if(!value||typeof value!=='object'||types.isProxy(value))stop();
 const ds=Object.getOwnPropertyDescriptors(value),out=Object.create(null);
 for(const k of Reflect.ownKeys(ds)){const d=ds[k];if(typeof k!=='string'||!['config','now','pause','guard','predecessorHandoff','onReadStage','assertStage'].includes(k)||!d.enumerable||!Object.hasOwn(d,'value'))stop();out[k]=d.value;}
 if(!Object.hasOwn(out,'config')||typeof out.guard!=='function')stop();return out;
}
// A failed/late response poisons this process. Never assign it to a later IO.
function protocol(child){
 let buffer='',dead=false,faulted=false,chain=Promise.resolve(),closedResolve;const waiting=[];
 const closed=new Promise(r=>{closedResolve=r;});
 const poison=()=>{faulted=true;for(const p of waiting.splice(0))p.reject(Error('TRIAL_STOPPED'));};
 child.on('error',()=>{poison();if(child.pid===undefined){dead=true;closedResolve();}});
 child.stdin.on('error',poison);child.stderr.resume();child.stdout.setEncoding('utf8');
 child.stdout.on('data',chunk=>{
  buffer+=chunk;if(buffer.length>100000){poison();child.kill('SIGTERM');return;}
  while(buffer.includes('\n')){const i=buffer.indexOf('\n'),line=buffer.slice(0,i);buffer=buffer.slice(i+1);const p=waiting.shift();if(!p){poison();child.kill('SIGTERM');return;}try{p.resolve(JSON.parse(line));}catch(_){p.reject(Error('TRIAL_STOPPED'));poison();}}
 });
 child.on('close',()=>{dead=true;poison();closedResolve();});
 const send=message=>{
  const task=chain.then(()=>new Promise((resolve,reject)=>{
   if(dead||faulted||child.exitCode!==null||child.signalCode!==null)return reject(Error('TRIAL_STOPPED'));
   let slot;const timer=setTimeout(()=>{poison();child.kill('SIGTERM');},10000);
   slot={resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}};waiting.push(slot);
   child.stdin.write(JSON.stringify(message)+'\n',e=>{if(e)poison();});
  }));chain=task.catch(()=>{});void task.catch(()=>{});return task;
 };
 const drain=async()=>{
  if(!dead){child.stdin.end();await Promise.race([closed,delay(2000)]);}
  if(!dead){child.kill('SIGTERM');await Promise.race([closed,delay(2000)]);}
  if(!dead){child.kill('SIGKILL');await closed;}
 };
 return {send,drain,closed,alive:()=>!dead&&!faulted};
}
function view(raw,standalone=false,staged=false){
 if(!exact(raw,['ok','spent','state','waitMs','newSpent','w0','expiresAt','deadlineUtc','deadlineTaipei','chargedUpperBoundMs','planReady','rpc','cleanup'])||raw.ok!==true||!integer(raw.spent)||raw.spent<27||raw.spent>(standalone?160:158)||!integer(raw.newSpent)||raw.newSpent<0||raw.newSpent>(standalone?129:112)||!['ready','stopped'].includes(raw.state)||!integer(raw.waitMs)||raw.waitMs<0||raw.waitMs>60000||!(staged&&raw.w0===null&&raw.expiresAt===null&&raw.deadlineUtc===null&&raw.deadlineTaipei===null||[raw.w0,raw.expiresAt].every(integer)&&typeof raw.deadlineUtc==='string'&&typeof raw.deadlineTaipei==='string')||![0,360000].includes(raw.chargedUpperBoundMs)||typeof raw.planReady!=='boolean'||!exact(raw.rpc,['beganAt','complete'])||(raw.rpc.beganAt!==null&&!integer(raw.rpc.beganAt))||typeof raw.rpc.complete!=='boolean'||!exact(raw.cleanup,['cActions','iActions'])||!Array.isArray(raw.cleanup.cActions)||!Array.isArray(raw.cleanup.iActions))stop();
 return data(raw);
}
// One trusted move, not revocation of arbitrary external raw aliases. The
// launcher must clear its known old-client globals before it moves this slot.
const predecessorHandoffs=new WeakMap(),movedPredecessors=new WeakSet();
export function createAuthorityClosedPreflightHandoff(slot){
 try{
  if(!slot||types.isProxy(slot)||!exact(slot,['current']))stop();
  const selected=Object.getOwnPropertyDescriptor(slot,'current');
  if(!selected||!Object.hasOwn(selected,'value')||selected.writable!==true)stop();
  const client=selected.value;if(!client||typeof client!=='object'||types.isProxy(client))stop();
  const d=Object.getOwnPropertyDescriptor(client,'control'),owner=d&&Object.hasOwn(d,'value')?d.value:null;
  const names=['withContinuation','requestStop','stopAndDrain','withOriginalCleanup','withScriptCleanup'];
  if(!owner||typeof owner!=='object'||types.isProxy(owner)||!Object.isFrozen(owner)||movedPredecessors.has(owner))stop();
  for(const name of names){const method=Object.getOwnPropertyDescriptor(owner,name);if(!method||!Object.hasOwn(method,'value')||typeof method.value!=='function')stop();}
  const lane=Object.freeze({stopAndDrain:(...args)=>owner.stopAndDrain(...args),withOriginalCleanup:(...args)=>owner.withOriginalCleanup(...args)});
  const state={phase:'retained',active:0,lane};
  const legacy=Object.freeze(Object.fromEntries(names.map(name=>[name,async(...args)=>{
   if(state.phase!=='retained')stop();state.active++;
   try{return await owner[name](...args);}finally{state.active--;}
  }])));
  slot.current=null;movedPredecessors.add(owner);
  const handoff=Object.freeze({legacy,lane});predecessorHandoffs.set(handoff,state);return handoff;
 }catch(_){stop();}
}
function consumePredecessorHandoff(handoff){
 const state=predecessorHandoffs.get(handoff);
 if(!state||state.phase!=='retained'||state.active)stop();state.phase='transferred';
 // No script cleanup or ordinary capability crosses the one-way transfer.
 return state.lane;
}
export function createAuthorityContinuationControl(input){
 return createControl(input,false);
}
export function createAuthorityStandaloneControl(input){
 return createControl(input,true);
}
export function createAuthorityStagedResumeControl(input){return createControl(input,true,true);}
export function createAuthorityReadonlyRecoveryControl(input){return createControl(input,true,true,true);}
function createControl(input,standalone,staged=false,readonly=false){
 try{
  const o=options(input),config=data(o.config),closed=standalone&&Object.hasOwn(config,'closedPreflight'),renewed=readonly&&Object.hasOwn(config,'deadlineRenewal'),repair=renewed&&Object.hasOwn(config,'firstStageRepair'),connection=repair&&Object.hasOwn(config,'connectionRepair'),rewindow=connection&&Object.hasOwn(config.connectionRepair,'windowApproval'),usertab=rewindow&&Object.hasOwn(config.connectionRepair,'userTabRepair'),now=o.now??Date.now,pause=o.pause??delay,guard=o.guard;
  if(!exact(config,['path','epoch','binding','decisionHash','expiresAt','original','baseline','legacyBudget','policySource',...(standalone?['history']:[]),...(closed?['closedPreflight']:[]),...(staged?['stagedResume']:[]),...(readonly?['readonlyRecovery']:[]),...(renewed?['deadlineRenewal']:[]),...(repair?['firstStageRepair']:[]),...(connection?['connectionRepair']:[])])||!isAbsolute(config.path)||config.decisionHash!==(readonly?READONLY_RECOVERY_DECISION_HASH:staged?STAGED_RESUME_DECISION_HASH:standalone?STANDALONE_TRIAL_DECISION_HASH:BOUNDED_CONTINUATION_DECISION_HASH)||staged&&(!closed||config.expiresAt!==null||typeof o.assertStage!=='function')||!staged&&Object.hasOwn(o,'assertStage')||typeof now!=='function'||typeof pause!=='function')stop();
  // Only this module's consumable move can supply the narrow predecessor lane.
  // Full owners and serialized receipts are rejected by options/brand checks.
  if(readonly&&Object.hasOwn(o,'predecessorHandoff'))stop();
  const predecessor=closed&&!readonly?consumePredecessorHandoff(o.predecessorHandoff):null;
  if(!closed&&(Object.hasOwn(o,'predecessorHandoff')||Object.hasOwn(o,'onReadStage')))stop();
  const predecessorLane=predecessor?.withOriginalCleanup;
  if(Object.hasOwn(o,'onReadStage')&&typeof o.onReadStage!=='function')stop();
  const stage=(operation,stage)=>{if(o.onReadStage){const result=o.onReadStage(Object.freeze({operationId:operation.id,stage,errorCategory:stage==='api-rejected'?'API_REJECTED':stage==='post-return-guard-rejected'?'POST_RETURN_GUARD':'NONE'}));if(result!==undefined)stop();}};
  const inPredecessorLane=callback=>closed&&!readonly?predecessorLane.call(predecessor,callback):callback();
  const home=homedir(),env={PATH:'/opt/homebrew/bin:/usr/bin:/bin',LANG:'C',TZ:'Asia/Taipei',HOME:home},source=fileURLToPath(new URL('./read-authority-continuation-budget.py',import.meta.url));
  const stem=usertab?'.readonly-user-tab-repair':connection?'.readonly-connection-repair':repair?'.readonly-wiring-repair':readonly?'.readonly-recovery':staged?'.staged-resume':closed?'.standalone-successor':standalone?'.standalone':'.continuation';
  const nonce=randomBytes(32).toString('hex');let attempted=false,localStop=false,current=null,lastOwned=null,serial=0,newSpentHighWater=0,cleanupRunning=false;
  const observed=raw=>{const result=view(raw,standalone,staged);newSpentHighWater=Math.max(newSpentHighWater,result.newSpent);return result;};
  const checked=()=>{const result=guard();if(types.isPromise(result))void Promise.prototype.then.call(result,()=>{},()=>{});if(result!==undefined)stop();};
  const veto=()=>{if(localStop)return true;try{lstatSync(config.path+stem+'-stop.json');return true;}catch(e){return e.code!=='ENOENT';}};
  const durableStop=async()=>{
   const child=spawn('python3',[source,usertab?'--readonly-user-tab-repair-request-stop':connection?'--readonly-connection-repair-request-stop':repair?'--readonly-wiring-repair-request-stop':readonly?'--readonly-recovery-request-stop':staged?'--staged-resume-request-stop':closed?'--standalone-successor-request-stop':standalone?'--standalone-request-stop':'--request-stop'],{stdio:['pipe','pipe','pipe'],env}),p=protocol(child);let acknowledged=false;
   try{const r=await p.send({path:config.path,epoch:config.epoch,binding:config.binding});if(!exact(r,['ok','stopRequested'])||r.ok!==true||r.stopRequested!==true)stop();acknowledged=true;}finally{await p.drain();}
   if(!acknowledged||child.exitCode!==0||child.signalCode!==null)stop();return true;
  };
  const stopCaptured=async owned=>{
   localStop=true;let ack=false;
   if(attempted)try{ack=await durableStop();}catch(_){}
   else ack=true; // Local veto makes an unstarted scope permanently inadmissible.
   if(ack)owned?.acknowledgeStop();return ack;
  };
  const requestStop=async()=>{const owned=current;const ack=await stopCaptured(owned);if(!ack)stop();return Object.freeze({stopRequested:true});};
  const drainCaptured=async owned=>{
   const ack=await stopCaptured(owned);if(owned){await owned.settled;owned.drained=true;}
   return Object.freeze({source:'canonical-continuation-holder',stopRequested:true,stopAcknowledged:ack,ordinaryScopeClosed:owned?.scopeClosed===true,ownedScope:Object.freeze({serial:owned?.serial??null,state:owned?'SETTLED':'NONE_CAPTURED'}),remoteExecutionSettled:false,trialAccepted:false,rollbackComplete:false});
  };
  // Keep the original settled promise for independent recovery. A new control
  // object has no captured holder; disk markers never manufacture this proof.
  const stopAndDrain=()=>{const owned=current??lastOwned;return drainCaptured(owned);};
  const withContinuation=async callback=>{
   if(attempted||current||localStop||typeof callback!=='function')stop();attempted=true;
   let resolveOwned;const owned={serial:++serial,settled:new Promise(r=>{resolveOwned=r;})};current=owned;lastOwned=owned;
   let child,p,fd,initial=false,active=true,failed=false,finishAck=false,scopeFailed=false,stopAck=false,holderDrained=false,released=false,busy=false,pending=0,eligibleRpc=false,result;const entered=new Set(),tasks=new Set();
   const release=()=>{if(released)return;released=true;if(fd!==undefined)closeSync(fd);if(current===owned)current=null;resolveOwned();};
   owned.acknowledgeStop=()=>{stopAck=true;if(holderDrained)release();};
   const fence=async()=>{
    if(!initial||stopAck)return;
    try{const r=observed(await p.send({op:'stop',now:now()}));stopAck=r.state==='stopped';}catch(_){}
    if(!stopAck)try{stopAck=await durableStop();}catch(_){}
   };
   const alive=(ordinary=false)=>{if(!active||!p?.alive())stop();checked();if(ordinary&&(failed||veto()))stop();};
   const exchange=async(q,ordinary=false)=>{alive(ordinary);const r=observed(await p.send(q));alive(ordinary);if(ordinary&&r.state!=='ready')stop();return r;};
   const time=()=>{const t=now();if(!integer(t))stop();return t;};
   const tracked=fn=>{
    pending++;const task=(async()=>{try{return await fn();}catch(_){failed=true;await fence();stop();}finally{pending--;}})();tasks.add(task);void task.then(()=>tasks.delete(task),()=>tasks.delete(task));return task;
   };
   const exclusive=async fn=>{if(busy)stop();busy=true;try{return await fn();}finally{busy=false;}};
   const wait=async(q,ordinary)=>{const start=time(),r=await exchange({...q,now:start},ordinary);if(r.waitMs){await pause(r.waitMs);alive(ordinary);if(time()<start||(await exchange({...q,now:time()},ordinary)).waitMs!==0)stop();}};
   const assertStage=proof=>{const value=o.assertStage(data(proof));if(types.isPromise(value))void Promise.prototype.then.call(value,()=>{},()=>{});if(value!==undefined)stop();};
   const run=async(q,io,ordinary)=>{
    if(typeof io!=='function')stop();if(staged&&ordinary&&q.operation?.bucket==='N')assertStage({stage:'readonly-preparation',operations:[q.operation]});await wait({...q,op:q.op==='rpc-begin'?'rpc-wait':q.op==='oldcleanup-debit'?'oldcleanup-wait':'wait'},ordinary);
    const admitted=await exchange({...q,now:time()},ordinary);alive(ordinary);
    const task=Promise.resolve().then(async()=>{alive(ordinary);if(closed&&q.operation)stage(q.operation,'entered');let value;try{value=await io(admitted);}catch(_){if(closed&&q.operation)stage(q.operation,'api-rejected');stop();}if(closed&&q.operation)stage(q.operation,'api-returned');return value;});entered.add(task);
    try{const value=await task;try{alive(ordinary);}catch(_){if(closed&&q.operation)stage(q.operation,'post-return-guard-rejected');stop();}return value;}finally{entered.delete(task);}
   };
   const cap=Object.freeze({decisionHash:config.decisionHash,
    identity:Object.freeze({epoch:config.epoch,binding:config.binding,decisionHash:config.decisionHash,expiresAt:config.expiresAt,...(closed?{closedPreflight:config.closedPreflight}:{} ),...(staged?{stagedResume:config.stagedResume}:{}),...(readonly?{readonlyRecovery:config.readonlyRecovery}:{}),...(renewed?{deadlineRenewal:config.deadlineRenewal}:{}),...(repair?{firstStageRepair:config.firstStageRepair}:{}),...(connection?{connectionRepair:config.connectionRepair}:{})}),
    inspect:()=>tracked(()=>exchange({op:'inspect'})),
    externalRead:(io,descriptor)=>{let operation;try{operation=data(descriptor);}catch(_){return tracked(async()=>stop());}return tracked(()=>exclusive(()=>run({op:'debit',operation},io,true)));},
    ...(staged?{completeStage:proof=>{let pinned;try{pinned=data(proof);if(!exact(pinned,['stage','operations','futureCaps']))stop();}catch(_){return tracked(async()=>stop());}return tracked(()=>exclusive(async()=>{assertStage(pinned);return exchange({op:'stage-ready',...pinned,now:time()},true);}));}}:{}),
    completePlan:operations=>{let pinned;try{pinned=data(operations);}catch(_){return tracked(async()=>stop());}return tracked(()=>exclusive(()=>{if(staged)assertStage({stage:'complete',operations:pinned});return exchange({op:'plan-ready',operations:pinned,now:time()},true);}));},
    restoreOriginalEditor:(action,io)=>tracked(()=>exclusive(()=>run({op:'oldcleanup-debit',kind:'C',action},io,false))),
    cleanup:(action,io)=>tracked(()=>exclusive(()=>run({op:'oldcleanup-debit',kind:'I',action},io,false))),
    dispatchCompatibility:(descriptor,io)=>{
     let d;try{d=data(descriptor);if(!exact(d,['operation','credentialExpiresAt'])||typeof io!=='function')stop();}catch(_){return tracked(async()=>stop());}
     return tracked(()=>exclusive(async()=>{const result=await run({op:'rpc-begin',...d},v=>io(v.rpc.beganAt),true);eligibleRpc=true;return result;}));
    },
    finishCompatibility:()=>tracked(()=>exclusive(async()=>{if(!eligibleRpc)stop();const r=await exchange({op:'rpc-finish',now:time()},true);eligibleRpc=false;return r;})),
   });
   try{
    checked();const t=time(),directory=lstatSync(dirname(config.path));
    if(!directory.isDirectory()||directory.uid!==userInfo().uid||(directory.mode&0o7777)!==0o700)stop();
    fd=openSync(config.path+'.lock',constants.O_RDWR|constants.O_NOFOLLOW);const s=fstatSync(fd),named=lstatSync(config.path+'.lock');
    if(!s.isFile()||s.uid!==userInfo().uid||(s.mode&0o7777)!==0o600||s.nlink!==1||s.size!==0||s.ino!==named.ino||s.dev!==named.dev)stop();
    child=spawn('python3',[source,standalone?'--standalone-inherited-lock':'--inherited-lock'],{stdio:['pipe','pipe','pipe',fd],env});p=protocol(child);
    const ready=observed(await p.send({...config,now:t,ownerNonce:nonce}));initial=true;owned.initial=true;
    if(ready.state!=='ready'||(standalone&&ready.spent<31))stop();
    if(connection){if(ready.spent!==(usertab?47:46)||(rewindow?ready.w0!==null||ready.expiresAt!==null:ready.w0!==CONNECTION_REPAIR_WINDOW.w0||ready.expiresAt!==CONNECTION_REPAIR_WINDOW.expiresAt||t>=ready.expiresAt))stop();}
    else if(readonly&&ready.spent!==43||(readonly&&!renewed?ready.w0!==READONLY_RECOVERY_WINDOW.w0||ready.expiresAt!==READONLY_RECOVERY_WINDOW.expiresAt||t>=ready.expiresAt||ready.spent!==43:staged?ready.w0!==null||ready.expiresAt!==null:closed?ready.w0>t||ready.expiresAt!==config.expiresAt:ready.w0!==t||ready.expiresAt!==config.expiresAt))stop();alive(true);
    result=await callback(cap);if(pending||failed||veto())stop();
    const ending=await exchange({op:'inspect'},true);
    // A returned callback/transport value never substitutes for postchecks.
    if(ending.rpc.beganAt!==null&&!ending.rpc.complete)stop();
   }catch(_){scopeFailed=true;await fence();}
   finally{
    active=false;
    await Promise.allSettled([...entered]);await Promise.allSettled([...tasks]);
    if(initial&&p?.alive())try{const r=await p.send({op:'finish',now:now()});if(!exact(r,['ok','finished'])||r.ok!==true||r.finished!==true)stop();finishAck=true;}catch(_){scopeFailed=true;}
    if(p)await p.drain();
    if(initial&&(!finishAck||failed||child.exitCode!==0||child.signalCode!==null))scopeFailed=true;
    if(scopeFailed)await fence();holderDrained=true;owned.scopeClosed=true;try{owned.settledAt=now();}catch(_){owned.settledAt=null;}
    // This segment can never reopen ordinary authority, even with the retained
    // nonce: its durable global claim is single-use. Once actual IO and child
    // handles have drained, an ambiguous negative marker must not deadlock C/I.
    // Preserve its bytes and report failed ACK separately from actual drain.
    release();
   }
   if(scopeFailed)stop();return result;
  };
  // One actual-owner lane covers the old scope's drain, cooldown and flock.
  // Separate recovery objects and copied loaders share this same closure.
  const withOriginalCleanup=async callback=>{
   if(!standalone||cleanupRunning||typeof callback!=='function'||!attempted||!lastOwned||lastOwned.initial!==true)stop();
   const owned=lastOwned;cleanupRunning=true;
   try{
    checked();await drainCaptured(owned);
    if(lastOwned!==owned||current||owned.scopeClosed!==true||owned.drained!==true||!integer(owned.settledAt))stop();
    checked();const result=await callback();checked();return result;
   }catch(_){stop();}finally{cleanupRunning=false;}
  };
  const withScriptCleanup=async callback=>{
   if(!standalone||cleanupRunning||typeof callback!=='function'||!attempted||!lastOwned||current||lastOwned.scopeClosed!==true||lastOwned.initial!==true)stop();
   const owned=lastOwned;cleanupRunning=true;let child,p,fd,active=true,failed=false,busy=false,pending=0,result,finished=false;const tasks=new Set(),entered=new Set();
   const time=()=>{const t=now();if(!integer(t))stop();return t;};
   const alive=()=>{if(!active||!p?.alive())stop();checked();};
   const exchange=async q=>{alive();const r=observed(await p.send(q));alive();if(r.state!=='stopped')stop();return r;};
   const tracked=fn=>{pending++;const task=(async()=>{try{return await fn();}catch(_){failed=true;stop();}finally{pending--;}})();tasks.add(task);void task.then(()=>tasks.delete(task),()=>tasks.delete(task));return task;};
   const cleanup=(action,io)=>tracked(async()=>{
    if(busy||failed||typeof io!=='function'||!['script-remove','script-verify'].includes(action))stop();busy=true;
    try{
     const start=time(),q={op:'scriptcleanup-wait',action,now:start},wait=await exchange(q);
     if(wait.waitMs){await pause(wait.waitMs);alive();if(time()<start||(await exchange({...q,now:time()})).waitMs!==0)stop();}
     const admitted=await exchange({op:'scriptcleanup-debit',action,now:time()});alive();
     const task=Promise.resolve().then(()=>{alive();if(failed)stop();return io(admitted);});entered.add(task);
     try{const value=await task;alive();return value;}finally{entered.delete(task);}
    }finally{busy=false;}
   });
   try{
    checked();await drainCaptured(owned);
    if(lastOwned!==owned||current||owned.initial!==true||owned.scopeClosed!==true||owned.drained!==true||!integer(owned.settledAt))stop();
    const elapsed=time()-owned.settledAt;if(elapsed<0)stop();if(elapsed<60000)await pause(60000-elapsed);
    checked();if(time()-owned.settledAt<60000)stop();
    const directory=lstatSync(dirname(config.path));if(!directory.isDirectory()||directory.uid!==userInfo().uid||(directory.mode&0o7777)!==0o700)stop();
    fd=openSync(config.path+'.lock',constants.O_RDWR|constants.O_NOFOLLOW);const s=fstatSync(fd),named=lstatSync(config.path+'.lock');
    if(!s.isFile()||s.uid!==userInfo().uid||(s.mode&0o7777)!==0o600||s.nlink!==1||s.size!==0||s.ino!==named.ino||s.dev!==named.dev)stop();
    child=spawn('python3',[source,'--standalone-cleanup-inherited-lock'],{stdio:['pipe','pipe','pipe',fd],env});p=protocol(child);
    const ready=observed(await p.send({...config,now:time(),ownerNonce:nonce,minimumNewSpent:newSpentHighWater}));
    if(ready.state!=='stopped'||!staged&&ready.expiresAt!==config.expiresAt)stop();alive();
    result=await callback(Object.freeze({cleanup}));if(pending||failed)stop();alive();
   }catch(_){failed=true;}
   finally{
    active=false;await Promise.allSettled([...entered]);await Promise.allSettled([...tasks]);
    if(p?.alive())try{const r=await p.send({op:'finish-cleanup'});if(!exact(r,['ok','finished'])||r.ok!==true||r.finished!==true)stop();finished=true;}catch(_){failed=true;}
    if(p)await p.drain();if(child&&(!finished||child.exitCode!==0||child.signalCode!==null))failed=true;
    if(fd!==undefined)closeSync(fd);cleanupRunning=false;
   }
   if(failed)stop();return result;
  };
  const bridgeOriginalStopControl=original=>{
   if(!original||typeof original.requestStop!=='function'||typeof original.stopAndDrain!=='function')stop();
   return Object.freeze({...original,requestStop:async()=>{const owned=current??lastOwned;const ack=await stopCaptured(owned);await original.requestStop();if(!ack)stop();return Object.freeze({stopRequested:true});},stopAndDrain:async()=>{
    const owned=current??lastOwned;
    // Capture both actual handles before either can be replaced during await.
    // drainCaptured sets the local admission veto synchronously first.
    const continuationDrain=drainCaptured(owned),originalDrain=original.stopAndDrain();
    const results=await Promise.allSettled([continuationDrain,originalDrain]);if(results.some(v=>v.status!=='fulfilled'))stop();
    const [continuationHolder,originalHolder]=results.map(v=>v.value);return Object.freeze({source:'continuation-owner-stop-bridge',stopRequested:true,stopAcknowledged:continuationHolder.stopAcknowledged&&originalHolder.stopAcknowledged===true,continuationHolder,originalHolder,remoteExecutionSettled:false,trialAccepted:false,rollbackComplete:false});
   }});
  };
  return Object.freeze({withContinuation:callback=>inPredecessorLane(()=>withContinuation(callback)),requestStop,stopAndDrain,bridgeOriginalStopControl,...(standalone?{withScriptCleanup:callback=>inPredecessorLane(()=>withScriptCleanup(callback)),withOriginalCleanup:callback=>inPredecessorLane(()=>withOriginalCleanup(callback))}:{})});
 }catch(_){stop();}
}
