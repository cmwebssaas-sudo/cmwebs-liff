import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

const pageNames = [
  'landlord-home.html',
  'landlord-tenants.html',
  'landlord-properties.html',
  'landlord-settings.html',
  'landlord-arrears.html',
  'landlord-contract-requests.html'
];
const entrySource = readFileSync(
  new URL('../landlord-entry.html', import.meta.url),
  'utf8'
);

const pages = Object.fromEntries(
  pageNames.map((name) => [
    name,
    readFileSync(new URL('../' + name, import.meta.url), 'utf8')
  ])
);

const legacyOperationalPages = [
  'landlord-arrears.html',
  'landlord-contract-requests.html'
];

const cssUrl = new URL('../landlord-responsive.css', import.meta.url);
const cssExists = existsSync(cssUrl);
const cssSource = cssExists ? readFileSync(cssUrl, 'utf8') : '';

function extractAtRuleBlocks(css, atRulePattern) {
  const blocks = [];
  let searchIndex = 0;

  while (searchIndex < css.length) {
    const remaining = css.slice(searchIndex);
    const match = remaining.match(atRulePattern);
    if (!match || match.index === undefined) break;

    const start = searchIndex + match.index;
    const blockStart = css.indexOf('{', start);
    assert.notEqual(blockStart, -1, 'at-rule block must include an opening brace');

    let depth = 0;
    let end = blockStart;
    for (; end < css.length; end += 1) {
      const char = css[end];
      if (char === '{') depth += 1;
      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }

    assert.equal(depth, 0, 'at-rule block braces must balance');
    blocks.push({
      start,
      end,
      body: css.slice(blockStart + 1, end - 1),
      full: css.slice(start, end)
    });
    searchIndex = end;
  }

  return blocks;
}

function cssWithoutBlocks(css, blocks) {
  let output = css;
  for (const block of blocks.toReversed()) {
    output = output.slice(0, block.start) + output.slice(block.end);
  }
  return output;
}

function extractStyleBlocks(source) {
  return [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(
    (match) => match[1]
  );
}

function extractTopLevelCssRuleBlocks(css, selector) {
  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, ' ')
  );
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const selectorPattern = new RegExp(
    `(?:^|})\\s*${escapedSelector}\\s*\\{`,
    'g'
  );
  const blocks = [];
  let match;

  while ((match = selectorPattern.exec(cssWithoutComments))) {
    const selectorStart = cssWithoutComments.indexOf(selector, match.index);
    const openingBrace = cssWithoutComments.indexOf('{', selectorStart);
    assert.notEqual(openingBrace, -1, `${selector} rule must include an opening brace`);

    let depthBefore = 0;
    for (let index = 0; index < selectorStart; index += 1) {
      if (cssWithoutComments[index] === '{') depthBefore += 1;
      if (cssWithoutComments[index] === '}') depthBefore -= 1;
    }

    let depth = 0;
    let end = openingBrace;
    for (; end < cssWithoutComments.length; end += 1) {
      const char = cssWithoutComments[end];
      if (char === '{') depth += 1;
      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }

    assert.equal(depth, 0, `${selector} rule braces must balance`);
    if (depthBefore === 0) {
      blocks.push({
        body: cssWithoutComments.slice(openingBrace + 1, end - 1)
      });
    }
    selectorPattern.lastIndex = end;
  }

  return blocks;
}

function parseCssDeclarations(ruleBody) {
  return ruleBody
    .split(';')
    .map((declaration) => declaration.match(/^\s*([\w-]+)\s*:\s*([\s\S]+?)\s*$/))
    .filter(Boolean)
    .map((match) => ({
      property: match[1].toLowerCase(),
      value: match[2]
    }));
}

function splitCssValueTokens(value) {
  const tokens = [];
  let token = '';
  let parentheses = 0;

  for (const char of value.trim()) {
    if (/\s/.test(char) && parentheses === 0) {
      if (token) {
        tokens.push(token);
        token = '';
      }
      continue;
    }
    token += char;
    if (char === '(') parentheses += 1;
    if (char === ')') parentheses -= 1;
  }

  if (token) tokens.push(token);
  return tokens;
}

function hasNavAndSafeAreaReserve(value) {
  return (
    /var\s*\(\s*--nav-height(?:\s*,[^)]*)?\s*\)/i.test(value) &&
    /env\s*\(\s*safe-area-inset-bottom(?:\s*,[^)]*)?\s*\)/i.test(value)
  );
}

