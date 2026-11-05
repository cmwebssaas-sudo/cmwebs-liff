import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { createIdentityAuthenticator, idTokenAudience } from '../cloudflare/read-api/src/read-identity.js';
import { resolveReadAccess } from '../cloudflare/read-api/src/read-access.js';
import { richDataset } from './fixtures/read-parity/runtime.mjs';

const now = Date.parse('2026-11-04T10:00:00+08:00');
const legacy = '1999999999';
const own = '1000000001';
const env = { LINE_LOGIN_CHANNEL_ID: legacy };
const jwt = payload => ['e30', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'synthetic-signature'].join('.');
const request = token => new Request('https://local.test/v1/arrears', { headers: { authorization: 'LIFF ' + token } });
const claims = aud => ({ iss: 'https://access.line.me', aud, sub: 'U_SYNTHETIC_OWN', exp: now / 1000 + 600 });

function authenticator(rows, verified = []) {
  const lookups = [];
  const auth = createIdentityAuthenticator({ now: () => now, fetch: async (url, options) => {
    const clientId = new URLSearchParams(options.body).get('client_id');
    verified.push(clientId);
    return Response.json(claims(clientId));
  } });
  const findLoginChannel = async id => { lookups.push(id); if (rows === 'down') throw new Error('d1'); return rows[id] || null; };
  return { auth: token => auth(request(token), env, { findLoginChannel }), lookups, verified };
}

test('the routing hint reads only a ten-digit channel and ignores anything else', () => {
  assert.equal(idTokenAudience(jwt({ aud: own })), own);
  for (const token of ['synthetic-token', jwt({ aud: 'abc' }), jwt({ aud: [own] }), 'a.!!!.b', jwt({})]) {
    assert.equal(idTokenAudience(token), '');
  }
});

test('the existing channel keeps its path and never looks up the registry', async () => {
  const { auth, lookups, verified } = authenticator({});
  for (const token of [jwt({ aud: legacy }), 'synthetic-unstructured-token']) {
    const identity = await auth(token);
    assert.deepEqual(identity, { kind: 'line', line_user_id: 'U_SYNTHETIC_OWN' });
  }
  assert.deepEqual(lookups, []);
  assert.deepEqual(verified, [legacy, legacy]);
});

test('an active own channel verifies against itself and binds its Workspace', async () => {
  const { auth, verified } = authenticator({ [own]: { workspace_id: 'w_own', status: 'active' } });
  const identity = await auth(jwt({ aud: own }));
  assert.deepEqual(identity, { kind: 'line', line_user_id: 'U_SYNTHETIC_OWN', channel_workspace_id: 'W_OWN' });
  assert.deepEqual(verified, [own]);
});

test('unknown, inactive or unreachable channels never reach LINE', async () => {
  for (const status of ['draft', 'verifying', 'suspended', 'revoked']) {
    const { auth, verified } = authenticator({ [own]: { workspace_id: 'W_OWN', status } });
    await assert.rejects(() => auth(jwt({ aud: own })), /AUTH_REQUIRED/);
    assert.deepEqual(verified, []);
  }
  const missing = authenticator({});
  await assert.rejects(() => missing.auth(jwt({ aud: own })), /AUTH_REQUIRED/);
  const down = authenticator('down');
  await assert.rejects(() => down.auth(jwt({ aud: own })), /AUTH_UNAVAILABLE/);
  assert.deepEqual([...missing.verified, ...down.verified], []);
});

test('a suspended channel stops working even after a cached login', async () => {
  const rows = { [own]: { workspace_id: 'W_OWN', status: 'active' } };
  const { auth } = authenticator(rows);
  const token = jwt({ aud: own });
  await auth(token);
  rows[own] = { workspace_id: 'W_OWN', status: 'suspended' };
  await assert.rejects(() => auth(token), /AUTH_REQUIRED/);
});

