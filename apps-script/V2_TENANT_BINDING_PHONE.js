/**
 * CMWebs V2 房客首次登入綁定
 *
 * Code.gs 路由：
 * - tenant_binding_status
 * - tenant_bind_submit
 */

const V2_TENANT_BINDING_SHEETS_ = {
  tenants: 'V2_tenants',
  users: 'V2_users',
  contracts: 'V2_contracts',
  tenantHomeView: 'V2_tenant_home_view',
  landlordTenantListView: 'V2_landlord_tenant_list_view',
  bindingLogs: 'V2_tenant_binding_logs'
};

const V2_TENANT_BINDING_TIMEZONE_ = 'Asia/Taipei';
const V2_TENANT_BINDING_MAX_FAILURES_ = 5;
const V2_TENANT_BINDING_BLOCK_SECONDS_ = 600;


/**
 * 查詢 LINE 帳號是否已綁定房客。
 */
function getTenantBindingStatusByLineUid_(lineUserId) {
  const action = 'tenant_binding_status';

  try {
    lineUserId = tenantBindingText_(lineUserId);

    if (!lineUserId) {
      return tenantBindingResult_(
        false,
        'MISSING_LINE_UID',
        '缺少 LINE User ID',
        {
          bound: false,
          account_active: false,
          tenant: null
        }
      );
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tenant = tenantBindingResolveByLineUid_(ss, lineUserId);

    if (!tenant) {
      tenantBindingLogAccess_({
        lineUserId,
        userId: '',
        role: 'tenant',
        action,
        targetId: '',
        result: 'success',
        errorMessage: '',
        notes: 'unbound'
      });

      return tenantBindingResult_(
        true,
        'UNBOUND',
        '尚未完成房客綁定',
        {
          bound: false,
          account_active: false,
          tenant: null
        }
      );
    }

    const accountStatus = tenantBindingText_(
      tenant.account_status ||
      tenant.tenant_account_status ||
      tenant.status ||
      'active'
    ).toLowerCase();

    const accountActive = tenantBindingIsActiveStatus_(accountStatus);

    tenantBindingLogAccess_({
      lineUserId,
      userId:
        tenant.user_id ||
        tenant.tenant_user_id ||
        '',
      role: 'tenant',
      action,
      targetId: tenant.tenant_id || '',
      result: 'success',
      errorMessage: '',
      notes:
        accountActive
          ? 'bound'
          : 'bound_account_inactive'
    });

    return tenantBindingResult_(
      true,
      accountActive
        ? 'BOUND'
        : 'BOUND_ACCOUNT_INACTIVE',
      accountActive
        ? '已完成房客綁定'
        : '房客帳號目前不是啟用狀態',
      {
        bound: true,
        account_active: accountActive,
        tenant: {
          tenant_id: tenant.tenant_id || '',
          tenant_name:
            tenant.tenant_name ||
            tenant.name ||
            '',
          room_name:
            tenant.room_name ||
            tenant.room_list ||
            '',
          user_id:
            tenant.user_id ||
            tenant.tenant_user_id ||
            '',
          account_status: accountStatus,
          bound_at:
            tenant.bound_at ||
            tenant.binding_at ||
            ''
        }
      }
    );

  } catch (error) {
    tenantBindingLogAccess_({
      lineUserId: lineUserId || '',
      userId: '',
      role: 'tenant',
      action,
      targetId: '',
      result: 'failed',
      errorMessage: error.message
    });

    return tenantBindingResult_(
      false,
      'SYSTEM_ERROR',
      '系統錯誤：' + error.message,
      {
        bound: false,
        account_active: false,
        tenant: null
      }
    );
  }
}


/**
 * 房客首次登入綁定。
 */
function bindTenantByLineUid_(lineUserId, phoneNumber) {
  const action = 'tenant_bind_submit';
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    lineUserId = tenantBindingText_(lineUserId);
    phoneNumber = tenantBindingNormalizePhone_(phoneNumber);

    if (!lineUserId) {
      return tenantBindingResult_(
        false,
        'MISSING_LINE_UID',
        '缺少 LINE User ID'
      );
    }

    if (!/^09\d{8}$/.test(phoneNumber)) {
      tenantBindingRecordFailure_(lineUserId);

      return tenantBindingResult_(
        false,
        'INVALID_PHONE_NUMBER',
        '請輸入正確的台灣手機號碼，例如 0912345678'
      );
    }

    const failureCount = tenantBindingFailureCount_(lineUserId);

    if (failureCount >= V2_TENANT_BINDING_MAX_FAILURES_) {
      tenantBindingWriteLog_({
        line_user_id: lineUserId,
        tenant_id: '',
        result: 'blocked',
        code: 'TOO_MANY_ATTEMPTS',
        message: '驗證失敗次數過多',
        note: 'failure_count=' + failureCount
      });

      return tenantBindingResult_(
        false,
        'TOO_MANY_ATTEMPTS',
        '驗證失敗次數過多，請 10 分鐘後再試'
      );
    }

    lock.waitLock(15000);
    locked = true;

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const boundTenant = tenantBindingResolveByLineUid_(
      ss,
      lineUserId
    );

    if (boundTenant) {
      tenantBindingClearFailures_(lineUserId);

      return tenantBindingResult_(
        true,
        'ALREADY_BOUND',
        '此 LINE 帳號已完成房客綁定',
        {
          tenant_id: boundTenant.tenant_id || '',
          tenant_name:
            boundTenant.tenant_name ||
            boundTenant.name ||
            '',
          room_name:
            boundTenant.room_name ||
            boundTenant.room_list ||
            ''
        }
      );
    }

    const tenantSheet = ss.getSheetByName(
      V2_TENANT_BINDING_SHEETS_.tenants
    );

    if (!tenantSheet) {
      return tenantBindingResult_(
        false,
        'TENANT_SHEET_NOT_FOUND',
        '找不到 V2_tenants 工作表'
      );
    }

    const tenantRows = tenantBindingGetObjectsWithRow_(
      tenantSheet
    );

    const userRows = tenantBindingGetOptionalObjects_(
      ss,
      V2_TENANT_BINDING_SHEETS_.users
    );

    const listRows = tenantBindingGetOptionalObjects_(
      ss,
      V2_TENANT_BINDING_SHEETS_.landlordTenantListView
    );

    const usersById = {};

    userRows.forEach(function (row) {
      const userId = tenantBindingText_(
        row.user_id
      );

      if (userId) {
        usersById[userId] = row;
      }
    });

    const listByTenantId = {};

    listRows.forEach(function (row) {
      const tenantId = tenantBindingText_(
        row.tenant_id
      ).toUpperCase();

      if (tenantId && !listByTenantId[tenantId]) {
        listByTenantId[tenantId] = row;
      }
    });

    const matchedTenants = tenantRows.filter(function (tenant) {
      const userId = tenantBindingText_(
        tenant.tenant_user_id ||
        tenant.user_id
      );

      const tenantId = tenantBindingText_(
        tenant.tenant_id
      ).toUpperCase();

      const registeredPhone =
        tenantBindingResolveRegisteredPhone_(
          tenant,
          usersById[userId] || {},
          listByTenantId[tenantId] || {}
        );

      return registeredPhone === phoneNumber;
    });

    if (matchedTenants.length === 0) {
      tenantBindingRecordFailure_(lineUserId);

      tenantBindingWriteLog_({
        line_user_id: lineUserId,
        tenant_id: '',
        result: 'failed',
        code: 'PHONE_NOT_FOUND',
        message: '查無符合的房客資料',
        note:
          'phone=' +
          tenantBindingMaskPhone_(phoneNumber)
      });

      return tenantBindingResult_(
        false,
        'PHONE_NOT_FOUND',
        '查無符合的房客資料，請確認手機號碼是否與租約登記資料一致'
      );
    }

    if (matchedTenants.length > 1) {
      tenantBindingWriteLog_({
        line_user_id: lineUserId,
        tenant_id: '',
        result: 'failed',
        code: 'MULTIPLE_TENANTS_FOUND',
        message: '同一手機號碼對應多筆房客資料',
        note:
          'matches=' +
          matchedTenants.length +
          ', phone=' +
          tenantBindingMaskPhone_(phoneNumber)
      });

      return tenantBindingResult_(
        false,
        'MULTIPLE_TENANTS_FOUND',
        '此手機號碼對應多筆租屋資料，請聯絡房東協助綁定'
      );
    }

    const tenant = matchedTenants[0];
    const tenantId = tenantBindingText_(
      tenant.tenant_id
    ).toUpperCase();

    const accountStatus = tenantBindingText_(
      tenant.account_status ||
      tenant.tenant_account_status ||
      tenant.status ||
      'active'
    ).toLowerCase();

    if (!tenantBindingIsActiveStatus_(accountStatus)) {
      tenantBindingWriteLog_({
        line_user_id: lineUserId,
        tenant_id: tenantId,
        result: 'failed',
        code: 'ACCOUNT_NOT_ACTIVE',
        message: '房客帳號未啟用'
      });

      return tenantBindingResult_(
        false,
        'ACCOUNT_NOT_ACTIVE',
        '房客帳號目前不是啟用狀態，請聯絡房東'
      );
    }

    const existingTenantLineUserId = tenantBindingText_(
      tenant.tenant_line_user_id ||
      tenant.line_user_id
    );

    if (
      existingTenantLineUserId &&
      existingTenantLineUserId !== lineUserId
    ) {
      tenantBindingWriteLog_({
        line_user_id: lineUserId,
        tenant_id: tenantId,
        result: 'failed',
        code: 'TENANT_ALREADY_BOUND',
        message: '此房客已綁定其他 LINE 帳號'
      });

      return tenantBindingResult_(
        false,
        'TENANT_ALREADY_BOUND',
        '此房客已綁定其他 LINE 帳號，請聯絡房東解除原綁定'
      );
    }

    const duplicateLineTenant = tenantRows.find(function (row) {
      const rowLineUserId = tenantBindingText_(
        row.tenant_line_user_id ||
        row.line_user_id
      );

      const rowTenantId = tenantBindingText_(
        row.tenant_id
      ).toUpperCase();

      return (
        rowLineUserId === lineUserId &&
        rowTenantId !== tenantId
      );
    });

    if (duplicateLineTenant) {
      return tenantBindingResult_(
        false,
        'LINE_ALREADY_BOUND',
        '此 LINE 帳號已綁定其他房客，請聯絡房東'
      );
    }

    const activeContract = tenantBindingResolveActiveContract_(
      ss,
      tenant
    );

    if (!activeContract) {
      tenantBindingWriteLog_({
        line_user_id: lineUserId,
        tenant_id: tenantId,
        result: 'failed',
        code: 'ACTIVE_CONTRACT_NOT_FOUND',
        message: '找不到有效合約'
      });

      return tenantBindingResult_(
        false,
        'ACTIVE_CONTRACT_NOT_FOUND',
        '目前找不到有效或尚未到期的租賃合約，請聯絡房東'
      );
    }

    const now = new Date();

    tenantBindingUpdateTenantRow_(
      tenantSheet,
      tenant.__row_number,
      lineUserId,
      now
    );

    tenantBindingUpdateUserRowIfPresent_(
      ss,
      tenant,
      lineUserId,
      now
    );

    tenantBindingSyncLineUidAcrossData_(
      ss,
      tenant,
      activeContract,
      lineUserId,
      now
    );

    SpreadsheetApp.flush();
    tenantBindingClearFailures_(lineUserId);

    const roomName = tenantBindingText_(
      tenant.room_name ||
      tenant.room_list ||
      activeContract.room_name ||
      activeContract.room_id
    );

    tenantBindingWriteLog_({
      line_user_id: lineUserId,
      tenant_id: tenantId,
      tenant_name:
        tenant.tenant_name ||
        tenant.name ||
        '',
      room_name: roomName,
      result: 'success',
      code: 'BOUND',
      message: '房客綁定成功',
      note:
        'contract_id=' +
        tenantBindingText_(
          activeContract.contract_id
        ) +
        ', phone=' +
        tenantBindingMaskPhone_(phoneNumber)
    });

    tenantBindingLogAccess_({
      lineUserId,
      userId:
        tenant.tenant_user_id ||
        tenant.user_id ||
        '',
      role: 'tenant',
      action,
      targetId: tenantId,
      result: 'success',
      errorMessage: '',
      notes: 'phone binding completed'
    });

    return tenantBindingResult_(
      true,
      'BOUND',
      '房客綁定成功',
      {
        tenant_id: tenantId,
        tenant_name:
          tenant.tenant_name ||
          tenant.name ||
          '',
        room_name: roomName,
        contract_id:
          activeContract.contract_id ||
          '',
        bound_at: now
      }
    );

  } catch (error) {
    tenantBindingWriteLog_({
      line_user_id: lineUserId || '',
      tenant_id: '',
      result: 'failed',
      code: 'SYSTEM_ERROR',
      message: error.message
    });

    tenantBindingLogAccess_({
      lineUserId: lineUserId || '',
      userId: '',
      role: 'tenant',
      action,
      targetId: '',
      result: 'failed',
      errorMessage: error.message
    });

    return tenantBindingResult_(
      false,
      'SYSTEM_ERROR',
      '系統錯誤：' + error.message
    );

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


/**
 * 讀取可選工作表；不存在時回傳空陣列。
 */
function tenantBindingGetOptionalObjects_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);

  return sheet
    ? tenantBindingGetObjectsWithRow_(sheet)
    : [];
}


