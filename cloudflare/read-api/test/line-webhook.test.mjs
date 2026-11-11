import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { encryptChannelSecrets } from '../src/line-channels.js';
import { lineWebhook, lineWebhookKey } from '../src/line-webhook.js';

const signing = 'synthetic-line-registry-secret';
const key = Buffer.alloc(32,7).toString('base64');
const channelSecret = 'synthetic-channel-secret';
const secrets = { messaging_channel_secret:channelSecret, messaging_access_token:'synthetic-b', line_login_channel_secret:'synthetic-c' };
const webhookKey = 'a'.repeat(32);
const bot = 'U'+'b'.repeat(32);
const appsScript = 'https://script.google.com/macros/s/SYNTHETIC_DEPLOYMENT/exec';

async function withDb(run) {
  const mf = new Miniflare(convertV4MiniflareOptions({ modules:true, script:'export default { fetch() { return new Response(null); } }',
    compatibilityDate:'2026-10-06', d1Databases:{ DB:randomUUID() } }));
  try {
    const db = await mf.getD1Database('DB');
    for (const file of (await readdir(new URL('../migrations/', import.meta.url))).filter(name => name.endsWith('.sql')).sort()) {
      const sql = await readFile(new URL('../migrations/'+file, import.meta.url), 'utf8');
      const statements = sql.replace(/^--.*$/gm,'').split(';').map(s => s.trim()).filter(Boolean);
      if (statements.length) await db.batch(statements.map(s => db.prepare(s)));
    }
    await run(db);
  } finally { await mf.dispose(); }
}
async function addChannel(db, { workspace = 'W_A', status = 'active', botUserId = bot, keyValue = webhookKey, n = 1 } = {}) {
  await db.prepare(`INSERT INTO line_channels(workspace_id,line_login_channel_id,liff_id,messaging_channel_id,webhook_key,status,
      encrypted_secrets,verified_at,updated_at,bot_user_id) VALUES (?,?,?,?,?,?,?,NULL,'2026-11-12T00:00:00Z',?)`)
    .bind(workspace,'100000000'+n,'100000000'+n+'-AbCdEfGh','200000000'+n,keyValue,status,
      await encryptChannelSecrets(secrets,key,workspace),botUserId).run();
}
const env = db => ({ DB:db, LINE_CHANNEL_SECRET_KEY:key, LINE_REGISTRY_SIGNING_SECRET:signing, APPS_SCRIPT_WEBHOOK_URL:appsScript });
const event = id => ({ type:'message', webhookEventId:id, timestamp:1, source:{ type:'user', userId:'U'+'c'.repeat(32) },
  message:{ id:'1', type:'text', text:'合成訊息' }, deliveryContext:{ isRedelivery:false } });
function lineRequest(body, { secret = channelSecret, path = '/line/webhook/'+webhookKey, signature } = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('https://local.test'+path,{ method:'POST', body:text,
    headers:{ 'x-line-signature':signature ?? createHmac('sha256',secret).update(text).digest('base64') } });
}
function appsScriptStub(answers = []) {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init, envelope:JSON.parse(init.body) });
    const answer = answers.length ? answers.shift() : { success:true };
    return answer instanceof Error ? Promise.reject(answer) : Response.json(answer);
  };
  return { calls, fetcher };
}
const statuses = async db => Object.fromEntries((await db.prepare('SELECT webhook_event_id,status FROM line_webhook_events').all()).results
  .map(row => [row.webhook_event_id,row.status]));

test('only 32-hex keys under /line/webhook/ are webhook paths', () => {
  assert.equal(lineWebhookKey('/line/webhook/'+webhookKey),webhookKey);
  for (const path of ['/line/webhook/','/line/webhook/'+webhookKey+'/x','/line/webhook/'+'A'.repeat(32),'/internal/line-send']) {
    assert.equal(lineWebhookKey(path),'');
  }
});

test('a signed event is forwarded to Apps Script with its verified Workspace', async () => {
  await withDb(async db => {
    await addChannel(db);
    const { calls, fetcher } = appsScriptStub();
    const response = await lineWebhook(lineRequest({ destination:bot, events:[event('E1')] }),env(db),null,fetcher);
    assert.equal(response.status,200);
    assert.equal(calls.length,1);
    assert.equal(calls[0].url,appsScript);
    const { envelope } = calls[0];
    assert.deepEqual(Object.keys(envelope).sort(),['action','nonce','payload','signature','timestamp']);
    assert.equal(envelope.action,'line_worker_webhook');
    const mac = createHmac('sha256',signing).update('cmwebs-line-webhook-v1\n'+envelope.timestamp+'\n'+envelope.nonce+'\n'+envelope.payload).digest('hex');
    assert.equal(envelope.signature,mac);
    const payload = JSON.parse(envelope.payload);
    assert.equal(payload.workspace_id,'W_A'); assert.equal(payload.destination,bot);
    assert.deepEqual(payload.events.map(item => item.webhookEventId),['E1']);
    assert.doesNotMatch(calls[0].init.body,/synthetic-channel-secret|synthetic-b/);
    assert.deepEqual(await statuses(db),{ E1:'forwarded' });
  });
});

