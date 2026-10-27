import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

// LIFF SDK 2.31+ throws from getIDToken() until liff.init() has run. The
// Email entry page reads auth params before any LIFF init, so the shared
// helpers must treat that as "no LINE token" instead of failing the page.
function windowWithUninitialisedLiff() {
  const window = {
    liff: { getIDToken() { throw new Error('liffId is necessary for liff.init()'); } },
    location: { href: 'https://example.test/cmwebs-liff/landlord-entry.html?mode=email' },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }
  };
  window.window = window;
  return vm.createContext(Object.assign(window, { URL, Set, String, Number, Math, Date, Object, Error, JSON }));
}

test('landlord auth params survive an uninitialised LIFF SDK', () => {
  const context = windowWithUninitialisedLiff();
  vm.runInContext(read('landlord-auth.js'), context);
  const auth = context.CMWebsLandlordAuth.init({ liffId: 'synthetic' });
  assert.equal(auth.getMode(), 'line');
  assert.deepEqual({ ...auth.getRequestAuthParams() }, { line_user_id: '', id_token: '' });
});

test('shared LIFF request auth treats an uninitialised SDK as no token', () => {
  const context = windowWithUninitialisedLiff();
  vm.runInContext(read('liff-request-auth.js'), context);
  assert.equal(context.CMWebsLiffRequestAuth.getIdToken(), '');
  assert.throws(
    () => context.CMWebsLiffRequestAuth.withIdToken('https://example.test/exec?v2_action=landlord_home'),
    { code: 'AUTH_REQUIRED' }
  );
});

test('entry desktop rail items carry an icon and a label', () => {
  const nav = read('landlord-entry.html').match(/<nav class="desktop-nav"[^>]*>([\s\S]*?)<\/nav>/)[1];
  const items = [...nav.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(m => m[1]);
  assert.equal(items.length, 2);
  assert.ok(items.every(item => /^<svg[\s\S]*<\/svg><span>[^<]+<\/span>$/.test(item)));
});

test('register page uses the glass theme with a padded card', () => {
  const page = read('landlord-register.html');
  assert.match(page, /<link rel="stylesheet" href="landlord-glass-theme\.css\?v=[^"]+" \/>\s*<\/head>/);
  assert.match(page, /\.register-card \{ padding: 24px 22px; \}/);
  assert.match(page, /<section class="card register-card">\s*<h1>建立房東帳號<\/h1>/);
  assert.match(page, /<div class="method-switch" aria-label="註冊方式">/);
});