/**
 * 從房客、使用者或房客清單中取得登記手機號碼。
 */
function tenantBindingResolveRegisteredPhone_(
  tenant,
  user,
  tenantListRow
) {
  const candidates = [
    tenant.tenant_phone,
    tenant.phone,
    tenant.mobile,
    tenant.mobile_phone,
    tenant.contact_phone,

    user.tenant_phone,
    user.phone,
    user.mobile,
    user.mobile_phone,
    user.contact_phone,

    tenantListRow.tenant_phone,
    tenantListRow.phone,
    tenantListRow.mobile,
    tenantListRow.mobile_phone,
    tenantListRow.contact_phone
  ];

  for (let index = 0; index < candidates.length; index++) {
    const normalized = tenantBindingNormalizePhone_(
      candidates[index]
    );

    if (normalized) {
      return normalized;
    }
  }

  return '';
}


/**
 * 台灣手機號碼正規化。
 *
 * 支援：
 * - 0912345678
 * - 912345678
 * - 886912345678
 * - +886 912 345 678
 */
function tenantBindingNormalizePhone_(value) {
  let digits = tenantBindingDigits_(value);

  if (!digits) {
    return '';
  }

  if (
    digits.indexOf('8860') === 0 &&
    digits.length === 13
  ) {
    digits =
      '0' +
      digits.slice(4);
  } else if (
    digits.indexOf('886') === 0 &&
    digits.length === 12
  ) {
    digits =
      '0' +
      digits.slice(3);
  } else if (
    digits.length === 9 &&
    digits.charAt(0) === '9'
  ) {
    digits =
      '0' +
      digits;
  }

  return digits;
}


