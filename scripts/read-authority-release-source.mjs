// Fixed read-only source transport for seven of the fifteen release observations.
// Raw observed bytes/metadata are not pin equality, native proof or acceptance.
// No refresh, account IO, counter mutation or source read occurs at construction.
import {types} from 'node:util';
const stop=()=>{throw Error('TRIAL_STOPPED');};
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const only=(v,keys,required=keys)=>record(v)&&Object.keys(v).every(k=>keys.includes(k))&&required.every(k=>Object.hasOwn(v,k));
const id=v=>typeof v==='string'&&/^[-A-Za-z0-9_]{20,200}$/.test(v);
const integer=Number.isSafeInteger;
const phases=['wrapper-before','wrapper-after'];
const scopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(s=>'https://www.googleapis.com/auth/'+s);
const sameScopes=v=>Array.isArray(v)&&v.length===scopes.length&&v.every(s=>typeof s==='string')&&JSON.stringify([...v].sort())===JSON.stringify([...scopes].sort());
function freeze(v){if(record(v)||Array.isArray(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function content(v,scriptId){
 if(!only(v,['scriptId','files'])||v.scriptId!==scriptId||!Array.isArray(v.files)||v.files.length<1||v.files.length>100)stop();
 const names=new Set();let manifests=0;
 for(const f of v.files){
  if(!only(f,['name','type','source'])||typeof f.name!=='string'||!/^[-A-Za-z0-9_]{1,128}$/.test(f.name)||names.has(f.name)||!['SERVER_JS','JSON'].includes(f.type)||typeof f.source!=='string'||Buffer.byteLength(f.source)>1000000)stop();
  names.add(f.name);
  if(f.type==='JSON'){if(f.name!=='appsscript'||!record(JSON.parse(f.source)))stop();manifests++;}
 }
 if(manifests!==1||Buffer.byteLength(JSON.stringify(v.files))>3000000)stop();return v;
}
function version(v,scriptId){
 if(!only(v,['scriptId','versionNumber','description','createTime'],['scriptId','versionNumber'])||v.scriptId!==scriptId||!integer(v.versionNumber)||v.versionNumber<1||v.versionNumber>1000000||
  (Object.hasOwn(v,'description')&&(typeof v.description!=='string'||v.description.length>1000))||
  (Object.hasOwn(v,'createTime')&&(typeof v.createTime!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(v.createTime)||!Number.isFinite(Date.parse(v.createTime)))))stop();
}
function inventory(v,key,scriptId){
 if(!only(v,[key,'nextPageToken'],[key])||(Object.hasOwn(v,'nextPageToken')&&v.nextPageToken!=='')||!Array.isArray(v[key])||v[key].length<1||v[key].length>200)stop();
 const seen=new Set();
 for(const row of v[key]){
  let identity;
  if(key==='versions'){version(row,scriptId);identity=row.versionNumber;}
  else{
   if(!only(row,['deploymentId','deploymentConfig'])||!id(row.deploymentId)||!only(row.deploymentConfig,['scriptId','versionNumber','manifestFileName','description'],['scriptId','versionNumber','manifestFileName']))stop();
   const c=row.deploymentConfig;if(c.scriptId!==scriptId||!integer(c.versionNumber)||c.versionNumber<1||c.versionNumber>1000000||c.manifestFileName!=='appsscript'||(Object.hasOwn(c,'description')&&(typeof c.description!=='string'||c.description.length>1000)))stop();identity=row.deploymentId;
  }
  if(seen.has(identity))stop();seen.add(identity);
 }
 return v;
}
async function json(r,url,max){
 if(r.status!==200||r.redirected===true||(r.url&&r.url!==url)||!r.body){if(r.body)await r.body.cancel().catch(()=>{});stop();}
 const reader=r.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;if(!types.isUint8Array(value)||(size+=value.byteLength)>max){await reader.cancel().catch(()=>{});stop();}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
export function createAuthorityReleaseSource(input){
 try{
  if(!only(input,['originalScriptId','thinScriptId','libraryVersion','publisherHash','credential','fetcher','now'],['originalScriptId','thinScriptId','libraryVersion','publisherHash','credential']))stop();
  const {originalScriptId,thinScriptId,libraryVersion,publisherHash,credential,fetcher=fetch,now=Date.now}=input;
  if(!id(originalScriptId)||!id(thinScriptId)||originalScriptId===thinScriptId||libraryVersion!==7||typeof publisherHash!=='string'||!/^[a-f0-9]{64}$/.test(publisherHash)||[credential,fetcher,now].some(f=>typeof f!=='function'))stop();
  const base=id=>'https://script.googleapis.com/v1/projects/'+id,query=f=>'?fields='+encodeURIComponent(f);
  const contentFields=query('scriptId,files(name,type,source)'),versionFields=query('nextPageToken,versions(scriptId,versionNumber,description,createTime)'),deploymentFields=query('nextPageToken,deployments(deploymentId,deploymentConfig(scriptId,versionNumber,manifestFileName,description))');
  const sourceCall=(scriptId,suffix='')=>({url:base(scriptId)+'/content'+contentFields+suffix,max:4000000,decode:v=>content(v,scriptId)});
  const deploymentsCall=scriptId=>({url:base(scriptId)+'/deployments'+deploymentFields+'&pageSize=200',max:100000,decode:v=>inventory(v,'deployments',scriptId)});
  const calls=Object.freeze({
   'original-project':{url:base(originalScriptId)+query('scriptId,parentId'),max:100000,decode:v=>{if(!only(v,['scriptId','parentId'],['scriptId'])||v.scriptId!==originalScriptId||(Object.hasOwn(v,'parentId')&&!id(v.parentId)))stop();return v;}},
   'original-editor':sourceCall(originalScriptId),
   'original-versions':{url:base(originalScriptId)+'/versions'+versionFields+'&pageSize=200',max:100000,decode:v=>inventory(v,'versions',originalScriptId)},
   'original-deployments':deploymentsCall(originalScriptId),
   'library-content':sourceCall(originalScriptId,'&versionNumber='+libraryVersion),
   'thin-content':sourceCall(thinScriptId,'&versionNumber=1'),
   'thin-deployments':deploymentsCall(thinScriptId)
  });
  let busy=false,stopped=false;const seen=new Set();
  return Object.freeze({read:async function(alias,control){
   let held=false;
   try{
    if(stopped||busy||arguments.length!==2||typeof alias!=='string'||!Object.hasOwn(calls,alias)||!control)stop();
    const phase=control.phase,external=control.externalRead,key=phase+':'+alias,call=calls[alias];
    if(!phases.includes(phase)||typeof external!=='function'||seen.has(key))stop();
    busy=true;held=true;seen.add(key);
    const raw=credential();if(types.isPromise(raw)){void Promise.prototype.then.call(raw,()=>{},()=>{});stop();}
    const tokenKeys=['accessToken','accountHash','scopes','expiresAt','refreshTokenPresent'];if(!only(raw,tokenKeys))stop();
    const token=Object.fromEntries(tokenKeys.map(k=>[k,raw[k]]));if(Array.isArray(token.scopes))token.scopes=Object.freeze([...token.scopes]);
    if(typeof token.accessToken!=='string'||!token.accessToken||token.accessToken.length>8192||/[\s\x00-\x1f\x7f]/.test(token.accessToken)||token.accountHash!==publisherHash||!sameScopes(token.scopes)||!integer(token.expiresAt)||typeof token.refreshTokenPresent!=='boolean')stop();
    const live=()=>{const t=now();if(stopped||!integer(t)||token.expiresAt-t<=10000)stop();};
    live();return await external(async()=>{
     live();const response=await fetcher(call.url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{authorization:'Bearer '+token.accessToken,'cache-control':'no-cache, no-store',pragma:'no-cache'}});
     const value=freeze(call.decode(await json(response,call.url,call.max)));live();return value;
    },alias);
   }catch(_){stopped=true;stop();}finally{if(held)busy=false;}
  }});
 }catch(_){stop();}
}
