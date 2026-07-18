// ==================================================
// CMWebs V2 Contract Requests
// 房客合約查詢、續約申請、解約申請、房東審核
// ==================================================

const V2_CONTRACT_REQUESTS_SHEET =
  'V2_contract_requests';

const V2_CONTRACT_REQUESTS_CONTRACTS_SHEET =
  'V2_contracts';

const V2_CONTRACT_REQUESTS_TENANTS_SHEET =
  'V2_tenants';

const V2_CONTRACT_REQUESTS_LANDLORDS_SHEET =
  'V2_landlords';

const V2_CONTRACT_REQUESTS_ROOMS_SHEET =
  'V2_rooms';

const V2_CONTRACT_REQUESTS_PROPERTIES_SHEET =
  'V2_properties';

const V2_CONTRACT_REQUESTS_BILLS_SHEET =
  'V2_bills';

const V2_CONTRACT_REQUESTS_LEGACY_BILL_SHEETS = [
  '1.每月帳單表',
  '3.歷史帳單總表'
];

const V2_CONTRACT_REQUESTS_TENANT_HOME_VIEW =
  'V2_tenant_home_view';

const V2_CONTRACT_REQUESTS_TENANT_LIST_VIEW =
  'V2_landlord_tenant_list_view';

const V2_CONTRACT_REQUESTS_LANDLORD_HOME_VIEW =
  'V2_landlord_home_view';

const V2_CONTRACT_REQUEST_HEADERS = [
  'request_id',
  'created_at',
  'updated_at',
  'request_type',

  'landlord_id',
  'landlord_line_user_id',

  'tenant_id',
  'tenant_user_id',
  'tenant_line_user_id',
  'tenant_name',

  'room_id',
  'room_name',
  'contract_id',

  'current_start_date',
  'current_end_date',
  'current_rent_amount',
  'current_management_fee',

  'requested_date',

  'requested_start_date',
  'requested_term_months',
  'requested_rent_amount',
  'requested_management_fee',
  'preferred_end_date',

  'approved_start_date',
  'approved_term_months',
  'approved_rent_amount',
  'approved_management_fee',
  'approved_end_date',

  'termination_type',
  'is_early_termination',
  'move_out_date',
  'approved_move_out_date',

  'penalty_status',
  'penalty_amount',
  'penalty_note',

  'reason',

  'status',
  'landlord_note',

  'approved_at',
  'approved_by',
  'rejected_at',
  'rejected_by',
  'cancelled_at',
  'cancelled_by',
  'completed_at',
  'completed_by',
  'closed_at',

  'applied_contract_id',
  'tenant_notified_at',
  'note'
];


// ==================================================
// 工作表初始化
// ==================================================

function ensureV2ContractRequestsSheet_() {
  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  let sheet =
    ss.getSheetByName(
      V2_CONTRACT_REQUESTS_SHEET
    );

  if (!sheet) {
    sheet =
      ss.insertSheet(
        V2_CONTRACT_REQUESTS_SHEET
      );
  }

  contractRequestEnsureHeaders_(
    sheet,
    V2_CONTRACT_REQUEST_HEADERS
  );

  return sheet;
}


function testEnsureV2ContractRequestsSheet() {
  const sheet =
    ensureV2ContractRequestsSheet_();

  const result = {
    success: true,
    code: 'OK',
    message: 'V2 合約申請工作表已就緒',
    data: {
      sheet_name:
        sheet.getName(),
      header_count:
        sheet.getLastColumn()
    }
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


// ==================================================
// 房客：合約首頁初始化
// ==================================================

function getTenantContractInitByLineUid_(
  tenantLineUserId
) {
  const action =
    'tenant_contract_init';

  try {
    tenantLineUserId =
      contractRequestText_(
        tenantLineUserId
      );

    if (!tenantLineUserId) {
      return contractRequestError_(
        'MISSING_TENANT_LINE_UID',
        '缺少房客 LINE UID'
      );
    }

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    const identity =
      contractRequestResolveTenantIdentity_(
        ss,
        tenantLineUserId
      );

    if (!identity) {
      return contractRequestError_(
        'TENANT_NOT_FOUND',
        '查無房客資料，請先完成身份綁定'
      );
    }

    const contract =
      contractRequestResolveCurrentContract_(
        ss,
        identity
      );

    if (!contract) {
      return contractRequestError_(
        'CONTRACT_NOT_FOUND',
        '查無目前有效合約',
        {
          tenant: identity,
          contract: null,
          requests: []
        }
      );
    }

    const requests =
      contractRequestGetTenantRequests_(
        ss,
        tenantLineUserId,
        identity.tenant_id
      );

    const responseData = {
      tenant: identity,
      contract:
        contractRequestBuildContractView_(
          ss,
          contract,
          identity
        ),
      requests: requests,
      permissions: {
        can_request_renewal:
          contractRequestCanSubmitType_(
            requests,
            'renewal'
          ),
        can_request_termination:
          contractRequestCanSubmitType_(
            requests,
            'termination'
          )
      }
    };

    contractRequestLogAccess_(
      {
        lineUserId:
          tenantLineUserId,
        userId:
          identity.tenant_user_id || '',
        role:
          'tenant',
        action:
          action,
        targetId:
          contract.contract_id || '',
        result:
          'success',
        notes:
          'request_count=' +
          requests.length
      }
    );

    return {
      success: true,
      code: 'OK',
      message: '查詢成功',
      data: responseData
    };

  } catch (error) {
    contractRequestLogAccess_(
      {
        lineUserId:
          tenantLineUserId || '',
        userId: '',
        role: 'tenant',
        action: action,
        targetId: '',
        result: 'failed',
        errorMessage:
          contractRequestErrorMessage_(
            error
          )
      }
    );

    return contractRequestError_(
      'TENANT_CONTRACT_INIT_ERROR',
      '合約資料讀取失敗：' +
      contractRequestErrorMessage_(
        error
      )
    );
  }
}


// ==================================================
// 房客：送出續約／解約申請
// ==================================================

function submitTenantContractRequestByLineUid_(
  tenantLineUserId,
  requestData
) {
  const action =
    'tenant_contract_request_submit';

  let lock = null;

  try {
    tenantLineUserId =
      contractRequestText_(
        tenantLineUserId
      );

    requestData =
      requestData || {};

    if (!tenantLineUserId) {
      return contractRequestError_(
        'MISSING_TENANT_LINE_UID',
        '缺少房客 LINE UID'
      );
    }

    const requestType =
      contractRequestNormalizeType_(
        requestData.request_type
      );

    if (!requestType) {
      return contractRequestError_(
        'INVALID_REQUEST_TYPE',
        '申請類型僅支援 renewal 或 termination'
      );
    }

    const reason =
      contractRequestText_(
        requestData.reason
      );

    if (!reason) {
      return contractRequestError_(
        'MISSING_REASON',
        '請填寫申請原因'
      );
    }

    if (reason.length > 500) {
      return contractRequestError_(
        'REASON_TOO_LONG',
        '申請原因最多 500 字'
      );
    }

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    const identity =
      contractRequestResolveTenantIdentity_(
        ss,
        tenantLineUserId
      );

    if (!identity) {
      return contractRequestError_(
        'TENANT_NOT_FOUND',
        '查無房客資料，請先完成身份綁定'
      );
    }

    const contract =
      contractRequestResolveCurrentContract_(
        ss,
        identity
      );

    if (!contract) {
      return contractRequestError_(
        'CONTRACT_NOT_FOUND',
        '查無目前有效合約'
      );
    }

    const normalized =
      contractRequestValidateRequestData_(
        requestType,
        requestData,
        contract
      );

    if (!normalized.success) {
      return normalized;
    }

    lock =
      LockService.getScriptLock();

    lock.waitLock(
      30000
    );

    const sheet =
      ensureV2ContractRequestsSheet_();

    const existingRequests =
      contractRequestGetTenantRequests_(
        ss,
        tenantLineUserId,
        identity.tenant_id
      );

    const duplicate =
      existingRequests.find(
        function (request) {
          return (
            request.request_type ===
              requestType &&
            request.status ===
              'pending' &&
            contractRequestText_(
              request.contract_id
            ) ===
              contractRequestText_(
                contract.contract_id
              )
          );
        }
      );

    if (duplicate) {
      return contractRequestError_(
        'PENDING_REQUEST_EXISTS',
        requestType === 'renewal'
          ? '已有待處理的續約申請'
          : '已有待處理的解約申請',
        {
          request: duplicate
        }
      );
    }

    const now =
      new Date();

    const requestId =
      contractRequestGenerateId_();

    const record = {
      request_id:
        requestId,
      created_at:
        now,
      updated_at:
        now,
      request_type:
        requestType,

      landlord_id:
        contractRequestText_(
          contract.landlord_id ||
          identity.landlord_id
        ),
      landlord_line_user_id:
        contractRequestText_(
          identity.landlord_line_user_id
        ),

      tenant_id:
        identity.tenant_id,
      tenant_user_id:
        identity.tenant_user_id,
      tenant_line_user_id:
        tenantLineUserId,
      tenant_name:
        identity.tenant_name,

      room_id:
        contractRequestText_(
          contract.room_id ||
          identity.room_id
        ),
      room_name:
        contractRequestText_(
          identity.room_name ||
          contract.room_name
        ),
      contract_id:
        contractRequestText_(
          contract.contract_id
        ),

      current_start_date:
        contractRequestFirstValue_(
          contract,
          [
            'start_date',
            'contract_start_date',
            'lease_start_date'
          ]
        ),
      current_end_date:
        contractRequestFirstValue_(
          contract,
          [
            'end_date',
            'contract_end_date',
            'lease_end_date'
          ]
        ),
      current_rent_amount:
        normalized.data.current_rent_amount,
      current_management_fee:
        normalized.data.current_management_fee,

      requested_date:
        normalized.data.requested_date,

      requested_start_date:
        normalized.data.requested_start_date,
      requested_term_months:
        normalized.data.requested_term_months,
      requested_rent_amount:
        normalized.data.requested_rent_amount,
      requested_management_fee:
        normalized.data.requested_management_fee,
      preferred_end_date:
        normalized.data.preferred_end_date,

      approved_start_date:
        '',
      approved_term_months:
        0,
      approved_rent_amount:
        '',
      approved_management_fee:
        '',
      approved_end_date:
        '',

      termination_type:
        normalized.data.termination_type,
      is_early_termination:
        normalized.data.is_early_termination,
      move_out_date:
        normalized.data.move_out_date,
      approved_move_out_date:
        '',

      penalty_status:
        normalized.data.penalty_status,
      penalty_amount:
        0,
      penalty_note:
        '',

      reason:
        reason,

      status:
        'pending',
      landlord_note:
        '',

      approved_at:
        '',
      approved_by:
        '',
      rejected_at:
        '',
      rejected_by:
        '',
      cancelled_at:
        '',
      cancelled_by:
        '',
      completed_at:
        '',
      completed_by:
        '',
      closed_at:
        '',

      applied_contract_id:
        '',
      tenant_notified_at:
        '',
      note:
        contractRequestText_(
          requestData.note
        )
    };

    contractRequestAppendObject_(
      sheet,
      record
    );

    const notification =
      contractRequestNotifyLandlordNewRequest_(
        record
      );

    contractRequestLogAccess_(
      {
        lineUserId:
          tenantLineUserId,
        userId:
          identity.tenant_user_id || '',
        role:
          'tenant',
        action:
          action,
        targetId:
          requestId,
        result:
          'success',
        notes:
          'request_type=' +
          requestType
      }
    );

    return {
      success: true,
      code: 'OK',
      message:
        requestType === 'renewal'
          ? '續約申請已送出，請等待房東處理'
          : '解約申請已送出，請等待房東處理',
      data: {
        request:
          contractRequestBuildRequestView_(
            record
          ),
        landlord_notification:
          notification
      }
    };

  } catch (error) {
    contractRequestLogAccess_(
      {
        lineUserId:
          tenantLineUserId || '',
        userId: '',
        role: 'tenant',
        action: action,
        targetId: '',
        result: 'failed',
        errorMessage:
          contractRequestErrorMessage_(
            error
          )
      }
    );

    return contractRequestError_(
      'CONTRACT_REQUEST_SUBMIT_ERROR',
      '申請送出失敗：' +
      contractRequestErrorMessage_(
        error
      )
    );

  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (releaseError) {
        // 忽略解除鎖定錯誤
      }
    }
  }
}


// ==================================================
// 房客：查詢申請紀錄
// ==================================================

function getTenantContractRequestsByLineUid_(
  tenantLineUserId
) {
  try {
    tenantLineUserId =
      contractRequestText_(
        tenantLineUserId
      );

    if (!tenantLineUserId) {
      return contractRequestError_(
        'MISSING_TENANT_LINE_UID',
        '缺少房客 LINE UID'
      );
    }

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    const identity =
      contractRequestResolveTenantIdentity_(
        ss,
        tenantLineUserId
      );

    if (!identity) {
      return contractRequestError_(
        'TENANT_NOT_FOUND',
        '查無房客資料'
      );
    }

    const requests =
      contractRequestGetTenantRequests_(
        ss,
        tenantLineUserId,
        identity.tenant_id
      );

    return {
      success: true,
      code: 'OK',
      message: '查詢成功',
      data: {
        tenant: identity,
        requests: requests
      }
    };

  } catch (error) {
    return contractRequestError_(
      'TENANT_CONTRACT_REQUESTS_ERROR',
      '申請紀錄讀取失敗：' +
      contractRequestErrorMessage_(
        error
      )
    );
  }
}


// ==================================================
// 房客：取消待處理申請
// ==================================================

function cancelTenantContractRequestByLineUid_(
  tenantLineUserId,
  requestId,
  cancelReason
) {
  const action =
    'tenant_contract_request_cancel';

  let lock = null;

  try {
    tenantLineUserId =
      contractRequestText_(
        tenantLineUserId
      );

    requestId =
      contractRequestText_(
        requestId
      );

    cancelReason =
      contractRequestText_(
        cancelReason
      );

    if (!tenantLineUserId) {
      return contractRequestError_(
        'MISSING_TENANT_LINE_UID',
        '缺少房客 LINE UID'
      );
    }

    if (!requestId) {
      return contractRequestError_(
        'MISSING_REQUEST_ID',
        '缺少申請 ID'
      );
    }

    lock =
      LockService.getScriptLock();

    lock.waitLock(
      30000
    );

    const sheet =
      ensureV2ContractRequestsSheet_();

    const rows =
      contractRequestGetObjects_(
        sheet
      );

    const request =
      rows.find(
        function (row) {
          return (
            contractRequestText_(
              row.request_id
            ) === requestId &&
            contractRequestText_(
              row.tenant_line_user_id
            ) === tenantLineUserId
          );
        }
      );

    if (!request) {
      return contractRequestError_(
        'REQUEST_NOT_FOUND',
        '查無指定申請'
      );
    }

    if (
      contractRequestNormalizeStatus_(
        request.status
      ) !== 'pending'
    ) {
      return contractRequestError_(
        'REQUEST_NOT_CANCELLABLE',
        '只有待處理申請可以取消'
      );
    }

    const now =
      new Date();

    const updated =
      Object.assign(
        {},
        request,
        {
          status:
            'cancelled',
          updated_at:
            now,
          cancelled_at:
            now,
          cancelled_by:
            'tenant',
          note:
            contractRequestMergeNote_(
              request.note,
              cancelReason
                ? '房客取消原因：' +
                  cancelReason
                : '房客取消申請'
            )
        }
      );

    contractRequestUpdateObjectRow_(
      sheet,
      request._sheet_row,
      updated
    );

    contractRequestNotifyLandlordCancelledRequest_(
      updated
    );

    contractRequestLogAccess_(
      {
        lineUserId:
          tenantLineUserId,
        userId:
          request.tenant_user_id || '',
        role:
          'tenant',
        action:
          action,
        targetId:
          requestId,
        result:
          'success'
      }
    );

    return {
      success: true,
      code: 'OK',
      message: '申請已取消',
      data: {
        request:
          contractRequestBuildRequestView_(
            updated
          )
      }
    };

  } catch (error) {
    return contractRequestError_(
      'CONTRACT_REQUEST_CANCEL_ERROR',
      '取消申請失敗：' +
      contractRequestErrorMessage_(
        error
      )
    );

  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (releaseError) {
        // 忽略解除鎖定錯誤
      }
    }
  }
}


