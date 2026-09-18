// ==================================================
// CMWebs V2 Test Bill Archive
// 一次性封存已停用房間的測試帳單
// ==================================================

function landlordTestBillArchiveText_(value) {
  return String(
    value === undefined || value === null
      ? ''
      : value
  ).trim();
}


function landlordTestBillArchiveIsClosedRoom_(room) {
  const accountStatus = landlordTestBillArchiveText_(
    room && room.account_status || 'active'
  ).toLowerCase();

  return [
    'inactive',
    'disabled',
    'closed',
    'archived',
    '停用',
    '關閉',
    '已關閉',
    '封存'
  ].indexOf(accountStatus) >= 0;
}


function landlordTestBillArchiveIsUnpaid_(bill) {
  if (!bill) {
    return false;
  }

  const billStatus = landlordTestBillArchiveText_(
    bill.bill_status
  ).toLowerCase();

  if ([
    'void',
    'voided',
    'cancelled',
    'canceled',
    'cancel',
    '作廢',
    '取消',
    '已取消'
  ].indexOf(billStatus) >= 0) {
    return false;
  }

  const paymentStatus = landlordTestBillArchiveText_(
    bill.payment_status
  ).toLowerCase();

  if ([
    'paid',
    'settled',
    'confirmed',
    'complete',
    'completed',
    '已繳',
    '已繳清',
    '已付款'
  ].indexOf(paymentStatus) >= 0) {
    return false;
  }

  return !landlordTestBillArchiveText_(bill.payment_id);
}


function archiveTestLandlordBillByLineUid_(
  landlordLineUserId,
  billId,
  archiveReason
) {
  landlordLineUserId = landlordTestBillArchiveText_(landlordLineUserId);
  billId = landlordTestBillArchiveText_(billId);
  archiveReason = landlordTestBillArchiveText_(archiveReason);

  if (!landlordLineUserId) {
    return workspaceResult_(
      false,
      'MISSING_LANDLORD_LINE_UID',
      '缺少房東 LINE UID'
    );
  }

  if (!billId) {
    return workspaceResult_(
      false,
      'MISSING_BILL_ID',
      '缺少帳單 ID'
    );
  }

  if (!archiveReason) {
    return workspaceResult_(
      false,
      'MISSING_ARCHIVE_REASON',
      '請填寫測試帳單封存原因'
    );
  }

  if (archiveReason.length < 3) {
    return workspaceResult_(
      false,
      'ARCHIVE_REASON_TOO_SHORT',
      '封存原因至少需要 3 個字'
    );
  }

  if (archiveReason.length > 300) {
    return workspaceResult_(
      false,
      'ARCHIVE_REASON_TOO_LONG',
      '封存原因最多 300 字'
    );
  }

  try {
    const access = workspaceLandlordResolveAccess_(
      landlordLineUserId,
      { require_onboarding: true }
    );

    if (!access.success) {
      return access;
    }

    const ss = runtimeSpreadsheet_();
    const roomSheet = ss.getSheetByName('V2_rooms');
    const billSheet = ss.getSheetByName('V2_bills');
    const billRows =
      typeof billingGetWorkspaceRows_ === 'function'
        ? billingGetWorkspaceRows_(billSheet, access)
        : [];
    const bill = billRows.find(function (row) {
      return landlordTestBillArchiveText_(row.bill_id) === billId;
    });

    if (!bill) {
      return workspaceResult_(
        false,
        'BILL_NOT_FOUND',
        '找不到指定帳單或無權限存取'
      );
    }

    if (
      typeof v2CanonicalBillIsVoided_ === 'function' &&
      v2CanonicalBillIsVoided_(bill)
    ) {
      return workspaceResult_(
        true,
        'BILL_ALREADY_ARCHIVED',
        '此帳單已完成作廢封存',
        { bill_id: billId }
      );
    }

    const roomRows =
      typeof billingGetWorkspaceRows_ === 'function'
        ? billingGetWorkspaceRows_(roomSheet, access)
        : [];
    const room = roomRows.find(function (row) {
      return landlordTestBillArchiveText_(row.room_id) ===
        landlordTestBillArchiveText_(bill.room_id);
    });

    if (!room) {
      return workspaceResult_(
        false,
        'ROOM_NOT_FOUND',
        '找不到帳單對應房間或無權限存取'
      );
    }

    if (!landlordTestBillArchiveIsClosedRoom_(room)) {
      return workspaceResult_(
        false,
        'ROOM_ACCOUNT_ACTIVE',
        '只有已關閉的房間帳號可以封存測試帳單'
      );
    }

    if (!landlordTestBillArchiveIsUnpaid_(bill)) {
      return workspaceResult_(
        false,
        landlordTestBillArchiveText_(bill.payment_id)
          ? 'BILL_HAS_PAYMENT'
          : 'BILL_NOT_UNPAID',
        landlordTestBillArchiveText_(bill.payment_id)
          ? '此帳單已有付款紀錄，不可作廢封存'
          : '只有未付款帳單可以作廢封存'
      );
    }

    if (typeof cancelV2BillForAccess_ !== 'function') {
      return workspaceResult_(
        false,
        'BILL_CANCELLATION_MODULE_REQUIRED',
        '找不到帳單取消核心服務'
      );
    }

    const cancellation = cancelV2BillForAccess_(
      access,
      billId,
      archiveReason,
      {
        bill_id: landlordTestBillArchiveText_(bill.bill_id),
        tenant_id: landlordTestBillArchiveText_(bill.tenant_id),
        contract_id: landlordTestBillArchiveText_(bill.contract_id),
        room_name: landlordTestBillArchiveText_(bill.room_name),
        bill_month:
          typeof v2CanonicalBillMonthKey_ === 'function'
            ? v2CanonicalBillMonthKey_(bill.bill_month)
            : landlordTestBillArchiveText_(bill.bill_month),
        total_amount: Math.round(Number(bill.total_amount || 0)),
        expected_bill_status:
          landlordTestBillArchiveText_(bill.bill_status || 'issued').toLowerCase(),
        require_closed_room_account: true
      }
    );

    if (!cancellation || cancellation.success !== true) {
      return cancellation || workspaceResult_(
        false,
        'TEST_BILL_ARCHIVE_FAILED',
        '測試帳單封存失敗'
      );
    }

    const result = Object.assign({}, cancellation, {
      code: 'TEST_BILL_ARCHIVED',
      message: '測試帳單已作廢並封存，不會建立付款紀錄或發送通知'
    });

    if (typeof workspaceRecordOperationActor_ === 'function') {
      workspaceRecordOperationActor_(
        access,
        'landlord_bill_test_archive',
        result,
        {
          target_type: 'bill',
          target_id: billId,
          secondary_target_id:
            landlordTestBillArchiveText_(bill.room_id),
          operation_status: 'closed',
          detail: 'reason=' + archiveReason
        }
      );
    }

    return result;
  } catch (error) {
    return workspaceResult_(
      false,
      'TEST_BILL_ARCHIVE_ERROR',
      '測試帳單封存失敗：' + error.message
    );
  }
}
