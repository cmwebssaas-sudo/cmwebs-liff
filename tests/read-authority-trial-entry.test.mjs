import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {authorityRuntime,authoritySecret} from './fixtures/read-parity/authority-runtime.mjs';
let build;
try{({buildAuthorityTrialEntry:build}=await import('../scripts/build-read-authority-trial-entry.mjs'));}
catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const email='trial-reader@example.invalid',scriptId='SYNTHETIC_THIN_SCRIPT';
function request(h){
  const payload=JSON.stringify({protocol:'session',credential:'synthetic-email-token',credential_digest:createHash('sha256').update('session:synthetic-email-token').digest('hex'),route:'/v1/arrears'});
  const r={action:'read_replica_authorize',timestamp:h.clock(),nonce:randomUUID(),payload};
  r.signature=createHmac('sha256',authoritySecret).update('cmwebs-read-auth-request-v1\n'+r.timestamp+'\n'+r.nonce+'\n'+payload).digest('hex');return r;
}
function runtime(overrides={}){
  assert.equal(typeof build,'function');const h=authorityRuntime(),bundle=build(),state={rows:0,cache:0,network:0,libraryCalls:0};
  const config={C3_TRIAL_CALLER_EMAIL:email,C3_TRIAL_CALLER_SCRIPT_ID:scriptId,...overrides.config};
  const base={Date:h.context.Date,JSON,console,Utilities:h.context.Utilities,
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>Object.hasOwn(config,key)?config[key]:h.context.PropertiesService.getScriptProperties().getProperty(key)})},
    Session:{getActiveUser:()=>({getEmail:()=>overrides.active??email}),getEffectiveUser:()=>({getEmail:()=>overrides.effective??email})},
    ScriptApp:{getScriptId:()=>overrides.scriptId??scriptId},
    SpreadsheetApp:new Proxy({}, {get(){state.rows++;throw Error('ROW_IO_FORBIDDEN');}}),
    CacheService:new Proxy({}, {get(){state.cache++;throw Error('CACHE_IO_FORBIDDEN');}}),
    LockService:new Proxy({}, {get(){state.cache++;throw Error('LOCK_IO_FORBIDDEN');}}),
    UrlFetchApp:{fetch(){state.network++;throw Error('NETWORK_IO_FORBIDDEN');}}};
  const context=vm.createContext(base);vm.runInContext(bundle.librarySource,context);
  const wrapperConfig={C3_TRIAL_CALLER_EMAIL:email,C3_TRIAL_CALLER_SCRIPT_ID:scriptId,...overrides.wrapperConfig};
  const wrapper=vm.createContext({...base,
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>wrapperConfig[key]??null})},
    Session:{getActiveUser:()=>({getEmail:()=>overrides.wrapperActive??email}),getEffectiveUser:()=>({getEmail:()=>overrides.wrapperEffective??email})},
    ScriptApp:{getScriptId:()=>overrides.wrapperScriptId??scriptId},
    AuthorityTrial:{authorizeTrial(...args){state.libraryCalls++;return context.authorizeTrial(...args);}}});
  vm.runInContext(bundle.wrapperSource,wrapper);
  return {...h,bundle,context,wrapper,state};
}
const plain=value=>JSON.parse(JSON.stringify(value));
const noIo=h=>assert.deepEqual([h.state.rows,h.state.cache,h.state.network],[0,0,0]);
test('entry builder exists before any executable preparation',()=>assert.equal(typeof build,'function'));
test('valid compatibility probe uses original MAC without rows, cache, lock or network',()=>{
  const h=runtime(),r=request(h);assert.deepEqual(plain(h.context.authorizeTrial(r,'compatibility')),{compatible:true});noIo(h);
  assert.equal(h.bundle.status,'LOCAL_ENTRY_NOT_DEPLOYABLE');
});
test('thin wrapper delegates signature check without copying library secret',()=>{
  const h=runtime();assert.deepEqual(plain(h.wrapper.authorizeTrial(request(h),'compatibility')),{compatible:true});assert.equal(h.state.libraryCalls,1);noIo(h);
});
for(const [name,override] of [
 ['empty active',{active:''}],['different active',{active:'other@example.invalid'}],
 ['empty effective',{effective:''}],['different effective',{effective:'other@example.invalid'}],
 ['different project',{scriptId:'OTHER_SCRIPT'}],['empty project',{scriptId:''}],
 ['missing allowed caller',{config:{C3_TRIAL_CALLER_EMAIL:null}}],
 ['missing allowed project',{config:{C3_TRIAL_CALLER_SCRIPT_ID:null}}]
])test('direct qualified library denial before authority IO: '+name,()=>{const h=runtime(override);assert.notEqual(h.context.authorizeTrial(request(h),'compatibility').compatible,true);noIo(h);});
for(const [name,override] of [
 ['empty active',{wrapperActive:''}],['different active',{wrapperActive:'other@example.invalid'}],
 ['empty effective',{wrapperEffective:''}],['different effective',{wrapperEffective:'other@example.invalid'}],
 ['different project',{wrapperScriptId:'OTHER_SCRIPT'}],
 ['missing caller config',{wrapperConfig:{C3_TRIAL_CALLER_EMAIL:null}}]
])test('thin wrapper denial never calls library: '+name,()=>{const h=runtime(override);assert.notEqual(h.wrapper.authorizeTrial(request(h),'compatibility').compatible,true);assert.equal(h.state.libraryCalls,0);noIo(h);});
for(const [name,change] of [
 ['forged MAC',r=>r.signature='0'.repeat(64)],['extra envelope field',r=>r.email=email],
 ['old timestamp',r=>r.timestamp-=15001],['invalid nonce',r=>r.nonce='short'],
 ['unknown operation',r=>r.action='anything'],['tampered payload',r=>r.payload+=' '],
])test('compatibility probe rejects '+name,()=>{const h=runtime(),r=request(h);change(r);assert.notEqual(h.wrapper.authorizeTrial(r,'compatibility').compatible,true);noIo(h);});
test('MAC-valid but disallowed payload rejected by canonical prefix',()=>{
  const h=runtime(),r=request(h);const payload=JSON.parse(r.payload);payload.route='/v1/private';r.payload=JSON.stringify(payload);
  r.signature=createHmac('sha256',authoritySecret).update('cmwebs-read-auth-request-v1\n'+r.timestamp+'\n'+r.nonce+'\n'+r.payload).digest('hex');
  assert.notEqual(h.context.authorizeTrial(r,'compatibility').compatible,true);noIo(h);
});
test('business mode requires fixed contract before authority IO',()=>{
  const h=runtime();assert.equal(h.context.authorizeTrial(request(h),'authority').success,false);noIo(h);
});
test('unknown operation or extra positional arguments denied without IO',()=>{
  const h=runtime();for(const target of [h.context,h.wrapper]){
    assert.notEqual(target.authorizeTrial(request(h),'anything').compatible,true);
    assert.notEqual(target.authorizeTrial(request(h),'compatibility','extra').compatible,true);
  }noIo(h);
});
test('only guarded public function exposed; original functions inaccessible',()=>{
  const h=runtime();for(const name of ['readAuthorizationConfirm_','readReplicaConfig_','workspaceEnsureSheet_','doPost'])assert.equal(vm.runInContext('typeof '+name,h.context),'undefined');
  const funcs=Object.entries(h.context).filter(([name,value])=>typeof value==='function'&&!['Date'].includes(name)).map(([name])=>name);assert.deepEqual(funcs,['authorizeTrial']);
});
