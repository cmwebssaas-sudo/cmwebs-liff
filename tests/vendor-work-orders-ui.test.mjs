import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createVendorWorkOrderServer } from '../_dev/vendor-work-orders/server.mjs';
import { createBindingInvite } from '../_dev/vendor-work-orders/line-binding.mjs';

// Use an installed browser harness, never add dependencies to the candidate.
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
let browser;
test('LINE 驗證後顯示中文確認且提交一次後讀回待核准', async t => {
  const config = { channelId: '1234567890', channelSecret: 'synthetic-secret', providerId: 'provider-test', messagingProviderId: 'provider-test',
    publicOrigin: 'https://workorders.example.test', redirectUri: 'https://workorders.example.test/auth/line/callback' };
  const h = await harness(t, { lineConfig: config, lineIdentityAdapter: { async exchangeAndVerify() { return { provider_id: 'provider-test', subject: 'U' + 'c'.repeat(32) }; } } });
  let token;
  await h.server.store.transact(snapshot => { const r = createBindingInvite(snapshot,
    { role: 'landlord', actor_id: 'landlord-a', workspace_id: 'ws-a' }, { partner_id: 'company-a', member_role: 'worker' }, Date.parse('2026-10-08T04:00:00Z')); token = r.token; return r.state; });
  const c = await browser.newContext(); t.after(() => c.close());
  const response = await fetch(`${h.origin}/auth/line/start?invite=${token}`, { redirect: 'manual' });
  const cookie = response.headers.get('set-cookie').split(';')[0].split('=');
  await c.addCookies([{ name: cookie[0], value: cookie[1], domain: '127.0.0.1', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }]);
  const p = await c.newPage();
  await p.goto(`${h.origin}/auth/line/callback?state=${new URL(response.headers.get('location')).searchParams.get('state')}&code=ui-code`);
  await p.getByRole('button', { name: '確認綁定', exact: true }).waitFor({ timeout: 3000 });
  assert.match(await p.locator('#content').textContent(), /示範維修公司甲.*施工者/s);
  await p.getByRole('button', { name: '確認綁定', exact: true }).click();
  await p.getByText('已提交綁定，等待房東核准。', { exact: true }).waitFor();
  await p.reload(); await p.getByText('已提交綁定，等待房東核准。', { exact: true }).waitFor();
  assert.equal((await h.server.store.readSnapshot()).line_binding_requests.length, 1);
  assert.equal(await p.getByRole('button', { name: '工單總覽' }).count(), 0);
});
test('未設定 LINE 的部署不顯示可登入的示範身分', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'vendor-ui-login-'));
  const server = createVendorWorkOrderServer({ dataFile: join(dir, 'state.json') });
  await server.start(); const c = await browser.newContext(); const p = await c.newPage();
  t.after(async () => { await c.close(); await server.close(); await rm(dir, { recursive: true }); });
  await p.goto(`http://127.0.0.1:${server.address().port}`);
  await p.getByText('LINE 登入尚未設定', { exact: true }).waitFor({ timeout: 3000 });
  assert.equal(await p.getByLabel('本機測試身份').count(), 0);
  assert.equal(await p.getByRole('link', { name: '使用 LINE 登入' }).count(), 0);
});
test('合作設定保存並讀回 LINE 邀請且不冒充真實登入', async t => {
  const h = await harness(t);
  const p = await h.page();
  await p.getByRole('button', { name: '合作設定', exact: true }).click();
  const card = p.locator('article[data-partner="company-a"]');
  await card.getByText('LINE 綁定邀請', { exact: true }).click();
  await card.getByRole('button', { name: '建立綁定邀請' }).click();
  await card.getByText('等待 LINE 登入', { exact: true }).waitFor();
  await p.reload();
  await p.getByRole('button', { name: '合作設定', exact: true }).click();
  await card.getByText('LINE 綁定邀請', { exact: true }).click();
  assert.equal(await card.getByText('等待 LINE 登入', { exact: true }).count(), 1);
  assert.match(await card.textContent(), /真實登入入口尚未接通/);
  await card.getByRole('button', { name: '撤銷邀請' }).click();
  await card.getByText('已撤銷', { exact: true }).waitFor();
});
before(async () => { browser = await playwright.chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function harness(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'vendor-ui-'));
  const server = createVendorWorkOrderServer({ dataFile: join(dir, 'state.json'), developmentMode: true,
    clock: () => Date.parse('2026-10-08T04:00:00Z'), ...options });
  await server.start();
  await server.store.transact(state => {
    state.partner_skills.push(...['company-a', 'individual-a'].flatMap(partner_id =>
      ['repair', 'cleaning', 'other'].map(trade => ({ workspace_id: 'ws-a', partner_id, trade,
        name: trade === 'other' ? '油漆' : trade }))));
    return state;
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const contexts = [];
  t.after(async () => { for (const c of contexts) await c.close(); await server.close(); await rm(dir, { recursive: true }); });
  async function page(principal = 'landlord_a', uncertainLogin = false) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    contexts.push(context);
    const p = await context.newPage();
    p.setDefaultTimeout(5000);
    const response = await p.goto(origin);
    // Missing UI assets must fail as a behavior assertion, not a locator timeout.
    assert.equal(response.status(), 200, 'workspace page is served');
    if (uncertainLogin) await p.route('**/api/dev/session', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, status: 502, body: JSON.stringify({ success: false, code: 'INTERNAL_ERROR' }) });
    });
    await p.getByLabel('本機測試身份').selectOption(principal);
    await p.getByRole('button', { name: '進入本機工作台', exact: true }).click();
    await p.locator('#identity').filter({ hasText: principal.startsWith('landlord') ? '房東' : '合作廠商' }).waitFor();
    await p.locator('#refresh').waitFor();
    return p;
  }
  async function api(principal, path, body, method = 'POST') {
    const c = await browser.newContext(); contexts.push(c);
    const login = await c.request.post(`${origin}/api/dev/session`, { data: { principal }, headers: { 'Idempotency-Key': randomUUID() } });
    assert.equal(login.status(), 200);
    const r = await c.request.fetch(`${origin}${path}`, { method, ...(body ? { data: body } : {}), headers: { 'Idempotency-Key': randomUUID() } });
    const json = await r.json(); assert.equal(r.status(), 200, JSON.stringify(json)); return json.data;
  }
  async function order(fixed = false, parallel = false, title = '合成公共區域工作') {
    let w = await api('landlord_a', '/api/work-orders', { title, trade: fixed ? 'cleaning' : 'repair', area: '合成區域', location: '合成精確位置', instructions: '合成作業指引', property_id: 'property-a' });
    w = await api('landlord_a', `/api/work-orders/${w.id}/invitations`, { expected_version: w.version,
      mode: parallel ? 'parallel' : 'manual', ...(parallel ? { partner_ids: ['company-a', 'individual-a'] } : { partner_id: 'company-a' }), ...(fixed ? { agreement_id: 'agreement-a' } : {}) });
    return w;
  }
  return { server, page, api, order, origin };
}
const quote = { labor_twd: 1000, materials_twd: 100, tax_twd: 0, estimated_days: 1, expires_at: '2026-10-10T00:00:00Z' };
async function saved(p, text = '已保存') { await p.locator('#feedback').filter({ hasText: text }).waitFor(); }
async function refresh(p) { await p.locator('#refresh').click(); await saved(p, '已讀取'); }
async function expand(p, key) {
  const disclosure = p.locator(`details[data-disclosure="${key}"]`);
  if (!await disclosure.getAttribute('open')) {
    if (!await disclosure.evaluate(element => element.open)) await disclosure.locator(':scope > summary').click();
  }
}
async function completeFixture(h) {
  let w = await h.order(true);
  w = await h.api('company_a_manager', `/api/assignments/${w.invitations[0].assignment_id}/accept`, { expected_version: w.version, assignee_actor_id: 'worker-a' });
  w = await h.api('company_a_worker', `/api/assignments/${w.assignment.id}/start`, { expected_version: w.version });
  return h.api('company_a_worker', `/api/assignments/${w.assignment.id}/completion`, { expected_version: w.version, description: '合成清潔已完成', actual_amount_twd: 1500 });
}
async function inProgressFixture(h, title = '合成固定價施工中') {
  let w = await h.order(true, false, title);
  w = await h.api('company_a_manager', `/api/assignments/${w.invitations[0].assignment_id}/accept`, { expected_version: w.version, assignee_actor_id: 'worker-a' });
  return h.api('company_a_worker', `/api/assignments/${w.assignment.id}/start`, { expected_version: w.version });
}