// ==================================================
// 房東：申請管理初始化
// ==================================================

function getLandlordContractRequestsInitByLineUid_(
  landlordLineUserId
) {
  const action =
    'landlord_contract_requests_init';

  try {
    landlordLineUserId =
      contractRequestText_(
        landlordLineUserId
      );

    if (!landlordLineUserId) {
      return contractRequestError_(
        'MISSING_LANDLORD_LINE_UID',
        '缺少房東 LINE UID'
      );
    }

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    const landlord =
      contractRequestResolveLandlordIdentity_(
        ss,
        landlordLineUserId
      );

    if (!landlord) {
      return contractRequestError_(
        'LANDLORD_NOT_FOUND',
        '查無房東資料，請先完成身份綁定'
      );
    }

    const sheet =
      ensureV2ContractRequestsSheet_();

    const allRequests =
      contractRequestGetObjects_(
        sheet
      )
        .filter(
          function (row) {
            return (
              contractRequestText_(
                row.landlord_id
              ) ===
                landlord.landlord_id ||
              contractRequestText_(
                row.landlord_line_user_id
              ) ===
                landlordLineUserId
            );
          }
        )
        .map(
          contractRequestBuildRequestView_
        );

    allRequests.sort(
      contractRequestSortRequests_
    );

    const summary =
      contractRequestBuildLandlordSummary_(
        allRequests
      );

    contractRequestLogAccess_(
      {
        lineUserId:
          landlordLineUserId,
        userId:
          landlord.user_id || '',
        role:
          'landlord',
        action:
          action,
        targetId:
          landlord.landlord_id,
        result:
          'success',
        notes:
          'request_count=' +
          allRequests.length
      }
    );

    return {
      success: true,
      code: 'OK',
      message: '查詢成功',
      data: {
        landlord: landlord,
        summary: summary,
        requests: allRequests
      }
    };

  } catch (error) {
    contractRequestLogAccess_(
      {
        lineUserId:
          landlordLineUserId || '',
        userId: '',
        role: 'landlord',
        action: action,
        targetId: '',
        result: 'failed',
        errorMessage:
          contractRequestErrorMessage_(
            error
          )
      }
    );

    return contractRequestError_(
      'LANDLORD_CONTRACT_REQUESTS_ERROR',
      '合約申請讀取失敗：' +
      contractRequestErrorMessage_(
        error
      )
    );
  }
}


// ==================================================
// 房東：核准、駁回、完成
// ==================================================

function updateLandlordContractRequestByLineUid_(
  landlordLineUserId,
  requestId,
  newStatus,
  landlordNote,
  decisionData
) {
  const action =
    'landlord_contract_request_update';

  let lock = null;

  try {
    landlordLineUserId =
      contractRequestText_(
        landlordLineUserId
      );

    requestId =
      contractRequestText_(
        requestId
      );

    newStatus =
      contractRequestNormalizeLandlordAction_(
        newStatus
      );

    landlordNote =
      contractRequestText_(
        landlordNote
      );

    decisionData =
      decisionData || {};

    if (!landlordLineUserId) {
      return contractRequestError_(
        'MISSING_LANDLORD_LINE_UID',
        '缺少房東 LINE UID'
      );
    }

    if (!requestId) {
      return contractRequestError_(
        'MISSING_REQUEST_ID',
        '缺少申請 ID'
      );
    }

    if (!newStatus) {
      return contractRequestError_(
        'INVALID_STATUS',
        '僅支援 approved、rejected、completed'
      );
    }

    if (
      newStatus === 'rejected' &&
      !landlordNote
    ) {
      return contractRequestError_(
        'MISSING_REJECT_REASON',
        '駁回申請時必須填寫原因'
      );
    }

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    const landlord =
      contractRequestResolveLandlordIdentity_(
        ss,
        landlordLineUserId
      );

    if (!landlord) {
      return contractRequestError_(
        'LANDLORD_NOT_FOUND',
        '查無房東資料'
      );
    }

    lock =
      LockService.getScriptLock();

    lock.waitLock(
      30000
    );

    const sheet =
      ensureV2ContractRequestsSheet_();

    const rows =
      contractRequestGetObjects_(
        sheet
      );

    const request =
      rows.find(
        function (row) {
          return (
            contractRequestText_(
              row.request_id
            ) === requestId &&
            (
              contractRequestText_(
                row.landlord_id
              ) ===
                landlord.landlord_id ||
              contractRequestText_(
                row.landlord_line_user_id
              ) ===
                landlordLineUserId
            )
          );
        }
      );

    if (!request) {
      return contractRequestError_(
        'REQUEST_NOT_FOUND',
        '查無指定申請'
      );
    }

    const currentStatus =
      contractRequestNormalizeStatus_(
        request.status
      );

    if (
      newStatus === 'completed'
    ) {
      if (
        currentStatus !== 'approved'
      ) {
        return contractRequestError_(
          'REQUEST_NOT_COMPLETABLE',
          '只有已核准申請可以標記完成'
        );
      }
    } else if (
      currentStatus !== 'pending'
    ) {
      return contractRequestError_(
        'REQUEST_ALREADY_PROCESSED',
        '此申請已經處理，無法重複更新'
      );
    }

    const now =
      new Date();

    let updated =
      Object.assign(
        {},
        request,
        {
          status:
            newStatus,
          updated_at:
            now,
          landlord_note:
            landlordNote
        }
      );

    if (
      newStatus === 'approved'
    ) {
      const approval =
        contractRequestValidateLandlordApproval_(
          request,
          decisionData
        );

      if (!approval.success) {
        return approval;
      }

      updated =
        Object.assign(
          updated,
          approval.data,
          {
            approved_at:
              now,
            approved_by:
              landlordLineUserId
          }
        );
    }

    if (
      newStatus === 'rejected'
    ) {
      updated.rejected_at =
        now;
      updated.rejected_by =
        landlordLineUserId;
      updated.closed_at =
        now;
    }

    let contractApplyResult = null;

    if (
      newStatus === 'completed'
    ) {
      contractApplyResult =
        contractRequestApplyCompletedRequestToContract_(
          ss,
          request,
          landlordLineUserId
        );

      if (
        !contractApplyResult.success
      ) {
        return contractApplyResult;
      }

      updated.completed_at =
        now;
      updated.completed_by =
        landlordLineUserId;
      updated.closed_at =
        now;
      updated.applied_contract_id =
        contractApplyResult.data &&
        contractApplyResult.data.contract_id
          ? contractApplyResult.data.contract_id
          : contractRequestText_(
              request.contract_id
            );
    }

    contractRequestUpdateObjectRow_(
      sheet,
      request._sheet_row,
      updated
    );

    const notification =
      contractRequestNotifyTenantRequestUpdated_(
        updated
      );

    if (
      notification.success
    ) {
      updated.tenant_notified_at =
        new Date();

      contractRequestUpdateObjectRow_(
        sheet,
        request._sheet_row,
        updated
      );
    }

    contractRequestLogAccess_(
      {
        lineUserId:
          landlordLineUserId,
        userId:
          landlord.user_id || '',
        role:
          'landlord',
        action:
          action,
        targetId:
          requestId,
        result:
          'success',
        notes:
          'status=' +
          newStatus
      }
    );

    return {
      success: true,
      code: 'OK',
      message:
        contractRequestStatusMessage_(
          newStatus
        ),
      data: {
        request:
          contractRequestBuildRequestView_(
            updated
          ),
        tenant_notification:
          notification,
        contract_apply_result:
          contractApplyResult
      }
    };

  } catch (error) {
    return contractRequestError_(
      'CONTRACT_REQUEST_UPDATE_ERROR',
      '申請更新失敗：' +
      contractRequestErrorMessage_(
        error
      )
    );

  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (releaseError) {
        // 忽略解除鎖定錯誤
      }
    }
  }
}

