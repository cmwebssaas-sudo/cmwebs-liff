import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const tenantLineUserId = 'tenant-line-148';

function paymentBill(overrides = {}) {
  return {
    line_user_id: tenantLineUserId,
    tenant_id: 'tenant-148',
    contract_id: 'contract-148',
    workspace_id: 'workspace-148',
    room_id: 'room-148',
    room_name: '201',
    bill_month: '2026-08',
    total_amount: 20100,
    payment_status: 'unpaid',
    bill_status: 'active',
    ...overrides
  };
}

function runTenantPaymentReportInit(sourcePath) {
  const malformedBill = paymentBill({ bill_id: '' });
  const validBill = paymentBill({ bill_id: 'bill-148' });
  const context = {
    Boolean,
    Date,
    Error,
    JSON,
    Math,
    Number,
    Object,
    String,
    getTenantHomeByLineUid() {
      return {
        success: true,
        data: {
          tenant_id: 'tenant-148',
          user_id: 'tenant-user-148',
          tenant_name: 'Tenant 148'
        }
      };
    },
    resolveCanonicalTenantRuntimeByLineUid_() {
      return {
        success: true,
        code: 'OK',
        message: 'runtime identity resolved',
        data: {
          line_user_id: tenantLineUserId,
          tenant_id: 'tenant-148',
          tenant_user_id: 'tenant-user-148',
          tenant_name: 'Tenant 148',
          tenant_bill_rows: [malformedBill, validBill]
        }
      };
    },
    getSheetObjects_(sheetName) {
      if (sheetName === 'V2_tenant_bill_view') {
        return [malformedBill, validBill];
      }
      return [];
    },
    runtimeSpreadsheet_() {
      return {
        getSheetByName() {
          return {};
        }
      };
    },
    v2CanonicalBillIsVoided_(bill) {
      return ['cancelled', 'voided'].includes(bill.bill_status);
    }
  };

  vm.runInNewContext(fs.readFileSync(sourcePath, 'utf8'), context);
  return context.getTenantPaymentReportInitByLineUid(tenantLineUserId);
}

{
  const result = runTenantPaymentReportInit(
    'apps-script/V2_TENANT_PAYMENT_REPORTS.js'
  );

  assert.equal(result.success, true);
  assert.deepEqual(
    result.data.bills.map((bill) => bill.bill_id),
    ['bill-148'],
    'tenant payment report init must not expose a blank bill row'
  );
}

{
  const source = fs.readFileSync(
    'apps-script/V2_LANDLORD_MANAGEMENT.js',
    'utf8'
  );
  assert.match(
    source,
    /function lmResolveEffectivePaymentReportStatus_\(/,
    'landlord payment reports must reconcile stale pending rows with bills'
  );

  const context = { String };
  vm.runInNewContext(
    [
      'function lmText_(value) { return value == null ? "" : String(value).trim(); }',
      source.slice(
        source.indexOf('function lmResolveEffectivePaymentReportStatus_('),
        source.indexOf('\n\n\n/**', source.indexOf('function lmResolveEffectivePaymentReportStatus_('))
      )
    ].join('\n'),
    context
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(context.lmResolveEffectivePaymentReportStatus_(
      { status: 'pending', matched_payment_id: '' },
      { payment_status: 'paid', payment_id: 'PAY-148' }
    ))),
    { status: 'confirmed', matched_payment_id: 'PAY-148' },
    'a paid bill must remove its stale payment report from pending review'
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.lmResolveEffectivePaymentReportStatus_(
      { status: 'pending', matched_payment_id: '' },
      { payment_status: 'unpaid', payment_id: '' }
    ))),
    { status: 'pending', matched_payment_id: '' },
    'an unpaid bill must remain pending'
  );

  const reportHeaders = [
    'report_id',
    'landlord_line_user_id',
    'landlord_id',
    'tenant_id',
    'bill_id',
    'status',
    'matched_payment_id'
  ];
  const reportRows = [
    reportHeaders,
    ['report-148', 'landlord-line-148', 'landlord-148', 'tenant-148', 'bill-148', 'pending', '']
  ];
  const billHeaders = ['bill_id', 'payment_status', 'payment_id'];
  const billRows = [
    billHeaders,
    ['bill-148', 'paid', 'PAY-148']
  ];
  function sheetFor(rows) {
    return {
      getLastRow() { return rows.length; },
      getLastColumn() { return rows[0].length; },
      getDataRange() { return { getValues() { return rows; } }; },
      getRange() {
        return {
          getValues() { return [rows[0]]; },
          setValue() {}
        };
      }
    };
  }
  const reportSheet = sheetFor(reportRows);
  const billSheet = sheetFor(billRows);
  const landlordContext = {
    landlord_id: 'landlord-148',
    landlord_user_id: 'landlord-user-148',
    landlord_line_user_id: 'landlord-line-148'
  };
  const landlordRuntime = {
    Boolean,
    Date,
    Error,
    Math,
    Number,
    Object,
    String,
    runtimeSpreadsheet_() {
      return {
        getSheetByName(name) {
          return name === 'V2_payment_reports' ? reportSheet : billSheet;
        }
      };
    },
    lmLogAccess_() {}
  };
  vm.runInNewContext(source, landlordRuntime);
  const landlordResult = landlordRuntime.getLandlordPaymentReportsInitByLineUid(
    'landlord-line-148',
    landlordContext
  );

  assert.equal(landlordResult.success, true);
  assert.equal(landlordResult.data.summary.pending, 0);
  assert.equal(landlordResult.data.summary.confirmed, 1);
  assert.equal(landlordResult.data.reports[0].status, 'confirmed');
}

{
  const source = fs.readFileSync(
    'apps-script/V2_PAYMENT_SETTLEMENT.js',
    'utf8'
  );
  let released = false;
  const context = {
    Boolean,
    Date,
    Error,
    JSON,
    Math,
    Number,
    Object,
    String,
    LockService: {
      getScriptLock() {
        return {
          tryLock() { return true; },
          releaseLock() { released = true; }
        };
      }
    },
    runtimeSpreadsheet_() {
      return {
        getSheetByName(name) {
          if (name !== 'V2_payment_reports') return null;
          return {
            getLastRow() { return 2; },
            getDataRange() {
              return {
                getValues() {
                  return [
                    ['report_id', 'landlord_line_user_id', 'bill_id'],
                    ['report-148', 'landlord-line-148', '']
                  ];
                }
              };
            }
          };
        }
      };
    },
    workspaceLandlordResolveAccess_() {
      return {
        success: true,
        principal_landlord_id: 'landlord-148',
        principal_line_user_id: 'landlord-line-148',
        principals: []
      };
    },
    billingBillMatchesAccessScope_() {
      return true;
    },
    logLiffAccess() {},
    logLiffAccess_() {}
  };
  vm.runInNewContext(source, context);

  const result = context.settleLandlordPaymentReportByLineUid_(
    'landlord-line-148',
    'report-148',
    ''
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    {
      success: false,
      code: 'REPORT_BILL_ID_EMPTY',
      message: '付款回報缺少帳單 ID'
    },
    'settlement must fail closed when a payment report has no bill ID'
  );
  assert.equal(released, true);
}

console.log('Phase 148 Version 102 payment reconciliation tests passed.');