function hasBottomPaddingReserve(declarations) {
  return declarations.some(({ property, value }) => {
    if (property === 'padding-bottom' || property === 'padding-block-end') {
      return hasNavAndSafeAreaReserve(value);
    }

    const tokens = splitCssValueTokens(value);
    if (property === 'padding') {
      const bottomToken =
        tokens.length <= 2 ? tokens[0] : tokens[2];
      return Boolean(bottomToken) && hasNavAndSafeAreaReserve(bottomToken);
    }
    if (property === 'padding-block') {
      const bottomToken = tokens.length > 1 ? tokens[1] : tokens[0];
      return Boolean(bottomToken) && hasNavAndSafeAreaReserve(bottomToken);
    }
    return false;
  });
}

function assertMobilePageShellContract(source, name) {
  const styleSource = extractStyleBlocks(source).join('\n');
  const pageRules = extractTopLevelCssRuleBlocks(styleSource, '.page');
  const hasPageContract = pageRules.some((rule) => {
    const declarations = parseCssDeclarations(rule.body);
    const height = declarations.find(({ property }) => property === 'height');
    const overflowY = declarations.find(({ property }) => property === 'overflow-y');

    return (
      height?.value.replace(/\s+/g, '') === '100%' &&
      overflowY?.value.replace(/\s+/g, '') === 'auto' &&
      hasBottomPaddingReserve(declarations)
    );
  });

  assert.equal(
    hasPageContract,
    true,
    `${name} must keep a top-level .page rule with height:100%, overflow-y:auto, and nav/safe-area bottom reserve`
  );
}

test('Phase 220 requires the shared landlord desktop stylesheet', () => {
  assert.equal(cssExists, true, 'landlord-responsive.css must exist');
  assert.match(cssSource, /--desktop-sidebar-width:\s*256px/);
  assert.match(cssSource, /--desktop-content-max:\s*1440px/);
  assert.match(cssSource, /--desktop-gap:\s*24px/);
  assert.match(cssSource, /@media\s*\(min-width:\s*1024px\)/);
});

