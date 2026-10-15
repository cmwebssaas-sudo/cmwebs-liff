// Local preparation only. Trusted orchestration pins IO and actual Google gates.
// No counter mutation, child, account, credential or trial RPC at construction.
import {spawn} from 'node:child_process';
import {SINGLE_WRAPPER_TRIAL_DECISION_HASH} from './read-authority-trial-budget-plan.mjs';
import {resolve,dirname} from 'node:path';
import {userInfo} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {lstatSync,openSync,fstatSync,closeSync,constants} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
const stop=()=>{throw Error('TRIAL_STOPPED');},hash=v=>createHash('sha256').update(v).digest('hex');
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),integer=Number.isSafeInteger;
const only=(v,keys,required=keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k))&&required.every(k=>Object.hasOwn(v,k));
export function createAuthorityPreparationControl(input){
 try{
  if(!only(input,['path','epoch','approvalHash','proposalHash','legacySha256','importedReads','expiresAt','now','pause','decisionHash'],['path','epoch','approvalHash','proposalHash','legacySha256','importedReads','expiresAt']))stop();
  const {epoch,approvalHash,proposalHash,legacySha256,importedReads,expiresAt,now=Date.now,pause=delay}=input;
  const policy=Object.hasOwn(input,'decisionHash')?Object.freeze({decisionHash:input.decisionHash}):Object.freeze({});
  if('decisionHash' in policy&&(policy.decisionHash!==SINGLE_WRAPPER_TRIAL_DECISION_HASH||importedReads!==25))stop();
  if(typeof input.path!=='string'||typeof epoch!=='string'||!/^[-A-Za-z0-9_]{20,200}$/.test(epoch)||![approvalHash,proposalHash,legacySha256].every(digest)||!integer(importedReads)||importedReads<0||importedReads>141||!integer(expiresAt)||[now,pause].some(f=>typeof f!=='function'))stop();
  const path=resolve(input.path),binding=hash(JSON.stringify({path,epoch,approvalHash,proposalHash,legacySha256,importedReads,expiresAt,...policy}));let busy=false,localStop=false,currentOwned=null,scopeSerial=0;
  const stopRequested=()=>{
   // Any marker, including a partial exclusive write, is a negative veto.
   // It grants no cleanup authority: Python still validates the canonical
   // counter, checkpoint and claim. Never repair or remove an ambiguous marker.
   if(localStop)return true;
   try{lstatSync(path+'.preparation-stop.json');return true;}catch(e){return e.code!=='ENOENT';}
  };
  const requestStop=async()=>{
   const owned=currentOwned;localStop=true;
   await new Promise((resolve,reject)=>{
    let output='',failed=false,killTimer;const child=spawn('python3',[fileURLToPath(new URL('./read-authority-preparation-budget.py',import.meta.url)),'--request-stop'],{stdio:['pipe','pipe','pipe'],env:{PATH:'/opt/homebrew/bin:/usr/bin:/bin',LANG:'C',TZ:'Asia/Taipei'}});
    const timer=setTimeout(()=>{failed=true;child.kill('SIGTERM');killTimer=setTimeout(()=>child.kill('SIGKILL'),2000);},10000);
    child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{output+=chunk;if(output.length>5000){failed=true;child.kill('SIGTERM');}});child.stderr.on('data',()=>{});
    child.on('error',()=>{failed=true;if(child.pid===undefined){clearTimeout(timer);reject(Error('TRIAL_STOPPED'));}});
    child.stdin.on('error',()=>{failed=true;});
    child.on('close',code=>{clearTimeout(timer);clearTimeout(killTimer);try{const r=JSON.parse(output);if(code!==0||failed||!only(r,['ok','stopRequested'])||r.ok!==true||r.stopRequested!==true)stop();resolve();}catch(_){reject(Error('TRIAL_STOPPED'));}});
    child.stdin.end(JSON.stringify({path,epoch,binding})+'\n',e=>{if(e)failed=true;});
   });owned?.acknowledgeStop();return Object.freeze({stopRequested:true});
  };
  const stopAndDrain=async()=>{
   // This is an original in-memory scope handle, never PID/file/lock metadata.
   const owned=currentOwned;let acknowledged=false;
   try{await requestStop();acknowledged=true;}catch(_){}
   if(owned)await owned.settled;
   return Object.freeze({source:'canonical-preparation-holder',stopRequested:true,stopAcknowledged:acknowledged,ownedScope:Object.freeze({serial:owned?.serial??null,state:owned?'SETTLED':'NONE_CAPTURED'}),remoteExecutionSettled:false,trialAccepted:false,rollbackComplete:false});
  };
  const scope=async(mode,runtimeBinding,callback)=>{
   if(busy||typeof callback!=='function'||(mode==='runtime'&&!digest(runtimeBinding)))stop();busy=true;let resolveOwned;const owned={serial:++scopeSerial,settled:new Promise(r=>{resolveOwned=r;})};currentOwned=owned;let child,lockFd,result,initialReady=false,active=true,pending=0,failed=false,scopeFailed=false,finishAcknowledged=false,stopFenced=false,holderDrained=false,released=false,admissionBusy=false,eligibleEntry=null,chain=Promise.resolve(),buffer='',waiting=[],ended=false,terminal=false;const enteredIO=new Set();let terminalResolve;const terminalPromise=new Promise(r=>{terminalResolve=r;});const markTerminal=()=>{terminal=true;terminalResolve();};
   const releaseOwnership=()=>{
    if(released)return;released=true;
    try{if(lockFd!==undefined)closeSync(lockFd);}
    finally{busy=false;if(currentOwned===owned)currentOwned=null;resolveOwned();}
   };
   // A failed durable stop cannot release another controller into ordinary IO.
   // Only this original handle can release retained ownership after strict ACK.
   owned.acknowledgeStop=()=>{stopFenced=true;if(holderDrained)releaseOwnership();};
   const send=message=>{
    const operation=chain.then(()=>new Promise((resolve,reject)=>{
     if(ended||!child||child.exitCode!==null)return reject(Error('TRIAL_STOPPED'));
     const timer=setTimeout(()=>reject(Error('TRIAL_STOPPED')),10000);
     waiting.push({resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});
     child.stdin.write(JSON.stringify(message)+'\n',e=>{if(e)reject(Error('TRIAL_STOPPED'));});
    }));chain=operation.catch(()=>{});void operation.catch(()=>{});return operation;
   };
   const alive=()=>{if(!active)stop();};
   const view=(r,extras=[])=>{if(!only(r,['ok','spent','state','waitMs',...extras])||r.ok!==true||!integer(r.spent)||r.spent<importedReads||r.spent>160||!['ready','stopped'].includes(r.state)||!integer(r.waitMs)||r.waitMs<0||r.waitMs>60000)stop();return r;};
   const request=async(op,kind='ordinary',action=null,units=1)=>{alive();if(kind==='ordinary'&&(failed||stopRequested()))stop();const t=now();if(!integer(t))stop();const r=await send({op,kind,action,units,now:t});alive();if(kind==='ordinary'&&(failed||stopRequested()))stop();return view(r);};
   const tracked=fn=>{pending++;const p=(async()=>{try{alive();return await fn();}catch(_){failed=true;if(child&&!ended)try{await send({op:'stop',kind:'ordinary',action:null,units:1,now:now()});}catch(_){}stop();}finally{pending--;}})();void p.catch(()=>{});return p;};
   const wait=async(kind,action,units)=>{const before=now(),r=await request('wait',kind,action,units);if(r.waitMs){await pause(r.waitMs);alive();if(now()<before)stop();const next=await request('wait',kind,action,units);if(next.waitMs!==0)stop();}};
   const action=async(kind,name,io)=>{
    if(typeof io!=='function'||admissionBusy)stop();admissionBusy=true;
    try{await wait(kind,name,1);await request('debit',kind,name,1);alive();const p=Promise.resolve().then(()=>{alive();if(kind==='ordinary'&&(failed||stopRequested()))stop();return io();});enteredIO.add(p);try{return await p;}finally{enteredIO.delete(p);}}
    finally{admissionBusy=false;}
   };
   const idle=()=>{if(admissionBusy)stop();};
   const handoff=descriptor=>tracked(async()=>{
    idle();if(pending!==1||failed||stopRequested()||!only(descriptor,['runtimeBinding','expectedSpent'])||!digest(descriptor.runtimeBinding)||!integer(descriptor.expectedSpent))stop();admissionBusy=true;
    try{
     const time=now();if(!integer(time))stop();const expected={runtimeBinding:descriptor.runtimeBinding,expectedSpent:descriptor.expectedSpent};
     const r=await send({op:'handoff',...expected,now:time});alive();if(failed||!only(r,['ok','spent','state','waitMs','handoff'])||r.ok!==true||r.state!=='ready'||r.waitMs!==0||r.spent!==expected.expectedSpent||!only(r.handoff,['runtimeBinding','time','spent','eventHash'])||r.handoff.runtimeBinding!==expected.runtimeBinding||r.handoff.time!==time||r.handoff.spent!==r.spent||!digest(r.handoff.eventHash))stop();
     return Object.freeze({source:'canonical-preparation-ledger',runtimeBinding:r.handoff.runtimeBinding,time,spent:r.spent,eventHash:r.handoff.eventHash,trialAccepted:false});
    }finally{admissionBusy=false;}
   });
   const inspectRuntime=()=>tracked(async()=>{
    const r=view(await send({op:'runtime-inspect'}),['runtimeBinding','runtime']);alive();
    if(r.runtimeBinding!==runtimeBinding||!only(r.runtime,['nativeMs','rpcEntries','pending','lastExecutionHash'])||!integer(r.runtime.nativeMs)||r.runtime.nativeMs<0||r.runtime.nativeMs>900000||!Array.isArray(r.runtime.rpcEntries)||r.runtime.rpcEntries.length>2||r.runtime.rpcEntries.some((v,i)=>v!==['wrapper','qualified'][i])||(r.runtime.pending!==null&&(!only(r.runtime.pending,['entry','startedAt'])||!['wrapper','qualified'].includes(r.runtime.pending.entry)||!integer(r.runtime.pending.startedAt)))||(r.runtime.lastExecutionHash!==null&&!digest(r.runtime.lastExecutionHash)))stop();
    return Object.freeze({source:'canonical-preparation-ledger',epoch,expiresAt,runtimeBinding,spent:r.spent,state:r.state,nativeMs:r.runtime.nativeMs,rpcEntries:Object.freeze([...r.runtime.rpcEntries]),pending:r.runtime.pending===null?null:Object.freeze({...r.runtime.pending}),lastExecutionHash:r.runtime.lastExecutionHash});
   });
   const inspectCleanup=()=>tracked(async()=>{
    const r=view(await send({op:'cleanup-inspect'}),['cleanup']);alive();const c=r.cleanup;
    const names=['close-deployment','verify-closed-deployment','remove-reader','verify-reader-removed','restore-original-guard','verify-original-guard','restore-thin-guard','verify-thin-guard','remove-testing-user','verify-testing-user-removed','revoke-token','verify-token-revoked','read-original-editor','read-original-versions','read-original-deployments','read-original-project','read-original-triggers'];
    if(!only(c,['version','cActions','iActions'])||![1,2,3].includes(c.version)||!Array.isArray(c.cActions)||!Array.isArray(c.iActions)||c.cActions.length>2||c.iActions.length>17||new Set(c.cActions).size!==c.cActions.length||new Set(c.iActions).size!==c.iActions.length||c.cActions.some(v=>!['restore-editor','read-restored-editor'].includes(v))||c.iActions.some(v=>!names.includes(v)))stop();
    return Object.freeze({source:'canonical-preparation-ledger',epoch,version:c.version,spent:r.spent,state:r.state,cActions:Object.freeze([...c.cActions]),iActions:Object.freeze([...c.iActions])});
   });
   const dispatchCompatibility=(descriptor,io)=>tracked(async()=>{
    idle();if(failed||stopRequested()||typeof io!=='function'||!only(descriptor,['entry','nativeMs','observedAt','credentialExpiresAt']))stop();admissionBusy=true;
    try{
     const d=Object.fromEntries(['entry','nativeMs','observedAt','credentialExpiresAt'].map(k=>[k,descriptor[k]]));
     if(!['wrapper','qualified'].includes(d.entry)||!integer(d.nativeMs)||d.nativeMs<0||d.nativeMs>540000||!integer(d.observedAt)||!integer(d.credentialExpiresAt))stop();
     const exchange=async op=>{alive();if(failed||stopRequested())stop();const t=now();if(!integer(t))stop();const r=view(await send({op,...d,now:t}),op==='rpc-begin'?['startedAt']:[]);alive();if(failed||r.state!=='ready'||stopRequested())stop();return r;};
     const before=now(),ready=await exchange('rpc-wait');if(ready.waitMs){await pause(ready.waitMs);alive();if(now()<before||(await exchange('rpc-wait')).waitMs!==0)stop();}
     const admitted=await exchange('rpc-begin');if(!integer(admitted.startedAt))stop();
     const p=Promise.resolve().then(()=>{alive();if(failed||stopRequested())stop();return io(admitted.startedAt);});enteredIO.add(p);
     try{const value=await p;eligibleEntry=d.entry;return Object.freeze({startedAt:admitted.startedAt,value});}finally{enteredIO.delete(p);}
    }finally{admissionBusy=false;}
   });
   const accountNative=descriptor=>tracked(async()=>{
    idle();if(pending!==1||!only(descriptor,['entry','totalMs','executionHash']))stop();const d=Object.fromEntries(['entry','totalMs','executionHash'].map(k=>[k,descriptor[k]]));
    if(!['wrapper','qualified'].includes(d.entry)||!integer(d.totalMs)||d.totalMs<0||d.totalMs>900000||!digest(d.executionHash))stop();const t=now();if(!integer(t))stop();view(await send({op:'native-account',...d,now:t}));alive();
   });
   const finishCompatibility=entry=>tracked(async()=>{
    idle();if(pending!==1||failed||stopRequested()||eligibleEntry!==entry||!['wrapper','qualified'].includes(entry))stop();const t=now();if(!integer(t))stop();const r=view(await send({op:'rpc-finish',entry,now:t}));alive();if(failed||r.state!=='ready'||stopRequested())stop();eligibleEntry=null;
   });
   const control=Object.freeze({inspectCleanup,waitForExternalReadSlot:units=>tracked(()=>{idle();return wait('ordinary',null,units);}),reserveExternalReads:units=>tracked(()=>{idle();return request('debit','ordinary',null,units);}),externalRead:(io,charge=null)=>tracked(()=>action('ordinary',policy.decisionHash?charge:null,io)),restoreOriginalEditor:(name,io)=>tracked(()=>action('C',name,io)),cleanup:(name,io)=>tracked(()=>action('I',name,io)),...(mode==='preparation'?{handoff}:{inspectRuntime,dispatchCompatibility,settlementRead:(io,charge=null)=>tracked(()=>action('S',charge,io)),accountNative,finishCompatibility})});
   const exited=()=>terminal||!child||child.exitCode!==null||child.signalCode!==null?Promise.resolve():terminalPromise;
   const fence=async()=>{
    if(!initialReady||stopFenced)return;
    if(child&&!ended)try{stopFenced=view(await send({op:'stop',kind:'ordinary',action:null,units:1,now:now()})).state==='stopped';}catch(_){}
    if(!stopFenced)try{await requestStop();}catch(_){}
   };
   try{
    const t=now();if(!integer(t))stop();
    const directory=lstatSync(dirname(path));
    if(!integer(userInfo().uid)||typeof constants.O_NOFOLLOW!=='number'||constants.O_NOFOLLOW<=0||!directory.isDirectory()||directory.uid!==userInfo().uid||(directory.mode&0o7777)!==0o700)stop();
    lockFd=openSync(path+'.lock',constants.O_RDWR|constants.O_CREAT|constants.O_NOFOLLOW,0o600);
    const lock=fstatSync(lockFd);
    if(!lock.isFile()||lock.uid!==userInfo().uid||(lock.mode&0o7777)!==0o600||lock.size!==0)stop();
    // Python acquires flock on the same open-file description. Retain this
    // descriptor until both entered IO and the original child have settled.
    child=spawn('python3',[fileURLToPath(new URL('./read-authority-preparation-budget.py',import.meta.url)),'--inherited-lock'],{stdio:['pipe','pipe','pipe',lockFd],env:{PATH:'/opt/homebrew/bin:/usr/bin:/bin',LANG:'C',TZ:'Asia/Taipei'}});
    child.on('error',()=>{failed=true;ended=true;if(child.pid===undefined)markTerminal();for(const p of waiting.splice(0))p.reject(Error('TRIAL_STOPPED'));});
    // A broken input pipe stops protocol admission, not ownership of the child
    // or an entered IO callback. The existing finalizer still drains both.
    child.stdin.on('error',()=>{failed=true;ended=true;for(const p of waiting.splice(0))p.reject(Error('TRIAL_STOPPED'));});
    child.on('close',markTerminal);child.on('exit',(code,signal)=>{if(!finishAcknowledged||code!==0||signal!==null)failed=true;markTerminal();ended=true;for(const p of waiting.splice(0))p.reject(Error('TRIAL_STOPPED'));});
    child.stderr.on('data',()=>{});child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{
     buffer+=chunk;if(buffer.length>100000){ended=true;child.kill('SIGTERM');return;}
     while(buffer.includes('\n')){const i=buffer.indexOf('\n'),line=buffer.slice(0,i);buffer=buffer.slice(i+1);const p=waiting.shift();if(!p){ended=true;child.kill('SIGTERM');return;}try{p.resolve(JSON.parse(line));}catch(_){p.reject(Error('TRIAL_STOPPED'));}}
    });
    const initial=await send({path,epoch,binding,approvalHash,proposalHash,legacySha256,importedReads,expiresAt,...policy,now:t,mode,...(mode==='runtime'?{runtimeBinding}:{})});if(initial.ok!==true)stop();initialReady=true;
    result=await callback(control);if(pending!==0||failed)stop();
   }catch(_){scopeFailed=true;await fence();}
   finally{
    active=false;
    await Promise.allSettled([...enteredIO]);
    if(child&&!ended)try{
     const r=await send({op:'finish'});
     if(!only(r,['ok','finished'])||r.ok!==true||r.finished!==true)stop();
     finishAcknowledged=true;
    }catch(_){scopeFailed=true;}
    if(child){child.stdin.end();await Promise.race([exited(),delay(2000)]);if(!terminal&&child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await Promise.race([exited(),delay(2000)]);}if(!terminal&&child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exited();}}
    if(initialReady&&(failed||!finishAcknowledged||child.exitCode!==0||child.signalCode!==null))scopeFailed=true;
    if(scopeFailed)await fence();
    holderDrained=true;
    if(!initialReady||!scopeFailed||stopFenced)releaseOwnership();
    // Otherwise retain the canonical descriptor and busy original handle.
    // A later successful requestStop/stopAndDrain releases it after durable ACK.
   }
   if(scopeFailed)stop();return result;
  };
  return Object.freeze({withPreparation:callback=>scope('preparation',null,callback),withRuntime:(runtimeBinding,callback)=>scope('runtime',runtimeBinding,callback),requestStop,stopAndDrain});
 }catch(_){stop();}
}
