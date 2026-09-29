import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const page = readFileSync(new URL('../landlord-tenant-create.html', import.meta.url), 'utf8');
const initiated = readFileSync(new URL('../apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js', import.meta.url), 'utf8');
const signing = readFileSync(new URL('../apps-script/V2_CONTRACT_DOCUMENT_SIGNING.js', import.meta.url), 'utf8');
const expiry = readFileSync(new URL('../apps-script/V2_CONTRACT_EXPIRY_RENEWALS.js', import.meta.url), 'utf8');

const conditions = (contractId, value) => JSON.stringify({
  cmwebs_contract_conditions_v1: { contract_id: contractId, text: value }
});

test('simple new lease renders an optional contract condition field', () => {
  const start = page.indexOf('function renderSimpleNewContractPage()');
  const end = page.indexOf('function paperBackfillRoomOptions(', start);
  assert.ok(start >= 0 && end > start);
  const app = { innerHTML: '' };
  const pageTitle = { textContent: '' };
  const context = {
    PAGE_DATA: { workspace: {}, rooms: [], defaults: {} },
    PRESELECTED_ROOM_ID: '',
    document: { getElementById: id => ({ app, pageTitle })[id] || null },
    resolveRoomLeaseDefaults_: () => ({ deposit_months: 2, payment_day: 10, electricity_fee_rate: 5, equipment_fee_rate: 0, rent_amount: 8500, management_fee: 500, deposit_amount: 18000 }),
    simpleContractEndDate_: () => '',
    safeHtml: value => String(value ?? ''),
    rawText: value => String(value ?? ''),
    simpleRoomOptions: () => '',
    handleSimpleRoomChange: () => {},
    updateSimpleLeaseEndDate_: () => {},
    updateSubmitState: () => {}
  };
  vm.createContext(context);
  vm.runInContext(page.slice(start, end), context);
  context.renderSimpleNewContractPage();
  assert.match(app.innerHTML, /<textarea[^>]*id="note"[^>]*maxlength="500"/);
  assert.match(app.innerHTML, /補充約定|特別約定/);
});

test('both new and renewal inputs preserve a condition; a direct 501-character request is rejected', () => {
  const context = { Date, Math, Number, String, Object, Array, JSON, RegExp };
  vm.createContext(context);
  vm.runInContext(initiated, context);
  const common = {
    room_id: 'R506', start_date: '2026-09-11', end_date: '2027-09-10',
    rent_amount: 8500, management_fee: 500, deposit_amount: 18000,
    payment_day: 10, note: '入住前先完成冷氣清潔'
  };
  for (const input of [common, { ...common, previous_contract_id: 'C-OLD' }]) {
    const result = context.landlordInitiatedContractNormalizeInput_(input);
    assert.equal(result.success, true, result.message);
    assert.equal(result.data.note, '入住前先完成冷氣清潔');
  }
  const tooLong = context.landlordInitiatedContractNormalizeInput_({
    ...common, note: '甲'.repeat(501)
  });
  assert.equal(tooLong.success, false);
});

test('landlord fixed-template contract preview receives the condition for a new or renewed version', () => {
  const context = { Date, Math, Number, String, Object, Array, JSON, RegExp };
  vm.createContext(context);
  vm.runInContext(initiated, context);
  context.tenantContractDocumentPreview_ = contract => ({
    available: true,
    content: `固定合約\n${JSON.parse(contract.terms_snapshot_json).cmwebs_contract_conditions_v1.text}`
  });
  for (const previousContractId of ['', 'C-OLD']) {
    const text = context.landlordInitiatedContractBuildDocument_(
      { user: { name: '房東' } }, { property_id: 'P1' }, { room_id: 'R506' },
      { contract_id: 'C-NEW', terms_snapshot_json: conditions('C-NEW', '入住前先完成冷氣清潔'), start_date: '2026-09-11', end_date: '2027-09-10', rent_amount: 8500, management_fee: 500, deposit_amount: 18000, note: '入住前先完成冷氣清潔', previous_contract_id: previousContractId },
      '房客'
    );
    assert.match(text, /固定合約\n入住前先完成冷氣清潔/);
  }
});

function signingContext() {
  const context = {
    Date, Math, Number, String, Object, Array, JSON, RegExp,
    Utilities: { formatDate: (_value, _timezone, pattern) => ({ yyyy: '2026', M: '9', d: '30', 'yyyy/MM/dd HH:mm:ss': '2026/09/30 08:00:00' })[pattern] || '' }
  };
  vm.createContext(context);
  vm.runInContext(signing, context);
  return context;
}

