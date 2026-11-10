import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const page = readFileSync(new URL('../landlord-contract-requests.html', import.meta.url), 'utf8');
const extract = name => {
  const start = page.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' must exist');
  let depth = 0;
  for (let i = page.indexOf('{', start); i < page.length; i++) {
    if (page[i] === '{') depth++;
    if (page[i] === '}') depth--;
    if (!depth) return page.slice(start, i + 1);
  }
  throw new Error('unterminated ' + name);
};

function loadCopy() {
  const copied = [];
  const alerts = [];
  const context = vm.createContext({
    ACTIVE_LANDLORD_INVITE: null,
    ACTIVE_LANDLORD_INVITE_RESULT: null,
    navigator: { clipboard: { writeText: async text => { copied.push(text); } } },
    showAlert: (title, body) => alerts.push(title + '|' + body)
  });
  vm.runInContext(
    ['rawText', 'normalizeStatus', 'landlordInviteCopyText'].map(extract).join('\n') +
      '\nasync ' + extract('copyLandlordInviteLink'),
    context
  );
  return { context, copied, alerts };
}

test('a freshly reissued renewal invite copies the link, confirmation code and signing instructions', async () => {
  const { context, copied, alerts } = loadCopy();
  context.ACTIVE_LANDLORD_INVITE = { contract_id: 'C1', signing_mode: 'renewal', invite_url: 'https://example.test/old' };
  context.ACTIVE_LANDLORD_INVITE_RESULT = { url: 'https://example.test/new', confirmation_code: '123456' };
  await context.copyLandlordInviteLink();
  assert.equal(copied[0],
    '請開啟房客續約簽署邀請：\nhttps://example.test/new\n\n確認碼：123456\n\n' +
    '請用本人 LINE 開啟連結，確認新版合約內容並完成線上簽署。房東審核通過後合約才會生效。');
  assert.match(alerts[0], /^已複製邀請訊息\|/);
});

test('a new-tenant invite uses the contract wording', async () => {
  const { context, copied } = loadCopy();
  context.ACTIVE_LANDLORD_INVITE = { contract_id: 'C2', signing_mode: 'new' };
  context.ACTIVE_LANDLORD_INVITE_RESULT = { url: 'https://example.test/n', confirmation_code: '654321' };
  await context.copyLandlordInviteLink();
  assert.match(copied[0], /^請開啟房客合約邀請：\nhttps:\/\/example\.test\/n\n\n確認碼：654321/);
});

test('without a confirmation code only the link is copied and the landlord is told to reissue', async () => {
  const { context, copied, alerts } = loadCopy();
  context.ACTIVE_LANDLORD_INVITE = { contract_id: 'C1', signing_mode: 'renewal', invite_url: 'https://example.test/old' };
  await context.copyLandlordInviteLink();
  assert.equal(copied[0], 'https://example.test/old');
  assert.match(alerts[0], /^已複製邀請連結\|.*重新產生邀請/);
});

test('the copy button says it includes the code when one is shown', () => {
  assert.match(page, /confirmationCode \? '複製邀請訊息（含確認碼）' : '複製邀請連結'/);
});
