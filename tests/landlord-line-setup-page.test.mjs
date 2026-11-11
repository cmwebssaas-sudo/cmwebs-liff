import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../landlord-line-setup.html', import.meta.url), 'utf8');
const script = page.slice(page.lastIndexOf('<script>'));

test('channel secrets travel only in the protected POST bridge', () => {
  assert.match(script, /auth\.requestProtected\(action,params\|\|\{\}\)/);
  assert.doesNotMatch(script, /fetch\(|jsonp|\?v2_action=|localStorage|sessionStorage|console\./);
  for (const name of ['messaging_channel_secret', 'messaging_access_token', 'line_login_channel_secret']) {
    assert.match(page, new RegExp('<input type="password" name="' + name + '"'));
  }
  assert.match(page, /<form id="channel-form" autocomplete="off">/);
  assert.match(script, /form\.reset\(\)/);
});

test('the page warns about the irreversible provider choice before anything can be entered', () => {
  assert.match(page, /Provider 選了就不能改/);
  assert.match(page, /同一個 Provider/);
  assert.match(script, /enable\('step-form',ack\)/);
});

test('webhook replacement is opt-in and activation waits for every check', () => {
  assert.match(script, /replace_existing:\$\('replace'\)\.checked\?'true':'false'/);
  assert.match(script, /every\(key=>data\.checks\[key\]===true\)/);
});

test('the phone link only accepts a 32-hex setup code', () => {
  assert.match(script, /\/\^\[a-f0-9\]\{32\}\$\/\.test\(code\)/);
});

test('LIFF ID comes from the shared config, loaded before the page scripts', () => {
  assert.match(script, /CMWebsLiffConfig\.liffId\('landlord'\)/);
  assert.ok(page.indexOf('liff-config.js') < page.indexOf('landlord-auth.js'));
  assert.doesNotMatch(page, /\d{10}-[A-Za-z0-9]{8}/);
});
