import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { lineChannels } from '../src/line-channels.js';
import { liffEndpoint } from '../src/line-setup.js';
import { createReadDatasetLoader } from '../src/read-dataset.js';

const signing = 'synthetic-line-registry-secret';
const key = Buffer.alloc(32,7).toString('base64');
const login = '1000000001', messaging = '2000000001', bot = 'U'+'b'.repeat(32), landlord = 'U'+'d'.repeat(32);
const secrets = { messaging_channel_secret:'synthetic-a', messaging_access_token:'synthetic-b', line_login_channel_secret:'synthetic-c' };
const origin = 'https://read.test';

// A small LINE: one Login channel with LIFF apps, one OA with a webhook.
function fakeLine({ apps = [], endpoint = '', active = true, friends = [landlord], tokenChannel = messaging, testPasses = true } = {}) {
  const state = { apps:[...apps], endpoint, active, calls:[] };
  const json = (body, status = 200) => Response.json(body,{ status });
  state.fetch = async (url, init = {}) => {
    const { pathname } = new URL(url);
    const auth = init.headers?.Authorization || '';
    const form = init.body && init.headers['content-type']?.includes('urlencoded') ? Object.fromEntries(new URLSearchParams(init.body)) : {};
    const body = init.body && init.headers['content-type'] === 'application/json' ? JSON.parse(init.body) : {};
    state.calls.push(init.method+' '+pathname);
    if (pathname === '/v2/oauth/accessToken') {
      return form.client_id === login && form.client_secret === 'synthetic-c' ? json({ access_token:'login-token' }) : json({},400);
    }
    if (pathname.startsWith('/liff/')) {
      if (auth !== 'Bearer login-token') return json({},401);
      if (init.method === 'GET') return state.apps.length ? json({ apps:state.apps }) : json({},404);
      if (init.method === 'POST') { const liffId = login+'-NewApp01'; state.apps.push({ liffId, view:body.view }); return json({ liffId }); }
      const app = state.apps.find(item => item.liffId === pathname.split('/').pop());
      app.view = body.view; return json({});
    }
    if (pathname === '/v2/oauth/verify') return form.access_token === 'synthetic-b' ? json({ client_id:tokenChannel, expires_in:9 }) : json({},400);
    if (pathname === '/oauth2/v2.1/verify') {
      return form.id_token === 'good-id-token' && form.client_id === login ? json({ aud:login, sub:landlord }) : json({},400);
    }
    if (auth !== 'Bearer synthetic-b') return json({},401);
    if (pathname === '/v2/bot/info') return json({ userId:bot, basicId:'@synthetic', displayName:'合成房東' });
    if (pathname === '/v2/bot/channel/webhook/endpoint') {
      if (init.method === 'PUT') { state.endpoint = body.endpoint; return json({}); }
      return state.endpoint ? json({ endpoint:state.endpoint, active:state.active }) : json({},404);
    }
    if (pathname === '/v2/bot/channel/webhook/test') return json({ success:testPasses, statusCode:testPasses ? 200 : 401, reason:testPasses ? 'OK' : 'ERROR_STATUS_CODE' });
    if (pathname === '/v2/bot/message/quota') return json({ type:'limited', value:200 });
    if (pathname === '/v2/bot/message/quota/consumption') return json({ totalUsage:17 });
    if (pathname.startsWith('/v2/bot/profile/')) return friends.includes(pathname.split('/').pop()) ? json({ userId:landlord }) : json({},404);
    return json({},404);
  };
  return state;
}

async function withRegistry(run, extraEnv = {}) {
  const mf = new Miniflare(convertV4MiniflareOptions({ modules:true, script:'export default { fetch() { return new Response(null); } }',
    compatibilityDate:'2026-10-06', d1Databases:{ DB:randomUUID() } }));
  try {
    const db = await mf.getD1Database('DB');
    for (const file of (await readdir(new URL('../migrations/', import.meta.url))).filter(name => name.endsWith('.sql')).sort()) {
      const sql = await readFile(new URL('../migrations/'+file, import.meta.url), 'utf8');
      const statements = sql.replace(/^--.*$/gm,'').split(';').map(s => s.trim()).filter(Boolean);
      if (statements.length) await db.batch(statements.map(s => db.prepare(s)));
    }
    const env = { DB:db, LINE_REGISTRY_SIGNING_SECRET:signing, LINE_CHANNEL_SECRET_KEY:key, ...extraEnv };
    const send = async (payload, line) => {
      const body = JSON.stringify(payload), timestamp = String(Math.floor(Date.now()/1000)), nonce = randomUUID();
      const signature = createHmac('sha256',signing).update(timestamp+'\n'+nonce+'\n'+body).digest('hex');
      const response = await lineChannels(new Request(origin+'/internal/line-channels',{ method:'POST', body,
        headers:{ 'X-CMWebs-Timestamp':timestamp, 'X-CMWebs-Nonce':nonce, 'X-CMWebs-Signature':signature } }),env,line.fetch);
      const text = await response.text();
      assert.doesNotMatch(text,/synthetic-[abc]|login-token|good-id-token/);
      return { status:response.status, body:JSON.parse(text) };
    };
    await run(db, send);
  } finally { await mf.dispose(); }
}
async function saved(send, line, liffId) {
  return send({ action:'upsert', workspace_id:'W_A', line_login_channel_id:login, liff_id:liffId, messaging_channel_id:messaging, secrets },line);
}
const setStatus = (send, line, status) => send({ action:'set_status', workspace_id:'W_A', status },line);

