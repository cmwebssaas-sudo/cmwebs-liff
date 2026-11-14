import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../landlord-tenant-detail.html', import.meta.url), 'utf8');

function pageFunction(name) {
  const match = new RegExp('(?:async )?function ' + name + '\\(').exec(html);
  assert.ok(match, 'missing ' + name);
  for (let end = html.indexOf('}', match.index); end !== -1; end = html.indexOf('}', end + 1)) {
    const candidate = html.slice(match.index, end + 1);
    try { new vm.Script(candidate); return candidate; } catch (_) {}
  }
  throw new Error('unterminated ' + name);
}

test('the whole tenant detail script still parses', () => {
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  scripts.forEach(source => new vm.Script(source));
});

test('paper buttons show only on a renewal still waiting for the tenant', () => {
  const context = vm.createContext({ String });
  vm.runInContext([pageFunction('rawText'), pageFunction('normalizedStatus'), pageFunction('canPaperSignRenewal')].join('\n'), context);
  const can = contract => vm.runInContext('canPaperSignRenewal(' + JSON.stringify(contract) + ')', context);
  assert.equal(can({ signing_mode: 'renewal', contract_status: 'pending_tenant_signature', tenant_signing_submission_status: 'pending' }), true);
  assert.equal(can({ signing_mode: 'renewal', contract_status: 'awaiting_tenant_signature' }), true);
  assert.equal(can({ signing_mode: 'renewal', contract_status: 'pending_tenant_signature', tenant_signing_submission_status: 'submitted' }), false);
  assert.equal(can({ signing_mode: 'renewal', contract_status: 'active' }), false);
  assert.equal(can({ signing_mode: 'new_tenant', contract_status: 'pending_tenant_signature' }), false);
});

test('both buttons call the POST-only paper routes through the verified landlord request', () => {
  const history = pageFunction('renderContractHistory');
  assert.match(history, /canPaperSignRenewal\(contract\)/);
  assert.match(history, /下載合約（紙本簽署）/);
  assert.match(history, /上傳已簽合約/);
  assert.match(pageFunction('downloadPaperRenewalContract'), /requestTenantInitialMeterAction\('landlord_contract_paper_signing_document'/);
  assert.match(pageFunction('downloadPaperRenewalContract'), /previewTenantDocument\(data\.document_id\)/);
  const submit = pageFunction('submitPaperRenewalUpload');
  assert.match(submit, /requestTenantInitialMeterAction\('landlord_contract_paper_signing_upload'/);
  assert.match(submit, /idempotency_key: PAPER_RENEWAL_UPLOAD_KEY/);
  assert.match(submit, /window\.confirm/);
});