// ==================================================
// 申請資料驗證
// ==================================================

function contractRequestValidateRequestData_(
  requestType,
  requestData,
  contract
) {
  requestData =
    requestData || {};

  const requestedDate =
    contractRequestNormalizeDate_(
      requestData.requested_date
    ) ||
    new Date();

  const currentRentAmount =
    contractRequestNumber_(
      contractRequestFirstValue_(
        contract,
        [
          'rent_amount',
          'monthly_rent',
          'rent'
        ]
      )
    );

  const currentManagementFee =
    contractRequestNumber_(
      contractRequestFirstValue_(
        contract,
        [
          'management_fee',
          'monthly_management_fee'
        ]
      )
    );

  const contractEndDate =
    contractRequestDateObject_(
      contractRequestFirstValue_(
        contract,
        [
          'end_date',
          'contract_end_date',
          'lease_end_date'
        ]
      )
    );

  if (
    requestType === 'renewal'
  ) {
    const requestedTermMonths =
      contractRequestInteger_(
        requestData.requested_term_months
      );

    if (
      requestedTermMonths < 1 ||
      requestedTermMonths > 36
    ) {
      return contractRequestError_(
        'INVALID_RENEWAL_TERM',
        '續約期間請輸入 1 至 36 個月'
      );
    }

    const requestedRentInput =
      contractRequestOptionalNumber_(
        requestData.requested_rent_amount
      );

    const requestedManagementInput =
      contractRequestOptionalNumber_(
        requestData.requested_management_fee
      );

    const requestedRentAmount =
      requestedRentInput === null
        ? currentRentAmount
        : requestedRentInput;

    const requestedManagementFee =
      requestedManagementInput === null
        ? currentManagementFee
        : requestedManagementInput;

    if (
      requestedRentAmount <= 0
    ) {
      return contractRequestError_(
        'INVALID_REQUESTED_RENT',
        '希望續約租金必須大於 0'
      );
    }

    if (
      requestedManagementFee < 0
    ) {
      return contractRequestError_(
        'INVALID_REQUESTED_MANAGEMENT_FEE',
        '希望管理費不可小於 0'
      );
    }

    let requestedStartDate =
      contractRequestNormalizeDate_(
        requestData.requested_start_date
      );

    if (!requestedStartDate) {
      requestedStartDate =
        contractEndDate
          ? contractRequestAddDays_(
              contractEndDate,
              1
            )
          : requestedDate;
    }

    if (
      contractEndDate &&
      requestedStartDate.getTime() <=
        contractEndDate.getTime()
    ) {
      return contractRequestError_(
        'RENEWAL_START_NOT_AFTER_CURRENT_END',
        '新租期起日必須晚於目前合約到期日'
      );
    }

    let preferredEndDate =
      contractRequestNormalizeDate_(
        requestData.preferred_end_date
      );

    if (!preferredEndDate) {
      preferredEndDate =
        contractRequestCalculateTermEndDate_(
          requestedStartDate,
          requestedTermMonths
        );
    }

    if (
      preferredEndDate.getTime() <
        requestedStartDate.getTime()
    ) {
      return contractRequestError_(
        'INVALID_PREFERRED_END_DATE',
        '希望續約到期日不可早於新租期起日'
      );
    }

    return {
      success: true,
      data: {
        requested_date:
          requestedDate,
        current_rent_amount:
          currentRentAmount,
        current_management_fee:
          currentManagementFee,
        requested_start_date:
          requestedStartDate,
        requested_term_months:
          requestedTermMonths,
        requested_rent_amount:
          requestedRentAmount,
        requested_management_fee:
          requestedManagementFee,
        preferred_end_date:
          preferredEndDate,
        termination_type:
          '',
        is_early_termination:
          false,
        move_out_date:
          '',
        penalty_status:
          'not_applicable'
      }
    };
  }

  if (!contractEndDate) {
    return contractRequestError_(
      'CONTRACT_END_DATE_MISSING',
      '目前合約缺少到期日，無法判斷解約類型'
    );
  }

  const terminationTypeInput =
    contractRequestNormalizeTerminationType_(
      requestData.termination_type
    );

  let moveOutDate =
    contractRequestNormalizeDate_(
      requestData.move_out_date
    );

  let terminationType =
    terminationTypeInput;

  if (!terminationType) {
    terminationType =
      moveOutDate &&
      moveOutDate.getTime() <
        contractEndDate.getTime()
        ? 'early_termination'
        : 'non_renewal';
  }

  if (
    terminationType === 'non_renewal'
  ) {
    moveOutDate =
      contractEndDate;
  }

  if (!moveOutDate) {
    return contractRequestError_(
      'MISSING_MOVE_OUT_DATE',
      '請填寫預計退租日期'
    );
  }

  const contractStartDate =
    contractRequestDateObject_(
      contractRequestFirstValue_(
        contract,
        [
          'start_date',
          'contract_start_date',
          'lease_start_date'
        ]
      )
    );

  if (
    contractStartDate &&
    moveOutDate.getTime() <
      contractStartDate.getTime()
  ) {
    return contractRequestError_(
      'MOVE_OUT_BEFORE_START',
      '退租日期不可早於合約起始日'
    );
  }

  if (
    terminationType ===
      'early_termination' &&
    moveOutDate.getTime() >=
      contractEndDate.getTime()
  ) {
    return contractRequestError_(
      'EARLY_TERMINATION_DATE_INVALID',
      '提前解約日期必須早於目前合約到期日'
    );
  }

  if (
    terminationType ===
      'non_renewal' &&
    moveOutDate.getTime() !==
      contractEndDate.getTime()
  ) {
    return contractRequestError_(
      'NON_RENEWAL_DATE_INVALID',
      '到期不續約的退租日期必須等於合約到期日'
    );
  }

  return {
    success: true,
    data: {
      requested_date:
        requestedDate,
      current_rent_amount:
        currentRentAmount,
      current_management_fee:
        currentManagementFee,
      requested_start_date:
        '',
      requested_term_months:
        0,
      requested_rent_amount:
        '',
      requested_management_fee:
        '',
      preferred_end_date:
        '',
      termination_type:
        terminationType,
      is_early_termination:
        terminationType ===
        'early_termination',
      move_out_date:
        moveOutDate,
      penalty_status:
        terminationType ===
        'early_termination'
          ? 'pending'
          : 'not_applicable'
    }
  };
}

// ==================================================
// 身分與合約解析
// ==================================================

function contractRequestResolveTenantIdentity_(
  ss,
  tenantLineUserId
) {
  const candidateSheets = [
    V2_CONTRACT_REQUESTS_TENANT_HOME_VIEW,
    V2_CONTRACT_REQUESTS_TENANT_LIST_VIEW,
    V2_CONTRACT_REQUESTS_TENANTS_SHEET
  ];

  for (
    let sheetIndex = 0;
    sheetIndex <
      candidateSheets.length;
    sheetIndex++
  ) {
    const sheet =
      ss.getSheetByName(
        candidateSheets[
          sheetIndex
        ]
      );

    const rows =
      contractRequestGetObjects_(
        sheet
      );

    for (
      let rowIndex = 0;
      rowIndex < rows.length;
      rowIndex++
    ) {
      const row =
        rows[rowIndex];

      const rowTenantLineUserId =
        contractRequestText_(
          row.tenant_line_user_id ||
          row.line_user_id
        );

      if (
        rowTenantLineUserId !==
        tenantLineUserId
      ) {
        continue;
      }

      return {
        tenant_line_user_id:
          tenantLineUserId,
        tenant_user_id:
          contractRequestText_(
            row.tenant_user_id ||
            row.user_id
          ),
        tenant_id:
          contractRequestText_(
            row.tenant_id
          ),
        tenant_name:
          contractRequestText_(
            row.tenant_name ||
            row.name
          ),
        tenant_phone:
          contractRequestText_(
            row.tenant_phone ||
            row.phone
          ),
        tenant_email:
          contractRequestText_(
            row.tenant_email ||
            row.email
          ),
        room_id:
          contractRequestText_(
            row.room_id
          ),
        room_name:
          contractRequestText_(
            row.room_name ||
            row.room_list
          ),
        landlord_id:
          contractRequestText_(
            row.landlord_id
          ),
        landlord_name:
          contractRequestText_(
            row.landlord_name
          ),
        landlord_line_user_id:
          contractRequestText_(
            row.landlord_line_user_id
          ),
        account_status:
          contractRequestText_(
            row.account_status ||
            row.tenant_account_status
          ) || 'active'
      };
    }
  }

  return null;
}


function contractRequestResolveLandlordIdentity_(
  ss,
  landlordLineUserId
) {
  const candidateSheets = [
    V2_CONTRACT_REQUESTS_LANDLORD_HOME_VIEW,
    V2_CONTRACT_REQUESTS_TENANT_LIST_VIEW,
    V2_CONTRACT_REQUESTS_LANDLORDS_SHEET
  ];

  for (
    let sheetIndex = 0;
    sheetIndex <
      candidateSheets.length;
    sheetIndex++
  ) {
    const sheet =
      ss.getSheetByName(
        candidateSheets[
          sheetIndex
        ]
      );

    const rows =
      contractRequestGetObjects_(
        sheet
      );

    for (
      let rowIndex = 0;
      rowIndex < rows.length;
      rowIndex++
    ) {
      const row =
        rows[rowIndex];

      const rowLineUserId =
        contractRequestText_(
          row.landlord_line_user_id ||
          row.line_user_id
        );

      if (
        rowLineUserId !==
        landlordLineUserId
      ) {
        continue;
      }

      return {
        line_user_id:
          landlordLineUserId,
        user_id:
          contractRequestText_(
            row.landlord_user_id ||
            row.user_id
          ),
        landlord_id:
          contractRequestText_(
            row.landlord_id
          ),
        landlord_name:
          contractRequestText_(
            row.landlord_name ||
            row.name
          ),
        room_count:
          contractRequestNumber_(
            row.room_count
          ),
        tenant_count:
          contractRequestNumber_(
            row.tenant_count
          ),
        account_status:
          contractRequestText_(
            row.account_status
          ) || 'active'
      };
    }
  }

  return null;
}


