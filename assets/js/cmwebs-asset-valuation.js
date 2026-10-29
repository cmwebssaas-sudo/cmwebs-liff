(function (root) {
  'use strict';
  const rates = [2, 3, 4, 4.5];
  // Validated categorical slots (dataviz reference palette): income is aqua,
  // valuation blue, invested cost orange; a loss uses the critical status red.
  const viz = { income: '#1baf7a', value: '#2a78d6', cost: '#eb6834', loss: '#d03b3b', grid: '#e6e9ef', axis: '#c9cfd8', surface: '#ffffff' };
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const money = value => value === null ? '—' : 'NT$ ' + Math.round(value).toLocaleString('zh-TW');
  const compact = value => Math.abs(value) >= 100000000 ? (value / 100000000).toLocaleString('zh-TW', { maximumFractionDigits: 2 }) + '億'
    : Math.abs(value) >= 10000 ? (value / 10000).toLocaleString('zh-TW', { maximumFractionDigits: 1 }) + '萬' : Math.round(value).toLocaleString('zh-TW');
  // Rounded data end, square at the baseline; negative bars hang below it.
  function barPath(x, base, top, width) {
    const h = Math.abs(base - top);
    const r = Math.min(4, width / 2, h);
    if (top <= base) return 'M' + x + ' ' + base + 'V' + (top + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + r) + ' ' + top + 'H' + (x + width - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + width) + ' ' + (top + r) + 'V' + base + 'Z';
    return 'M' + x + ' ' + base + 'V' + (top - r) + 'A' + r + ' ' + r + ' 0 0 0 ' + (x + r) + ' ' + top + 'H' + (x + width - r) + 'A' + r + ' ' + r + ' 0 0 0 ' + (x + width) + ' ' + (top - r) + 'V' + base + 'Z';
  }
  // Charts draw at the card's real width so text stays at its CSS size.
  function chartWidth(host, columns) {
    const width = host && host.clientWidth ? host.clientWidth : 0;
    if (!width) return 600;
    const cols = columns === 1 || width <= 600 ? 1 : 2;
    return Math.max(260, Math.floor((width - 14 * (cols - 1)) / cols) - 30);
  }

  function rollingMoney(value, previous, animate) {
    if (value === null || !Number.isFinite(value)) return '—';
    const target = Math.round(value);
    const old = previous === null || !Number.isFinite(previous) ? null : Math.round(previous);
    if (!animate || target === old || target < 0) return money(target);
    const digits = String(target);
    const before = String(old === null ? 0 : old).padStart(digits.length, '0');
    const direction = old !== null && target < old ? -1 : 1;
    let index = 0;
    const visual = target.toLocaleString('zh-TW').split('').map(char => {
      if (!/\d/.test(char)) return '<span class="av-number-separator">' + char + '</span>';
      const start = Number(before[before.length - digits.length + index] || 0);
      const end = Number(char);
      const delay = index++ * 12;
      if (old !== null && start === end) return '<span class="av-number-digit">' + char + '</span>';
      const steps = ((end - start) * direction + 10) % 10 + (old === null ? 10 : 0);
      const frames = Array.from({ length: steps + 1 }, (_, n) => '<i>' + ((start + n * direction + 20) % 10) + '</i>').join('');
      return '<span class="av-number-digit"><span class="av-number-track" style="--roll-end:-' + steps + 'em;--roll-delay:' + delay + 'ms">' + frames + '</span></span>';
    }).join('');
    return '<span class="av-number" role="img" aria-label="' + money(target) + '"><span class="av-number-visual" aria-hidden="true"><span class="av-number-currency">NT$&nbsp;</span>' + visual + '</span></span>';
  }

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

  // Clean axis steps (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 x 10^n) with a little headroom.
  function niceScale(max, count) {
    const raw = Math.max(1, max) / count;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(value => value * magnitude >= raw) * magnitude;
    return { top: step * count, step };
  }

  function axis(scale, count, left, right, width, base, plot) {
    return Array.from({ length: count + 1 }, (_, i) => {
      const y = (base - (scale.step * i / scale.top) * plot).toFixed(1);
      return '<line x1="' + left + '" x2="' + (width - right) + '" y1="' + y + '" y2="' + y + '" stroke="' + (i ? viz.grid : viz.axis) + '" shape-rendering="crispEdges"/><text class="av-tick" x="' + (left - 8) + '" y="' + (Number(y) + 4) + '" text-anchor="end">' + compact(scale.step * i) + '</text>';
    }).join('');
  }

  function saleChart(value, invested, width = 600) {
    const points = [['總投入', invested, viz.cost], ['出售淨額', value.net_sale, viz.value], ['出售獲利', value.sale_profit, viz.income]].filter(([, amount]) => amount !== null);
    if (!points.length) return '';
    const max = Math.max(1, ...points.map(([, amount]) => Math.abs(amount)));
    const loss = points.some(([, amount]) => amount < 0);
    const base = loss ? 112 : 172;
    const span = loss ? 72 : 136;
    const slot = width / points.length;
    const barWidth = Math.min(24, slot * .5);
    return '<svg class="av-svg" viewBox="0 0 ' + width + ' 240" role="img" aria-label="總投入、出售淨額與預估獲利比較"><line x1="0" x2="' + width + '" y1="' + base + '" y2="' + base + '" stroke="' + viz.axis + '" shape-rendering="crispEdges"/>' + points.map(([label, amount, color], i) => {
      const height = Math.abs(amount) / max * span;
      const center = slot * (i + .5);
      const end = amount >= 0 ? base - height : base + height;
      return '<g><title>' + escape(label + '：' + money(amount)) + '</title>' + (height > 0 ? '<path class="av-mark av-bar" d="' + barPath(center - barWidth / 2, base, end, barWidth) + '" fill="' + (amount < 0 ? viz.loss : color) + '"/>' : '') + '<text class="av-value" x="' + center + '" y="' + (amount >= 0 ? end - 8 : end + 18) + '" text-anchor="middle">' + escape(money(amount)) + '</text><text class="av-tick" x="' + center + '" y="232" text-anchor="middle">' + escape(label) + '</text></g>';
    }).join('') + '</svg>';
  }

  function chart(rows, key, label, bars, reference = null, width = 600) {
    if (!rows.length) return '<p class="av-note">沒有年度資料。</p>';
    const color = key === 'gross_value' ? viz.value : viz.income;
    const left = 56, right = 16, top = 16, base = 172, plot = base - top;
    const scale = niceScale(Math.max(1, reference || 0, ...rows.map(row => Number(row[key]) || 0)), 3);
    const span = Math.max(1, rows[rows.length - 1].year - rows[0].year + 1);
    const slot = (width - left - right) / span;
    const y = value => base - (value / scale.top) * plot;
    const points = rows.filter(row => typeof row[key] === 'number' && Number.isFinite(row[key])).map(row => ({ x: left + slot * (row.year - rows[0].year + .5), y: y(row[key]), row }));
    const segments = [];
    points.forEach((point, i) => {
      if (!i || point.row.year !== points[i - 1].row.year + 1) segments.push([]);
      segments[segments.length - 1].push(point);
    });
    const barWidth = Math.min(24, slot * .5);
    const coords = segment => segment.map(p => p.x.toFixed(1) + ' ' + p.y.toFixed(1));
    // Missing years break the line: each run of consecutive years is its own wash and line.
    const lines = bars ? '' : segments.filter(segment => segment.length > 1).map(segment => '<path class="av-area" d="M' + coords(segment).join('L') + 'L' + segment[segment.length - 1].x.toFixed(1) + ' ' + base + 'L' + segment[0].x.toFixed(1) + ' ' + base + 'Z" fill="' + color + '" fill-opacity=".1"/><polyline pathLength="1" points="' + coords(segment).map(point => point.replace(' ', ',')).join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>').join('');
    // A group owns each visible mark and the larger transparent tap target.
    const marks = points.map(p => {
      const visible = bars
        ? '<path class="av-mark av-bar" d="' + barPath(p.x - barWidth / 2, base, p.y, barWidth) + '" fill="' + color + '"/>'
        : '<circle class="av-mark" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4" fill="' + color + '" stroke="' + viz.surface + '" stroke-width="2"/>';
      const hitWidth = Math.max(24, slot * .8);
      return '<g role="button" tabindex="0" data-chart-year="' + p.row.year + '" aria-label="' + escape(p.row.year + ' 年，' + label + '，' + money(p.row[key]) + '，查看明細') + '"><title>' + escape(p.row.year + '：' + money(p.row[key])) + '</title>' + visible + '<rect x="' + (p.x - hitWidth / 2).toFixed(1) + '" y="' + (bars ? top : p.y - 14).toFixed(1) + '" width="' + hitWidth.toFixed(1) + '" height="' + (bars ? plot : 28) + '" fill="transparent"/></g>';
    }).join('');
    const last = points[points.length - 1];
    const endLabel = last ? '<text class="av-value" x="' + last.x.toFixed(1) + '" y="' + Math.max(12, last.y - 10).toFixed(1) + '" text-anchor="middle">' + escape(compact(last.row[key])) + '</text>' : '';
    const referenceY = reference === null ? 0 : y(reference).toFixed(1);
    const referenceLine = reference === null ? '' : '<line x1="' + left + '" x2="' + (width - right) + '" y1="' + referenceY + '" y2="' + referenceY + '" stroke="' + viz.cost + '" stroke-width="1.5" stroke-dasharray="5 4"><title>總投入成本：' + money(reference) + '</title></line><text class="av-tick" x="' + (width - right) + '" y="' + (referenceY - 6) + '" text-anchor="end">總投入</text>';
    const years = points.map(p => '<text class="av-tick" x="' + p.x.toFixed(1) + '" y="194" text-anchor="middle">' + escape(p.row.year) + '</text>').join('');
    const extrema = points.length ? '<p class="av-note">最高：' + money(Math.max(...points.map(p => p.row[key]))) + ' · 最低：' + money(Math.min(...points.map(p => p.row[key]))) + '</p>' : '';
    return '<svg class="av-svg" viewBox="0 0 ' + width + ' 204" role="group" aria-label="' + escape(label) + '">' + axis(scale, 3, left, right, width, base, plot) + lines + referenceLine + marks + endLabel + years + '</svg>' + extrema + (reference === null ? '' : '<p class="av-note">橘色虛線 · 總投入成本：' + money(reference) + '；藍色曲線 · 收益情境估值（不是已實現獲利）。</p>');
  }

  // Twelve months read better as columns than as a twelve-colour pie.
  function monthColumns(months, width = 600) {
    const total = months.reduce((sum, row) => sum + row.collected, 0);
    if (total <= 0) return '<p class="av-note">本年沒有已確認實收，無法繪製比例。</p>';
    const left = 56, right = 8, top = 16, base = 172, plot = base - top;
    const scale = niceScale(Math.max(1, ...months.map(row => row.collected)), 3);
    const slot = (width - left - right) / 12;
    const barWidth = Math.min(18, slot * .6);
    const byMonth = new Map(months.map(row => [Number(row.month.slice(5)), row]));
    const columns = Array.from({ length: 12 }, (_, i) => {
      const row = byMonth.get(i + 1);
      const center = left + slot * (i + .5);
      const tick = '<text class="av-tick" x="' + center.toFixed(1) + '" y="194" text-anchor="middle">' + (i + 1) + '</text>';
      if (!row || !(row.collected > 0)) return tick;
      const end = base - (row.collected / scale.top) * plot;
      const share = (row.collected / total * 100).toFixed(1);
      return '<g role="button" tabindex="0" data-month="' + escape(row.month) + '" aria-label="' + escape(row.month + '，已確認實收 ' + money(row.collected) + '，年內占比 ' + share + '%，查看明細') + '"><title>' + escape(row.month + '：' + money(row.collected)) + '</title><path class="av-mark av-bar" d="' + barPath(center - barWidth / 2, base, end, barWidth) + '" fill="' + viz.income + '"/><rect x="' + (center - slot / 2).toFixed(1) + '" y="' + top + '" width="' + slot.toFixed(1) + '" height="' + plot + '" fill="transparent"/></g>' + tick;
    }).join('');
    return '<svg class="av-svg" viewBox="0 0 ' + width + ' 204" role="group" aria-label="所選年度每月實收">' + axis(scale, 3, left, right, width, base, plot) + columns + '</svg><p class="av-note">合計 ' + money(total) + ' · 橫軸為月份；點擊柱查看年內占比。</p>';
  }

  function mount(element, rows, previous) {
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
    element.innerHTML = '<section class="card section av"><div class="eyebrow">INCOME → ASSET</div><h2>營收與資產</h2><div data-overview class="av-overview" aria-live="polite"></div><p class="av-note">以各年已確認實收反推收益情境。含管理費、電費等帳單收入，並非純租金；未扣成本時不是淨收益估價。</p><div class="av-rates" role="group" aria-label="估值收益率">' + rates.map(value => '<button type="button" data-rate="' + value + '" aria-pressed="' + (value === rate) + '">' + value + '%</button>').join('') + '</div><p data-error role="alert" class="av-error"></p><div data-result aria-live="polite"></div><p class="av-note">年度實收 ÷ 所選收益率。僅為情境估算，非市場成交價或正式鑑價；不自動年化。帳單月份歸屬不代表實際銀行入帳日期。</p><div data-charts></div><div class="av-controls"><label>選擇年度<select data-year>' + rows.map(row => '<option value="' + row.year + '"' + (row.year === selected ? ' selected' : '') + '>' + row.year + '</option>').join('') + '</select></label><label><span data-cost-label>年度營運成本（NT$）</span><input data-expense type="number" min="0" step="any" inputmode="decimal" placeholder="選填，空白不推算淨值"></label></div><details><summary>查看每年收入與估值明細</summary><div data-table class="table-wrap"></div></details></section>';
    const costInput = element.querySelector('[data-expense]');
    const controls = element.querySelector('.av-controls');
    controls.insertAdjacentHTML('afterend', '<fieldset class="av-investment"><legend>投入成本與回報率試算</legend><div class="av-controls">' + [['purchase', '物件購入總價'], ['renovation', '裝修成本'], ['other', '其他投入（選填）']].map(([key, label]) => '<label>' + label + '（NT$）<input data-investment="' + key + '" type="number" min="0" step="any" inputmode="decimal" placeholder="' + (key === 'other' ? '空白以 0 計算' : '請填金額；無成本請填 0') + '"></label>').join('') + '</div><p class="av-note">成本僅供本次瀏覽試算，重新載入會清除。購入與裝修皆填寫後才計算回報率；不是利息、IRR 或淨利。</p><p data-investment-error role="alert" class="av-error"></p><div data-returns aria-live="polite"></div></fieldset>');
    element.querySelector('.av-investment').insertAdjacentHTML('afterend', '<fieldset class="av-investment av-sale"><legend>② 估值出售試算 · 未實現</legend><p class="av-note">售價空白時使用上方毛收益情境估值，不保證成交。稅費與仲介費請填金額，沒有費用請填 0；不自動推算稅額。</p><div class="av-controls">' + [['price', '預計售價（空白跟隨估值）'], ['tax', '出售稅費'], ['agent', '仲介費'], ['other', '其他出售費用（選填，空白為 0）'], ['loan', '剩餘貸款（無貸款填 0）'], ['operating', '歷年累計營運支出（計算含出租淨獲利）']].map(([key, label]) => '<label>' + label + '（NT$）<input data-sale="' + key + '" type="number" min="0" step="any" inputmode="decimal" placeholder="' + (key === 'price' ? '自動採收益估值，可自行修改' : '請填金額；無費用填 0') + '"></label>').join('') + '</div><p data-sale-error class="av-error" role="alert"></p><div data-sale-result aria-live="polite"></div><div class="av-chart-grid" data-sale-chart></div><p class="av-note">出售獲利＝售價－投入－出售費用；貸款僅影響拿回現金，不重複扣為成本。含出租總獲利須另填歷年營運支出，且不含貸款利息以外的本金償還。所有欄位只供本次瀏覽試算、重新載入清除；不是複利年化率或 IRR。</p></fieldset>');
    element.querySelector('[data-charts]').insertAdjacentHTML('beforebegin', '<button type="button" class="av-motion" data-motion aria-pressed="false">暫停圖表動畫</button><p class="av-note">點擊柱、曲線資料點或月份，查看明細。</p>');
    element.querySelector('[data-charts]').insertAdjacentHTML('afterend', '<div data-chart-detail class="av-detail" aria-live="polite"></div>');
    element.querySelector('.av-rates').insertAdjacentHTML('afterend', '<div class="av-rates" role="group" aria-label="估值營收基準"><button type="button" data-basis="highest">最高年度營收</button><button type="button" data-basis="average">平均年度營收</button><button type="button" data-basis="year">指定年度</button></div>');
    controls.insertAdjacentHTML('beforebegin', '<label class="av-note"><input type="checkbox" data-partial> 平均值包含不足 12 個有紀錄月份的年份</label><p class="av-note">營運成本僅供本次瀏覽試算，切換基準分開保存，重新載入不保留。</p>');
    function expenseKey() { return mode + ':' + (mode === 'year' ? selected : mode === 'average' ? includePartial : basis(rows, mode, selected).row.year); }
    const visualState = { gross: previous ? previous.gross : null, collected: previous ? previous.collected : null, paused: Boolean(previous && previous.paused) };
    let paused = visualState.paused;
    let overviewKey = '';
    let previousGross = visualState.gross;
    let previousCollected = visualState.collected;
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
      const overviewCollected = rows.reduce((sum, row) => sum + Number(row.collected || 0), 0);
      const nextOverviewKey = JSON.stringify([result.gross_value, overviewCollected, chosen.label, rate, paused]);
      if (overviewKey !== nextOverviewKey) {
        const animate = !paused && !(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
        element.querySelector('[data-overview]').innerHTML = '<div class="av-overview-value"><small>目前資產估值（收益情境）</small><strong>' + rollingMoney(result.gross_value, previousGross, animate) + '</strong><span>' + escape(chosen.label) + ' ／ ' + rate + '% 收益率</span></div><div class="av-overview-income"><small>歷年累計已確認實收</small><strong>' + rollingMoney(overviewCollected, previousCollected, animate) + '</strong><span>目前物件範圍內全部有紀錄年度，含管理費與電費</span></div>';
        previousGross = result.gross_value;
        previousCollected = overviewCollected;
        visualState.gross = previousGross;
        visualState.collected = previousCollected;
        visualState.paused = paused;
        overviewKey = nextOverviewKey;
      }
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
        element.querySelector('[data-sale-chart]').innerHTML = saleChart(sale, invested, chartWidth(element.querySelector('[data-sale-chart]'), 1));
        element.querySelector('[data-sale-chart]').setAttribute('data-paused', String(paused));
      } catch (failure) {
        saleError.textContent = '出售欄位請填有限的 0 或正數金額。';
        element.querySelector('[data-sale-result]').innerHTML = '';
        element.querySelector('[data-sale-chart]').innerHTML = '';
      }
      const width = chartWidth(element.querySelector('[data-charts]'), 2);
      if (redraw) {
        element.querySelector('[data-charts]').innerHTML = '<div class="av-chart-grid"' + (paused ? ' data-paused="true"' : '') + '><article><h3>每年實收 · 柱狀圖</h3>' + chart(modeled, 'income', '各年已確認實收柱狀圖', true, null, width) + '</article><article><h3>每年實收 · 高低曲線</h3>' + chart(modeled, 'income', '各年已確認實收曲線', false, null, width) + '</article><article><div data-valuation-chart><h3>毛收益情境估值 · ' + rate + '%</h3>' + chart(modeled, 'gross_value', '各年毛收益情境估值曲線', false, invested, width) + '</div></article><article><h3>' + selected + ' 年 · 每月實收</h3>' + monthColumns(row.months || [], width) + '</article></div>';
        element.querySelector('[data-chart-detail]').innerHTML = '';
      }
      element.querySelector('[data-valuation-chart]').innerHTML = '<h3>估值與投入對照 · ' + rate + '%</h3>' + chart(modeled, 'gross_value', '年度估值與總投入成本', false, invested, width);
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
      update(false);
    });
    function showDetail(event) {
      if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target.closest('[data-chart-year], [data-month]');
      if (!target) return;
      if (event.type === 'keydown') event.preventDefault();
      const month = target.dataset.month;
      const row = rows.find(value => value.year === (month ? selected : Number(target.dataset.chartYear)));
      if (!row) return;
      const months = row.months || [];
      if (month) {
        const value = months.find(value => value.month === month);
        if (!value) return;
        const total = months.reduce((sum, value) => sum + value.collected, 0);
        element.querySelector('[data-chart-detail]').innerHTML = '<h3>' + escape(month) + ' 月份明細</h3><p>已確認實收 ' + money(value.collected) + ' · 年內占比 ' + (total > 0 ? (value.collected / total * 100).toFixed(2) : '0.00') + '%</p>';
        element.querySelectorAll('[data-month]').forEach(column => column.setAttribute('aria-pressed', String(column.dataset.month === month)));
      } else {
        element.querySelector('[data-chart-detail]').innerHTML = '<h3>' + row.year + ' 年明細</h3><p>已確認實收 ' + money(row.collected) + ' · ' + rate + '% 情境估值 ' + money(calculate(row, rate, '').gross_value) + ' · 有紀錄 ' + row.recorded_months + '／12 月</p><ul>' + months.map(value => '<li>' + escape(value.month) + '：' + money(value.collected) + '</li>').join('') + '</ul>';
      }
    }
    element.querySelector('[data-charts]').addEventListener('click', showDetail);
    element.querySelector('[data-charts]').addEventListener('keydown', showDetail);
    if (paused) {
      element.querySelector('[data-motion]').setAttribute('aria-pressed', 'true');
      element.querySelector('[data-motion]').textContent = '繼續圖表動畫';
    }
    update();
    // Charts are drawn at the card's width; redraw this widget when that width changes.
    let drawnWidth = chartWidth(element.querySelector('[data-charts]'), 2);
    redrawActive = () => {
      const next = chartWidth(element.querySelector('[data-charts]'), 2);
      if (next !== drawnWidth && element.isConnected !== false) { drawnWidth = next; update(); }
    };
    return visualState;
  }
  let redrawActive = null;
  let resizeTimer = 0;
  if (typeof root.addEventListener === 'function') {
    root.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (redrawActive) redrawActive(); }, 150);
    });
  }
  root.CMWebsAssetValuation = { calculate, basis, investmentReturns, saleScenario, rollingMoney, mount };
})(globalThis);
