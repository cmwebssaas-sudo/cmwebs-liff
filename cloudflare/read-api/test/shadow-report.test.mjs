import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile,readdir } from 'node:fs/promises';
import { randomUUID,createHmac } from 'node:crypto';
import vm from 'node:vm';
import { build } from 'esbuild';
import { Miniflare,convertV4MiniflareOptions } from 'miniflare';
import { richDataset,projectedDataset,fixture,access,originalGas } from '../../../tests/fixtures/read-parity/runtime.mjs';
import { authorityRuntime,authoritySecret } from '../../../tests/fixtures/read-parity/authority-runtime.mjs';
import { shadowExportQueries } from '../src/shadow-export.js';
import { evaluateShadowWindows } from '../src/shadow-windows.js';
import { evaluateAcceleratedShadow } from '../../../scripts/read-accelerated-shadow.mjs';

const release=JSON.parse(await readFile(new URL('../read-comparison-manifest.json',import.meta.url),'utf8')).comparison_version,
  token='synthetic-email-token';
const body={route:'tenants',variant:'default',release,outcome:'compared',paths:['data.summary.total_amount','data.tenants[].tenant_name'],clock_paths:[],headers_ms:90,elapsed_ms:100};
async function setup({shadowRelease=release,beforeMigration,shadowStartedAt=new Date(Date.parse(fixture.now)-3600000).toISOString()}={}) {
  const input=richDataset();Object.assign(input.V2_users[0],{email_verified_at:'2026-10-01',email_login_enabled:true,email:'synthetic@example.invalid'});
  input.V2_landlord_email_sessions=[{session_id:'SYNTHETIC_SESSION',session_token_hash:createHmac('sha256','synthetic-email-key').update('session:'+token).digest('hex'),
    user_id:access.user.user_id,workspace_id:access.workspace.workspace_id,role:'owner',status:'active',expires_at:new Date(Date.parse(fixture.now)+3600000).toISOString()}];
  const authority=authorityRuntime();Object.assign(authority.data,structuredClone(input));
  const output=await build({entryPoints:[new URL('./read-access-fixture-worker.js',import.meta.url).pathname],bundle:true,write:false,format:'esm',target:'es2022'});
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:output.outputFiles[0].text,compatibilityDate:'2026-10-06',d1Databases:{DB:randomUUID()},
    outboundService:async request=>Response.json(authority.post(await request.json())),
    bindings:{FIXTURE_NOW:String(Date.parse(fixture.now)),READ_SHADOW_EPOCH:'synthetic-epoch',READ_SHADOW_RELEASE:shadowRelease,
      READ_SHADOW_STARTED_AT:shadowStartedAt,
      LINE_LOGIN_CHANNEL_ID:'SYNTHETIC_CHANNEL',EMAIL_SESSION_HMAC_SECRET:'synthetic-email-key',READ_REPLICA_SYNC_SECRET:authoritySecret,
      READ_AUTHORITY_URL:'https://script.google.com/macros/s/SYNTHETIC_DEPLOYMENT/exec'}}));
  const db=await mf.getD1Database('DB');
  for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(file=>file.endsWith('.sql')).sort()) {
    if(beforeMigration) await beforeMigration(db,file);
    const sql=await readFile(new URL('../migrations/'+file,import.meta.url),'utf8');
    await db.batch(sql.replace(/^--.*$/gm,'').split(';').map(sql=>sql.trim()).filter(Boolean).map(sql=>db.prepare(sql)));
  }
  const schema=JSON.parse(await readFile(new URL('../schema.json',import.meta.url),'utf8')),data=projectedDataset(input),inserts=[];
  for(const [table,definition] of Object.entries(schema)) for(const row of data[table]) inserts.push(db.prepare(`INSERT INTO "${table}"(row_key,row_hash,synced_at,${definition.fields.map(key=>'"'+key+'"').join(',')}) VALUES(${Array(definition.fields.length+3).fill('?').join(',')})`)
    .bind(row[definition.key],'synthetic',fixture.now,...definition.fields.map(key=>Object.hasOwn(row,key)?JSON.stringify(row[key]):null)));
  await db.batch(inserts);
  await db.batch(Object.keys(schema).map(table=>db.prepare("INSERT INTO sync_runs(snapshot_id,sheet,mode,source_version,batch_count,row_count,snapshot_hash,status,started_at,completed_at) VALUES (?,?,'snapshot',?,1,0,'synthetic','completed',?,?)").bind(randomUUID(),table,Date.parse(fixture.now),fixture.now,fixture.now)));
  const post=async(value=body,credential='Session '+token,options={})=>{
    if(value.outcome==='compared'&&value.receipt===undefined) {
      const read=await mf.dispatchFetch('https://local.test/http/v1/tenants?read_view=summary',{headers:{authorization:credential,'x-cmwebs-read-mode':'shadow'}});
      value={...value,receipt:read.headers.get('x-cmwebs-shadow-receipt')};
    }
    return mf.dispatchFetch('https://local.test/http/v1/shadow-report',{
    method:'POST',headers:{authorization:credential,'content-type':'application/json',origin:'https://cmwebssaas-sudo.github.io'},body:JSON.stringify(value),...options});
  };
  return {mf,db,post,authority,input};
}
test('actual LINE/Email report HTTP stores only redacted metadata atomically and enforces current source authority',async()=>{
  const {mf,db,post,authority}=await setup();
  try {
    for(const credential of ['Session '+token,'LIFF synthetic-valid-line-token']) {
      const response=await post(body,credential);assert.equal(response.status,200,await response.clone().text());
      assert.equal(response.headers.get('access-control-allow-origin'),'https://cmwebssaas-sudo.github.io');
    }
    const rows=(await db.prepare('SELECT * FROM shadow_reports').all()).results;
    assert.equal(rows.length,2);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM shadow_diffs').first()).n,4);
    const attempts=(await db.prepare('SELECT * FROM shadow_attempts ORDER BY rowid').all()).results;
    assert.deepEqual(attempts.map(row=>row.auth_kind),['email','line']);
    await assert.rejects(db.prepare("UPDATE shadow_attempts SET auth_kind='forged'").run());
    for(const row of rows){assert.match(row.scope_hash,/^[a-f0-9]{64}$/);assert.match(row.actor_hash,/^[a-f0-9]{64}$/);}
    assert.doesNotMatch(JSON.stringify(rows),/SYNTHETIC_U1|SYNTHETIC_W1|synthetic-email-token|synthetic-email-key|tenant_name/);
    const exported=await db.batch(shadowExportQueries(db,{scope:rows[0].scope_hash,epoch:'synthetic-epoch',release,startedAt:new Date(Date.parse(fixture.now)-3600000).toISOString(),now:Date.parse(fixture.now)+1000}));
    assert.equal(exported[0].results[0].compared,2);assert.equal(exported[0].results[0].diffs,4);
    assert.equal(exported[1].results.length,2);assert.equal(exported[2].results.length,2);
    assert.deepEqual(exported[1].results.map(row=>row.auth_kind).sort(),['email','line']);
    for(const sample of exported[1].results){assert.equal(sample.observed_at,new Date(fixture.now).toISOString());assert.match(sample.receipt,/^[a-f0-9-]{36}$/);}
    assert.equal(new Set(exported[1].results.map(row=>row.receipt)).size,2);
    assert.equal(exported[3].results[0].attempts,2);assert.equal(exported[3].results[0].matched,2);
    assert.doesNotMatch(JSON.stringify(exported.map(result=>result.results)),/scope_hash|actor_hash|SYNTHETIC/);
    for(const patch of [{workspace_id:'other'},{auth_kind:'line'},{values:[1234]},{paths:['data.person@example.invalid']},{release:'old'}]) assert.equal((await post({...body,...patch})).status,400);
    assert.equal((await post({...body,paths:['x'.repeat(13000)]})).status,400);
    assert.equal((await post({...body,values:'x'.repeat(25000)})).status,400);
    const claimed=await mf.dispatchFetch('https://local.test/http/v1/tenants?read_view=summary',{headers:{authorization:'Session '+token,'x-cmwebs-read-mode':'shadow','x-cmwebs-auth-kind':'line'}});
    assert.equal(claimed.status,200);assert.equal((await db.prepare('SELECT auth_kind FROM shadow_attempts WHERE attempt_id=?').bind(claimed.headers.get('x-cmwebs-shadow-receipt')).first()).auth_kind,'email');
    assert.equal((await post({...body,receipt:randomUUID()},'Session forged')).status,401);
    authority.data.V2_landlord_email_sessions[0].status='revoked';assert.equal((await post({...body,receipt:randomUUID()})).status,401);
    authority.data.V2_landlord_email_sessions[0].status='active';
    authority.data.V2_users[0].account_status='disabled';assert.equal((await post({...body,receipt:randomUUID()},'LIFF synthetic-valid-line-token')).status,401);
    authority.data.V2_users[0].account_status='active';
    authority.cache.set('cmwebs:read-replica:dirty:V2_rooms','pending');
    assert.equal((await post({...body,receipt:randomUUID()})).status,503);
    assert.equal((await post({...body,outcome:'worker_error',receipt:null,paths:[],headers_ms:null,elapsed_ms:null})).status,200);
    const failed=(await db.prepare("SELECT * FROM shadow_reports WHERE outcome='worker_error'").all()).results;
    assert.equal(failed.length,1);assert.equal(failed[0].field_count,0);assert.equal(failed[0].elapsed_ms,null);
    const preflight=await mf.dispatchFetch('https://local.test/http/v1/shadow-report',{method:'OPTIONS',headers:{origin:'https://cmwebssaas-sudo.github.io','access-control-request-method':'POST','access-control-request-headers':'authorization,content-type'}});
    assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-methods'),'POST');
    assert.equal((await post(body,undefined,{headers:{origin:'https://foreign.invalid'}})).status,403);
  } finally {await mf.dispose();}
});

