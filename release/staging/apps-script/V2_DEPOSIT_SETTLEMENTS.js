/**
 * CMWebs V2 deposit settlement workflow (Phase 94 staging only).
 */

const V2_DEPOSIT_SETTLEMENTS_SHEET_ = 'V2_DEPOSIT_SETTLEMENTS';

const V2_DEPOSIT_SETTLEMENT_HEADERS_ = [
  'settlement_id',
  'idempotency_key',
  'request_id',
  'created_at',
  'updated_at',
  'workspace_id',
  'landlord_id',
  'tenant_id',
  'tenant_user_id',
  'tenant_name',
  'contract_id',
  'property_id',
  'room_id',
  'deposit_amount',
  'unpaid_bill_amount',
  'repair_cost_amount',
  'total_deductions',
  'refund_amount',
  'tenant_balance_due',
  'unpaid_bill_ids_json',
  'repair_items_json',
  'status',
  'ready_at',
  'refunded_at',
  'refund_method',
  'refund_reference',
  'confirmed_by',
  'inspection_note',
  'created_by',
  'updated_by'
];


function completeLandlordMoveOutInspectionByLineUid_(
  lineUserId,
  requestId,
  repairItems,
  inspectionNote,
  idempotencyKey
) {
  moveOutAssertEnabled_();
  const access = moveOutLandlordAccess_(lineUserId);
  if (!access.success) return access;
  return settlementTransactionExecute_({
    idempotency_key: idempotencyKey,
    operation: 'deposit_settlement_prepare',
    workspace_id: moveOutText_(access.workspace.workspace_id),
    actor_user_id: moveOutText_(access.user && access.user.user_id),
    request_id: moveOutText_(requestId)
  }, function (transaction) {
    return completeLandlordMoveOutInspectionUnsafe_(
      lineUserId,
      requestId,
      repairItems,
      inspectionNote,
      idempotencyKey,
      transaction
    );
  });
}


