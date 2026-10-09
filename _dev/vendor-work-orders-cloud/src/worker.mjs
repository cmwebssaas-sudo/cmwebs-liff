import { createD1StateStore } from './d1-state-store.mjs';
import { createAuthStore } from './auth-store.mjs';
import { createLineLogin, hashToken, randomToken, sha256Hex } from './line-auth-worker.mjs';
import { verifyLineWebhook } from './line-crypto.mjs';
import { applyWebhookEvents } from '../../vendor-work-orders/line-webhook.mjs';
import { normalizeWorkOrderInput, authorizeWorkOrderAction, transitionWorkOrder,
  projectInbox, projectWorkOrderForActor, authorizeAttachment, recordAttachmentAccess,
  attachmentMetadata } from '../../vendor-work-orders/domain.mjs';
import { createPrivateAttachmentStore } from './r2-attachments.mjs';

const defaultOrigin = 'https://workorders-test.cmwebs.com';

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extra,
  }});
}

function publicOrigin(env) {
  return typeof env?.PUBLIC_ORIGIN === 'string' && env.PUBLIC_ORIGIN ? env.PUBLIC_ORIGIN : defaultOrigin;
}

function checkOrigin(request, origin) {
  const requestOrigin = request.headers.get('origin');
  if (requestOrigin && requestOrigin !== origin) return false;
  return true;
}

function cookies(request) {
  return String(request.headers.get('cookie') || '').split(';').map(value => value.trim()).filter(Boolean)
    .map(value => value.split('='))
    .filter(parts => parts.length >= 2)
    .map(([name, ...rest]) => [name, rest.join('=')]);
}

function cookie(request, name) {
  const values = cookies(request).filter(([key]) => key === name).map(([, value]) => value);
  return values.length === 1 ? values[0] : null;
}

function redirect(url, setCookie, status = 302) {
  const headers = { location: url, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' };
  if (setCookie) headers['set-cookie'] = setCookie;
  return new Response(null, { status, headers });
}

async function readJson(request, limit = 4096) {
  const contentType = (request.headers.get('content-type') || '').split(';')[0].trim();
  if (contentType !== 'application/json') throw Object.assign(new Error('INVALID_BODY'), { code: 'INVALID_BODY' });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > limit) throw Object.assign(new Error('BODY_TOO_LARGE'), { code: 'BODY_TOO_LARGE' });
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('INVALID_BODY'), { code: 'INVALID_BODY' }); }
}

function routeError(error) {
  const code = error?.code || 'INVALID_REQUEST';
  const status = code === 'FORBIDDEN' ? 403 : code === 'NOT_FOUND' ? 404 : code === 'SESSION_REQUIRED' ? 401 :
    ['IDEMPOTENCY_CONFLICT', 'VERSION_CONFLICT'].includes(code) ? 409 : code === 'BODY_TOO_LARGE' ? 413 : 400;
  return json({ success: false, error: code }, status);
}

const attachmentTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
function validAttachmentSignature(type, bytes) {
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (type === 'image/webp') return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return type === 'application/pdf' && new TextDecoder().decode(bytes.slice(0, 8)).match(/^%PDF-\d\.\d/u);
}

