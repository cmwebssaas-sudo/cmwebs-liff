import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const syncSource = fs.readFileSync(
  new URL(
    '../apps-script/V2_LEGACY_CONTRACT_SIGNED_SYNC.js',
    import.meta.url
  ),
  'utf8'
);
const dispatcherSource = fs.readFileSync(
  new URL('../apps-script/程式碼.js', import.meta.url),
  'utf8'
);
const contractRequestsSource = fs.readFileSync(
  new URL(
    '../apps-script/V2_CONTRACT_REQUESTS.js',
    import.meta.url
  ),
  'utf8'
);
const onboardingSource = fs.readFileSync(
  new URL(
    '../apps-script/V2_TENANT_LEASE_ONBOARDING.js',
    import.meta.url
  ),
  'utf8'
);

const fixedEpochSeconds = 1_800_000_000;
const privateMetadataFields = [
  'legacy_contract_id',
  'legacy_signed_at',
  'legacy_signed_status',
  'legacy_signed_document_url',
  'legacy_signed_pdf_url',
  'legacy_identity_front_url',
  'legacy_identity_back_url',
  'legacy_signed_sync_at'
];

function createSheet(headers, rows) {
  const values = [headers.slice(), ...rows.map((row) => row.slice())];
  let writes = 0;

  function ensureSize(row, column) {
    while (values.length < row) values.push([]);
    while (values[row - 1].length < column) values[row - 1].push('');
  }

  return {
    getLastRow() {
      return values.length;
    },
    getLastColumn() {
      return values[0].length;
    },
    getDataRange() {
      return {
        getValues() {
          return values.map((row) => row.slice());
        }
      };
    },
    getRange(startRow, startColumn, rowCount, columnCount) {
      return {
        getValues() {
          return Array.from({ length: rowCount }, (_, rowIndex) =>
            Array.from({ length: columnCount }, (_, columnIndex) =>
              values[startRow - 1 + rowIndex]?.[startColumn - 1 + columnIndex] ?? ''
            )
          );
        },
        setValues(nextValues) {
          nextValues.forEach((row, rowIndex) => {
            row.forEach((value, columnIndex) => {
              ensureSize(
                startRow + rowIndex,
                startColumn + columnIndex
              );
              values[startRow - 1 + rowIndex][startColumn - 1 + columnIndex] = value;
            });
          });
          writes += 1;
        }
      };
    },
    snapshot() {
      return values.map((row) => row.slice());
    },
    writeCount() {
      return writes;
    }
  };
}

function createFixture(overrides = {}) {
  const hmacKey = overrides.secret === undefined
    ? crypto.randomBytes(32).toString('hex')
    : overrides.secret;
  const contractHeaders = [
    'contract_id',
    'workspace_id',
    'landlord_id',
    'landlord_line_user_id',
    'tenant_line_user_id',
    'contract_status',
    'status',
    'signed_at',
    'updated_at',
    ...privateMetadataFields
  ];
  const contractRow = [
    'TALLY-A-001',
    'WS-001',
    'LANDLORD-001',
    'landlord-line-001',
    'tenant-line-001',
    'active',
    'active',
    '',
    '',
    ...privateMetadataFields.map(() => '')
  ];
  const legacySheet = createSheet(
    ['contract_id', 'landlord_id', 'uid'],
    [[
      'TALLY-A-001',
      'LANDLORD-001',
      'tenant-line-001'
    ]]
  );
  const contractSheet = createSheet(
    contractHeaders,
    [contractRow]
  );
  const sheets = {
    '5.新租客合約資料': legacySheet,
    V2_contracts: contractSheet
  };
  const access = {
    success: true,
    workspace: { workspace_id: 'WS-001' },
    principal_landlord_id: 'LANDLORD-001',
    membership: { role: 'owner' },
    permissions: { can_edit_contract: true }
  };

  const sandbox = {
    Utilities: {
      computeHmacSha256Signature(body, secret) {
        return [...crypto
          .createHmac('sha256', secret)
          .update(body)
          .digest()]
          .map((byte) => (byte > 127 ? byte - 256 : byte));
      },
      formatDate() {
        return '2027-01-15T08:00:00+08:00';
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return key === 'CMWEBS_LEGACY_CONTRACT_SYNC_HMAC_SECRET'
              ? hmacKey
              : '';
          }
        };
      }
    },
    LockService: {
      getScriptLock() {
        return {
          waitLock() {},
          releaseLock() {}
        };
      }
    },
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        return {
          getSheetByName(name) {
            return sheets[name] || null;
          }
        };
      }
    },
    workspaceLandlordResolveAccess_(lineUserId, options) {
      if (overrides.requireReadOnlyResolver === true) {
        assert.equal(lineUserId, 'landlord-line-001');
        assert.equal(options.skip_schema_ensure, true);
        assert.equal(options.skip_legacy_context_creation, true);
      }
      return {
        ...access,
        ...overrides.access
      };
    },
    workspaceLandlordCheckPolicy_() {
      return overrides.permission || { success: true };
    }
  };

  vm.runInNewContext(syncSource, sandbox, {
    filename: 'V2_LEGACY_CONTRACT_SIGNED_SYNC.js'
  });
  sandbox.legacyContractSignedSyncNowEpochSeconds_ = () => fixedEpochSeconds;

  return { sandbox, legacySheet, contractSheet, hmacKey };
}

