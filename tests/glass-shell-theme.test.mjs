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

const pageCss = () => {
  const css = read('landlord-glass-theme.css');
  return css.slice(css.indexOf('Page colours at every width'));
};

test('page colours apply at every width; phone layouts stay in the phone query', () => {
  const pages = pageCss();
  const shared = pages.slice(0, pages.indexOf('/* Phone page layouts'));
  assert.ok(!shared.includes('@media'), 'colour rules are not width-scoped');
  assert.match(shared, /\.app-shell \.card:is\(\.hero, \.header-card\)/, 'coloured page heroes become light glass');
  assert.match(shared, /\.btn\.btn-primary, \.create-tenant-button, \.save-button/, 'green primary actions become navy');
  const phone = pages.slice(pages.indexOf('/* Phone page layouts'), pages.indexOf('/* Desktop page layouts'));
  const blocks = phone.split('@media').slice(1);
  assert.ok(blocks.length >= 3);
  for (const block of blocks) assert.match(block, /^ \(max-width: 1023px\)/);
  assert.match(phone, /\.app-shell \.summary-grid \{\s*grid-template-columns: repeat\(2/, 'stats use two columns on phones');
  assert.match(phone, /\(min-width: 340px\) \{\s*\.app-shell :is\(\.profile-summary, \.request-grid, \.action-grid, \.request-info-grid\)/);
  assert.match(phone, /\.request-info:has\(\.amount-compare\) \{\s*grid-column: 1 \/ -1;/, 'rent comparisons span the card');
});

test('desktop layouts only widen grids on desktop widths', () => {
  const desktop = pageCss().slice(pageCss().indexOf('/* Desktop page layouts'));
  const blocks = desktop.split('@media').slice(1);
  assert.equal(blocks.length, 2);
  assert.match(blocks[0], /^ \(min-width: 1024px\)/);
  assert.match(blocks[1], /^ \(min-width: 1280px\)/);
  assert.match(desktop, /\.room-grid \{\s*grid-template-columns: repeat\(3/);
  assert.match(desktop, /:has\(> \.arrears-card\) \{\s*display: grid;/);
});

test('every desktop rail item has its own icon and a label', () => {
  for (const page of pages.filter(page => page !== 'landlord-entry.html')) {
    const nav = read(page).match(/<nav class="desktop-nav">([\s\S]*?)<\/nav>/)[1];
    const items = [...nav.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(m => m[1]);
    assert.ok(items.length >= 8, page);
    const icons = items.map(item => item.match(/<svg[\s\S]*?<\/svg>/)?.[0].replace(/\s+/g, ' '));
    assert.ok(icons.every(Boolean), `${page}: every item has an icon`);
    assert.equal(new Set(icons).size, icons.length, `${page}: icons are distinct`);
    assert.ok(items.every(item => /<span>[^<]+<\/span>$/.test(item)), `${page}: labels are tooltips`);
  }
});