function contractRequestResolveCurrentContract_(
  ss,
  identity
) {
  const sheet =
    ss.getSheetByName(
      V2_CONTRACT_REQUESTS_CONTRACTS_SHEET
    );

  const rows =
    contractRequestGetObjects_(
      sheet
    );

  const tenantId =
    contractRequestText_(
      identity.tenant_id
    );

  const roomId =
    contractRequestText_(
      identity.room_id
    );

  let candidates =
    rows.filter(
      function (row) {
        const rowTenantId =
          contractRequestText_(
            row.tenant_id
          );

        const rowRoomId =
          contractRequestText_(
            row.room_id
          );

        return (
          rowTenantId ===
            tenantId &&
          (
            !roomId ||
            !rowRoomId ||
            rowRoomId === roomId
          )
        );
      }
    );

  if (
    candidates.length === 0 &&
    roomId
  ) {
    candidates =
      rows.filter(
        function (row) {
          return (
            contractRequestText_(
              row.room_id
            ) === roomId
          );
        }
      );
  }

  if (
    candidates.length === 0
  ) {
    return null;
  }

  candidates.sort(
    function (a, b) {
      const activeA =
        contractRequestContractIsActive_(
          a
        )
          ? 1
          : 0;

      const activeB =
        contractRequestContractIsActive_(
          b
        )
          ? 1
          : 0;

      if (
        activeA !== activeB
      ) {
        return activeB - activeA;
      }

      return (
        contractRequestTimeValue_(
          contractRequestFirstValue_(
            b,
            [
              'end_date',
              'contract_end_date',
              'updated_at'
            ]
          )
        ) -
        contractRequestTimeValue_(
          contractRequestFirstValue_(
            a,
            [
              'end_date',
              'contract_end_date',
              'updated_at'
            ]
          )
        )
      );
    }
  );

  return candidates[0];
}


function contractRequestContractIsActive_(
  contract
) {
  const status =
    contractRequestText_(
      contract.contract_status ||
      contract.status ||
      contract.account_status
    ).toLowerCase();

  if (
    [
      'active',
      'valid',
      'current',
      '啟用',
      '有效'
    ].indexOf(status) !== -1
  ) {
    return true;
  }

  const endDate =
    contractRequestDateObject_(
      contractRequestFirstValue_(
        contract,
        [
          'end_date',
          'contract_end_date',
          'lease_end_date'
        ]
      )
    );

  if (!endDate) {
    return false;
  }

  const today =
    contractRequestTaipeiToday_();

  return (
    endDate.getTime() >=
    today.getTime()
  );
}


// ==================================================
// View 建立
// ==================================================

function contractRequestBuildContractView_(
  ss,
  contract,
  identity
) {
  const startDate =
    contractRequestFirstValue_(
      contract,
      [
        'start_date',
        'contract_start_date',
        'lease_start_date'
      ]
    );

  const endDate =
    contractRequestFirstValue_(
      contract,
      [
        'end_date',
        'contract_end_date',
        'lease_end_date'
      ]
    );

  const supplement =
    contractRequestResolveContractSupplement_(
      ss,
      contract,
      identity
    );

  return {
    contract_id:
      contractRequestText_(
        contract.contract_id
      ),

    landlord_id:
      contractRequestText_(
        contract.landlord_id ||
        identity.landlord_id ||
        supplement.landlord_id
      ),

    landlord_name:
      contractRequestText_(
        contract.landlord_name ||
        identity.landlord_name ||
        supplement.landlord_name
      ),

    property_id:
      contractRequestText_(
        contract.property_id ||
        supplement.property_id
      ),

    property_name:
      contractRequestText_(
        contract.property_name ||
        supplement.property_name
      ),

    property_address:
      contractRequestText_(
        contract.property_address ||
        contract.address ||
        supplement.property_address
      ),

    room_id:
      contractRequestText_(
        contract.room_id ||
        identity.room_id ||
        supplement.room_id
      ),

    room_name:
      contractRequestText_(
        identity.room_name ||
        contract.room_name ||
        supplement.room_name
      ),

    tenant_id:
      identity.tenant_id,

    tenant_name:
      identity.tenant_name,

    start_date:
      startDate || '',

    end_date:
      endDate || '',

    days_remaining:
      contractRequestDaysRemaining_(
        endDate
      ),

    rent_amount:
      contractRequestNumber_(
        contractRequestFirstValue_(
          contract,
          [
            'rent_amount',
            'monthly_rent',
            'rent'
          ]
        )
      ),

    management_fee:
      contractRequestNumber_(
        contractRequestFirstValue_(
          contract,
          [
            'management_fee',
            'monthly_management_fee'
          ]
        )
      ),

    deposit_amount:
      contractRequestNumber_(
        contractRequestFirstValue_(
          contract,
          [
            'deposit_amount',
            'deposit'
          ]
        )
      ),

    monthly_payment_day:
      contractRequestInteger_(
        contractRequestFirstValue_(
          contract,
          [
            'monthly_payment_day',
            'payment_day',
            'rent_due_day',
            'due_day'
          ]
        ) ||
        supplement.monthly_payment_day
      ),

    bank_name:
      contractRequestText_(
        contractRequestFirstValue_(
          contract,
          [
            'bank_name',
            'landlord_bank_name'
          ]
        ) ||
        supplement.bank_name
      ),

    bank_account:
      contractRequestText_(
        contractRequestFirstValue_(
          contract,
          [
            'bank_account',
            'landlord_bank_account',
            'payment_account'
          ]
        ) ||
        supplement.bank_account
      ),

    bank_account_name:
      contractRequestText_(
        contractRequestFirstValue_(
          contract,
          [
            'bank_account_name',
            'account_name',
            'landlord_bank_account_name'
          ]
        ) ||
        supplement.bank_account_name
      ),

    bank_raw_text:
      contractRequestText_(
        supplement.bank_raw_text
      ),

    contract_status:
      contractRequestText_(
        contract.contract_status ||
        contract.status ||
        contract.account_status
      ),

    updated_at:
      contract.updated_at || ''
  };
}


// ==================================================
// 合約補充資料解析
// 用途：補齊房東名稱、匯款帳號、每月繳款日、建物資料
// ==================================================

function contractRequestResolveContractSupplement_(
  ss,
  contract,
  identity
) {
  const result = {
    landlord_id: '',
    landlord_name: '',
    property_id: '',
    property_name: '',
    property_address: '',
    room_id: '',
    room_name: '',
    monthly_payment_day: 0,
    bank_name: '',
    bank_account: '',
    bank_account_name: '',
    bank_raw_text: ''
  };

  const contractId =
    contractRequestText_(
      contract.contract_id
    );

  const tenantId =
    contractRequestText_(
      identity.tenant_id ||
      contract.tenant_id
    );

  const roomId =
    contractRequestText_(
      contract.room_id ||
      identity.room_id
    );

  const roomName =
    contractRequestText_(
      identity.room_name ||
      contract.room_name
    );

  const landlordId =
    contractRequestText_(
      contract.landlord_id ||
      identity.landlord_id
    );

  result.landlord_id = landlordId;
  result.room_id = roomId;
  result.room_name = roomName;

  // 1. 房間資料：取得 property_id 與房號
  const roomRows =
    contractRequestGetObjects_(
      ss.getSheetByName(
        V2_CONTRACT_REQUESTS_ROOMS_SHEET
      )
    );

  const roomRow =
    roomRows.find(
      function (row) {
        const rowRoomId =
          contractRequestText_(
            row.room_id
          );

        const rowRoomName =
          contractRequestText_(
            row.room_name ||
            row.room_number ||
            row.name
          );

        return (
          (roomId && rowRoomId === roomId) ||
          (!roomId && roomName && rowRoomName === roomName)
        );
      }
    ) || {};

  result.room_id =
    result.room_id ||
    contractRequestText_(
      roomRow.room_id
    );

  result.room_name =
    result.room_name ||
    contractRequestText_(
      roomRow.room_name ||
      roomRow.room_number ||
      roomRow.name
    );

  result.property_id =
    contractRequestText_(
      contract.property_id ||
      roomRow.property_id
    );

  // 2. 房東主檔：房東名稱與匯款資料
  const landlordRows =
    contractRequestGetObjects_(
      ss.getSheetByName(
        V2_CONTRACT_REQUESTS_LANDLORDS_SHEET
      )
    );

  const landlordRow =
    landlordRows.find(
      function (row) {
        return (
          contractRequestText_(
            row.landlord_id
          ) === landlordId
        );
      }
    ) || {};

  result.landlord_name =
    contractRequestText_(
      landlordRow.landlord_name ||
      landlordRow.name ||
      landlordRow.owner_name
    );

  result.bank_name =
    contractRequestText_(
      contractRequestFirstValue_(
        landlordRow,
        [
          'bank_name',
          'landlord_bank_name',
          'remittance_bank',
          '銀行',
          '銀行名稱'
        ]
      )
    );

  result.bank_account =
    contractRequestText_(
      contractRequestFirstValue_(
        landlordRow,
        [
          'bank_account',
          'landlord_bank_account',
          'payment_account',
          'remittance_account',
          '銀行帳號',
          '匯款帳號'
        ]
      )
    );

  result.bank_account_name =
    contractRequestText_(
      contractRequestFirstValue_(
        landlordRow,
        [
          'bank_account_name',
          'account_name',
          'landlord_bank_account_name',
          '戶名',
          '帳戶名稱'
        ]
      )
    );

  // 3. 建物主檔：名稱、地址與可能的匯款資料
  const propertyRows =
    contractRequestGetObjects_(
      ss.getSheetByName(
        V2_CONTRACT_REQUESTS_PROPERTIES_SHEET
      )
    );

  const propertyRow =
    propertyRows.find(
      function (row) {
        const rowPropertyId =
          contractRequestText_(
            row.property_id
          );

        const rowLandlordId =
          contractRequestText_(
            row.landlord_id
          );

        return (
          (result.property_id &&
            rowPropertyId === result.property_id) ||
          (!result.property_id &&
            landlordId &&
            rowLandlordId === landlordId)
        );
      }
    ) || {};

  result.property_id =
    result.property_id ||
    contractRequestText_(
      propertyRow.property_id
    );

  result.property_name =
    contractRequestText_(
      propertyRow.property_name ||
      propertyRow.building_name ||
      propertyRow.name
    );

  result.property_address =
    contractRequestText_(
      propertyRow.property_address ||
      propertyRow.address ||
      propertyRow.full_address
    );

  result.bank_name =
    result.bank_name ||
    contractRequestText_(
      contractRequestFirstValue_(
        propertyRow,
        [
          'bank_name',
          'landlord_bank_name',
          'remittance_bank',
          '銀行',
          '銀行名稱'
        ]
      )
    );

  result.bank_account =
    result.bank_account ||
    contractRequestText_(
      contractRequestFirstValue_(
        propertyRow,
        [
          'bank_account',
          'landlord_bank_account',
          'payment_account',
          'remittance_account',
          '銀行帳號',
          '匯款帳號'
        ]
      )
    );

  result.bank_account_name =
    result.bank_account_name ||
    contractRequestText_(
      contractRequestFirstValue_(
        propertyRow,
        [
          'bank_account_name',
          'account_name',
          'landlord_bank_account_name',
          '戶名',
          '帳戶名稱'
        ]
      )
    );

  // 4. 最新 V2 帳單：由 due_date 反推每月繳款日
  const billRows =
    contractRequestGetObjects_(
      ss.getSheetByName(
        V2_CONTRACT_REQUESTS_BILLS_SHEET
      )
    );

  const billCandidates =
    billRows.filter(
      function (row) {
        const rowContractId =
          contractRequestText_(
            row.contract_id
          );

        const rowTenantId =
          contractRequestText_(
            row.tenant_id
          );

        const rowRoomId =
          contractRequestText_(
            row.room_id
          );

        return (
          (contractId && rowContractId === contractId) ||
          (!contractId && tenantId && rowTenantId === tenantId) ||
          (!contractId && !tenantId && roomId && rowRoomId === roomId)
        );
      }
    );

  billCandidates.sort(
    function (a, b) {
      return (
        contractRequestTimeValue_(
          b.due_date ||
          b.bill_month ||
          b.updated_at
        ) -
        contractRequestTimeValue_(
          a.due_date ||
          a.bill_month ||
          a.updated_at
        )
      );
    }
  );

  if (billCandidates.length > 0) {
    result.monthly_payment_day =
      contractRequestDayOfMonth_(
        billCandidates[0].due_date
      );
  }

  // 5. V1 帳單：作為匯款帳號與繳款日最後備援
  const legacy =
    contractRequestResolveLegacyBillSupplement_(
      ss,
      roomName,
      identity.tenant_name
    );

  result.monthly_payment_day =
    result.monthly_payment_day ||
    legacy.monthly_payment_day;

  result.bank_name =
    result.bank_name ||
    legacy.bank_name;

  result.bank_account =
    result.bank_account ||
    legacy.bank_account;

  result.bank_account_name =
    result.bank_account_name ||
    legacy.bank_account_name;

  result.bank_raw_text =
    legacy.bank_raw_text || '';

  result.landlord_name =
    result.landlord_name ||
    legacy.landlord_name;

  return result;
}