test('simple_creation_and_optional_settings_do_not_require_advanced_fields', async t => {
  const h = await harness(t), p = await h.page();
  const form = p.locator('#job-create');
  assert.equal(await form.locator('input:visible, select:visible, textarea:visible').count(), 3);
  await form.getByLabel('工作標題').fill('只填基本資料的工單');
  await form.getByLabel('必要區域').fill('公共走廊');
  await form.getByRole('button', { name: '建立工作草稿' }).click(); await saved(p);
  const card = p.locator('article.work-order').filter({ hasText: '只填基本資料的工單' });
  assert.equal(await card.locator('[data-parallel-partners]').isVisible(), false);
  await card.getByLabel('邀請方式').selectOption('parallel');
  assert.equal(await card.locator('[data-parallel-partners]').isVisible(), true);
  await p.getByRole('button', { name: '合作設定', exact: true }).click();
  const visibleText = await p.locator('#content').innerText();
  assert.match(visibleText, /示範維修公司甲/);
  assert.doesNotMatch(visibleText, /Synthetic|manager-a|worker-a|contact-a|\bmanager\b|\bworker\b|\bcontact\b|\bTWD\b/);
  assert.equal(await p.locator('#priority-form').isVisible(), false);
  assert.equal(await p.locator('#agreement-form').isVisible(), false);
  const partners = p.locator('#partner-create');
  assert.equal(await partners.getByLabel('其他工種名稱（每行一項）').isVisible(), false);
  await partners.getByRole('checkbox', { name: '其他工種', exact: true }).check();
  assert.equal(await partners.getByLabel('其他工種名稱（每行一項）').isVisible(), true);
});

test('renders_partner_setup_and_ranked_services', async t => {
  const h = await harness(t), p = await h.page();
  await p.getByRole('button', { name: '合作設定', exact: true }).click();
  const f = p.locator('#partner-create');
  await f.getByLabel('合作名稱').fill('合成油漆個人');
  await f.getByLabel('合作類型').selectOption('individual');
  await f.getByRole('checkbox', { name: '其他工種', exact: true }).check();
  await f.getByLabel('其他工種名稱（每行一項）').fill('油漆');
  await f.getByLabel('服務區域').fill('合成區域');
  await f.getByRole('button', { name: '保存合作對象' }).click(); await saved(p);
  assert.equal(await p.getByRole('heading', { name: '合成油漆個人' }).count(), 1);
  const rank = p.locator('#priority-form');
  await expand(p, 'priorities');
  await rank.getByLabel('物件代號').fill('property-a');
  await rank.locator('select[name="trade"]').selectOption('repair');
  await rank.getByLabel('示範維修公司甲 順位').fill('1');
  await rank.getByLabel('示範個人師傅 順位').fill('2');
  await rank.getByRole('button', { name: '保存順位' }).click(); await saved(p);
  await rank.locator('select[name="trade"]').selectOption('other');
  await rank.getByLabel('物件代號').fill('property-a');
  await rank.getByLabel('其他工種名稱').fill('油漆');
  await rank.getByLabel('示範維修公司甲 順位').fill('1');
  assert.deepEqual(await rank.locator(':invalid').evaluateAll(elements => elements.map(element => [element.name, element.value])), []);
  const prioritySave = p.waitForResponse(response => response.url().endsWith('/api/priority-rules') && response.request().method() === 'PUT');
  await rank.getByRole('button', { name: '保存順位' }).click();
  const priorityResponse = await prioritySave;
  assert.equal(priorityResponse.status(), 200, JSON.stringify(await priorityResponse.json()));
  await saved(p);
  const otherPriority = await h.api('landlord_a', '/api/priority-rules', undefined, 'GET');
  assert.ok(otherPriority.some(rule => rule.trade === 'other' && rule.trade_name === '油漆' && rule.partner_id === 'company-a'));
  await p.reload(); await p.locator('#refresh').waitFor();
  await p.getByRole('button', { name: '合作設定', exact: true }).click();
  await expand(p, 'priorities');
  await p.locator('#priority-list').filter({ hasText: '示範物件甲' }).waitFor();
  assert.match(await p.locator('#priority-list').innerText(), /1.*示範維修公司甲/s);
  const member = p.locator('article[data-partner="company-a"]');
  await expand(p, 'members-company-a');
  await member.getByLabel('成員代號').fill('synthetic-new-worker');
  await member.getByRole('button', { name: '加入成員' }).click(); await saved(p);
  assert.match(await member.innerText(), /synthetic-new-worker/);
  const agreement = p.locator('#agreement-form');
  await expand(p, 'agreements');
  await agreement.getByLabel('約定標題').fill('合成除草固定價');
  await agreement.getByLabel('合作對象').selectOption('company-a');
  await agreement.locator('select[name="trade"]').selectOption('other');
  await agreement.getByLabel('其他工種名稱').fill('油漆');
  await agreement.getByLabel('固定價（元）').fill('2000');
  await agreement.getByLabel('開始日期').fill('2026-10-01T00:00');
  await agreement.getByLabel('結束日期').fill('2026-12-31T00:00');
  await agreement.getByRole('button', { name: '保存固定價約定' }).click(); await saved(p);
  assert.match(await p.locator('#agreement-list').innerText(), /合成除草固定價.*2,000/s);
});