test('fixed contract preview inserts conditions before signature when template has no note slot', () => {
  const context = signingContext();
  const template = '標準租約正文\n乙方簽名（線上簽署）：＿＿＿＿（待簽署）';
  const preview = context.tenantContractDocumentBuildPreviewText_(
    template, { contract_id: 'C-NEW', terms_snapshot_json: conditions('C-NEW', '入住前先完成冷氣清潔') }, {}, new Date('2026-09-30T00:00:00Z'), {}
  );
  assert.match(preview, /標準租約正文[\s\S]*補充約定（本合約之一部分）：\n入住前先完成冷氣清潔[\s\S]*乙方簽名/);
  assert.equal(preview.split('入住前先完成冷氣清潔').length - 1, 1);
});

test('existing note placeholder is not duplicated and blank notes add no clause', () => {
  const context = signingContext();
  const withSlot = context.tenantContractDocumentBuildPreviewText_(
    '補充約定：{{備註}}\n乙方簽名（線上簽署）',
    { contract_id: 'C-NEW', terms_snapshot_json: conditions('C-NEW', '水費每月結算') }, {}, new Date('2026-09-30T00:00:00Z'), {}
  );
  assert.equal(withSlot.split('水費每月結算').length - 1, 1);
  const withoutNote = context.tenantContractDocumentBuildPreviewText_(
    '標準租約正文\n乙方簽名（線上簽署）',
    { note: '' }, {}, new Date('2026-09-30T00:00:00Z'), {}
  );
  assert.doesNotMatch(withoutNote, /補充約定/);
});

test('signed copy inserts the same condition before its signature block', () => {
  const context = signingContext();
  const body = { children: [] };
  const first = { text: '標準租約正文', getParent: () => body };
  const signature = { text: '乙方簽名（線上簽署）', getParent: () => body };
  body.children.push(first, signature);
  body.getText = () => body.children.map(child => child.text).join('\n');
  body.getChildIndex = child => body.children.indexOf(child);
  body.findText = () => ({ getElement: () => ({ getParent: () => signature }) });
  body.insertParagraph = (index, value) => body.children.splice(index, 0, { text: value, getParent: () => body });
  body.appendParagraph = value => body.children.push({ text: value, getParent: () => body });
  context.tenantContractDocumentEnsureSupplementalConditionsInBody_(
    body, '標準租約正文\n乙方簽名（線上簽署）',
    { contract_id: 'C-NEW', terms_snapshot_json: conditions('C-NEW', '入住前先完成冷氣清潔') }
  );
  assert.match(body.getText(), /標準租約正文\n補充約定（本合約之一部分）：\n入住前先完成冷氣清潔\n乙方簽名/);
});

test('legacy notes and copied previous-version conditions never enter a new signature', () => {
  const context = signingContext();
  const template = '補充約定：{{備註}}\n乙方簽名（線上簽署）';
  for (const contract of [
    { contract_id: 'C-NEW', note: '內部催繳紀錄', landlord_note: '不對房客公開' },
    { contract_id: 'C-NEW', note: '舊條件', terms_snapshot_json: conditions('C-OLD', '舊約不可沿用') }
  ]) {
    const preview = context.tenantContractDocumentBuildPreviewText_(template, contract, {}, new Date('2026-09-30T00:00:00Z'), {});
    assert.doesNotMatch(preview, /內部催繳|不對房客公開|舊約不可沿用|舊條件/);
  }
});

test('only newly entered conditions are marked for the newly generated version', () => {
  const context = { Date, Math, Number, String, Object, Array, JSON, RegExp };
  vm.createContext(context);
  vm.runInContext(initiated, context);
  const inherited = conditions('C-OLD', '舊約條件');
  const fresh = context.landlordInitiatedContractConditionsSnapshot_(inherited, '新條件', 'C-NEW');
  assert.equal(fresh.success, true);
  assert.deepEqual(JSON.parse(fresh.data).cmwebs_contract_conditions_v1, { contract_id: 'C-NEW', text: '新條件' });
  const blank = context.landlordInitiatedContractConditionsSnapshot_(inherited, '', 'C-NEW');
  assert.equal(blank.success, true);
  assert.equal(blank.data, '');
  assert.equal(context.landlordInitiatedContractConditionsSnapshot_('not-json', '新條件', 'C-NEW').success, false);
  assert.doesNotMatch(expiry, /note:\s*previous\.note\s*\|\|/);
});

