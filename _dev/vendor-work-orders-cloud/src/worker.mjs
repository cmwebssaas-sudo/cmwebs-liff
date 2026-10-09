import { createBindingInvite, requestBinding, approveBinding, revokeBindingInvite } from '../../vendor-work-orders/line-binding.mjs';
import { authorizedActor } from './session-policy.mjs';
import { createD1StateStore } from './d1-state-store.mjs';
import { createAuthStore } from './auth-store.mjs';
import { createLineLogin, hashToken, randomToken, sha256Hex } from './line-auth-worker.mjs';
import { verifyLineWebhook } from './line-crypto.mjs';
import { applyWebhookEvents } from '../../vendor-work-orders/line-webhook.mjs';
import { normalizeWorkOrderInput, authorizeWorkOrderAction, transitionWorkOrder,
  projectInbox, projectWorkOrderForActor, authorizeAttachment, recordAttachmentAccess,
  attachmentMetadata, normalizeMemberId, normalizeDirectoryInput, mutateDirectory, projectDirectory } from '../../vendor-work-orders/domain.mjs';
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
  const reader = request.body?.getReader(); if (!reader) fail('INVALID_BODY');
  const chunks = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); fail('BODY_TOO_LARGE'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const raw = new TextDecoder().decode(bytes);
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('INVALID_BODY'), { code: 'INVALID_BODY' }); }
}

function fail(code) { throw Object.assign(new Error(code), { code }); }