function tenantBindingMaskPhone_(phoneNumber) {
  const phone = tenantBindingNormalizePhone_(
    phoneNumber
  );

  if (phone.length !== 10) {
    return '';
  }

  return (
    phone.slice(0, 2) +
    '******' +
    phone.slice(-2)
  );
}



/**
 * 依 LINE UID 找房客。
 */
function tenantBindingResolveByLineUid_(ss, lineUserId) {
  const sheetNames = [
    V2_TENANT_BINDING_SHEETS_.tenantHomeView,
    V2_TENANT_BINDING_SHEETS_.landlordTenantListView,
    V2_TENANT_BINDING_SHEETS_.tenants
  ];

  for (let i = 0; i < sheetNames.length; i++) {
    const sheet = ss.getSheetByName(sheetNames[i]);

    if (!sheet) {
      continue;
    }

    const row = tenantBindingGetObjectsWithRow_(sheet).find(
      function (item) {
        return (
          tenantBindingText_(
            item.tenant_line_user_id ||
            item.line_user_id
          ) === lineUserId
        );
      }
    );

    if (row) {
      return row;
    }
  }

  return null;
}


/**
 * 找有效或尚未到期合約。
 */
function tenantBindingResolveActiveContract_(ss, tenant) {
  const sheet = ss.getSheetByName(
    V2_TENANT_BINDING_SHEETS_.contracts
  );

  if (!sheet) {
    return null;
  }

  const tenantId = tenantBindingText_(tenant.tenant_id).toUpperCase();
  const roomId = tenantBindingText_(tenant.room_id);

  const rows = tenantBindingGetObjectsWithRow_(sheet)
    .filter(function (row) {
      const rowTenantId = tenantBindingText_(row.tenant_id).toUpperCase();
      const rowRoomId = tenantBindingText_(row.room_id);

      return (
        rowTenantId === tenantId &&
        (
          !roomId ||
          !rowRoomId ||
          rowRoomId === roomId
        )
      );
    })
    .filter(tenantBindingContractIsUsable_);

  rows.sort(function (a, b) {
    return (
      tenantBindingTimeValue_(
        b.end_date ||
        b.contract_end_date ||
        b.lease_end_date ||
        b.updated_at
      ) -
      tenantBindingTimeValue_(
        a.end_date ||
        a.contract_end_date ||
        a.lease_end_date ||
        a.updated_at
      )
    );
  });

  return rows[0] || null;
}


