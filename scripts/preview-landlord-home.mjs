// Synthetic, loopback-only preview of the actual homepage renderer. No API or login.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const home = {
  landlord_name: '房東', latest_bill_month: '2026-10', latest_bill_count: 20,
  latest_total_amount: 286000, paid_total_amount: 264000, unpaid_total_amount: 22000,
  unpaid_bill_count: 2,
  updated_at: '本機示範資料', workspace: { workspace_name: 'CMWebs 示範管理團隊' },
  current_membership: { role: 'owner' }
};
const report = {
  months: [
    ['2025-11', 228000, 216000], ['2025-12', 244000, 231000],
    ['2026-01', 235000, 225000], ['2026-02', 259000, 247000],
    ['2026-03', 250000, 236000], ['2026-04', 274000, 260000],
    ['2026-05', 271000, 259000], ['2026-06', 295000, 276000],
    ['2026-07', 281000, 266000], ['2026-08', 290000, 279000],
    ['2026-09', 278000, 262000], ['2026-10', 286000, 264000]
  ].map(([month, receivable, collected]) => ({ month, receivable, collected, outstanding: receivable - collected })),
  occupancy: { occupancy_rate: 0.9 },
  contract_expiry: [{ bucket: '0-30', count: 2 }, { bucket: '31-60', count: 4 }, { bucket: '61-90', count: 1 }]
};

export function previewHtml() {
  const source = readFileSync(new URL('landlord-home.html', root), 'utf8');
  const startup = '\n    loadPage();\n  </script>';
  if (source.split(startup).length !== 2) throw new Error('Homepage startup changed; preview must be reviewed.');
  return source
    .replace(/<script src="(?!landlord-home-motion\.js)[^"]+"><\/script>/g, '')
    .replaceAll("${TEST_MODE ? '測試' : '正式'}", '本機示範')
    .replace(startup, `
      function previewRender() {
        renderHome(${JSON.stringify(home)}, buildActionSummary({}, {}, {}, {}));
        document.getElementById('app').insertAdjacentHTML('afterbegin',
          '<aside class="preview-notice"><span><strong>首頁設計預覽</strong> · 合成數據，尚未發布</span><button type="button" id="previewReplay">重播進場動畫</button></aside>');
        renderLandlordDashboardCharts_(${JSON.stringify(report)});
      }
      previewRender();
      document.addEventListener('click', function (event) {
        const control = event.target.closest('a, button');
        if (!control || control.hasAttribute('data-motion-toggle')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (control.id === 'previewReplay' || control.id === 'refreshButton') previewRender();
        else showToast('這是本機設計預覽，不會開啟正式資料或執行操作。');
      }, true);
    </script>`)
    .replace('</head>', `<style>
      .preview-notice { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; padding:10px 14px; margin-bottom:20px; background:#e8f2ec; border:1px solid #cadfd2; border-radius:12px; color:#284f3b; font-size:12px; line-height:1.6; }
      .preview-notice button { min-height:44px; padding:8px 12px; border:1px solid #afcbb9; border-radius:8px; background:#fff; color:#284f3b; cursor:pointer; font-size:12px; }
      .preview-notice button:focus-visible { outline:3px solid #16704e; outline-offset:2px; }
    </style></head>`);
}

export function createPreviewServer() {
  const assets = new Map([
    ['/landlord-home.css', 'text/css'], ['/landlord-responsive.css', 'text/css'],
    ['/landlord-home-motion.js', 'text/javascript']
  ]);
  return createServer((request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'self'; frame-ancestors 'self'");
    if (request.method !== 'GET') { response.writeHead(405); response.end(); return; }
    if (pathname === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(previewHtml());
    } else if (pathname === '/mobile') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
        <title>CMWebs 手機版首頁預覽</title><style>
        *{box-sizing:border-box}body{margin:0;background:#e9eeea;color:#173e2c;font-family:system-ui,sans-serif}
        header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 20px;max-width:700px;margin:auto}
        h1{font-size:18px;margin:0}p{font-size:12px;margin:4px 0 0;color:#426151}
        a{color:#173e2c;background:white;border:1px solid #b7cbbd;border-radius:8px;padding:12px;font-size:13px;text-decoration:none;white-space:nowrap}
        a:focus-visible{outline:3px solid #14704c;outline-offset:3px}
        main{width:min(390px,calc(100% - 20px));height:calc(100dvh - 92px);min-height:320px;margin:0 auto 12px;border:1px solid #afc2b6;border-radius:24px;overflow:hidden;background:#fff;box-shadow:0 12px 35px #173e2c16}
        iframe{width:100%;height:100%;border:0;display:block}
        </style></head><body><header><div><h1>手機版首頁</h1><p>可直接捲動 · 合成數據 · 尚未發布</p></div><a href="/">查看桌面版</a></header>
        <main><iframe src="/" title="手機版房東首頁預覽"></iframe></main></body></html>`);
    } else if (assets.has(pathname)) {
      response.setHeader('Content-Type', assets.get(pathname) + '; charset=utf-8');
      response.end(readFileSync(new URL(pathname.slice(1), root)));
    } else { response.writeHead(404); response.end('Preview asset not found'); }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createPreviewServer();
  server.listen(0, '127.0.0.1', () => console.log(`Synthetic homepage preview: http://127.0.0.1:${server.address().port}/`));
}
