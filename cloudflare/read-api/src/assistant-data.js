// Data questions for the landlord assistant. The model only picks an intent id
// from the catalog. Every number and name in the answer is computed here from
// the Workspace-scoped read calculator, so the model never sees landlord data.
const MAX_LINES = 15;
const EXPIRY_DAYS = 60;

const text = value => String(value == null ? '' : value).trim();
const money = value => (Number(value) || 0).toLocaleString('en-US');
const monthLabel = month => Number(String(month).slice(5, 7)) + ' 月';
const dayLabel = date => /^\d{4}-(\d{2})-(\d{2})$/.test(date) ? Number(date.slice(5, 7)) + '/' + Number(date.slice(8, 10)) : date;

function isoDate(value) {
  const match = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(text(value));
  return match ? match[1] + '-' + match[2].padStart(2, '0') + '-' + match[3].padStart(2, '0') : '';
}
const slashDate = iso => iso.replace(/-/g, '/');
const dayNumber = iso => Date.parse(iso + 'T00:00:00Z') / 86400000;

function unwrap(result) {
  if (!result || result.success !== true || !result.data) throw new Error('ASSISTANT_DATA_UNAVAILABLE');
  return result.data;
}

const paymentCalendar = (calculator, uid) => unwrap(calculator.getWorkspaceLandlordPaymentCalendarNativeByLineUid_(uid));
const arrearsList = (calculator, uid) => unwrap(calculator.getWorkspaceLandlordArrearsNativeByLineUid_(uid)).arrears || [];
const tenantRows = (calculator, uid) => unwrap(calculator.getWorkspaceLandlordTenantsNativeByLineUid_(uid, 'summary')).tenants || [];

function moreLine(total) {
  return total > MAX_LINES ? '\n…另外還有 ' + (total - MAX_LINES) + ' 筆，請到欠款頁看' : '';
}

function cellLine(cell) {
  const label = monthLabel(cell.month) + '：';
  switch (cell.status) {
    case 'paid': return label + money(cell.total_amount) + ' 元，已繳';
    case 'unpaid': return label + money(cell.total_amount) + ' 元，未繳（到期 ' + dayLabel(cell.due_date) + '）';
    case 'overdue': return label + money(cell.total_amount) + ' 元，逾期 ' + cell.days_overdue + ' 天、未繳 ' + money(cell.unpaid_amount) + ' 元';
    case 'no_bill': return label + '還沒開帳單';
    default: return label + '空房';
  }
}

// A room name that is all digits must not match inside a longer number.
function nameInQuestion(name, question) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const before = /^\d/.test(name) ? '(?<!\\d)' : '';
  const after = /\d$/.test(name) ? '(?!\\d)' : '';
  return new RegExp(before + escaped + after, 'i').test(question);
}

function findRooms(question, rooms) {
  const normalized = question.normalize('NFKC');
  const named = rooms.filter(room => text(room.room_name) && nameInQuestion(text(room.room_name).normalize('NFKC'), normalized));
  if (named.length) {
    const longest = Math.max(...named.map(room => text(room.room_name).length));
    return named.filter(room => text(room.room_name).length === longest);
  }
  const numbers = normalized.match(/\d+/g) || [];
  return rooms.filter(room => {
    const own = text(room.room_name).normalize('NFKC').match(/\d+/g) || [];
    return numbers.some(number => own.includes(number));
  });
}

function roomAnswer(room, tenantsByRoom) {
  const head = text(room.room_name) + ' 房' + (room.property_name ? '（' + room.property_name + '）' : '') + (room.tenant_name ? (room.property_name ? '' : ' ') + room.tenant_name : '');
  const lines = [...room.cells].reverse().map(cellLine);
  const end = isoDate((tenantsByRoom.get(room.room_id) || {}).contract_end_date);
  if (end) lines.push('合約到期：' + slashDate(end));
  return [head, ...lines].join('\n');
}