function completeLandlordMoveOutInspectionUnsafe_(
  lineUserId,
  requestId,
  repairItems,
  inspectionNote,
  idempotencyKey,
  transaction
) {
  moveOutAssertEnabled_();
  const access = moveOutLandlordAccess_(lineUserId);
  if (!access.success) return access;
  const workspaceId = moveOutText_(access.workspace.workspace_id);
  const match = moveOutFindRequest_(requestId, workspaceId);
  if (!match.success) return match;
  const request = match.data;
  const requestStatus = moveOutText_(request.status).toLowerCase();

  const existingSettlements = moveOutRows_(depositSettlementSheet_()).filter(function (row) {
    return moveOutText_(row.workspace_id) === workspaceId &&
      moveOutText_(row.request_id) === moveOutText_(request.request_id);
  });
  if (existingSettlements.length > 1) {
    return moveOutFailure_('DEPOSIT_SETTLEMENT_CONFLICT', '退租申請存在重複押金結算');
  }
  if (existingSettlements.length === 1) {
    return {
      success: true,
      code: 'DEPOSIT_SETTLEMENT_ALREADY_EXISTS',
      duplicate: true,
      data: {
        request: moveOutPublicRequest_(request),
        settlement: depositSettlementPublic_(existingSettlements[0])
      }
    };
  }
  if (requestStatus !== 'inspection_scheduled') {
    return moveOutFailure_('INSPECTION_STATUS_INVALID', '必須先安排驗屋才能完成結算');
  }

  const contract = moveOutFindContract_(request.contract_id, workspaceId);
  if (!contract.success) return contract;
  if (moveOutText_(contract.data.tenant_id) !== moveOutText_(request.tenant_id)) {
    return moveOutFailure_('MOVE_OUT_CONTRACT_TENANT_CONFLICT', '退租申請與租約房客不一致');
  }
  const repairResult = depositSettlementRepairItems_(
    workspaceId,
    request,
    repairItems
  );
  if (!repairResult.success) return repairResult;
  const billResult = depositSettlementUnpaidBills_(workspaceId, request);
  if (!billResult.success) return billResult;

  const depositAmount = depositSettlementAmount_(contract.data.deposit_amount);
  if (depositAmount === null) {
    return moveOutFailure_('DEPOSIT_AMOUNT_INVALID', '租約押金金額格式錯誤');
  }
  const totalDeductions = billResult.amount + repairResult.amount;
  const refundAmount = Math.max(0, depositAmount - totalDeductions);
  const tenantBalanceDue = Math.max(0, totalDeductions - depositAmount);
  const now = new Date();
  const settlement = {
    settlement_id: moveOutMakeId_('DST'),
    idempotency_key: moveOutText_(idempotencyKey),
    request_id: moveOutText_(request.request_id),
    created_at: now,
    updated_at: now,
    workspace_id: workspaceId,
    landlord_id: moveOutText_(request.landlord_id),
    tenant_id: moveOutText_(request.tenant_id),
    tenant_user_id: moveOutText_(request.tenant_user_id),
    tenant_name: moveOutText_(request.tenant_name),
    contract_id: moveOutText_(request.contract_id),
    property_id: moveOutText_(request.property_id),
    room_id: moveOutText_(request.room_id),
    deposit_amount: depositAmount,
    unpaid_bill_amount: billResult.amount,
    repair_cost_amount: repairResult.amount,
    total_deductions: totalDeductions,
    refund_amount: refundAmount,
    tenant_balance_due: tenantBalanceDue,
    unpaid_bill_ids_json: JSON.stringify(billResult.bill_ids),
    repair_items_json: JSON.stringify(repairResult.items.map(function (item) {
      return {
        ticket_id: item.ticket_id,
        amount: item.amount,
        note: item.note
      };
    })),
    status: 'ready',
    ready_at: now,
    refunded_at: '',
    refund_method: '',
    refund_reference: '',
    confirmed_by: '',
    inspection_note: moveOutText_(inspectionNote),
    created_by: moveOutText_(access.user && access.user.user_id),
    updated_by: moveOutText_(access.user && access.user.user_id)
  };
  const settlementSheet = depositSettlementSheet_();
  transaction.captureAppend(settlementSheet);
  workspaceAppendObject_(settlementSheet, settlement);
  const stored = moveOutRows_(settlementSheet).filter(function (row) {
    return moveOutText_(row.settlement_id) === settlement.settlement_id;
  })[0] || settlement;

  repairResult.items.forEach(function (item) {
    transaction.captureRow(repairResult.sheet, item.row_number);
    moveOutUpdate_(repairResult.sheet, item.row_number, {
      settlement_chargeable: true,
      settlement_cost: item.amount,
      settlement_note: item.note,
      deposit_settlement_id: settlement.settlement_id,
      updated_at: new Date(),
      updated_by: moveOutText_(access.user && access.user.user_id)
    });
  });
  const requestUpdates = {
    status: 'settlement_ready',
    inspection_completed_at: now,
    inspection_note: moveOutText_(inspectionNote),
    settlement_id: settlement.settlement_id,
    updated_at: now,
    updated_by: moveOutText_(access.user && access.user.user_id)
  };
  transaction.captureRow(match.sheet, request.__row_number);
  moveOutUpdate_(match.sheet, request.__row_number, requestUpdates);
  Object.keys(requestUpdates).forEach(function (key) { request[key] = requestUpdates[key]; });

  const queueSheet = runtimeSpreadsheet_().getSheetByName('V2_NOTIFICATION_QUEUE');
  if (queueSheet) transaction.captureAppend(queueSheet);
  const queued = moveOutEnqueue_({
    receiver_type: 'tenant',
    receiver_id: request.tenant_id,
    workspace_id: request.workspace_id,
    event_type: 'deposit_settlement_ready',
    request: request,
    variables: {
      tenant_name: request.tenant_name || request.tenant_id,
      deposit_amount: depositSettlementMoney_(depositAmount),
      deduction_amount: depositSettlementMoney_(totalDeductions),
      refund_amount: depositSettlementMoney_(refundAmount)
    }
  });
  if (queued.success && queued.data && queued.data.queue_id) {
    moveOutUpdate_(match.sheet, request.__row_number, {
      deposit_settlement_ready_queue_id: queued.data.queue_id,
      updated_at: new Date()
    });
    request.deposit_settlement_ready_queue_id = queued.data.queue_id;
  }

  return {
    success: true,
    code: 'OK',
    message: '驗屋完成，押金結算已建立',
    data: {
      request: moveOutPublicRequest_(request),
      settlement: depositSettlementPublic_(stored),
      notification: moveOutQueueSummary_(queued)
    }
  };
}


