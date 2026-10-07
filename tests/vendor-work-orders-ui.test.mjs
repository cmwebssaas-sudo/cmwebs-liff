import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createVendorWorkOrderServer } from '../_dev/vendor-work-orders/server.mjs';

// Use an installed browser harness, never add dependencies to the candidate.
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
let browser;
before(async () => { browser = await playwright.chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function harness(t) {
  const dir = await mkdtemp(join(tmpdir(), 'vendor-ui-'));
  const server = createVendorWorkOrderServer({ dataFile: join(dir, 'state.json'), developmentMode: true,
    clock: () => Date.parse('2026-10-08T04:00:00Z') });
  await server.start();
  await server.store.transact(state => {
    state.partner_skills.push(...['company-a', 'individual-a'].flatMap(partner_id =>
      ['repair', 'cleaning', 'other'].map(trade => ({ workspace_id: 'ws-a', partner_id, trade }))));
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
async function completeFixture(h) {
  let w = await h.order(true);
  w = await h.api('company_a_worker', `/api/assignments/${w.invitations[0].assignment_id}/accept`, { expected_version: w.version });
  w = await h.api('company_a_worker', `/api/assignments/${w.assignment.id}/start`, { expected_version: w.version });
  return h.api('company_a_worker', `/api/assignments/${w.assignment.id}/completion`, { expected_version: w.version, description: '合成清潔已完成', actual_amount_twd: 1500 });
}

test('renders_partner_setup_and_ranked_services', async t => {
  const h = await harness(t), p = await h.page();
  await p.getByRole('button', { name: '合作設定', exact: true }).click();
  const f = p.locator('#partner-create');
  await f.getByLabel('合作名稱').fill('合成油漆個人');
  await f.getByLabel('合作類型').selectOption('individual');
  await f.getByLabel('其他工種').check();
  await f.getByLabel('工種名稱').fill('油漆');
  await f.getByLabel('服務區域').fill('合成區域');
  await f.getByRole('button', { name: '保存合作對象' }).click(); await saved(p);
  assert.equal(await p.getByRole('heading', { name: '合成油漆個人' }).count(), 1);
  const rank = p.locator('#priority-form');
  await rank.getByLabel('物件代號').fill('property-a');
  await rank.getByLabel('工種').selectOption('repair');
  await rank.getByLabel('Synthetic Repair Company A 順位').fill('1');
  await rank.getByLabel('Synthetic Individual Worker 順位').fill('2');
  await rank.getByRole('button', { name: '保存順位' }).click(); await saved(p);
  await p.reload(); await p.locator('#refresh').waitFor();
  await p.getByRole('button', { name: '合作設定', exact: true }).click();
  await p.locator('#priority-list').filter({ hasText: 'property-a' }).waitFor();
  assert.match(await p.locator('#priority-list').innerText(), /1.*Synthetic Repair Company A/s);
  const member = p.locator('article[data-partner="company-a"]');
  await member.getByLabel('成員代號').fill('synthetic-new-worker');
  await member.getByRole('button', { name: '加入成員' }).click(); await saved(p);
  assert.match(await member.innerText(), /synthetic-new-worker/);
  const agreement = p.locator('#agreement-form');
  await agreement.getByLabel('約定標題').fill('合成除草固定價');
  await agreement.getByLabel('合作對象').selectOption('company-a');
  await agreement.getByLabel('工種').selectOption('other');
  await agreement.getByLabel('固定價 TWD').fill('2000');
  await agreement.getByLabel('開始日期').fill('2026-10-01T00:00');
  await agreement.getByLabel('結束日期').fill('2026-12-31T00:00');
  await agreement.getByRole('button', { name: '保存固定價約定' }).click(); await saved(p);
  assert.match(await p.locator('#agreement-list').innerText(), /合成除草固定價.*2,000/s);
});

test('landlord_can_create_quote_and_fixed_price_jobs', async t => {
  const h = await harness(t), p = await h.page();
  for (const fixed of [false, true]) {
    const f = p.locator('#job-create');
    await f.getByLabel('工作標題').fill(fixed ? '合成固定價清潔' : '合成報價維修');
    await f.getByLabel('工種').selectOption(fixed ? 'cleaning' : 'repair');
    await f.getByLabel('必要區域').fill('合成公共區域');
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

test('landlord_can_compare_approve_and_accept_work', async t => {
  const h = await harness(t); let w = await h.order(false, true);
  for (const [index, principal] of ['company_a_worker', 'individual_worker'].entries()) {
    await h.api(principal, `/api/invitations/${w.invitations[index].id}/quote`, { expected_version: w.version, ...quote, labor_twd: 1000 + index * 500 });
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
  const h = await harness(t); await h.order(); await h.order(true, false, '合成固定清潔');
  const p = await h.page('company_a_manager');
  const repair = p.locator('article.work-order').filter({ hasText: '合成公共區域工作' });
  await repair.getByLabel('工資 TWD').fill('1000');
  await repair.getByLabel('報價有效期限').fill('2026-10-10T00:00');
  await repair.getByRole('button', { name: '提交報價', exact: true }).click(); await saved(p);
  assert.match(await repair.innerText(), /待核准/);
  const card = p.locator('article.work-order').filter({ hasText: '合成固定清潔' });
  await card.getByRole('button', { name: '接受固定價工作' }).click(); await saved(p);
  await card.getByRole('button', { name: '開始施工' }).click(); await saved(p);
  await card.getByLabel('私有附件').setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nsynthetic only') });
  await card.getByRole('button', { name: '上傳附件' }).click(); await saved(p);
  assert.equal(await card.getByRole('progressbar').getAttribute('value'), '100');
  assert.equal(await card.getByRole('link', { name: /下載私有附件/ }).count(), 1);
  await card.getByLabel('完工說明').fill('合成清潔完成');
  await card.getByLabel('實際費用 TWD').fill('1500');
  await card.getByRole('button', { name: '提交完工回報' }).click(); await saved(p);
  assert.match(await card.innerText(), /待驗收/);
  const state = await h.server.store.readSnapshot(); assert.equal(state.completion_reports[0].attachment_ids.length, 1);
  assert.equal(state.acceptances.length, 0);
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
  assert.doesNotMatch(await p.locator('main').innerText(), /合成精確位置|合成作業指引|Synthetic Individual Worker/);
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
  w = await h.api('company_a_worker', `/api/assignments/${w.invitations[0].assignment_id}/accept`, { expected_version: w.version });
  await h.api('company_a_worker', `/api/assignments/${w.assignment.id}/start`, { expected_version: w.version });
  const p = await h.page('company_a_worker');
  await p.getByLabel('完工說明').fill('合成額外清潔'); await p.getByLabel('實際費用 TWD').fill('1600');
  await p.getByRole('button', { name: '提交完工回報' }).click(); await saved(p, 'SUPPLEMENT_REQUIRED');
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
  await p.locator('#refresh').click(); await saved(p, 'FORBIDDEN');
  assert.equal(await p.locator('article.work-order').count(), 0);
  assert.doesNotMatch(await p.locator('main').innerText(), /合成精確位置|合成清潔已完成/);
});

test('uncertain_fixture_login_recovers_the_server_session', async t => {
  const h = await harness(t), p = await h.page('company_a_worker', true);
  await saved(p, '已讀回');
  assert.match(await p.locator('#identity').innerText(), /合作廠商.*worker-a/);
  assert.equal(await p.locator('#partner-create').count(), 0);
});
