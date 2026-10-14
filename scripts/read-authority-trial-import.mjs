// Local candidate; trusted offline XLSX preflight and complete execution gates
// are orchestration inputs, not proved by receipt shape. No IO at construction.
import {openSync,closeSync,writeSync,fsyncSync,readFileSync,lstatSync,mkdirSync,renameSync,unlinkSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {homedir,userInfo} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {types} from 'node:util';
const stop=()=>{throw Error('TRIAL_STOPPED');},hash=v=>createHash('sha256').update(v).digest('hex'),checksum=v=>hash(JSON.stringify(v));
const record=v=>v&&typeof v==='object'&&!Array.isArray(v),only=(v,keys,required=keys)=>record(v)&&Object.keys(v).every(k=>keys.includes(k))&&required.every(k=>Object.hasOwn(v,k));
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),id=v=>typeof v==='string'&&/^[-A-Za-z0-9_]{20,200}$/.test(v),mime='application/vnd.google-apps.spreadsheet';
const scopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(s=>'https://www.googleapis.com/auth/'+s);
function directory(p){const s=lstatSync(dirname(p));if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==userInfo().uid||(s.mode&0o777)!==0o700)stop();}
function read(p){const s=lstatSync(p);if(!s.isFile()||s.isSymbolicLink()||s.uid!==userInfo().uid||(s.mode&0o777)!==0o600||s.size>20000)stop();const e=JSON.parse(readFileSync(p,'utf8'));if(!only(e,['value','sha256'])||checksum(e.value)!==e.sha256)stop();return e.value;}
function save(p,value,initial=false){directory(p);const temp=initial?p:p+'.'+randomUUID()+'.tmp',fd=openSync(temp,'wx',0o600);try{writeSync(fd,JSON.stringify({value,sha256:checksum(value)}));fsyncSync(fd);}finally{closeSync(fd);}if(!initial)renameSync(temp,p);const d=openSync(dirname(p),'r');try{fsyncSync(d);}finally{closeSync(d);}if(JSON.stringify(read(p))!==JSON.stringify(value))stop();}
async function json(r,url){
 if(r.status!==200||r.redirected===true||(r.url&&r.url!==url)||!r.body){if(r.body)await r.body.cancel().catch(()=>{});stop();}const reader=r.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;if(!types.isUint8Array(value)||(size+=value.byteLength)>4096){await reader.cancel().catch(()=>{});stop();}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
export function createAuthorityTrialImport(input){
 try{
  if(!only(input,['path','epoch','originalSheetId','publisherHash','fixtureHash','fixtureBytes','preflightReceipt','expiresAt','control','credential','fetcher','now'],['path','epoch','originalSheetId','publisherHash','fixtureHash','fixtureBytes','preflightReceipt','expiresAt','control','credential']))stop();
  const {epoch,originalSheetId,publisherHash,fixtureHash,expiresAt,control,credential,fetcher=fetch,now=Date.now}=input;
  if(typeof input.path!=='string'||!id(epoch)||!id(originalSheetId)||!digest(publisherHash)||!digest(fixtureHash)||!Number.isSafeInteger(expiresAt)||!types.isUint8Array(input.fixtureBytes)||input.fixtureBytes.length<4||input.fixtureBytes.length>5242880||[credential,fetcher,now,control?.externalRead].some(f=>typeof f!=='function'))stop();
  const path=resolve(input.path),bytes=Buffer.from(input.fixtureBytes),preflight={...input.preflightReceipt};directory(path);
  if(!bytes.subarray(0,4).equals(Buffer.from([80,75,3,4]))||hash(bytes)!==fixtureHash||!only(preflight,['source','fixtureHash','size','tabs','unsafeFeatures'])||preflight.source!=='fixed-trial-xlsx-preflight'||preflight.fixtureHash!==fixtureHash||preflight.size!==bytes.length||preflight.tabs!==20||preflight.unsafeFeatures!==false)stop();
  // This trusted receipt binds the already-reviewed offline preflight; this
  // adapter does not parse ZIP/XML, verify data types, or attest absence of bind.
  const cap=Object.freeze({external:control.externalRead});
  const binding=checksum({epoch,originalSheetId,publisherHash,fixtureHash,expiresAt,preflight}),registryDir=join(homedir(),'.codex','private','cmwebs-authority-trials');mkdirSync(registryDir,{recursive:true,mode:0o700});
  const registry=join(registryDir,checksum(epoch)+'.import.json'),registration={path,binding};directory(registry);let journal,lock;
  try{lock=openSync(registry+'.lock','wx',0o600);let existing=true;try{lstatSync(registry);}catch(e){if(e.code==='ENOENT')existing=false;else throw e;}
   if(existing){if(JSON.stringify(read(registry))!==JSON.stringify(registration))stop();journal=read(path);}
   else{const t=now();if(!Number.isSafeInteger(t)||expiresAt<=t||expiresAt-t>21600000)stop();save(registry,registration,true);journal={version:1,binding,state:'ready',createStarted:false,createAttempted:false,creationOutcome:'NOT_SENT',syntheticSheetId:null};save(path,journal,true);}
  }finally{if(lock!==undefined){closeSync(lock);unlinkSync(registry+'.lock');}}
  const validate=j=>{if(!only(j,['version','binding','state','createStarted','createAttempted','creationOutcome','syntheticSheetId'])||j.version!==1||j.binding!==binding||!['ready','creating','created','verified','stopped'].includes(j.state)||['createStarted','createAttempted'].some(k=>typeof j[k]!=='boolean')||!['NOT_SENT','UNKNOWN','ACK_MATCHED','VERIFIED'].includes(j.creationOutcome)||(j.createAttempted&&!j.createStarted)||(j.creationOutcome!=='NOT_SENT'&&!j.createAttempted)||(j.syntheticSheetId!==null&&(!id(j.syntheticSheetId)||j.syntheticSheetId===originalSheetId))||(['ACK_MATCHED','VERIFIED'].includes(j.creationOutcome)&&!j.syntheticSheetId))stop();return j;};validate(journal);
  const stopPath=registry+'.stop',operationPath=path+'.operation.lock';let localStopRequested=false;
  const stopped=()=>{try{lstatSync(stopPath);}catch(e){if(e.code==='ENOENT')return false;throw e;}if(JSON.stringify(read(stopPath))!==JSON.stringify(registration))stop();return true;};
  const publishStop=()=>{if(stopped())return;try{save(stopPath,registration,true);}catch(e){if(!stopped())throw e;}};
  const integrity=()=>{directory(path);if(JSON.stringify(read(registry))!==JSON.stringify(registration)||JSON.stringify(read(path))!==JSON.stringify(journal))stop();};
  const live=()=>{integrity();const t=now();if(!Number.isSafeInteger(t)||t>=expiresAt||localStopRequested||stopped())stop();};
  const write=patch=>{journal={...journal,...patch};save(path,journal);};
  const token=()=>{const raw=credential();if(types.isPromise(raw)){void Promise.prototype.then.call(raw,()=>{},()=>{});stop();}if(!only(raw,['accessToken','accountHash','scopes','expiresAt','refreshTokenPresent']))stop();const t={...raw};
   if(typeof t.accessToken!=='string'||!t.accessToken||t.accessToken.length>8192||/[\s\x00-\x1f\x7f]/.test(t.accessToken)||t.accountHash!==publisherHash||!Array.isArray(t.scopes)||JSON.stringify([...t.scopes].sort())!==JSON.stringify([...scopes].sort())||!Number.isSafeInteger(t.expiresAt)||typeof t.refreshTokenPresent!=='boolean'||t.expiresAt-now()<=10000)stop();return t;};
  const request=async(url,method,body,contentType)=>{live();const t=token();return cap.external(async()=>{live();if(t.expiresAt-now()<=10000)stop();if(method==='POST'){write({createAttempted:true,creationOutcome:'UNKNOWN'});live();}
   return json(await fetcher(url,{method,redirect:'manual',signal:AbortSignal.timeout(10000),headers:{authorization:'Bearer '+t.accessToken,'cache-control':'no-cache, no-store',...(contentType?{'content-type':contentType}: {})},...(body?{body}: {})}),url);});};
  let started=false;
  return Object.freeze({status:()=>localStopRequested||stopped()?'stopped':journal.state,stop:()=>{localStopRequested=true;try{publishStop();return Object.freeze({stopRequested:true,creationOutcome:journal.creationOutcome});}catch(_){stop();}},create:async()=>{
   if(started)stop();started=true;let op,claimed=false;
   try{op=openSync(operationPath,'wx',0o600);integrity();if(journal.createStarted||journal.createAttempted||localStopRequested||stopped())stop();claimed=true;write({createStarted:true,state:'creating'});live();
    const boundary='cmwebs_'+randomUUID().replaceAll('-',''),metadata={name:'CMWebs C3 synthetic '+hash(epoch).slice(0,16),mimeType:mime};
    const body=Buffer.concat([Buffer.from('--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n'),bytes,Buffer.from('\r\n--'+boundary+'--\r\n')]);
    const url='https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields='+encodeURIComponent('id,mimeType');
    const v=await request(url,'POST',body,'multipart/related; boundary='+boundary);
    if(record(v)&&id(v.id)&&v.id!==originalSheetId)write({syntheticSheetId:v.id});
    if(!only(v,['id','mimeType'])||!id(v.id)||v.id===originalSheetId||v.mimeType!==mime)stop();write({state:'created',creationOutcome:'ACK_MATCHED'});live();
    const fields='id,mimeType,ownedByMe,trashed,driveId',get='https://www.googleapis.com/drive/v3/files/'+journal.syntheticSheetId+'?fields='+encodeURIComponent(fields),r=await request(get,'GET');
    if(!only(r,['id','mimeType','ownedByMe','trashed'])||r.id!==journal.syntheticSheetId||r.mimeType!==mime||r.ownedByMe!==true||r.trashed!==false)stop();live();write({state:'verified',creationOutcome:'VERIFIED'});
    return Object.freeze({source:'fixed-trial-import-readback',epoch,syntheticSheetId:journal.syntheticSheetId,publisherHash,fixtureHash});
   }catch(_){if(claimed)try{integrity();write({state:'stopped'});}catch(_){}stop();}finally{if(op!==undefined)try{closeSync(op);unlinkSync(operationPath);}catch(_){stop();}}
  }});
 }catch(_){stop();}
}