function confirmLandlordDepositRefundByLineUid_(
  lineUserId,
  settlementId,
  refundMethod,
  refundReference,
  idempotencyKey
) {
  moveOutAssertEnabled_();
  const access = moveOutLandlordAccess_(lineUserId);
  if (!access.success) return access;
  return settlementTransactionExecute_({
    idempotency_key: idempotencyKey,
    operation: 'deposit_refund_confirm',
    workspace_id: moveOutText_(access.workspace.workspace_id),
    actor_user_id: moveOutText_(access.user && access.user.user_id),
    settlement_id: moveOutText_(settlementId)
  }, function (transaction) {
    return confirmLandlordDepositRefundUnsafe_(
      lineUserId,
      settlementId,
      refundMethod,
      refundReference,
      transaction
    );
  });
}


function confirmLandlordDepositRefundUnsafe_(
  lineUserId,
  settlementId,
  refundMethod,
  refundReference,
  transaction
) {
  moveOutAssertEnabled_();
  const access = moveOutLandlordAccess_(lineUserId);
  if (!access.success) return access;
  const workspaceId = moveOutText_(access.workspace.workspace_id);
  const settlementMatch = depositSettlementFind_(settlementId, workspaceId);
  if (!settlementMatch.success) return settlementMatch;
  const settlement = settlementMatch.data;
  const requestMatch = moveOutFindRequest_(settlement.request_id, workspaceId);
  if (!requestMatch.success) return requestMatch;
  const request = requestMatch.data;

  if (moveOutText_(settlement.status).toLowerCase() === 'refunded') {
    return {
      success: true,
      code: 'DEPOSIT_ALREADY_REFUNDED',
      duplicate: true,
      data: {
        request: moveOutPublicRequest_(request),
        settlement: depositSettlementPublic_(settlement)
      }
    };
  }
  if (moveOutText_(settlement.status).toLowerCase() !== 'ready' ||
      moveOutText_(request.status).toLowerCase() !== 'settlement_ready') {
    return moveOutFailure_('DEPOSIT_REFUND_STATUS_INVALID', '押金結算尚未達可退款狀態');
  }
  refundMethod = moveOutText_(refundMethod);
  refundReference = moveOutText_(refundReference);
  if (!refundMethod) {
    return moveOutFailure_('REFUND_METHOD_REQUIRED', '退款方式為必要欄位');
  }
  if (Number(settlement.refund_amount) > 0 && !refundReference) {
    return moveOutFailure_('REFUND_REFERENCE_REQUIRED', '有退款金額時必須提供退款參考編號');
  }

  transaction.captureByKey(
    runtimeSpreadsheet_().getSheetByName('V2_contracts'),
    'contract_id',
    settlement.contract_id
  );
  transaction.captureRow(settlementMatch.sheet, settlement.__row_number);
  transaction.captureRow(requestMatch.sheet, request.__row_number);
  const queueSheet = runtimeSpreadsheet_().getSheetByName('V2_NOTIFICATION_QUEUE');
  if (queueSheet) transaction.captureAppend(queueSheet);

  const terminated = updateLandlordContractStatusByLineUid_(
    lineUserId,
    settlement.contract_id,
    'terminated',
    'Move-out deposit settlement ' + settlement.settlement_id
  );
  if (!terminated || terminated.success !== true) {
    return moveOutFailure_(
      terminated && terminated.code || 'CONTRACT_TERMINATION_FAILED',
      terminated && terminated.message || '租約終止失敗'
    );
  }

  const now = new Date();
  const settlementUpdates = {
    status: 'refunded',
    refunded_at: now,
    refund_method: refundMethod,
    refund_reference: refundReference,
    confirmed_by: moveOutText_(access.user && access.user.user_id),
    updated_by: moveOutText_(access.user && access.user.user_id),
    updated_at: now
  };
  moveOutUpdate_(settlementMatch.sheet, settlement.__row_number, settlementUpdates);
  Object.keys(settlementUpdates).forEach(function (key) { settlement[key] = settlementUpdates[key]; });
  const requestUpdates = {
    status: 'completed',
    updated_at: now,
    updated_by: moveOutText_(access.user && access.user.user_id)
  };
  moveOutUpdate_(requestMatch.sheet, request.__row_number, requestUpdates);
  Object.keys(requestUpdates).forEach(function (key) { request[key] = requestUpdates[key]; });

  const refundedQueue = moveOutEnqueue_({
    receiver_type: 'tenant',
    receiver_id: request.tenant_id,
    workspace_id: request.workspace_id,
    event_type: 'deposit_refunded',
    request: request,
    variables: {
      tenant_name: request.tenant_name || request.tenant_id,
      refund_amount: depositSettlementMoney_(settlement.refund_amount),
      refund_method: refundMethod
    }
  });
  const terminatedQueue = moveOutEnqueue_({
    receiver_type: 'tenant',
    receiver_id: request.tenant_id,
    workspace_id: request.workspace_id,
    event_type: 'contract_terminated',
    request: request,
    variables: {
      tenant_name: request.tenant_name || request.tenant_id,
      contract_id: request.contract_id,
      move_out_date: moveOutDate_(request.requested_move_out_date)
    }
  });
  const queueUpdates = {};
  if (refundedQueue.success && refundedQueue.data) {
    queueUpdates.deposit_refunded_queue_id = refundedQueue.data.queue_id || '';
  }
  if (terminatedQueue.success && terminatedQueue.data) {
    queueUpdates.contract_terminated_queue_id = terminatedQueue.data.queue_id || '';
  }
  if (Object.keys(queueUpdates).length > 0) {
    queueUpdates.updated_at = new Date();
    moveOutUpdate_(requestMatch.sheet, request.__row_number, queueUpdates);
    Object.keys(queueUpdates).forEach(function (key) { request[key] = queueUpdates[key]; });
  }

  return {
    success: true,
    code: 'OK',
    message: '押金退款已確認，租約已終止',
    data: {
      request: moveOutPublicRequest_(request),
      settlement: depositSettlementPublic_(settlement),
      contract: terminated.data && terminated.data.contract || null,
      notifications: {
        deposit_refunded: moveOutQueueSummary_(refundedQueue),
        contract_terminated: moveOutQueueSummary_(terminatedQueue)
      }
    }
  };
}


