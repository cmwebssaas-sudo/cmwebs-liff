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

  function investmentReturns(rows, annualIncome, costs, expense) {
    const amounts = ['purchase', 'renovation', 'other'].map(key => {
      const raw = costs[key];
      if (raw === undefined || raw === null || String(raw).trim() === '') return key === 'other' ? 0 : null;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) throw new Error('Invalid investment');
      return value;
    });
    const invested = amounts.includes(null) ? null : amounts.reduce((sum, value) => sum + value, 0);
    if (invested !== null && !Number.isFinite(invested)) throw new Error('Invalid investment');
    const total = rows.reduce((sum, row) => {
      const value = Number(row.collected);
      if (!Number.isFinite(value) || value < 0) throw new Error('Invalid income');
      return sum + value;
    }, 0);
    if (!Number.isFinite(total)) throw new Error('Invalid income');
    const net = annualIncome === null ? null : calculate({ collected: annualIncome }, 2, expense).net_income;
    const percent = value => invested > 0 && value !== null && Number.isFinite(value / invested * 100) ? value / invested * 100 : null;
    return { total_collected: total, total_invested: invested, annual_gross_return: percent(annualIncome),
      cumulative_gross_return: percent(total), annual_net_return: percent(net) };
  }

  function saleScenario(estimate, invested, collected, inputs) {
    const read = (key, fallback = null) => {
      const raw = inputs[key];
      if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) throw new Error('Invalid sale input');
      return value;
    };
    const price = read('price', estimate);
    const costs = [read('tax'), read('agent'), read('other', 0)];
    const fees = costs.includes(null) ? null : costs.reduce((sum, value) => sum + value, 0);
    const operating = read('operating');
    const loan = read('loan');
    const netSale = price !== null && fees !== null ? price - fees : null;
    const profit = netSale !== null && invested !== null ? netSale - invested : null;
    const totalProfit = profit !== null && operating !== null ? profit + collected - operating : null;
    const cash = netSale !== null && loan !== null ? netSale - loan : null;
    const percent = value => invested > 0 && value !== null ? value / invested * 100 : null;
    const value = { sale_price: price, fees, net_sale: netSale, sale_profit: profit, sale_return: percent(profit),
      total_profit: totalProfit, total_return: percent(totalProfit), cash_received: cash };
    if (Object.values(value).some(number => number !== null && !Number.isFinite(number))) throw new Error('Invalid sale total');
    return value;
  }

  function saleChart(value, invested) {
    const points = [['總投入', invested], ['出售淨額', value.net_sale], ['出售獲利', value.sale_profit]].filter(([, amount]) => amount !== null);
    if (!points.length) return '';
    const max = Math.max(1, ...points.map(([, amount]) => Math.abs(amount)));
    return '<svg viewBox="0 0 640 240" role="img" aria-label="總投入、出售淨額與預估獲利比較"><line x1="32" x2="608" y1="120" y2="120" stroke="#8594ad"/>' + points.map(([label, amount], i) => {
      const height = Math.abs(amount) / max * 85;
      const x = 70 + i * 190;
      return '<g><title>' + escape(label + '：' + money(amount)) + '</title><rect class="av-mark" x="' + x + '" y="' + (amount >= 0 ? 120 - height : 120) + '" width="120" height="' + height + '" rx="4" fill="' + (amount < 0 ? '#c83c4a' : colors[i]) + '"/><text x="' + (x + 60) + '" y="220" text-anchor="middle" font-size="14">' + escape(label) + '</text><text x="' + (x + 60) + '" y="238" text-anchor="middle" font-size="12">' + escape(money(amount)) + '</text></g>';
    }).join('') + '</svg>';
  }

  function chart(rows, key, label, bars, reference = null) {
    if (!rows.length) return '<p class="av-note">沒有年度資料。</p>';
    const max = Math.max(1, reference || 0, ...rows.map(row => Number(row[key]) || 0));
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
    const interactive = series.replace(/<(rect|circle) /g, '<$1 class="av-mark" ').replace(/<polyline /g, '<polyline pathLength="1" ');
    // A group owns each visible mark and the larger transparent tap target.
    let index = 0;
    const marks = interactive.replace(/<(rect|circle)\b[\s\S]*?<\/\1>/g, mark => {
      const p = points[index++];
      return '<g role="button" tabindex="0" data-chart-year="' + p.row.year + '" aria-label="' + escape(p.row.year + ' 年，' + label + '，' + money(p.row[key]) + '，查看明細') + '">' + mark + '<rect x="' + (p.x - Math.max(12, slot * .3)) + '" y="' + (bars ? Math.min(p.y, 162) : p.y - 12) + '" width="' + Math.max(24, slot * .6) + '" height="' + (bars ? Math.max(24, 186 - p.y) : 24) + '" fill="transparent"/></g>';
    });
    const extrema = points.length ? '<p class="av-note">最高：' + money(Math.max(...points.map(p => p.row[key]))) + ' · 最低：' + money(Math.min(...points.map(p => p.row[key]))) + '</p>' : '';
    const referenceLine = reference === null ? '' : '<line x1="64" x2="620" y1="' + (186 - reference / max * 140) + '" y2="' + (186 - reference / max * 140) + '" stroke="#eb9a38" stroke-width="2" stroke-dasharray="6 4"><title>總投入成本：' + money(reference) + '</title></line>';
    return '<svg viewBox="0 0 640 220" role="group" aria-label="' + escape(label) + '">' + ticks + marks + referenceLine + points.map(p => '<text x="' + p.x + '" y="210" text-anchor="middle" font-size="10" fill="#6b778c">' + escape(p.row.year) + '</text>').join('') + '</svg>' + extrema + (reference === null ? '' : '<p class="av-note">橘色虛線 · 總投入成本：' + money(reference) + '；綠色曲線 · 收益情境估值（不是已實現獲利）。</p>');
  }

  function pie(months) {
    const total = months.reduce((sum, row) => sum + row.collected, 0);
    if (total <= 0) return '<p class="av-note">本年沒有已確認實收，無法繪製比例。</p>';
    let offset = 0;
    const arcs = months.map(row => {
      const index = Number(row.month.slice(5)) - 1;
      const share = row.collected / total;
      const point = (radius, angle) => [100 + radius * Math.cos(angle), 100 + radius * Math.sin(angle)].join(' ');
      const start = offset / 100 * Math.PI * 2 - Math.PI / 2;
      const end = start + share * Math.PI * 2;
      const large = share > .5 ? 1 : 0;
      const path = share >= 1
        ? 'M 100 20 A 80 80 0 1 1 100 180 A 80 80 0 1 1 100 20 M 100 48 A 52 52 0 1 0 100 152 A 52 52 0 1 0 100 48 Z'
        : 'M ' + point(80, start) + ' A 80 80 0 ' + large + ' 1 ' + point(80, end) + ' L ' + point(52, end) + ' A 52 52 0 ' + large + ' 0 ' + point(52, start) + ' Z';
      const segment = share > 0 ? '<path data-pie-month="' + escape(row.month) + '" data-rotation="' + (-(offset + share * 50) * 3.6) + '" d="' + path + '" fill="' + colors[index] + '" fill-rule="evenodd"><title>' + escape(row.month) + '：' + money(row.collected) + '</title></path>' : '';
      offset += share * 100;
      return segment;
    }).join('');
    return '<div class="av-pie"><svg viewBox="0 0 200 200" role="group" aria-label="所選年度每月實收比例"><g data-pie-ring>' + arcs + '</g><text x="100" y="97" text-anchor="middle" fill="#152238" font-size="15">月份收入</text><text x="100" y="117" text-anchor="middle" fill="#6b778c" font-size="12">實收占比</text></svg><ul>' + months.map(row => '<li><button type="button" data-pie-month="' + escape(row.month) + '"><i style="background:' + colors[Number(row.month.slice(5)) - 1] + '"></i>' + escape(row.month) + ' <span>' + money(row.collected) + '</span></button></li>').join('') + '</ul></div>';
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
    const investments = { purchase: '', renovation: '', other: '' };
    const saleInputs = { price: '', tax: '', agent: '', other: '', loan: '', operating: '' };
    element.innerHTML = '<section class="card section av"><div class="eyebrow">INCOME → ASSET</div><h2>資產收益估值</h2><p class="av-note">以各年已確認實收反推收益情境。含管理費、電費等帳單收入，並非純租金；未扣成本時不是淨收益估價。</p><div class="av-rates" role="group" aria-label="估值收益率">' + rates.map(value => '<button type="button" data-rate="' + value + '" aria-pressed="' + (value === rate) + '">' + value + '%</button>').join('') + '</div><div class="av-controls"><label>選擇年度<select data-year>' + rows.map(row => '<option value="' + row.year + '"' + (row.year === selected ? ' selected' : '') + '>' + row.year + '</option>').join('') + '</select></label><label><span data-cost-label>年度營運成本（NT$）</span><input data-expense type="number" min="0" step="any" inputmode="decimal" placeholder="選填，空白不推算淨值"></label></div><p data-error role="alert" class="av-error"></p><div data-result aria-live="polite"></div><p class="av-note">年度實收 ÷ 所選收益率。僅為情境估算，非市場成交價或正式鑑價；不自動年化。帳單月份歸屬不代表實際銀行入帳日期。</p><div data-charts></div><details><summary>查看每年收入與估值明細</summary><div data-table class="table-wrap"></div></details></section>';
    const costInput = element.querySelector('[data-expense]');
    const controls = element.querySelector('.av-controls');
    controls.insertAdjacentHTML('afterend', '<fieldset class="av-investment"><legend>投入成本與回報率試算</legend><div class="av-controls">' + [['purchase', '物件購入總價'], ['renovation', '裝修成本'], ['other', '其他投入（選填）']].map(([key, label]) => '<label>' + label + '（NT$）<input data-investment="' + key + '" type="number" min="0" step="any" inputmode="decimal" placeholder="' + (key === 'other' ? '空白以 0 計算' : '請填金額；無成本請填 0') + '"></label>').join('') + '</div><p class="av-note">成本僅供本次瀏覽試算，重新載入會清除。購入與裝修皆填寫後才計算回報率；不是利息、IRR 或淨利。</p><p data-investment-error role="alert" class="av-error"></p><div data-returns aria-live="polite"></div></fieldset>');
    element.querySelector('[data-charts]').insertAdjacentHTML('afterend', '<fieldset class="av-investment av-sale"><legend>② 估值出售試算 · 未實現</legend><p class="av-note">售價空白時使用上方毛收益情境估值，不保證成交。稅費與仲介費請填金額，沒有費用請填 0；不自動推算稅額。</p><div class="av-controls">' + [['price', '預計售價（空白跟隨估值）'], ['tax', '出售稅費'], ['agent', '仲介費'], ['other', '其他出售費用（選填，空白為 0）'], ['loan', '剩餘貸款（無貸款填 0）'], ['operating', '歷年累計營運支出（計算含出租淨獲利）']].map(([key, label]) => '<label>' + label + '（NT$）<input data-sale="' + key + '" type="number" min="0" step="any" inputmode="decimal" placeholder="' + (key === 'price' ? '自動採收益估值，可自行修改' : '請填金額；無費用填 0') + '"></label>').join('') + '</div><p data-sale-error class="av-error" role="alert"></p><div data-sale-result aria-live="polite"></div><div class="av-chart-grid" data-sale-chart></div><p class="av-note">出售獲利＝售價－投入－出售費用；貸款僅影響拿回現金，不重複扣為成本。含出租總獲利須另填歷年營運支出，且不含貸款利息以外的本金償還。所有欄位只供本次瀏覽試算、重新載入清除；不是複利年化率或 IRR。</p></fieldset>');
    element.querySelector('[data-charts]').insertAdjacentHTML('beforebegin', '<button type="button" class="av-motion" data-motion aria-pressed="false">暫停圖表動畫</button><p class="av-note">點擊柱、曲線資料點或月份，查看明細。</p>');
    element.querySelector('[data-charts]').insertAdjacentHTML('afterend', '<div data-chart-detail class="av-detail" aria-live="polite"></div>');
    controls.insertAdjacentHTML('beforebegin', '<div class="av-rates" role="group" aria-label="估值營收基準"><button type="button" data-basis="highest">最高年度營收</button><button type="button" data-basis="average">平均年度營收</button><button type="button" data-basis="year">指定年度</button></div><label class="av-note"><input type="checkbox" data-partial> 平均值包含不足 12 個有紀錄月份的年份</label><p class="av-note">營運成本僅供本次瀏覽試算，切換基準分開保存，重新載入不保留。</p>');
    function expenseKey() { return mode + ':' + (mode === 'year' ? selected : mode === 'average' ? includePartial : basis(rows, mode, selected).row.year); }
    let paused = false;
    function update(redraw = true) {
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
      const investmentError = element.querySelector('[data-investment-error]');
      let invested = null;
      let collected = null;
      try {
        element.querySelectorAll('[data-investment]').forEach(input => {
          if (input.validity && input.validity.badInput) throw new Error('Invalid investment');
        });
        const value = investmentReturns(rows, result.income, investments, error.textContent ? '' : expenses[expenseKey()]);
        invested = value.total_invested; collected = value.total_collected;
        const percentage = number => number === null ? '—' : number.toLocaleString('zh-TW', { maximumFractionDigits: 2 }) + '%';
        element.querySelector('[data-returns]').innerHTML = '<div class="av-metrics">' + [
          ['歷年累計已確認實收', money(value.total_collected)], ['總投入成本', money(value.total_invested)],
          [chosen.label + ' · 毛回報率', percentage(value.annual_gross_return)],
          ['歷年累計毛回報率（非年化）', percentage(value.cumulative_gross_return)],
          ['該基準年度淨回報率', percentage(value.annual_net_return)]
        ].map(([label, amount]) => '<div><small>' + escape(label) + '</small><strong>' + amount + '</strong></div>').join('') + '</div><p class="av-note">毛回報率＝實收 ÷ 總投入。年度淨回報率須填該基準營運成本；未計算歷年累計淨回報率。累計實收含管理費、電費等，不能當作純租金或利息。</p>';
        investmentError.textContent = invested === null ? '請填完整購入總價與裝修成本；沒有裝修成本請填 0。' : '';
      } catch (failure) {
        investmentError.textContent = '投入成本請填有限的 0 或正數金額。';
        element.querySelector('[data-returns]').innerHTML = '';
      }
      const modeled = rows.map(value => ({ ...value, ...calculate(value, rate, '') }));
      const saleError = element.querySelector('[data-sale-error]');
      try {
        element.querySelectorAll('[data-sale]').forEach(input => { if (input.validity && input.validity.badInput) throw new Error('Invalid sale input'); });
        const sale = saleScenario(result.gross_value, invested, collected, saleInputs);
        const percent = value => value === null ? '—' : value.toLocaleString('zh-TW', { maximumFractionDigits: 2 }) + '%';
        element.querySelector('[data-sale-result]').innerHTML = '<div class="av-metrics">' + [
          ['試算售價' + (saleInputs.price.trim() ? ' · 自訂' : ' · 收益估值'), money(sale.sale_price)],
          ['預估出售獲利', money(sale.sale_profit)], ['預估出售回報率（非年化）', percent(sale.sale_return)],
          ['含出租總淨獲利', money(sale.total_profit)], ['含出租總回報率（非年化）', percent(sale.total_return)],
          ['出售後可拿回現金', money(sale.cash_received)]
        ].map(([label, amount]) => '<div><small>' + escape(label) + '</small><strong>' + amount + '</strong></div>').join('') + '</div><p class="av-note">' + (saleInputs.operating.trim() ? '' : '歷年營運支出尚未填寫，不計算含出租總淨獲利。') + (saleInputs.loan.trim() ? '' : ' 剩餘貸款尚未填寫，不計算可拿回現金；無貸款請填 0。') + '</p>';
        saleError.textContent = sale.fees === null ? '出售稅費與仲介費未填完整；尚未計算出售獲利。' : invested === null ? '總投入未填完整；尚未計算出售回報。' : '';
        element.querySelector('[data-sale-chart]').innerHTML = saleChart(sale, invested);
        element.querySelector('[data-sale-chart]').setAttribute('data-paused', String(paused));
      } catch (failure) {
        saleError.textContent = '出售欄位請填有限的 0 或正數金額。';
        element.querySelector('[data-sale-result]').innerHTML = '';
        element.querySelector('[data-sale-chart]').innerHTML = '';
      }
      if (redraw) {
        element.querySelector('[data-charts]').innerHTML = '<div class="av-chart-grid"' + (paused ? ' data-paused="true"' : '') + '><article><h3>每年實收 · 柱狀圖</h3>' + chart(modeled, 'income', '各年已確認實收柱狀圖', true) + '</article><article><h3>每年實收 · 高低曲線</h3>' + chart(modeled, 'income', '各年已確認實收曲線', false) + '</article><article><div data-valuation-chart><h3>毛收益情境估值 · ' + rate + '%</h3>' + chart(modeled, 'gross_value', '各年毛收益情境估值曲線', false, invested) + '</div></article><article><h3>' + selected + ' 年 · 月份圓餅圖</h3>' + pie(row.months || []) + '</article></div>';
        element.querySelector('[data-chart-detail]').innerHTML = '';
      }
      element.querySelector('[data-valuation-chart]').innerHTML = '<h3>估值與投入對照 · ' + rate + '%</h3>' + chart(modeled, 'gross_value', '年度估值與總投入成本', false, invested);
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
    costInput.addEventListener('input', () => { expenses[expenseKey()] = costInput.value; update(false); });
    element.querySelectorAll('[data-investment]').forEach(input => input.addEventListener('input', () => { investments[input.dataset.investment] = input.value; update(false); }));
    element.querySelectorAll('[data-sale]').forEach(input => input.addEventListener('input', () => { saleInputs[input.dataset.sale] = input.value; update(false); }));
    element.querySelector('[data-motion]').addEventListener('click', event => {
      paused = !paused;
      event.currentTarget.setAttribute('aria-pressed', String(paused));
      event.currentTarget.textContent = paused ? '繼續圖表動畫' : '暫停圖表動畫';
      element.querySelector('.av-chart-grid').setAttribute('data-paused', String(paused));
      element.querySelector('[data-sale-chart]').setAttribute('data-paused', String(paused));
    });
    function showDetail(event) {
      if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target.closest('[data-chart-year], [data-pie-month]');
      if (!target) return;
      if (event.type === 'keydown') event.preventDefault();
      const month = target.dataset.pieMonth;
      const row = rows.find(value => value.year === (month ? selected : Number(target.dataset.chartYear)));
      if (!row) return;
      const months = row.months || [];
      if (month) {
        const value = months.find(value => value.month === month);
        if (!value) return;
        const total = months.reduce((sum, value) => sum + value.collected, 0);
        element.querySelector('[data-chart-detail]').innerHTML = '<h3>' + escape(month) + ' 月份明細</h3><p>已確認實收 ' + money(value.collected) + ' · 年內占比 ' + (total > 0 ? (value.collected / total * 100).toFixed(2) : '0.00') + '%</p>';
        const arc = Array.from(element.querySelectorAll('[data-rotation]')).find(arc => arc.dataset.pieMonth === month);
        const ring = element.querySelector('[data-pie-ring]');
        if (arc && ring) ring.style.transform = 'rotate(' + arc.dataset.rotation + 'deg)';
      } else {
        element.querySelector('[data-chart-detail]').innerHTML = '<h3>' + row.year + ' 年明細</h3><p>已確認實收 ' + money(row.collected) + ' · ' + rate + '% 情境估值 ' + money(calculate(row, rate, '').gross_value) + ' · 有紀錄 ' + row.recorded_months + '／12 月</p><ul>' + months.map(value => '<li>' + escape(value.month) + '：' + money(value.collected) + '</li>').join('') + '</ul>';
      }
    }
    element.querySelector('[data-charts]').addEventListener('click', showDetail);
    element.querySelector('[data-charts]').addEventListener('keydown', showDetail);
    update();
  }
  root.CMWebsAssetValuation = { calculate, basis, investmentReturns, saleScenario, mount };
})(globalThis);
