import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { decryptChannelSecrets, encryptChannelSecrets } from '../src/line-channels.js';

const signing = 'synthetic-line-registry-secret';
const key = Buffer.alloc(32,7).toString('base64');
const otherKey = Buffer.alloc(32,9).toString('base64');
const secrets = { messaging_channel_secret:'synthetic-a', messaging_access_token:'synthetic-b', line_login_channel_secret:'synthetic-c' };
const channel = (overrides = {}) => ({ action:'upsert', workspace_id:'W_A', line_login_channel_id:'1000000001',
  liff_id:'1000000001-AbCdEfGh', messaging_channel_id:'2000000001', secrets, ...overrides });

async function fixture(run, bindings = { LINE_REGISTRY_SIGNING_SECRET:signing, LINE_CHANNEL_SECRET_KEY:key }) {
  const script = await readFile(new URL('../.wrangler/dry-run/index.js', import.meta.url), 'utf8');
  const mf = new Miniflare(convertV4MiniflareOptions({ modules:true, script, compatibilityDate:'2026-10-06',
    d1Databases:{ DB:randomUUID() }, bindings }));
  try {
    const db = await mf.getD1Database('DB');
    for (const file of (await readdir(new URL('../migrations/', import.meta.url))).filter(name => name.endsWith('.sql')).sort()) {
      const sql = await readFile(new URL('../migrations/'+file, import.meta.url), 'utf8');
      const statements = sql.replace(/^--.*$/gm,'').split(';').map(s => s.trim()).filter(Boolean);
      if (statements.length) await db.batch(statements.map(s => db.prepare(s)));
    }
    const send = async (payload, options = {}) => {
      const body = JSON.stringify(payload), timestamp = String(Math.floor(Date.now()/1000)), nonce = options.nonce || randomUUID();
      const signature = options.signature ?? createHmac('sha256',signing).update(timestamp+'\n'+nonce+'\n'+body).digest('hex');
      const response = await mf.dispatchFetch('https://local.test/internal/line-channels', { method:'POST', body,
        headers:{ 'X-CMWebs-Timestamp':timestamp, 'X-CMWebs-Nonce':nonce, 'X-CMWebs-Signature':signature } });
      return { status:response.status, text:await response.text() };
    };
    await run(db, send, mf);
  } finally { await mf.dispose(); }
}
const code = result => JSON.parse(result.text).code;

test('secrets round trip and stay bound to their Workspace and key', async () => {
  const stored = await encryptChannelSecrets(secrets,key,'W_A');
  assert.doesNotMatch(stored,/synthetic/);
  assert.deepEqual(await decryptChannelSecrets(stored,key,'W_A'),secrets);
  await assert.rejects(decryptChannelSecrets(stored,key,'W_B'));
  await assert.rejects(decryptChannelSecrets(stored,otherKey,'W_A'));
});

test('stores encrypted secrets and never returns them', async () => {
  await fixture(async (db, send) => {
    const result = await send(channel());
    assert.equal(result.status,200);
    assert.doesNotMatch(result.text,/synthetic|encrypted_secrets/);
    const data = JSON.parse(result.text).data;
    assert.equal(data.status,'draft'); assert.equal(data.has_secrets,true); assert.match(data.webhook_key,/^[a-f0-9]{32}$/);
    const row = await db.prepare('SELECT * FROM line_channels').first();
    assert.doesNotMatch(JSON.stringify(row),/synthetic/);
    assert.deepEqual(await decryptChannelSecrets(row.encrypted_secrets,key,'W_A'),secrets);
    assert.doesNotMatch((await send({ action:'get', workspace_id:'W_A' })).text,/synthetic|encrypted_secrets/);
  });
});

test('one channel cannot belong to two Workspaces', async () => {
  await fixture(async (db, send) => {
    await send(channel());
    const result = await send(channel({ workspace_id:'W_B', liff_id:'1000000001-ZzZzZzZz', messaging_channel_id:'2000000002' }));
    assert.equal(result.status,409); assert.equal(code(result),'LINE_CHANNEL_CONFLICT');
    assert.equal((await db.prepare('SELECT count(*) AS n FROM line_channels').first()).n,1);
  });
});

test('rejects bad signatures, replays, malformed channels and missing configuration', async () => {
  await fixture(async (db, send) => {
    assert.equal((await send(channel(),{ signature:'0'.repeat(64) })).status,401);
    const nonce = randomUUID();
    assert.equal((await send(channel(),{ nonce })).status,200);
    assert.equal(code(await send(channel(),{ nonce })),'NONCE_REPLAY');
    assert.equal(code(await send(channel({ liff_id:'1999999999-AbCdEfGh' }))),'INVALID_LINE_CHANNEL');
    assert.equal(code(await send(channel({ extra:true }))),'INVALID_LINE_CHANNEL');
    assert.equal(code(await send({ action:'get', workspace_id:'W_MISSING' })),'LINE_CHANNEL_NOT_FOUND');
  });
  await fixture(async (db, send) => {
    assert.equal(code(await send(channel())),'LINE_CHANNEL_NOT_CONFIGURED');
  },{});
});

test('status follows the allowed path and revoking removes secrets', async () => {
  await fixture(async (db, send) => {
    await send(channel());
    const status = value => send({ action:'set_status', workspace_id:'W_A', status:value });
    assert.equal(code(await status('active')),'LINE_CHANNEL_INVALID_STATUS');
    assert.equal(JSON.parse((await status('verifying')).text).data.status,'verifying');
    const active = JSON.parse((await status('active')).text).data;
    assert.equal(active.status,'active'); assert(active.verified_at);
    assert.equal(JSON.parse((await status('suspended')).text).data.status,'suspended');
    const revoked = JSON.parse((await status('revoked')).text).data;
    assert.equal(revoked.status,'revoked'); assert.equal(revoked.has_secrets,false);
    assert.equal(code(await status('active')),'LINE_CHANNEL_INVALID_STATUS');
  });
});