function depositSettlementRepairItems_(workspaceId, request, repairItems) {
  if (!Array.isArray(repairItems)) {
    return moveOutFailure_('REPAIR_ITEMS_INVALID', '報修扣款必須為陣列');
  }
  const sheet = runtimeSpreadsheet_().getSheetByName('V2_REPAIR_TICKETS');
  if (!sheet) return moveOutFailure_('REPAIR_SHEET_NOT_CONFIGURED', '找不到報修資料表');
  const tickets = moveOutRows_(sheet);
  const ids = {};
  const normalized = [];
  for (let index = 0; index < repairItems.length; index += 1) {
    const input = repairItems[index] || {};
    const ticketId = moveOutText_(input.ticket_id);
    const amount = depositSettlementAmount_(input.amount);
    if (!ticketId || input.amount === undefined || input.amount === '' || amount === null) {
      return moveOutFailure_('REPAIR_DEDUCTION_INVALID', '報修扣款缺少 ticket_id 或金額錯誤');
    }
    if (ids[ticketId]) {
      return moveOutFailure_('REPAIR_DEDUCTION_DUPLICATE', '同一報修單不可重複扣款');
    }
    ids[ticketId] = true;
    const matches = tickets.filter(function (ticket) {
      return moveOutText_(ticket.ticket_id) === ticketId &&
        moveOutText_(ticket.workspace_id) === workspaceId &&
        moveOutText_(ticket.tenant_id) === moveOutText_(request.tenant_id) &&
        moveOutText_(ticket.contract_id) === moveOutText_(request.contract_id);
    });
    if (matches.length !== 1) {
      return moveOutFailure_(
        matches.length > 1 ? 'REPAIR_TICKET_CONFLICT' : 'REPAIR_TICKET_NOT_FOUND',
        '報修扣款來源不存在或不唯一'
      );
    }
    const status = moveOutText_(matches[0].status).toLowerCase();
    if (status !== 'completed' && status !== 'closed') {
      return moveOutFailure_('REPAIR_NOT_SETTLEABLE', '只有已完成或已關閉報修可列入扣款');
    }
    normalized.push({
      ticket_id: ticketId,
      amount: amount,
      note: moveOutText_(input.note),
      row_number: matches[0].__row_number
    });
  }
  return {
    success: true,
    sheet: sheet,
    items: normalized,
    amount: normalized.reduce(function (sum, item) { return sum + item.amount; }, 0)
  };
}


