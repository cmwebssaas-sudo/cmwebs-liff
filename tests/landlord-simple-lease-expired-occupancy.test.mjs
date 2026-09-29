import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const page = readFileSync(new URL('../landlord-tenant-create.html', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = page.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0;
  for (let index = page.indexOf('{', start); index < page.length; index += 1) {
    if (page[index] === '{') depth += 1;
    if (page[index] === '}' && --depth === 0) return page.slice(start, index + 1);
  }
  throw new Error(`${name} is not closed`);
}

const rooms = [
  {
    room_id: 'R502', property_name: 'no88', room_name: '502',
    room_status: 'occupied', has_current_or_upcoming_contract: false
  },
  {
    room_id: 'R501', property_name: 'no88', room_name: '501',
    room_status: 'vacant', has_current_or_upcoming_contract: false
  },
  {
    room_id: 'R503', property_name: 'no88', room_name: '503',
    room_status: 'occupied', has_current_or_upcoming_contract: true
  }
];
const form = {
  roomId: 'R502', startDate: '2026-09-29', endDate: '2027-09-28',
  termMonths: '12', rentAmount: '8500', managementFee: '500', depositAmount: '18000'
};
const context = vm.createContext({
  PAGE_DATA: { rooms },
  SIMPLE_NEW_MODE: true,
  rawText: value => String(value ?? ''),
  safeHtml: value => String(value ?? ''),
  inputValue: id => form[id] ?? '',
  getRoom: id => rooms.find(room => room.room_id === id) || null
});
vm.runInContext([
  extractFunction('simpleRoomOptions'),
  extractFunction('validateForm')
].join('\n'), context);

test('expired occupied room is marked for review instead of appearing vacant in quick lease', () => {
  const options = context.simpleRoomOptions('R502');
  assert.match(options, /no88・502（房況待核對，勿作空房）/);
  assert.match(options, /no88・503（已出租，已有租約，請勿建立新房客租約）/);
  assert.doesNotMatch(options, /no88・501（房況待核對/);
});

test('quick lease rejects an expired occupied room but keeps a truly vacant room available', () => {
  assert.match(context.validateForm(), /房況待核對.*確認續約或完成退房/);
  form.roomId = 'R503';
  assert.match(context.validateForm(), /已出租.*確認續約或完成退房/);
  form.roomId = 'R501';
  assert.equal(context.validateForm(), '');
});
