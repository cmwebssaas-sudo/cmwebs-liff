// One live owner for the approved replacement. Each callback is exactly one IO
// primitive; mapped private adapters fix its destination, actor and safe result.
import {spawn} from 'node:child_process';
import {openSync,closeSync,lstatSync,fstatSync,constants,writeFileSync,readFileSync,fsyncSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir,userInfo} from 'node:os';
import {randomBytes,createHash} from 'node:crypto';
import {types} from 'node:util';
import {SIMPLE_DECISION,simpleData,simpleExact,simpleBrowser,simpleFixed,compileAuthoritySimplePlan,REBALANCE_DECISION,SIMPLE_NATIVE} from './read-authority-simple-plan.mjs';
const stop=()=>{throw Error('TRIAL_STOPPED');};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function protocol(child){
 let buffer='',closed=false,poison=false;const rows=[],waiters=[];
 const push=value=>waiters.length?waiters.shift()(value):rows.push(value);
 child.stdout.setEncoding('utf8');child.stdout.on('data',v=>{buffer+=v;if(buffer.length>1000000){poison=true;child.kill();return;}while(buffer.includes('\n')){const n=buffer.indexOf('\n');let value;try{value=JSON.parse(buffer.slice(0,n));}catch(_){poison=true;child.kill();return;}buffer=buffer.slice(n+1);push(value);}});
 child.stderr.resume();child.stdin.on('error',()=>{});child.on('error',()=>{poison=true;});
 const ended=new Promise(resolve=>child.once('close',()=>{closed=true;while(waiters.length)waiters.shift()(null);resolve();}));
 return {send:async q=>{if(closed||poison)stop();child.stdin.write(JSON.stringify(q)+'\n');const value=await (rows.length?Promise.resolve(rows.shift()):new Promise((resolve,reject)=>{const timer=setTimeout(()=>{poison=true;child.kill();reject(Error('TRIAL_STOPPED'));},10000);waiters.push(v=>{clearTimeout(timer);resolve(v);});}));if(!value||value.ok!==true||poison)stop();return value;},close:async()=>{child.stdin.end();const timer=setTimeout(()=>child.kill('SIGTERM'),2000),hard=setTimeout(()=>child.kill('SIGKILL'),4000);try{await ended;}finally{clearTimeout(timer);clearTimeout(hard);}}};
}
function options(input){
 if(!input||typeof input!=='object'||types.isProxy(input))stop();const o={};for(const [k,d] of Object.entries(Object.getOwnPropertyDescriptors(input))){if(!['config','guard','assertStage','now','pause'].includes(k)||!Object.hasOwn(d,'value')||!d.enumerable)stop();o[k]=d.value;}
 if(Object.getOwnPropertySymbols(input).length||!['config','guard','assertStage'].every(k=>Object.hasOwn(o,k)))stop();return o;
}
export function createAuthoritySimpleControl(input){
 const o=options(input),config=simpleData(o.config),guard=o.guard,assertStage=o.assertStage,now=o.now??Date.now,pause=o.pause??delay,home=homedir(),nonce=randomBytes(32).toString('hex');
 const continued=Object.hasOwn(config,'continuation'),repaired=Object.hasOwn(config,'admissionRepair'),renewed=Object.hasOwn(config,'admissionWindow'),debug=Object.hasOwn(config,'readonlyDebug'),continuity=Object.hasOwn(config,'readonlyContinuity'),successor=Object.hasOwn(config,'readonlySuccessor'),rebalanced=Object.hasOwn(config,'readonlyRebalance'),loading=Object.hasOwn(config,'readonlyLoading'),accountLoad=Object.hasOwn(config,'readonlyAccountLoad'),connected=Object.hasOwn(config,'readonlyConnection'),suffix=connected?'.simple-connection':accountLoad?'.simple-account-load':rebalanced?'.simple-rebalanced':successor?'.simple-readonly-diagnostic':continuity?'.simple-readonly-continuity':debug?'.simple-readonly-debug':repaired?'.simple-admission-repair':continued?'.simple-continuation':'.simple';
 if(connected&&!accountLoad||accountLoad&&!loading||repaired&&!continued||renewed&&!repaired||debug&&!renewed||continuity&&!debug||successor&&!continuity||rebalanced&&!successor||loading&&!rebalanced||loading&&!Object.hasOwn(config,'resume')||Object.hasOwn(config,'resume')&&!continuity)stop();
 if(!simpleExact(config,['path','epoch','binding','decisionHash','approval','history','baseline','original','legacyBudget','sources',...(continued?['continuation']:[]),...(repaired?['admissionRepair']:[]),...(renewed?['admissionWindow']:[]),...(debug?['readonlyDebug']:[]),...(continuity?['readonlyContinuity']:[]),...(successor?['readonlySuccessor']:[]),...(rebalanced?['readonlyRebalance']:[]),...(loading?['readonlyLoading']:[]),...(accountLoad?['readonlyAccountLoad']:[]),...(connected?['readonlyConnection']:[]),...(Object.hasOwn(config,'resume')?['resume']:[])])||config.decisionHash!==SIMPLE_DECISION||[guard,assertStage,now,pause].some(v=>typeof v!=='function'||types.isProxy(v)))stop();
 if(continued&&(!simpleExact(config.continuation,['decisionHash','approval','journal','claim','stop','registry','drain'])||config.continuation.decisionHash!=='fc822ca3296a4f66195c02e9db1088ca6b95eb197bd440a27f417069e9b7cdd7'))stop();
 if(repaired&&(!simpleExact(config.admissionRepair,['decisionHash','approval','journal','claim','stop','registry'])||config.admissionRepair.decisionHash!=='03310835216ab80ff344fe51264466bb7c7cc333d3e7df499b28ce9eb85e290f'))stop();
 if(renewed&&(!simpleExact(config.admissionWindow,['decisionHash','approval'])||config.admissionWindow.decisionHash!=='abb1747f4eae5ba0cd98c200649f700a4cd6de97b215b14b671f63eee0eb25a3'))stop();
 if(debug&&(!simpleExact(config.readonlyDebug,['decisionHash','approval','journal','claim','stop','registry','drain'])||config.readonlyDebug.decisionHash!=='e0342182ffe003392fe00a0f3a516d3b1605dd9c52cecd35ad3a690bc4db1390'))stop();
 if(continuity&&(!simpleExact(config.readonlyContinuity,['decisionHash','approval','journal','claim','stop','registry','drain'])||config.readonlyContinuity.decisionHash!=='5d9a800f4e7f7982ae01c5326e83187d7f0533f9e0a63cfb123b0d283e006e52'))stop();
 if(successor&&(!simpleExact(config.readonlySuccessor,['decisionHash','approval','journal','claim','stop','registry','terminal','flow'])||config.readonlySuccessor.decisionHash!=='d5dfef1f8870664508a58fdf62922b5754b3c391374d2e365622cf94e8272a32'))stop();
 if(rebalanced&&(!simpleExact(config.readonlyRebalance,['decisionHash','approval','journal','claim','registry','receipt'])||config.readonlyRebalance.decisionHash!==REBALANCE_DECISION))stop();
 if(loading&&(!simpleExact(config.readonlyLoading,['decisionHash','approval','origin'])||config.readonlyLoading.decisionHash!=='909dabbd2cfbd56dd06ac94f1221fe1fad0e566e8b247989419aa455066b73a6'))stop();
 if(accountLoad&&(!simpleExact(config.readonlyAccountLoad,['decisionHash','approval','origin'])||config.readonlyAccountLoad.decisionHash!=='8ddb213aa8a504c2cf2c2e5042d3ee7f212d90cffd555e140164f6ddcf25063f'))stop();
 if(connected&&(!simpleExact(config.readonlyConnection,['decisionHash','approval','origin'])||config.readonlyConnection.decisionHash!=='659f6874e4e7a53558ed3e3bb9c0e69c2783d42465eeb2eb05bbf921d6d8f6c8'))stop();
 const isPrep=operation=>continuity&&(!rebalanced||operation.preparation===true&&operation.key==='N:preparation')&&phase==='PREP'&&['N:preparation','N:navigation'].includes(operation.key)&&['original-settings','original-triggers','thin-settings','thin-triggers','oauth-audience','oauth-client','caller-executions','publisher-executions'].includes(operation.target)&&['inventory','claim','navigate','snapshot','read-key-presence',...(loading?['wait']:[])].includes(operation.operation);
 const source=fileURLToPath(new URL('./read-authority-simple-budget.py',import.meta.url));let attempted=false,stopping=false,owner=null,highWater=0,cleanupRunning=false,handoff=null,phase=null;
 const checked=()=>{const r=guard();if(types.isPromise(r)){void r.catch(()=>{});stop();}if(r!==undefined)stop();};
 const proof=value=>{const r=assertStage(simpleData(value));if(types.isPromise(r)){void r.catch(()=>{});stop();}if(r!==undefined)stop();};
 const time=()=>{const t=now();if(!Number.isSafeInteger(t))stop();return t;};
 const lock=()=>{
  const d=lstatSync(dirname(config.path));if(!d.isDirectory()||d.uid!==userInfo().uid||(d.mode&0o7777)!==0o700)stop();
  const fd=openSync(config.path+'.lock',constants.O_RDWR|constants.O_NOFOLLOW);try{const s=fstatSync(fd),n=lstatSync(config.path+'.lock');if(!s.isFile()||s.uid!==userInfo().uid||(s.mode&0o7777)!==0o600||s.nlink!==1||s.size!==0||s.ino!==n.ino||s.dev!==n.dev)stop();return fd;}catch(e){closeSync(fd);throw e;}
 };
 const start=async cleanup=>{
  checked();const fd=lock();let child,p;
  try{child=spawn('python3',[source,...(cleanup?['--cleanup']:[])],{stdio:['pipe','pipe','pipe',fd],env:{HOME:home,PATH:'/opt/homebrew/bin:/usr/bin:/bin',TZ:'Asia/Taipei',LANG:'C'}});p=protocol(child);const initial={...config};if(cleanup)delete initial.resume;const first=await p.send({...initial,now:time(),ownerNonce:nonce,...(cleanup?{minimumEvents:highWater}:{})});observe(first);return {fd,p};}catch(e){if(p)await p.close();closeSync(fd);throw e;}
 };
 const observe=r=>{
  if(continuity){if(!['PREP','TRIAL'].includes(r.phase)||!['ACTIVE','CLEAN_PAUSE','HARD_STOP'].includes(r.lifecycle)||!Number.isSafeInteger(r.technicalFailures)||r.technicalFailures<0||r.technicalFailures>3||phase==='TRIAL'&&r.phase!=='TRIAL')stop();phase=r.phase;}
  if(!Number.isSafeInteger(r.mainSpent)||r.mainSpent<53||r.mainSpent>(connected?132:rebalanced?137:158)||!Number.isSafeInteger(r.uiSpent)||r.uiSpent<(debug?15:repaired?13:continued?12:0)||r.uiSpent>(connected?98:rebalanced?93:72)||r.combinedSpent!==r.mainSpent+r.uiSpent||r.combinedSpent>232||!['ready','stopped'].includes(r.state)||!Number.isSafeInteger(r.waitMs)||r.waitMs<0||r.waitMs>60000||r.combinedSpent-53<highWater)stop();highWater=r.combinedSpent-53;return Object.freeze(r);
 };
 const runScope=async(callback,cleanup=false)=>{
  let connection,active=true,busy=false,scopeFailed=false,paused=false;const tasks=new Set(),inflight=new Set();let pending=0;
  const alive=ordinary=>{if(!active||ordinary&&(stopping||paused))stop();checked();};
  const send=async(q,ordinary=true)=>{alive(ordinary);const r=observe(await connection.p.send(q));alive(ordinary);if(ordinary&&r.state!=='ready')stop();return r;};
  const track=fn=>{pending++;const task=(async()=>{try{return await fn();}catch(e){if(e?.message!=='READ_FAILED'){scopeFailed=true;stopping=true;}throw e;}finally{pending--;}})();tasks.add(task);void task.then(()=>tasks.delete(task),()=>tasks.delete(task));return task;};
  const exclusive=async fn=>{if(busy)stop();busy=true;try{return await fn();}finally{busy=false;}};
  const execute=(lane,raw,io,reserve=false,mode='ordinary',credentialExpiresAt=null)=>track(()=>exclusive(async()=>{
   if(typeof io!=='function')stop();let operation;
   try{operation=lane==='ui'?simpleBrowser(raw,loading&&phase==='PREP'):simpleFixed(raw,cleanup);}catch(_){stop();}
   const ordinary=!cleanup&&mode!=='terminal';
   proof({stage:cleanup?'recovery':mode==='terminal'?'terminal':(operation.preparation||isPrep(operation))?'readonly-preparation':'operation',lane,operation});
   const q={op:mode==='rpc'?'rpc-wait':mode==='terminal'?'terminal-wait':'wait',lane,operation,now:time(),...(mode==='rpc'?{credentialExpiresAt}:{})};let r=await send(q,ordinary);
   if(r.waitMs){const before=q.now;await pause(r.waitMs);alive(ordinary);if(time()<before)stop();r=await send({...q,now:time()},ordinary);if(r.waitMs)stop();}
   const admitted=await send({...q,op:mode==='rpc'?'rpc-begin':mode==='terminal'?'terminal-debit':'debit',now:time()},ordinary);let value,rejected=false,readonlyFailure=null,preparationOutcome=null,nativeResultVerified=false,loadingResultVerified=false,connectionFailure=null;
   const task=Promise.resolve().then(()=>{alive(ordinary);return io(admitted);});inflight.add(task);
   try{value=await task;if(loading&&isPrep(operation)&&operation.operation==='snapshot'){proof({stage:'loading-result',operation,result:simpleData(value)});loadingResultVerified=true;}if(rebalanced&&lane==='ui'&&SIMPLE_NATIVE.includes(operation.key)){proof({stage:'native-result',operation,result:simpleData(value)});nativeResultVerified=true;}}catch(e){rejected=true;if(connected&&isPrep(operation)&&operation.operation!=='snapshot'){try{const p=simpleData(e);if(simpleExact(p,['source','kind','phase','errorClass','code','pureRead','terminal','fieldsRead'])&&p.source==='settled-readonly-connection'&&p.kind==='READONLY_TOOL'&&['discovery','binding','inventory','claim','wait'].includes(p.phase)&&['ERROR','TYPE_ERROR','TIMEOUT','UNKNOWN'].includes(p.errorClass)&&['API_REJECTED','BROWSER_UNAVAILABLE','OWNER_CONNECTION_REQUIRED'].includes(p.code)&&p.pureRead===true&&p.terminal===true&&p.fieldsRead===false){proof({stage:'connection-failure',operation,result:p});const{source,...safe}=p;connectionFailure=safe;}}catch(_){}}if(continuity&&lane==='ui'&&isPrep(operation)){try{const p=simpleData(e);if(simpleExact(p,['source','kind','phase','targetVerified','accountVerified','bindingVerified','pureRead','terminal','fieldsRead'])&&p.source==='settled-preparation'&&['targetVerified','accountVerified','bindingVerified','pureRead','terminal'].every(k=>p[k]===true)&&typeof p.fieldsRead==='boolean'&&(p.kind==='NOT_READY'&&p.phase==='READY'&&p.fieldsRead===false||p.kind==='TECHNICAL'&&['DECODE','PROJECTOR_COMBOS','PROJECTOR_SHAPE','PROJECTOR_ANCESTORS','PROJECTOR_RELATED','POSTCHECK_COMBO'].includes(p.phase))){const{source,...outcome}=p;preparationOutcome=outcome;}}catch(_){}}else if(debug&&lane==='ui'&&operation.preparation){try{const p=simpleData(e);if(simpleExact(p,['source','phase','targetVerified'])&&p.source==='settled-readonly-projection'&&p.targetVerified===true&&['PROJECTOR_COMBOS','PROJECTOR_SHAPE','PROJECTOR_ANCESTORS','PROJECTOR_RELATED','POSTCHECK_COMBO'].includes(p.phase))readonlyFailure={phase:p.phase,category:'SETTLED_READONLY_PROJECTION_REJECTED',targetVerified:true};}catch(_){}}}finally{inflight.delete(task);}
   // IO has actually returned before pending is cleared, including on STOP.
   const settled=observe(await connection.p.send({op:'settle',id:operation.id,success:!rejected,now:time(),...(nativeResultVerified?{nativeResultVerified:true}:{}),...(loadingResultVerified?{loadingResultVerified:true}:{}),...(connectionFailure?{connectionFailure}:preparationOutcome?{preparationOutcome}:readonlyFailure?{readonlyFailure}:{})}));
   alive(ordinary);if(rejected){if(settled.state==='ready'&&connectionFailure?.code==='OWNER_CONNECTION_REQUIRED'){await send({op:'pause-preparation',now:time()},ordinary);paused=true;}if(settled.state==='ready'&&lane==='ui'&&(operation.preparation||isPrep(operation)))throw Error('READ_FAILED');stop();}if(ordinary&&settled.state!=='ready')stop();return reserve?settled:value;
  }));
  const cap=Object.freeze({decisionHash:SIMPLE_DECISION,identity:Object.freeze({epoch:config.epoch,binding:config.binding,decisionHash:SIMPLE_DECISION,expiresAt:null}),
   inspect:()=>track(()=>exclusive(()=>send({op:'inspect'},!cleanup))),
   browserRead:(io,descriptor)=>execute('ui',descriptor,io),
   externalRead:(io,descriptor)=>execute('main',descriptor,io),
   prepareReadonly:raw=>track(()=>exclusive(async()=>{if(!continuity)stop();const p=simpleData(raw);proof({stage:'readonly-map',...p});return send({op:'preparation-ready',...p,now:time()});})),
   pausePreparation:()=>track(()=>exclusive(async()=>{if(!continuity||cleanup)stop();const r=await send({op:'pause-preparation',now:time()});paused=true;return r;})),
   completeStage:raw=>track(()=>exclusive(async()=>{const p=simpleData(raw);proof(p);return send({op:'stage-ready',...p,now:time()});})),
   completeRecoveryPlan:raw=>track(()=>exclusive(async()=>{const browserOperations=simpleData(raw);proof({stage:'recovery-map',browserOperations});return send({op:'recovery-ready',browserOperations,now:time()});})),
   completePlan:raw=>track(()=>exclusive(async()=>{const p=simpleData(raw);const compiled=compileAuthoritySimplePlan({...p,decisionHash:SIMPLE_DECISION,history:{spent:53,limit:connected?134:rebalanced?139:160},mapComplete:true,...(rebalanced?{accountingDecision:connected?'659f6874e4e7a53558ed3e3bb9c0e69c2783d42465eeb2eb05bbf921d6d8f6c8':REBALANCE_DECISION}:{})});if(!compiled.credentialRpcEligible)stop();proof({stage:'complete',...p});return send({op:'plan-ready',plan:p,now:time()});})),
   completeBrowserOperation:key=>track(()=>exclusive(()=>send({op:'ui-complete',key,now:time()}))),
   dispatchCompatibility:(raw,io)=>{let d;try{d=simpleData(raw);if(!simpleExact(d,['operation','credentialExpiresAt'])||!Number.isSafeInteger(d.credentialExpiresAt)||typeof io!=='function')stop();}catch(_){return Promise.reject(Error('TRIAL_STOPPED'));}return execute('main',d.operation,v=>io(v.rpc.beganAt),false,'rpc',d.credentialExpiresAt);},
   inspectTerminal:()=>track(()=>exclusive(()=>send({op:'inspect'},false))),
   terminalRead:(io,descriptor)=>execute('main',descriptor,io,false,'terminal'),
   finishCompatibility:()=>track(()=>exclusive(()=>send({op:'rpc-finish',now:time()}))),
   reserveNativeCleanup:descriptor=>{if(!cleanup)stop();return execute('main',descriptor,()=>{},true);}
  });
  try{
   connection=await start(cleanup);if(!cleanup)owner.initialized=true;
   if(cleanup)await send({op:'cleanup-start',now:time()},false);
   const result=await callback(cap);if(pending||scopeFailed||!cleanup&&stopping)stop();return result;
  }catch(_){scopeFailed=true;stopping=true;stop();}
  finally{
   stopping=true;await Promise.allSettled([...inflight]);await Promise.allSettled([...tasks]);
   if(connection){try{if(!paused||scopeFailed){observe(await connection.p.send({op:'stop'}));if(owner)owner.stopAcknowledged=true;}}catch(_){scopeFailed=true;}await connection.p.close();closeSync(connection.fd);}
   active=false;if(!cleanup){owner.scopeClosed=true;owner.settledAt=time();try{if(paused&&!scopeFailed){checked();const jp=config.path+suffix+'.json',raw=readFileSync(jp),j=JSON.parse(raw),digest=bytes=>createHash('sha256').update(bytes).digest('hex'),registry=home+'/.codex/private/cmwebs-authority-trials/'+digest(JSON.stringify(config.epoch))+(accountLoad?'.simple-rebalanced':suffix)+'.json',registryRaw=readFileSync(registry);if(j.lifecycle!=='CLEAN_PAUSE'||j.pending!==null||j.phase!=='PREP'||j.holder!==digest(nonce)||pending||inflight.size||tasks.size)stop();const path=config.path+suffix+'-handoff-'+j.holders.length+'.json',receipt={source:'readonly-continuity-terminal-holder',lifecycle:'HANDOFF_CLOSED',ownerHash:j.holder,journalSha256:digest(raw),registrySha256:digest(registryRaw),eventCount:j.events.length,holderCount:j.holders.length,allIoSettled:true,scopeClosed:true,childClosed:true,lockReleased:true},bytes=JSON.stringify(receipt),fd=openSync(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}handoff=Object.freeze({receipt:Object.freeze({path,sha256:digest(bytes)}),minimumEvents:j.events.length});}}finally{owner.resolve();}}
  }
 };
 const withContinuation=callback=>{
  if(attempted||stopping||typeof callback!=='function')return Promise.reject(Error('TRIAL_STOPPED'));attempted=true;
  let resolve;const settled=new Promise(r=>{resolve=r;});owner={settled,resolve,scopeClosed:false,stopAcknowledged:false,initialized:false,settledAt:null};return runScope(callback);
 };
 const requestStop=async()=>{
  stopping=true;
  if(owner?.initialized){checked();const marker=config.path+suffix+'-stop.json';try{writeFileSync(marker,JSON.stringify({source:'live-owner-stop',binding:config.binding}),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')stop();}}
  return Object.freeze({stopRequested:true});
 };
 const stopAndDrain=async()=>{await requestStop();if(owner)await owner.settled;return Object.freeze({source:'simple-authority-holder',stopRequested:true,stopAcknowledged:owner?.stopAcknowledged??!attempted,ordinaryScopeClosed:owner?.scopeClosed??false,ownedScope:Object.freeze({state:owner?'SETTLED':'NONE_CAPTURED'}),trialAccepted:false,remoteExecutionSettled:false,rollbackComplete:false});};
 const withCleanup=async callback=>{
  if(cleanupRunning||!owner?.initialized||!owner.scopeClosed||typeof callback!=='function')stop();cleanupRunning=true;
  try{await stopAndDrain();const elapsed=time()-owner.settledAt;if(elapsed<0)stop();if(elapsed<60000)await pause(60000-elapsed);if(time()-owner.settledAt<60000)stop();return await runScope(callback,true);}finally{cleanupRunning=false;}
 };
 return Object.freeze({withContinuation,requestStop,stopAndDrain,withCleanup,preparationHandoff:()=>{if(!handoff||!owner?.scopeClosed)stop();return handoff;}});
}
