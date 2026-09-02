// V2.1 landlord-only checkout lifecycle.
// Checkout is an additive state transition on the original contract. It never
// rewrites the original term or contract document and never pushes the tenant.

const V2_CONTRACT_CHECKOUT_ALLOWED_PREDECESSOR_STATUSES_ = [
  'active',
  'expired',
  'approved',
  'completed'
];
const V2_CONTRACT_CHECKOUT_OPEN_SIBLING_STATUSES_ = [
  'active',
  'current',
  'pending_landlord_review',
  'pending_tenant_signature',
  'awaiting_tenant_signature'
];

const V2_CHECKOUT_SETTLEMENT_SHEET_ = 'V2_checkout_settlements';
const V2_CHECKOUT_SETTLEMENT_HEADERS_ = [
  'settlement_id', 'workspace_id', 'landlord_id', 'contract_id', 'tenant_id',
  'room_id', 'previous_bill_id', 'previous_bill_month',
  'previous_electricity_amount', 'previous_equipment_amount',
  'settlement_start_date', 'move_out_date', 'rent_days', 'days_in_month',
  'rent_amount', 'start_meter_reading', 'end_meter_reading', 'electricity_usage',
  'electricity_fee_rate', 'equipment_fee_rate', 'electricity_amount',
  'equipment_amount', 'deposit_amount', 'deposit_deduction_amount',
  'deposit_refund_amount', 'subtotal_amount', 'tenant_balance_due',
  'start_meter_document_id', 'end_meter_document_id', 'settlement_note',
  'settlement_status', 'idempotency_key', 'created_at', 'created_by_user_id',
  'completed_at'
];

const V2_CHECKOUT_SETTLEMENT_PAID_STATUSES_ = [
  'paid', 'confirmed', 'cancelled', 'canceled', 'void', 'voided'
];

function landlordContractCheckoutSettlementError_(code, message) {
  return { success: false, code: code, message: message };
}

