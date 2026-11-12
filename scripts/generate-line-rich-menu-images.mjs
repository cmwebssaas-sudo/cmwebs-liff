// Renders the standard rich menu images with headless Chrome and records their
// SHA-256 for the Worker. The look follows the owner's format of 2026-11-12,
// ported from the Libenest platform-tabbed gen.mjs: a two-tone tab bar whose
// selected tab joins its page colour along an S curve (mirrored on page 2),
// white buttons with a gradient first button, 100px line icons in 172px
// circles. Run after changing line-rich-menu-layout.js:
//   node scripts/generate-line-rich-menu-images.mjs
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RICH_MENUS, RICH_MENU_ORDER, RICH_MENU_PALETTES, RICH_MENU_SIZE, RICH_MENU_TAB_HEIGHT, RICH_MENU_COLUMNS } from '../cloudflare/read-api/src/line-rich-menu-layout.js';

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
const svg = (name, size, width = 1.5) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = new URL('../', import.meta.url);
const work = mkdtempSync(join(tmpdir(), 'cmwebs-rich-menu-'));
const hashes = {};
const W = RICH_MENU_SIZE.width, H = RICH_MENU_SIZE.height, T = RICH_MENU_TAB_HEIGHT;
const ROW = (H - T) / 2;
// The selected tab's shape: rounded outer corner, S curve down into the other half.
const tabPath = left => left
  ? `M0 ${T + 12} V60 Q0 0 60 0 H1080 C1180 0 1200 ${T} 1330 ${T} H1330 V${T + 12} Z`
  : `M${W} ${T + 12} V60 Q${W} 0 ${W - 60} 0 H1420 C1320 0 1300 ${T} 1170 ${T} V${T + 12} Z`;
try {
  for (const [menu, { items }] of Object.entries(RICH_MENUS)) {
    hashes[menu] = {};
    const index = RICH_MENU_ORDER.indexOf(menu);
    for (const [palette, c] of Object.entries(RICH_MENU_PALETTES)) {
      const [top, bottom] = c.tone[index], other = c.tone[1 - index][0];
      // The 150px mark beside the selected tab: the tab's own icon, never a landlord logo.
      const tabs = RICH_MENU_ORDER.map((name, i) => `<div class="tab${i === index ? ' on' : ''}" style="left:${i * W / 2}px">${
        i === index ? `<span class="mark">${svg(RICH_MENUS[name].icon, 92, 1.8)}</span>` : ''}${RICH_MENUS[name].tab}</div>`).join('');
      const cells = items.map(([label, , caption, icon], n) => `<div class="cell"><div class="tile${n === 0 ? ' primary' : ''}"><div class="icon">${
        svg(icon, 100)}</div><div class="label${[...label].length > 4 ? ' long' : ''}">${label}</div><div class="sub">${caption}</div></div></div>`).join('');
      const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}html,body{width:${W}px;height:${H}px;background:${other};font-family:"PingFang TC","Noto Sans TC",sans-serif;color:#101113;position:relative;overflow:hidden}
.bar{position:absolute;inset:0 0 auto 0;height:${T}px}.bar svg.shape{position:absolute;inset:0}
.tab{position:absolute;top:0;height:${T}px;width:${W / 2}px;display:flex;align-items:center;justify-content:center;gap:34px;font-size:108px;font-weight:500;letter-spacing:10px;color:#8A94A3}
.tab.on{color:#101113;font-weight:600}.mark{width:150px;height:150px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(160deg,${c.primary[0]},${c.primary[1]});color:#fff}
.panel{position:absolute;top:${T}px;left:0;right:0;bottom:0;background:linear-gradient(${top},${bottom})}
.grid{display:grid;grid-template-columns:${RICH_MENU_COLUMNS.slice(1).map((x, i) => x - RICH_MENU_COLUMNS[i] + 'px').join(' ')};grid-template-rows:${ROW}px ${ROW}px;height:100%}
.cell{padding:58px 66px;display:flex}.tile{flex:1;background:#FFFFFF;border-radius:48px;box-shadow:0 14px 34px rgba(${c.shadow},.10),0 2px 6px rgba(${c.shadow},.05);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px}
.tile.primary{background:linear-gradient(160deg,${c.primary[0]},${c.primary[1]});color:#fff;box-shadow:0 18px 40px rgba(${c.glow},.30)}
.icon{width:172px;height:172px;border-radius:50%;background:${c.iconBg};display:grid;place-items:center;color:${c.icon}}.primary .icon{background:rgba(255,255,255,.92)}
.label{font-size:82px;font-weight:600;letter-spacing:4px;line-height:1}.label.long{font-size:74px;letter-spacing:2px}
.sub{font-size:32px;letter-spacing:5px;color:#78818B;font-weight:500;line-height:1}.primary .sub{color:${c.primarySub}}
</style></head><body><div class="panel"><div class="grid">${cells}</div></div>
<div class="bar"><svg class="shape" width="${W}" height="${T + 12}" viewBox="0 0 ${W} ${T + 12}"><path d="${tabPath(index === 0)}" fill="${top}"/></svg>${tabs}</div></body></html>`;
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
