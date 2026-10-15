// Local control library. Observers must supply actual Google readback, not VM
// evidence. No account, token, trigger, deployment or automatic retry is created.
import {openSync,closeSync,writeSync,fsyncSync,lstatSync,readFileSync,renameSync,unlinkSync,mkdirSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {homedir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {types} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {SINGLE_WRAPPER_TRIAL_DECISION_HASH,SINGLE_WRAPPER_TRIAL_OPERATIONS,NATIVE_IO_DECISION_HASH,getAuthorityTrialPolicy} from './read-authority-trial-budget-plan.mjs';
export const AUTHORITY_TRIAL_SCOPES=Object.freeze(['https://www.googleapis.com/auth/spreadsheets.readonly','https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/script.external_request']);
const stop=()=>{throw Error('TRIAL_STOPPED');};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const keys=(a,list)=>a&&typeof a==='object'&&!Array.isArray(a)&&Object.keys(a).sort().join(',')===[...list].sort().join(',');
const day=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const pinKeys=['deploymentId','thinScriptId','libraryId','libraryVersion','librarySourceHash','thinSourceHash','libraryManifestHash','thinManifestHash','originalEditorHash','originalDeploymentsHash','originalCloudProject','trialEpoch','syntheticSheetId','callerHash','publisherHash','oauthClientHash','newCloudProject','sheetContractHash'];
function validateExpected(e){
 if(!keys(e,pinKeys)||!Number.isSafeInteger(e.libraryVersion)||e.libraryVersion<1)stop();
 for(const key of pinKeys.filter(k=>k!=='libraryVersion'))if(typeof e[key]!=='string'||!(/Hash$/.test(key)?/^[a-f0-9]{64}$/:/^[-A-Za-z0-9_]{1,200}$/).test(e[key]))stop();
 if(e.callerHash===e.publisherHash||e.newCloudProject===e.originalCloudProject)stop();
}
export function verifyAuthorityTrialReadback(expected,observed){
 validateExpected(expected);
 if(!observed||pinKeys.some(k=>observed[k]!==expected[k])||!same([...observed.scopes||[]].sort(),[...AUTHORITY_TRIAL_SCOPES].sort())||
 observed.developmentMode!==false||observed.executionAccess!=='ANYONE'||observed.oauthStatus!=='TESTING'||observed.testingUsers!==1||
 observed.callerSheetRole!=='reader'||observed.callerLibraryRole!=='none'||observed.callerPropertiesMatch!==true||observed.libraryPropertiesMatch!==true||observed.originalTriggers!==0||observed.originalEditorRestored!==true||
 !Array.isArray(observed.retainedVersions)||![1,2,3,4,5,6].every(v=>observed.retainedVersions.includes(v)))stop();
 return true;
}
const standalonePinKeys=['deploymentId','thinScriptId','standaloneVersion','thinSourceHash','thinManifestHash','originalScriptId','originalEditorHash','originalDeploymentsHash','originalCloudProject','trialEpoch','syntheticSheetId','callerHash','publisherHash','oauthClientHash','newCloudProject','sheetContractHash'];
// Standalone evidence is untrusted data, including when called outside a driver.
// Reject executable object hooks before reading pins or comparing any evidence.
function standaloneSnapshot(value){
 let count=0;const active=new Set();
 const copy=(v,depth)=>{
  if(++count>4000||depth>12)stop();
  if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return v;
  if(typeof v!=='object'||types.isProxy(v)||active.has(v)||(!Array.isArray(v)&&![Object.prototype,null].includes(Object.getPrototypeOf(v))))stop();
  active.add(v);const ds=Object.getOwnPropertyDescriptors(v),out=Array.isArray(v)?[]:{};
  if(Array.isArray(v)&&(Reflect.ownKeys(ds).length!==v.length+1||Object.keys(ds).some(k=>k!=='length'&&(!/^(?:0|[1-9]\d*)$/.test(k)||Number(k)>=v.length))))stop();
  for(const k of Reflect.ownKeys(ds)){if(Array.isArray(v)&&k==='length')continue;const d=ds[k];if(typeof k!=='string'||!d.enumerable||!Object.hasOwn(d,'value')||Array.isArray(v)&&!/^\d+$/.test(k))stop();Object.defineProperty(out,k,{value:copy(d.value,depth+1),enumerable:true});}
  if(Array.isArray(v)&&Object.keys(out).length!==v.length)stop();active.delete(v);return Object.freeze(out);
 };return copy(value,0);
}
function canonicalStandaloneExpected(expected){
 const e=standaloneSnapshot(expected);
 if(!keys(e,standalonePinKeys)||e.standaloneVersion!==1||e.originalScriptId===e.thinScriptId||e.callerHash===e.publisherHash||e.originalCloudProject===e.newCloudProject)stop();
 for(const k of standalonePinKeys.filter(k=>k!=='standaloneVersion'))if(typeof e[k]!=='string'||!(/Hash$/.test(k)?/^[a-f0-9]{64}$/:/^[-A-Za-z0-9_]{1,200}$/).test(e[k]))stop();
 return Object.freeze(Object.fromEntries(standalonePinKeys.map(k=>[k,e[k]])));
}
export function verifyAuthorityStandaloneReadback(expected,observed){
 try{
  const e=canonicalStandaloneExpected(expected),r=standaloneSnapshot(observed);
  if(!keys(r,[...standalonePinKeys,'scopes','developmentMode','executionAccess','oauthStatus','testingUsers','callerSheetRole','callerOriginalScriptRole','callerOriginalSheetRole','callerStandaloneScriptRole','callerPropertiesMatch','standaloneLibraryCount','standaloneTriggers','originalTriggers','originalEditorUnchanged','originalDeploymentsUnchanged','retainedVersions','observedAt'])||standalonePinKeys.some(k=>r[k]!==e[k])||
   !Array.isArray(r.scopes)||!same([...r.scopes].sort(),[...AUTHORITY_TRIAL_SCOPES].sort())||r.developmentMode!==false||r.executionAccess!=='ANYONE'||r.oauthStatus!=='TESTING'||r.testingUsers!==1||
   r.callerSheetRole!=='reader'||r.callerOriginalScriptRole!=='none'||r.callerOriginalSheetRole!=='none'||r.callerStandaloneScriptRole!=='reader'||r.callerPropertiesMatch!==true||
   r.standaloneLibraryCount!==0||r.standaloneTriggers!==0||r.originalTriggers!==0||r.originalEditorUnchanged!==true||r.originalDeploymentsUnchanged!==true||
   !Number.isSafeInteger(r.observedAt)||r.observedAt<0||!Array.isArray(r.retainedVersions)||r.retainedVersions.some(v=>!Number.isSafeInteger(v)||v<1)||new Set(r.retainedVersions).size!==r.retainedVersions.length||![1,2,3,4,5,6].every(v=>r.retainedVersions.includes(v)))stop();
  return true;
 }catch(_){stop();}
}
function proof(p,now,expected){
 // Native collectors must pre-debit actual navigation/reads with the scoped
 // control. This verifies proof fields, not IO wiring or Google UI coverage.
 if(!p||p.source!=='google-native-ui'||p.coverage!=='caller-and-publisher-all-projects'||!same(p.accountHashes,[expected.callerHash,expected.publisherHash])||!same(p.trialScriptIds,[expected.libraryId,expected.thinScriptId])||p.complete!==true||p.active!==0||p.day!==day(now)||
 !Number.isSafeInteger(p.observedAt)||p.observedAt>now+1000||now-p.observedAt>60000||!Number.isSafeInteger(p.totalMs)||p.totalMs<0||p.totalMs>900000)stop();
 // totalMs is native runtime of the fixed synthetic trial scripts on the Taipei
 // day, not runtime of unrelated existing projects. Account trigger quotas have
 // a distinct rolling24h window; preserve complete load evidence separately.
 if(!Array.isArray(p.accountUsage)||p.accountUsage.length!==2)stop();
 for(let i=0;i<2;i++){
  const a=p.accountUsage[i];
  if(!a||a.accountHash!==p.accountHashes[i]||!['consumer','workspace'].includes(a.accountType)||a.complete!==true||
   ![a.windowStartMs,a.windowEndMs,a.allProjectRuntimeMs,a.triggerRuntimeMs].every(Number.isSafeInteger)||
   a.windowEndMs-a.windowStartMs!==86400000||a.windowEndMs<p.observedAt||a.windowEndMs>now+1000||
   a.allProjectRuntimeMs<0||a.triggerRuntimeMs<0||a.triggerRuntimeMs>a.allProjectRuntimeMs)stop();
  // Workspace trial maturity is not inferred from a paid badge. Without actual
  // maturity proof use the lower consumer trigger quota even for Workspace.
  const quota=a.accountType==='workspace'&&a.workspaceQuotaMature===true?21600000:5400000;
  if(a.triggerRuntimeMs+360000>quota)stop();
 }
 if(p.accountUsage.reduce((sum,a)=>sum+a.allProjectRuntimeMs,0)<p.totalMs)stop();
 return p;
}
function privatePath(path){
 const parent=lstatSync(dirname(path));if(!parent.isDirectory()||parent.isSymbolicLink()||(parent.mode&0o777)!==0o700||parent.uid!==process.getuid())stop();
}
function read(path){
 const stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o777)!==0o600||stat.uid!==process.getuid()||stat.size>100000)stop();
 const envelope=JSON.parse(readFileSync(path,'utf8'));if(!keys(envelope,['value','sha256'])||hash(envelope.value)!==envelope.sha256)stop();return envelope.value;
}
function save(path,value,initial=false){
 const encoded=JSON.stringify({value,sha256:hash(value)}),tmp=initial?path:path+'.'+randomUUID()+'.tmp';
 const fd=openSync(tmp,'wx',0o600);try{writeSync(fd,encoded);fsyncSync(fd);}finally{closeSync(fd);}
 if(!initial)renameSync(tmp,path);
 const dir=openSync(dirname(path),'r');try{fsyncSync(dir);}finally{closeSync(dir);}
 if(!same(read(path),value))stop();
}
function registryPath(epoch){
 const directory=join(homedir(),'.codex','private','cmwebs-authority-trials');
 mkdirSync(directory,{recursive:true,mode:0o700});const path=join(directory,hash(epoch)+'.json');privatePath(path);return path;
}
function registration(path,expected,binding,expiresAt){
 const record=read(path);if(!keys(record,['state','journalPath','binding','expiresAt'])||record.state!=='ready'||record.journalPath!==expected||record.binding!==binding||record.expiresAt!==expiresAt)stop();
}
const cleanupActions=Object.freeze(['close-deployment','verify-closed-deployment','remove-reader','verify-reader-removed','restore-original-guard','verify-original-guard','restore-thin-guard','verify-thin-guard','remove-testing-user','verify-testing-user-removed','revoke-token','verify-token-revoked','read-original-editor','read-original-versions','read-original-deployments','read-original-project','read-original-triggers']);
function approvalReceipt(value,preparation){
 if(value===undefined)return null;
 const a={...value};
 if(!keys(a,['sha256','priorProposalHash','preparationReads','limit','cleanupReserve','stage'])||
  typeof a.sha256!=='string'||!/^[a-f0-9]{64}$/.test(a.sha256)||a.priorProposalHash!==preparation.sha256||
  !Number.isSafeInteger(a.preparationReads)||a.preparationReads<preparation.reads||a.preparationReads>143||
  a.limit!==160||a.cleanupReserve!==17||a.stage!=='compatibility-only')stop();
 // This is a trusted orchestration receipt of a human decision, not an
 // authentication mechanism. It must be backed by the private approval record.
 return Object.freeze(a);
}
const progressCeiling=l=>l.version===2?160-(17-l.budget.cleanupActions.length):40;
const budgetState=approval=>({approvalHash:approval.sha256,priorProposalHash:approval.priorProposalHash,importedReads:approval.preparationReads,cleanupActions:[],rpcEntries:[]});
function journal(l,binding,expiry,approval=null,terminal=false){
 const approved=l?.version===2;
 const fields=['version','binding','expiresAt','state','readsUsed','nativeMs','day','calls','pending','lastExecutionHash'];
 if(approved)fields.push('budget');
 if(!keys(l,fields)||![1,2].includes(l.version)||l.binding!==binding||l.expiresAt!==expiry||
 (!terminal&&(l.state!=='ready'||l.pending!==null))||!['ready','pending','stopped'].includes(l.state)||
 (l.pending!==null&&(!keys(l.pending,['started','operation'])||!Number.isSafeInteger(l.pending.started)||!['compatibility','authority'].includes(l.pending.operation)))||
 (l.lastExecutionHash!==null&&!/^[a-f0-9]{64}$/.test(l.lastExecutionHash))||
 !Number.isSafeInteger(l.readsUsed)||l.readsUsed<0||l.readsUsed>(approved?160:40)||!Number.isSafeInteger(l.nativeMs)||l.nativeMs<0||l.nativeMs>900000||
 !Array.isArray(l.calls)||l.calls.length!==l.readsUsed||l.calls.some(t=>!Number.isSafeInteger(t)))stop();
 if(approved){
  const b=l.budget;
  if(!approval||!keys(b,['approvalHash','priorProposalHash','importedReads','cleanupActions','rpcEntries'])||
   b.approvalHash!==approval.sha256||b.priorProposalHash!==approval.priorProposalHash||b.importedReads!==approval.preparationReads||
   !Array.isArray(b.cleanupActions)||b.cleanupActions.length>17||new Set(b.cleanupActions).size!==b.cleanupActions.length||b.cleanupActions.some(a=>!cleanupActions.includes(a))||
   !Array.isArray(b.rpcEntries)||b.rpcEntries.length>2||new Set(b.rpcEntries).size!==b.rpcEntries.length||b.rpcEntries.some(a=>!['wrapper','qualified'].includes(a))||
   l.readsUsed<b.importedReads+b.cleanupActions.length+b.rpcEntries.length||l.readsUsed>progressCeiling(l))stop();
 }
 return l;
}
function resultAllowed(result,operation){
 if(operation==='compatibility')return keys(result,['compatible'])&&result.compatible===true;
 // Canonical signed envelope is checked by the original verifier downstream;
 // this controller bounds transport and disallows raw objects/rows. It does not
 // turn an opaque MAC into a parity or authorization acceptance claim.
 return (keys(result,['success','code'])&&result.success===false&&result.code==='TRIAL_UNAVAILABLE')||
 (keys(result,['body','signature'])&&typeof result.body==='string'&&result.body.length<=20000&&typeof result.signature==='string'&&/^[a-f0-9]{64}$/.test(result.signature));
}
function signedFactoryRequest(value,time){
 if(types.isPromise(value)){void Promise.prototype.then.call(value,()=>{},()=>{});stop();}
 if(!keys(value,['action','nonce','payload','signature','timestamp']))stop();
 // Snapshot each primitive once. Accessors cannot replace a validated field
 // during the later transport copy, and no supplied toJSON reaches Google.
 value={action:value.action,nonce:value.nonce,payload:value.payload,signature:value.signature,timestamp:value.timestamp};
 if(value.action!=='read_replica_authorize'||
  !Number.isSafeInteger(value.timestamp)||Math.abs(time-value.timestamp)>15000||
  typeof value.nonce!=='string'||!/^[-a-zA-Z0-9]{20,64}$/.test(value.nonce)||
  typeof value.payload!=='string'||value.payload.length>10000||
  typeof value.signature!=='string'||!/^[a-f0-9]{64}$/.test(value.signature))stop();
 const payload=JSON.parse(value.payload);
 if(!keys(payload,['credential','credential_digest','protocol','route'])||!['liff','session'].includes(payload.protocol)||
  typeof payload.credential!=='string'||!payload.credential||/\s/.test(payload.credential)||payload.credential.length>8192||
  !['/v1/home','/v1/revenue','/v1/tenants','/v1/rooms','/v1/arrears','/v1/properties'].includes(payload.route)||
  payload.credential_digest!==createHash('sha256').update(payload.protocol+':'+payload.credential).digest('hex'))stop();
 // Copy only signed primitive fields, with no factory-supplied toJSON behavior.
 // Google still verifies the original MAC; this is no local authorization proof.
 return Object.freeze({action:value.action,nonce:value.nonce,payload:value.payload,signature:value.signature,timestamp:value.timestamp});
}
export async function createAuthorityTrialDriver(options){
 try{
  const {path:input,expected:inputExpected,expiresAt,now=Date.now,pause=delay,readRelease,readNative,credential,transport}=options;
  const expected=Object.freeze({...inputExpected});
  const preparation=Object.freeze({...options.preparation});
  const approval=approvalReceipt(options.budgetApproval,preparation);
  if(!keys(preparation,['reads','sha256'])||!Number.isSafeInteger(preparation.reads)||preparation.reads<0||preparation.reads>(approval?143:40)||typeof preparation.sha256!=='string'||!/^[a-f0-9]{64}$/.test(preparation.sha256))stop();
  validateExpected(expected);const path=resolve(input);privatePath(path);
  if(!Number.isSafeInteger(expiresAt)||(!approval&&expiresAt<=now())||expiresAt>now()+21600000||[pause,readRelease,readNative,credential,transport].some(f=>typeof f!=='function'))stop();
  const binding=hash({expected,preparation}),registry=registryPath(expected.trialEpoch);let initializeLock;
  try{
   initializeLock=openSync(registry+'.lock','wx',0o600);
   let exists=true;try{lstatSync(registry);}catch(e){if(e.code==='ENOENT')exists=false;else throw e;}
   if(!exists){
    if(expiresAt<=now()||(approval&&approval.preparationReads!==preparation.reads))stop();
    const intent={state:'initializing',journalPath:path,binding,expiresAt};save(registry,intent,true);
    // Registry intent is written first. Missing journal after a crash or deletion
    // is not initialized a second time, nor can another path claim this epoch.
    // Import the immutable preparation receipt without opening a zero ledger. Until
    // its precise per-request timestamps are integrated, conservatively place
    // all those reads at initialization time in the rolling-minute counter.
    save(path,{version:approval?2:1,binding,expiresAt,state:'ready',readsUsed:preparation.reads,nativeMs:0,day:day(now()),calls:Array(preparation.reads).fill(now()),pending:null,lastExecutionHash:null,...(approval?{budget:budgetState(approval)}:{})},true);
    save(registry,{...intent,state:'ready'});
   }
   registration(registry,path,binding,expiresAt);
   const current=read(path);
   if(approval&&current.version===1){
    journal(current,binding,expiresAt);
    if(expiresAt<=now()||current.readsUsed!==approval.preparationReads||current.lastExecutionHash!==null||current.nativeMs!==0)stop();
    save(path,{...current,version:2,budget:budgetState(approval)});
   }
  }finally{if(initializeLock!==undefined){closeSync(initializeLock);unlinkSync(registry+'.lock');}}
  journal(read(path),binding,expiresAt,approval,Boolean(approval));
  const stopPath=registry+'.stop.json';
  const assertTrialRunning=()=>{
   try{lstatSync(stopPath);}catch(e){if(e.code==='ENOENT')return;stop();}stop();
  };
  const requestStop=()=>{
   privatePath(path);registration(registry,path,binding,expiresAt);
   journal(read(path),binding,expiresAt,approval,true);
   const intent={version:1,binding,expiresAt,approvalHash:approval.sha256};
   try{save(stopPath,intent,true);}catch(e){
    // Another cleanup may have already published the same irreversible intent.
    // Partial/corrupt/differently bound intent is never repaired or discarded.
    if(e.code!=='EEXIST'||!same(read(stopPath),intent))stop();
   }
  };
  const currentJournal=()=>{assertTrialRunning();return journal(read(path),binding,expiresAt,approval);};
  // Readiness is distinct from debit. Never consume an over-limit reservation
  // and retry it. Each wait is at most one minute, with the epoch lock retained.
  const waitSlot=async(getCurrent,units)=>{
   const inspect=()=>{
    const l=getCurrent(),time=now();
    if(l.pending===null)assertTrialRunning();
    if(!Number.isSafeInteger(units)||units<1||units>10||!Number.isSafeInteger(time)||time>=expiresAt||l.day!==day(time)||l.calls.some(t=>t>time)||l.readsUsed+units>progressCeiling(l))stop();
    return {l,time,recent:l.calls.filter(t=>time-t<60000).sort((a,b)=>a-b)};
   };
   const before=inspect();if(before.recent.length+units<=10)return;
   const ms=before.recent[before.recent.length+units-11]+60000-before.time;
   if(!Number.isSafeInteger(ms)||ms<1||ms>60000||before.time+ms>=expiresAt||day(before.time+ms)!==before.l.day)stop();
   await pause(ms);
   const after=inspect();if(after.time<before.time||after.recent.length+units>10)stop();
  };
  return Object.freeze({waitForExternalReadSlot:async units=>{
   let lock,held=false,l;
   try{
    privatePath(path);lock=openSync(registry+'.lock','wx',0o600);held=true;registration(registry,path,binding,expiresAt);l=currentJournal();
    await waitSlot(()=>{privatePath(path);registration(registry,path,binding,expiresAt);if(!held||!same(read(path),l))stop();return l;},units);
   }catch(_){if(held&&l){try{save(path,{...l,state:'stopped'});}catch(_){}}stop();}
   finally{if(held){closeSync(lock);unlinkSync(registry+'.lock');}}
  },reserveExternalReads:async units=>{
   let lock,held=false,l;
   try{
    privatePath(path);lock=openSync(registry+'.lock','wx',0o600);held=true;registration(registry,path,binding,expiresAt);l=currentJournal();const time=now();
    if(!Number.isSafeInteger(units)||units<1||units>10||time>=expiresAt||l.day!==day(time)||l.calls.some(t=>t>time)||l.readsUsed+units>progressCeiling(l)||l.calls.filter(t=>time-t<60000).length+units>10)stop();
    l={...l,readsUsed:l.readsUsed+units,calls:l.calls.concat(Array(units).fill(time))};save(path,l);
   }catch(_){if(held&&l){try{save(path,{...l,state:'stopped'});}catch(_){}}stop();}
   finally{if(held){closeSync(lock);unlinkSync(registry+'.lock');}}
  },cleanup:async(action,io)=>{
   let lock,held=false,l;
   try{
    if(!approval||!cleanupActions.includes(action)||typeof io!=='function')stop();
    // Publish stop intent before waiting for the epoch lock or a minute slot.
    // A busy active RPC can still account its native terminal, but neither its
    // completion nor a failed pause may re-enable dispatch.
    requestStop();
    privatePath(path);lock=openSync(registry+'.lock','wx',0o600);held=true;registration(registry,path,binding,expiresAt);
    l=journal(read(path),binding,expiresAt,approval,true);
    const inspect=()=>{
     const time=now();privatePath(path);registration(registry,path,binding,expiresAt);
     if(!same(read(path),l)||!Number.isSafeInteger(time)||l.calls.some(t=>t>time)||l.version!==2||l.budget.cleanupActions.includes(action)||l.readsUsed+1>160||l.budget.cleanupActions.length>=17)stop();
     return {time,recent:l.calls.filter(t=>time-t<60000).sort((a,b)=>a-b)};
    };
    const before=inspect();
    if(before.recent.length>=10){
     const ms=before.recent[before.recent.length-10]+60000-before.time;
     if(!Number.isSafeInteger(ms)||ms<1||ms>60000)stop();await pause(ms);
    }
    const ready=inspect();if(ready.time<before.time||ready.recent.length>=10)stop();
    // Revocation remains available after expiry/day change/unknown terminal.
    // It never clears pending or refunds an attempt, and the first cleanup
    // permanently vetoes further trial RPC. Trusted fixed adapters perform IO.
    l={...l,state:'stopped',readsUsed:l.readsUsed+1,calls:[...l.calls,ready.time],budget:{...l.budget,cleanupActions:[...l.budget.cleanupActions,action]}};save(path,l);
    await io();
   }catch(_){stop();}
   finally{if(held){closeSync(lock);unlinkSync(registry+'.lock');}}
  },run:async(request,operation,entry='wrapper')=>{
   let lock,held=false,l;
   // The observer already runs under this epoch lock. Give it a short-lived
   // debit capability instead of recursively acquiring the public reserve lock.
   const observe=async(observer,...args)=>{
    let active=true,failed=false,pendingWaits=0,pendingReads=0;const enteredReads=new Set();
    const waitForExternalReadSlot=units=>{
     pendingWaits++;
     const pending=(async()=>{
      try{
       await waitSlot(()=>{if(!active||!held||failed)stop();privatePath(path);registration(registry,path,binding,expiresAt);if(!same(read(path),l))stop();return l;},units);
      }catch(_){failed=true;stop();}
      finally{pendingWaits--;}
     })();
     // An observer must await readiness. Veto unfinished waits before dispatch
     // and consume a late rejection even when the observer forgot its promise.
     void pending.catch(()=>{});return pending;
    };
    const reserveExternalReads=async units=>{
     try{
      if(!active||!held||failed)stop();const time=now();
      if(l.pending===null)assertTrialRunning();
      if(!Number.isSafeInteger(units)||units<1||units>10||time>=expiresAt||l.day!==day(time)||l.calls.some(t=>t>time)||l.readsUsed+units>progressCeiling(l)||l.calls.filter(t=>time-t<60000).length+units>10)stop();
      l={...l,readsUsed:l.readsUsed+units,calls:l.calls.concat(Array(units).fill(time))};save(path,l);
     }catch(_){failed=true;stop();}
    };
    const externalRead=io=>{
     pendingReads++;
     const pending=(async()=>{
      try{
       if(typeof io!=='function'||!active||!held||failed||pendingReads!==1)stop();
       await waitForExternalReadSlot(1);if(failed)stop();await reserveExternalReads(1);
       if(!active||!held||failed)stop();
       const entered=Promise.resolve().then(()=>{if(!active||!held||failed)stop();return io();});
       enteredReads.add(entered);try{return await entered;}finally{enteredReads.delete(entered);}
      }catch(_){failed=true;stop();}finally{pendingReads--;}
     })();void pending.catch(()=>{});return pending;
    };
    const idle=()=>{if(pendingReads){failed=true;stop();}};
    const standalone=method=>units=>{const pending=(async()=>{idle();return await method(units);})();void pending.catch(()=>{});return pending;};
    const standaloneWait=standalone(waitForExternalReadSlot),standaloneDebit=standalone(reserveExternalReads);
    try{const observed=await observer(...args,Object.freeze({waitForExternalReadSlot:standaloneWait,reserveExternalReads:standaloneDebit,externalRead}));if(failed||pendingWaits||pendingReads)stop();return observed;}
    finally{active=false;await Promise.allSettled([...enteredReads]);}
   };
   try{
    privatePath(path);lock=openSync(registry+'.lock','wx',0o600);held=true;registration(registry,path,binding,expiresAt);
    l=currentJournal();const started=now();
    if(approval&&(operation!=='compatibility'||l.budget.rpcEntries.includes(entry)||l.budget.rpcEntries.length>=2))stop();
    const functionName=entry==='wrapper'?'authorizeTrial':entry==='qualified'&&operation==='compatibility'?'AuthorityTrial.authorizeTrial':stop();
    const cost=operation==='compatibility'?1:operation==='authority'?7:stop();
    if(started>=expiresAt||l.day!==day(started)||l.calls.some(t=>t>started)||l.readsUsed+cost>progressCeiling(l)||l.calls.filter(t=>started-t<60000).length+cost>10)stop();
    verifyAuthorityTrialReadback(expected,await observe(readRelease));
    const before=proof(await observe(readNative,'before'),now(),expected);
    // Reserve a full six-minute native execution, even for compatibility, in
    // the unchanged synthetic daily budget; account load is separately checked.
    if(before.totalMs<l.nativeMs||before.totalMs+360000>900000)stop();
    const token=await credential();
    if(!token||typeof token.accessToken!=='string'||!token.accessToken||token.accessToken.length>8192||token.refreshTokenPresent!==false||
      token.callerHash!==expected.callerHash||token.oauthClientHash!==expected.oauthClientHash||!same([...token.scopes||[]].sort(),[...AUTHORITY_TRIAL_SCOPES].sort())||!Number.isSafeInteger(token.expiresAt)||token.expiresAt-now()<=360000||token.expiresAt>expiresAt)stop();
    let outgoingRequest=request;
    if(typeof request==='function'){
     if(Object.prototype.toString.call(request)==='[object AsyncFunction]')stop();
     // Trusted local signer only: synchronous, no network/metadata IO. Mint
     // after awaited release/native/credential work, under the same epoch lock.
     outgoingRequest=signedFactoryRequest(request(),now());
    }
    const dispatch=now();proof(before,dispatch,expected);
    assertTrialRunning();
    // Snapshot getters can consume synchronous time too. Recheck the copied
    // factory timestamp at dispatch, using the original canonical lifetime.
    if(typeof request==='function'&&Math.abs(dispatch-outgoingRequest.timestamp)>15000)stop();
    if(dispatch>=expiresAt||token.expiresAt-dispatch<=360000||l.day!==day(dispatch)||l.calls.some(t=>t>dispatch)||l.readsUsed+cost>progressCeiling(l)||l.calls.filter(t=>dispatch-t<60000).length+cost>10)stop();
    l={...l,state:'pending',readsUsed:l.readsUsed+cost,nativeMs:before.totalMs,calls:l.calls.concat(Array(cost).fill(dispatch)),pending:{started:dispatch,operation},...(approval?{budget:{...l.budget,rpcEntries:[...l.budget.rpcEntries,entry]}}:{})};save(path,l);
    // No arbitrary function, devMode, sessionState, route, redirect or retries.
    const response=await transport({url:'https://script.googleapis.com/v1/scripts/'+expected.deploymentId+':run',
     accessToken:token.accessToken,body:{function:functionName,parameters:[outgoingRequest,operation],devMode:false}});
    const after=proof(await observe(readNative,'after'),now(),expected),e=after.execution;
    if(!e||!['COMPLETED','FAILED','TIMED_OUT','CANCELED'].includes(e.status)||e.function!==functionName||e.deploymentId!==expected.deploymentId||
      ![e.startMs,e.endMs,e.durationMs].every(Number.isSafeInteger)||e.durationMs<0||e.durationMs>360000||e.startMs<dispatch-1000||e.endMs<e.startMs||
      e.endMs>after.observedAt+1000||e.endMs-e.startMs!==e.durationMs||after.totalMs<before.totalMs+e.durationMs)stop();
    const executionHash=hash([e.deploymentId,e.function,e.startMs,e.endMs,e.durationMs]);if(executionHash===l.lastExecutionHash)stop();
    l.nativeMs=after.totalMs;l.lastExecutionHash=executionHash;save(path,l);
    if(!response||response.done!==true||(('response' in response)===('error' in response))||'error' in response||e.status!=='COMPLETED'||
      !resultAllowed(response.response?.result,operation))stop();
    verifyAuthorityTrialReadback(expected,await observe(readRelease));
    assertTrialRunning();
    l={...l,state:'ready',pending:null};save(path,l);return response.response.result;
   }catch(_){
    if(held&&l){try{save(path,{...l,state:'stopped'});}catch(_){/* existing pending/unreadable journal also vetoes resume */}}
    stop();
   }finally{if(held){closeSync(lock);unlinkSync(registry+'.lock');}}
  }});
 }catch(_){stop();}
}

