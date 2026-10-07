/* Local fixture sessions only; authority and projections always come from the server. */
'use strict';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const id = value => encodeURIComponent(value);
const labels = { draft: '草稿', sourcing: '待回覆', pending: '待通知', sent: '待回覆', quoted: '已報價', submitted: '已報價',
  awaiting_approval: '待核准', approved: '已核准', accepted: '已接單', assigned: '已派工', in_progress: '施工中',
  awaiting_acceptance: '待驗收', completed: '已結案', cancelled: '已取消', expired: '已逾期', declined: '已拒接', rejected: '已拒絕', withdrawn: '已撤回' };
const trades = [['repair', '維修'], ['cleaning', '清潔'], ['other', '其他工種']];
const state = { actor: null, orders: [], partners: [], priorities: [], agreements: [], inbox: [], tab: 'jobs', busy: false, progress: new Map() };
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
  if (!response.ok || data.success !== true) throw Object.assign(new Error(data.code || '無法讀取回應'), { uncertain: write && response.status >= 500, code: data.code });
  return data.data;
}
async function readAll(orderId) {
  // Session is rechecked on every refresh; a removed member cannot keep a stale view.
  const session = await api('/api/session');
  const landlord = session.actor.role === 'landlord';
  const [orders, partners, agreements, inbox, priorities] = await Promise.all([
    api('/api/work-orders'), api('/api/partners'), api('/api/service-agreements'), api('/api/inbox'),
    landlord ? api('/api/priority-rules') : Promise.resolve([]),
  ]);
  const current = orderId ? await api(`/api/work-orders/${id(orderId)}`) : null;
  Object.assign(state, { actor: session.actor, orders: current ? orders.map(w => w.id === current.id ? current : w) : orders, partners, agreements, inbox, priorities });
  render(); return current;
}
function clearUnauthorized(error) {
  if (['SESSION_REQUIRED', 'FORBIDDEN'].includes(error.code)) {
    Object.assign(state, { actor: null, orders: [], partners: [], agreements: [], inbox: [], priorities: [] });
    state.progress.clear(); render();
  }
}
async function write(path, body, method = 'POST', orderId) {
  if (state.busy) return;
  lock(true); feedback('保存中…');
  let committed = false;
  try {
    const result = await api(path, method, body); committed = true;
    const current = await readAll(orderId || (result?.status && result?.id ? result.id : undefined));
    feedback(`已保存並讀回${current ? `：${labels[current.status] || current.status} · 版本 ${current.version}` : '合作設定'}。通知狀態請查看本機收件匣。`);
  } catch (error) {
    clearUnauthorized(error);
    if (error.uncertain || committed) {
      try {
        const current = await readAll(orderId);
        feedback(`回應結果不明；已讀回目前${current ? `狀態：${labels[current.status] || current.status} · 版本 ${current.version}` : '清單'}。請核對紀錄後再操作；未自動重送。`, true);
      } catch (readError) { clearUnauthorized(readError); feedback('結果不明且讀回失敗；請重新讀取確認後再操作。未自動重送。', true); }
    } else feedback(`未保存：${error.message}。${error.code === 'SUPPLEMENT_REQUIRED' ? '超過核准金額，請先提交追加報價並取得核准。' : '請檢查輸入或重新讀取狀態。'}`, true);
  } finally { lock(false); }
}
const options = (rows, selected) => rows.map(([value, title]) => `<option value="${esc(value)}"${String(value) === String(selected) ? ' selected' : ''}>${esc(title)}</option>`).join('');
const input = (name, title, value = '', type = 'text', required = true) => `<label>${esc(title)}<input name="${name}" type="${type}" value="${esc(value)}"${required ? ' required' : ''}${type === 'number' ? ' min="0" max="9007199254740991" step="1"' : ''}></label>`;
const select = (name, title, rows, selected) => `<label>${esc(title)}<select name="${name}">${options(rows, selected)}</select></label>`;
const textarea = (name, title, required = false) => `<label>${esc(title)}<textarea name="${name}"${required ? ' required' : ''}></textarea></label>`;
const money = value => `TWD ${Number(value).toLocaleString('zh-TW')}`;
const partnerName = value => state.partners.find(p => p.id === value)?.name || value;
const partnerOptions = () => state.partners.filter(p => p.active).map(p => [p.id, p.name]);
const localDate = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const future = () => localDate(new Date(Date.now() + 86400000));
function quoteFields() {
  return input('labor_twd', '工資 TWD', 0, 'number') + input('materials_twd', '材料 TWD', 0, 'number') + input('tax_twd', '稅費 TWD', 0, 'number') +
    input('estimated_days', '預計工期（天）', 1, 'number') + input('expires_at', '報價有效期限', future(), 'datetime-local');
}
function skillsFields(p = {}) {
  return `<fieldset><legend>服務工種</legend>${trades.map(([trade, title]) => `<label class="check"><input type="checkbox" name="trades" value="${trade}"${p.trades?.includes(trade) ? ' checked' : ''}>${title}</label>`).join('')}</fieldset>` +
    input('skill_name', '工種名稱', p.skills?.find(s => s.trade === 'other')?.name || '', 'text', false) + input('service_areas', '服務區域', p.service_areas?.join('、') || '', 'text', false);
}
function directory() {
  return `<h2>合作設定</h2><section class="panel"><h3>新增公司或個人</h3><form id="partner-create" data-form="partner-create">${input('name', '合作名稱')}${select('type', '合作類型', [['company', '公司'], ['individual', '個人']])}${skillsFields()}<button>保存合作對象</button></form></section>` +
    state.partners.map(p => `<article data-partner="${esc(p.id)}"><h3>${esc(p.name)}</h3><p>${p.type === 'company' ? '公司' : '個人'} · ${p.active ? '合作中' : '已停用'}</p>
      <form data-form="partner-update" data-partner="${esc(p.id)}">${input('name', '合作名稱', p.name)}${skillsFields(p)}${select('active', '合作狀態', [['true', '啟用'], ['false', '停用']], p.active)}<button>更新合作設定</button></form>
      <p>成員：${p.members.map(m => `${esc(m.actor_id)}（${esc(m.member_role)}，${m.active ? '啟用' : '停用'}）`).join('、') || '尚無'}</p>
      <form data-form="member-create" data-partner="${esc(p.id)}">${input('actor_id', '成員代號')}${select('member_role', '成員職責', [['worker', '施工者'], ['manager', '管理者'], ['contact', '窗口']])}<button>加入成員</button></form></article>`).join('') +
    `<section class="panel"><h3>物件工種順位</h3><p class="muted">留白表示未列入；每個順位只可有一位合作對象。</p><form id="priority-form" data-form="priority">${input('property_id', '物件代號')}${select('trade', '工種', trades)}${partnerOptions().map(([key, name]) => input(`rank:${key}`, `${name} 順位`, '', 'number', false)).join('')}<button>保存順位</button></form>
      <div id="priority-list">${state.priorities.slice().sort((a, b) => a.rank - b.rank).map(r => `<p>${esc(r.property_id)} · ${esc(trades.find(t => t[0] === r.trade)?.[1])} · ${r.rank}：${esc(partnerName(r.partner_id))}</p>`).join('') || '<p>尚未設定順位</p>'}</div></section>
    <section class="panel"><h3>固定價服務約定</h3><form id="agreement-form" data-form="agreement">${input('title', '約定標題')}${select('partner_id', '合作對象', partnerOptions())}${select('trade', '工種', trades, 'cleaning')}${input('property_id', '物件代號', '', 'text', false)}${input('price_twd', '固定價 TWD', 0, 'number')}${input('starts_at', '開始日期', localDate(new Date()), 'datetime-local')}${input('ends_at', '結束日期', localDate(new Date(Date.now() + 365 * 86400000)), 'datetime-local')}<button>保存固定價約定</button></form>
      <div id="agreement-list">${state.agreements.map(a => `<p>${esc(a.title)} · ${esc(partnerName(a.partner_id))} · ${money(a.price_twd)} · 版本 ${a.version} · ${esc(a.starts_at)} — ${esc(a.ends_at)}</p>`).join('')}</div></section>`;
}
function inviteForm(w) {
  return `<form data-form="invite" data-order="${esc(w.id)}">${select('mode', '邀請方式', [['ranked', '依順位邀請'], ['manual', '手動指定'], ['parallel', '明確邀請多家報價']])}${select('partner_id', '指定合作對象', partnerOptions())}
    <fieldset><legend>多家報價對象（僅多家模式）</legend>${partnerOptions().map(([key, name]) => `<label class="check"><input name="partner_ids" type="checkbox" value="${esc(key)}">${esc(name)}</label>`).join('')}</fieldset>
    ${select('agreement_id', '價格方式', [['', '先報價再核准'], ...state.agreements.filter(a => a.active && a.trade === w.trade).map(a => [a.agreement_id, `${a.title} · ${money(a.price_twd)} · v${a.version}`])])}
    ${input('reply_hours', '回覆期限（小時）', 24, 'number')}<label class="check"><input name="continue_round" type="checkbox">拒絕報價後，繼續下一順位</label>
    <p class="muted">確認固定價派工即核准約定快照；廠商接單後才建立承接紀錄。</p><button>確認邀請／固定價派工</button></form>`;
}
function orderCard(w) {
  const landlord = state.actor.role === 'landlord';
  let content = `<article class="work-order" data-order="${esc(w.id)}"><h3>${esc(w.title)}</h3><p><span class="badge">${esc(labels[w.status] || w.status)}</span> · 版本 ${w.version}</p><p class="muted">工單 ${esc(w.id)}</p><p>${esc(w.trade)} · ${esc(w.area)}</p>`;
  if (w.location) content += `<p>作業位置：${esc(w.location)}</p>`;
  if (w.instructions) content += `<p>作業指引：${esc(w.instructions)}</p>`;
  content += w.invitations.map(i => `<p>${esc(partnerName(i.partner_id))} · ${esc(labels[i.status] || i.status)} · 回覆期限 ${esc(i.deadline_at)}${i.agreement_snapshot ? ` · 固定價 ${money(i.agreement_snapshot.price_twd)} · v${i.agreement_snapshot.version}` : ''}</p>`).join('');
  if (landlord && ['draft', 'sourcing'].includes(w.status) && !w.assignment) content += inviteForm(w);
  if (w.quotes.length) content += `<h4>${landlord ? '報價比較' : '我的報價'}</h4>`;
  content += w.quotes.map(q => `<div class="quote"><p>${esc(partnerName(q.partner_id))} · ${money(q.total_twd)} · v${q.version} · ${esc(labels[q.status] || q.status)}</p><p class="muted">工資 ${money(q.labor_twd)} / 材料 ${money(q.materials_twd)} / 稅費 ${money(q.tax_twd)} · ${q.estimated_days} 天 · 有效至 ${esc(q.expires_at)}</p>${landlord && q.status === 'submitted' ? `<div class="actions"><button data-action="approve" data-order="${esc(w.id)}" data-quote="${esc(q.id)}">核准此報價</button><button class="secondary" data-action="reject" data-order="${esc(w.id)}" data-quote="${esc(q.id)}">拒絕此報價</button></div>` : ''}</div>`).join('');
  if (!landlord && !w.assignment) {
    content += w.invitations.filter(i => ['sent', 'quoted'].includes(i.status)).map(i => `<section>${i.agreement_snapshot ? `<button data-action="accept-fixed" data-order="${esc(w.id)}" data-invitation="${esc(i.id)}">接受固定價工作</button>` : `<form data-form="quote" data-order="${esc(w.id)}" data-invitation="${esc(i.id)}">${quoteFields()}<button>提交報價</button></form>`}<button class="secondary" data-action="decline" data-order="${esc(w.id)}" data-invitation="${esc(i.id)}">拒接邀請</button></section>`).join('');
  }
  if (w.assignment) content += `<p>核准金額：${money(w.assignment.approved_amount_twd)} · ${esc(labels[w.assignment.status] || w.assignment.status)}</p>`;
  if (!landlord && w.assignment && w.status === 'assigned') content += `<button data-action="start" data-order="${esc(w.id)}">開始施工</button>`;
  content += (w.completion_reports || []).map(r => `<div class="quote"><h4>完工回報</h4><p>${esc(r.description)}</p><p>實際費用 ${money(r.actual_amount_twd)} · ${esc(r.at)}</p></div>`).join('');
  content += (w.acceptances || []).map(a => `<p>${a.decision === 'rework' ? `補修原因：${esc(a.reason)}` : '驗收通過'} · ${esc(a.at)}</p>`).join('');
  content += (w.attachments || []).map(a => `<p><a href="/api/attachments/${id(a.id)}">下載私有附件 · ${esc(a.content_type)} · ${a.size_bytes} bytes</a></p>`).join('');
  if (!landlord && w.assignment && w.status === 'in_progress') {
    content += `<form data-form="upload" data-order="${esc(w.id)}"><label>私有附件<input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf" required></label><p class="muted">JPEG、PNG、WebP、PDF；每個檔案最多 10 MiB。</p><progress aria-label="附件上傳進度" max="100" value="${state.progress.get(w.id) || 0}"></progress><button>上傳附件</button></form>
      <form data-form="completion" data-order="${esc(w.id)}">${textarea('description', '完工說明', true)}${input('actual_amount_twd', '實際費用 TWD', w.assignment.approved_amount_twd, 'number')}<p class="muted">將包含已保存附件。完工後等待房東驗收。</p><button>提交完工回報</button></form>
      <details><summary>追加費用報價</summary><form data-form="supplement" data-order="${esc(w.id)}">${quoteFields()}${textarea('reason', '追加原因', true)}<button>提交追加報價</button></form></details>`;
  }
  content += (w.supplements || []).map(s => `<div class="quote"><p>追加 ${money(s.total_twd)} · ${esc(s.reason)} · ${s.approved ? '已核准' : '待核准'}</p>${landlord && !s.approved && w.status === 'in_progress' ? `<button data-action="approve-supplement" data-order="${esc(w.id)}" data-supplement="${esc(s.id)}">核准追加報價</button>` : ''}</div>`).join('');
  if (landlord && w.status === 'awaiting_acceptance') content += `<button data-action="accept" data-order="${esc(w.id)}">驗收通過</button><form data-form="rework" data-order="${esc(w.id)}">${textarea('reason', '補修原因', true)}<button>退回補修</button></form>`;
  return content + '</article>';
}
function render() {
  if (!state.actor) {
    $('#identity').textContent = '尚未登入本機測試身份'; $('#navigation').replaceChildren();
    $('#content').innerHTML = `<section class="panel"><h2>本機合成身份</h2><form data-form="login">${select('principal', '本機測試身份', [
      ['landlord_a', '房東 A（合成）'], ['landlord_b', '房東 B（合成）'], ['company_a_manager', '公司 A 管理者（合成）'], ['company_a_worker', '公司 A 施工者（合成）'], ['company_b_worker', '公司 B 施工者（合成）'], ['individual_worker', '個人施工者（合成）'],
    ])}<button>進入本機工作台</button></form></section>`; return;
  }
  const landlord = state.actor.role === 'landlord';
  $('#identity').textContent = `${landlord ? '房東' : '合作廠商'} · ${state.actor.actor_id} · ${state.actor.workspace_id}`;
  $('#navigation').innerHTML = `<button data-tab="jobs" aria-current="${state.tab === 'jobs' ? 'page' : 'false'}">${landlord ? '工單總覽' : '我的工作'}</button>${landlord ? '<button data-tab="directory">合作設定</button>' : ''}<button data-tab="inbox">通知中心</button>`;
  let html = '<button class="secondary" id="refresh">重新讀取</button>';
  if (state.tab === 'directory' && landlord) html += directory();
  else if (state.tab === 'inbox') html += `<h2>本機通知中心</h2>${state.inbox.map(n => `<article><p>${esc(n.message)}</p><p>${esc(n.status)} · ${esc(n.at)}</p></article>`).join('') || '<p>尚無本機通知</p>'}`;
  else {
    html += `<h2>${landlord ? '工單總覽' : '我的邀請與工作'}</h2>`;
    if (landlord) html += `<details open class="panel"><summary>建立工作</summary><form id="job-create" data-form="create">${input('title', '工作標題')}${select('trade', '工種', trades)}${input('area', '必要區域')}${input('property_id', '物件代號', '', 'text', false)}${input('location', '核准作業位置', '', 'text', false)}${textarea('instructions', '核准作業指引')}<button>建立工作草稿</button></form></details>`;
    html += state.orders.map(orderCard).join('') || '<p>目前沒有工單。</p>';
  }
  $('#content').innerHTML = html;
}
function fields(form) { return Object.fromEntries(new FormData(form)); }
function quoteInput(f) { return { labor_twd: Number(f.labor_twd), materials_twd: Number(f.materials_twd), tax_twd: Number(f.tax_twd), estimated_days: Number(f.estimated_days), expires_at: new Date(f.expires_at).toISOString() }; }
function partnerInput(form, f) {
  const chosen = new FormData(form).getAll('trades');
  return { name: f.name, skills: chosen.map(trade => ({ trade, name: trade === 'other' ? f.skill_name || '其他工種' : trades.find(t => t[0] === trade)[1] })), service_areas: f.service_areas.split(/[、,，]/).map(v => v.trim()).filter(Boolean) };
}
async function upload(form, w) {
  const file = form.elements.file.files[0];
  if (!file || file.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) { feedback('未上傳：只接受 JPEG、PNG、WebP、PDF，且最多 10 MiB。', true); return; }
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
    committed = true; state.progress.set(w.id, 100); await readAll(w.id); feedback('已保存並讀回私有附件。');
  } catch (error) {
    state.progress.set(w.id, 0); form.querySelector('progress').value = 0; clearUnauthorized(error);
    if (error.uncertain || committed) {
      try { await readAll(w.id); feedback('附件回應結果不明；已讀回附件清單，請核對後再操作。未自動重送。', true); }
      catch (readError) { clearUnauthorized(readError); feedback('附件結果不明且讀回失敗；請重新讀取。未自動重送。', true); }
    } else feedback(`未上傳：${error.message}`, true);
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
        try { await readAll(); feedback('登入回應結果不明；已讀回本機 session 與工作清單，請核對目前身份。未自動重送。', true); }
        catch (readError) { clearUnauthorized(readError); feedback('登入結果不明且 session 讀回失敗。請重新讀取確認。未自動重送。', true); }
      } finally { lock(false); }
      return;
    }
    if (kind === 'upload') { await upload(form, w); return; }
    let path, body, method = 'POST';
    if (kind === 'create') { path = '/api/work-orders'; body = { title: f.title, trade: f.trade, area: f.area, location: f.location, instructions: f.instructions, ...(f.property_id ? { property_id: f.property_id } : {}) }; }
    if (kind === 'partner-create') { path = '/api/partners'; body = { ...partnerInput(form, f), type: f.type }; }
    if (kind === 'partner-update') { path = `/api/partners/${id(form.dataset.partner)}`; method = 'PATCH'; body = { ...partnerInput(form, f), active: f.active === 'true' }; }
    if (kind === 'member-create') { path = `/api/partners/${id(form.dataset.partner)}/memberships`; body = { actor_id: f.actor_id, member_role: f.member_role }; }
    if (kind === 'priority') { path = '/api/priority-rules'; method = 'PUT'; body = { property_id: f.property_id, trade: f.trade, rules: Object.entries(f).filter(([k, v]) => k.startsWith('rank:') && v !== '').map(([k, v]) => ({ partner_id: k.slice(5), rank: Number(v) })) }; }
    if (kind === 'agreement') { path = '/api/service-agreements'; body = { partner_id: f.partner_id, title: f.title, trade: f.trade, property_id: f.property_id, price_twd: Number(f.price_twd), starts_at: new Date(f.starts_at).toISOString(), ends_at: new Date(f.ends_at).toISOString() }; }
    if (kind === 'invite') { path = `/api/work-orders/${id(w.id)}/invitations`; body = { ...version, mode: f.mode, reply_hours: Number(f.reply_hours), continue_round: f.continue_round === 'on', ...(f.mode === 'manual' ? { partner_id: f.partner_id } : {}), ...(f.mode === 'parallel' ? { partner_ids: new FormData(form).getAll('partner_ids') } : {}), ...(f.agreement_id ? { agreement_id: f.agreement_id } : {}) }; }
    if (kind === 'quote') { path = `/api/invitations/${id(form.dataset.invitation)}/quote`; body = { ...version, ...quoteInput(f) }; }
    if (kind === 'completion') { path = `/api/assignments/${id(w.assignment.id)}/completion`; body = { ...version, description: f.description, actual_amount_twd: Number(f.actual_amount_twd), attachment_ids: (w.attachments || []).map(a => a.id) }; }
    if (kind === 'supplement') { path = `/api/assignments/${id(w.assignment.id)}/supplements`; body = { ...version, ...quoteInput(f), reason: f.reason }; }
    if (kind === 'rework') { path = `/api/work-orders/${id(w.id)}/acceptance`; body = { ...version, decision: 'rework', reason: f.reason }; }
    if (path) await write(path, body, method, w?.id);
  } catch (error) { clearUnauthorized(error); feedback(`操作失敗：${error.message}。請重新讀取確認。`, true); lock(false); }
});
document.addEventListener('click', async event => {
  const button = event.target.closest('button'); if (!button || state.busy) return;
  if (button.dataset.tab) { state.tab = button.dataset.tab; render(); $('#page').scrollTop = 0; return; }
  if (button.id === 'refresh') {
    lock(true); try { await readAll(); feedback('已讀取伺服器保存狀態。'); } catch (error) { clearUnauthorized(error); feedback(`讀取失敗：${error.message}`, true); } finally { lock(false); } return;
  }
  const action = button.dataset.action; if (!action) return;
  const w = state.orders.find(w => w.id === button.dataset.order); if (!w) return;
  let path, body = { expected_version: w.version };
  if (['approve', 'reject'].includes(action)) { const q = w.quotes.find(q => q.id === button.dataset.quote); path = `/api/work-orders/${id(w.id)}/quote-approval`; Object.assign(body, { quote_id: q.id, quote_version: q.version, decision: action === 'approve' ? 'approve' : 'reject' }); }
  if (action === 'accept-fixed') { const invitation = w.invitations.find(i => i.id === button.dataset.invitation); path = `/api/assignments/${id(invitation.assignment_id)}/accept`; }
  if (action === 'decline') path = `/api/invitations/${id(button.dataset.invitation)}/decline`;
  if (action === 'start') path = `/api/assignments/${id(w.assignment.id)}/start`;
  if (action === 'accept') { path = `/api/work-orders/${id(w.id)}/acceptance`; body.decision = 'accept'; }
  if (action === 'approve-supplement') { const s = w.supplements.find(s => s.id === button.dataset.supplement); path = `/api/work-orders/${id(w.id)}/supplement-approval`; Object.assign(body, { supplement_id: s.id, supplement_version: s.version }); }
  if (path) await write(path, body, 'POST', w.id);
});
readAll().then(() => feedback('已讀取本機保存狀態。')).catch(error => { clearUnauthorized(error); render(); feedback(error.code === 'SESSION_REQUIRED' ? '請選擇本機合成身份登入。' : `讀取失敗：${error.message}`, error.code !== 'SESSION_REQUIRED'); });