function tenantBindingContractIsUsable_(contract) {
  const status = tenantBindingText_(
    contract.contract_status ||
    contract.status ||
    contract.account_status
  ).toLowerCase();

  if (
    [
      'active',
      'valid',
      'current',
      'enabled',
      '啟用',
      '有效'
    ].indexOf(status) >= 0
  ) {
    return true;
  }

  const endDate = tenantBindingDateObject_(
    contract.end_date ||
    contract.contract_end_date ||
    contract.lease_end_date
  );

  if (!endDate) {
    return false;
  }

  return (
    endDate.getTime() >=
    tenantBindingTaipeiToday_().getTime()
  );
}


/**
 * 寫入 V2_tenants。
 */
function tenantBindingUpdateTenantRow_(
  sheet,
  rowNumber,
  lineUserId,
  now
) {
  const map = tenantBindingHeaderMap_(sheet);
  const lineHeaders = [
    'tenant_line_user_id',
    'line_user_id'
  ];

  let hasLineHeader = false;

  lineHeaders.forEach(function (header) {
    if (map[header] !== undefined) {
      sheet
        .getRange(rowNumber, map[header] + 1)
        .setValue(lineUserId);

      hasLineHeader = true;
    }
  });

  if (!hasLineHeader) {
    const column = tenantBindingEnsureHeader_(
      sheet,
      'tenant_line_user_id'
    );

    sheet.getRange(rowNumber, column).setValue(lineUserId);
  }

  tenantBindingSetFirstExistingOrCreate_(
    sheet,
    rowNumber,
    [
      'tenant_binding_status',
      'binding_status'
    ],
    'tenant_binding_status',
    'bound'
  );

  tenantBindingSetFirstExistingOrCreate_(
    sheet,
    rowNumber,
    [
      'bound_at',
      'binding_at',
      'line_bound_at'
    ],
    'bound_at',
    now
  );

  tenantBindingSetFirstExistingOrCreate_(
    sheet,
    rowNumber,
    [
      'updated_at',
      'last_updated_at'
    ],
    'updated_at',
    now
  );
}


/**
 * V2_users 存在時同步 LINE UID。
 */
function tenantBindingUpdateUserRowIfPresent_(
  ss,
  tenant,
  lineUserId,
  now
) {
  const sheet = ss.getSheetByName(
    V2_TENANT_BINDING_SHEETS_.users
  );

  if (!sheet) {
    return;
  }

  const userId = tenantBindingText_(
    tenant.tenant_user_id ||
    tenant.user_id
  );

  if (!userId) {
    return;
  }

  const rows = tenantBindingGetObjectsWithRow_(sheet);

  const user = rows.find(function (row) {
    return tenantBindingText_(row.user_id) === userId;
  });

  if (!user) {
    return;
  }

  const duplicate = rows.find(function (row) {
    return (
      tenantBindingText_(row.line_user_id) === lineUserId &&
      tenantBindingText_(row.user_id) !== userId
    );
  });

  if (duplicate) {
    throw new Error(
      '此 LINE 帳號已綁定其他系統使用者'
    );
  }

  tenantBindingSetFirstExistingOrCreate_(
    sheet,
    user.__row_number,
    [
      'line_user_id',
      'tenant_line_user_id'
    ],
    'line_user_id',
    lineUserId
  );

  tenantBindingSetFirstExistingOrCreate_(
    sheet,
    user.__row_number,
    [
      'binding_status',
      'tenant_binding_status'
    ],
    'binding_status',
    'bound'
  );

  tenantBindingSetFirstExistingOrCreate_(
    sheet,
    user.__row_number,
    [
      'bound_at',
      'binding_at'
    ],
    'bound_at',
    now
  );

  tenantBindingSetFirstExistingOrCreate_(
    sheet,
    user.__row_number,
    [
      'updated_at',
      'last_updated_at'
    ],
    'updated_at',
    now
  );
}


/**
 * 綁定完成後同步所有 V2 view 與營運資料。
 *
 * landlord tenant list 的 line_user_id 是房東查詢鍵，不可覆蓋；
 * 該表只更新 tenant_line_user_id。
 */
