import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const pages = ['landlord-home.html','landlord-tenants.html','landlord-properties.html','landlord-contract-requests.html','landlord-arrears.html','landlord-more.html','landlord-settings.html','landlord-rooms.html','landlord-tenant-detail.html'];
for (const page of pages) test(`${page} provides the complete desktop destinations without a contextless checkout`, () => {
  const nav = read(page).match(/<nav class="desktop-nav">([\s\S]*?)<\/nav>/)[1];
  const context = vm.createContext({goPage: destination => {context.destination = destination;}});
  for (const [label, target] of [['總覽','landlord-home.html'],['房客','landlord-tenants.html'],['物件與房間','landlord-properties.html'],['合約','landlord-contract-requests.html'],['退房','landlord-tenants.html'],['帳款','landlord-arrears.html'],['營收與資產','landlord-revenue-dashboard.html'],['更多工具','landlord-more.html']]) {
    const button = [...nav.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find(m => m[2].replace(/<[^>]+>/g,'').trim() === label);
    assert.ok(button, `${label} must be reachable on ${page}`);
    vm.runInContext(button[1].match(/onclick="([^"]+)"/)[1], context);
    assert.equal(context.destination, target);
  }
});
function fn(name, next) {return read('landlord-contract-requests.html').split('    function ' + name)[1]?.split('    function ' + next)[0];}
test('native auth polling uses JSONP for the cross-origin Apps Script status endpoint', async () => {
  const context = vm.createContext({URL, LINE_USER_ID:'synthetic-user', TEST_MODE:false, window:{CMWebsLandlordApi:{request:async config => ({action:config.action, params:config.params})}}, API_URL:'https://script.google.com/macros/s/fixture/exec', fetch: async () => {throw new Error('cross-origin GET unavailable');}});
  vm.runInContext('function callNativeSigningReviewAuthStatus' + fn('callNativeSigningReviewAuthStatus','initializeNativeSigningReviewSession').split('    async')[0], context);
  // Include the real transport implementation rather than a success-only stub.
  const transport = read('landlord-contract-requests.html').match(/    (?:async )?function fetchStatusJson\(url\) \{[\s\S]*?\n    \}/)[0];
  vm.runInContext(transport, context);
  const result = await context.callNativeSigningReviewAuthStatus('synthetic-request', 'synthetic-poll');
  assert.equal(result.action, 'landlord_contract_signing_review_auth_status');
  assert.equal(result.params.request_id, 'synthetic-request');
  assert.equal(result.params.poll_secret, 'synthetic-poll');
});

test('contract page preserves the failed verification cause in both native sections', async () => {
  const source = read('landlord-contract-requests.html');
  const context = vm.createContext({window:{CMWebsLandlordAuth:{}}, TEST_MODE:false, CONTRACT_FILTER_ID:'', TENANT_FILTER_ID:'',
    ensureLandlordAuthReady:async()=>true, isEmailAuthSession:()=>false,
    initializeNativeSigningReviewSession:async()=>{const error=new Error('Provider rejected verification');error.code='LINE_TOKEN_VERIFY_FAILED';throw error;},
    jsonpRequest:async()=>({}), renderLoading(){}, renderPage(data){context.rendered=data;}, renderError(message){throw new Error(message);}});
  vm.runInContext("let NATIVE_SIGNING_REVIEW_SESSION_TOKEN = ''; let NATIVE_SIGNING_REVIEW_AUTH_ERROR = null;",context);
  for (const [name,next] of [['callNativeSigningReviewApi','callLandlordInitiatedStatus'],['callLandlordInitiatedApi','initLineUserId'],['loadPage','main']]) {
    const code = source.slice(source.indexOf('    async function '+name), source.indexOf('    '+(next==='callLandlordInitiatedStatus'?'function ':'async function ')+next));
    vm.runInContext(code,context);
  }
  await context.loadPage(false);
  assert.equal(context.rendered.native_signing_reviews_error.code,'LINE_TOKEN_VERIFY_FAILED');
  assert.equal(context.rendered.landlord_initiated_contracts_error.code,'LINE_TOKEN_VERIFY_FAILED');
  assert.equal(context.rendered.landlord_initiated_contracts_error.message,'Provider rejected verification');
});

test('contextless checkout offers tenant selection without initializing or writing', async () => {
  const source = read('landlord-tenant-checkout.html');
  const app={innerHTML:''};
  const context=vm.createContext({CONTRACT_ID:'',document:{getElementById:()=>app},initializeNativeSigningReviewSession:()=>{throw new Error('must not authenticate without a selection');}});
  vm.runInContext(source.match(/    async function loadPage\(\) \{[\s\S]*?(?=\n    loadPage\(\);)/)[0],context);
  await context.loadPage();
  assert.match(app.innerHTML,/href="landlord-tenants.html"/);
  assert.doesNotMatch(app.innerHTML,/缺少 contract_id/);
});

test('missing LINE signing credential retains an actionable code before any request', async () => {
  const source=read('landlord-contract-requests.html');
  const context=vm.createContext({TEST_MODE:false,liff:{getIDToken:()=>null},fetch:()=>{throw new Error('must not send without credential');}});
  const start=source.indexOf('    async function initializeNativeSigningReviewSession');
  const end=source.indexOf('    function callNativeSigningReviewExchangeStatus',start);
  vm.runInContext(source.slice(start,end),context);
  await assert.rejects(context.initializeNativeSigningReviewSession(), error=>error.code==='MISSING_ID_TOKEN');
});

test('LINE recovery is explicit, strips old OAuth callback fields and leaves contract context intact', () => {
  const source=read('landlord-contract-requests.html');
  const calls=[];
  const context=vm.createContext({URL,location:{href:'https://example.test/landlord-contract-requests.html?contract_id=C1&tenant_id=T1&v=fixture&code=old&state=old&liff.state=old#native-signing-reviews'},liff:{logout:()=>calls.push('logout'),login:options=>calls.push(options)}});
  const start=source.indexOf('    function renderNativeAuthRecovery');
  const end=source.indexOf('    async function callNativeSigningReviewApi',start);
  vm.runInContext(source.slice(start,end),context);
  assert.equal(calls.length,0,'render/load must never start an automatic OAuth loop');
  assert.equal(context.renderNativeAuthRecovery({code:'WORKSPACE_FORBIDDEN'}),'');
  assert.match(context.renderNativeAuthRecovery({code:'LINE_ID_TOKEN_EXPIRED'}),/重新登入 LINE/);
  context.retryContractLineLogin();
  assert.equal(calls[0],'logout');
  const target=new URL(calls[1].redirectUri);
  assert.equal(target.searchParams.get('contract_id'),'C1');
  assert.equal(target.searchParams.get('tenant_id'),'T1');
  assert.equal(target.searchParams.has('code'),false);
  assert.equal(target.searchParams.has('state'),false);
  assert.equal(target.searchParams.has('liff.state'),false);
});