function signedPayload(overrides = {}) {
  return {
    action: 'legacy_contract_signed_sync',
    timestamp: fixedEpochSeconds,
    contract_id: 'TALLY-A-001',
    tenant_line_uid: 'tenant-line-001',
    signed_at: '2027-01-15T00:00:00Z',
    signed_document_url: 'https://docs.google.com/document/d/example',
    signed_pdf_url: 'https://drive.google.com/file/d/pdf/view',
    identity_front_url: 'https://drive.google.com/file/d/front/view',
    identity_back_url: 'https://drive.google.com/file/d/back/view',
    ...overrides
  };
}

function send(fixture, payload) {
  const body = JSON.stringify(payload);
  const signature = fixture.sandbox
    .legacyContractSignedSyncComputeHmacHex_(
      body,
      fixture.hmacKey
    );
  return fixture.sandbox.handleLegacyContractSignedSyncPost_(
    body,
    signature
  );
}

{
  const fixture = createFixture({ requireReadOnlyResolver: true });
  const result = send(fixture, signedPayload());
  const values = fixture.contractSheet.snapshot();
  const headers = values[0];
  const row = values[1];
  const field = (name) => row[headers.indexOf(name)];

  assert.equal(result.success, true);
  assert.equal(result.data.idempotent, false);
  assert.equal(field('legacy_contract_id'), 'TALLY-A-001');
  assert.equal(field('signed_at'), '2027-01-15T00:00:00Z');
  assert.equal(field('contract_status'), 'signed');
  assert.equal(field('status'), 'signed');
  assert.equal(
    field('legacy_identity_front_url'),
    'https://drive.google.com/file/d/front/view'
  );
}

{
  const fixture = createFixture();
  const values = fixture.contractSheet.snapshot();
  const missingColumn = values[0].indexOf('legacy_identity_back_url');
  values.forEach((row) => row.splice(missingColumn, 1));
  const missingSchemaSheet = createSheet(values[0], [values[1]]);
  fixture.sandbox.SpreadsheetApp.getActiveSpreadsheet = () => ({
    getSheetByName(name) {
      return name === 'V2_contracts'
        ? missingSchemaSheet
        : fixture.legacySheet;
    }
  });

  const result = send(fixture, signedPayload());
  assert.equal(result.success, false);
  assert.equal(result.code, 'V2_CONTRACT_SYNC_SCHEMA_NOT_READY');
  assert.equal(missingSchemaSheet.writeCount(), 0);
}

{
  const fixture = createFixture();
  const result = send(
    fixture,
    signedPayload({ contract_id: 'TALLY-A-NOT-FOUND' })
  );
  assert.equal(result.success, false);
  assert.equal(result.code, 'LEGACY_CONTRACT_NOT_FOUND');
  assert.equal(fixture.contractSheet.writeCount(), 0);
}

{
  const fixture = createFixture({ secret: '' });
  const body = JSON.stringify(signedPayload());
  const result = fixture.sandbox.handleLegacyContractSignedSyncPost_(
    body,
    'unused'
  );
  assert.equal(result.success, false);
  assert.equal(result.code, 'SYNC_SECRET_NOT_CONFIGURED');
  assert.equal(fixture.contractSheet.writeCount(), 0);
}

