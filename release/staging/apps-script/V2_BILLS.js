/**
 * CMWebs V2 billing lifecycle (Phase 93 staging only).
 *
 * Physical sheet stays V2_bills for compatibility with the tenant portal and
 * existing settlement modules. All LINE events are enqueued through Phase 90.
 */

const PHASE93_BILLS_SHEET_ = 'V2_bills';

const PHASE93_BILLS_REQUIRED_HEADERS_ = [
  'bill_id',
  'created_at',
  'updated_at',
  'workspace_id',
  'landlord_id',
  'tenant_id',
  'tenant_user_id',
  'user_id',
  'tenant_line_user_id',
  'tenant_name',
  'contract_id',
  'property_id',
  'room_id',
  'room_name',
  'bill_month',
  'due_date',
  'rent_amount',
  'management_fee',
  'electricity_amount',
  'equipment_amount',
  'other_amount',
  'discount_amount',
  'total_amount',
  'bill_status',
  'payment_status',
  'issued_at',
  'paid_at',
  'payment_id',
  'created_by',
  'updated_by',
  'bill_created_queue_id',
  'payment_due_queue_id',
  'payment_overdue_queue_id',
  'notes'
];


function migrateStagingBillingLifecycle() {
  runtimeRequireSchemaMigration_();
  billingLifecycleAssertEnabled_();

  const ss = runtimeSpreadsheet_();
  const billSheet = billingLifecycleEnsureSheet_(
    ss,
    PHASE93_BILLS_SHEET_,
    PHASE93_BILLS_REQUIRED_HEADERS_
  );
  const paymentSheet = billingLifecycleEnsureSheet_(
    ss,
    PHASE93_PAYMENTS_SHEET_,
    PHASE93_PAYMENTS_REQUIRED_HEADERS_
  );
  const triggers = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === 'processBillingLifecycleNotifications';
  });
  let triggerCreated = false;
  if (triggers.length === 0) {
    ScriptApp.newTrigger('processBillingLifecycleNotifications')
      .timeBased()
      .everyDays(1)
      .atHour(8)
      .create();
    triggerCreated = true;
  }

  return {
    success: true,
    environment: 'staging',
    module: 'V2_BILLS/V2_PAYMENTS',
    bills_sheet: billSheet.getName(),
    payments_sheet: paymentSheet.getName(),
    bill_header_count: PHASE93_BILLS_REQUIRED_HEADERS_.length,
    payment_header_count: PHASE93_PAYMENTS_REQUIRED_HEADERS_.length,
    lifecycle_trigger_count: triggers.length + (triggerCreated ? 1 : 0),
    trigger_created: triggerCreated
  };
}


function getLandlordBillingLifecycleByLineUid_(lineUserId, billMonth, status) {
  const access = billingLifecycleAccess_(lineUserId);
  if (!access.success) return access;

  const workspaceId = billingLifecycleText_(access.workspace.workspace_id);
  const monthFilter = billingLifecycleMonth_(billMonth);
  const statusFilter = billingLifecycleText_(status).toLowerCase();
  const bills = billingLifecycleRows_(billingLifecycleBillSheet_())
    .filter(function (bill) {
      if (billingLifecycleText_(bill.workspace_id) !== workspaceId) return false;
      if (monthFilter && billingLifecycleMonth_(bill.bill_month) !== monthFilter) return false;
      if (statusFilter && billingLifecycleBillStatus_(bill) !== statusFilter) return false;
      return true;
    })
    .map(billingLifecyclePublicBill_);
  const payments = billingLifecycleRows_(billingLifecyclePaymentSheet_())
    .filter(function (payment) {
      return billingLifecycleText_(payment.workspace_id) === workspaceId;
    })
    .map(billingLifecyclePublicPayment_);

  return {
    success: true,
    code: 'OK',
    data: {
      workspace_id: workspaceId,
      bills: bills,
      payments: payments,
      bill_count: bills.length,
      payment_count: payments.length
    }
  };
}


