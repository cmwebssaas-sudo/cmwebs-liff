import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const dir = new URL('../apps-script/', import.meta.url);
const sources = readdirSync(dir).filter(name => name.endsWith('.js') && name !== 'TESTS.js')
  .map(name => [name, readFileSync(new URL(name, dir), 'utf8')]);
const code = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/^\s*\*.*$/gm, '');

function calls(source, name) {
  const found = [];
  let from = 0;
  while ((from = source.indexOf(name + '(', from)) >= 0) {
    if (/function\s+$/.test(source.slice(Math.max(0, from - 10), from)) || /[\w$]$/.test(source.slice(Math.max(0, from - 1), from))) { from += name.length; continue; }
    let i = from + name.length + 1, depth = 1, quote = '', commas = 0;
    for (; depth; i++) {
      const c = source[i];
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; }
      else if (`'"\``.includes(c)) quote = c;
      else if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) depth--;
      else if (c === ',' && depth === 1) commas++;
    }
    found.push(commas + 1);
    from = i;
  }
  return found;
}

test('only the send entry knows the LINE push endpoint', () => {
  const owners = sources.filter(([, source]) => code(source).includes('api.line.me/v2/bot/message/push')).map(([name]) => name);
  assert.deepEqual(owners, ['V2_API.js']);
});

test('every LINE push names its Workspace', () => {
  for (const [name, source] of sources) {
    for (const count of calls(code(source), 'pushLineTextMessage_')) assert.equal(count, 4, name);
    for (const count of calls(code(source), 'lineBuildPushRequest_')) assert.ok(count >= 4, name);
    for (const count of calls(code(source), 'lmPushText_')) assert.equal(count, 3, name);
    for (const count of calls(code(source), 'contractRequestPushLine_')) assert.equal(count, 4, name);
  }
});

function apiContext(status = 200, properties = { LINE_CHANNEL_ACCESS_TOKEN: 'synthetic-token' }) {
  const requests = [];
  const context = {
    Date, JSON, String, Math,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties[key] ?? null }) },
    Utilities: { Charset: { UTF_8: 'utf8' }, getUuid: () => 'synthetic-nonce-0001',
      computeHmacSha256Signature: (value, key) => [...createHmac('sha256', key).update(value).digest()] },
    readReplicaHex_: bytes => bytes.map(value => ((value + 256) % 256).toString(16).padStart(2, '0')).join(''),
    UrlFetchApp: { fetch(url, options) { requests.push({ url, options }); return { getResponseCode: () => status, getContentText: () => 'body' }; } }
  };
  const source = readFileSync(new URL('V2_API.js', dir), 'utf8');
  const start = source.indexOf('let LINE_WORKER_ROUTE_CONFIG_');
  const end = source.indexOf('// ==================================================', start);
  vm.runInNewContext(source.slice(start, end), context);
  return { context, requests };
}

test('existing push request stays the same for every Workspace', () => {
  for (const workspace of ['W_A', 'W_B', '']) {
    const { context, requests } = apiContext();
    assert.equal(context.pushLineTextMessage_('U_SYNTHETIC', '合成通知', 'retry-key', workspace).success, true);
    assert.equal(requests[0].url, 'https://api.line.me/v2/bot/message/push');
    assert.equal(requests[0].options.method, 'post');
    assert.equal(requests[0].options.contentType, 'application/json');
    assert.equal(requests[0].options.muteHttpExceptions, true);
    assert.equal(requests[0].options.headers.Authorization, 'Bearer synthetic-token');
    assert.equal(requests[0].options.headers['X-Line-Retry-Key'], 'retry-key');
    assert.equal(requests[0].options.payload, JSON.stringify({ to: 'U_SYNTHETIC', messages: [{ type: 'text', text: '合成通知' }] }));
  }
});

test('Workspaces outside the Worker list stay on the existing token', () => {
  const { context } = apiContext(200, { CMWEBS_LINE_WORKER_WORKSPACES: 'W_TEST', READ_REPLICA_URL: 'https://worker.test/', LINE_REGISTRY_SIGNING_SECRET: 'synthetic-signing' });
  assert.equal(context.lineSendRoute_('W_OTHER').transport, 'legacy');
  assert.equal(context.lineSendRoute_('').transport, 'legacy');
  assert.equal(context.lineBuildPushRequest_('W_OTHER', 'synthetic-token', 'U', 'x').url, 'https://api.line.me/v2/bot/message/push');
});

test('listed Workspaces send a signed Worker request without the shared token', () => {
  const { context, requests } = apiContext(200, { LINE_CHANNEL_ACCESS_TOKEN: 'synthetic-token', CMWEBS_LINE_WORKER_WORKSPACES: 'W_TEST, W_NEXT', READ_REPLICA_URL: 'https://worker.test/', LINE_REGISTRY_SIGNING_SECRET: 'synthetic-signing' });
  assert.equal(context.pushLineTextMessage_('U_SYNTHETIC', '合成通知', 'retry-key', 'W_TEST').success, true);
  const { url, options } = requests[0];
  assert.equal(url, 'https://worker.test/internal/line-send');
  assert.equal(options.followRedirects, false);
  assert.equal(JSON.stringify(options).includes('synthetic-token'), false);
  assert.deepEqual(JSON.parse(options.payload), { workspace_id: 'W_TEST', to: 'U_SYNTHETIC', text: '合成通知', retry_key: 'retry-key' });
  const expected = createHmac('sha256', 'synthetic-signing').update(options.headers['X-CMWebs-Timestamp'] + '\n' + options.headers['X-CMWebs-Nonce'] + '\n' + options.payload).digest('hex');
  assert.equal(options.headers['X-CMWebs-Signature'], expected);
});

test('a listed Workspace never falls back when the Worker is not configured', () => {
  const { context, requests } = apiContext(200, { LINE_CHANNEL_ACCESS_TOKEN: 'synthetic-token', CMWEBS_LINE_WORKER_WORKSPACES: 'W_TEST' });
  assert.equal(context.pushLineTextMessage_('U', 'x', '', 'W_TEST').code, 'LINE_WORKER_ROUTE_NOT_CONFIGURED');
  assert.equal(requests.length, 0);
});

test('retry and failure results keep their existing codes', () => {
  assert.equal(apiContext(409).context.pushLineTextMessage_('U', 'x', 'key', 'W').success, true);
  assert.equal(apiContext(400).context.pushLineTextMessage_('U', 'x', 'key', 'W').code, 'LINE_PUSH_PERMANENT');
  assert.equal(apiContext(500).context.pushLineTextMessage_('U', 'x', 'key', 'W').code, 'LINE_PUSH_FAILED');
});
