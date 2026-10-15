import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {authorityRuntime,authoritySecret} from './fixtures/read-parity/authority-runtime.mjs';
const root=new URL('../',import.meta.url);
let build;
try{({buildAuthorityTrialClosure:build}=await import('../scripts/build-read-authority-trial-closure.mjs'));}
catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
test('trial closure generator exists before any Google preparation',()=>assert.equal(typeof build,'function'));
function request(h,protocol='session',credential='synthetic-email-token'){
  const payload=JSON.stringify({protocol,credential,credential_digest:createHash('sha256').update(protocol+':'+credential).digest('hex'),route:'/v1/arrears'});
  const value={action:'read_replica_authorize',timestamp:h.clock(),nonce:randomUUID(),payload};
  value.signature=createHmac('sha256',authoritySecret).update('cmwebs-read-auth-request-v1\n'+value.timestamp+'\n'+value.nonce+'\n'+payload).digest('hex');return value;
}
function trial(){
  const h=authorityRuntime(),bundle=build(root),base={};
  // Keep only explicit GAS/builtin service fixtures. No original dispatcher,
  // bridge, stub or unselected canonical function may mask a missing dependency.
  for(const name of ['Date','JSON','console','SpreadsheetApp','PropertiesService',
    'CacheService','LockService','Logger','Utilities','UrlFetchApp','ContentService'])base[name]=h.context[name];
  const context=vm.createContext(base);vm.runInContext(bundle.source,context);
  function call(r){context.runtimeSnapshotBegin_('read_replica_authorize');return context.readAuthorizationConfirm_(r);}
  return {...h,context,call,bundle};
}
test('closure is deterministic, exactly pinned, private and excludes management globals',()=>{
  assert.equal(typeof build,'function');const a=build(root),b=build(root);assert.deepEqual(a,b);
  assert.equal(a.status,'LOCAL_CLOSURE_NOT_DEPLOYABLE');assert.ok(a.declarations.length>0);
  for(const d of a.declarations){const source=readFileSync(new URL(d.path,root),'utf8');assert.equal(createHash('sha256').update(source.slice(d.start,d.end)).digest('hex'),d.sha256);}
  assert.ok(a.declarations.some(d=>d.names.includes('readAuthorizationConfirm_')));
  assert.ok(a.declarations.filter(d=>d.kind==='FunctionDeclaration').every(d=>d.names.every(n=>n.endsWith('_'))));
  assert.ok(!a.declarations.some(d=>d.names.some(n=>/^(doGet|doPost|syncReadReplica|authorizeC3TestEnvironment)$/.test(n))));
  assert.deepEqual(a.publicFunctions,[]);
});
test('isolated VM cannot call original dispatcher or unrelated bridge/stubs',()=>{
  assert.equal(typeof build,'function');const h=trial();
  for(const name of ['doPost','dispatchV2Post_','resolveLandlordQuickLeaseBridgeAccess_',
    'bankReceiptPostRequest_','repairRouteRequestFromPostBody_']){
    assert.equal(vm.runInContext('typeof '+name,h.context),'undefined',name+' must not mask a missing dependency');
  }
});
for(const role of ['owner','admin','manager','accountant','maintenance','viewer'])for(const protocol of ['session','liff'])test('isolated closure oracle '+role+' '+protocol,()=>{
  assert.equal(typeof build,'function');const h=trial(),oracle=authorityRuntime();for(const current of [h,oracle]){current.data.V2_workspace_members[0].role=role;current.data.V2_landlord_email_sessions[0].role=role;}
  const credential=protocol==='liff'?'synthetic-valid-line-token':'synthetic-email-token';const actual=h.call(request(h,protocol,credential));assert.ok(actual.body);const expected=oracle.post(request(oracle,protocol,credential));assert.deepEqual(JSON.parse(actual.body).result,JSON.parse(expected.body).result);
  assert.equal(JSON.parse(actual.body).result.success,true);
});
for(const [name,change] of [
 ['session revoked',h=>h.data.V2_landlord_email_sessions[0].status='revoked'],
 ['user disabled',h=>h.data.V2_users[0].account_status='disabled'],
 ['workspace disabled',h=>h.data.V2_workspaces[0].account_status='disabled'],
 ['member suspended',h=>h.data.V2_workspace_members[0].member_status='suspended'],
 ['role changed',h=>h.data.V2_workspace_members[0].role='viewer'],
 ['cross workspace',h=>h.data.V2_landlord_email_sessions[0].workspace_id='OTHER'],
 ['expired',h=>h.advance(Date.parse(h.data.V2_landlord_email_sessions[0].expires_at)-h.clock()+1)],
])test('isolated closure source freshness '+name,()=>{assert.equal(typeof build,'function');const h=trial();assert.equal(JSON.parse(h.call(request(h)).body).result.success,true);change(h);assert.equal(JSON.parse(h.call(request(h)).body).result.success,false);});
test('isolated closure shares nonce lifetime and dirty/lease state, rejects forged MAC',()=>{
  assert.equal(typeof build,'function');const h=trial(),r=request(h);assert.equal(JSON.parse(h.call(r).body).result.success,true);assert.equal(h.call(r).success,false);
  for(const key of ['cmwebs:read-replica:dirty:V2_bills','cmwebs:read-replica:lease']){h.cache.set(key,'pending');assert.equal(JSON.parse(h.call(request(h)).body).result.replica_dirty,true);h.cache.delete(key);}
  assert.equal(h.call({...request(h),signature:'0'.repeat(64)}).success,false);
});
