import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(
  new URL('../landlord-contract-requests.html', import.meta.url),
  'utf8'
);

function extractFunction(name) {
  const start = source.indexOf(`async function ${name}(`) >= 0
    ? source.indexOf(`async function ${name}(`)
    : source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);

  const openingBrace = source.indexOf('{', start);
  let depth = 0;

  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  throw new Error(`Could not extract ${name}`);
}

test('test mode skips authenticated signing-review network calls', async () => {
  const state = { fetchCalls: 0 };
  const context = {
    Error,
    Object,
    Promise,
    String,
    state,
    fetch() {
      state.fetchCalls += 1;
      throw new Error('unexpected authenticated request');
    }
  };

  vm.runInNewContext(
    [
      'let TEST_MODE = true;',
      'let NATIVE_SIGNING_REVIEW_SESSION_TOKEN = "";',
      extractFunction('initializeNativeSigningReviewSession'),
      extractFunction('callNativeSigningReviewApi')
    ].join('\n'),
    context
  );

  assert.equal(
    await context.initializeNativeSigningReviewSession(),
    false,
    'test mode must not initialize a landlord signing-review session'
  );
  await assert.rejects(
    () => context.callNativeSigningReviewApi('landlord_contract_signing_reviews_init'),
    /房東審核身分驗證已失效/,
    'missing session must fail closed before the authenticated API call'
  );
  assert.equal(state.fetchCalls, 0, 'test mode must not issue an authenticated request');
});

test('test mode renderer returns the deterministic unavailable state at runtime', () => {
  const renderSource = extractFunction('renderNativeSigningReviewSection');
  const loadSource = extractFunction('loadPage');
  const testModeGuard = loadSource.indexOf('if (TEST_MODE)');
  const nativeReadCall = loadSource.indexOf('callNativeSigningReviewApi(');

  assert.ok(
    testModeGuard >= 0 && nativeReadCall > testModeGuard,
    'loadPage must branch around native signing-review API loading in test mode'
  );

  assert.match(
    renderSource,
    /TEST_MODE/,
    'the native signing-review renderer must branch explicitly for test mode'
  );
  assert.match(
    renderSource,
    /測試模式|test[- ]only/i,
    'test mode must identify its unavailable state instead of using a Production auth error'
  );
  assert.doesNotMatch(
    renderSource,
    /身分驗證已失效/,
    'test-only readback must not present a Production identity failure'
  );

  const context = {};
  vm.runInNewContext(
    [
      'let TEST_MODE = true;',
      'let TENANT_FILTER_ID = "T000020";',
      'let CONTRACT_FILTER_ID = "C000019";',
      'let SIGNING_REVIEWS = [];',
      'let PAGE_DATA = { native_signing_reviews_error: { code: "UNKNOWN", message: "房東審核身分驗證已失效" } };',
      extractFunction('renderNativeSigningReviewSection')
    ].join('\n'),
    context
  );

  const rendered = context.renderNativeSigningReviewSection();
  assert.match(rendered, /測試模式：合約全文與簽名暫不載入/);
  assert.match(rendered, /不會呼叫正式簽署審核 API/);
  assert.doesNotMatch(rendered, /身分驗證已失效/);
});

async function runLoadPage(testMode) {
  const state = { calls: [], renderedData: null, error: null };
  const context = { state, Promise, Error, Object, Array, String };

  vm.runInNewContext(
    [
      `let TEST_MODE = ${testMode};`,
      'let CONTRACT_FILTER_ID = "C000019";',
      'let TENANT_FILTER_ID = "T000020";',
      'function renderLoading() {}',
      'function renderPage(data) { state.renderedData = data; }',
      'function renderError(error) { state.error = String(error && error.message || error); }',
      'function callApi(action) { state.calls.push(action); return Promise.resolve({ requests: [] }); }',
      'function callNativeSigningReviewApi() { state.calls.push("native-signing-review"); return Promise.resolve({ items: [] }); }',
      'function callLandlordInitiatedApi(action) { state.calls.push(action); return Promise.resolve({ items: [] }); }',
      extractFunction('loadPage')
    ].join('\n'),
    context
  );

  await context.loadPage(false);
  return state;
}

test('test mode skips the native read at loadPage runtime while formal mode keeps it', async () => {
  const testModeState = await runLoadPage(true);
  assert.deepEqual(Array.from(testModeState.calls), [
    'landlord_contract_requests_init',
    'landlord_contract_initiated_init'
  ]);
  assert.equal(testModeState.error, null);
  assert.equal(testModeState.renderedData.native_signing_reviews_error, null);

  const formalState = await runLoadPage(false);
  assert.deepEqual(Array.from(formalState.calls), [
    'landlord_contract_requests_init',
    'native-signing-review',
    'landlord_contract_initiated_init'
  ]);
  assert.equal(formalState.error, null);
  assert.deepEqual(Array.from(formalState.renderedData.native_signing_reviews), []);
});

console.log('Phase 192 test-mode contract readback regression specification loaded.');
