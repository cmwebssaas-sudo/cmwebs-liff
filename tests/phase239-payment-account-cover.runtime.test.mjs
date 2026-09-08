import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(
  new URL('../apps-script/V2_PAYMENT_ACCOUNT_COVER.js', import.meta.url),
  'utf8'
);

function makePng() {
  const bytes = Buffer.alloc(64);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  bytes.write('IHDR', 12);
  bytes.writeUInt32BE(64, 16);
  bytes.writeUInt32BE(64, 20);
  return bytes.toString('base64');
}

test('landlord can privately replace the Workspace payment account cover', () => {
  const state = {
    saved: null,
    files: [],
    lockWaitMs: null,
    props: new Map([
      ['CMWEBS_PAYMENT_ACCOUNT_COVER_DRIVE_ROOT_FOLDER_ID', 'cover-root']
    ])
  };
  const sheet = {};
  const root = {
    createFile(blob) {
      const file = {
        id: crypto.randomUUID(),
        blob,
        sharing: null,
        trashed: false,
        getId() {
          return this.id;
        },
        setSharing(access, permission) {
          this.sharing = [access, permission];
        },
        setTrashed(value) {
          this.trashed = value;
        }
      };
      state.files.push(file);
      return file;
    }
  };
  const context = {
    Array,
    Date,
    Error,
    Math,
    Number,
    Object,
    RegExp,
    String,
    SpreadsheetApp: {},
    V2_SYSTEM_SETTINGS_SHEETS_: {
      paymentAccounts: 'V2_workspace_payment_accounts'
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return state.props.get(key) || '';
          }
        };
      }
    },
    DriveApp: {
      Access: { PRIVATE: 'PRIVATE' },
      Permission: { NONE: 'NONE' },
      getFolderById(id) {
        assert.equal(id, 'cover-root');
        return root;
      }
    },
    LockService: {
      getScriptLock() {
        return {
          tryLock(timeoutMs) {
            state.lockWaitMs = timeoutMs;
            return true;
          },
          releaseLock() {}
        };
      }
    },
    Utilities: {
      getUuid() {
        return 'cover-uuid';
      },
      base64Decode(value) {
        return [...Buffer.from(value, 'base64')];
      },
      newBlob(bytes, mimeType, name) {
        return { bytes, mimeType, name };
      },
      computeDigest() {
        return [1, 2, 3, 4];
      },
      DigestAlgorithm: { SHA_256: 'SHA_256' }
    },
    runtimeSpreadsheet_() {
      return { getSheetByName() { return sheet; } };
    },
    systemSettingsEnsureSchema_() {},
    systemSettingsBuildPermissions_() {
      return { can_edit_payment: true };
    },
    systemSettingsText_(value) {
      return value === null || value === undefined ? '' : String(value);
    },
    systemSettingsFindDefaultPaymentAccount_() {
      return {
        __row_number: 2,
        payment_account_id: 'PA-239',
        workspace_id: 'WS-239',
        bank_account: '001234567890'
      };
    },
    systemSettingsSetRowValues_(_sheet, rowNumber, values) {
      state.saved = { rowNumber, values };
    }
  };

  vm.runInNewContext(source, context, {
    filename: 'V2_PAYMENT_ACCOUNT_COVER.js'
  });

  const result = context.uploadLandlordPaymentAccountCover_({
    workspace: { workspace_id: 'WS-239' },
    membership: { role: 'owner' },
    user: { user_id: 'U-239' }
  }, {
    mime_type: 'image/png',
    file_name: '帳戶封面.png',
    base64: makePng()
  });

  assert.equal(result.success, true, result.code);
  assert.equal(
    state.lockWaitMs,
    8000,
    'cover uploads must return a typed busy state before the client bridge timeout instead of waiting 25 seconds on the global lock'
  );
  assert.equal(state.files.length, 1);
  assert.deepEqual(state.files[0].sharing, ['PRIVATE', 'NONE']);
  assert.equal(state.saved.rowNumber, 2);
  assert.equal(
    state.saved.values.bank_account_cover_file_name,
    '帳戶封面.png'
  );
  assert.equal(
    JSON.stringify(result).includes(state.files[0].id),
    false
  );
});

test('tenant cover preview returns image data without exposing private storage ids', () => {
  const imageBytes = [137, 80, 78, 71];
  const context = {
    Array,
    Date,
    Error,
    Math,
    Number,
    Object,
    RegExp,
    String,
    tenantBillsRuntimeResolveIdentity_() {
      return { workspace_id: 'WS-239' };
    },
    tenantBillsRuntimePaymentAccountRows_() {
      return [{
        workspace_id: 'WS-239',
        is_default: true,
        account_status: 'active',
        bank_account_cover_file_id: 'drive-secret-id',
        bank_account_cover_file_name: '帳戶封面.png',
        bank_account_cover_mime_type: 'image/png'
      }];
    },
    tenantBillsRuntimeUpper_(value) {
      return String(value || '').toUpperCase();
    },
    tenantBillsRuntimeText_(value) {
      return value === null || value === undefined
        ? ''
        : String(value);
    },
    DriveApp: {
      getFileById(id) {
        assert.equal(id, 'drive-secret-id');
        return {
          getBlob() {
            return {
              getBytes() {
                return imageBytes;
              },
              getContentType() {
                return 'image/png';
              }
            };
          }
        };
      }
    },
    Utilities: {
      base64Encode(bytes) {
        return Buffer.from(bytes).toString('base64');
      }
    }
  };

  vm.runInNewContext(
    source +
      '\nthis.coverPreview = getTenantPaymentAccountCoverByLineUid_;',
    context,
    { filename: 'V2_PAYMENT_ACCOUNT_COVER.js' }
  );

  const result = context.coverPreview('line-tenant');

  assert.equal(result.success, true, result.code);
  assert.equal(result.data.file_name, '帳戶封面.png');
  assert.equal(result.data.mime_type, 'image/png');
  assert.match(result.data.data_url, /^data:image\/png;base64,/);
  assert.equal(
    JSON.stringify(result).includes('drive-secret-id'),
    false
  );
});
