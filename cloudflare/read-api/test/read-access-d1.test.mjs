import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID,createHmac } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare,convertV4MiniflareOptions } from 'miniflare';
import { richDataset,projectedDataset,fixture,originalGas,access,cases,plain } from '../../../tests/fixtures/read-parity/runtime.mjs';
import { authorityRuntime,authoritySecret } from '../../../tests/fixtures/read-parity/authority-runtime.mjs';
import { capacityDataset } from '../../../tests/fixtures/read-parity/capacity.mjs';

const paths={home:'/v1/home',actions:'/v1/home?section=actions&read_view=summary',revenue:'/v1/revenue?from_month=2026-09&to_month=2026-10&as_of=2026-10-12',tenants:'/v1/tenants?read_view=summary',rooms:'/v1/rooms?include_archived=1',arrears:'/v1/arrears',properties:'/v1/properties?include_archived=1'};
async function setup(input,identity={kind:'line',line_user_id:'SYNTHETIC_LINE1'}) {
  const output=await build({entryPoints:[new URL('./read-access-fixture-worker.js',import.meta.url).pathname],bundle:true,write:false,format:'esm',target:'es2022'});
  const authority=authorityRuntime();Object.assign(authority.data,structuredClone(input));
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:output.outputFiles[0].text,compatibilityDate:'2026-10-06',d1Databases:{DB:randomUUID()},
    outboundService:async request=>Response.json(authority.post(await request.json())),
    bindings:{FIXTURE_NOW:String(Date.parse(fixture.now)),FIXTURE_IDENTITY:JSON.stringify(identity),LINE_LOGIN_CHANNEL_ID:'SYNTHETIC_CHANNEL',EMAIL_SESSION_HMAC_SECRET:'synthetic-email-key',READ_REPLICA_SYNC_SECRET:authoritySecret,READ_AUTHORITY_URL:'https://script.google.com/macros/s/SYNTHETIC_DEPLOYMENT/exec'}}));
  let stage='database',seedStatements=0;
  try {
    const db=await mf.getD1Database('DB');
    stage='migration';
    for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(file=>file.endsWith('.sql')).sort()) {
      const sql=await readFile(new URL('../migrations/'+file,import.meta.url),'utf8');
      await db.batch(sql.replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
    }
    stage='projection';
    const schema=JSON.parse(await readFile(new URL('../schema.json',import.meta.url),'utf8')),data=projectedDataset(input),inserts=[];
    for(const [table,definition] of Object.entries(schema)) for(const row of data[table]) {
      inserts.push(db.prepare(`INSERT INTO "${table}" (row_key,row_hash,synced_at,${definition.fields.map(key=>'"'+key+'"').join(',')}) VALUES (${Array(definition.fields.length+3).fill('?').join(',')})`).bind(row[definition.key],'synthetic-hash',fixture.now,...definition.fields.map(key=>Object.hasOwn(row,key)?JSON.stringify(row[key]):null)));
    }
    stage='row_seed';seedStatements=inserts.length;
    // Projection/prepare/bind use synchronous Miniflare proxy calls. Let Node
    // observe workerd idle socket closures before dispatching the one seed RPC.
    await new Promise(setImmediate);
    await db.batch(inserts);
    stage='sync_markers';
    await db.batch(Object.keys(schema).map(table=>db.prepare("INSERT INTO sync_runs(snapshot_id,sheet,mode,source_version,batch_count,row_count,snapshot_hash,status,started_at,completed_at) VALUES (?,?,'snapshot',?,1,0,'synthetic','completed',?,?)").bind(randomUUID(),table,Date.parse(fixture.now),fixture.now,fixture.now)));
    return {mf,db,schema,authority};
  } catch(error) {
    // Fixed enums/counts only. Never emit messages, SQL/rows, addresses, URLs
    // or arbitrary cause properties. Diagnostics cannot mask cleanup/failure.
    const diagnostic={stage,seed_statements:seedStatements,error_kind:'OTHER',cause_kind:'NONE',
      cause_code:'NONE',socket_bytes_read:null,socket_bytes_written:null,cause_inspection:'AVAILABLE'};
    try {
      const kinds=new Set(['Error','TypeError','RangeError','AggregateError','SocketError','HeadersTimeoutError','BodyTimeoutError','ConnectTimeoutError']);
      const codes=new Set(['UND_ERR_SOCKET','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_CONNECT_TIMEOUT','ECONNRESET','ECONNREFUSED','EPIPE']);
      const kind=value=>kinds.has(value)?value:'OTHER';
      const bytes=value=>Number.isSafeInteger(value)&&value>=0?value:null;
      diagnostic.error_kind=kind(error?.name);
      const cause=error?.cause;
      if(cause){
        diagnostic.cause_kind=kind(cause.name);
        const code=cause.code;diagnostic.cause_code=codes.has(code)?code:'OTHER';
        diagnostic.socket_bytes_read=bytes(cause.socket?.bytesRead);
        diagnostic.socket_bytes_written=bytes(cause.socket?.bytesWritten);
      }
    } catch {diagnostic.cause_inspection='UNAVAILABLE';}
    try {console.log('C6_D1_FIXTURE_FAILURE '+JSON.stringify(diagnostic));}catch{}
    // A rejected seed occurs before the caller receives mf. Release it here
    // so the failed test remains visible without leaving workerd alive.
    try {await mf.dispose();}
    catch(cleanup) {throw new AggregateError([error,cleanup],'Read fixture setup and cleanup failed',{cause:error});}
    throw error;
  }
}
test('server-resolved D1 scope preserves all six canonical route results',async()=>{
  const input=richDataset(),{mf}=await setup(input);
  try {
    const gas=originalGas(input);
    const inspected=await (await mf.dispatchFetch('https://local.test/inspect')).json();
    assert.equal(inspected.access.workspace.workspace_id,access.workspace.workspace_id,JSON.stringify(inspected));
    for(const item of cases) {
      const response=await mf.dispatchFetch('https://local.test'+paths[item.route]);
      assert.equal(response.status,200,item.route+': '+JSON.stringify(await response.clone().json()));
      assert.deepEqual(await response.json(),plain(gas[item.fn](...item.args)),item.route);
    }
  } finally {await mf.dispose();}
});
test('500 owned rooms preserve canonical HTTP reads through authenticated primary-D1 scope',async()=>{
  // Catches scope/relationship batching that truncates capacity rows or admits
  // foreign rows. LINE/Google authority transports and GAS service adapters
  // are synthetic; HTTP/identity/authority policy and D1 scope modules are real.
  const input=capacityDataset(),{mf,db,authority}=await setup(input);
  try {
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM V2_rooms').first()).n,501);
    const inspection=await (await mf.dispatchFetch('https://local.test/inspect')).json();
    assert.equal(inspection.dataset.V2_rooms.length,500);
    assert.equal(inspection.dataset.V2_properties.length,20);
    assert.equal(inspection.dataset.V2_tenants.length,250);
    assert.equal(inspection.dataset.V2_bills.length,500);
    for(const [table,rows] of Object.entries(inspection.dataset)) {
      assert.ok(!rows.some(row=>row.workspace_id==='SYNTHETIC_W2'),table+' excludes foreign Workspace');
    }
    const gas=originalGas(input),observed={};
    for(const item of cases) {
      const response=await mf.dispatchFetch('https://local.test/http'+paths[item.route],{
        headers:{authorization:'LIFF synthetic-valid-line-token',origin:'https://cmwebssaas-sudo.github.io'}
      });
      assert.equal(response.status,200,item.route+' authenticated status');
      assert.equal(response.headers.get('cache-control'),'no-store');
      const raw=await response.text(),actual=JSON.parse(raw),expected=plain(gas[item.fn](...item.args));
      assert.ok(JSON.stringify(actual)===JSON.stringify(expected),item.route+' canonical JSON at scoped capacity');
      assert.doesNotMatch(raw,/SYNTHETIC_PX|SYNTHETIC_RX|SYNTHETIC_PRIVATE_/);
      observed[item.route]=actual.data;
    }
    assert.equal(observed.home.home.room_count,500);
    assert.equal(observed.home.home.tenant_count,250);
    assert.equal(observed.rooms.rooms.length,500);
    assert.equal(observed.tenants.tenants.length,250);
    assert.equal(observed.properties.properties.length,20);
    assert.equal(observed.properties.summary.occupied_room_count,250);
    assert.equal(observed.properties.summary.vacant_room_count,250);
    assert.equal(observed.revenue.kpis.receivable,3948000);
    assert.equal(observed.revenue.kpis.collected,1932000);
    assert.equal(observed.revenue.kpis.outstanding,2016000);
    assert.equal(observed.arrears.arrears.length,252);
    // An authority-only change denies the next request while primary D1 still
    // contains the previously active membership; no replication patch is sent.
    const member=authority.data.V2_workspace_members.find(row=>row.membership_id===access.membership.membership_id);
    member.member_status='suspended';
    const denied=await mf.dispatchFetch('https://local.test/http/v1/rooms?include_archived=1',{
      headers:{authorization:'LIFF synthetic-valid-line-token',origin:'https://cmwebssaas-sudo.github.io'}
    });
    assert.equal(denied.status,401);
    assert.doesNotMatch(await denied.text(),/SYNTHETIC_500_|synthetic-valid-line-token|stack/);
  }finally{await mf.dispose();}
});
test('fixture preparation starvation cannot reuse an expired D1 client socket',async()=>{
  const input=capacityDataset(),room=input.V2_rooms[0],workspace=room.workspace_id;
  let reads=0;
  // First read is setup's structuredClone before Miniflare exists; the second
  // is projection after the last async migration. Model synchronous preparation
  // starving Node beyond workerd's idle socket lifetime, without changing data.
  Object.defineProperty(room,'workspace_id',{enumerable:true,configurable:true,get(){
    if(++reads===2)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,6500);
    return workspace;
  }});
  const {mf,db}=await setup(input);
  try{
    assert.ok(reads>=2,'Starvation must occur after clone');
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM V2_rooms').first()).n,501);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM V2_tenants').first()).n,250);
  }finally{await mf.dispose();}
});
test('explicit foreign Workspace never enters D1 dataset through shared landlord/property identifiers',async()=>{
  const input=richDataset();
  const schema=JSON.parse(await readFile(new URL('../schema.json',import.meta.url),'utf8'));
  for(const [table,definition] of Object.entries(schema)) {
    if(!definition.fields.includes('workspace_id')||['V2_workspaces','V2_workspace_members','V2_landlord_email_sessions'].includes(table)) continue;
    const row=input[table]?.[0];if(!row) continue;
    input[table].push({...row,[definition.key]:'FOREIGN_'+table,workspace_id:'SYNTHETIC_FOREIGN'});
  }
  const {mf,db}=await setup(input);
  try {
    const inspected=await (await mf.dispatchFetch('https://local.test/inspect')).json();
    assert.ok(inspected.dataset,JSON.stringify(inspected));
    for(const [table,rows] of Object.entries(inspected.dataset)) {
      assert.ok(!rows.some(row=>row.workspace_id==='SYNTHETIC_FOREIGN'),table);
      assert.ok(!rows.some(row=>String(row[schema[table].key]).startsWith('FOREIGN_')),table);
    }
    // Current membership is read from primary D1 every time; no access cache.
    await db.prepare('UPDATE V2_workspace_members SET member_status = ? WHERE row_key = ?').bind(JSON.stringify('suspended'),access.membership.membership_id).run();
    const denied=await (await mf.dispatchFetch('https://local.test/inspect')).json();
    assert.equal(denied.code,'WORKSPACE_REQUIRED');
  } finally {await mf.dispose();}
});

