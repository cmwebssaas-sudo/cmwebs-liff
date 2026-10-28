import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

// Pages that joined the bright glass shell after the main tabs. Each keeps
// its phone header and gains the desktop rail and top bar.
const PAGES = {
  'landlord-activity.html': { title: '團隊操作紀錄', active: '更多工具' },
  'landlord-announcements.html': { title: '公告發送', active: '更多工具' },
  'landlord-bill-notifications.html': { title: '帳單通知', active: '帳款' },
  'landlord-notifications.html': { title: '通知中心', active: '更多工具' },
  'landlord-team.html': { title: '團隊與權限', active: '更多工具' },
  'landlord-tenant-checkin.html': { title: '房客報到管理', active: '房客' }
};

for (const [page, expected] of Object.entries(PAGES)) {
  test(`${page} uses the glass desktop shell`, () => {
    const html = read(page);
    assert.match(html, /<div class="app-shell desktop-ready">\s*<aside class="desktop-sidebar"/);
    assert.match(html, /<link rel="stylesheet" href="landlord-responsive\.css\?v=[^"]+" \/>/);

    const current = [...html.matchAll(/<button class="desktop-nav-item active" type="button" aria-current="page"[\s\S]*?<\/button>/g)];
    assert.equal(current.length, 1);
    assert.match(current[0][0], new RegExp(`<span>${expected.active}</span></button>$`));

    const topbar = html.match(/<main class="page desktop-main">\s*<header class="desktop-topbar" hidden>([\s\S]*?)<\/header>/);
    assert.ok(topbar, 'desktop top bar opens the main column');
    assert.match(topbar[1], new RegExp(`<div class="desktop-page-title">${expected.title}</div>`));
    assert.match(topbar[1], /<button class="refresh" type="button" onclick="loadPage\(\)">重新整理<\/button>/);
    assert.match(html, new RegExp(`<div class="page-title">${expected.title}</div>`), 'phone header stays');

    assert.match(html, /\['desktopWorkspaceName', 'desktopTopbarWorkspaceName'\]\.forEach\(function \(id\) \{\n\s*const node = document\.getElementById\(id\);\n\s*if \(node\) node\.textContent = workspace\.workspace_name \|\| '目前 Workspace';/);
  });
}

test('desktop hides phone headers that sit beside the glass top bar', () => {
  const css = read('landlord-glass-theme.css');
  const desktop = css.slice(css.indexOf('@media (min-width: 1024px)'));
  assert.match(desktop, /\.desktop-ready \.desktop-main > \.topbar \{\s*display: none;\s*\}/);
  assert.match(desktop, /\.desktop-topbar-meta \.refresh \{[^}]*border-radius: 999px;[^}]*white-space: nowrap;/);
});

test('bill notification send bar clears the desktop rail', () => {
  const html = read('landlord-bill-notifications.html');
  const desktop = html.slice(html.lastIndexOf('@media (min-width: 1024px)'));
  assert.match(desktop, /\.desktop-ready > \.action-bar \{[^}]*left: calc\(var\(--desktop-sidebar-width\) \+ 24px\);/);
});

test('old white-on-colour hero details stay readable on the glass hero', () => {
  const css = read('landlord-glass-theme.css');
  assert.match(css, /\.app-shell \.hero :is\(\.hero-pill, \.progress-item, \.simple-step\) \{[^}]*color: var\(--glass-ink\);/);
  assert.match(css, /\.app-shell \.hero :is\(\.hero-meta, \.progress-label, \.simple-step\) \{\s*color: var\(--glass-ink-muted\);/);
});

test('tenant detail quick-action tiles do not restyle other pages\' action buttons', () => {
  const css = read('landlord-glass-theme.css');
  assert.match(css, /\.app-shell \.section-card > \.action-grid \.action-button \{\s*min-height: 112px;/);
  assert.doesNotMatch(css, /\.app-shell \.action-grid \.action-button \{/);
});
