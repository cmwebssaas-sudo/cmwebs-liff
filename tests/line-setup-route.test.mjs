import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const dir = new URL('../apps-script/', import.meta.url);
const source = readFileSync(new URL('V3_LINE_SETUP.js', dir), 'utf8');
const record = (overrides = {}) => ({ workspace_id: 'W_TEST', line_login_channel_id: '1000000001', liff_id: '1000000001-AbCdEfGh',
  messaging_channel_id: '2000000001', status: 'draft', has_secrets: true, ...overrides });

function setup({ role = 'owner', workspace = 'w_test', setupList = 'W_TEST', answers = {} } = {}) {
  const calls = [], audits = [], cache = new Map();
  const ctx = {
    JSON, String, Object, Array,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => key === 'CMWEBS_LINE_SETUP_WORKSPACES' ? setupList : null }) },
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key) ?? null, put: (key, value) => cache.set(key, value), remove: key => cache.delete(key) }) },
    Utilities: { getUuid: () => '0123abcd-0123-4567-89ab-0123456789ab' },
    resolveLandlordPrincipal_: request => request.id_token === 'landlord'
      ? { success: true, data: { workspace_id: workspace, role, workspace: { workspace_id: workspace }, user: {}, membership: {} } }
      : { success: false, code: 'AUTH_REQUIRED' },
    lineRequestChannelDenied_: () => null,
    lineRequestAuthRequired_: () => ({ success: false, code: 'AUTH_REQUIRED' }),
    lineWorkerSignedRequest_: (path, fields) => ({ url: 'https://worker.test' + path, fields }),
    UrlFetchApp: { fetch(url, request) {
      calls.push(request.fields);
      const answer = answers[request.fields.action] || { status: 200, body: { success: true, data: record() } };
      const value = typeof answer === 'function' ? answer(request.fields) : answer;
      return { getResponseCode: () => value.status, getContentText: () => JSON.stringify(value.body) };
    } },
    workspaceRecordOperationActor_: (access, action, result) => audits.push({ action, result })
  };
  vm.runInNewContext(source, ctx);
  return { ctx, calls, audits, cache };
}
const save = { id_token: 'landlord', messaging_channel_id: '2000000001', messaging_channel_secret: 'abcdef0123456789abcdef0123456789',
  messaging_access_token: 'synthetic+token/value=', line_login_channel_id: '1000000001', line_login_channel_secret: 'fedcba9876543210fedcba9876543210' };

test('only the owner of a Workspace on the setup list can use the wizard', () => {
  for (const [options, code] of [[{ role: 'admin' }, 'LINE_SETUP_OWNER_REQUIRED'], [{ setupList: '' }, 'LINE_SETUP_NOT_ENABLED'],
    [{ setupList: 'W_OTHER' }, 'LINE_SETUP_NOT_ENABLED']]) {
    const { ctx, calls } = setup(options);
    assert.equal(ctx.lineSetupHandle_('landlord_line_setup_status', { id_token: 'landlord' }).code, code);
    assert.equal(calls.length, 0);
  }
  const { ctx, calls } = setup();
  assert.equal(ctx.lineSetupHandle_('landlord_line_setup_save', { ...save, id_token: 'someone' }).code, 'AUTH_REQUIRED');
  assert.equal(calls.length, 0);
});

test('saving creates the LIFF app first, then stores the channel, and never echoes secrets', () => {
  const { ctx, calls, audits } = setup({ answers: { prepare_liff: { status: 200, body: { success: true, data: { liff_id: '1000000001-NewApp01' } } } } });
  const result = ctx.lineSetupHandle_('landlord_line_setup_save', save);
  assert.equal(result.success, true);
  assert.deepEqual(calls.map(call => call.action), ['prepare_liff', 'upsert']);
  assert.equal(calls[1].workspace_id, 'W_TEST');
  assert.equal(calls[1].liff_id, '1000000001-NewApp01');
  assert.deepEqual(Object.keys(calls[1].secrets).sort(), ['line_login_channel_secret', 'messaging_access_token', 'messaging_channel_secret']);
  assert.doesNotMatch(JSON.stringify(result) + JSON.stringify(audits), /abcdef0123|synthetic\+token|fedcba98/);
  assert.equal(audits[0].action, 'landlord_line_setup_save');
});

test('malformed channel data is refused before any registry call', () => {
  for (const change of [{ messaging_channel_id: '12' }, { line_login_channel_secret: '' }, { messaging_channel_secret: 'has space' },
    { line_login_channel_id: '2000000001' }]) {
    const { ctx, calls } = setup();
    assert.equal(ctx.lineSetupHandle_('landlord_line_setup_save', { ...save, ...change }).code, 'INVALID_LINE_SETUP');
    assert.equal(calls.length, 0);
  }
});