function contractRequestResolveLegacyBillSupplement_(
  ss,
  roomName,
  tenantName
) {
  const result = {
    landlord_name: '',
    monthly_payment_day: 0,
    bank_name: '',
    bank_account: '',
    bank_account_name: '',
    bank_raw_text: ''
  };

  for (
    let sheetIndex = 0;
    sheetIndex <
      V2_CONTRACT_REQUESTS_LEGACY_BILL_SHEETS.length;
    sheetIndex++
  ) {
    const sheet =
      ss.getSheetByName(
        V2_CONTRACT_REQUESTS_LEGACY_BILL_SHEETS[
          sheetIndex
        ]
      );

    const rows =
      contractRequestGetObjects_(
        sheet
      );

    const candidates =
      rows.filter(
        function (row) {
          const rowRoomName =
            contractRequestText_(
              row['房號'] ||
              row.room_name
            );

          const rowTenantName =
            contractRequestText_(
              row['租客姓名'] ||
              row.tenant_name
            );

          return (
            rowRoomName === roomName &&
            (
              !tenantName ||
              !rowTenantName ||
              rowTenantName === tenantName
            )
          );
        }
      );

    if (candidates.length === 0) {
      continue;
    }

    const row =
      candidates[
        candidates.length - 1
      ];

    result.monthly_payment_day =
      contractRequestInteger_(
        contractRequestFirstValue_(
          row,
          [
            '每月繳款日',
            '繳款日',
            'monthly_payment_day',
            'payment_day'
          ]
        )
      );

    if (!result.monthly_payment_day) {
      result.monthly_payment_day =
        contractRequestDayOfMonth_(
          contractRequestFirstValue_(
            row,
            [
              '繳款期限',
              'due_date'
            ]
          )
        );
    }

    const bankRaw =
      contractRequestText_(
        contractRequestFirstValue_(
          row,
          [
            '房東匯款帳號',
            '匯款帳號',
            'landlord_bank_account',
            'bank_account'
          ]
        )
      );

    const parsed =
      contractRequestParseBankText_(
        bankRaw
      );

    result.bank_raw_text = bankRaw;
    result.bank_name = parsed.bank_name;
    result.bank_account = parsed.bank_account;
    result.bank_account_name = parsed.bank_account_name;
    result.landlord_name = parsed.bank_account_name;

    return result;
  }

  return result;
}


function contractRequestParseBankText_(
  value
) {
  const text =
    contractRequestText_(
      value
    );

  const result = {
    bank_name: '',
    bank_account: '',
    bank_account_name: ''
  };

  if (!text) {
    return result;
  }

  const accountNameMatch =
    text.match(
      /(?:戶名|帳戶名稱)\s*[：:]?\s*([^\s，,；;]+)/
    );

  if (accountNameMatch) {
    result.bank_account_name =
      contractRequestText_(
        accountNameMatch[1]
      );
  }

  const bankMatch =
    text.match(
      /(郵局|中華郵政|[\u4e00-\u9fff]{2,8}銀行)/
    );

  if (bankMatch) {
    result.bank_name =
      bankMatch[1] === '中華郵政'
        ? '郵局'
        : bankMatch[1];
  }

  const accountMatch =
    text.match(
      /(?:\d{3}[-\s]?)?\d{8,16}/
    );

  if (accountMatch) {
    result.bank_account =
      accountMatch[0]
        .replace(/\s+/g, '');
  }

  return result;
}


function contractRequestDayOfMonth_(
  value
) {
  const date =
    contractRequestDateObject_(
      value
    );

  if (date) {
    return Number(
      Utilities.formatDate(
        date,
        'Asia/Taipei',
        'd'
      )
    );
  }

  const text =
    contractRequestText_(
      value
    );

  const dateMatch =
    text.match(
      /\d{4}[\/-]\d{1,2}[\/-](\d{1,2})/
    );

  if (dateMatch) {
    return Number(
      dateMatch[1]
    );
  }

  const number =
    contractRequestInteger_(
      value
    );

  return (
    number >= 1 &&
    number <= 31
  )
    ? number
    : 0;
}


function testTenantContractSupplementFields() {
  const result =
    getTenantContractInitByLineUid_(
      getRequiredScriptProperty_('TEST_TENANT_LINE_UID')
    );

  const contract =
    result &&
    result.data &&
    result.data.contract
      ? result.data.contract
      : {};

  const output = {
    success:
      result.success,
    code:
      result.code,
    contract_id:
      contract.contract_id || '',
    landlord_name:
      contract.landlord_name || '',
    property_name:
      contract.property_name || '',
    property_address:
      contract.property_address || '',
    monthly_payment_day:
      contract.monthly_payment_day || 0,
    bank_name:
      contract.bank_name || '',
    bank_account:
      contract.bank_account || '',
    bank_account_name:
      contract.bank_account_name || '',
    bank_raw_text:
      contract.bank_raw_text || ''
  };

  Logger.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );

  return output;
}


function contractRequestBuildRequestView_(
  row
) {
  return {
    request_id:
      contractRequestText_(
        row.request_id
      ),
    created_at:
      row.created_at || '',
    updated_at:
      row.updated_at || '',
    request_type:
      contractRequestNormalizeType_(
        row.request_type
      ) ||
      contractRequestText_(
        row.request_type
      ),
    request_type_label:
      contractRequestTypeLabel_(
        row.request_type
      ),

    landlord_id:
      contractRequestText_(
        row.landlord_id
      ),
    landlord_line_user_id:
      contractRequestText_(
        row.landlord_line_user_id
      ),

    tenant_id:
      contractRequestText_(
        row.tenant_id
      ),
    tenant_user_id:
      contractRequestText_(
        row.tenant_user_id
      ),
    tenant_line_user_id:
      contractRequestText_(
        row.tenant_line_user_id
      ),
    tenant_name:
      contractRequestText_(
        row.tenant_name
      ),

    room_id:
      contractRequestText_(
        row.room_id
      ),
    room_name:
      contractRequestText_(
        row.room_name
      ),
    contract_id:
      contractRequestText_(
        row.contract_id
      ),

    current_start_date:
      row.current_start_date || '',
    current_end_date:
      row.current_end_date || '',
    current_rent_amount:
      contractRequestNumber_(
        row.current_rent_amount
      ),
    current_management_fee:
      contractRequestNumber_(
        row.current_management_fee
      ),

    requested_date:
      row.requested_date || '',

    requested_start_date:
      row.requested_start_date || '',
    requested_term_months:
      contractRequestInteger_(
        row.requested_term_months
      ),
    requested_rent_amount:
      contractRequestOptionalNumber_(
        row.requested_rent_amount
      ),
    requested_management_fee:
      contractRequestOptionalNumber_(
        row.requested_management_fee
      ),
    preferred_end_date:
      row.preferred_end_date || '',

    approved_start_date:
      row.approved_start_date || '',
    approved_term_months:
      contractRequestInteger_(
        row.approved_term_months
      ),
    approved_rent_amount:
      contractRequestOptionalNumber_(
        row.approved_rent_amount
      ),
    approved_management_fee:
      contractRequestOptionalNumber_(
        row.approved_management_fee
      ),
    approved_end_date:
      row.approved_end_date || '',

    termination_type:
      contractRequestNormalizeTerminationType_(
        row.termination_type
      ),
    termination_type_label:
      contractRequestTerminationTypeLabel_(
        row.termination_type
      ),
    is_early_termination:
      contractRequestBoolean_(
        row.is_early_termination
      ),
    move_out_date:
      row.move_out_date || '',
    approved_move_out_date:
      row.approved_move_out_date || '',

    penalty_status:
      contractRequestNormalizePenaltyStatus_(
        row.penalty_status
      ),
    penalty_status_label:
      contractRequestPenaltyStatusLabel_(
        row.penalty_status
      ),
    penalty_amount:
      contractRequestNumber_(
        row.penalty_amount
      ),
    penalty_note:
      contractRequestText_(
        row.penalty_note
      ),

    reason:
      contractRequestText_(
        row.reason
      ),

    status:
      contractRequestNormalizeStatus_(
        row.status
      ) ||
      contractRequestText_(
        row.status
      ),
    status_label:
      contractRequestStatusLabel_(
        row.status
      ),
    landlord_note:
      contractRequestText_(
        row.landlord_note
      ),

    approved_at:
      row.approved_at || '',
    approved_by:
      contractRequestText_(
        row.approved_by
      ),
    rejected_at:
      row.rejected_at || '',
    rejected_by:
      contractRequestText_(
        row.rejected_by
      ),
    cancelled_at:
      row.cancelled_at || '',
    cancelled_by:
      contractRequestText_(
        row.cancelled_by
      ),
    completed_at:
      row.completed_at || '',
    completed_by:
      contractRequestText_(
        row.completed_by
      ),
    closed_at:
      row.closed_at || '',
    applied_contract_id:
      contractRequestText_(
        row.applied_contract_id
      ),
    tenant_notified_at:
      row.tenant_notified_at || '',
    note:
      contractRequestText_(
        row.note
      )
  };
}

function contractRequestGetTenantRequests_(
  ss,
  tenantLineUserId,
  tenantId
) {
  const sheet =
    ensureV2ContractRequestsSheet_();

  const requests =
    contractRequestGetObjects_(
      sheet
    )
      .filter(
        function (row) {
          const byLineUid =
            contractRequestText_(
              row.tenant_line_user_id
            ) ===
              tenantLineUserId;

          const byTenantId =
            tenantId &&
            contractRequestText_(
              row.tenant_id
            ) === tenantId;

          return (
            byLineUid ||
            byTenantId
          );
        }
      )
      .map(
        contractRequestBuildRequestView_
      );

  requests.sort(
    contractRequestSortRequests_
  );

  return requests;
}


function contractRequestSortRequests_(
  a,
  b
) {
  const statusWeight = {
    pending: 1,
    approved: 2,
    rejected: 3,
    cancelled: 4,
    completed: 5
  };

  const weightA =
    statusWeight[
      a.status
    ] || 99;

  const weightB =
    statusWeight[
      b.status
    ] || 99;

  if (
    weightA !== weightB
  ) {
    return weightA - weightB;
  }

  return (
    contractRequestTimeValue_(
      b.created_at
    ) -
    contractRequestTimeValue_(
      a.created_at
    )
  );
}


