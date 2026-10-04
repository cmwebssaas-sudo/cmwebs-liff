// Loopback-only synthetic preview. Never calls Production API or initializes login.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
export const sampleYears = [
  { year: 2023, values: [10000, 14000, 9000, 16000, 18000, 12000, 10000, 14000, 9000, 16000, 18000, 12000] },
  { year: 2024, values: [14000, 19000, 11000, 20000, 22000, 18000, 14000, 19000, 11000, 20000, 22000, 18000] },
  { year: 2025, values: [12000, 17000, 10000, 18000, 20000, 15000, 12000, 17000, 10000, 18000, 20000, 15000] },
  { year: 2026, values: [20000, 26000, 18000, 28000, 30000, 22000] }
].map(row => ({ year: row.year, collected: row.values.reduce((a, b) => a + b, 0), recorded_months: row.values.length,
  allocated_bill_count: row.year === 2026 ? 2 : 0,
  months: row.values.map((collected, i) => ({ month: row.year + '-' + String(i + 1).padStart(2, '0'), collected })) }));

export function previewHtml(empty = false) {
  const page = readFileSync(new URL('landlord-revenue-dashboard.html', root), 'utf8');
  const startup = "(async function () { try { if (await initLineUserId()) await loadReport(); } catch (error) { showToast(error.message || '登入失敗', true); } }());";
  if (page.split(startup).length !== 2) throw new Error('Revenue startup changed; review preview isolation.');
  const report = { annual_income: empty ? [] : sampleYears, has_data: false, months: [], properties: [], updated_at: '' };
  return page.replace(/<script src="(?!assets\/js\/cmwebs-asset-valuation\.js)[^"]+"><\/script>/g, '')
    .replace(startup, `render(${JSON.stringify(report)});
      document.getElementById('app').insertAdjacentHTML('afterbegin', '<p class="av-warning">本機功能預覽 · 全部合成數據 · 尚未發布。年度估值不受本期月份篩選影響。</p>');
      loadReport = function() { showToast('合成資料預覽，不呼叫正式 API'); };
      goPage = function() { showToast('預覽不開啟正式網站'); };`);
}

export function createPreviewServer() {
  const assets = new Map([
    ['/assets/js/cmwebs-asset-valuation.js', 'text/javascript'],
    ['/assets/css/cmwebs-asset-valuation.css', 'text/css']
  ]);
  return createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; frame-src 'self'; form-action 'none'; base-uri 'none'");
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    if (assets.has(url.pathname)) {
      res.setHeader('Content-Type', assets.get(url.pathname));
      res.end(readFileSync(new URL(url.pathname.slice(1), root)));
    } else if (url.pathname === '/mobile') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html lang="zh-Hant"><meta name="viewport" content="width=device-width,initial-scale=1"><title>資產估值手機預覽</title><body style="margin:0;background:#e5eaf1;font-family:system-ui"><p style="text-align:center">手機版功能預覽 · 合成資料 · <a href="/">桌面版</a></p><iframe title="390px 手機預覽" src="/" style="display:block;width:min(390px,100%);height:85vh;margin:auto;border:0;border-radius:18px"></iframe></body></html>');
    } else if (url.pathname === '/' || url.pathname === '/empty') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(previewHtml(url.pathname === '/empty'));
    } else { res.writeHead(404); res.end(); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createPreviewServer();
  server.listen(0, '127.0.0.1', () => console.log('Asset valuation preview: http://127.0.0.1:' + server.address().port + '/'));
}
