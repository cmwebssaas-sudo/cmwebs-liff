import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const secret = 'synthetic-sync-secret-only';
const canonical = value => JSON.stringify(value, Object.keys(value).sort());
const hash = value => createHash('sha256').update(value).digest('hex');
const row = (key, name = key) => {
  const fields = { room_id: key, room_name: name, workspace_id: 'W_SYNTHETIC' };
  return { row_key: key, row_hash: hash(canonical(fields)), fields };
};
function snapshot(rows, overrides = {}) {
  return { sheet: 'V2_rooms', rows, mode: 'snapshot', snapshot_id: randomUUID(),
    source_version: Date.now(), batch_index: 0, batch_count: 1, row_count: rows.length,
    snapshot_hash: hash(JSON.stringify(rows.map(r => [r.row_key, r.row_hash]).sort((a, b) => a[0].localeCompare(b[0])))),
    complete: true, ...overrides };
}
async function fixture(run, configured = true) {
  // Bundle imports using Wrangler's production bundler, then execute actual workerd.
  const script = await readFile(new URL('../.wrangler/dry-run/index.js', import.meta.url), 'utf8');
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script,
    compatibilityDate: '2026-10-06', d1Databases: { DB: randomUUID() },
    bindings: configured ? { READ_REPLICA_SYNC_SECRET: secret } : {} }));
  try {
    const db = await mf.getD1Database('DB');
    for(const file of ['0001_read_replica.sql','0002_read_projection.sql','0003_read_projection.sql','0005_read_scope_indexes.sql']) {
      const migration = await readFile(new URL('../migrations/'+file, import.meta.url), 'utf8');
      await db.batch(migration.replace(/^--.*$/gm,'').split(';').map(s => s.trim()).filter(Boolean).map(s => db.prepare(s)));
    }
    const send = async (payload, options = {}) => {
      const body = JSON.stringify(payload);
      const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
      const nonce = options.nonce || randomUUID();
      const signature = options.signature ?? createHmac('sha256', secret).update(timestamp+'\n'+nonce+'\n'+body).digest('hex');
      return mf.dispatchFetch('https://local.test/sync', { method: 'POST', body,
        headers: { 'content-type': 'application/json', 'X-CMWebs-Timestamp': timestamp,
          'X-CMWebs-Nonce': nonce, 'X-CMWebs-Signature': signature } });
    };
    await run(db, send);
  } finally { await mf.dispose(); }
}

test('signed snapshots update only changed rows and delete only after a complete manifest', async () => {
  await fixture(async (db, send) => {
    assert.equal((await send(snapshot([row('R1'), row('R2')]))).status, 200);
    const first = await db.prepare('SELECT row_hash,synced_at FROM V2_rooms WHERE row_key=?').bind('R1').first();
    assert.equal((await send(snapshot([row('R1'), row('R2')], { source_version: Date.now()+1 }))).status, 200);
    assert.deepEqual(await db.prepare('SELECT row_hash,synced_at FROM V2_rooms WHERE row_key=?').bind('R1').first(), first);
    const rows = [row('R1','changed'),row('R3')];
    const full = snapshot(rows, { batch_count: 2, source_version: Date.now()+2 });
    assert.equal((await send({ ...full, rows: [rows[0]], complete: false })).status, 200);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM V2_rooms').first()).count, 2);
    assert.equal((await db.prepare('SELECT room_name FROM V2_rooms WHERE row_key=?').bind('R1').first()).room_name, JSON.stringify('R1'));
    assert.equal((await send({ ...full, rows: [rows[1]], batch_index: 1 })).status, 200);
    const stored = (await db.prepare('SELECT row_key,room_name FROM V2_rooms ORDER BY row_key').all()).results;
    assert.deepEqual(stored, [{row_key:'R1',room_name:JSON.stringify('changed')},{row_key:'R3',room_name:JSON.stringify('R3')}]);
  });
});

test('bad signatures, expired timestamps and nonce replay never alter replica rows', async () => {
  await fixture(async (db, send) => {
    const payload = snapshot([row('R1')]);
    assert.equal((await send(payload, { signature: '0'.repeat(64) })).status, 401);
    assert.equal((await send(payload, { timestamp: Math.floor(Date.now()/1000)-301 })).status, 401);
    const nonce = randomUUID();
    assert.equal((await send(payload, { nonce })).status, 200);
    assert.equal((await send(snapshot([]), { nonce })).status, 409);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM V2_rooms').first()).count, 1);
  });
});

test('whitelist, row integrity and 500-row bound fail before any sync state write', async () => {
  await fixture(async (db, send) => {
    for (const payload of [snapshot([], { sheet:'V2_unapproved_accounts' }),
      snapshot([{...row('R1'), fields:{...row('R1').fields,bank_account:'synthetic'}}]),
      snapshot([{...row('R1'),row_hash:'0'.repeat(64)}]),
      snapshot(Array.from({length:501},(_,i)=>row('R'+i))),
      snapshot([row('R1'),row('R1')])]) {
      assert.equal((await send(payload)).status, 400);
    }
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM sync_runs').first()).count, 0);
  });
});

