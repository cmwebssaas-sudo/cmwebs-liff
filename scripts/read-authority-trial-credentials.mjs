// Existing publisher grant only. New access tokens live in this original holder;
// neither disk nor copied rollback descriptors can restore them after its loss.
import {openSync,readFileSync,fstatSync,closeSync,constants} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {AUTHORITY_TRIAL_SCOPES} from './read-authority-trial-driver.mjs';
import {CREDENTIAL_READBACK_DECISION_HASH} from './read-authority-trial-budget-plan.mjs';
const stop=()=>{throw Error('TRIAL_STOPPED');};
const hash=v=>createHash('sha256').update(v).digest('hex'),integer=Number.isSafeInteger;
const only=(v,keys,required=keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k))&&required.every(k=>Object.hasOwn(v,k));
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const secret=v=>typeof v==='string'&&v.length>0&&v.length<=8192&&!/[\s\x00-\x1f\x7f]/.test(v);
const managementScopes=Object.freeze(['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(s=>'https://www.googleapis.com/auth/'+s));
const sameScopes=(v,expected)=>Array.isArray(v)&&v.length===expected.length&&v.every(s=>typeof s==='string')&&JSON.stringify([...v].sort())===JSON.stringify([...expected].sort());
const userUrl='https://www.googleapis.com/oauth2/v2/userinfo?fields=email%2Cverified_email',tokenUrl='https://oauth2.googleapis.com/token';
const options=(method,body,headers={})=>({method,redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'cache-control':'no-cache, no-store',pragma:'no-cache',...headers},...(body===undefined?{}:{body})});
async function json(response,url){
 if(response.status!==200||response.redirected===true||(response.url&&response.url!==url)||!response.body){if(response.body)await response.body.cancel().catch(()=>{});stop();}
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;if(!types.isUint8Array(value)||(size+=value.byteLength)>30000){await reader.cancel().catch(()=>{});stop();}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
function identity(user,expected){
 if(!only(user,['email','verified_email'])||typeof user.email!=='string'||user.email.length>320||!/^\S+@\S+\.\S+$/.test(user.email)||user.verified_email!==true||hash(user.email.trim().toLowerCase())!==expected)stop();
}
function syncValue(getter){const v=getter();if(types.isPromise(v)){void Promise.prototype.then.call(v,()=>{},()=>{});stop();}return v;}
function sourceProfile(source){
 const fd=openSync(source.path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const before=fstatSync(fd);if(!before.isFile()||before.uid!==process.getuid()||(before.mode&0o777)!==0o600||before.size<1||before.size>100000)stop();
  const bytes=readFileSync(fd),after=fstatSync(fd);
  if(['dev','ino','size','mtimeMs','ctimeMs','mode','uid'].some(k=>before[k]!==after[k])||hash(bytes)!==source.sha256)stop();
  const root=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),p=root?.tokens?.default;
  if(!only(p,['access_token','refresh_token','client_id','client_secret','token_type','expiry_date','id_token'],['access_token','refresh_token','client_id','token_type','expiry_date'])||
   ![p.access_token,p.refresh_token,p.client_id].every(secret)||!/^[-A-Za-z0-9_]{1,200}\.apps\.googleusercontent\.com$/.test(p.client_id)||p.token_type!=='Bearer'||!integer(p.expiry_date)||
   (Object.hasOwn(p,'client_secret')&&!secret(p.client_secret))||(Object.hasOwn(p,'id_token')&&!secret(p.id_token)))stop();
  // Historical access/id tokens and the filename are never scope/actor proof.
  return {client_id:p.client_id,refresh_token:p.refresh_token,...(Object.hasOwn(p,'client_secret')?{client_secret:p.client_secret}:{})};
 }finally{closeSync(fd);}
}
function validateConfig(decisionHash,expiresAt,now){
 if(decisionHash!==CREDENTIAL_READBACK_DECISION_HASH||typeof now!=='function')stop();const t=now();
 if(!integer(t)||!integer(expiresAt)||expiresAt-t<=360000||expiresAt-t>21600000)stop();return t;
}
export function createAuthorityPublisherCredentials(input){
 try{
  if(!only(input,['source','publisherHash','decisionHash','expiresAt','fetcher','now'],['source','publisherHash','decisionHash','expiresAt'])||!only(input.source,['path','sha256'])||typeof input.source.path!=='string'||!digest(input.source.sha256))stop();
  const {publisherHash,decisionHash,expiresAt,fetcher=fetch,now=Date.now}=input,source=Object.freeze({path:resolve(input.source.path),sha256:input.source.sha256});
  if(!digest(publisherHash)||typeof fetcher!=='function')stop();const start=validateConfig(decisionHash,expiresAt,now);
  let stage='new',stopped=false,busy=false,pending=null,renewed=null,verified=null;
  const live=()=>{const t=now();if(stopped||!integer(t)||t<start||t>=expiresAt)stop();return t;};
  const run=async fn=>{
   if(busy||stopped)stop();busy=true;
   const work=(async()=>{try{return await fn();}catch(_){stage='failed';renewed=null;verified=null;stop();}})();pending=work;
   try{return await work;}finally{busy=false;if(pending===work)pending=null;}
  };
  const capability=control=>{if(!control||control.decisionHash!==decisionHash||typeof control.externalRead!=='function')stop();return control.externalRead;};
  return Object.freeze({
   refresh:async function(control){
    try{if(arguments.length!==1||stage!=='new')stop();const external=capability(control);
     return await run(async()=>{stage='refreshing';live();
      // Local source and response disposal remain inside the charged IO scope.
      await external(async()=>{
       const sentAt=live(),grant=sourceProfile(source),body=new URLSearchParams({grant_type:'refresh_token',...grant}).toString();
       const value=await json(await fetcher(tokenUrl,options('POST',body,{'content-type':'application/x-www-form-urlencoded'})),tokenUrl),end=live();
       if(end<sentAt||!only(value,['access_token','token_type','expires_in','scope'])||!secret(value.access_token)||value.token_type!=='Bearer'||!integer(value.expires_in)||value.expires_in<=360||typeof value.scope!=='string'||!sameScopes(value.scope.trim().split(/\s+/),managementScopes))stop();
       const expiry=sentAt+value.expires_in*1000;if(!integer(expiry)||expiry>expiresAt||expiry-end<=360000)stop();
       renewed=Object.freeze({accessToken:value.access_token,accountHash:publisherHash,scopes:managementScopes,expiresAt:expiry,refreshTokenPresent:true});stage='renewed';
      },'P:publisher-refresh');live();
     });
    }catch(_){stop();}
   },
   verify:async function(control){
    try{if(arguments.length!==1||stage!=='renewed'||!renewed)stop();const external=capability(control),token=renewed;
     return await run(async()=>{stage='verifying';
      await external(async()=>{
       const begin=live();if(token.expiresAt-begin<=360000)stop();
       identity(await json(await fetcher(userUrl,options('GET',undefined,{authorization:'Bearer '+token.accessToken})),userUrl),publisherHash);
       const end=live();if(end<begin||token.expiresAt-end<=360000)stop();verified=token;stage='ready';
      },'P:publisher-userinfo');live();
     });
    }catch(_){stop();}
   },
   credential:function(){try{if(arguments.length||stage!=='ready'||!verified||verified.expiresAt-live()<=360000)stop();return verified;}catch(_){stop();}},
   stopAndDrain:async function(){
    if(arguments.length)stop();stopped=true;const owned=pending;if(owned)try{await owned;}catch(_){}
    renewed=null;verified=null;stage='stopped';
    return Object.freeze({source:'original-publisher-credential-holder',ownedIOSettled:true,remoteExecutionSettled:false,rollbackComplete:false});
   }
  });
 }catch(_){stop();}
}
export function createAuthorityNativeIdentity(input){
 try{
  if(!only(input,['callerHash','publisherHash','oauthClientHash','decisionHash','expiresAt','callerCredential','publisherCredential','fetcher','now'],['callerHash','publisherHash','oauthClientHash','decisionHash','expiresAt','callerCredential','publisherCredential']))stop();
  const {callerHash,publisherHash,oauthClientHash,decisionHash,expiresAt,callerCredential,publisherCredential,fetcher=fetch,now=Date.now}=input;
  if(![callerHash,publisherHash,oauthClientHash].every(digest)||callerHash===publisherHash||[callerCredential,publisherCredential,fetcher].some(f=>typeof f!=='function'))stop();const start=validateConfig(decisionHash,expiresAt,now);
  let stopped=false,busy=false,pending=null;const seen=new Set();
  return Object.freeze({read:async function(actor,control){
   let claimed=false;
   try{
    if(arguments.length!==2||stopped||busy||!['caller','publisher'].includes(actor)||!control||control.decisionHash!==decisionHash||!['wrapper-before','wrapper-after'].includes(control.phase)||typeof control.externalRead!=='function')stop();
    const phase=control.phase,external=control.externalRead,key=phase+':'+actor;if(seen.has(key))stop();seen.add(key);busy=true;claimed=true;
    const raw=syncValue(actor==='caller'?callerCredential:publisherCredential),caller=actor==='caller',fields=['accessToken','scopes','expiresAt','refreshTokenPresent',...(caller?['callerHash','oauthClientHash']:['accountHash'])];
    if(!only(raw,fields))stop();const token=Object.fromEntries(fields.map(k=>[k,raw[k]]));if(Array.isArray(token.scopes))token.scopes=Object.freeze([...token.scopes]);
    const accountHash=caller?callerHash:publisherHash;
    if(!secret(token.accessToken)||!sameScopes(token.scopes,caller?AUTHORITY_TRIAL_SCOPES:managementScopes)||!integer(token.expiresAt)||typeof token.refreshTokenPresent!=='boolean'||(caller?(token.refreshTokenPresent||token.callerHash!==callerHash||token.oauthClientHash!==oauthClientHash):token.accountHash!==publisherHash))stop();
    const live=()=>{const t=now();if(stopped||!integer(t)||t<start||t>=expiresAt||token.expiresAt-t<=360000)stop();return t;};live();
    const work=external(async()=>{
     const begin=live();identity(await json(await fetcher(userUrl,options('GET',undefined,{authorization:'Bearer '+token.accessToken})),userUrl),accountHash);const end=live();if(end<begin)stop();
     return Object.freeze({source:'google-userinfo-same-token',actor,phase,accountHash,observedAt:end,credentialExpiresAt:token.expiresAt,complete:false,trialAccepted:false});
    },Object.freeze({actor,category:'identityReads'}));pending=work;
    try{return await work;}finally{if(pending===work)pending=null;}
   }catch(_){if(claimed)stopped=true;stop();}finally{if(claimed)busy=false;}
  },stopAndDrain:async function(){
   if(arguments.length)stop();stopped=true;const owned=pending;if(owned)try{await owned;}catch(_){}
   return Object.freeze({source:'original-native-identity-holder',ownedIOSettled:true,remoteExecutionSettled:false,rollbackComplete:false});
  }});
 }catch(_){stop();}
}
