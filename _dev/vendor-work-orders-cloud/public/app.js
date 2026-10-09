/* Local fixture sessions only; authority and projections always come from the server. */
'use strict';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const id = value => encodeURIComponent(value);
const labels = { draft: '草稿', sourcing: '待回覆', pending: '待通知', sent: '待回覆', quoted: '已報價', submitted: '已報價',
  awaiting_approval: '待核准', approved: '已核准', accepted: '已接單', assigned: '已派工', in_progress: '施工中',
  awaiting_acceptance: '待驗收', completed: '已結案', cancelled: '已取消', expired: '已逾期', declined: '已拒接', rejected: '已拒絕', withdrawn: '已撤回' };
const trades = [['repair', '維修'], ['cleaning', '清潔'], ['other', '其他工種']];
const displayNames = { 'Synthetic Repair Company A': '示範維修公司甲', 'Synthetic Cleaning Company B': '示範清潔公司乙',
  'Synthetic Individual Worker': '示範個人師傅', 'Synthetic fixed-price cleaning': '示範固定價清潔',
  'manager-a': '公司甲管理者', 'worker-a': '公司甲施工者一', 'worker-a-2': '公司甲施工者二', 'contact-a': '公司甲聯絡窗口',
  'worker-b': '公司乙施工者', 'individual-worker': '個人師傅', 'landlord-a': '示範房東甲', 'landlord-b': '示範房東乙',
  'ws-a': '示範工作區甲', 'ws-b': '示範工作區乙', 'property-a': '示範物件甲', 'property-b': '示範物件乙' };
const displayName = value => displayNames[value] || value;
const roleName = value => ({ manager: '管理者', worker: '施工者', contact: '聯絡窗口' })[value] || '成員';
const tradeName = value => trades.find(([key]) => key === value)?.[1] || '工作';
const errorNames = { SESSION_REQUIRED: '登入已失效，請重新登入', FORBIDDEN: '目前身分沒有操作權限',
  VERSION_CONFLICT: '資料已更新，請重新讀取', INVALID_INPUT: '請確認必填資料', INVALID_TRADE: '廠商沒有提供這項工種服務',
  INVALID_ASSIGNEE: '請選擇已啟用的執行成員', NO_CANDIDATE: '尚未設定適合的廠商，請手動指定或設定順位',
  PRIORITY_CONFLICT: '優先順位不可重複', INVALID_PRIORITY: '請確認物件、工種與順位',
  INVALID_AMOUNT: '金額請填零或正整數', INVALID_QUOTE: '請確認報價金額與有效期限',
  QUOTE_EXPIRED: '報價已過期', INVITATION_EXPIRED: '邀請已過期', SUPPLEMENT_REQUIRED: '需要先核准追加費用',
  INVALID_PARTNER: '請確認合作對象資料', INVALID_MEMBER: '請確認成員資料', INVALID_AGREEMENT: '請確認固定價約定',
  INTERNAL_ERROR: '系統暫時無法完成操作', NOT_FOUND: '找不到這筆資料', INVALID_TRANSITION: '目前進度無法執行這項操作',
  QUOTE_AWAITING_APPROVAL: '請先處理待核准報價', QUOTE_NOT_APPROVED: '報價尚未核准' };
