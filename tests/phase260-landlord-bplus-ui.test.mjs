import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const css = readFileSync(
  new URL('../landlord-responsive.css', import.meta.url),
  'utf8'
);
const home = readFileSync(
  new URL('../landlord-home.html', import.meta.url),
  'utf8'
);

function desktopCssSource() {
  const desktopStart = css.indexOf('@media (min-width: 1024px)');
  assert.ok(desktopStart >= 0, 'desktop media boundary must exist');
  return css.slice(desktopStart);
}

test('B+ desktop shell uses a light Airbnb-inspired operations canvas', () => {
  const desktopCss = desktopCssSource();

  assert.match(css, /--desktop-sidebar-width:\s*232px/);
  assert.match(css, /--desktop-shell-bg:\s*#f7f7f5/);
  assert.match(css, /--desktop-sidebar-bg:\s*#fffdfb/);
  assert.match(css, /--desktop-accent:\s*#0f766e/);
  assert.match(
    desktopCss,
    /\.desktop-nav-item\.active[\s\S]*?background:\s*var\(--desktop-accent-soft\)/
  );
  assert.match(
    desktopCss,
    /\.desktop-main[\s\S]*?padding:\s*28px 32px 48px/
  );
  assert.match(
    desktopCss,
    /\.desktop-overview[\s\S]*?\.dashboard-summary-card/
  );
});

test('B+ overview keeps existing data hooks and uses color-block controls', () => {
  const desktopCss = desktopCssSource();

  assert.match(
    home,
    /<main class="page desktop-main desktop-overview">/
  );
  for (const marker of [
    'dashboard-kpi-grid desktop-kpi-row',
    'landlordDashboardState',
    'desktop-panel-grid',
    'homeActionSection',
    'landlordRevenueChart',
    'landlordOccupancyChart',
    'landlordContractExpiryChart'
  ]) {
    assert.match(home, new RegExp(marker));
  }
  assert.match(
    desktopCss,
    /\.desktop-overview[\s\S]*?\.primary-button[\s\S]*?background:\s*var\(--desktop-accent\)/
  );
});

test('B+ desktop changes stay inside the desktop media boundary', () => {
  const desktopStart = css.indexOf('@media (min-width: 1024px)');
  assert.ok(desktopStart >= 0);
  const desktopCss = css.slice(desktopStart);
  const mobileCss = css.slice(0, desktopStart);

  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(desktopCss, /min-height:\s*44px/);
  assert.doesNotMatch(mobileCss, /\.desktop-overview/);
});
