import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const pages = execSync('git grep -l \'class="bottom-nav"\' -- "*.html"', { cwd: root, encoding: 'utf8' })
  .trim().split('\n').filter(page => read(page).includes('landlord-responsive.css'));

test('every landlord page with the shared stylesheet loads the glass nav script at the release version', () => {
  assert.ok(pages.length >= 11, 'main landlord pages are covered');
  const release = read('frontend-release.js').match(/CMWEBS_RELEASE_VERSION = '([^']+)'/)[1];
  for (const page of pages) {
    const source = read(page);
    assert.match(source, new RegExp(`<script src="landlord-glass-nav\\.js\\?v=${release}" defer></script>`), page);
  }
});

test('glass styles apply only on phones after the script marks the bar ready', () => {
  const css = read('landlord-responsive.css');
  const block = css.slice(css.indexOf('iOS-style liquid glass bottom navigation'));
  assert.match(block, /@media \(max-width: 1023px\)/);
  for (const selector of block.match(/^\s+\.[^{]+\{/gm)) assert.match(selector, /\.bottom-nav\.glass-ready/, selector.trim());
});

test('the bar never scales and, like the iOS tab bar, the lens only spreads sideways inside it', () => {
  const css = read('landlord-responsive.css'), script = read('landlord-glass-nav.js');
  const block = css.slice(css.indexOf('iOS-style liquid glass bottom navigation'));
  assert.doesNotMatch(block, /\.bottom-nav\.glass-ready(\.is-[a-z-]+)?\s*\{[^}]*transform/);
  const [scaleX, scaleY] = script.match(/PRESS_SCALE = \[([\d.]+), ([\d.]+)\]/).slice(1).map(Number);
  assert.ok(scaleX > 1 && scaleX <= 1.15, 'lens is only a touch wider than its tab');
  assert.equal(scaleY, 1, 'lens never grows taller');
  assert.doesNotMatch(script, /scale\([^)]*,\s*(?!1\))[\d.]/, 'every lens frame keeps height 1');
  assert.match(block, /\.is-under-lens\s*\{\s*transform: scale\(1\.08\)/);
});

test('pointer gestures suppress the native click while keyboard clicks still navigate', () => {
  const script = read('landlord-glass-nav.js');
  assert.match(script, /event\.detail > 0 && Date\.now\(\) < suppressUntil/);
  assert.match(script, /prefers-reduced-motion: reduce/);
});

test('the end tabs tug the bar by its edge, the lens has no backdrop filter and held tabs never open link preview', () => {
  const css = read('landlord-responsive.css'), script = read('landlord-glass-nav.js');
  const block = css.slice(css.indexOf('iOS-style liquid glass bottom navigation'));
  // WebKit draws a transformed backdrop filter as a square block.
  assert.doesNotMatch(block.slice(block.indexOf('.glass-pill')), /backdrop-filter:/);
  assert.match(block, /\.nav-item \{[^}]*-webkit-touch-callout: none;/);
  assert.match(script, /marginLeft' : 'marginRight'/);
  assert.match(script, /index !== 0 && index !== items\.length - 1/);
});
