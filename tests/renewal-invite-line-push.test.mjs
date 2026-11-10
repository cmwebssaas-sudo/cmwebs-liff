import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js', import.meta.url), 'utf8');
const extract = name => {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' must exist');
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    if (!depth) return source.slice(start, i + 1);
  }
  throw new Error('unterminated ' + name);
};

function load({ tenants = [], push = () => ({ success: true }) } = {}) {
  const pushes = [];
  const context = vm.createContext({
    landlordInitiatedContractText_: v => String(v == null ? '' : v).trim(),
    landlordInitiatedContractRows_: () => tenants,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => ({}) }) },
    pushLineTextMessage_: (to, text, retryKey, workspaceId) => { pushes.push({ to, text, retryKey, workspaceId }); return push(); }
  });
  vm.runInContext(['landlordInitiatedContractSendSigningInviteByLine_', 'landlordInitiatedContractTenantLineUserId_', 'landlordInitiatedContractSigningInviteText_'].map(extract).join('\n'), context);
  return { send: context.landlordInitiatedContractSendSigningInviteByLine_, pushes };
}

const created = () => ({
  success: true,
  data: {
    contract: { contract_id: 'C1', tenant_id: 'T1', workspace_id: 'W1', signing_mode: 'renewal', property_name: 'no88', room_name: '403', start_date: '2026-10-03', end_date: '2027-10-02' },
    invite: { invite_id: '11111111-2222-3333-4444-555555555555', url: 'https://example.test/invite', confirmation_code: '123456' }
  }
});

test('a bound tenant receives the signing link, code and instructions by LINE', () => {
  const { send, pushes } = load({ tenants: [{ tenant_id: 'T1', workspace_id: '', tenant_line_user_id: 'U-tenant' }] });
  const result = send(created());
  assert.equal(result.success, true);
  assert.deepEqual({ ...result.data.line_notification }, { sent: true, code: 'OK', message: '已用 LINE 把簽約邀請發給房客' });
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].to, 'U-tenant');
  assert.equal(pushes[0].workspaceId, 'W1');
  assert.equal(pushes[0].retryKey, '11111111-2222-3333-4444-555555555555', 'retries reuse the invite id so LINE never sends twice');
  assert.match(pushes[0].text, /^【CMWebs 續約簽署邀請】/);
  assert.match(pushes[0].text, /https:\/\/example\.test\/invite/);
  assert.match(pushes[0].text, /確認碼：123456/);
  assert.match(pushes[0].text, /房東審核通過後合約才會生效/);
});

test('the contract LINE id is used before looking up the tenant', () => {
  const { send, pushes } = load({ tenants: [{ tenant_id: 'T1', tenant_line_user_id: 'U-other' }] });
  const result = created();
  result.data.contract.tenant_line_user_id = 'U-contract';
  send(result);
  assert.equal(pushes[0].to, 'U-contract');
});

test('an unbound tenant keeps the invite and asks the landlord to send it', () => {
  const { send, pushes } = load({ tenants: [{ tenant_id: 'T1' }] });
  const result = send(created());
  assert.equal(result.success, true);
  assert.equal(result.data.invite.confirmation_code, '123456');
  assert.equal(result.data.line_notification.sent, false);
  assert.equal(result.data.line_notification.code, 'TENANT_LINE_UID_MISSING');
  assert.equal(pushes.length, 0);
});

test('a LINE failure or exception never undoes the created invite', () => {
  for (const push of [() => ({ success: false, code: 'LINE_PUSH_FAILED' }), () => { throw new Error('network'); }]) {
    const { send } = load({ tenants: [{ tenant_id: 'T1', tenant_line_user_id: 'U-tenant' }], push });
    const result = send(created());
    assert.equal(result.success, true);
    assert.equal(result.data.line_notification.sent, false);
  }
});

test('a tenant row from another workspace is not used', () => {
  const { send, pushes } = load({ tenants: [{ tenant_id: 'T1', workspace_id: 'W2', tenant_line_user_id: 'U-foreign' }] });
  assert.equal(send(created()).data.line_notification.sent, false);
  assert.equal(pushes.length, 0);
});

test('failed creations pass through untouched', () => {
  const { send, pushes } = load();
  const failed = { success: false, code: 'ROOM_ALREADY_RESERVED' };
  assert.equal(send(failed), failed);
  assert.equal(pushes.length, 0);
});

test('quick renewal and reissue both send after the lock is released', () => {
  assert.match(source, /function landlordInitiatedContractCreateDirectRenewal_\(access, input\) \{\n  return landlordInitiatedContractSendSigningInviteByLine_\(landlordInitiatedContractWithScriptLock_\(/);
  assert.match(source, /function landlordInitiatedContractReissueBySession_\(sessionToken, inviteId\) \{\n  return landlordInitiatedContractSendSigningInviteByLine_\(landlordInitiatedContractWithScriptLock_\(/);
});