test('authenticated HTTP verifies LINE/Email and rereads revocation, role and disabled states in primary D1',async()=>{
  const input=richDataset(),secret='synthetic-email-key',token='synthetic-email-token';
  Object.assign(input.V2_users[0],{email:'synthetic@example.invalid',email_verified_at:'2026-10-01',email_login_enabled:true});
  input.V2_landlord_email_sessions=[{session_id:'SYNTHETIC_SESSION',session_token_hash:createHmac('sha256',secret).update('session:'+token).digest('hex'),user_id:access.user.user_id,workspace_id:access.workspace.workspace_id,role:'owner',status:'active',issued_at:'2026-10-12T00:00:00Z',expires_at:'2026-10-13T00:00:00Z',revoked_at:''}];
  const {mf,db,authority,schema}=await setup(input);
  const headers=authorization=>({authorization,origin:'https://cmwebssaas-sudo.github.io'});
  const get=(authorization,path='/v1/arrears')=>mf.dispatchFetch('https://local.test/http'+path,{headers:headers(authorization)});
  async function update(table,field,key,value){await db.prepare(`UPDATE "${table}" SET "${field}" = ? WHERE row_key = ?`).bind(JSON.stringify(value),key).run();authority.data[table].find(row=>row[schema[table].key]===key)[field]=value;}
  try {
    for(const credential of ['LIFF synthetic-valid-line-token','Session '+token]) {
      const response=await get(credential);assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
      assert.equal(response.headers.get('access-control-allow-origin'),'https://cmwebssaas-sudo.github.io');
      assert.equal(response.headers.get('cache-control'),'no-store');
      const currentAccess={...access,user:input.V2_users[0]};
      assert.deepEqual(await response.json(),plain(originalGas(input,currentAccess).getWorkspaceLandlordArrearsNativeByLineUid_('SYNTHETIC_LINE1')));
    }
    for(const credential of ['LIFF synthetic-forged','Session synthetic-other-token','Bearer synthetic-token']) assert.equal((await get(credential)).status,401);
    for(const query of ['?workspace_id=SYNTHETIC_W2','?line_uid=SYNTHETIC_OTHER','?section=home&section=actions']) {
      assert.equal((await get('LIFF synthetic-valid-line-token','/v1/home'+query)).status,400);
    }
    const foreignOrigin=await mf.dispatchFetch('https://local.test/http/v1/arrears',{headers:{authorization:'LIFF synthetic-valid-line-token',origin:'https://foreign.invalid'}});
    assert.equal(foreignOrigin.status,403);assert.equal(foreignOrigin.headers.get('access-control-allow-origin'),null);
    const preflight=await mf.dispatchFetch('https://local.test/http/v1/arrears',{method:'OPTIONS',headers:{origin:'https://cmwebssaas-sudo.github.io','access-control-request-method':'GET','access-control-request-headers':'authorization'}});
    assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-methods'),'GET');
    await update('V2_landlord_email_sessions','status','SYNTHETIC_SESSION','revoked');
    assert.equal((await get('Session '+token)).status,401);
    await update('V2_landlord_email_sessions','status','SYNTHETIC_SESSION','active');
    await update('V2_workspace_members','role',access.membership.membership_id,'viewer');
    assert.equal((await get('Session '+token)).status,403);
    assert.equal((await get('LIFF synthetic-valid-line-token')).status,200);
    await update('V2_workspace_members','role',access.membership.membership_id,'tenant');
    assert.equal((await get('LIFF synthetic-valid-line-token')).status,403);
    await update('V2_workspace_members','role',access.membership.membership_id,'owner');
    for(const [table,key] of [['V2_users',access.user.user_id],['V2_workspaces',access.workspace.workspace_id]]) {
      await update(table,'account_status',key,'disabled');
      const denied=await get('LIFF synthetic-valid-line-token');assert.equal(denied.status,403);
      assert.doesNotMatch(await denied.text(),/synthetic-valid-line-token|synthetic-email-key|stack|SYNTHETIC_U1/);
      await update(table,'account_status',key,'active');
    }
    // These changes happen only in authoritative GAS; no D1 patch is sent.
    for(const [row,field,value] of [[authority.data.V2_landlord_email_sessions[0],'status','revoked'],
      [authority.data.V2_users[0],'account_status','disabled'],
      [authority.data.V2_workspace_members[0],'member_status','suspended'],
      [authority.data.V2_workspaces[0],'account_status','disabled']]) {
      const previous=row[field];row[field]=value;
      assert.equal((await get('Session '+token)).status,401);
      row[field]=previous;
    }
    for(const [row,field,value,status] of [
      [authority.data.V2_users[0],'account_status','disabled',401],
      [authority.data.V2_workspace_members[0],'member_status','suspended',401],
      [authority.data.V2_workspaces[0],'account_status','disabled',401],
      [authority.data.V2_workspace_members[0],'role','tenant',401],
      [authority.data.V2_workspace_members[0],'role','viewer',503]
    ]) {
      const previous=row[field];row[field]=value;
      const denied=await get('LIFF synthetic-valid-line-token');
      assert.equal(denied.status,status);
      if(status===503) assert.equal((await denied.json()).code,'READ_AUTH_STATE_CHANGED');
      row[field]=previous;
      assert.equal((await get('LIFF synthetic-valid-line-token')).status,200);
    }
    authority.cache.set('cmwebs:read-replica:dirty:V2_rooms','synthetic-generation');
    const pending=await get('LIFF synthetic-valid-line-token');
    assert.equal(pending.status,503);assert.equal((await pending.json()).code,'READ_SYNC_PENDING');
    authority.cache.delete('cmwebs:read-replica:dirty:V2_rooms');
    await db.prepare("INSERT INTO sync_runs(snapshot_id,sheet,mode,source_version,batch_count,row_count,snapshot_hash,status,started_at) VALUES ('synthetic-pending','V2_rooms','snapshot',?,2,0,'synthetic','receiving',?)").bind(Date.parse(fixture.now)+1,fixture.now).run();
    const incomplete=await get('LIFF synthetic-valid-line-token');
    assert.equal(incomplete.status,503);assert.equal((await incomplete.json()).code,'READ_SYNC_INCOMPLETE');
    await db.prepare("DELETE FROM sync_runs WHERE snapshot_id='synthetic-pending'").run();
    await db.prepare('UPDATE sync_runs SET completed_at=?').bind(new Date(Date.parse(fixture.now)-26*3600000-1).toISOString()).run();
    const stale=await get('LIFF synthetic-valid-line-token');
    assert.equal(stale.status,503);assert.equal((await stale.json()).code,'READ_SYNC_STALE');
  } finally {await mf.dispose();}
});

