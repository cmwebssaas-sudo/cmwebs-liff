// Independent C2/I17 only. New journal integrity never creates recovery authority.
// A real retained owner handle is captured/drained, followed by a full60s quiet
// interval, before the unchanged original copied control acquires its own flock.
import {mkdirSync,lstatSync,readFileSync,readdirSync,openSync,closeSync,writeSync,fsyncSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {userInfo} from 'node:os';
import {types} from 'node:util';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {verifyAuthorityTrialRollback,loadAuthorityTrialRollback} from './read-authority-trial-rollback.mjs';
const stop=()=>{throw Error('TRIAL_STOPPED');};
const hash=v=>createHash('sha256').update(v).digest('hex'),digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),integer=Number.isSafeInteger;
const files=Object.freeze(['scripts/read-authority-continuation-recovery.mjs','scripts/read-authority-trial-budget-plan.mjs','scripts/read-authority-trial-rollback.mjs']);
const policy=Object.freeze({formatVersion:1,cleanupOnly:true,requiresCapturedOwner:true,minimumCooldownMs:60000});
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function data(v){
 let count=0;const active=new Set();
 const copy=(v,depth)=>{
  if(++count>500||depth>6)stop();if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return v;
  if(typeof v!=='object'||types.isProxy(v)||active.has(v)||(!Array.isArray(v)&&![Object.prototype,null].includes(Object.getPrototypeOf(v))))stop();active.add(v);
  const out=Array.isArray(v)?[]:{},descriptors=Object.getOwnPropertyDescriptors(v);
  for(const key of Reflect.ownKeys(descriptors)){if(Array.isArray(v)&&key==='length')continue;const d=descriptors[key];if(typeof key!=='string'||!d.enumerable||!Object.hasOwn(d,'value'))stop();Object.defineProperty(out,key,{value:copy(d.value,depth+1),enumerable:true});}
  if(Array.isArray(v)&&Object.keys(out).length!==v.length)stop();active.delete(v);return Object.freeze(out);
 };return copy(v,0);
}
function dir(path,privateMode=true){const s=lstatSync(path);if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==userInfo().uid||privateMode&&(s.mode&0o7777)!==0o700)stop();}
function read(path,privateMode=true,max=1000000){const s=lstatSync(path);if(!s.isFile()||s.isSymbolicLink()||s.uid!==userInfo().uid||s.nlink!==1||s.size>max||privateMode&&(s.mode&0o7777)!==0o600)stop();return readFileSync(path);}
function synced(path,bytes){const fd=openSync(path,'wx',0o600);try{writeSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}}
function syncDir(path){const fd=openSync(path,'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
function pinned(input){
 if(!exact(input,['path','sha256'])||typeof input.path!=='string'||!digest(input.sha256))stop();return Object.freeze({path:resolve(input.path),sha256:input.sha256});
}
function manifestAt(input){
 const ref=pinned(input);dir(dirname(ref.path));dir(ref.path);dir(join(ref.path,'scripts'));
 if(readdirSync(ref.path).sort().join(',')!=='manifest.json,scripts'||readdirSync(join(ref.path,'scripts')).sort().join(',')!==files.map(v=>v.slice(8)).sort().join(','))stop();
 const bytes=read(join(ref.path,'manifest.json'),true,20000);if(hash(bytes)!==ref.sha256)stop();const m=JSON.parse(bytes);
 if(!exact(m,['source','policy','originalCopy','files'])||m.source!=='fixed-authority-continuation-recovery-runtime'||!same(m.policy,policy)||!exact(m.files,files))stop();
 for(const name of files){const bytes=read(join(ref.path,name)),pin=m.files[name];if(!exact(pin,['sha256','size'])||!digest(pin.sha256)||!integer(pin.size)||pin.size!==bytes.length||hash(bytes)!==pin.sha256)stop();}
 verifyAuthorityTrialRollback(pinned(m.originalCopy));return {ref,manifest:m};
}
export function verifyAuthorityContinuationRecovery(input){
 try{const {ref}=manifestAt(data(input));return Object.freeze({source:'fixed-authority-continuation-recovery-runtime',...ref,...policy,trialAccepted:false,rollbackComplete:false});}catch(_){stop();}
}
// The original copy is produced by buildAuthorityTrialRollback and is never
// rewritten. This new graph copies only its verified bootstrap dependencies.
export function buildAuthorityContinuationRecovery(input){
 try{
  input=data(input);if(!exact(input,['path','originalCopy'])||typeof input.path!=='string')stop();const originalCopy=pinned(input.originalCopy);verifyAuthorityTrialRollback(originalCopy);
  const path=resolve(input.path);dir(dirname(path));const buffers=new Map();
  buffers.set(files[0],read(fileURLToPath(import.meta.url),false));
  for(const name of files.slice(1))buffers.set(name,read(join(originalCopy.path,name)));
  const manifest={source:'fixed-authority-continuation-recovery-runtime',policy,originalCopy,files:Object.fromEntries(files.map(name=>[name,{size:buffers.get(name).length,sha256:hash(buffers.get(name))}]))};
  mkdirSync(path,{mode:0o700});mkdirSync(join(path,'scripts'),{mode:0o700});for(const [name,bytes] of buffers)synced(join(path,name),bytes);
  const bytes=Buffer.from(JSON.stringify(canonical(manifest))+'\n');synced(join(path,'manifest.json'),bytes);syncDir(join(path,'scripts'));syncDir(path);syncDir(dirname(path));return verifyAuthorityContinuationRecovery({path,sha256:hash(bytes)});
 }catch(_){stop();}
}
function inputOptions(input){
 if(!input||typeof input!=='object'||types.isProxy(input))stop();const out={};
 for(const key of Reflect.ownKeys(Object.getOwnPropertyDescriptors(input))){const d=Object.getOwnPropertyDescriptor(input,key);if(typeof key!=='string'||!['owner','originalOptions','now','pause'].includes(key)||!d.enumerable||!Object.hasOwn(d,'value'))stop();out[key]=d.value;}
 if(!Object.hasOwn(out,'owner')||!Object.hasOwn(out,'originalOptions'))stop();return out;
}
function captured(receipt){
 receipt=data(receipt);
 if(!exact(receipt,['source','stopRequested','stopAcknowledged','ordinaryScopeClosed','ownedScope','remoteExecutionSettled','trialAccepted','rollbackComplete'])||receipt.source!=='canonical-continuation-holder'||receipt.stopRequested!==true||typeof receipt.stopAcknowledged!=='boolean'||receipt.ordinaryScopeClosed!==true||!exact(receipt.ownedScope,['serial','state'])||!integer(receipt.ownedScope.serial)||receipt.ownedScope.serial<1||receipt.ownedScope.state!=='SETTLED'||receipt.remoteExecutionSettled!==false||receipt.trialAccepted!==false||receipt.rollbackComplete!==false)stop();
 // STOP is a negative veto, not cleanup authority. A failed marker ACK cannot
 // undo actual captured drain of the permanently single-use ordinary scope.
 // The original copied ledger still supplies all C/I authorization and locks.
 return receipt;
}
export async function loadAuthorityContinuationRecovery(input){
 try{
  const {ref,manifest}=manifestAt(data(input)),receipt=verifyAuthorityContinuationRecovery(ref),check=()=>manifestAt(ref),legacy=await loadAuthorityTrialRollback(pinned(manifest.originalCopy));check();
  const contexts=new WeakMap();
  const adapter=name=>input=>{
   try{
    if(!input||typeof input!=='object'||types.isProxy(input))stop();const d=Object.getOwnPropertyDescriptor(input,'control');if(!d||!Object.hasOwn(d,'value'))stop();const ctx=contexts.get(d.value);if(!ctx)stop();ctx.guard();
    const copied={...input,control:ctx.oldCap},api=legacy[name](copied);
    return Object.freeze(Object.fromEntries(Object.keys(api).map(method=>[method,(...args)=>{try{ctx.guard();return api[method](...args);}catch(_){ctx.failed=true;stop();}}])));
   }catch(_){stop();}
  };
  return Object.freeze({receipt,createReader:adapter('createReader'),createPublication:adapter('createPublication'),createThin:adapter('createThin'),createCleanup:input=>{
   try{
    const selected=inputOptions(input),owner=selected.owner;
    if(!owner||typeof owner!=='object'||types.isProxy(owner)||!Object.isFrozen(owner))stop();const d=Object.getOwnPropertyDescriptor(owner,'stopAndDrain');if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function')stop();const drain=d.value;
    const original=data(selected.originalOptions),now=selected.now??Date.now,pause=selected.pause??delay;
    if(!exact(original,['path','epoch','approvalHash','proposalHash','legacySha256','importedReads','expiresAt','decisionHash','nativeTargets'])||typeof now!=='function'||typeof pause!=='function')stop();let busy=false;
    return Object.freeze({withCleanup:async callback=>{
     if(busy||typeof callback!=='function')stop();busy=true;
     try{
      check();captured(await drain.call(owner));check();const start=now();if(!integer(start))stop();await pause(60000);const end=now();if(!integer(end)||end-start<60000)stop();check();
      // Existing loader revalidates original claim/binding/checkpoint before its
      // control can construct a child. That control alone owns the original lock.
      const control=legacy.createCleanupControl({...original,now,pause});
      return await control.withPreparationCleanup(async oldCap=>{
       const ctx={oldCap,active:true,failed:false,guard:()=>{try{if(!ctx.active)stop();check();}catch(_){ctx.failed=true;stop();}}};
       const cap=Object.freeze(Object.fromEntries(['restoreOriginalEditor','cleanup','inspectCleanup'].map(name=>[name,(...args)=>{try{ctx.guard();return oldCap[name](...args);}catch(_){ctx.failed=true;const p=Promise.reject(Error('TRIAL_STOPPED'));void p.catch(()=>{});return p;}}])));contexts.set(cap,ctx);
       try{const result=await callback(cap);ctx.guard();if(ctx.failed)stop();return result;}finally{ctx.active=false;}
      });
     }catch(_){stop();}finally{busy=false;}
    }});
   }catch(_){stop();}
  }});
 }catch(_){stop();}
}
