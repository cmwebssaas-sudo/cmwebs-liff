import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
import vm from 'node:vm';

const schemaSource=readFileSync(new URL('../apps-script/V2_READ_REPLICA_SCHEMA.js',import.meta.url),'utf8');
const moduleSource=()=>readFileSync(new URL('../apps-script/V2_READ_REPLICA_SYNC.js',import.meta.url),'utf8');
const tableCount=Object.keys(JSON.parse(readFileSync(new URL('../cloudflare/read-api/schema.json',import.meta.url),'utf8'))).length;
function harness({configured=true,fail=false,sheets={}}={}) {
  const cache=new Map(), sent=[], logs=[]; let reads=0, cacheSingleReads=0, cacheBatchReads=0, propertyReads=0;
  const properties=new Map(configured ? [['READ_REPLICA_URL','https://replica.synthetic.test'],['READ_REPLICA_SYNC_SECRET','synthetic-secret']] : []);
  const ctx=vm.createContext({ console, Date, JSON, Map, Set,
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>{propertyReads++;return properties.get(key)||null;}})},
    CacheService:{getScriptCache:()=>({get:key=>{cacheSingleReads++;return cache.get(key)||null;},
      getAll:keys=>{cacheBatchReads++;return Object.fromEntries(keys.filter(key=>cache.has(key)).map(key=>[key,cache.get(key)]));},
      put:(key,value)=>cache.set(key,value),remove:key=>cache.delete(key)})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
      getUuid:()=>crypto.randomUUID(),
      computeDigest:(_,text)=>[...createHash('sha256').update(text).digest()].map(x=>x>127?x-256:x),
      computeHmacSha256Signature:(text,key)=>[...createHmac('sha256',key).update(text).digest()].map(x=>x>127?x-256:x),
      newBlob:text=>({getBytes:()=>[...Buffer.from(text)]})},
    SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:name=>sheets[name] ? {getDataRange:()=>({getValues:()=>{reads++; return sheets[name];}})} : null})},
    UrlFetchApp:{fetch:(url,options)=>{sent.push({url,...options}); return {getResponseCode:()=>fail?503:200,getContentText:()=>JSON.stringify({success:!fail,data:{completed:JSON.parse(options.payload).complete}})};}},
    Logger:{log:value=>logs.push(value)}
  });
  vm.runInContext(schemaSource+'\n'+moduleSource(),ctx);
  return {ctx,cache,sent,logs,get reads(){return reads;},get cacheSingleReads(){return cacheSingleReads;},get cacheBatchReads(){return cacheBatchReads;},get propertyReads(){return propertyReads;}};
}

test('generated Apps Script schema equals the single JSON whitelist authority',()=>{
  const h=harness();
  const expected=JSON.parse(readFileSync(new URL('../cloudflare/read-api/schema.json',import.meta.url),'utf8'));
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(V2_READ_REPLICA_TABLES_)',h.ctx)),expected);
});

test('every dispatched action has an explicit classification and mutations invalidate their dependencies',()=>{
  const h=harness();
  const dispatcher=readFileSync(new URL('../apps-script/程式碼.js',import.meta.url),'utf8');
  const actions=new Set([...dispatcher.matchAll(/'((?:landlord|tenant|commercial)_[a-z0-9_]+)'/g)].map(m=>m[1]));
  actions.delete('landlord_session_token'); // Request field, not a route.
  const policy=JSON.parse(vm.runInContext('JSON.stringify(V2_READ_REPLICA_ACTIONS_)',h.ctx));
  for(const action of actions) assert.ok(Object.hasOwn(policy,action),action+' lacks explicit policy');
  for(const [action,required] of Object.entries({
    landlord_email_login_verify:['V2_landlord_email_sessions'],
    landlord_team_member_remove:['V2_workspace_members','V2_member_scopes'],
    landlord_invitation_accept:['V2_workspace_members'],
    landlord_bills_generate:['V2_bills'],
    landlord_bill_apply_initial_rent_credit:['V2_bills'],
    landlord_bill_reopen:['V2_bills'],
    landlord_contract_initiate_new:['V2_contracts','V2_contract_invites'],
    landlord_contract_paper_backfill:['V2_contracts','V2_tenants'],
    commercial_registration_email_verify:['V2_users','V2_workspaces'],
    commercial_registration_line:['V2_users','V2_workspaces']
  })) {
    h.cache.clear(); h.ctx.readReplicaAfterResponse_(action,{success:true});
    for(const table of required) assert.ok(h.cache.has('cmwebs:read-replica:dirty:'+table),action+' omitted '+table);
  }
  assert.equal(h.ctx.readReplicaSheetsForAction_('future_unclassified_route').length,tableCount);
});

