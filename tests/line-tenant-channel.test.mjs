import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const legacy = '1999999999';
const own = '1000000001';
const ownLiff = own + '-AbCdEfGh';
const existingUrl = 'https://liff.line.me/2010314940-iJB1D6sN';
const tenantHeaders = ['tenant_id', 'workspace_id', 'tenant_line_user_id', 'line_user_id', 'tenant_line_uid', 'tenant_phone', 'account_status'];
const jwt = payload => ['e30', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'synthetic-signature'].join('.');
const appsScript = name => readFileSync(new URL('../apps-script/' + name, import.meta.url), 'utf8');

function sheet(headers, rows) {
  const values = [headers, ...rows.map(row => headers.map(header => row[header] ?? ''))];
  return { getLastRow: () => values.length, getLastColumn: () => headers.length, getDataRange: () => ({ getValues: () => values }) };
}

function gas({ workspaces = 'W_OWN', login = { workspace_id: 'W_OWN', status: 'active' },
  channel = { status: 'active', liff_id: ownLiff }, worker = 200, tenants = [] } = {}) {
  const state = { verified: [], registryCalls: [], cache: new Map(), tenantReads: 0, picked: [] };
  const properties = { CMWEBS_LINE_LOGIN_CHANNEL_ID: legacy, CMWEBS_LINE_WORKER_WORKSPACES: workspaces,
    READ_REPLICA_URL: 'https://worker.test', LINE_REGISTRY_SIGNING_SECRET: 'synthetic-signing' };
  const tenantSheet = sheet(tenantHeaders, tenants);
  const now = () => Math.floor(Date.now() / 1000);
  const context = vm.createContext({ Date, JSON, String, Math, Object, Number, Error,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties[key] ?? null }) },
    CacheService: { getScriptCache: () => ({ get: key => state.cache.get(key) ?? null, put: (key, value) => state.cache.set(key, value) }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    SpreadsheetApp: { flush: () => {} },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, getUuid: () => 'synthetic-nonce-0001',
      computeDigest: (_, value) => [...createHash('sha256').update(value).digest()].map(n => n > 127 ? n - 256 : n),
      computeHmacSha256Signature: (value, key) => [...createHmac('sha256', key).update(value).digest()],
      base64DecodeWebSafe: value => [...Buffer.from(value, 'base64url')],
      newBlob: bytes => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8') }) },
    readReplicaHex_: bytes => bytes.map(value => ((value + 256) % 256).toString(16).padStart(2, '0')).join(''),
    runtimeSpreadsheet_: () => ({ getSheetByName: name => {
      if (name !== 'V2_tenants') return null;
      state.tenantReads++;
      return tenantSheet;
    } }),
    runtimeSnapshotGetValues_: target => target.getDataRange().getValues(),
    UrlFetchApp: { fetch(url, options) {
      if (url === 'https://worker.test/internal/line-channels') {
        const body = JSON.parse(options.payload);
        state.registryCalls.push(body);
        const row = body.action === 'find_login_channel'
          ? body.line_login_channel_id === own ? login : null
          : body.workspace_id === 'W_OWN' ? channel : null;
        const code = worker !== 200 ? worker : row ? 200 : 404;
        return { getResponseCode: () => code, getContentText: () => JSON.stringify({ data: row }) };
      }
      assert.equal(url, 'https://api.line.me/oauth2/v2.1/verify');
      state.verified.push(options.payload.client_id);
      const claims = JSON.parse(Buffer.from(options.payload.id_token.split('.')[1], 'base64url').toString('utf8'));
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ iss: 'https://access.line.me',
        sub: 'U_SYNTHETIC', iat: now() - 10, exp: now() + 600, ...claims, aud: options.payload.client_id }) };
    } } });
  const api = appsScript('V2_API.js');
  vm.runInContext([appsScript('V2_LINE_IDENTITY.js'),
    api.slice(api.indexOf('let LINE_WORKER_ROUTE_CONFIG_'), api.indexOf('function lineBuildWorkerPushRequest_(')),
    appsScript('V2_TENANT_LIFF_SIGNING_SESSION.js'), appsScript('V2_TENANT_BINDING_PHONE.js')].join('\n'), context);
  Object.assign(context, {
    tenantBindingFailureCount_: () => 0, tenantBindingRecordFailure_: () => {}, tenantBindingClearFailures_: () => {},
    tenantBindingWriteLog_: () => {}, tenantBindingLogAccess_: () => {},
    tenantBindingResolveActiveContract_: (_, tenant) => { state.picked.push(tenant.tenant_id); return null; }
  });
  return { context, state };
}

