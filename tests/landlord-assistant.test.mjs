import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

function loadAssistant() {
  const context = vm.createContext({ window: {} });
  vm.runInContext(read('landlord-assistant.js'), context);
  return context.window.CMWEBS_LANDLORD_ASSISTANT;
}

test('every catalog entry has steps and links to a page that exists', () => {
  const { catalog } = loadAssistant();
  const ids = new Set();
  assert.ok(catalog.length >= 20);
  for (const item of catalog) {
    assert.ok(!ids.has(item.id), 'duplicate id ' + item.id);
    ids.add(item.id);
    assert.ok(item.title && item.keywords.length && item.steps.length, item.id);
    const page = item.link.page.split('?')[0];
    assert.match(page, /^landlord-[a-z-]+\.html$/, item.id);
    assert.ok(existsSync(new URL('../' + page, import.meta.url)), item.id + ' links to missing ' + page);
  }
});

test('everyday questions find the right function first', () => {
  const { search } = loadAssistant();
  const cases = {
    '怎麼新增房客': 'new_tenant',
    '我有新的房客要簽約': 'new_tenant',
    '房客要退房怎麼處理': 'checkout',
    '房客要搬走了': 'checkout',
    '合約退房要怎麼處理': 'checkout',
    '續約邀請要重傳': 'reissue_invite',
    '忘了複製確認碼': 'reissue_invite',
    '合約快到期要續約': 'renewal',
    '房客有沒有簽名回傳': 'signing_status',
    '誰還沒繳': 'reminder',
    '房客付現金': 'manual_settle',
    '入帳要怎麼核對': 'confirm_payment',
    '銷錯帳了': 'undo_settle',
    '要抄電表': 'meter_billing',
    '停水要通知大家': 'announcement',
    '補登紙本合約': 'paper_backfill',
    '房客沒綁定 LINE': 'tenant_binding',
    '改收款帳號': 'settings'
  };
  for (const [question, expected] of Object.entries(cases)) {
    const results = search(question);
    assert.equal(results[0] && results[0].id, expected, question + ' → ' + (results[0] && results[0].id));
  }
  assert.equal(search('').length, 0);
  assert.equal(search('今天天氣如何').length, 0);
});

function loadWithApi(askAssistant, storage) {
  const store = storage || new Map();
  const window = {
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }
  };
  if (askAssistant) window.CMWebsLandlordApi = { askAssistant };
  const context = vm.createContext({ window });
  vm.runInContext(read('landlord-assistant.js'), context);
  return { assistant: context.window.CMWEBS_LANDLORD_ASSISTANT, store };
}

test('an AI answer keeps the chosen catalog entry; none or failure falls back to keywords', async () => {
  let sent;
  const { assistant } = loadWithApi(async (question, catalog) => {
    sent = { question, ids: catalog.map(item => item.id) };
    return { id: 'checkout', reply: '退房請到房客資料按「辦理退房」。' };
  });
  const reply = await assistant.answer('房客月底要搬走');
  assert.equal(sent.question, '房客月底要搬走');
  assert.equal(sent.ids.length, assistant.catalog.length);
  assert.deepEqual([...reply.ids], ['checkout']);
  assert.equal(reply.reply, '退房請到房客資料按「辦理退房」。');
  const none = await loadWithApi(async () => ({ id: 'none', reply: '換個說法試試。' })).assistant.answer('房客要退房');
  assert.equal(none.ids[0], 'checkout');
  const failed = await loadWithApi(async () => { throw new Error('ASSISTANT_NOT_ENABLED'); }).assistant.answer('房客要退房');
  assert.equal(failed.reply, '');
  assert.equal(failed.ids[0], 'checkout');
  const offline = await loadWithApi(null).assistant.answer('誰還沒繳');
  assert.equal(offline.ids[0], 'reminder');
});

test('chat messages render bubbles, steps and a 前往 button, escaping text', () => {
  const { assistant } = loadWithApi(null);
  assert.match(assistant.renderMessage({ role: 'user', text: '<b>退房</b>' }), /cma-me"><div class="cma-bubble">&lt;b&gt;退房&lt;\/b&gt;/);
  const html = assistant.renderMessage({ role: 'assistant', reply: '可以這樣做', ids: ['checkout'] });
  assert.match(html, /房客退房、退租/);
  assert.match(html, /<button class="cma-go" type="button" data-page="landlord-tenants\.html">前往房客名單 ›<\/button>/);
  assert.match(assistant.renderMessage({ role: 'assistant', reply: '', ids: [] }), /我找不到相符的功能/);
  assert.match(assistant.renderMessage({ role: 'assistant', pending: true }), /助理思考中/);
});

test('the conversation survives page changes for one day on this phone only', () => {
  const { assistant, store } = loadWithApi(null);
  const now = Date.parse('2026-11-12T10:00:00Z');
  assistant.saveChat({ open: false, messages: [{ role: 'user', text: '退房' }] }, now);
  assert.equal(assistant.loadChat(now + 60000).messages.length, 1);
  assert.equal(assistant.loadChat(now + 25 * 3600000).messages.length, 0, 'expires after a day');
  assistant.saveChat({ open: true, messages: Array.from({ length: 40 }, (_, i) => ({ role: 'user', text: String(i) })) }, now);
  const kept = assistant.loadChat(now);
  assert.equal(kept.messages.length, 30);
  assert.equal(kept.open, true);
  assistant.clearChat();
  assert.equal(store.size, 0);
  assert.match(read('landlord-auth.js'), /removeItem\('cmwebs_landlord_assistant_chat_v1'\)/);
});

test('every landlord page with the bottom toolbar loads the assistant', () => {
  const pages = ['landlord-home.html', 'landlord-tenants.html', 'landlord-arrears.html', 'landlord-more.html',
    'landlord-tenant-detail.html', 'landlord-contract-requests.html', 'landlord-properties.html', 'landlord-team.html'];
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /<script src="landlord-assistant\.js\?v=[^"]+"( defer)?><\/script>/, page);
    assert.match(html, /<link rel="stylesheet" href="landlord-assistant\.css\?v=[^"]+" \/>/, page);
  }
  assert.match(read('landlord-more.html'), /CMWEBS_LANDLORD_ASSISTANT\.openChat\(\)/);
  const css = read('landlord-assistant.css');
  assert.match(css, /\.cma-fab \{[\s\S]*bottom: calc\(var\(--nav-height, 68px\) \+ env\(safe-area-inset-bottom\) \+ 14px\)/);
  assert.match(css, /\.cma-panel \{[\s\S]*z-index: 1300/);
});

test('the read client posts the question to the read service with the landlord credential', () => {
  const api = read('landlord-api.js');
  assert.match(api, /askAssistant: async function \(question, catalog\)/);
  assert.match(api, /'\/v1\/assistant'/);
});