test('empty and unprocessed webhooks do not schedule full replica reads',()=>{
  const h=harness();
  for(const result of [{success:true,code:'EMPTY_BODY'}, {success:true,code:'NO_EVENTS'},
    {success:true,data:{processed:0}}]) {
    h.ctx.readReplicaAfterResponse_('LINE_WEBHOOK',{getContent:()=>JSON.stringify(result)});
    assert.equal(h.cache.size,0);
  }
  h.ctx.readReplicaAfterResponse_('unknown_action',{success:true,code:'NO_EVENTS'});
  assert.equal(h.cache.size,0);
  h.ctx.readReplicaAfterResponse_('unknown_action',{success:true,code:'OK',message:'LINE webhook processed',
    data:{total:1,processed:0,skipped:1,errors:0}});
  assert.equal(h.cache.size,0);
  h.ctx.readReplicaAfterResponse_('LINE_WEBHOOK',{success:true,data:{processed:1}});
  assert.equal(h.cache.size,tableCount);
});

test('payment account projection preserves only a masked suffix and drops the full account',()=>{
  const h=harness();
  const result=h.ctx.readReplicaProjectRow_('V2_payment_accounts',{payment_account_id:'SYNTHETIC_ACCOUNT',
    workspace_id:'SYNTHETIC_W1',bank_account:'0000-0001-2345',bank_code:'SYNTHETIC',bank_name:'synthetic'});
  assert.equal(result.fields.bank_account_last5,'•••• 12345');
  assert.ok(!Object.hasOwn(result.fields,'bank_account'));
  assert.doesNotMatch(JSON.stringify(result),/0000-0001-2345|000000012345/);
});

test('projection preserves real Sheet row order across blanks and ignores spoofed ordinal fields',()=>{
  const h=harness({sheets:{V2_rooms:[['room_id','workspace_id','replica_source_row'],
    ['SYNTHETIC_Z','SYNTHETIC_W1',999],['','',''],['SYNTHETIC_A','SYNTHETIC_W1',0]]}});
  h.ctx.readReplicaMarkDirty_(['V2_rooms']);
  assert.equal(h.ctx.runV2ReadReplicaDirtySync().success,true);
  const rows=JSON.parse(h.sent[0].payload).rows;
  assert.deepEqual(rows.map(row=>[row.row_key,row.fields.replica_source_row]),[['SYNTHETIC_Z',2],['SYNTHETIC_A',4]]);
  const moved=h.ctx.readReplicaProjectRow_('V2_rooms',{room_id:'SYNTHETIC_Z',workspace_id:'SYNTHETIC_W1'},4,{roomBridgeSupported:true});
  assert.notEqual(moved.row_hash,rows[0].row_hash,'source order participates in synchronization integrity');
});

test('tenant list view is invalidated by its existing source mutations',()=>{
  const h=harness();
  for(const action of ['landlord_room_save','landlord_bills_generate','landlord_contract_paper_backfill']) {
    assert.ok(h.ctx.readReplicaSheetsForAction_(action).includes('V2_landlord_tenant_list_view'),action);
  }
  assert.ok(h.ctx.readReplicaSheetsForAction_('landlord_property_save').includes('V2_property_owners'));
});

test('Date cells retain type metadata while ISO-looking text remains text',()=>{
  const h=harness();
  const result=h.ctx.readReplicaProjectRow_('V2_bills',{bill_id:'SYNTHETIC_BILL',
    bill_month:new Date('2026-10-01T00:00:00+08:00'),due_date:'2026-09-30T16:00:00.000Z',replica_date_fields:'["bill_id"]'},2);
  assert.equal(result.fields.bill_month,'2026-09-30T16:00:00.000Z');
  assert.deepEqual(JSON.parse(result.fields.replica_date_fields),['bill_month']);
  assert.throws(()=>h.ctx.readReplicaProjectRow_('V2_bills',{bill_id:new Date()},2),/stable replica key/);
});

