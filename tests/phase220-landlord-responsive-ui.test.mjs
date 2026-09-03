import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

const pageNames = [
  'landlord-home.html',
  'landlord-tenants.html',
  'landlord-properties.html'
];

const pages = Object.fromEntries(
  pageNames.map((name) => [
    name,
    readFileSync(new URL('../' + name, import.meta.url), 'utf8')
  ])
);

const cssUrl = new URL('../landlord-responsive.css', import.meta.url);
const cssExists = existsSync(cssUrl);
const cssSource = cssExists ? readFileSync(cssUrl, 'utf8') : '';

function stripDesktopMedia(css) {
  const marker = '@media (min-width: 1024px)';
  let output = css;
  let start = output.indexOf(marker);

  while (start >= 0) {
    const blockStart = output.indexOf('{', start);
    assert.notEqual(blockStart, -1, 'desktop media block must include an opening brace');

    let depth = 0;
    let end = blockStart;
    for (; end < output.length; end += 1) {
      const char = output[end];
      if (char === '{') depth += 1;
      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }

    output = output.slice(0, start) + output.slice(end);
    start = output.indexOf(marker);
  }

  return output;
}

test('Phase 220 requires the shared landlord desktop stylesheet', () => {
  assert.equal(cssExists, true, 'landlord-responsive.css must exist');
  assert.match(cssSource, /--desktop-sidebar-width:\s*256px/);
  assert.match(cssSource, /--desktop-content-max:\s*1440px/);
  assert.match(cssSource, /--desktop-gap:\s*24px/);
  assert.match(cssSource, /@media\s*\(min-width:\s*1024px\)/);
});

test('Phase 220 links the shared stylesheet and preserves the mobile shell contract', () => {
  for (const [name, source] of Object.entries(pages)) {
    assert.match(source, /<link[^>]+href="landlord-responsive\.css"/, `${name} must link shared CSS`);
    assert.match(source, /<div class="app-shell desktop-ready">/, `${name} must opt into desktop shell`);
    assert.match(source, /<main class="page desktop-main">/, `${name} must preserve .page while exposing desktop-main`);
    assert.match(source, /<nav class="bottom-nav">/, `${name} must keep mobile bottom navigation`);
    assert.match(source, /function setAppHeight\(\)/, `${name} must keep setAppHeight()`);
    assert.match(source, /html,\s*\n\s*body[\s\S]*?overflow:\s*hidden/, `${name} must keep fixed mobile body shell`);
    assert.match(source, /\.app-shell[\s\S]*?position:\s*relative[\s\S]*?height:\s*var\(--app-height\)[\s\S]*?overflow:\s*hidden/, `${name} must keep fixed app shell`);
  }
});

test('Phase 220 keeps desktop selectors inside the 1024px media boundary', () => {
  const nonDesktopCss = stripDesktopMedia(cssSource);
  assert.doesNotMatch(nonDesktopCss, /\.desktop-/);
  assert.doesNotMatch(nonDesktopCss, /\.landlord-desktop-/);

  assert.match(cssSource, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(cssSource, /:focus-visible/);
  assert.match(cssSource, /min-height:\s*44px/);
  assert.match(cssSource, /font-size:\s*16px/);
  assert.match(cssSource, /position:\s*sticky/);
});

test('Phase 220 provides identical desktop navigation and preserves release-version navigation', () => {
  const labels = ['總覽', '房客', '物件與房間', '合約', '退房', '帳款'];
  for (const [name, source] of Object.entries(pages)) {
    assert.match(source, /class="desktop-sidebar"/, `${name} must render desktop sidebar`);
    assert.match(source, /class="desktop-topbar"/, `${name} must render desktop topbar`);
    assert.match(source, /desktopWorkspaceName/, `${name} must expose workspace label`);
    assert.match(source, /desktopRoleLabel/, `${name} must expose role label`);
    assert.match(source, /desktopLogoutButton/, `${name} must expose logout action`);
    assert.match(source, /window\.CMWEBS_RELEASE_VERSION/, `${name} must use release-version navigation`);
    assert.match(source, /TEST_MODE[\s\S]*?'\&test=1'/, `${name} must preserve test-mode navigation params`);
    for (const label of labels) {
      assert.match(source, new RegExp(label), `${name} missing desktop nav label ${label}`);
    }
  }
});

test('Phase 220 exposes desktop table and panel hooks while preserving existing action handlers', () => {
  assert.match(pages['landlord-home.html'], /dashboard-kpi-grid desktop-kpi-row/);
  assert.match(pages['landlord-home.html'], /desktop-panel-grid/);
  assert.match(pages['landlord-home.html'], /landlord-payment-report-review\.html/);
  assert.match(pages['landlord-home.html'], /landlord-contract-requests\.html/);

  assert.match(pages['landlord-tenants.html'], /tenant-table-wrap desktop-table-wrap/);
  assert.match(pages['landlord-tenants.html'], /tenant-desktop-table/);
  assert.match(pages['landlord-tenants.html'], /id="tenantSearch"/);
  assert.match(pages['landlord-tenants.html'], /goCreateTenant\(\)/);
  assert.match(pages['landlord-tenants.html'], /goTenantDetail\('/);
  assert.match(pages['landlord-tenants.html'], /shareTenantBindingInvite\(event\)/);

  assert.match(pages['landlord-properties.html'], /property-desktop-table-wrap desktop-table-wrap/);
  assert.match(pages['landlord-properties.html'], /room-desktop-table/);
  assert.match(pages['landlord-properties.html'], /goTenantPaperBackfill\('/);
  assert.match(pages['landlord-properties.html'], /goTenantCreate\('/);
  assert.match(pages['landlord-properties.html'], /toggleRoomAccount\('/);
  assert.match(pages['landlord-properties.html'], /openRoomEditor\('/);
});

test('Phase 220 documents focused viewport checks at required widths', () => {
  const requiredWidths = [375, 390, 768, 1024, 1440];
  for (const width of requiredWidths) {
    assert.match(cssSource, new RegExp(`phase220-width-${width}`));
  }
});