function generateContractMonthlyBillByLineUid_(
  lineUserId,
  contractId,
  billMonth,
  input
) {
  billingLifecycleAssertEnabled_();
  const access = billingLifecycleAccess_(lineUserId);
  if (!access.success) return access;
  input = input || {};

  const workspaceId = billingLifecycleText_(access.workspace.workspace_id);
  const contract = billingLifecycleFindContract_(contractId, workspaceId);
  if (!contract.success) return contract;
  const status = billingLifecycleText_(
    contract.data.contract_status || contract.data.status
  ).toLowerCase();
  if (status !== 'active' && status !== 'expiring') {
    return billingLifecycleFailure_(
      'BILL_CONTRACT_NOT_ACTIVE',
      '只有有效租約可產生月租帳單'
    );
  }

  billMonth = billingLifecycleMonth_(billMonth);
  if (!billMonth) {
    return billingLifecycleFailure_('BILL_MONTH_INVALID', '帳單月份格式錯誤');
  }
  const startMonth = billingLifecycleMonth_(contract.data.start_date);
  const endMonth = billingLifecycleMonth_(contract.data.end_date);
  if ((startMonth && billMonth < startMonth) || (endMonth && billMonth > endMonth)) {
    return billingLifecycleFailure_(
      'BILL_MONTH_OUTSIDE_CONTRACT',
      '帳單月份不在租約期間內'
    );
  }

  const billId = 'BILL-' + billMonth.replace('-', '') + '-' +
    billingLifecycleText_(contract.data.contract_id);
  const billSheet = billingLifecycleBillSheet_();
  const existing = billingLifecycleRows_(billSheet).filter(function (bill) {
    return billingLifecycleText_(bill.workspace_id) === workspaceId &&
      billingLifecycleText_(bill.bill_id) === billId;
  });
  if (existing.length > 1) {
    return billingLifecycleFailure_('DUPLICATE_BILL_ID', '帳單編號存在重複資料');
  }
  if (existing.length === 1) {
    return {
      success: true,
      code: 'BILL_ALREADY_EXISTS',
      duplicate: true,
      data: { bill: billingLifecyclePublicBill_(existing[0]) }
    };
  }

  const relation = billingLifecycleRelation_(contract.data, workspaceId);
  if (!relation.success) return relation;
  const rentAmount = billingLifecycleAmount_(
    input.rent_amount === undefined || input.rent_amount === ''
      ? contract.data.monthly_rent
      : input.rent_amount
  );
  const managementFee = billingLifecycleAmount_(input.management_fee || 0);
  const electricityAmount = billingLifecycleAmount_(input.electricity_amount || 0);
  const equipmentAmount = billingLifecycleAmount_(input.equipment_amount || 0);
  const otherAmount = billingLifecycleAmount_(input.other_amount || 0);
  const discountAmount = billingLifecycleAmount_(input.discount_amount || 0);
  if ([rentAmount, managementFee, electricityAmount, equipmentAmount,
    otherAmount, discountAmount].some(function (amount) { return amount === null; })) {
    return billingLifecycleFailure_('BILL_AMOUNT_INVALID', '帳單金額格式錯誤');
  }
  const totalAmount = rentAmount + managementFee + electricityAmount +
    equipmentAmount + otherAmount - discountAmount;
  if (totalAmount < 0) {
    return billingLifecycleFailure_('BILL_TOTAL_INVALID', '帳單總額不得小於零');
  }

  const dueDay = Number(input.payment_due_day || contract.data.payment_due_day || 1);
  const dueDate = billingLifecycleDueDate_(billMonth, dueDay);
  const now = new Date();
  const record = {
    bill_id: billId,
    created_at: now,
    updated_at: now,
    workspace_id: workspaceId,
    landlord_id: billingLifecycleText_(
      access.principal_landlord_id || contract.data.landlord_id
    ),
    tenant_id: billingLifecycleText_(contract.data.tenant_id),
    tenant_user_id: billingLifecycleText_(
      contract.data.tenant_user_id || relation.tenant.tenant_user_id || relation.tenant.user_id
    ),
    user_id: billingLifecycleText_(
      contract.data.tenant_user_id || relation.tenant.tenant_user_id || relation.tenant.user_id
    ),
    tenant_line_user_id: billingLifecycleText_(
      relation.tenant.tenant_line_user_id || relation.tenant.line_user_id
    ),
    tenant_name: billingLifecycleText_(relation.tenant.tenant_name || relation.tenant.name),
    contract_id: billingLifecycleText_(contract.data.contract_id),
    property_id: billingLifecycleText_(contract.data.property_id),
    room_id: billingLifecycleText_(contract.data.room_id),
    room_name: billingLifecycleText_(relation.room.room_name || relation.room.room_no),
    bill_month: billMonth,
    due_date: dueDate,
    rent_amount: rentAmount,
    management_fee: managementFee,
    electricity_amount: electricityAmount,
    equipment_amount: equipmentAmount,
    other_amount: otherAmount,
    discount_amount: discountAmount,
    total_amount: totalAmount,
    bill_status: 'issued',
    payment_status: 'unpaid',
    issued_at: now,
    paid_at: '',
    payment_id: '',
    created_by: billingLifecycleText_(access.user && access.user.user_id),
    updated_by: billingLifecycleText_(access.user && access.user.user_id),
    bill_created_queue_id: '',
    payment_due_queue_id: '',
    payment_overdue_queue_id: '',
    notes: billingLifecycleText_(input.notes)
  };
  workspaceAppendObject_(billSheet, record);
  const created = billingLifecycleRows_(billSheet).filter(function (bill) {
    return billingLifecycleText_(bill.workspace_id) === workspaceId &&
      billingLifecycleText_(bill.bill_id) === billId;
  })[0] || record;
  const queued = billingLifecycleEnqueueBillEvent_(created, 'bill_created');
  if (queued.success && queued.data && queued.data.queue_id && created.__row_number) {
    billingLifecycleUpdate_(billSheet, created.__row_number, {
      bill_created_queue_id: queued.data.queue_id,
      updated_at: new Date()
    });
    created.bill_created_queue_id = queued.data.queue_id;
  }

  return {
    success: true,
    code: 'OK',
    message: '月租帳單已建立',
    data: {
      bill: billingLifecyclePublicBill_(created),
      notification: billingLifecycleQueueSummary_(queued)
    }
  };
}


