import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadCheckinInitLine({ getProfile }) {
  const source = fs.readFileSync('landlord-tenant-checkin.html', 'utf8');
  const start = source.indexOf('function buildLandlordLoginRedirectUri()');
  const end = source.indexOf('\n    function showToast(', start);

  assert.notEqual(start, -1, 'check-in login redirect helper must exist');
  assert.notEqual(end, -1, 'initLine must precede showToast');

  const storage = new Map();
  const calls = { logout: 0, login: [] };
  const context = {
    URL,
    location: {
      href: 'https://example.test/landlord-tenant-checkin.html?room_id=R000020',
      search: '?room_id=R000020'
    },
    sessionStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key)
    },
    LANDLORD_ENTRY_URL: 'https://example.test/landlord-entry.html',
    LIFF_ACCESS_TOKEN_RENEWAL_KEY:
      'cmwebs_landlord_tenant_checkin_liff_renewal_attempted',
    TEST_MODE: false,
    LIFF_ID: 'liff-test',
    LINE_USER_ID: '',
    liff: {
      init: async () => {},
      isLoggedIn: () => true,
      getProfile,
      logout: () => { calls.logout += 1; },
      login: (options) => { calls.login.push(options); }
    }
  };

  vm.runInNewContext(source.slice(start, end), context);
  return { calls, context, storage };
}

{
  const runtime = loadCheckinInitLine({
    getProfile: async () => { throw new Error('The access token expired'); }
  });

  const result = await runtime.context.initLine();

  assert.equal(result, false);
  assert.equal(runtime.calls.logout, 1);
  assert.equal(runtime.calls.login.length, 1);
  assert.equal(
    new URL(runtime.calls.login[0].redirectUri).pathname.slice(1) +
      new URL(runtime.calls.login[0].redirectUri).search,
    'landlord-entry.html?return_to=landlord-tenant-checkin.html%3Froom_id%3DR000020'
  );
}
