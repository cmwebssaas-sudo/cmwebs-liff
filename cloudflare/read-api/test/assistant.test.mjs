import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAssistantHandler, parseAssistantRequest, assistantEnabledFor } from '../src/assistant.js';

const origin = 'https://cmwebssaas-sudo.github.io';
const catalog = [
  { id: 'checkout', title: '房客退房、退租', keywords: ['退房'] },
  { id: 'renewal', title: '續約', keywords: ['續約'] }
];
const access = workspace_id => ({ workspace: { workspace_id } });
function env(bridgeReply, extra = {}) {
  const calls = [];
  return {
    calls,
    DB: {},
    CMWEBS_ASSISTANT_TOKEN: 'bridge-token',
    ASSISTANT_AI_WORKSPACES: 'W000001',
    ASSISTANT_BRIDGE: {
      async fetch(url, init) {
        calls.push({ url, init, body: JSON.parse(init.body) });
        return typeof bridgeReply === 'function' ? bridgeReply() : Response.json(bridgeReply.body, { status: bridgeReply.status || 200 });
      }
    },
    ...extra
  };
}
const ask = (handler, e, body, headers = {}) => handler(new Request('https://read.test/v1/assistant', {
  method: 'POST',
  headers: { origin, authorization: 'LIFF token', 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body)
}), e);

test('an allowlisted landlord gets a catalog function from the bridge', async () => {
  const handler = createAssistantHandler({ verify: async () => ({ access: access('W000001') }) });
  const e = env({ body: { success: true, data: { id: 'checkout', reply: '請到房客資料按辦理退房。' } } });
  const response = await ask(handler, e, { question: '房客要搬走', catalog });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, data: { id: 'checkout', reply: '請到房客資料按辦理退房。' } });
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.equal(e.calls[0].url, 'http://127.0.0.1:18760/v1/answer');
  assert.equal(e.calls[0].init.headers.authorization, 'Bearer bridge-token');
  assert.deepEqual(e.calls[0].body.question, '房客要搬走');
});

test('ids outside the catalog become none', async () => {
  const handler = createAssistantHandler({ verify: async () => ({ access: access('W000001') }) });
  const response = await ask(handler, env({ body: { success: true, data: { id: 'drop_tables', reply: 'x' } } }), { question: '刪資料', catalog });
  assert.equal((await response.json()).data.id, 'none');
});

test('other Workspaces are refused before the bridge is called', async () => {
  const handler = createAssistantHandler({ verify: async () => ({ access: access('W000002') }) });
  const e = env({ body: {} });
  const response = await ask(handler, e, { question: '退房', catalog });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'ASSISTANT_NOT_ENABLED');
  assert.equal(e.calls.length, 0);
});

test('an unauthenticated request never reaches the bridge', async () => {
  const handler = createAssistantHandler({ verify: async () => { throw Object.assign(new Error('AUTH_REQUIRED'), { code: 'AUTH_REQUIRED' }); } });
  const e = env({ body: {} });
  const response = await ask(handler, e, { question: '退房', catalog });
  assert.equal(response.status, 401);
  assert.equal(e.calls.length, 0);
});

test('bridge failures and missing configuration are reported plainly', async () => {
  const handler = createAssistantHandler({ verify: async () => ({ access: access('W000001') }) });
  assert.equal((await (await ask(handler, env({ status: 503, body: { success: false, code: 'ASSISTANT_BUSY' } }), { question: '退房', catalog })).json()).code, 'ASSISTANT_BUSY');
  assert.equal((await (await ask(handler, env(() => { throw new Error('tunnel down'); }), { question: '退房', catalog })).json()).code, 'ASSISTANT_UNAVAILABLE');
  const missing = await ask(handler, env({ body: {} }, { ASSISTANT_BRIDGE: undefined }), { question: '退房', catalog });
  assert.deepEqual([missing.status, (await missing.json()).code], [503, 'ASSISTANT_NOT_READY']);
});

test('foreign origins, wrong methods and malformed bodies are refused', async () => {
  const handler = createAssistantHandler({ verify: async () => ({ access: access('W000001') }) });
  assert.equal((await ask(handler, env({ body: {} }), { question: '退房', catalog }, { origin: 'https://evil.test' })).status, 403);
  assert.equal((await handler(new Request('https://read.test/v1/assistant', { headers: { origin } }), env({ body: {} }))).status, 405);
  assert.equal((await ask(handler, env({ body: {} }), { question: '', catalog })).status, 400);
  const preflight = await handler(new Request('https://read.test/v1/assistant', { method: 'OPTIONS', headers: {
    origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization, content-type' } }), env({ body: {} }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-methods'), 'POST');
});

test('request parsing and allowlist helpers', () => {
  assert.equal(parseAssistantRequest('{"question":"x","catalog":[{"id":"Bad-Id","title":"t"}]}'), null);
  assert.equal(parseAssistantRequest('{"question":"x","catalog":[{"id":"none","title":"t"}]}'), null);
  assert.equal(parseAssistantRequest('not json'), null);
  assert.equal(parseAssistantRequest(JSON.stringify({ question: 'q'.repeat(201), catalog })), null);
  assert.deepEqual(parseAssistantRequest(JSON.stringify({ question: ' 退房 ', catalog })).question, '退房');
  assert.equal(assistantEnabledFor({ ASSISTANT_AI_WORKSPACES: 'W1, W2' }, 'W2'), true);
  assert.equal(assistantEnabledFor({}, 'W1'), false);
});
