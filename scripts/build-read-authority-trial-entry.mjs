// Local single-entry/readonly-adapter preparation. No manifest or deployment.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildAuthorityTrialClosure} from './build-read-authority-trial-closure.mjs';
const require=createRequire(new URL('../cloudflare/read-api/package.json',import.meta.url));
const {parse}=require('acorn');
const sha=text=>createHash('sha256').update(text).digest('hex');
const denied="{success:false,code:'TRIAL_UNAVAILABLE'}";
// Library Properties belong to the library; thin wrapper Properties belong to
// its own project. Both are configured with the same fixed caller/script keys.
const callerGuard=`function readTrialCallerAllowed_(){
  try {
    const properties=PropertiesService.getScriptProperties();
    const email=properties.getProperty('C3_TRIAL_CALLER_EMAIL');
    const script=properties.getProperty('C3_TRIAL_CALLER_SCRIPT_ID');
    if(typeof email!=='string'||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)||
      typeof script!=='string'||!/^[-A-Za-z0-9_]{1,200}$/.test(script))return false;
    const active=Session.getActiveUser().getEmail(),effective=Session.getEffectiveUser().getEmail();
    return typeof active==='string'&&typeof effective==='string'&&
      active.toLowerCase()===email.toLowerCase()&&effective.toLowerCase()===email.toLowerCase()&&
      ScriptApp.getScriptId()===script;
  }catch(_){return false;}
}`;
export function buildAuthorityTrialEntry(root=new URL('../',import.meta.url)){
  return buildEntry(root,false);
}
function buildEntry(root,compatibilityOnly){
  const closure=buildAuthorityTrialClosure(root);
  const declaration=closure.declarations.find(d=>d.names.includes('readAuthorizationConfirm_'));
  const original=readFileSync(new URL(declaration.path,root),'utf8').slice(declaration.start,declaration.end);
  const node=parse(original,{ecmaVersion:'latest'}).body[0];
  const guarded=node.body.body.find(n=>n.type==='TryStatement');
  const nonce=guarded?.block.body.find(n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='nonceKey'));
  if(!nonce||!original.startsWith('function readAuthorizationConfirm_(request)'))throw Error('Canonical validation boundary unsupported');
  // Preserve the canonical signed-request validation prefix verbatim, only
  // rename its private helper and end before the first authority-cache access.
  // Canonical denial objects are not truthy success: invoke checks === true.
  const prefix=original.slice(0,nonce.start);
  const validate=prefix.replace('function readAuthorizationConfirm_','function readTrialRequestValidated_')+
    'return true;\n  }catch(_){return false;}\n}\n';
  const adapter=readFileSync(new URL('./templates/read-authority-trial-adapter.js',import.meta.url),'utf8');
  const librarySource=`const V2_AUTHORITY_TRIAL_PRIVATE_=(function(NativeScriptApp,NativeUrlFetchApp){
const SpreadsheetApp=Object.freeze({getActiveSpreadsheet:function(){throw new Error('TRIAL_UNAVAILABLE');},
  openById:function(){throw new Error('TRIAL_UNAVAILABLE');}});
// Hide getOAuthToken from the original optional bulk transport, forcing it to
// use the only supplied request-local readonly facade; native fallback cannot IO.
const ScriptApp=Object.freeze({getScriptId:function(){return NativeScriptApp.getScriptId();}});
const UrlFetchApp=Object.freeze({fetch:function(url,options){
  if(url!=='https://api.line.me/oauth2/v2.1/verify'||!options||options.method!=='post'||
    options.followRedirects!==false||options.muteHttpExceptions!==true||
    options.contentType!=='application/x-www-form-urlencoded')throw new Error('TRIAL_UNAVAILABLE');
  const response=NativeUrlFetchApp.fetch(url,options);
  return {getResponseCode:function(){return response.getResponseCode();},getContentText:function(){
    const text=response.getContentText();if(typeof text!=='string'||text.length>10000)throw new Error('TRIAL_UNAVAILABLE');return text;}};
}});
${closure.source}
${callerGuard}
${validate}
${adapter}
return Object.freeze({invoke:function(request,operation){
  if(arguments.length!==2||!readTrialCallerAllowed_())return ${denied};
  if(${compatibilityOnly?"operation!=='compatibility'":"operation!=='compatibility'&&operation!=='authority'"})return ${denied};
  if(readTrialRequestValidated_(request)!==true)return ${denied};
  if(operation==='compatibility')return {compatible:true};
  try {
    const contract=readTrialContract_();
    runtimeSnapshotBegin_('read_replica_authorize');
    V2_REQUEST_RUNTIME_SNAPSHOT_STATE_.spreadsheet_handles.ACTIVE=readTrialSpreadsheet_(contract);
    return readAuthorizationConfirm_(request);
  }catch(_){return ${denied};}
}});
})(ScriptApp,UrlFetchApp);
function authorizeTrial(request,operation){
  if(arguments.length!==2)return ${denied};
  return V2_AUTHORITY_TRIAL_PRIVATE_.invoke(request,operation);
}
`;
  const wrapperSource=`const V2_AUTHORITY_TRIAL_WRAPPER_PRIVATE_=(function(){
${callerGuard}
return Object.freeze({invoke:function(request,operation){
  if(arguments.length!==2||!readTrialCallerAllowed_()||
    (operation!=='compatibility'&&operation!=='authority'))return ${denied};
  try{return AuthorityTrial.authorizeTrial(request,operation);}catch(_){return ${denied};}
}});
})();
function authorizeTrial(request,operation){
  if(arguments.length!==2)return ${denied};
  return V2_AUTHORITY_TRIAL_WRAPPER_PRIVATE_.invoke(request,operation);
}
`;
  return {status:'LOCAL_ENTRY_NOT_DEPLOYABLE',librarySource,wrapperSource,
    librarySha256:sha(librarySource),wrapperSha256:sha(wrapperSource),closureSha256:closure.sourceSha256,
    adapterSha256:sha(adapter),
    canonicalValidationPrefix:{path:declaration.path,start:declaration.start,end:declaration.start+nonce.start,sha256:sha(prefix)},
    limits:['Local readonly-adapter model only; no executable manifest, credentials or live deployment.',
      'Native caller/project/library visibility and resource sharing still require actual Google verification.',
      'Thin wrapper delegates MAC to the fixed guarded library; it never copies the library secret.']};
}