test('verifying moves a draft to verifying before checking', () => {
  const { ctx, calls } = setup();
  ctx.lineSetupHandle_('landlord_line_setup_verify', { id_token: 'landlord' });
  assert.deepEqual(calls.map(call => call.action), ['get', 'set_status', 'verify']);
  assert.equal(calls[1].status, 'verifying');
  const again = setup({ answers: { get: { status: 200, body: { success: true, data: record({ status: 'verifying' }) } } } });
  again.ctx.lineSetupHandle_('landlord_line_setup_verify', { id_token: 'landlord' });
  assert.deepEqual(again.calls.map(call => call.action), ['get', 'verify']);
});

test('replacing an existing webhook needs the explicit confirmation flag', () => {
  const { ctx, calls } = setup({ answers: { set_webhook: { status: 409, body: { success: false, code: 'LINE_WEBHOOK_REPLACE_CONFIRM_REQUIRED' } } } });
  const refused = ctx.lineSetupHandle_('landlord_line_setup_webhook', { id_token: 'landlord' });
  assert.equal(refused.code, 'LINE_WEBHOOK_REPLACE_CONFIRM_REQUIRED');
  assert.match(refused.message, /Webhook/);
  ctx.lineSetupHandle_('landlord_line_setup_webhook', { id_token: 'landlord', replace_existing: 'true' });
  assert.deepEqual(calls.map(call => call.replace_existing), [false, true]);
});

test('the phone link carries a short-lived code tied to the Workspace', () => {
  const { ctx, calls, cache } = setup({ answers: { check_provider: { status: 200, body: { success: true, data: { provider_match: true } } } } });
  const link = ctx.lineSetupHandle_('landlord_line_setup_provider_link', { id_token: 'landlord' });
  assert.equal(link.data.url, 'https://liff.line.me/1000000001-AbCdEfGh/landlord-line-setup.html?setup_code=0123abcd0123456789ab0123456789ab');
  assert.equal(cache.get('v3_line_setup_code:0123abcd0123456789ab0123456789ab'), 'W_TEST');
  const result = ctx.lineSetupHandle_('line_setup_provider_check', { setup_code: '0123abcd0123456789ab0123456789ab', id_token: 'phone-token' });
  assert.equal(result.data.provider_match, true);
  assert.equal(result.data.channel_active, false);
  assert.equal(JSON.stringify(calls.at(-1)), JSON.stringify({ action: 'check_provider', workspace_id: 'W_TEST', id_token: 'phone-token' }));
  assert.equal(ctx.lineSetupHandle_('line_setup_provider_check', { setup_code: 'bad', id_token: 'x' }).code, 'LINE_SETUP_CODE_INVALID');
  assert.equal(ctx.lineSetupHandle_('line_setup_provider_check', { setup_code: 'f'.repeat(32), id_token: 'x' }).code, 'LINE_SETUP_CODE_INVALID');
});

test('the phone link can try a menu on the opener\'s own LINE', () => {
  const { ctx, calls } = setup();
  ctx.lineSetupHandle_('landlord_line_setup_provider_link', { id_token: 'landlord' });
  const code = '0123abcd0123456789ab0123456789ab';
  assert.equal(ctx.lineSetupHandle_('line_setup_menu_preview', { setup_code: code, id_token: 'phone', menu: 'landlord' }).success, true);
  assert.equal(JSON.stringify(calls.at(-1)), JSON.stringify({ action: 'preview_menu', workspace_id: 'W_TEST', id_token: 'phone', menu: 'landlord' }));
  assert.equal(ctx.lineSetupHandle_('line_setup_menu_preview', { setup_code: code, id_token: 'phone', menu: 'admin' }).code, 'INVALID_LINE_SETUP');
  assert.equal(ctx.lineSetupHandle_('line_setup_menu_preview', { setup_code: 'f'.repeat(32), id_token: 'phone', menu: 'tenant' }).code, 'LINE_SETUP_CODE_INVALID');
});

test('menu publishing, default switch and restore are owner actions with fixed values', () => {
  const { ctx, calls, audits } = setup();
  assert.equal(ctx.lineSetupHandle_('landlord_line_setup_menu_publish', { id_token: 'landlord', palette: 'neon' }).code, 'INVALID_LINE_SETUP');
  ctx.lineSetupHandle_('landlord_line_setup_menu_publish', { id_token: 'landlord', palette: 'ocean' });
  ctx.lineSetupHandle_('landlord_line_setup_menu_default', { id_token: 'landlord', enabled: 'true' });
  ctx.lineSetupHandle_('landlord_line_setup_menu_default', { id_token: 'landlord', enabled: 'false' });
  ctx.lineSetupHandle_('landlord_line_setup_menu_restore', { id_token: 'landlord' });
  assert.equal(JSON.stringify(calls.map(call => [call.action, call.palette ?? call.enabled ?? null])),
    JSON.stringify([['publish_menus', 'ocean'], ['set_default_menu', true], ['set_default_menu', false], ['restore_menus', null]]));
  assert.equal(audits.length, 4);
  const admin = setup({ role: 'admin' });
  assert.equal(admin.ctx.lineSetupHandle_('landlord_line_setup_menu_restore', { id_token: 'landlord' }).code, 'LINE_SETUP_OWNER_REQUIRED');
});

