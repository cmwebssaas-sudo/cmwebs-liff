import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const pages = execSync('git grep -l \'landlord-glass-nav.js\' -- "*.html"', { cwd: root, encoding: 'utf8' }).trim().split('\n');
const release = read('frontend-release.js').match(/CMWEBS_RELEASE_VERSION = '([^']+)'/)[1];

test('every glass-nav page loads the theme last and the shell script at the release version', () => {
  assert.ok(pages.length >= 11, 'main landlord pages are covered');
  for (const page of pages) {
    const source = read(page);
    const head = source.slice(0, source.indexOf('</head>'));
    const theme = `<link rel="stylesheet" href="landlord-glass-theme.css?v=${release}" />`;
    assert.ok(head.trimEnd().endsWith(theme), `${page}: theme is the last thing in <head>`);
    assert.ok(head.lastIndexOf('</style>') < head.indexOf(theme), `${page}: theme follows the inline styles`);
    assert.ok(head.includes(`<script src="landlord-glass-shell.js?v=${release}" defer></script>`), page);
  }
});

test('card and button rules stay at single-class specificity so page variants still win', () => {
  const css = read('landlord-glass-theme.css');
  const cardRule = css.match(/^(:where\(\.app-shell\) :is\(\.card[^{]+)\{/m);
  assert.ok(cardRule, 'card rule is scoped with :where');
  for (const coloured of ['.hero', '.home-hero', '.header-card', '.tenant-filter-card', '.dashboard-chart-error']) {
    assert.ok(cardRule[1].includes(coloured), `${coloured} keeps its own background`);
  }
  assert.match(css, /^:where\(\.app-shell\) \.primary-button \{/m);
  assert.match(css, /:where\(\.app-shell\) \.primary-button:where\(:hover:not\(:disabled\)\)/);
});

test('press and hover motion use the scale and translate properties, never transform', () => {
  const css = read('landlord-glass-theme.css');
  const press = css.match(/button:where\(:not\([^)]*\)\):active \{([^}]*)\}/);
  assert.ok(press && /scale: 0\.97/.test(press[1]) && !/transform/.test(press[1]));
  assert.match(press[0], /\.nav-item/, 'bottom nav keeps its own lens motion');
  assert.match(css, /@keyframes glass-rise \{\s*from \{\s*opacity: 0;\s*translate: 0 14px;/);
});

test('entrance motion plays once, respects reduced motion and stops observing', () => {
  const script = read('landlord-glass-shell.js');
  assert.match(script, /prefers-reduced-motion: reduce/);
  assert.match(script, /observer\.disconnect\(\)/);
  assert.match(script, /GIVE_UP_MS = \d+/);
  assert.match(script, /home-skeleton-page/, 'skeletons do not animate');
});

test('phone page layouts stay inside the phone media query', () => {
  const css = read('landlord-glass-theme.css');
  const phone = css.slice(css.indexOf('Phone page layouts (redesign phase 3)'));
  assert.ok(phone.length > 0);
  const blocks = phone.split('@media').slice(1);
  assert.ok(blocks.length >= 4);
  for (const block of blocks) assert.match(block, /^ \(max-width: 1023px\)/);
  assert.match(phone, /\.app-shell \.card:is\(\.hero, \.header-card\)/, 'coloured page heroes become light glass');
  assert.match(phone, /\.app-shell \.summary-grid \{\s*grid-template-columns: repeat\(2/, 'stats use two columns on phones');
});

test('tenant detail and contract requests keep two-column grids on phones', () => {
  const css = read('landlord-glass-theme.css');
  const batch = css.slice(css.indexOf('Tenant detail and contract requests on phones'));
  assert.ok(batch.length > 0);
  for (const block of batch.split('@media').slice(1)) assert.match(block, /^ \(max-width: 1023px\)/);
  assert.match(batch, /\(min-width: 340px\) \{\s*\.app-shell :is\(\.profile-summary, \.request-grid, \.action-grid, \.request-info-grid\)/);
  assert.match(batch, /\.request-info:has\(\.amount-compare\) \{\s*grid-column: 1 \/ -1;/, 'rent comparisons span the card');
});
