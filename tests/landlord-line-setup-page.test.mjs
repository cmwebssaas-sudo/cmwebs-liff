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

test('the replaced webhook URL is shown and can be restored after a confirmation', () => {
  assert.match(page, /CMWebs 取代前的網址/);
  assert.match(script, /if\(!confirm\('確定把 Webhook 改回[^']*'\)\)return;\s*const data=await call\('landlord_line_setup_webhook_restore'\)/);
});

test('the default menu changes only after publishing, trying and an explicit confirmation', () => {
  assert.match(script, /if\(!\$\('menu-confirm'\)\.checked\)\{say\('請先勾選確認。'\);return;\}/);
  assert.match(script, /enable\('step-menu',ack&&!!channel&&channel\.status==='active'\)/);
  assert.match(page, /發布選單（還不會換掉房客的選單）/);
  for (const palette of ['forest', 'ocean', 'terracotta', 'charcoal']) assert.match(page, new RegExp('value="' + palette + '"'));
  assert.match(script, /\$\('phone-preview'\)\.hidden=!\(data\.provider_match&&data\.channel_active\)/);
});

test('the move check is read-only and names only who still has to add the OA', () => {
  assert.match(page, /id="audience">查看好友與額度<\/button>/);
  assert.match(page, /call\('landlord_line_setup_audience'\)/);
  assert.doesNotMatch(page.slice(page.indexOf('function showAudience'), page.indexOf("$('audience')")), /innerHTML|line_user_id/);
});