test('partner_edit_preserves_all_named_other_trade_skills', async t => {
  const h = await harness(t);
  await h.server.store.transact(state => {
    state.partner_skills = state.partner_skills.filter(skill => !(skill.workspace_id === 'ws-a' && skill.partner_id === 'company-a' && skill.trade === 'other'));
    state.partner_skills.push(
      { workspace_id: 'ws-a', partner_id: 'company-a', trade: 'other', name: '油漆' },
      { workspace_id: 'ws-a', partner_id: 'company-a', trade: 'other', name: '除草' },
    );
    return state;
  });
  const p = await h.page();
  await p.getByRole('button', { name: '合作設定', exact: true }).click();
  const partner = p.locator('article[data-partner="company-a"]');
  await expand(p, 'edit-company-a');
  const skills = partner.getByLabel('其他工種名稱（每行一項）');
  assert.equal(await skills.inputValue(), '油漆\n除草');
  await partner.getByLabel('服務區域').fill('更新後的合成服務區');
  await partner.getByRole('button', { name: '更新合作設定' }).click(); await saved(p);
  await p.reload(); await p.locator('#refresh').waitFor();
  await p.getByRole('button', { name: '合作設定', exact: true }).click();
  const reloaded = p.locator('article[data-partner="company-a"]');
  assert.equal(await reloaded.getByLabel('其他工種名稱（每行一項）').inputValue(), '油漆\n除草');
  const directory = await h.api('landlord_a', '/api/partners', undefined, 'GET');
  const savedPartner = directory.find(item => item.id === 'company-a');
  assert.equal(savedPartner.service_areas[0], '更新後的合成服務區');
  assert.deepEqual(savedPartner.skills.filter(skill => skill.trade === 'other').map(skill => skill.name), ['油漆', '除草']);
});

test('landlord_can_create_quote_and_fixed_price_jobs', async t => {
  const h = await harness(t), p = await h.page();
  for (const fixed of [false, true]) {
    const f = p.locator('#job-create');
    await f.getByLabel('工作標題').fill(fixed ? '合成固定價清潔' : '合成報價維修');
    await f.locator('select[name="trade"]').selectOption(fixed ? 'cleaning' : 'repair');
    await f.getByLabel('必要區域').fill('合成公共區域');
    await expand(p, 'create-extra');
    await f.getByLabel('物件代號').fill('property-a');
    await f.getByRole('button', { name: '建立工作草稿' }).click(); await saved(p);
    const card = p.locator('article.work-order').filter({ hasText: fixed ? '合成固定價清潔' : '合成報價維修' });
    await card.getByLabel('邀請方式').selectOption('manual');
    await card.getByLabel('指定合作對象').selectOption('company-a');
    if (fixed) await card.getByLabel('價格方式').selectOption('agreement-a');
    await card.getByRole('button', { name: '確認邀請／固定價派工' }).click(); await saved(p);
    assert.match(await card.innerText(), fixed ? /1,500/ : /待回覆/);
  }
  const state = await h.server.store.readSnapshot();
  assert.equal(state.work_orders.length, 2); assert.equal(state.assignments.length, 0);
  assert.equal(state.invitations.filter(i => i.agreement_snapshot).length, 1);
});

