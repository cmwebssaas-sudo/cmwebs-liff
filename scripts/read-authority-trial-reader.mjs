// Local candidate. Real fixture/import, scope, native window and itemized budget
// gates belong to trusted orchestration. No operation runs at construction.
import {openSync,closeSync,writeSync,fsyncSync,readFileSync,lstatSync,mkdirSync,renameSync,unlinkSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {homedir,userInfo} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {types} from 'node:util';
const stop=()=>{throw Error('TRIAL_STOPPED');},hash=v=>createHash('sha256').update(v).digest('hex'),checksum=v=>hash(JSON.stringify(v));
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const only=(v,keys,required=keys)=>record(v)&&Object.keys(v).every(k=>keys.includes(k))&&required.every(k=>Object.hasOwn(v,k));
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const id=(v,min=1)=>typeof v==='string'&&new RegExp('^[-A-Za-z0-9_]{'+min+',200}$').test(v);
const email=v=>typeof v==='string'&&v.length<=254&&/^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,63}$/.test(v.toLowerCase());
const scopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(s=>'https://www.googleapis.com/auth/'+s);
function directory(p){const s=lstatSync(dirname(p));if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==userInfo().uid||(s.mode&0o777)!==0o700)stop();}
function read(p){const s=lstatSync(p);if(!s.isFile()||s.isSymbolicLink()||s.uid!==userInfo().uid||(s.mode&0o777)!==0o600||s.size>20000)stop();const e=JSON.parse(readFileSync(p,'utf8'));if(!only(e,['value','sha256'])||checksum(e.value)!==e.sha256)stop();return e.value;}
function save(p,value,initial=false){directory(p);const temp=initial?p:p+'.'+randomUUID()+'.tmp',fd=openSync(temp,'wx',0o600);try{writeSync(fd,JSON.stringify({value,sha256:checksum(value)}));fsyncSync(fd);}finally{closeSync(fd);}if(!initial)renameSync(temp,p);const d=openSync(dirname(p),'r');try{fsyncSync(d);}finally{closeSync(d);}if(JSON.stringify(read(p))!==JSON.stringify(value))stop();}
async function json(r,url,max=16000){
 if(r.status!==200||r.redirected===true||(r.url&&r.url!==url)||!r.body){if(r.body)await r.body.cancel().catch(()=>{});stop();}const reader=r.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;if(!types.isUint8Array(value)||(size+=value.byteLength)>max){await reader.cancel().catch(()=>{});stop();}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
function permission(p,role,accountHash){
 if(!only(p,['id','type','role','emailAddress','deleted','permissionDetails','kind'],['id','type','role','emailAddress'])||!id(p.id)||p.type!=='user'||p.role!==role||!email(p.emailAddress)||hash(p.emailAddress.toLowerCase())!==accountHash||p.deleted===true||
  (Object.hasOwn(p,'deleted')&&typeof p.deleted!=='boolean')||(Object.hasOwn(p,'kind')&&p.kind!=='drive#permission'))stop();
 if(Object.hasOwn(p,'permissionDetails')){if(!Array.isArray(p.permissionDetails)||p.permissionDetails.length>10)stop();for(const d of p.permissionDetails)if(!only(d,['inherited','permissionType','role'],['inherited','permissionType','role'])||d.inherited!==false||d.permissionType!=='file'||d.role!==role)stop();}
 return p.id;
}
function acl(v){if(!only(v,['permissions','nextPageToken'],['permissions'])||!Array.isArray(v.permissions)||v.permissions.length>2||(Object.hasOwn(v,'nextPageToken')&&v.nextPageToken!==''))stop();return v.permissions;}
export function createAuthorityTrialReader(input){
 try{
  if(!only(input,['path','epoch','originalSheetId','syntheticSheetId','callerEmail','callerHash','publisherHash','fixtureHash','expiresAt','creationReceipt','metadata','control','credential','fetcher','now'],['path','epoch','originalSheetId','syntheticSheetId','callerEmail','callerHash','publisherHash','fixtureHash','expiresAt','creationReceipt','metadata','control','credential']))stop();
  const {epoch,originalSheetId,syntheticSheetId,callerHash,publisherHash,fixtureHash,expiresAt,control,metadata,credential,fetcher=fetch,now=Date.now}=input;
  const callerEmail=typeof input.callerEmail==='string'?input.callerEmail.toLowerCase():null,path=resolve(input.path),creation={...input.creationReceipt};directory(path);
  if(!id(epoch,20)||!id(originalSheetId,20)||!id(syntheticSheetId,20)||originalSheetId===syntheticSheetId||![callerHash,publisherHash,fixtureHash].every(digest)||callerHash===publisherHash||!email(callerEmail)||hash(callerEmail)!==callerHash||!Number.isSafeInteger(expiresAt)||
   !only(creation,['source','epoch','syntheticSheetId','publisherHash','fixtureHash'])||creation.source!=='fixed-trial-import-readback'||creation.epoch!==epoch||creation.syntheticSheetId!==syntheticSheetId||creation.publisherHash!==publisherHash||creation.fixtureHash!==fixtureHash||
   [credential,fetcher,now,metadata?.read,control?.externalRead,control?.cleanup].some(f=>typeof f!=='function'))stop();
  const cap=Object.freeze({read:metadata.read,external:control.externalRead,cleanup:control.cleanup});const metadataControl=Object.freeze({externalRead:cap.external});
  const binding=checksum({epoch,originalSheetId,syntheticSheetId,callerHash,publisherHash,fixtureHash,expiresAt,creation}),registryDir=join(homedir(),'.codex','private','cmwebs-authority-trials');mkdirSync(registryDir,{recursive:true,mode:0o700});
  const registry=join(registryDir,checksum(epoch)+'.reader.json'),registration={path,binding};directory(registry);let journal,lock;
  try{
   lock=openSync(registry+'.lock','wx',0o600);let existing=true;try{lstatSync(registry);}catch(e){if(e.code==='ENOENT')existing=false;else throw e;}
   if(existing){if(JSON.stringify(read(registry))!==JSON.stringify(registration))stop();journal=read(path);}
   else{const start=now();if(!Number.isSafeInteger(start)||expiresAt<=start||expiresAt-start>21600000)stop();save(registry,registration,true);journal={version:1,binding,state:'ready',permissionId:null,ownerId:null,grantStarted:false,grantAttempted:false,grantOutcome:'NOT_SENT',removeAttempted:false,removeOutcome:'NOT_STARTED',verifyAttempted:false,verifyOutcome:'NOT_STARTED',stopRequested:false};save(path,journal,true);}
  }finally{if(lock!==undefined){closeSync(lock);unlinkSync(registry+'.lock');}}
  const validate=j=>{if(!only(j,['version','binding','state','permissionId','ownerId','grantStarted','grantAttempted','grantOutcome','removeAttempted','removeOutcome','verifyAttempted','verifyOutcome','stopRequested'])||j.version!==1||j.binding!==binding||
   !['ready','checking','grant-intent','reader-verified','failed','stopped'].includes(j.state)||['grantStarted','grantAttempted','removeAttempted','verifyAttempted','stopRequested'].some(k=>typeof j[k]!=='boolean')||
   !['NOT_SENT','UNKNOWN','ACK_MATCHED','READER_VERIFIED'].includes(j.grantOutcome)||!['NOT_STARTED','UNKNOWN','ACK_UNVERIFIED','NO_GRANT'].includes(j.removeOutcome)||!['NOT_STARTED','UNKNOWN','ABSENT_AT_READBACK'].includes(j.verifyOutcome)||
   [j.permissionId,j.ownerId].some(v=>v!==null&&!id(v))||(j.grantAttempted&&(!j.grantStarted||!j.permissionId||!j.ownerId||j.permissionId===j.ownerId)))stop();return j;};validate(journal);
  const stopPath=registry+'.stop',operationPath=path+'.operation.lock';
  const stopped=()=>{try{lstatSync(stopPath);}catch(e){if(e.code==='ENOENT')return false;throw e;}if(JSON.stringify(read(stopPath))!==JSON.stringify(registration))stop();return true;};
  const publishStop=()=>{if(stopped())return;try{save(stopPath,registration,true);}catch(e){if(!stopped())throw e;}};
  const release=fd=>{if(fd!==undefined)try{closeSync(fd);unlinkSync(operationPath);}catch(_){stop();}};
  const write=patch=>{journal={...journal,...patch};save(path,journal);};
  const integrity=()=>{directory(path);if(JSON.stringify(read(registry))!==JSON.stringify(registration)||JSON.stringify(read(path))!==JSON.stringify(journal))stop();};
  const live=()=>{integrity();const t=now();if(!Number.isSafeInteger(t)||t>=expiresAt||journal.stopRequested||stopped())stop();};
  const token=()=>{const raw=credential();if(types.isPromise(raw)){void Promise.prototype.then.call(raw,()=>{},()=>{});stop();}if(!only(raw,['accessToken','accountHash','scopes','expiresAt','refreshTokenPresent']))stop();const v={...raw};
   if(typeof v.accessToken!=='string'||v.accessToken.length>8192||!v.accessToken||/[\s\x00-\x1f\x7f]/.test(v.accessToken)||v.accountHash!==publisherHash||!Array.isArray(v.scopes)||JSON.stringify([...v.scopes].sort())!==JSON.stringify([...scopes].sort())||!Number.isSafeInteger(v.expiresAt)||typeof v.refreshTokenPresent!=='boolean'||v.expiresAt-now()<=10000)stop();return v;};
  const options=(method,t,body)=>({method,redirect:'manual',signal:AbortSignal.timeout(10000),headers:{authorization:'Bearer '+t.accessToken,'cache-control':'no-cache, no-store',...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const base='https://www.googleapis.com/drive/v3/files/'+syntheticSheetId+'/permissions';
  const ownerOnly=v=>{const rows=acl(v);if(rows.length!==1)stop();return permission(rows[0],'owner',publisherHash);};
  const verifyReader=v=>{const rows=acl(v);if(rows.length!==2)stop();const own=rows.filter(p=>p.role==='owner'),call=rows.filter(p=>p.role==='reader');if(own.length!==1||call.length!==1||permission(own[0],'owner',publisherHash)!==journal.ownerId||permission(call[0],'reader',callerHash)!==journal.permissionId)stop();};
  let grantPromise,removing=false,verifying=false;
  const grantWork=async()=>{
   let op,claimed=false;
   try{
    op=openSync(operationPath,'wx',0o600);integrity();if(journal.grantStarted||journal.grantAttempted||journal.stopRequested||stopped())stop();claimed=true;write({grantStarted:true,state:'checking'});live();
    const lookup=await cap.read('caller-permission-id',metadataControl);live();if(!only(lookup,['kind','id'])||lookup.kind!=='drive#permissionId'||!id(lookup.id))stop();write({permissionId:lookup.id});
    const originalOwner=ownerOnly(await cap.read('original-acl',metadataControl));live();if(originalOwner===journal.permissionId)stop();
    const file=await cap.read('synthetic-file',metadataControl);live();if(!only(file,['id','mimeType','ownedByMe','trashed'])||file.id!==syntheticSheetId||file.mimeType!=='application/vnd.google-apps.spreadsheet'||file.ownedByMe!==true||file.trashed!==false)stop();
    const newOwner=ownerOnly(await cap.read('synthetic-acl',metadataControl));live();if(newOwner!==originalOwner||newOwner===journal.permissionId)stop();write({ownerId:newOwner});
    live();const t=token();const reply=await cap.external(async()=>{live();if(t.expiresAt-now()<=10000)stop();
     write({state:'grant-intent',grantAttempted:true,grantOutcome:'UNKNOWN'});live();
     const url=base+'?fields='+encodeURIComponent('kind,id,type,role,emailAddress')+'&sendNotificationEmail=false';
     return await json(await fetcher(url,options('POST',t,{type:'user',role:'reader',emailAddress:callerEmail})),url);
    });
    if(!only(reply,['kind','id','type','role','emailAddress'])||reply.kind!=='drive#permission'||permission(reply,'reader',callerHash)!==journal.permissionId)stop();write({grantOutcome:'ACK_MATCHED'});live();
    verifyReader(await cap.read('synthetic-acl',metadataControl));live();write({state:'reader-verified',grantOutcome:'READER_VERIFIED'});return Object.freeze({readerVerified:true,permissionHash:hash(journal.permissionId)});
   }catch(_){if(claimed)try{integrity();write({state:'failed'});}catch(_){}stop();}finally{release(op);}
  };
  return Object.freeze({status:()=>journal.state,
   grant:()=>{if(grantPromise||journal.grantStarted||journal.stopRequested)return Promise.reject(Error('TRIAL_STOPPED'));grantPromise=grantWork();return grantPromise;},
   remove:async()=>{
    if(removing||journal.removeAttempted)stop();removing=true;let failed=false,op;
    try{try{publishStop();}catch(_){failed=true;}if(grantPromise)await grantPromise.catch(()=>{});
     op=openSync(operationPath,'wx',0o600);try{journal=validate(read(path));}catch(_){if(!journal.grantAttempted||!journal.permissionId||!journal.ownerId)stop();failed=true;}
     if(journal.removeAttempted)stop();try{write({stopRequested:true,state:'stopped'});}catch(_){failed=true;}
     if(!journal.grantAttempted){try{write({removeAttempted:true,removeOutcome:'NO_GRANT'});}catch(_){failed=true;}if(failed)stop();return Object.freeze({grantNeverDispatched:true});}
     if(!journal.permissionId||!journal.ownerId||journal.permissionId===journal.ownerId)stop();
     await cap.cleanup('remove-reader',async()=>{try{write({removeAttempted:true,removeOutcome:'UNKNOWN'});}catch(_){failed=true;}const t=token(),url=base+'/'+encodeURIComponent(journal.permissionId),r=await fetcher(url,options('DELETE',t));if(r.redirected===true||(r.url&&r.url!==url)){if(r.body)await r.body.cancel().catch(()=>{});stop();}if(r.status===204){if(r.body!==null){await r.body.cancel().catch(()=>{});stop();}}else{const v=await json(r,url,4096);if(!only(v,[]))stop();}});
     try{write({removeOutcome:'ACK_UNVERIFIED'});}catch(_){failed=true;}if(failed)stop();return Object.freeze({removeAcknowledged:true,rollbackComplete:false});
    }catch(_){stop();}finally{release(op);removing=false;}
   },verifyRemoved:async()=>{
    if(removing||verifying)stop();verifying=true;let failed=false,op;
    try{op=openSync(operationPath,'wx',0o600);try{journal=validate(read(path));}catch(_){if(!journal.grantAttempted||!journal.permissionId||!journal.ownerId)stop();failed=true;}if(!journal.removeAttempted||journal.removeOutcome==='NO_GRANT'||journal.verifyAttempted)stop();
     await cap.cleanup('verify-reader-removed',async()=>{try{write({verifyAttempted:true,verifyOutcome:'UNKNOWN'});}catch(_){failed=true;}const t=token(),fields='nextPageToken,permissions(kind,id,type,role,emailAddress,deleted,permissionDetails(inherited,permissionType,role))',url=base+'?fields='+encodeURIComponent(fields)+'&pageSize=100';const v=await json(await fetcher(url,options('GET',t)),url);if(ownerOnly(v)!==journal.ownerId)stop();});
     try{write({verifyOutcome:'ABSENT_AT_READBACK'});}catch(_){failed=true;}if(failed)stop();return Object.freeze({readerAbsentAtReadback:true,grantOutcomeKnown:['ACK_MATCHED','READER_VERIFIED'].includes(journal.grantOutcome),rollbackComplete:false});
    }catch(_){stop();}finally{release(op);verifying=false;}
   }
  });
 }catch(_){stop();}
}
