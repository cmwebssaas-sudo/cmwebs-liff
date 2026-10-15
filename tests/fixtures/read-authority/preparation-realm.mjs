// Synthetic-only interoperability harness. Every destination has an injected
// in-memory fetcher; no browser, Google request, real credential or resource.
import {writeFileSync,readFileSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {request as localRequest} from 'node:http';
import {buildAuthorityTrialArtifacts} from '../../../scripts/build-read-authority-trial-entry.mjs';
import {buildAuthorityTrialRollback} from '../../../scripts/read-authority-trial-rollback.mjs';
export const preparationFixtureBytes=Buffer.from('PK\x03\x04SYNTHETIC_REALM_PREFLIGHT');
const hash=v=>createHash('sha256').update(v).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const checksum=v=>hash(JSON.stringify(canonical(v))),fileHash=v=>checksum([...v].sort((a,b)=>a.name.localeCompare(b.name)));
const managementScopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(s=>'https://www.googleapis.com/auth/'+s);
const callerScopes=['spreadsheets.readonly','userinfo.email','script.external_request'].map(s=>'https://www.googleapis.com/auth/'+s);
export async function exercisePreparationRealm(api,{dir,mode='all',constructOnly=false,fixtureBytes=preparationFixtureBytes,badBytes=false,listener=false,lifecycle=false,rpcFailure=false}){
 const epoch='SYNTHETIC_PREP_REALM_'+randomUUID(),budgetPath=join(dir,'budget.json');let time=Date.parse('2026-10-14T00:00:00Z');const expiresAt=time+21600000;
 const raw=JSON.stringify({limit:160,spent:25,kind:'preparation-management-reads',proposal_sha256:'b'.repeat(64),approval_sha256:'a'.repeat(64),prior_limit:40});writeFileSync(budgetPath,raw,{mode:0o600,flag:'wx'});
 const counter=()=>JSON.parse(readFileSync(budgetPath)),controlOptions={path:budgetPath,epoch,approvalHash:'a'.repeat(64),proposalHash:'b'.repeat(64),legacySha256:hash(raw),importedReads:25,expiresAt,now:()=>time,pause:async ms=>{time+=ms;}};
 const canonicalControl=api.createAuthorityPreparationControl(controlOptions),control=lifecycle?api.createAuthorityPhaseControl(canonicalControl):canonicalControl,peer=api.createAuthorityPreparationControl(controlOptions);
 const originalSheetId='SYNTHETIC_ORIGINAL_SHEET_ID',syntheticSheetId='SYNTHETIC_NEW_UNBOUND_SHEET_ID',libraryId='SYNTHETIC_LIBRARY_SCRIPT_ID',thinId='SYNTHETIC_THIN_SCRIPT_ID',deploymentId='SYNTHETIC_THIN_DEPLOYMENT_ID';
 const callerEmail='caller@example.invalid',publisherEmail='publisher@example.invalid',callerHash=hash(callerEmail),publisherHash=hash(publisherEmail),fixtureHash=hash(preparationFixtureBytes),permissionId='00001234567890123456789';
 const owner={id:'SYNTHETIC_OWNER_ID',type:'user',role:'owner',emailAddress:publisherEmail},reader={id:permissionId,type:'user',role:'reader',emailAddress:callerEmail};
 let readerPresent=false,thinClosed=false,currentLibrary,version,thinFiles,thinConfig,httpCalls=0,peerDenials=0,constructed=0,entered=false;
 const records=[],journalPaths=[];
 const credential=actor=>({accessToken:'SYNTHETIC_REALM_TOKEN',accountHash:actor==='caller'?callerHash:publisherHash,scopes:actor==='caller'?callerScopes:managementScopes,expiresAt:time+3600000,refreshTokenPresent:actor!=='caller'});
 const result=(value,url,status=200)=>{
  if(status===204)return {status,url,redirected:false,body:null};let read=false;const bytes=badBytes?{byteLength:1,0:123}:Buffer.from(JSON.stringify(value));
  return {status,url,redirected:false,body:{cancel:async()=>{},getReader:()=>({read:async()=>read?{done:true}:(read=true,{done:false,value:bytes}),cancel:async()=>{},releaseLock:()=>{}})}};
 };
 const originalFiles=Array.from({length:10},(_,n)=>({name:n===0?'appsscript':'Original'+n,type:n===0?'JSON':'SERVER_JS',source:n===0?'{"timeZone":"Asia/Taipei","runtimeVersion":"V8"}':'// SYNTHETIC ORIGINAL '+n+'\n'}));
 const versions=Array.from({length:6},(_,i)=>({scriptId:libraryId,versionNumber:i+1})),deployments=[{deploymentId:'SYNTHETIC_SERVING_DEPLOYMENT',deploymentConfig:{scriptId:libraryId,versionNumber:1,manifestFileName:'appsscript'}}];
 const libraryBundle=buildAuthorityTrialArtifacts({libraryId,version:1}),libraryFiles=[{name:'AuthorityTrial',type:'SERVER_JS',source:libraryBundle.librarySource},{name:'appsscript',type:'JSON',source:JSON.stringify(libraryBundle.libraryManifest)}];currentLibrary=originalFiles;
 const fetcher=async(url,init)=>{
  if(entered)throw Error('SYNTHETIC_PARALLEL_IO');entered=true;
  try{
   const ledger=counter();if(ledger.spent<=25)throw Error('SYNTHETIC_UNPAID_IO');
   httpCalls++;records.push({kind:ledger.preparation.events.at(-1).kind,method:init.method});
   try{await peer.withPreparation(async()=>{});throw Error('SYNTHETIC_FLOCK_RELEASED');}catch(e){if(e.message!=='TRIAL_STOPPED')throw e;peerDenials++;}
   const u=new URL(url);
   if(u.origin==='https://oauth2.googleapis.com')return result(u.pathname==='/token'?{access_token:'SYNTHETIC_ACCESS_TOKEN',expires_in:3600,token_type:'Bearer',scope:callerScopes.join(' ')}:{},url);
   if(u.pathname==='/oauth2/v2/userinfo')return result({email:callerEmail,verified_email:true},url);
   if(u.pathname.startsWith('/upload/drive/'))return result({id:syntheticSheetId,mimeType:'application/vnd.google-apps.spreadsheet'},url);
   if(u.pathname.startsWith('/drive/v2/permissionIds/'))return result({kind:'drive#permissionId',id:permissionId},url);
   if(u.pathname.startsWith('/drive/v3/files/')){
    if(u.pathname.includes('/permissions')){
     if(init.method==='POST'){readerPresent=true;return result({kind:'drive#permission',...reader},url);}
     if(init.method==='DELETE'){readerPresent=false;return result(null,url,204);}
     return result({permissions:u.pathname.includes(originalSheetId)?[owner]:readerPresent?[owner,reader]:[owner]},url);
    }
    return result({id:syntheticSheetId,mimeType:'application/vnd.google-apps.spreadsheet',ownedByMe:true,trashed:false},url);
   }
   if(u.origin==='https://sheets.googleapis.com')return result({spreadsheetId:syntheticSheetId,properties:{timeZone:'Asia/Taipei'},sheets:Array.from({length:20},(_,i)=>({properties:{sheetId:i,title:'Synthetic_tab_'+i}}))},url);
   if(u.pathname.startsWith('/v1/projects/'+libraryId+'/')){
    if(init.method==='PUT'){currentLibrary=JSON.parse(init.body).files;return result({scriptId:libraryId,files:currentLibrary},url);}
    if(init.method==='POST'){version={scriptId:libraryId,versionNumber:7,description:JSON.parse(init.body).description};return result(version,url);}
    if(u.pathname.endsWith('/content'))return result({scriptId:libraryId,files:u.searchParams.has('versionNumber')?libraryFiles:currentLibrary},url);
    if(u.pathname.endsWith('/versions'))return result({versions:[...versions,version]},url);
    return result({deployments},url);
   }
   if(u.pathname.startsWith('/v1/projects/'+thinId+'/')){
    if(init.method==='PUT'){thinFiles=JSON.parse(init.body).files;return result({scriptId:thinId,files:thinFiles},url);}
    if(u.pathname.endsWith('/versions'))return result({scriptId:thinId,versionNumber:1,description:JSON.parse(init.body).description},url);
    if(u.pathname.endsWith('/content'))return result({scriptId:thinId,files:thinFiles},url);
    if(init.method==='DELETE'){thinClosed=true;return result(null,url,204);}
    const d=()=>({deploymentId,deploymentConfig:thinConfig,entryPoints:[{entryPointType:'EXECUTION_API',executionApi:{entryPointConfig:{access:'ANYONE'}}}]});
    if(init.method==='POST'){thinConfig={scriptId:thinId,...JSON.parse(init.body)};return result(d(),url);}
    return result({deployments:thinClosed?[]:[d()]},url);
   }
   throw Error('SYNTHETIC_UNKNOWN_DESTINATION');
  }finally{entered=false;}
 };
 const path=name=>{const p=join(dir,name+'.json');journalPaths.push(p);return p;},select=name=>mode==='all'||mode===name;
 let importer,metadata,readerAdapter,publication,thin,oauth,error=null,listenerRequests=0,listenerClosed=false,rpcCalls=0,nativeMs=0,runtimeEntries=[],lastExecution,orchestrationReport=null,syntheticNativeCleanupCalls=0;
 const clientId='1234567890-synthetic.apps.googleusercontent.com',oauthClientHash=hash(clientId),cloudProjectHash='c'.repeat(64);
 const expected={deploymentId,thinScriptId:thinId,libraryId,libraryVersion:7,librarySourceHash:fileHash(libraryFiles),thinSourceHash:'a'.repeat(64),libraryManifestHash:hash(JSON.stringify(libraryBundle.libraryManifest)),thinManifestHash:'a'.repeat(64),originalEditorHash:fileHash(originalFiles),originalDeploymentsHash:checksum(deployments),originalCloudProject:'SYNTHETIC_DEFAULT_PROJECT',trialEpoch:epoch,syntheticSheetId,callerHash,publisherHash,oauthClientHash,newCloudProject:'SYNTHETIC_NEW_PROJECT',sheetContractHash:'e'.repeat(64)};
 const localGet=path=>new Promise((resolve,reject)=>{
  listenerRequests++;const req=localRequest({hostname:'127.0.0.1',port:34763,method:'GET',path,headers:{connection:'close'}},r=>{let body='';r.setEncoding('utf8');r.on('data',chunk=>{body+=chunk;if(body.length>4096)req.destroy(Error('SYNTHETIC_LOCAL_RESPONSE_TOO_LARGE'));});r.on('end',()=>resolve({status:r.statusCode,headers:r.headers,body}));r.on('error',reject);});req.setTimeout(10000,()=>req.destroy(Error('SYNTHETIC_LOCAL_TIMEOUT')));req.on('error',reject);req.end();
 });
 const prepare=async cap=>{
   const common={epoch,publisherHash,expiresAt,control:cap,credential:()=>credential('publisher'),fetcher,now:()=>time};
   if(select('import')){importer=api.createAuthorityTrialImport({...common,path:path('import'),originalSheetId,fixtureHash,fixtureBytes,preflightReceipt:{source:'fixed-trial-xlsx-preflight',fixtureHash,size:preparationFixtureBytes.length,tabs:20,unsafeFeatures:false}});constructed++;if(!constructOnly)await importer.create();}
   if(select('metadata')||select('reader'))metadata=api.createAuthorityTrialMetadataAdapters({originalSheetId,syntheticSheetId,expectedTabNames:Array.from({length:20},(_,i)=>'Synthetic_tab_'+i),callerHash,publisherHash,callerEmail,credential,fetcher,now:()=>time});
   if(select('metadata')){constructed++;if(!constructOnly)await metadata.read('synthetic-tabs',cap);}
   if(select('reader')){readerAdapter=api.createAuthorityTrialReader({...common,path:path('reader'),originalSheetId,syntheticSheetId,callerEmail,callerHash,fixtureHash,creationReceipt:{source:'fixed-trial-import-readback',epoch,syntheticSheetId,publisherHash,fixtureHash},metadata});constructed++;if(!constructOnly)await readerAdapter.grant();}
   if(select('publication')){const sourceHash=fileHash(originalFiles);publication=api.createAuthorityTrialPublication({...common,path:path('publication'),scriptId:libraryId,originalFiles,originalSourceHash:sourceHash,baselineVersions:versions,baselineDeployments:deployments,backupReceipt:{source:'fixed-trial-original-editor-backup',epoch,scriptId:libraryId,publisherHash,sourceHash,versionsHash:checksum(versions),deploymentsHash:checksum(deployments)}});constructed++;if(!constructOnly)await publication.publishAndRestore();}
   if(select('thin')){const files=[{name:'Code',type:'SERVER_JS',source:'\n'},{name:'appsscript',type:'JSON',source:'{"timeZone":"Asia/Taipei","runtimeVersion":"V8"}'}],sourceHash=fileHash(files);thin=api.createAuthorityTrialThin({...common,path:path('thin'),scriptId:thinId,libraryId,libraryVersion:7,originalFiles:files,originalSourceHash:sourceHash,backupReceipt:{source:'fixed-trial-thin-empty-backup',epoch,scriptId:thinId,publisherHash,sourceHash}});constructed++;if(!constructOnly)await thin.publish();}
   if(select('oauth')){oauth=api.createAuthorityTrialOAuth({path:path('oauth'),epoch,clientId,oauthClientHash,cloudProjectHash,callerHash,publisherHash,expiresAt,control:cap,clientSecret:()=> 'SYNTHETIC_CLIENT_SECRET',fetcher,now:()=>time,clientReadback:{source:'google-native-ui',oauthClientHash,cloudProjectHash,redirectUri:'http://127.0.0.1:34763/oauth/callback',isolatedTrialProject:true}});constructed++;if(!constructOnly){const state=new URL(oauth.authorizationUrl).searchParams.get('state'),url='/oauth/callback?'+new URLSearchParams({state,code:'SYNTHETIC_CODE'});
    if(listener){const handle=await api.startAuthorityTrialOAuthListener(oauth);try{const callback=await localGet(url);if(callback.status!==303||callback.headers.location!=='/oauth/result')throw Error('SYNTHETIC_LOCAL_CALLBACK_FAILED');const result=await localGet('/oauth/result');if(result.status!==200||result.body.includes(state)||result.body.includes('SYNTHETIC_CODE'))throw Error('SYNTHETIC_LOCAL_RESULT_FAILED');}finally{await handle.close();listenerClosed=true;}}
    else await oauth.receive({method:'GET',host:'127.0.0.1:34763',url});if(oauth.credential().refreshTokenPresent!==false)throw Error('SYNTHETIC_BAD_CREDENTIAL');}}
   if(lifecycle){expected.thinSourceHash=fileHash(thinFiles);expected.thinManifestHash=hash(thinFiles.find(f=>f.name==='appsscript').source);return {driverOptions:runtimeOptions(),expectedSpent:49};}
   if(!lifecycle&&mode==='all'&&!constructOnly){await thin.close();await thin.verifyClosed();await readerAdapter.remove();await readerAdapter.verifyRemoved();await oauth.cancel();}
 };
 const runtimeOptions=()=>{
   const release=()=>({...expected,scopes:callerScopes,developmentMode:false,executionAccess:'ANYONE',oauthStatus:'TESTING',testingUsers:1,callerSheetRole:readerPresent?'reader':'none',callerLibraryRole:'none',callerPropertiesMatch:true,libraryPropertiesMatch:true,originalTriggers:0,retainedVersions:[1,2,3,4,5,6],originalEditorRestored:JSON.stringify(currentLibrary)===JSON.stringify(originalFiles)});
   const native=()=>({source:'google-native-ui',coverage:'caller-and-publisher-all-projects',accountHashes:[callerHash,publisherHash],trialScriptIds:[libraryId,thinId],accountUsage:[callerHash,publisherHash].map(accountHash=>({accountHash,accountType:'consumer',windowStartMs:time-86400000,windowEndMs:time,allProjectRuntimeMs:nativeMs,triggerRuntimeMs:0,complete:true})),observedAt:time,day:'2026-10-14',complete:true,active:0,totalMs:nativeMs,execution:lastExecution});
   return {expected,expiresAt,now:()=>time,readRelease:async cap=>{await cap.externalRead(async()=>{});return release();},readNative:async(phase,cap)=>{await cap.externalRead(async()=>{});if(phase==='after'){time=Math.max(time,lastExecution.endMs);nativeMs+=lastExecution.durationMs;}return native();},credential:()=>oauth.credential(),signRequest:()=>({action:'read_replica_authorize',nonce:randomUUID(),payload:JSON.stringify({protocol:'session',credential:'SYNTHETIC_SESSION_NEVER_PERSIST',credential_digest:hash('session:SYNTHETIC_SESSION_NEVER_PERSIST'),route:'/v1/arrears'}),signature:'f'.repeat(64),timestamp:time}),transport:async call=>{
    const state=counter();if(state.preparation.runtime.pending===null||state.preparation.events.at(-1).kind!=='R')throw Error('SYNTHETIC_UNPAID_RPC');
    try{await peer.withRuntime(api.canonicalAuthorityTrialBinding(expected),async()=>{});throw Error('SYNTHETIC_FLOCK_RELEASED');}catch(e){if(e.message!=='TRIAL_STOPPED')throw e;peerDenials++;}
    if(call.accessToken!=='SYNTHETIC_ACCESS_TOKEN'||call.body.parameters[1]!=='compatibility'||call.body.devMode!==false)throw Error('SYNTHETIC_BAD_RPC');rpcCalls++;lastExecution={status:'COMPLETED',function:call.body.function,deploymentId,startMs:time,endMs:time+100,durationMs:100};if(rpcFailure==='transport')throw Error('SYNTHETIC_TRANSPORT_UNKNOWN');return {done:true,response:{result:{compatible:true}}};
   }};
 };
 try{
  if(lifecycle){
   const adapterActions={'close-deployment':()=>thin.close(),'verify-closed-deployment':()=>thin.verifyClosed(),'remove-reader':()=>readerAdapter.remove(),'verify-reader-removed':()=>readerAdapter.verifyRemoved(),'revoke-token':()=>oauth.cancel()};
   const cleanup=Object.fromEntries(api.AUTHORITY_TRIAL_CLEANUP_ACTIONS.map(action=>[action,adapterActions[action]??(cap=>cap.cleanup(action,async()=>{syntheticNativeCleanupCalls++;try{await peer.withRuntime(api.canonicalAuthorityTrialBinding(expected),async()=>{});throw Error('SYNTHETIC_FLOCK_RELEASED');}catch(e){if(e.message!=='TRIAL_STOPPED')throw e;peerDenials++;}}))]));
   const receipt=buildAuthorityTrialRollback({path:join(dir,'rollback-runtime')});
   const orchestrator=api.createAuthorityTrialOrchestrator({control:canonicalControl,rollback:{path:receipt.path,sha256:receipt.sha256,controlOptions},prepare,restoreEditor:()=>publication.restore(),cleanup});
   try{await orchestrator.run();}finally{orchestrationReport=orchestrator.report();}
  }else await control.withPreparation(prepare);
 }catch(e){error=e.message;}
 const ledger=counter(),pending=ledger.preparation.runtime?.pending??null;runtimeEntries=(ledger.preparation.runtime?.entries??[]).map(e=>({entry:e.entry,complete:e.complete,accounted:Number.isSafeInteger(e.afterNativeMs)&&typeof e.executionHash==='string'}));const privateModes=journalPaths.filter(p=>{try{return lstatSync(p).isFile();}catch{return false;}}).map(p=>lstatSync(p).mode&0o777);
 return {ok:error===null,error,constructed,httpCalls,peerDenials,spent:ledger.spent,events:ledger.preparation.events.map(e=>e.kind),cActions:ledger.preparation.cActions,iActions:ledger.preparation.iActions,privateModes,records,listenerRequests,listenerClosed,rpcCalls,nativeMs,runtimeEntries,pending,orchestrationReport,syntheticNativeCleanupCalls,trialAccepted:false,rollbackComplete:false,realGoogleUiCalls:0,actualCounterTouched:false};
}
