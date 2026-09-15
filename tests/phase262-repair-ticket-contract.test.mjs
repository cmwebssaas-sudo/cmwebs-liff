import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const dataModel = fs.readFileSync(new URL('../docs/05-DATA-MODEL.md', import.meta.url), 'utf8');
const apiRoutes = fs.readFileSync(new URL('../docs/04-API-ROUTES.md', import.meta.url), 'utf8');

function fencedList(document, heading) {
  const match = document.match(new RegExp(`${heading}[\\s\\S]*?${'```text'}\\n([\\s\\S]*?)${'```'}`));
  assert.ok(match, `missing canonical ${heading} contract`);
  return match[1].trim().split('\n');
}

function tableValues(document, heading, column) {
  const section = document.match(new RegExp(`${heading}[\\s\\S]*?(?=\\n#{1,3}\\s|$)`))?.[0];
  assert.ok(section, `missing ${heading} section`);
  return [...section.matchAll(/^\|\s*([^|\n]+)\s*\|\s*[^|\n]+/gm)]
    .map((m) => m[1].trim())
    .filter((value) => value !== column && value !== '---')
    .map((value) => value.replaceAll('`', ''))
    .filter((value) => !value.includes(' '));
}

test('freezes repair ticket headers and tenant privacy projection', () => {
  const REPAIR_TICKET_HEADERS = fencedList(dataModel, '### `V2_repair_tickets` headers');
  const TENANT_REPAIR_ALLOWED_FIELDS = fencedList(dataModel, '### `tenant_repair_allowed_fields`');

  assert.deepEqual(REPAIR_TICKET_HEADERS, [
    'workspace_id', 'repair_ticket_id', 'source_message_id', 'property_id', 'room_id', 'room_name_snapshot',
    'tenant_id_snapshot', 'lease_id_snapshot', 'tenant_name_snapshot', 'category', 'title', 'description',
    'priority', 'status', 'responsibility_party', 'estimated_cost', 'actual_cost', 'created_at', 'closed_at'
  ]);
  assert.deepEqual(TENANT_REPAIR_ALLOWED_FIELDS, [
    'repair_ticket_id', 'property_id', 'room_id', 'room_name_snapshot', 'category', 'title', 'description',
    'priority', 'status', 'created_at', 'closed_at', 'public_note'
  ]);
  for (const denied of ['tenant_name_snapshot', 'tenant_id_snapshot', 'tenant_line_user_id', 'email', 'phone',
    'description_original', 'attachment_id', 'attachment_ids', 'attachment_file_id', 'attachment_url',
    'download_url', 'permanent_download_url', 'internal_note']) {
    assert.equal(TENANT_REPAIR_ALLOWED_FIELDS.includes(denied), false, `tenant denylist contains ${denied}`);
  }
});

test('freezes repair ticket statuses and documented actions', () => {
  assert.deepEqual(tableValues(dataModel, '### `V2_repair_tickets` statuses', 'Status'), [
    'open', 'in_progress', 'awaiting_confirmation', 'completed', 'closed'
  ]);
  assert.deepEqual(tableValues(apiRoutes, '## Repair-ticket actions', 'Action'), [
    'tenant_repair_tickets_init', 'landlord_repair_tickets_init', 'landlord_repair_ticket_update'
  ]);
  assert.match(apiRoutes, /undocumented query-string actions are not\s+accepted/);
});