test('prepare_liff creates one CMWebs LIFF app and reuses it afterwards', async () => {
  await withRegistry(async (db, send) => {
    const line = fakeLine({ apps:[{ liffId:login+'-OtherApp', view:{ type:'full', url:'https://landlord.example/' } }] });
    const first = await send({ action:'prepare_liff', workspace_id:'W_A', line_login_channel_id:login, line_login_channel_secret:'synthetic-c' },line);
    assert.equal(first.status,200);
    assert.equal(first.body.data.liff_id,login+'-NewApp01');
    assert.equal(line.apps.find(app => app.liffId === login+'-NewApp01').view.url,liffEndpoint(login+'-NewApp01'));
    const again = await send({ action:'prepare_liff', workspace_id:'W_A', line_login_channel_id:login, line_login_channel_secret:'synthetic-c' },line);
    assert.equal(again.body.data.liff_id,login+'-NewApp01');
    assert.equal(line.apps.length,2);
    assert.equal(line.calls.filter(call => call === 'POST /liff/v1/apps').length,1);
    const wrong = await send({ action:'prepare_liff', workspace_id:'W_A', line_login_channel_id:login, line_login_channel_secret:'wrong' },line);
    assert.equal(wrong.body.code,'LINE_LOGIN_SECRET_INVALID');
  });
});

test('the full wizard path ends active only after every check passes', async () => {
  await withRegistry(async (db, send) => {
    const line = fakeLine({ apps:[{ liffId:login+'-AbCdEfGh', view:{ type:'full', url:liffEndpoint(login+'-AbCdEfGh') } }] });
    await saved(send,line,login+'-AbCdEfGh');
    const first = await send({ action:'verify', workspace_id:'W_A' },line);
    assert.deepEqual(first.body.data.checks,{ token:true, login:true, liff:true, webhook:false, provider:false });
    assert.equal(first.body.data.bot.basic_id,'@synthetic');
    const row = await db.prepare('SELECT * FROM line_channels').first();
    assert.equal(row.bot_user_id,bot);
    assert.equal(first.body.data.webhook.expected,origin+'/line/webhook/'+row.webhook_key);
    assert.equal((await send({ action:'set_webhook', workspace_id:'W_A', replace_existing:false },line)).body.code,'LINE_CHANNEL_INVALID_STATUS');
    await setStatus(send,line,'verifying');
    const webhook = await send({ action:'set_webhook', workspace_id:'W_A', replace_existing:false },line);
    assert.equal(webhook.body.data.test.success,true);
    assert.equal(line.endpoint,origin+'/line/webhook/'+row.webhook_key);
    assert.equal((await setStatus(send,line,'active')).body.code,'LINE_CHANNEL_NOT_VERIFIED');
    const provider = await send({ action:'check_provider', workspace_id:'W_A', id_token:'good-id-token' },line);
    assert.equal(provider.body.data.provider_match,true);
    const done = await send({ action:'verify', workspace_id:'W_A' },line);
    assert.deepEqual(done.body.data.checks,{ token:true, login:true, liff:true, webhook:true, provider:true });
    assert.equal((await setStatus(send,line,'active')).body.data.status,'active');
  });
});

test('an existing webhook is replaced only after confirmation and is kept for rollback', async () => {
  await withRegistry(async (db, send) => {
    const line = fakeLine({ endpoint:'https://other-bot.example/hook' });
    await saved(send,line,login+'-AbCdEfGh');
    await setStatus(send,line,'verifying');
    const refused = await send({ action:'set_webhook', workspace_id:'W_A', replace_existing:false },line);
    assert.equal(refused.status,409); assert.equal(refused.body.code,'LINE_WEBHOOK_REPLACE_CONFIRM_REQUIRED');
    assert.equal(line.endpoint,'https://other-bot.example/hook');
    const replaced = await send({ action:'set_webhook', workspace_id:'W_A', replace_existing:true },line);
    assert.equal(replaced.body.data.previous_endpoint,'https://other-bot.example/hook');
    assert.equal(replaced.body.data.channel.previous_webhook_endpoint,'https://other-bot.example/hook');
    // Running it again keeps the landlord's original URL, not CMWebs's own.
    const again = await send({ action:'set_webhook', workspace_id:'W_A', replace_existing:false },line);
    assert.equal(again.body.data.previous_endpoint,'https://other-bot.example/hook');
    // Saving the same OA again keeps it.
    await saved(send,line,login+'-AbCdEfGh');
    assert.equal((await db.prepare('SELECT previous_webhook_endpoint AS p FROM line_channels').first()).p,'https://other-bot.example/hook');
  });
});