test('delegated manager preserves the canonical owner, masking, permissions and all route projections',async()=>{
  const input=richDataset();
  const user={...input.V2_users[0],user_id:'SYNTHETIC_MANAGER',line_user_id:'SYNTHETIC_MANAGER_LINE',name:'合成管理員'};
  const member={...input.V2_workspace_members[0],membership_id:'SYNTHETIC_MANAGER_MEMBER',user_id:user.user_id,role:'manager',is_primary:false,can_edit_bank_account:false,can_manage_team:false};
  input.V2_users.push(user);input.V2_workspace_members.push(member);
  const oracle=originalGas(input),ss=oracle.runtimeSpreadsheet_();
  const context=oracle.workspaceResolveContextByLineUid_(ss,user.line_user_id);
  const principals=plain(oracle.workspaceLandlordResolvePrincipals_(ss,context));
  const currentAccess={...access,user,membership:member,principals,principal:principals[0],line_user_id:user.line_user_id,delegated:true,permissions:plain(oracle.workspaceBuildPermissionView_(member))};
  const gas=originalGas(input,currentAccess),{mf}=await setup(input,{kind:'line',line_user_id:user.line_user_id});
  try {
    const inspected=await (await mf.dispatchFetch('https://local.test/inspect')).json();
    assert.equal(inspected.access.user.user_id,user.user_id);
    assert.equal(inspected.access.membership.user_id,user.user_id);
    assert.equal(inspected.access.delegated,true);
    for(const item of cases) {
      const args=[user.line_user_id,...item.args.slice(1)];
      const response=await mf.dispatchFetch('https://local.test'+paths[item.route]);
      assert.equal(response.status,200,item.route+': '+JSON.stringify(await response.clone().json()));
      assert.deepEqual(await response.json(),plain(gas[item.fn](...args)),item.route);
    }
  } finally {await mf.dispose();}
});

