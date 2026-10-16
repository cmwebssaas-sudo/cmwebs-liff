import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fixture,clock} from './standalone-budget.mjs';
import {createAuthorityStandaloneControl,createAuthorityClosedPreflightHandoff} from '../../../scripts/read-authority-continuation-control.mjs';
import {STANDALONE_TRIAL_POLICY as policy,STANDALONE_TRIAL_DECISION_HASH as decisionHash} from '../../../scripts/read-authority-continuation-plan.mjs';
import {AUTHORITY_TRIAL_SCOPES} from '../../../scripts/read-authority-trial-driver.mjs';
import * as mod from '../../../scripts/read-authority-continuation-driver.mjs';
export {clock};
const sha=v=>createHash('sha256').update(v).digest('hex');
const managementScopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(v=>'https://www.googleapis.com/auth/'+v);
const aliases=['original-project','original-editor','original-versions','original-deployments','library-content','thin-content','thin-deployments','synthetic-acl','original-acl','original-settings','original-triggers','thin-settings','oauth-audience','oauth-client','caller-sheets-metadata','standalone-acl'];
const fullMap=()=>Object.entries(policy.operations).map(([key,rule])=>{const i=key.indexOf(':');return {id:key.replaceAll(':','.'),bucket:key.slice(0,i),alias:key.slice(i+1),actor:rule.actor,target:rule.target,operation:rule.methods[0],units:1};});
export function setup(){
 const s=fixture();let time=clock,drift=false;const map=fullMap(),events=[],calls={credential:0,publisher:0,rpc:0,sign:0,guard:0};
 const expected={deploymentId:'SYNTHETIC_DEPLOYMENT_ID',thinScriptId:'SYNTHETIC_THIN_SCRIPT',originalScriptId:'SYNTHETIC_ORIGINAL_SCRIPT',standaloneVersion:1,thinSourceHash:'a'.repeat(64),thinManifestHash:'a'.repeat(64),originalEditorHash:'a'.repeat(64),originalDeploymentsHash:'a'.repeat(64),originalCloudProject:'SYNTHETIC_DEFAULT',trialEpoch:s.cfg.epoch,syntheticSheetId:'SYNTHETIC_SHEET',callerHash:'b'.repeat(64),publisherHash:'c'.repeat(64),oauthClientHash:'d'.repeat(64),newCloudProject:'SYNTHETIC_NEW_PROJECT',sheetContractHash:'f'.repeat(64)};
 const guard=()=>{calls.guard++;if(drift)throw Error('PRIVATE_SOURCE_DRIFT');};
 const home=process.env.HOME,{now,ownerNonce,...config}=s.cfg;let control;
 try{process.env.HOME=s.home;control=createAuthorityStandaloneControl({config,now:()=>time,pause:async ms=>{time+=ms;},guard});}finally{if(home===undefined)delete process.env.HOME;else process.env.HOME=home;}
 const release=()=>({...expected,scopes:[...AUTHORITY_TRIAL_SCOPES],developmentMode:false,executionAccess:'ANYONE',oauthStatus:'TESTING',testingUsers:1,callerSheetRole:'reader',callerOriginalScriptRole:'none',callerOriginalSheetRole:'none',callerStandaloneScriptRole:'reader',callerPropertiesMatch:true,standaloneLibraryCount:0,standaloneTriggers:0,originalTriggers:0,retainedVersions:[1,2,3,4,5,6],originalEditorUnchanged:true,originalDeploymentsUnchanged:true,observedAt:time});
 const options={decisionHash,continuationBinding:config.binding,expected,expiresAt:config.expiresAt,now:()=>time,operations:map,
  credential:()=>{calls.credential++;return {accessToken:'SYNTHETIC_CALLER_SECRET',scopes:[...AUTHORITY_TRIAL_SCOPES],expiresAt:config.expiresAt,refreshTokenPresent:false,callerHash:expected.callerHash,oauthClientHash:expected.oauthClientHash};},
  publisherCredential:()=>{calls.publisher++;return {accessToken:'SYNTHETIC_PUBLISHER_SECRET',scopes:[...managementScopes],expiresAt:config.expiresAt,refreshTokenPresent:true,accountHash:expected.publisherHash};},
  readRelease:async cap=>{for(const alias of aliases)await cap.externalRead(()=>{events.push(cap.phase+'.'+alias);},alias);return release();},
  readIdentity:async(actor,token,context)=>{events.push(context.phase+'.identity.'+actor);assert.equal(token,actor==='caller'?'SYNTHETIC_CALLER_SECRET':'SYNTHETIC_PUBLISHER_SECRET');return {source:'google-userinfo-same-token',actor,phase:context.phase,accountHash:expected[actor+'Hash'],observedAt:time,credentialExpiresAt:config.expiresAt};},
  signRequest:()=>{calls.sign++;return {action:'read_replica_authorize',nonce:'SYNTHETIC-NONCE-123456789012',timestamp:time,signature:'f'.repeat(64),payload:JSON.stringify({protocol:'session',credential:'SYNTHETIC_SESSION_SECRET',credential_digest:sha('session:SYNTHETIC_SESSION_SECRET'),route:'/v1/rooms'})};},
  assertDispatch:guard,
  transport:async call=>{calls.rpc++;assert.equal(call.accessToken,'SYNTHETIC_CALLER_SECRET');assert.equal(call.url,'https://script.googleapis.com/v1/scripts/SYNTHETIC_DEPLOYMENT_ID:run');assert.equal(call.body.function,'authorizeTrial');assert.equal(call.body.devMode,false);assert.equal(call.body.parameters[1],'compatibility');assert.equal((existsSync(s.path+'.standalone-successor.json')?JSON.parse(readFileSync(s.path+'.standalone-successor.json')):s.journal()).chargedUpperBoundMs,360000);assert.equal((existsSync(s.path+'.standalone-successor.json')?JSON.parse(readFileSync(s.path+'.standalone-successor.json')):s.journal()).events.at(-1).outcome,'UNKNOWN');assert.equal((existsSync(s.path+'.standalone-successor.json')?JSON.parse(readFileSync(s.path+'.standalone-successor.json')):s.journal()).events.at(-1).operation.bucket,'H');events.push('RPC');return {done:true,response:{result:{compatible:true}}};}
 };
 const prepare=async cap=>{await cap.completePlan(map);for(const bucket of ['P','A','B','C','D','E'])for(const op of map.filter(v=>v.bucket===bucket&&!['restore-editor','read-restored-editor',...(cap.identity.closedPreflight?['caller-bind']:[])].includes(v.alias)))await cap.externalRead(()=>{},op);};
 const driver=()=>{assert.equal(typeof mod.createAuthorityStandaloneDriver,'function');return mod.createAuthorityStandaloneDriver(options);};
 const run=async(d=driver(),inside=null)=>control.withContinuation(async cap=>{await prepare(cap);if(inside)return inside(d,cap);return d.run(cap);});
 return {...s,options,driver,run,prepare,control,calls,events,map,release,now:()=>time,setTime:v=>{time=v;},setDrift:()=>{drift=true;}};
}

import {successorFixture} from './standalone-budget.mjs';
export async function successorSetup(){
 const s=setup(),caller=s.map.find(o=>o.alias==='caller-bind'),publisher=s.map.find(o=>o.alias==='publisher-bind');
 await assert.rejects(s.control.withContinuation(async cap=>{await cap.externalRead(()=>{},caller);await cap.externalRead(()=>{throw Error('API_REJECTED');},publisher);}),/TRIAL_STOPPED/);
 successorFixture(s);s.setTime(clock+1);const previous=process.env.HOME;process.env.HOME=s.home;
 let control;const {now,ownerNonce,...config}=s.cfg;
 try{control=createAuthorityStandaloneControl({config,predecessorHandoff:createAuthorityClosedPreflightHandoff({current:{control:s.control}}),now:s.now,pause:async ms=>s.setTime(s.now()+ms),guard:()=>{}});}finally{if(previous===undefined)delete process.env.HOME;else process.env.HOME=previous;}
 s.options.continuationBinding=config.binding;s.options.closedPreflight={pins:config.closedPreflight,callerSelection:caller};
 const run=async(d=s.driver())=>control.withContinuation(async cap=>{await s.prepare(cap);return d.run(cap);});
 return {...s,control,run};
}