function processBillingLifecycleNotifications() {
  billingLifecycleAssertEnabled_();
  const sheet = billingLifecycleBillSheet_();
  const today = billingLifecycleDate_(new Date());
  const results = [];

  billingLifecycleRows_(sheet).forEach(function (bill) {
    const status = billingLifecycleBillStatus_(bill);
    const paymentStatus = billingLifecycleText_(bill.payment_status).toLowerCase();
    const dueDate = billingLifecycleDate_(bill.due_date);
    if ((status !== 'issued' && status !== 'overdue') || paymentStatus === 'paid' || !dueDate) {
      return;
    }

    if (dueDate === today && !billingLifecycleText_(bill.payment_due_queue_id)) {
      const queuedDue = billingLifecycleEnqueueBillEvent_(bill, 'payment_due');
      if (queuedDue.success && queuedDue.data && queuedDue.data.queue_id) {
        billingLifecycleUpdate_(sheet, bill.__row_number, {
          payment_due_queue_id: queuedDue.data.queue_id,
          updated_at: new Date(),
          updated_by: 'system:billing_lifecycle_worker'
        });
      }
      results.push(billingLifecycleWorkerResult_(bill, 'payment_due', queuedDue));
    }

    if (dueDate < today && !billingLifecycleText_(bill.payment_overdue_queue_id)) {
      const queuedOverdue = billingLifecycleEnqueueBillEvent_(bill, 'payment_overdue');
      if (queuedOverdue.success && queuedOverdue.data && queuedOverdue.data.queue_id) {
        billingLifecycleUpdate_(sheet, bill.__row_number, {
          bill_status: 'overdue',
          payment_overdue_queue_id: queuedOverdue.data.queue_id,
          updated_at: new Date(),
          updated_by: 'system:billing_lifecycle_worker'
        });
      }
      results.push(billingLifecycleWorkerResult_(bill, 'payment_overdue', queuedOverdue));
    }
  });

  return {
    success: results.every(function (item) { return item.success; }),
    processed_count: results.length,
    queued_count: results.filter(function (item) { return item.success; }).length,
    results: results
  };
}