test('failed or missing reads cannot claim zero comparison, receipts cannot replay or change route, and source failures are recorded',async()=>{
  const {mf,db,post,authority}=await setup();
  try {
    assert.equal((await post({...body,paths:[],receipt:randomUUID()})).status,409);
    await db.prepare("UPDATE V2_rooms SET replica_room_bridge_supported='false'").run();
    const denied=await mf.dispatchFetch('https://local.test/http/v1/rooms?include_archived=1',{headers:{authorization:'LIFF synthetic-valid-line-token','x-cmwebs-read-mode':'shadow'}});
    assert.equal(denied.status,503);const failedReceipt=denied.headers.get('x-cmwebs-shadow-receipt');assert.ok(failedReceipt);
    assert.equal((await post({...body,route:'rooms',paths:[],receipt:failedReceipt})).status,409);
    const read=await mf.dispatchFetch('https://local.test/http/v1/tenants?read_view=summary',{headers:{authorization:'Session '+token,'x-cmwebs-read-mode':'shadow'}});
    const receipt=read.headers.get('x-cmwebs-shadow-receipt');assert.equal(read.status,200);assert.ok(receipt);
    assert.equal((await post({...body,route:'home',variant:'actions',receipt})).status,409);
    assert.equal((await post({...body,receipt})).status,200);
    assert.equal((await post({...body,receipt})).status,409);
    authority.data.V2_workspace_members[0].role='viewer';
    const changed=await mf.dispatchFetch('https://local.test/http/v1/tenants?read_view=summary',{headers:{authorization:'LIFF synthetic-valid-line-token','x-cmwebs-read-mode':'shadow'}});
    assert.equal(changed.status,503);assert.ok(changed.headers.get('x-cmwebs-shadow-receipt'));
    const counts=await db.prepare("SELECT COUNT(*) AS n,SUM(status!=200) AS failed FROM shadow_attempts").first();assert.equal(counts.n,3);assert.equal(counts.failed,2);
    const bogus=await mf.dispatchFetch('https://local.test/http/v1/tenants?read_view=summary',{headers:{authorization:'Session forged','x-cmwebs-read-mode':'shadow'}});
    assert.equal(bogus.status,401);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM shadow_attempts').first()).n,3);
  } finally {await mf.dispose();}
});
test('rate limit is atomic under concurrent submissions and failed diff insert leaves no partial report',async()=>{
  const {mf,db,post}=await setup();
  try {
    assert.equal((await post()).status,200);
    const seed=await db.prepare('SELECT * FROM shadow_reports LIMIT 1').first();
    await db.batch(Array.from({length:118},()=>db.prepare('INSERT INTO shadow_reports SELECT ?,scope_hash,actor_hash,epoch,release_id,route,variant,outcome,headers_ms,elapsed_ms,field_count,observed_at,NULL,0 FROM shadow_reports WHERE report_id=?').bind(randomUUID(),seed.report_id)));
    // Establish two successful, distinct reads before racing the REPORT writes.
    // A failed prerequisite read must fail here, rather than being mistaken for
    // a rate-limit defect when its ineligible receipt correctly receives409.
    const receipts=[];
    for(let i=0;i<2;i++) {
      const read=await mf.dispatchFetch('https://local.test/http/v1/tenants?read_view=summary',{
        headers:{authorization:'Session '+token,'x-cmwebs-read-mode':'shadow'}});
      assert.equal(read.status,200,'rate-limit fixture prerequisite read must succeed');
      await read.arrayBuffer();
      const receipt=read.headers.get('x-cmwebs-shadow-receipt');assert.ok(receipt);
      const attempt=await db.prepare('SELECT status,report_id FROM shadow_attempts WHERE attempt_id=?').bind(receipt).first();
      assert.equal(attempt.status,200);assert.equal(attempt.report_id,null);receipts.push(receipt);
    }
    assert.equal(new Set(receipts).size,2);
    const responses=await Promise.all(receipts.map(receipt=>post({...body,receipt})));assert.deepEqual(responses.map(r=>r.status).sort(),[200,429]);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM shadow_reports').first()).n,120);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM shadow_diffs').first()).n,4);
    // Expire the synthetic rate window, then make the second insert fail.
    await db.prepare("UPDATE shadow_reports SET observed_at='2020-01-01T00:00:00.000Z'").run();
    await db.exec("CREATE TRIGGER reject_shadow_diff BEFORE INSERT ON shadow_diffs BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");
    assert.equal((await post()).status,503);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM shadow_reports').first()).n,120);
  } finally {await mf.dispose();}
});