function tenantBindingSyncLineUidAcrossData_(
  ss,
  tenant,
  activeContract,
  lineUserId,
  now
) {
  const tenantId =
    tenantBindingText_(
      tenant.tenant_id
    ).toUpperCase();

  const tenantUserId =
    tenantBindingText_(
      tenant.tenant_user_id ||
      tenant.user_id
    );

  const contractId =
    tenantBindingText_(
      activeContract &&
      activeContract.contract_id
        ? activeContract.contract_id
        : ''
    );

  const configs = [
    {
      sheet_name:
        V2_TENANT_BINDING_SHEETS_
          .tenantHomeView,
      set_line_user_id:
        true,
      set_tenant_line_user_id:
        true,
      set_binding_status:
        true
    },
    {
      sheet_name:
        'V2_tenant_bill_view',
      set_line_user_id:
        true,
      set_tenant_line_user_id:
        true,
      set_binding_status:
        false
    },
    {
      sheet_name:
        V2_TENANT_BINDING_SHEETS_
          .landlordTenantListView,
      set_line_user_id:
        false,
      set_tenant_line_user_id:
        true,
      set_binding_status:
        true
    },
    {
      sheet_name:
        V2_TENANT_BINDING_SHEETS_
          .contracts,
      set_line_user_id:
        false,
      set_tenant_line_user_id:
        true,
      set_binding_status:
        false
    },
    {
      sheet_name:
        'V2_bills',
      set_line_user_id:
        false,
      set_tenant_line_user_id:
        true,
      set_binding_status:
        false
    },
    {
      sheet_name:
        'V2_payment_reports',
      set_line_user_id:
        false,
      set_tenant_line_user_id:
        true,
      set_binding_status:
        false
    },
    {
      sheet_name:
        'V2_tenant_messages',
      set_line_user_id:
        false,
      set_tenant_line_user_id:
        true,
      set_binding_status:
        false
    }
  ];

  configs.forEach(
    function (config) {
      const sheet =
        ss.getSheetByName(
          config.sheet_name
        );

      if (
        !sheet ||
        sheet.getLastRow() < 2
      ) {
        return;
      }

      const rows =
        tenantBindingGetObjectsWithRow_(
          sheet
        );

      rows.forEach(
        function (row) {
          const rowTenantId =
            tenantBindingText_(
              row.tenant_id
            ).toUpperCase();

          const rowTenantUserId =
            tenantBindingText_(
              row.tenant_user_id ||
              row.user_id
            );

          const rowContractId =
            tenantBindingText_(
              row.contract_id ||
              row.current_contract_id
            );

          const matchesTenant =
            tenantId &&
            rowTenantId ===
              tenantId;

          const matchesUser =
            !matchesTenant &&
            tenantUserId &&
            rowTenantUserId ===
              tenantUserId;

          const matchesContract =
            !matchesTenant &&
            !matchesUser &&
            contractId &&
            rowContractId ===
              contractId;

          if (
            !matchesTenant &&
            !matchesUser &&
            !matchesContract
          ) {
            return;
          }

          if (
            config.set_line_user_id
          ) {
            tenantBindingSetFirstExistingOrCreate_(
              sheet,
              row.__row_number,
              [
                'line_user_id'
              ],
              'line_user_id',
              lineUserId
            );
          }

          if (
            config
              .set_tenant_line_user_id
          ) {
            tenantBindingSetFirstExistingOrCreate_(
              sheet,
              row.__row_number,
              [
                'tenant_line_user_id'
              ],
              'tenant_line_user_id',
              lineUserId
            );
          }

          if (
            config.set_binding_status
          ) {
            tenantBindingSetFirstExistingOrCreate_(
              sheet,
              row.__row_number,
              [
                'tenant_binding_status',
                'binding_status'
              ],
              'tenant_binding_status',
              'bound'
            );

            tenantBindingSetFirstExistingOrCreate_(
              sheet,
              row.__row_number,
              [
                'bound_at',
                'binding_at',
                'line_bound_at'
              ],
              'bound_at',
              now
            );
          }

          tenantBindingSetFirstExistingOrCreate_(
            sheet,
            row.__row_number,
            [
              'updated_at',
              'last_updated_at'
            ],
            'updated_at',
            now
          );
        }
      );
    }
  );
}


/**
 * 綁定紀錄。
 */
function tenantBindingWriteLog_(record) {
  try {
    const sheet = tenantBindingEnsureLogSheet_();
    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0]
      .map(tenantBindingText_);

    const data = Object.assign(
      {
        log_id: tenantBindingMakeLogId_(),
        created_at: new Date(),
        line_user_id: '',
        tenant_id: '',
        tenant_name: '',
        room_name: '',
        result: '',
        code: '',
        message: '',
        note: ''
      },
      record || {}
    );

    sheet.appendRow(
      headers.map(function (header) {
        return (
          data[header] !== undefined
            ? data[header]
            : ''
        );
      })
    );

  } catch (error) {
    // 紀錄失敗不影響綁定。
  }
}


function tenantBindingEnsureLogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(
    V2_TENANT_BINDING_SHEETS_.bindingLogs
  );

  const headers = [
    'log_id',
    'created_at',
    'line_user_id',
    'tenant_id',
    'tenant_name',
    'room_name',
    'result',
    'code',
    'message',
    'note'
  ];

  if (!sheet) {
    sheet = ss.insertSheet(
      V2_TENANT_BINDING_SHEETS_.bindingLogs
    );

    sheet
      .getRange(1, 1, 1, headers.length)
      .setValues([headers]);

    return sheet;
  }

  headers.forEach(function (header) {
    tenantBindingEnsureHeader_(sheet, header);
  });

  return sheet;
}


/**
 * 驗證失敗限制。
 */
function tenantBindingFailureCount_(lineUserId) {
  return Number(
    CacheService
      .getScriptCache()
      .get(tenantBindingFailureKey_(lineUserId)) ||
    0
  );
}


function tenantBindingRecordFailure_(lineUserId) {
  const cache = CacheService.getScriptCache();
  const key = tenantBindingFailureKey_(lineUserId);
  const count = Number(cache.get(key) || 0) + 1;

  cache.put(
    key,
    String(count),
    V2_TENANT_BINDING_BLOCK_SECONDS_
  );
}


function tenantBindingClearFailures_(lineUserId) {
  CacheService
    .getScriptCache()
    .remove(
      tenantBindingFailureKey_(lineUserId)
    );
}


function tenantBindingFailureKey_(lineUserId) {
  return (
    'tenant_bind_fail_' +
    tenantBindingText_(lineUserId).slice(-24)
  );
}


/**
 * 工作表工具。
 */