function contractRequestBuildLandlordSummary_(
  requests
) {
  const summary = {
    total_count:
      requests.length,
    pending_count: 0,
    approved_count: 0,
    rejected_count: 0,
    cancelled_count: 0,
    completed_count: 0,
    renewal_count: 0,
    termination_count: 0,
    early_termination_count: 0,
    non_renewal_count: 0,
    penalty_charged_count: 0,
    penalty_waived_count: 0,
    updated_at:
      new Date()
  };

  requests.forEach(
    function (request) {
      const status =
        contractRequestNormalizeStatus_(
          request.status
        );

      const type =
        contractRequestNormalizeType_(
          request.request_type
        );

      const terminationType =
        contractRequestNormalizeTerminationType_(
          request.termination_type
        );

      const penaltyStatus =
        contractRequestNormalizePenaltyStatus_(
          request.penalty_status
        );

      if (
        status &&
        summary[
          status + '_count'
        ] !== undefined
      ) {
        summary[
          status + '_count'
        ]++;
      }

      if (
        type &&
        summary[
          type + '_count'
        ] !== undefined
      ) {
        summary[
          type + '_count'
        ]++;
      }

      if (
        terminationType &&
        summary[
          terminationType + '_count'
        ] !== undefined
      ) {
        summary[
          terminationType + '_count'
        ]++;
      }

      if (
        penaltyStatus === 'charged'
      ) {
        summary.penalty_charged_count++;
      }

      if (
        penaltyStatus === 'waived'
      ) {
        summary.penalty_waived_count++;
      }
    }
  );

  return summary;
}

// ==================================================
// 房東核准條件與正式合約套用
// ==================================================

function contractRequestValidateLandlordApproval_(
  request,
  decisionData
) {
  decisionData =
    decisionData || {};

  const requestType =
    contractRequestNormalizeType_(
      request.request_type
    );

  if (
    requestType === 'renewal'
  ) {
    const approvedTermMonths =
      contractRequestInteger_(
        decisionData.approved_term_months ||
        request.requested_term_months
      );

    if (
      approvedTermMonths < 1 ||
      approvedTermMonths > 36
    ) {
      return contractRequestError_(
        'INVALID_APPROVED_RENEWAL_TERM',
        '核准續約期間請輸入 1 至 36 個月'
      );
    }

    const approvedRentInput =
      contractRequestOptionalNumber_(
        decisionData.approved_rent_amount
      );

    const approvedManagementInput =
      contractRequestOptionalNumber_(
        decisionData.approved_management_fee
      );

    const approvedRentAmount =
      approvedRentInput === null
        ? contractRequestNumber_(
            request.requested_rent_amount ||
            request.current_rent_amount
          )
        : approvedRentInput;

    const approvedManagementFee =
      approvedManagementInput === null
        ? contractRequestNumber_(
            request.requested_management_fee ||
            request.current_management_fee
          )
        : approvedManagementInput;

    if (
      approvedRentAmount <= 0
    ) {
      return contractRequestError_(
        'INVALID_APPROVED_RENT',
        '核准租金必須大於 0'
      );
    }

    if (
      approvedManagementFee < 0
    ) {
      return contractRequestError_(
        'INVALID_APPROVED_MANAGEMENT_FEE',
        '核准管理費不可小於 0'
      );
    }

    const currentEndDate =
      contractRequestDateObject_(
        request.current_end_date
      );

    let approvedStartDate =
      contractRequestNormalizeDate_(
        decisionData.approved_start_date ||
        request.requested_start_date
      );

    if (!approvedStartDate) {
      approvedStartDate =
        currentEndDate
          ? contractRequestAddDays_(
              currentEndDate,
              1
            )
          : new Date();
    }

    if (
      currentEndDate &&
      approvedStartDate.getTime() <=
        currentEndDate.getTime()
    ) {
      return contractRequestError_(
        'APPROVED_START_NOT_AFTER_CURRENT_END',
        '核准新租期起日必須晚於目前合約到期日'
      );
    }

    let approvedEndDate =
      contractRequestNormalizeDate_(
        decisionData.approved_end_date
      );

    if (!approvedEndDate) {
      approvedEndDate =
        contractRequestCalculateTermEndDate_(
          approvedStartDate,
          approvedTermMonths
        );
    }

    if (
      approvedEndDate.getTime() <
        approvedStartDate.getTime()
    ) {
      return contractRequestError_(
        'INVALID_APPROVED_END_DATE',
        '核准到期日不可早於新租期起日'
      );
    }

    return {
      success: true,
      data: {
        approved_start_date:
          approvedStartDate,
        approved_term_months:
          approvedTermMonths,
        approved_rent_amount:
          approvedRentAmount,
        approved_management_fee:
          approvedManagementFee,
        approved_end_date:
          approvedEndDate,
        approved_move_out_date:
          '',
        penalty_status:
          'not_applicable',
        penalty_amount:
          0,
        penalty_note:
          ''
      }
    };
  }

  const terminationType =
    contractRequestNormalizeTerminationType_(
      request.termination_type
    ) ||
    (
      contractRequestBoolean_(
        request.is_early_termination
      )
        ? 'early_termination'
        : 'non_renewal'
    );

  let approvedMoveOutDate =
    contractRequestNormalizeDate_(
      decisionData.approved_move_out_date ||
      request.move_out_date
    );

  const currentEndDate =
    contractRequestDateObject_(
      request.current_end_date
    );

  if (
    terminationType === 'non_renewal'
  ) {
    approvedMoveOutDate =
      currentEndDate ||
      approvedMoveOutDate;
  }

  if (!approvedMoveOutDate) {
    return contractRequestError_(
      'MISSING_APPROVED_MOVE_OUT_DATE',
      '請填寫核准退租日期'
    );
  }

  if (
    terminationType ===
      'early_termination' &&
    currentEndDate &&
    approvedMoveOutDate.getTime() >=
      currentEndDate.getTime()
  ) {
    return contractRequestError_(
      'APPROVED_EARLY_MOVE_OUT_INVALID',
      '提前解約的核准退租日必須早於合約到期日'
    );
  }

  if (
    terminationType === 'non_renewal'
  ) {
    return {
      success: true,
      data: {
        approved_start_date:
          '',
        approved_term_months:
          0,
        approved_rent_amount:
          '',
        approved_management_fee:
          '',
        approved_end_date:
          '',
        approved_move_out_date:
          approvedMoveOutDate,
        penalty_status:
          'not_applicable',
        penalty_amount:
          0,
        penalty_note:
          contractRequestText_(
            decisionData.penalty_note
          )
      }
    };
  }

  const penaltyStatus =
    contractRequestNormalizePenaltyStatus_(
      decisionData.penalty_status
    );

  if (
    [
      'charged',
      'waived'
    ].indexOf(
      penaltyStatus
    ) === -1
  ) {
    return contractRequestError_(
      'PENALTY_DECISION_REQUIRED',
      '提前解約核准時，請選擇收取或免收違約金'
    );
  }

  let penaltyAmount =
    contractRequestNumber_(
      decisionData.penalty_amount
    );

  if (
    penaltyStatus === 'charged' &&
    penaltyAmount <= 0
  ) {
    return contractRequestError_(
      'INVALID_PENALTY_AMOUNT',
      '選擇收取違約金時，金額必須大於 0'
    );
  }

  if (
    penaltyStatus === 'waived'
  ) {
    penaltyAmount = 0;
  }

  return {
    success: true,
    data: {
      approved_start_date:
        '',
      approved_term_months:
        0,
      approved_rent_amount:
        '',
      approved_management_fee:
        '',
      approved_end_date:
        '',
      approved_move_out_date:
        approvedMoveOutDate,
      penalty_status:
        penaltyStatus,
      penalty_amount:
        penaltyAmount,
      penalty_note:
        contractRequestText_(
          decisionData.penalty_note
        )
    }
  };
}


function contractRequestApplyCompletedRequestToContract_(
  ss,
  request,
  landlordLineUserId
) {
  const sheet =
    ss.getSheetByName(
      V2_CONTRACT_REQUESTS_CONTRACTS_SHEET
    );

  if (!sheet) {
    return contractRequestError_(
      'CONTRACT_SHEET_NOT_FOUND',
      '找不到 V2_contracts 工作表'
    );
  }

  contractRequestEnsureHeaders_(
    sheet,
    [
      'contract_id',
      'start_date',
      'end_date',
      'rent_amount',
      'management_fee',
      'contract_status',
      'updated_at',
      'renewed_at',
      'renewal_request_id',
      'terminated_at',
      'termination_request_id'
    ]
  );

  const contractId =
    contractRequestText_(
      request.contract_id
    );

  const rows =
    contractRequestGetObjects_(
      sheet
    );

  const contract =
    rows.find(
      function (row) {
        return (
          contractRequestText_(
            row.contract_id
          ) === contractId
        );
      }
    );

  if (!contract) {
    return contractRequestError_(
      'CONTRACT_NOT_FOUND_FOR_COMPLETION',
      '找不到要更新的正式合約'
    );
  }

  const now =
    new Date();

  const requestType =
    contractRequestNormalizeType_(
      request.request_type
    );

  const updated =
    Object.assign(
      {},
      contract,
      {
        updated_at:
          now
      }
    );

  if (
    requestType === 'renewal'
  ) {
    const approvedEndDate =
      contractRequestDateObject_(
        request.approved_end_date
      );

    const approvedRentAmount =
      contractRequestNumber_(
        request.approved_rent_amount
      );

    const approvedManagementFee =
      contractRequestNumber_(
        request.approved_management_fee
      );

    if (
      !approvedEndDate ||
      approvedRentAmount <= 0 ||
      approvedManagementFee < 0
    ) {
      return contractRequestError_(
        'APPROVED_RENEWAL_TERMS_INCOMPLETE',
        '核准續約條件不完整，無法完成合約更新'
      );
    }

    updated.end_date =
      approvedEndDate;
    updated.rent_amount =
      approvedRentAmount;
    updated.management_fee =
      approvedManagementFee;
    updated.contract_status =
      'active';
    updated.renewed_at =
      now;
    updated.renewal_request_id =
      request.request_id;
  } else {
    const approvedMoveOutDate =
      contractRequestDateObject_(
        request.approved_move_out_date ||
        request.move_out_date
      );

    if (!approvedMoveOutDate) {
      return contractRequestError_(
        'APPROVED_MOVE_OUT_DATE_MISSING',
        '核准退租日期不完整，無法完成合約更新'
      );
    }

    updated.end_date =
      approvedMoveOutDate;
    updated.contract_status =
      'terminated';
    updated.terminated_at =
      now;
    updated.termination_request_id =
      request.request_id;
  }

  contractRequestUpdateObjectRow_(
    sheet,
    contract._sheet_row,
    updated
  );

  return {
    success: true,
    code: 'OK',
    message:
      requestType === 'renewal'
        ? '正式合約續約條件已更新'
        : '正式合約已完成退租結案',
    data: {
      contract_id:
        contractId,
      request_id:
        request.request_id,
      request_type:
        requestType,
      updated_by:
        landlordLineUserId
    }
  };
}


// ==================================================
// LINE 通知
// ==================================================