const verify = (context, aud, sub = 'U_SYNTHETIC') => context.verifyLandlordLineIdToken_(jwt({ aud, sub }));

test('with no Workspace on its own channel, tenant checks and links stay as today', () => {
  const { context, state } = gas({ workspaces: '', tenants: [{ tenant_id: 'T1', workspace_id: 'W000001', line_user_id: 'U_SYNTHETIC' }] });
  assert.equal(verify(context, legacy).success, true);
  assert.equal(context.lineTenantChannelDenied_('U_SYNTHETIC'), null);
  assert.equal(context.lineTenantLiffUrl_('W000001'), existingUrl);
  assert.equal(context.lineTenantLiffUrl_('W000001', 'tenant-contract.html'), existingUrl);
  assert.equal(state.tenantReads, 0, 'no extra tenant sheet read');
  assert.deepEqual(state.registryCalls, []);
});

test('every tenant row a LINE account is bound to must belong to the verified channel', () => {
  const tenants = [
    { tenant_id: 'T1', workspace_id: 'W_OWN', tenant_line_user_id: 'U_OWN_ONLY' },
    { tenant_id: 'T2', workspace_id: 'W000001', line_user_id: 'U_EXISTING_ONLY' },
    { tenant_id: 'T3', workspace_id: '', line_user_id: 'U_NO_WORKSPACE' },
    { tenant_id: 'T4', workspace_id: 'w_own', line_user_id: 'U_BOTH' },
    { tenant_id: 'T5', workspace_id: 'W000001', tenant_line_user_id: 'U_BOTH' },
    { tenant_id: 'T6', workspace_id: 'W000001', tenant_line_uid: 'U_OLD_COLUMN' }
  ];
  const ownChannel = gas({ tenants }).context;
  assert.equal(ownChannel.lineTenantChannelDenied_('U_EXISTING_ONLY'), null, 'nothing verified yet, as in test mode');
  verify(ownChannel, own);
  assert.equal(ownChannel.lineTenantChannelDenied_('U_OWN_ONLY'), null);
  assert.equal(ownChannel.lineTenantChannelDenied_('U_NEW'), null);
  for (const sub of ['U_EXISTING_ONLY', 'U_NO_WORKSPACE', 'U_BOTH', 'U_OLD_COLUMN']) {
    assert.equal(ownChannel.lineTenantChannelDenied_(sub).code, 'LINE_CHANNEL_TENANT_CONFLICT', sub);
  }

  const existingChannel = gas({ tenants }).context;
  verify(existingChannel, legacy);
  for (const sub of ['U_EXISTING_ONLY', 'U_NO_WORKSPACE', 'U_NEW']) assert.equal(existingChannel.lineTenantChannelDenied_(sub), null, sub);
  for (const sub of ['U_OWN_ONLY', 'U_BOTH']) {
    assert.equal(existingChannel.lineTenantChannelDenied_(sub).code, 'LINE_CHANNEL_TENANT_CONFLICT', sub);
  }
});

test('phone binding only matches tenants inside the verified channel', () => {
  const samePhone = [
    { tenant_id: 'T_OWN', workspace_id: 'W_OWN', tenant_phone: '0912345678', account_status: 'active' },
    { tenant_id: 'T_EXISTING', workspace_id: 'W000001', tenant_phone: '0912345678', account_status: 'active' }
  ];
  const bind = (setup, aud) => {
    const { context, state } = gas(setup);
    verify(context, aud, 'U_NEW');
    return { result: context.bindTenantByLineUid_('U_NEW', '0912345678'), picked: state.picked };
  };
  assert.deepEqual(bind({ tenants: samePhone }, own).picked, ['T_OWN']);
  assert.deepEqual(bind({ tenants: samePhone }, legacy).picked, ['T_EXISTING']);
  assert.equal(bind({ tenants: [samePhone[1]] }, own).result.code, 'PHONE_NOT_FOUND');
  assert.equal(bind({ workspaces: '', tenants: samePhone }, legacy).result.code, 'MULTIPLE_TENANTS_FOUND',
    'unchanged while no Workspace uses its own channel');
});