const errorText = error => errorNames[error.code] || (/^[A-Z_]+$/.test(error.message || '') ? '請確認資料後再試一次' : error.message);
const state = { actor: null, orders: [], partners: [], priorities: [], agreements: [], inbox: [], bindings: { invites: [], requests: [] }, line: { login_ready: false, development_mode: false }, pendingBinding: null, inviteLinks: new Map(), tab: 'jobs', busy: false, progress: new Map() };
function height() { document.documentElement.style.setProperty('--app-height', `${window.visualViewport?.height || window.innerHeight}px`); }
height(); window.addEventListener('resize', height); window.visualViewport?.addEventListener('resize', height);
document.addEventListener('focusin', event => {
  if (event.target.matches('input, textarea, select')) requestAnimationFrame(() => event.target.scrollIntoView({ block: 'nearest' }));
});
function feedback(message, error = false) { $('#feedback').textContent = message; $('#feedback').dataset.error = String(error); }
function lock(busy) {
  state.busy = busy; $('#content').setAttribute('aria-busy', String(busy));
  document.querySelectorAll('button').forEach(button => { button.disabled = busy; });
}
async function api(path, method = 'GET', body) {
  const write = method !== 'GET';
  let response, data;
  try {
    response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: write ? { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() } : {},
      ...(write ? { body: JSON.stringify(body) } : {}) });
    data = await response.json();
  } catch { throw Object.assign(new Error('回應結果不明'), { uncertain: write }); }
  const code = data.code || data.error;
  if (!response.ok || data.success !== true) throw Object.assign(new Error(code || '無法讀取回應'), { uncertain: write && response.status >= 500, code });
  return data.data;
}
async function readAll(orderId, beforeRender) {
  // Session is rechecked on every refresh; a removed member cannot keep a stale view.
  const session = await api('/api/session');
  const landlord = session.actor.role === 'landlord';
  const [orders, partners, agreements, inbox, priorities, bindings] = await Promise.all([
    api('/api/work-orders'), api('/api/partners'), api('/api/service-agreements'), api('/api/inbox'),
    landlord ? api('/api/priority-rules') : Promise.resolve([]),
    landlord ? api('/api/line/bindings') : Promise.resolve({ invites: [], requests: [] }),
  ]);
  const current = orderId ? await api(`/api/work-orders/${id(orderId)}`) : null;
  Object.assign(state, { actor: session.actor, orders: current ? orders.map(w => w.id === current.id ? current : w) : orders, partners, agreements, inbox, priorities, bindings });
  const afterRender = beforeRender?.();
  render(); afterRender?.(); return current;
}
function clearUnauthorized(error) {
  if (['SESSION_REQUIRED', 'FORBIDDEN'].includes(error.code)) {
    Object.assign(state, { actor: null, orders: [], partners: [], agreements: [], inbox: [], priorities: [], bindings: { invites: [], requests: [] } });
    state.progress.clear(); render();
    state.inviteLinks.clear();
  }
}
async function write(path, body, method = 'POST', orderId) {
  if (state.busy) return;
  lock(true); feedback('保存中…');
  let committed = false;
  try {
    const result = await api(path, method, body); committed = true;
    const current = await readAll(orderId || (result?.status && result?.id ? result.id : undefined));
    if (result?.token && result?.invite && state.line.login_ready) {
      state.inviteLinks.set(result.invite.id, `${state.line.public_origin}/auth/line/start?invite=${encodeURIComponent(result.token)}`); render();
    }
    feedback(`已保存並讀回${current ? `：${labels[current.status] || current.status} · 版本 ${current.version}` : '合作設定'}。通知狀態請查看本機收件匣。`);
  } catch (error) {
    clearUnauthorized(error);
    if (error.uncertain || committed) {
      try {
        const current = await readAll(orderId);
        feedback(`回應結果不明；已讀回目前${current ? `狀態：${labels[current.status] || current.status} · 版本 ${current.version}` : '清單'}。請核對紀錄後再操作；未自動重送。`, true);
      } catch (readError) { clearUnauthorized(readError); feedback('結果不明且讀回失敗；請重新讀取確認後再操作。未自動重送。', true); }
    } else feedback(`未保存：${errorText(error)}。${error.code === 'SUPPLEMENT_REQUIRED' ? '超過核准金額，請先提交追加報價並取得核准。' : '請檢查輸入或重新讀取狀態。'}`, true);
  } finally { lock(false); }
}
const options = (rows, selected) => rows.map(([value, title]) => `<option value="${esc(value)}"${String(value) === String(selected) ? ' selected' : ''}>${esc(title)}</option>`).join('');
const examples = { title: '例如：202 房水龍頭漏水', area: '例如：202 房、樓梯間或庭院', name: '例如：陳先生水電', service_areas: '例如：台中市、大里區（可留白）', location: '例如：202 房浴室洗手台', property_id: '填物件管理中的代號；未設定可留白' };
const input = (name, title, value = '', type = 'text', required = true) => `<label>${esc(title)}<input name="${name}" type="${type}" value="${esc(value)}"${examples[name] ? ` placeholder="${esc(examples[name])}"` : ''}${required ? ' required' : ''}${type === 'number' ? ' min="0" max="9007199254740991" step="1"' : ''}></label>`;
const select = (name, title, rows, selected) => `<label>${esc(title)}<select name="${name}">${options(rows, selected)}</select></label>`;
const textarea = (name, title, required = false, value = '') => `<label>${esc(title)}<textarea name="${name}"${required ? ' required' : ''}>${esc(value)}</textarea></label>`;
const money = value => `新臺幣 ${Number(value).toLocaleString('zh-TW')} 元`;
const partnerName = value => displayName(state.partners.find(p => p.id === value)?.name || value);
const partnerOptions = () => state.partners.filter(p => p.active).map(p => [p.id, displayName(p.name)]);
const isCompanyManager = () => state.actor?.role === 'vendor' && state.actor.partner_type === 'company' && state.actor.member_role === 'manager';
const canRespond = () => state.actor?.role === 'vendor' && (state.actor.member_role === 'manager' ||
  state.actor.partner_type === 'individual' && state.actor.member_role === 'worker');