{
  const fixture = createFixture();
  const payload = signedPayload({
    signed_pdf_url: 'https://example.invalid/file.pdf'
  });
  const result = send(fixture, payload);
  assert.equal(result.success, false);
  assert.equal(result.code, 'INVALID_SYNC_URL');
  assert.equal(fixture.contractSheet.writeCount(), 0);
}

{
  const fixture = createFixture();
  const body = JSON.stringify(signedPayload(), null, 2);
  const signature = fixture.sandbox
    .legacyContractSignedSyncComputeHmacHex_(body, fixture.hmacKey);
  const accepted = fixture.sandbox.handleLegacyContractSignedSyncPost_(
    body,
    signature
  );
  const modified = fixture.sandbox.handleLegacyContractSignedSyncPost_(
    body + ' ',
    signature
  );

  assert.equal(accepted.success, true);
  assert.equal(modified.success, false);
  assert.equal(modified.code, 'INVALID_SIGNATURE');
  assert.equal(
    fixture.sandbox.legacyContractSignedSyncIsRequest_(''),
    false,
    'an empty body must never be recognized as a signed sync request'
  );
}

{
  const fixture = createFixture();
  const result = send(
    fixture,
    signedPayload({ tenant_line_uid: 'another-tenant-line' })
  );
  assert.equal(result.success, false);
  assert.equal(result.code, 'TENANT_LINE_UID_MISMATCH');
  assert.equal(fixture.contractSheet.writeCount(), 0);
}

{
  const fixture = createFixture({
    access: {
      workspace: { workspace_id: 'WS-OTHER' }
    }
  });
  const result = send(fixture, signedPayload());
  assert.equal(result.success, false);
  assert.equal(result.code, 'WORKSPACE_MISMATCH');
  assert.equal(fixture.contractSheet.writeCount(), 0);
}

{
  const fixture = createFixture();
  const first = send(fixture, signedPayload());
  const second = send(fixture, signedPayload());
  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(second.data.idempotent, true);
  assert.equal(
    fixture.contractSheet.writeCount(),
    1,
    'duplicate signed payload must not write the V2 contract twice'
  );
}

{
  const fixture = createFixture();
  const expiredBody = JSON.stringify(
    signedPayload({ timestamp: fixedEpochSeconds - 301 })
  );
  const expiredSignature = fixture.sandbox
    .legacyContractSignedSyncComputeHmacHex_(
      expiredBody,
      fixture.hmacKey
    );
  const expired = fixture.sandbox
    .handleLegacyContractSignedSyncPost_(
      expiredBody,
      expiredSignature
    );
  const badSignature = fixture.sandbox
    .handleLegacyContractSignedSyncPost_(
      JSON.stringify(signedPayload()),
      'not-a-valid-signature'
    );

  assert.equal(expired.success, false);
  assert.equal(expired.code, 'EXPIRED_TIMESTAMP');
  assert.equal(badSignature.success, false);
  assert.equal(badSignature.code, 'INVALID_SIGNATURE');
  assert.equal(fixture.contractSheet.writeCount(), 0);
}

{
  const viewStart = contractRequestsSource.indexOf(
    'function contractRequestBuildContractView_'
  );
  const viewEnd = contractRequestsSource.indexOf(
    'function contractRequestResolveContractSupplement_',
    viewStart
  );
  const tenantContractView = contractRequestsSource.slice(
    viewStart,
    viewEnd
  );

  assert.doesNotMatch(
    tenantContractView,
    /legacy_(?:signed_document|signed_pdf|identity_front|identity_back)_url/,
    'tenant contract response must not expose private document or identity URLs'
  );
  privateMetadataFields.forEach((field) => {
    assert.match(
      onboardingSource,
      new RegExp(`'${field}'`),
      `optional ${field} header must preserve V2 contract schema compatibility`
    );
  });
}

assert.match(
  dispatcherSource,
  /legacyContractSignedSyncIsRequest_\(postBody\)/,
  'doPost must dispatch the signed integration before LINE fallback'
);
assert.match(
  dispatcherSource,
  /: handleLineWebhook_\(postBody\)/,
  'existing LINE webhook must remain the doPost fallback'
);

console.log('Phase 129 legacy signed contract sync tests passed.');