test('fixed_price_choices_use_latest_eligible_snapshot_for_selected_partner', async t => {
  const h = await harness(t);
  const now = Date.now(), day = 24 * 60 * 60 * 1000;
  const validFrom = new Date(now - day).toISOString(), validUntil = new Date(now + day).toISOString();
  await h.server.store.transact(state => {
    const row = (id, agreement_id, partner_id, trade, property_id, version, price_twd, active, starts_at, ends_at) => ({
      id, agreement_id, workspace_id: 'ws-a', partner_id, title: id, trade, property_id,
      version, price_twd, active, starts_at, ends_at,
    });
    state.service_agreements.push(
      row('cleaning-v1', 'cleaning-a', 'company-a', 'cleaning', '', 1, 1200, true, validFrom, validUntil),
      row('cleaning-v2', 'cleaning-a', 'company-a', 'cleaning', '', 2, 2400, true, validFrom, validUntil),
      row('cleaning-sunset-v1', 'cleaning-sunset', 'company-a', 'cleaning', '', 1, 800, true, validFrom, validUntil),
      row('cleaning-sunset-v2', 'cleaning-sunset', 'company-a', 'cleaning', '', 2, 900, false, validFrom, validUntil),
      row('wrong-partner', 'wrong-partner', 'individual-a', 'cleaning', '', 1, 3100, true, validFrom, validUntil),
      row('wrong-property', 'wrong-property', 'company-a', 'cleaning', 'property-b', 1, 3200, true, validFrom, validUntil),
      row('expired', 'expired', 'company-a', 'cleaning', '', 1, 3300, true, validFrom, new Date(now - 60000).toISOString()),
      row('future', 'future', 'company-a', 'cleaning', '', 1, 3400, true, new Date(now + day).toISOString(), validUntil),
      row('wrong-trade', 'wrong-trade', 'company-a', 'repair', '', 1, 3500, true, validFrom, validUntil),
      row('individual-cleaning', 'individual-cleaning', 'individual-a', 'cleaning', '', 1, 4100, true, validFrom, validUntil),
    );
    return state;
  });
  await h.order(true, false, '合成固定價候選測試');
  const p = await h.page();
  const card = p.locator('article.work-order').filter({ hasText: '合成固定價候選測試' });
  await card.getByLabel('邀請方式').selectOption('manual');
  const partner = card.getByLabel('指定合作對象');
  const agreement = card.locator('select[name="agreement_id"]');
  const visible = () => agreement.locator('option').allTextContents();
  let options = await visible();
  assert.ok(options.some(text => text.includes('cleaning-v2') && text.includes('2,400') && text.includes('第 2 版')));
  assert.equal(options.some(text => text.includes('cleaning-v1')), false, 'older revision is not offered');
  for (const stale of ['cleaning-sunset-v1', 'cleaning-sunset-v2', 'wrong-partner', 'wrong-property', 'expired', 'future', 'wrong-trade', 'individual-cleaning']) {
    assert.equal(options.some(text => text.includes(stale)), false, `${stale} must not be offered to company A for this job`);
  }
  await partner.selectOption('individual-a');
  options = await visible();
  assert.ok(options.some(text => text.includes('individual-cleaning') && text.includes('4,100') && text.includes('第 1 版')));
  assert.equal(options.some(text => text.includes('cleaning-v2')), false, 'other partner agreement is not selectable');
});

test('property_scoped_fixed_price_is_selectable_and_dispatches_with_correct_snapshot', async t => {
  const h = await harness(t);
  await h.server.store.transact(state => {
    state.service_agreements.push({ id: 'property-cleaning', agreement_id: 'property-cleaning',
      workspace_id: 'ws-a', partner_id: 'company-a', title: '物件專屬清潔', trade: 'cleaning',
      property_id: 'property-a', version: 1, price_twd: 1200, active: true,
      starts_at: '2026-01-01T00:00:00Z', ends_at: '2099-12-31T00:00:00Z' });
    return state;
  });
  const jobs = [];
  for (const property_id of ['property-a', 'property-b']) jobs.push(await h.api('landlord_a', '/api/work-orders', {
    title: `專屬價格 ${property_id}`, trade: 'cleaning', area: '合成區域', property_id,
  }));
  const p = await h.page();
  const matching = p.locator('article.work-order').filter({ hasText: '專屬價格 property-a' });
  const other = p.locator('article.work-order').filter({ hasText: '專屬價格 property-b' });
  await matching.getByLabel('邀請方式').selectOption('manual');
  await other.getByLabel('邀請方式').selectOption('manual');
  assert.equal(await matching.locator('select[name="agreement_id"] option[value="property-cleaning"]').count(), 1);
  assert.equal(await other.locator('select[name="agreement_id"] option[value="property-cleaning"]').count(), 0);
  await matching.getByLabel('邀請方式').selectOption('manual');
  await matching.getByLabel('價格方式').selectOption('property-cleaning');
  await matching.getByRole('button', { name: '確認邀請／固定價派工' }).click(); await saved(p);
  let w = await h.api('landlord_a', `/api/work-orders/${jobs[0].id}`, undefined, 'GET');
  assert.equal(w.invitations[0].agreement_snapshot.price_twd, 1200);
  w = await h.api('company_a_manager', `/api/assignments/${w.invitations[0].assignment_id}/accept`, { expected_version: w.version, assignee_actor_id: 'worker-a' });
  assert.equal(w.status, 'assigned');
  assert.equal(w.assignment.approved_amount_twd, 1200);
  assert.equal(w.assignment.agreement_snapshot.price_twd, 1200);
  assert.equal(w.assignment.agreement_snapshot.version, 1);
  assert.equal(Object.hasOwn(w, 'property_id'), false);
});

test('repair_jobs_offer_only_quotation_even_when_fixed_agreements_exist', async t => {
  const h = await harness(t);
  await h.server.store.transact(state => {
    state.service_agreements.push({ id: 'repair-fixed', workspace_id: 'ws-a', partner_id: 'company-a',
      title: '不可直接派工的維修固定價', trade: 'repair', version: 1, price_twd: 1200, active: true,
      starts_at: '2026-01-01T00:00:00Z', ends_at: '2099-12-31T00:00:00Z' });
    return state;
  });
  await h.order();
  const p = await h.page(), card = p.locator('article.work-order');
  assert.deepEqual(await card.locator('select[name="agreement_id"] option').allTextContents(), ['先報價再核准']);
  await card.getByLabel('指定合作對象').selectOption('individual-a');
  assert.deepEqual(await card.locator('select[name="agreement_id"] option').allTextContents(), ['先報價再核准']);
});

