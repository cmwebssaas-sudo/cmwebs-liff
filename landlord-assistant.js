/**
 * 房東助理：功能目錄與「找功能」搜尋。
 * 目錄是助理回答的唯一依據；之後接 AI 時，AI 也只能從這裡挑功能。
 * 每一項都要有可前往的頁面，tests/landlord-assistant.test.mjs 會檢查。
 */
(function () {
  const CATALOG = [
    {
      id: 'new_tenant',
      title: '新增房客並建立合約',
      keywords: ['新增房客', '新房客', '新租客', '新增合約', '建立合約', '新合約', '簽約', '租出去', '有人要租'],
      steps: [
        '到「更多」按「快速建立租約」，或在「房客」頁按「＋ 新增房客」。',
        '選擇房間，確認租金、管理費與租期。',
        '按「建立租約並產生簽署邀請」。',
        '把畫面上的邀請訊息（含確認碼）複製後用 LINE 傳給房客。',
        '房客簽完後，到「合約申請管理」審核並核准生效。'
      ],
      link: { page: 'landlord-tenant-create.html?mode=new', label: '前往快速建立租約' }
    },
    {
      id: 'paper_backfill',
      title: '補登已簽好的紙本合約',
      keywords: ['紙本', '補登', '舊合約', '已經簽好', '紙本合約'],
      steps: [
        '到「物件與房間」，在房間上按「手動補登紙本合約」；已有房客資料時，也可在房客詳細資料裡按。',
        '填寫房客與租約資料，上傳舊合約照片。',
        '按「確認補登紙本合約」。'
      ],
      link: { page: 'landlord-properties.html', label: '前往物件與房間' }
    },
    {
      id: 'renewal',
      title: '續約（合約快到期）',
      keywords: ['續約', '到期', '合約到期', '延長', '再租', '續租', '快速續約'],
      steps: [
        '到「房客」頁，合約快到期或已到期的房客會有「快速續約」按鈕；也可以在房客詳細資料按「發起續約」。',
        '確認新的租期、租金與條件後建立。',
        '房客有綁定 LINE 時，系統會自動把簽約邀請發到房客的 LINE；沒綁定時，請把畫面上的邀請訊息（含確認碼）複製後傳給房客。',
        '房客名單會顯示「續約待簽署」；房客簽完後，到「合約申請管理」核准生效。簽署邀請 24 小時內有效。'
      ],
      link: { page: 'landlord-tenants.html', label: '前往房客名單' }
    },
    {
      id: 'reissue_invite',
      title: '重傳簽署邀請（連結或確認碼不見、過期）',
      keywords: ['重傳', '重新傳', '重新產生', '邀請過期', '確認碼', '連結不見', '忘了複製', '簽署連結', '邀請連結'],
      steps: [
        '到「更多」→「合約申請管理」，找到那個房號的卡片。',
        '按「重新產生邀請」，舊的連結會立即失效。',
        '房客有綁定 LINE 時，系統會自動把新的邀請發到房客的 LINE。',
        '沒綁定時，在跳出的視窗按「複製邀請訊息（含確認碼）」，貼到 LINE 傳給房客。新邀請 24 小時內有效。'
      ],
      link: { page: 'landlord-contract-requests.html', label: '前往合約申請管理' }
    },
    {
      id: 'signing_status',
      title: '查看房客有沒有簽約、核准合約',
      keywords: ['簽了沒', '有沒有簽', '簽名', '簽約進度', '待審核', '核准', '審核合約', '回傳'],
      steps: [
        '到「更多」→「合約申請管理」。',
        '房客簽完名，卡片會變成「待審核」。',
        '按進去看過內容與簽名，按核准後新租約才生效。'
      ],
      link: { page: 'landlord-contract-requests.html', label: '前往合約申請管理' }
    },
    {
      id: 'checkout',
      title: '房客退房、退租',
      keywords: ['退房', '退租', '搬走', '搬家', '不續約', '解約', '押金', '結算'],
      steps: [
        '到「房客」頁，找到房客按「查看房客資料」。',
        '按「辦理退房」，系統會帶入這位房客的合約。',
        '選「完整電表結算」或「快速結案」，上傳房間照片。',
        '確認結算內容後送出。'
      ],
      link: { page: 'landlord-tenants.html', label: '前往房客名單' }
    },
    {
      id: 'confirm_payment',
      title: '核對入帳、確認銷帳',
      keywords: ['入帳', '轉帳', '匯款', '付款回報', '銷帳', '對帳', '入帳通知', '確認收款'],
      steps: [
        '到「更多」→「付款回報審核」。',
        '在「銀行入帳通知」核對金額、末五碼與配對到的帳單。',
        '正確就按「確認銷帳」；配錯了按「配對有誤」改選帳單。'
      ],
      link: { page: 'landlord-payment-report-review.html', label: '前往付款回報審核' }
    },
    {
      id: 'manual_settle',
      title: '手動確認已繳（現金、私下轉帳）',
      keywords: ['手動銷帳', '手動確認', '現金', '已經繳了', '收到錢', '收現金', '已繳'],
      steps: [
        '到「欠款」頁，找到那一張帳單。',
        '按「手動確認已繳」，填付款日期與方式。',
        '按「確認已繳並銷帳」。'
      ],
      link: { page: 'landlord-arrears.html', label: '前往欠款' }
    },
    {
      id: 'reminder',
      title: '查看誰沒繳、催繳',
      keywords: ['催繳', '提醒繳費', '欠款', '沒繳', '未繳', '逾期', '欠錢', '繳費提醒'],
      steps: [
        '到「欠款」頁查看未繳的房間、金額與繳費月曆。',
        '要個別提醒：在房客詳細資料按「傳送繳費提醒」。',
        '自動催繳的時間與天數在「系統設定」調整。'
      ],
      link: { page: 'landlord-arrears.html', label: '前往欠款' }
    },
    {
      id: 'undo_settle',
      title: '銷錯帳、恢復成未繳',
      keywords: ['誤銷帳', '銷錯', '取消銷帳', '恢復未繳', '銷帳錯誤'],
      steps: [
        '到「更多」→「已繳帳單」。',
        '找到那一張帳單，依畫面指示恢復成未繳。'
      ],
      link: { page: 'landlord-paid-bills.html', label: '前往已繳帳單' }
    },
    {
      id: 'meter_billing',
      title: '抄表、開立帳單',
      keywords: ['抄表', '電表', '度數', '開帳單', '建立帳單', '電費', '本月帳單'],
      steps: [
        '到「更多」→「帳單管理」。',
        '輸入每間房本期的電表度數，可用「批次抄表」。',
        '勾選房間後按「建立／更新所選帳單」。'
      ],
      link: { page: 'landlord-billing.html', label: '前往帳單與抄表' }
    },
    {
      id: 'send_bills',
      title: '用 LINE 傳帳單給房客',
      keywords: ['傳帳單', '發帳單', '帳單通知', '寄帳單', '傳送帳單'],
      steps: [
        '到「更多」→「LINE 帳單通知」。',
        '勾選要通知的房客，可先按「預覽 LINE 訊息」。',
        '按「發送所選通知」。'
      ],
      link: { page: 'landlord-bill-notifications.html', label: '前往 LINE 帳單通知' }
    },
    {
      id: 'announcement',
      title: '發公告給房客',
      keywords: ['公告', '通知大家', '通知全部', '停水', '停電', '群發', '大樓通知'],
      steps: [
        '到「更多」→「公告發送」。',
        '寫好內容、選擇要通知的房客。',
        '按「立即發送公告」，之後可看送達明細。'
      ],
      link: { page: 'landlord-announcements.html', label: '前往公告發送' }
    },
    {
      id: 'checkin',
      title: '房客報到、交鑰匙',
      keywords: ['報到', '入住', '交鑰匙', '鑰匙', '搬進來'],
      steps: [
        '到「更多」→「房客報到管理」。',
        '找到房客按「管理報到」，填寫入住與鑰匙交接。',
        '按「儲存報到資料」。'
      ],
      link: { page: 'landlord-tenant-checkin.html', label: '前往房客報到管理' }
    },
    {
      id: 'property_room',
      title: '新增或修改物件、房間',
      keywords: ['新增房間', '新增物件', '房間設定', '改租金', '房間資料', '新房子', '封存房間'],
      steps: [
        '到「物件與房間」。',
        '按「＋ 新增物件」或「＋ 新增房間」；修改請按「編輯」。',
        '按「儲存物件」或「儲存房間」。'
      ],
      link: { page: 'landlord-properties.html', label: '前往物件與房間' }
    },
    {
      id: 'tenant_binding',
      title: '邀請房客綁定 LINE',
      keywords: ['綁定', '沒綁定', '未綁定', '收不到', '房客收不到通知', '加入 LINE'],
      steps: [
        '到「房客」頁，篩選「未綁定 LINE」。',
        '按房客的「邀請綁定」，把綁定訊息傳給房客。'
      ],
      link: { page: 'landlord-tenants.html', label: '前往房客名單' }
    },
    {
      id: 'tenant_messages',
      title: '房客訊息、報修',
      keywords: ['訊息', '報修', '房客問題', '回覆房客', '修理', '壞掉'],
      steps: [
        '到「更多」→「房客訊息管理」查看與回覆。',
        '要直接傳訊息給某位房客：在房客詳細資料按「自訂 LINE 訊息」。'
      ],
      link: { page: 'landlord-messages.html', label: '前往房客訊息管理' }
    },
    {
      id: 'contract_documents',
      title: '查看或下載合約文件',
      keywords: ['合約文件', '看合約', '合約內容', '下載合約', '列印合約', '簽名檔'],
      steps: [
        '到「更多」→「文件總覽」，或在房客詳細資料按「查看完整合約與簽名」。',
        '可以預覽、列印或分享。'
      ],
      link: { page: 'landlord-contract-documents.html', label: '前往文件總覽' }
    },
    {
      id: 'revenue',
      title: '營收與報表',
      keywords: ['營收', '收入', '報表', '收益', '資產'],
      steps: ['到「更多」→「營收與資產」查看每月收入與趨勢。'],
      link: { page: 'landlord-revenue-dashboard.html', label: '前往營收與資產' }
    },
    {
      id: 'team',
      title: '新增管理團隊成員、設定權限',
      keywords: ['團隊', '員工', '管理員', '成員', '權限', '邀請同事', '助理'],
      steps: [
        '到「更多」→「團隊與權限」。',
        '按「＋ 建立邀請」，選擇角色。',
        '按「分享邀請連結」傳給對方。'
      ],
      link: { page: 'landlord-team.html', label: '前往團隊與權限' }
    },
    {
      id: 'settings',
      title: '收款帳號、自動催繳與帳務預設',
      keywords: ['設定', '收款帳號', '銀行帳號', '匯款帳號', '自動催繳', '繳費日', '押金月數', '夏月', '通知設定'],
      steps: [
        '到「更多」→「系統設定」。',
        '收款帳號、帳務預設、通知偏好各有自己的區塊與儲存按鈕。'
      ],
      link: { page: 'landlord-settings.html', label: '前往系統設定' }
    }
  ];

  function normalize(text) {
    return String(text == null ? '' : text)
      .toLowerCase()
      .replace(/[\s，。？！、,.?!「」『』（）()：:；;]/g, '')
      .replace(/臺/g, '台');
  }

  function bigrams(text) {
    const grams = new Set();
    for (let i = 0; i < text.length - 1; i++) grams.add(text.slice(i, i + 2));
    return grams;
  }

  function scoreItem(item, query) {
    let score = 0;
    const terms = [item.title].concat(item.keywords);
    terms.forEach(function (term) {
      const key = normalize(term);
      if (!key) return;
      if (query.indexOf(key) >= 0) score += 10 + key.length;
      else if (key.indexOf(query) >= 0 && query.length >= 2) score += 6;
    });
    const queryGrams = bigrams(query);
    const itemGrams = bigrams(normalize(terms.join('')));
    queryGrams.forEach(function (gram) {
      if (itemGrams.has(gram)) score += 1;
    });
    return score;
  }

  function search(text, limit) {
    const query = normalize(text);
    if (!query) return [];
    return CATALOG
      .map(function (item) { return { item: item, score: scoreItem(item, query) }; })
      .filter(function (entry) { return entry.score >= 3; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, limit || 3)
      .map(function (entry) { return entry.item; });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderResults(items, query) {
    if (!normalize(query)) {
      return '<div class="assistant-hint">例如：「怎麼新增房客」「房客要退房」「續約邀請要重傳」「誰還沒繳」</div>';
    }
    if (!items.length) {
      return '<div class="assistant-hint">找不到相符的功能。可以換個說法，或直接看下方的功能列表。</div>';
    }
    return items.map(function (item) {
      return '<article class="assistant-result">' +
        '<div class="assistant-result-title">' + escapeHtml(item.title) + '</div>' +
        '<ol class="assistant-steps">' + item.steps.map(function (step) {
          return '<li>' + escapeHtml(step) + '</li>';
        }).join('') + '</ol>' +
        '<button class="assistant-go" type="button" data-page="' + escapeHtml(item.link.page) + '">' +
        escapeHtml(item.link.label) + ' ›</button>' +
        '</article>';
    }).join('');
  }

  // ===== 對話視窗：每頁右下角的 AI 小圓鈕 =====
  // 對話只存在這支手機（localStorage），一天後或登出時清掉；按「前往」後回來可以接著問。
  const CHAT_KEY = 'cmwebs_landlord_assistant_chat_v1';
  const CHAT_TTL_MS = 24 * 60 * 60 * 1000;
  const CHAT_MAX = 30;

  function loadChat(now) {
    try {
      const saved = JSON.parse(window.localStorage.getItem(CHAT_KEY) || 'null');
      if (saved && Array.isArray(saved.messages) && now - Number(saved.savedAt || 0) < CHAT_TTL_MS) {
        return { open: saved.open === true, messages: saved.messages.slice(-CHAT_MAX) };
      }
    } catch (error) { /* 私密模式或存取被擋時，就從空白開始 */ }
    return { open: false, messages: [] };
  }

  function saveChat(chat, now) {
    try {
      window.localStorage.setItem(CHAT_KEY, JSON.stringify({
        savedAt: now, open: chat.open, messages: chat.messages.slice(-CHAT_MAX)
      }));
    } catch (error) { /* 存不了也不影響這一頁使用 */ }
  }

  function clearChat() {
    try { window.localStorage.removeItem(CHAT_KEY); } catch (error) { /* 忽略 */ }
  }

  function itemCard(item) {
    return '<article class="cma-card">' +
      '<div class="cma-card-title">' + escapeHtml(item.title) + '</div>' +
      '<ol class="cma-steps">' + item.steps.map(function (step) {
        return '<li>' + escapeHtml(step) + '</li>';
      }).join('') + '</ol>' +
      '<button class="cma-go" type="button" data-page="' + escapeHtml(item.link.page) + '">' +
      escapeHtml(item.link.label) + ' ›</button>' +
      '</article>';
  }

  function renderMessage(message) {
    if (message.role === 'user') {
      return '<div class="cma-row cma-me"><div class="cma-bubble">' + escapeHtml(message.text) + '</div></div>';
    }
    if (message.pending) {
      return '<div class="cma-row"><div class="cma-bubble cma-wait">助理思考中…</div></div>';
    }
    const items = (message.ids || []).map(function (id) {
      return CATALOG.find(function (entry) { return entry.id === id; });
    }).filter(Boolean);
    const text = message.reply || (items.length ? '可以這樣做：' : '我找不到相符的功能，可以換個說法再問一次，或到「更多」看全部功能。');
    return '<div class="cma-row"><div class="cma-bubble">' + escapeHtml(text) + '</div></div>' +
      items.map(itemCard).join('');
  }

  // 問一題：AI 選到目錄內功能就用 AI 的回答；AI 回 none、忙碌或連不上就改用關鍵字結果。
  async function answer(question) {
    const api = window.CMWebsLandlordApi;
    const keywordIds = search(question, 2).map(function (item) { return item.id; });
    if (!api || typeof api.askAssistant !== 'function') return { role: 'assistant', reply: '', ids: keywordIds };
    try {
      const result = await api.askAssistant(question, CATALOG);
      const chosen = CATALOG.some(function (entry) { return entry.id === result.id; }) ? [result.id] : keywordIds;
      return { role: 'assistant', reply: String(result.reply || '').slice(0, 1500), ids: chosen };
    } catch (error) {
      return { role: 'assistant', reply: '', ids: keywordIds };
    }
  }

  function openChat() {
    if (window.CMWEBS_LANDLORD_ASSISTANT_CHAT) window.CMWEBS_LANDLORD_ASSISTANT_CHAT.open();
  }

  function mountChat(doc, clock) {
    const now = clock || Date.now;
    if (!doc.body || doc.getElementById('cmaFab')) return null;
    const chat = loadChat(now());
    const fab = doc.createElement('button');
    fab.id = 'cmaFab';
    fab.className = 'cma-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', '打開 AI 助理');
    fab.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="6" y="9" width="20" height="16" rx="6"/>' +
      '<circle cx="12.5" cy="17" r="2.2"/><circle cx="19.5" cy="17" r="2.2"/><path d="M13 21.5h6"/>' +
      '<path d="M16 9V5.5"/><circle cx="16" cy="4.5" r="1.6"/><path d="M6 15H4M26 15h2"/></svg>';
    const panel = doc.createElement('section');
    panel.id = 'cmaPanel';
    panel.className = 'cma-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'AI 助理');
    panel.innerHTML =
      '<header class="cma-head"><strong>AI 助理</strong>' +
      '<button class="cma-clear" type="button">清除對話</button>' +
      '<button class="cma-close" type="button" aria-label="收起">✕</button></header>' +
      '<div class="cma-log" aria-live="polite"></div>' +
      '<form class="cma-form"><input class="cma-input" type="text" enterkeyhint="send" autocomplete="off" ' +
      'maxlength="200" placeholder="想做什麼？例如：房客要退房" aria-label="想問助理的問題" />' +
      '<button class="cma-send" type="submit">問</button></form>';
    doc.body.appendChild(fab);
    doc.body.appendChild(panel);
    const log = panel.querySelector('.cma-log');
    const input = panel.querySelector('.cma-input');
    const greeting = '<div class="cma-row"><div class="cma-bubble">你好！想做什麼直接問我，例如「怎麼新增房客」「房客要退房」「誰還沒繳」。按「前往」去操作後，再點右下角的機器人就能回到這裡接著問。</div></div>';

    function render() {
      log.innerHTML = greeting + chat.messages.map(renderMessage).join('');
      log.scrollTop = log.scrollHeight;
      panel.classList.toggle('is-open', chat.open);
      fab.classList.toggle('is-hidden', chat.open);
    }
    function persist() {
      saveChat({ open: chat.open, messages: chat.messages.filter(function (m) { return !m.pending; }) }, now());
    }
    function setOpen(open) {
      chat.open = open;
      persist();
      render();
      if (open) setTimeout(function () { input.focus(); }, 50);
    }

    fab.addEventListener('click', function () { setOpen(true); });
    panel.querySelector('.cma-close').addEventListener('click', function () { setOpen(false); });
    panel.querySelector('.cma-clear').addEventListener('click', function () {
      chat.messages = [];
      persist();
      render();
    });
    panel.querySelector('.cma-form').addEventListener('submit', async function (event) {
      event.preventDefault();
      const question = String(input.value || '').trim();
      if (!question || chat.messages.some(function (m) { return m.pending; })) return;
      input.value = '';
      chat.messages.push({ role: 'user', text: question.slice(0, 200) });
      const pending = { role: 'assistant', pending: true };
      chat.messages.push(pending);
      render();
      const reply = await answer(question);
      chat.messages[chat.messages.indexOf(pending)] = reply;
      persist();
      render();
    });
    log.addEventListener('click', function (event) {
      const button = event.target.closest('.cma-go');
      if (!button) return;
      // 前往操作頁時先收起，對話留著；回來點 AI 就能接著問。
      chat.open = false;
      persist();
      const page = button.getAttribute('data-page');
      if (typeof window.goPage === 'function') window.goPage(page);
      else window.location.href = page;
    });
    render();
    const controller = { open: function () { setOpen(true); }, close: function () { setOpen(false); }, panel: panel, fab: fab };
    window.CMWEBS_LANDLORD_ASSISTANT_CHAT = controller;
    return controller;
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    const start = function () { mountChat(document); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }

  window.CMWEBS_LANDLORD_ASSISTANT = {
    catalog: CATALOG,
    search: search,
    renderResults: renderResults,
    answer: answer,
    renderMessage: renderMessage,
    mountChat: mountChat,
    loadChat: loadChat,
    saveChat: saveChat,
    openChat: openChat,
    clearChat: clearChat
  };
})();