test('an own-channel login only opens its own Workspace', () => {
  const data = richDataset();
  const uid = data.V2_users[0].line_user_id;
  const workspace = String(data.V2_workspaces[0].workspace_id).toUpperCase();
  const bound = resolveReadAccess(data, { kind: 'line', line_user_id: uid, channel_workspace_id: workspace });
  assert.equal(String(bound.workspace.workspace_id).toUpperCase(), workspace);
  assert.throws(() => resolveReadAccess(richDataset(), { kind: 'line', line_user_id: uid, channel_workspace_id: 'W_SOMEONE_ELSE' }),
    /WORKSPACE_REQUIRED|WORKSPACE_FORBIDDEN/);
});

const appsScript = name => readFileSync(new URL('../apps-script/' + name, import.meta.url), 'utf8');
function scriptFunction(source, name) {
  const match = new RegExp('function ' + name + '\\(').exec(source);
  for (let end = source.indexOf('}', match.index); end !== -1; end = source.indexOf('}', end + 1)) {
    const candidate = source.slice(match.index, end + 1);
    try { new vm.Script(candidate); return candidate; } catch (_) {}
  }
  throw Error('Cannot parse ' + name);
}

function gas({ registry = {}, workspaces = 'W_OWN', worker = 200 } = {}) {
  const state = { verified: [], registryCalls: [], cache: new Map() };
  const properties = { CMWEBS_LINE_LOGIN_CHANNEL_ID: legacy, CMWEBS_LINE_WORKER_WORKSPACES: workspaces,
    READ_REPLICA_URL: 'https://worker.test', LINE_REGISTRY_SIGNING_SECRET: 'synthetic-signing' };
  const context = vm.createContext({ Date, JSON, String, Math, Object, Number,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties[key] ?? null }) },
    CacheService: { getScriptCache: () => ({ get: key => state.cache.get(key) || null, put: (key, value) => state.cache.set(key, value) }) },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, getUuid: () => 'synthetic-nonce-0001',
      computeDigest: (_, value) => [...createHash('sha256').update(value).digest()].map(n => n > 127 ? n - 256 : n),
      computeHmacSha256Signature: (value, key) => [...createHmac('sha256', key).update(value).digest()],
      base64DecodeWebSafe: value => [...Buffer.from(value, 'base64url')],
      newBlob: bytes => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8') }) },
    readReplicaHex_: bytes => bytes.map(value => ((value + 256) % 256).toString(16).padStart(2, '0')).join(''),
    UrlFetchApp: { fetch(url, options) {
      if (url === 'https://worker.test/internal/line-channels') {
        const body = JSON.parse(options.payload);
        state.registryCalls.push(body);
        const signature = createHmac('sha256', 'synthetic-signing').update(options.headers['X-CMWebs-Timestamp'] + '\n' +
          options.headers['X-CMWebs-Nonce'] + '\n' + options.payload).digest('hex');
        assert.equal(options.headers['X-CMWebs-Signature'], signature);
        const row = registry[body.line_login_channel_id];
        const code = worker !== 200 ? worker : row ? 200 : 404;
        return { getResponseCode: () => code, getContentText: () => JSON.stringify({ data: row || null }) };
      }
      assert.equal(url, 'https://api.line.me/oauth2/v2.1/verify');
      state.verified.push(options.payload.client_id);
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(gasClaims(options.payload.client_id)) };
    } } });
  const api = appsScript('V2_API.js');
  vm.runInContext(appsScript('V2_LINE_IDENTITY.js') + '\n' + api.slice(api.indexOf('let LINE_WORKER_ROUTE_CONFIG_'),
    api.indexOf('function lineBuildWorkerPushRequest_(')), context);
  return { context, state };
}
const tokenNow = () => ({ ...claims(own), exp: Math.floor(Date.now() / 1000) + 600 });
const gasClaims = aud => ({ ...tokenNow(), aud });

test('Apps Script keeps the existing channel unchanged and outside the registry', () => {
  const { context, state } = gas();
  const result = context.verifyLandlordLineIdToken_(jwt({ aud: legacy }));
  assert.equal(result.success, true);
  assert.equal(result.data.channel_workspace_id, undefined);
  assert.deepEqual(state.verified, [legacy]);
  assert.deepEqual(state.registryCalls, []);
  assert.deepEqual({ ...context.lineRequestChannelScope_() }, { workspace_id: '' });
});

