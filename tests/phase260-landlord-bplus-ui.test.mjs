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

test('B+ desktop sidebar controls use layered shadows for clear interaction feedback', () => {
  const desktopCss = desktopCssSource();

  assert.match(css, /--desktop-nav-shadow:\s*0 2px 8px rgba\(37,\s*48,\s*44,\s*0\.08\)/);
  assert.match(css, /--desktop-nav-shadow-hover:\s*0 6px 14px rgba\(15,\s*118,\s*110,\s*0\.14\)/);
  assert.match(css, /--desktop-nav-shadow-active:\s*0 3px 8px rgba\(15,\s*118,\s*110,\s*0\.18\)/);
  assert.match(
    desktopCss,
    /\.desktop-nav-item\s*\{[\s\S]*?box-shadow:\s*var\(--desktop-nav-shadow\)/
  );
  assert.match(
    desktopCss,
    /\.desktop-nav-item:hover\s*\{[\s\S]*?box-shadow:\s*var\(--desktop-nav-shadow-hover\)/
  );
  assert.match(
    desktopCss,
    /\.desktop-nav-item\.active\s*\{[\s\S]*?box-shadow:\s*var\(--desktop-nav-shadow-active\)/
  );
  assert.match(
    desktopCss,
    /\.desktop-logout-button\s*\{[\s\S]*?box-shadow:\s*var\(--desktop-nav-shadow\)/
  );
});
