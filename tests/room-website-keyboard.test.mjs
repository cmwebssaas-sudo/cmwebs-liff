import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Catch loss of keyboard state or field/save-button reveal when the viewport shrinks.
const source = fs.readFileSync('landlord-rooms.html', 'utf8');
function setup({width = 390, height = 340, focused = true, offset = 0} = {}) {
  const flags = new Map(), styles = new Map(), viewportEvents = new Map();
  const timers = new Map(); let timerId = 0;
  const page = {scrollTop: 400, getBoundingClientRect: () => ({top: 0, bottom: height})};
  const button = {getBoundingClientRect: () => ({top: 640, bottom: 684})};
  const editor = {querySelector: () => button};
  let fieldBounds = {top: 580, bottom: 626};
  const field = {matches: () => true, closest: () => editor, getBoundingClientRect: () => fieldBounds};
  const document = {addEventListener: () => {}, activeElement: focused ? field : {matches: () => false}, querySelector: () => page,
    documentElement: {style: {setProperty: (k,v) => styles.set(k,v)}, classList: {toggle: (k,v) => flags.set(k,v)}}};
  const c = vm.createContext({document, window: {addEventListener: () => {}, innerWidth: width, innerHeight: 780, visualViewport: {height, offsetTop: offset, addEventListener: (name, fn) => viewportEvents.set(name, fn)}},
    requestAnimationFrame: fn => fn(), setTimeout: fn => {timers.set(++timerId, fn); return timerId;}, clearTimeout: id => timers.delete(id)});
  vm.runInContext(source.slice(source.indexOf('    function setAppHeight()'), source.indexOf('    function goPage(')), c);
  vm.runInContext(source.slice(source.indexOf("    document.addEventListener('focusin'"), source.indexOf('    loadPage(true);')), c);
  return {c, page, flags, styles, document, pan: () => viewportEvents.get('scroll')(), moveField: b => {fieldBounds = b;}, flush: () => {const jobs = [...timers.values()]; timers.clear(); jobs.forEach(fn => fn());}};
}
test('focus resizes the shell without competing with native keyboard scrolling', () => {
  const s = setup(); s.c.setAppHeight();
  assert.equal(s.styles.get('--app-height'), '340px');
  assert.equal(s.flags.get('room-input-active'), true);
  assert.equal(s.page.scrollTop, 400);
});
test('settled viewport leaves a natively revealed URL alone even when save is below it', () => {
  const s = setup(); s.c.scheduleRoomInputReveal(); s.c.scheduleRoomInputReveal();
  s.moveField({top: 200, bottom: 246}); s.flush();
  assert.equal(s.page.scrollTop, 400);
});
test('settled viewport corrects only a still-hidden input by the minimum distance', () => {
  const s = setup(); s.c.scheduleRoomInputReveal(); s.flush();
  assert.equal(s.page.scrollTop, 702); // 626 - (340 - 16), plus current400
});
test('viewport pan is included when determining whether the input is above the visible area', () => {
  const s = setup({height: 340, offset: 120}); s.moveField({top: 90, bottom: 136});
  s.c.scheduleRoomInputReveal(); s.flush();
  assert.equal(s.page.scrollTop, 354); // move down46: visible top120+16 minus input90
});
test('pending reveal never moves the page after the user has left the input', () => {
  const s = setup(); s.c.scheduleRoomInputReveal(); s.document.activeElement = {matches: () => false}; s.flush();
  assert.equal(s.page.scrollTop, 400);
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
test('keyboard pan beyond the resized shell keeps the shell anchored in the visible viewport', () => {
  const s = setup({height: 340, offset: 600});
  s.c.setAppHeight();
  assert.equal(s.styles.get('--app-offset-top'), '600px');
  assert.equal(s.styles.get('--app-height'), '340px');
  assert.equal(s.page.scrollTop, 400);
});
test('late keyboard pan schedules another reveal after resize has already settled', () => {
  const s = setup(); s.moveField({top: 200, bottom: 246});
  s.c.scheduleRoomInputReveal(); s.flush();
  s.c.window.visualViewport.offsetTop = 120;
  s.moveField({top: 90, bottom: 136});
  s.pan(); s.flush();
  assert.equal(s.page.scrollTop, 354);
});
test('keyboard offset is cleared on blur and never shifts the desktop shell', () => {
  const s = setup({offset: 600}); s.c.setAppHeight();
  s.document.activeElement = {matches: () => false}; s.c.setAppHeight();
  assert.equal(s.styles.get('--app-offset-top'), '0px');
  const desktop = setup({width: 1280, offset: 600}); desktop.c.setAppHeight();
  assert.equal(desktop.styles.get('--app-offset-top'), '0px');
});