test('actual D1 export retains post-week failures and uses read timestamps rather than delayed report timestamps',async()=>{
  const {mf,db,post}=await setup();
  try {
    assert.equal((await post()).status,200);
    const seed=await db.prepare('SELECT * FROM shadow_reports LIMIT 1').first();
    await db.exec('DELETE FROM shadow_diffs; DELETE FROM shadow_clock_diffs; DELETE FROM shadow_reports; DELETE FROM shadow_attempts;');
    const start=Date.parse(fixture.now)-7*86400000+500,startedAt=new Date(start).toISOString();
    const variants=[['home','home'],['home','actions'],...['revenue','tenants','rooms','arrears','properties'].map(route=>[route,'default'])];
    for(let window=0;window<7;window++) for(const [route,variant] of variants) {
      const attempt=randomUUID(),report=randomUUID(),readAt=new Date(start+window*86400000+1000).toISOString();
      await db.batch([
        db.prepare("INSERT INTO shadow_attempts(attempt_id,scope_hash,actor_hash,epoch,release_id,route,variant,outcome,status,observed_at,report_id) VALUES(?,?,?,?,?,?,?,'completed',200,?,?)").bind(attempt,seed.scope_hash,seed.actor_hash,seed.epoch,release,route,variant,readAt,report),
        db.prepare("INSERT INTO shadow_reports VALUES(?,?,?,?,?,?,?,'compared',10,20,0,?,?,0)").bind(report,seed.scope_hash,seed.actor_hash,seed.epoch,release,route,variant,new Date(Date.parse(readAt)+1000).toISOString(),attempt)
      ]);
    }
    const selection={scope:seed.scope_hash,epoch:seed.epoch,release,startedAt,now:start+7*86400000+1000};
    const exportNow=async selected=>{
      const result=await db.batch(shadowExportQueries(db,selected));
      return {started_at:startedAt,epoch:seed.epoch,release,rows:result[0].results,sample_rows:result[1].results,attempt_rows:result[3].results};
    };
    assert.equal(evaluateShadowWindows(await exportNow(selection),{now:selection.now,epoch:seed.epoch,release}).eligible,true);
    assert.ok((await exportNow(selection)).sample_rows.every(row=>row.auth_kind==='unknown'));
    await db.prepare("INSERT INTO shadow_attempts(attempt_id,scope_hash,actor_hash,epoch,release_id,route,variant,outcome,status,observed_at,report_id) VALUES(?,?,?,?,?,?,'default','completed',503,?,NULL)")
      .bind(randomUUID(),seed.scope_hash,seed.actor_hash,seed.epoch,release,'rooms',new Date(start+7*86400000+2000).toISOString()).run();
    selection.now=start+7*86400000+3000;
    const failed=await exportNow(selection);assert.ok(failed.attempt_rows.some(row=>row.window===7&&row.errors===1));
    assert.equal(evaluateShadowWindows(failed,{now:selection.now,epoch:seed.epoch,release}).eligible,false);
    // One millisecond before a rolling boundary must remain in window0, even
    // when its authenticated report arrives in the next window.
    const attempt=randomUUID(),report=randomUUID(),readAt=new Date(start+86400000-1).toISOString();
    await db.batch([
      db.prepare("INSERT INTO shadow_attempts(attempt_id,scope_hash,actor_hash,epoch,release_id,route,variant,outcome,status,observed_at,report_id) VALUES(?,?,?,?,?,?,'default','completed',200,?,?)").bind(attempt,seed.scope_hash,seed.actor_hash,seed.epoch,release,'tenants',readAt,report),
      db.prepare("INSERT INTO shadow_reports VALUES(?,?,?,?,?,?,'default','compared',10,20,0,?,?,0)").bind(report,seed.scope_hash,seed.actor_hash,seed.epoch,release,'tenants',new Date(start+86400000+1).toISOString(),attempt)
    ]);
    const boundary=await exportNow(selection);
    assert.equal(boundary.rows.find(row=>row.window===0&&row.route==='tenants').compared,2);
    assert.equal(boundary.rows.find(row=>row.window===1&&row.route==='tenants').compared,1);
  } finally {await mf.dispose();}
});