test('a failed webhook test leaves the channel unverified', async () => {
  await withRegistry(async (db, send) => {
    const line = fakeLine({ testPasses:false });
    await saved(send,line,login+'-AbCdEfGh');
    await setStatus(send,line,'verifying');
    const result = await send({ action:'set_webhook', workspace_id:'W_A', replace_existing:false },line);
    assert.equal(result.body.data.test.success,false);
    assert.equal(result.body.data.test.reason,'ERROR_STATUS_CODE');
    assert.equal(result.body.data.channel.webhook_verified_at,null);
  });
});

test('a different provider, a non-friend or a bad ID token never passes the provider check', async () => {
  await withRegistry(async (db, send) => {
    const line = fakeLine({ friends:[] });
    await saved(send,line,login+'-AbCdEfGh');
    await setStatus(send,line,'verifying');
    const missing = await send({ action:'check_provider', workspace_id:'W_A', id_token:'good-id-token' },line);
    assert.equal(missing.body.data.provider_match,false);
    assert.equal(missing.body.data.channel.provider_checked_at,null);
    const bad = await send({ action:'check_provider', workspace_id:'W_A', id_token:'forged' },line);
    assert.equal(bad.status,401); assert.equal(bad.body.code,'LINE_ID_TOKEN_INVALID');
  });
});

test('a token from another channel fails the token check', async () => {
  await withRegistry(async (db, send) => {
    const line = fakeLine({ tokenChannel:'2999999999' });
    await saved(send,line,login+'-AbCdEfGh');
    const result = await send({ action:'verify', workspace_id:'W_A' },line);
    assert.equal(result.body.data.checks.token,false);
    assert.equal((await db.prepare('SELECT bot_user_id AS b FROM line_channels').first()).b,null);
  });
});

test('setup actions reject unknown fields, missing channels and LINE outages', async () => {
  await withRegistry(async (db, send) => {
    const line = fakeLine();
    assert.equal((await send({ action:'verify', workspace_id:'W_A' },line)).status,404);
    await saved(send,line,login+'-AbCdEfGh');
    for (const payload of [{ action:'verify', workspace_id:'W_A', extra:1 },{ action:'set_webhook', workspace_id:'W_A', replace_existing:'yes' },
      { action:'prepare_liff', workspace_id:'W_A', line_login_channel_id:'bad', line_login_channel_secret:'x' }]) {
      assert.equal((await send(payload,line)).body.code,'INVALID_LINE_CHANNEL');
    }
    const down = { fetch:async () => { throw new Error('down'); } };
    assert.equal((await send({ action:'verify', workspace_id:'W_A' },down)).body.code,'LINE_UNREACHABLE');
  });
});

test('LIFF apps the wizard did not make are never rewritten', async () => {
  await withRegistry(async (db, send) => {
    const existing = { liffId:login+'-TenantAp', view:{ type:'full', url:'https://cmwebssaas-sudo.github.io/cmwebs-liff/tenant-bind.html' } };
    const line = fakeLine({ apps:[existing] });
    const result = await send({ action:'prepare_liff', workspace_id:'W_A', line_login_channel_id:login, line_login_channel_secret:'synthetic-c' },line);
    assert.equal(result.body.data.liff_id,login+'-NewApp01');
    assert.equal(existing.view.url,'https://cmwebssaas-sudo.github.io/cmwebs-liff/tenant-bind.html');
    assert.ok(!line.calls.includes('PUT /liff/v1/apps/'+login+'-TenantAp'));
  });
});

