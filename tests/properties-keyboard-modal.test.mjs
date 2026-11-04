import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const page = fs.readFileSync(new URL('../landlord-properties.html', import.meta.url), 'utf8');

function loadHelpers(environment) {
  const start = page.indexOf('    function setAppHeight()');
  const end = page.indexOf('    function rawText(value)');
  assert.ok(start > 0 && end > start);
  const context = vm.createContext(environment);
  vm.runInContext(page.slice(start, end), context);
  return context;
}

function documentWith(sheet, field) {
  const classes = new Set();
  return {
    activeElement: field,
    getElementById: id => id === 'editorSheet' ? sheet : null,
    documentElement: {
      style: { setProperty() {} },
      classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)) }
    },
    classes
  };
}

test('editing a room scrolls the focused field into the middle of the sheet', () => {
  const field = { tagName: 'INPUT', getBoundingClientRect: () => ({ top: -400, height: 46 }) };
  const sheet = {
    scrollTop: 600,
    clientHeight: 234,
    contains: node => node === field,
    getBoundingClientRect: () => ({ top: 14 })
  };
  const document = documentWith(sheet, field);
  const context = loadHelpers({ document, window: { innerHeight: 812 } });

  context.keepFocusedFieldVisible();
  // Field sat 414px above the sheet top; it now sits centred in the sheet.
  assert.equal(sheet.scrollTop, Math.round(600 - 414 - (234 - 46) / 2));
});

test('the keyboard-open class drops the bottom-nav padding only while typing', () => {
  const document = documentWith(null, null);
  const window = { innerHeight: 812, visualViewport: { height: 420 } };
  const context = loadHelpers({ document, window, Math });

  context.setAppHeight();
  assert.equal(document.classes.has('keyboard-open'), true);
  window.visualViewport.height = 800;
  context.setAppHeight();
  assert.equal(document.classes.has('keyboard-open'), false);

  assert.match(page, /html\.keyboard-open \.modal-backdrop \{\s*padding-bottom: 14px;/);
  assert.match(page, /addEventListener\('focusin'[\s\S]{0,120}setTimeout\(keepFocusedFieldVisible, 350\)/);
});