function syncContext({ scope, member = true, answer = { status: 200, body: { success: true } } } = {}) {
  const env = setup({ answers: { link_menu: answer } });
  env.ctx.lineRequestChannelScope_ = () => scope;
  env.ctx.workspaceLandlordResolveAccess_ = () => member ? { success: true, workspace: { workspace_id: 'w_test' } } : { success: false };
  return env;
}
const sub = 'U' + 'a'.repeat(32);

test('landlords opening their own LIFF get the landlord menu once per six hours', () => {
  const { ctx, calls, cache } = syncContext({ scope: { workspace_id: 'W_TEST' } });
  ctx.lineMenuSyncLandlord_(sub);
  ctx.lineMenuSyncLandlord_(sub);
  assert.equal(calls.length, 1);
  assert.equal(JSON.stringify(calls[0]), JSON.stringify({ action: 'link_menu', workspace_id: 'W_TEST', line_user_id: sub, menu: 'landlord' }));
  assert.equal(cache.get('v3_line_menu:W_TEST:' + sub), 'landlord');
});

test('people who are not members lose the landlord menu', () => {
  const { ctx, calls } = syncContext({ scope: { workspace_id: 'W_TEST' }, member: false });
  ctx.lineMenuSyncLandlord_(sub);
  assert.equal(calls[0].menu, 'none');
});

test('the existing channel never touches rich menus', () => {
  for (const scope of [null, { workspace_id: '' }]) {
    const { ctx, calls } = syncContext({ scope });
    ctx.lineMenuSyncLandlord_(sub);
    assert.equal(calls.length, 0);
  }
  const main = readFileSync(new URL('程式碼.js', dir), 'utf8');
  assert.match(main, /lineUserId = identity\.data\.sub;\s*if \(\/\^landlord_\/\.test\(v2Action\)\) lineMenuSyncLandlord_\(lineUserId\);/);
});

test('an unpublished menu is retried after ten minutes and errors never break the request', () => {
  const { ctx, cache } = syncContext({ scope: { workspace_id: 'W_TEST' }, answer: { status: 409, body: { success: false, code: 'LINE_RICH_MENU_NOT_PUBLISHED' } } });
  ctx.lineMenuSyncLandlord_(sub);
  assert.equal(cache.get('v3_line_menu:W_TEST:' + sub), 'unpublished');
  const broken = syncContext({ scope: { workspace_id: 'W_TEST' } });
  broken.ctx.workspaceLandlordResolveAccess_ = () => { throw new Error('sheet'); };
  assert.doesNotThrow(() => broken.ctx.lineMenuSyncLandlord_(sub));
});

test('activating clears the cached login channel and LIFF lookups', () => {
  const { ctx, calls, cache } = setup({ answers: { set_status: { status: 200, body: { success: true, data: record({ status: 'active' }) } } } });
  cache.set('v3_line_login_channel:1000000001', '{"status":"verifying"}');
  cache.set('v3_line_workspace_liff:W_TEST', '{"liff_id":""}');
  assert.equal(ctx.lineSetupHandle_('landlord_line_setup_activate', { id_token: 'landlord' }).success, true);
  assert.equal(calls[0].status, 'active');
  assert.equal(cache.size, 0);
});

test('the POST dispatcher sends only setup actions to the wizard handler', () => {
  const main = readFileSync(new URL('程式碼.js', dir), 'utf8');
  assert.match(main, /if \(typeof lineSetupIsAction_ === 'function' && lineSetupIsAction_\(action\)\) \{\s*const setupResult=lineSetupHandle_\(action,request\);/);
  const { ctx } = setup();
  assert.equal(ctx.lineSetupIsAction_('landlord_line_setup_save'), true);
  assert.equal(ctx.lineSetupIsAction_('landlord_team_init'), false);
});

test('restoring the webhook is an owner action', () => {
  const { ctx, calls, audits } = setup();
  ctx.lineSetupHandle_('landlord_line_setup_webhook_restore', { id_token: 'landlord' });
  assert.equal(calls[0].action, 'restore_webhook');
  assert.equal(audits[0].action, 'landlord_line_setup_webhook_restore');
  assert.match(setup().ctx.lineSetupResult_(false, 'LINE_WEBHOOK_PROTECTED').message, /不能在精靈中更換/);
});
