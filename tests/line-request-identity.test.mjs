import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const source = name => existsSync(new URL(name, root)) ? readFileSync(new URL(name, root), 'utf8') : '';
const now = Math.floor(Date.now() / 1000);
function runtime() {
  const state = { calls: 0, effects: [], entries: new Map(), puts: [], channel: 'synthetic-channel',
    claims: { iss: 'https://access.line.me', aud: 'synthetic-channel', sub: 'synthetic-owner', exp: now + 3600 }, code: 200 };
  const context = vm.createContext({ Date, JSON, String, Number, Math, Error, RegExp,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => state.channel }) },
    CacheService: { getScriptCache: () => ({ get: k => state.entries.get(k) || null, put(k, v, ttl) { state.entries.set(k, v); state.puts.push({ k, ttl }); } }) },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_, value) => [...createHash('sha256').update(value).digest()].map(n => n > 127 ? n - 256 : n) },
    UrlFetchApp: { fetch(url, options) { state.calls++; if (state.networkError) throw Error('offline');
      assert.equal(url, 'https://api.line.me/oauth2/v2.1/verify');
      assert.equal(options.method, 'post'); assert.equal(options.payload.client_id, state.channel);
      return { getResponseCode: () => state.code, getContentText: () => state.badJson ? '{' : JSON.stringify(state.claims) }; } },
    bankReceiptIsAction_: () => false,
    runtimeSnapshotBegin_: () => state.effects.push('snapshot'),
    runtimeSnapshotFinish_: () => {},
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => ({ result: JSON.parse(text) }) }) },
    workspaceLandlordResolveAccess_: uid => { state.effects.push('workspace:' + uid); return { success: true,
      line_user_id: uid, principal_line_user_id: uid, user: {}, workspace: {}, membership: {} }; },
    requestLandlordEmailVerificationByLineUid_: uid => { state.effects.push('business:' + uid); return { success: true }; },
    verifyLandlordEmailVerificationCodeByLineUid_: uid => { state.effects.push('business:' + uid); return { success: true }; },
    uploadLandlordPaymentAccountCover_: principal => { state.effects.push('business:' + principal.data.principal_line_user_id); return { success: true }; },
    uploadLandlordContractDocumentByLineUid_: uid => { state.effects.push('business:' + uid); return { success: true }; },
    landlordInitiatedContractUpdateRenewalIntentByLineUid_: uid => { state.effects.push('business:' + uid); return { success: true }; },
    resolveTenantRequestLineUserId_: (_, action, uid) => uid,
    getWorkspaceLandlordHomeNativeByLineUid_: uid => { state.effects.push(uid); return { success: true, data: { principal: uid } }; },
    bindTenantByLineUid_: (uid, phone) => { state.effects.push(uid); return { success: true, data: { principal: uid, phone } }; },
    cancelTenantContractRequestByLineUid_: (uid, id) => { state.effects.push('business:' + uid); return { success: true, data: { principal: uid, id } }; },
    jsonOutput_: (result, callback) => ({ result, callback }),
    htmlBridgeOutput_: (result, requestId) => ({ result, requestId }),
    landlordInitiatedContractReadExchange_: (operation, id, secret) => ({ success: secret === 'synthetic-poll-secret', id, operation }),
  });
  vm.runInContext(source('apps-script/V2_LINE_IDENTITY.js') + '\n' + source('apps-script/程式碼.js'), context);
  vm.runInContext(pageFunction(source('apps-script/V2_API.js'), 'resolveLandlordPrincipal_') + '\n' +
    pageFunction(source('apps-script/V2_API.js'), 'landlordEmailAuthPostRequires_') + '\n' +
    pageFunction(source('apps-script/V2_API.js'), 'landlordEmailAuthPostMissingField_'), context);
  return { state, context, get: parameters => context.doGet({ parameter: parameters }),
    post: parameters => context.doPost({ parameter: {}, postData: { contents: JSON.stringify(parameters) } }) };
}

test('LINE POST consumers require a provider credential before principal and business resolution', () => {
  const requests = [
    { action: 'landlord_email_verify_request', response_mode: 'bridge', email: 'synthetic@example.invalid', request_id: 'synthetic-request' },
    { action: 'landlord_email_verify_code', response_mode: 'bridge', challenge_id: 'synthetic-challenge', code: 'synthetic-code', request_id: 'synthetic-request' },
    { action: 'landlord_settings_upload_payment_account_cover', response_mode: 'bridge', request_id: 'synthetic-request' },
    { v2_action: 'landlord_contract_document_upload' },
    { v2_action: 'tenant_contract_renewal_intent', contract_id: 'synthetic-contract', decision: 'accepted' }
  ];
  for (const request of requests) {
    for (const credential of [{}, { id_token: 'synthetic-token', line_user_id: 'another-principal' },
      { id_token: 'synthetic-token', test: '1' }]) {
      const { state, post } = runtime();
      const result = post({ line_user_id: 'synthetic-owner', ...request, ...credential });
      assert.equal(result.result.code, 'AUTH_REQUIRED', request.action || request.v2_action);
      assert.ok(state.effects.every(effect => effect === 'snapshot'), 'no Workspace or business resolution');
    }
    const { state, post } = runtime();
    assert.equal(post({ line_user_id: 'synthetic-owner', id_token: 'synthetic-token', ...request }).result.success, true);
    assert.ok(state.effects.includes('business:synthetic-owner'));
  }
});

