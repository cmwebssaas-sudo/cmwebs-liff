import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAssistantHandler } from '../src/assistant.js';
import { DATA_INTENTS } from '../src/assistant-data.js';
import { richDataset, projectedDataset, access, fixture } from '../../../tests/fixtures/read-parity/runtime.mjs';

const origin = 'https://cmwebssaas-sudo.github.io';
const catalog = [{ id: 'reminder', title: '查看誰沒繳、催繳', keywords: ['催繳'] }, { id: 'renewal', title: '續約', keywords: ['續約'] }];
const now = Date.parse(fixture.now);

function build(edit) {
  const input = richDataset();
  if (edit) edit(input);
  const dataset = projectedDataset(input);
  const verified = {
    ...access,
    workspace: dataset.V2_workspaces.find(row => row.workspace_id === access.workspace.workspace_id),
    user: dataset.V2_users.find(row => row.user_id === access.user.user_id),
    membership: dataset.V2_workspace_members.find(row => row.membership_id === access.membership.membership_id),
    principal: dataset.V2_landlords[0]
  };
  verified.principals = [verified.principal];
  return { dataset, verified };
}

// Fake bridge: records what it receives and picks the given id.
async function ask(question, pick, { edit, loaderFails, bridgeReply } = {}) {
  const { dataset, verified } = build(edit);
  const loader = {
    checkReplica: async () => { if (loaderFails) throw Object.assign(new Error('x'), { code: 'READ_SYNC_STALE' }); },
    checkHeartbeat: async () => {},
    loadDataset: async () => dataset
  };
  const calls = [];
  const env = {
    DB: {}, CMWEBS_ASSISTANT_TOKEN: 't', ASSISTANT_AI_WORKSPACES: verified.workspace.workspace_id,
    ASSISTANT_BRIDGE: { async fetch(url, init) { calls.push(JSON.parse(init.body)); return Response.json({ success: true, data: { id: pick, reply: bridgeReply || '模型的話' } }); } }
  };
  const handler = createAssistantHandler({ verify: async () => ({ access: verified, loader, runtimeOptions: { now } }) });
  const response = await handler(new Request('https://read.test/v1/assistant', { method: 'POST',
    headers: { origin, authorization: 'LIFF t', 'content-type': 'application/json' }, body: JSON.stringify({ question, catalog }) }), env);
  return { response, body: await response.json(), calls };
}
const reply = async (...args) => (await ask(...args)).body.data.reply;


const paidFirstMonth = input => Object.assign(input.V2_bills.find(row => row.bill_id === 'SYNTHETIC_B1'), { bill_status: 'paid', paid_amount: 10300, payment_status: 'paid', paid_at: '2026-09-12' });
const manyOverdue = count => input => {
  for (let n = 0; n < count; n += 1) {
    const room = 'SYNTHETIC_RM' + n, tenant = 'SYNTHETIC_TM' + n;
    input.V2_rooms.push({ room_id: room, workspace_id: 'SYNTHETIC_W1', landlord_id: 'SYNTHETIC_L1', property_id: 'SYNTHETIC_P1', room_name: String(300 + n), account_status: 'active', room_status: 'occupied', current_tenant_id: tenant, rent_amount: 5000 });
    input.V2_tenants.push({ tenant_id: tenant, workspace_id: 'SYNTHETIC_W1', landlord_id: 'SYNTHETIC_L1', tenant_name: '房客' + n, room_id: room, property_id: 'SYNTHETIC_P1', account_status: 'active' });
    input.V2_bills.push({ bill_id: 'SYNTHETIC_BM' + n, workspace_id: 'SYNTHETIC_W1', landlord_id: 'SYNTHETIC_L1', tenant_id: tenant, room_id: room, property_id: 'SYNTHETIC_P1', bill_month: '2026-10', bill_status: 'issued', total_amount: 5000, paid_amount: 0, due_date: '2026-10-10' });
  }
};
const renewalSent = input => input.V2_contracts.push({ contract_id: 'SYNTHETIC_CR', workspace_id: 'SYNTHETIC_W1', landlord_id: 'SYNTHETIC_L1', tenant_id: 'SYNTHETIC_T1', room_id: 'SYNTHETIC_R1', property_id: 'SYNTHETIC_P1',
  start_date: '2026-11-01', end_date: '2027-10-31', contract_status: 'pending_tenant_signature', signing_mode: 'renewal', previous_contract_id: 'SYNTHETIC_C1' });

test('a room that is found lists tenant, the three months newest first, and the contract end', async () => {
  assert.equal(await reply('201的房租有繳了嗎？', 'ask_room_payment'), [
    '201 房（合成一館）合成房客甲', '10 月：10,300 元，逾期 2 天、未繳 10,300 元', '9 月：10,300 元，逾期 32 天、未繳 10,300 元', '8 月：還沒開帳單', '合約到期：2026/10/31'].join('\n'));
  assert.equal(await reply('202房租', 'ask_room_payment'), ['202 房（合成一館）', '10 月：空房', '9 月：空房', '8 月：空房'].join('\n'));
});

test('a paid month says 已繳', async () => {
  const text = await reply('201 繳了嗎', 'ask_room_payment', { edit: paidFirstMonth });
  assert.match(text, /\n9 月：10,300 元，已繳\n/);
});

