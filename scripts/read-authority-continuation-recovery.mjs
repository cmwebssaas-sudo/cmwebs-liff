// Independent C2/I17 only. New journal integrity never creates recovery authority.
// A real retained owner handle is captured/drained, followed by a full60s quiet
// interval, before the unchanged original copied control acquires its own flock.
import {mkdirSync,lstatSync,readFileSync,readdirSync,openSync,closeSync,writeSync,fsyncSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {userInfo,homedir} from 'node:os';
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
const denied=()=>{const p=Promise.reject(Error('TRIAL_STOPPED'));void p.catch(()=>{});return p;};
const scriptResourceKeys=['scriptReaderPath','originalScriptId'];
const resourceKeys=Object.freeze(['epoch','expiresAt','thinScriptId','publisherHash','syntheticSheetId','originalSheetId','callerHash','fixtureHash','thinOriginalSourceHash','thinPath','readerPath']);
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
function standaloneSelection(input,originalCopy){
 if(!exact(input,['copy','resources']))stop();const copy=pinned(input.copy),resources=input.resources;
 const hasScript=Object.hasOwn(resources,'scriptReaderPath')||Object.hasOwn(resources,'originalScriptId');
 if(copy.path===originalCopy.path||!exact(resources,[...resourceKeys,...(hasScript?scriptResourceKeys:[])]))stop();verifyAuthorityTrialRollback(copy);
 const selected=lstatSync(copy.path),original=lstatSync(originalCopy.path);if(selected.dev===original.dev&&selected.ino===original.ino)stop();
 const id=v=>typeof v==='string'&&/^[-A-Za-z0-9_]{20,200}$/.test(v);
 if(!['epoch','thinScriptId','syntheticSheetId','originalSheetId'].every(k=>id(resources[k]))||resources.syntheticSheetId===resources.originalSheetId||!integer(resources.expiresAt)||resources.expiresAt<=0||!['publisherHash','callerHash','fixtureHash','thinOriginalSourceHash'].every(k=>digest(resources[k]))||resources.callerHash===resources.publisherHash)stop();
 for(const key of ['thinPath','readerPath'])if(typeof resources[key]!=='string'||resolve(resources[key])!==resources[key])stop();
 if(resources.thinPath===resources.readerPath)stop();
 if(hasScript&&(!id(resources.originalScriptId)||resources.originalScriptId===resources.thinScriptId||typeof resources.scriptReaderPath!=='string'||resolve(resources.scriptReaderPath)!==resources.scriptReaderPath||[resources.thinPath,resources.readerPath].includes(resources.scriptReaderPath)))stop();return {copy,resources};
}
function manifestAt(input){
 const ref=pinned(input);dir(dirname(ref.path));dir(ref.path);dir(join(ref.path,'scripts'));
 if(readdirSync(ref.path).sort().join(',')!=='manifest.json,scripts'||readdirSync(join(ref.path,'scripts')).sort().join(',')!==files.map(v=>v.slice(8)).sort().join(','))stop();
 const bytes=read(join(ref.path,'manifest.json'),true,20000);if(hash(bytes)!==ref.sha256)stop();const m=JSON.parse(bytes);
 if(!exact(m,['source','policy','originalCopy','files',...(Object.hasOwn(m,'standalone')?['standalone']:[])])||m.source!=='fixed-authority-continuation-recovery-runtime'||!same(m.policy,policy)||!exact(m.files,files))stop();
 for(const name of files){const bytes=read(join(ref.path,name)),pin=m.files[name];if(!exact(pin,['sha256','size'])||!digest(pin.sha256)||!integer(pin.size)||pin.size!==bytes.length||hash(bytes)!==pin.sha256)stop();}
 const originalCopy=pinned(m.originalCopy);verifyAuthorityTrialRollback(originalCopy);if(Object.hasOwn(m,'standalone'))standaloneSelection(m.standalone,originalCopy);return {ref,manifest:m};
}
export function verifyAuthorityContinuationRecovery(input){
 try{const {ref}=manifestAt(data(input));return Object.freeze({source:'fixed-authority-continuation-recovery-runtime',...ref,...policy,trialAccepted:false,rollbackComplete:false});}catch(_){stop();}
}
// The original copy is produced by buildAuthorityTrialRollback and is never
// rewritten. This new graph copies only its verified bootstrap dependencies.
export function buildAuthorityContinuationRecovery(input){
 try{
  input=data(input);if(!exact(input,['path','originalCopy',...(Object.hasOwn(input,'standalone')?['standalone']:[])])||typeof input.path!=='string')stop();const originalCopy=pinned(input.originalCopy);verifyAuthorityTrialRollback(originalCopy);
  const standalone=Object.hasOwn(input,'standalone')?standaloneSelection(input.standalone,originalCopy):null;
  const path=resolve(input.path);dir(dirname(path));const buffers=new Map();
  buffers.set(files[0],read(fileURLToPath(import.meta.url),false));
  for(const name of files.slice(1))buffers.set(name,read(join(originalCopy.path,name)));
  const manifest={source:'fixed-authority-continuation-recovery-runtime',policy,originalCopy,files:Object.fromEntries(files.map(name=>[name,{size:buffers.get(name).length,sha256:hash(buffers.get(name))}])),...(standalone?{standalone}:{})};
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
  const contexts=new WeakMap();let standaloneModules;
  if(manifest.standalone){
   const base=manifest.standalone.copy.path,module=name=>import(pathToFileURL(join(base,'scripts/'+name+'.mjs')).href);
   const thin=await module('read-authority-trial-thin'),reader=await module('read-authority-trial-reader'),generator=await module('build-read-authority-trial-entry');check();
   if(typeof thin.createStandaloneAuthorityTrialPublication!=='function'||typeof reader.createAuthorityTrialReader!=='function'||typeof generator.buildStandaloneAuthorityTrialArtifacts!=='function')stop();
   const bundle=generator.buildStandaloneAuthorityTrialArtifacts(),wrapper=[{name:'AuthorityTrial',type:'SERVER_JS',source:bundle.source},{name:'appsscript',type:'JSON',source:JSON.stringify(bundle.manifest)}];
   standaloneModules={thin:thin.createStandaloneAuthorityTrialPublication,reader:reader.createAuthorityTrialReader,wrapperHash:hash(JSON.stringify(canonical(wrapper.sort((a,b)=>a.name.localeCompare(b.name))))),...(manifest.standalone.resources.scriptReaderPath?{scriptReader:reader.createAuthorityStandaloneScriptReader}:{})};if(manifest.standalone.resources.scriptReaderPath&&typeof standaloneModules.scriptReader!=='function')stop();check();
  }
  const adapter=name=>input=>{
   try{
    if(!input||typeof input!=='object'||types.isProxy(input))stop();const d=Object.getOwnPropertyDescriptor(input,'control');if(!d||!Object.hasOwn(d,'value'))stop();const ctx=contexts.get(d.value);if(!ctx||ctx.kind==='script')stop();ctx.guard();
    const copied={...input,control:ctx.oldCap},api=legacy[name](copied);
    return Object.freeze(Object.fromEntries(Object.keys(api).map(method=>[method,(...args)=>{try{ctx.guard();return api[method](...args);}catch(_){ctx.failed=true;stop();}}])));
   }catch(_){stop();}
  };
  const standaloneAdapter=kind=>input=>{
   try{
    if(!standaloneModules||!input||typeof input!=='object'||types.isProxy(input))stop();const options={};
    const allowed=kind==='thin'?['path','epoch','scriptId','publisherHash','originalFiles','originalSourceHash','backupReceipt','expiresAt','control','credential','fetcher','now']:['path','epoch','originalSheetId','syntheticSheetId','callerEmail','callerHash','publisherHash','fixtureHash','expiresAt','creationReceipt','metadata','control','credential','fetcher','now'];
    for(const key of Reflect.ownKeys(Object.getOwnPropertyDescriptors(input))){const d=Object.getOwnPropertyDescriptor(input,key);if(typeof key!=='string'||!allowed.includes(key)||!d.enumerable||!Object.hasOwn(d,'value'))stop();options[key]=['control','credential','fetcher','now','metadata'].includes(key)?d.value:data(d.value);}
    const ctx=contexts.get(options.control);if(!ctx||ctx.kind==='script')stop();ctx.guard();const fixed=manifest.standalone.resources;
    const pins={epoch:fixed.epoch,expiresAt:fixed.expiresAt,publisherHash:fixed.publisherHash,path:fixed[kind+'Path'],...(kind==='thin'?{scriptId:fixed.thinScriptId,originalSourceHash:fixed.thinOriginalSourceHash}:{originalSheetId:fixed.originalSheetId,syntheticSheetId:fixed.syntheticSheetId,callerHash:fixed.callerHash,fixtureHash:fixed.fixtureHash})};
    if(Object.entries(pins).some(([k,v])=>options[k]!==v))stop();
    let expected;
    if(kind==='thin')expected=hash(JSON.stringify(canonical({epoch:fixed.epoch,scriptId:fixed.thinScriptId,entryKind:'standalone',publisherHash:fixed.publisherHash,originalSourceHash:fixed.thinOriginalSourceHash,expiresAt:fixed.expiresAt,backup:options.backupReceipt,wrapperHash:standaloneModules.wrapperHash})));
    else expected=hash(JSON.stringify({epoch:fixed.epoch,originalSheetId:fixed.originalSheetId,syntheticSheetId:fixed.syntheticSheetId,callerHash:fixed.callerHash,publisherHash:fixed.publisherHash,fixtureHash:fixed.fixtureHash,expiresAt:fixed.expiresAt,creation:options.creationReceipt}));
    const record=path=>{dir(dirname(path));const e=JSON.parse(read(path,true,20000));if(!exact(e,['value','sha256'])||hash(JSON.stringify(kind==='reader'?e.value:canonical(e.value)))!==e.sha256)stop();return e.value;};
    const registry=join(homedir(),'.codex','private','cmwebs-authority-trials',hash(JSON.stringify(fixed.epoch))+'.'+kind+'.json'),registration=record(registry),journal=record(pins.path);
    // Required before the constructor: no missing registry/journal may trigger
    // its ordinary initialization branch. Its semantic validator still runs.
    if(!exact(registration,['path','binding'])||registration.path!==pins.path||registration.binding!==expected||journal.binding!==expected)stop();
    const control=Object.freeze({externalRead:denied,cleanup:options.control.cleanup,restoreOriginalEditor:options.control.restoreOriginalEditor});
    const api=standaloneModules[kind]({...options,control,...(kind==='reader'?{metadata:Object.freeze({read:denied})}:{})}),keys=kind==='thin'?['status','stop','close','verifyClosed']:['status','remove','verifyRemoved'];
    return Object.freeze(Object.fromEntries(keys.map(key=>[key,(...args)=>{try{ctx.guard();return api[key](...args);}catch(_){ctx.failed=true;stop();}}])));
   }catch(_){stop();}
  };
  const scriptAdapter=input=>{
   try{
    if(!standaloneModules?.scriptReader||!input||typeof input!=='object'||types.isProxy(input))stop();const options={};
    const allowed=['path','epoch','scriptId','originalScriptId','callerEmail','callerHash','publisherHash','callerPermissionId','expiresAt','backupReceipt','control','credential','fetcher','now'];
    for(const key of Reflect.ownKeys(Object.getOwnPropertyDescriptors(input))){const d=Object.getOwnPropertyDescriptor(input,key);if(typeof key!=='string'||!allowed.includes(key)||!d.enumerable||!Object.hasOwn(d,'value'))stop();options[key]=['control','credential','fetcher','now'].includes(key)?d.value:data(d.value);}
    const ctx=contexts.get(options.control);if(!ctx||ctx.kind!=='script')stop();ctx.guard();const fixed=manifest.standalone.resources;
    const pins={path:fixed.scriptReaderPath,epoch:fixed.epoch,scriptId:fixed.thinScriptId,originalScriptId:fixed.originalScriptId,callerHash:fixed.callerHash,publisherHash:fixed.publisherHash,expiresAt:fixed.expiresAt};
    if(Object.entries(pins).some(([k,v])=>options[k]!==v)||!same(options.backupReceipt,{source:'fixed-trial-thin-empty-backup',epoch:fixed.epoch,scriptId:fixed.thinScriptId,publisherHash:fixed.publisherHash,sourceHash:fixed.thinOriginalSourceHash}))stop();
    const backupReceipt={source:options.backupReceipt.source,epoch:options.backupReceipt.epoch,scriptId:options.backupReceipt.scriptId,publisherHash:options.backupReceipt.publisherHash,sourceHash:options.backupReceipt.sourceHash};
    const expected=hash(JSON.stringify({mode:'standalone-script',epoch:options.epoch,scriptId:options.scriptId,originalScriptId:options.originalScriptId,callerHash:options.callerHash,publisherHash:options.publisherHash,callerPermissionId:options.callerPermissionId,expiresAt:options.expiresAt,backupReceipt}));
    const record=path=>{dir(dirname(path));const e=JSON.parse(read(path,true,20000));if(!exact(e,['value','sha256'])||hash(JSON.stringify(e.value))!==e.sha256)stop();return e.value;};
    const registry=join(homedir(),'.codex','private','cmwebs-authority-trials',hash(JSON.stringify(fixed.epoch))+'.script-reader.json'),registration=record(registry),journal=record(pins.path);
    if(!exact(registration,['path','binding','mode','scriptId','originalScriptId'])||registration.path!==pins.path||registration.binding!==expected||registration.mode!=='standalone-script'||registration.scriptId!==pins.scriptId||registration.originalScriptId!==pins.originalScriptId||journal.binding!==expected)stop();
    const api=standaloneModules.scriptReader({...options,control:Object.freeze({externalRead:denied,cleanup:options.control.cleanup})});
    return Object.freeze(Object.fromEntries(['status','remove','verifyRemoved'].map(key=>[key,(...args)=>{try{ctx.guard();return api[key](...args);}catch(_){ctx.failed=true;stop();}}])));
   }catch(_){stop();}
  };
  return Object.freeze({receipt,createReader:adapter('createReader'),createPublication:adapter('createPublication'),createThin:adapter('createThin'),...(standaloneModules?{createStandaloneThin:standaloneAdapter('thin'),createStandaloneReader:standaloneAdapter('reader'),...(standaloneModules.scriptReader?{createStandaloneScriptReader:scriptAdapter}:{})} :{}),createCleanup:input=>{
   try{
    // Trusted launcher input: capture the actual source-pinned factory result.
    // JSON/receipts and disk markers never supply a replacement owner.
    const selected=inputOptions(input),owner=selected.owner;
    if(!owner||typeof owner!=='object'||types.isProxy(owner)||!Object.isFrozen(owner))stop();const d=Object.getOwnPropertyDescriptor(owner,'stopAndDrain');if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function')stop();const drain=d.value;const scriptDescriptor=Object.getOwnPropertyDescriptor(owner,'withScriptCleanup'),scriptScope=scriptDescriptor&&Object.hasOwn(scriptDescriptor,'value')&&typeof scriptDescriptor.value==='function'?scriptDescriptor.value:null;
    const originalDescriptor=Object.getOwnPropertyDescriptor(owner,'withOriginalCleanup'),originalScope=originalDescriptor&&Object.hasOwn(originalDescriptor,'value')&&typeof originalDescriptor.value==='function'?originalDescriptor.value:null;
    const original=data(selected.originalOptions),now=selected.now??Date.now,pause=selected.pause??delay;
    if(!exact(original,['path','epoch','approvalHash','proposalHash','legacySha256','importedReads','expiresAt','decisionHash','nativeTargets'])||typeof now!=='function'||typeof pause!=='function')stop();let busy=false;
    return Object.freeze({withCleanup:async callback=>{
     if(busy||typeof callback!=='function')stop();busy=true;
     try{
      const work=async()=>{
      check();captured(await drain.call(owner));check();const start=now();if(!integer(start))stop();await pause(60000);const end=now();if(!integer(end)||end-start<60000)stop();check();
      // Existing loader revalidates original claim/binding/checkpoint before its
      // control can construct a child. That control alone owns the original lock.
      const control=legacy.createCleanupControl({...original,now,pause});
      return await control.withPreparationCleanup(async oldCap=>{
       const ctx={oldCap,active:true,failed:false,guard:()=>{try{if(!ctx.active)stop();check();}catch(_){ctx.failed=true;stop();}}};
       const cap=Object.freeze(Object.fromEntries(['restoreOriginalEditor','cleanup','inspectCleanup'].map(name=>[name,(...args)=>{try{
        ctx.guard();
        // Original admission awaits its durable debit. Recheck both frozen
        // graphs at actual IO entry; an admitted UNKNOWN is never refunded.
        if(name!=='inspectCleanup'&&typeof args[1]==='function'){const io=args[1];args[1]=(...values)=>{ctx.guard();return io(...values);};}
        return oldCap[name](...args);
       }catch(_){ctx.failed=true;const p=Promise.reject(Error('TRIAL_STOPPED'));void p.catch(()=>{});return p;}}])));contexts.set(cap,ctx);
       try{const result=await callback(cap);ctx.guard();if(ctx.failed)stop();return result;}finally{ctx.active=false;}
      });
      };
      return await (originalScope?originalScope.call(owner,work):work());
     }catch(_){stop();}finally{busy=false;}
    },...(standaloneModules?.scriptReader&&scriptScope?{withScriptCleanup:async callback=>{
     if(busy||typeof callback!=='function')stop();busy=true;
     try{
      check();captured(await drain.call(owner));check();const start=now();if(!integer(start))stop();await pause(60000);const end=now();if(!integer(end)||end-start<60000)stop();check();
      return await scriptScope.call(owner,async ownerCap=>{
       const ctx={kind:'script',active:true,failed:false,guard:()=>{try{if(!ctx.active)stop();check();}catch(_){ctx.failed=true;stop();}}};
       const cap=Object.freeze({cleanup:(action,io)=>{try{ctx.guard();if(typeof io!=='function')stop();return ownerCap.cleanup(action,(...values)=>{ctx.guard();return io(...values);});}catch(_){ctx.failed=true;return denied();}}});contexts.set(cap,ctx);
       try{const result=await callback(cap);ctx.guard();if(ctx.failed)stop();return result;}finally{ctx.active=false;}
      });
     }catch(_){stop();}finally{busy=false;}
    }}:{})});
   }catch(_){stop();}
  }});
 }catch(_){stop();}
}
