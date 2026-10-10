/**
 * CMWebs V2 payment lifecycle (Phase 93 staging only).
 *
 * Physical sheet stays V2_payments for compatibility with settlement modules.
 */

const PHASE93_PAYMENTS_SHEET_ = 'V2_payments';

const PHASE93_PAYMENTS_REQUIRED_HEADERS_ = [
  'payment_id',
  'created_at',
  'updated_at',
  'workspace_id',
  'landlord_id',
  'tenant_id',
  'tenant_user_id',
  'user_id',
  'contract_id',
  'property_id',
  'room_id',
  'bill_id',
  'bill_month',
  'payment_date',
  'amount',
  'payment_method',
  'bank_last5',
  'status',
  'source',
  'source_ref_id',
  'confirmation_source',
  'confirmed_at',
  'confirmed_by',
  'rejected_at',
  'rejection_reason',
  'note',
  'payment_confirmed_queue_id'
];


function confirmLandlordBillPaymentByLineUid_(lineUserId, billId, input) {
  billingLifecycleAssertEnabled_();
  const access = billingLifecycleAccess_(lineUserId);
  if (!access.success) return access;
  input = input || {};

  const workspaceId = billingLifecycleText_(access.workspace.workspace_id);
  const scriptLock = LockService.getScriptLock();
  let locked = false;
  let payment;
  let bill;
  let billSheet;

  try {
    if (!scriptLock.tryLock(10000)) {
      return billingLifecycleFailure_('PAYMENT_BUSY', '付款確認作業忙碌中，請稍後再試');
    }
    locked = true;
    const match = billingLifecycleFindBill_(billId, workspaceId);
    if (!match.success) return match;
    bill = match.data;
    billSheet = match.sheet;

    const billStatus = billingLifecycleBillStatus_(bill);
    const paymentStatus = billingLifecycleText_(bill.payment_status).toLowerCase();
    if (billStatus === 'paid' || paymentStatus === 'paid') {
      const existingPayment = billingLifecycleRows_(billingLifecyclePaymentSheet_())
        .filter(function (row) {
          return billingLifecycleText_(row.workspace_id) === workspaceId &&
            billingLifecycleText_(row.bill_id) === billingLifecycleText_(bill.bill_id) &&
            billingLifecycleText_(row.status).toLowerCase() === 'confirmed';
        });
      return {
        success: true,
        code: 'PAYMENT_ALREADY_CONFIRMED',
        duplicate: true,
        data: {
          bill: billingLifecyclePublicBill_(bill),
          payment: existingPayment.length === 1
            ? billingLifecyclePublicPayment_(existingPayment[0])
            : null
        }
      };
    }
    if (billStatus !== 'issued' && billStatus !== 'overdue') {
      return billingLifecycleFailure_(
        'PAYMENT_BILL_STATUS_INVALID',
        '只有已出帳或逾期帳單可確認付款'
      );
    }

    const paymentSheet = billingLifecyclePaymentSheet_();
    const duplicatePayments = billingLifecycleRows_(paymentSheet).filter(function (row) {
      return billingLifecycleText_(row.workspace_id) === workspaceId &&
        billingLifecycleText_(row.bill_id) === billingLifecycleText_(bill.bill_id) &&
        billingLifecycleText_(row.status).toLowerCase() === 'confirmed';
    });
    if (duplicatePayments.length > 0) {
      return billingLifecycleFailure_(
        'PAYMENT_LEDGER_CONFLICT',
        '帳單已有確認付款紀錄，但帳單狀態尚未同步'
      );
    }

    const expectedAmount = Number(bill.total_amount) || 0;
    const amount = input.amount === undefined || input.amount === ''
      ? expectedAmount
      : Number(input.amount);
    if (!isFinite(amount) || amount < 0 || amount !== expectedAmount) {
      return billingLifecycleFailure_(
        'PAYMENT_AMOUNT_MISMATCH',
        '付款金額必須等於帳單總額'
      );
    }
    const paymentDate = billingLifecycleDate_(input.payment_date || new Date());
    if (!paymentDate) {
      return billingLifecycleFailure_('PAYMENT_DATE_INVALID', '付款日期格式錯誤');
    }

    const now = new Date();
    payment = {
      payment_id: billingLifecyclePaymentId_(),
      created_at: now,
      updated_at: now,
      workspace_id: workspaceId,
      landlord_id: billingLifecycleText_(bill.landlord_id),
      tenant_id: billingLifecycleText_(bill.tenant_id),
      tenant_user_id: billingLifecycleText_(bill.tenant_user_id || bill.user_id),
      user_id: billingLifecycleText_(bill.tenant_user_id || bill.user_id),
      contract_id: billingLifecycleText_(bill.contract_id),
      property_id: billingLifecycleText_(bill.property_id),
      room_id: billingLifecycleText_(bill.room_id),
      bill_id: billingLifecycleText_(bill.bill_id),
      bill_month: billingLifecycleMonth_(bill.bill_month),
      payment_date: paymentDate,
      amount: amount,
      payment_method: billingLifecycleText_(input.payment_method || 'bank_transfer'),
      bank_last5: billingLifecycleText_(input.bank_last5).slice(-5),
      status: 'confirmed',
      source: 'billing_lifecycle',
      source_ref_id: billingLifecycleText_(input.source_ref_id),
      confirmation_source: billingLifecycleText_(input.confirmation_source || 'landlord'),
      confirmed_at: now,
      confirmed_by: billingLifecycleText_(access.user && access.user.user_id),
      rejected_at: '',
      rejection_reason: '',
      note: billingLifecycleText_(input.note),
      payment_confirmed_queue_id: ''
    };
    workspaceAppendObject_(paymentSheet, payment);
    const storedPayments = billingLifecycleRows_(paymentSheet).filter(function (row) {
      return billingLifecycleText_(row.workspace_id) === workspaceId &&
        billingLifecycleText_(row.payment_id) === payment.payment_id;
    });
    payment = storedPayments[0] || payment;

    const billUpdates = {
      bill_status: 'paid',
      payment_status: 'paid',
      payment_id: payment.payment_id,
      paid_at: now,
      updated_at: now,
      updated_by: billingLifecycleText_(access.user && access.user.user_id)
    };
    billingLifecycleUpdate_(billSheet, bill.__row_number, billUpdates);
    Object.keys(billUpdates).forEach(function (key) { bill[key] = billUpdates[key]; });
    SpreadsheetApp.flush();

  } catch (error) {
    return billingLifecycleFailure_(
      error && error.code || 'PAYMENT_CONFIRMATION_ERROR',
      error && error.message || '付款確認失敗'
    );
  } finally {
    if (locked) scriptLock.releaseLock();
  }

  const queued = billingLifecycleEnqueueBillEvent_(bill, 'payment_confirmed');
  if (queued.success && queued.data && queued.data.queue_id && payment.__row_number) {
    billingLifecycleUpdate_(billingLifecyclePaymentSheet_(), payment.__row_number, {
      payment_confirmed_queue_id: queued.data.queue_id,
      updated_at: new Date()
    });
    payment.payment_confirmed_queue_id = queued.data.queue_id;
  }

  return {
    success: true,
    code: 'OK',
    message: '付款已確認',
    data: {
      bill: billingLifecyclePublicBill_(bill),
      payment: billingLifecyclePublicPayment_(payment),
      notification: billingLifecycleQueueSummary_(queued)
    }
  };
}


