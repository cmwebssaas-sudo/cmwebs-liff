import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import * as entry from '../scripts/build-read-authority-trial-entry.mjs';
import {authorityRuntime,authoritySecret} from './fixtures/read-parity/authority-runtime.mjs';

const email='standalone-reader@example.invalid',scriptId='SYNTHETIC_STANDALONE_SCRIPT';
function runtime(overrides={}){
  assert.equal(typeof entry.buildStandaloneAuthorityTrialArtifacts,'function');
  const bundle=entry.buildStandaloneAuthorityTrialArtifacts(),h=authorityRuntime();
  const io=[];
  const deniedService=name=>new Proxy({}, {get(){io.push(name);throw Error('UNEXPECTED_IO');}});
  const properties={C3_TRIAL_CALLER_EMAIL:email,C3_TRIAL_CALLER_SCRIPT_ID:scriptId,...overrides.properties};
  const context=vm.createContext({Date:h.context.Date,JSON,Utilities:h.context.Utilities,
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>Object.hasOwn(properties,key)?properties[key]:h.context.PropertiesService.getScriptProperties().getProperty(key)})},
    Session:{getActiveUser:()=>({getEmail:()=>overrides.active??email}),getEffectiveUser:()=>({getEmail:()=>overrides.effective??email})},
    ScriptApp:{getScriptId:()=>overrides.scriptId??scriptId},
    SpreadsheetApp:deniedService('sheet'),CacheService:deniedService('cache'),LockService:deniedService('lock'),UrlFetchApp:deniedService('network')});
  vm.runInContext(bundle.source,context);
  return {...h,bundle,context,io};
}
function request(h){
  const credential='synthetic-email-token';
  const payload=JSON.stringify({protocol:'session',credential,credential_digest:createHash('sha256').update('session:'+credential).digest('hex'),route:'/v1/arrears'});
  const r={action:'read_replica_authorize',timestamp:h.clock(),nonce:randomUUID(),payload};
  r.signature=createHmac('sha256',authoritySecret).update('cmwebs-read-auth-request-v1\n'+r.timestamp+'\n'+r.nonce+'\n'+payload).digest('hex');
  return r;
}
const plain=value=>JSON.parse(JSON.stringify(value));
test('standalone compatibility succeeds without any external library or row IO',()=>{
  const h=runtime();
  assert.deepEqual(plain(h.context.authorizeTrial(request(h),'compatibility')),{compatible:true});
  assert.deepEqual(h.io,[]);
  assert.deepEqual(h.bundle.manifest.dependencies,{});
  assert.deepEqual(h.bundle.manifest.oauthScopes,[
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/script.external_request']);
  assert.equal(h.bundle.manifest.executionApi.access,'ANYONE');
  assert.equal(h.bundle.status,'LOCAL_STANDALONE_UNDEPLOYED');
});
for(const [name,overrides] of [
  ['wrong caller',{active:'other@example.invalid'}],['wrong effective caller',{effective:'other@example.invalid'}],
  ['empty caller',{active:''}],['wrong script',{scriptId:'OTHER_SCRIPT'}],
  ['missing caller property',{properties:{C3_TRIAL_CALLER_EMAIL:null}}],
  ['missing script property',{properties:{C3_TRIAL_CALLER_SCRIPT_ID:null}}]
])test('standalone rejects '+name+' before IO',()=>{
  const h=runtime(overrides);
  assert.deepEqual(plain(h.context.authorizeTrial(request(h),'compatibility')),{success:false,code:'TRIAL_UNAVAILABLE'});
  assert.deepEqual(h.io,[]);
});
for(const [name,change] of [
  ['forged signature',r=>{r.signature='0'.repeat(64);}],
  ['expired signature',r=>{r.timestamp-=15001;}],
  ['tampered payload',r=>{r.payload+=' ';}],
  ['extra envelope field',r=>{r.extra=true;}]
])test('standalone preserves canonical rejection of '+name,()=>{
  const h=runtime(),r=request(h);change(r);
  assert.deepEqual(plain(h.context.authorizeTrial(r,'compatibility')),{success:false,code:'TRIAL_UNAVAILABLE'});
  assert.deepEqual(h.io,[]);
});
test('standalone first phase cannot invoke authority, alternate operations, or extra arguments',()=>{
  const h=runtime();
  for(const args of [[request(h),'authority'],[request(h),'unknown'],[request(h),'compatibility','extra'],[request(h)]])
    assert.deepEqual(plain(h.context.authorizeTrial(...args)),{success:false,code:'TRIAL_UNAVAILABLE'});
  assert.deepEqual(h.io,[]);
});
test('standalone does not expose canonical helpers or alternate public endpoints',()=>{
  const h=runtime();
  for(const name of ['readAuthorizationConfirm_','readReplicaConfig_','readTrialRequestValidated_','doGet','doPost','AuthorityTrial'])
    assert.equal(vm.runInContext('typeof '+name,h.context),'undefined');
  assert.deepEqual(Object.entries(h.context).filter(([name,value])=>typeof value==='function'&&name!=='Date').map(([name])=>name),['authorizeTrial']);
});
