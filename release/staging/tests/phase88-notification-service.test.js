'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const stagingRoot = path.resolve(__dirname, '..');
const appsRoot = path.join(stagingRoot, 'apps-script');
const serviceSource = [
  'V2_NOTIFICATION_TEMPLATES.js',
  'V2_NOTIFICATION_QUEUE.js',
  'V2_NOTIFICATION_SERVICE.js'
].map(name => fs.readFileSync(path.join(appsRoot, name), 'utf8')).join('\n');


class MockRange {
  constructor(sheet, row, column, rows, columns) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rows = rows || 1;
    this.columns = columns || 1;
  }

  getValues() {
    const result = [];
    for (let row = 0; row < this.rows; row += 1) {
      const values = [];
      for (let column = 0; column < this.columns; column += 1) {
        values.push(
          (this.sheet.values[this.row - 1 + row] || [])[this.column - 1 + column] ?? ''
        );
      }
      result.push(values);
    }
    return result;
  }

  setValues(values) {
    values.forEach((row, rowOffset) => {
      while (this.sheet.values.length < this.row + rowOffset) {
        this.sheet.values.push([]);
      }
      row.forEach((value, columnOffset) => {
        this.sheet.values[this.row - 1 + rowOffset][this.column - 1 + columnOffset] = value;
      });
    });
    return this;
  }

  setValue(value) {
    return this.setValues([[value]]);
  }
}


class MockSheet {
  constructor(name, values) {
    this.name = name;
    this.values = values.map(row => row.slice());
  }

  getName() { return this.name; }
  getLastRow() { return this.values.length; }
  getLastColumn() {
    return this.values.reduce((max, row) => Math.max(max, row.length), 0);
  }
  getDataRange() {
    return new MockRange(this, 1, 1, this.getLastRow(), this.getLastColumn());
  }
  getRange(row, column, rows, columns) {
    return new MockRange(this, row, column, rows, columns);
  }
  appendRow(row) {
    this.values.push(row.slice());
    return this;
  }
}


class MockSpreadsheet {
  constructor(sheets) {
    this.sheets = sheets;
  }

  getSheetByName(name) {
    return this.sheets[name] || null;
  }

  insertSheet(name) {
    const sheet = new MockSheet(name, []);
    this.sheets[name] = sheet;
    return sheet;
  }
}


function table(headers, rows) {
  return [headers].concat(
    rows.map(row => headers.map(header => row[header] ?? ''))
  );
}


