import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const createPage = readFileSync('landlord-tenant-create.html', 'utf8');
const checkinPage = readFileSync('landlord-tenant-checkin.html', 'utf8');
const entryPage = readFileSync('landlord-entry.html', 'utf8');

function extractFunction(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `${name} must exist`);
  let depth = 0;
  for (let index = source.indexOf('{', match.index); index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) {
      return source.slice(match.index, index + 1);
    }
  }
  throw new Error(`${name} is not closed`);
}

const saved = new Map();
const sessionStorage = {
  getItem: key => saved.get(key) || null,
  setItem: (key, value) => saved.set(key, String(value)),
  removeItem: key => saved.delete(key)
};
const createContext = vm.createContext({
  URL,
  location: {
    href: 'https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-tenant-create.html?property_id=P1&room_id=R506&code=oauth-secret&state=oauth-state'
  },
  sessionStorage,
  LANDLORD_ENTRY_URL: 'https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-entry.html'
});
vm.runInContext(extractFunction(createPage, 'buildLandlordLoginRedirectUri'), createContext);

const redirect = new URL(createContext.buildLandlordLoginRedirectUri());
assert.equal(redirect.pathname, '/cmwebs-liff/landlord-entry.html');
assert.equal(
  redirect.searchParams.get('return_to'),
  'landlord-tenant-create.html?property_id=P1&room_id=R506',
  'the pending room should survive LINE login without OAuth credentials'
);
assert.equal(saved.get('cmwebs_landlord_line_fallback_intent'), '1',
  'a LINE-only write flow must tell the desktop entry to finish LINE authentication');

const calls = [];
const app = { innerHTML: '' };
const entryContext = vm.createContext({
  TEST_MODE: false,
  EMAIL_LOGIN_MODE: false,
  STAY_MODE: false,
  LINE_USER_ID: '',
  RETURN_TO: '',
  document: { getElementById: () => app },
  resolveReturnTo: () => saved.get('cmwebs_landlord_return_to') || '',
  initAuthClient: () => ({
    getMode: () => 'email',
    getRequestAuthParams: () => ({ landlord_session_token: 'existing-email-session' }),
    getSessionStatus: () => { throw new Error('Email session must not override LINE intent'); }
  }),
  hasLineFallbackIntent: () => saved.get('cmwebs_landlord_line_fallback_intent') === '1',
  clearLineFallbackIntent: () => saved.delete('cmwebs_landlord_line_fallback_intent'),
  renderEmailLogin: () => calls.push('email'),
  initLine: async () => { calls.push('line'); entryContext.LINE_USER_ID = 'verified-line-user'; return true; },
  isInvitationReturnTo: () => false,
  fetchStatusJson: async () => ({ success: true, data: { route: 'home' } }),
  goReturnTo: () => { calls.push(['return', entryContext.RETURN_TO]); return true; }
});
vm.runInContext(extractFunction(entryPage, 'loadPage'), entryContext);
await entryContext.loadPage();

assert.deepEqual(calls, [
  'line',
  ['return', 'landlord-tenant-create.html?property_id=P1&room_id=R506']
]);
assert.equal(saved.has('cmwebs_landlord_line_fallback_intent'), false,
  'LINE intent is one-shot after a verified landlord status');

createContext.location.href = 'https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-tenant-checkin.html?property_id=P1&room_id=R506&tenant_id=T506&code=oauth-secret&state=oauth-state';
vm.runInContext(extractFunction(checkinPage, 'buildLandlordLoginRedirectUri'), createContext);
const checkinRedirect = new URL(createContext.buildLandlordLoginRedirectUri());
assert.equal(checkinRedirect.searchParams.get('return_to'),
  'landlord-tenant-checkin.html?property_id=P1&room_id=R506&tenant_id=T506');
assert.equal(saved.get('cmwebs_landlord_line_fallback_intent'), '1',
  'the check-in flow must also preserve LINE write intent');
