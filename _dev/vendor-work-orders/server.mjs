import { createServer } from 'node:http';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile, mkdir, chmod, lstat, realpath, readdir, unlink, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { resolve, dirname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createWorkOrderStore } from './store.mjs';
import { createSyntheticFixtures } from './fixtures.mjs';
import { normalizeActor, normalizeMemberId, normalizeDirectoryInput, mutateDirectory, projectDirectory,
  normalizeWorkOrderInput, authorizeWorkOrderAction, transitionWorkOrder, projectWorkOrderForActor,
  projectInbox, expireDueInvitations, authorizeAttachment, attachmentMetadata, recordAttachmentAccess } from './domain.mjs';

const contexts = new WeakMap();
const hours8 = 8 * 60 * 60 * 1000;
const publicDir = join(dirname(fileURLToPath(import.meta.url)), 'public');
const blobId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const maxAttachment = 10 * 1024 * 1024;
const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
function validSignature(type, bytes) {
  if (type === 'image/jpeg') return bytes.length >= 4 && bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'));
  if (type === 'image/png') return bytes.length >= 16 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && bytes.toString('latin1', 12, 16) === 'IHDR';
  if (type === 'image/webp') return bytes.length >= 16 && bytes.toString('latin1', 0, 4) === 'RIFF' &&
    bytes.toString('latin1', 8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('latin1', 12, 16));
  return type === 'application/pdf' && /^(?:%PDF-1\.[0-7]|%PDF-2\.0)$/.test(bytes.subarray(0, 8).toString('latin1'));
}
async function attachmentBody(request) {
  const content_type = request.headers['content-type']?.split(';')[0].trim();
  const name = request.headers['x-file-name'];
  if (!Object.hasOwn(extensions, content_type || '') || name !== undefined &&
      (typeof name !== 'string' || !name.trim() || name === '.' || name === '..' || /[/\\%\u0000-\u001f\u007f]/u.test(name))) fail('INVALID_ATTACHMENT');
  if (Number(request.headers['content-length']) > maxAttachment) fail('BODY_TOO_LARGE', 413);
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxAttachment) fail('BODY_TOO_LARGE', 413);
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (!validSignature(content_type, bytes)) fail('INVALID_ATTACHMENT');
  return { bytes, content_type, size_bytes: size, sha256: createHash('sha256').update(bytes).digest('hex') };
}
function inside(parent, child) {
  const path = relative(parent, child);
  return path === '' || !path.startsWith('..') && !isAbsolute(path);
}
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/app.css', ['app.css', 'text/css; charset=utf-8']],
]);
function fail(code, status = 400) { throw Object.assign(new Error(code), { code, status }); }
function checkMembership(state, actor) {
  const active = actor.role === 'landlord'
    ? state.workspace_memberships.some(row => row.actor_id === actor.actor_id && row.workspace_id === actor.workspace_id && row.active === true)
    : state.partner_memberships.some(row => row.actor_id === actor.actor_id && row.workspace_id === actor.workspace_id &&
        row.partner_id === actor.partner_id && row.active === true) &&
      state.partners.some(row => row.id === actor.partner_id && row.active === true) &&
      state.workspace_partners.some(row => row.workspace_id === actor.workspace_id && row.partner_id === actor.partner_id && row.active === true);
  if (!active) fail('FORBIDDEN', 403);
}

/** Trusted session only: request bodies never supply actor authority. */
export function requireSession(request) {
  const context = contexts.get(request);
  const cookies = String(request.headers.cookie || '').split(';').map(value => value.trim());
  const tokens = cookies.filter(value => value.startsWith('vendor_session='));
  if (!context || tokens.length !== 1) fail('SESSION_REQUIRED', 401);
  const token = tokens[0].slice('vendor_session='.length);
  const session = context.sessions.get(token);
  if (!session || session.expiresAt <= context.now()) {
    context.sessions.delete(token);
    fail('SESSION_REQUIRED', 401);
  }
  checkMembership(context.state, session.actor);
  return structuredClone(session.actor);
}

async function jsonBody(request) {
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') fail('INVALID_BODY');
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4096) fail('BODY_TOO_LARGE', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { fail('INVALID_BODY'); }
}

