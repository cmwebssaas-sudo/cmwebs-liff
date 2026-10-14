// Local fixed publication candidate. Actual exclusive editor/native/budget gates
// and two independently reserved C restore units belong to trusted orchestration.
import {openSync,closeSync,writeSync,fsyncSync,readFileSync,lstatSync,mkdirSync,renameSync,unlinkSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {homedir,userInfo} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {types} from 'node:util';
const stop=()=>{throw Error('TRIAL_STOPPED');},hash=v=>createHash('sha256').update(v).digest('hex'),checksum=v=>hash(JSON.stringify(canonical(v)));
function canonical(v){return Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;}
const record=v=>v&&typeof v==='object'&&!Array.isArray(v),only=(v,keys,required=keys)=>record(v)&&Object.keys(v).every(k=>keys.includes(k))&&required.every(k=>Object.hasOwn(v,k));
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),id=v=>typeof v==='string'&&/^[-A-Za-z0-9_]{20,200}$/.test(v);
const scopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(s=>'https://www.googleapis.com/auth/'+s);
function directory(p){const s=lstatSync(dirname(p));if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==userInfo().uid||(s.mode&0o777)!==0o700)stop();}
function read(p){const s=lstatSync(p);if(!s.isFile()||s.isSymbolicLink()||s.uid!==userInfo().uid||(s.mode&0o777)!==0o600||s.size>20000)stop();const e=JSON.parse(readFileSync(p,'utf8'));if(!only(e,['value','sha256'])||checksum(e.value)!==e.sha256)stop();return e.value;}
function save(p,value,initial=false){directory(p);const temp=initial?p:p+'.'+randomUUID()+'.tmp',fd=openSync(temp,'wx',0o600);try{writeSync(fd,JSON.stringify({value,sha256:checksum(value)}));fsyncSync(fd);}finally{closeSync(fd);}if(!initial)renameSync(temp,p);const d=openSync(dirname(p),'r');try{fsyncSync(d);}finally{closeSync(d);}if(JSON.stringify(read(p))!==JSON.stringify(value))stop();}
async function json(r,url,max=4000000){
 if(r.status!==200||r.redirected===true||(r.url&&r.url!==url)||!r.body){if(r.body)await r.body.cancel().catch(()=>{});stop();}const reader=r.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;if(!types.isUint8Array(value)||(size+=value.byteLength)>max){await reader.cancel().catch(()=>{});stop();}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
import {buildAuthorityTrialArtifacts} from './build-read-authority-trial-entry.mjs';
const filesHash=files=>checksum([...files].sort((a,b)=>a.name.localeCompare(b.name)));
function files(v,count){if(!Array.isArray(v)||v.length!==count||new Set(v.map(f=>f?.name)).size!==count)stop();for(const f of v)if(!only(f,['name','type','source'])||typeof f.name!=='string'||!/^[-A-Za-z0-9_]{1,128}$/.test(f.name)||!['JSON','SERVER_JS'].includes(f.type)||typeof f.source!=='string'||Buffer.byteLength(f.source)>1000000)stop();if(v.filter(f=>f.name==='appsscript'&&f.type==='JSON').length!==1||v.filter(f=>f.type==='JSON').length!==1)stop();const manifest=JSON.parse(v.find(f=>f.name==='appsscript').source);if(!record(manifest)||Buffer.byteLength(JSON.stringify(v))>3000000)stop();return v;}
function version(v,scriptId){if(!only(v,['scriptId','versionNumber','description','createTime'],['scriptId','versionNumber'])||v.scriptId!==scriptId||!Number.isSafeInteger(v.versionNumber)||v.versionNumber<1||v.versionNumber>1000000||(Object.hasOwn(v,'description')&&(typeof v.description!=='string'||v.description.length>1000))||(Object.hasOwn(v,'createTime')&&(typeof v.createTime!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(v.createTime)||!Number.isFinite(Date.parse(v.createTime)))))stop();return v;}
function deployments(v,scriptId){if(!Array.isArray(v)||v.length<1||v.length>100||new Set(v.map(d=>d?.deploymentId)).size!==v.length)stop();for(const d of v)if(!only(d,['deploymentId','deploymentConfig'])||!id(d.deploymentId)||!only(d.deploymentConfig,['scriptId','versionNumber','manifestFileName','description'],['scriptId','versionNumber','manifestFileName'])||d.deploymentConfig.scriptId!==scriptId||d.deploymentConfig.versionNumber!==1||d.deploymentConfig.manifestFileName!=='appsscript'||(Object.hasOwn(d.deploymentConfig,'description')&&typeof d.deploymentConfig.description!=='string'))stop();return v;}
export function createAuthorityTrialPublication(input){
 try{
  if(!only(input,['path','epoch','scriptId','publisherHash','originalFiles','originalSourceHash','baselineVersions','baselineDeployments','backupReceipt','expiresAt','control','credential','fetcher','now'],['path','epoch','scriptId','publisherHash','originalFiles','originalSourceHash','baselineVersions','baselineDeployments','backupReceipt','expiresAt','control','credential']))stop();
  const {epoch,scriptId,publisherHash,originalSourceHash,expiresAt,control,credential,fetcher=fetch,now=Date.now}=input;
  if(typeof input.path!=='string'||!id(epoch)||!id(scriptId)||!digest(publisherHash)||!digest(originalSourceHash)||!Number.isSafeInteger(expiresAt)||[credential,fetcher,now,control?.externalRead,control?.restoreOriginalEditor].some(f=>typeof f!=='function'))stop();
  const path=resolve(input.path);directory(path);const original=files(structuredClone(input.originalFiles),10),baseline=structuredClone(input.baselineVersions),serving=deployments(structuredClone(input.baselineDeployments),scriptId),backup={...input.backupReceipt};
  if(filesHash(original)!==originalSourceHash||!Array.isArray(baseline)||baseline.length!==6||baseline.some((v,i)=>version(v,scriptId).versionNumber!==i+1)||!only(backup,['source','epoch','scriptId','publisherHash','sourceHash','versionsHash','deploymentsHash'])||backup.source!=='fixed-trial-original-editor-backup'||backup.epoch!==epoch||backup.scriptId!==scriptId||backup.publisherHash!==publisherHash||backup.sourceHash!==originalSourceHash||backup.versionsHash!==checksum(baseline)||backup.deploymentsHash!==checksum(serving))stop();
  const bundle=buildAuthorityTrialArtifacts({libraryId:scriptId,version:1}),library=[{name:'AuthorityTrial',type:'SERVER_JS',source:bundle.librarySource},{name:'appsscript',type:'JSON',source:JSON.stringify(bundle.libraryManifest)}],libraryFilesHash=filesHash(library);
  const cap=Object.freeze({external:control.externalRead,restore:control.restoreOriginalEditor});
  const binding=checksum({epoch,scriptId,publisherHash,originalSourceHash,expiresAt,backup,libraryFilesHash}),registryDir=join(homedir(),'.codex','private','cmwebs-authority-trials');mkdirSync(registryDir,{recursive:true,mode:0o700});
  const registry=join(registryDir,checksum(epoch)+'.publication.json'),registration={path,binding};directory(registry);let journal,lock;
  try{lock=openSync(registry+'.lock','wx',0o600);let existing=true;try{lstatSync(registry);}catch(e){if(e.code==='ENOENT')existing=false;else throw e;}
   if(existing){if(JSON.stringify(read(registry))!==JSON.stringify(registration))stop();journal=read(path);}
   else{const t=now();if(!Number.isSafeInteger(t)||expiresAt<=t||expiresAt-t>21600000)stop();save(registry,registration,true);journal={version:1,binding,state:'ready',started:false,stageAttempted:false,stageOutcome:'NOT_SENT',versionAttempted:false,versionOutcome:'NOT_SENT',libraryVersion:null,libraryVerified:false,restoreAttempted:false,restoreOutcome:'NOT_STARTED',restoreReadAttempted:false,editorRestoredAtReadback:false};save(path,journal,true);}
  }finally{if(lock!==undefined){closeSync(lock);unlinkSync(registry+'.lock');}}
  const validate=j=>{if(!only(j,['version','binding','state','started','stageAttempted','stageOutcome','versionAttempted','versionOutcome','libraryVersion','libraryVerified','restoreAttempted','restoreOutcome','restoreReadAttempted','editorRestoredAtReadback'])||j.version!==1||j.binding!==binding||!['ready','running','stopped','finished'].includes(j.state)||['started','stageAttempted','versionAttempted','libraryVerified','restoreAttempted','restoreReadAttempted','editorRestoredAtReadback'].some(k=>typeof j[k]!=='boolean')||!['NOT_SENT','UNKNOWN','ACK_MATCHED'].includes(j.stageOutcome)||!['NOT_SENT','UNKNOWN','ACK_MATCHED'].includes(j.versionOutcome)||!['NOT_STARTED','UNKNOWN','ACK_MATCHED'].includes(j.restoreOutcome)||(j.libraryVersion!==null&&j.libraryVersion!==7)||(j.stageAttempted&&!j.started)||(j.versionAttempted&&!j.stageAttempted))stop();return j;};validate(journal);
  const operationPath=path+'.operation.lock',stopPath=registry+'.stop';let localStop=false,publishing=false,restoring=false,readingOriginal=false;const originalReads=new Set();
  const stopped=()=>{try{lstatSync(stopPath);}catch(e){if(e.code==='ENOENT')return false;throw e;}if(JSON.stringify(read(stopPath))!==JSON.stringify(registration))stop();return true;};
  const publishStop=()=>{localStop=true;if(stopped())return;try{save(stopPath,registration,true);}catch(e){if(!stopped())throw e;}};
  const integrity=()=>{directory(path);if(JSON.stringify(read(registry))!==JSON.stringify(registration)||JSON.stringify(read(path))!==JSON.stringify(journal))stop();};
  const live=()=>{integrity();const t=now();if(!Number.isSafeInteger(t)||t>=expiresAt||localStop||stopped())stop();};
  const write=patch=>{journal={...journal,...patch};save(path,journal);};
  const token=()=>{const raw=credential();if(types.isPromise(raw)){void Promise.prototype.then.call(raw,()=>{},()=>{});stop();}if(!only(raw,['accessToken','accountHash','scopes','expiresAt','refreshTokenPresent']))stop();const t={...raw};if(typeof t.accessToken!=='string'||!t.accessToken||t.accessToken.length>8192||/[\s\x00-\x1f\x7f]/.test(t.accessToken)||t.accountHash!==publisherHash||!Array.isArray(t.scopes)||JSON.stringify([...t.scopes].sort())!==JSON.stringify([...scopes].sort())||!Number.isSafeInteger(t.expiresAt)||typeof t.refreshTokenPresent!=='boolean'||t.expiresAt-now()<=10000)stop();return t;};
  const base='https://script.googleapis.com/v1/projects/'+scriptId,contentFields='scriptId,files(name,type,source)',content=base+'/content?fields='+encodeURIComponent(contentFields),description='CMWebs C3 trial '+hash(epoch).slice(0,16);
  const io=async(url,method,body,t=token())=>json(await fetcher(url,{method,redirect:'manual',signal:AbortSignal.timeout(10000),headers:{authorization:'Bearer '+t.accessToken,'cache-control':'no-cache, no-store',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),url);
  const contentMatch=(v,expected)=>{if(!only(v,['scriptId','files'])||v.scriptId!==scriptId||filesHash(files(v.files,expected.length))!==filesHash(expected))stop();};
  const ordinary=async(url,method,body,intent)=>{live();const t=token();return cap.external(async()=>{live();if(t.expiresAt-now()<=10000)stop();if(intent){write(intent);live();}return await io(url,method,body,t);});};
  const restoreWork=async()=>{
   if(!journal.stageAttempted)return;let receiptFailed=false,cleanupFailed=false;
   const best=patch=>{try{write(patch);}catch(_){receiptFailed=true;}};
   if(!journal.restoreAttempted)try{await cap.restore('restore-editor',async()=>{best({restoreAttempted:true,restoreOutcome:'UNKNOWN'});contentMatch(await io(content,'PUT',{files:original}),original);best({restoreOutcome:'ACK_MATCHED'});});}catch(_){cleanupFailed=true;}
   if(journal.restoreAttempted&&!journal.restoreReadAttempted)try{await cap.restore('read-restored-editor',async()=>{best({restoreReadAttempted:true});contentMatch(await io(content,'GET'),original);best({editorRestoredAtReadback:true});});}catch(_){cleanupFailed=true;}
   if(receiptFailed||cleanupFailed||journal.restoreOutcome!=='ACK_MATCHED'||!journal.editorRestoredAtReadback)stop();
  };
  const release=fd=>{if(fd!==undefined)try{closeSync(fd);unlinkSync(operationPath);}catch(_){stop();}};
  return Object.freeze({status:()=>localStop||stopped()?'stopped':journal.state,stop:()=>{try{publishStop();return Object.freeze({stopRequested:true});}catch(_){stop();}},restore:async()=>{
   if(publishing||restoring||readingOriginal)stop();restoring=true;let op,stopReceiptFailed=false;
   try{try{publishStop();}catch(_){stopReceiptFailed=true;}op=openSync(operationPath,'wx',0o600);journal=validate(read(path));await restoreWork();if(stopReceiptFailed)stop();return Object.freeze({editorRestoredAtReadback:journal.editorRestoredAtReadback,rollbackComplete:false});}catch(_){stop();}finally{release(op);restoring=false;}
  },readOriginal:async(action,cleanupControl)=>{
   let held=false,op;
   try{
    if(publishing||restoring||readingOriginal||originalReads.has(action)||!['read-original-editor','read-original-versions','read-original-deployments'].includes(action)||typeof cleanupControl?.cleanup!=='function')stop();
    readingOriginal=true;held=true;op=openSync(operationPath,'wx',0o600);const cleanup=cleanupControl.cleanup;
    const endpoint=action==='read-original-editor'?content:base+(action==='read-original-versions'?'/versions?fields='+encodeURIComponent('nextPageToken,versions(scriptId,versionNumber,description,createTime)'):'/deployments?fields='+encodeURIComponent('nextPageToken,deployments(deploymentId,deploymentConfig(scriptId,versionNumber,manifestFileName,description))'))+'&pageSize=200';
    return await cleanup(action,async()=>{
     // Cleanup remains independent of ordinary expiry/stop. The canonical I
     // capability admits/debits first; no credentials, IO or journal mutation
     // occurs before it. Never replay an admitted unknown read in this holder.
     if(originalReads.has(action))stop();originalReads.add(action);integrity();
     const start=now();if(!Number.isSafeInteger(start))stop();const t=token();
     const observed=await io(endpoint,'GET',undefined,t);integrity();
     if(action==='read-original-editor')contentMatch(observed,original);
     else if(action==='read-original-versions'){
      if(!only(observed,['versions','nextPageToken'],['versions'])||(observed.nextPageToken!==undefined&&observed.nextPageToken!=='')||!Array.isArray(observed.versions)||![6,7].includes(observed.versions.length))stop();
      const rows=[...observed.versions].sort((a,b)=>a.versionNumber-b.versionNumber);rows.forEach(v=>version(v,scriptId));
      if(checksum(rows.slice(0,6))!==checksum(baseline))stop();
      if(rows.length===7&&(!journal.versionAttempted||rows[6].versionNumber!==7||rows[6].description!==description))stop();
      if(journal.versionOutcome==='ACK_MATCHED'&&rows.length!==7)stop();
     }else if(!only(observed,['deployments','nextPageToken'],['deployments'])||(observed.nextPageToken!==undefined&&observed.nextPageToken!=='')||checksum(deployments(observed.deployments,scriptId))!==checksum(serving))stop();
     const end=now();if(!Number.isSafeInteger(end)||end<start)stop();
     return Object.freeze({action,matchedAtReadback:true,observedAt:end,rollbackComplete:false});
    });
   }catch(_){stop();}finally{try{release(op);}finally{if(held)readingOriginal=false;}}
  },publishAndRestore:async()=>{
   if(publishing||restoring||readingOriginal)stop();publishing=true;let op,claimed=false,failed=false;
   try{op=openSync(operationPath,'wx',0o600);integrity();if(journal.started||localStop||stopped())stop();claimed=true;write({started:true,state:'running'});
    try{
     contentMatch(await ordinary(content,'PUT',{files:library},{stageAttempted:true,stageOutcome:'UNKNOWN'}),library);write({stageOutcome:'ACK_MATCHED'});live();
     const v=await ordinary(base+'/versions?fields='+encodeURIComponent('scriptId,versionNumber,description,createTime'),'POST',{description},{versionAttempted:true,versionOutcome:'UNKNOWN'});
     if(record(v)&&v.scriptId===scriptId&&v.versionNumber===7)write({libraryVersion:7});version(v,scriptId);if(v.versionNumber!==7||v.description!==description)stop();write({versionOutcome:'ACK_MATCHED'});live();
     const fixed=await ordinary(content+'&versionNumber=7','GET');contentMatch(fixed,library);write({libraryVerified:true});live();
    }catch(_){failed=true;}finally{try{await restoreWork();}catch(_){failed=true;}}
    if(failed)stop();live();
    const inventory=await ordinary(base+'/versions?fields='+encodeURIComponent('nextPageToken,versions(scriptId,versionNumber,description,createTime)')+'&pageSize=200','GET');
    if(!only(inventory,['versions','nextPageToken'],['versions'])||(inventory.nextPageToken!==undefined&&inventory.nextPageToken!=='')||!Array.isArray(inventory.versions)||inventory.versions.length!==7)stop();const rows=[...inventory.versions].sort((a,b)=>a.versionNumber-b.versionNumber);rows.forEach(v=>version(v,scriptId));if(checksum(rows.slice(0,6))!==checksum(baseline)||rows[6].versionNumber!==7||rows[6].description!==description)stop();live();
    const dep=await ordinary(base+'/deployments?fields='+encodeURIComponent('nextPageToken,deployments(deploymentId,deploymentConfig(scriptId,versionNumber,manifestFileName,description))')+'&pageSize=200','GET');
    if(!only(dep,['deployments','nextPageToken'],['deployments'])||(dep.nextPageToken!==undefined&&dep.nextPageToken!=='')||checksum(deployments(dep.deployments,scriptId))!==checksum(serving))stop();live();write({state:'finished'});
    return Object.freeze({libraryVersion:7,librarySha256:bundle.librarySha256,editorRestoredAtReadback:true,publicationAccepted:false,rollbackComplete:false});
   }catch(_){if(claimed)try{integrity();write({state:'stopped'});}catch(_){}stop();}finally{release(op);publishing=false;}
  }});
 }catch(_){stop();}
}