test('bank suffix projection rejects unmasked values before any state write',async()=>{
  await fixture(async(db,send)=>{
    const fields={payment_account_id:'SYNTHETIC_ACCOUNT',bank_account_last5:'000000012345'};
    const row={row_key:fields.payment_account_id,row_hash:hash(canonical(fields)),fields};
    assert.equal((await send(snapshot([row],{sheet:'V2_payment_accounts'}))).status,400);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM sync_runs').first()).count,0);
    fields.bank_account_last5='•••• 12345';row.row_hash=hash(canonical(fields));
    assert.equal((await send(snapshot([row],{sheet:'V2_payment_accounts'}))).status,200);
    assert.equal((await db.prepare('SELECT bank_account_last5 FROM V2_payment_accounts').first()).bank_account_last5,'"•••• 12345"');
  });
});

test('Date type metadata and room dependency capabilities are validated before storage writes',async()=>{
  await fixture(async(db,send)=>{
    const date='2026-09-30T16:00:00.000Z';
    for(const metadata of ['not JSON','{}','["bank_account"]','["room_id"]','["replica_source_row"]','["created_at","created_at"]']) {
      const fields={room_id:'SYNTHETIC_DATE_ROOM',created_at:date,replica_date_fields:metadata};
      assert.equal((await send(snapshot([{row_key:fields.room_id,row_hash:hash(canonical(fields)),fields}]))).status,400);
    }
    const fields={room_id:'SYNTHETIC_DATE_ROOM',created_at:date,replica_date_fields:'["created_at"]',replica_room_bridge_supported:'true'};
    assert.equal((await send(snapshot([{row_key:fields.room_id,row_hash:hash(canonical(fields)),fields}]))).status,400);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM sync_runs').first()).count,0);
    fields.replica_room_bridge_supported=true;
    assert.equal((await send(snapshot([{row_key:fields.room_id,row_hash:hash(canonical(fields)),fields}]))).status,200);
    const stored=await db.prepare('SELECT created_at,replica_date_fields,replica_room_bridge_supported FROM V2_rooms').first();
    assert.deepEqual(stored,{created_at:JSON.stringify(date),replica_date_fields:'"[\\"created_at\\"]"',replica_room_bridge_supported:'true'});
  });
});

test('missing batches, altered manifests and older snapshots cannot delete newer rows', async () => {
  await fixture(async (db, send) => {
    const version = Date.now();
    assert.equal((await send(snapshot([row('R1')],{source_version:version}))).status, 200);
    const incomplete = snapshot([row('R2')],{batch_count:2,source_version:version+1});
    assert.equal((await send({...incomplete,batch_index:1})).status, 409);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM V2_rooms').first()).count, 1);
    assert.equal((await send(snapshot([],{source_version:version-1}))).status, 409);
    assert.equal((await db.prepare('SELECT row_key FROM V2_rooms').first()).row_key,'R1');
  });
});

test('an immediate session patch cannot delete unrelated sessions', async () => {
  await fixture(async (db, send) => {
    const sessionRow = (key,status) => { const fields={session_id:key,session_token_hash:hash(key),status}; return {row_key:key,row_hash:hash(canonical(fields)),fields}; };
    const rows=[sessionRow('S1','active'),sessionRow('S2','active')];
    assert.equal((await send(snapshot(rows,{sheet:'V2_landlord_email_sessions'}))).status,200);
    const changed=[sessionRow('S1','revoked')];
    assert.equal((await send(snapshot(changed,{sheet:'V2_landlord_email_sessions',mode:'patch',source_version:Date.now()+1}))).status,200);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM V2_landlord_email_sessions').first()).count,2);
    assert.equal((await db.prepare('SELECT status FROM V2_landlord_email_sessions WHERE row_key=?').bind('S1').first()).status,JSON.stringify('revoked'));
  });
});

test('unconfigured synchronization is disabled', async () => {
  await fixture(async (_, send) => assert.equal((await send(snapshot([]))).status,503),false);
});

test('500 rows are accepted and scalar JSON types survive D1 storage', async () => {
  await fixture(async (db, send) => {
    const rows=Array.from({length:500},(_,i)=>row('R'+String(i).padStart(3,'0')));
    rows[0].fields={...rows[0].fields,account_status:true,rent_amount:0,note:null};
    rows[0].row_hash=hash(canonical(rows[0].fields));
    assert.equal((await send(snapshot(rows))).status,200);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM V2_rooms').first()).count,500);
    const stored=await db.prepare('SELECT account_status,rent_amount,note,management_fee FROM V2_rooms WHERE row_key=?').bind('R000').first();
    assert.deepEqual(stored,{account_status:'true',rent_amount:'0',note:'null',management_fee:null});
  });
});

test('changed manifest, cross-batch duplicate and oversized body fail without deleting replica rows', async () => {
  await fixture(async (db,send)=>{
    const base=snapshot([row('R1')]); assert.equal((await send(base)).status,200);
    const two=snapshot([row('R2'),row('R3')],{batch_count:2,source_version:Date.now()+1});
    assert.equal((await send({...two,rows:[row('R2')],complete:false})).status,200);
    assert.equal((await send({...two,rows:[row('R3')],batch_index:1,snapshot_hash:'0'.repeat(64)})).status,409);
    assert.equal((await send({...two,rows:[row('R2')],batch_index:1})).status,409);
    const big=row('R4','x'.repeat(1024*1024));
    assert.equal((await send(snapshot([big]))).status,413);
    assert.equal((await db.prepare('SELECT row_key FROM V2_rooms').first()).row_key,'R1');
  });
});
