import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createWorkOrderStore } from './store.mjs';
import { createSyntheticFixtures } from './fixtures.mjs';
import { normalizeActor, normalizeDirectoryInput, mutateDirectory, projectDirectory } from './domain.mjs';

const contexts = new WeakMap();
const hours8 = 8 * 60 * 60 * 1000;
const publicDir = join(dirname(fileURLToPath(import.meta.url)), 'public');
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
      const partnerPath = /^\/api\/partners\/([A-Za-z0-9_-]+)(?:\/memberships(?:\/([A-Za-z0-9_-]+))?)?$/.exec(path);
      const collection = ['/api/partners', '/api/priority-rules', '/api/service-agreements'].includes(path) ? path.slice(5) : null;
      let action, resource = {};
      if (collection === 'partners' && request.method === 'POST') action = 'partner-create';
      if (partnerPath) {
        resource = { partner_id: partnerPath[1] };
        if (!path.includes('/memberships') && request.method === 'PATCH') action = 'partner-update';
        else if (path.endsWith('/memberships') && request.method === 'POST') action = 'member-create';
        else if (partnerPath[2] && request.method === 'PATCH') {
          action = 'member-update'; resource.actor_id = partnerPath[2];
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
      // Only explicit safe protocol codes are returned. Never forward error.message.
      const codes = new Set(['LOOPBACK_REQUIRED', 'ORIGIN_REJECTED', 'NOT_FOUND', 'SESSION_REQUIRED',
        'INVALID_BODY', 'BODY_TOO_LARGE', 'INVALID_PRINCIPAL', 'IDEMPOTENCY_KEY_REQUIRED', 'IDEMPOTENCY_CONFLICT', 'FORBIDDEN',
        'INVALID_INPUT', 'INVALID_PARTNER', 'INVALID_MEMBER', 'INVALID_TRADE', 'INVALID_PRIORITY', 'PRIORITY_CONFLICT',
        'INVALID_AGREEMENT', 'INVALID_AMOUNT', 'ALREADY_EXISTS', 'VERSION_CONFLICT']);
      const code = codes.has(error.code) ? error.code : 'INTERNAL_ERROR';
      const status = error.status || (code === 'FORBIDDEN' ? 403 : code === 'NOT_FOUND' ? 404 :
        ['ALREADY_EXISTS', 'VERSION_CONFLICT', 'PRIORITY_CONFLICT', 'IDEMPOTENCY_CONFLICT'].includes(code) ? 409 : 400);
      send(codes.has(error.code) ? status : 500, { success: false, code, message: code });
    }
  });
  let started = false;
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
      await new Promise((resolveStart, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => { server.off('error', reject); resolveStart(); });
      });
      started = true;
      return server.address();
    },
    async close() {
      if (started) await new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
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
