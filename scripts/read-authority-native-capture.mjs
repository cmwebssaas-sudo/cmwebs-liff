// Fixed native page capture candidate. The trusted producer must use CUA only;
// no browser is selected, navigated or queried by this module. Not a quota proof.
import {openSync,closeSync,writeSync,fsyncSync,readFileSync,lstatSync,mkdirSync,renameSync,unlinkSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {homedir,userInfo} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {analyzeAuthorityNativeSnapshot} from './read-authority-native-snapshot.mjs';
const stop=()=>{throw Error('NATIVE_CAPTURE_STOPPED');},hash=v=>createHash('sha256').update(v).digest('hex'),checksum=v=>hash(JSON.stringify(v));
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),id=v=>typeof v==='string'&&/^[-A-Za-z0-9_]{20,200}$/.test(v),integer=Number.isSafeInteger;
const phases=['wrapper-before','wrapper-after'],actors=['caller','publisher'];
function directory(p){const s=lstatSync(dirname(p));if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==userInfo().uid||(s.mode&0o777)!==0o700)stop();}
function privateFile(p,max=1000000){const s=lstatSync(p);if(!s.isFile()||s.isSymbolicLink()||s.uid!==userInfo().uid||(s.mode&0o777)!==0o600||s.size>max)stop();return readFileSync(p);}
function read(p){const e=JSON.parse(privateFile(p));if(!exact(e,['value','sha256'])||checksum(e.value)!==e.sha256)stop();return e.value;}
function exists(p){try{lstatSync(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
function rawSave(p,bytes,initial){directory(p);const temp=initial?p:p+'.'+randomUUID()+'.tmp',fd=openSync(temp,'wx',0o600);try{writeSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}if(!initial)renameSync(temp,p);const d=openSync(dirname(p),'r');try{fsyncSync(d);}finally{closeSync(d);}if(!privateFile(p,4000000).equals(Buffer.from(bytes)))stop();}
const save=(p,value,initial=false)=>rawSave(p,JSON.stringify({value,sha256:checksum(value)}),initial);
export function createAuthorityNativeCapture(input){
 try{
  if(!exact(input,['path','epoch','callerHash','publisherHash','maxReads','expiresAt','control','nativeRead','now']))stop();
  const {epoch,callerHash,publisherHash,maxReads,expiresAt,control,nativeRead,now}=input,externalRead=control?.externalRead;
  if(typeof input.path!=='string'||!id(epoch)||![callerHash,publisherHash].every(digest)||callerHash===publisherHash||!integer(maxReads)||maxReads<1||maxReads>16||!integer(expiresAt)||[now,nativeRead,externalRead].some(f=>typeof f!=='function'))stop();
  const scopedPhase=control.phase;if(scopedPhase!==undefined&&!phases.includes(scopedPhase))stop();
  const path=resolve(input.path);directory(path);const binding=checksum({path,epoch,callerHash,publisherHash,maxReads,expiresAt}),registration={path,binding},registryDir=join(homedir(),'.codex','private','cmwebs-authority-trials');mkdirSync(registryDir,{recursive:true,mode:0o700});
  const registry=join(registryDir,checksum(epoch)+'.native-capture.json'),stopPath=registry+'.stop',operationPath=path+'.operation.lock';directory(registry);let journal,lock,busy=false,localStop=false;
  try{lock=openSync(registry+'.lock','wx',0o600);const claimPath=path+'.native-capture-claim.json',claim={path,binding,epoch};if(exists(claimPath)){if(JSON.stringify(read(claimPath))!==JSON.stringify(claim))stop();}else{if(exists(registry)||exists(path))stop();save(claimPath,claim,true);}if(exists(registry)){if(JSON.stringify(read(registry))!==JSON.stringify(registration))stop();journal=read(path);}else{const t=now();if(!integer(t)||expiresAt<=t||expiresAt-t>21600000)stop();save(registry,registration,true);journal={version:1,binding,entries:[]};save(path,journal,true);}}finally{if(lock!==undefined){closeSync(lock);unlinkSync(registry+'.lock');}}
  const intentPath=n=>registry+'.intent-'+String(n).padStart(3,'0');
  const intent=e=>({path,binding,number:e.number,phase:e.phase,actor:e.actor,page:e.page,requestId:e.requestId,startedAt:e.startedAt});
  const completionPath=n=>registry+'.completed-'+String(n).padStart(3,'0'),completion=e=>({...intent(e),capturedAt:e.capturedAt,snapshotSha256:e.snapshotSha256,analysisHash:checksum(e.analysis)});
  const validate=j=>{if(!exact(j,['version','binding','entries'])||j.version!==1||j.binding!==binding||!Array.isArray(j.entries)||j.entries.length>maxReads)stop();const keys=new Set();for(let i=0;i<j.entries.length;i++){const e=j.entries[i],key=e?.phase+'.'+e?.actor+'.'+e?.page;if(!exact(e,['number','phase','actor','page','requestId','startedAt','status','capturedAt','snapshotSha256','analysis'])||e.number!==i+1||!phases.includes(e.phase)||!actors.includes(e.actor)||!integer(e.page)||e.page<1||e.page>4||typeof e.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(e.requestId)||!integer(e.startedAt)||!['UNKNOWN','CAPTURED'].includes(e.status)||keys.has(key))stop();keys.add(key);if(e.status==='UNKNOWN'){if(e.capturedAt!==null||e.snapshotSha256!==null||e.analysis!==null||exists(completionPath(e.number)))stop();}else{if(!integer(e.capturedAt)||e.capturedAt<e.startedAt||!digest(e.snapshotSha256)||e.analysis?.source!=='google-native-ui-snapshot-analysis'||e.analysis.pageIndex!==e.page||e.analysis.accountMatched!==true||e.analysis.complete!==false||e.analysis.quotaAccepted!==false||e.analysis.trialAccepted!==false||JSON.stringify(read(completionPath(e.number)))!==JSON.stringify(completion(e)))stop();const raw=privateFile(path+'.page-'+String(e.number).padStart(3,'0')+'.ax.txt',4000000);if(hash(raw)!==e.snapshotSha256||JSON.stringify(analyzeAuthorityNativeSnapshot({snapshot:raw.toString('utf8'),referenceAt:e.capturedAt,expectedAccountHash:e.actor==='caller'?callerHash:publisherHash}))!==JSON.stringify(e.analysis))stop();}if(JSON.stringify(read(intentPath(e.number)))!==JSON.stringify(intent(e)))stop();}if(exists(intentPath(j.entries.length+1)))stop();return j;};validate(journal);
  const stopped=()=>{if(!exists(stopPath))return false;if(JSON.stringify(read(stopPath))!==JSON.stringify(registration))stop();return true;};
  const publishStop=()=>{localStop=true;if(stopped())return;try{save(stopPath,registration,true);}catch(e){if(!stopped())throw e;}};
  const integrity=()=>{directory(path);if(JSON.stringify(read(registry))!==JSON.stringify(registration)||JSON.stringify(validate(read(path)))!==JSON.stringify(journal))stop();};
  const live=()=>{integrity();const t=now();if(!integer(t)||t>=expiresAt||localStop||stopped())stop();};
  const write=entries=>{journal={...journal,entries};save(path,journal);};
  return Object.freeze({stop:()=>{try{publishStop();return Object.freeze({stopRequested:true});}catch(_){stop();}},status:()=>localStop||stopped()?'stopped':'ready',capture:async request=>{
   if(busy)stop();busy=true;let op,claimed=false;
   try{
    if(!exact(request,['phase','actor','page']))stop();
    request=Object.freeze({phase:request.phase,actor:request.actor,page:request.page});
    if((scopedPhase!==undefined&&request.phase!==scopedPhase)||!exact(request,['phase','actor','page'])||!phases.includes(request.phase)||!actors.includes(request.actor)||!integer(request.page)||request.page<1||request.page>4)stop();
    op=openSync(operationPath,'wx',0o600);live();claimed=true;if(journal.entries.length>=maxReads||journal.entries.some(e=>e.status!=='CAPTURED'))stop();const previous=journal.entries.filter(e=>e.phase===request.phase&&e.actor===request.actor);if(request.page!==previous.length+1||(previous.length&&previous.at(-1).analysis.nextPageAvailable!==true))stop();
    return await externalRead(async()=>{
     live();const number=journal.entries.length+1,entry={number,...request,requestId:randomUUID(),startedAt:now(),status:'UNKNOWN',capturedAt:null,snapshotSha256:null,analysis:null};save(intentPath(number),intent(entry),true);write([...journal.entries,entry]);
     const descriptor=Object.freeze({requestId:entry.requestId,actor:entry.actor,phase:entry.phase,page:entry.page,url:'https://script.google.com/home/executions',method:'getAXState',disableDiffing:true});
     const reply=await nativeRead(descriptor);live();const time=now();if(!exact(reply,['requestId','source','capturedAt','snapshot'])||reply.requestId!==entry.requestId||reply.source!=='cua.getAXState'||!integer(reply.capturedAt)||reply.capturedAt<entry.startedAt||reply.capturedAt>time+1000||time-reply.capturedAt>60000||typeof reply.snapshot!=='string'||Buffer.byteLength(reply.snapshot)>4000000)stop();
     const analysis=analyzeAuthorityNativeSnapshot({snapshot:reply.snapshot,referenceAt:reply.capturedAt,expectedAccountHash:entry.actor==='caller'?callerHash:publisherHash});if(analysis.pageIndex!==entry.page||analysis.selectedPageSize!==200)stop();
     const bytes=Buffer.from(reply.snapshot),snapshotSha256=hash(bytes);rawSave(path+'.page-'+String(number).padStart(3,'0')+'.ax.txt',bytes,true);live();const completed={...entry,status:'CAPTURED',capturedAt:reply.capturedAt,snapshotSha256,analysis};save(completionPath(number),completion(completed),true);write([...journal.entries.slice(0,-1),completed]);live();return Object.freeze({requestId:entry.requestId,capturedAt:reply.capturedAt,snapshotSha256,analysis});
    },Object.freeze({actor:request.actor,category:'pages'}));
   }catch(_){if(claimed)try{publishStop();}catch(_){}stop();}finally{if(op!==undefined){closeSync(op);unlinkSync(operationPath);}busy=false;}
  }});
 }catch(_){stop();}
}
