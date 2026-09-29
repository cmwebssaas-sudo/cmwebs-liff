import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const page = readFileSync(new URL('../landlord-tenant-create.html', import.meta.url), 'utf8');
const initiated = readFileSync(new URL('../apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js', import.meta.url), 'utf8');
const signing = readFileSync(new URL('../apps-script/V2_CONTRACT_DOCUMENT_SIGNING.js', import.meta.url), 'utf8');

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
    content: `固定合約\n${contract.note || ''}`
  });
  for (const previousContractId of ['', 'C-OLD']) {
    const text = context.landlordInitiatedContractBuildDocument_(
      { user: { name: '房東' } }, { property_id: 'P1' }, { room_id: 'R506' },
      { start_date: '2026-09-11', end_date: '2027-09-10', rent_amount: 8500, management_fee: 500, deposit_amount: 18000, note: '入住前先完成冷氣清潔', previous_contract_id: previousContractId },
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
    template, { note: '入住前先完成冷氣清潔' }, {}, new Date('2026-09-30T00:00:00Z'), {}
  );
  assert.match(preview, /標準租約正文[\s\S]*補充約定（本合約之一部分）：\n入住前先完成冷氣清潔[\s\S]*乙方簽名/);
  assert.equal(preview.split('入住前先完成冷氣清潔').length - 1, 1);
});

test('existing note placeholder is not duplicated and blank notes add no clause', () => {
  const context = signingContext();
  const withSlot = context.tenantContractDocumentBuildPreviewText_(
    '補充約定：{{備註}}\n乙方簽名（線上簽署）',
    { note: '水費每月結算' }, {}, new Date('2026-09-30T00:00:00Z'), {}
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
    { note: '入住前先完成冷氣清潔' }
  );
  assert.match(body.getText(), /標準租約正文\n補充約定（本合約之一部分）：\n入住前先完成冷氣清潔\n乙方簽名/);
});
