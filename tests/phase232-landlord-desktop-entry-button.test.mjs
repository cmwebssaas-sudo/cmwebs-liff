import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('landlord-more.html', 'utf8');

assert.match(
  source,
  /<button[^>]+id="desktopEntryButton"[^>]+type="button"[^>]+onclick="openDesktopShareModal\(\)"/s,
  'landlord more page must open a share modal before the desktop entry flow'
);

assert.doesNotMatch(
  source,
  /id="desktopEntryButton"[^>]+href=/s,
  'the desktop entry must not navigate before the user shares the URL'
);

assert.match(
  source,
  /<div class="desktop-entry-title">開啟桌面版<\/div>/,
  'desktop entry must have a clear visible title'
);

assert.match(
  source,
  /Email 驗證碼登入/,
  'desktop entry must explain that it uses Email OTP login'
);

console.log('Phase 232 landlord desktop entry button tests passed.');