function billingLifecycleEnqueueBillEvent_(bill, eventType) {
  if (typeof notificationQueueEnqueue_ !== 'function') {
    return billingLifecycleFailure_(
      'NOTIFICATION_QUEUE_UNAVAILABLE',
      'Notification queue is unavailable'
    );
  }
  const templateKey = billingLifecycleText_(eventType).toLowerCase();
  return notificationQueueEnqueue_({
    receiver: {
      receiver_type: 'tenant',
      receiver_id: billingLifecycleText_(bill.tenant_id),
      workspace_id: billingLifecycleText_(bill.workspace_id)
    },
    event_type: templateKey,
    event_id: 'bill:' + billingLifecycleText_(bill.bill_id) + ':' + templateKey,
    actor_type: 'system',
    actor_id: 'billing_lifecycle_worker',
    resource_type: 'bill',
    resource_id: billingLifecycleText_(bill.bill_id),
    template_key: templateKey,
    variables: {
      tenant_name: billingLifecycleText_(bill.tenant_name) || '房客',
      month: billingLifecycleMonth_(bill.bill_month),
      amount: Math.round(Number(bill.total_amount) || 0).toLocaleString('en-US'),
      due_date: billingLifecycleDate_(bill.due_date)
    },
    source: 'billing_lifecycle',
    reference_id: billingLifecycleText_(bill.bill_id) + ':' + templateKey,
    metadata: {
      bill_id: billingLifecycleText_(bill.bill_id),
      contract_id: billingLifecycleText_(bill.contract_id),
      tenant_id: billingLifecycleText_(bill.tenant_id),
      room_id: billingLifecycleText_(bill.room_id)
    }
  });
}


function billingLifecycleFindContract_(contractId, workspaceId) {
  const sheet = runtimeSpreadsheet_().getSheetByName('V2_contracts');
  if (!sheet) return billingLifecycleFailure_('CONTRACT_SHEET_NOT_CONFIGURED', '找不到租約資料表');
  const matches = billingLifecycleRows_(sheet).filter(function (contract) {
    return billingLifecycleText_(contract.contract_id) === billingLifecycleText_(contractId) &&
      billingLifecycleText_(contract.workspace_id) === workspaceId;
  });
  if (matches.length !== 1) {
    return billingLifecycleFailure_(
      matches.length > 1 ? 'CONTRACT_CONFLICT' : 'CONTRACT_NOT_FOUND',
      matches.length > 1 ? '租約資料重複，已停止操作' : '找不到指定租約'
    );
  }
  return { success: true, data: matches[0] };
}


function billingLifecycleRelation_(contract, workspaceId) {
  const ss = runtimeSpreadsheet_();
  const tenantSheet = ss.getSheetByName('V2_tenants');
  const roomSheet = ss.getSheetByName('V2_rooms');
  if (!tenantSheet || !roomSheet) {
    return billingLifecycleFailure_('BILL_RELATION_SHEET_MISSING', '房客或房間資料表不存在');
  }
  const tenants = billingLifecycleRows_(tenantSheet).filter(function (tenant) {
    return billingLifecycleText_(tenant.tenant_id) === billingLifecycleText_(contract.tenant_id) &&
      billingLifecycleText_(tenant.workspace_id) === workspaceId;
  });
  const rooms = billingLifecycleRows_(roomSheet).filter(function (room) {
    return billingLifecycleText_(room.room_id) === billingLifecycleText_(contract.room_id) &&
      billingLifecycleText_(room.workspace_id) === workspaceId &&
      billingLifecycleText_(room.property_id) === billingLifecycleText_(contract.property_id);
  });
  if (tenants.length !== 1 || rooms.length !== 1) {
    return billingLifecycleFailure_(
      tenants.length > 1 || rooms.length > 1 ? 'BILL_RELATION_CONFLICT' : 'BILL_RELATION_NOT_FOUND',
      '租約的房客或房間關聯不存在或不唯一'
    );
  }
  return { success: true, tenant: tenants[0], room: rooms[0] };
}


function billingLifecycleAccess_(lineUserId) {
  const access = workspaceLandlordResolveCanonicalScopedAccess_(
    billingLifecycleText_(lineUserId),
    { require_onboarding: false }
  );
  if (!access || access.success !== true) {
    return billingLifecycleFailure_(
      access && access.code || 'LANDLORD_ACCESS_DENIED',
      access && access.message || '無法確認房東權限'
    );
  }
  return access;
}


function billingLifecycleEnsureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const existing = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(billingLifecycleText_)
    : [];
  const missing = headers.filter(function (header) {
    return existing.indexOf(header) === -1;
  });
  if (existing.length === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else if (missing.length > 0) {
    sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  }
  return sheet;
}