function landlordContractCheckoutSettlementText_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function landlordContractCheckoutSettlementNumber_(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function landlordContractCheckoutSettlementRound_(value) {
  return Math.round(landlordContractCheckoutSettlementNumber_(value, 0));
}

function landlordContractCheckoutSettlementParseDate_(value) {
  const text = landlordContractCheckoutSettlementText_(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function landlordContractCheckoutSettlementFormatDate_(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-');
}

function landlordContractCheckoutSettlementDaysInMonth_(value) {
  const date = landlordContractCheckoutSettlementParseDate_(value);
  if (!date) return 0;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

function landlordContractCheckoutSettlementPreviousMonth_(value) {
  const date = landlordContractCheckoutSettlementParseDate_(value + '-01');
  if (!date) return '';
  date.setUTCMonth(date.getUTCMonth() - 1);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0')
  ].join('-');
}

function landlordContractCheckoutSettlementNormalizeMonth_(value) {
  const isDate = value instanceof Date || Object.prototype.toString.call(value) === '[object Date]';
  if (isDate && !Number.isNaN(value.getTime())) {
    if (typeof Utilities !== 'undefined' && Utilities && typeof Utilities.formatDate === 'function') {
      return Utilities.formatDate(value, 'Asia/Taipei', 'yyyy-MM');
    }
    return String(value.getUTCFullYear()) + '-' + String(value.getUTCMonth() + 1).padStart(2, '0');
  }
  const text = landlordContractCheckoutSettlementText_(value);
  const compactMatch = /^(\d{4})(\d{2})$/.exec(text);
  if (compactMatch) {
    const compactMonth = Number(compactMatch[2]);
    return compactMonth >= 1 && compactMonth <= 12 ? compactMatch[1] + '-' + compactMatch[2] : '';
  }
  const chineseMatch = /^(\d{4})\s*年\s*(\d{1,2})\s*月/.exec(text);
  const match = chineseMatch || /^(\d{4})[-\/](\d{1,2})(?:[-\/](\d{1,2}))?(?:$|T)/.exec(text);
  if (!match) return '';
  const month = Number(match[2]);
  if (month < 1 || month > 12) return '';
  return match[1] + '-' + String(month).padStart(2, '0');
}

function landlordContractCheckoutSettlementBillIsUnpaid_(bill) {
  if (!bill) return false;
  const statuses = [bill.payment_status, bill.bill_status, bill.status]
    .map(function(status) { return landlordContractCheckoutSettlementText_(status).toLowerCase(); })
    .filter(function(status) { return status; });
  return !statuses.some(function(status) {
    return V2_CHECKOUT_SETTLEMENT_PAID_STATUSES_.indexOf(status) >= 0;
  });
}

function landlordContractCheckoutSettlementRate_(value) {
  if (value === null || value === undefined || landlordContractCheckoutSettlementText_(value) === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function landlordContractCheckoutSettlementFirstRate_(candidates, fallback) {
  for (let index = 0; index < candidates.length; index += 1) {
    const rate = landlordContractCheckoutSettlementRate_(candidates[index]);
    if (rate !== null) return rate;
  }
  const fallbackRate = landlordContractCheckoutSettlementRate_(fallback);
  return fallbackRate === null ? 0 : fallbackRate;
}

function landlordContractCheckoutSettlementResolveRates_(ss, access, contract, room, settlementStartDate) {
  const targetContract = contract || {};
  const targetRoom = room || {};
  const settings = typeof settingsIntegrationGetWorkspaceSettings_ === 'function'
    ? settingsIntegrationGetWorkspaceSettings_(ss, access)
    : {
        default_electricity_fee_rate: 3,
        summer_equipment_fee_rate: 3.5,
        regular_equipment_fee_rate: 2.5,
        summer_months: [6, 7, 8, 9]
      };
  const summerMonths = typeof settingsIntegrationResolveSummerMonths_ === 'function'
    ? settingsIntegrationResolveSummerMonths_(targetRoom.equipment_summer_months || targetContract.equipment_summer_months, settings)
    : (Array.isArray(settings.summer_months) ? settings.summer_months : [6, 7, 8, 9]);
  const month = Number(String(settlementStartDate || '').slice(5, 7));
  const electricityFeeRate = landlordContractCheckoutSettlementFirstRate_([
    targetContract.electricity_fee_rate,
    targetContract.electricity_rate,
    targetRoom.electricity_fee_rate,
    targetRoom.electricity_rate
  ], settings.default_electricity_fee_rate);
  const genericEquipmentRate = landlordContractCheckoutSettlementRate_(targetContract.equipment_fee_rate);
  const roomGenericEquipmentRate = landlordContractCheckoutSettlementRate_(targetRoom.equipment_fee_rate);
  const equipmentFeeRate = genericEquipmentRate !== null
    ? genericEquipmentRate
    : roomGenericEquipmentRate !== null
      ? roomGenericEquipmentRate
      : summerMonths.indexOf(month) >= 0
        ? landlordContractCheckoutSettlementFirstRate_([
            targetContract.equipment_fee_rate_summer,
            targetContract.summer_equipment_fee_rate,
            targetRoom.equipment_fee_rate_summer,
            targetRoom.summer_equipment_fee_rate
          ], settings.summer_equipment_fee_rate)
        : landlordContractCheckoutSettlementFirstRate_([
            targetContract.equipment_fee_rate_regular,
            targetContract.regular_equipment_fee_rate,
            targetContract.non_summer_equipment_fee_rate,
            targetRoom.equipment_fee_rate_regular,
            targetRoom.regular_equipment_fee_rate,
            targetRoom.non_summer_equipment_fee_rate
          ], settings.regular_equipment_fee_rate);
  return {
    electricity_fee_rate: electricityFeeRate,
    equipment_fee_rate: equipmentFeeRate
  };
}

function landlordContractCheckoutSettlementValidateInput_(input) {
  const normalized = input || {};
  const contract = normalized.contract || {};
  const moveOutDate = landlordContractCheckoutSettlementText_(normalized.moveOutDate || normalized.move_out_date);
  const startDate = landlordContractCheckoutSettlementText_(contract.start_date || contract.contract_start_date);
  const moveOut = landlordContractCheckoutSettlementParseDate_(moveOutDate);
  const leaseStart = landlordContractCheckoutSettlementParseDate_(startDate);
  if (!moveOut || !leaseStart || moveOutDate < startDate) return landlordContractCheckoutSettlementError_('CHECKOUT_MOVE_OUT_DATE_INVALID', '退房日期無效或早於租約起始日');

  const startMeterReading = landlordContractCheckoutSettlementNumber_(normalized.startMeterReading === undefined ? normalized.start_meter_reading : normalized.startMeterReading, NaN);
  const endMeterReading = landlordContractCheckoutSettlementNumber_(normalized.endMeterReading === undefined ? normalized.end_meter_reading : normalized.endMeterReading, NaN);
  if (!Number.isFinite(startMeterReading) || !Number.isFinite(endMeterReading) || startMeterReading < 0 || endMeterReading < startMeterReading) {
    return landlordContractCheckoutSettlementError_('CHECKOUT_METER_READING_INVALID', '電表起始或結束度數無效');
  }

  const depositAmount = landlordContractCheckoutSettlementRound_(contract.deposit_amount);
  const depositDeductionAmount = landlordContractCheckoutSettlementNumber_(normalized.depositDeductionAmount === undefined ? normalized.deposit_deduction_amount : normalized.depositDeductionAmount, NaN);
  if (!Number.isFinite(depositAmount) || depositAmount < 0 || !Number.isFinite(depositDeductionAmount) || depositDeductionAmount < 0 || depositDeductionAmount > depositAmount) {
    return landlordContractCheckoutSettlementError_('CHECKOUT_DEPOSIT_DEDUCTION_INVALID', '押金扣除金額超過押金或無效');
  }
  const deductionNote = landlordContractCheckoutSettlementText_(normalized.depositDeductionNote || normalized.deposit_deduction_note);
  if (depositDeductionAmount > 0 && !deductionNote) return landlordContractCheckoutSettlementError_('CHECKOUT_DEPOSIT_DEDUCTION_NOTE_REQUIRED', '有押金扣除時必須填寫說明');
  return { success: true, code: 'OK' };
}

function landlordContractCheckoutSettlementPreviousUtility_(previousBill, settlementStartDate) {
  const bill = previousBill || {};
  const expectedMonth = landlordContractCheckoutSettlementPreviousMonth_(settlementStartDate.slice(0, 7));
  if (!bill || landlordContractCheckoutSettlementNormalizeMonth_(bill.bill_month) !== expectedMonth || !landlordContractCheckoutSettlementBillIsUnpaid_(bill)) {
    return { electricity_amount: 0, equipment_amount: 0 };
  }
  return {
    electricity_amount: landlordContractCheckoutSettlementRound_(bill.electricity_amount),
    equipment_amount: landlordContractCheckoutSettlementRound_(bill.equipment_amount)
  };
}

function landlordContractCheckoutSettlementCalculate_(input) {
  const normalized = input || {};
  const validation = landlordContractCheckoutSettlementValidateInput_(normalized);
  if (!validation.success) return validation;

  const contract = normalized.contract || {};
  const moveOutDate = landlordContractCheckoutSettlementText_(normalized.moveOutDate || normalized.move_out_date);
  const moveOut = landlordContractCheckoutSettlementParseDate_(moveOutDate);
  const settlementStartDate = landlordContractCheckoutSettlementFormatDate_(new Date(Date.UTC(moveOut.getUTCFullYear(), moveOut.getUTCMonth(), 1)));
  const daysInMonth = landlordContractCheckoutSettlementDaysInMonth_(moveOutDate);
  const rentDays = moveOut.getUTCDate();
  const rentAmount = landlordContractCheckoutSettlementRound_(landlordContractCheckoutSettlementNumber_(contract.rent_amount === undefined ? contract.monthly_rent : contract.rent_amount, 0) * rentDays / daysInMonth);
  const startMeterReading = landlordContractCheckoutSettlementNumber_(normalized.startMeterReading === undefined ? normalized.start_meter_reading : normalized.startMeterReading, 0);
  const endMeterReading = landlordContractCheckoutSettlementNumber_(normalized.endMeterReading === undefined ? normalized.end_meter_reading : normalized.endMeterReading, 0);
  const electricityUsage = endMeterReading - startMeterReading;
  const electricityFeeRate = landlordContractCheckoutSettlementNumber_(contract.electricity_fee_rate, 0);
  const equipmentFeeRate = landlordContractCheckoutSettlementNumber_(contract.equipment_fee_rate, 0);
  const electricityAmount = landlordContractCheckoutSettlementRound_(electricityUsage * electricityFeeRate);
  const equipmentAmount = landlordContractCheckoutSettlementRound_(electricityUsage * equipmentFeeRate);
  const previousUtility = landlordContractCheckoutSettlementPreviousUtility_(normalized.previousBill, settlementStartDate);
  const depositAmount = landlordContractCheckoutSettlementRound_(contract.deposit_amount);
  const depositDeductionAmount = landlordContractCheckoutSettlementRound_(normalized.depositDeductionAmount === undefined ? normalized.deposit_deduction_amount : normalized.depositDeductionAmount);
  const subtotalAmount = landlordContractCheckoutSettlementRound_(previousUtility.electricity_amount + previousUtility.equipment_amount + rentAmount + electricityAmount + equipmentAmount);
  return {
    success: true,
    code: 'OK',
    data: {
      settlement_start_date: settlementStartDate,
      move_out_date: moveOutDate,
      rent_days: rentDays,
      days_in_month: daysInMonth,
      rent_amount: rentAmount,
      start_meter_reading: startMeterReading,
      end_meter_reading: endMeterReading,
      electricity_usage: electricityUsage,
      electricity_amount: electricityAmount,
      equipment_amount: equipmentAmount,
      previous_electricity_amount: previousUtility.electricity_amount,
      previous_equipment_amount: previousUtility.equipment_amount,
      subtotal_amount: subtotalAmount,
      deposit_amount: depositAmount,
      deposit_deduction_amount: depositDeductionAmount,
      deposit_refund_amount: Math.max(0, depositAmount - depositDeductionAmount),
      tenant_balance_due: Math.max(0, subtotalAmount - depositDeductionAmount)
    }
  };
}

function landlordContractCheckoutSettlementEnsureSheet_(ss) {
  const spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet || typeof spreadsheet.getSheetByName !== 'function') return landlordContractCheckoutSettlementError_('CHECKOUT_SETTLEMENT_SPREADSHEET_REQUIRED', '找不到結算資料表');
  let sheet = spreadsheet.getSheetByName(V2_CHECKOUT_SETTLEMENT_SHEET_);
  if (!sheet && typeof spreadsheet.insertSheet === 'function') sheet = spreadsheet.insertSheet(V2_CHECKOUT_SETTLEMENT_SHEET_);
  if (!sheet) return landlordContractCheckoutSettlementError_('CHECKOUT_SETTLEMENT_SHEET_REQUIRED', '無法建立退房結算資料表');
  const lastColumn = Number(sheet.getLastColumn && sheet.getLastColumn()) || 0;
  const existingHeaders = lastColumn > 0 && sheet.getRange ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(header) { return landlordContractCheckoutSettlementText_(header); }) : [];
  const addedHeaders = [];
  if (existingHeaders.length === 0) {
    sheet.getRange(1, 1, 1, V2_CHECKOUT_SETTLEMENT_HEADERS_.length).setValues([V2_CHECKOUT_SETTLEMENT_HEADERS_.slice()]);
    addedHeaders.push.apply(addedHeaders, V2_CHECKOUT_SETTLEMENT_HEADERS_);
  } else {
    V2_CHECKOUT_SETTLEMENT_HEADERS_.forEach(function(header) {
      if (existingHeaders.indexOf(header) < 0) addedHeaders.push(header);
    });
    if (addedHeaders.length > 0) sheet.getRange(1, existingHeaders.length + 1, 1, addedHeaders.length).setValues([addedHeaders]);
  }
  return { success: true, code: 'OK', data: { sheet: sheet, added_headers: addedHeaders } };
}

function runV2CheckoutSettlementProductionMigration() {
  return landlordContractCheckoutSettlementEnsureSheet_(SpreadsheetApp.getActiveSpreadsheet());
}

function landlordContractCheckoutSettlementSchema_(ss, ensureSettlementSheet) {
  const schema = landlordInitiatedContractSchema_(ss);
  if (!schema.success) return schema;
  let settlementSheet = schema.data.settlements || ss.getSheetByName(V2_CHECKOUT_SETTLEMENT_SHEET_);
  if (!settlementSheet && ensureSettlementSheet === true) {
    const ensured = landlordContractCheckoutSettlementEnsureSheet_(ss);
    if (!ensured.success) return ensured;
    settlementSheet = ensured.data.sheet;
  }
  if (!settlementSheet) return landlordContractCheckoutSettlementError_('CHECKOUT_SETTLEMENT_SCHEMA_NOT_READY', '退房結算資料表尚未就緒');
  return {
    success: true,
    code: 'OK',
    data: Object.assign({}, schema.data, {
      bills: ss.getSheetByName('V2_bills'),
      documents: ss.getSheetByName('V2_contract_documents'),
      settlements: settlementSheet
    })
  };
}

function landlordContractCheckoutSettlementUuid_() {
  if (typeof Utilities !== 'undefined' && Utilities && typeof Utilities.getUuid === 'function') return String(Utilities.getUuid());
  return 'checkout-settlement-' + String(new Date().getTime()) + '-' + String(Math.floor(Math.random() * 1000000));
}

function landlordContractCheckoutSettlementFindPreviousBill_(sheet, access, contract, settlementStartDate) {
  if (!sheet) return null;
  const expectedMonth = landlordContractCheckoutSettlementPreviousMonth_(settlementStartDate.slice(0, 7));
  return landlordContractCheckoutRows_(sheet).find(function(row) {
    return landlordInitiatedContractText_(row.workspace_id) === landlordInitiatedContractWorkspaceId_(access) &&
      landlordInitiatedContractText_(row.contract_id) === landlordInitiatedContractText_(contract.contract_id) &&
      landlordInitiatedContractText_(row.tenant_id) === landlordInitiatedContractText_(contract.tenant_id) &&
      landlordInitiatedContractText_(row.room_id) === landlordInitiatedContractText_(contract.room_id) &&
      landlordContractCheckoutSettlementNormalizeMonth_(row.bill_month) === expectedMonth &&
      landlordContractCheckoutSettlementBillIsUnpaid_(row);
  }) || null;
}

function landlordContractCheckoutSettlementPublicBill_(bill) {
  if (!bill) return null;
  return {
    bill_id: landlordInitiatedContractText_(bill.bill_id),
    bill_month: landlordContractCheckoutSettlementNormalizeMonth_(bill.bill_month),
    payment_status: landlordInitiatedContractText_(bill.payment_status || bill.status).toLowerCase(),
    electricity_amount: landlordContractCheckoutSettlementRound_(bill.electricity_amount),
    equipment_amount: landlordContractCheckoutSettlementRound_(bill.equipment_amount)
  };
}

function landlordContractCheckoutSettlementSource_(schema, access, contractId, moveOutDate) {
  const contract = landlordContractCheckoutFindContract_(schema.data.contracts, access, contractId);
  if (!contract) return landlordContractCheckoutSettlementError_('CONTRACT_NOT_FOUND', '找不到可辦理退房的合約');
  const room = landlordInitiatedContractFindScopedRow_(schema.data.rooms, access, 'room_id', contract.room_id);
  const tenant = landlordInitiatedContractFindScopedRow_(schema.data.tenants, access, 'tenant_id', contract.tenant_id);
  if (!room) return landlordContractCheckoutSettlementError_('ROOM_NOT_FOUND', '找不到合約所屬房間');
  const originalEndDate = landlordContractCheckoutOriginalEndDate_(contract);
  const selectedMoveOutDate = landlordInitiatedContractText_(moveOutDate) || originalEndDate;
  const eligibility = landlordContractCheckoutValidateTarget_(contract, room, landlordContractCheckoutFindSiblings_(schema.data.contracts, access, contract), {
    workspace_id: landlordInitiatedContractWorkspaceId_(access),
    move_out_date: selectedMoveOutDate
  });
  if (!eligibility.success) return eligibility;
  const moveOut = landlordContractCheckoutSettlementParseDate_(selectedMoveOutDate);
  const settlementStartDate = landlordContractCheckoutSettlementFormatDate_(new Date(Date.UTC(moveOut.getUTCFullYear(), moveOut.getUTCMonth(), 1)));
  const rates = landlordContractCheckoutSettlementResolveRates_(SpreadsheetApp.getActiveSpreadsheet(), access, contract, room, settlementStartDate);
  const previousBill = landlordContractCheckoutSettlementFindPreviousBill_(schema.data.bills, access, contract, settlementStartDate);
  const previousUtility = landlordContractCheckoutSettlementPreviousUtility_(previousBill, settlementStartDate);
  return {
    success: true,
    code: 'OK',
    data: {
      contract: Object.assign({}, contract, { original_end_date: originalEndDate }),
      tenant: tenant || null,
      room: room,
      previous_bill: landlordContractCheckoutSettlementPublicBill_(previousBill),
      settlement: {
        settlement_start_date: settlementStartDate,
        move_out_date: selectedMoveOutDate,
        previous_bill_id: previousBill ? landlordInitiatedContractText_(previousBill.bill_id) : '',
        previous_bill_month: previousBill ? landlordContractCheckoutSettlementNormalizeMonth_(previousBill.bill_month) : '',
        previous_electricity_amount: previousUtility.electricity_amount,
        previous_equipment_amount: previousUtility.equipment_amount,
        rent_amount: landlordContractCheckoutSettlementRound_(contract.rent_amount === undefined ? contract.monthly_rent : contract.rent_amount),
        deposit_amount: landlordContractCheckoutSettlementRound_(contract.deposit_amount),
        electricity_fee_rate: rates.electricity_fee_rate,
        equipment_fee_rate: rates.equipment_fee_rate
      }
    }
  };
}

function landlordContractCheckoutSettlementInitBySession_(sessionToken, contractId, moveOutDate) {
  const access = landlordContractCheckoutAccessFromSession_(sessionToken, 'read');
  if (!access.success) return access;
  const schema = landlordContractCheckoutSettlementSchema_(SpreadsheetApp.getActiveSpreadsheet(), false);
  if (!schema.success) return schema;
  return landlordContractCheckoutSettlementSource_(schema, access, contractId, moveOutDate);
}

function landlordContractCheckoutSettlementPreviewBySession_(sessionToken, input) {
  const normalized = input || {};
  const access = landlordContractCheckoutAccessFromSession_(sessionToken, 'read');
  if (!access.success) return access;
  const schema = landlordContractCheckoutSettlementSchema_(SpreadsheetApp.getActiveSpreadsheet(), false);
  if (!schema.success) return schema;
  const source = landlordContractCheckoutSettlementSource_(schema, access, normalized.contract_id, normalized.move_out_date || normalized.moveOutDate);
  if (!source.success) return source;
  const calculation = landlordContractCheckoutSettlementCalculate_(Object.assign({}, normalized, {
    contract: Object.assign({}, source.data.contract, {
      electricity_fee_rate: source.data.settlement.electricity_fee_rate,
      equipment_fee_rate: source.data.settlement.equipment_fee_rate
    }),
    previousBill: source.data.previous_bill
  }));
  if (!calculation.success) return calculation;
  return {
    success: true,
    code: 'OK',
    data: {
      contract_id: landlordInitiatedContractText_(source.data.contract.contract_id),
      tenant_id: landlordInitiatedContractText_(source.data.contract.tenant_id),
      settlement: Object.assign({}, calculation.data, {
        previous_bill_id: source.data.settlement.previous_bill_id,
        previous_bill_month: source.data.settlement.previous_bill_month,
        electricity_fee_rate: source.data.settlement.electricity_fee_rate,
        equipment_fee_rate: source.data.settlement.equipment_fee_rate
      })
    }
  };
}

function landlordContractCheckoutSettlementFindExisting_(sheet, access, contractId) {
  if (!sheet) return null;
  return landlordContractCheckoutRows_(sheet).find(function(row) {
    return landlordInitiatedContractText_(row.workspace_id) === landlordInitiatedContractWorkspaceId_(access) && landlordInitiatedContractText_(row.contract_id) === landlordInitiatedContractText_(contractId);
  }) || null;
}

function landlordContractCheckoutSettlementHasStoredDocument_(sheet, access, contract, documentId, documentType) {
  if (!sheet) return false;
  return landlordContractCheckoutRows_(sheet).some(function(row) {
    const status = landlordInitiatedContractText_(row.status || 'stored').toLowerCase();
    return landlordInitiatedContractText_(row.document_id) === landlordInitiatedContractText_(documentId) &&
      landlordInitiatedContractText_(row.document_type).toLowerCase() === documentType &&
      landlordInitiatedContractText_(row.workspace_id) === landlordInitiatedContractWorkspaceId_(access) &&
      landlordInitiatedContractText_(row.contract_id) === landlordInitiatedContractText_(contract.contract_id) &&
      landlordInitiatedContractText_(row.tenant_id) === landlordInitiatedContractText_(contract.tenant_id) &&
      ['stored', 'active'].indexOf(status) >= 0;
  });
}

function landlordContractCheckoutSettlementResult_(row, calculation, idempotent) {
  return {
    success: true,
    code: idempotent ? 'IDEMPOTENT' : 'OK',
    data: {
      settlement_id: landlordInitiatedContractText_(row.settlement_id),
      contract_id: landlordInitiatedContractText_(row.contract_id),
      tenant_id: landlordInitiatedContractText_(row.tenant_id),
      settlement_status: landlordInitiatedContractText_(row.settlement_status),
      subtotal_amount: calculation.subtotal_amount,
      deposit_deduction_amount: calculation.deposit_deduction_amount,
      tenant_balance_due: calculation.tenant_balance_due,
      deposit_refund_amount: calculation.deposit_refund_amount,
      idempotent: idempotent === true
    }
  };
}

function landlordContractCheckoutSettlementApplyUnlocked_(access, schema, input) {
  const normalized = input || {};
  const contractId = landlordInitiatedContractText_(normalized.contract_id);
  const idempotencyKey = landlordInitiatedContractText_(normalized.idempotency_key);
  if (!contractId || !idempotencyKey) return landlordContractCheckoutSettlementError_('CHECKOUT_SETTLEMENT_INPUT_REQUIRED', '缺少合約或退房結算操作識別碼');
  if (idempotencyKey.length > 160) return landlordContractCheckoutSettlementError_('CHECKOUT_SETTLEMENT_IDEMPOTENCY_KEY_INVALID', '退房結算操作識別碼無效');
  const settlementSheet = schema && schema.data && schema.data.settlements;
  if (!settlementSheet) return landlordContractCheckoutSettlementError_('CHECKOUT_SETTLEMENT_SCHEMA_NOT_READY', '退房結算資料表尚未就緒');
  const existing = landlordContractCheckoutSettlementFindExisting_(settlementSheet, access, contractId);
  if (existing) {
    if (landlordInitiatedContractText_(existing.idempotency_key) === idempotencyKey && landlordInitiatedContractText_(existing.settlement_status).toLowerCase() === 'completed') {
      return landlordContractCheckoutSettlementResult_(existing, {
        subtotal_amount: landlordContractCheckoutSettlementRound_(existing.subtotal_amount),
        deposit_deduction_amount: landlordContractCheckoutSettlementRound_(existing.deposit_deduction_amount),
        tenant_balance_due: landlordContractCheckoutSettlementRound_(existing.tenant_balance_due),
        deposit_refund_amount: landlordContractCheckoutSettlementRound_(existing.deposit_refund_amount)
      }, true);
    }
    return landlordContractCheckoutSettlementError_('CHECKOUT_SETTLEMENT_ALREADY_EXISTS', '此合約已有退房結算紀錄');
  }

  const contract = landlordContractCheckoutFindContract_(schema.data.contracts, access, contractId);
  if (!contract) return landlordContractCheckoutSettlementError_('CONTRACT_NOT_FOUND', '找不到可辦理退房的合約');
  const room = landlordInitiatedContractFindScopedRow_(schema.data.rooms, access, 'room_id', contract.room_id);
  if (!room) return landlordContractCheckoutSettlementError_('ROOM_NOT_FOUND', '找不到合約所屬房間');
  const tenant = landlordInitiatedContractFindScopedRow_(schema.data.tenants, access, 'tenant_id', contract.tenant_id);
  const moveOutDate = landlordInitiatedContractText_(normalized.move_out_date || normalized.moveOutDate);
  const validation = landlordContractCheckoutValidateTarget_(contract, room, landlordContractCheckoutFindSiblings_(schema.data.contracts, access, contract), {
    workspace_id: landlordInitiatedContractWorkspaceId_(access),
    move_out_date: moveOutDate
  });
  if (!validation.success) return validation;
  const startMeterDocumentId = landlordContractCheckoutSettlementText_(normalized.start_meter_document_id || normalized.startMeterDocumentId);
  const endMeterDocumentId = landlordContractCheckoutSettlementText_(normalized.end_meter_document_id || normalized.endMeterDocumentId);
  if (!startMeterDocumentId || !endMeterDocumentId || !landlordContractCheckoutSettlementHasStoredDocument_(schema.data.documents, access, contract, startMeterDocumentId, 'checkout_start_meter') || !landlordContractCheckoutSettlementHasStoredDocument_(schema.data.documents, access, contract, endMeterDocumentId, 'checkout_end_meter')) return landlordContractCheckoutSettlementError_('CHECKOUT_METER_DOCUMENTS_REQUIRED', '退房時必須上傳起始與結束電表照片');
  const parsedMoveOut = landlordContractCheckoutSettlementParseDate_(moveOutDate);
  const settlementStartDate = landlordContractCheckoutSettlementFormatDate_(new Date(Date.UTC(parsedMoveOut.getUTCFullYear(), parsedMoveOut.getUTCMonth(), 1)));
  const rates = landlordContractCheckoutSettlementResolveRates_(SpreadsheetApp.getActiveSpreadsheet(), access, contract, room, settlementStartDate);
  const previousBill = landlordContractCheckoutSettlementFindPreviousBill_(schema.data.bills, access, contract, settlementStartDate);
  const calculation = landlordContractCheckoutSettlementCalculate_(Object.assign({}, normalized, {
    contract: Object.assign({}, contract, rates),
    previousBill: previousBill
  }));
  if (!calculation.success) return calculation;
  const settlementId = landlordContractCheckoutSettlementUuid_();
  const nowIso = new Date().toISOString();
  const row = Object.assign({}, calculation.data, {
    settlement_id: settlementId,
    workspace_id: landlordInitiatedContractWorkspaceId_(access),
    landlord_id: landlordInitiatedContractLandlordId_(access),
    contract_id: landlordInitiatedContractText_(contract.contract_id),
    tenant_id: landlordInitiatedContractText_(contract.tenant_id),
    room_id: landlordInitiatedContractText_(contract.room_id),
    previous_bill_id: previousBill ? landlordInitiatedContractText_(previousBill.bill_id) : '',
    previous_bill_month: previousBill ? landlordContractCheckoutSettlementNormalizeMonth_(previousBill.bill_month) : '',
    electricity_fee_rate: rates.electricity_fee_rate,
    equipment_fee_rate: rates.equipment_fee_rate,
    start_meter_document_id: startMeterDocumentId,
    end_meter_document_id: endMeterDocumentId,
    settlement_note: landlordContractCheckoutSettlementText_(normalized.settlement_note || normalized.note),
    settlement_status: 'completed',
    idempotency_key: idempotencyKey,
    created_at: nowIso,
    created_by_user_id: landlordInitiatedContractText_(access.user && access.user.user_id),
    completed_at: nowIso
  });
  landlordInitiatedContractAppend_(settlementSheet, row);
  return landlordContractCheckoutSettlementResult_(row, calculation.data, false);
}

function landlordContractCheckoutEvidenceUploadBySession_(sessionToken, input) {
  const normalized = input || {};
  const documentType = landlordContractCheckoutSettlementText_(normalized.document_type || normalized.documentType).toLowerCase();
  if (['checkout_start_meter', 'checkout_end_meter'].indexOf(documentType) < 0) return landlordContractCheckoutSettlementError_('INVALID_CHECKOUT_EVIDENCE_TYPE', '退房結算照片類型無效');
  const mimeType = landlordContractCheckoutSettlementText_(normalized.mime_type || normalized.mimeType).toLowerCase();
  if (['image/jpeg', 'image/png'].indexOf(mimeType) < 0) return landlordContractCheckoutSettlementError_('INVALID_CHECKOUT_EVIDENCE_MIME_TYPE', '電表照片僅支援 JPG 或 PNG');
  const access = landlordContractCheckoutAccessFromSession_(sessionToken, 'contract_write');
  if (!access.success) return access;
  const schema = landlordInitiatedContractSchema_(SpreadsheetApp.getActiveSpreadsheet());
  if (!schema.success) return schema;
  const contractId = landlordInitiatedContractText_(normalized.contract_id || normalized.contractId);
  const contract = landlordContractCheckoutFindContract_(schema.data.contracts, access, contractId);
  if (!contract) return landlordContractCheckoutSettlementError_('CONTRACT_NOT_FOUND', '找不到可辦理退房的合約');
  const tenantId = landlordInitiatedContractText_(normalized.tenant_id || normalized.tenantId);
  if (tenantId && tenantId !== landlordInitiatedContractText_(contract.tenant_id)) return landlordContractCheckoutSettlementError_('CHECKOUT_TENANT_SCOPE_INVALID', '房客不屬於此合約');
  if (typeof uploadLandlordContractDocumentByLineUid_ !== 'function') return landlordContractCheckoutSettlementError_('LANDLORD_DOCUMENT_MODULE_REQUIRED', '找不到私有文件上傳模組');
  const verifiedLineUserId = landlordInitiatedContractText_(access.line_user_id || access.principal_line_user_id);
  if (!verifiedLineUserId) return landlordContractCheckoutSettlementError_('WORKSPACE_ACCESS_DENIED', '房東 session 缺少驗證身份');
  return uploadLandlordContractDocumentByLineUid_(
    verifiedLineUserId,
    contractId,
    landlordInitiatedContractText_(contract.tenant_id),
    documentType,
    normalized.file_name || normalized.fileName,
    mimeType,
    normalized.base64,
    normalized.idempotency_key || normalized.idempotencyKey,
    normalized.note
  );
}

function landlordContractCheckoutInitBySession_(sessionToken, contractId) {
  const access = landlordContractCheckoutAccessFromSession_(sessionToken, 'read');
  if (!access.success) return access;
  const schema = landlordInitiatedContractSchema_(SpreadsheetApp.getActiveSpreadsheet());
  if (!schema.success) return schema;
  const contract = landlordContractCheckoutFindContract_(schema.data.contracts, access, contractId);
  if (!contract) return landlordInitiatedContractError_('CONTRACT_NOT_FOUND', '找不到可辦理退房的合約');
  const room = landlordInitiatedContractFindScopedRow_(schema.data.rooms, access, 'room_id', contract.room_id);
  const tenant = landlordInitiatedContractFindScopedRow_(schema.data.tenants, access, 'tenant_id', contract.tenant_id);
  if (!room) return landlordInitiatedContractError_('ROOM_NOT_FOUND', '找不到合約所屬房間');
  const siblings = landlordContractCheckoutFindSiblings_(schema.data.contracts, access, contract);
  const originalEndDate = landlordContractCheckoutOriginalEndDate_(contract);
  const eligibility = landlordContractCheckoutValidateTarget_(contract, room, siblings, {
    workspace_id: landlordInitiatedContractWorkspaceId_(access),
    move_out_date: originalEndDate
  });
  return {
    success: true,
    code: 'OK',
    data: {
      contract: Object.assign({}, contract, { original_end_date: originalEndDate }),
      tenant: tenant || null,
      room: room,
      default_move_out_date: originalEndDate,
      eligibility: {
        can_checkout: eligibility.success === true,
        code: eligibility.success ? 'OK' : eligibility.code,
        message: eligibility.success ? '可以辦理退房' : eligibility.message
      }
    }
  };
}

function landlordContractCheckoutCompleteBySession_(sessionToken, input) {
  let result = landlordInitiatedContractWithScriptLock_(function() {
    const access = landlordContractCheckoutAccessFromSession_(sessionToken, 'contract_write');
    if (!access.success) return access;
    const schema = landlordContractCheckoutSettlementSchema_(SpreadsheetApp.getActiveSpreadsheet(), true);
    if (!schema.success) return schema;
    return landlordContractCheckoutApplyUnlocked_(access, schema, input || {});
  });

  if (result && result.success === true && result.data && result.data.access) {
    if (result.data.idempotent !== true && typeof workspaceRecordOperationActor_ === 'function') {
      try {
        workspaceRecordOperationActor_(result.data.access, 'landlord_contract_checkout_complete', result, {
          target_type: 'contract',
          target_id: result.data.contract_id,
          secondary_target_id: result.data.tenant_id || '',
          detail: {
            move_out_date: result.data.move_out_date,
            checkout_source: result.data.checkout_source
          }
        });
      } catch (_) {}
    }
    delete result.data.access;
  }
  return result;
}

function landlordContractCheckoutApplyUnlocked_(access, schema, input) {
  const normalizedInput = input || {};
  const contractId = landlordInitiatedContractText_(normalizedInput.contract_id);
  const idempotencyKey = landlordInitiatedContractText_(normalizedInput.idempotency_key);
  const moveOutDate = landlordInitiatedContractText_(normalizedInput.move_out_date);
  const note = landlordInitiatedContractText_(normalizedInput.note);
  if (!contractId || !idempotencyKey) return landlordInitiatedContractError_('CHECKOUT_INPUT_REQUIRED', '缺少合約或退房操作識別碼');
  if (idempotencyKey.length > 160) return landlordInitiatedContractError_('CHECKOUT_IDEMPOTENCY_KEY_INVALID', '退房操作識別碼無效');

  const contract = landlordContractCheckoutFindContract_(schema.data.contracts, access, contractId);
  if (!contract) return landlordInitiatedContractError_('CONTRACT_NOT_FOUND', '找不到可辦理退房的合約');
  const existingCheckoutStatus = landlordInitiatedContractText_(contract.checkout_status).toLowerCase();
  if (existingCheckoutStatus === 'completed') {
    if (landlordInitiatedContractText_(contract.checkout_idempotency_key) === idempotencyKey) {
      const existingSettlement = landlordContractCheckoutSettlementFindExisting_(schema.data.settlements, access, contractId);
      return landlordContractCheckoutResult_(access, contract, true, existingSettlement ? {
        settlement_id: landlordInitiatedContractText_(existingSettlement.settlement_id),
        subtotal_amount: landlordContractCheckoutSettlementRound_(existingSettlement.subtotal_amount),
        deposit_deduction_amount: landlordContractCheckoutSettlementRound_(existingSettlement.deposit_deduction_amount),
        tenant_balance_due: landlordContractCheckoutSettlementRound_(existingSettlement.tenant_balance_due),
        deposit_refund_amount: landlordContractCheckoutSettlementRound_(existingSettlement.deposit_refund_amount)
      } : null);
    }
    return landlordInitiatedContractError_('CHECKOUT_ALREADY_COMPLETED', '此合約已完成退房');
  }

  const hasStartMeter = normalizedInput.start_meter_reading !== undefined || normalizedInput.startMeterReading !== undefined;
  const hasEndMeter = normalizedInput.end_meter_reading !== undefined || normalizedInput.endMeterReading !== undefined;
  const hasDepositDeduction = normalizedInput.deposit_deduction_amount !== undefined || normalizedInput.depositDeductionAmount !== undefined;
  const hasStartDocument = landlordContractCheckoutSettlementText_(normalizedInput.start_meter_document_id || normalizedInput.startMeterDocumentId);
  const hasEndDocument = landlordContractCheckoutSettlementText_(normalizedInput.end_meter_document_id || normalizedInput.endMeterDocumentId);
  if (!hasStartMeter || !hasEndMeter || !hasDepositDeduction || !hasStartDocument || !hasEndDocument) return landlordInitiatedContractError_('CHECKOUT_SETTLEMENT_REQUIRED', '完成退房前必須完成結算、電表度數與兩張電表照片');

  const settlement = landlordContractCheckoutSettlementApplyUnlocked_(access, schema, normalizedInput);
  if (!settlement.success) return settlement.code === 'CHECKOUT_METER_DOCUMENTS_REQUIRED' ? landlordInitiatedContractError_('CHECKOUT_SETTLEMENT_REQUIRED', '完成退房前必須完成結算、電表度數與兩張電表照片') : settlement;

  const room = landlordInitiatedContractFindScopedRow_(schema.data.rooms, access, 'room_id', contract.room_id);
  const tenant = landlordInitiatedContractFindScopedRow_(schema.data.tenants, access, 'tenant_id', contract.tenant_id);
  if (!room) return landlordInitiatedContractError_('ROOM_NOT_FOUND', '找不到合約所屬房間');
  if (tenant && landlordInitiatedContractText_(tenant.current_contract_id) && landlordInitiatedContractText_(tenant.current_contract_id) !== contractId) {
    return landlordInitiatedContractError_('CHECKOUT_TENANT_POINTER_STALE', '房客目前已指向其他合約，無法直接退房');
  }
  const siblings = landlordContractCheckoutFindSiblings_(schema.data.contracts, access, contract);
  const validation = landlordContractCheckoutValidateTarget_(contract, room, siblings, {
    workspace_id: landlordInitiatedContractWorkspaceId_(access),
    move_out_date: moveOutDate
  });
  if (!validation.success) return validation;

  const nowIso = new Date().toISOString();
  const checkoutSource = landlordInitiatedContractText_(contract.checkout_source) || 'manual_landlord';
  landlordInitiatedContractUpdate_(schema.data.contracts, contract, {
    contract_status: 'terminated',
    status: 'terminated',
    account_status: 'inactive',
    terminated_at: nowIso,
    checkout_status: 'completed',
    checkout_source: checkoutSource,
    checkout_requested_at: landlordInitiatedContractText_(contract.checkout_requested_at) || nowIso,
    checkout_completed_at: nowIso,
    checkout_move_out_date: moveOutDate,
    checkout_note: note || landlordInitiatedContractText_(contract.checkout_note),
    checkout_idempotency_key: idempotencyKey,
    updated_at: nowIso
  });
  Object.assign(contract, {
    contract_status: 'terminated', status: 'terminated', account_status: 'inactive', terminated_at: nowIso,
    checkout_status: 'completed', checkout_source: checkoutSource,
    checkout_requested_at: landlordInitiatedContractText_(contract.checkout_requested_at) || nowIso,
    checkout_completed_at: nowIso, checkout_move_out_date: moveOutDate,
    checkout_note: note || landlordInitiatedContractText_(contract.checkout_note),
    checkout_idempotency_key: idempotencyKey, updated_at: nowIso
  });
  landlordInitiatedContractUpdate_(schema.data.rooms, room, {
    room_status: 'vacant', current_contract_id: '', current_tenant_id: '', current_tenant_name: '', updated_at: nowIso
  });
  if (tenant) landlordInitiatedContractUpdate_(schema.data.tenants, tenant, { current_contract_id: '', updated_at: nowIso });
  landlordContractCheckoutClearViews_(SpreadsheetApp.getActiveSpreadsheet(), contract, nowIso);
  return landlordContractCheckoutResult_(access, contract, false, settlement.data);
}

function landlordContractCheckoutResult_(access, contract, idempotent, settlement) {
  const data = {
    access: access,
    contract_id: landlordInitiatedContractText_(contract.contract_id),
    tenant_id: landlordInitiatedContractText_(contract.tenant_id),
    checkout_status: landlordInitiatedContractText_(contract.checkout_status),
    checkout_source: landlordInitiatedContractText_(contract.checkout_source),
    move_out_date: landlordInitiatedContractText_(contract.checkout_move_out_date),
    idempotent: idempotent === true
  };
  if (settlement) {
    data.settlement_id = landlordInitiatedContractText_(settlement.settlement_id);
    data.subtotal_amount = landlordContractCheckoutSettlementRound_(settlement.subtotal_amount);
    data.deposit_deduction_amount = landlordContractCheckoutSettlementRound_(settlement.deposit_deduction_amount);
    data.tenant_balance_due = landlordContractCheckoutSettlementRound_(settlement.tenant_balance_due);
    data.deposit_refund_amount = landlordContractCheckoutSettlementRound_(settlement.deposit_refund_amount);
  }
  return {
    success: true,
    code: idempotent ? 'IDEMPOTENT' : 'OK',
    data: data
  };
}

function landlordContractCheckoutValidateTarget_(contract, room, siblings, input) {
  const target = contract || {};
  const targetWorkspaceId = landlordInitiatedContractText_(target.workspace_id);
  const inputWorkspaceId = landlordInitiatedContractText_(input && input.workspace_id);
  if (!targetWorkspaceId || (inputWorkspaceId && inputWorkspaceId !== targetWorkspaceId)) return landlordInitiatedContractError_('WORKSPACE_ACCESS_DENIED', '退房合約不屬於目前 Workspace');
  if (!room || landlordInitiatedContractText_(room.workspace_id) !== targetWorkspaceId || landlordInitiatedContractText_(room.room_id) !== landlordInitiatedContractText_(target.room_id)) return landlordInitiatedContractError_('CHECKOUT_ROOM_SCOPE_INVALID', '房間不屬於目前合約');
  if (landlordInitiatedContractText_(room.current_contract_id) !== landlordInitiatedContractText_(target.contract_id)) return landlordInitiatedContractError_('CHECKOUT_ROOM_POINTER_STALE', '房間目前未指向此合約');
  const status = landlordInitiatedContractText_(target.contract_status || target.status).toLowerCase();
  if (V2_CONTRACT_CHECKOUT_ALLOWED_PREDECESSOR_STATUSES_.indexOf(status) < 0) return landlordInitiatedContractError_('CHECKOUT_STATUS_NOT_ALLOWED', '此合約狀態不可辦理退房');
  const moveOutDate = landlordInitiatedContractText_(input && input.move_out_date);
  const startDate = landlordInitiatedContractText_(target.start_date || target.contract_start_date);
  if (!landlordInitiatedContractIsIsoDate_(moveOutDate) || !landlordInitiatedContractIsIsoDate_(startDate) || moveOutDate < startDate) return landlordInitiatedContractError_('CHECKOUT_MOVE_OUT_DATE_INVALID', '退房日期無效或早於租約起始日');
  const openSibling = (Array.isArray(siblings) ? siblings : []).find(function(sibling) {
    if (landlordInitiatedContractText_(sibling.workspace_id) !== targetWorkspaceId || landlordInitiatedContractText_(sibling.room_id) !== landlordInitiatedContractText_(target.room_id) || landlordInitiatedContractText_(sibling.contract_id) === landlordInitiatedContractText_(target.contract_id)) return false;
    const siblingStatus = landlordInitiatedContractText_(sibling.contract_status || sibling.status).toLowerCase();
    if (siblingStatus === 'pending_landlord_review' && landlordInitiatedContractText_(sibling.signing_mode).toLowerCase() === 'renewal' && landlordInitiatedContractText_(sibling.renewal_tenant_intent).toLowerCase() === 'declined') return false;
    return V2_CONTRACT_CHECKOUT_OPEN_SIBLING_STATUSES_.indexOf(siblingStatus) >= 0;
  });
  if (openSibling) return landlordInitiatedContractError_('CHECKOUT_NEWER_CONTRACT_EXISTS', '房間已有較新的有效或簽署中合約');
  return { success: true, code: 'OK' };
}

function landlordContractCheckoutAccessFromSession_(sessionToken, policy) {
  if (typeof tenantContractSigningReviewAccessFromSession_ !== 'function') return landlordInitiatedContractError_('LANDLORD_REVIEW_SESSION_MODULE_REQUIRED', '找不到房東 session 模組');
  const accessResult = tenantContractSigningReviewAccessFromSession_(sessionToken, policy);
  if (!accessResult || accessResult.success !== true) return accessResult || landlordInitiatedContractError_('LANDLORD_REVIEW_SESSION_INVALID', '房東 session 無效');
  const access = Object.assign({ success: true }, accessResult.data || {});
  if (!landlordInitiatedContractAccessValid_(access)) return landlordInitiatedContractError_('WORKSPACE_ACCESS_DENIED', 'Workspace 權限無效');
  return access;
}

function landlordContractCheckoutFindContract_(sheet, access, contractId) {
  return landlordContractCheckoutRows_(sheet).find(function(row) {
    return landlordInitiatedContractText_(row.contract_id) === landlordInitiatedContractText_(contractId) && landlordInitiatedContractText_(row.workspace_id) === landlordInitiatedContractWorkspaceId_(access);
  }) || null;
}

function landlordContractCheckoutFindSiblings_(sheet, access, contract) {
  const workspaceId = landlordInitiatedContractWorkspaceId_(access);
  return landlordContractCheckoutRows_(sheet).filter(function(row) {
    return landlordInitiatedContractText_(row.workspace_id) === workspaceId && landlordInitiatedContractText_(row.room_id) === landlordInitiatedContractText_(contract.room_id) && landlordInitiatedContractText_(row.contract_id) !== landlordInitiatedContractText_(contract.contract_id);
  });
}

function landlordContractCheckoutOriginalEndDate_(contract) {
  return landlordInitiatedContractText_(contract && (contract.end_date || contract.contract_end_date));
}

function landlordContractCheckoutClearViews_(ss, contract, timestamp) {
  if (typeof landlordInitiatedContractFinalizationViews_ !== 'function') return;
  const views = landlordInitiatedContractFinalizationViews_(ss);
  if (!views || views.success !== true) return;
  [views.data.landlord.sheet, views.data.tenant.sheet].forEach(function(sheet) {
    const row = landlordContractCheckoutRows_(sheet).find(function(item) {
      return landlordInitiatedContractText_(item.tenant_id) === landlordInitiatedContractText_(contract.tenant_id) && landlordInitiatedContractText_(item.workspace_id) === landlordInitiatedContractText_(contract.workspace_id);
    });
    if (row) landlordInitiatedContractUpdate_(sheet, row, { current_contract_id: '', contract_status: 'terminated', updated_at: timestamp });
  });
}

function landlordContractCheckoutRows_(sheet) {
  return typeof landlordInitiatedContractRows_ === 'function' ? landlordInitiatedContractRows_(sheet) : [];
}
