// Fixed read-only source transport for seven of the fifteen release observations.
// Raw observed bytes/metadata are not pin equality, native proof or acceptance.
// No refresh, account IO, counter mutation or source read occurs at construction.
import {types} from 'node:util';
import {createHash} from 'node:crypto';
import {canonicalAuthorityTrialBinding,AUTHORITY_TRIAL_SCOPES} from './read-authority-trial-driver.mjs';
const stop=()=>{throw Error('TRIAL_STOPPED');};
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const only=(v,keys,required=keys)=>record(v)&&Object.keys(v).every(k=>keys.includes(k))&&required.every(k=>Object.hasOwn(v,k));
const id=v=>typeof v==='string'&&/^[-A-Za-z0-9_]{20,200}$/.test(v);
const integer=Number.isSafeInteger;
const phases=['wrapper-before','wrapper-after'];
const sourceAdapters=new WeakMap();
const aliases=['original-project','original-editor','original-versions','original-deployments','library-content','thin-content','thin-deployments'];
const sha=v=>createHash('sha256').update(v).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):record(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const checksum=v=>sha(JSON.stringify(canonical(v)));
const filesHash=v=>checksum([...v].sort((a,b)=>a.name.localeCompare(b.name)));
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
function inventory(v,key,scriptId,execution=false){
 if(!only(v,[key,'nextPageToken'],[key])||(Object.hasOwn(v,'nextPageToken')&&v.nextPageToken!=='')||!Array.isArray(v[key])||v[key].length<1||v[key].length>200)stop();
 const seen=new Set();
 for(const row of v[key]){
  let identity;
  if(key==='versions'){version(row,scriptId);identity=row.versionNumber;}
  else{
   if(!only(row,['deploymentId','deploymentConfig',...(execution?['entryPoints']:[])])||!id(row.deploymentId)||!only(row.deploymentConfig,['scriptId','versionNumber','manifestFileName','description'],['scriptId','versionNumber','manifestFileName']))stop();
   const c=row.deploymentConfig;if(c.scriptId!==scriptId||!integer(c.versionNumber)||c.versionNumber<1||c.versionNumber>1000000||c.manifestFileName!=='appsscript'||(Object.hasOwn(c,'description')&&(typeof c.description!=='string'||c.description.length>1000)))stop();identity=row.deploymentId;
   if(execution){
    if(!Array.isArray(row.entryPoints)||row.entryPoints.length!==1||!only(row.entryPoints[0],['entryPointType','executionApi']))stop();
    const e=row.entryPoints[0];if(e.entryPointType!=='EXECUTION_API'||!only(e.executionApi,['entryPointConfig'])||!only(e.executionApi.entryPointConfig,['access'])||e.executionApi.entryPointConfig.access!=='ANYONE')stop();
   }
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
  const contentFields=query('scriptId,files(name,type,source)'),versionFields=query('nextPageToken,versions(scriptId,versionNumber,description,createTime)');
  const sourceCall=(scriptId,suffix='')=>({url:base(scriptId)+'/content'+contentFields+suffix,max:4000000,decode:v=>content(v,scriptId)});
  const deploymentsCall=(scriptId,execution=false)=>{
   const fields='deploymentId,deploymentConfig(scriptId,versionNumber,manifestFileName,description)'+(execution?',entryPoints(entryPointType,executionApi(entryPointConfig(access)))':'');
   return {url:base(scriptId)+'/deployments'+query('nextPageToken,deployments('+fields+')')+'&pageSize=200',max:100000,decode:v=>inventory(v,'deployments',scriptId,execution)};
  };
  const calls=Object.freeze({
   'original-project':{url:base(originalScriptId)+query('scriptId,parentId'),max:100000,decode:v=>{if(!only(v,['scriptId','parentId'],['scriptId'])||v.scriptId!==originalScriptId||(Object.hasOwn(v,'parentId')&&!id(v.parentId)))stop();return v;}},
   'original-editor':sourceCall(originalScriptId),
   'original-versions':{url:base(originalScriptId)+'/versions'+versionFields+'&pageSize=200',max:100000,decode:v=>inventory(v,'versions',originalScriptId)},
   'original-deployments':deploymentsCall(originalScriptId),
   'library-content':sourceCall(originalScriptId,'&versionNumber='+libraryVersion),
   'thin-content':sourceCall(thinScriptId,'&versionNumber=1'),
   'thin-deployments':deploymentsCall(thinScriptId,true)
  });
  let busy=false,stopped=false;const seen=new Set();
  const adapter=Object.freeze({read:async function(alias,control){
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
  sourceAdapters.set(adapter,Object.freeze({originalScriptId,thinScriptId,libraryVersion,publisherHash,read:adapter.read}));return adapter;
 }catch(_){stop();}
}

function manifestOf(packet,wrapper,expected){
 const raw=packet.files.find(f=>f.type==='JSON').source,m=JSON.parse(raw);
 const keys=['timeZone','dependencies','exceptionLogging','runtimeVersion','oauthScopes','urlFetchWhitelist',...(wrapper?['executionApi']:[])];
 if(!only(m,keys)||m.timeZone!=='Asia/Taipei'||m.exceptionLogging!=='NONE'||m.runtimeVersion!=='V8'||!Array.isArray(m.oauthScopes)||
  checksum([...m.oauthScopes].sort())!==checksum([...AUTHORITY_TRIAL_SCOPES].sort())||!Array.isArray(m.urlFetchWhitelist)||
  checksum([...m.urlFetchWhitelist].sort())!==checksum(['https://sheets.googleapis.com/v4/spreadsheets/','https://api.line.me/oauth2/v2.1/verify'].sort()))stop();
 if(wrapper){
  if(!only(m.dependencies,['libraries'])||!Array.isArray(m.dependencies.libraries)||m.dependencies.libraries.length!==1||!only(m.executionApi,['access'])||m.executionApi.access!=='ANYONE')stop();
  const l=m.dependencies.libraries[0];if(!only(l,['userSymbol','libraryId','version','developmentMode'])||l.userSymbol!=='AuthorityTrial'||l.libraryId!==expected.libraryId||l.version!==String(expected.libraryVersion)||l.developmentMode!==false)stop();
 }else if(!only(m.dependencies,[]))stop();
 return {raw,manifest:m};
}
// Partial equality evidence only. The five native release observations, ACLs,
// caller Sheets metadata and complete native quota/windows still belong to the
// trusted full observer. This object cannot satisfy the driver's full readback.
export function createAuthorityReleaseSourceVerifier(input){
 try{
  if(!only(input,['expected','originalParentId','baselineVersions','sourceAdapter']))stop();
  const expected=freeze(structuredClone(input.expected)),parent=input.originalParentId,baseline=structuredClone(input.baselineVersions),adapter=input.sourceAdapter,pins=sourceAdapters.get(adapter);
  canonicalAuthorityTrialBinding(expected);
  if(!pins||pins.originalScriptId!==expected.libraryId||pins.thinScriptId!==expected.thinScriptId||pins.libraryVersion!==expected.libraryVersion||pins.publisherHash!==expected.publisherHash||(parent!==null&&!id(parent))||!Array.isArray(baseline)||baseline.length!==6)stop();
  baseline.sort((a,b)=>a.versionNumber-b.versionNumber);for(let i=0;i<6;i++){version(baseline[i],expected.libraryId);if(baseline[i].versionNumber!==i+1)stop();}freeze(baseline);
  const read=pins.read;let busy=false,stopped=false,nextPhase=0;
  return Object.freeze({read:async function(control){
   let held=false,active=false;
   try{
    if(stopped||busy||arguments.length!==1||!control)stop();
    const phase=control.phase,external=control.externalRead;
    if(phase!==phases[nextPhase]||typeof external!=='function')stop();busy=true;held=true;active=true;
    const live=()=>{if(stopped||!active)stop();},packets={};
    const cap=Object.freeze({phase,externalRead:(io,alias)=>{live();return external(async()=>{live();return await io();},alias);}});
    for(const alias of aliases){
     live();const v=freeze(structuredClone(await read.call(adapter,alias,cap)));live();packets[alias]=v;
     if(alias==='original-project'){if(v.scriptId!==expected.libraryId||(Object.hasOwn(v,'parentId')?v.parentId:null)!==parent)stop();}
     else if(alias==='original-editor'){if(filesHash(v.files)!==expected.originalEditorHash)stop();}
     else if(alias==='original-versions'){
      const rows=[...v.versions].sort((a,b)=>a.versionNumber-b.versionNumber);
      if(rows.length!==7||checksum(rows.slice(0,6))!==checksum(baseline)||rows[6].versionNumber!==expected.libraryVersion||rows[6].description!=='CMWebs C3 trial '+sha(expected.trialEpoch).slice(0,16))stop();
     }else if(alias==='original-deployments'){if(checksum(v.deployments)!==expected.originalDeploymentsHash)stop();}
     else if(alias==='library-content'||alias==='thin-content'){
      const wrapper=alias==='thin-content',m=manifestOf(v,wrapper,expected);
      if(filesHash(v.files)!==expected[wrapper?'thinSourceHash':'librarySourceHash']||sha(m.raw)!==expected[wrapper?'thinManifestHash':'libraryManifestHash'])stop();
     }else{
      if(v.deployments.length!==1||v.deployments[0].deploymentId!==expected.deploymentId||v.deployments[0].deploymentConfig.versionNumber!==1)stop();
     }
    }
    const library=packets['library-content'],thin=packets['thin-content'],wrapper=manifestOf(thin,true,expected).manifest;
    const facts={libraryId:library.scriptId,thinScriptId:thin.scriptId,libraryVersion:packets['original-versions'].versions.find(v=>v.versionNumber===7).versionNumber,
     deploymentId:packets['thin-deployments'].deployments[0].deploymentId,librarySourceHash:filesHash(library.files),thinSourceHash:filesHash(thin.files),
     libraryManifestHash:sha(manifestOf(library,false,expected).raw),thinManifestHash:sha(manifestOf(thin,true,expected).raw),
     originalEditorHash:filesHash(packets['original-editor'].files),originalDeploymentsHash:checksum(packets['original-deployments'].deployments),
     retainedVersions:packets['original-versions'].versions.map(v=>v.versionNumber).sort((a,b)=>a-b),originalEditorRestored:true,
     scopes:[...wrapper.oauthScopes],developmentMode:wrapper.dependencies.libraries[0].developmentMode,executionAccess:packets['thin-deployments'].deployments[0].entryPoints[0].executionApi.entryPointConfig.access};
    live();nextPhase++;return freeze({source:'fixed-source-release-readback',phase,facts,nativeProofAccepted:false,trialAccepted:false});
   }catch(_){stopped=true;stop();}finally{active=false;if(held)busy=false;}
  }});
 }catch(_){stop();}
}