test('landlord_can_compare_approve_and_accept_work', async t => {
  const h = await harness(t); let w = await h.order(false, true);
  for (const [index, principal] of ['company_a_manager', 'individual_worker'].entries()) {
    await h.api(principal, `/api/invitations/${w.invitations[index].id}/quote`, { expected_version: w.version, ...quote, ...(principal === 'company_a_manager' ? { assignee_actor_id: 'worker-a' } : {}), labor_twd: 1000 + index * 500 });
    w = await h.api('landlord_a', `/api/work-orders/${w.id}`, undefined, 'GET');
  }
  const p = await h.page(), card = p.locator('article.work-order');
  assert.match(await card.innerText(), /1,100/); assert.match(await card.innerText(), /1,600/);
  await card.getByRole('button', { name: '核准此報價' }).first().click(); await saved(p);
  w = await h.api('landlord_a', `/api/work-orders/${w.id}`, undefined, 'GET');
  assert.equal(w.status, 'assigned');
  w = await h.api('company_a_worker', `/api/assignments/${w.assignment.id}/start`, { expected_version: w.version });
  await h.api('company_a_worker', `/api/assignments/${w.assignment.id}/completion`, { expected_version: w.version, description: '合成維修完成', actual_amount_twd: 1100 });
  await refresh(p); await card.getByRole('button', { name: '驗收通過', exact: true }).click(); await saved(p);
  assert.match(await card.innerText(), /已結案/);
  assert.equal((await h.server.store.readSnapshot()).acceptances[0].decision, 'accept');
});

test('vendor_can_quote_accept_and_report_completion', async t => {
  const h = await harness(t); await h.order(); const w = await h.order(true, false, '合成固定清潔');
  let p = await h.page('company_a_manager');
  const repair = p.locator('article.work-order').filter({ hasText: '合成公共區域工作' });
  await repair.getByLabel('指定執行成員').selectOption('worker-a');
  await repair.getByLabel('工資（元）').fill('1000');
  await repair.getByLabel('報價有效期限').fill('2026-10-10T00:00');
  await repair.getByRole('button', { name: '提交報價', exact: true }).click(); await saved(p);
  assert.match(await repair.innerText(), /待核准/);
  const card = p.locator('article.work-order').filter({ hasText: '合成固定清潔' });
  await card.getByLabel('指定執行成員').selectOption('worker-a');
  await card.getByRole('button', { name: '接受固定價工作' }).click(); await saved(p);
  p = await h.page('company_a_worker');
  const assignedCard = p.locator('article.work-order').filter({ hasText: '合成固定清潔' });
  await assignedCard.getByRole('button', { name: '開始施工' }).click(); await saved(p);
  await assignedCard.getByLabel('完工說明').fill('先填的合成完工說明');
  await assignedCard.getByLabel('實際費用（元）').fill('1450');
  let orderReadbacks = 0;
  p.on('request', request => {
    if (request.method() === 'GET' && request.url().endsWith(`/api/work-orders/${w.id}`)) orderReadbacks++;
  });
  await assignedCard.getByLabel('私有附件').setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nsynthetic only') });
  await assignedCard.getByRole('button', { name: '上傳附件' }).click(); await saved(p);
  assert.equal(await assignedCard.getByRole('progressbar').getAttribute('value'), '100');
  assert.equal(await assignedCard.getByRole('link', { name: /下載私有附件/ }).count(), 1);
  assert.ok(orderReadbacks > 0, 'successful upload performs an authoritative work-order GET');
  assert.equal(await assignedCard.getByLabel('完工說明').inputValue(), '先填的合成完工說明');
  assert.equal(await assignedCard.getByLabel('實際費用（元）').inputValue(), '1450');
  await assignedCard.getByRole('button', { name: '提交完工回報' }).click(); await saved(p);
  assert.match(await assignedCard.innerText(), /待驗收/);
  const state = await h.server.store.readSnapshot(); assert.equal(state.completion_reports[0].attachment_ids.length, 1);
  assert.equal(state.acceptances.length, 0);
});

test('company_workers_and_contacts_cannot_respond_to_unassigned_invitations', async t => {
  const h = await harness(t);
  await h.order(false, false, '待報價維修');
  await h.order(true, false, '固定價清潔');
  for (const principal of ['company_a_worker', 'company_a_contact']) {
    const p = await h.page(principal);
    assert.equal(await p.locator('form[data-form="quote"]').count(), 0, `${principal} must not submit a quote`);
    assert.equal(await p.getByRole('button', { name: '拒接邀請' }).count(), 0, `${principal} must not decline an invitation`);
    assert.equal(await p.getByRole('button', { name: '接受固定價工作' }).count(), 0, `${principal} must not accept fixed-price work`);
  }
});

test('company_manager_assigns_an_active_member_and_only_that_member_can_start', async t => {
  const h = await harness(t), w = await h.order(true, false, '指定成員固定價工單');
  const manager = await h.page('company_a_manager');
  const managerCard = manager.locator(`article.work-order[data-order="${w.id}"]`);
  await managerCard.getByLabel('指定執行成員').selectOption('worker-a-2');
  await managerCard.getByRole('button', { name: '接受固定價工作' }).click(); await saved(manager);
  assert.equal(await managerCard.getByRole('button', { name: '開始施工' }).count(), 0);

  const otherWorker = await h.page('company_a_worker');
  const otherCard = otherWorker.locator(`article.work-order[data-order="${w.id}"]`);
  assert.equal(await otherCard.getByRole('button', { name: '開始施工' }).count(), 0);
  assert.equal(await otherCard.locator('form[data-form="completion"]').count(), 0);

  const assignedWorker = await h.page('company_a_worker_2');
  const assignedCard = assignedWorker.locator(`article.work-order[data-order="${w.id}"]`);
  assert.equal(await assignedCard.getByRole('button', { name: '開始施工' }).count(), 1);
  await assignedCard.getByRole('button', { name: '開始施工' }).click(); await saved(assignedWorker);
  assert.equal(await assignedCard.locator('form[data-form="completion"]').count(), 1);
});

