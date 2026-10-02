import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewServer } from '../scripts/preview-landlord-home.mjs';

test('mobile preview is directly reachable but cannot serve repository files or submit data', async () => {
  const server = createPreviewServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const mobile = await fetch(base + '/mobile');
    assert.equal(mobile.status, 200, 'a directly openable phone-sized preview must exist');
    assert.match(mobile.headers.get('content-security-policy'), /frame-src 'self'/,
      'the wrapper must allow its same-origin phone iframe');
    const html = await mobile.text();
    assert.match(html, /<iframe[^>]+src="\/"/);
    assert.match(html, /title="手機版房東首頁預覽"/);
    const page = await fetch(base + '/');
    assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'self'/);
    assert.match(page.headers.get('content-security-policy'), /connect-src 'none'/);
    assert.match(page.headers.get('content-security-policy'), /form-action 'none'/);
    assert.equal((await fetch(base + '/landlord-auth.js')).status, 404);
    assert.equal((await fetch(base + '/.git/config')).status, 404);
    assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
