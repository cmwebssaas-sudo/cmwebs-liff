import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const page = readFileSync(new URL('../landlord-contract-documents.html', import.meta.url), 'utf8');
assert.match(page, /landlord-auth\.js\?v=/);
const script = [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1]).find(body => body.includes('async function initLine'));
assert.ok(script);
let mode = 'email';
let token = 'EMAIL_SESSION';
let lineCalls = 0;
let redirect = '';
const requests = [];
const auth = {
  init() { return this; },
  getMode() { return mode; },
  getRequestAuthParams() { return token ? { landlord_session_token: token } : {}; },
  async request(action, params) {
    requests.push({ action, params });
    return { success: true, data: { documents: [] } };
  },
  handleAuthFailure() { return false; }
};
const context = {
  URL, URLSearchParams,
  location: {
    href: 'https://example.test/cmwebs-liff/landlord-contract-documents.html',
    search: '',
    replace(value) { redirect = value; }
  },
  document: {
    documentElement: { style: { setProperty() {} } },
    getElementById() { return { addEventListener() {} }; }
  },
  CMWebsLandlordAuth: auth,
  liff: {
    async init() { lineCalls++; },
    isLoggedIn() { return true; },
    async getProfile() { return { userId: 'LINE_PRINCIPAL' }; }
  },
  innerHeight: 900,
  addEventListener() {}
};
context.window = context;
vm.createContext(context);
vm.runInContext(script.replace(/\(async function bootstrap\(\) \{[\s\S]*?\}\)\(\);/, ''), context);

assert.equal(await context.initLine(), true);
assert.equal(lineCalls, 0, 'Email document overview must not initialize LINE');
await context.jsonpRequest('landlord_contract_documents_init', { contract_id: '' });
await context.jsonpRequest('landlord_contract_document_download', { document_id: 'D1' });
assert.deepEqual(requests.map(item => item.action), [
  'landlord_contract_documents_init', 'landlord_contract_document_download'
]);
assert.equal(requests[1].params.document_id, 'D1');

token = '';
assert.equal(await context.initLine(), false);
assert.equal(new URL(redirect).searchParams.get('mode'), 'email');
assert.equal(new URL(redirect).searchParams.get('return_to'), 'landlord-contract-documents.html');
assert.equal(lineCalls, 0, 'Missing desktop session must not fall back to LINE');

mode = 'line';
assert.equal(await context.initLine(), true);
assert.equal(lineCalls, 1, 'Mobile LINE authentication remains available');
console.log('Document overview Email session and mobile LINE regression passed.');