function routeError(error) {
  const codes = new Set(['ALREADY_BOUND', 'ALREADY_EXISTS', 'BODY_TOO_LARGE', 'FORBIDDEN', 'IDEMPOTENCY_CONFLICT', 'IDEMPOTENCY_KEY_REQUIRED', 'INVALID_ACCEPTANCE', 'INVALID_ACTION', 'INVALID_ACTOR', 'INVALID_AGREEMENT', 'INVALID_AMOUNT', 'INVALID_ASSIGNEE', 'INVALID_ATTACHMENT', 'INVALID_BODY', 'INVALID_IDENTITY', 'INVALID_INPUT', 'INVALID_INVITE', 'INVALID_MEMBER', 'INVALID_PARTNER', 'INVALID_PRIORITY', 'INVALID_QUOTE', 'INVALID_TIME', 'INVALID_TRADE', 'INVALID_TRANSITION', 'INVITATION_EXPIRED', 'INVITE_EXPIRED', 'INVITE_REVOKED', 'INVITE_USED', 'NOT_FOUND', 'NO_CANDIDATE', 'PARALLEL_CHOICE_REQUIRED', 'PRIORITY_CONFLICT', 'QUOTE_AWAITING_APPROVAL', 'QUOTE_EXPIRED', 'QUOTE_NOT_APPROVED', 'QUOTE_REQUIRED', 'SESSION_REQUIRED', 'SUPPLEMENT_REQUIRED', 'VERSION_CONFLICT']);
  const code = codes.has(error?.code) ? error.code : 'INTERNAL_ERROR';
  const status = code === 'INTERNAL_ERROR' ? 500 : code === 'FORBIDDEN' ? 403 : code === 'NOT_FOUND' ? 404 : code === 'SESSION_REQUIRED' ? 401 :
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
    const current = authorizedActor(state, actor);
    return current ? { actor: current, state } : null;
  }
  return {
    async fetch(request) {
      try {
      const url = new URL(request.url);
      if (url.origin !== origin || !checkOrigin(request, origin)) return json({ success: false, error: 'ORIGIN_REJECTED' }, 403);
      if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, service: 'vendor-work-orders' });
      if (request.method === 'GET' && url.pathname === '/auth/line/start') {
        if (!lineLogin || !authStore) return json({ success: false, error: 'LINE_NOT_CONFIGURED' }, 503);
        const inviteToken = url.searchParams.get('invite') || undefined;
        if ([...url.searchParams.keys()].some(key => key !== 'invite') || url.searchParams.getAll('invite').length > 1) {
          return json({ success: false, error: 'INVALID_AUTH_TRANSACTION' }, 400);
        }
        if (inviteToken) {
          const snapshot = await store.read();
          const inviteHash = await sha256Hex(inviteToken);
          const invite = snapshot.line_binding_invites.find(row => row.token_hash === inviteHash);
          if (!invite || invite.status !== 'pending' || invite.expires_at <= clock()) fail('INVALID_INVITE');
        }
        const browserToken = cookie(request, 'vendor_line_browser') || randomToken();
        const transaction = await lineLogin.begin({ browserToken, inviteToken });
        await authStore.put('line_browser', await hashToken(browserToken), {
          stateHash: transaction.stateHash, nonce: transaction.nonce, codeVerifier: transaction.codeVerifier,
          inviteToken: transaction.inviteToken,
        }, Number(clock()) + 600000);
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
        if (result.inviteToken) {
          await authStore.put('line_pending', browserKey, { inviteToken: result.inviteToken, identity: result.identity, csrf: randomToken() }, Number(clock()) + 600000);
          return redirect(`${origin}/?line=binding`, null, 303);
        }
        const actorId = `line-${await sha256Hex(JSON.stringify([result.identity.provider_id, result.identity.subject]))}`;
        if (/^line-[a-f0-9]{64}$/u.test(env.OWNER_ACTOR_ID || '') && env.OWNER_ACTOR_ID === actorId &&
            /^[A-Za-z0-9_-]{1,100}$/u.test(env.OWNER_WORKSPACE_ID || '')) {
          await store.transact(snapshot => {
            if (!snapshot.workspace_memberships.some(row => row.actor_id === actorId && row.workspace_id === env.OWNER_WORKSPACE_ID)) {
              snapshot.workspace_memberships.push({ id: randomToken(), actor_id: actorId, workspace_id: env.OWNER_WORKSPACE_ID,
                active: true, permissions: ['work_order_read', 'work_order_dispatch', 'work_order_approve', 'work_order_accept'] });
            }
            return snapshot;
          });
        }
        const stateSnapshot = await store.read();
        const landlords = stateSnapshot.workspace_memberships.filter(row => row.actor_id === actorId && row.active === true);
        const memberships = stateSnapshot.partner_memberships.filter(row => row.actor_id === actorId && row.active === true);
        const actor = landlords.length === 1 ? { role: 'landlord', actor_id: actorId, workspace_id: landlords[0].workspace_id }
          : memberships.length === 1 ? { role: 'vendor', actor_id: actorId, workspace_id: memberships[0].workspace_id, partner_id: memberships[0].partner_id } : null;
        if (!authorizedActor(stateSnapshot, actor)) return json({ success: false, error: 'LINE_MEMBERSHIP_REQUIRED' }, 403);
        const sessionToken = randomToken();
        await authStore.put('vendor_session', await hashToken(sessionToken), { actor }, Number(clock()) + 8 * 60 * 60 * 1000);
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
        const session = await sessionActor(request);
        if (!session) return json({ success: false, error: 'SESSION_REQUIRED' }, 401);
        return json({ success: true, data: { actor: session.actor } });
      }
      if (['/api/line/pending', '/api/line/confirm'].includes(url.pathname)) {
        const token = cookie(request, 'vendor_line_browser');
        const saved = token && await authStore.get('line_pending', await hashToken(token));
        if (!saved) fail('SESSION_REQUIRED');
        const draft = saved.payload, snapshot = await store.read();
        const inviteHash = await sha256Hex(draft.inviteToken);
        const invite = snapshot.line_binding_invites.find(row => row.token_hash === inviteHash);
        if (!invite || invite.status === 'revoked' || invite.expires_at <= clock()) fail('INVALID_INVITE');
        const priorRequest = current => current.line_binding_requests.find(row => row.invite_id === invite.id &&
          row.identity?.provider_id === draft.identity.provider_id && row.identity?.subject === draft.identity.subject);
        if (request.method === 'GET' && url.pathname === '/api/line/pending') return json({ success: true, data: {
          partner_name: snapshot.partners.find(row => row.id === invite.partner_id)?.name,
          member_role: invite.member_role, csrf: draft.csrf, status: priorRequest(snapshot)?.status || 'confirmation_required' } });
        if (request.method === 'POST' && url.pathname === '/api/line/confirm') {
          const body = await readJson(request);
          if (!body || Object.keys(body).length !== 1 || body.csrf !== draft.csrf) fail('FORBIDDEN');
          await store.transact(current => {
            const currentInvite = current.line_binding_invites.find(row => row.id === invite.id);
            if (!currentInvite || currentInvite.status === 'revoked' || currentInvite.expires_at <= clock()) fail('INVALID_INVITE');
            if (priorRequest(current)) return current;
            return requestBinding(current, { token: draft.inviteToken, verified_identity: draft.identity }, Number(clock())).state;
          });
          return json({ success: true, data: { status: 'awaiting_approval' } });
        }
        fail('NOT_FOUND');
      }
      const bindingAction = /^\/api\/line\/(bindings|invites)\/([A-Za-z0-9_-]+)\/(approve|revoke)$/.exec(url.pathname);
      if (url.pathname === '/api/line/bindings' && request.method === 'GET' ||
          url.pathname === '/api/line/invites' && request.method === 'POST' || bindingAction && request.method === 'POST') {
        const session = await sessionActor(request);
        if (!session) fail('SESSION_REQUIRED');
        const actor = session.actor;
        const authorized = state => {
          const m = state.workspace_memberships.find(m => m.active === true && m.actor_id === actor.actor_id && m.workspace_id === actor.workspace_id);
          if (actor.role !== 'landlord' || !m?.permissions.includes('work_order_dispatch')) fail('FORBIDDEN', 403);
        };
        authorized(session.state);
        if (request.method === 'GET') {
          const s = session.state;
          const redact = ({ token_hash, identity, ...row }) => row;
          return json({ success: true, data: { invites: s.line_binding_invites.filter(i => i.workspace_id === actor.workspace_id).map(redact),
            requests: s.line_binding_requests.filter(i => i.workspace_id === actor.workspace_id).map(redact) } });
        }
        const key = request.headers.get('idempotency-key');
        if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key)) fail('IDEMPOTENCY_KEY_REQUIRED');
        const input = await readJson(request), normalized = JSON.stringify(input);
        const scope = JSON.stringify([actor.workspace_id, actor.actor_id, url.pathname]); let data;
        await store.transact(s => {
          if (!authorizedActor(s, actor)) fail('SESSION_REQUIRED'); authorized(s);
          const prior = s.idempotency_records.find(r => r.scope === scope && r.key === key);
          // Never persist raw invitation secrets for replay recovery.
          if (prior) { if (prior.normalized_body !== normalized) fail('IDEMPOTENCY_CONFLICT', 409); data = prior.result; return s; }
          let next;
          if (!bindingAction) {
            const result = createBindingInvite(s, actor, { partner_id: input.partner_id, member_role: input.member_role }, Number(clock()));
            next = result.state; const { token_hash, ...invite } = result.invite;
            data = { invite, token: result.token };
          } else if (bindingAction[1] === 'bindings' && bindingAction[3] === 'approve') {
            const result = approveBinding(s, actor, bindingAction[2], Number(clock())); next = result.state; data = result.membership;
          } else if (bindingAction[1] === 'invites' && bindingAction[3] === 'revoke') {
            next = revokeBindingInvite(s, actor, bindingAction[2], Number(clock())); data = { revoked: true };
          } else fail('NOT_FOUND', 404);
          const { token, ...saved } = data;
          next.idempotency_records.push({ id: crypto.randomUUID(), workspace_id: actor.workspace_id, actor_id: actor.actor_id,
            scope, key, normalized_body: normalized, result: structuredClone(saved) }); return next;
        });
        return json({ success: true, data });
      }
      const orderPath = /^\/api\/work-orders\/([A-Za-z0-9_-]+)(?:\/(invitations|quote-approval|acceptance|supplement-approval))?$/.exec(url.pathname);
      const invitePath = /^\/api\/invitations\/([A-Za-z0-9_-]+)\/(quote|decline)$/.exec(url.pathname);
      const acceptPath = /^\/api\/assignments\/([A-Za-z0-9_-]+)\/(accept|start|completion|supplements)$/.exec(url.pathname);
      const orderCollection = url.pathname === '/api/work-orders';
      const inbox = url.pathname === '/api/inbox';
      const orderAction = request.method === 'POST' ? orderCollection ? 'create'
        : orderPath?.[2] === 'invitations' ? 'invite' : orderPath?.[2] === 'quote-approval' ? 'approve-quote'
          : orderPath?.[2] === 'acceptance' ? 'acceptance' : orderPath?.[2] === 'supplement-approval' ? 'approve-supplement'
          : invitePath ? invitePath[2] : acceptPath ? ({ accept: 'accept-assignment', start: 'start', completion: 'complete', supplements: 'request-supplement' })[acceptPath[2]] : null : null;
      if (orderAction || request.method === 'GET' && (orderCollection || inbox || orderPath && !orderPath[2])) {
        const session = await sessionActor(request);
        if (!session) return json({ success: false, error: 'SESSION_REQUIRED' }, 401);
        const actor = session.actor;
        if (!orderAction) {
          const state = session.state;
          let data;
          if (inbox) data = projectInbox(state, actor);
          else if (orderCollection) {
            // Check the read capability even when the collection is empty.
            projectInbox(state, actor);
            data = state.work_orders.filter(w => w.workspace_id === actor.workspace_id).flatMap(w => {
              try { return [projectWorkOrderForActor(state, actor, w.id)]; }
              catch (error) { if (error.code === 'FORBIDDEN') return []; throw error; }
            });
          } else data = projectWorkOrderForActor(state, actor, orderPath[1]);
          return json({ success: true, data });
        }
        const key = request.headers.get('idempotency-key');
        if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key)) fail('IDEMPOTENCY_KEY_REQUIRED');
        const body = await readJson(request);
        const action = orderAction === 'acceptance' ? body?.decision === 'accept' ? 'accept' : body?.decision === 'rework' ? 'rework' : null : orderAction;
        if (!action) fail('INVALID_ACCEPTANCE');
        const input = normalizeWorkOrderInput(action, body);
        const resource = orderPath ? { work_order_id: orderPath[1] } : invitePath ? { invitation_id: invitePath[1] }
          : acceptPath ? { assignment_id: acceptPath[1] } : {};
        const scope = JSON.stringify([actor.workspace_id, actor.actor_id, orderAction, resource]);
        const normalizedBody = JSON.stringify({ ...input, ...(orderAction === 'acceptance' ? { decision: action } : {}) });
        let data;
        await store.transact(state => {
          const currentActor = authorizedActor(state, actor);
          if (!currentActor) fail('SESSION_REQUIRED');
          authorizeWorkOrderAction(state, currentActor, action, resource);
          const previous = state.idempotency_records.find(r => r.scope === scope && r.key === key);
          if (previous) {
            if (previous.normalized_body !== normalizedBody) fail('IDEMPOTENCY_CONFLICT', 409);
            data = structuredClone(previous.result);
            return state;
          }
          const workOrderId = acceptPath && action !== 'accept-assignment'
            ? state.assignments.find(a => a.id === resource.assignment_id && a.workspace_id === currentActor.workspace_id)?.work_order_id : undefined;
          const mutation = transitionWorkOrder(state, currentActor, action,
            { ...input, ...resource, ...(workOrderId ? { work_order_id: workOrderId } : {}),
              ...(action === 'create' ? { id: crypto.randomUUID() } : {}) }, new Date(clock()).toISOString());
          const orderId = mutation.events[0].work_order_id;
          data = projectWorkOrderForActor(mutation.state, currentActor, orderId);
          mutation.state.idempotency_records.push({ id: crypto.randomUUID(), workspace_id: currentActor.workspace_id,
            actor_id: currentActor.actor_id, scope, key, normalized_body: normalizedBody, result: structuredClone(data) });
          return mutation.state;
        });
        return json({ success: true, data });
      }
      // Match raw url.pathname structure first, then decode only the one membership ID
      // segment. Never normalize/decode the entire route or decode an ID twice.
      const partnerPath = /^\/api\/partners\/([A-Za-z0-9_-]+)(?:\/memberships(?:\/([^/]+))?)?$/.exec(url.pathname);
      const collection = ['/api/partners', '/api/priority-rules', '/api/service-agreements'].includes(url.pathname) ? url.pathname.slice(5) : null;
      let action, resource = {};
      if (collection === 'partners' && request.method === 'POST') action = 'partner-create';
      if (partnerPath) {
        resource = { partner_id: partnerPath[1] };
        if (!url.pathname.includes('/memberships') && request.method === 'PATCH') action = 'partner-update';
        else if (url.pathname.endsWith('/memberships') && request.method === 'POST') action = 'member-create';
        else if (partnerPath[2] && request.method === 'PATCH') {
          let decoded;
          try { decoded = decodeURIComponent(partnerPath[2]); }
          catch { fail('INVALID_MEMBER'); }
          action = 'member-update'; resource.actor_id = normalizeMemberId(decoded);
        }
      }
      if (collection === 'priority-rules' && request.method === 'PUT') action = 'priority-set';
      if (collection === 'service-agreements' && request.method === 'POST') action = 'agreement-save';
      if ((collection && request.method === 'GET') || action) {
        const session = await sessionActor(request);
        if (!session) return json({ success: false, error: 'SESSION_REQUIRED' }, 401);
        const actor = session.actor;
        if (!action) {
          return json({ success: true, data: projectDirectory(session.state, actor, collection) });
        }
        const key = request.headers.get('idempotency-key');
        if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key)) fail('IDEMPOTENCY_KEY_REQUIRED');
        const input = normalizeDirectoryInput(action, await readJson(request));
        if (action === 'priority-set') resource = { property_id: input.property_id, trade: input.trade };
        if (action === 'agreement-save') resource = { agreement_id: input.agreement_id || 'new' };
        const scope = JSON.stringify([actor.workspace_id, actor.actor_id, action, resource]);
        const normalizedBody = JSON.stringify(input);
        let data;
        await store.transact(state => {
          // Refresh authorization inside the serialized commit boundary, including replays.
          const currentActor = authorizedActor(state, actor);
          if (!currentActor) fail('SESSION_REQUIRED');
          const membership = state.workspace_memberships.find(m => m.workspace_id === currentActor.workspace_id &&
            m.actor_id === currentActor.actor_id && m.active === true);
          if (currentActor.role !== 'landlord' || !membership?.permissions.includes('work_order_dispatch')) fail('FORBIDDEN', 403);
          const previous = state.idempotency_records.find(r => r.scope === scope && r.key === key);
          if (previous) {
            if (previous.normalized_body !== normalizedBody) fail('IDEMPOTENCY_CONFLICT', 409);
            data = structuredClone(previous.result);
            return state;
          }
          const mutation = mutateDirectory(state, currentActor, action, input, resource, new Date(clock()).toISOString(), crypto.randomUUID());
          data = mutation.data;
          mutation.state.idempotency_records.push({ id: crypto.randomUUID(), workspace_id: currentActor.workspace_id,
            actor_id: currentActor.actor_id, scope, key, normalized_body: normalizedBody, result: structuredClone(data) });
          return mutation.state;
        });
        return json({ success: true, data });
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
            const reader = request.body?.getReader(), chunks = []; let size = 0;
            if (!reader) fail('INVALID_ATTACHMENT');
            for (;;) {
              const { done, value } = await reader.read(); if (done) break;
              size += value.byteLength;
              if (size > 10 * 1024 * 1024) { await reader.cancel(); fail('BODY_TOO_LARGE'); }
              chunks.push(value);
            }
            const bytes = new Uint8Array(size); let offset = 0;
            for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
            if (bytes.byteLength > 10 * 1024 * 1024 || !bytes.byteLength || !validAttachmentSignature(contentType, bytes)) {
              return json({ success: false, error: 'INVALID_ATTACHMENT' }, 400);
            }
            const expectedVersion = Number(versionHeader);
            const state = session.state;
            const order = authorizeAttachment(state, session.actor, uploadMatch[1], true);
            const id = randomToken();
            const metadata = { content_type: contentType, size_bytes: bytes.byteLength, sha256: await digestHex(bytes) };
            const scope = JSON.stringify([session.actor.workspace_id, session.actor.actor_id, 'attachment-upload', uploadMatch[1]]);
            const normalizedBody = JSON.stringify({ ...metadata, expected_version: expectedVersion });
            const prior = state.idempotency_records.find(row => row.scope === scope && row.key === key);
            if (prior) {
              if (prior.normalized_body !== normalizedBody) fail('IDEMPOTENCY_CONFLICT');
              return json({ success: true, data: prior.result });
            }
            if (order.version !== expectedVersion) fail('VERSION_CONFLICT');
            await attachments.put({ id, bytes, contentType });
            let data, replayed = false;
            try {
              await store.transact(current => {
                const actor = authorizedActor(current, session.actor);
                if (!actor) fail('SESSION_REQUIRED');
                authorizeAttachment(current, actor, uploadMatch[1], true);
                const previous = current.idempotency_records.find(row => row.scope === scope && row.key === key);
                if (previous) {
                  if (previous.normalized_body !== normalizedBody) fail('IDEMPOTENCY_CONFLICT');
                  data = previous.result; replayed = true; return current;
                }
                const mutation = recordAttachmentAccess(current, actor, 'attachment-upload', uploadMatch[1], id,
                  new Date(clock()).toISOString(), metadata, expectedVersion);
                data = attachmentMetadata(mutation.private_attachments.at(-1));
                mutation.idempotency_records.push({ id: randomToken(), workspace_id: actor.workspace_id, actor_id: actor.actor_id,
                  scope, key, normalized_body: normalizedBody, result: structuredClone(data) });
                return mutation;
              });
            } catch (error) {
              await attachments.delete(id);
              throw error;
            }
            if (replayed) await attachments.delete(id);
            return json({ success: true, data });
          }
          const state = session.state;
          const metadata = state.private_attachments.find(row => row.id === downloadMatch[1]);
          if (!metadata) return json({ success: false, error: 'NOT_FOUND' }, 404);
          authorizeAttachment(state, session.actor, metadata.work_order_id, false);
          const object = await attachments.get(metadata.id);
          if (!object) return json({ success: false, error: 'NOT_FOUND' }, 404);
          await store.transact(current => {
            const actor = authorizedActor(current, session.actor); if (!actor) fail('SESSION_REQUIRED');
            authorizeAttachment(current, actor, metadata.work_order_id, false);
            const next = recordAttachmentAccess(current, actor, 'attachment-download', metadata.work_order_id, metadata.id, new Date(clock()).toISOString());
            next.work_order_events.at(-1).id = crypto.randomUUID();
            return next;
          });
          return new Response(object.body, { status: 200, headers: { 'content-type': metadata.content_type,
            'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-disposition': `attachment; filename="${metadata.id}"` } });
        } catch (error) { return routeError(error); }
      }
      if (request.method === 'POST' && url.pathname === '/api/line/webhook') {
        if (!env.LINE_MESSAGING_SECRET || !env.LINE_PROVIDER_ID || !store) return json({ success: false, error: 'LINE_WEBHOOK_NOT_CONFIGURED' }, 503);
        const raw = await request.text();
        const signature = request.headers.get('x-line-signature') || '';
        if (!(await verifyLineWebhook(raw, signature, env.LINE_MESSAGING_SECRET))) return json({ success: false, error: 'INVALID_WEBHOOK_SIGNATURE' }, 401);
        let payload;
        try { payload = JSON.parse(raw); } catch { return json({ success: false, error: 'INVALID_BODY' }, 400); }
        if (!payload || typeof payload !== 'object' || !Array.isArray(payload.events)) return json({ success: false, error: 'INVALID_WEBHOOK_EVENT' }, 400);
        const events = payload.events.map(event => ({ ...event, provider_id: env.LINE_PROVIDER_ID }));
        await store.transact(state => applyWebhookEvents(state, events, Number(clock())));
        return json({ success: true, data: { accepted_events: events.length } });
      }
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return json({ success: false, error: 'NOT_FOUND' }, 404);
      if (request.method === 'GET' && env.ASSETS && typeof env.ASSETS.fetch === 'function') return env.ASSETS.fetch(request);
      return json({ success: false, error: 'NOT_FOUND' }, 404);
      } catch (error) { return routeError(error); }
    },
  };
}

export default {
  fetch(request, env, ctx) {
    return createWorker({ env }).fetch(request, env, ctx);
  },
};