test('uncertain_attachment_upload_keeps_completion_draft_after_authoritative_readback', async t => {
  const h = await harness(t), w = await inProgressFixture(h);
  const p = await h.page('company_a_worker');
  const card = p.locator('article.work-order').filter({ hasText: w.title });
  await card.getByLabel('完工說明').fill('timeout 後仍要保留的合成說明');
  await card.getByLabel('實際費用（元）').fill('1425');
  let uploadPosts = 0, orderReadbacks = 0;
  p.on('request', request => {
    if (request.method() === 'GET' && request.url().endsWith(`/api/work-orders/${w.id}`)) orderReadbacks++;
  });
  await p.route(`**/api/work-orders/${w.id}/attachments`, async route => {
    uploadPosts++;
    await route.fetch();
    await route.abort('failed');
  });
  await card.getByLabel('私有附件').setInputFiles({ name: 'uncertain.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\ncommitted before response loss') });
  await card.getByRole('button', { name: '上傳附件' }).click();
  await saved(p, '附件回應結果不明');
  const current = p.locator('article.work-order').filter({ hasText: w.title });
  assert.equal(await current.getByLabel('完工說明').inputValue(), 'timeout 後仍要保留的合成說明');
  assert.equal(await current.getByLabel('實際費用（元）').inputValue(), '1425');
  assert.equal(await current.getByRole('link', { name: /下載私有附件/ }).count(), 1);
  assert.equal(uploadPosts, 1, 'uncertain upload is not blindly resubmitted');
  assert.ok(orderReadbacks > 0, 'uncertain upload performs an authoritative work-order GET');
  const savedState = await h.server.store.readSnapshot();
  assert.equal(savedState.private_attachments.length, 1);
  assert.equal(savedState.completion_reports.length, 0);
});

for (const uncertain of [false, true]) test(`attachment_${uncertain ? 'uncertain' : 'success'}_preserves_edits_during_upload_and_readback`, async t => {
  const h = await harness(t), w = await inProgressFixture(h);
  const p = await h.page('company_a_worker');
  const card = p.locator('article.work-order').filter({ hasText: w.title });
  function barrier() {
    let arrive, release;
    const reached = new Promise(resolve => { arrive = resolve; });
    const released = new Promise(resolve => { release = resolve; });
    t.after(release);
    return { reached, released, arrive, release };
  }
  const post = barrier(), get = barrier();
  let uploadPosts = 0, detailGets = 0;
  await p.route(`**/api/work-orders/${w.id}/attachments`, async route => {
    uploadPosts++;
    const response = await route.fetch();
    assert.equal(response.status(), 200);
    post.arrive(); await post.released;
    if (uncertain) await route.abort('failed');
    else await route.fulfill({ response });
  });
  await p.route(`**/api/work-orders/${w.id}`, async route => {
    detailGets++;
    const response = await route.fetch();
    assert.equal(response.status(), 200);
    get.arrive(); await get.released;
    await route.fulfill({ response });
  });
  await card.getByLabel('完工說明').fill('上傳前');
  await card.getByLabel('實際費用（元）').fill('1200');
  await card.getByLabel('私有附件').setInputFiles({ name: 'barrier.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nlocal barrier upload') });
  await card.getByRole('button', { name: '上傳附件' }).click();
  await post.reached;
  assert.equal((await h.server.store.readSnapshot()).private_attachments.length, 1, 'server committed before response release');
  await card.getByLabel('完工說明').fill('上傳期間修改');
  await card.getByLabel('實際費用（元）').fill('1350');
  post.release(); await get.reached;
  await card.getByLabel('完工說明').fill('讀回期間的最新修改');
  await card.getByLabel('實際費用（元）').fill('1475');
  get.release(); await saved(p, uncertain ? '附件回應結果不明' : '已保存');
  assert.equal(await card.getByLabel('完工說明').inputValue(), '讀回期間的最新修改');
  assert.equal(await card.getByLabel('實際費用（元）').inputValue(), '1475');
  assert.equal(await card.getByRole('link', { name: /下載私有附件/ }).count(), 1);
  assert.equal(uploadPosts, 1, 'upload is never automatically resubmitted');
  assert.equal(detailGets, 1, 'uses authoritative detail GET');
  const stored = await h.server.store.readSnapshot();
  assert.equal(stored.private_attachments.length, 1);
  assert.equal(stored.completion_reports.length, 0, 'draft is not submitted by readback');
});

for (const uncertain of [false, true]) test(`attachment_${uncertain ? 'uncertain' : 'success'}_preserves_all_editable_order_drafts`, async t => {
  const h = await harness(t), a = await inProgressFixture(h, '草稿 A'), b = await inProgressFixture(h, '草稿 B');
  const p = await h.page('company_a_worker');
  const card = w => p.locator(`article.work-order[data-order="${w.id}"]`);
  let releasePost, releaseGet, postArrive, getArrive;
  const postReached = new Promise(r => { postArrive = r; }), getReached = new Promise(r => { getArrive = r; });
  const postBarrier = new Promise(r => { releasePost = r; }), getBarrier = new Promise(r => { releaseGet = r; });
  t.after(() => { releasePost(); releaseGet(); });
  let posts = 0, gets = 0;
  await p.route(`**/api/work-orders/${a.id}/attachments`, async route => {
    posts++; const response = await route.fetch(); assert.equal(response.status(), 200);
    postArrive(); await postBarrier;
    if (uncertain) await route.abort('failed'); else await route.fulfill({ response });
  });
  await p.route(`**/api/work-orders/${a.id}`, async route => {
    gets++; const response = await route.fetch(); assert.equal(response.status(), 200);
    getArrive(); await getBarrier; await route.fulfill({ response });
  });
  for (const w of [a, b]) {
    await card(w).getByLabel('完工說明').fill(`${w.title} 上傳前`);
    await card(w).getByLabel('實際費用（元）').fill('1200');
  }
  await card(a).getByLabel('私有附件').setInputFiles({ name: 'all-drafts.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nsynthetic drafts') });
  await card(a).getByRole('button', { name: '上傳附件' }).click(); await postReached;
  assert.equal((await h.server.store.readSnapshot()).private_attachments.length, 1);
  await card(b).getByLabel('完工說明').fill('B 上傳期間');
  releasePost(); await getReached;
  for (const w of [a, b]) {
    await card(w).getByLabel('完工說明').fill(`${w.title} 最後讀回修改`);
    await card(w).getByLabel('實際費用（元）').fill(w.id === a.id ? '1375' : '1425');
  }
  releaseGet(); await saved(p, uncertain ? '附件回應結果不明' : '已保存');
  for (const w of [a, b]) {
    assert.equal(await card(w).getByLabel('完工說明').inputValue(), `${w.title} 最後讀回修改`);
    assert.equal(await card(w).getByLabel('實際費用（元）').inputValue(), w.id === a.id ? '1375' : '1425');
    const current = await h.api('company_a_worker', `/api/work-orders/${w.id}`, undefined, 'GET');
    assert.match(await card(w).innerText(), new RegExp(`版本 ${current.version}`));
    assert.equal(current.assignment.approved_amount_twd, 1500);
  }
  assert.equal(await card(a).getByRole('link', { name: /下載私有附件/ }).count(), 1);
  assert.equal(posts, 1); assert.equal(gets, 1);
  assert.equal((await h.server.store.readSnapshot()).completion_reports.length, 0);
});

