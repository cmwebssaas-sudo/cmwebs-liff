import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const landlordHtml = readFileSync(
  new URL('../landlord-messages.html', import.meta.url),
  'utf8'
);
const tenantHtml = readFileSync(
  new URL('../tenant-message.html', import.meta.url),
  'utf8'
);

const TENANT_A_PRIVATE_VALUES = [
  '前房客 A',
  '0912-345-678',
  'tenant-a@example.test',
  'TENANT-A-LINE',
  '前房客原始報修內容',
  'private-attachment-a.jpg',
  'LEASE-A',
  '前房客私人備註'
];

const tenantARepairTicket = {
  repair_ticket_id: 'TICKET-A',
  room_id: 'ROOM-101',
  tenant_name_snapshot: TENANT_A_PRIVATE_VALUES[0],
  phone: TENANT_A_PRIVATE_VALUES[1],
  email: TENANT_A_PRIVATE_VALUES[2],
  tenant_line_user_id: TENANT_A_PRIVATE_VALUES[3],
  description: TENANT_A_PRIVATE_VALUES[4],
  attachment_id: TENANT_A_PRIVATE_VALUES[5],
  lease_id_snapshot: TENANT_A_PRIVATE_VALUES[6],
  internal_note: '前房客私人備註'
};

const tenantBSafeProjection = {
  repair_ticket_id: 'TICKET-B',
  property_id: 'PROPERTY-1',
  room_id: 'ROOM-101',
  room_name_snapshot: '101',
  category: 'repair',
  title: '浴室排水維修',
  priority: 'normal',
  status: 'in_progress',
  created_at: '2026-09-15T09:00:00+08:00',
  closed_at: '',
  public_note: '師傅預計下午到訪。'
};

function repairRendererSource(html, functionName) {
  const marker = 'function ' + functionName + '(';
  const start = html.indexOf(marker);
  assert.notEqual(start, -1, 'missing ' + functionName);
  const remainder = html.slice(start + marker.length);
  const nextFunctionOffset = remainder.search(/\n    (?:async )?function /);
  return html.slice(
    start,
    nextFunctionOffset === -1
      ? html.length
      : start + marker.length + nextFunctionOffset
  );
}

function createTenantRepairRenderer() {
  const context = {
    safeHtml(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, function(character) {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        }[character];
      });
    },
    normalizeStatus(value) {
      return String(value == null ? '' : value).trim().toLowerCase();
    },
    categoryText(value) {
      return value === 'repair' ? '報修' : String(value || '-');
    },
    formatDateTime(value) {
      return String(value || '-');
    },
    statusText(value) {
      return value === 'in_progress' ? '處理中' : String(value || '-');
    },
    statusBadgeClass() {
      return 'badge';
    }
  };

  return vm.runInNewContext(
    '(' + repairRendererSource(tenantHtml, 'renderTenantRepairTickets') + ')',
    context
  );
}

test('landlord repair history keeps the existing message UI and uses the authenticated repair bridge', () => {
  assert.match(landlordHtml, /房客訊息管理/);
  assert.match(landlordHtml, /landlord_messages_init/);
  assert.match(landlordHtml, /id="statusFilter"/);
  assert.match(landlordHtml, /id="categoryFilter"/);
  assert.match(landlordHtml, /id="repairRoomFilter"/);
  assert.match(landlordHtml, /id="repairStatusFilter"/);
  assert.match(landlordHtml, /applyRepairFilters/);
  assert.match(landlordHtml, /landlord_repair_tickets_init/);
  assert.match(landlordHtml, /landlord_repair_ticket_update/);
  assert.equal(
    (landlordHtml.match(/await landlordRepairRequest\('landlord_repair_ticket_update'/g) || []).length,
    1
  );
  assert.match(landlordHtml, /renderRepairTimeline/);
  assert.match(landlordHtml, /groupRepairTicketsByRoom/);
  assert.match(landlordHtml, /LANDLORD_REPAIR_AUTH \|\| initLandlordRepairAuth\(\)/);
  assert.match(landlordHtml, /auth\.request\(action, params \|\| \{\}\)/);
});

test('landlord repair update keeps success feedback visible after the authenticated refresh', () => {
  assert.match(landlordHtml, /async function loadRepairTickets\(options\)/);
  assert.match(landlordHtml, /preserveFeedback/);
  assert.match(landlordHtml, /const refreshed = await loadRepairTickets\(\{ preserveFeedback: true \}\)/);
  assert.match(landlordHtml, /if \(refreshed\) \{[\s\S]*renderRepairFeedback\('報修工單已更新。', false\)/);
});

test('tenant repair renderer requests only the authenticated tenant projection and contains no denied repair fields', () => {
  assert.match(tenantHtml, /tenant_repair_tickets_init/);
  const bridge = repairRendererSource(tenantHtml, 'tenantRepairBridgeRequest');
  assert.match(bridge, /id_token/);
  assert.doesNotMatch(bridge, /line_user_id/);
  assert.match(tenantHtml, /renderTenantRepairTickets/);
  const renderer = repairRendererSource(tenantHtml, 'renderTenantRepairTickets');
  for (const deniedField of [
    'tenant_name_snapshot',
    'tenant_line_user_id',
    'tenant_user_id',
    'lease_id',
    'internal_note',
    'attachment_id',
    'phone',
    'email',
    'message_body',
    'description'
  ]) {
    assert.doesNotMatch(renderer, new RegExp(deniedField));
  }
});

test('tenant B fixture payload and rendered output exclude every tenant A private value', () => {
  const payload = JSON.stringify({ tickets: [tenantBSafeProjection] });
  const rendered = createTenantRepairRenderer()([tenantBSafeProjection]);
  assert.deepEqual(Object.keys(tenantBSafeProjection).sort(), [
    'category', 'closed_at', 'created_at', 'priority', 'property_id',
    'public_note', 'repair_ticket_id', 'room_id', 'room_name_snapshot',
    'status', 'title'
  ]);
  for (const privateValue of TENANT_A_PRIVATE_VALUES) {
    assert.doesNotMatch(payload, new RegExp(privateValue));
    assert.doesNotMatch(rendered, new RegExp(privateValue));
  }
  assert.match(rendered, /浴室排水維修/);
  assert.match(rendered, /in_progress/);
  assert.ok(tenantARepairTicket.internal_note);
});