async function digestHex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export function createWorker({ env = {}, clock = Date.now, lineFetchImpl = fetch } = {}) {
  const origin = publicOrigin(env);
  const store = env.DB ? createD1StateStore({ db: env.DB, clock: () => new Date(clock()).toISOString() }) : null;
  const authStore = env.DB ? createAuthStore({ db: env.DB, clock }) : null;
  const lineConfigured = Boolean(env.LINE_CHANNEL_ID && env.LINE_CHANNEL_SECRET && env.LINE_PROVIDER_ID);
  const lineLogin = lineConfigured ? createLineLogin({ channelId: env.LINE_CHANNEL_ID,
    channelSecret: env.LINE_CHANNEL_SECRET, providerId: env.LINE_PROVIDER_ID, publicOrigin: origin }) : null;
  async function sessionActor(request) {
    if (!authStore || !store) return null;
    const sessionToken = cookie(request, 'vendor_session');
    if (!sessionToken) return null;
    const saved = await authStore.get('vendor_session', await hashToken(sessionToken));
    if (!saved?.payload?.actor) return null;
    const actor = saved.payload.actor;
    const state = await store.read();
    const active = actor.role === 'vendor' && state.partner_memberships.some(row => row.actor_id === actor.actor_id && row.workspace_id === actor.workspace_id &&
      row.partner_id === actor.partner_id && row.active === true) &&
      state.partners.some(row => row.id === actor.partner_id && row.active === true) &&
      state.workspace_partners.some(row => row.workspace_id === actor.workspace_id && row.partner_id === actor.partner_id && row.active === true);
    return active ? { actor, state } : null;
  }
  return {
    async fetch(request) {
      const url = new URL(request.url);
      if (url.origin !== origin || !checkOrigin(request, origin)) return json({ success: false, error: 'ORIGIN_REJECTED' }, 403);
      if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, service: 'vendor-work-orders' });
      if (request.method === 'GET' && url.pathname === '/auth/line/start') {
        if (!lineLogin || !authStore) return json({ success: false, error: 'LINE_NOT_CONFIGURED' }, 503);
        const inviteToken = url.searchParams.get('invite') || undefined;
        if ([...url.searchParams.keys()].some(key => key !== 'invite') || url.searchParams.getAll('invite').length > 1) {
          return json({ success: false, error: 'INVALID_AUTH_TRANSACTION' }, 400);
        }
        const browserToken = cookie(request, 'vendor_line_browser') || randomToken();
        const transaction = await lineLogin.begin({ browserToken, inviteToken });
        await authStore.put('line_browser', await hashToken(browserToken), {
          stateHash: transaction.stateHash, nonce: transaction.nonce, codeVerifier: transaction.codeVerifier,
          inviteToken: transaction.inviteToken,
        }, Date.now() + 600000);
        return redirect(transaction.authorizationUrl,
          `vendor_line_browser=${browserToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
      }
      if (request.method === 'GET' && url.pathname === '/auth/line/callback') {
        if (!lineLogin || !authStore || !store) return json({ success: false, error: 'LINE_NOT_CONFIGURED' }, 503);
        const browserToken = cookie(request, 'vendor_line_browser');
        const state = url.searchParams.get('state');
        const code = url.searchParams.get('code');
        if (!browserToken || url.searchParams.getAll('state').length !== 1 || url.searchParams.getAll('code').length !== 1 ||
            !state || !code || url.searchParams.has('error')) return json({ success: false, error: 'INVALID_AUTH_TRANSACTION' }, 400);
        const browserKey = await hashToken(browserToken);
        const saved = await authStore.get('line_browser', browserKey);
        if (!saved) return json({ success: false, error: 'INVALID_AUTH_TRANSACTION' }, 401);
        await authStore.remove(browserKey);
        let result;
        try {
          result = await lineLogin.complete({ transaction: saved.payload, code, state, fetchImpl: lineFetchImpl, now: clock });
        } catch (error) {
          const errorCode = error?.code || 'LINE_IDENTITY_REJECTED';
          const status = errorCode === 'INVALID_AUTH_TRANSACTION' ? 400 : 502;
          return json({ success: false, error: errorCode }, status);
        }
        const stateSnapshot = await store.read();
        const actorId = `line-${await sha256Hex(JSON.stringify([result.identity.provider_id, result.identity.subject]))}`;
        const memberships = stateSnapshot.partner_memberships.filter(row => row.actor_id === actorId && row.active === true);
        if (memberships.length !== 1) return json({ success: false, error: 'LINE_MEMBERSHIP_REQUIRED' }, 403);
        const membership = memberships[0];
        const sessionToken = randomToken();
        await authStore.put('vendor_session', await hashToken(sessionToken), { actor: {
          role: 'vendor', actor_id: actorId, workspace_id: membership.workspace_id, partner_id: membership.partner_id,
        } }, Number(clock()) + 8 * 60 * 60 * 1000);
        return redirect(`${origin}/`, `vendor_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`, 303);
      }
      if (request.method === 'GET' && url.pathname === '/api/line/status') {
        const channelId = typeof env.LINE_CHANNEL_ID === 'string' ? env.LINE_CHANNEL_ID : '';
        const configured = Boolean(channelId && env.LINE_CHANNEL_SECRET);
        return json({ success: true, data: {
          login_ready: configured,
          channel_id: channelId || null,
          public_origin: origin,
          notification_ready: false,
          reason: configured ? '登入已設定，LINE 通知仍關閉' : '尚未設定獨立 LINE Login 密鑰',
        }});
      }
      if (request.method === 'GET' && url.pathname === '/api/session') {
        if (!authStore || !store) return json({ success: false, error: 'SESSION_REQUIRED' }, 401);
        const sessionToken = cookie(request, 'vendor_session');
        if (!sessionToken) return json({ success: false, error: 'SESSION_REQUIRED' }, 401);
        const saved = await authStore.get('vendor_session', await hashToken(sessionToken));
        if (!saved?.payload?.actor) return json({ success: false, error: 'SESSION_REQUIRED' }, 401);
        const actor = saved.payload.actor;
        const state = await store.read();
        const active = state.partner_memberships.some(row => row.actor_id === actor.actor_id && row.workspace_id === actor.workspace_id &&
          row.partner_id === actor.partner_id && row.active === true) &&
          state.partners.some(row => row.id === actor.partner_id && row.active === true) &&
          state.workspace_partners.some(row => row.workspace_id === actor.workspace_id && row.partner_id === actor.partner_id && row.active === true);
        if (!active) return json({ success: false, error: 'SESSION_REQUIRED' }, 401);
        return json({ success: true, data: { actor } });
      }
      const orderMatch = /^\/api\/work-orders\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
      if (request.method === 'GET' && (url.pathname === '/api/work-orders' || url.pathname === '/api/inbox' || orderMatch)) {
        const session = await sessionActor(request);
        if (!session) return json({ success: false, error: 'SESSION_REQUIRED' }, 401);
        try {
          if (url.pathname === '/api/inbox') return json({ success: true, data: projectInbox(session.state, session.actor) });
          if (orderMatch) return json({ success: true, data: projectWorkOrderForActor(session.state, session.actor, orderMatch[1]) });
          projectInbox(session.state, session.actor);
          const data = session.state.work_orders.filter(row => row.workspace_id === session.actor.workspace_id).flatMap(row => {
            try { return [projectWorkOrderForActor(session.state, session.actor, row.id)]; } catch (error) { return error.code === 'FORBIDDEN' ? [] : (() => { throw error; })(); }
          });
          return json({ success: true, data });
        } catch (error) {
          return json({ success: false, error: error.code === 'FORBIDDEN' ? 'FORBIDDEN' : error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'INVALID_REQUEST' }, error.code === 'FORBIDDEN' ? 403 : error.code === 'NOT_FOUND' ? 404 : 400);
        }
      }
      const assignmentActionMatch = /^\/api\/assignments\/([A-Za-z0-9_-]+)\/(accept|start|completion|supplements)$/.exec(url.pathname);
      if (request.method === 'POST' && assignmentActionMatch) {
        const session = await sessionActor(request);
        if (!session) return json({ success: false, error: 'SESSION_REQUIRED' }, 401);
        const action = ({ accept: 'accept-assignment', start: 'start', completion: 'complete', supplements: 'request-supplement' })[assignmentActionMatch[2]];
        const key = request.headers.get('idempotency-key');
        if (!key || !/^[\x21-\x7e]{1,128}$/u.test(key)) return json({ success: false, error: 'IDEMPOTENCY_KEY_REQUIRED' }, 400);
        try {
          const body = await readJson(request);
          const input = normalizeWorkOrderInput(action, body);
          const resource = { assignment_id: assignmentActionMatch[1] };
          const scope = JSON.stringify([session.actor.workspace_id, session.actor.actor_id, action, resource]);
          const normalizedBody = JSON.stringify(input);
          let data;
          await store.transact(state => {
            authorizeWorkOrderAction(state, session.actor, action, resource);
            const previous = state.idempotency_records.find(row => row.scope === scope && row.key === key);
            if (previous) {
              if (previous.normalized_body !== normalizedBody) throw Object.assign(new Error('IDEMPOTENCY_CONFLICT'), { code: 'IDEMPOTENCY_CONFLICT' });
              data = structuredClone(previous.result);
              return state;
            }
            const assignment = state.assignments.find(row => row.id === resource.assignment_id && row.workspace_id === session.actor.workspace_id);
            if (!assignment) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
            const mutation = transitionWorkOrder(state, session.actor, action,
              { ...input, ...resource, work_order_id: assignment.work_order_id }, new Date(clock()).toISOString());
            data = projectWorkOrderForActor(mutation.state, session.actor, assignment.work_order_id);
            mutation.state.idempotency_records.push({ id: randomToken(), workspace_id: session.actor.workspace_id,
              actor_id: session.actor.actor_id, scope, key, normalized_body: normalizedBody, result: structuredClone(data) });
            return mutation.state;
          });
          return json({ success: true, data });
        } catch (error) { return routeError(error); }
      }
      const uploadMatch = /^\/api\/work-orders\/([A-Za-z0-9_-]+)\/attachments$/.exec(url.pathname);
      const downloadMatch = /^\/api\/attachments\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
      if ((request.method === 'POST' && uploadMatch) || (request.method === 'GET' && downloadMatch)) {
        const session = await sessionActor(request);
        if (!session) return json({ success: false, error: 'SESSION_REQUIRED' }, 401);
        if (!env.ATTACHMENTS) return json({ success: false, error: 'ATTACHMENTS_NOT_CONFIGURED' }, 503);
        const attachments = createPrivateAttachmentStore({ bucket: env.ATTACHMENTS });
        try {
          if (uploadMatch) {
            const contentType = (request.headers.get('content-type') || '').split(';')[0].trim();
            const fileName = request.headers.get('x-file-name');
            const versionHeader = request.headers.get('x-work-order-version');
            const key = request.headers.get('idempotency-key');
            if (!attachmentTypes.has(contentType) || fileName && (!fileName.trim() || /[/\\%\u0000-\u001f\u007f]/u.test(fileName)) ||
                !versionHeader || !/^[1-9]\d*$/u.test(versionHeader) || !key || !/^[\x21-\x7e]{1,128}$/u.test(key)) {
              return json({ success: false, error: 'INVALID_ATTACHMENT' }, 400);
            }
            const bytes = new Uint8Array(await request.arrayBuffer());
            if (bytes.byteLength > 10 * 1024 * 1024 || !bytes.byteLength || !validAttachmentSignature(contentType, bytes)) {
              return json({ success: false, error: 'INVALID_ATTACHMENT' }, 400);
            }
            const expectedVersion = Number(versionHeader);
            const state = session.state;
            const order = authorizeAttachment(state, session.actor, uploadMatch[1], true);
            if (order.version !== expectedVersion) return json({ success: false, error: 'VERSION_CONFLICT' }, 409);
            const id = randomToken();
            const metadata = { content_type: contentType, size_bytes: bytes.byteLength, sha256: await digestHex(bytes) };
            await attachments.put({ id, bytes, contentType });
            let data;
            try {
              await store.transact(current => {
                authorizeAttachment(current, session.actor, uploadMatch[1], true);
                const mutation = recordAttachmentAccess(current, session.actor, 'attachment-upload', uploadMatch[1], id,
                  new Date(clock()).toISOString(), metadata, expectedVersion);
                data = attachmentMetadata(mutation.state.private_attachments.at(-1));
                return mutation.state;
              });
            } catch (error) {
              await attachments.delete(id);
              throw error;
            }
            return json({ success: true, data });
          }
          const state = session.state;
          const metadata = state.private_attachments.find(row => row.id === downloadMatch[1]);
          if (!metadata) return json({ success: false, error: 'NOT_FOUND' }, 404);
          authorizeAttachment(state, session.actor, metadata.work_order_id, false);
          const object = await attachments.get(metadata.id);
          if (!object) return json({ success: false, error: 'NOT_FOUND' }, 404);
          return new Response(object.body, { status: 200, headers: { 'content-type': metadata.content_type,
            'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-disposition': `attachment; filename="${metadata.id}"` } });
        } catch (error) { return routeError(error); }
      }
      if (request.method === 'POST' && url.pathname === '/api/line/webhook') {
        if (!env.LINE_CHANNEL_SECRET || !env.LINE_PROVIDER_ID || !store) return json({ success: false, error: 'LINE_WEBHOOK_NOT_CONFIGURED' }, 503);
        const raw = await request.text();
        const signature = request.headers.get('x-line-signature') || '';
        if (!(await verifyLineWebhook(raw, signature, env.LINE_CHANNEL_SECRET))) return json({ success: false, error: 'INVALID_WEBHOOK_SIGNATURE' }, 401);
        let payload;
        try { payload = JSON.parse(raw); } catch { return json({ success: false, error: 'INVALID_BODY' }, 400); }
        if (!payload || typeof payload !== 'object' || !Array.isArray(payload.events)) return json({ success: false, error: 'INVALID_WEBHOOK_EVENT' }, 400);
        const events = payload.events.map(event => ({ ...event, provider_id: env.LINE_PROVIDER_ID }));
        await store.transact(state => applyWebhookEvents(state, events, Number(clock())));
        return json({ success: true, data: { accepted_events: events.length } });
      }
      if (request.method === 'GET' && url.pathname === '/api/cloud/state') {
        if (!store) return json({ success: false, error: 'D1_NOT_CONFIGURED' }, 503);
        const state = await store.read();
        return json({ success: true, data: { schema_version: state.schema_version, table_counts: Object.fromEntries(Object.entries(state).filter(([key]) => key !== 'schema_version').map(([key, rows]) => [key, rows.length])) } });
      }
      if (request.method === 'GET' && env.ASSETS && typeof env.ASSETS.fetch === 'function') return env.ASSETS.fetch(request);
      return json({ success: false, error: 'NOT_FOUND' }, 404);
    },
  };
}

export default {
  fetch(request, env, ctx) {
    return createWorker({ env }).fetch(request, env, ctx);
  },
};
