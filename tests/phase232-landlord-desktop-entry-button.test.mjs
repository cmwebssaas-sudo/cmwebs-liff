import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('landlord-more.html', 'utf8');

assert.match(
  source,
  /<a[^>]+id="desktopEntryButton"[^>]+href="landlord-entry\.html\?mode=email&return_to=landlord-home\.html"[^>]+target="_blank"[^>]+rel="noopener"/s,
  'landlord more page must expose a safe external desktop-entry Email link'
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