function depositSettlementUnpaidBills_(workspaceId, request) {
  const sheet = runtimeSpreadsheet_().getSheetByName('V2_bills');
  if (!sheet) return moveOutFailure_('BILL_SHEET_NOT_CONFIGURED', '找不到帳單資料表');
  const bills = moveOutRows_(sheet).filter(function (bill) {
    const status = moveOutText_(bill.bill_status).toLowerCase();
    const paymentStatus = moveOutText_(bill.payment_status).toLowerCase();
    return moveOutText_(bill.workspace_id) === workspaceId &&
      moveOutText_(bill.tenant_id) === moveOutText_(request.tenant_id) &&
      moveOutText_(bill.contract_id) === moveOutText_(request.contract_id) &&
      status !== 'cancelled' && status !== 'void' &&
      status !== 'paid' && paymentStatus !== 'paid';
  });
  const seen = {};
  let amount = 0;
  const billIds = [];
  for (let index = 0; index < bills.length; index += 1) {
    const billId = moveOutText_(bills[index].bill_id);
    if (!billId || seen[billId]) {
      return moveOutFailure_('UNPAID_BILL_CONFLICT', '未繳帳單缺少編號或存在重複');
    }
    const billAmount = depositSettlementAmount_(bills[index].total_amount);
    if (moveOutText_(bills[index].total_amount) === '' || billAmount === null) {
      return moveOutFailure_('UNPAID_BILL_AMOUNT_INVALID', '未繳帳單金額格式錯誤');
    }
    seen[billId] = true;
    billIds.push(billId);
    amount += billAmount;
  }
  return { success: true, amount: amount, bill_ids: billIds };
}


function depositSettlementFind_(settlementId, workspaceId) {
  const sheet = depositSettlementSheet_();
  const matches = moveOutRows_(sheet).filter(function (row) {
    return moveOutText_(row.settlement_id) === moveOutText_(settlementId) &&
      moveOutText_(row.workspace_id) === moveOutText_(workspaceId);
  });
  if (matches.length !== 1) {
    return moveOutFailure_(
      matches.length > 1 ? 'DEPOSIT_SETTLEMENT_CONFLICT' : 'DEPOSIT_SETTLEMENT_NOT_FOUND',
      matches.length > 1 ? '押金結算重複，已停止操作' : '找不到押金結算'
    );
  }
  return { success: true, sheet: sheet, data: matches[0] };
}


function depositSettlementSheet_() {
  const sheet = runtimeSpreadsheet_().getSheetByName(V2_DEPOSIT_SETTLEMENTS_SHEET_);
  if (!sheet) throw new Error('DEPOSIT_SETTLEMENT_SHEET_NOT_CONFIGURED');
  return sheet;
}


function depositSettlementPublic_(settlement) {
  return {
    settlement_id: moveOutText_(settlement.settlement_id),
    request_id: moveOutText_(settlement.request_id),
    workspace_id: moveOutText_(settlement.workspace_id),
    tenant_id: moveOutText_(settlement.tenant_id),
    contract_id: moveOutText_(settlement.contract_id),
    deposit_amount: Number(settlement.deposit_amount) || 0,
    unpaid_bill_amount: Number(settlement.unpaid_bill_amount) || 0,
    repair_cost_amount: Number(settlement.repair_cost_amount) || 0,
    total_deductions: Number(settlement.total_deductions) || 0,
    refund_amount: Number(settlement.refund_amount) || 0,
    tenant_balance_due: Number(settlement.tenant_balance_due) || 0,
    unpaid_bill_ids: depositSettlementJsonArray_(settlement.unpaid_bill_ids_json),
    repair_items: depositSettlementJsonArray_(settlement.repair_items_json),
    status: moveOutText_(settlement.status).toLowerCase(),
    ready_at: moveOutJsonValue_(settlement.ready_at),
    refunded_at: moveOutJsonValue_(settlement.refunded_at),
    refund_method: moveOutText_(settlement.refund_method),
    refund_reference: moveOutText_(settlement.refund_reference),
    inspection_note: moveOutText_(settlement.inspection_note),
    created_at: moveOutJsonValue_(settlement.created_at),
    updated_at: moveOutJsonValue_(settlement.updated_at)
  };
}


function depositSettlementAmount_(value) {
  const amount = Number(value || 0);
  return isFinite(amount) && amount >= 0 ? amount : null;
}


function depositSettlementMoney_(value) {
  return Math.round(Number(value) || 0).toLocaleString('en-US');
}


function depositSettlementJsonArray_(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(moveOutText_(value) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}