test('only the home Workspace may register the existing CMWebs Login channel', async () => {
  await withRegistry(async (db, send) => {
    const line = fakeLine();
    const prepared = await send({ action:'prepare_liff', workspace_id:'W_A', line_login_channel_id:login, line_login_channel_secret:'synthetic-c' },line);
    assert.equal(prepared.status,409); assert.equal(prepared.body.code,'LINE_CHANNEL_RESERVED');
    assert.equal((await saved(send,line,login+'-AbCdEfGh')).body.code,'LINE_CHANNEL_RESERVED');
    assert.equal(line.calls.length,0);
    const home = await send({ action:'prepare_liff', workspace_id:'W_HOME', line_login_channel_id:login, line_login_channel_secret:'synthetic-c' },line);
    assert.equal(home.status,200); assert.equal(home.body.data.liff_id,login+'-NewApp01');
    const row = await send({ action:'upsert', workspace_id:'W_HOME', line_login_channel_id:login, liff_id:login+'-NewApp01',
      messaging_channel_id:messaging, secrets },line);
    assert.equal(row.status,200);
    // Reads: the home Workspace keeps accepting the existing channel's tokens.
    await db.prepare("UPDATE line_channels SET status='active' WHERE workspace_id='W_HOME'").run();
    const loader = createReadDatasetLoader(db);
    assert.equal(await loader.workspaceOnOwnChannel('w_home',login),false);
    await db.prepare("UPDATE line_channels SET line_login_channel_id='1000000002' WHERE workspace_id='W_HOME'").run();
    assert.equal(await loader.workspaceOnOwnChannel('W_HOME',login),true);
  },{ LINE_LOGIN_CHANNEL_ID:login, LINE_LOGIN_HOME_WORKSPACE:'W_HOME' });
  // Without a named home Workspace nobody may claim it.
  await withRegistry(async (db, send) => {
    const home = await send({ action:'prepare_liff', workspace_id:'W_HOME', line_login_channel_id:login, line_login_channel_secret:'synthetic-c' },fakeLine());
    assert.equal(home.body.code,'LINE_CHANNEL_RESERVED');
  },{ LINE_LOGIN_CHANNEL_ID:login });
});

test('the audience check answers friend counts and quota, never profiles', async () => {
  await withRegistry(async (db, send) => {
    const other = 'U'+'e'.repeat(32), third = 'U'+'f'.repeat(32);
    const line = fakeLine({ friends:[landlord,other] });
    await saved(send,line,login+'-AbCdEfGh');
    const result = await send({ action:'audience_check', workspace_id:'W_A', line_user_ids:[landlord,other,third] },line);
    assert.equal(result.status,409, 'a draft channel is not checked');
    await setStatus(send,line,'verifying');
    const counted = await send({ action:'audience_check', workspace_id:'W_A', line_user_ids:[landlord,other,third] },line);
    assert.equal(counted.status,200);
    const { channel, ...data } = counted.body.data;
    assert.deepEqual(data,{ friends:2, not_friends:1, unknown:0, quota_type:'limited', quota_limit:200, quota_used:17 });
    assert.doesNotMatch(JSON.stringify(counted.body),/U[ef]{32}|合成房東/);
    for (const ids of [[landlord,landlord],['bad'],Array.from({ length:41 },(_,i) => 'U'+i.toString(16).padStart(32,'0'))]) {
      assert.equal((await send({ action:'audience_check', workspace_id:'W_A', line_user_ids:ids },line)).body.code,'INVALID_LINE_CHANNEL');
    }
  });
});

test('a webhook that points at Apps Script is never replaced', async () => {
  await withRegistry(async (db, send) => {
    const live = 'https://script.google.com/macros/s/LIVE_DEPLOYMENT/exec';
    const line = fakeLine({ endpoint:live });
    await saved(send,line,login+'-AbCdEfGh');
    await setStatus(send,line,'verifying');
    const refused = await send({ action:'set_webhook', workspace_id:'W_A', replace_existing:true },line);
    assert.equal(refused.status,409); assert.equal(refused.body.code,'LINE_WEBHOOK_PROTECTED');
    assert.equal(line.endpoint,live);
  });
});

test('restoring the webhook puts the replaced URL back', async () => {
  await withRegistry(async (db, send) => {
    const line = fakeLine({ endpoint:'https://other-bot.example/hook' });
    await saved(send,line,login+'-AbCdEfGh');
    await setStatus(send,line,'verifying');
    await send({ action:'set_webhook', workspace_id:'W_A', replace_existing:true },line);
    const restored = await send({ action:'restore_webhook', workspace_id:'W_A' },line);
    assert.equal(restored.body.data.restored,true);
    assert.equal(line.endpoint,'https://other-bot.example/hook');
    assert.equal(restored.body.data.channel.webhook_verified_at,null);
  });
  await withRegistry(async (db, send) => {
    const line = fakeLine();
    await saved(send,line,login+'-AbCdEfGh');
    await setStatus(send,line,'verifying');
    await send({ action:'set_webhook', workspace_id:'W_A', replace_existing:false },line);
    const none = await send({ action:'restore_webhook', workspace_id:'W_A' },line);
    assert.equal(none.body.data.restored,false);
  });
});
