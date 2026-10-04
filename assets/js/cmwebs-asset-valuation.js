(function (root) {
  'use strict';
  const rates = [2, 3, 4, 4.5];
  const colors = ['#246bfd', '#09a77b', '#725ac1', '#eb9a38', '#d65878', '#37899b', '#597bbf', '#5c9d51', '#b782ba', '#be7a57', '#8594ad', '#bfac38'];
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const money = value => value === null ? '—' : 'NT$ ' + Math.round(value).toLocaleString('zh-TW');

  function basis(rows, mode, year, includePartial) {
    if (mode === 'highest') {
      const row = rows.reduce((best, value) => !best || value.collected > best.collected ? value : best, null);
      return { row, label: row ? '最高年度營收 · ' + row.year : '最高年度營收', years: row ? [row.year] : [] };
    }
    if (mode === 'average') {
      const eligible = rows.filter(row => includePartial || row.recorded_months === 12);
      return { row: eligible.length ? { collected: eligible.reduce((sum, row) => sum + row.collected, 0) / eligible.length } : null,
        label: '平均年度營收 · ' + eligible.length + ' 年', years: eligible.map(row => row.year) };
    }
    return { row: rows.find(row => row.year === year) || null, label: year + ' 年已確認實收', years: [year] };
  }

  function calculate(row, rate, expense) {
    if (!rates.includes(Number(rate))) throw new Error('Invalid rate');
    const income = Number(row.collected);
    if (!Number.isFinite(income) || income < 0) throw new Error('Invalid income');
    const hasExpense = expense !== undefined && expense !== null && String(expense).trim() !== '';
    const cost = hasExpense ? Number(expense) : null;
    if (hasExpense && (!Number.isFinite(cost) || cost < 0)) throw new Error('Invalid expense');
    const net = hasExpense ? income - cost : null;
    return { income, net_income: net, gross_value: income > 0 ? income / (Number(rate) / 100) : null,
      net_value: net !== null && net > 0 ? net / (Number(rate) / 100) : null };
  }

  function chart(rows, key, label, bars) {
    if (!rows.length) return '<p class="av-note">沒有年度資料。</p>';
    const max = Math.max(1, ...rows.map(row => Number(row[key]) || 0));
    const span = Math.max(1, rows[rows.length - 1].year - rows[0].year + 1);
    const slot = 550 / span;
    const points = rows.filter(row => typeof row[key] === 'number' && Number.isFinite(row[key])).map(row => ({ x: 64 + slot * (row.year - rows[0].year + .5), y: 186 - (row[key] / max) * 140, row }));
    const segments = [];
    points.forEach((point, i) => {
      if (!i || point.row.year !== points[i - 1].row.year + 1) segments.push([]);
      segments[segments.length - 1].push(point);
    });
    const ticks = [0, .5, 1].map(ratio => '<line x1="64" x2="620" y1="' + (186 - ratio * 140) + '" y2="' + (186 - ratio * 140) + '" stroke="#e3eaf3"/><text x="58" y="' + (190 - ratio * 140) + '" text-anchor="end" font-size="10" fill="#6b778c">' + (max * ratio / 10000).toFixed(1) + '萬</text>').join('');
    const series = bars ? points.map(p => '<rect x="' + (p.x - slot * .29) + '" y="' + p.y + '" width="' + slot * .58 + '" height="' + (186 - p.y) + '" rx="3" fill="#246bfd"><title>' + escape(p.row.year) + '：' + money(p.row[key]) + '</title></rect>').join('') : segments.filter(segment => segment.length > 1).map(segment => '<polyline points="' + segment.map(p => p.x + ',' + p.y).join(' ') + '" fill="none" stroke="#09a77b" stroke-width="3"/>').join('') + points.map(p => '<circle cx="' + p.x + '" cy="' + p.y + '" r="4" fill="#09a77b"><title>' + escape(p.row.year) + '：' + money(p.row[key]) + '</title></circle>').join('');
    return '<svg viewBox="0 0 640 220" role="img" aria-label="' + escape(label) + '">' + ticks + series + points.map(p => '<text x="' + p.x + '" y="210" text-anchor="middle" font-size="10" fill="#6b778c">' + escape(p.row.year) + '</text>').join('') + '</svg>';
  }

  function pie(months) {
    const total = months.reduce((sum, row) => sum + row.collected, 0);
    if (total <= 0) return '<p class="av-note">本年沒有已確認實收，無法繪製比例。</p>';
    let offset = 0;
    const arcs = months.map(row => {
      const index = Number(row.month.slice(5)) - 1;
      const share = row.collected / total;
      const segment = '<circle cx="100" cy="100" r="66" fill="none" stroke="' + colors[index] + '" stroke-width="28" pathLength="100" stroke-dasharray="' + share * 100 + ' ' + (100 - share * 100) + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 100 100)"><title>' + escape(row.month) + '：' + money(row.collected) + '</title></circle>';
      offset += share * 100;
      return segment;
    }).join('');
    return '<div class="av-pie"><svg viewBox="0 0 200 200" role="img" aria-label="所選年度每月實收比例">' + arcs + '<text x="100" y="97" text-anchor="middle" fill="#152238" font-size="15">月份收入</text><text x="100" y="117" text-anchor="middle" fill="#6b778c" font-size="12">實收占比</text></svg><ul>' + months.map(row => '<li><i style="background:' + colors[Number(row.month.slice(5)) - 1] + '"></i>' + escape(row.month) + ' <span>' + money(row.collected) + '</span></li>').join('') + '</ul></div>';
  }

  function mount(element, rows) {
    if (!element) return;
    if (!Array.isArray(rows)) { element.innerHTML = '<section class="card section"><h2>資產收益估值</h2><p class="av-note">目前後端尚未提供年度資料；不以近 12 個月假裝歷年收益。</p></section>'; return; }
    if (!rows.length) { element.innerHTML = '<section class="card section"><h2>資產收益估值</h2><p class="av-note">目前沒有可用的歷年收入資料。</p></section>'; return; }
    let rate = 2;
    let mode = 'highest';
    let includePartial = false;
    let selected = rows[rows.length - 1].year;
    const expenses = {};
    element.innerHTML = '<section class="card section av"><div class="eyebrow">INCOME → ASSET</div><h2>資產收益估值</h2><p class="av-note">以各年已確認實收反推收益情境。含管理費、電費等帳單收入，並非純租金；未扣成本時不是淨收益估價。</p><div class="av-rates" role="group" aria-label="估值收益率">' + rates.map(value => '<button type="button" data-rate="' + value + '" aria-pressed="' + (value === rate) + '">' + value + '%</button>').join('') + '</div><div class="av-controls"><label>選擇年度<select data-year>' + rows.map(row => '<option value="' + row.year + '"' + (row.year === selected ? ' selected' : '') + '>' + row.year + '</option>').join('') + '</select></label><label><span data-cost-label>年度營運成本（NT$）</span><input data-expense type="number" min="0" step="any" inputmode="decimal" placeholder="選填，空白不推算淨值"></label></div><p data-error role="alert" class="av-error"></p><div data-result aria-live="polite"></div><p class="av-note">年度實收 ÷ 所選收益率。僅為情境估算，非市場成交價或正式鑑價；不自動年化。帳單月份歸屬不代表實際銀行入帳日期。</p><div data-charts></div><details><summary>查看每年收入與估值明細</summary><div data-table class="table-wrap"></div></details></section>';
    const costInput = element.querySelector('[data-expense]');
    const controls = element.querySelector('.av-controls');
    controls.insertAdjacentHTML('beforebegin', '<div class="av-rates" role="group" aria-label="估值營收基準"><button type="button" data-basis="highest">最高年度營收</button><button type="button" data-basis="average">平均年度營收</button><button type="button" data-basis="year">指定年度</button></div><label class="av-note"><input type="checkbox" data-partial> 平均值包含不足 12 個有紀錄月份的年份</label><p class="av-note">營運成本僅供本次瀏覽試算，切換基準分開保存，重新載入不保留。</p>');
    function expenseKey() { return mode + ':' + (mode === 'year' ? selected : mode === 'average' ? includePartial : basis(rows, mode, selected).row.year); }
    function update() {
      const row = rows.find(value => value.year === selected);
      const chosen = basis(rows, mode, selected, includePartial);
      const error = element.querySelector('[data-error]');
      let result;
      const unavailable = { income: null, gross_value: null, net_value: null, net_income: null };
      try {
        if (costInput.validity && costInput.validity.badInput) throw new Error('Invalid expense');
        result = chosen.row ? calculate(chosen.row, rate, expenses[expenseKey()]) : unavailable;
        error.textContent = ''; costInput.removeAttribute('aria-invalid');
      } catch (failure) { error.textContent = '請輸入 0 或正數的年度營運成本。'; costInput.setAttribute('aria-invalid', 'true'); result = chosen.row ? calculate(chosen.row, rate, '') : unavailable; }
      const warning = mode === 'average'
        ? (chosen.years.length ? '平均涵蓋：' + chosen.years.join('、') + '。' + (includePartial ? '包含不完整年度，不年化。' : '只含 12 個月有紀錄的年份。') : '沒有 12 個月都有紀錄的年份；不產生平均估值。')
        : '有紀錄 ' + chosen.row.recorded_months + '／12 月。' + (chosen.row.recorded_months < 12 ? '非完整年度，不自動補足或年化。' : '12 個有紀錄月份不等於全部帳單已完整對帳。');
      const allocated = mode === 'average' ? rows.filter(value => chosen.years.includes(value.year)).reduce((sum, value) => sum + (value.allocated_bill_count || 0), 0) : chosen.row.allocated_bill_count;
      element.querySelector('[data-result]').innerHTML = '<div class="av-metrics"><div><small>' + escape(chosen.label) + '</small><strong>' + money(result.income) + '</strong></div><div><small>' + rate + '% 毛收益情境估值</small><strong data-gross>' + money(result.gross_value) + '</strong></div><div><small>扣該基準年度成本後淨收益情境估值</small><strong data-net>' + money(result.net_value) + '</strong></div></div><p class="av-warning">' + escape(warning) + (allocated ? ' 含 ' + allocated + ' 筆人工分配資料。' : '') + ' 資料完整性仍須核對。缺失年份不補零、曲線不跨缺年連接。' + (result.net_income !== null && result.net_income <= 0 ? ' 淨收益非正數，不產生正資產估值。' : '') + '</p>';
      const modeled = rows.map(value => ({ ...value, ...calculate(value, rate, '') }));
      element.querySelector('[data-charts]').innerHTML = '<div class="av-chart-grid"><article><h3>每年實收 · 柱狀圖</h3>' + chart(modeled, 'income', '各年已確認實收柱狀圖', true) + '</article><article><h3>每年實收 · 高低曲線</h3>' + chart(modeled, 'income', '各年已確認實收曲線', false) + '</article><article><h3>毛收益情境估值 · ' + rate + '%</h3>' + chart(modeled, 'gross_value', '各年毛收益情境估值曲線', false) + '</article><article><h3>' + selected + ' 年 · 月份圓餅圖</h3>' + pie(row.months || []) + '</article></div>';
      element.querySelector('[data-table]').innerHTML = '<table><thead><tr><th>年度</th><th>實收</th><th>情境估值 ' + rate + '%</th><th>有紀錄月份</th></tr></thead><tbody>' + modeled.map(value => '<tr><td>' + value.year + '</td><td>' + money(value.income) + '</td><td>' + money(value.gross_value) + '</td><td>' + value.recorded_months + '／12</td></tr>').join('') + '</tbody></table>';
      element.querySelectorAll('[data-rate]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.rate) === rate)));
      element.querySelectorAll('[data-basis]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.basis === mode)));
      const costLabel = mode === 'average' ? '平均年度營運成本（NT$；涵蓋 ' + (chosen.years.join('、') || '無完整年份') + '）' : chosen.label + '的年度營運成本（NT$）';
      element.querySelector('[data-cost-label]').textContent = costLabel;
      costInput.setAttribute('aria-label', costLabel);
    }
    element.querySelectorAll('[data-rate]').forEach(button => button.addEventListener('click', () => { rate = Number(button.dataset.rate); update(); }));
    element.querySelectorAll('[data-basis]').forEach(button => button.addEventListener('click', () => { mode = button.dataset.basis; costInput.value = expenses[expenseKey()] || ''; update(); }));
    element.querySelector('[data-partial]').addEventListener('change', event => { includePartial = event.target.checked; costInput.value = expenses[expenseKey()] || ''; update(); });
    element.querySelector('[data-year]').addEventListener('change', event => { selected = Number(event.target.value); costInput.value = expenses[expenseKey()] || ''; update(); });
    costInput.addEventListener('input', () => { expenses[expenseKey()] = costInput.value; update(); });
    update();
  }
  root.CMWebsAssetValuation = { calculate, basis, mount };
})(globalThis);