test('tenant links of an own-channel Workspace open its own LIFF app', () => {
  const { context, state } = gas();
  assert.equal(context.lineTenantLiffUrl_('W_OWN'), 'https://liff.line.me/' + ownLiff + '/tenant-bind.html');
  assert.equal(context.lineTenantLiffUrl_('W_OWN', 'tenant-contract.html'), 'https://liff.line.me/' + ownLiff + '/tenant-contract.html');
  assert.equal(context.lineTenantLiffUrl_('W000001'), existingUrl);
  assert.deepEqual(state.registryCalls, [{ action: 'get', workspace_id: 'W_OWN' }], 'registry answer is cached');

  for (const setup of [{ channel: { status: 'suspended', liff_id: ownLiff } }, { channel: null }, { channel: { status: 'active', liff_id: 'bad' } }]) {
    assert.equal(gas(setup).context.lineTenantLiffUrl_('W_OWN'), '', 'never falls back to another LIFF app');
  }
  const down = gas({ worker: 503 });
  assert.equal(down.context.lineTenantLiffUrl_('W_OWN'), '');
  down.context.lineTenantLiffUrl_('W_OWN');
  assert.equal(down.state.registryCalls.length, 1, 'one lookup per execution, even for list views');
  assert.equal(down.state.cache.size, 0, 'an unavailable registry is not cached across executions');
});

test('signing sessions verify against the token channel and keep its scope', () => {
  const existing = gas();
  const legacyResult = existing.context.tenantLiffSigningVerifyIdTokenClaims_(jwt({ aud: legacy }));
  assert.equal(legacyResult.success, true);
  assert.deepEqual(existing.state.verified, [legacy]);
  assert.deepEqual(existing.state.registryCalls, []);

  const ownChannel = gas({ tenants: [{ tenant_id: 'T1', workspace_id: 'W_OWN', line_user_id: 'U_SYNTHETIC' }] });
  assert.equal(ownChannel.context.tenantLiffSigningVerifyIdTokenClaims_(jwt({ aud: own })).success, true);
  assert.deepEqual(ownChannel.state.verified, [own]);
  assert.equal(ownChannel.context.lineRequestChannelDenied_('W000001').code, 'WORKSPACE_FORBIDDEN');

  const conflict = gas({ tenants: [{ tenant_id: 'T2', workspace_id: 'W000001', line_user_id: 'U_SYNTHETIC' }] });
  assert.equal(conflict.context.tenantLiffSigningVerifyIdTokenClaims_(jwt({ aud: own })).code, 'LINE_CHANNEL_TENANT_CONFLICT');

  for (const setup of [{ login: { workspace_id: 'W_OWN', status: 'suspended' } }, { workspaces: 'W_OTHER' }, { worker: 503 }]) {
    const { context, state } = gas(setup);
    assert.equal(context.tenantLiffSigningVerifyIdTokenClaims_(jwt({ aud: own })).code, 'LINE_TOKEN_VERIFY_FAILED');
    assert.deepEqual(state.verified, []);
  }
  const none = gas({ workspaces: '' });
  assert.equal(none.context.tenantLiffSigningVerifyIdTokenClaims_(jwt({ aud: own })).code, 'LINE_TOKEN_VERIFY_FAILED');
  assert.deepEqual([...none.state.verified, ...none.state.registryCalls], [], 'no registry read while no Workspace uses its own channel');
});

test('the site root opens the page a landlord LIFF link names', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const run = (search, workspaceLiffId) => {
    const calls = [];
    const location = { search, replace: url => calls.push('replace:' + url) };
    const context = vm.createContext({ URLSearchParams, location, console,
      CMWebsLiffConfig: { liffId: () => 'existing-index', workspaceLiffId: () => workspaceLiffId },
      document: { getElementById: () => ({ style: {}, set innerHTML(value) { calls.push('error'); } }) },
      liff: { init: async options => { calls.push('init:' + options.liffId); }, isLoggedIn: () => false, login: () => calls.push('login') } });
    vm.runInContext(script, context);
    return new Promise(resolve => setTimeout(() => resolve(calls), 0));
  };
  return Promise.all([
    run('?cmwebs_liff=' + ownLiff + '&liff.state=%2Ftenant-bills.html', ownLiff),
    run('?cmwebs_liff=' + ownLiff, ownLiff),
    run('', '')
  ]).then(([withPage, bare, existing]) => {
    assert.deepEqual(withPage, ['init:' + ownLiff], 'LIFF moves on to the named page');
    assert.deepEqual(bare, ['init:' + ownLiff, 'replace:tenant-bind.html']);
    assert.deepEqual(existing, ['init:existing-index', 'login'], 'the existing page is unchanged');
  });
});