test('room snapshots derive bridge capability from the source schema rather than a row claim',()=>{
  for(const present of [false,true]) {
    const sheets={V2_rooms:[['room_id','replica_room_bridge_supported'],['SYNTHETIC_ROOM',!present]]};
    if(present) sheets.V3_listing_integrations=[['room_id']];
    const h=harness({sheets});h.ctx.readReplicaMarkDirty_(['V2_rooms']);h.ctx.runV2ReadReplicaDirtySync();
    assert.equal(JSON.parse(h.sent[0].payload).rows[0].fields.replica_room_bridge_supported,!present);
  }
});

test('idle or unconfigured triggers read no Sheet and send nothing',()=>{
  for(const h of [harness(),harness({configured:false})]) {
    h.ctx.runV2ReadReplicaDirtySync();
    assert.equal(h.reads,0); assert.equal(h.sent.length,0);
  }
});

test('idle trigger discovers all dirty markers in one cache service call',()=>{
  const h=harness();
  assert.equal(h.ctx.runV2ReadReplicaDirtySync().code,'IDLE');
  assert.equal(h.cacheBatchReads,1);
  assert.equal(h.cacheSingleReads,0);
  assert.equal(h.propertyReads,0,'idle has no configuration or credential read');
});

test('dirty snapshot filters private fields, batches 501 rows and signs exact UTF8 bytes',()=>{
  const rows=Array.from({length:501},(_,i)=>['R'+i,'W_SYNTHETIC','合成房間 '+i,'private-bank','private-document','private-token']);
  const h=harness({sheets:{V2_rooms:[['room_id','workspace_id','room_name','bank_account','identity_document_url','line_token'],...rows]}});
  h.ctx.readReplicaMarkDirty_(['V2_rooms']);
  const result=h.ctx.runV2ReadReplicaDirtySync();
  assert.equal(result.success,true); assert.equal(h.reads,1); assert.equal(h.sent.length,2);
  const payloads=h.sent.map(r=>JSON.parse(r.payload));
  assert.deepEqual(payloads.map(p=>p.rows.length),[500,1]);
  assert.equal(payloads[0].complete,false); assert.equal(payloads[1].complete,true);
  assert.equal(payloads[0].snapshot_id,payloads[1].snapshot_id);
  assert.equal(payloads[0].row_count,501);
  for(const request of h.sent) {
    assert.equal(request.followRedirects,false);
    assert.equal(request.headers['X-CMWebs-Signature'],createHmac('sha256','synthetic-secret').update(request.headers['X-CMWebs-Timestamp']+'\n'+request.headers['X-CMWebs-Nonce']+'\n'+request.payload).digest('hex'));
    assert.doesNotMatch(request.payload,/private-bank|private-document|private-token/);
  }
  assert.equal([...h.cache.keys()].filter(k=>k.startsWith('cmwebs:read-replica:dirty:')).length,0);
  assert.doesNotMatch(h.logs.join('\n'),/R0|合成房間|synthetic-secret/);
});

test('failed and concurrently changed dirty generations remain queued',()=>{
  const h=harness({fail:true,sheets:{V2_rooms:[['room_id'],['R1']]}});
  h.ctx.readReplicaMarkDirty_(['V2_rooms']);
  assert.equal(h.ctx.runV2ReadReplicaDirtySync().success,false);
  assert.ok(h.cache.get('cmwebs:read-replica:dirty:V2_rooms'));
  const h2=harness({sheets:{V2_rooms:[['room_id'],['R1']]}});
  h2.ctx.readReplicaMarkDirty_(['V2_rooms']);
  const fetch=h2.ctx.UrlFetchApp.fetch;
  h2.ctx.UrlFetchApp.fetch=(...args)=>{h2.ctx.readReplicaMarkDirty_(['V2_rooms']);return fetch(...args);};
  h2.ctx.runV2ReadReplicaDirtySync();
  assert.ok(h2.cache.get('cmwebs:read-replica:dirty:V2_rooms'));
});

test('missing sheets and duplicate stable keys never send a deleting snapshot',()=>{
  for(const sheets of [{},{V2_rooms:[['room_id'],['R1'],['R1']]}]) {
    const h=harness({sheets}); h.ctx.readReplicaMarkDirty_(['V2_rooms']);
    assert.equal(h.ctx.runV2ReadReplicaDirtySync().success,false);
    assert.equal(h.sent.length,0);
  }
});