test('actual browser router completes a receipt-bound comparison without sending source values',async()=>{
  const {mf,db,input}=await setup();
  try {
    const gas=originalGas(input,{...access,user:input.V2_users[0],membership:input.V2_workspace_members[0],workspace:input.V2_workspaces[0]});
    // The real bridge/JSONP transport serializes native GAS Date values.
    const gasResult=JSON.parse(JSON.stringify(gas.getWorkspaceLandlordTenantsNativeByLineUid_('SYNTHETIC_LINE1','summary')));
    const store=new Map(),reports=[];let completeReport;
    const reported=new Promise(resolve=>{completeReport=resolve;});
    const context={URL,Date,Math,Promise,AbortController,setTimeout,clearTimeout,
      CMWEBS_READ_PATH:{tenants:'shadow'},CMWEBS_READ_API_URL:'https://local.test/http',CMWEBS_RELEASE_VERSION:'assets-before',CMWEBS_READ_COMPARISON_VERSION:release,
      localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)},
      CMWebsLandlordAuth:{getRequestAuthParams:()=>({response_mode:'bridge',landlord_session_token:token}),handleAuthFailure:()=>false,
        request:async()=>gasResult},
      fetch:async(url,options)=>{
        if(options.method==='POST') reports.push(JSON.parse(options.body));
        const response=await mf.dispatchFetch(url,options);
        if(options.method==='POST') completeReport(response.status);
        return response;
      }};
    context.window=context;vm.createContext(context);vm.runInContext(await readFile(new URL('../../../landlord-api.js',import.meta.url),'utf8'),context);
    assert.equal(await context.CMWebsLandlordApi.request({action:'landlord_tenants',params:{read_view:'summary'},maxAttempts:1}),gasResult);
    assert.equal(await reported,200);assert.equal(reports.length,1);
    assert.deepEqual(Array.from(reports[0].paths),[]);assert.ok(reports[0].receipt);
    assert.doesNotMatch(JSON.stringify(reports),/synthetic-email-token|SYNTHETIC_U1|SYNTHETIC_W1|0912345678|contract_content/);
    const attempt=await db.prepare('SELECT * FROM shadow_attempts').first();assert.ok(attempt.report_id);
    assert.equal((await db.prepare('SELECT * FROM shadow_reports').first()).field_count,0);
    // A real canonical calculation on the same input but a separate clock.
    const clockGas=originalGas(input,{...access,user:input.V2_users[0],membership:input.V2_workspace_members[0],workspace:input.V2_workspaces[0]},
      {now:Date.parse(fixture.now)+1000});
    const clockResult=JSON.parse(JSON.stringify(clockGas.getWorkspaceLandlordTenantsNativeByLineUid_('SYNTHETIC_LINE1','summary')));
    context.CMWEBS_RELEASE_VERSION='assets-after-rooms-on';
    context.CMWebsLandlordAuth.request=async()=>clockResult;
    const nextReported=new Promise(resolve=>{completeReport=resolve;});
    assert.equal(await context.CMWebsLandlordApi.request({action:'landlord_tenants',params:{read_view:'summary'},maxAttempts:1}),clockResult);
    assert.equal(await nextReported,200);
    assert.equal(reports[1].release,release);
    assert.deepEqual(Array.from(reports[1].paths),[]);assert.deepEqual(Array.from(reports[1].clock_paths),['data.landlord.updated_at']);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM shadow_diffs').first()).n,0);
    const clockRow=await db.prepare('SELECT * FROM shadow_clock_diffs').first();assert.equal(clockRow.field_path,'data.landlord.updated_at');
    assert.doesNotMatch(JSON.stringify(clockRow),/SYNTHETIC_U1|SYNTHETIC_W1|synthetic-email-token|0912345678/);
  } finally {await mf.dispose();}
});