test('verified LINE claims supply the request principal and cache only a token digest', () => {
  const { context, state } = runtime();
  const result = context.verifyLandlordLineIdToken_('synthetic-token-a');
  assert.equal(result.success, true); assert.equal(result.data.sub, 'synthetic-owner');
  assert.equal(context.verifyLandlordLineIdToken_('synthetic-token-a').success, true);
  assert.equal(state.calls, 1); assert.equal(state.puts[0].ttl, 3000);
  assert.ok(!state.puts[0].k.includes('synthetic-token-a'));
  context.verifyLandlordLineIdToken_('synthetic-token-b'); assert.equal(state.calls, 2);
  state.channel = 'another-channel';
  assert.equal(context.verifyLandlordLineIdToken_('synthetic-token-a').success, false);
});

test('tenant request cancellation applies the same verified mutation policy', () => {
  for (const credential of [{}, { id_token: 'synthetic-token', line_user_id: 'another-principal' },
    { id_token: 'synthetic-token', test: '1' }, { id_token: 'synthetic-token', invalid: true }]) {
    const { state, get } = runtime(); if (credential.invalid) state.claims.exp = now - 1;
    const result = get({ v2_action: 'tenant_contract_request_cancel', request_id: 'synthetic-request', ...credential });
    assert.equal(result.result.code, 'AUTH_REQUIRED'); assert.deepEqual(state.effects, []);
  }
  const { get } = runtime();
  const result = get({ v2_action: 'tenant_contract_request_cancel', id_token: 'synthetic-token', request_id: 'synthetic-request' });
  assert.equal(result.result.data.principal, 'synthetic-owner'); assert.equal(result.result.data.id, 'synthetic-request');
});

test('credential failures return a controlled response without business effects', () => {
  for (const change of [s => s.channel = '', s => s.networkError = true, s => s.code = 401,
    s => s.badJson = true, s => s.claims.iss = 'invalid', s => s.claims.aud = 'invalid',
    s => s.claims.sub = '', s => s.claims.exp = now - 1, s => s.claims.exp = 'NaN']) {
    const { state, get } = runtime(); change(state);
    assert.equal(get({ v2_action: 'landlord_home', id_token: 'synthetic-token' }).result.code, 'AUTH_REQUIRED');
    assert.deepEqual(state.effects, []);
  }
  for (const params of [{}, { id_token: 'synthetic-token', line_user_id: 'other-principal' },
    { id_token: 'synthetic-token', test: '1' }]) {
    const { get, state } = runtime();
    assert.equal(get({ v2_action: 'landlord_home', ...params }).result.code, 'AUTH_REQUIRED');
    assert.deepEqual(state.effects, []);
  }
});

test('all ordinary landlord GET actions and tenant submissions require credentials', () => {
  const names = [...new Set(source('apps-script/程式碼.js').match(/(?:landlord_[a-z_]+|tenant_[a-z_]+_submit)/g))];
  const postOnly = ['landlord_repair_tickets_init', 'landlord_repair_ticket_update',
    'landlord_contract_initiated_init', 'landlord_contract_initiate_new', 'landlord_contract_initiate_renewal',
    'landlord_contract_initiate_renewal_direct', 'landlord_contract_renewal_draft_update', 'landlord_contract_renewal_review_confirm',
    'landlord_contract_checkout_init', 'landlord_contract_checkout_settlement_init', 'landlord_contract_checkout_settlement_preview',
    'landlord_contract_checkout_complete', 'landlord_contract_checkout_evidence_upload', 'landlord_contract_paper_backfill',
    'landlord_tenant_initial_meter_init', 'landlord_tenant_initial_meter_save', 'landlord_contract_invite_cancel', 'landlord_contract_invite_reissue'];
  const classification = runtime().context;
  const exchanges = ['landlord_contract_initiated_status', 'landlord_contract_signing_review_auth_status',
    'landlord_contract_signing_reviews_fetch_status', 'landlord_contract_signing_review_update_status'];
  for (const action of names.filter(a => !postOnly.includes(a) && !exchanges.includes(a) && !classification.bankReceiptIsAction_(a))) {
    const { state, get } = runtime();
    const output = get({ v2_action: action, bridge: '1', request_id: 'synthetic-request' });
    assert.equal(output.result.code, 'AUTH_REQUIRED', action);
    assert.equal(output.requestId, 'synthetic-request'); assert.deepEqual(state.effects, [], action);
  }
});