function billingLifecycleFindBill_(billId, workspaceId) {
  const sheet = billingLifecycleBillSheet_();
  const matches = billingLifecycleRows_(sheet).filter(function (bill) {
    return billingLifecycleText_(bill.bill_id) === billingLifecycleText_(billId) &&
      billingLifecycleText_(bill.workspace_id) === billingLifecycleText_(workspaceId);
  });
  if (matches.length !== 1) {
    return billingLifecycleFailure_(
      matches.length > 1 ? 'BILL_CONFLICT' : 'BILL_NOT_FOUND',
      matches.length > 1 ? '帳單資料重複，已停止操作' : '找不到指定帳單'
    );
  }
  return { success: true, sheet: sheet, data: matches[0] };
}


function billingLifecyclePaymentSheet_() {
  const sheet = runtimeSpreadsheet_().getSheetByName(PHASE93_PAYMENTS_SHEET_);
  if (!sheet) throw new Error('PAYMENT_SHEET_NOT_CONFIGURED');
  return sheet;
}


function billingLifecyclePublicPayment_(payment) {
  return {
    payment_id: billingLifecycleText_(payment.payment_id),
    workspace_id: billingLifecycleText_(payment.workspace_id),
    landlord_id: billingLifecycleText_(payment.landlord_id),
    tenant_id: billingLifecycleText_(payment.tenant_id),
    contract_id: billingLifecycleText_(payment.contract_id),
    bill_id: billingLifecycleText_(payment.bill_id),
    bill_month: billingLifecycleMonth_(payment.bill_month),
    payment_date: billingLifecycleDate_(payment.payment_date),
    amount: Number(payment.amount) || 0,
    payment_method: billingLifecycleText_(payment.payment_method),
    status: billingLifecycleText_(payment.status).toLowerCase(),
    confirmed_at: billingLifecycleJsonValue_(payment.confirmed_at),
    confirmed_by: billingLifecycleText_(payment.confirmed_by),
    created_at: billingLifecycleJsonValue_(payment.created_at),
    updated_at: billingLifecycleJsonValue_(payment.updated_at)
  };
}


function billingLifecyclePaymentId_() {
  return 'PAY-' + Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyyMMddHHmmss'
  ) + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
}