test('a stale configured comparison identity closes shadow reads and reports without metadata writes',async()=>{
  const {mf,db,post}=await setup({shadowRelease:'read-stale-contract'});
  try {
    const response=await mf.dispatchFetch('https://local.test/http/v1/tenants?read_view=summary',
      {headers:{authorization:'Session '+token,'x-cmwebs-read-mode':'shadow'}});
    assert.equal(response.status,503);
    assert.equal((await post({...body,receipt:'00000000-0000-4000-8000-000000000001'})).status,503);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM shadow_attempts').first()).n,0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM shadow_reports').first()).n,0);
  } finally {await mf.dispose();}
});

test('auth-kind migration preserves existing attempts as unknown without rewriting their evidence',async()=>{
  const attempt=randomUUID(),scope='a'.repeat(64),actor='b'.repeat(64);let observedOldSchema=false;
  const {mf,db}=await setup({beforeMigration:async(db,file)=>{
    if(file!=='0006_shadow_auth_kind.sql')return;
    const columns=(await db.prepare('PRAGMA table_info(shadow_attempts)').all()).results;
    assert.equal(columns.some(row=>row.name==='auth_kind'),false);observedOldSchema=true;
    await db.prepare("INSERT INTO shadow_attempts VALUES(?,?,?,?,?,?,'default','completed',200,?,NULL)").bind(attempt,scope,actor,'legacy-epoch',release,'rooms',new Date(fixture.now).toISOString()).run();
  }});
  try{assert.equal(observedOldSchema,true);const row=await db.prepare('SELECT * FROM shadow_attempts WHERE attempt_id=?').bind(attempt).first();assert.equal(row.auth_kind,'unknown');assert.equal(row.scope_hash,scope);assert.equal(row.actor_hash,actor);assert.equal(row.outcome,'completed');assert.equal(row.status,200);assert.equal(row.observed_at,new Date(fixture.now).toISOString());assert.equal(row.report_id,null);}finally{await mf.dispose();}
});