function trialManifest(){
  return {timeZone:'Asia/Taipei',dependencies:{},exceptionLogging:'NONE',runtimeVersion:'V8',
    oauthScopes:['https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/script.external_request'],
    urlFetchWhitelist:['https://sheets.googleapis.com/v4/spreadsheets/','https://api.line.me/oauth2/v2.1/verify']};
}

// The first phase is compatibility-only. It embeds the same guarded canonical
// closure in one isolated project; no library, original-project access or
// original secret is required. The owner provisions a separate synthetic key.
// Generated artifacts are inert: deployment, source ACL, fixed Properties and
// the actual Google caller still require independent verification.
export function buildStandaloneAuthorityTrialArtifacts(root=new URL('../',import.meta.url)){
  const result=buildEntry(root,true),manifest=trialManifest();
  manifest.executionApi={access:'ANYONE'};
  return {status:'LOCAL_STANDALONE_UNDEPLOYED',operation:'compatibility',source:result.librarySource,
    sourceSha256:result.librarySha256,manifest,closureSha256:result.closureSha256,
    adapterSha256:result.adapterSha256,canonicalValidationPrefix:result.canonicalValidationPrefix,
    limits:['Single synthetic compatibility entry only; authority is rejected.',
      'No library dependency or original project/source/secret access.',
      'Source visibility is limited to this isolated synthetic script.',
      'No Google operation, credential, deployment or execution authorization is created.']};
}

export function buildAuthorityTrialArtifacts(options){
  if(!options||Object.keys(options).sort().join(',')!=='libraryId,version'||
    typeof options.libraryId!=='string'||!/^[-A-Za-z0-9_]{20,200}$/.test(options.libraryId)||
    !Number.isSafeInteger(options.version)||options.version<1||options.version>1000000)throw Error('Fixed trial library binding required');
  const result=buildAuthorityTrialEntry();
  const libraryManifest=trialManifest(),wrapperManifest=trialManifest();
  wrapperManifest.dependencies.libraries=[{userSymbol:'AuthorityTrial',libraryId:options.libraryId,version:String(options.version),developmentMode:false}];
  wrapperManifest.executionApi={access:'ANYONE'};
  return {...result,status:'LOCAL_ARTIFACTS_UNDEPLOYED',libraryManifest,wrapperManifest,
    limits:result.limits.concat(['ANYONE means logged-in Google users; actual fixed-user Testing/guards must be checked.',
      'This generator does not create resources, versions, deployments, properties or credentials.'])};
}