test('immediate revocation projects and patches only the revoked session',()=>{
  const h=harness();
  assert.equal(h.ctx.readReplicaPushRevokedSession_({session_id:'S_SYNTHETIC',session_token_hash:'hashed-synthetic',status:'revoked',revoked_at:new Date().toISOString(),raw_token:'private-token'}).success,true);
  assert.equal(h.reads,0); assert.equal(h.sent.length,1);
  const batch=JSON.parse(h.sent[0].payload);
  assert.equal(batch.mode,'patch'); assert.equal(batch.sheet,'V2_landlord_email_sessions');
  assert.equal(batch.rows.length,1); assert.equal(batch.rows[0].fields.status,'revoked');
  assert.doesNotMatch(h.sent[0].payload,/private-token|raw_token/);
});

test('dispatcher observes successful writes across JSON, JSONP and bridge; ignores reads and failures',()=>{
  const h=harness();
  for(const output of [
    {getContent:()=>JSON.stringify({success:true})},
    {getContent:()=> 'cb('+JSON.stringify({success:true})+');'},
    {getContent:()=> '<script>window.top.postMessage('+JSON.stringify({source:'CMWEBS_APPS_SCRIPT',payload:{success:true}})+", '*');</script>"}
  ]) {
    h.cache.clear(); h.ctx.readReplicaAfterResponse_('landlord_room_save',output);
    assert.ok(h.cache.get('cmwebs:read-replica:dirty:V2_rooms'));
  }
  h.cache.clear();
  h.ctx.readReplicaAfterResponse_('landlord_room_center_init',{success:true});
  h.ctx.readReplicaAfterResponse_('landlord_room_save',{success:false});
  assert.equal(h.cache.size,0);
});

test('real GET/POST dispatcher wrappers preserve responses and mark successful JSON/form writes',()=>{
  const h=harness();
  vm.runInContext(readFileSync(new URL('../apps-script/程式碼.js',import.meta.url),'utf8'),h.ctx);
  const result={getContent:()=>JSON.stringify({success:true})};
  h.ctx.dispatchV2Get_=()=>result; h.ctx.dispatchV2Post_=()=>result;
  assert.equal(h.ctx.doGet({parameter:{v2_action:'landlord_room_save'}}),result);
  assert.ok(h.cache.get('cmwebs:read-replica:dirty:V2_rooms'));
  for(const body of [JSON.stringify({action:'landlord_payment_report_confirm'}),'action=landlord_payment_report_confirm']) {
    h.cache.clear(); assert.equal(h.ctx.doPost({postData:{contents:body}}),result);
    assert.ok(h.cache.get('cmwebs:read-replica:dirty:V2_bills'));
  }
});

test('real Email revoke writes local status before immediate patch and reports pending synchronization',()=>{
  for(const fail of [false,true]) {
    const h=harness({fail});
    vm.runInContext(readFileSync(new URL('../apps-script/V2_LANDLORD_EMAIL_AUTH.js',import.meta.url),'utf8'),h.ctx);
    const session={session_id:'S_SYNTHETIC',session_token_hash:'hashed-synthetic',status:'active'};
    const writes=[];
    h.ctx.landlordEmailAuthResolveSession_=()=>({success:true,data:{session}});
    h.ctx.landlordEmailAuthSessionSheet_=()=>({});
    h.ctx.landlordEmailAuthUpdateRow_=(_,__,changes)=>writes.push(changes);
    h.ctx.landlordEmailAuthNowIso_=()=>new Date().toISOString();
    const result=h.ctx.revokeLandlordEmailSession_('synthetic-opaque','synthetic-request');
    assert.equal(writes[0].status,'revoked'); assert.equal(h.sent.length,1);
    assert.equal(JSON.parse(h.sent[0].payload).rows[0].fields.status,'revoked');
    assert.equal(result.success,!fail);
    if(fail) {assert.equal(result.code,'READ_REPLICA_REVOCATION_PENDING');assert.ok(h.cache.get('cmwebs:read-replica:dirty:V2_landlord_email_sessions'));}
  }
});

test('affected Apps Script projection test function executes without private fields',()=>{
  assert.equal(harness().ctx.testReadReplicaProjection().success,true);
});