test('actual D1 sample export feeds only a local accelerated candidate and unknown channels deny',async()=>{
 const start=Date.parse(fixture.now)-86400000,startedAt=new Date(start).toISOString();
 const {mf,db,post}=await setup({shadowStartedAt:startedAt});
 try{
  assert.equal((await post()).status,200);const seed=await db.prepare('SELECT * FROM shadow_reports LIMIT 1').first();
  for(let i=0;i<20;i++){
   const attempt=randomUUID(),reportId=randomUUID(),readAt=new Date(start+(1+(i%3)*8)*3600000+i*1000).toISOString();
   await db.batch([
    db.prepare("INSERT INTO shadow_attempts(attempt_id,scope_hash,actor_hash,epoch,release_id,route,variant,outcome,status,observed_at,report_id,auth_kind) VALUES(?,?,?,?,?,'rooms','default','completed',200,?,?,?)").bind(attempt,seed.scope_hash,seed.actor_hash,seed.epoch,release,readAt,reportId,i<10?'line':'email'),
    db.prepare("INSERT INTO shadow_reports VALUES(?,?,?,?,?,'rooms','default','compared',100,200,0,?,?,0)").bind(reportId,seed.scope_hash,seed.actor_hash,seed.epoch,release,new Date(Date.parse(readAt)+1000).toISOString(),attempt)
   ]);
  }
  const selection={scope:seed.scope_hash,epoch:seed.epoch,release,startedAt,now:Date.parse(fixture.now)+1000};
  const read=async()=>{const q=await db.batch(shadowExportQueries(db,selection));return evaluateAcceleratedShadow({started_at:startedAt,exported_at:new Date(selection.now).toISOString(),epoch:seed.epoch,release,rows:q[0].results,sample_rows:q[1].results,attempt_rows:q[3].results},{now:selection.now,epoch:seed.epoch,release,page:'rooms'});};
  const r=await read();assert.equal(r.shadowEligible,true);assert.equal(r.cutoverAuthorized,false);assert.deepEqual(r.samples,{total:20,line:10,email:10,periods:3});assert.ok(r.excludedIssueGroups.some(g=>g.route==='tenants'));
  await db.prepare("UPDATE shadow_attempts SET auth_kind='unknown' WHERE attempt_id=(SELECT attempt_id FROM shadow_attempts WHERE route='rooms' LIMIT 1)").run();assert.equal((await read()).shadowEligible,false);
 }finally{await mf.dispose();}
});
