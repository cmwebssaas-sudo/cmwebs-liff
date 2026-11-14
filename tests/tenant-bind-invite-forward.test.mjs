import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

// 合約簽署邀請連結 liff.line.me/2010314940-iJB1D6sN?invite_id=… 一律先開
// tenant-bind.html（房客 LIFF 端點）。綁定頁必須把邀請送到簽約頁，否則已綁定
// 的房客會被帶回首頁，永遠看不到要簽的合約。
const source = readFileSync('tenant-bind.html', 'utf8');
const INVITE_ID = '3288a3e1-a6f8-46ee-b355-c17b0d041964';
const PAGE = 'https://cmwebssaas-sudo.github.io/cmwebs-liff/tenant-bind.html';

function extractFunction(functionName) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${functionName}\\s*\\(`).exec(source);
  assert.ok(match, `missing function ${functionName}`);
  const bodyStart = source.indexOf('{', match.index);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(match.index, index + 1);
    }
  }
  throw new Error(`unterminated function ${functionName}`);
}

function inviteTarget(search, { testMode = false } = {}) {
  const href = PAGE + search;
  const context = createContext({
    URL,
    URLSearchParams,
    location: { href },
    window: { CMWEBS_RELEASE_VERSION: '20261114-bind-invite-forward-v1' },
    URL_PARAMS: new URLSearchParams(new URL(href).search),
    TEST_MODE: testMode,
    rawText(value) {
      return value === undefined || value === null ? '' : String(value);
    }
  });
  runInContext(
    ['preserveTestQuery_', 'buildInviteContractTarget_'].map(extractFunction).join('\n'),
    context
  );
  return runInContext('buildInviteContractTarget_()', context);
}

test('first open: the invite id inside liff.state goes to the contract page', () => {
  const target = new URL(inviteTarget('?liff.state=' + encodeURIComponent('?invite_id=' + INVITE_ID)));
  assert.equal(target.pathname, '/cmwebs-liff/tenant-contract.html');
  assert.equal(target.searchParams.get('invite_id'), INVITE_ID);
  assert.equal(target.searchParams.get('v'), '20261114-bind-invite-forward-v1');
});

test('after the LIFF redirect: a plain invite_id goes to the contract page', () => {
  const target = new URL(inviteTarget('?invite_id=' + INVITE_ID));
  assert.equal(target.pathname, '/cmwebs-liff/tenant-contract.html');
  assert.equal(target.searchParams.get('invite_id'), INVITE_ID);
});

test('test mode is kept on the contract page', () => {
  const target = new URL(inviteTarget('?invite_id=' + INVITE_ID + '&test=1', { testMode: true }));
  assert.equal(target.searchParams.get('test'), '1');
});

test('no invite, or a malformed one, keeps the normal binding flow', () => {
  assert.equal(inviteTarget(''), '');
  assert.equal(inviteTarget('?next=tenant-bills.html'), '');
  assert.equal(inviteTarget('?invite_id=probe-test'), '');
  assert.equal(inviteTarget('?liff.state=' + encodeURIComponent('/tenant-home.html')), '');
});

test('the forward runs after LINE login and before the binding check', () => {
  const loadPage = extractFunction('loadPage');
  const login = loadPage.indexOf('initLine()');
  const forward = loadPage.indexOf('buildInviteContractTarget_()');
  const bindingCheck = loadPage.indexOf("'tenant_binding_status'");
  assert.ok(login >= 0 && forward > login, 'forward must follow LINE login so the LIFF token is stored');
  assert.ok(bindingCheck > forward, 'forward must happen before the binding check sends the tenant home');
});
