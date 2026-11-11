import { boundedBody } from './sync.js';
import { decryptChannelSecrets } from './line-channels.js';
import { RICH_MENU_SWITCH_DATA } from './line-rich-menu-layout.js';

// V3 stage 5. Each landlord channel posts to /line/webhook/<webhook_key>. The
// key only picks the channel; LINE's signature over the raw body, made with
// that channel's secret, is what authenticates the request.
const encoder = new TextEncoder();
const pathPattern = /^\/line\/webhook\/([a-f0-9]{32})$/;
const weekMs = 7 * 24 * 3600 * 1000;
const staleClaimMs = 120000;
const reply = (code, status = 200) => Response.json({ success:status === 200, code }, { status, headers:{ 'cache-control':'no-store' } });
const hex = bytes => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2,'0')).join('');

export function lineWebhookKey(pathname) {
  return pathPattern.exec(pathname)?.[1] || '';
}

async function validLineSignature(body, header, channelSecret) {
  let expected;
  try { expected = Uint8Array.from(atob(header), char => char.charCodeAt(0)); } catch { return false; }
  if (expected.length !== 32) return false;
  const key = await crypto.subtle.importKey('raw',encoder.encode(channelSecret),{ name:'HMAC', hash:'SHA-256' },false,['verify']);
  return crypto.subtle.verify('HMAC',key,expected,encoder.encode(body));
}

// Claims events not yet forwarded. A failed event, or one left pending by a
// run that died, can be claimed again when LINE redelivers it.
async function claimEvents(db, workspaceId, events, now) {
  const statements = events.map(event => db.prepare(`INSERT INTO line_webhook_events(webhook_event_id,workspace_id,status,received_at,updated_at)
      VALUES (?,?,'pending',?,?)
    ON CONFLICT(webhook_event_id) DO UPDATE SET status='pending',updated_at=excluded.updated_at
      WHERE line_webhook_events.status='failed' OR (line_webhook_events.status='pending' AND line_webhook_events.updated_at<?)
    RETURNING webhook_event_id`).bind(event.webhookEventId,workspaceId,now,now,now-staleClaimMs));
  statements.push(db.prepare('DELETE FROM line_webhook_events WHERE received_at<?').bind(now-weekMs));
  const results = await db.batch(statements);
  const claimed = new Set(results.slice(0,-1).flatMap(result => result.results || []).map(row => row.webhook_event_id));
  return events.filter(event => claimed.has(event.webhookEventId));
}

async function markEvents(db, events, status) {
  if (!events.length) return;
  const now = Date.now();
  await db.batch(events.map(event => db.prepare('UPDATE line_webhook_events SET status=?,updated_at=? WHERE webhook_event_id=?')
    .bind(status,now,event.webhookEventId)));
}

export async function signForward(payload, secret, now = Date.now(), nonce = crypto.randomUUID()) {
  const key = await crypto.subtle.importKey('raw',encoder.encode(secret),{ name:'HMAC', hash:'SHA-256' },false,['sign']);
  const mac = await crypto.subtle.sign('HMAC',key,encoder.encode('cmwebs-line-webhook-v1\n'+now+'\n'+nonce+'\n'+payload));
  return { action:'line_worker_webhook', timestamp:now, nonce, payload, signature:hex(mac) };
}

// Apps Script answers a web-app POST with a redirect to the response body.
async function forwardOnce(env, envelope, fetcher) {
  try {
    const response = await fetcher(env.APPS_SCRIPT_WEBHOOK_URL,{ method:'POST', redirect:'follow',
      headers:{ 'content-type':'application/json' }, body:JSON.stringify(envelope), signal:AbortSignal.timeout(25000) });
    if (!response.ok) return false;
    return (await response.json())?.success === true;
  } catch { return false; }
}

async function forward(db, env, workspaceId, destination, events, fetcher) {
  const payload = JSON.stringify({ workspace_id:workspaceId, destination, events });
  let delivered = await forwardOnce(env,await signForward(payload,env.LINE_REGISTRY_SIGNING_SECRET),fetcher);
  if (!delivered) delivered = await forwardOnce(env,await signForward(payload,env.LINE_REGISTRY_SIGNING_SECRET),fetcher);
  await markEvents(db,events,delivered ? 'forwarded' : 'failed');
}

function validEvents(body) {
  let parsed; try { parsed = JSON.parse(body); } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.destination !== 'string' ||
      !/^U[0-9a-f]{32}$/.test(parsed.destination) || !Array.isArray(parsed.events) || parsed.events.length > 100) return null;
  if (parsed.events.some(event => !event || typeof event !== 'object' ||
      typeof event.webhookEventId !== 'string' || !/^[A-Za-z0-9]{1,64}$/.test(event.webhookEventId))) return null;
  return parsed;
}

// Answers LINE before Apps Script has the events; LINE does not wait long.
// LINE never redelivers after a 200, so an event whose forward fails twice is
// lost; its row stays 'failed' for inspection. A manual redelivery is forwarded.
export async function lineWebhook(request, env, ctx, fetcher = fetch) {
  if (request.method !== 'POST') return reply('METHOD_NOT_ALLOWED',405);
  if (!env.DB || !env.LINE_CHANNEL_SECRET_KEY || !env.LINE_REGISTRY_SIGNING_SECRET) return reply('LINE_WEBHOOK_NOT_CONFIGURED',503);
  try {
    const db = env.DB.withSession ? env.DB.withSession('first-primary') : env.DB;
    const row = await db.prepare('SELECT workspace_id,status,encrypted_secrets,bot_user_id FROM line_channels WHERE webhook_key=?')
      .bind(lineWebhookKey(new URL(request.url).pathname)).first();
    if (!row || !['verifying','active'].includes(row.status) || !row.encrypted_secrets) return reply('NOT_FOUND',404);
    const body = await boundedBody(request);
    const secrets = await decryptChannelSecrets(row.encrypted_secrets,env.LINE_CHANNEL_SECRET_KEY,row.workspace_id);
    if (!await validLineSignature(body,request.headers.get('x-line-signature') || '',secrets.messaging_channel_secret)) {
      return reply('LINE_SIGNATURE_INVALID',401);
    }
    // A signed request to a channel that is still being verified is a setup
    // test (the console's Verify button or the webhook test API): accept it
    // whatever its events look like, and forward nothing.
    if (row.status !== 'active') return reply('OK');
    const parsed = validEvents(body);
    if (!parsed || (row.bot_user_id && parsed.destination !== row.bot_user_id)) return reply('LINE_WEBHOOK_INVALID',400);
    // A rich menu tab switch is a postback, not a message; Apps Script never sees it.
    parsed.events = parsed.events.filter(event => !(event.type === 'postback' &&
      String(event.postback?.data || '').startsWith(RICH_MENU_SWITCH_DATA)));
    if (!parsed.events.length) return reply('OK');
    // Setup tests above work without it, so forwarding can stay off until approved.
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(env.APPS_SCRIPT_WEBHOOK_URL || '')) {
      return reply('LINE_WEBHOOK_NOT_CONFIGURED',503);
    }
    const events = await claimEvents(db,row.workspace_id,parsed.events,Date.now());
    if (!events.length) return reply('OK');
    const work = forward(db,env,row.workspace_id,parsed.destination,events,fetcher).catch(() => {});
    if (ctx?.waitUntil) ctx.waitUntil(work); else await work;
    return reply('OK');
  } catch {
    return reply('LINE_WEBHOOK_UNAVAILABLE',503);
  }
}
