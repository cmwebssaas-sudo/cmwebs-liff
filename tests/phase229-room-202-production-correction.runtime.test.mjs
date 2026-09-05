import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const billingSource = readFileSync(
  new URL('../apps-script/V2_BILLING_MANAGEMENT.js', import.meta.url),
  'utf8'
);

test('room 202 correction updates duplicate same-workspace tenant bill views', () => {
  const helperStart = billingSource.indexOf(
    'function billingUpsertById_('
  );
  const helperEnd = billingSource.indexOf(
    'function billingFindByTenantId_(',
    helperStart
  );

  assert.notEqual(
    helperStart,
    -1,
    'bill upsert helper must tolerate legacy duplicate rows when explicitly requested'
  );
  assert.notEqual(
    helperEnd,
    -1,
    'bill-view upsert helper must have a stable boundary'
  );

  const updates = [];
  const appends = [];
  const sheet = {
    getName: () => 'V2_tenant_bill_view',
    rows: [
      {
        __row_number: 12,
        bill_id: 'B0000021',
        workspace_id: 'W1',
        total_amount: 500
      },
      {
        __row_number: 37,
        bill_id: 'B0000021',
        workspace_id: 'W1',
        total_amount: 500
      }
    ]
  };
  const context = {
    Array,
    Object,
    String,
    Error,
    billingText_: value => value == null ? '' : String(value),
    workspaceGetObjectsWithRow_: target => target.rows,
    billingSetValues_: (target, rowNumber, values) => {
      updates.push({ target, rowNumber, values });
    },
    workspaceAppendObject_: (target, values) => {
      appends.push({ target, values });
    }
  };

  const source = billingSource.slice(helperStart, helperEnd);
  vm.runInNewContext(source, context, {
    filename: 'V2_BILLING_MANAGEMENT.js'
  });

  const result = context.billingUpsertById_(
    sheet,
    'bill_id',
    'B0000021',
    {
      bill_id: 'B0000021',
      workspace_id: 'W1',
      total_amount: 0,
      payment_status: 'paid'
    },
    { allowSameWorkspaceDuplicates: true }
  );

  assert.equal(updates.length, 2);
  assert.equal(appends.length, 0);

  const conflictingSheet = {
    getName: () => 'V2_tenant_bill_view',
    rows: [
      {
        __row_number: 12,
        bill_id: 'B0000021',
        workspace_id: 'W1'
      },
      {
        __row_number: 37,
        bill_id: 'B0000021',
        workspace_id: 'W2'
      }
    ]
  };

  assert.throws(
    () => context.billingUpsertById_(
      conflictingSheet,
      'bill_id',
      'B0000021',
      { bill_id: 'B0000021', workspace_id: 'W1' },
      { allowSameWorkspaceDuplicates: true }
    ),
    /V2_tenant_bill_view 的 bill_id canonical key 衝突/
  );
});

test('room 202 arrears identity falls back to the landlord room identity when bill tenant id is stale', () => {
  const apiSource = readFileSync(
    new URL('../apps-script/V2_API.js', import.meta.url),
    'utf8'
  );
  const identityStart = apiSource.indexOf(
    'function v2ResolveLandlordArrearsTenantIdentity_('
  );
  const identityEnd = apiSource.indexOf(
    '\n\nfunction getLandlordArrearsByLineUid',
    identityStart
  );

  assert.notEqual(identityStart, -1);
  assert.notEqual(identityEnd, -1);

  const context = { String, Array, Object };
  vm.runInNewContext(
    apiSource.slice(identityStart, identityEnd),
    context,
    { filename: 'V2_API.js' }
  );

  const identity = context.v2ResolveLandlordArrearsTenantIdentity_(
    {
      landlord_id: 'L1',
      workspace_id: 'W1',
      tenant_id: 'STALE-TENANT-ID',
      room_id: 'R202',
      room_name: '202',
      tenant_name: '測試'
    },
    'L1',
    [
      {
        landlord_id: 'L1',
        workspace_id: 'W1',
        tenant_id: 'CANONICAL-TENANT-ID',
        room_id: 'R202',
        room_name: '202',
        tenant_name: '劉致瑋'
      },
      {
        landlord_id: 'L1',
        workspace_id: 'W1',
        tenant_id: 'OTHER-TENANT-ID',
        room_id: 'R203',
        room_name: '203',
        tenant_name: '不應套用的房客'
      }
    ],
    []
  );

  assert.equal(identity.tenant_name, '劉致瑋');
});