export function createVendorWorkOrderServer(options = {}) {
  const { host = '127.0.0.1', port = 0, dataFile = resolve('.codex-local/vendor-work-orders/state.json'),
    clock = Date.now, developmentMode = false } = options;
  if (host !== '127.0.0.1') fail('LOOPBACK_ONLY');
  if (!Number.isInteger(port) || port < 0 || port > 65535) fail('INVALID_PORT');
  const store = createWorkOrderStore({ filePath: dataFile });
  const privateDir = resolve(options.attachmentDir || join(dirname(resolve(dataFile)), 'attachments'));
  if (inside(publicDir, privateDir) || inside(privateDir, publicDir)) fail('INVALID_ATTACHMENT_STORAGE');
  async function prepareAttachments() {
    await mkdir(privateDir, { recursive: true, mode: 0o700 });
    if (!(await lstat(privateDir)).isDirectory()) fail('INVALID_ATTACHMENT_STORAGE');
    const canonical = await realpath(privateDir);
    const staticRoot = join(await realpath(dirname(publicDir)), 'public');
    if (inside(staticRoot, canonical) || inside(canonical, staticRoot)) fail('INVALID_ATTACHMENT_STORAGE');
    await chmod(privateDir, 0o700);
    const state = await store.readSnapshot();
    const referenced = new Set(state.private_attachments.map(a => a.id));
    // A single local writer owns this directory, as it owns the JSON snapshot.
    // Recovery deletes only our opaque orphan IDs; operator files are preserved.
    for (const id of await readdir(privateDir)) {
      if (blobId.test(id) && !referenced.has(id)) await unlink(join(privateDir, id));
    }
  }
  const sessions = new Map();
  const bootstrapKeys = new Map();
  const fixtures = createSyntheticFixtures();
  const now = () => {
    const value = Number(clock());
    if (!Number.isFinite(value)) fail('INTERNAL_ERROR', 500);
    return value;
  };
  const server = createServer(async (request, response) => {
    const request_id = randomUUID();
    const send = (status, data) => {
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      response.end(JSON.stringify({ ...data, request_id }));
    };
    try {
      const authority = `127.0.0.1:${server.address().port}`;
      if (request.headers.host !== authority) fail('LOOPBACK_REQUIRED', 403);
      if (request.headers.origin !== undefined && request.headers.origin !== `http://${authority}`) fail('ORIGIN_REJECTED', 403);
      const path = request.url?.split('?')[0];
      // Compare raw paths with exact allowlists, without URL normalization.
      if (request.method === 'GET' && assets.has(path)) {
        const [file, type] = assets.get(path);
        let bytes;
        try { bytes = await readFile(join(publicDir, file)); }
        catch (error) { if (error.code === 'ENOENT') fail('NOT_FOUND', 404); throw error; }
        response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store',
          'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'self'; frame-ancestors 'none'" });
        response.end(bytes);
        return;
      }
      if (path === '/api/dev/session' && request.method === 'POST' && developmentMode === true) {
        const key = request.headers['idempotency-key'];
        if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key)) fail('IDEMPOTENCY_KEY_REQUIRED');
        const body = await jsonBody(request);
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 ||
            typeof body.principal !== 'string' || !Object.hasOwn(fixtures.principals, body.principal)) fail('INVALID_PRINCIPAL');
        const time = now();
        for (const [token, session] of sessions) if (session.expiresAt <= time) sessions.delete(token);
        for (const [savedKey, saved] of bootstrapKeys) if (saved.expiresAt <= time) bootstrapKeys.delete(savedKey);
        const prior = bootstrapKeys.get(key);
        if (prior && prior.principal !== body.principal) fail('IDEMPOTENCY_CONFLICT', 409);
        checkMembership(await store.readSnapshot(), fixtures.principals[body.principal]);
        const session = prior || (() => {
          const token = randomBytes(32).toString('hex');
          const actor = normalizeActor(fixtures.principals[body.principal]);
          const expiresAt = time + hours8;
          sessions.set(token, { actor, expiresAt });
          return { principal: body.principal, token, expiresAt, actor,
            cookie: `vendor_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800; Expires=${new Date(expiresAt).toUTCString()}` };
        })();
        bootstrapKeys.set(key, session);
        response.setHeader('set-cookie', session.cookie);
        send(200, { success: true, data: { actor: session.actor } });
        return;
      }
      if (path === '/api/session' && request.method === 'GET') {
        contexts.set(request, { sessions, now, state: await store.readSnapshot() });
        send(200, { success: true, data: { actor: requireSession(request) } });
        return;
      }
      const uploadPath = /^\/api\/work-orders\/([A-Za-z0-9_-]+)\/attachments$/.exec(path);
      const downloadPath = /^\/api\/attachments\/([0-9a-f-]+)$/.exec(path);
      if (request.method === 'POST' && uploadPath || request.method === 'GET' && downloadPath && blobId.test(downloadPath[1])) {
        contexts.set(request, { sessions, now, state: await store.readSnapshot() });
        const actor = requireSession(request);
        if (uploadPath) {
          authorizeAttachment(contexts.get(request).state, actor, uploadPath[1], true);
          const key = request.headers['idempotency-key'];
          if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key)) fail('IDEMPOTENCY_KEY_REQUIRED');
          const versionHeader = request.headers['x-work-order-version'];
          if (typeof versionHeader !== 'string' || !/^[1-9][0-9]*$/.test(versionHeader) || !Number.isSafeInteger(Number(versionHeader))) fail('VERSION_CONFLICT');
          const expectedVersion = Number(versionHeader);
          const body = await attachmentBody(request);
          const normalized_body = JSON.stringify({ content_type: body.content_type, size_bytes: body.size_bytes,
            sha256: body.sha256, expected_version: expectedVersion });
          const scope = JSON.stringify([actor.workspace_id, actor.actor_id, 'attachment-upload', uploadPath[1]]);
          let data, written;
          try {
            await store.transact(async state => {
              contexts.set(request, { sessions, now, state });
              const currentActor = requireSession(request);
              const order = authorizeAttachment(state, currentActor, uploadPath[1], true);
              const previous = state.idempotency_records.find(r => r.scope === scope && r.key === key);
              if (previous) {
                if (previous.normalized_body !== normalized_body) fail('IDEMPOTENCY_CONFLICT', 409);
                data = structuredClone(previous.result);
                return state;
              }
              if (order.version !== expectedVersion) fail('VERSION_CONFLICT');
              const id = randomUUID();
              const next = recordAttachmentAccess(state, currentActor, 'attachment-upload', order.id, id,
                new Date(now()).toISOString(), body, expectedVersion);
              data = attachmentMetadata(next.private_attachments.at(-1));
              next.idempotency_records.push({ id: randomUUID(), workspace_id: currentActor.workspace_id,
                actor_id: currentActor.actor_id, scope, key, normalized_body, result: structuredClone(data) });
              const handle = await open(join(privateDir, id), 'wx', 0o600);
              written = join(privateDir, id);
              try { await handle.writeFile(body.bytes); await handle.sync(); }
              finally { await handle.close(); }
              return next;
            });
          } catch (error) {
            if (written) await unlink(written);
            throw error;
          }
          send(200, { success: true, data });
        } else {
          let handle, metadata;
          try {
            await store.transact(async state => {
              contexts.set(request, { sessions, now, state });
              const currentActor = requireSession(request);
              metadata = state.private_attachments.find(a => a.id === downloadPath[1] && a.workspace_id === currentActor.workspace_id);
              if (!metadata) fail('NOT_FOUND', 404);
              authorizeAttachment(state, currentActor, metadata.work_order_id);
              if (!Object.hasOwn(extensions, metadata.content_type)) fail('INTERNAL_ERROR', 500);
              handle = await open(join(privateDir, metadata.id), constants.O_RDONLY | constants.O_NOFOLLOW);
              const stat = await handle.stat();
              if (!stat.isFile() || stat.size !== metadata.size_bytes || stat.size > maxAttachment) fail('INTERNAL_ERROR', 500);
              const hash = createHash('sha256');
              for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk);
              if (hash.digest('hex') !== metadata.sha256) fail('INTERNAL_ERROR', 500);
              return recordAttachmentAccess(state, currentActor, 'attachment-download', metadata.work_order_id,
                randomUUID(), new Date(now()).toISOString(), { attachment_id: metadata.id });
            });
            // No headers or bytes escape before the read audit has committed.
            response.writeHead(200, { 'content-type': metadata.content_type, 'content-length': metadata.size_bytes,
              'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
              'content-disposition': `attachment; filename="${metadata.id}.${extensions[metadata.content_type]}"`,
              'content-security-policy': "default-src 'none'; sandbox" });
            await pipeline(handle.createReadStream({ start: 0, autoClose: false }), response);
          } finally { await handle?.close(); }
        }
        return;
      }
      const orderPath = /^\/api\/work-orders\/([A-Za-z0-9_-]+)(?:\/(invitations|quote-approval|acceptance|supplement-approval))?$/.exec(path);
      const invitePath = /^\/api\/invitations\/([A-Za-z0-9_-]+)\/(quote|decline)$/.exec(path);
      const acceptPath = /^\/api\/assignments\/([A-Za-z0-9_-]+)\/(accept|start|completion|supplements)$/.exec(path);
      const orderCollection = path === '/api/work-orders';
      const inbox = path === '/api/inbox';
      const orderAction = request.method === 'POST' ? orderCollection ? 'create'
        : orderPath?.[2] === 'invitations' ? 'invite' : orderPath?.[2] === 'quote-approval' ? 'approve-quote'
          : orderPath?.[2] === 'acceptance' ? 'acceptance' : orderPath?.[2] === 'supplement-approval' ? 'approve-supplement'
          : invitePath ? invitePath[2] : acceptPath ? ({ accept: 'accept-assignment', start: 'start', completion: 'complete', supplements: 'request-supplement' })[acceptPath[2]] : null : null;
      if (orderAction || request.method === 'GET' && (orderCollection || inbox || orderPath && !orderPath[2])) {
        contexts.set(request, { sessions, now, state: await store.readSnapshot() });
        const actor = requireSession(request);
        if (!orderAction) {
          const state = contexts.get(request).state;
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
          send(200, { success: true, data });
          return;
        }
        const key = request.headers['idempotency-key'];
        if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key)) fail('IDEMPOTENCY_KEY_REQUIRED');
        const body = await jsonBody(request);
        const action = orderAction === 'acceptance' ? body?.decision === 'accept' ? 'accept' : body?.decision === 'rework' ? 'rework' : null : orderAction;
        if (!action) fail('INVALID_ACCEPTANCE');
        const input = normalizeWorkOrderInput(action, body);
        const resource = orderPath ? { work_order_id: orderPath[1] } : invitePath ? { invitation_id: invitePath[1] }
          : acceptPath ? { assignment_id: acceptPath[1] } : {};
        const scope = JSON.stringify([actor.workspace_id, actor.actor_id, orderAction, resource]);
        const normalizedBody = JSON.stringify({ ...input, ...(orderAction === 'acceptance' ? { decision: action } : {}) });
        let data;
        await store.transact(state => {
          contexts.set(request, { sessions, now, state });
          const currentActor = requireSession(request);
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
              ...(action === 'create' ? { id: randomUUID() } : {}) }, new Date(now()).toISOString());
          const orderId = mutation.events[0].work_order_id;
          data = projectWorkOrderForActor(mutation.state, currentActor, orderId);
          mutation.state.idempotency_records.push({ id: randomUUID(), workspace_id: currentActor.workspace_id,
            actor_id: currentActor.actor_id, scope, key, normalized_body: normalizedBody, result: structuredClone(data) });
          return mutation.state;
        });
        send(200, { success: true, data });
        return;
      }
      // Match raw path structure first, then decode only the one membership ID
      // segment. Never normalize/decode the entire route or decode an ID twice.
      const partnerPath = /^\/api\/partners\/([A-Za-z0-9_-]+)(?:\/memberships(?:\/([^/]+))?)?$/.exec(path);
      const collection = ['/api/partners', '/api/priority-rules', '/api/service-agreements'].includes(path) ? path.slice(5) : null;
      let action, resource = {};
      if (collection === 'partners' && request.method === 'POST') action = 'partner-create';
      if (partnerPath) {
        resource = { partner_id: partnerPath[1] };
        if (!path.includes('/memberships') && request.method === 'PATCH') action = 'partner-update';
        else if (path.endsWith('/memberships') && request.method === 'POST') action = 'member-create';
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
        contexts.set(request, { sessions, now, state: await store.readSnapshot() });
        const actor = requireSession(request);
        if (!action) {
          send(200, { success: true, data: projectDirectory(contexts.get(request).state, actor, collection) });
          return;
        }
        const key = request.headers['idempotency-key'];
        if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key)) fail('IDEMPOTENCY_KEY_REQUIRED');
        const input = normalizeDirectoryInput(action, await jsonBody(request));
        if (action === 'priority-set') resource = { property_id: input.property_id, trade: input.trade };
        if (action === 'agreement-save') resource = { agreement_id: input.agreement_id || 'new' };
        const scope = JSON.stringify([actor.workspace_id, actor.actor_id, action, resource]);
        const normalizedBody = JSON.stringify(input);
        let data;
        await store.transact(state => {
          // Refresh authorization inside the serialized commit boundary, including replays.
          contexts.set(request, { sessions, now, state });
          const currentActor = requireSession(request);
          const membership = state.workspace_memberships.find(m => m.workspace_id === currentActor.workspace_id &&
            m.actor_id === currentActor.actor_id && m.active === true);
          if (currentActor.role !== 'landlord' || !membership?.permissions.includes('work_order_dispatch')) fail('FORBIDDEN', 403);
          const previous = state.idempotency_records.find(r => r.scope === scope && r.key === key);
          if (previous) {
            if (previous.normalized_body !== normalizedBody) fail('IDEMPOTENCY_CONFLICT', 409);
            data = structuredClone(previous.result);
            return state;
          }
          const mutation = mutateDirectory(state, currentActor, action, input, resource, new Date(now()).toISOString(), randomUUID());
          data = mutation.data;
          mutation.state.idempotency_records.push({ id: randomUUID(), workspace_id: currentActor.workspace_id,
            actor_id: currentActor.actor_id, scope, key, normalized_body: normalizedBody, result: structuredClone(data) });
          return mutation.state;
        });
        send(200, { success: true, data });
        return;
      }
      fail('NOT_FOUND', 404);
    } catch (error) {
      if (response.headersSent) { response.destroy(); return; }
      // Only explicit safe protocol codes are returned. Never forward error.message.
      const codes = new Set(['LOOPBACK_REQUIRED', 'ORIGIN_REJECTED', 'NOT_FOUND', 'SESSION_REQUIRED',
        'INVALID_BODY', 'BODY_TOO_LARGE', 'INVALID_PRINCIPAL', 'IDEMPOTENCY_KEY_REQUIRED', 'IDEMPOTENCY_CONFLICT', 'FORBIDDEN',
        'INVALID_INPUT', 'INVALID_PARTNER', 'INVALID_MEMBER', 'INVALID_TRADE', 'INVALID_PRIORITY', 'PRIORITY_CONFLICT',
        'INVALID_AGREEMENT', 'INVALID_AMOUNT', 'ALREADY_EXISTS', 'VERSION_CONFLICT', 'INVALID_TRANSITION',
        'INVALID_QUOTE', 'QUOTE_NOT_APPROVED', 'QUOTE_EXPIRED', 'INVITATION_EXPIRED', 'NO_CANDIDATE',
        'QUOTE_AWAITING_APPROVAL', 'PARALLEL_CHOICE_REQUIRED', 'SUPPLEMENT_REQUIRED', 'INVALID_COMPLETION',
        'INVALID_ACCEPTANCE', 'INVALID_ATTACHMENT']);
      const code = codes.has(error.code) ? error.code : 'INTERNAL_ERROR';
      const status = error.status || (code === 'FORBIDDEN' ? 403 : code === 'NOT_FOUND' ? 404 :
        ['ALREADY_EXISTS', 'VERSION_CONFLICT', 'PRIORITY_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'INVALID_TRANSITION',
          'INVITATION_EXPIRED', 'QUOTE_EXPIRED', 'QUOTE_AWAITING_APPROVAL'].includes(code) ? 409 : 400);
      send(codes.has(error.code) ? status : 500, { success: false, code, message: code });
    }
  });
  let started = false;
  let sweepTimer;
  const sweep = () => store.transact(state => expireDueInvitations(state, new Date(now()).toISOString()));
  return {
    store,
    address: () => server.address(),
    async start() {
      if (started) return server.address();
      await store.readSnapshot();
      if (developmentMode === true) {
        await store.transact(state => Object.values(state).every(value => !Array.isArray(value) || value.length === 0)
          ? fixtures.state : state);
      }
      await sweep();
      await prepareAttachments();
      await new Promise((resolveStart, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => { server.off('error', reject); resolveStart(); });
      });
      started = true;
      sweepTimer = setInterval(() => {
        sweep().catch(() => { process.stderr.write('Local invitation sweep failed; next tick will retry.\n'); });
      }, 60000);
      sweepTimer.unref?.();
      return server.address();
    },
    async close() {
      clearInterval(sweepTimer);
      sweepTimer = undefined;
      if (started) await new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
      await store.readSnapshot(); // Drain any expiry transaction already queued before timer cancellation.
      started = false;
      sessions.clear();
      bootstrapKeys.clear();
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const app = createVendorWorkOrderServer({ port: 8787, developmentMode: process.argv.includes('--development') });
  await app.start();
  process.stdout.write('Local work-order API: http://127.0.0.1:8787\n');
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); });
}