function askRoomPayment(question, calculator, uid) {
  const rooms = paymentCalendar(calculator, uid).rooms || [];
  const found = findRooms(question, rooms);
  if (!found.length) {
    return /\d/.test(question) ? '我在你的房間裡找不到這間房，請確認房號再問一次。' : '想查哪一間房？請告訴我房號，例如「302 的房租有繳了嗎？」';
  }
  const tenantsByRoom = new Map();
  for (const row of tenantRows(calculator, uid)) if (text(row.room_id) && !tenantsByRoom.has(row.room_id)) tenantsByRoom.set(row.room_id, row);
  return found.slice(0, 3).map(room => roomAnswer(room, tenantsByRoom)).join('\n\n');
}

function askUnpaidList(question, calculator, uid) {
  const arrears = arrearsList(calculator, uid);
  if (!arrears.length) return '目前沒有未繳的帳單。';
  const names = new Map();
  for (const room of paymentCalendar(calculator, uid).rooms || []) names.set(room.room_id, room);
  const total = arrears.reduce((sum, row) => sum + (Number(row.total_amount) || 0), 0);
  const lines = arrears.slice(0, MAX_LINES).map(row => {
    const known = names.get(row.room_id) || {};
    const overdue = Number(row.days_overdue) > 0 ? '逾期 ' + row.days_overdue + ' 天' : '未到期';
    return '• ' + [text(row.room_name) || text(known.room_name), text(row.tenant_name) || text(known.tenant_name)].filter(Boolean).join(' ') +
      ' ' + monthLabel(row.bill_month) + ' ' + money(row.total_amount) + ' 元，' + overdue;
  });
  return '目前 ' + arrears.length + ' 筆未繳，共 ' + money(total) + ' 元：\n' + lines.join('\n') + moreLine(arrears.length);
}

const EXPIRY_STATUSES = new Set(['active', 'expired', 'expiring', 'expiring_soon']);

function askContractExpiry(question, calculator, uid, today) {
  const limit = dayNumber(today) + EXPIRY_DAYS;
  const due = tenantRows(calculator, uid)
    .map(row => ({ row, end: isoDate(row.contract_end_date) }))
    .filter(({ row, end }) => end && EXPIRY_STATUSES.has(text(row.current_contract_status).toLowerCase()) && dayNumber(end) <= limit)
    .sort((a, b) => a.end.localeCompare(b.end));
  if (!due.length) return EXPIRY_DAYS + ' 天內沒有快到期的合約。';
  const lines = due.slice(0, MAX_LINES).map(({ row, end }) =>
    '• ' + [text(row.room_list), text(row.tenant_name)].filter(Boolean).join(' ') + ' ' + slashDate(end) + (end < today ? ' 已到期' : ' 到期') +
    '，' + (text(row.pending_renewal_contract_id) ? '已發續約，等房客簽名' : '還沒續約'));
  const more = due.length > MAX_LINES ? '\n…另外還有 ' + (due.length - MAX_LINES) + ' 筆，請到房客頁看' : '';
  return '共 ' + due.length + ' 筆合約在 ' + EXPIRY_DAYS + ' 天內到期或已到期：\n' + lines.join('\n') + more;
}

export const DATA_INTENTS = [
  { id: 'ask_room_payment', title: '查某一間房這幾個月繳了沒', go: 'reminder', answer: askRoomPayment,
    keywords: ['繳了嗎', '有繳', '繳了沒', '房租', '付了沒', '付了嗎', '繳費狀況', '這間房'] },
  { id: 'ask_unpaid_list', title: '列出還沒繳的房間', go: 'reminder', answer: askUnpaidList,
    keywords: ['誰沒繳', '還沒繳', '未繳', '欠款', '列出', '哪些房間沒繳', '誰欠', '幾個人逾期', '逾期名單'] },
  { id: 'ask_contract_expiry', title: '查快到期、待續約的合約', go: 'renewal', answer: askContractExpiry,
    keywords: ['快到期', '到期', '待續約', '續約', '哪些合約', '合約到期', '誰還沒簽續約', '續約名單'] }
];

export const dataIntentById = new Map(DATA_INTENTS.map(intent => [intent.id, intent]));
export const dataCatalog = () => DATA_INTENTS.map(({ id, title, keywords }) => ({ id, title, keywords }));