for (const changedIdentity of [false, true]) test(`attachment_readback_respects_${changedIdentity ? 'authenticated_identity' : 'server_completed_order'}`, async t => {
  const h = await harness(t), a = await inProgressFixture(h, '防護 A'), b = await inProgressFixture(h, '防護 B');
  const p = await h.page('company_a_worker');
  const card = w => p.locator(`article.work-order[data-order="${w.id}"]`);
  let arrive, release;
  const reached = new Promise(r => { arrive = r; }), barrier = new Promise(r => { release = r; });
  t.after(release);
  let posts = 0, gets = 0;
  await p.route(`**/api/work-orders/${a.id}/attachments`, async route => {
    posts++; const response = await route.fetch(); assert.equal(response.status(), 200);
    arrive(); await barrier; await route.fulfill({ response });
  });
  p.on('request', request => { if (request.method() === 'GET' && request.url() === `${h.origin}/api/work-orders/${a.id}`) gets++; });
  for (const w of [a, b]) {
    await card(w).getByLabel('完工說明').fill('不可跨身份或已完工還原的草稿');
    await card(w).getByLabel('實際費用（元）').fill('1425');
  }
  await card(a).getByLabel('私有附件').setInputFiles({ name: 'scope.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nsynthetic scope') });
  await card(a).getByRole('button', { name: '上傳附件' }).click(); await reached;
  if (changedIdentity) {
    // Change the actual HttpOnly fixture session, not the DOM/client role.
    const response = await p.context().request.post(`${h.origin}/api/dev/session`, {
      data: { principal: 'company_a_manager' }, headers: { 'Idempotency-Key': randomUUID() },
    });
    assert.equal(response.status(), 200);
  } else {
    await h.api('company_a_worker', `/api/assignments/${b.assignment.id}/completion`, {
      expected_version: b.version, description: '另一窗口保存的權威完工', actual_amount_twd: 1300,
    });
  }
  release(); await saved(p);
  if (changedIdentity) {
    assert.match(await p.locator('#identity').innerText(), /公司甲管理者/);
    for (const w of [a, b]) {
      assert.equal(await card(w).locator('form[data-form="completion"]').count(), 0,
        'changing to a non-assignee manager must not retain the previous identity’s editable draft');
      assert.doesNotMatch(await card(w).innerText(), /不可跨身份或已完工還原的草稿/);
    }
  } else {
    assert.equal(await card(a).getByLabel('完工說明').inputValue(), '不可跨身份或已完工還原的草稿');
    assert.equal(await card(b).locator('form[data-form="completion"]').count(), 0);
    assert.match(await card(b).innerText(), /待驗收.*另一窗口保存的權威完工/s);
    assert.match(await card(b).innerText(), /1,300/);
  }
  assert.equal(posts, 1); assert.equal(gets, 1);
});

test('invitation_prices_follow_ranked_manual_and_parallel_semantics', async t => {
  const h = await harness(t);
  await h.server.store.transact(state => {
    state.priority_rules.push({ workspace_id: 'ws-a', property_id: 'property-a', trade: 'cleaning', partner_id: 'individual-a', rank: 1 },
      { workspace_id: 'ws-a', property_id: 'property-b', trade: 'cleaning', partner_id: 'company-a', rank: 1 },
      { workspace_id: 'ws-a', property_id: 'property-a', trade: 'other', partner_id: 'company-a', rank: 1 });
    state.service_agreements.push({ id: 'individual-fixed', agreement_id: 'individual-fixed', workspace_id: 'ws-a',
      partner_id: 'individual-a', property_id: 'property-a', trade: 'cleaning', title: '第一順位個人固定價', version: 1,
      price_twd: 1250, active: true, starts_at: '2026-01-01T00:00:00Z', ends_at: '2099-12-31T00:00:00Z' });
    return state;
  });
  const w = await h.api('landlord_a', '/api/work-orders', { title: '順位價格一致', trade: 'cleaning', property_id: 'property-a', area: '合成區域' });
  const p = await h.page(), card = p.locator(`article.work-order[data-order="${w.id}"]`);
  const choices = () => card.locator('select[name="agreement_id"] option').evaluateAll(rows => rows.map(row => row.value));
  assert.deepEqual(await choices(), ['', 'individual-fixed'], 'ranked uses actual first priority, not directory default company');
  await card.getByLabel('指定合作對象').selectOption('company-a');
  assert.deepEqual(await choices(), ['', 'individual-fixed'], 'manual selector must not change ranked invitee');
  await card.getByLabel('邀請方式').selectOption('manual');
  assert.deepEqual(await choices(), ['', 'agreement-a']);
  await card.getByLabel('指定合作對象').selectOption('individual-a');
  assert.deepEqual(await choices(), ['', 'individual-fixed']);
  await card.getByLabel('價格方式').selectOption('individual-fixed');
  await card.getByLabel('邀請方式').selectOption('parallel');
  assert.deepEqual(await choices(), ['']);
  assert.equal(await card.getByLabel('價格方式').inputValue(), '', 'mode change clears stale fixed selection');
  await card.getByLabel('邀請方式').selectOption('ranked');
  await card.getByLabel('指定合作對象').selectOption('company-a');
  await card.getByLabel('價格方式').selectOption('individual-fixed');
  await card.getByRole('button', { name: '確認邀請／固定價派工' }).click(); await saved(p);
  let current = await h.api('landlord_a', `/api/work-orders/${w.id}`, undefined, 'GET');
  assert.equal(current.invitations[0].partner_id, 'individual-a');
  assert.equal(current.invitations[0].agreement_snapshot.price_twd, 1250);
  current = await h.api('individual_worker', `/api/assignments/${current.invitations[0].assignment_id}/accept`, { expected_version: current.version });
  assert.equal(current.assignment.approved_amount_twd, 1250);
});

