import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Catch loss of keyboard state or field/save-button reveal when the viewport shrinks.
const source = fs.readFileSync('landlord-rooms.html', 'utf8');
function setup({width = 390, height = 340, focused = true} = {}) {
  const flags = new Map(), styles = new Map();
  const page = {scrollTop: 400, getBoundingClientRect: () => ({top: 0, bottom: height})};
  const button = {getBoundingClientRect: () => ({top: 640, bottom: 684})};
  const editor = {querySelector: () => button};
  const field = {matches: () => true, closest: () => editor, getBoundingClientRect: () => ({top: 580, bottom: 626})};
  const document = {activeElement: focused ? field : {matches: () => false}, querySelector: () => page,
    documentElement: {style: {setProperty: (k,v) => styles.set(k,v)}, classList: {toggle: (k,v) => flags.set(k,v)}}};
  const c = vm.createContext({document, window: {innerWidth: width, innerHeight: 780, visualViewport: {height}},
    requestAnimationFrame: fn => fn()});
  vm.runInContext(source.slice(source.indexOf('    function setAppHeight()'), source.indexOf('    function goPage(')), c);
  return {c, page, flags, styles, document};
}
test('mobile keyboard resize keeps URL and save button inside the scrollable viewport', () => {
  const s = setup(); s.c.setAppHeight();
  assert.equal(s.styles.get('--app-height'), '340px');
  assert.equal(s.flags.get('room-input-active'), true);
  assert.equal(s.page.scrollTop, 760); // 684 - (340 - 16), plus current400
});
test('desktop focus does not enter mobile input layout or move the page', () => {
  const s = setup({width: 1280}); s.c.setAppHeight();
  assert.equal(s.flags.get('room-input-active'), false);
  assert.equal(s.page.scrollTop, 400);
});
test('leaving the field restores normal navigation without changing drafts or scroll', () => {
  const s = setup({focused: false}); s.c.setAppHeight();
  assert.equal(s.flags.get('room-input-active'), false);
  assert.equal(s.page.scrollTop, 400);
});