function contractRequestNotifyLandlordNewRequest_(
  request
) {
  const landlordLineUserId =
    contractRequestText_(
      request.landlord_line_user_id
    );

  if (!landlordLineUserId) {
    return {
      success: false,
      code:
        'LANDLORD_LINE_UID_MISSING',
      message:
        '房東尚未綁定 LINE'
    };
  }

  const lines = [
    '【CMWebs 合約申請通知】',
    '',
    '房客：' +
      (request.tenant_name || '-'),
    '房號：' +
      (request.room_name || '-'),
    '申請類型：' +
      contractRequestTypeLabel_(
        request.request_type
      )
  ];

  if (
    contractRequestNormalizeType_(
      request.request_type
    ) === 'renewal'
  ) {
    lines.push(
      '希望續約：' +
        contractRequestInteger_(
          request.requested_term_months
        ) +
        ' 個月',
      '希望租金：NT$ ' +
        contractRequestNumber_(
          request.requested_rent_amount
        ).toLocaleString('zh-TW'),
      '希望管理費：NT$ ' +
        contractRequestNumber_(
          request.requested_management_fee
        ).toLocaleString('zh-TW')
    );
  } else {
    lines.push(
      '退租類型：' +
        contractRequestTerminationTypeLabel_(
          request.termination_type
        ),
      '預計退租日：' +
        contractRequestFormatDate_(
          request.move_out_date
        )
    );
  }

  lines.push(
    '',
    '申請原因：',
    request.reason || '-',
    '',
    '請至 CMWebs 房東端「合約申請管理」查看。'
  );

  const text =
    lines.join('\n');

  if (
    typeof workspaceNotifyTeam_ ===
    'function'
  ) {
    return workspaceNotifyTeam_({
      workspace_id:
        request.workspace_id ||
        '',

      landlord_id:
        request.landlord_id ||
        '',

      event_type:
        'contract',

      title:
        '收到新的合約申請',

      body:
        text,

      target_type:
        'contract_request',

      target_id:
        request.request_id ||
        '',

      action_url:
        'https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-contract-requests.html',

      severity:
        'info',

      source:
        'tenant_contract_request',

      fallback_line_user_id:
        landlordLineUserId,

      metadata: {
        request_type:
          request.request_type ||
          '',

        tenant_id:
          request.tenant_id ||
          '',

        tenant_name:
          request.tenant_name ||
          '',

        room_name:
          request.room_name ||
          ''
      }
    });
  }

  return contractRequestPushLine_(
    landlordLineUserId,
    text,
    {
      landlord_line_user_id:
        landlordLineUserId,
      tenant_line_user_id:
        request.tenant_line_user_id || '',
      tenant_id:
        request.tenant_id || '',
      tenant_user_id:
        request.tenant_user_id || '',
      tenant_name:
        request.tenant_name || '',
      room_list:
        request.room_name || '',
      message_type:
        'contract_request',
      source:
        'tenant_liff',
      note:
        'request_id=' +
        request.request_id
    }
  );
}


function contractRequestNotifyLandlordCancelledRequest_(
  request
) {
  const landlordLineUserId =
    contractRequestText_(
      request.landlord_line_user_id
    );

  if (!landlordLineUserId) {
    return {
      success: false,
      code:
        'LANDLORD_LINE_UID_MISSING',
      message:
        '房東尚未綁定 LINE'
    };
  }

  const text = [
    '【CMWebs 合約申請取消通知】',
    '',
    '房客：' +
      (request.tenant_name || '-'),
    '房號：' +
      (request.room_name || '-'),
    '申請類型：' +
      contractRequestTypeLabel_(
        request.request_type
      ),
    '',
    '房客已取消此申請。'
  ].join('\n');

  if (
    typeof workspaceNotifyTeam_ ===
    'function'
  ) {
    return workspaceNotifyTeam_({
      workspace_id:
        request.workspace_id ||
        '',

      landlord_id:
        request.landlord_id ||
        '',

      event_type:
        'contract',

      title:
        '房客已取消合約申請',

      body:
        text,

      target_type:
        'contract_request',

      target_id:
        request.request_id ||
        '',

      action_url:
        'https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-contract-requests.html',

      severity:
        'warning',

      source:
        'tenant_contract_request_cancelled',

      fallback_line_user_id:
        landlordLineUserId,

      metadata: {
        request_type:
          request.request_type ||
          '',

        tenant_id:
          request.tenant_id ||
          '',

        tenant_name:
          request.tenant_name ||
          '',

        room_name:
          request.room_name ||
          ''
      }
    });
  }

  return contractRequestPushLine_(
    landlordLineUserId,
    text,
    {
      landlord_line_user_id:
        landlordLineUserId,
      tenant_line_user_id:
        request.tenant_line_user_id || '',
      tenant_id:
        request.tenant_id || '',
      tenant_user_id:
        request.tenant_user_id || '',
      tenant_name:
        request.tenant_name || '',
      room_list:
        request.room_name || '',
      message_type:
        'contract_request_cancelled',
      source:
        'tenant_liff',
      note:
        'request_id=' +
        request.request_id
    }
  );
}


function contractRequestNotifyTenantRequestUpdated_(
  request
) {
  const tenantLineUserId =
    contractRequestText_(
      request.tenant_line_user_id
    );

  if (!tenantLineUserId) {
    return {
      success: false,
      code:
        'TENANT_LINE_UID_MISSING',
      message:
        '房客尚未綁定 LINE'
    };
  }

  const status =
    contractRequestNormalizeStatus_(
      request.status
    );

  const statusText =
    contractRequestStatusLabel_(
      status
    );

  const lines = [
    '【CMWebs 合約申請結果】',
    '',
    (request.tenant_name || '房客') +
      ' 您好：',
    '',
    '申請類型：' +
      contractRequestTypeLabel_(
        request.request_type
      ),
    '房號：' +
      (request.room_name || '-'),
    '處理結果：' +
      statusText
  ];

  const requestType =
    contractRequestNormalizeType_(
      request.request_type
    );

  if (
    status === 'approved' &&
    requestType === 'renewal'
  ) {
    lines.push(
      '',
      '核准新租金：NT$ ' +
        contractRequestNumber_(
          request.approved_rent_amount
        ).toLocaleString('zh-TW'),
      '核准管理費：NT$ ' +
        contractRequestNumber_(
          request.approved_management_fee
        ).toLocaleString('zh-TW'),
      '核准租期：' +
        contractRequestInteger_(
          request.approved_term_months
        ) +
        ' 個月',
      '新租期：' +
        contractRequestFormatDate_(
          request.approved_start_date
        ) +
        ' 至 ' +
        contractRequestFormatDate_(
          request.approved_end_date
        )
    );
  }

  if (
    status === 'approved' &&
    requestType === 'termination'
  ) {
    lines.push(
      '',
      '退租類型：' +
        contractRequestTerminationTypeLabel_(
          request.termination_type
        ),
      '核准退租日：' +
        contractRequestFormatDate_(
          request.approved_move_out_date ||
          request.move_out_date
        ),
      '違約金：' +
        contractRequestPenaltyStatusLabel_(
          request.penalty_status
        )
    );

    if (
      contractRequestNormalizePenaltyStatus_(
        request.penalty_status
      ) === 'charged'
    ) {
      lines.push(
        '違約金金額：NT$ ' +
          contractRequestNumber_(
            request.penalty_amount
          ).toLocaleString('zh-TW')
      );
    }
  }

  if (
    request.landlord_note
  ) {
    lines.push(
      '',
      '房東說明：',
      request.landlord_note
    );
  }

  if (
    status === 'approved'
  ) {
    lines.push(
      '',
      '後續合約文件及日期仍以房東確認內容為準。'
    );
  }

  lines.push(
    '',
    '請至 CMWebs 房客端查看詳細資料。'
  );

  return contractRequestPushLine_(
    tenantLineUserId,
    lines.join('\n'),
    {
      landlord_line_user_id:
        request.landlord_line_user_id || '',
      tenant_line_user_id:
        tenantLineUserId,
      tenant_id:
        request.tenant_id || '',
      tenant_user_id:
        request.tenant_user_id || '',
      tenant_name:
        request.tenant_name || '',
      room_list:
        request.room_name || '',
      message_type:
        'contract_request_result',
      source:
        'landlord_liff',
      note:
        'request_id=' +
        request.request_id +
        ', status=' +
        status
    }
  );
}


function contractRequestPushLine_(
  toLineUserId,
  text,
  logData
) {
  try {
    if (
      typeof pushLineTextMessage_ !==
      'function'
    ) {
      return {
        success: false,
        code:
          'LINE_PUSH_FUNCTION_MISSING',
        message:
          '找不到 pushLineTextMessage_ 函式'
      };
    }

    const pushResult =
      pushLineTextMessage_(
        toLineUserId,
        text
      );

    const success =
      !pushResult ||
      pushResult.success !== false;

    if (
      typeof cmwebsLogLineMessage_ ===
      'function'
    ) {
      try {
        cmwebsLogLineMessage_(
          Object.assign(
            {
              created_at:
                new Date(),
              direction:
                'outgoing',
              status:
                success
                  ? 'success'
                  : 'failed',
              message_text:
                text,
              note:
                success
                  ? 'LINE message sent'
                  : contractRequestText_(
                      pushResult &&
                      pushResult.message
                    )
            },
            logData || {}
          )
        );
      } catch (logError) {
        // LINE 已發送時，紀錄錯誤不影響主流程
      }
    }

    return {
      success:
        success,
      code:
        success
          ? 'OK'
          : 'LINE_PUSH_FAILED',
      message:
        success
          ? 'LINE 通知已發送'
          : contractRequestText_(
              pushResult &&
              pushResult.message
            ) ||
            'LINE 發送失敗',
      data:
        pushResult || {}
    };

  } catch (error) {
    return {
      success: false,
      code:
        'LINE_PUSH_ERROR',
      message:
        contractRequestErrorMessage_(
          error
        )
    };
  }
}


// ==================================================
// 工作表工具
// ==================================================

function contractRequestEnsureHeaders_(
  sheet,
  requiredHeaders
) {
  if (
    sheet.getLastColumn() === 0
  ) {
    sheet
      .getRange(
        1,
        1,
        1,
        requiredHeaders.length
      )
      .setValues([
        requiredHeaders
      ]);

    return;
  }

  const currentHeaders =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getDisplayValues()[0]
      .map(
        contractRequestText_
      );

  const missingHeaders =
    requiredHeaders.filter(
      function (header) {
        return (
          currentHeaders.indexOf(
            header
          ) === -1
        );
      }
    );

  if (
    missingHeaders.length === 0
  ) {
    return;
  }

  sheet
    .getRange(
      1,
      currentHeaders.length + 1,
      1,
      missingHeaders.length
    )
    .setValues([
      missingHeaders
    ]);
}


function contractRequestGetObjects_(
  sheet
) {
  if (
    !sheet ||
    sheet.getLastRow() < 2 ||
    sheet.getLastColumn() < 1
  ) {
    return [];
  }

  const values =
    sheet
      .getDataRange()
      .getValues();

  const headers =
    values[0].map(
      contractRequestText_
    );

  return values
    .slice(1)
    .map(
      function (
        row,
        rowIndex
      ) {
        const object = {
          _sheet_row:
            rowIndex + 2
        };

        headers.forEach(
          function (
            header,
            columnIndex
          ) {
            if (header) {
              object[header] =
                row[columnIndex];
            }
          }
        );

        return object;
      }
    );
}


function contractRequestGetHeaders_(
  sheet
) {
  return sheet
    .getRange(
      1,
      1,
      1,
      sheet.getLastColumn()
    )
    .getDisplayValues()[0]
    .map(
      contractRequestText_
    );
}


function contractRequestAppendObject_(
  sheet,
  record
) {
  const headers =
    contractRequestGetHeaders_(
      sheet
    );

  const row =
    headers.map(
      function (header) {
        return (
          record[header] !==
          undefined
            ? record[header]
            : ''
        );
      }
    );

  sheet
    .getRange(
      sheet.getLastRow() + 1,
      1,
      1,
      row.length
    )
    .setValues([
      row
    ]);
}


function contractRequestUpdateObjectRow_(
  sheet,
  rowNumber,
  record
) {
  const headers =
    contractRequestGetHeaders_(
      sheet
    );

  const existing =
    sheet
      .getRange(
        rowNumber,
        1,
        1,
        headers.length
      )
      .getValues()[0];

  const row =
    headers.map(
      function (
        header,
        index
      ) {
        if (
          record[header] !==
          undefined
        ) {
          return record[header];
        }

        return existing[index];
      }
    );

  sheet
    .getRange(
      rowNumber,
      1,
      1,
      row.length
    )
    .setValues([
      row
    ]);
}


// ==================================================
// 一般工具
// ==================================================