test('Phase 244 keeps the entry bottom navigation inside the mobile app shell contract', () => {
  assert.match(
    entrySource,
    /<div class="app-shell desktop-ready">[\s\S]*?<main class="page desktop-main">[\s\S]*?<\/main>\s*<nav class="bottom-nav">/,
    'entry bottom navigation must remain an app-shell child after the full-height page'
  );
  assertMobilePageShellContract(entrySource, 'landlord-entry.html');

  const entryStyles = extractStyleBlocks(entrySource).join('\n');
  const bottomNavRules = extractTopLevelCssRuleBlocks(entryStyles, '.bottom-nav');
  assert.equal(bottomNavRules.some((rule) => {
    const declarations = parseCssDeclarations(rule.body);
    return declarations.some(({ property, value }) => property === 'position' && value === 'absolute') &&
      declarations.some(({ property, value }) => property === 'bottom' && value === '0') &&
      declarations.some(({ property, value }) => property === 'padding-bottom' && /safe-area-inset-bottom/.test(value));
  }), true, 'entry bottom navigation must be positioned within the overflow-hidden shell with safe-area clearance');

  const desktopCss = extractAtRuleBlocks(cssSource, /@media\s*\(min-width:\s*1024px\)/)
    .map((block) => block.full)
    .join('\n');
  assert.match(desktopCss, /\.bottom-nav[\s\S]*?display:\s*none/);
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

test('Phase 220 binds the mobile .page shell contract to each page CSS rule', () => {
  for (const [name, source] of Object.entries(pages)) {
    assertMobilePageShellContract(source, name);
  }
});

test('Phase 220 keeps desktop selectors inside the 1024px media boundary', () => {
  const desktopBlocks = extractAtRuleBlocks(
    cssSource,
    /@media\s*\(min-width:\s*1024px\)/
  );
  assert.equal(desktopBlocks.length, 1, 'exactly one desktop media block is expected');

  const desktopCss = desktopBlocks.map((block) => block.body).join('\n');
  const nonDesktopCss = cssWithoutBlocks(cssSource, desktopBlocks);

  assert.doesNotMatch(nonDesktopCss, /\.desktop-/);
  assert.doesNotMatch(nonDesktopCss, /\.landlord-desktop-/);

  assert.match(cssSource, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(desktopCss, /:focus-visible/);
  assert.match(desktopCss, /min-height:\s*44px/);
  assert.match(desktopCss, /\.desktop-sidebar[\s\S]*?display:\s*flex/);
  assert.match(desktopCss, /\.desktop-table-wrap[\s\S]*?display:\s*block/);
  assert.match(desktopCss, /\.bottom-nav[\s\S]*?display:\s*none/);
  assert.match(desktopCss, /position:\s*sticky/);
});

test('Phase 220 desktop typography uses at least 16px text', () => {
  const desktopCss = extractAtRuleBlocks(
    cssSource,
    /@media\s*\(min-width:\s*1024px\)/
  ).map((block) => block.body).join('\n');

  const fontSizes = [...desktopCss.matchAll(/font-size:\s*(\d+)px/g)]
    .map((match) => Number(match[1]));

  assert.ok(fontSizes.length > 0, 'desktop CSS should declare explicit type sizes');
  for (const size of fontSizes) {
    assert.ok(size >= 16, `desktop font-size ${size}px is below 16px`);
  }
});

test('Phase 220 provides identical desktop navigation and preserves release-version navigation', () => {
  const labels = ['總覽', '房客', '物件與房間', '合約', '退房', '帳款'];
  for (const [name, source] of Object.entries(pages)) {
    const expectedLabels = legacyOperationalPages.includes(name)
      ? labels.filter((label) => label !== '退房')
      : labels;
    assert.match(source, /class="desktop-sidebar"/, `${name} must render desktop sidebar`);
    assert.match(source, /class="desktop-topbar"/, `${name} must render desktop topbar`);
    assert.match(source, /desktopWorkspaceName/, `${name} must expose workspace label`);
    assert.match(source, /desktopRoleLabel/, `${name} must expose role label`);
    assert.match(source, /desktopLogoutButton/, `${name} must expose logout action`);
    assert.match(source, /window\.CMWEBS_RELEASE_VERSION/, `${name} must use release-version navigation`);
    assert.match(
      source,
      /TEST_MODE[\s\S]*(?:'\&test=1'|params\.set\('test',\s*'1'\))/,
      `${name} must preserve test-mode navigation params`
    );
    for (const label of expectedLabels) {
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

  assert.match(pages['landlord-settings.html'], /emailVerificationPanel\(/);
  assert.match(pages['landlord-settings.html'], /landlord_settings_init/);
});

test('Phase 220 integrates the shared landlord auth client before protected page bootstrap', () => {
  for (const [name, source] of Object.entries(pages)) {
    assert.match(source, /<script src="landlord-auth\.js"><\/script>/, `${name} must load the shared auth client`);
    assert.match(source, /async function ensureLandlordAuthReady\(\)/, `${name} must expose a shared auth readiness gate`);
    assert.match(source, /await ensureLandlordAuthReady\(\)[\s\S]*?jsonpRequest\(/, `${name} must await auth before the first page API bootstrap`);
    assert.match(source, /window\.CMWebsLandlordAuth\.getRequestAuthParams\(\)/, `${name} must derive request identity from the shared auth envelope`);
    assert.match(source, /handleAuthFailure\(result\)/, `${name} must route auth failures through the shared handler`);
    assert.doesNotMatch(source, /['"]&line_user_id=|&line_user_id=/, `${name} must not hard-code line_user_id into page JSONP URLs`);
  }
});

test('Phase 220 keeps entry and protected pages on one auth module boundary', () => {
  assert.match(entrySource, /<script src="landlord-auth\.js"><\/script>/);
  assert.match(entrySource, /getRequestAuthParams\(\)/);
  assert.doesNotMatch(
    entrySource,
    /landlord_session_token[\s\S]{0,120}(?:location\.href|location\.replace|buildPageUrl)/,
    'entry page must not place Email session tokens in navigation URLs'
  );

  for (const source of Object.values(pages)) {
    assert.doesNotMatch(
      source,
      /landlord_session_token[\s\S]{0,120}(?:script\.src|url\s*\+=|location\.href|location\.replace)/,
      'protected pages must keep Email session transport out of GET/navigation URLs'
    );
  }
});

test('Phase 220 keeps settings protected bootstrap on the shared auth transport', () => {
  const source = pages['landlord-settings.html'];

  assert.match(source, /<link[^>]+href="landlord-responsive\.css"/);
  assert.match(source, /<div class="app-shell desktop-ready">/);
  assert.match(source, /<main class="page desktop-main">/);
  assert.match(source, /async function ensureLandlordAuthReady\(\)/);
  assert.match(source, /const authParams = window\.CMWebsLandlordAuth\.getRequestAuthParams\(\)/);
  assert.match(source, /handleAuthFailure\(result\)/);
  assert.doesNotMatch(source, /\?v2_action=[^"']*&line_user_id=/);
});

test('Phase 220 completes the shared desktop shell for legacy operational pages', () => {
  for (const name of legacyOperationalPages) {
    const source = pages[name];

    assert.match(source, /<link[^>]+href="landlord-responsive\.css"/);
    assert.match(source, /<script src="landlord-auth\.js"><\/script>/);
    assert.match(source, /<script src="landlord-api\.js"><\/script>/);
    assert.match(source, /<div class="app-shell desktop-ready">/);
    assert.match(source, /<aside class="desktop-sidebar"[^>]+hidden>/);
    assert.match(source, /<main class="page desktop-main">/);
    assert.match(source, /<header class="desktop-topbar"[^>]+hidden>/);
    assert.match(source, /class="desktop-nav"[\s\S]*?landlord-home\.html/);
    assert.match(source, /landlord-contract-requests\.html/);
    assert.match(source, /landlord-arrears\.html/);
    assert.match(source, /desktopWorkspaceName/);
    assert.match(source, /desktopRoleLabel/);
    assert.match(source, /desktopLogoutButton/);
    assert.match(source, /function setAppHeight\(\)/);
    assert.match(source, /function desktopLogout\(\)/);
    assert.match(source, /function updateDesktopChrome\(/);
    assert.match(
      source,
      /async function ensureLandlordAuthReady\(\)[\s\S]*?await ensureLandlordAuthReady\(\)[\s\S]*?jsonpRequest\(/,
      `${name} must await the shared auth boundary before its protected bootstrap`
    );
    assert.match(source, /window\.CMWebsLandlordAuth\.getRequestAuthParams\(\)/);
    assert.doesNotMatch(source, /['"]&line_user_id=|&line_user_id=/);
    assert.doesNotMatch(
      source,
      /landlord_session_token[\s\S]{0,120}(?:script\.src|url\s*\+=|location\.href|location\.replace)/,
      `${name} must not place the Email session token in a URL`
    );
  }
});

test('Phase 220 fails closed before unsupported desktop Email operations can timeout or claim success', () => {
  for (const name of legacyOperationalPages) {
    const source = pages[name];
    const callApiStart = source.indexOf('function callApi');
    const bridgeCall = source.indexOf('window.CMWebsLandlordAuth.request(', callApiStart);
    const guardCall = source.indexOf('assertDesktopEmailActionSupported(action)', callApiStart);

    assert.ok(callApiStart >= 0, `${name} must expose its API boundary`);
    assert.ok(guardCall >= 0, `${name} must guard unsupported desktop Email actions`);
    assert.ok(bridgeCall > guardCall, `${name} must fail before entering the Email bridge`);
    assert.match(
      source,
      /function assertDesktopEmailActionSupported\([\s\S]*?throw error;/,
      `${name} must throw an explicit unsupported-state error`
    );
    assert.match(source, /DESKTOP_EMAIL_UNSUPPORTED/);
    assert.match(source, /桌面 Email 版目前尚未支援/);
  }
});

test('Phase 220 preserves legacy action and modal contracts while making desktop modals usable', () => {
  const arrears = pages['landlord-arrears.html'];
  assert.match(arrears, /id="app"/);
  assert.match(arrears, /id="manualReminderModal"[^>]*class="modal-mask desktop-modal"/);
  assert.match(arrears, /id="settlementModal"[^>]*class="modal-mask desktop-modal"/);
  assert.match(arrears, /id="alertModal"[^>]*class="alert-mask desktop-modal"/);
  for (const marker of [
    'openManualReminderModal',
    'closeManualReminderModal',
    'submitManualReminder',
    'openSettlementModal',
    'closeSettlementModal',
    'submitSettlement',
    'loadPage'
  ]) {
    assert.match(arrears, new RegExp(`(?:function|onclick=)[\\s\\S]*${marker}`));
  }

  const contracts = pages['landlord-contract-requests.html'];
  assert.match(contracts, /id="app"/);
  assert.match(contracts, /id="requestModal"[^>]*class="modal-mask desktop-modal"/);
  assert.match(contracts, /id="landlordInviteModal"[^>]*class="modal-mask desktop-modal"/);
  assert.match(contracts, /id="confirmModal"[^>]*class="modal-mask desktop-modal"/);
  assert.match(contracts, /id="alertModal"[^>]*class="modal-mask desktop-modal"/);
  for (const marker of [
    'openRequestModal',
    'closeRequestModal',
    'approveActiveRequest',
    'rejectActiveRequest',
    'requestComplete',
    'loadPage'
  ]) {
    assert.match(contracts, new RegExp(`(?:function|onclick=)[\\s\\S]*${marker}`));
  }
  assert.match(
    contracts,
    /@media\s*\(min-width:\s*1024px\)[\s\S]*?#requestModal\.desktop-modal[\s\S]*?bottom:\s*0/
  );
  assert.match(
    contracts,
    /#requestModal\.desktop-modal \.modal-sheet[\s\S]*?overflow-y:\s*auto/
  );
});

test('Phase 220 keeps native contract sessions separate and fails closed on desktop Email auth', () => {
  const source = pages['landlord-contract-requests.html'];
  const nativeStart = source.indexOf('async function callNativeSigningReviewApi');
  const initiatedStart = source.indexOf('async function callLandlordInitiatedApi');
  assert.ok(nativeStart >= 0);
  assert.ok(initiatedStart > nativeStart);

  const nativeSource = source.slice(nativeStart, initiatedStart);
  assert.doesNotMatch(nativeSource, /landlord_session_token/);
  assert.match(nativeSource, /session_token:\s*NATIVE_SIGNING_REVIEW_SESSION_TOKEN/);
  assert.match(source, /DESKTOP_EMAIL_UNSUPPORTED/);
  assert.match(source, /僅支援 LINE 手機流程/);
});

test('Phase 220 does not expose a broken checkout page from the desktop operational sidebar', () => {
  for (const name of legacyOperationalPages) {
    assert.doesNotMatch(
      pages[name],
      /landlord-tenant-checkout\.html/,
      `${name} must not expose checkout without its required contract_id and auth shell`
    );
  }
});

test('Phase 220 validates required viewport contracts from actual selectors and properties', () => {
  const desktopCss = extractAtRuleBlocks(
    cssSource,
    /@media\s*\(min-width:\s*1024px\)/
  ).map((block) => block.body).join('\n');

  const expectations = [
    { width: 375, desktop: false },
    { width: 390, desktop: false },
    { width: 768, desktop: false },
    { width: 1024, desktop: true },
    { width: 1440, desktop: true }
  ];

  for (const expectation of expectations) {
    for (const [name, source] of Object.entries(pages)) {
      assert.match(source, /<div class="app-shell desktop-ready">/, `${name} keeps app shell at ${expectation.width}`);
      assert.match(source, /<main class="page desktop-main">/, `${name} keeps page scroller at ${expectation.width}`);
      assert.match(source, /<nav class="bottom-nav">/, `${name} keeps bottom nav markup at ${expectation.width}`);
      assert.match(source, /function setAppHeight\(\)/, `${name} keeps visualViewport app-height handler at ${expectation.width}`);
      assertMobilePageShellContract(source, `${name} at ${expectation.width}px`);
      assert.match(source, /class="desktop-sidebar"[^>]*hidden/, `${name} hides desktop sidebar by default at ${expectation.width}`);
      assert.match(source, /class="desktop-topbar"[^>]*hidden/, `${name} hides desktop topbar by default at ${expectation.width}`);
    }

    if (expectation.desktop) {
      assert.match(desktopCss, /\.app-shell\.desktop-ready[\s\S]*?grid-template-columns:\s*var\(--desktop-sidebar-width\) minmax\(0, 1fr\)/);
      assert.match(desktopCss, /\.desktop-sidebar,\s*\n\s*\.desktop-sidebar\[hidden\][\s\S]*?display:\s*flex/);
      assert.match(desktopCss, /\.desktop-topbar,\s*\n\s*\.desktop-topbar\[hidden\][\s\S]*?display:\s*flex/);
      assert.match(desktopCss, /\.desktop-table-wrap,\s*\n\s*\.desktop-table-wrap\[hidden\][\s\S]*?display:\s*block/);
      assert.match(desktopCss, /\.bottom-nav[\s\S]*?display:\s*none/);
    } else {
      assert.doesNotMatch(cssWithoutBlocks(cssSource, extractAtRuleBlocks(cssSource, /@media\s*\(min-width:\s*1024px\)/)), /\.desktop-sidebar[^{]*\{[\s\S]*?display:\s*flex/);
      assert.doesNotMatch(cssWithoutBlocks(cssSource, extractAtRuleBlocks(cssSource, /@media\s*\(min-width:\s*1024px\)/)), /\.desktop-table-wrap[^{]*\{[\s\S]*?display:\s*block/);
      assert.doesNotMatch(cssWithoutBlocks(cssSource, extractAtRuleBlocks(cssSource, /@media\s*\(min-width:\s*1024px\)/)), /\.bottom-nav[^{]*\{[\s\S]*?display:\s*none/);
    }
  }
});