function canonicalExpected(input){
 if(!keys(input,pinKeys))stop();
 const expected=Object.freeze(Object.fromEntries(pinKeys.map(k=>[k,input[k]])));
 validateExpected(expected);return expected;
}
export function canonicalAuthorityTrialBinding(input,decisionHash=SINGLE_WRAPPER_TRIAL_DECISION_HASH){
 try{if(arguments.length>2)stop();getAuthorityTrialPolicy(decisionHash);return hash({kind:'canonical-compatibility-runtime',decisionHash,expected:canonicalExpected(input)});}catch(_){stop();}
}
export function canonicalAuthorityStandaloneBinding(expected){
 try{if(arguments.length!==1)stop();return hash({kind:'canonical-standalone-compatibility-runtime',decisionHash:'02c75938cc8ecff17c907431db861613bb7f4e2af967f185c6b9933758f7dfd8',expected:canonicalStandaloneExpected(expected)});}catch(_){stop();}
}
// Approved first stage only. All durable state and IO ownership belong to the
// canonical preparation controller; this driver never opens or seeds a journal.
export function createCanonicalAuthorityTrialDriver(input){
 try{
  const baseKeys=['expected','expiresAt','now','control','readRelease','readNative','credential','signRequest','transport'];
  const selectedDecisionHash=Object.hasOwn(input,'decisionHash')?input.decisionHash:SINGLE_WRAPPER_TRIAL_DECISION_HASH,policy=getAuthorityTrialPolicy(selectedDecisionHash);
  if(!keys(input,[...baseKeys,...(Object.hasOwn(input,'decisionHash')?['decisionHash']:[]),...(Object.hasOwn(input,'prepareDispatch')||Object.hasOwn(input,'assertDispatch')?['prepareDispatch','assertDispatch']:[])]))stop();
  const expected=canonicalExpected(input.expected),binding=canonicalAuthorityTrialBinding(expected,selectedDecisionHash);
  const {expiresAt,now,readRelease,readNative,credential,signRequest,transport,prepareDispatch,assertDispatch}=input;
  if(('prepareDispatch' in input||'assertDispatch' in input)&&[prepareDispatch,assertDispatch].some(f=>typeof f!=='function'))stop();
  const withRuntime=input.control?.withRuntime,requestStop=input.control?.requestStop;
  if(!Number.isSafeInteger(expiresAt)||expiresAt<=0||[now,readRelease,readNative,credential,signRequest,transport,withRuntime,requestStop].some(f=>typeof f!=='function'))stop();
  const releaseAliases=SINGLE_WRAPPER_TRIAL_OPERATIONS.F.filter(v=>v.startsWith('wrapper-before.')).map(v=>v.slice('wrapper-before.'.length));
  const nativeLimits=policy.bucketLimits.G.perWindow;
  const observe=async(observer,read,native,kind,phase,...args)=>{
   let active=true,failed=false,pending=0;const operations=new Set(),seen=new Map();
   const externalRead=(io,item)=>{
    pending++;
    const operation=(async()=>{
     try{
      if(!active||failed||pending!==1||typeof io!=='function')stop();
      let charge,key,limit;
      if(kind==='release'){
       if(typeof item!=='string'||!releaseAliases.includes(item))stop();
       key=item;limit=1;charge='F:'+phase+'.'+key;
      }else{
       if(!keys(item,['actor','category']))stop();
       const {actor,category}=item;
       if(!['caller','publisher'].includes(actor)||!Object.hasOwn(nativeLimits,category)||category==='settlementReads')stop();
       key=actor+':'+category;limit=nativeLimits[category];charge='G:'+phase+':'+key;
      }
      const count=(seen.get(key)??0)+1;if(count>limit)stop();seen.set(key,count);
      return await read(async()=>{if(!active||failed)stop();return await io();},charge);
     }catch(_){failed=true;stop();}finally{pending--;}
    })();operations.add(operation);void operation.catch(()=>{});return operation;
   };
   const nativeRead=(descriptor,io)=>{
    pending++;
    const operation=(async()=>{
     try{
      if(!active||failed||pending!==1||typeof native!=='function'||typeof io!=='function'||descriptor?.stage!==phase)stop();
      return await native(descriptor,async pinned=>{if(!active||failed)stop();return await io(pinned);});
     }catch(_){failed=true;stop();}finally{pending--;}
    })();operations.add(operation);void operation.catch(()=>{});return operation;
   };
   try{
    const value=await observer(...args,Object.freeze({externalRead,...(selectedDecisionHash===NATIVE_IO_DECISION_HASH?{nativeRead}:{}),phase,decisionHash:selectedDecisionHash}));
    if(failed||pending)stop();
    if(kind==='release'){
     if(seen.size!==15||releaseAliases.some(alias=>seen.get(alias)!==1))stop();
    }else for(const actor of ['caller','publisher']){
     if(!(seen.get(actor+':pages')>=1)||seen.get(actor+':identityReads')!==1||seen.get(actor+':quotaReads')!==1)stop();
    }
    return value;
   }finally{active=false;await Promise.allSettled([...operations]);}
  };
  const tokenSnapshot=()=>{
   const raw=credential();
   if(types.isPromise(raw)){void Promise.prototype.then.call(raw,()=>{},()=>{});stop();}
   if(!keys(raw,['accessToken','scopes','expiresAt','refreshTokenPresent','callerHash','oauthClientHash']))stop();
   const token=Object.fromEntries(['accessToken','scopes','expiresAt','refreshTokenPresent','callerHash','oauthClientHash'].map(k=>[k,raw[k]]));
   if(!Array.isArray(token.scopes))stop();token.scopes=Object.freeze([...token.scopes]);
   const time=now();
   if(!Number.isSafeInteger(time)||typeof token.accessToken!=='string'||!token.accessToken||/[\s\x00-\x1f\x7f]/.test(token.accessToken)||token.accessToken.length>8192||token.refreshTokenPresent!==false||token.callerHash!==expected.callerHash||token.oauthClientHash!==expected.oauthClientHash||!same([...token.scopes].sort(),[...AUTHORITY_TRIAL_SCOPES].sort())||!Number.isSafeInteger(token.expiresAt)||token.expiresAt-time<=360000||token.expiresAt>expiresAt)stop();
   return Object.freeze(token);
  };
  const run=async(...args)=>{
   try{
    if(args.length>1)stop();const entry=args[0]??'wrapper';if(entry!=='wrapper')stop();
    return await withRuntime(binding,async cap=>{
     const state=await cap.inspectRuntime(),time=now();
     if(state.source!=='canonical-preparation-ledger'||state.decisionHash!==selectedDecisionHash||state.runtimeBinding!==binding||state.epoch!==expected.trialEpoch||state.expiresAt!==expiresAt||state.state!=='ready'||state.pending!==null||state.rpcEntries.length!==0||!Number.isSafeInteger(time)||time>=expiresAt)stop();
     verifyAuthorityTrialReadback(expected,await observe(readRelease,cap.externalRead,cap.nativeRead,'release','wrapper-before'));
     const before=proof(await observe(readNative,cap.externalRead,cap.nativeRead,'native','wrapper-before','before'),now(),expected);
     if(before.totalMs<state.nativeMs||before.totalMs+360000>900000)stop();
     const token=tokenSnapshot(),functionName='authorizeTrial';
     let response,startedAt,transportFailed=false,transportEntered=false;
     try{
      const reply=await cap.dispatchCompatibility({entry,nativeMs:before.totalMs,observedAt:before.observedAt,credentialExpiresAt:token.expiresAt},async()=>{
       // Await local readiness before the final synchronous guards/signing.
       // No hook may insert a new await between those guards and transport.
       if(prepareDispatch)await prepareDispatch(cap);
       const dispatched=now();proof(before,dispatched,expected);
       if(!Number.isSafeInteger(dispatched)||dispatched>=expiresAt||token.expiresAt-dispatched<=360000)stop();
       // Preserve the existing canonical validation prefix, minting once after
       // rolling admission. Trusted synchronous signing has no external IO.
       const request=signedFactoryRequest(signRequest(),now());
       if(assertDispatch){const asserted=assertDispatch();if(types.isPromise(asserted)){void Promise.prototype.then.call(asserted,()=>{},()=>{});stop();}if(asserted!==undefined)stop();}
       const sendTime=now();proof(before,sendTime,expected);
       if(!Number.isSafeInteger(sendTime)||sendTime>=expiresAt||token.expiresAt-sendTime<=360000||Math.abs(sendTime-request.timestamp)>15000)stop();
       transportEntered=true;
       return await transport(Object.freeze({url:'https://script.googleapis.com/v1/scripts/'+expected.deploymentId+':run',accessToken:token.accessToken,body:Object.freeze({function:functionName,parameters:Object.freeze([request,'compatibility']),devMode:false})}));
      });response=reply.value;startedAt=reply.startedAt;
     }catch(_){
      // An admitted unknown remains spent. Only pending readback may settle it;
      // no new RPC/retry or completion eligibility follows from an error.
      const pending=(await cap.inspectRuntime()).pending;
      if(!pending||pending.entry!==entry||!transportEntered)stop();startedAt=pending.startedAt;transportFailed=true;
     }
     const after=proof(await observe(readNative,cap.settlementRead,cap.nativeRead,'native','wrapper-after','after'),now(),expected),e=after.execution;
     if(!e||!['COMPLETED','FAILED','TIMED_OUT','CANCELED'].includes(e.status)||e.function!==functionName||e.deploymentId!==expected.deploymentId||![e.startMs,e.endMs,e.durationMs].every(Number.isSafeInteger)||e.durationMs<0||e.durationMs>360000||e.startMs<startedAt-1000||e.endMs<e.startMs||e.endMs>after.observedAt+1000||e.endMs-e.startMs!==e.durationMs||after.totalMs<before.totalMs+e.durationMs)stop();
     await cap.accountNative({entry,totalMs:after.totalMs,executionHash:hash([e.deploymentId,e.function,e.startMs,e.endMs,e.durationMs])});
     if(transportFailed||!response||response.done!==true||(('response' in response)===('error' in response))||'error' in response||e.status!=='COMPLETED'||!resultAllowed(response.response?.result,'compatibility'))stop();
     verifyAuthorityTrialReadback(expected,await observe(readRelease,cap.settlementRead,cap.nativeRead,'release','wrapper-after'));
     await cap.finishCompatibility(entry);return Object.freeze({compatible:true});
    });
   }catch(_){stop();}
  };
  return Object.freeze({run,requestStop,cleanup:async(name,io)=>{
   // A partial stop ACK may fail while its negative veto remains. Cleanup still
   // needs the independently validated canonical checkpoint and exclusive flock.
   try{await requestStop();}catch(_){}
   try{return await withRuntime(binding,cap=>cap.cleanup(name,io));}catch(_){stop();}
  }});
 }catch(_){stop();}
}

