// Compatibility-only continuation inside an already-held canonical scope.
// This module performs no claim, preparation, credential acquisition or retry.
// Trusted adapters must wire every charged callback to one fixed low-level IO.
// A real launcher must pin the entire reachable source closure and independent
// recovery; the synchronous guard is an obligation, not a source-proof factory.
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {AUTHORITY_TRIAL_SCOPES,verifyAuthorityTrialReadback,verifyAuthorityStandaloneReadback} from './read-authority-trial-driver.mjs';
import {BOUNDED_CONTINUATION_DECISION_HASH as continuationDecisionHash,BOUNDED_CONTINUATION_POLICY as policy,compileAuthorityContinuationPlan,STANDALONE_TRIAL_DECISION_HASH,STANDALONE_TRIAL_POLICY,compileAuthorityStandalonePlan} from './read-authority-continuation-plan.mjs';
const stop=()=>{throw Error('TRIAL_STOPPED');};
const keys=(v,list)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...list].sort().join(',');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hash=v=>createHash('sha256').update(v).digest('hex');
const integer=Number.isSafeInteger;
const continuationPins=['deploymentId','thinScriptId','libraryId','libraryVersion','librarySourceHash','thinSourceHash','libraryManifestHash','thinManifestHash','originalEditorHash','originalDeploymentsHash','originalCloudProject','trialEpoch','syntheticSheetId','callerHash','publisherHash','oauthClientHash','newCloudProject','sheetContractHash'];
const standalonePins=['deploymentId','thinScriptId','standaloneVersion','thinSourceHash','thinManifestHash','originalScriptId','originalEditorHash','originalDeploymentsHash','originalCloudProject','trialEpoch','syntheticSheetId','callerHash','publisherHash','oauthClientHash','newCloudProject','sheetContractHash'];
const managementScopes=Object.freeze(['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(v=>'https://www.googleapis.com/auth/'+v));
const aliasesFor=policy=>Object.keys(policy.operations).filter(k=>k.startsWith('F:wrapper-before.')).map(k=>k.slice('F:wrapper-before.'.length));
// Accessor/proxy/toJSON code never participates in validated data snapshots.
function snapshot(value,strict=false){
 let count=0;const seen=new Set();
 const copy=(v,depth)=>{
  if(++count>4000||depth>12)stop();
  if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return v;
  if(typeof v!=='object'||types.isProxy(v)||seen.has(v)||(!Array.isArray(v)&&![Object.prototype,null].includes(Object.getPrototypeOf(v))))stop();
  seen.add(v);const ds=Object.getOwnPropertyDescriptors(v),out=Array.isArray(v)?[]:{};
  if(strict&&Array.isArray(v)&&(Reflect.ownKeys(ds).length!==v.length+1||Object.keys(ds).some(k=>k!=='length'&&(!/^(?:0|[1-9]\d*)$/.test(k)||Number(k)>=v.length))))stop();
  for(const k of Reflect.ownKeys(ds)){if(Array.isArray(v)&&k==='length')continue;const d=ds[k];if(typeof k!=='string'||!d.enumerable||!Object.hasOwn(d,'value')||Array.isArray(v)&&!/^\d+$/.test(k))stop();Object.defineProperty(out,k,{value:copy(d.value,depth+1),enumerable:true});}
  if(Array.isArray(v)&&Object.keys(out).length!==v.length)stop();seen.delete(v);return Object.freeze(out);
 };return copy(value,0);
}
function inputSnapshot(input,strict=false){
 if(!input||typeof input!=='object'||types.isProxy(input))stop();const ds=Object.getOwnPropertyDescriptors(input),out={};
 for(const k of Reflect.ownKeys(ds)){const d=ds[k];if(typeof k!=='string'||!d.enumerable||!Object.hasOwn(d,'value'))stop();Object.defineProperty(out,k,{value:typeof d.value==='function'?d.value:snapshot(d.value,strict),enumerable:true});}
 return Object.freeze(out);
}
function sync(fn){const value=fn();if(types.isPromise(value)){void Promise.prototype.then.call(value,()=>{},()=>{});stop();}return value;}
function signedRequest(raw,time){
 const v=snapshot(raw);if(!keys(v,['action','nonce','payload','signature','timestamp'])||v.action!=='read_replica_authorize'||!integer(v.timestamp)||Math.abs(time-v.timestamp)>15000||typeof v.nonce!=='string'||!/^[-a-zA-Z0-9]{20,64}$/.test(v.nonce)||typeof v.signature!=='string'||!/^[a-f0-9]{64}$/.test(v.signature)||typeof v.payload!=='string'||v.payload.length>10000)stop();
 const p=JSON.parse(v.payload);
 if(!keys(p,['credential','credential_digest','protocol','route'])||!['liff','session'].includes(p.protocol)||typeof p.credential!=='string'||!p.credential||/[\s\x00-\x1f\x7f]/.test(p.credential)||p.credential.length>8192||p.credential_digest!==hash(p.protocol+':'+p.credential)||!['/v1/home','/v1/revenue','/v1/tenants','/v1/rooms','/v1/arrears','/v1/properties'].includes(p.route))stop();return v;
}
function compatible(response){
 if(!keys(response,['done','response'])||response.done!==true)return false;
 const r=response.response,typed=r&&Object.hasOwn(r,'@type');
 return keys(r,['result',...(typed?['@type']:[])])&&(!typed||r['@type']==='type.googleapis.com/google.apps.script.v1.ExecutionResponse')&&keys(r.result,['compatible'])&&r.result.compatible===true;
}
export function createAuthorityContinuationDriver(input){
 return createDriver(input,false);
}
export function createAuthorityStandaloneDriver(input){
 return createDriver(input,true);
}
function createDriver(input,standalone){
 try{
  const data=value=>snapshot(value,standalone);
  const releaseAliases=aliasesFor(standalone?STANDALONE_TRIAL_POLICY:policy);
  const decisionHash=standalone?STANDALONE_TRIAL_DECISION_HASH:continuationDecisionHash,pins=standalone?standalonePins:continuationPins;
  const compile=standalone?compileAuthorityStandalonePlan:compileAuthorityContinuationPlan,verify=standalone?verifyAuthorityStandaloneReadback:verifyAuthorityTrialReadback;
  const o=inputSnapshot(input,standalone),closed=standalone&&Object.hasOwn(o,'closedPreflight'),required=['decisionHash','continuationBinding','expected','expiresAt','now','operations','readRelease','readIdentity','credential','publisherCredential','signRequest','assertDispatch','transport'];
  if(!keys(o,[...required,...(Object.hasOwn(o,'readTerminal')?['readTerminal']:[]),...(closed?['closedPreflight']:[])])||o.decisionHash!==decisionHash||typeof o.continuationBinding!=='string'||!/^[a-f0-9]{64}$/.test(o.continuationBinding)||!integer(o.expiresAt)||o.expiresAt<=0||['now','readRelease','readIdentity','credential','publisherCredential','signRequest','assertDispatch','transport',...(Object.hasOwn(o,'readTerminal')?['readTerminal']:[])].some(k=>typeof o[k]!=='function'))stop();
  const e=o.expected;
  const version=standalone?'standaloneVersion':'libraryVersion';
  if(!keys(e,pins)||!integer(e[version])||(standalone?e[version]!==1||e.originalScriptId===e.thinScriptId:e[version]<1)||e.callerHash===e.publisherHash||e.originalCloudProject===e.newCloudProject)stop();
  for(const k of pins.filter(k=>k!==version))if(typeof e[k]!=='string'||!(/Hash$/.test(k)?/^[a-f0-9]{64}$/:/^[-A-Za-z0-9_]{1,200}$/).test(e[k]))stop();
  if(closed&&!keys(o.closedPreflight,['pins','callerSelection']))stop();
  if(!compile({decisionHash,history:{spent:closed?33:standalone?STANDALONE_TRIAL_POLICY.importedUnits:policy.importedUnits,limit:160,...(closed?{closedPreflightCaller:o.closedPreflight.callerSelection}:{})},mapComplete:true,operations:o.operations}).credentialRpcEligible)stop();
  const mapped=new Map(o.operations.map(v=>[v.bucket+':'+v.alias,v]));
  const time=()=>{const n=o.now();if(!integer(n))stop();return n;};
  const guard=()=>{if(sync(o.assertDispatch)!==undefined)stop();};
  const live=()=>{const n=time();if(n>=o.expiresAt)stop();return n;};
  const fresh=(observedAt,n=time())=>{if(!integer(observedAt)||observedAt>n||n-observedAt>60000)stop();};
  const token=(getter,actor)=>{
   const t=data(sync(getter)),caller=actor==='caller',fields=['accessToken','scopes','expiresAt','refreshTokenPresent',...(caller?['callerHash','oauthClientHash']:['accountHash'])];
   if(!keys(t,fields)||typeof t.accessToken!=='string'||!t.accessToken||/[\s\x00-\x1f\x7f]/.test(t.accessToken)||t.accessToken.length>8192||!Array.isArray(t.scopes)||!same([...t.scopes].sort(),[...(caller?AUTHORITY_TRIAL_SCOPES:managementScopes)].sort())||!integer(t.expiresAt)||t.expiresAt-live()<=360000||t.expiresAt>o.expiresAt||t.refreshTokenPresent!==!caller||(caller?(t.callerHash!==e.callerHash||t.oauthClientHash!==e.oauthClientHash):t.accountHash!==e.publisherHash))stop();return t;
  };
  let used=false;
  const run=async function(cap){
   let observerActive=false;
   try{
    if(standalone)cap=inputSnapshot(cap,standalone);
    if(arguments.length!==1||used||!cap||typeof cap.inspect!=='function'||typeof cap.externalRead!=='function'||typeof cap.dispatchCompatibility!=='function'||typeof cap.finishCompatibility!=='function')stop();used=true;
    // No new scope or ledger: identity comes from the current captured owner.
    const identity=data(cap.identity);
    if(!keys(identity,['epoch','binding','decisionHash','expiresAt',...(closed?['closedPreflight']:[])])||identity.epoch!==e.trialEpoch||identity.binding!==o.continuationBinding||identity.decisionHash!==decisionHash||identity.expiresAt!==o.expiresAt||cap.decisionHash!==decisionHash||closed&&!same(identity.closedPreflight,o.closedPreflight.pins))stop();
    guard();const state=data(await cap.inspect());
    if(state.state!=='ready'||state.planReady!==true||state.expiresAt!==o.expiresAt||!integer(state.w0)||live()<state.w0||o.expiresAt-state.w0>21600000||state.rpc?.beganAt!==null||state.rpc?.complete!==false||state.chargedUpperBoundMs!==0)stop();
    const caller=token(o.credential,'caller'),publisher=token(o.publisherCredential,'publisher');
    if(caller.accessToken===publisher.accessToken)stop();
    const tokens=Object.freeze({caller,publisher});
    const release=async phase=>{
     if(observerActive)stop();observerActive=true;let active=true,failed=false,pending=0;const seen=new Set(),tasks=[];
     const externalRead=(io,alias)=>{
      pending++;
      const task=(async()=>{
       try{if(!active||failed||pending!==1||typeof io!=='function'||!releaseAliases.includes(alias)||seen.has(alias))stop();seen.add(alias);const descriptor=mapped.get('F:'+phase+'.'+alias);return await cap.externalRead(()=>{if(!active||failed)stop();guard();live();return io();},descriptor);}catch(_){failed=true;stop();}finally{pending--;}
      })();tasks.push(task);void task.catch(()=>{});return task;
     };
     try{
      guard();live();const start=time();const raw=await o.readRelease(Object.freeze({phase,decisionHash,externalRead,credentials:tokens}));
      if(failed||pending||seen.size!==releaseAliases.length||releaseAliases.some(v=>!seen.has(v)))stop();const result=data(raw);verify(e,result);fresh(result.observedAt);if(result.observedAt<start)stop();guard();return result;
     }finally{active=false;await Promise.allSettled(tasks);observerActive=false;}
    };
    const identities=async phase=>{
     const result=[];
     for(const actor of ['caller','publisher']){
      const t=tokens[actor];let admittedAt;guard();live();
      const v=data(await cap.externalRead(async()=>{
       guard();admittedAt=live();if(t.expiresAt-admittedAt<=10000)stop();return o.readIdentity(actor,t.accessToken,Object.freeze({phase,decisionHash,credentialExpiresAt:t.expiresAt}));
      },mapped.get('G:'+phase+'.'+actor)));
      if(!keys(v,['source','actor','phase','accountHash','observedAt','credentialExpiresAt'])||v.source!=='google-userinfo-same-token'||v.actor!==actor||v.phase!==phase||v.accountHash!==e[actor+'Hash']||v.credentialExpiresAt!==t.expiresAt)stop();fresh(v.observedAt);if(v.observedAt<admittedAt)stop();result.push(v);
     }return result;
    };
    const before=await release('wrapper-before'),beforeIdentities=await identities('wrapper-before');
    // Guard/sign/validate/dispatch remain synchronous in this admitted callback.
    // Catch only actual transport errors here: the core must still own pending H
    // while bounded F/G/T readback runs. Source/owner faults deny those reads.
    const reply=await cap.dispatchCompatibility({operation:mapped.get('H:wrapper-compatibility-rpc'),credentialExpiresAt:caller.expiresAt},async startedAt=>{
     guard();live();fresh(before.observedAt);beforeIdentities.forEach(v=>fresh(v.observedAt));
     if(!integer(startedAt)||time()<startedAt||caller.expiresAt-time()<=360000||publisher.expiresAt-time()<=360000)stop();
     const request=signedRequest(sync(o.signRequest),time());guard();const sendTime=live();
     fresh(before.observedAt,sendTime);beforeIdentities.forEach(v=>fresh(v.observedAt,sendTime));
     if(Math.abs(sendTime-request.timestamp)>15000||caller.expiresAt-sendTime<=360000||publisher.expiresAt-sendTime<=360000)stop();
     const call=Object.freeze({url:'https://script.googleapis.com/v1/scripts/'+e.deploymentId+':run',accessToken:caller.accessToken,body:Object.freeze({function:'authorizeTrial',parameters:Object.freeze([request,'compatibility']),devMode:false})});
     try{return {transportFailed:false,response:data(await o.transport(call)),startedAt};}catch(_){return {transportFailed:true,response:null,startedAt};}
    });
    const after=await release('wrapper-after'),afterIdentities=await identities('wrapper-after');
    if(reply.transportFailed||!compatible(reply.response)){
     if(o.readTerminal)for(let attempt=1;attempt<=3;attempt++){
      const result=await cap.externalRead(async()=>{guard();live();try{return data(await o.readTerminal(Object.freeze({attempt,startedAt:reply.startedAt,deploymentId:e.deploymentId,function:'authorizeTrial',accessToken:caller.accessToken})));}catch(_){return {terminalKnown:false};}},mapped.get('T:terminal-'+attempt));
      if(!keys(result,['terminalKnown'])||typeof result.terminalKnown!=='boolean')stop();if(result.terminalKnown)break;
     }
     stop();
    }
    guard();live();fresh(after.observedAt);afterIdentities.forEach(v=>fresh(v.observedAt));await cap.finishCompatibility();return Object.freeze({compatible:true});
   }catch(_){stop();}
  };
  return Object.freeze({run});
 }catch(_){stop();}
}
