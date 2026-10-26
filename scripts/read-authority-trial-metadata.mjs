// Local, fixed read-only preparation/observer adapters. No grant, upload,
// source publication, token refresh, pagination or trial RPC is implemented.
import {types} from 'node:util';
import {createHash} from 'node:crypto';
import {AUTHORITY_TRIAL_SCOPES} from './read-authority-trial-driver.mjs';
const stop=()=>{throw Error('TRIAL_STOPPED');};
const managementScopes=Object.freeze(['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(s=>'https://www.googleapis.com/auth/'+s));
const roles=['owner','writer','reader','commenter','organizer','fileOrganizer'];
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const only=(v,allowed,required=[])=>record(v)&&Object.keys(v).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(v,k));
const text=(v,max=200)=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\r\n]/.test(v);
const id=v=>typeof v==='string'&&/^[-A-Za-z0-9_]{20,200}$/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const sameScopes=(v,expected)=>Array.isArray(v)&&v.length===expected.length&&v.every(x=>typeof x==='string')&&JSON.stringify([...v].sort())===JSON.stringify([...expected].sort());
const metadataAdapters=new WeakMap();
function freeze(v){if(record(v)||Array.isArray(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function fileMetadata(v,expected){
 if(!only(v,['id','mimeType','trashed','ownedByMe','driveId'],['id','mimeType','trashed','ownedByMe'])||v.id!==expected||
  v.mimeType!=='application/vnd.google-apps.spreadsheet'||v.trashed!==false||v.ownedByMe!==true||Object.hasOwn(v,'driveId'))stop();
 return v;
}
function permissions(v){
 if(!only(v,['permissions','nextPageToken'],['permissions'])||(Object.hasOwn(v,'nextPageToken')&&v.nextPageToken!=='')||!Array.isArray(v.permissions)||v.permissions.length>100)stop();
 for(const p of v.permissions){
  if(!only(p,['id','type','role','emailAddress','domain','deleted','allowFileDiscovery','permissionDetails'],['id','type','role'])||!text(p.id)||!['user','group','domain','anyone'].includes(p.type)||!roles.includes(p.role)||
   (Object.hasOwn(p,'emailAddress')&&!text(p.emailAddress,320))||(Object.hasOwn(p,'domain')&&!text(p.domain,253))||
   ['deleted','allowFileDiscovery'].some(k=>Object.hasOwn(p,k)&&typeof p[k]!=='boolean'))stop();
  if(Object.hasOwn(p,'permissionDetails')){
   if(!Array.isArray(p.permissionDetails)||p.permissionDetails.length>10)stop();
   for(const d of p.permissionDetails)if(!only(d,['inherited','inheritedFrom','permissionType','role'],['inherited','permissionType','role'])||typeof d.inherited!=='boolean'||
    !['file','member'].includes(d.permissionType)||!roles.includes(d.role)||(Object.hasOwn(d,'inheritedFrom')&&!text(d.inheritedFrom)))stop();
  }
 }
 // This is a complete single-page shape, not a no-Viewer/caller-role proof.
 // Groups, public/domain and inherited access remain visible to the verifier.
 return v;
}
function permissionIdentity(v){
 if(!only(v,['kind','id'],['kind','id'])||v.kind!=='drive#permissionId'||typeof v.id!=='string'||!/^[-A-Za-z0-9_]{1,200}$/.test(v.id))stop();
 // Opaque grantee ID only. Never numeric coercion or a role/no-Viewer proof.
 return v;
}
function tabs(v,expected,names){
 if(!only(v,['spreadsheetId','properties','sheets'],['spreadsheetId','properties','sheets'])||v.spreadsheetId!==expected||
  !only(v.properties,['timeZone'],['timeZone'])||v.properties.timeZone!=='Asia/Taipei'||!Array.isArray(v.sheets)||v.sheets.length!==20)stop();
 const ids=new Set(),titles=new Set();
 for(const s of v.sheets){
  if(!only(s,['properties'],['properties'])||!only(s.properties,['sheetId','title'],['sheetId','title']))stop();
  const {sheetId,title}=s.properties;
  if(!Number.isSafeInteger(sheetId)||sheetId<0||sheetId>2147483647||ids.has(sheetId)||!names.includes(title)||titles.has(title))stop();
  ids.add(sheetId);titles.add(title);
 }
 return v;
}
async function boundedJson(response,max,url){
 if(response.status!==200||response.redirected===true||(response.url&&response.url!==url)||!response.body){if(response.body)await response.body.cancel().catch(()=>{});stop();}
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;
   if(!types.isUint8Array(value)||(size+=value.byteLength)>max){await reader.cancel().catch(()=>{});stop();}chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
// Standalone inputs are exact own data. References are retained only for named
// trusted callback/adapter slots; all JSON pins are copied without hooks.
function standaloneSnapshot(value,references=[]){
 const plain=v=>v&&typeof v==='object'&&!types.isProxy(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
 if(!plain(value))stop();let count=0;const active=new Set();
 const copy=(v,depth)=>{
  if(++count>2000||depth>10)stop();
  if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return v;
  if(!v||typeof v!=='object'||types.isProxy(v)||active.has(v)||(!Array.isArray(v)&&!plain(v)))stop();
  active.add(v);const ds=Object.getOwnPropertyDescriptors(v),names=Reflect.ownKeys(ds),array=Array.isArray(v),out=array?[]:{};
  if(array&&(v.length>200||names.length!==v.length+1||Array.from({length:v.length},(_,i)=>String(i)).some(k=>!Object.hasOwn(ds,k))))stop();
  for(const k of names){if(array&&k==='length')continue;const d=ds[k];if(typeof k!=='string'||!d.enumerable||!Object.hasOwn(d,'value'))stop();Object.defineProperty(out,k,{value:copy(d.value,depth+1),enumerable:true});}
  active.delete(v);return Object.freeze(out);
 };
 const out={};for(const k of Reflect.ownKeys(Object.getOwnPropertyDescriptors(value))){const d=Object.getOwnPropertyDescriptor(value,k);if(typeof k!=='string'||!d.enumerable||!Object.hasOwn(d,'value'))stop();Object.defineProperty(out,k,{value:references.includes(k)?d.value:copy(d.value,0),enumerable:true});}return Object.freeze(out);
}
export function createAuthorityTrialMetadataAdapters(input){return createMetadataAdapters(input,false);}
export function createAuthorityStandaloneTrialMetadata(input){
 try{if(arguments.length!==1)stop();return createMetadataAdapters(standaloneSnapshot(input,['credential','fetcher','now']),true);}catch(_){stop();}
}
function createMetadataAdapters(input,standalone){
 try{
  if(!only(input,['originalSheetId','syntheticSheetId','expectedTabNames','publisherHash','callerHash','callerEmail','credential','fetcher','now',...(standalone?['mode','thinScriptId','originalScriptId']:[])],['originalSheetId','syntheticSheetId','expectedTabNames','publisherHash','callerHash','credential',...(standalone?['mode','thinScriptId','originalScriptId']:[])]))stop();
  const {originalSheetId,syntheticSheetId,publisherHash,callerHash,credential,fetcher=fetch,now=Date.now}=input;
  const names=Array.isArray(input.expectedTabNames)?[...input.expectedTabNames]:null;
  if(!id(originalSheetId)||!id(syntheticSheetId)||originalSheetId===syntheticSheetId||!hash(publisherHash)||!hash(callerHash)||publisherHash===callerHash||
   !names||names.length!==20||names.some(n=>!text(n,256))||new Set(names).size!==20||[credential,fetcher,now].some(f=>typeof f!=='function'))stop();
  if(standalone&&(input.mode!=='standalone-script'||!id(input.thinScriptId)||!id(input.originalScriptId)||new Set([originalSheetId,syntheticSheetId,input.thinScriptId,input.originalScriptId]).size!==4))stop();
  let email;
  if(Object.hasOwn(input,'callerEmail')){
   if(typeof input.callerEmail!=='string'||input.callerEmail.length>254||/[\s\x00-\x1f\x7f]/.test(input.callerEmail))stop();
   email=input.callerEmail.toLowerCase();
   if(!/^[a-z0-9._+-]{1,64}@[a-z0-9.-]+\.[a-z]{2,63}$/.test(email)||createHash('sha256').update(email).digest('hex')!==callerHash)stop();
  }
  Object.freeze(names);
  const query=fields=>'?fields='+encodeURIComponent(fields);
  const aclFields='nextPageToken,permissions(id,type,role,emailAddress,domain,deleted,allowFileDiscovery,permissionDetails(inherited,inheritedFrom,permissionType,role))';
  const aclCall=sheetId=>({actor:'publisher',url:'https://www.googleapis.com/drive/v3/files/'+sheetId+'/permissions'+query(aclFields)+'&pageSize=100',max:100000,decode:permissions});
  const calls=Object.freeze({
   'original-acl':aclCall(originalSheetId),'synthetic-acl':aclCall(syntheticSheetId),
   ...(standalone?{'standalone-acl':aclCall(input.thinScriptId)}:{}),
   'synthetic-file':{actor:'publisher',url:'https://www.googleapis.com/drive/v3/files/'+syntheticSheetId+query('id,mimeType,trashed,driveId,ownedByMe'),max:4096,decode:v=>fileMetadata(v,syntheticSheetId)},
   'synthetic-tabs':{actor:'caller',url:'https://sheets.googleapis.com/v4/spreadsheets/'+syntheticSheetId+query('spreadsheetId,properties(timeZone),sheets(properties(sheetId,title))'),max:16384,decode:v=>tabs(v,syntheticSheetId,names)},
   ...(email===undefined?{}:{'caller-permission-id':{actor:'publisher',url:'https://www.googleapis.com/drive/v2/permissionIds/'+encodeURIComponent(email)+query('kind,id'),max:4096,decode:permissionIdentity}})
  });
  let active=false,stopped=false;
  const seen=new Set();
  const adapter=Object.freeze({read:async function(operation,control){
   let held=false,admitted=false,open=true,task;
   try{
    if(standalone)control=standaloneSnapshot(control,['externalRead']);
    if(stopped||active||arguments.length!==2||typeof operation!=='string'||!Object.hasOwn(calls,operation)||!control||
     typeof control.externalRead!=='function')stop();
    if(standalone){if(!only(control,['phase','externalRead'],['externalRead'])||Object.hasOwn(control,'phase')&&!['wrapper-before','wrapper-after'].includes(control.phase))stop();const key=(control.phase??'direct')+':'+operation;if(seen.has(key))stop();seen.add(key);}
    active=true;held=true;const call=calls[operation],external=control.externalRead;
    // Trusted synchronous local getter only. No OAuth refresh/userinfo/IO here.
    let raw=credential(call.actor);
    if(types.isPromise(raw)){void Promise.prototype.then.call(raw,()=>{},()=>{});stop();}
    if(standalone)raw=standaloneSnapshot(raw);
    const tokenKeys=['accessToken','accountHash','scopes','expiresAt','refreshTokenPresent'];
    if(!only(raw,tokenKeys,tokenKeys))stop();
    const token={accessToken:raw.accessToken,accountHash:raw.accountHash,scopes:raw.scopes,expiresAt:raw.expiresAt,refreshTokenPresent:raw.refreshTokenPresent};
    if(!text(token.accessToken,8192)||/\s/.test(token.accessToken)||token.accountHash!==(call.actor==='publisher'?publisherHash:callerHash)||
     !sameScopes(token.scopes,call.actor==='publisher'?managementScopes:AUTHORITY_TRIAL_SCOPES)||!Number.isSafeInteger(token.expiresAt)||
     typeof token.refreshTokenPresent!=='boolean'||(call.actor==='caller'&&token.refreshTokenPresent!==false))stop();
    const live=()=>{const time=now();if(standalone&&stopped||!Number.isSafeInteger(time)||token.expiresAt-time<=(call.actor==='caller'?360000:10000))stop();};
    live();const invoke=()=>{
     if(standalone&&(admitted||!open||stopped)){stopped=true;stop();}admitted=true;
     task=(async()=>{live();
      const response=await fetcher(call.url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{authorization:'Bearer '+token.accessToken,'cache-control':'no-cache, no-store',pragma:'no-cache'}});
      const value=freeze(call.decode(await boundedJson(response,call.max,call.url)));live();return value;
     })();void task.catch(()=>{});return task;
    };
    const result=await external(invoke);if(standalone&&(!admitted||result!==await task||stopped))stop();return result;
   }catch(_){if(standalone)stopped=true;stop();}
   finally{open=false;if(task)await Promise.allSettled([task]);if(held)active=false;}
  }});
  metadataAdapters.set(adapter,Object.freeze({originalSheetId,syntheticSheetId,publisherHash,callerHash,names,standalone,...(standalone?{thinScriptId:input.thinScriptId,originalScriptId:input.originalScriptId}:{}),read:adapter.read}));return adapter;
 }catch(_){stop();}
}

const authorizationNames=Object.freeze(['V2_landlord_email_sessions','V2_users','V2_workspaces','V2_workspace_members','V2_landlords']);
const sha=v=>createHash('sha256').update(v).digest('hex');
function directPermission(p,role,accountHash){
 if(!only(p,['id','type','role','emailAddress','deleted','permissionDetails','allowFileDiscovery'],['id','type','role','emailAddress'])||
  typeof p.id!=='string'||!/^[-A-Za-z0-9_]{1,200}$/.test(p.id)||p.type!=='user'||p.role!==role||typeof p.emailAddress!=='string'||p.emailAddress.length>254||
  !/^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,63}$/i.test(p.emailAddress)||sha(p.emailAddress.toLowerCase())!==accountHash||
  (Object.hasOwn(p,'deleted')&&p.deleted!==false)||(Object.hasOwn(p,'allowFileDiscovery')&&p.allowFileDiscovery!==false))stop();
 if(Object.hasOwn(p,'permissionDetails')){
  if(!Array.isArray(p.permissionDetails)||p.permissionDetails.length>10)stop();
  for(const d of p.permissionDetails)if(!only(d,['inherited','permissionType','role'],['inherited','permissionType','role'])||d.inherited!==false||d.permissionType!=='file'||d.role!==role)stop();
 }
 return p.id;
}
// Derives partial evidence from this module's actual fixed transport, not from
// caller-supplied packets. Source-parent binding, headers, Properties and full
// native/quota acceptance remain distinct mandatory observations.
export function createAuthorityReleaseMetadataVerifier(input){return createReleaseMetadataVerifier(input,false);}
export function createAuthorityStandaloneMetadataVerifier(input){
 try{if(arguments.length!==1)stop();return createReleaseMetadataVerifier(standaloneSnapshot(input,['metadataAdapter']),true);}catch(_){stop();}
}
function createReleaseMetadataVerifier(input,standalone){
 try{
  if(!only(input,['metadataAdapter','originalSheetId','syntheticSheetId','publisherHash','callerHash','callerPermissionHash','expectedAuthorizationSheets',...(standalone?['mode','thinScriptId','originalScriptId']:[])],['metadataAdapter','originalSheetId','syntheticSheetId','publisherHash','callerHash','callerPermissionHash','expectedAuthorizationSheets',...(standalone?['mode','thinScriptId','originalScriptId']:[])]))stop();
  const {metadataAdapter,originalSheetId,syntheticSheetId,publisherHash,callerHash,callerPermissionHash}=input,pins=metadataAdapters.get(metadataAdapter),expected=structuredClone(input.expectedAuthorizationSheets);
  if(!pins||pins.standalone!==standalone||standalone&&(input.mode!=='standalone-script'||pins.thinScriptId!==input.thinScriptId||pins.originalScriptId!==input.originalScriptId)||pins.originalSheetId!==originalSheetId||pins.syntheticSheetId!==syntheticSheetId||pins.publisherHash!==publisherHash||pins.callerHash!==callerHash||!hash(callerPermissionHash)||!Array.isArray(expected)||expected.length!==5)stop();
  const seenNames=new Set(),seenIds=new Set();
  for(const row of expected){
   if(!only(row,['name','sheetId'],['name','sheetId'])||!authorizationNames.includes(row.name)||!pins.names.includes(row.name)||seenNames.has(row.name)||!Number.isSafeInteger(row.sheetId)||row.sheetId<0||row.sheetId>2147483647||seenIds.has(row.sheetId))stop();
   seenNames.add(row.name);seenIds.add(row.sheetId);
  }
  freeze(expected);const phases=['wrapper-before','wrapper-after'],read=pins.read;let nextPhase=0,busy=false,stopped=false;
  return Object.freeze({read:async function(control){
   let held=false,active=false;
   try{
    if(standalone){control=standaloneSnapshot(control,['externalRead']);if(!only(control,['phase','externalRead'],['phase','externalRead']))stop();}
    if(stopped||busy||arguments.length!==1||!control||control.phase!==phases[nextPhase]||typeof control.externalRead!=='function')stop();
    const phase=control.phase,external=control.externalRead;busy=true;held=true;active=true;
    const live=()=>{if(stopped||!active)stop();};
    const observe=async(operation,alias)=>{
     live();const cap=Object.freeze({...(standalone?{phase}:{}),externalRead:io=>{live();return external(async()=>{live();return await io();},alias);}});
     const value=await read.call(metadataAdapter,operation,cap);live();return value;
    };
    const synthetic=await observe('synthetic-acl','synthetic-acl');
    if(synthetic.permissions.length!==2)stop();const owners=synthetic.permissions.filter(v=>v.role==='owner'),readers=synthetic.permissions.filter(v=>v.role==='reader');if(owners.length!==1||readers.length!==1)stop();
    const ownerId=directPermission(owners[0],'owner',publisherHash),callerId=directPermission(readers[0],'reader',callerHash);
    if(ownerId===callerId||sha(callerId)!==callerPermissionHash)stop();
    const original=await observe('original-acl','original-acl');if(original.permissions.length!==1||directPermission(original.permissions[0],'owner',publisherHash)!==ownerId)stop();
    const metadata=await observe('synthetic-tabs','caller-sheets-metadata');
    const actual=expected.map(row=>{
     const matches=metadata.sheets.filter(s=>s.properties.title===row.name);if(matches.length!==1||matches[0].properties.sheetId!==row.sheetId)stop();
     return {name:matches[0].properties.title,sheetId:matches[0].properties.sheetId};
    });
    if(standalone){
     const script=await observe('standalone-acl','standalone-acl');
     if(script.permissions.length!==2)stop();const scriptOwners=script.permissions.filter(v=>v.role==='owner'),scriptReaders=script.permissions.filter(v=>v.role==='reader');
     if(scriptOwners.length!==1||scriptReaders.length!==1||directPermission(scriptOwners[0],'owner',publisherHash)!==ownerId||directPermission(scriptReaders[0],'reader',callerHash)!==callerId)stop();
    }
    live();nextPhase++;
    return freeze({source:standalone?'fixed-standalone-metadata-release-readback':'fixed-metadata-release-readback',phase,facts:{syntheticSheetId:metadata.spreadsheetId,callerSheetRole:'reader',...(standalone?{callerStandaloneScriptRole:'reader',callerOriginalSheetRole:'none'}:{})},
     originalContainer:{spreadsheetId:originalSheetId,callerRole:'none'},authorizationSheets:actual,callerPermissionHash:sha(callerId),publisherPermissionHash:sha(ownerId),
     headersVerified:false,nativeProofAccepted:false,trialAccepted:false});
   }catch(_){stopped=true;stop();}finally{active=false;if(held)busy=false;}
  }});
 }catch(_){stop();}
}
