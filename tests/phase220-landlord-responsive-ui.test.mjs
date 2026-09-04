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
