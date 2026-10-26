import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
import vm from 'node:vm';

const schemaSource=readFileSync(new URL('../apps-script/V2_READ_REPLICA_SCHEMA.js',import.meta.url),'utf8');
const moduleSource=()=>readFileSync(new URL('../apps-script/V2_READ_REPLICA_SYNC.js',import.meta.url),'utf8');
const tableCount=Object.keys(JSON.parse(readFileSync(new URL('../cloudflare/read-api/schema.json',import.meta.url),'utf8'))).length;
function harness({configured=true,fail=false,sheets={}}={}) {
  const cache=new Map(), sent=[], heartbeats=[], logs=[]; let reads=0, cacheSingleReads=0, cacheBatchReads=0, propertyReads=0, blobReads=0;
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
      newBlob:text=>({getBytes:()=>{blobReads++;return [...Buffer.from(text)];}})},
    SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:name=>sheets[name] ? {getDataRange:()=>({getValues:()=>{reads++; return sheets[name];}})} : null})},
    UrlFetchApp:{fetch:(url,options)=>{
      if(url.endsWith('/sync/heartbeat')){heartbeats.push({url,...options});return {getResponseCode:()=>fail?503:200,getContentText:()=>'{"success":true}'};}
      sent.push({url,...options}); return {getResponseCode:()=>fail?503:200,getContentText:()=>JSON.stringify({success:!fail,data:{completed:JSON.parse(options.payload).complete}})};}},
    Logger:{log:value=>logs.push(value)}
  });
  vm.runInContext(schemaSource+'\n'+moduleSource(),ctx);
  return {ctx,cache,sent,heartbeats,logs,get reads(){return reads;},get cacheSingleReads(){return cacheSingleReads;},get cacheBatchReads(){return cacheBatchReads;},get propertyReads(){return propertyReads;},get blobReads(){return blobReads;}};
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

test('idle or unconfigured triggers read no Sheet and send no rows',()=>{
  for(const h of [harness(),harness({configured:false})]) {
    h.ctx.runV2ReadReplicaDirtySync();
    assert.equal(h.reads,0); assert.equal(h.sent.length,0);
  }
  const unconfigured=harness({configured:false});
  unconfigured.ctx.runV2ReadReplicaDirtySync();
  assert.equal(unconfigured.heartbeats.length,0);
});

test('idle trigger discovers all dirty markers in one cache service call and reports clean',()=>{
  const h=harness(),before=Date.now();
  assert.equal(h.ctx.runV2ReadReplicaDirtySync().code,'IDLE');
  assert.equal(h.cacheBatchReads,1);
  assert.equal(h.cacheSingleReads,0);
  assert.equal(h.heartbeats.length,1);
  const [beat]=h.heartbeats,body=JSON.parse(beat.payload);
  assert.deepEqual(Object.keys(body),['clean_version']);
  assert.ok(body.clean_version>=before&&body.clean_version<=Date.now());
  assert.equal(beat.followRedirects,false);
  assert.equal(beat.headers['X-CMWebs-Signature'],createHmac('sha256','synthetic-secret').update(beat.headers['X-CMWebs-Timestamp']+'\n'+beat.headers['X-CMWebs-Nonce']+'\n'+beat.payload).digest('hex'));
});

test('a drained dirty run reports clean; a failed run does not',()=>{
  const ok=harness({sheets:{V2_rooms:[['room_id'],['SYNTHETIC_ROOM']]}});
  ok.ctx.readReplicaMarkDirty_(['V2_rooms']);
  assert.equal(ok.ctx.runV2ReadReplicaDirtySync().code,'OK');
  assert.equal(ok.heartbeats.length,1);
  const failed=harness({fail:true,sheets:{V2_rooms:[['room_id'],['SYNTHETIC_ROOM']]}});
  failed.ctx.readReplicaMarkDirty_(['V2_rooms']);
  assert.equal(failed.ctx.runV2ReadReplicaDirtySync().code,'SYNC_PENDING');
  assert.equal(failed.heartbeats.length,0);
  const full=harness({sheets:{V2_rooms:[['room_id'],['SYNTHETIC_ROOM']]}});
  full.ctx.runV2ReadReplicaFullSync();
  assert.equal(full.heartbeats.length,0,'full reconciliation does not observe dirty markers');
});