test('Apps Script accepts an own channel only when active and on the Worker list', () => {
  const active = { [own]: { workspace_id: 'w_own', status: 'active' } };
  const ok = gas({ registry: active });
  const result = ok.context.verifyLandlordLineIdToken_(jwt({ aud: own }));
  assert.equal(result.success, true);
  assert.equal(result.data.channel_workspace_id, 'W_OWN');
  assert.deepEqual(ok.state.verified, [own]);
  ok.context.verifyLandlordLineIdToken_(jwt({ aud: own }));
  assert.equal(ok.state.registryCalls.length, 1, 'registry answer is cached');

  for (const setup of [{ registry: { [own]: { workspace_id: 'W_OWN', status: 'suspended' } } }, { registry: {} },
    { registry: active, workspaces: 'W_OTHER' }, { registry: active, worker: 503 }]) {
    const { context, state } = gas(setup);
    assert.equal(context.verifyLandlordLineIdToken_(jwt({ aud: own })).code, 'AUTH_REQUIRED');
    assert.deepEqual(state.verified, []);
  }
});

test('the verified channel decides which Workspaces a landlord can open', () => {
  const own_ = gas({ registry: { [own]: { workspace_id: 'W_OWN', status: 'active' } }, workspaces: 'W_OWN,W_TEST' });
  assert.equal(own_.context.lineRequestChannelDenied_('W_OWN'), null, 'nothing verified yet');
  own_.context.verifyLandlordLineIdToken_(jwt({ aud: own }));
  assert.equal(own_.context.lineRequestChannelDenied_('w_own'), null);
  assert.equal(own_.context.lineRequestChannelDenied_('W000001').code, 'WORKSPACE_FORBIDDEN');
  assert.equal(own_.context.lineRequestChannelDenied_('W_TEST').code, 'WORKSPACE_FORBIDDEN');

  const existing = gas({ workspaces: 'W_OWN' });
  existing.context.verifyLandlordLineIdToken_(jwt({ aud: legacy }));
  assert.equal(existing.context.lineRequestChannelDenied_('W000001'), null);
  assert.equal(existing.context.lineRequestChannelDenied_('W_OWN').code, 'WORKSPACE_FORBIDDEN');
});

test('tenant actions refuse own-channel tokens before any lookup', () => {
  const { context, state } = gas();
  assert.equal(context.lineRequestChannelGate_('tenant_home_init', { id_token: jwt({ aud: own }) }).code, 'LINE_CHANNEL_TENANT_NOT_READY');
  assert.equal(context.lineRequestChannelGate_('tenant_bind_submit', { id_token: jwt({ aud: own }) }).code, 'LINE_CHANNEL_TENANT_NOT_READY');
  for (const parameter of [{ id_token: jwt({ aud: legacy }) }, { id_token: 'synthetic-token' }, {}]) {
    assert.equal(context.lineRequestChannelGate_('tenant_home_init', parameter), null);
  }
  assert.equal(context.lineRequestChannelGate_('landlord_home_init', { id_token: jwt({ aud: own }) }), null);
  assert.deepEqual([...state.verified, ...state.registryCalls], []);
});