function tenantBindingGetObjectsWithRow_(sheet) {
  if (
    !sheet ||
    sheet.getLastRow() < 2 ||
    sheet.getLastColumn() < 1
  ) {
    return [];
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(tenantBindingText_);

  return values.slice(1).map(function (row, index) {
    const object = {
      __row_number: index + 2
    };

    headers.forEach(function (header, column) {
      if (header) {
        object[header] = row[column];
      }
    });

    return object;
  });
}


function tenantBindingHeaderMap_(sheet) {
  const headers = sheet
    .getRange(
      1,
      1,
      1,
      Math.max(sheet.getLastColumn(), 1)
    )
    .getValues()[0];

  const map = {};

  headers.forEach(function (header, index) {
    const key = tenantBindingText_(header);

    if (key) {
      map[key] = index;
    }
  });

  return map;
}


function tenantBindingEnsureHeader_(sheet, header) {
  const map = tenantBindingHeaderMap_(sheet);

  if (map[header] !== undefined) {
    return map[header] + 1;
  }

  const column = sheet.getLastColumn() + 1;
  sheet.getRange(1, column).setValue(header);

  return column;
}


function tenantBindingSetFirstExistingOrCreate_(
  sheet,
  rowNumber,
  candidates,
  createHeader,
  value
) {
  const map = tenantBindingHeaderMap_(sheet);

  const existing = candidates.find(function (header) {
    return map[header] !== undefined;
  });

  const column = existing
    ? map[existing] + 1
    : tenantBindingEnsureHeader_(
        sheet,
        createHeader
      );

  sheet.getRange(rowNumber, column).setValue(value);
}


/**
 * 一般工具。
 */
function tenantBindingText_(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return '';
  }

  return String(value).trim();
}


function tenantBindingDigits_(value) {
  return tenantBindingText_(value).replace(/\D/g, '');
}


function tenantBindingIsActiveStatus_(status) {
  return (
    [
      'active',
      'enabled',
      'valid',
      'current',
      '啟用',
      '有效'
    ].indexOf(
      tenantBindingText_(status).toLowerCase()
    ) >= 0
  );
}


function tenantBindingDateObject_(value) {
  if (
    value instanceof Date &&
    !Number.isNaN(value.getTime())
  ) {
    return value;
  }

  const text = tenantBindingText_(value);

  if (!text) {
    return null;
  }

  const exact = text.match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (exact) {
    return new Date(
      Number(exact[1]),
      Number(exact[2]) - 1,
      Number(exact[3]),
      0,
      0,
      0,
      0
    );
  }

  const date = new Date(text);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}


function tenantBindingTaipeiToday_() {
  return tenantBindingDateObject_(
    Utilities.formatDate(
      new Date(),
      V2_TENANT_BINDING_TIMEZONE_,
      'yyyy-MM-dd'
    )
  );
}


function tenantBindingTimeValue_(value) {
  const date = tenantBindingDateObject_(value);
  return date ? date.getTime() : 0;
}


function tenantBindingMakeLogId_() {
  return (
    'TBL-' +
    Utilities.formatDate(
      new Date(),
      V2_TENANT_BINDING_TIMEZONE_,
      'yyyyMMddHHmmss'
    ) +
    '-' +
    Math.floor(1000 + Math.random() * 9000)
  );
}


function tenantBindingResult_(success, code, message, data) {
  return {
    success: success === true,
    code: code || '',
    message: message || '',
    data:
      data === undefined
        ? null
        : data
  };
}


function tenantBindingLogAccess_(payload) {
  if (typeof logLiffAccess_ === 'function') {
    try {
      logLiffAccess_(payload);
    } catch (error) {
      // 不影響主要流程。
    }
  }
}


// ==================================================
// Existing binding diagnosis and repair
// ==================================================