test('bad signatures, unknown keys and inactive channels never reach Apps Script', async () => {
  await withDb(async db => {
    await addChannel(db);
    await addChannel(db,{ workspace:'W_S', status:'suspended', keyValue:'d'.repeat(32), n:2 });
    const { calls, fetcher } = appsScriptStub();
    const body = { destination:bot, events:[event('E1')] };
    assert.equal((await lineWebhook(lineRequest(body,{ secret:'wrong-secret' }),env(db),null,fetcher)).status,401);
    assert.equal((await lineWebhook(lineRequest(body,{ signature:'not base64!' }),env(db),null,fetcher)).status,401);
    assert.equal((await lineWebhook(lineRequest(body,{ path:'/line/webhook/'+'e'.repeat(32) }),env(db),null,fetcher)).status,404);
    assert.equal((await lineWebhook(lineRequest(body,{ path:'/line/webhook/'+'d'.repeat(32) }),env(db),null,fetcher)).status,404);
    assert.equal((await lineWebhook(lineRequest({ destination:'U'+'f'.repeat(32), events:[event('E1')] }),env(db),null,fetcher)).status,400);
    assert.equal((await lineWebhook(lineRequest({ destination:bot, events:[{ type:'message' }] }),env(db),null,fetcher)).status,400);
    assert.equal(calls.length,0);
    assert.deepEqual(await statuses(db),{});
  });
});

test('Verify requests and channels still being verified answer 200 without forwarding', async () => {
  await withDb(async db => {
    await addChannel(db,{ status:'verifying', botUserId:null });
    const { calls, fetcher } = appsScriptStub();
    assert.equal((await lineWebhook(lineRequest({ destination:bot, events:[] }),env(db),null,fetcher)).status,200);
    assert.equal((await lineWebhook(lineRequest({ destination:bot, events:[event('E1')] }),env(db),null,fetcher)).status,200);
    assert.equal((await lineWebhook(lineRequest({ destination:bot, events:[{ type:'test' }] }),env(db),null,fetcher)).status,200);
    assert.equal((await lineWebhook(lineRequest({ destination:bot, events:[] },{ secret:'wrong-secret' }),env(db),null,fetcher)).status,401);
    assert.equal(calls.length,0);
  });
});

test('a forwarded event is skipped when LINE delivers it again', async () => {
  await withDb(async db => {
    await addChannel(db);
    const { calls, fetcher } = appsScriptStub();
    await lineWebhook(lineRequest({ destination:bot, events:[event('E1')] }),env(db),null,fetcher);
    await lineWebhook(lineRequest({ destination:bot, events:[event('E1'),event('E2')] }),env(db),null,fetcher);
    assert.deepEqual(calls.map(call => JSON.parse(call.envelope.payload).events.map(item => item.webhookEventId)),[['E1'],['E2']]);
  });
});

test('a failed forward is retried once, then forwarded again on redelivery', async () => {
  await withDb(async db => {
    await addChannel(db);
    const { calls, fetcher } = appsScriptStub([new Error('down'),{ success:false }]);
    assert.equal((await lineWebhook(lineRequest({ destination:bot, events:[event('E1')] }),env(db),null,fetcher)).status,200);
    assert.equal(calls.length,2);
    assert.notEqual(calls[0].envelope.nonce,calls[1].envelope.nonce);
    assert.deepEqual(await statuses(db),{ E1:'failed' });
    await lineWebhook(lineRequest({ destination:bot, events:[event('E1')] }),env(db),null,fetcher);
    assert.equal(calls.length,3);
    assert.deepEqual(await statuses(db),{ E1:'forwarded' });
  });
});

test('forwarding runs after the reply when the runtime offers waitUntil', async () => {
  await withDb(async db => {
    await addChannel(db);
    const { calls, fetcher } = appsScriptStub();
    const pending = [];
    const response = await lineWebhook(lineRequest({ destination:bot, events:[event('E1')] }),env(db),{ waitUntil:work => pending.push(work) },fetcher);
    assert.equal(response.status,200);
    assert.equal(pending.length,1);
    await Promise.all(pending);
    assert.equal(calls.length,1);
  });
});

test('missing configuration and other methods are refused', async () => {
  await withDb(async db => {
    await addChannel(db);
    const { calls, fetcher } = appsScriptStub();
    const body = { destination:bot, events:[event('E1')] };
    for (const broken of [{ APPS_SCRIPT_WEBHOOK_URL:'' },{ APPS_SCRIPT_WEBHOOK_URL:'https://evil.test/exec' },{ LINE_CHANNEL_SECRET_KEY:'' }]) {
      assert.equal((await lineWebhook(lineRequest(body),{ ...env(db), ...broken },null,fetcher)).status,503);
    }
    assert.equal((await lineWebhook(new Request('https://local.test/line/webhook/'+webhookKey),env(db),null,fetcher)).status,405);
    assert.equal(calls.length,0);
  });
});