test('the landlord resolver applies the channel scope on fresh and cached access', () => {
  const source = appsScript('V2_WORKSPACE_LANDLORD_ACCESS.js');
  const resolver = scriptFunction(source, 'workspaceLandlordResolveAccess_');
  const run = (scope, cached) => {
    const seen = [];
    const workspace = { workspace_id: 'W000001', account_status: 'active', onboarding_status: 'completed' };
    const context = vm.createContext({ Object, String,
      lineRequestChannelScope_: () => scope,
      lineRequestChannelDenied_: id => String(id).toUpperCase() === (scope.workspace_id || 'W000001') ? null : { success: false, code: 'WORKSPACE_FORBIDDEN' },
      workspaceText_: value => String(value ?? '').trim(),
      workspaceResult_: (success, code) => ({ success, code }),
      runtimeSnapshotGetContext_: () => cached ? { success: true, workspace } : null,
      runtimeSnapshotSetContext_: () => {},
      workspaceEnsureSchema_: () => {}, runtimeSpreadsheet_: () => ({}),
      workspaceResolveContextByLineUid_: (ss, uid, options) => { seen.push(options.workspace_id || '');
        return { user: { account_status: 'active' }, activeWorkspace: workspace, activeMembership: { member_status: 'active' } }; },
      workspaceIsActiveStatus_: () => true, workspaceOnboardingComplete_: () => true,
      workspaceLandlordResolvePrincipals_: () => [{ line_user_id: 'U_SYNTHETIC', landlord_id: 'L1' }],
      workspaceBuildPermissionView_: () => ({}) });
    vm.runInContext(resolver, context);
    return { result: context.workspaceLandlordResolveAccess_('U_SYNTHETIC', {}), seen };
  };
  assert.equal(run({ workspace_id: '' }).result.success, true);
  const scoped = run({ workspace_id: 'W_OWN' });
  assert.deepEqual(scoped.seen, ['W_OWN']);
  assert.equal(scoped.result.code, 'WORKSPACE_FORBIDDEN');
  assert.equal(run({ workspace_id: 'W_OWN' }, true).result.code, 'WORKSPACE_FORBIDDEN');
  assert.equal(run(null).result.success, true);
});

const repo = new URL('../', import.meta.url);
function liffConfig(href, stored = {}) {
  const window = { location: { href }, sessionStorage: { getItem: key => stored[key] ?? null, setItem: (key, value) => { stored[key] = value; } } };
  vm.runInNewContext(readFileSync(new URL('liff-config.js', repo), 'utf8'), { window, URL });
  return { config: window.CMWebsLiffConfig, stored };
}

test('pages keep the existing LIFF apps unless a landlord LIFF opened the tab', () => {
  const existing = liffConfig('https://cmwebs.test/landlord-home.html').config;
  assert.equal(existing.liffId('landlord'), '2010314940-EjX1qbb8');
  assert.equal(existing.liffId('tenant'), '2010314940-iJB1D6sN');
  assert.throws(() => existing.liffId('unknown'), /UNKNOWN_LIFF_APP/);

  const opened = liffConfig('https://cmwebs.test/landlord-entry.html?cmwebs_liff=' + own + '-AbCdEfGh');
  assert.equal(opened.config.liffId('landlord'), own + '-AbCdEfGh');
  assert.equal(opened.config.liffId('tenant'), own + '-AbCdEfGh');
  const next = liffConfig('https://cmwebs.test/landlord-home.html', opened.stored).config;
  assert.equal(next.liffId('landlord'), own + '-AbCdEfGh', 'in-app links drop the query');

  for (const value of ['bad', own, own + '-AbCdEfGh&x', '<script>']) {
    assert.equal(liffConfig('https://cmwebs.test/a.html?cmwebs_liff=' + encodeURIComponent(value)).config.liffId('landlord'), '2010314940-EjX1qbb8');
  }
  const blocked = { location: { href: 'https://cmwebs.test/a.html' }, get sessionStorage() { throw new Error('blocked'); } };
  vm.runInNewContext(readFileSync(new URL('liff-config.js', repo), 'utf8'), { window: blocked, URL });
  assert.equal(blocked.CMWebsLiffConfig.liffId('landlord'), '2010314940-EjX1qbb8');
});

test('no page hard-codes a LIFF ID and each loads the config before using it', () => {
  const pages = execPages();
  assert.ok(pages.length >= 50);
  for (const name of pages) {
    const html = readFileSync(new URL(name, repo), 'utf8');
    assert.doesNotMatch(html, /\b\d{10}-[A-Za-z0-9]{8}\b/, name);
    if (!html.includes('CMWebsLiffConfig')) continue;
    const loaded = html.indexOf('<script src="liff-config.js?v=');
    assert.ok(loaded >= 0 && loaded < html.indexOf('CMWebsLiffConfig'), name);
  }
});
function execPages() {
  return readdirSync(repo).filter(name => name.endsWith('.html'));
}
