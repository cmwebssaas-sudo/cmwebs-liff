import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../apps-script/V2_TENANT_CONTRACT_SIGNING_REVIEW.js', import.meta.url), 'utf8');

class Sheet {
  constructor(headers, rows) {
    this.headers = headers;
    this.rows = rows;
  }

  getLastRow() { return this.rows.length + 1; }
  getLastColumn() { return this.headers.length; }
  getDataRange() {
    return { getValues: () => [this.headers.slice(), ...this.rows.map(row => row.slice())] };
  }
  getRange() {
    return { getDisplayValues: () => [this.headers.slice()] };
  }
}

const headers = [
  'contract_id', 'workspace_id', 'tenant_id', 'contract_status',
  'tenant_signing_submission_status', 'tenant_signing_submitted_at',
  'tenant_signed_at', 'signing_mode', 'tenant_signing_reviewed_at',
  'tenant_signing_reviewed_by_user_id', 'tenant_signing_reviewed_by_membership_id',
  'tenant_signing_review_note', 'updated_at'
];
const sheet = new Sheet(headers, [
  ['C603-2026', 'W1', 'T603', 'renewed', 'approved', '', '2026-08-25T00:00:00.000Z', 'new_tenant'],
  ['C603-2027', 'W1', 'T603', 'pending_tenant_signature', 'submitted', '2026-08-27T00:00:00.000Z', '', 'renewal'],
  ['C604-2026', 'W1', 'T604', 'active', 'approved', '', '2026-08-25T00:00:00.000Z', 'new_tenant'],
  ['OTHER-2026', 'W2', 'T999', 'active', 'approved', '', '2026-08-25T00:00:00.000Z', 'new_tenant']
]);

const context = {
  Date, Math, Number, String, Object, Array, JSON, RegExp,
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({ getSheetByName: name => name === 'V2_contracts' ? sheet : null })
  }
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'V2_TENANT_CONTRACT_SIGNING_REVIEW.js' });
context.tenantContractSigningReviewAccessFromSession_ = () => ({
  success: true,
  data: { workspace: { workspace_id: 'W1' } }
});

const pending = context.getLandlordContractSigningReviewsBySessionToken_('session');
assert.equal(pending.success, true, pending.code);
assert.deepEqual(pending.data.items.map(item => item.contract_id), ['C603-2027']);

const completed = context.getLandlordContractSigningReviewsBySessionToken_('session', 'C603-2026', 'T603');
assert.equal(completed.success, true, completed.code);
assert.deepEqual(completed.data.items.map(item => item.contract_id), ['C603-2026']);
assert.equal(completed.data.items[0].tenant_signing_submission_status, 'approved');

const wrongTenant = context.getLandlordContractSigningReviewsBySessionToken_('session', 'C603-2026', 'T604');
assert.equal(wrongTenant.success, false);
assert.equal(wrongTenant.code, 'CONTRACT_NOT_FOUND');

const otherWorkspace = context.getLandlordContractSigningReviewsBySessionToken_('session', 'OTHER-2026');
assert.equal(otherWorkspace.success, false);
assert.equal(otherWorkspace.code, 'CONTRACT_NOT_FOUND');

console.log('Phase 176 contract history review runtime tests passed.');