function billingLifecycleBillSheet_() {
  const sheet = runtimeSpreadsheet_().getSheetByName(PHASE93_BILLS_SHEET_);
  if (!sheet) throw new Error('BILL_SHEET_NOT_CONFIGURED');
  return sheet;
}


function billingLifecycleRows_(sheet) {
  return workspaceGetObjectsWithRow_(sheet);
}


function billingLifecycleUpdate_(sheet, rowNumber, updates) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0].map(billingLifecycleText_);
  Object.keys(updates).forEach(function (key) {
    const column = headers.indexOf(key);
    if (column >= 0) sheet.getRange(rowNumber, column + 1).setValue(updates[key]);
  });
}


function billingLifecyclePublicBill_(bill) {
  return {
    bill_id: billingLifecycleText_(bill.bill_id),
    workspace_id: billingLifecycleText_(bill.workspace_id),
    landlord_id: billingLifecycleText_(bill.landlord_id),
    tenant_id: billingLifecycleText_(bill.tenant_id),
    tenant_user_id: billingLifecycleText_(bill.tenant_user_id || bill.user_id),
    contract_id: billingLifecycleText_(bill.contract_id),
    property_id: billingLifecycleText_(bill.property_id),
    room_id: billingLifecycleText_(bill.room_id),
    room_name: billingLifecycleText_(bill.room_name),
    bill_month: billingLifecycleMonth_(bill.bill_month),
    due_date: billingLifecycleDate_(bill.due_date),
    rent_amount: Number(bill.rent_amount) || 0,
    management_fee: Number(bill.management_fee) || 0,
    electricity_amount: Number(bill.electricity_amount) || 0,
    equipment_amount: Number(bill.equipment_amount) || 0,
    other_amount: Number(bill.other_amount) || 0,
    discount_amount: Number(bill.discount_amount) || 0,
    total_amount: Number(bill.total_amount) || 0,
    bill_status: billingLifecycleBillStatus_(bill),
    payment_status: billingLifecycleText_(bill.payment_status || 'unpaid').toLowerCase(),
    payment_id: billingLifecycleText_(bill.payment_id),
    paid_at: billingLifecycleJsonValue_(bill.paid_at),
    created_at: billingLifecycleJsonValue_(bill.created_at),
    updated_at: billingLifecycleJsonValue_(bill.updated_at)
  };
}


function billingLifecycleBillStatus_(bill) {
  return billingLifecycleText_(bill.bill_status || 'issued').toLowerCase();
}


function billingLifecycleMonth_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM');
  }
  const match = billingLifecycleText_(value).match(/^(\d{4})[-\/]?(\d{1,2})/);
  return match ? match[1] + '-' + ('0' + match[2]).slice(-2) : '';
}


function billingLifecycleDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const match = billingLifecycleText_(value).match(/^(\d{4})[-\/]?(\d{1,2})[-\/]?(\d{1,2})/);
  return match
    ? match[1] + '-' + ('0' + match[2]).slice(-2) + '-' + ('0' + match[3]).slice(-2)
    : '';
}


function billingLifecycleDueDate_(billMonth, dueDay) {
  const parts = billMonth.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.max(1, Math.min(Number(dueDay) || 1, lastDay));
  return year + '-' + ('0' + month).slice(-2) + '-' + ('0' + day).slice(-2);
}


function billingLifecycleAmount_(value) {
  const amount = Number(value);
  return isFinite(amount) && amount >= 0 ? amount : null;
}


function billingLifecycleQueueSummary_(queued) {
  return {
    success: queued && queued.success === true,
    code: queued && queued.code || '',
    queue_id: queued && queued.data && queued.data.queue_id || '',
    duplicate: queued && queued.duplicate === true
  };
}


function billingLifecycleWorkerResult_(bill, eventType, queued) {
  return {
    bill_id: billingLifecycleText_(bill.bill_id),
    event_type: eventType,
    success: queued && queued.success === true,
    code: queued && queued.code || '',
    queue_id: queued && queued.data && queued.data.queue_id || ''
  };
}


function billingLifecycleJsonValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd'T'HH:mm:ssXXX"
    );
  }
  return value || '';
}


function billingLifecycleAssertEnabled_() {
  runtimeEnvironment_();
  runtimeRequireFeature_('BILLING_LIFECYCLE');
}


function billingLifecycleFailure_(code, message) {
  return { success: false, code: code, message: message };
}


function billingLifecycleText_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}