function pageFunction(html, name) {
  const match = new RegExp('(?:async )?function ' + name + '\\(').exec(html);
  if (!match) return '';
  for (let end = html.indexOf('}', match.index); end !== -1; end = html.indexOf('}', end + 1)) {
    const candidate = html.slice(match.index, end + 1);
    try { new vm.Script(candidate); return candidate; } catch (_) {}
  }
  throw Error('Cannot parse ' + name);
}

test('every standalone page transport attaches the current LIFF credential at runtime', async () => {
  let count = 0;
  for (const file of readdirSync(root).filter(f => f.endsWith('.html'))) {
    const html = source(file);
    const fn = ['jsonpRequestOnce', 'jsonpRequest', 'callApi'].map(name => ({ name, code: pageFunction(html, name) }))
      .find(f => f.code.includes('CMWebsLiffRequestAuth.withIdToken'));
    if (!fn) continue;
    assert.ok(html.includes('src="liff-request-auth.js?v=20261029-email-login-messages-v1"'), file);
    const scripts = [], timers = new Map();
    const context = vm.createContext({ URL, URLSearchParams, Date, Math, Object, String, Number, Promise, Error,
      encodeURIComponent, location: { href: 'https://example.invalid/' + file },
      liff: { getIDToken: () => 'synthetic-current-token' },
      API_URL: 'https://example.invalid/exec', LINE_USER_ID: 'synthetic-owner', TEST_MODE: false,
      JSONP_REQUEST_TIMEOUT_MS: 100, getTenantIdParam: () => '', getTenantUserIdParam: () => '',
      setTimeout(fn) { const id = timers.size + 1; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
      document: { createElement: () => ({}), body: { appendChild(script) {
        scripts.push(script); const url = new URL(script.src);
        context[url.searchParams.get('callback')]({ success: true, code: 'OK', data: {} });
      } } }
    });
    context.window = context;
    vm.runInContext(source('liff-request-auth.js') + '\n' + source('landlord-auth.js'), context);
    context.LANDLORD_AUTH = context.CMWebsLandlordAuth.init({ lineUserId: context.LINE_USER_ID });
    context.REVIEW_AUTH = context.LANDLORD_AUTH;
    context.initLandlordAuthClient = () => context.LANDLORD_AUTH;
    vm.runInContext(fn.code, context);
    const action = file.startsWith('tenant-') ? 'tenant_payment_report_submit' : 'landlord_home';
    await context[fn.name](action, {});
    assert.equal(scripts.length, 1, file);
    assert.equal(new URL(scripts[0].src).searchParams.get('id_token'), 'synthetic-current-token', file);
    context.liff.getIDToken = () => null;
    await assert.rejects(context[fn.name](action, {}), /AUTH_REQUIRED/, file);
    assert.equal(scripts.length, 1, file + ' must reject before sending');
    count++;
  }
  assert.equal(count, 31, 'all standalone JSONP transports are exercised');
});

test('LINE entry status GET attaches credentials and clears its timeout', async () => {
  const context = browser(); const requests = [];
  Object.assign(context, { AbortController, API_URL: 'https://example.invalid/exec', LINE_USER_ID: 'synthetic-owner',
    fetch: async (url) => { requests.push(new URL(url)); return { ok: true, json: async () => ({ success: true }) }; } });
  vm.runInContext(pageFunction(source('landlord-entry.html'), 'fetchStatusJson'), context);
  assert.equal((await context.fetchStatusJson('landlord_entry_status', {})).success, true);
  assert.equal(requests[0].searchParams.get('id_token'), 'synthetic-id-token');
});

test('valid GET reaches the real dispatcher and credential-bound exchange polling remains separate', () => {
  const { get, state } = runtime();
  const result = get({ v2_action: 'landlord_home', id_token: 'synthetic-token' });
  assert.equal(result.result.data.principal, 'synthetic-owner');
  assert.deepEqual(state.effects, ['snapshot', 'synthetic-owner']);
  const poll = get({ v2_action: 'landlord_contract_initiated_status', request_id: 'synthetic-request', poll_secret: 'synthetic-poll-secret' });
  assert.equal(poll.result.success, true); assert.equal(state.calls, 1);
  const submitted = get({ v2_action: 'tenant_bind_submit', id_token: 'synthetic-token', phone: 'synthetic-phone' });
  assert.equal(submitted.result.data.principal, 'synthetic-owner');
  assert.equal(submitted.result.data.phone, 'synthetic-phone');
});

test('cache rechecks expiry and never extends the credential lifetime', () => {
  const { context, state } = runtime(); state.claims.exp = now + 40;
  assert.equal(context.verifyLandlordLineIdToken_('synthetic-token').success, true);
  assert.ok(state.puts[0].ttl <= 40);
  const key = state.puts[0].k; const expired = JSON.parse(state.entries.get(key)); expired.exp = now - 1;
  state.entries.set(key, JSON.stringify(expired)); state.claims.exp = now - 1;
  assert.equal(context.verifyLandlordLineIdToken_('synthetic-token').success, false);
});

function browser(token = 'synthetic-id-token', email = '') {
  const values = new Map(email ? [['cmwebs_landlord_session_token', email]] : []);
  const context = vm.createContext({ URL, URLSearchParams, Date, Math, String, Object, Error,
    setTimeout, clearTimeout, location: { href: 'https://example.invalid/', search: '' },
    sessionStorage: { getItem: k => values.get(k) || null }, liff: { getIDToken: () => token },
    document: {}, addEventListener() {} }); context.window = context;
  vm.runInContext(source('liff-request-auth.js') + '\n' + source('landlord-auth.js'), context);
  return context;
}

test('shared LINE transport sends the current token and Email transport remains a bridge', () => {
  const line = browser(); line.CMWebsLandlordAuth.init({ lineUserId: 'synthetic-owner', testMode: true });
  assert.equal(line.CMWebsLandlordAuth.getRequestAuthParams().id_token, 'synthetic-id-token');
  const url = new URL(line.CMWebsLiffRequestAuth.withIdToken('https://example.invalid/?v2_action=landlord_home&id_token=caller-token'));
  assert.equal(url.searchParams.getAll('id_token').length, 1); assert.equal(url.searchParams.get('id_token'), 'synthetic-id-token');
  const email = browser(null, 'synthetic-email-session'); email.liff.getIDToken = () => { throw Error('Email must not read LIFF'); };
  assert.equal(email.CMWebsLandlordAuth.getRequestAuthParams().landlord_session_token, 'synthetic-email-session');
  assert.equal(email.CMWebsLandlordAuth.getRequestAuthParams().id_token, undefined);
  assert.throws(() => browser(null).CMWebsLiffRequestAuth.withIdToken('https://example.invalid/?v2_action=tenant_payment_report_submit'), /AUTH_REQUIRED/);
  assert.doesNotThrow(() => browser(null).CMWebsLiffRequestAuth.withIdToken('https://example.invalid/?v2_action=landlord_contract_initiated_status'));
});

test('LINE JSON POST consumers attach the active credential and preserve request data', async () => {
  const context = browser(); const bodies = [];
  context.CMWebsLandlordAuth.init({ lineUserId: 'synthetic-owner' });
  Object.assign(context, { API_URL: 'https://example.invalid/exec', LINE_USER_ID: 'synthetic-owner',
    LANDLORD_AUTH: context.CMWebsLandlordAuth, showAlert() {}, confirm: () => true,
    fetch: async (_, options) => { bodies.push(JSON.parse(options.body)); return { ok: true,
      text: async () => JSON.stringify({ success: true }), json: async () => ({ success: true }) }; } });
  vm.runInContext(pageFunction(source('landlord-tenant-detail.html'), 'postJsonBody'), context);
  await context.postJsonBody({ v2_action: 'landlord_contract_document_upload', contract_id: 'synthetic-contract', id_token: 'caller-token' });
  assert.equal(bodies[0].id_token, 'synthetic-id-token'); assert.equal(bodies[0].contract_id, 'synthetic-contract');
  vm.runInContext(pageFunction(source('tenant-contract.html'), 'submitRenewalIntent'), context);
  await context.submitRenewalIntent('synthetic-contract', 'accepted');
  assert.equal(bodies[1].id_token, 'synthetic-id-token'); assert.equal(bodies[1].decision, 'accepted');
});

test('the Email resolver keeps the authenticated session principal independent of LINE parameters', () => {
  const { context, state } = runtime();
  context.resolveLandlordEmailSession_ = token => ({ success: token === 'synthetic-email-session',
    data: { user: { line_user_id: 'synthetic-email-owner' }, workspace: {}, membership: {} } });
  const result = context.resolveLandlordPrincipal_({ landlord_session_token: 'synthetic-email-session', line_user_id: 'caller-principal' });
  assert.equal(result.data.principal_line_user_id, 'synthetic-email-owner'); assert.equal(state.calls, 0);
  assert.deepEqual(state.effects, []);
});

test('public HTML pages contain no fixed test principal', () => {
  for (const file of readdirSync(root).filter(f => f.endsWith('.html'))) {
    assert.equal(source(file).includes('TEST_LINE_USER_ID'), false, file);
  }
});