test('landlord contract creation refuses to save a condition when the fixed preview cannot place it', () => {
  assert.match(initiated, /const newContent = landlordInitiatedContractBuildDocument_\(/);
  assert.match(initiated, /if \(normalized\.data\.note && !newContent\) return landlordInitiatedContractError_\(/);
  assert.match(initiated, /const renewalContent = landlordInitiatedContractBuildDocument_\(/);
  assert.match(initiated, /if \(normalized\.data\.note && !renewalContent\) return landlordInitiatedContractError_\(/);
});

test('inline-image-only signature template rejects a condition unless it has a note slot', () => {
  const context = signingContext();
  const contract = { contract_id: 'C-NEW', terms_snapshot_json: conditions('C-NEW', '新條件') };
  assert.throws(() => context.tenantContractDocumentBuildPreviewText_('標準租約正文\n簽名圖片', contract, {}, new Date(), {}), /CONTRACT_CONDITIONS_SLOT_NOT_FOUND/);
  const body = { findText: () => null, appendParagraph: () => assert.fail('must not append after signature') };
  assert.throws(() => context.tenantContractDocumentEnsureSupplementalConditionsInBody_(body, '標準租約正文\n簽名圖片', contract), /CONTRACT_CONDITIONS_SLOT_NOT_FOUND/);
  assert.match(context.tenantContractDocumentBuildPreviewText_('補充約定：{{備註}}\n簽名圖片', contract, {}, new Date(), {}), /新條件/);
});

test('new and renewal fixed-template preview agree with the signed copy, without releasing an unsafe image-slot copy', () => {
  for (const { kind, template, value, shouldFail } of [
    { kind: 'new', template: '租約正文\n乙方簽名（線上簽署）', value: '新約現場條件' },
    { kind: 'renewal', template: '租約正文\n補充約定：{{備註}}\n乙方簽名（線上簽署）', value: '續約新條件' },
    { kind: 'renewal', template: '租約正文\n乙方簽名（線上簽署）', value: '' },
    { kind: 'new', template: '租約正文\n簽名圖片', value: '必須在簽名前', shouldFail: true }
  ]) {
    const context = signingContext();
    const contract = {
      contract_id: `C-${kind}`, workspace_id: 'W1', tenant_id: 'T1',
      note: '舊的內部紀錄',
      terms_snapshot_json: value ? conditions(`C-${kind}`, value) : ''
    };
    const makeBody = () => {
      const body = { children: [] };
      body.children = template.split('\n').map(text => ({ text, getParent: () => body }));
      body.getText = () => body.children.map(child => child.text).join('\n');
      body.getChildIndex = child => body.children.indexOf(child);
      body.findText = () => {
        const child = body.children.find(entry => entry.text.includes('乙方簽名（線上簽署）'));
        return child ? { getElement: () => ({ getParent: () => child }) } : null;
      };
      body.insertParagraph = (index, text) => body.children.splice(index, 0, { text, getParent: () => body });
      body.editAsText = () => ({ replaceText: (pattern, replacement) => {
        body.children.forEach(child => { child.text = child.text.replace(new RegExp(pattern, 'g'), replacement); });
      } });
      return body;
    };
    const templateBody = makeBody();
    const copyBody = makeBody();
    let trashed = false;
    let saved = false;
    let appended = false;
    const copy = {
      getId: () => 'copy-id', setSharing: () => {},
      setTrashed: value => { trashed = value; }
    };
    context.tenantContractDocumentTemplateId_ = () => 'template-id';
    context.tenantContractDocumentRootFolder_ = () => ({ success: true, data: {} });
    context.tenantContractDocumentResolveContext_ = () => ({});
    context.tenantContractDocumentEnsureSchema_ = () => ({});
    context.tenantContractDocumentFindExisting_ = () => null;
    context.tenantContractDocumentReplaceSignature_ = () => true;
    context.tenantContractDocumentAppend_ = () => { appended = true; };
    context.SpreadsheetApp = { getActiveSpreadsheet: () => ({}) };
    context.Utilities.getUuid = () => 'document-record-id';
    context.DocumentApp = { openById: id => ({
      getBody: () => id === 'template-id' ? templateBody : copyBody,
      saveAndClose: () => { saved = true; }
    }) };
    context.DriveApp = {
      Access: { PRIVATE: 'PRIVATE' }, Permission: { NONE: 'NONE' },
      getFileById: id => id === 'template-id'
        ? { makeCopy: () => copy }
        : { getBlob: () => ({}) }
    };
    const preview = context.tenantContractDocumentPreview_(contract, {});
    const materialized = context.tenantContractDocumentMaterialize_(contract, {}, 'artifact-id', 'signature-id');
    if (shouldFail) {
      assert.equal(preview.available, false);
      assert.equal(materialized.success, false);
      assert.equal(trashed, true);
      assert.equal(appended, false);
      continue;
    }
    assert.equal(preview.available, true);
    assert.equal(materialized.success, true);
    assert.equal(saved, true);
    assert.equal(appended, true);
    assert.doesNotMatch(preview.content, /舊的內部紀錄/);
    assert.doesNotMatch(copyBody.getText(), /舊的內部紀錄/);
    if (value) {
      assert.ok(preview.content.indexOf(value) < preview.content.indexOf('乙方簽名'));
      assert.ok(copyBody.getText().indexOf(value) < copyBody.getText().indexOf('乙方簽名'));
    } else {
      assert.doesNotMatch(preview.content, /補充約定/);
      assert.doesNotMatch(copyBody.getText(), /補充約定/);
    }
  }
});