export function createGoogleExecutionTransport(deploymentId,fetcher=fetch){
 if(typeof deploymentId!=='string'||!/^[-A-Za-z0-9_]{20,200}$/.test(deploymentId)||typeof fetcher!=='function')stop();
 const endpoint='https://script.googleapis.com/v1/scripts/'+deploymentId+':run';
 return async call=>{
  try{
   if(!keys(call,['url','accessToken','body'])||call.url!==endpoint||typeof call.accessToken!=='string'||!call.accessToken||/\s/.test(call.accessToken)||call.accessToken.length>8192||
    !keys(call.body,['function','parameters','devMode'])||!['authorizeTrial','AuthorityTrial.authorizeTrial'].includes(call.body.function)||call.body.devMode!==false||!Array.isArray(call.body.parameters)||call.body.parameters.length!==2||
    (call.body.function==='AuthorityTrial.authorizeTrial'&&call.body.parameters[1]!=='compatibility')||
    !['compatibility','authority'].includes(call.body.parameters[1])||JSON.stringify(call.body).length>20000)stop();
   const response=await fetcher(endpoint,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(365000),
    headers:{authorization:'Bearer '+call.accessToken,'content-type':'application/json','cache-control':'no-cache, no-store'},body:JSON.stringify(call.body)});
   if(response.status!==200||response.redirected===true||(response.url&&response.url!==endpoint)||!response.body){if(response.body)await response.body.cancel().catch(()=>{});stop();}const reader=response.body.getReader(),chunks=[];let size=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;if(!types.isUint8Array(value)||(size+=value.byteLength)>30000){await reader.cancel().catch(()=>{});stop();}chunks.push(value);}}
   finally{reader.releaseLock();}
   const raw=new Uint8Array(size);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.byteLength;}
   return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
  }catch(_){stop();}
 };
}