function diagnoseAllTenantLineBindings_() {
  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const index =
    tenantBindingBuildLineCandidateIndex_(
      ss
    );

  const tenantSheet =
    ss.getSheetByName(
      V2_TENANT_BINDING_SHEETS_
        .tenants
    );

  if (!tenantSheet) {
    return {
      success:
        false,
      code:
        'TENANT_SHEET_NOT_FOUND',
      message:
        '找不到 V2_tenants'
    };
  }

  const tenants =
    tenantBindingGetObjectsWithRow_(
      tenantSheet
    );

  const rows =
    tenants.map(
      function (tenant) {
        const tenantId =
          tenantBindingText_(
            tenant.tenant_id
          ).toUpperCase();

        const tenantUserId =
          tenantBindingText_(
            tenant.tenant_user_id ||
            tenant.user_id
          );

        const candidates =
          tenantBindingResolveLineCandidates_(
            index,
            tenantId,
            tenantUserId
          );

        return {
          tenant_id:
            tenantId,
          tenant_name:
            tenantBindingText_(
              tenant.tenant_name ||
              tenant.name
            ),
          tenant_phone:
            tenantBindingText_(
              tenant.tenant_phone ||
              tenant.phone
            ),
          room_list:
            tenantBindingResolveTenantRoomList_(
              index,
              tenantId
            ),
          current_tenant_line_user_id:
            tenantBindingText_(
              tenant.tenant_line_user_id ||
              tenant.line_user_id
            ),
          candidate_count:
            candidates.length,
          candidate_line_user_ids:
            candidates,
          status:
            candidates.length ===
              0
              ? 'unbound'
              : (
                  candidates.length ===
                    1
                    ? 'resolvable'
                    : 'conflict'
                )
        };
      }
    );

  const result = {
    success:
      true,
    tenant_count:
      rows.length,
    resolvable_count:
      rows.filter(
        function (row) {
          return (
            row.status ===
            'resolvable'
          );
        }
      ).length,
    unbound_count:
      rows.filter(
        function (row) {
          return (
            row.status ===
            'unbound'
          );
        }
      ).length,
    conflict_count:
      rows.filter(
        function (row) {
          return (
            row.status ===
            'conflict'
          );
        }
      ).length,
    tenants:
      rows
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


function repairAllTenantLineBindings_() {
  const lock =
    LockService.getScriptLock();

  let locked =
    false;

  try {
    lock.waitLock(
      25000
    );

    locked =
      true;

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const index =
      tenantBindingBuildLineCandidateIndex_(
        ss
      );

    const tenantSheet =
      ss.getSheetByName(
        V2_TENANT_BINDING_SHEETS_
          .tenants
      );

    if (!tenantSheet) {
      return {
        success:
          false,
        code:
          'TENANT_SHEET_NOT_FOUND',
        message:
          '找不到 V2_tenants'
      };
    }

    const tenants =
      tenantBindingGetObjectsWithRow_(
        tenantSheet
      );

    const repaired = [];
    const unbound = [];
    const conflicts = [];

    tenants.forEach(
      function (tenant) {
        const tenantId =
          tenantBindingText_(
            tenant.tenant_id
          ).toUpperCase();

        const tenantUserId =
          tenantBindingText_(
            tenant.tenant_user_id ||
            tenant.user_id
          );

        const candidates =
          tenantBindingResolveLineCandidates_(
            index,
            tenantId,
            tenantUserId
          );

        const roomList =
          tenantBindingResolveTenantRoomList_(
            index,
            tenantId
          );

        if (
          candidates.length ===
          0
        ) {
          unbound.push({
            tenant_id:
              tenantId,
            tenant_name:
              tenantBindingText_(
                tenant.tenant_name ||
                tenant.name
              ),
            room_list:
              roomList
          });

          return;
        }

        if (
          candidates.length >
          1
        ) {
          conflicts.push({
            tenant_id:
              tenantId,
            tenant_name:
              tenantBindingText_(
                tenant.tenant_name ||
                tenant.name
              ),
            room_list:
              roomList,
            candidate_line_user_ids:
              candidates
          });

          return;
        }

        const lineUserId =
          candidates[0];

        const now =
          new Date();

        tenantBindingUpdateTenantRow_(
          tenantSheet,
          tenant.__row_number,
          lineUserId,
          now
        );

        tenantBindingUpdateUserRowIfPresent_(
          ss,
          tenant,
          lineUserId,
          now
        );

        const activeContract =
          tenantBindingResolveBestContractForTenant_(
            index,
            tenantId
          );

        tenantBindingSyncLineUidAcrossData_(
          ss,
          tenant,
          activeContract ||
          {},
          lineUserId,
          now
        );

        repaired.push({
          tenant_id:
            tenantId,
          tenant_name:
            tenantBindingText_(
              tenant.tenant_name ||
              tenant.name
            ),
          room_list:
            roomList,
          tenant_line_user_id:
            lineUserId
        });
      }
    );

    SpreadsheetApp.flush();

    const result = {
      success:
        conflicts.length ===
        0,
      code:
        conflicts.length ===
          0
          ? 'TENANT_BINDINGS_REPAIRED'
          : 'TENANT_BINDINGS_PARTIAL',
      message:
        conflicts.length ===
          0
          ? '房客 LINE 綁定資料已同步'
          : '部分房客存在多個 LINE UID，未自動覆蓋',
      repaired_count:
        repaired.length,
      unbound_count:
        unbound.length,
      conflict_count:
        conflicts.length,
      repaired:
        repaired,
      unbound:
        unbound,
      conflicts:
        conflicts
    };

    Logger.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return result;

  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


function tenantBindingBuildLineCandidateIndex_(
  ss
) {
  const sheetNames = [
    V2_TENANT_BINDING_SHEETS_
      .tenants,
    V2_TENANT_BINDING_SHEETS_
      .users,
    V2_TENANT_BINDING_SHEETS_
      .contracts,
    V2_TENANT_BINDING_SHEETS_
      .tenantHomeView,
    V2_TENANT_BINDING_SHEETS_
      .landlordTenantListView,
    'V2_tenant_bill_view',
    'V2_bills',
    'V2_payment_reports',
    'V2_tenant_messages'
  ];

  const index = {
    tenant_candidates:
      {},
    user_candidates:
      {},
    contracts_by_tenant:
      {},
    room_names_by_tenant:
      {}
  };

  sheetNames.forEach(
    function (sheetName) {
      const sheet =
        ss.getSheetByName(
          sheetName
        );

      if (
        !sheet ||
        sheet.getLastRow() <
        2
      ) {
        return;
      }

      const rows =
        tenantBindingGetObjectsWithRow_(
          sheet
        );

      rows.forEach(
        function (row) {
          const tenantId =
            tenantBindingText_(
              row.tenant_id
            ).toUpperCase();

          const tenantUserId =
            tenantBindingText_(
              row.tenant_user_id ||
              (
                sheetName ===
                  V2_TENANT_BINDING_SHEETS_
                    .users
                  ? row.user_id
                  : ''
              )
            );

          const contractId =
            tenantBindingText_(
              row.contract_id ||
              row.current_contract_id
            );

          const lineCandidates = [];

          function addLine(
            value
          ) {
            value =
              tenantBindingText_(
                value
              );

            if (
              tenantBindingLooksLikeLineUid_(
                value
              ) &&
              lineCandidates.indexOf(
                value
              ) <
              0
            ) {
              lineCandidates.push(
                value
              );
            }
          }

          if (
            sheetName ===
            V2_TENANT_BINDING_SHEETS_
              .landlordTenantListView
          ) {
            addLine(
              row.tenant_line_user_id
            );
          } else if (
            sheetName ===
              V2_TENANT_BINDING_SHEETS_
                .contracts ||
            sheetName ===
              'V2_bills' ||
            sheetName ===
              'V2_payment_reports' ||
            sheetName ===
              'V2_tenant_messages'
          ) {
            addLine(
              row.tenant_line_user_id
            );
          } else {
            addLine(
              row.tenant_line_user_id
            );
            addLine(
              row.line_user_id
            );
          }

          lineCandidates.forEach(
            function (lineUserId) {
              if (tenantId) {
                tenantBindingIndexAdd_(
                  index
                    .tenant_candidates,
                  tenantId,
                  lineUserId
                );
              }

              if (tenantUserId) {
                tenantBindingIndexAdd_(
                  index
                    .user_candidates,
                  tenantUserId,
                  lineUserId
                );
              }
            }
          );

          if (
            tenantId &&
            (
              sheetName ===
                V2_TENANT_BINDING_SHEETS_
                  .contracts ||
              contractId
            )
          ) {
            if (
              !index
                .contracts_by_tenant[
                  tenantId
                ]
            ) {
              index
                .contracts_by_tenant[
                  tenantId
                ] = [];
            }

            index
              .contracts_by_tenant[
                tenantId
              ].push(
                row
              );
          }

          if (tenantId) {
            const roomName =
              tenantBindingText_(
                row.room_name ||
                row.room_list
              );

            if (roomName) {
              tenantBindingIndexAdd_(
                index
                  .room_names_by_tenant,
                tenantId,
                roomName
              );
            }
          }
        }
      );
    }
  );

  return index;
}


function tenantBindingResolveLineCandidates_(
  index,
  tenantId,
  tenantUserId
) {
  const values = [];

  function addAll(
    list
  ) {
    (
      list ||
      []
    ).forEach(
      function (value) {
        if (
          values.indexOf(
            value
          ) <
          0
        ) {
          values.push(
            value
          );
        }
      }
    );
  }

  addAll(
    index
      .tenant_candidates[
        tenantId
      ]
  );

  addAll(
    index
      .user_candidates[
        tenantUserId
      ]
  );

  return values;
}


function tenantBindingResolveBestContractForTenant_(
  index,
  tenantId
) {
  const rows =
    (
      index
        .contracts_by_tenant[
          tenantId
        ] ||
      []
    ).slice();

  rows.sort(
    function (a, b) {
      return (
        tenantBindingContractTime_(
          b
        ) -
        tenantBindingContractTime_(
          a
        )
      );
    }
  );

  return rows.find(
    function (contract) {
      return tenantBindingContractLooksActive_(
        contract
      );
    }
  ) ||
  rows[0] ||
  null;
}


function tenantBindingResolveTenantRoomList_(
  index,
  tenantId
) {
  return (
    index
      .room_names_by_tenant[
        tenantId
      ] ||
    []
  )
    .slice()
    .sort(
      function (a, b) {
        return tenantBindingText_(
          a
        ).localeCompare(
          tenantBindingText_(
            b
          ),
          'zh-Hant',
          {
            numeric:
              true
          }
        );
      }
    )
    .join(
      '、'
    );
}


function tenantBindingContractLooksActive_(
  contract
) {
  const status =
    tenantBindingText_(
      contract.contract_status ||
      contract.status
    ).toLowerCase();

  if (
    [
      'terminated',
      'ended',
      'expired',
      'cancelled',
      'canceled',
      'closed',
      'archived',
      'void',
      'voided',
      'deleted'
    ].indexOf(
      status
    ) >=
    0
  ) {
    return false;
  }

  const now =
    new Date();

  now.setHours(
    0,
    0,
    0,
    0
  );

  const start =
    tenantBindingSafeDate_(
      contract.start_date ||
      contract.contract_start_date
    );

  const end =
    tenantBindingSafeDate_(
      contract.end_date ||
      contract.contract_end_date
    );

  if (
    start &&
    start.getTime() >
    now.getTime()
  ) {
    return false;
  }

  if (
    end &&
    end.getTime() <
    now.getTime()
  ) {
    return false;
  }

  return true;
}


function tenantBindingContractTime_(
  contract
) {
  const candidates = [
    contract.start_date,
    contract.contract_start_date,
    contract.updated_at,
    contract.created_at
  ];

  for (
    let index = 0;
    index < candidates.length;
    index += 1
  ) {
    const date =
      tenantBindingSafeDate_(
        candidates[
          index
        ]
      );

    if (date) {
      return date.getTime();
    }
  }

  return 0;
}


function tenantBindingSafeDate_(
  value
) {
  if (!value) {
    return null;
  }

  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {
    return value;
  }

  const date =
    new Date(
      value
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}


function tenantBindingLooksLikeLineUid_(
  value
) {
  return /^U[a-zA-Z0-9_-]{20,}$/.test(
    tenantBindingText_(
      value
    )
  );
}


function tenantBindingIndexAdd_(
  map,
  key,
  value
) {
  if (
    !key ||
    !value
  ) {
    return;
  }

  if (!map[key]) {
    map[key] = [];
  }

  if (
    map[key].indexOf(
      value
    ) <
    0
  ) {
    map[key].push(
      value
    );
  }
}


function testDiagnoseAllTenantLineBindings() {
  return diagnoseAllTenantLineBindings_();
}


function testRepairAllTenantLineBindings() {
  return repairAllTenantLineBindings_();
}


/**
 * 測試函式。
 */
function testEnsureV2TenantBindingLogsSheet() {
  const sheet = tenantBindingEnsureLogSheet_();

  const result = {
    success: true,
    sheet_name: sheet.getName(),
    last_column: sheet.getLastColumn()
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function testTenantBindingStatus() {
  const result = getTenantBindingStatusByLineUid_(
    getRequiredScriptProperty_('TEST_TENANT_LINE_UID')
  );

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function testTenantBindingSchema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = {};

  [
    V2_TENANT_BINDING_SHEETS_.tenants,
    V2_TENANT_BINDING_SHEETS_.users,
    V2_TENANT_BINDING_SHEETS_.contracts,
    V2_TENANT_BINDING_SHEETS_.tenantHomeView
  ].forEach(function (sheetName) {
    const sheet = ss.getSheetByName(sheetName);

    result[sheetName] = sheet
      ? {
          exists: true,
          rows: sheet.getLastRow(),
          columns: sheet.getLastColumn(),
          headers: sheet
            .getRange(
              1,
              1,
              1,
              Math.max(sheet.getLastColumn(), 1)
            )
            .getValues()[0]
        }
      : {
          exists: false
        };
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