function contractRequestGenerateId_() {
  const now =
    new Date();

  const timestamp =
    Utilities.formatDate(
      now,
      'Asia/Taipei',
      'yyyyMMddHHmmssSSS'
    );

  const random =
    String(
      Math.floor(
        Math.random() *
        10000
      )
    ).padStart(
      4,
      '0'
    );

  return (
    'CR-' +
    timestamp +
    '-' +
    random
  );
}


function contractRequestNormalizeType_(
  value
) {
  const text =
    contractRequestText_(
      value
    ).toLowerCase();

  if (
    text === 'renewal' ||
    text === '續約'
  ) {
    return 'renewal';
  }

  if (
    text === 'termination' ||
    text === 'terminate' ||
    text === '解約' ||
    text === '退租'
  ) {
    return 'termination';
  }

  return '';
}


function contractRequestNormalizeTerminationType_(
  value
) {
  const text =
    contractRequestText_(
      value
    )
      .toLowerCase()
      .replace(/\s+/g, '');

  if (
    [
      'early_termination',
      'earlytermination',
      '提前解約',
      '提前退租'
    ].indexOf(text) !== -1
  ) {
    return 'early_termination';
  }

  if (
    [
      'non_renewal',
      'nonrenewal',
      '到期不續約',
      '到期退租'
    ].indexOf(text) !== -1
  ) {
    return 'non_renewal';
  }

  return '';
}


function contractRequestTerminationTypeLabel_(
  value
) {
  const type =
    contractRequestNormalizeTerminationType_(
      value
    );

  const map = {
    early_termination:
      '提前解約',
    non_renewal:
      '到期不續約'
  };

  return map[type] || '-';
}


function contractRequestNormalizePenaltyStatus_(
  value
) {
  const text =
    contractRequestText_(
      value
    )
      .toLowerCase()
      .replace(/\s+/g, '');

  const map = {
    pending: 'pending',
    待決定: 'pending',
    charged: 'charged',
    charge: 'charged',
    收取: 'charged',
    收取違約金: 'charged',
    waived: 'waived',
    waive: 'waived',
    免收: 'waived',
    免收違約金: 'waived',
    not_applicable: 'not_applicable',
    notapplicable: 'not_applicable',
    不適用: 'not_applicable'
  };

  return map[text] || '';
}


function contractRequestPenaltyStatusLabel_(
  value
) {
  const status =
    contractRequestNormalizePenaltyStatus_(
      value
    );

  const map = {
    pending: '待房東決定',
    charged: '收取違約金',
    waived: '免收違約金',
    not_applicable: '不適用'
  };

  return map[status] || '-';
}


function contractRequestNormalizeStatus_(
  value
) {
  const text =
    contractRequestText_(
      value
    ).toLowerCase();

  const map = {
    pending: 'pending',
    待處理: 'pending',
    approved: 'approved',
    核准: 'approved',
    已核准: 'approved',
    rejected: 'rejected',
    駁回: 'rejected',
    已駁回: 'rejected',
    cancelled: 'cancelled',
    canceled: 'cancelled',
    已取消: 'cancelled',
    completed: 'completed',
    已完成: 'completed'
  };

  return map[text] || '';
}


function contractRequestNormalizeLandlordAction_(
  value
) {
  const status =
    contractRequestNormalizeStatus_(
      value
    );

  return [
    'approved',
    'rejected',
    'completed'
  ].indexOf(status) !== -1
    ? status
    : '';
}


function contractRequestTypeLabel_(
  value
) {
  const type =
    contractRequestNormalizeType_(
      value
    );

  return type === 'renewal'
    ? '續約申請'
    : type === 'termination'
      ? '解約／退租申請'
      : '合約申請';
}


function contractRequestStatusLabel_(
  value
) {
  const status =
    contractRequestNormalizeStatus_(
      value
    );

  const map = {
    pending: '待房東處理',
    approved: '已核准',
    rejected: '已駁回',
    cancelled: '已取消',
    completed: '已完成'
  };

  return map[status] ||
    contractRequestText_(
      value
    ) ||
    '-';
}


function contractRequestStatusMessage_(
  status
) {
  const map = {
    approved:
      '申請已核准，房客通知已處理',
    rejected:
      '申請已駁回，房客通知已處理',
    completed:
      '申請已標記完成'
  };

  return map[status] ||
    '申請已更新';
}


function contractRequestCanSubmitType_(
  requests,
  requestType
) {
  return !requests.some(
    function (request) {
      return (
        request.request_type ===
          requestType &&
        request.status ===
          'pending'
      );
    }
  );
}


function contractRequestNormalizeDate_(
  value
) {
  const date =
    contractRequestDateObject_(
      value
    );

  return date || '';
}


function contractRequestDateObject_(
  value
) {
  if (
    Object.prototype
      .toString
      .call(value) ===
      '[object Date]' &&
    !isNaN(
      value.getTime()
    )
  ) {
    return value;
  }

  if (
    typeof value === 'number' &&
    isFinite(value) &&
    value > 20000 &&
    value < 100000
  ) {
    return new Date(
      Date.UTC(
        1899,
        11,
        30
      ) +
      value *
      86400000
    );
  }

  const text =
    contractRequestText_(
      value
    );

  if (!text) {
    return null;
  }

  const dateMatch =
    text.match(
      /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/
    );

  if (dateMatch) {
    return new Date(
      Number(dateMatch[1]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[3]),
      12,
      0,
      0
    );
  }

  const parsed =
    new Date(text);

  return isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;
}


function contractRequestTaipeiToday_() {
  const key =
    Utilities.formatDate(
      new Date(),
      'Asia/Taipei',
      'yyyy-MM-dd'
    );

  return new Date(
    key +
    'T00:00:00+08:00'
  );
}


function contractRequestDaysRemaining_(
  endDateValue
) {
  const endDate =
    contractRequestDateObject_(
      endDateValue
    );

  if (!endDate) {
    return 0;
  }

  const endKey =
    Utilities.formatDate(
      endDate,
      'Asia/Taipei',
      'yyyy-MM-dd'
    );

  const end =
    new Date(
      endKey +
      'T00:00:00+08:00'
    );

  const today =
    contractRequestTaipeiToday_();

  return Math.ceil(
    (
      end.getTime() -
      today.getTime()
    ) /
    86400000
  );
}


function contractRequestOptionalNumber_(
  value
) {
  if (
    value === undefined ||
    value === null ||
    contractRequestText_(
      value
    ) === ''
  ) {
    return null;
  }

  const number =
    Number(
      String(value)
        .replace(/,/g, '')
        .replace(/[^\d.-]/g, '')
    );

  return isFinite(number)
    ? number
    : null;
}


function contractRequestBoolean_(
  value
) {
  if (
    value === true ||
    value === 1
  ) {
    return true;
  }

  const text =
    contractRequestText_(
      value
    ).toLowerCase();

  return [
    'true',
    '1',
    'yes',
    'y',
    '是'
  ].indexOf(text) !== -1;
}


function contractRequestAddDays_(
  dateValue,
  days
) {
  const date =
    contractRequestDateObject_(
      dateValue
    );

  if (!date) {
    return null;
  }

  const result =
    new Date(
      date.getTime()
    );

  result.setDate(
    result.getDate() +
    Number(days || 0)
  );

  result.setHours(
    12,
    0,
    0,
    0
  );

  return result;
}


function contractRequestCalculateTermEndDate_(
  startDateValue,
  termMonths
) {
  const startDate =
    contractRequestDateObject_(
      startDateValue
    );

  const months =
    contractRequestInteger_(
      termMonths
    );

  if (
    !startDate ||
    months < 1
  ) {
    return null;
  }

  const result =
    new Date(
      startDate.getFullYear(),
      startDate.getMonth() +
        months,
      startDate.getDate(),
      12,
      0,
      0
    );

  result.setDate(
    result.getDate() - 1
  );

  return result;
}


function contractRequestFormatDate_(
  value
) {
  const date =
    contractRequestDateObject_(
      value
    );

  if (!date) {
    return '-';
  }

  return Utilities.formatDate(
    date,
    'Asia/Taipei',
    'yyyy-MM-dd'
  );
}


function contractRequestMergeNote_(
  original,
  addition
) {
  const parts = [];

  const originalText =
    contractRequestText_(
      original
    );

  const additionText =
    contractRequestText_(
      addition
    );

  if (originalText) {
    parts.push(
      originalText
    );
  }

  if (additionText) {
    parts.push(
      additionText
    );
  }

  return parts.join(
    '｜'
  );
}


function contractRequestFirstValue_(
  object,
  keys
) {
  if (!object) {
    return '';
  }

  for (
    let index = 0;
    index < keys.length;
    index++
  ) {
    const value =
      object[
        keys[index]
      ];

    if (
      value !== undefined &&
      value !== null &&
      value !== ''
    ) {
      return value;
    }
  }

  return '';
}


function contractRequestTimeValue_(
  value
) {
  const date =
    contractRequestDateObject_(
      value
    );

  return date
    ? date.getTime()
    : 0;
}


function contractRequestText_(
  value
) {
  if (
    value === undefined ||
    value === null
  ) {
    return '';
  }

  return String(value).trim();
}


function contractRequestNumber_(
  value
) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return 0;
  }

  const number =
    Number(
      String(value)
        .replace(/,/g, '')
        .replace(/[^\d.-]/g, '')
    );

  return isFinite(number)
    ? number
    : 0;
}


function contractRequestInteger_(
  value
) {
  return Math.round(
    contractRequestNumber_(
      value
    )
  );
}


function contractRequestErrorMessage_(
  error
) {
  return (
    error &&
    error.message
  )
    ? error.message
    : String(error);
}


function contractRequestError_(
  code,
  message,
  data
) {
  return {
    success: false,
    code: code,
    message: message,
    data:
      data || null
  };
}


function contractRequestLogAccess_(
  data
) {
  try {
    if (
      typeof logLiffAccess_ ===
      'function'
    ) {
      logLiffAccess_(
        data
      );
    }
  } catch (error) {
    // 存取紀錄錯誤不影響主流程
  }
}


// ==================================================
// 測試函式
// ==================================================

function testTenantContractInit() {
  const result =
    getTenantContractInitByLineUid_(
      getRequiredScriptProperty_('TEST_TENANT_LINE_UID')
    );

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


function testLandlordContractRequestsInit() {
  const result =
    getLandlordContractRequestsInitByLineUid_(
      getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID')
    );

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/**
 * 測試續約金額與提前解約違約金資料模型。
 * 僅驗證，不寫入資料。
 */
function testContractRequestTermsAndPenaltyModel() {
  const renewal =
    contractRequestValidateRequestData_(
      'renewal',
      {
        requested_term_months: 12,
        requested_rent_amount: 25000,
        requested_management_fee: 600
      },
      {
        start_date: '2023-10-01',
        end_date: '2026-09-30',
        rent_amount: 24000,
        management_fee: 500
      }
    );

  const earlyTermination =
    contractRequestValidateRequestData_(
      'termination',
      {
        termination_type:
          'early_termination',
        move_out_date:
          '2026-08-31'
      },
      {
        start_date: '2023-10-01',
        end_date: '2026-09-30',
        rent_amount: 24000,
        management_fee: 500
      }
    );

  const penaltyApproval =
    contractRequestValidateLandlordApproval_(
      {
        request_type:
          'termination',
        termination_type:
          'early_termination',
        is_early_termination:
          true,
        current_end_date:
          '2026-09-30',
        move_out_date:
          '2026-08-31'
      },
      {
        penalty_status:
          'charged',
        penalty_amount:
          24000,
        penalty_note:
          '依合約收取一個月租金'
      }
    );

  const result = {
    success:
      renewal.success === true &&
      earlyTermination.success === true &&
      penaltyApproval.success === true,
    code: 'OK',
    renewal: renewal,
    early_termination:
      earlyTermination,
    penalty_approval:
      penaltyApproval
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}