function createFixture(options = {}) {
  const requests = [];
  let uuidCounter = 0;
  const sheets = {
    V2_tenants: new MockSheet(
      'V2_tenants',
      table(
        [
          'tenant_id', 'workspace_id', 'tenant_user_id',
          'tenant_line_user_id', 'account_status', 'binding_status'
        ],
        [
          {
            tenant_id: 'TFIX88',
            workspace_id: 'WFIX88',
            tenant_user_id: 'UFIX88T',
            tenant_line_user_id: 'Ufixture-tenant-88',
            account_status: 'active',
            binding_status: 'bound'
          }
        ]
      )
    ),
    V2_landlords: new MockSheet(
      'V2_landlords',
      table(
        ['landlord_id', 'landlord_user_id', 'workspace_id', 'status'],
        [
          {
            landlord_id: 'LFIX88',
            landlord_user_id: 'UFIX88L',
            workspace_id: 'WFIX88',
            status: 'active'
          }
        ]
      )
    ),
    V2_users: new MockSheet(
      'V2_users',
      table(
        ['user_id', 'line_user_id', 'account_status'],
        [
          {
            user_id: 'UFIX88L',
            line_user_id: 'Ufixture-landlord-88',
            account_status: 'active'
          }
        ]
      )
    ),
    V2_workspace_members: new MockSheet(
      'V2_workspace_members',
      table(
        ['membership_id', 'workspace_id', 'user_id', 'status'],
        [
          {
            membership_id: 'WMFIX88',
            workspace_id: 'WFIX88',
            user_id: 'UFIX88L',
            status: 'active'
          }
        ]
      )
    )
  };
  const spreadsheet = new MockSpreadsheet(sheets);
  const properties = {
    LINE_CHANNEL_ACCESS_TOKEN:
      options.withToken === false ? '' : 'fixture-token-not-a-secret'
  };

  const context = {
    console,
    Date,
    Math,
    JSON,
    Object,
    Number,
    String,
    Array,
    Error,
    RegExp,
    runtimeRequireFeature_: () => true,
    runtimeSpreadsheet_: () => spreadsheet,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: key => properties[key] || ''
      })
    },
    LockService: {
      getDocumentLock: () => ({
        waitLock: () => true,
        releaseLock: () => true
      }),
      getUserLock: () => ({
        waitLock: () => true,
        releaseLock: () => true
      })
    },
    UrlFetchApp: {
      fetch: (url, request) => {
        const requestIndex = requests.length;
        requests.push({ url, request });
        return {
          getResponseCode: () => options.httpStatuses
            ? options.httpStatuses[Math.min(requestIndex, options.httpStatuses.length - 1)]
            : options.httpStatus || 200,
          getContentText: () => options.responseBody || '{}'
        };
      }
    },
    Utilities: {
      getUuid: () => {
        uuidCounter += 1;
        return String(uuidCounter).padStart(8, '0') +
          '-1234-1234-1234-123456789012';
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(serviceSource, context, {
    filename: 'V2_NOTIFICATION_SERVICE.js'
  });

  return { context, spreadsheet, requests };
}


function testReceiverResolution() {
  const { context } = createFixture();

  const tenant = context.notificationResolveReceiver_({
    receiver_type: 'tenant',
    receiver_id: 'TFIX88',
    workspace_id: 'WFIX88'
  });
  assert.strictEqual(tenant.success, true);
  assert.strictEqual(tenant.line_user_id, 'Ufixture-tenant-88');

  const landlord = context.notificationResolveReceiver_({
    receiver_type: 'landlord',
    receiver_id: 'LFIX88',
    workspace_id: 'WFIX88'
  });
  assert.strictEqual(landlord.success, true);
  assert.strictEqual(landlord.line_user_id, 'Ufixture-landlord-88');

  const isolated = context.notificationResolveReceiver_({
    receiver_type: 'landlord',
    receiver_id: 'LFIX88',
    workspace_id: 'WOTHER'
  });
  assert.strictEqual(isolated.success, false);
  assert.strictEqual(isolated.code, 'NOTIFICATION_LANDLORD_NOT_FOUND');
}


function testTenantAndLandlordDeliveryLogs() {
  const { context, spreadsheet, requests } = createFixture();

  const tenantResult = context.notificationSendLineText_({
    receiver: {
      receiver_type: 'tenant',
      receiver_id: 'TFIX88',
      workspace_id: 'WFIX88'
    },
    text: 'tenant fixture message',
    source: 'phase88_test',
    event_type: 'tenant_fixture',
    reference_id: 'REF-T-88'
  });

  const landlordResult = context.notificationSendLineText_({
    receiver: {
      receiver_type: 'landlord',
      receiver_id: 'LFIX88',
      workspace_id: 'WFIX88'
    },
    text: 'landlord fixture message',
    source: 'phase88_test',
    event_type: 'landlord_fixture',
    reference_id: 'REF-L-88'
  });

  assert.strictEqual(tenantResult.success, true);
  assert.strictEqual(landlordResult.success, true);
  assert.strictEqual(requests.length, 2);

  const tenantPayload = JSON.parse(requests[0].request.payload);
  const landlordPayload = JSON.parse(requests[1].request.payload);
  assert.strictEqual(tenantPayload.to, 'Ufixture-tenant-88');
  assert.strictEqual(landlordPayload.to, 'Ufixture-landlord-88');

  const logSheet = spreadsheet.getSheetByName('V2_notification_logs');
  assert.ok(logSheet, 'notification log sheet created');
  assert.strictEqual(logSheet.values.length, 3, 'header plus two delivery logs');

  const headers = logSheet.values[0];
  const receiverTypeIndex = headers.indexOf('receiver_type');
  const statusIndex = headers.indexOf('delivery_status');
  const providerResponseIndex = headers.indexOf('provider_response');
  const tokenLeak = logSheet.values.flat().some(value =>
    String(value).includes('fixture-token-not-a-secret')
  );

  assert.strictEqual(logSheet.values[1][receiverTypeIndex], 'tenant');
  assert.strictEqual(logSheet.values[2][receiverTypeIndex], 'landlord');
  assert.strictEqual(logSheet.values[1][statusIndex], 'sent');
  assert.strictEqual(logSheet.values[2][statusIndex], 'sent');
  assert.strictEqual(logSheet.values[1][providerResponseIndex], '');
  assert.strictEqual(logSheet.values[2][providerResponseIndex], '');
  assert.strictEqual(tokenLeak, false, 'access token never enters notification log');

  const queueSheet = spreadsheet.getSheetByName('V2_NOTIFICATION_QUEUE');
  const queueHeaders = queueSheet.values[0];
  assert.strictEqual(
    queueSheet.values[1][queueHeaders.indexOf('status')],
    'sent'
  );
}


function testMissingTokenFailsClosedAndLogs() {
  const { context, spreadsheet, requests } = createFixture({ withToken: false });
  const result = context.notificationSendLineText_({
    receiver: {
      receiver_type: 'tenant',
      receiver_id: 'TFIX88',
      workspace_id: 'WFIX88'
    },
    text: 'must not send'
  });

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.code, 'LINE_TOKEN_NOT_SET');
  assert.strictEqual(requests.length, 0);

  const logSheet = spreadsheet.getSheetByName('V2_notification_logs');
  const headers = logSheet.values[0];
  assert.strictEqual(
    logSheet.values[1][headers.indexOf('delivery_status')],
    'failed'
  );
}


function testLegacyBoundaryUsesService() {
  const apiSource = fs.readFileSync(
    path.join(appsRoot, 'V2_API.js'),
    'utf8'
  );
  const workspaceSource = fs.readFileSync(
    path.join(appsRoot, 'V2_WORKSPACE_NOTIFICATIONS.js'),
    'utf8'
  );
  const tenantMessageSource = fs.readFileSync(
    path.join(appsRoot, 'V2_TENANT_MESSAGES.js'),
    'utf8'
  );

  const legacyStart = apiSource.indexOf('function pushLineTextMessage_');
  const legacyEnd = apiSource.indexOf(
    '// ==================================================',
    legacyStart
  );
  const legacyFunction = apiSource.slice(legacyStart, legacyEnd);

  assert.ok(legacyFunction.includes('notificationSendLineText_'));
  assert.ok(!legacyFunction.includes('UrlFetchApp.fetch'));
  assert.ok(workspaceSource.includes('notificationSendLineText_({'));
  assert.ok(workspaceSource.includes('landlord_id:'));
  assert.ok(tenantMessageSource.includes('notificationSendLineText_({'));
  assert.ok(workspaceSource.includes('workspaceNotificationLogLine_('));
}


if (require.main === module) {
  testReceiverResolution();
  testTenantAndLandlordDeliveryLogs();
  testMissingTokenFailsClosedAndLogs();
  testLegacyBoundaryUsesService();
  console.log('Phase 88 notification service tests: PASS');
}

module.exports = { createFixture };
