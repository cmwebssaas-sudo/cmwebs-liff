// Renders the standard rich menu images with headless Chrome and records their
// SHA-256 for the Worker. Run after changing line-rich-menu-layout.js:
//   node scripts/generate-line-rich-menu-images.mjs
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RICH_MENUS, RICH_MENU_ORDER, RICH_MENU_PALETTES, RICH_MENU_SIZE, RICH_MENU_TAB_HEIGHT } from '../cloudflare/read-api/src/line-rich-menu-layout.js';

// Line icons on a 24-unit grid.
const ICONS = {
  home:'<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  bill:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  card:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/>',
  chat:'<path d="M4 5h16v11H9l-5 4z"/><path d="M9 10.5h.01M12 10.5h.01M15 10.5h.01"/>',
  lease:'<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>',
  link:'<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1"/><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>',
  grid:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  coin:'<circle cx="12" cy="12" r="8"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5V8M12 16v1.5"/>',
  people:'<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.4 0 4 2 4 5"/>',
  building:'<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-4h4v4"/>',
  dots:'<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>'
};
const svg = (name, size) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = new URL('../', import.meta.url);
const work = mkdtempSync(join(tmpdir(), 'cmwebs-rich-menu-'));
const hashes = {};
const W = RICH_MENU_SIZE.width, H = RICH_MENU_SIZE.height, T = RICH_MENU_TAB_HEIGHT;
try {
  for (const [menu, { items }] of Object.entries(RICH_MENUS)) {
    hashes[menu] = {};
    const activeLeft = RICH_MENU_ORDER.indexOf(menu) === 0;
    for (const [palette, c] of Object.entries(RICH_MENU_PALETTES)) {
      const tabs = RICH_MENU_ORDER.map(name => name === menu
        ? `<div class="tab on"><span class="badge">${svg(RICH_MENUS[name].icon,82)}</span>${RICH_MENUS[name].tab}</div>`
        : `<div class="tab">${RICH_MENUS[name].tab}</div>`).join('');
      const cards = items.map(([label, , caption, icon], index) => `<div class="card${index === 0 ? ' primary' : ''}">
        <span class="icon">${svg(icon,96)}</span><b>${label}</b><small>${caption}</small></div>`).join('');
      // The active tab's shape: a rounded top with a sweeping curve into the inactive side.
      const curve = activeLeft
        ? `M0 ${T} L0 60 Q0 0 60 0 L1060 0 Q1180 0 1230 ${T/2} Q1280 ${T} 1400 ${T} Z`
        : `M${W} ${T} L${W} 60 Q${W} 0 ${W-60} 0 L1440 0 Q1320 0 1270 ${T/2} Q1220 ${T} 1100 ${T} Z`;
      const html = `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${c.background};
font-family:"Noto Sans TC","PingFang TC","Heiti TC",sans-serif;color:${c.ink}}
nav{position:relative;height:${T}px;background:${c.tabBar}}nav svg.shape{position:absolute;inset:0}
.tabs{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr}
.tab{display:flex;align-items:center;justify-content:center;gap:34px;font-size:92px;font-weight:700;letter-spacing:10px;color:${c.muted}}
.tab.on{color:${c.ink}}.badge{display:inline-flex;width:132px;height:132px;border-radius:50%;align-items:center;justify-content:center;background:${c.accent};color:#fff}
main{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:28px;padding:28px;height:${H - T}px}
.card{background:#fff;border-radius:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;
box-shadow:0 6px 18px rgba(0,0,0,.07)}
.icon{display:inline-flex;width:170px;height:170px;border-radius:50%;align-items:center;justify-content:center;
background:${c.background};color:${c.accent};margin-bottom:12px}
b{font-size:104px;letter-spacing:8px}small{font-size:40px;letter-spacing:8px;color:${c.muted}}
.primary{background:${c.accent};color:#fff;box-shadow:0 12px 28px rgba(0,0,0,.18)}.primary .icon{background:rgba(255,255,255,.95)}.primary small{color:rgba(255,255,255,.85)}
</style><nav><svg class="shape" viewBox="0 0 ${W} ${T}" width="${W}" height="${T}"><path d="${curve}" fill="${c.background}"/></svg>
<div class="tabs">${tabs}</div></nav><main>${cards}</main>`;
      const page = join(work, `${menu}-${palette}.html`);
      const out = new URL(`assets/line-rich-menu/${menu}-${palette}.png`, root);
      writeFileSync(page, html);
      execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
        `--window-size=${W},${H}`, `--screenshot=${out.pathname}`, `file://${page}`], { stdio: 'ignore' });
      hashes[menu][palette] = createHash('sha256').update(readFileSync(out)).digest('hex');
    }
  }
} finally { rmSync(work, { recursive: true, force: true }); }
writeFileSync(new URL('cloudflare/read-api/src/line-rich-menu-images.js', root),
  '// Generated by scripts/generate-line-rich-menu-images.mjs. Do not edit.\n' +
  'export const RICH_MENU_IMAGE_SHA256 = ' + JSON.stringify(hashes, null, 2) + ';\n');
console.log('Rendered', Object.keys(hashes).length * Object.keys(RICH_MENU_PALETTES).length, 'rich menu images.');