function assigneeOptions() {
  if (state.actor?.partner_type === 'individual') return [[state.actor.actor_id, `${displayName(state.actor.actor_id)}（本人）`]];
  const partner = state.partners.find(p => p.id === state.actor?.partner_id);
  return (partner?.members || []).filter(member => member.active && ['manager', 'worker'].includes(member.member_role))
    .map(member => [member.actor_id, `${displayName(member.actor_id)}（${roleName(member.member_role)}）`]);
}
function assigneeField() {
  return isCompanyManager() ? select('assignee_actor_id', '指定執行成員', assigneeOptions()) : '';
}
const tradeNameField = title => `<label data-trade-name-field hidden>${esc(title)}<input name="trade_name" type="text" maxlength="80"></label>`;
function eligibleAgreementOptions(order, partnerId) {
  if (order.trade === 'repair') return [];
  const latest = new Map();
  for (const agreement of state.agreements) {
    const agreementId = agreement.agreement_id || agreement.id;
    const previous = latest.get(agreementId);
    if (!previous || agreement.version > previous.version) latest.set(agreementId, agreement);
  }
  const now = Date.now();
  return [...latest.values()].filter(agreement => agreement.active === true && agreement.partner_id === partnerId &&
    agreement.trade === order.trade && (order.trade !== 'other' || agreement.trade_name === order.trade_name) &&
    (!agreement.property_id || agreement.property_id === order.property_id) &&
    Date.parse(agreement.starts_at) <= now && Date.parse(agreement.ends_at) >= now)
    .sort((a, b) => a.title.localeCompare(b.title) || a.agreement_id.localeCompare(b.agreement_id))
    .map(agreement => [agreement.agreement_id || agreement.id, `${displayName(agreement.title)} · ${money(agreement.price_twd)} · 第 ${agreement.version} 版`]);
}
function invitationPartner(order, mode = 'ranked', selectedPartner) {
  if (mode === 'manual') return selectedPartner;
  if (mode !== 'ranked') return undefined;
  return state.priorities.filter(rule => rule.workspace_id === state.actor.workspace_id &&
    rule.property_id === order.property_id && rule.trade === order.trade && (order.trade !== 'other' || rule.trade_name === order.trade_name))
    .sort((a, b) => a.rank - b.rank)[0]?.partner_id;
}
function refreshAgreementChoices(form, order) {
  const selectControl = form.querySelector('select[name="agreement_id"]');
  const rows = [['', '先報價再核准'], ...eligibleAgreementOptions(order,
    invitationPartner(order, form.elements.mode.value, form.elements.partner_id.value))];
  selectControl.innerHTML = options(rows);
  selectControl.value = '';
}
const localDate = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const future = () => localDate(new Date(Date.now() + 86400000));
function quoteFields() {
  return `<p class="muted">先填主要費用；沒有材料或稅費可保留 0。金額以新臺幣計算。</p>` + input('labor_twd', '工資（元）', 0, 'number') +
    input('expires_at', '報價有效期限', future(), 'datetime-local') + `<details class="optional"><summary>材料、稅費與工期（選填）</summary><div class="form-fields">` +
    input('materials_twd', '材料（元）', 0, 'number') + input('tax_twd', '稅費（元）', 0, 'number') + input('estimated_days', '預計工期（天）', 1, 'number') + '</div></details>';
}
function skillsFields(p = {}) {
  const otherNames = [...new Set((p.skills || []).filter(skill => skill.trade === 'other')
    .map(skill => skill.name.trim()).filter(name => name && name !== 'other' && name !== '其他工種'))];
  return `<fieldset><legend>服務工種</legend>${trades.map(([trade, title]) => `<label class="check"><input type="checkbox" name="trades" value="${trade}"${p.trades?.includes(trade) ? ' checked' : ''}>${title}</label>`).join('')}</fieldset>` +
    `<div data-other-skills${p.trades?.includes('other') ? '' : ' hidden'}>${textarea('skill_names', '其他工種名稱（每行一項）', false, otherNames.join('\n'))}<p class="muted">例如油漆、剪枝、除草，每行填一個。</p></div>` + input('service_areas', '服務區域', p.service_areas?.join('、') || '', 'text', false);
}
function updateTradeNameField(form) {
  const field = form.querySelector('[data-trade-name-field]');
  if (!field) return;
  const selected = form.elements.trade.value === 'other';
  field.hidden = !selected;
  field.querySelector('input').required = selected;
  if (!selected) field.querySelector('input').value = '';
}
function bindingPanel(p) {
  return `<details data-disclosure="line-${esc(p.id)}"><summary>LINE 綁定邀請</summary><p class="muted">${state.line.login_ready ? '邀請限一次使用，對方確認後仍需房東核准。LINE 通知尚未啟用。邀請網址只顯示本次；遺失時請撤銷後重新建立。' : '真實登入入口尚未接通；目前可保存、撤銷邀請，尚不能發送 LINE 或完成真實綁定。'}</p><form data-form="line-invite" data-partner="${esc(p.id)}">${select('member_role', '綁定後職責', [['worker', '施工者'], ['manager', '管理者'], ['contact', '聯絡窗口']])}<button>建立綁定邀請</button></form>${state.bindings.invites.filter(i => i.partner_id === p.id).map(i => `<p><span>${i.status === 'revoked' ? '已撤銷' : i.status === 'pending' ? '等待 LINE 登入' : '已提交綁定申請'}</span> · ${esc(roleName(i.member_role))} · 有效至 ${esc(new Date(i.expires_at).toLocaleString('zh-TW'))}</p>${i.status === 'pending' ? `${state.inviteLinks.has(i.id) ? `<label>請複製此邀請給指定合作人員<input readonly value="${esc(state.inviteLinks.get(i.id))}"></label>` : ''}<button type="button" class="secondary" data-action="line-revoke" data-binding="${esc(i.id)}">撤銷邀請</button>` : ''}`).join('')}${state.bindings.requests.filter(r => r.partner_id === p.id).map(r => `<p>${r.status === 'approved' ? '已綁定' : '等待房東核准'} · ${esc(roleName(r.member_role))}</p>${r.status === 'awaiting_approval' ? `<button type="button" data-action="line-approve" data-binding="${esc(r.id)}">核准綁定</button>` : ''}`).join('')}</details>`;
}
function directory() {
  return `<h2>合作設定</h2><p class="muted">先新增合作對象與服務工種。順位、固定價與成員只需設定一次，需要時再展開。</p><section class="panel"><h3>新增公司或個人</h3><p class="muted">例如「大林清潔公司」或「陳先生水電」。</p><form id="partner-create" data-form="partner-create">${input('name', '合作名稱')}${select('type', '合作類型', [['company', '公司'], ['individual', '個人']])}${skillsFields()}<button>保存合作對象</button></form></section>` +
    state.partners.map(p => `<article data-partner="${esc(p.id)}"><h3>${esc(displayName(p.name))}</h3><p>${p.type === 'company' ? '公司' : '個人'} · ${p.active ? '合作中' : '已停用'}</p>
      <details data-disclosure="edit-${esc(p.id)}"><summary>修改合作資料</summary><form data-form="partner-update" data-partner="${esc(p.id)}">${input('name', '合作名稱', displayName(p.name))}${skillsFields(p)}${select('active', '合作狀態', [['true', '啟用'], ['false', '停用']], p.active)}<button>更新合作設定</button></form></details>
      ${bindingPanel(p)}<p>成員：${p.members.map(m => `${esc(displayName(m.actor_id))}（${esc(roleName(m.member_role))}，${m.active ? '啟用' : '停用'}）`).join('、') || '尚無'}</p>
      <details data-disclosure="members-${esc(p.id)}"><summary>新增公司成員／聯絡窗口</summary><p class="muted">管理者負責報價與接單；施工者回報完工；窗口查看進度。本機示範以成員代號加入。</p><form data-form="member-create" data-partner="${esc(p.id)}">${input('actor_id', '成員代號')}${select('member_role', '成員職責', [['worker', '施工者'], ['manager', '管理者'], ['contact', '窗口']])}<button>加入成員</button></form></details></article>`).join('') +
    `<details class="panel" data-disclosure="priorities"><summary>設定第一、第二優先順序</summary><p class="muted">同一物件與工種：填 1 代表優先聯絡，填 2 代表第二順位；不合作的對象留白。</p><form id="priority-form" data-form="priority">${input('property_id', '物件代號')}${select('trade', '工種', trades)}${tradeNameField('其他工種名稱')}${partnerOptions().map(([key, name]) => input(`rank:${key}`, `${name} 順位`, '', 'number', false)).join('')}<button>保存順位</button></form>
      <div id="priority-list">${state.priorities.slice().sort((a, b) => a.rank - b.rank).map(r => `<p>${esc(displayName(r.property_id))} · ${esc(trades.find(t => t[0] === r.trade)?.[1])}${r.trade_name ? `（${esc(r.trade_name)}）` : ''} · ${r.rank}：${esc(partnerName(r.partner_id))}</p>`).join('') || '<p>尚未設定順位</p>'}</div></details>
    <details class="panel" data-disclosure="agreements"><summary>已有固定收費？設定服務約定</summary><p class="muted">例如每次清潔 1,500 元。有約定才需要設定；一般維修可直接請廠商報價。</p><form id="agreement-form" data-form="agreement">${input('title', '約定標題')}${select('partner_id', '合作對象', partnerOptions())}${select('trade', '工種', trades, 'cleaning')}${tradeNameField('其他工種名稱')}${input('property_id', '物件代號', '', 'text', false)}${input('price_twd', '固定價（元）', 0, 'number')}${input('starts_at', '開始日期', localDate(new Date()), 'datetime-local')}${input('ends_at', '結束日期', localDate(new Date(Date.now() + 365 * 86400000)), 'datetime-local')}<button>保存固定價約定</button></form>
      <div id="agreement-list">${state.agreements.map(a => `<p>${esc(displayName(a.title))} · ${esc(partnerName(a.partner_id))} · ${esc(a.trade_name || tradeName(a.trade))} · ${money(a.price_twd)} · 版本 ${a.version} · ${esc(a.starts_at)} — ${esc(a.ends_at)}</p>`).join('')}</div></details>`;
}
function inviteForm(w) {
  const defaultMode = invitationPartner(w) ? 'ranked' : 'manual';
  const firstPartner = defaultMode === 'ranked' ? invitationPartner(w) : partnerOptions()[0]?.[0];
  return `<p class="muted">選一位廠商即可詢價；已有固定價約定時，可在價格方式選擇。</p><form data-form="invite" data-order="${esc(w.id)}">${select('mode', '邀請方式', [['ranked', '依順位邀請'], ['manual', '手動指定'], ['parallel', '明確邀請多家報價']], defaultMode)}${select('partner_id', '指定合作對象', partnerOptions())}
    <fieldset data-parallel-partners hidden><legend>選擇要詢價的廠商</legend>${partnerOptions().map(([key, name]) => `<label class="check"><input name="partner_ids" type="checkbox" value="${esc(key)}">${esc(name)}</label>`).join('')}</fieldset>
    ${select('agreement_id', '價格方式', [['', '先報價再核准'], ...eligibleAgreementOptions(w, firstPartner)])}
    <details class="optional"><summary>回覆期限與順位遞補設定</summary><div class="form-fields">${input('reply_hours', '回覆期限（小時）', 24, 'number')}<label class="check"><input name="continue_round" type="checkbox">拒絕報價後，繼續下一順位</label></div></details>
    <p class="muted">確認固定價派工即核准約定快照；廠商接單後才建立承接紀錄。</p><button>確認邀請／固定價派工</button></form>`;
}
document.addEventListener('change', event => {
  const changedForm = event.target.closest('form[data-form]');
  if (changedForm && event.target.name === 'trade') updateTradeNameField(changedForm);
  if (changedForm && event.target.name === 'trades') {
    const group = changedForm.querySelector('[data-other-skills]');
    if (group) group.hidden = !changedForm.querySelector('input[name="trades"][value="other"]').checked;
  }
  const form = event.target.closest('form[data-form="invite"]');
  if (!form || !['partner_id', 'mode'].includes(event.target.name)) return;
  form.querySelector('[data-parallel-partners]').hidden = form.elements.mode.value !== 'parallel';
  const order = state.orders.find(candidate => candidate.id === form.dataset.order);
  if (order) refreshAgreementChoices(form, order);
});
function orderCard(w) {
  const landlord = state.actor.role === 'landlord';
  const assignedToCurrent = !landlord && w.assignment?.assigned_actor_id === state.actor.actor_id && ['worker', 'manager'].includes(state.actor.member_role);
  let content = `<article class="work-order" data-order="${esc(w.id)}"><h3>${esc(displayName(w.title))}</h3><p><span class="badge">${esc(labels[w.status] || '處理中')}</span> · 版本 ${w.version}</p><p>${esc(tradeName(w.trade))}${w.trade_name ? ` · ${esc(w.trade_name)}` : ''} · ${esc(w.area)}</p>`;
  if (w.location) content += `<p>作業位置：${esc(w.location)}</p>`;
  if (w.instructions) content += `<p>作業指引：${esc(w.instructions)}</p>`;
  content += w.invitations.map(i => `<p>${esc(partnerName(i.partner_id))} · ${esc(labels[i.status] || i.status)} · 回覆期限 ${esc(i.deadline_at)}${i.agreement_snapshot ? ` · 固定價 ${money(i.agreement_snapshot.price_twd)} · 第 ${i.agreement_snapshot.version} 版` : ''}</p>`).join('');
  if (landlord && ['draft', 'sourcing'].includes(w.status) && !w.assignment) content += inviteForm(w);
  if (w.quotes.length) content += `<h4>${landlord ? '報價比較' : '我的報價'}</h4>`;
  content += w.quotes.map(q => `<div class="quote"><p>${esc(partnerName(q.partner_id))} · ${money(q.total_twd)} · 第 ${q.version} 版 · ${esc(labels[q.status] || q.status)}</p><p class="muted">工資 ${money(q.labor_twd)} / 材料 ${money(q.materials_twd)} / 稅費 ${money(q.tax_twd)} · ${q.estimated_days} 天 · 有效至 ${esc(q.expires_at)}</p>${landlord && q.status === 'submitted' ? `<div class="actions"><button data-action="approve" data-order="${esc(w.id)}" data-quote="${esc(q.id)}">核准此報價</button><button class="secondary" data-action="reject" data-order="${esc(w.id)}" data-quote="${esc(q.id)}">拒絕此報價</button></div>` : ''}</div>`).join('');
  if (!landlord && canRespond() && !w.assignment) {
    content += w.invitations.filter(i => ['sent', 'quoted'].includes(i.status)).map(i => `<section>${i.agreement_snapshot ? `<form data-form="accept-fixed" data-order="${esc(w.id)}" data-invitation="${esc(i.id)}">${assigneeField()}<button>接受固定價工作</button></form>` : `<form data-form="quote" data-order="${esc(w.id)}" data-invitation="${esc(i.id)}">${assigneeField()}${quoteFields()}<button>提交報價</button></form>`}<button class="secondary" data-action="decline" data-order="${esc(w.id)}" data-invitation="${esc(i.id)}">拒接邀請</button></section>`).join('');
  }
  if (w.assignment) content += `<p>核准金額：${money(w.assignment.approved_amount_twd)} · ${esc(labels[w.assignment.status] || w.assignment.status)}</p>`;
  if (assignedToCurrent && w.status === 'assigned') content += `<button data-action="start" data-order="${esc(w.id)}">開始施工</button>`;
  content += (w.completion_reports || []).map(r => `<div class="quote"><h4>完工回報</h4><p>${esc(r.description)}</p><p>實際費用 ${money(r.actual_amount_twd)} · ${esc(r.at)}</p></div>`).join('');
  content += (w.acceptances || []).map(a => `<p>${a.decision === 'rework' ? `補修原因：${esc(a.reason)}` : '驗收通過'} · ${esc(a.at)}</p>`).join('');
  content += (w.attachments || []).map(a => `<p><a href="/api/attachments/${id(a.id)}">下載私有附件 · ${a.content_type === 'application/pdf' ? '文件' : '圖片'} · ${Math.ceil(a.size_bytes / 1024).toLocaleString('zh-TW')} 千位元組</a></p>`).join('');
  if (assignedToCurrent && w.status === 'in_progress') {
    content += `<form data-form="upload" data-order="${esc(w.id)}"><label>私有附件<input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf" required></label><p class="muted">可上傳照片或文件；每個檔案最多 10 百萬位元組。</p><progress aria-label="附件上傳進度" max="100" value="${state.progress.get(w.id) || 0}"></progress><button>上傳附件</button></form>
      <form data-form="completion" data-order="${esc(w.id)}">${textarea('description', '完工說明', true)}${input('actual_amount_twd', '實際費用（元）', w.assignment.approved_amount_twd, 'number')}<p class="muted">將包含已保存附件。完工後等待房東驗收。</p><button>提交完工回報</button></form>
      <details><summary>追加費用報價</summary><form data-form="supplement" data-order="${esc(w.id)}">${quoteFields()}${textarea('reason', '追加原因', true)}<button>提交追加報價</button></form></details>`;
  }
  content += (w.supplements || []).map(s => `<div class="quote"><p>追加 ${money(s.total_twd)} · ${esc(s.reason)} · ${s.approved ? '已核准' : '待核准'}</p>${landlord && !s.approved && w.status === 'in_progress' ? `<button data-action="approve-supplement" data-order="${esc(w.id)}" data-supplement="${esc(s.id)}">核准追加報價</button>` : ''}</div>`).join('');
  if (landlord && w.status === 'awaiting_acceptance') content += `<button data-action="accept" data-order="${esc(w.id)}">驗收通過</button><form data-form="rework" data-order="${esc(w.id)}">${textarea('reason', '補修原因', true)}<button>退回補修</button></form>`;
  return content + '</article>';
}
function render() {
  const opened = new Set([...document.querySelectorAll('details[data-disclosure][open]')].map(d => d.dataset.disclosure));
  if (!state.actor) {
    if (state.pendingBinding) {
      const b = state.pendingBinding;
      $('#identity').textContent = 'LINE 身分已驗證，尚未取得工單權限'; $('#navigation').replaceChildren();
      $('#content').innerHTML = `<section class="panel"><h2>確認加入合作對象</h2><p>${esc(displayName(b.partner_name))} · ${esc(roleName(b.member_role))}</p>${b.status === 'awaiting_approval' ? '<p>已提交綁定，等待房東核准。</p><a href="/auth/line/start">房東核准後，使用 LINE 登入</a>' : '<p>請確認公司與職責正確；提交後仍需房東核准。</p><form data-form="line-confirm"><button>確認綁定</button></form>'}</section>`; return;
    }
    if (!state.line.development_mode) {
      $('#identity').textContent = '尚未登入'; $('#navigation').replaceChildren();
      $('#content').innerHTML = `<section class="panel"><h2>${state.line.login_ready ? '合作人員登入' : 'LINE 登入尚未設定'}</h2>${state.line.login_ready ? '<a href="/auth/line/start">使用 LINE 登入</a><p>初次使用請先向房東取得綁定邀請。</p>' : '<p>尚未接通真實登入，請等待測試入口設定完成。</p>'}</section>`; return;
    }
    $('#identity').textContent = '尚未登入本機測試身份'; $('#navigation').replaceChildren();
    $('#content').innerHTML = `<section class="panel"><h2>本機合成身份</h2><form data-form="login">${select('principal', '本機測試身份', [
      ['landlord_a', '房東甲（示範）'], ['landlord_b', '房東乙（示範）'], ['company_a_manager', '公司甲管理者（示範）'], ['company_a_worker', '公司甲施工者一（示範）'], ['company_a_worker_2', '公司甲施工者二（示範）'], ['company_a_contact', '公司甲聯絡窗口（示範）'], ['company_b_worker', '公司乙施工者（示範）'], ['individual_worker', '個人師傅（示範）'],
    ])}<button>進入本機工作台</button></form></section>`; return;
  }
  const landlord = state.actor.role === 'landlord';
  $('#identity').textContent = `${landlord ? '房東' : '合作廠商'} · ${displayName(state.actor.actor_id)} · ${displayName(state.actor.workspace_id)}`;
  $('#navigation').innerHTML = `<button data-tab="jobs" aria-current="${state.tab === 'jobs' ? 'page' : 'false'}">${landlord ? '工單總覽' : '我的工作'}</button>${landlord ? '<button data-tab="directory">合作設定</button>' : ''}<button data-tab="inbox">通知中心</button>`;
  let html = '<button class="secondary" id="refresh">重新讀取</button>';
  if (state.tab === 'directory' && landlord) html += directory();
  else if (state.tab === 'inbox') html += `<h2>本機通知中心</h2>${state.inbox.map(n => { const matched = /^Work order (repair|cleaning|other): update available\.$/.exec(n.message); return `<article><p>${esc(matched ? `${tradeName(matched[1])}工單有新進度，請查看工作清單。` : n.message)}</p><p>${n.status === 'saved' ? '已保存通知' : '通知處理中'} · ${esc(n.at)}</p></article>`; }).join('') || '<p>尚無本機通知</p>'}`;
  else {
    html += `<h2>${landlord ? '工單總覽' : '我的邀請與工作'}</h2>`;
    if (landlord) html += `<details open class="panel"><summary>建立工作</summary><p class="muted">先填三項：要做什麼、工作類型、在哪裡。建立後再選廠商。</p><form id="job-create" data-form="create">${input('title', '工作標題')}${select('trade', '工種', trades)}${tradeNameField('其他工種名稱')}${input('area', '必要區域')}<details class="optional" data-disclosure="create-extra"><summary>補充物件、詳細位置與作業說明（選填）</summary><div class="form-fields"><p class="muted">有設定廠商順位才需填物件代號；詳細位置與作業指引提供給承接廠商。</p>${input('property_id', '物件代號', '', 'text', false)}${input('location', '核准作業位置', '', 'text', false)}${textarea('instructions', '核准作業指引')}</div></details><button>建立工作草稿</button></form></details>`;
    html += state.orders.map(orderCard).join('') || '<p>目前沒有工單。</p>';
  }
  $('#content').innerHTML = html;
  document.querySelectorAll('details[data-disclosure]').forEach(d => { d.open = opened.has(d.dataset.disclosure); });
  document.querySelectorAll('form[data-form="create"], form[data-form="priority"], form[data-form="agreement"]').forEach(updateTradeNameField);
}
function fields(form) { return Object.fromEntries(new FormData(form)); }
function quoteInput(f) { return { labor_twd: Number(f.labor_twd), materials_twd: Number(f.materials_twd), tax_twd: Number(f.tax_twd), estimated_days: Number(f.estimated_days), expires_at: new Date(f.expires_at).toISOString() }; }
function partnerInput(form, f) {
  const chosen = new FormData(form).getAll('trades');
  const skills = chosen.filter(trade => trade !== 'other').map(trade => ({ trade, name: trades.find(t => t[0] === trade)[1] }));
  if (chosen.includes('other')) {
    const names = [...new Set(f.skill_names.split(/\r?\n/).map(name => name.trim()).filter(Boolean))];
    skills.push(...(names.length ? names : ['其他工種']).map(name => ({ trade: 'other', name })));
  }
  return { name: f.name, skills, service_areas: f.service_areas.split(/[、,，]/).map(v => v.trim()).filter(Boolean) };
}
async function upload(form, w) {
  const file = form.elements.file.files[0];
  if (!file || file.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) { feedback('未上傳：請選擇支援的照片或文件，每個檔案最多 10 百萬位元組。', true); return; }
  // Ephemeral to this authenticated upload/readback, never shared or persisted.
  const actorScope = actor => JSON.stringify([actor?.workspace_id, actor?.actor_id, actor?.role, actor?.partner_id]);
  const uploadScope = actorScope(state.actor);
  const preserveCompletionDraft = () => {
    // Capture after all authoritative GETs, immediately before replacing the DOM.
    if (actorScope(state.actor) !== uploadScope) return;
    const drafts = new Map([...document.querySelectorAll('form[data-form="completion"]')].map(completion =>
      [completion.dataset.order, { description: completion.elements.description.value,
        actual_amount_twd: completion.elements.actual_amount_twd.value }]));
    return () => {
      if (actorScope(state.actor) !== uploadScope) return;
      for (const current of document.querySelectorAll('form[data-form="completion"]')) {
        const draft = drafts.get(current.dataset.order);
        if (!draft) continue; // Only forms still editable in the server projection.
        current.elements.description.value = draft.description;
        current.elements.actual_amount_twd.value = draft.actual_amount_twd;
      }
    };
  };
  lock(true); feedback('附件上傳中…'); let committed = false;
  try {
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest(); xhr.open('POST', `/api/work-orders/${id(w.id)}/attachments`); xhr.timeout = 15000;
      xhr.setRequestHeader('Content-Type', file.type); xhr.setRequestHeader('Idempotency-Key', crypto.randomUUID()); xhr.setRequestHeader('X-Work-Order-Version', String(w.version));
      xhr.upload.onprogress = e => { if (e.lengthComputable) { const value = Math.round(e.loaded / e.total * 100); state.progress.set(w.id, value); form.querySelector('progress').value = value; } };
      xhr.onload = () => {
        let result; try { result = JSON.parse(xhr.responseText); } catch { reject(Object.assign(new Error('回應結果不明'), { uncertain: true })); return; }
        if (xhr.status >= 200 && xhr.status < 300 && result.success === true) resolve(result.data);
        else reject(Object.assign(new Error(result.code || '附件失敗'), { code: result.code, uncertain: xhr.status >= 500 }));
      };
      xhr.onerror = xhr.ontimeout = () => reject(Object.assign(new Error('回應結果不明'), { uncertain: true })); xhr.send(file);
    });
    committed = true; state.progress.set(w.id, 100); await readAll(w.id, preserveCompletionDraft); feedback('已保存並讀回私有附件。');
  } catch (error) {
    state.progress.set(w.id, 0); form.querySelector('progress').value = 0; clearUnauthorized(error);
    if (error.uncertain || committed) {
      try { await readAll(w.id, preserveCompletionDraft); feedback('附件回應結果不明；已讀回附件清單，請核對後再操作。未自動重送。', true); }
      catch (readError) { clearUnauthorized(readError); feedback('附件結果不明且讀回失敗；請重新讀取。未自動重送。', true); }
    } else feedback(`未上傳：${errorText(error)}`, true);
  } finally { lock(false); }
}
document.addEventListener('submit', async event => {
  const form = event.target.closest('form[data-form]'); if (!form) return; event.preventDefault(); if (state.busy) return;
  const f = fields(form), kind = form.dataset.form, w = state.orders.find(w => w.id === form.dataset.order);
  const version = w ? { expected_version: w.version } : {};
  try {
    if (kind === 'login') {
      lock(true);
      try {
        await api('/api/dev/session', 'POST', { principal: f.principal }); await readAll(); feedback('已讀取本機合成身份與工作清單。');
      } catch (error) {
        if (!error.uncertain) throw error;
        try { await readAll(); feedback('登入回應結果不明；已讀回本機登入狀態 與工作清單，請核對目前身份。未自動重送。', true); }
        catch (readError) { clearUnauthorized(readError); feedback('登入結果不明且 登入狀態讀回失敗。請重新讀取確認。未自動重送。', true); }
      } finally { lock(false); }
      return;
    }
    if (kind === 'upload') { await upload(form, w); return; }
    if (kind === 'line-confirm') {
      lock(true);
      try {
        await api('/api/line/confirm', 'POST', { csrf: state.pendingBinding.csrf });
        state.pendingBinding = await api('/api/line/pending'); render(); feedback('已讀回綁定申請，等待房東核准。');
      } catch (error) {
        if (error.uncertain) {
          state.pendingBinding = await api('/api/line/pending'); render(); feedback('回應不明；已讀回綁定狀態，未自動重送。', true);
        } else throw error;
      } finally { lock(false); }
      return;
    }
    let path, body, method = 'POST';
    if (kind === 'create') { path = '/api/work-orders'; body = { title: f.title, trade: f.trade, ...(f.trade === 'other' ? { trade_name: f.trade_name } : {}), area: f.area, location: f.location, instructions: f.instructions, ...(f.property_id ? { property_id: f.property_id } : {}) }; }
    if (kind === 'partner-create') { path = '/api/partners'; body = { ...partnerInput(form, f), type: f.type }; }
    if (kind === 'partner-update') { path = `/api/partners/${id(form.dataset.partner)}`; method = 'PATCH'; body = { ...partnerInput(form, f), active: f.active === 'true' }; }
    if (kind === 'member-create') { path = `/api/partners/${id(form.dataset.partner)}/memberships`; body = { actor_id: f.actor_id, member_role: f.member_role }; }
    if (kind === 'line-invite') { path = '/api/line/invites'; body = { partner_id: form.dataset.partner, member_role: f.member_role }; }
    if (kind === 'priority') { path = '/api/priority-rules'; method = 'PUT'; body = { property_id: f.property_id, trade: f.trade, ...(f.trade === 'other' ? { trade_name: f.trade_name } : {}), rules: Object.entries(f).filter(([k, v]) => k.startsWith('rank:') && v !== '').map(([k, v]) => ({ partner_id: k.slice(5), rank: Number(v) })) }; }
    if (kind === 'agreement') { path = '/api/service-agreements'; body = { partner_id: f.partner_id, title: f.title, trade: f.trade, ...(f.trade === 'other' ? { trade_name: f.trade_name } : {}), property_id: f.property_id, price_twd: Number(f.price_twd), starts_at: new Date(f.starts_at).toISOString(), ends_at: new Date(f.ends_at).toISOString() }; }
    if (kind === 'invite') { path = `/api/work-orders/${id(w.id)}/invitations`; body = { ...version, mode: f.mode, reply_hours: Number(f.reply_hours), continue_round: f.continue_round === 'on', ...(f.mode === 'manual' ? { partner_id: f.partner_id } : {}), ...(f.mode === 'parallel' ? { partner_ids: new FormData(form).getAll('partner_ids') } : {}), ...(f.agreement_id ? { agreement_id: f.agreement_id } : {}) }; }
    if (kind === 'quote') { path = `/api/invitations/${id(form.dataset.invitation)}/quote`; body = { ...version, ...quoteInput(f), ...(f.assignee_actor_id ? { assignee_actor_id: f.assignee_actor_id } : {}) }; }
    if (kind === 'accept-fixed') { const invitation = w.invitations.find(i => i.id === form.dataset.invitation); path = `/api/assignments/${id(invitation.assignment_id)}/accept`; body = { ...version, ...(f.assignee_actor_id ? { assignee_actor_id: f.assignee_actor_id } : {}) }; }
    if (kind === 'completion') { path = `/api/assignments/${id(w.assignment.id)}/completion`; body = { ...version, description: f.description, actual_amount_twd: Number(f.actual_amount_twd), attachment_ids: (w.attachments || []).map(a => a.id) }; }
    if (kind === 'supplement') { path = `/api/assignments/${id(w.assignment.id)}/supplements`; body = { ...version, ...quoteInput(f), reason: f.reason }; }
    if (kind === 'rework') { path = `/api/work-orders/${id(w.id)}/acceptance`; body = { ...version, decision: 'rework', reason: f.reason }; }
    if (path) await write(path, body, method, w?.id);
  } catch (error) { clearUnauthorized(error); feedback(`操作失敗：${errorText(error)}。請重新讀取確認。`, true); lock(false); }
});
document.addEventListener('click', async event => {
  const button = event.target.closest('button'); if (!button || state.busy) return;
  if (button.dataset.tab) { state.tab = button.dataset.tab; render(); $('#page').scrollTop = 0; return; }
  if (button.id === 'refresh') {
    lock(true); try { await readAll(); feedback('已讀取伺服器保存狀態。'); } catch (error) { clearUnauthorized(error); feedback(`讀取失敗：${errorText(error)}`, true); } finally { lock(false); } return;
  }
  const action = button.dataset.action; if (!action) return;
  if (action === 'line-revoke' || action === 'line-approve') {
    await write(`/api/line/${action === 'line-revoke' ? 'invites' : 'bindings'}/${id(button.dataset.binding)}/${action === 'line-revoke' ? 'revoke' : 'approve'}`, {}); return;
  }
  const w = state.orders.find(w => w.id === button.dataset.order); if (!w) return;
  let path, body = { expected_version: w.version };
  if (['approve', 'reject'].includes(action)) { const q = w.quotes.find(q => q.id === button.dataset.quote); path = `/api/work-orders/${id(w.id)}/quote-approval`; Object.assign(body, { quote_id: q.id, quote_version: q.version, decision: action === 'approve' ? 'approve' : 'reject' }); }
  if (action === 'decline') path = `/api/invitations/${id(button.dataset.invitation)}/decline`;
  if (action === 'start') path = `/api/assignments/${id(w.assignment.id)}/start`;
  if (action === 'accept') { path = `/api/work-orders/${id(w.id)}/acceptance`; body.decision = 'accept'; }
  if (action === 'approve-supplement') { const s = w.supplements.find(s => s.id === button.dataset.supplement); path = `/api/work-orders/${id(w.id)}/supplement-approval`; Object.assign(body, { supplement_id: s.id, supplement_version: s.version }); }
  if (path) await write(path, body, 'POST', w.id);
});
async function startPage() {
  state.line = await api('/api/line/status');
  if (state.line.login_ready && new URL(location.href).searchParams.get('line') === 'binding') {
    state.pendingBinding = await api('/api/line/pending'); render(); return;
  }
  try { await readAll(); feedback('已讀取保存狀態。'); }
  catch (error) { clearUnauthorized(error); render(); feedback(error.code === 'SESSION_REQUIRED' ? state.line.development_mode ? '請選擇本機合成身份登入。' : '請使用 LINE 登入。' : `讀取失敗：${errorText(error)}`, error.code !== 'SESSION_REQUIRED'); }
}
startPage().catch(() => { render(); feedback('登入設定讀取失敗，請重新整理。', true); });
