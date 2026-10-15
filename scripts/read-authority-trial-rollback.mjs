// Fixed private source snapshot. No credentials, counter seed, live IO or RPC.
import {mkdirSync,lstatSync,readFileSync,readdirSync,openSync,closeSync,writeSync,fsyncSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {homedir,userInfo} from 'node:os';
import {createHash} from 'node:crypto';
import {NATIVE_IO_DECISION_HASH,normalizeAuthorityNativeTargets} from './read-authority-trial-budget-plan.mjs';
const stop=()=>{throw Error('TRIAL_STOPPED');};
const denied=()=>{const p=Promise.reject(Error('TRIAL_STOPPED'));void p.catch(()=>{});return p;};
const hash=v=>createHash('sha256').update(v).digest('hex');
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const only=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const files=Object.freeze([
 'scripts/read-authority-preparation-budget.py','scripts/read-authority-preparation-control.mjs','scripts/read-authority-phase-control.mjs','scripts/read-authority-trial-orchestrator.mjs','scripts/read-authority-trial-rollback.mjs',
 'scripts/read-authority-trial-import.mjs','scripts/read-authority-trial-reader.mjs','scripts/read-authority-trial-publication.mjs','scripts/read-authority-trial-thin.mjs','scripts/read-authority-trial-oauth.mjs','scripts/read-authority-trial-metadata.mjs','scripts/read-authority-trial-driver.mjs','scripts/read-authority-trial-budget-plan.mjs',
 'scripts/read-authority-native-capture.mjs','scripts/read-authority-native-producer.mjs','scripts/read-authority-native-snapshot.mjs','scripts/build-read-authority-trial-entry.mjs','scripts/build-read-authority-trial-closure.mjs','scripts/templates/read-authority-trial-adapter.js',
 ...['V2_RUNTIME_SNAPSHOT','V2_WORKSPACES','V2_WORKSPACE_LANDLORD_ACCESS','V2_LANDLORD_EMAIL_AUTH','V2_LINE_IDENTITY','V2_READ_REPLICA_SCHEMA','V2_READ_REPLICA_SYNC','V2_READ_AUTHORIZATION'].map(name=>'apps-script/'+name+'.js'),
 'cloudflare/read-api/package.json','cloudflare/read-api/node_modules/acorn/package.json','cloudflare/read-api/node_modules/acorn/dist/acorn.js','cloudflare/read-api/node_modules/acorn/LICENSE'
].sort());
const dirs=new Set(['']);for(const f of files){let d=dirname(f);while(d!=='.'){dirs.add(d);d=dirname(d);}}
const policy=Object.freeze({formatVersion:1,ledgerVersions:Object.freeze([1,2,3]),cleanupOnly:true,limit:160,cleanupReserve:17,restoreReserve:2,acornVersion:'8.15.0'});
function dir(path,privateMode=true){const s=lstatSync(path);if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==userInfo().uid||(privateMode&&(s.mode&0o777)!==0o700))stop();}
function read(path,privateMode=true,max=1000000){const s=lstatSync(path);if(!s.isFile()||s.isSymbolicLink()||s.uid!==userInfo().uid||s.nlink!==1||s.size>max||(privateMode&&(s.mode&0o777)!==0o600))stop();return readFileSync(path);}
function under(root,name,privateMode){let d=dirname(name);while(d!=='.'){dir(join(root,d),privateMode);d=dirname(d);}return read(join(root,name),privateMode);}
function synced(path,bytes){const fd=openSync(path,'wx',0o600);try{writeSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}}
function syncDir(path){const fd=openSync(path,'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
function inventory(root){
 const seen=new Set();const visit=(folder,prefix)=>{dir(folder);for(const name of readdirSync(folder)){const rel=prefix?prefix+'/'+name:name,s=lstatSync(join(folder,name));if(s.isSymbolicLink())stop();if(s.isDirectory()){if(!dirs.has(rel))stop();visit(join(folder,name),rel);}else{if(!s.isFile()||(!files.includes(rel)&&rel!=='manifest.json'))stop();seen.add(rel);}}};visit(root,'');
 if(seen.size!==files.length+1||!seen.has('manifest.json')||files.some(f=>!seen.has(f)))stop();
}
export function verifyAuthorityTrialRollback(input){
 try{
  if(!only(input,['path','sha256'])||typeof input.path!=='string'||!digest(input.sha256))stop();const path=resolve(input.path);dir(dirname(path));dir(path);inventory(path);
  const bytes=read(join(path,'manifest.json'),true,30000);if(hash(bytes)!==input.sha256)stop();const manifest=JSON.parse(bytes);
  if(!only(manifest,['source','policy','files'])||manifest.source!=='fixed-authority-trial-rollback-runtime'||!same(manifest.policy,policy)||!only(manifest.files,files))stop();
  for(const name of files){const pin=manifest.files[name],bytes=under(path,name,true);if(!only(pin,['sha256','size'])||!digest(pin.sha256)||!Number.isSafeInteger(pin.size)||pin.size!==bytes.length||hash(bytes)!==pin.sha256)stop();}
  const acorn=JSON.parse(under(path,'cloudflare/read-api/node_modules/acorn/package.json',true));if(acorn.name!=='acorn'||acorn.version!==policy.acornVersion||acorn.main!=='dist/acorn.js')stop();
  return Object.freeze({source:manifest.source,path,sha256:input.sha256,formatVersion:1,ledgerVersion:3,cleanupOnly:true,trialAccepted:false,rollbackComplete:false});
 }catch(_){stop();}
}
export function buildAuthorityTrialRollback(input){
 try{
  if(!only(input,['path'])||typeof input.path!=='string')stop();const path=resolve(input.path),root=fileURLToPath(new URL('../',import.meta.url));dir(dirname(path));dir(root,false);
  const buffers=new Map();for(const name of files)buffers.set(name,under(root,name,false));const acorn=JSON.parse(buffers.get('cloudflare/read-api/node_modules/acorn/package.json'));if(acorn.name!=='acorn'||acorn.version!==policy.acornVersion||acorn.main!=='dist/acorn.js')stop();
  const manifest={source:'fixed-authority-trial-rollback-runtime',policy,files:Object.fromEntries(files.map(name=>[name,{sha256:hash(buffers.get(name)),size:buffers.get(name).length}]))};
  mkdirSync(path,{mode:0o700});for(const d of [...dirs].filter(Boolean).sort((a,b)=>a.split('/').length-b.split('/').length||a.localeCompare(b)))mkdirSync(join(path,d),{mode:0o700});
  for(const name of files)synced(join(path,name),buffers.get(name));const bytes=Buffer.from(JSON.stringify(canonical(manifest))+'\n');synced(join(path,'manifest.json'),bytes);
  for(const d of [...dirs].sort((a,b)=>b.split('/').length-a.split('/').length))syncDir(join(path,d));syncDir(dirname(path));return verifyAuthorityTrialRollback({path,sha256:hash(bytes)});
 }catch(_){stop();}
}
function existingCounter(input){
 const path=resolve(input.path);dir(dirname(path));const value=JSON.parse(read(path,true,128000)),p=value.preparation;
 if(!p||![1,2,3].includes(p.version))stop();const binding=hash(JSON.stringify({path,epoch:input.epoch,approvalHash:input.approvalHash,proposalHash:input.proposalHash,legacySha256:input.legacySha256,importedReads:input.importedReads,expiresAt:input.expiresAt,...(Object.hasOwn(input,'decisionHash')?{decisionHash:input.decisionHash}:{}),...(input.decisionHash===NATIVE_IO_DECISION_HASH?{nativeTargets:normalizeAuthorityNativeTargets(input.nativeTargets)}:{})}));
 const record=path=>{dir(dirname(path));const e=JSON.parse(read(path,true,128000));if(!only(e,['value','sha256'])||hash(JSON.stringify(canonical(e.value)))!==e.sha256)stop();return e.value;};
 const claim=record(path+'.preparation-claim.json');if(!same(claim,{path,epoch:input.epoch,binding}))stop();
 const registry=join(homedir(),'.codex','private','cmwebs-authority-trials',hash(JSON.stringify(input.epoch))+'.preparation.json'),reg=record(registry);
 if(!only(reg,['path','binding','checkpoint'])||reg.path!==path||reg.binding!==binding||!same(reg.checkpoint,value)||p.binding!==binding)stop();
 // Existence is an admission prerequisite, never proof that a holder is absent.
 read(path+'.lock',true,0);return path;
}
export async function loadAuthorityTrialRollback(input){
 try{
  const receipt=verifyAuthorityTrialRollback(input),check=()=>verifyAuthorityTrialRollback({path:receipt.path,sha256:receipt.sha256});
  const module=name=>import(pathToFileURL(join(receipt.path,'scripts/'+name+'.mjs')).href);
  const core=await module('read-authority-preparation-control'),phaseApi=await module('read-authority-phase-control'),reader=await module('read-authority-trial-reader'),publication=await module('read-authority-trial-publication'),thin=await module('read-authority-trial-thin');check();
  const contexts=new WeakMap();
  const adapter=(kind,create,keys)=>input=>{
   try{const options={...input},ctx=contexts.get(options.control);if(!ctx)stop();ctx.guard();
   if(options.epoch!==ctx.options.epoch||options.expiresAt!==ctx.options.expiresAt||typeof options.path!=='string')stop();
   const journalPath=resolve(options.path),registry=join(homedir(),'.codex','private','cmwebs-authority-trials',hash(JSON.stringify(options.epoch))+'.'+kind+'.json');
   // Preserve each existing adapter's format; recovery never rewrites records.
   const record=path=>{dir(dirname(path));const e=JSON.parse(read(path,true,20000));if(!only(e,['value','sha256'])||hash(JSON.stringify(kind==='reader'?e.value:canonical(e.value)))!==e.sha256)stop();return e.value;};
   const registration=record(registry),journal=record(journalPath);if(!only(registration,['path','binding'])||registration.path!==journalPath||!digest(registration.binding)||journal.binding!==registration.binding)stop();
   // Constructors need an external method shape; recovery supplies a denial,
   // never ordinary authority. Existing registration is mandatory before them.
   const control=Object.freeze({externalRead:denied,cleanup:options.control.cleanup,restoreOriginalEditor:options.control.restoreOriginalEditor});
   const api=create({...options,control});return Object.freeze(Object.fromEntries(keys.map(key=>[key,(...args)=>{ctx.guard();if(kind==='publication'&&key==='readOriginal'){if(args.length!==1)stop();return api.readOriginal(args[0],control);}return api[key](...args);}])));
   }catch(_){stop();}
  };
  return Object.freeze({
   receipt,
   createReader:adapter('reader',reader.createAuthorityTrialReader,['status','remove','verifyRemoved']),
   createPublication:adapter('publication',publication.createAuthorityTrialPublication,['status','stop','restore','readOriginal']),
   createThin:adapter('thin',thin.createAuthorityTrialThin,['status','stop','close','verifyClosed']),
   createCleanupControl:input=>{
    try{check();const options={...input};existingCounter(options);const control=core.createAuthorityPreparationControl(options),phase=phaseApi.createAuthorityPhaseControl(control);
    const guarded=()=>{check();existingCounter(options);};
    const scope=async(binding,callback)=>{
     guarded();if(typeof callback!=='function')stop();const work=async cap=>{
      const ctx={options,active:true,failed:false,guard:()=>{try{if(!ctx.active)stop();guarded();}catch(_){ctx.failed=true;stop();}}};
      const scoped=Object.freeze(Object.fromEntries(['restoreOriginalEditor','cleanup','inspectCleanup',...(binding===null?[]:['inspectRuntime','settlementRead','accountNative'])].map(name=>[name,(...args)=>{try{ctx.guard();return cap[name](...args);}catch(_){return denied();}}])));contexts.set(scoped,ctx);
      try{const value=await callback(scoped);if(ctx.failed)stop();return value;}finally{ctx.active=false;}
     };
     return binding===null?await phase.withPreparationCleanup(work):await phase.withCleanup(binding,work);
    };
    return Object.freeze({requestStop:async()=>{guarded();return control.requestStop();},stopAndDrain:async()=>{guarded();return control.stopAndDrain();},withPreparationCleanup:callback=>scope(null,callback),withRuntimeCleanup:(binding,callback)=>scope(binding,callback)});
    }catch(_){stop();}
   }
  });
 }catch(_){stop();}
}