test('rework_reason_is_visible_to_assigned_vendor', async t => {
  const h = await harness(t); const w = await completeFixture(h);
  const landlord = await h.page();
  await landlord.getByLabel('補修原因').fill('合成角落尚未清潔');
  await landlord.getByRole('button', { name: '退回補修' }).click(); await saved(landlord);
  const p = await h.page('company_a_worker');
  assert.match(await p.locator('article.work-order').innerText(), /合成角落尚未清潔/);
  assert.match(await p.locator('article.work-order').innerText(), /施工中/);
  assert.equal((await h.api('company_a_worker', `/api/work-orders/${w.id}`, undefined, 'GET')).acceptances[0].decision, 'rework');
});

test('escapes_user_supplied_text', async t => {
  const h = await harness(t); const text = '<img src=x onerror="window.injected=1">';
  await h.order(false, false, text); const p = await h.page();
  assert.equal(await p.getByRole('heading', { name: text, exact: true }).count(), 1);
  assert.equal(await p.locator('article.work-order img').count(), 0);
  assert.equal(await p.evaluate(() => window.injected), undefined);
});

test('vendor_view_uses_allowlisted_projection_only', async t => {
  const h = await harness(t); await h.order(); const p = await h.page('company_a_worker');
  assert.equal(await p.locator('#partner-create').count(), 0);
  assert.equal(await p.getByRole('button', { name: '合作設定', exact: true }).count(), 0);
  assert.doesNotMatch(await p.locator('main').innerText(), /合成精確位置|合成作業指引|示範個人師傅/);
  assert.equal(await p.getByRole('button', { name: '核准此報價' }).count(), 0);
});

test('api_response_does_not_include_other_vendor_quotes', async t => {
  const h = await harness(t); let w = await h.order(false, true);
  w = await h.api('individual_worker', `/api/invitations/${w.invitations[1].id}/quote`, { expected_version: w.version, ...quote, labor_twd: 54321 });
  const p = await h.page('company_a_worker');
  const response = await p.request.get(`${h.origin}/api/work-orders/${w.id}`); const view = (await response.json()).data;
  assert.deepEqual(view.quotes, []); assert.equal(view.invitations.length, 1);
  assert.doesNotMatch(await p.locator('main').innerText(), /54,421|individual-a/);
});

test('page_uses_fixed_app_shell_and_visual_viewport_height', async t => {
  const h = await harness(t), p = await h.page();
  assert.equal(await p.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');
  assert.equal(await p.locator('.page').evaluate(el => getComputedStyle(el).overflowY), 'auto');
  await p.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 420 });
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  assert.equal(await p.locator('.app-shell').evaluate(el => Math.round(el.getBoundingClientRect().height)), 420);
  await p.getByLabel('必要區域').focus();
  await p.getByRole('button', { name: '建立工作草稿' }).scrollIntoViewIfNeeded();
  const button = await p.getByRole('button', { name: '建立工作草稿' }).boundingBox();
  const nav = await p.locator('.bottom-nav').boundingBox(); assert.ok(button.y + button.height <= nav.y);
  const feedback = await p.locator('#feedback').boundingBox();
  assert.ok(feedback.y >= 0 && feedback.y + feedback.height < nav.y, 'persisted feedback stays visible above the keyboard-safe navigation');
  assert.equal(await p.locator('.app-shell').evaluate(el => el.scrollWidth <= el.clientWidth), true);
});

test('uncertain_write_recovers_by_get_without_duplicate_submission', async t => {
  const h = await harness(t), w = await completeFixture(h), p = await h.page(); let posts = 0;
  await p.route(`**/api/work-orders/${w.id}/acceptance`, async route => {
    posts++; await route.fetch(); await route.abort('failed');
  });
  await p.getByRole('button', { name: '驗收通過', exact: true }).click(); await saved(p, '已讀回');
  assert.match(await p.locator('article.work-order').innerText(), /已結案/);
  assert.equal(posts, 1); assert.equal((await h.server.store.readSnapshot()).acceptances.length, 1);
});

test('rejected_write_shows_error_and_preserves_completion_form', async t => {
  const h = await harness(t); let w = await h.order(true);
  w = await h.api('company_a_manager', `/api/assignments/${w.invitations[0].assignment_id}/accept`, { expected_version: w.version, assignee_actor_id: 'worker-a' });
  await h.api('company_a_worker', `/api/assignments/${w.assignment.id}/start`, { expected_version: w.version });
  const p = await h.page('company_a_worker');
  await p.getByLabel('完工說明').fill('合成額外清潔'); await p.getByLabel('實際費用（元）').fill('1600');
  await p.getByRole('button', { name: '提交完工回報' }).click(); await saved(p, '需要先核准追加費用');
  assert.equal(await p.getByLabel('完工說明').inputValue(), '合成額外清潔');
  assert.equal((await h.server.store.readSnapshot()).completion_reports.length, 0);
});

test('revoked_session_clears_previously_rendered_private_work', async t => {
  const h = await harness(t); await completeFixture(h);
  const p = await h.page('company_a_worker');
  assert.match(await p.locator('main').innerText(), /合成精確位置/);
  await h.server.store.transact(state => {
    state.partner_memberships.find(m => m.actor_id === 'worker-a').active = false;
    return state;
  });
  await p.locator('#refresh').click(); await saved(p, '目前身分沒有操作權限');
  assert.equal(await p.locator('article.work-order').count(), 0);
  assert.doesNotMatch(await p.locator('main').innerText(), /合成精確位置|合成清潔已完成/);
});

test('uncertain_fixture_login_recovers_the_server_session', async t => {
  const h = await harness(t), p = await h.page('company_a_worker', true);
  await saved(p, '已讀回');
  assert.match(await p.locator('#identity').innerText(), /合作廠商.*公司甲施工者一/);
  assert.equal(await p.locator('#partner-create').count(), 0);
});