test('dirty snapshot filters private fields, batches 501 rows and signs exact UTF8 bytes',()=>{
  const rows=Array.from({length:501},(_,i)=>['R'+i,'W_SYNTHETIC','合成房間 '+i,'private-bank','private-document','private-token']);
  const h=harness({sheets:{V2_rooms:[['room_id','workspace_id','room_name','bank_account','identity_document_url','line_token'],...rows]}});
  h.ctx.readReplicaMarkDirty_(['V2_rooms']);
  const result=h.ctx.runV2ReadReplicaDirtySync();
  assert.equal(result.success,true); assert.equal(h.reads,1); assert.equal(h.sent.length,2);
  assert.equal(h.blobReads,0,'501-row batching must size serialized UTF-8 without per-row Blob calls');
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

test('serialized JSON byte sizing agrees with independent UTF-8 across Unicode and escaped malformed source strings',()=>{
  const h=harness();
  const samples=['','ascii','房租','é','e\u0301','😀','𝄞','🇹🇼','👩‍💻','\u0000\n\t"\\','\ud800','\udc00','\ud800\ud800\udc00'];
  for(let i=0;i<200;i++)samples.push(String.fromCharCode(i*313%65536)+String.fromCodePoint(0x10000+i*97));
  for(const value of samples){const serialized=JSON.stringify({value});assert.equal(h.ctx.readReplicaUtf8Length_(serialized),Buffer.byteLength(serialized,'utf8'));}
  assert.equal(h.blobReads,0);
  assert.throws(()=>h.ctx.readReplicaUtf8Length_('\ud800'),/surrogate/i);assert.throws(()=>h.ctx.readReplicaUtf8Length_('\udc00'),/surrogate/i);
});

function rowOfBytes(h,key,bytes){
  const source={room_id:key,room_name:''},row=h.ctx.readReplicaProjectRow_('V2_rooms',source),remaining=bytes-Buffer.byteLength(JSON.stringify(row));
  assert(remaining>=0);source.room_name='房😀'.repeat(Math.floor(remaining/7))+'a'.repeat(remaining%7);const result=h.ctx.readReplicaProjectRow_('V2_rooms',source);assert.equal(Buffer.byteLength(JSON.stringify(result)),bytes);return result;
}
test('UTF-8 byte boundary retains exact 900000 batch sizing and complete signed payloads',()=>{
  for(const [bytes,expected] of [[449999,[2]],[450000,[1,1]]]){
    const h=harness(),rows=[rowOfBytes(h,'R1',bytes),rowOfBytes(h,'R2',bytes)],start=Date.now();h.ctx.readReplicaSendRows_(h.ctx.readReplicaConfig_(),'V2_rooms',rows,'snapshot',start,start+30000);
    assert.deepEqual(h.sent.map(v=>JSON.parse(v.payload).rows.length),expected);assert.equal(h.blobReads,0);
    for(const request of h.sent){assert(Buffer.byteLength(request.payload)<=1048576);assert.equal(request.headers['X-CMWebs-Signature'],createHmac('sha256','synthetic-secret').update(request.headers['X-CMWebs-Timestamp']+'\n'+request.headers['X-CMWebs-Nonce']+'\n'+request.payload).digest('hex'));}
    assert.equal(JSON.parse(h.sent.at(-1).payload).complete,true);
  }
});
test('maximum UTF-8 row is accepted and one extra byte fails before outbound IO',()=>{
  const h=harness(),start=Date.now();h.ctx.readReplicaSendRows_(h.ctx.readReplicaConfig_(),'V2_rooms',[rowOfBytes(h,'R1',899999)],'snapshot',start,start+30000);assert.equal(h.sent.length,1);const bad=harness();assert.throws(()=>bad.ctx.readReplicaSendRows_(bad.ctx.readReplicaConfig_(),'V2_rooms',[rowOfBytes(bad,'R1',900000)],'snapshot',start,start+30000),/row too large/);assert.equal(bad.sent.length,0);assert.equal(bad.blobReads,0);
});
test('actual module UTF-8 comparison function uses only fixed JSON samples and bounded native oracle calls',()=>{
  const h=harness(),r=h.ctx.testReadReplicaUtf8BatchSizing();assert.equal(r.success,true);assert.equal(r.samples,13);assert.equal(h.blobReads,13);assert.equal(h.sent.length,0);assert.equal(h.reads,0);assert.equal(h.propertyReads,0);assert.equal(h.cacheBatchReads,0);
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

test('dirty sync stops reading subsequent Sheets when a send consumes the four-minute deadline',()=>{
  const h=harness({sheets:{V2_rooms:[['room_id'],['R1']],V2_properties:[['property_id'],['P1']]}});
  let clock=1000000;
  h.ctx.Date={now:()=>clock};
  h.ctx.readReplicaMarkDirty_(['V2_rooms','V2_properties']);
  const pending=[...h.cache.keys()];
  const fetch=h.ctx.UrlFetchApp.fetch;
  h.ctx.UrlFetchApp.fetch=(...args)=>{const response=fetch(...args);clock+=240000;return response;};
  const result=h.ctx.runV2ReadReplicaDirtySync();
  assert.equal(h.reads,1,'expired run must not load and hash another Sheet');
  assert.equal(h.sent.length,1);
  assert.equal(result.success,false);
  assert.equal(result.code,'SYNC_PENDING');
  assert.equal(result.tables,1);
  assert.equal(result.failed_tables.length,1);
  const completed=JSON.parse(h.sent[0].payload).sheet;
  assert.equal(h.cache.has('cmwebs:read-replica:dirty:'+completed),false);
  for(const key of pending.filter(key=>key!=='cmwebs:read-replica:dirty:'+completed)) assert.ok(h.cache.has(key));
  assert.equal(h.cache.has('cmwebs:read-replica:lease'),false);
});

test('full sync queues every unattempted table after deadline without reading its Sheet',()=>{
  const schema=JSON.parse(readFileSync(new URL('../cloudflare/read-api/schema.json',import.meta.url),'utf8'));
  const sheets=Object.fromEntries(Object.entries(schema).map(([name,table])=>[name,[[table.key],['SYNTHETIC_'+name]]]));
  const h=harness({sheets});
  let clock=1000000;
  h.ctx.Date={now:()=>clock};
  const fetch=h.ctx.UrlFetchApp.fetch;
  h.ctx.UrlFetchApp.fetch=(...args)=>{const response=fetch(...args);clock+=240001;return response;};
  const result=h.ctx.runV2ReadReplicaFullSync();
  assert.equal(h.reads,1,'full reconciliation must not load remaining Sheets after expiry');
  assert.equal(h.sent.length,1);
  assert.equal(result.success,false);
  assert.equal(result.code,'SYNC_PENDING');
  assert.equal(result.tables,1);
  assert.deepEqual(Array.from(result.failed_tables),Object.keys(schema).slice(1));
  for(const name of result.failed_tables) assert.ok(h.cache.get('cmwebs:read-replica:dirty:'+name));
  assert.equal(h.cache.has('cmwebs:read-replica:lease'),false);
});

test('a missing sheet never sends a deleting snapshot',()=>{
  const h=harness({sheets:{}}); h.ctx.readReplicaMarkDirty_(['V2_rooms']);
  assert.equal(h.ctx.runV2ReadReplicaDirtySync().success,false);
  assert.equal(h.sent.length,0);
});

test('keyless and repeated-ID rows are kept and identified by Sheet row',()=>{
  const h=harness({sheets:{V2_payments:[['payment_id','amount'],['P1',100],['',200],['P1',300],['',400]]}});
  h.ctx.readReplicaMarkDirty_(['V2_payments']);
  assert.equal(h.ctx.runV2ReadReplicaDirtySync().success,true);
  const rows=JSON.parse(h.sent[0].payload).rows;
  assert.deepEqual(rows.map(row=>row.row_key),['P1','row:3','P1#row:4','row:5']);
  assert.deepEqual(rows.map(row=>row.fields.amount),[100,200,300,400]);
  assert.equal(rows[1].fields.payment_id,'');
  // Patches carry no Sheet row and still require a real ID.
  assert.throws(()=>h.ctx.readReplicaProjectRow_('V2_landlord_email_sessions',{session_id:'',status:'revoked'}),/stable replica key/);
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

test('trigger installer replaces replica triggers with a five-minute sync and a 03:00 Taipei reconciliation',()=>{
  const h=harness(),created=[],deleted=[];
  const existing=['runV2ReadReplicaDirtySync','runV2ReadReplicaFullSync','unrelatedReminder'].map(name=>({getHandlerFunction:()=>name}));
  function builder(handler) {
    const spec={handler};
    const chain={timeBased:()=>chain,everyMinutes:n=>{spec.everyMinutes=n;return chain;},atHour:n=>{spec.atHour=n;return chain;},
      everyDays:n=>{spec.everyDays=n;return chain;},inTimezone:zone=>{spec.timezone=zone;return chain;},create:()=>{created.push(spec);return {};}};
    return chain;
  }
  h.ctx.ScriptApp={getProjectTriggers:()=>existing,deleteTrigger:trigger=>deleted.push(trigger.getHandlerFunction()),newTrigger:builder};
  assert.equal(h.ctx.installV2ReadReplicaTriggers().success,true);
  assert.deepEqual(deleted,['runV2ReadReplicaDirtySync','runV2ReadReplicaFullSync']);
  assert.deepEqual(created,[{handler:'runV2ReadReplicaDirtySync',everyMinutes:5},
    {handler:'runV2ReadReplicaFullSync',atHour:3,everyDays:1,timezone:'Asia/Taipei'}]);
});
