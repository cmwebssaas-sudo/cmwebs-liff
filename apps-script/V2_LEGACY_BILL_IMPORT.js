// ==================================================
// CMWebs V2 Legacy Bill Import
// V1 歷史帳單 → V2_bills
//
// 預設用途：
// - 從「3.歷史帳單總表」匯入指定月份
// - 可只匯入未繳帳單
// - 使用 legacy_ref 防止重複
// - 不在匯入時直接發送 LINE
// ==================================================

const LEGACY_BILL_IMPORT_SOURCE_SHEET =
  '3.歷史帳單總表';

const LEGACY_BILL_IMPORT_TARGET_SHEET =
  'V2_bills';

const LEGACY_BILL_IMPORT_ROOMS_SHEET =
  'V2_rooms';

const LEGACY_BILL_IMPORT_CONTRACTS_SHEET =
  'V2_contracts';

const LEGACY_BILL_IMPORT_TENANTS_SHEET =
  'V2_tenants';

const LEGACY_BILL_IMPORT_DEFAULT_DUE_DAY =
  10;


// ==================================================
// V2_bills 必要欄位
// ==================================================

const LEGACY_BILL_IMPORT_TARGET_HEADERS = [
  'bill_id',
  'bill_month',
  'contract_id',
  'tenant_id',
  'user_id',
  'room_id',
  'property_id',
  'landlord_id',
  'room_name',
  'tenant_name',
  'due_date',

  'rent_amount',
  'management_fee',

  'previous_meter',
  'current_meter',
  'electricity_usage',

  'electricity_fee_rate',
  'equipment_fee_rate',

  'electricity_amount',
  'equipment_amount',

  'other_amount',
  'discount_amount',
  'total_amount',

  'bill_status',
  'payment_status',
  'sent_status',

  'payment_id',
  'paid_at',

  'created_at',
  'updated_at',

  'legacy_source',
  'legacy_ref',
  'notes',

  'reopened_at',
  'reopen_reason',
  'reversal_id'
];


// ==================================================
// 一鍵測試函式
// ==================================================

/**
 * 只預覽，不寫入。
 *
 * 預期找到：
 * - 房號 306
 * - 房號 402
 */