test('Email D1 lookup rejects two owners sharing one LINE alias in either source order',async()=>{
  for(const aliasFirst of [true,false]) {
    const input=richDataset(),actor=input.V2_users[0],member=input.V2_workspace_members[0];
    Object.assign(actor,{email:'synthetic@example.invalid',email_verified_at:'2026-10-01',email_login_enabled:true});
    const alias={...actor,user_id:'SYNTHETIC_ALIAS_USER'};
    const aliasMember={...member,membership_id:'SYNTHETIC_ALIAS_MEMBER',user_id:alias.user_id,can_edit_bank_account:true};
    input.V2_users[aliasFirst?'unshift':'push'](alias);
    input.V2_workspace_members[aliasFirst?'unshift':'push'](aliasMember);
    const {mf}=await setup(input,{kind:'email',user_id:actor.user_id,session:{workspace_id:access.workspace.workspace_id,role:'owner'}});
    try {const response=await mf.dispatchFetch('https://local.test/inspect');assert.equal(response.status,503);assert.equal((await response.json()).code,'AUTH_REQUIRED');}
    finally {await mf.dispose();}
  }
});

test('delegated legacy scope rejects a blank-Workspace child anchored to a declared foreign parent',async()=>{
  const input=richDataset();
  const user={...input.V2_users[0],user_id:'SYNTHETIC_MANAGER',line_user_id:'SYNTHETIC_MANAGER_LINE'};
  const member={...input.V2_workspace_members[0],membership_id:'SYNTHETIC_MANAGER_MEMBER',user_id:user.user_id,role:'manager',is_primary:false};
  input.V2_users.push(user);input.V2_workspace_members.push(member);
  const legacy={...input.V2_landlords[0],landlord_id:'SYNTHETIC_L2'};
  input.V2_landlords.push(legacy);
  Object.assign(legacy,{workspace_id:'',user_id:input.V2_users[0].user_id});
  const room=input.V2_rooms.find(row=>row.room_id==='SYNTHETIC_RX');room.workspace_id='';
  const bill=input.V2_bills.find(row=>row.bill_id==='SYNTHETIC_BX');bill.workspace_id='';
  input.V2_contracts.push({contract_id:'SYNTHETIC_FOREIGN_PARENT_CONTRACT',workspace_id:'',landlord_id:'SYNTHETIC_L2',property_id:'SYNTHETIC_PX',room_id:room.room_id,contract_status:'active'});
  const oracle=originalGas(input),ss=oracle.runtimeSpreadsheet_(),context=oracle.workspaceResolveContextByLineUid_(ss,user.line_user_id);
  const principals=plain(oracle.workspaceLandlordResolvePrincipals_(ss,context));
  assert.ok(principals.some(row=>row.landlord_id==='SYNTHETIC_L2'),'exercise inferred legacy owner relationship');
  const currentAccess={...access,user,membership:member,principals,principal:principals[0],line_user_id:user.line_user_id,delegated:true,permissions:plain(oracle.workspaceBuildPermissionView_(member))};
  const gas=originalGas(input,currentAccess),{mf}=await setup(input,{kind:'line',line_user_id:user.line_user_id});
  try {
    const inspected=await (await mf.dispatchFetch('https://local.test/inspect')).json();
    assert.ok(inspected.dataset,JSON.stringify(inspected));
    assert.ok(!inspected.dataset.V2_rooms.some(row=>row.room_id===room.room_id));
    assert.ok(!inspected.dataset.V2_bills.some(row=>row.bill_id===bill.bill_id));
    assert.ok(!inspected.dataset.V2_contracts.some(row=>row.contract_id==='SYNTHETIC_FOREIGN_PARENT_CONTRACT'));
    for(const item of cases) {
      const response=await mf.dispatchFetch('https://local.test'+paths[item.route]);
      assert.equal(response.status,200,item.route);
      assert.deepEqual(await response.json(),plain(gas[item.fn](user.line_user_id,...item.args.slice(1))),item.route);
    }
  } finally {await mf.dispose();}
});
