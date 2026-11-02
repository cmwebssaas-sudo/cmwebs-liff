import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');

test('privacy page stays a static public page', () => {
  assert.doesNotMatch(html, /<script/i);
  assert.match(html, /<title>CMWebs 隱私權政策<\/title>/);
});

test('privacy page discloses the Google Drive backup use', () => {
  assert.match(html, /CMWebs Core Backup/);
  assert.match(html, /不讀取該帳號的其他檔案/);
  assert.match(html, /不會用於廣告/);
});

test('privacy page gives a contact and the rights section', () => {
  assert.match(html, /mailto:cmwebs\.saas@gmail\.com/);
  assert.match(html, /個人資料保護法/);
});