test('a missing, unknown or longer-number room gets a plain answer', async () => {
  assert.equal(await reply('房租有繳了嗎', 'ask_room_payment'), '想查哪一間房？請告訴我房號，例如「302 的房租有繳了嗎？」');
  assert.equal(await reply('302 繳了嗎', 'ask_room_payment'), '我在你的房間裡找不到這間房，請確認房號再問一次。');
  assert.equal(await reply('2010 繳了嗎', 'ask_room_payment'), '我在你的房間裡找不到這間房，請確認房號再問一次。');
});

test('the unpaid list shows each bill with its overdue days', async () => {
  assert.equal(await reply('誰還沒繳', 'ask_unpaid_list'), ['目前 2 筆未繳，共 20,600 元：', '• 201 合成房客甲 9 月 10,300 元，逾期 32 天', '• 201 合成房客甲 10 月 10,300 元，逾期 2 天'].join('\n'));
  const none = await reply('誰還沒繳', 'ask_unpaid_list', { edit: input => { for (const bill of input.V2_bills) if (bill.workspace_id === 'SYNTHETIC_W1') Object.assign(bill, { bill_status: 'paid', paid_amount: bill.total_amount, payment_status: 'paid' }); } });
  assert.equal(none, '目前沒有未繳的帳單。');
});

test('a long unpaid list stops at 15 lines and says how many are left', async () => {
  const text = await reply('誰還沒繳', 'ask_unpaid_list', { edit: manyOverdue(20) });
  const lines = text.split('\n');
  assert.equal(lines[0], '目前 22 筆未繳，共 120,600 元：');
  assert.equal(lines.filter(line => line.startsWith('• ')).length, 15);
  assert.equal(lines.at(-1), '…另外還有 7 筆，請到欠款頁看');
  assert.ok(text.length <= 1500);
});

test('expiring contracts say whether a renewal is waiting for the tenant', async () => {
  assert.equal(await reply('快到期的合約', 'ask_contract_expiry'), ['共 1 筆合約在 60 天內到期或已到期：', '• 合成房間 合成房客甲 2026/10/31 到期，還沒續約'].join('\n'));
  assert.match(await reply('快到期的合約', 'ask_contract_expiry', { edit: renewalSent }), /2026\/10\/31 到期，已發續約，等房客簽名/);
});

test('the bridge sees only the question and the catalog, never landlord data', async () => {
  const { calls } = await ask('201的房租有繳了嗎？', 'ask_room_payment');
  assert.deepEqual(Object.keys(calls[0]).sort(), ['catalog', 'question']);
  assert.deepEqual(calls[0].catalog.slice(-DATA_INTENTS.length).map(item => item.id), DATA_INTENTS.map(item => item.id));
  const wire = JSON.stringify(calls[0]);
  for (const secret of ['合成房客甲', '10300', '10,300', '合成一館', 'SYNTHETIC']) assert.ok(!wire.includes(secret), secret);
});

test('data answers carry no phone, LINE id, email or other private fields', async () => {
  for (const [question, pick] of [['201', 'ask_room_payment'], ['誰沒繳', 'ask_unpaid_list'], ['到期', 'ask_contract_expiry']]) {
    const { body } = await ask(question, pick);
    assert.equal(body.data.kind, 'data');
    assert.ok(!/0912345678|SYNTHETIC|@/.test(JSON.stringify(body)), pick);
  }
});

test("another Workspace's rooms and bills are never answered", async () => {
  assert.match(await reply('999 繳了嗎', 'ask_room_payment'), /找不到這間房/);
  assert.ok(!(await reply('誰沒繳', 'ask_unpaid_list')).includes('999'));
});

test('a data intent ignores the model reply and points at the matching page card', async () => {
  const { body } = await ask('誰沒繳', 'ask_unpaid_list', { bridgeReply: '我猜大概五萬元' });
  assert.equal(body.data.id, 'reminder');
  assert.ok(!body.data.reply.includes('五萬'));
  assert.equal((await ask('快到期', 'ask_contract_expiry')).body.data.id, 'renewal');
});

test('a stale replica answers with the sync message instead of data', async () => {
  const { response, body } = await ask('誰沒繳', 'ask_unpaid_list', { loaderFails: true });
  assert.equal(response.status, 200);
  assert.deepEqual(body, { success: true, data: { id: 'reminder', reply: '資料正在同步，請稍後再問一次。', kind: 'data' } });
});

test('a function reply that only echoes the question becomes empty; a real reply is kept', async () => {
  assert.equal(await reply('302的房租有繳了嗎？', 'reminder', { bridgeReply: '302 的房租有繳了嗎？' }), '');
  assert.equal(await reply('302的房租有繳了嗎？', 'reminder', { bridgeReply: '房租有繳了嗎' }), '');
  assert.equal(await reply('房客要搬走', 'reminder', { bridgeReply: '請到房客頁辦理退房。' }), '請到房客頁辦理退房。');
});

test('client catalogs may not use the reserved ask_ ids', async () => {
  const { dataset, verified } = build();
  const handler = createAssistantHandler({ verify: async () => ({ access: verified, loader: {}, runtimeOptions: { now } }) });
  const response = await handler(new Request('https://read.test/v1/assistant', { method: 'POST', headers: { origin, authorization: 'LIFF t' },
    body: JSON.stringify({ question: 'x', catalog: [{ id: 'ask_unpaid_list', title: 't', keywords: [] }] }) }),
    { DB: {}, CMWEBS_ASSISTANT_TOKEN: 't', ASSISTANT_AI_WORKSPACES: verified.workspace.workspace_id, ASSISTANT_BRIDGE: { fetch() { throw new Error('never'); } } });
  assert.equal(response.status, 400);
  assert.ok(dataset);
});