function previewImportV1JuneUnpaidBillsToV2() {
  const result =
    importV1HistoricalBillsToV2ByMonth_(
      '2026-06',
      {
        dryRun: true,
        onlyUnpaid: true,
        landlordId: 'L000001',
        preserveExistingPaymentStatus: true
      }
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
 * 正式匯入 2026 年 6 月未繳帳單。
 *
 * 不會自動傳送 LINE。
 */
function importV1JuneUnpaidBillsToV2() {
  const result =
    importV1HistoricalBillsToV2ByMonth_(
      '2026-06',
      {
        dryRun: false,
        onlyUnpaid: true,
        landlordId: 'L000001',
        preserveExistingPaymentStatus: true
      }
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


// ==================================================
// 主匯入函式
// ==================================================

/**
 * 匯入 V1 歷史帳單到 V2_bills。
 *
 * @param {string} billMonth 格式 yyyy-MM
 * @param {Object} options 選項
 * @return {Object}
 */
function importV1HistoricalBillsToV2ByMonth_(
  billMonth,
  options
) {
  options = options || {};

  const dryRun =
    options.dryRun === true;

  const onlyUnpaid =
    options.onlyUnpaid !== false;

  const landlordId =
    legacyBillImportText_(
      options.landlordId
    );

  const preserveExistingPaymentStatus =
    options.preserveExistingPaymentStatus !==
    false;

  billMonth =
    legacyBillImportNormalizeBillMonth_(
      billMonth
    );

  if (!billMonth) {
    return {
      success: false,
      code: 'INVALID_BILL_MONTH',
      message:
        '帳單月份格式錯誤，請使用 yyyy-MM，例如 2026-06'
    };
  }

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const sourceSheet =
    ss.getSheetByName(
      LEGACY_BILL_IMPORT_SOURCE_SHEET
    );

  if (!sourceSheet) {
    return {
      success: false,
      code: 'SOURCE_SHEET_NOT_FOUND',
      message:
        '找不到來源工作表：' +
        LEGACY_BILL_IMPORT_SOURCE_SHEET
    };
  }

  let targetSheet =
    ss.getSheetByName(
      LEGACY_BILL_IMPORT_TARGET_SHEET
    );

  if (!targetSheet) {
    targetSheet =
      ss.insertSheet(
        LEGACY_BILL_IMPORT_TARGET_SHEET
      );

    targetSheet
      .getRange(
        1,
        1,
        1,
        LEGACY_BILL_IMPORT_TARGET_HEADERS.length
      )
      .setValues([
        LEGACY_BILL_IMPORT_TARGET_HEADERS
      ]);
  }

  legacyBillImportEnsureHeaders_(
    targetSheet,
    LEGACY_BILL_IMPORT_TARGET_HEADERS
  );

  const sourceRows =
    legacyBillImportGetObjects_(
      sourceSheet,
      true
    );

  const targetRows =
    legacyBillImportGetObjects_(
      targetSheet,
      false
    );

  const context =
    legacyBillImportBuildContext_(
      ss,
      targetRows,
      landlordId
    );

  const matchedSourceRows =
    sourceRows.filter(
      function (sourceRow) {
        const sourceMonth =
          legacyBillImportSourceMonth_(
            sourceRow
          );

        if (
          sourceMonth !==
          billMonth
        ) {
          return false;
        }

        const paymentStatus =
          legacyBillImportNormalizePaymentStatus_(
            sourceRow['繳費狀態']
          );

        if (
          onlyUnpaid &&
          paymentStatus !== 'unpaid'
        ) {
          return false;
        }

        return true;
      }
    );

  const result = {
    success: true,
    code: 'OK',

    message:
      dryRun
        ? 'V1 歷史帳單匯入預覽完成'
        : 'V1 歷史帳單匯入完成',

    data: {
      dry_run:
        dryRun,

      bill_month:
        billMonth,

      only_unpaid:
        onlyUnpaid,

      landlord_id:
        landlordId,

      source_sheet:
        LEGACY_BILL_IMPORT_SOURCE_SHEET,

      target_sheet:
        LEGACY_BILL_IMPORT_TARGET_SHEET,

      source_row_count:
        sourceRows.length,

      matched_source_count:
        matchedSourceRows.length,

      inserted_count:
        0,

      updated_count:
        0,

      skipped_count:
        0,

      unchanged_count:
        0,

      unpaid_count:
        0,

      paid_count:
        0,

      imported_bills:
        [],

      skipped_rows:
        []
    }
  };

  let lock = null;

  try {
    if (!dryRun) {
      lock =
        LockService.getScriptLock();

      lock.waitLock(
        30000
      );
    }

    matchedSourceRows.forEach(
      function (sourceRow) {
        const roomName =
          legacyBillImportNormalizeRoomName_(
            sourceRow['房號']
          );

        const tenantName =
          legacyBillImportText_(
            sourceRow['租客姓名']
          );

        const paymentStatus =
          legacyBillImportNormalizePaymentStatus_(
            sourceRow['繳費狀態']
          );

        if (!roomName) {
          result.data.skipped_count++;

          result.data.skipped_rows.push({
            source_row:
              sourceRow._sheet_row,

            room_name:
              '',

            tenant_name:
              tenantName,

            reason:
              '來源資料缺少房號'
          });

          return;
        }

        if (!paymentStatus) {
          result.data.skipped_count++;

          result.data.skipped_rows.push({
            source_row:
              sourceRow._sheet_row,

            room_name:
              roomName,

            tenant_name:
              tenantName,

            reason:
              '無法判斷繳費狀態'
          });

          return;
        }

        const identity =
          legacyBillImportResolveIdentity_(
            context,
            roomName,
            tenantName,
            landlordId
          );

        if (
          !identity ||
          !identity.contract_id ||
          !identity.room_id ||
          !identity.tenant_id
        ) {
          result.data.skipped_count++;

          result.data.skipped_rows.push({
            source_row:
              sourceRow._sheet_row,

            room_name:
              roomName,

            tenant_name:
              tenantName,

            reason:
              '找不到對應的 V2 房間、合約或房客資料'
          });

          return;
        }

        const record =
          legacyBillImportBuildBillRecord_(
            sourceRow,
            billMonth,
            identity,
            paymentStatus
          );

        const existing =
          context.targetByLegacyRef[
            record.legacy_ref
          ] ||
          context.targetByBillId[
            record.bill_id
          ] ||
          null;

        const action =
          existing
            ? 'update'
            : 'insert';

        if (
          existing &&
          preserveExistingPaymentStatus
        ) {
          const existingStatus =
            legacyBillImportNormalizeV2PaymentStatus_(
              existing.payment_status
            );

          if (existingStatus) {
            record.payment_status =
              existingStatus;
          }

          record.payment_id =
            existing.payment_id || '';

          record.paid_at =
            existing.paid_at || '';

          record.reopened_at =
            existing.reopened_at || '';

          record.reopen_reason =
            existing.reopen_reason || '';

          record.reversal_id =
            existing.reversal_id || '';

          record.created_at =
            existing.created_at ||
            record.created_at;
        }

        if (
          record.payment_status ===
          'unpaid'
        ) {
          result.data.unpaid_count++;
        } else if (
          record.payment_status ===
          'paid'
        ) {
          result.data.paid_count++;
        }

        const detail = {
          source_row:
            sourceRow._sheet_row,

          action:
            action,

          room_name:
            record.room_name,

          tenant_name:
            record.tenant_name,

          contract_id:
            record.contract_id,

          bill_id:
            record.bill_id,

          bill_month:
            record.bill_month,

          total_amount:
            record.total_amount,

          payment_status:
            record.payment_status,

          due_date:
            legacyBillImportFormatDate_(
              record.due_date
            ),

          legacy_ref:
            record.legacy_ref
        };

        result.data.imported_bills.push(
          detail
        );

        if (dryRun) {
          return;
        }

        if (existing) {
          legacyBillImportUpdateTargetRow_(
            targetSheet,
            existing._sheet_row,
            record
          );

          result.data.updated_count++;
        } else {
          const newRowNumber =
            legacyBillImportAppendTargetRow_(
              targetSheet,
              record
            );

          result.data.inserted_count++;

          const insertedObject =
            Object.assign(
              {
                _sheet_row:
                  newRowNumber
              },
              record
            );

          context.targetByLegacyRef[
            record.legacy_ref
          ] =
            insertedObject;

          context.targetByBillId[
            record.bill_id
          ] =
            insertedObject;
        }
      }
    );

  } catch (error) {
    return {
      success: false,
      code:
        'LEGACY_BILL_IMPORT_ERROR',

      message:
        'V1 歷史帳單匯入失敗：' +
        (
          error &&
          error.message
            ? error.message
            : String(error)
        ),

      data:
        result.data
    };

  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (releaseError) {
        // 忽略解除鎖定錯誤
      }
    }
  }

  return result;
}


// ==================================================
// 建立匯入所需索引
// ==================================================

function legacyBillImportBuildContext_(
  ss,
  targetRows,
  landlordId
) {
  const roomsSheet =
    ss.getSheetByName(
      LEGACY_BILL_IMPORT_ROOMS_SHEET
    );

  const contractsSheet =
    ss.getSheetByName(
      LEGACY_BILL_IMPORT_CONTRACTS_SHEET
    );

  const tenantsSheet =
    ss.getSheetByName(
      LEGACY_BILL_IMPORT_TENANTS_SHEET
    );

  const rooms =
    legacyBillImportGetObjects_(
      roomsSheet,
      false
    );

  const contracts =
    legacyBillImportGetObjects_(
      contractsSheet,
      false
    );

  const tenants =
    legacyBillImportGetObjects_(
      tenantsSheet,
      false
    );

  const tenantById = {};

  tenants.forEach(
    function (tenant) {
      const tenantId =
        legacyBillImportText_(
          tenant.tenant_id
        );

      if (tenantId) {
        tenantById[tenantId] =
          tenant;
      }
    }
  );

  const targetByLegacyRef = {};
  const targetByBillId = {};
  const billsByRoomName = {};

  targetRows.forEach(
    function (bill) {
      const rowLandlordId =
        legacyBillImportText_(
          bill.landlord_id
        );

      if (
        landlordId &&
        rowLandlordId &&
        rowLandlordId !==
          landlordId
      ) {
        return;
      }

      const legacyRef =
        legacyBillImportText_(
          bill.legacy_ref
        );

      const billId =
        legacyBillImportText_(
          bill.bill_id
        );

      const roomName =
        legacyBillImportNormalizeRoomName_(
          bill.room_name
        );

      if (legacyRef) {
        targetByLegacyRef[
          legacyRef
        ] =
          bill;
      }

      if (billId) {
        targetByBillId[
          billId
        ] =
          bill;
      }

      if (roomName) {
        if (
          !billsByRoomName[
            roomName
          ]
        ) {
          billsByRoomName[
            roomName
          ] = [];
        }

        billsByRoomName[
          roomName
        ].push(
          bill
        );
      }
    }
  );

  Object.keys(
    billsByRoomName
  ).forEach(
    function (roomName) {
      billsByRoomName[
        roomName
      ].sort(
        function (a, b) {
          return (
            legacyBillImportMonthSortValue_(
              b.bill_month
            ) -
            legacyBillImportMonthSortValue_(
              a.bill_month
            )
          );
        }
      );
    }
  );

  const roomsByName = {};

  rooms.forEach(
    function (room) {
      const roomName =
        legacyBillImportNormalizeRoomName_(
          room.room_name ||
          room.room_number ||
          room.name
        );

      const rowLandlordId =
        legacyBillImportText_(
          room.landlord_id
        );

      if (!roomName) {
        return;
      }

      if (
        landlordId &&
        rowLandlordId &&
        rowLandlordId !==
          landlordId
      ) {
        return;
      }

      if (
        !roomsByName[
          roomName
        ]
      ) {
        roomsByName[
          roomName
        ] = [];
      }

      roomsByName[
        roomName
      ].push(
        room
      );
    }
  );

  const contractsByRoomId = {};

  contracts.forEach(
    function (contract) {
      const roomId =
        legacyBillImportText_(
          contract.room_id
        );

      const rowLandlordId =
        legacyBillImportText_(
          contract.landlord_id
        );

      if (!roomId) {
        return;
      }

      if (
        landlordId &&
        rowLandlordId &&
        rowLandlordId !==
          landlordId
      ) {
        return;
      }

      if (
        !contractsByRoomId[
          roomId
        ]
      ) {
        contractsByRoomId[
          roomId
        ] = [];
      }

      contractsByRoomId[
        roomId
      ].push(
        contract
      );
    }
  );

  return {
    targetByLegacyRef:
      targetByLegacyRef,

    targetByBillId:
      targetByBillId,

    billsByRoomName:
      billsByRoomName,

    roomsByName:
      roomsByName,

    contractsByRoomId:
      contractsByRoomId,

    tenantById:
      tenantById
  };
}


// ==================================================
// 解析 V2 身分資料
// ==================================================

function legacyBillImportResolveIdentity_(
  context,
  roomName,
  sourceTenantName,
  landlordId
) {
  /*
   * 第一優先：
   * 使用該房號現有 V2 帳單作為身分模板。
   *
   * 例如使用 2026-07 的 306、402 帳單，
   * 建立 2026-06 帳單。
   */
  const billTemplates =
    context.billsByRoomName[
      roomName
    ] || [];

  if (billTemplates.length > 0) {
    const template =
      billTemplates[0];

    if (
      template.contract_id &&
      template.room_id &&
      template.tenant_id
    ) {
      return {
        contract_id:
          legacyBillImportText_(
            template.contract_id
          ),

        tenant_id:
          legacyBillImportText_(
            template.tenant_id
          ),

        user_id:
          legacyBillImportText_(
            template.user_id
          ),

        room_id:
          legacyBillImportText_(
            template.room_id
          ),

        property_id:
          legacyBillImportText_(
            template.property_id
          ),

        landlord_id:
          legacyBillImportText_(
            template.landlord_id
          ) ||
          landlordId,

        room_name:
          roomName,

        tenant_name:
          sourceTenantName ||
          legacyBillImportText_(
            template.tenant_name
          ),

        due_day:
          legacyBillImportDueDayFromValue_(
            template.due_date
          ),

        electricity_fee_rate:
          legacyBillImportNumber_(
            template.electricity_fee_rate
          ),

        equipment_fee_rate:
          legacyBillImportNumber_(
            template.equipment_fee_rate
          )
      };
    }
  }

  /*
   * 第二優先：
   * V2_rooms + V2_contracts。
   */
  const roomCandidates =
    context.roomsByName[
      roomName
    ] || [];

  if (roomCandidates.length === 0) {
    return null;
  }

  const room =
    roomCandidates[0];

  const roomId =
    legacyBillImportText_(
      room.room_id
    );

  const contractCandidates =
    context.contractsByRoomId[
      roomId
    ] || [];

  if (
    contractCandidates.length === 0
  ) {
    return null;
  }

  let contract = null;

  /*
   * 優先尋找租客姓名相同的合約。
   */
  if (sourceTenantName) {
    contract =
      contractCandidates.find(
        function (candidate) {
          const tenantId =
            legacyBillImportText_(
              candidate.tenant_id
            );

          const tenant =
            context.tenantById[
              tenantId
            ] || {};

          const candidateName =
            legacyBillImportText_(
              tenant.tenant_name ||
              candidate.tenant_name
            );

          return (
            candidateName ===
            sourceTenantName
          );
        }
      ) || null;
  }

  /*
   * 找不到同名時，優先使用有效合約。
   */
  if (!contract) {
    contract =
      contractCandidates.find(
        function (candidate) {
          const status =
            legacyBillImportText_(
              candidate.contract_status ||
              candidate.status ||
              candidate.account_status
            ).toLowerCase();

          return [
            'active',
            'valid',
            'current',
            '啟用',
            '有效'
          ].indexOf(status) !== -1;
        }
      ) || null;
  }

  if (!contract) {
    contract =
      contractCandidates[
        contractCandidates.length - 1
      ];
  }

  const tenantId =
    legacyBillImportText_(
      contract.tenant_id
    );

  const tenant =
    context.tenantById[
      tenantId
    ] || {};

  return {
    contract_id:
      legacyBillImportText_(
        contract.contract_id
      ),

    tenant_id:
      tenantId,

    user_id:
      legacyBillImportText_(
        contract.user_id ||
        tenant.user_id
      ),

    room_id:
      roomId,

    property_id:
      legacyBillImportText_(
        contract.property_id ||
        room.property_id
      ),

    landlord_id:
      legacyBillImportText_(
        contract.landlord_id ||
        room.landlord_id
      ) ||
      landlordId,

    room_name:
      roomName,

    tenant_name:
      sourceTenantName ||
      legacyBillImportText_(
        tenant.tenant_name ||
        contract.tenant_name
      ),

    due_day:
      legacyBillImportInteger_(
        contract.monthly_payment_day ||
        contract.payment_day ||
        contract.rent_due_day ||
        contract.due_day
      ),

    electricity_fee_rate:
      legacyBillImportNumber_(
        room.electricity_fee_rate ||
        contract.electricity_fee_rate
      ),

    equipment_fee_rate:
      legacyBillImportNumber_(
        room.equipment_fee_rate ||
        contract.equipment_fee_rate
      )
  };
}


// ==================================================
// 建立 V2 帳單資料
// ==================================================

function legacyBillImportBuildBillRecord_(
  sourceRow,
  billMonth,
  identity,
  paymentStatus
) {
  const now =
    new Date();

  const roomName =
    legacyBillImportNormalizeRoomName_(
      sourceRow['房號']
    );

  const tenantName =
    legacyBillImportText_(
      sourceRow['租客姓名']
    ) ||
    identity.tenant_name;

  const contractId =
    legacyBillImportText_(
      identity.contract_id
    );

  const billId =
    'BILL-' +
    billMonth.replace(
      '-',
      ''
    ) +
    '-' +
    contractId;

  const legacyRef =
    'old_bill_' +
    billMonth +
    '_room_' +
    roomName;

  const previousMeter =
    legacyBillImportNumberOrBlank_(
      sourceRow['上期度數']
    );

  const currentMeter =
    legacyBillImportNumberOrBlank_(
      sourceRow['本期度數']
    );

  let electricityUsage = '';

  if (
    previousMeter !== '' &&
    currentMeter !== ''
  ) {
    electricityUsage =
      Math.max(
        0,
        Number(currentMeter) -
        Number(previousMeter)
      );
  }

  const dueDay =
    legacyBillImportValidDueDay_(
      identity.due_day
    );

  const dueDate =
    legacyBillImportCreateDueDate_(
      billMonth,
      dueDay
    );

  const electricityRate =
    legacyBillImportNumber_(
      identity.electricity_fee_rate
    ) || 3;

  const equipmentRate =
    legacyBillImportNumber_(
      identity.equipment_fee_rate
    ) || 3.5;

  return {
    bill_id:
      billId,

    bill_month:
      billMonth,

    contract_id:
      contractId,

    tenant_id:
      identity.tenant_id,

    user_id:
      identity.user_id,

    room_id:
      identity.room_id,

    property_id:
      identity.property_id,

    landlord_id:
      identity.landlord_id,

    room_name:
      roomName,

    tenant_name:
      tenantName,

    due_date:
      dueDate,

    rent_amount:
      legacyBillImportNumber_(
        sourceRow['每月租金']
      ),

    management_fee:
      legacyBillImportNumber_(
        sourceRow['每月管理費']
      ),

    previous_meter:
      previousMeter,

    current_meter:
      currentMeter,

    electricity_usage:
      electricityUsage,

    electricity_fee_rate:
      electricityRate,

    equipment_fee_rate:
      equipmentRate,

    electricity_amount:
      legacyBillImportNumber_(
        sourceRow['本月電費']
      ),

    equipment_amount:
      legacyBillImportNumber_(
        sourceRow['本月設備耗損費']
      ),

    other_amount:
      0,

    discount_amount:
      0,

    total_amount:
      legacyBillImportNumber_(
        sourceRow['本月應繳總額']
      ),

    bill_status:
      'issued',

    payment_status:
      paymentStatus,

    /*
     * 匯入時一律設為未發送，
     * 避免直接誤發 LINE。
     */
    sent_status:
      'not_sent',

    payment_id:
      '',

    paid_at:
      '',

    created_at:
      now,

    updated_at:
      now,

    legacy_source:
      LEGACY_BILL_IMPORT_SOURCE_SHEET,

    legacy_ref:
      legacyRef,

    notes:
      [
        'V1 歷史帳單匯入',
        '來源列：' +
          sourceRow._sheet_row,
        '原繳費狀態：' +
          legacyBillImportText_(
            sourceRow['繳費狀態']
          )
      ].join('｜'),

    reopened_at:
      '',

    reopen_reason:
      '',

    reversal_id:
      ''
  };
}


// ==================================================
// 寫入 V2_bills
// ==================================================

function legacyBillImportEnsureHeaders_(
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
        function (header) {
          return legacyBillImportText_(
            header
          );
        }
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


function legacyBillImportAppendTargetRow_(
  sheet,
  record
) {
  const headers =
    legacyBillImportGetHeaders_(
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

  const rowNumber =
    sheet.getLastRow() + 1;

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

  return rowNumber;
}


function legacyBillImportUpdateTargetRow_(
  sheet,
  rowNumber,
  record
) {
  const headers =
    legacyBillImportGetHeaders_(
      sheet
    );

  const existingValues =
    sheet
      .getRange(
        rowNumber,
        1,
        1,
        headers.length
      )
      .getValues()[0];

  const updatedValues =
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

        return existingValues[index];
      }
    );

  sheet
    .getRange(
      rowNumber,
      1,
      1,
      updatedValues.length
    )
    .setValues([
      updatedValues
    ]);
}


// ==================================================
// 資料讀取工具
// ==================================================

function legacyBillImportGetObjects_(
  sheet,
  useDisplayValues
) {
  if (
    !sheet ||
    sheet.getLastRow() < 2 ||
    sheet.getLastColumn() < 1
  ) {
    return [];
  }

  const range =
    sheet.getDataRange();

  const values =
    useDisplayValues
      ? range.getDisplayValues()
      : range.getValues();

  const headers =
    values[0].map(
      function (header) {
        return legacyBillImportText_(
          header
        );
      }
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


function legacyBillImportGetHeaders_(
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
      function (header) {
        return legacyBillImportText_(
          header
        );
      }
    );
}


// ==================================================
// 月份與狀態工具
// ==================================================

function legacyBillImportSourceMonth_(
  sourceRow
) {
  const year =
    legacyBillImportInteger_(
      sourceRow['結帳年份']
    );

  const month =
    legacyBillImportMonthNumber_(
      sourceRow['結帳月份']
    );

  if (
    !year ||
    !month
  ) {
    return '';
  }

  return (
    String(year) +
    '-' +
    String(month).padStart(
      2,
      '0'
    )
  );
}


function legacyBillImportNormalizeBillMonth_(
  value
) {
  const text =
    legacyBillImportText_(
      value
    );

  const match =
    text.match(
      /^(\d{4})-(\d{1,2})$/
    );

  if (!match) {
    return '';
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  if (
    year < 2000 ||
    month < 1 ||
    month > 12
  ) {
    return '';
  }

  return (
    String(year) +
    '-' +
    String(month).padStart(
      2,
      '0'
    )
  );
}


function legacyBillImportMonthNumber_(
  value
) {
  const text =
    legacyBillImportText_(
      value
    );

  const match =
    text.match(
      /(\d{1,2})/
    );

  if (!match) {
    return 0;
  }

  const month =
    Number(match[1]);

  return (
    month >= 1 &&
    month <= 12
  )
    ? month
    : 0;
}


function legacyBillImportNormalizePaymentStatus_(
  value
) {
  const text =
    legacyBillImportText_(
      value
    )
      .replace(/\s+/g, '')
      .toLowerCase();

  if (!text) {
    return '';
  }

  if (
    text === 'unpaid' ||
    text.indexOf('未繳') !== -1 ||
    text.indexOf('欠款') !== -1
  ) {
    return 'unpaid';
  }

  if (
    text === 'paid' ||
    text.indexOf('已繳') !== -1 ||
    text.indexOf('已銷帳') !== -1 ||
    text.indexOf('銷帳') !== -1
  ) {
    return 'paid';
  }

  return '';
}


function legacyBillImportNormalizeV2PaymentStatus_(
  value
) {
  const text =
    legacyBillImportText_(
      value
    ).toLowerCase();

  if (
    text === 'paid' ||
    text === '已繳'
  ) {
    return 'paid';
  }

  if (
    text === 'unpaid' ||
    text === '未繳'
  ) {
    return 'unpaid';
  }

  return '';
}


// ==================================================
// 日期工具
// ==================================================

function legacyBillImportCreateDueDate_(
  billMonth,
  dueDay
) {
  const parts =
    billMonth.split('-');

  const year =
    Number(parts[0]);

  const month =
    Number(parts[1]);

  const maxDay =
    new Date(
      year,
      month,
      0
    ).getDate();

  const safeDay =
    Math.min(
      Math.max(
        1,
        Number(dueDay) ||
        LEGACY_BILL_IMPORT_DEFAULT_DUE_DAY
      ),
      maxDay
    );

  /*
   * 使用中午避免時區轉換後日期減一天。
   */
  return new Date(
    year,
    month - 1,
    safeDay,
    12,
    0,
    0
  );
}


function legacyBillImportDueDayFromValue_(
  value
) {
  if (
    Object.prototype
      .toString
      .call(value) ===
      '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return Number(
      Utilities.formatDate(
        value,
        'Asia/Taipei',
        'd'
      )
    );
  }

  const text =
    legacyBillImportText_(
      value
    );

  const match =
    text.match(
      /\d{4}[\/-]\d{1,2}[\/-](\d{1,2})/
    );

  return match
    ? Number(match[1])
    : LEGACY_BILL_IMPORT_DEFAULT_DUE_DAY;
}


function legacyBillImportValidDueDay_(
  value
) {
  const day =
    legacyBillImportInteger_(
      value
    );

  if (
    day >= 1 &&
    day <= 31
  ) {
    return day;
  }

  return LEGACY_BILL_IMPORT_DEFAULT_DUE_DAY;
}


function legacyBillImportFormatDate_(
  value
) {
  if (
    Object.prototype
      .toString
      .call(value) ===
      '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return Utilities.formatDate(
      value,
      'Asia/Taipei',
      'yyyy-MM-dd'
    );
  }

  return legacyBillImportText_(
    value
  );
}


// ==================================================
// 一般工具
// ==================================================

function legacyBillImportText_(
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


function legacyBillImportNormalizeRoomName_(
  value
) {
  const text =
    legacyBillImportText_(
      value
    );

  if (!text) {
    return '';
  }

  /*
   * 將工作表中的 306.0 轉成 306。
   */
  if (
    /^\d+\.0+$/.test(text)
  ) {
    return String(
      parseInt(
        text,
        10
      )
    );
  }

  return text;
}


function legacyBillImportNumber_(
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


function legacyBillImportNumberOrBlank_(
  value
) {
  if (
    value === undefined ||
    value === null ||
    legacyBillImportText_(
      value
    ) === ''
  ) {
    return '';
  }

  return legacyBillImportNumber_(
    value
  );
}


function legacyBillImportInteger_(
  value
) {
  const number =
    legacyBillImportNumber_(
      value
    );

  return isFinite(number)
    ? Math.round(number)
    : 0;
}


function legacyBillImportMonthSortValue_(
  value
) {
  if (
    Object.prototype
      .toString
      .call(value) ===
      '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return Number(
      Utilities.formatDate(
        value,
        'Asia/Taipei',
        'yyyyMM'
      )
    );
  }

  const text =
    legacyBillImportText_(
      value
    );

  const match =
    text.match(
      /(\d{4})\D*(\d{1,2})/
    );

  if (!match) {
    return 0;
  }

  return (
    Number(match[1]) *
    100 +
    Number(match[2])
  );
}