import tables from '../schema.json' with { type: 'json' };

const encoder = new TextEncoder();
const maxBytes = 1024 * 1024;
const hex = bytes => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
export const canonicalFields = fields => JSON.stringify(Object.fromEntries(Object.keys(fields).sort().map(k => [k, fields[k]])));
export async function sha256(value) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
function failure(code, status) { return Response.json({ success:false, code, message:'Read replica synchronization failed', data:null }, { status, headers:{'cache-control':'no-store'} }); }
function stop(code, status = 400) { throw Object.assign(new Error(code), { code, status }); }
async function boundedBody(request) {
  if (!request.body) stop('INVALID_BATCH');
  const reader = request.body.getReader();
  const parts = []; let size = 0;
  try {
    while (true) {
      const {done,value} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); stop('BATCH_TOO_LARGE',413); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(size); let offset = 0;
  for (const part of parts) { buffer.set(part,offset); offset += part.length; }
  return new TextDecoder('utf-8',{fatal:true}).decode(buffer);
}
async function verifySignature(request, body, secret) {
  const timestamp = request.headers.get('X-CMWebs-Timestamp') || '';
  const nonce = request.headers.get('X-CMWebs-Nonce') || '';
  const signature = request.headers.get('X-CMWebs-Signature') || '';
  if (!/^\d{10}$/.test(timestamp) || Math.abs(Date.now()/1000-Number(timestamp)) > 300 ||
      !/^[A-Za-z0-9_-]{16,128}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) stop('SYNC_AUTH_REQUIRED',401);
  const key = await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const bytes = Uint8Array.from(signature.match(/../g),part => parseInt(part,16));
  if (!await crypto.subtle.verify('HMAC',key,bytes,encoder.encode(timestamp+'\n'+nonce+'\n'+body))) stop('SYNC_AUTH_REQUIRED',401);
  return nonce;
}
async function validateBatch(batch) {
  if (!batch || typeof batch !== 'object' || !Object.hasOwn(tables,batch.sheet)) stop('INVALID_BATCH');
  const table = tables[batch.sheet];
  const allowed = ['sheet','rows','mode','snapshot_id','source_version','batch_index','batch_count','row_count','snapshot_hash','complete'];
  if (Object.keys(batch).some(k=>!allowed.includes(k)) || !Array.isArray(batch.rows) || batch.rows.length > 500 ||
      !['snapshot','patch'].includes(batch.mode) || (batch.mode==='patch' && batch.sheet!=='V2_landlord_email_sessions') ||
      !/^[A-Za-z0-9_-]{16,128}$/.test(batch.snapshot_id || '') || typeof batch.complete !== 'boolean' ||
      !Number.isSafeInteger(batch.source_version) || batch.source_version < 1 || batch.source_version > Date.now()+300000 ||
      !Number.isInteger(batch.batch_count) || batch.batch_count < 1 || batch.batch_count > 10000 ||
      !Number.isInteger(batch.batch_index) || batch.batch_index < 0 || batch.batch_index >= batch.batch_count ||
      !Number.isInteger(batch.row_count) || batch.row_count < batch.rows.length || batch.row_count > batch.batch_count*500 ||
      !/^[a-f0-9]{64}$/.test(batch.snapshot_hash || '') ||
      (batch.complete && batch.batch_index !== batch.batch_count-1) ||
      (batch.mode==='patch' && (batch.batch_count!==1 || !batch.complete))) stop('INVALID_BATCH');
  const seen = new Set();
  for (const row of batch.rows) {
    if (!row || Object.keys(row).some(k=>!['row_key','row_hash','fields'].includes(k)) ||
        typeof row.row_key !== 'string' || !row.row_key.trim() || row.row_key.length > 256 || seen.has(row.row_key) ||
        !row.fields || typeof row.fields !== 'object' || Array.isArray(row.fields) ||
        String(row.fields[table.key] ?? '').trim() !== row.row_key ||
        Object.entries(row.fields).some(([key,value])=>!table.fields.includes(key) ||
          !(['string','number','boolean'].includes(typeof value) || value === null) ||
          (typeof value === 'number' && !Number.isFinite(value))) ||
        row.row_hash !== await sha256(canonicalFields(row.fields))) stop('INVALID_BATCH');
    seen.add(row.row_key);
  }
  return table;
}
export async function sync(request, env) {
  if (request.method !== 'POST') return failure('METHOD_NOT_ALLOWED',405);
  if (!env.READ_REPLICA_SYNC_SECRET || !env.DB) return failure('SYNC_NOT_CONFIGURED',503);
  let db;
  try {
    const body = await boundedBody(request);
    const nonce = await verifySignature(request,body,env.READ_REPLICA_SYNC_SECRET);
    let batch; try { batch=JSON.parse(body); } catch { stop('INVALID_BATCH'); }
    const table = await validateBatch(batch);
    db = env.DB.withSession ? env.DB.withSession('first-primary') : env.DB;
    const now = new Date().toISOString();
    const existing = await db.prepare('SELECT * FROM sync_runs WHERE snapshot_id=?').bind(batch.snapshot_id).first();
    if (existing && ['sheet','mode','source_version','batch_count','row_count','snapshot_hash'].some(key=>existing[key]!==batch[key])) stop('MANIFEST_CONFLICT',409);
    const newer = await db.prepare("SELECT snapshot_id FROM sync_runs WHERE sheet=? AND status='completed' AND source_version>=? AND snapshot_id<>? LIMIT 1").bind(batch.sheet,batch.source_version,batch.snapshot_id).first();
    if (newer) stop('STALE_SNAPSHOT',409);
    const batchHash = await sha256(JSON.stringify(batch.rows));
    const previousBatch = await db.prepare('SELECT batch_hash FROM sync_batches WHERE snapshot_id=? AND batch_index=?').bind(batch.snapshot_id,batch.batch_index).first();
    if (previousBatch && previousBatch.batch_hash !== batchHash) stop('BATCH_CONFLICT',409);
    const statements = [db.prepare('DELETE FROM sync_nonces WHERE expires_at<=?').bind(Date.now()),
      db.prepare('INSERT INTO sync_nonces(nonce,expires_at) VALUES (?,?)').bind(nonce,Date.now()+600000),
      db.prepare(`INSERT INTO sync_runs(snapshot_id,sheet,mode,source_version,batch_count,row_count,snapshot_hash,status,started_at)
        VALUES (?,?,?,?,?,?,?,'receiving',?) ON CONFLICT(snapshot_id) DO UPDATE SET snapshot_hash=CASE
          WHEN sync_runs.sheet=excluded.sheet AND sync_runs.mode=excluded.mode
            AND sync_runs.source_version=excluded.source_version AND sync_runs.batch_count=excluded.batch_count
            AND sync_runs.row_count=excluded.row_count AND sync_runs.snapshot_hash=excluded.snapshot_hash
          THEN sync_runs.snapshot_hash ELSE NULL END`).bind(batch.snapshot_id,batch.sheet,batch.mode,batch.source_version,batch.batch_count,batch.row_count,batch.snapshot_hash,now)];
    if (!previousBatch && existing?.status !== 'completed') {
      statements.push(db.prepare('INSERT INTO sync_batches(snapshot_id,batch_index,batch_hash) VALUES (?,?,?)').bind(batch.snapshot_id,batch.batch_index,batchHash));
      for (const row of batch.rows) statements.push(db.prepare('INSERT INTO sync_staging(snapshot_id,row_key,row_hash,fields) VALUES (?,?,?,?)').bind(batch.snapshot_id,row.row_key,row.row_hash,canonicalFields(row.fields)));
    }
    try { await db.batch(statements); }
    catch {
      if (await db.prepare('SELECT nonce FROM sync_nonces WHERE nonce=?').bind(nonce).first()) stop('NONCE_REPLAY',409);
      stop('SYNC_STATE_CONFLICT',409);
    }
    let completed = existing?.status === 'completed';
    if (batch.complete && !completed) {
      const count = await db.prepare('SELECT COUNT(*) AS count FROM sync_batches WHERE snapshot_id=?').bind(batch.snapshot_id).first();
      const rows = (await db.prepare('SELECT row_key,row_hash FROM sync_staging WHERE snapshot_id=? ORDER BY row_key').bind(batch.snapshot_id).all()).results;
      if (count.count !== batch.batch_count || rows.length !== batch.row_count ||
          await sha256(JSON.stringify(rows.map(row=>[row.row_key,row.row_hash]))) !== batch.snapshot_hash) stop('INCOMPLETE_SNAPSHOT',409);
      // Keep all final writes in a single transaction. The SQL guard rechecks
      // committed versions to prevent a slower older invocation overwriting a new one.
      const ready = `SELECT 1 FROM sync_runs AS current WHERE current.snapshot_id=? AND current.status='receiving'
        AND NOT EXISTS (SELECT 1 FROM sync_runs AS newer WHERE newer.sheet=current.sheet
          AND newer.status='completed' AND newer.source_version>=current.source_version)`;
      const columns = table.fields.map(field=>`"${field}"`);
      const values = table.fields.map(field=>`fields -> '$.${field}'`);
      const final = [db.prepare(`INSERT INTO "${batch.sheet}" (row_key,row_hash,synced_at,${columns.join(',')})
        SELECT row_key,row_hash,?,${values.join(',')} FROM sync_staging WHERE snapshot_id=? AND EXISTS (${ready})
        ON CONFLICT(row_key) DO UPDATE SET row_hash=excluded.row_hash,synced_at=excluded.synced_at,
          ${columns.map(column=>`${column}=excluded.${column}`).join(',')}
        WHERE "${batch.sheet}".row_hash<>excluded.row_hash`).bind(now,batch.snapshot_id,batch.snapshot_id)];
      if (batch.mode==='snapshot') final.push(db.prepare(`DELETE FROM "${batch.sheet}" WHERE EXISTS (${ready}) AND row_key NOT IN (SELECT row_key FROM sync_staging WHERE snapshot_id=?)`).bind(batch.snapshot_id,batch.snapshot_id));
      final.push(db.prepare(`UPDATE sync_runs SET status='completed',completed_at=? WHERE snapshot_id=? AND EXISTS (${ready})`).bind(now,batch.snapshot_id,batch.snapshot_id));
      await db.batch(final);
      completed = (await db.prepare('SELECT status FROM sync_runs WHERE snapshot_id=?').bind(batch.snapshot_id).first()).status==='completed';
      if (!completed) stop('STALE_SNAPSHOT',409);
      await db.batch([db.prepare('DELETE FROM sync_staging WHERE snapshot_id=?').bind(batch.snapshot_id)]);
    }
    return Response.json({ success:true, code:'OK', message:'Replica batch accepted', data:{completed} }, {headers:{'cache-control':'no-store'}});
  } catch (error) {
    return failure(error.status ? error.code : 'SYNC_UNAVAILABLE',error.status || 503);
  }
}
