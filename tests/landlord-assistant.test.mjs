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

test('results show steps and a button that opens the page through goPage', () => {
  const { renderResults, search } = loadAssistant();
  const html = renderResults(search('房客要退房'), '房客要退房');
  assert.match(html, /房客退房、退租/);
  assert.match(html, /<ol class="assistant-steps"><li>/);
  assert.match(html, /class="assistant-go" type="button" data-page="landlord-tenants\.html">前往房客名單 ›<\/button>/);
  assert.match(renderResults([], '<b>'), /找不到相符的功能/);
  assert.doesNotMatch(renderResults([{ title: '<b>x</b>', steps: ['<i>'], link: { page: 'a', label: 'b' } }], 'q'), /<b>|<i>/);
});

test('the More page loads the assistant and mounts the panel', () => {
  const page = read('landlord-more.html');
  assert.match(page, /<script src="landlord-assistant\.js\?v=[^"]+"><\/script>/);
  assert.match(page, /<form id="assistantPanel"/);
  assert.match(page, /CMWEBS_LANDLORD_ASSISTANT\.mount\('assistantPanel'\)/);
});

function loadWithApi(askAssistant) {
  const context = vm.createContext({ window: { CMWebsLandlordApi: { askAssistant } } });
  vm.runInContext(read('landlord-assistant.js'), context);
  return context.window.CMWEBS_LANDLORD_ASSISTANT;
}

test('pressing ask shows the AI reply and the catalog entry it chose', async () => {
  let sent;
  const assistant = loadWithApi(async (question, catalog) => {
    sent = { question, ids: catalog.map(item => item.id) };
    return { id: 'checkout', reply: '退房請到房客資料按「辦理退房」。' };
  });
  const html = await assistant.ask('房客月底要搬走');
  assert.equal(sent.question, '房客月底要搬走');
  assert.ok(sent.ids.includes('checkout') && sent.ids.length === assistant.catalog.length);
  assert.match(html, /assistant-ai-reply">退房請到房客資料按「辦理退房」。/);
  assert.match(html, /房客退房、退租/);
  assert.equal((html.match(/assistant-result"/g) || []).length, 1);
});

test('an AI none answer or an AI failure falls back to keyword results', async () => {
  const none = await loadWithApi(async () => ({ id: 'none', reply: '這個問題我幫不上忙。' })).ask('房客要退房');
  assert.match(none, /這個問題我幫不上忙/);
  assert.match(none, /房客退房、退租/);
  const failed = await loadWithApi(async () => { throw new Error('ASSISTANT_NOT_ENABLED'); }).ask('房客要退房');
  assert.doesNotMatch(failed, /assistant-ai-reply/);
  assert.match(failed, /房客退房、退租/);
  const invented = await loadWithApi(async () => ({ id: 'not_in_catalog', reply: '<b>x</b>' })).ask('房客要退房');
  assert.doesNotMatch(invented, /<b>/);
});

test('the read client posts the question to the read service with the landlord credential', () => {
  const api = read('landlord-api.js');
  assert.match(api, /askAssistant: async function \(question, catalog\)/);
  assert.match(api, /'\/v1\/assistant'/);
  assert.match(api, /method: 'POST'/);
  assert.match(read('landlord-more.html'), /<button class="assistant-ask" type="submit">問助理<\/button>/);
});
