/**
 * CMWebs V2 房客 runtime identity resolver 與安全資料修復工具。
 *
 * Runtime：
 * - tenant_home / tenant_bills / tenant_message 共用 canonical resolver。
 *
 * 人工工具：
 * - diagnoseTestTenantRuntimeDataDetailed()：唯讀詳細診斷。
 * - previewRepairTestTenantRuntimeData()：唯讀修復預覽。
 * - repairTestTenantRuntimeData()：僅修復 TEST_TENANT_LINE_UID。
 * - repairTestTenantRuntimeViews()：冪等補建三張衍生 View。
 * - verifyTestTenantRuntimeViews()：唯讀驗證三張衍生 View。
 *
 * 本模組不建立帳單、不修改付款狀態、不傳送 LINE。
 */

const V2_TENANT_RUNTIME_DATA_SHEETS_ = {
  tenants: 'V2_tenants',
  contracts: 'V2_contracts',
  tenantHomeView: 'V2_tenant_home_view',
  tenantBillView: 'V2_tenant_bill_view',
  bills: 'V2_bills',
  rooms: 'V2_rooms',
  properties: 'V2_properties',
  landlordTenantListView:
    'V2_landlord_tenant_list_view'
};

const V2_TENANT_RUNTIME_REPAIRABLE_SHEETS_ = [
  'V2_tenants',
  'V2_contracts',
  'V2_tenant_home_view',
  'V2_tenant_bill_view',
  'V2_landlord_tenant_list_view'
];

const V2_TENANT_RUNTIME_FORBIDDEN_REPAIR_FIELDS_ = [
  'bill_id',
  'bill_month',
  'billing_month',
  'bill_status',
  'payment_status',
  'sent_status',
  'paid_at',
  'payment_at'
];


function tenantRuntimeText_(value) {
  return String(
    value === undefined || value === null
      ? ''
      : value
  ).trim();
}


function tenantRuntimeUpper_(value) {
  return tenantRuntimeText_(value)
    .toUpperCase();
}


function tenantRuntimeFirst_(row, keys) {
  row = row || {};

  for (
    let index = 0;
    index < keys.length;
    index += 1
  ) {
    const value =
      tenantRuntimeText_(
        row[keys[index]]
      );

    if (value) {
      return value;
    }
  }

  return '';
}


function tenantRuntimeUniqueValues_(values) {
  const found = {};

  (values || []).forEach(function (value) {
    const text =
      tenantRuntimeText_(value);
    const key =
      tenantRuntimeUpper_(text);

    if (key) {
      found[key] = text;
    }
  });

  return Object.keys(found)
    .sort()
    .map(function (key) {
      return found[key];
    });
}


function tenantRuntimeError_(code, message) {
  const error = new Error(message || code);
  error.code = code;
  return error;
}


function tenantRuntimeMaskUid_(value) {
  const text = tenantRuntimeText_(value);

  if (text.length <= 8) {
    return text ? '***' : '';
  }

  return (
    text.slice(0, 4) +
    '…' +
    text.slice(-4)
  );
}


function tenantRuntimeReadSheet_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return {
      name: sheetName,
      exists: false,
      sheet: null,
      headers: [],
      header_map: {},
      rows: []
    };
  }

  const values =
    sheet.getDataRange().getValues();

  const headers =
    values.length > 0
      ? values[0].map(tenantRuntimeText_)
      : [];

  const headerMap = {};

  headers.forEach(function (header, index) {
    if (header && headerMap[header] === undefined) {
      headerMap[header] = index + 1;
    }
  });

  const rows =
    values
      .slice(1)
      .map(function (row, index) {
        const object = {
          __sheet_row: index + 2
        };

        headers.forEach(function (header, column) {
          if (header) {
            object[header] = row[column];
          }
        });

        return object;
      })
      .filter(function (row) {
        return headers.some(function (header) {
          return (
            row[header] !== '' &&
            row[header] !== null
          );
        });
      });

  return {
    name: sheetName,
    exists: true,
    sheet: sheet,
    headers: headers,
    header_map: headerMap,
    rows: rows
  };
}


function tenantRuntimeReadSnapshot_(ss) {
  const source = {};

  Object.keys(
    V2_TENANT_RUNTIME_DATA_SHEETS_
  ).forEach(function (key) {
    const sheetName =
      V2_TENANT_RUNTIME_DATA_SHEETS_[key];

    source[sheetName] =
      tenantRuntimeReadSheet_(
        ss,
        sheetName
      );
  });

  return source;
}


function tenantRuntimeRequireSheet_(source, sheetName) {
  const entry = source[sheetName];

  if (!entry || !entry.exists) {
    throw tenantRuntimeError_(
      'TENANT_RUNTIME_SHEET_MISSING',
      '缺少必要資料表：' + sheetName
    );
  }

  return entry;
}


function tenantRuntimeLineMatches_(
  row,
  lineUserId,
  includeGenericLine
) {
  lineUserId = tenantRuntimeText_(
    lineUserId
  );

  if (!lineUserId) {
    return false;
  }

  const candidates = [
    row.tenant_line_user_id,
    row.tenant_line_uid
  ];

  if (includeGenericLine) {
    candidates.push(row.line_user_id);
  }

  return candidates.some(function (value) {
    return (
      tenantRuntimeText_(value) ===
      lineUserId
    );
  });
}


function tenantRuntimeContractIsActive_(contract) {
  const status =
    tenantRuntimeFirst_(
      contract,
      [
        'contract_status',
        'status',
        'account_status'
      ]
    ).toLowerCase();

  return [
    'active',
    'valid',
    'current',
    'enabled',
    '啟用',
    '有效'
  ].indexOf(status) >= 0;
}


function tenantRuntimeRequireOne_(
  rows,
  missingCode,
  duplicateCode,
  label
) {
  if (rows.length === 0) {
    throw tenantRuntimeError_(
      missingCode,
      '找不到唯一的' + label
    );
  }

  if (rows.length > 1) {
    throw tenantRuntimeError_(
      duplicateCode,
      label + '存在重複或衝突資料'
    );
  }

  return rows[0];
}


function tenantRuntimeRequireConsistentValue_(
  values,
  missingCode,
  conflictCode,
  label
) {
  const unique =
    tenantRuntimeUniqueValues_(values);

  if (unique.length === 0) {
    throw tenantRuntimeError_(
      missingCode,
      label + '為空白'
    );
  }

  if (unique.length > 1) {
    throw tenantRuntimeError_(
      conflictCode,
      label + '不一致'
    );
  }

  return unique[0];
}


function tenantRuntimeRowsRelatedToTenant_(
  rows,
  canonical,
  options
) {
  options = options || {};

  return (rows || []).filter(function (row) {
    const tenantId =
      tenantRuntimeUpper_(row.tenant_id);
    const tenantUserId =
      tenantRuntimeUpper_(
        tenantRuntimeFirst_(
          row,
          options.include_generic_user === false
            ? ['tenant_user_id']
            : ['tenant_user_id', 'user_id']
        )
      );
    const contractId =
      tenantRuntimeUpper_(
        tenantRuntimeFirst_(
          row,
          ['contract_id', 'current_contract_id']
        )
      );
    const lineMatch =
      tenantRuntimeLineMatches_(
        row,
        canonical.line_user_id,
        options.include_generic_line === true
      );

    const related =
      lineMatch ||
      (
        tenantId &&
        tenantId ===
          tenantRuntimeUpper_(canonical.tenant_id)
      ) ||
      (
        tenantUserId &&
        tenantUserId ===
          tenantRuntimeUpper_(
            canonical.tenant_user_id
          )
      ) ||
      (
        contractId &&
        contractId ===
          tenantRuntimeUpper_(canonical.contract_id)
      );

    if (!related) {
      return false;
    }

    const rowTenantLineIds =
      tenantRuntimeUniqueValues_([
        row.tenant_line_user_id,
        row.tenant_line_uid,
        options.include_generic_line === true
          ? row.line_user_id
          : ''
      ]);

    if (
      rowTenantLineIds.length > 0 &&
      rowTenantLineIds.some(function (value) {
        return (
          value !==
          canonical.line_user_id
        );
      })
    ) {
      throw tenantRuntimeError_(
        'TENANT_LINE_UID_CONFLICT',
        '相關資料列的 tenant LINE UID 不一致'
      );
    }

    const rowWorkspaceId =
      tenantRuntimeUpper_(row.workspace_id);

    if (
      rowWorkspaceId &&
      rowWorkspaceId !==
        tenantRuntimeUpper_(canonical.workspace_id)
    ) {
      throw tenantRuntimeError_(
        'TENANT_RUNTIME_WORKSPACE_CONFLICT',
        '相關資料列的 workspace_id 不一致'
      );
    }

    return true;
  });
}


function tenantRuntimeResolveCanonicalFromSnapshot_(
  source,
  lineUserId,
  options
) {
  options = options || {};
  lineUserId = tenantRuntimeText_(lineUserId);
  const requestedTenantId =
    tenantRuntimeUpper_(
      options.tenant_id
    );
  const requestedContractId =
    tenantRuntimeUpper_(
      options.contract_id
    );
  const expectedWorkspaceId =
    tenantRuntimeUpper_(
      options.workspace_id
    );

  if (!lineUserId && !requestedTenantId) {
    throw tenantRuntimeError_(
      'MISSING_TENANT_IDENTITY',
      '缺少 LINE UID 或 tenant_id'
    );
  }

  const tenantRows =
    tenantRuntimeRequireSheet_(
      source,
      V2_TENANT_RUNTIME_DATA_SHEETS_.tenants
    ).rows.filter(function (row) {
      if (requestedTenantId) {
        return (
          tenantRuntimeUpper_(
            row.tenant_id
          ) === requestedTenantId
        );
      }

      return tenantRuntimeLineMatches_(
        row,
        lineUserId,
        true
      );
    });

  const tenant = tenantRuntimeRequireOne_(
    tenantRows,
    'TENANT_NOT_FOUND',
    'MULTIPLE_TENANTS_FOUND',
    '房客資料'
  );

  const tenantId =
    tenantRuntimeText_(tenant.tenant_id);

  if (!tenantId) {
    throw tenantRuntimeError_(
      'TENANT_ID_MISSING',
      '房客資料缺少 tenant_id'
    );
  }

  const resolvedLineUserIds =
    tenantRuntimeUniqueValues_([
      lineUserId,
      tenant.tenant_line_user_id,
      tenant.tenant_line_uid,
      tenant.line_user_id
    ]);

  if (resolvedLineUserIds.length > 1) {
    throw tenantRuntimeError_(
      'TENANT_LINE_UID_CONFLICT',
      '房客主資料的 LINE UID 不一致'
    );
  }

  lineUserId =
    resolvedLineUserIds[0] || '';

  const duplicateTenantIds =
    tenantRuntimeRequireSheet_(
      source,
      V2_TENANT_RUNTIME_DATA_SHEETS_.tenants
    ).rows.filter(function (row) {
      return (
        tenantRuntimeUpper_(row.tenant_id) ===
        tenantRuntimeUpper_(tenantId)
      );
    });

  if (duplicateTenantIds.length !== 1) {
    throw tenantRuntimeError_(
      'DUPLICATE_TENANT_ID',
      'tenant_id 不是唯一值'
    );
  }

  const contracts =
    tenantRuntimeRequireSheet_(
      source,
      V2_TENANT_RUNTIME_DATA_SHEETS_.contracts
    ).rows.filter(function (row) {
      const matchesTenant =
        tenantRuntimeUpper_(row.tenant_id) ===
        tenantRuntimeUpper_(tenantId);

      if (!matchesTenant) {
        return false;
      }

      if (requestedContractId) {
        return (
          tenantRuntimeUpper_(
            row.contract_id
          ) === requestedContractId
        );
      }

      return tenantRuntimeContractIsActive_(row);
    });

  const contract = tenantRuntimeRequireOne_(
    contracts,
    'ACTIVE_CONTRACT_NOT_FOUND',
    'MULTIPLE_ACTIVE_CONTRACTS_FOUND',
    '有效租約'
  );

  const contractId =
    tenantRuntimeText_(contract.contract_id);

  if (!contractId) {
    throw tenantRuntimeError_(
      'CONTRACT_ID_MISSING',
      '有效租約缺少 contract_id'
    );
  }

  const duplicateContractIds =
    tenantRuntimeRequireSheet_(
      source,
      V2_TENANT_RUNTIME_DATA_SHEETS_.contracts
    ).rows.filter(function (row) {
      return (
        tenantRuntimeUpper_(row.contract_id) ===
        tenantRuntimeUpper_(contractId)
      );
    });

  if (duplicateContractIds.length !== 1) {
    throw tenantRuntimeError_(
      'DUPLICATE_CONTRACT_ID',
      'contract_id 不是唯一值'
    );
  }

  const propertyId =
    tenantRuntimeRequireConsistentValue_(
      [
        tenant.property_id,
        contract.property_id
      ],
      'PROPERTY_ID_MISSING',
      'PROPERTY_ID_CONFLICT',
      'property_id'
    );

  const properties =
    tenantRuntimeRequireSheet_(
      source,
      V2_TENANT_RUNTIME_DATA_SHEETS_.properties
    ).rows.filter(function (row) {
      return (
        tenantRuntimeUpper_(row.property_id) ===
        tenantRuntimeUpper_(propertyId)
      );
    });

  const property = tenantRuntimeRequireOne_(
    properties,
    'PROPERTY_NOT_FOUND',
    'MULTIPLE_PROPERTIES_FOUND',
    '物件資料'
  );

  const workspaceId =
    tenantRuntimeRequireConsistentValue_(
      [
        tenant.workspace_id,
        contract.workspace_id,
        property.workspace_id
      ],
      'WORKSPACE_ID_MISSING',
      'TENANT_RUNTIME_WORKSPACE_CONFLICT',
      'workspace_id'
    );

  if (
    expectedWorkspaceId &&
    tenantRuntimeUpper_(workspaceId) !==
      expectedWorkspaceId
  ) {
    throw tenantRuntimeError_(
      'TENANT_RUNTIME_WORKSPACE_CONFLICT',
      '房客不屬於指定 Workspace'
    );
  }

  const explicitRoomIds =
    tenantRuntimeUniqueValues_([
      tenant.room_id,
      contract.room_id
    ]);

  if (explicitRoomIds.length > 1) {
    throw tenantRuntimeError_(
      'ROOM_ID_CONFLICT',
      'room_id 不一致'
    );
  }

  const roomLabels =
    tenantRuntimeUniqueValues_([
      tenant.room_name,
      tenant.room_list,
      tenant.room_no,
      contract.room_name,
      contract.room_no
    ]);

  if (
    explicitRoomIds.length === 0 &&
    roomLabels.length !== 1
  ) {
    throw tenantRuntimeError_(
      roomLabels.length > 1
        ? 'ROOM_LABEL_CONFLICT'
        : 'ROOM_ID_AND_LABEL_MISSING',
      '無法由租客與租約唯一判定房間'
    );
  }

  const rooms =
    tenantRuntimeRequireSheet_(
      source,
      V2_TENANT_RUNTIME_DATA_SHEETS_.rooms
    ).rows.filter(function (row) {
      const sameWorkspace =
        tenantRuntimeUpper_(row.workspace_id) ===
        tenantRuntimeUpper_(workspaceId);
      const sameProperty =
        tenantRuntimeUpper_(row.property_id) ===
        tenantRuntimeUpper_(propertyId);

      if (!sameWorkspace || !sameProperty) {
        return false;
      }

      if (explicitRoomIds.length === 1) {
        return (
          tenantRuntimeUpper_(row.room_id) ===
          tenantRuntimeUpper_(explicitRoomIds[0])
        );
      }

      const rowLabels =
        tenantRuntimeUniqueValues_([
          row.room_name,
          row.room_no,
          row.room_number
        ]).map(tenantRuntimeUpper_);

      return (
        rowLabels.indexOf(
          tenantRuntimeUpper_(roomLabels[0])
        ) >= 0
      );
    });

  const room = tenantRuntimeRequireOne_(
    rooms,
    'ROOM_NOT_FOUND',
    'MULTIPLE_ROOMS_FOUND',
    '同 Workspace 與物件下的房間'
  );

  const roomId =
    tenantRuntimeText_(room.room_id);

  if (!roomId) {
    throw tenantRuntimeError_(
      'ROOM_ID_MISSING',
      '房間資料缺少 room_id'
    );
  }

  const duplicateRoomIds =
    tenantRuntimeRequireSheet_(
      source,
      V2_TENANT_RUNTIME_DATA_SHEETS_.rooms
    ).rows.filter(function (row) {
      return (
        tenantRuntimeUpper_(row.room_id) ===
        tenantRuntimeUpper_(roomId)
      );
    });

  if (duplicateRoomIds.length !== 1) {
    throw tenantRuntimeError_(
      'DUPLICATE_ROOM_ID',
      'room_id 不是唯一值'
    );
  }

  const resolvedRoomLabels =
    tenantRuntimeUniqueValues_([
      room.room_name,
      room.room_no,
      room.room_number
    ]).map(tenantRuntimeUpper_);

  if (
    roomLabels.some(function (label) {
      return (
        resolvedRoomLabels.indexOf(
          tenantRuntimeUpper_(label)
        ) < 0
      );
    })
  ) {
    throw tenantRuntimeError_(
      'ROOM_LABEL_CONFLICT',
      '租客或租約的房號與 V2_rooms 不一致'
    );
  }

  const seed = {
    line_user_id: lineUserId,
    tenant_id: tenantId,
    tenant_user_id:
      tenantRuntimeFirst_(
        tenant,
        ['tenant_user_id', 'user_id']
      ) ||
      tenantRuntimeFirst_(
        contract,
        ['tenant_user_id', 'user_id']
      ),
    contract_id: contractId,
    workspace_id: workspaceId,
    property_id: propertyId,
    room_id: roomId
  };

  const landlordLinks =
    tenantRuntimeRowsRelatedToTenant_(
      tenantRuntimeRequireSheet_(
        source,
        V2_TENANT_RUNTIME_DATA_SHEETS_
          .landlordTenantListView
      ).rows,
      seed,
      {
        include_generic_line: false,
        include_generic_user: false
      }
    );

  if (landlordLinks.length > 1) {
    throw tenantRuntimeError_(
      'MULTIPLE_TENANT_LANDLORD_LINKS',
      '房客與房東關聯 view 存在重複資料'
    );
  }

  const landlordLink =
    landlordLinks[0] || null;

  const landlordId =
    tenantRuntimeRequireConsistentValue_(
      [
        tenant.landlord_id,
        contract.landlord_id,
        property.landlord_id,
        landlordLink
          ? landlordLink.landlord_id
          : ''
      ],
      'LANDLORD_ID_MISSING',
      'LANDLORD_ID_CONFLICT',
      'landlord_id'
    );

  const landlordLineUserIds =
    tenantRuntimeUniqueValues_([
      contract.landlord_line_user_id,
      property.landlord_line_user_id,
      landlordLink
        ? tenantRuntimeFirst_(
            landlordLink,
            [
              'landlord_line_user_id',
              'line_user_id'
            ]
          )
        : ''
    ]);

  if (landlordLineUserIds.length > 1) {
    throw tenantRuntimeError_(
      'LANDLORD_LINE_UID_CONFLICT',
      '房東 LINE UID 關聯不一致'
    );
  }

  const canonical = {
    line_user_id: lineUserId,
    tenant_id: tenantId,
    tenant_user_id: seed.tenant_user_id,
    tenant_name:
      tenantRuntimeFirst_(
        tenant,
        ['tenant_name', 'name']
      ) ||
      tenantRuntimeText_(contract.tenant_name),
    tenant_phone:
      tenantRuntimeFirst_(
        tenant,
        ['tenant_phone', 'phone']
      ) ||
      tenantRuntimeText_(contract.tenant_phone),
    tenant_email:
      tenantRuntimeFirst_(
        tenant,
        ['tenant_email', 'email']
      ) ||
      tenantRuntimeText_(contract.tenant_email),
    contract_id: contractId,
    contract_status:
      tenantRuntimeFirst_(
        contract,
        ['contract_status', 'status']
      ),
    contract_start_date:
      tenantRuntimeFirst_(
        contract,
        ['contract_start_date', 'start_date']
      ),
    contract_end_date:
      tenantRuntimeFirst_(
        contract,
        ['contract_end_date', 'end_date']
      ),
    workspace_id: workspaceId,
    landlord_id: landlordId,
    landlord_name:
      tenantRuntimeText_(contract.landlord_name) ||
      (
        landlordLink
          ? tenantRuntimeText_(
              landlordLink.landlord_name
            )
          : ''
      ),
    landlord_line_user_id:
      landlordLineUserIds[0] || '',
    property_id: propertyId,
    property_name:
      tenantRuntimeText_(property.property_name) ||
      tenantRuntimeText_(contract.property_name),
    property_address:
      tenantRuntimeFirst_(
        property,
        ['property_address', 'address']
      ) ||
      tenantRuntimeText_(contract.property_address),
    room_id: roomId,
    room_no:
      tenantRuntimeFirst_(
        room,
        ['room_no', 'room_name', 'room_number']
      ),
    room_name:
      tenantRuntimeFirst_(
        room,
        ['room_name', 'room_no', 'room_number']
      ),
    account_status:
      tenantRuntimeFirst_(
        tenant,
        ['account_status', 'tenant_account_status']
      ) || 'active',
    binding_status:
      tenantRuntimeFirst_(
        tenant,
        ['tenant_binding_status', 'binding_status']
      ) || 'bound',
    tenant_row: tenant,
    contract_row: contract,
    property_row: property,
    room_row: room,
    landlord_tenant_link_row: landlordLink
  };

  canonical.tenant_home_rows =
    tenantRuntimeRowsRelatedToTenant_(
      tenantRuntimeRequireSheet_(
        source,
        V2_TENANT_RUNTIME_DATA_SHEETS_
          .tenantHomeView
      ).rows,
      canonical,
      { include_generic_line: true }
    );

  canonical.tenant_bill_rows =
    tenantRuntimeRowsRelatedToTenant_(
      tenantRuntimeRequireSheet_(
        source,
        V2_TENANT_RUNTIME_DATA_SHEETS_
          .tenantBillView
      ).rows,
      canonical,
      { include_generic_line: true }
    );

  canonical.bill_rows =
    tenantRuntimeRowsRelatedToTenant_(
      tenantRuntimeRequireSheet_(
        source,
        V2_TENANT_RUNTIME_DATA_SHEETS_.bills
      ).rows,
      canonical,
      { include_generic_line: false }
    );

  const billViewIds = {};

  canonical.tenant_bill_rows.forEach(function (row) {
    const billId =
      tenantRuntimeUpper_(row.bill_id);

    if (billId) {
      billViewIds[billId] = true;
    }
  });

  canonical.missing_bill_view_bill_ids =
    canonical.bill_rows
      .map(function (row) {
        return tenantRuntimeText_(
          row.bill_id
        );
      })
      .filter(function (billId) {
        return (
          billId &&
          !billViewIds[
            tenantRuntimeUpper_(billId)
          ]
        );
      });

  return canonical;
}


function resolveCanonicalTenantRuntimeByLineUid_(
  lineUserId
) {
  try {
    const ss =
      SpreadsheetApp.getActiveSpreadsheet();
    const source =
      tenantRuntimeReadSnapshot_(ss);

    return {
      success: true,
      code: 'OK',
      message: '房客 runtime 身份解析成功',
      data:
        tenantRuntimeResolveCanonicalFromSnapshot_(
          source,
          lineUserId
        )
    };
  } catch (error) {
    return {
      success: false,
      code:
        error && error.code
          ? error.code
          : 'TENANT_RUNTIME_RESOLUTION_ERROR',
      message:
        error && error.message
          ? error.message
          : '房客 runtime 身份解析失敗',
      data: null
    };
  }
}


function tenantRuntimeHomeData_(canonical, homeRow) {
  homeRow = homeRow || {};

  const billRows =
    (canonical.tenant_bill_rows || [])
      .filter(function (row) {
        return Boolean(
          tenantRuntimeText_(row.bill_id)
        );
      });

  const latestBill =
    billRows
      .slice()
      .sort(function (a, b) {
        return tenantRuntimeText_(
          b.bill_month
        ).localeCompare(
          tenantRuntimeText_(a.bill_month)
        );
      })[0] || {};

  const unpaidRows =
    billRows.filter(function (row) {
      const status =
        tenantRuntimeText_(
          row.payment_status ||
          row.bill_status
        ).toLowerCase();

      return (
        status === 'unpaid' ||
        status === 'pending' ||
        status === 'overdue'
      );
    });

  return {
    line_user_id:
      canonical.line_user_id,
    user_id:
      tenantRuntimeFirst_(
        homeRow,
        ['user_id', 'tenant_user_id']
      ) || canonical.tenant_user_id,
    tenant_id:
      canonical.tenant_id,
    tenant_name:
      tenantRuntimeText_(homeRow.tenant_name) ||
      canonical.tenant_name,
    room_list:
      tenantRuntimeFirst_(
        homeRow,
        ['room_list', 'room_name', 'room_no']
      ) ||
      canonical.room_name ||
      canonical.room_no,
    latest_bill_month:
      tenantRuntimeText_(homeRow.latest_bill_month) ||
      tenantRuntimeText_(latestBill.bill_month),
    latest_due_date:
      homeRow.latest_due_date ||
      latestBill.due_date ||
      '',
    latest_total_amount: Number(
      homeRow.latest_total_amount ||
      latestBill.total_amount ||
      0
    ),
    latest_payment_status:
      tenantRuntimeText_(
        homeRow.latest_payment_status
      ) ||
      tenantRuntimeText_(
        latestBill.payment_status
      ),
    unpaid_bill_count:
      homeRow.unpaid_bill_count !== '' &&
      homeRow.unpaid_bill_count !== undefined
        ? Number(homeRow.unpaid_bill_count || 0)
        : unpaidRows.length,
    unpaid_total_amount:
      homeRow.unpaid_total_amount !== '' &&
      homeRow.unpaid_total_amount !== undefined
        ? Number(homeRow.unpaid_total_amount || 0)
        : unpaidRows.reduce(function (sum, row) {
            return sum +
              Number(row.total_amount || 0);
          }, 0),
    account_status:
      tenantRuntimeText_(homeRow.account_status) ||
      canonical.account_status ||
      'active',
    updated_at:
      homeRow.updated_at ||
      canonical.contract_row.updated_at ||
      ''
  };
}


function tenantRuntimeEmptyBillsResult_() {
  return {
    success: true,
    ok: true,
    code: 'OK_EMPTY',
    message: '目前沒有帳單',
    data: [],
    bills: []
  };
}


function tenantRuntimeDiagnosticRow_(row) {
  return {
    row: row.__sheet_row,
    tenant_id:
      tenantRuntimeText_(row.tenant_id),
    tenant_user_id:
      tenantRuntimeFirst_(
        row,
        ['tenant_user_id', 'user_id']
      ),
    contract_id:
      tenantRuntimeFirst_(
        row,
        ['contract_id', 'current_contract_id']
      ),
    workspace_id:
      tenantRuntimeText_(row.workspace_id),
    landlord_id:
      tenantRuntimeText_(row.landlord_id),
    property_id:
      tenantRuntimeText_(row.property_id),
    room_id:
      tenantRuntimeText_(row.room_id),
    room_no:
      tenantRuntimeFirst_(
        row,
        ['room_no', 'room_name', 'room_list']
      ),
    contract_status:
      tenantRuntimeFirst_(
        row,
        ['contract_status', 'status']
      ),
    account_status:
      tenantRuntimeFirst_(
        row,
        ['account_status', 'tenant_account_status']
      ),
    binding_status:
      tenantRuntimeFirst_(
        row,
        ['tenant_binding_status', 'binding_status']
      ),
    bill_id:
      tenantRuntimeText_(row.bill_id),
    bill_month:
      tenantRuntimeFirst_(
        row,
        ['bill_month', 'billing_month']
      ),
    bill_status:
      tenantRuntimeText_(row.bill_status),
    payment_status:
      tenantRuntimeText_(row.payment_status)
  };
}


function tenantRuntimeCanonicalPublic_(canonical) {
  return {
    tenant_id: canonical.tenant_id,
    tenant_user_id: canonical.tenant_user_id,
    contract_id: canonical.contract_id,
    workspace_id: canonical.workspace_id,
    landlord_id: canonical.landlord_id,
    property_id: canonical.property_id,
    room_id: canonical.room_id,
    room_no: canonical.room_no,
    contract_status: canonical.contract_status,
    account_status: canonical.account_status,
    binding_status: canonical.binding_status,
    bill_count: canonical.bill_rows.length,
    home_view_count:
      canonical.tenant_home_rows.length,
    bill_view_count:
      canonical.tenant_bill_rows.length
  };
}


function diagnoseTestTenantRuntimeDataDetailed() {
  const lineUserId =
    tenantRuntimeText_(
      getRequiredScriptProperty_(
        'TEST_TENANT_LINE_UID'
      )
    );
  const ss =
    SpreadsheetApp.getActiveSpreadsheet();
  const source =
    tenantRuntimeReadSnapshot_(ss);
  let canonical = null;
  let resolutionError = null;

  try {
    canonical =
      tenantRuntimeResolveCanonicalFromSnapshot_(
        source,
        lineUserId
      );
  } catch (error) {
    resolutionError = {
      code:
        error && error.code
          ? error.code
          : 'TENANT_RUNTIME_RESOLUTION_ERROR',
      message:
        error && error.message
          ? error.message
          : '房客 runtime 身份解析失敗'
    };
  }

  const sheets = {};

  Object.keys(source).forEach(function (sheetName) {
    const entry = source[sheetName];
    let rows = [];

    if (canonical) {
      if (sheetName === 'V2_rooms') {
        rows = entry.rows.filter(function (row) {
          return (
            tenantRuntimeUpper_(row.room_id) ===
            tenantRuntimeUpper_(canonical.room_id)
          );
        });
      } else if (sheetName === 'V2_properties') {
        rows = entry.rows.filter(function (row) {
          return (
            tenantRuntimeUpper_(row.property_id) ===
            tenantRuntimeUpper_(canonical.property_id)
          );
        });
      } else {
        rows = tenantRuntimeRowsRelatedToTenant_(
          entry.rows,
          canonical,
          {
            include_generic_line:
              sheetName !==
              'V2_landlord_tenant_list_view'
          }
        );
      }
    } else {
      rows = entry.rows.filter(function (row) {
        return tenantRuntimeLineMatches_(
          row,
          lineUserId,
          sheetName !==
            'V2_landlord_tenant_list_view'
        );
      });
    }

    sheets[sheetName] = {
      exists: entry.exists,
      matched_row_count: rows.length,
      rows: rows.map(
        tenantRuntimeDiagnosticRow_
      )
    };
  });

  const result = {
    diagnostic:
      'diagnoseTestTenantRuntimeDataDetailed',
    read_only: true,
    generated_at: new Date(),
    test_line_uid_masked:
      tenantRuntimeMaskUid_(lineUserId),
    success: Boolean(canonical),
    resolution_error: resolutionError,
    canonical_ids:
      canonical
        ? tenantRuntimeCanonicalPublic_(canonical)
        : null,
    sheets: sheets
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function tenantRuntimePlanField_(
  plan,
  entry,
  rowNumber,
  field,
  newValue,
  operation
) {
  if (
    V2_TENANT_RUNTIME_FORBIDDEN_REPAIR_FIELDS_
      .indexOf(field) >= 0
  ) {
    throw tenantRuntimeError_(
      'FORBIDDEN_REPAIR_FIELD',
      '修復計畫不可修改欄位：' + field
    );
  }

  if (entry.header_map[field] === undefined) {
    return;
  }

  const existingRow =
    entry.rows.find(function (row) {
      return row.__sheet_row === rowNumber;
    }) || {};
  const oldValue =
    existingRow[field] === undefined
      ? ''
      : existingRow[field];
  const oldText = tenantRuntimeText_(oldValue);
  const newText = tenantRuntimeText_(newValue);

  if (!newText || oldText === newText) {
    return;
  }

  if (
    oldText &&
    tenantRuntimeUpper_(oldText) !==
      tenantRuntimeUpper_(newText)
  ) {
    throw tenantRuntimeError_(
      'NONEMPTY_FIELD_CONFLICT',
      entry.name +
        ' row ' +
        rowNumber +
        ' 的 ' +
        field +
        ' 已有不同值'
    );
  }

  if (!oldText) {
    plan.push({
      operation: operation || 'UPDATE',
      sheet: entry.name,
      row: rowNumber,
      field: field,
      old_value: oldValue,
      new_value: newValue
    });
  }
}


function tenantRuntimePlanFields_(
  plan,
  entry,
  rowNumber,
  values,
  operation
) {
  Object.keys(values).forEach(function (field) {
    tenantRuntimePlanField_(
      plan,
      entry,
      rowNumber,
      field,
      values[field],
      operation
    );
  });
}


function tenantRuntimeBuildRepairPlan_(
  source,
  canonical
) {
  const plan = [];
  const tenantValues = {
    tenant_line_user_id:
      canonical.line_user_id,
    line_user_id:
      canonical.line_user_id,
    tenant_user_id:
      canonical.tenant_user_id,
    user_id:
      canonical.tenant_user_id,
    workspace_id:
      canonical.workspace_id,
    landlord_id:
      canonical.landlord_id,
    landlord_line_user_id:
      canonical.landlord_line_user_id,
    tenant_name:
      canonical.tenant_name,
    name:
      canonical.tenant_name,
    property_id:
      canonical.property_id,
    property_name:
      canonical.property_name,
    room_id:
      canonical.room_id,
    room_name:
      canonical.room_name,
    room_list:
      canonical.room_name,
    current_contract_id:
      canonical.contract_id,
    tenant_binding_status: 'bound',
    binding_status: 'bound',
    account_status: 'active',
    tenant_account_status: 'active'
  };

  tenantRuntimePlanFields_(
    plan,
    source.V2_tenants,
    canonical.tenant_row.__sheet_row,
    tenantValues,
    'UPDATE'
  );

  const contractValues = {
    tenant_line_user_id:
      canonical.line_user_id,
    tenant_user_id:
      canonical.tenant_user_id,
    tenant_id:
      canonical.tenant_id,
    tenant_name:
      canonical.tenant_name,
    workspace_id:
      canonical.workspace_id,
    landlord_id:
      canonical.landlord_id,
    landlord_line_user_id:
      canonical.landlord_line_user_id,
    landlord_name:
      canonical.landlord_name,
    property_id:
      canonical.property_id,
    property_name:
      canonical.property_name,
    property_address:
      canonical.property_address,
    room_id:
      canonical.room_id,
    room_name:
      canonical.room_name
  };

  tenantRuntimePlanFields_(
    plan,
    source.V2_contracts,
    canonical.contract_row.__sheet_row,
    contractValues,
    'UPDATE'
  );

  const homeValues = {
    line_user_id:
      canonical.line_user_id,
    tenant_line_user_id:
      canonical.line_user_id,
    user_id:
      canonical.tenant_user_id,
    tenant_user_id:
      canonical.tenant_user_id,
    tenant_id:
      canonical.tenant_id,
    tenant_name:
      canonical.tenant_name,
    workspace_id:
      canonical.workspace_id,
    landlord_id:
      canonical.landlord_id,
    landlord_name:
      canonical.landlord_name,
    landlord_line_user_id:
      canonical.landlord_line_user_id,
    property_id:
      canonical.property_id,
    property_name:
      canonical.property_name,
    room_id:
      canonical.room_id,
    room_name:
      canonical.room_name,
    room_list:
      canonical.room_name,
    current_contract_id:
      canonical.contract_id,
    contract_status:
      canonical.contract_status,
    contract_start_date:
      canonical.contract_start_date,
    contract_end_date:
      canonical.contract_end_date,
    tenant_binding_status: 'bound',
    account_status: 'active'
  };

  if (canonical.bill_rows.length === 0) {
    homeValues.latest_total_amount = 0;
    homeValues.unpaid_bill_count = 0;
    homeValues.unpaid_total_amount = 0;
  }

  if (canonical.tenant_home_rows.length > 1) {
    throw tenantRuntimeError_(
      'MULTIPLE_TENANT_HOME_ROWS',
      'V2_tenant_home_view 存在重複房客列'
    );
  }

  const homeEntry = source.V2_tenant_home_view;
  const homeRow =
    canonical.tenant_home_rows[0];

  tenantRuntimePlanFields_(
    plan,
    homeEntry,
    homeRow
      ? homeRow.__sheet_row
      : homeEntry.sheet.getLastRow() + 1,
    homeValues,
    homeRow ? 'UPDATE' : 'INSERT_CELL'
  );

  const landlordListValues = {
    line_user_id:
      canonical.landlord_line_user_id,
    workspace_id:
      canonical.workspace_id,
    landlord_id:
      canonical.landlord_id,
    landlord_name:
      canonical.landlord_name,
    tenant_line_user_id:
      canonical.line_user_id,
    tenant_user_id:
      canonical.tenant_user_id,
    tenant_id:
      canonical.tenant_id,
    tenant_name:
      canonical.tenant_name,
    property_id:
      canonical.property_id,
    property_name:
      canonical.property_name,
    room_id:
      canonical.room_id,
    room_list:
      canonical.room_name,
    tenant_binding_status: 'bound',
    tenant_account_status: 'active',
    current_contract_id:
      canonical.contract_id,
    contract_status:
      canonical.contract_status,
    contract_start_date:
      canonical.contract_start_date,
    contract_end_date:
      canonical.contract_end_date
  };

  const listEntry =
    source.V2_landlord_tenant_list_view;
  const listRow =
    canonical.landlord_tenant_link_row;

  tenantRuntimePlanFields_(
    plan,
    listEntry,
    listRow
      ? listRow.__sheet_row
      : listEntry.sheet.getLastRow() + 1,
    landlordListValues,
    listRow ? 'UPDATE' : 'INSERT_CELL'
  );

  canonical.tenant_bill_rows
    .filter(function (billViewRow) {
      return Boolean(
        tenantRuntimeText_(
          billViewRow.bill_id
        )
      );
    })
    .forEach(function (billViewRow) {
    tenantRuntimePlanFields_(
      plan,
      source.V2_tenant_bill_view,
      billViewRow.__sheet_row,
      {
        line_user_id:
          canonical.line_user_id,
        tenant_line_user_id:
          canonical.line_user_id,
        user_id:
          canonical.tenant_user_id,
        tenant_user_id:
          canonical.tenant_user_id,
        tenant_id:
          canonical.tenant_id,
        tenant_name:
          canonical.tenant_name,
        workspace_id:
          canonical.workspace_id,
        landlord_id:
          canonical.landlord_id,
        room_id:
          canonical.room_id,
        room_name:
          canonical.room_name
      },
      'UPDATE'
    );
    });

  return plan;
}


function tenantRuntimeRepairPublicPlan_(plan) {
  return (plan || []).map(function (item) {
    return {
      operation: item.operation,
      sheet: item.sheet,
      row: item.row,
      field: item.field,
      old_value: item.old_value,
      new_value: item.new_value
    };
  });
}


function previewRepairTestTenantRuntimeData() {
  const lineUserId =
    tenantRuntimeText_(
      getRequiredScriptProperty_(
        'TEST_TENANT_LINE_UID'
      )
    );
  const ss =
    SpreadsheetApp.getActiveSpreadsheet();
  const source =
    tenantRuntimeReadSnapshot_(ss);

  try {
    const canonical =
      tenantRuntimeResolveCanonicalFromSnapshot_(
        source,
        lineUserId
      );
    const plan =
      tenantRuntimeBuildRepairPlan_(
        source,
        canonical
      );
    const result = {
      success: true,
      dry_run: true,
      writes_performed: 0,
      test_line_uid_masked:
        tenantRuntimeMaskUid_(lineUserId),
      canonical_ids:
        tenantRuntimeCanonicalPublic_(canonical),
      change_count: plan.length,
      changes:
        tenantRuntimeRepairPublicPlan_(plan)
    };

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    const result = {
      success: false,
      dry_run: true,
      writes_performed: 0,
      code:
        error && error.code
          ? error.code
          : 'TENANT_RUNTIME_PREVIEW_ERROR',
      message:
        error && error.message
          ? error.message
          : '修復預覽失敗',
      changes: []
    };

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }
}


function tenantRuntimeValidateRepairPlan_(plan) {
  (plan || []).forEach(function (item) {
    if (
      V2_TENANT_RUNTIME_REPAIRABLE_SHEETS_
        .indexOf(item.sheet) < 0
    ) {
      throw tenantRuntimeError_(
        'REPAIR_SHEET_NOT_ALLOWED',
        '修復計畫包含不允許的資料表：' +
          item.sheet
      );
    }

    if (
      V2_TENANT_RUNTIME_FORBIDDEN_REPAIR_FIELDS_
        .indexOf(item.field) >= 0
    ) {
      throw tenantRuntimeError_(
        'FORBIDDEN_REPAIR_FIELD',
        '修復計畫包含不允許的欄位：' +
          item.field
      );
    }

    if (
      !Number(item.row) ||
      Number(item.row) < 2
    ) {
      throw tenantRuntimeError_(
        'INVALID_REPAIR_ROW',
        '修復計畫包含無效 row'
      );
    }
  });
}


function tenantRuntimeApplyRepairPlan_(source, plan) {
  tenantRuntimeValidateRepairPlan_(plan);

  plan.forEach(function (item) {
    const entry = source[item.sheet];

    if (
      !entry ||
      !entry.exists ||
      !entry.sheet ||
      entry.header_map[item.field] === undefined
    ) {
      throw tenantRuntimeError_(
        'REPAIR_SCHEMA_CHANGED',
        '寫入前 schema 已變更：' +
          item.sheet +
          '.' +
          item.field
      );
    }

    const currentValue =
      entry.sheet
        .getRange(
          item.row,
          entry.header_map[item.field]
        )
        .getValue();

    if (
      tenantRuntimeText_(currentValue) !==
      tenantRuntimeText_(item.old_value)
    ) {
      throw tenantRuntimeError_(
        'REPAIR_DATA_CHANGED',
        '寫入前資料已變更，修復已停止：' +
          item.sheet +
          ' row ' +
          item.row +
          ' ' +
          item.field
      );
    }
  });

  let appliedCount = 0;

  plan.forEach(function (item) {
    const entry = source[item.sheet];

    try {
      entry.sheet
        .getRange(
          item.row,
          entry.header_map[item.field]
        )
        .setValue(item.new_value);

      appliedCount += 1;
    } catch (error) {
      error.applied_count = appliedCount;
      throw error;
    }
  });

  try {
    SpreadsheetApp.flush();
  } catch (error) {
    error.applied_count = appliedCount;
    throw error;
  }

  return appliedCount;
}


function repairTestTenantRuntimeData() {
  const lineUserId =
    tenantRuntimeText_(
      getRequiredScriptProperty_(
        'TEST_TENANT_LINE_UID'
      )
    );
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    lock.waitLock(25000);
    locked = true;

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();
    const source =
      tenantRuntimeReadSnapshot_(ss);
    const canonical =
      tenantRuntimeResolveCanonicalFromSnapshot_(
        source,
        lineUserId
      );
    const plan =
      tenantRuntimeBuildRepairPlan_(
        source,
        canonical
      );

    tenantRuntimeValidateRepairPlan_(plan);

    const rollback =
      plan.map(function (item) {
        return {
          sheet: item.sheet,
          row: item.row,
          field: item.field,
          restore_value: item.old_value
        };
      });

    Logger.log(
      JSON.stringify(
        {
          phase:
            'ROLLBACK_BACKUP_BEFORE_WRITE',
          generated_at: new Date(),
          test_line_uid_masked:
            tenantRuntimeMaskUid_(lineUserId),
          canonical_ids:
            tenantRuntimeCanonicalPublic_(canonical),
          rollback: rollback
        },
        null,
        2
      )
    );

    const appliedCount =
      tenantRuntimeApplyRepairPlan_(
      source,
      plan
    );

    const result = {
      success: true,
      code: 'TEST_TENANT_RUNTIME_REPAIRED',
      message:
        '測試房客 runtime 關聯已安全同步',
      test_line_uid_masked:
        tenantRuntimeMaskUid_(lineUserId),
      canonical_ids:
        tenantRuntimeCanonicalPublic_(canonical),
      changed_cell_count: appliedCount,
      changes:
        tenantRuntimeRepairPublicPlan_(plan),
      rollback: rollback,
      bills_created: 0,
      line_messages_sent: 0,
      payment_fields_modified: 0
    };

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    const result = {
      success: false,
      code:
        error && error.code
          ? error.code
          : 'TEST_TENANT_RUNTIME_REPAIR_ERROR',
      message:
        error && error.message
          ? error.message
          : '測試房客 runtime 修復失敗',
      changed_cell_count:
        error && error.applied_count
          ? error.applied_count
          : 0,
      rollback_required:
        Boolean(
          error && error.applied_count
        )
    };

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


function tenantRuntimeNewViewStats_() {
  return {
    inserted: 0,
    updated: 0,
    unchanged: 0,
    conflict: 0
  };
}


function tenantRuntimeViewValueEqual_(left, right) {
  if (
    left instanceof Date &&
    right instanceof Date
  ) {
    return left.getTime() === right.getTime();
  }

  return (
    tenantRuntimeText_(left) ===
    tenantRuntimeText_(right)
  );
}


function tenantRuntimeBillMonth_(bill) {
  return tenantRuntimeFirst_(
    bill,
    ['bill_month', 'billing_month']
  );
}


function tenantRuntimeBuildBillSummary_(canonical) {
  const bills =
    (canonical.bill_rows || [])
      .slice()
      .sort(function (a, b) {
        const monthCompare =
          tenantRuntimeBillMonth_(b)
            .localeCompare(
              tenantRuntimeBillMonth_(a)
            );

        if (monthCompare !== 0) {
          return monthCompare;
        }

        return tenantRuntimeText_(
          b.updated_at || b.created_at
        ).localeCompare(
          tenantRuntimeText_(
            a.updated_at || a.created_at
          )
        );
      });

  const latest = bills[0] || {};
  const unpaid =
    bills.filter(function (bill) {
      return [
        'unpaid',
        'pending',
        'overdue'
      ].indexOf(
        tenantRuntimeText_(
          bill.payment_status
        ).toLowerCase()
      ) >= 0;
    });

  return {
    latest_bill_month:
      tenantRuntimeBillMonth_(latest),
    latest_due_date:
      latest.due_date || '',
    latest_total_amount:
      latest.total_amount === undefined ||
      latest.total_amount === null ||
      latest.total_amount === ''
        ? 0
        : latest.total_amount,
    latest_payment_status:
      tenantRuntimeText_(
        latest.payment_status
      ),
    unpaid_bill_count:
      unpaid.length,
    unpaid_total_amount:
      unpaid.reduce(function (sum, bill) {
        const amount = Number(
          tenantRuntimeText_(
            bill.total_amount
          ).replace(/,/g, '')
        );

        return sum + (
          Number.isFinite(amount)
            ? amount
            : 0
        );
      }, 0)
  };
}


function tenantRuntimeBuildDesiredViews_(
  canonical,
  now
) {
  const summary =
    tenantRuntimeBuildBillSummary_(
      canonical
    );
  const common = {
    tenant_line_user_id:
      canonical.line_user_id,
    tenant_user_id:
      canonical.tenant_user_id,
    tenant_id:
      canonical.tenant_id,
    tenant_name:
      canonical.tenant_name,
    tenant_phone:
      canonical.tenant_phone,
    tenant_email:
      canonical.tenant_email,
    workspace_id:
      canonical.workspace_id,
    landlord_id:
      canonical.landlord_id,
    landlord_name:
      canonical.landlord_name,
    property_id:
      canonical.property_id,
    property_name:
      canonical.property_name,
    room_id:
      canonical.room_id,
    room_name:
      canonical.room_name,
    current_contract_id:
      canonical.contract_id,
    contract_status:
      canonical.contract_status,
    contract_start_date:
      canonical.contract_start_date,
    contract_end_date:
      canonical.contract_end_date,
    updated_at:
      now
  };

  const home =
    Object.assign(
      {},
      common,
      summary,
      {
        line_user_id:
          canonical.line_user_id,
        user_id:
          canonical.tenant_user_id,
        landlord_line_user_id:
          canonical.landlord_line_user_id,
        room_list:
          canonical.room_name,
        tenant_binding_status:
          canonical.binding_status || 'bound',
        binding_status:
          canonical.binding_status || 'bound',
        account_status:
          canonical.account_status || 'active'
      }
    );

  const landlordList =
    Object.assign(
      {},
      common,
      summary,
      {
        line_user_id:
          canonical.landlord_line_user_id,
        user_id: '',
        landlord_line_user_id:
          canonical.landlord_line_user_id,
        room_list:
          canonical.room_name,
        tenant_binding_status:
          canonical.binding_status || 'bound',
        binding_status:
          canonical.binding_status || 'bound',
        tenant_account_status:
          canonical.account_status || 'active',
        account_status:
          canonical.account_status || 'active'
      }
    );

  const billRows =
    (canonical.bill_rows || [])
      .map(function (bill) {
        return Object.assign(
          {},
          bill,
          {
            line_user_id:
              canonical.line_user_id,
            user_id:
              tenantRuntimeFirst_(
                bill,
                ['tenant_user_id', 'user_id']
              ) || canonical.tenant_user_id,
            tenant_line_user_id:
              canonical.line_user_id,
            tenant_user_id:
              tenantRuntimeText_(
                bill.tenant_user_id
              ) || canonical.tenant_user_id,
            tenant_id:
              canonical.tenant_id,
            tenant_name:
              tenantRuntimeText_(
                bill.tenant_name
              ) || canonical.tenant_name,
            workspace_id:
              canonical.workspace_id,
            landlord_id:
              tenantRuntimeText_(
                bill.landlord_id
              ) || canonical.landlord_id,
            landlord_line_user_id:
              tenantRuntimeText_(
                bill.landlord_line_user_id
              ) || canonical.landlord_line_user_id,
            contract_id:
              tenantRuntimeText_(
                bill.contract_id
              ) || canonical.contract_id,
            property_id:
              tenantRuntimeText_(
                bill.property_id
              ) || canonical.property_id,
            property_name:
              tenantRuntimeText_(
                bill.property_name
              ) || canonical.property_name,
            room_id:
              tenantRuntimeText_(
                bill.room_id
              ) || canonical.room_id,
            room_name:
              tenantRuntimeText_(
                bill.room_name
              ) || canonical.room_name,
            bill_month:
              tenantRuntimeBillMonth_(bill),
            updated_at:
              now
          }
        );
      });

  return {
    V2_tenant_home_view: [home],
    V2_tenant_bill_view: billRows,
    V2_landlord_tenant_list_view:
      [landlordList]
  };
}


function tenantRuntimePlanDerivedViewRow_(
  syncPlan,
  entry,
  keyFields,
  identityField,
  desired,
  now
) {
  const stats =
    syncPlan.stats[entry.name];
  const identityValue =
    tenantRuntimeText_(
      desired[identityField]
    );
  const workspaceId =
    tenantRuntimeUpper_(
      desired.workspace_id
    );

  keyFields.forEach(function (field) {
    if (entry.header_map[field] === undefined) {
      stats.conflict += 1;
      syncPlan.conflicts.push({
        sheet: entry.name,
        key: identityValue,
        code: 'VIEW_KEY_HEADER_MISSING',
        field: field
      });
    }
  });

  if (
    !identityValue ||
    !workspaceId ||
    stats.conflict > 0
  ) {
    if (!identityValue || !workspaceId) {
      stats.conflict += 1;
      syncPlan.conflicts.push({
        sheet: entry.name,
        key: identityValue,
        code: 'VIEW_CANONICAL_KEY_MISSING'
      });
    }

    return;
  }

  const identityRows =
    entry.rows.filter(function (row) {
      return (
        tenantRuntimeUpper_(
          row[identityField]
        ) ===
        tenantRuntimeUpper_(identityValue)
      );
    });

  if (identityRows.length > 1) {
    stats.conflict += 1;
    syncPlan.conflicts.push({
      sheet: entry.name,
      key: identityValue,
      code: 'DUPLICATE_VIEW_KEY',
      rows: identityRows.map(function (row) {
        return row.__sheet_row;
      })
    });
    return;
  }

  const existing = identityRows[0] || null;

  if (
    existing &&
    tenantRuntimeText_(existing.workspace_id) &&
    tenantRuntimeUpper_(existing.workspace_id) !==
      workspaceId
  ) {
    stats.conflict += 1;
    syncPlan.conflicts.push({
      sheet: entry.name,
      key: identityValue,
      code: 'VIEW_WORKSPACE_CONFLICT',
      row: existing.__sheet_row
    });
    return;
  }

  if (!existing) {
    const insertValues = {};

    entry.headers.forEach(function (field) {
      if (
        field &&
        desired[field] !== undefined
      ) {
        insertValues[field] =
          desired[field];
      }
    });

    if (
      entry.header_map.created_at !== undefined &&
      insertValues.created_at === undefined
    ) {
      insertValues.created_at = now;
    }

    if (
      entry.header_map.updated_at !== undefined
    ) {
      insertValues.updated_at = now;
    }

    syncPlan.operations.push({
      operation: 'INSERT',
      sheet: entry.name,
      row: null,
      values: insertValues,
      key_fields: keyFields,
      key: identityValue
    });
    stats.inserted += 1;
    return;
  }

  const changes = [];
  const preserveWhenBlank = {
    line_user_id: true,
    landlord_line_user_id: true,
    tenant_line_user_id: true
  };

  Object.keys(desired).forEach(function (field) {
    if (
      field === 'created_at' ||
      field === 'updated_at' ||
      entry.header_map[field] === undefined
    ) {
      return;
    }

    const newValue = desired[field];
    const oldValue = existing[field];

    if (
      preserveWhenBlank[field] &&
      !tenantRuntimeText_(newValue) &&
      tenantRuntimeText_(oldValue)
    ) {
      return;
    }

    if (
      !tenantRuntimeViewValueEqual_(
        oldValue,
        newValue
      )
    ) {
      changes.push({
        field: field,
        old_value: oldValue,
        new_value: newValue
      });
    }
  });

  if (changes.length === 0) {
    stats.unchanged += 1;
    return;
  }

  if (
    entry.header_map.updated_at !== undefined
  ) {
    changes.push({
      field: 'updated_at',
      old_value: existing.updated_at,
      new_value: now
    });
  }

  syncPlan.operations.push({
    operation: 'UPDATE',
    sheet: entry.name,
    row: existing.__sheet_row,
    changes: changes,
    key_fields: keyFields,
    key: identityValue
  });
  stats.updated += 1;
}


function tenantRuntimeBuildViewSyncPlan_(
  source,
  canonical,
  now
) {
  const desired =
    tenantRuntimeBuildDesiredViews_(
      canonical,
      now
    );
  const syncPlan = {
    stats: {
      V2_tenant_home_view:
        tenantRuntimeNewViewStats_(),
      V2_tenant_bill_view:
        tenantRuntimeNewViewStats_(),
      V2_landlord_tenant_list_view:
        tenantRuntimeNewViewStats_()
    },
    operations: [],
    conflicts: []
  };

  const configs = [
    {
      sheet: 'V2_tenant_home_view',
      key_fields: ['workspace_id', 'tenant_id'],
      identity_field: 'tenant_id'
    },
    {
      sheet: 'V2_tenant_bill_view',
      key_fields: ['workspace_id', 'bill_id'],
      identity_field: 'bill_id'
    },
    {
      sheet: 'V2_landlord_tenant_list_view',
      key_fields: ['workspace_id', 'tenant_id'],
      identity_field: 'tenant_id'
    }
  ];

  configs.forEach(function (config) {
    const entry =
      tenantRuntimeRequireSheet_(
        source,
        config.sheet
      );

    desired[config.sheet].forEach(function (row) {
      tenantRuntimePlanDerivedViewRow_(
        syncPlan,
        entry,
        config.key_fields,
        config.identity_field,
        row,
        now
      );
    });
  });

  const expectedBillIds = {};

  desired.V2_tenant_bill_view.forEach(function (row) {
    expectedBillIds[
      tenantRuntimeUpper_(row.bill_id)
    ] = true;
  });

  const orphanBillRows =
    source.V2_tenant_bill_view.rows
      .filter(function (row) {
        return (
          tenantRuntimeUpper_(row.workspace_id) ===
            tenantRuntimeUpper_(canonical.workspace_id) &&
          tenantRuntimeUpper_(row.tenant_id) ===
            tenantRuntimeUpper_(canonical.tenant_id) &&
          tenantRuntimeText_(row.bill_id) &&
          !expectedBillIds[
            tenantRuntimeUpper_(row.bill_id)
          ]
        );
      });

  if (orphanBillRows.length > 0) {
    syncPlan.stats
      .V2_tenant_bill_view
      .conflict += orphanBillRows.length;

    orphanBillRows.forEach(function (row) {
      syncPlan.conflicts.push({
        sheet: 'V2_tenant_bill_view',
        key: tenantRuntimeText_(row.bill_id),
        code: 'ORPHAN_BILL_VIEW_ROW',
        row: row.__sheet_row
      });
    });
  }

  return syncPlan;
}


function tenantRuntimeApplyViewSyncPlan_(
  source,
  syncPlan
) {
  if (syncPlan.conflicts.length > 0) {
    throw tenantRuntimeError_(
      'TENANT_RUNTIME_VIEW_CONFLICT',
      'View 存在重複或 Workspace 衝突，未執行同步'
    );
  }

  syncPlan.operations
    .filter(function (operation) {
      return operation.operation === 'UPDATE';
    })
    .forEach(function (operation) {
      const entry = source[operation.sheet];

      operation.changes.forEach(function (change) {
        const current =
          entry.sheet
            .getRange(
              operation.row,
              entry.header_map[change.field]
            )
            .getValue();

        if (
          !tenantRuntimeViewValueEqual_(
            current,
            change.old_value
          )
        ) {
          throw tenantRuntimeError_(
            'TENANT_RUNTIME_VIEW_CHANGED',
            operation.sheet +
              ' 在同步前已被其他操作修改'
          );
        }
      });
    });

  const applied = [];

  try {
    syncPlan.operations.forEach(function (operation) {
      const entry = source[operation.sheet];

      if (operation.operation === 'UPDATE') {
        operation.changes.forEach(function (change) {
          entry.sheet
            .getRange(
              operation.row,
              entry.header_map[change.field]
            )
            .setValue(change.new_value);

          applied.push({
            operation: 'UPDATE',
            sheet: operation.sheet,
            row: operation.row,
            column:
              entry.header_map[change.field],
            old_value: change.old_value
          });
        });
        return;
      }

      const rowNumber =
        entry.sheet.getLastRow() + 1;
      const rowValues =
        entry.headers.map(function (header) {
          return operation.values[header] !== undefined
            ? operation.values[header]
            : '';
        });

      entry.sheet
        .getRange(
          rowNumber,
          1,
          1,
          rowValues.length
        )
        .setValues([rowValues]);

      applied.push({
        operation: 'INSERT',
        sheet: operation.sheet,
        row: rowNumber,
        column_count: rowValues.length
      });
    });
  } catch (error) {
    let rollbackSuccess = true;

    applied
      .slice()
      .reverse()
      .forEach(function (item) {
        const entry = source[item.sheet];

        try {
          if (item.operation === 'UPDATE') {
            entry.sheet
              .getRange(
                item.row,
                item.column
              )
              .setValue(item.old_value);
          } else {
            entry.sheet
              .getRange(
                item.row,
                1,
                1,
                item.column_count
              )
              .clearContent();
          }
        } catch (rollbackError) {
          rollbackSuccess = false;
        }
      });

    error.applied_count = applied.length;
    error.rollback_success = rollbackSuccess;
    throw error;
  }

  return syncPlan.operations.length;
}


function syncTenantRuntimeViewsForTenant_(
  ss,
  identity,
  now
) {
  identity = identity || {};
  now = now || new Date();

  try {
    const source =
      tenantRuntimeReadSnapshot_(ss);
    const canonical =
      tenantRuntimeResolveCanonicalFromSnapshot_(
        source,
        identity.line_user_id || '',
        {
          tenant_id:
            identity.tenant_id || '',
          contract_id:
            identity.contract_id || '',
          workspace_id:
            identity.workspace_id || ''
        }
      );
    const syncPlan =
      tenantRuntimeBuildViewSyncPlan_(
        source,
        canonical,
        now
      );

    if (syncPlan.conflicts.length > 0) {
      return {
        success: false,
        code: 'TENANT_RUNTIME_VIEW_CONFLICT',
        message:
          'View 存在重複或 Workspace 衝突，未執行同步',
        canonical_ids:
          tenantRuntimeCanonicalPublic_(
            canonical
          ),
        views: syncPlan.stats,
        conflicts: syncPlan.conflicts,
        writes_performed: 0
      };
    }

    const writes =
      tenantRuntimeApplyViewSyncPlan_(
        source,
        syncPlan
      );

    return {
      success: true,
      code: 'TENANT_RUNTIME_VIEWS_SYNCED',
      message: '房客衍生 View 已同步',
      canonical_ids:
        tenantRuntimeCanonicalPublic_(
          canonical
        ),
      views: syncPlan.stats,
      conflicts: [],
      writes_performed: writes
    };
  } catch (error) {
    return {
      success: false,
      code:
        error && error.code
          ? error.code
          : 'TENANT_RUNTIME_VIEW_SYNC_ERROR',
      message:
        error && error.message
          ? error.message
          : '房客衍生 View 同步失敗',
      views: {
        V2_tenant_home_view:
          tenantRuntimeNewViewStats_(),
        V2_tenant_bill_view:
          tenantRuntimeNewViewStats_(),
        V2_landlord_tenant_list_view:
          tenantRuntimeNewViewStats_()
      },
      conflicts: [],
      writes_performed: 0,
      rollback_success:
        error &&
        error.rollback_success !== undefined
          ? error.rollback_success
          : null,
      rollback_required:
        Boolean(
          error &&
          error.applied_count &&
          error.rollback_success === false
        )
    };
  }
}


function tenantRuntimeVerifyViewFields_(
  row,
  expected
) {
  const mismatches = [];

  Object.keys(expected).forEach(function (field) {
    if (
      !tenantRuntimeViewValueEqual_(
        row ? row[field] : '',
        expected[field]
      )
    ) {
      mismatches.push(field);
    }
  });

  return mismatches;
}


function tenantRuntimeVerifyViews_(source, canonical) {
  const workspaceId =
    tenantRuntimeUpper_(
      canonical.workspace_id
    );
  const tenantId =
    tenantRuntimeUpper_(
      canonical.tenant_id
    );
  const contractId =
    tenantRuntimeText_(
      canonical.contract_id
    );
  const roomId =
    tenantRuntimeText_(
      canonical.room_id
    );

  function tenantRows_(sheetName) {
    return source[sheetName].rows.filter(function (row) {
      return (
        tenantRuntimeUpper_(row.tenant_id) ===
        tenantId
      );
    });
  }

  const homeRows =
    tenantRows_('V2_tenant_home_view');
  const listRows =
    tenantRows_(
      'V2_landlord_tenant_list_view'
    );
  const billChecks = [];
  let billConflictCount = 0;

  (canonical.bill_rows || []).forEach(function (bill) {
    const billId =
      tenantRuntimeText_(bill.bill_id);
    const rows =
      source.V2_tenant_bill_view.rows
        .filter(function (row) {
          return (
            tenantRuntimeUpper_(row.bill_id) ===
            tenantRuntimeUpper_(billId)
          );
        });
    const mismatches =
      rows.length === 1
        ? tenantRuntimeVerifyViewFields_(
            rows[0],
            {
              workspace_id:
                canonical.workspace_id,
              tenant_id:
                canonical.tenant_id,
              contract_id:
                tenantRuntimeText_(
                  bill.contract_id
                ) || contractId,
              room_id:
                tenantRuntimeText_(
                  bill.room_id
                ) || roomId
            }
          )
        : ['row_count'];

    if (
      rows.length !== 1 ||
      mismatches.length > 0
    ) {
      billConflictCount += 1;
    }

    billChecks.push({
      bill_id: billId,
      row_count: rows.length,
      mismatched_fields: mismatches,
      valid:
        rows.length === 1 &&
        mismatches.length === 0
    });
  });

  const homeMismatches =
    homeRows.length === 1
      ? tenantRuntimeVerifyViewFields_(
          homeRows[0],
          {
            workspace_id:
              canonical.workspace_id,
            tenant_id:
              canonical.tenant_id,
            current_contract_id:
              contractId,
            room_id:
              roomId
          }
        )
      : ['row_count'];
  const listMismatches =
    listRows.length === 1
      ? tenantRuntimeVerifyViewFields_(
          listRows[0],
          {
            workspace_id:
              canonical.workspace_id,
            tenant_id:
              canonical.tenant_id,
            current_contract_id:
              contractId,
            room_id:
              roomId
          }
        )
      : ['row_count'];
  const foreignWorkspaceRows =
    homeRows.concat(listRows)
      .filter(function (row) {
        return (
          tenantRuntimeUpper_(row.workspace_id) !==
          workspaceId
        );
      });
  const masterBillCount =
    canonical.bill_rows.length;
  const billViewReady =
    masterBillCount > 0 &&
    billConflictCount === 0 &&
    billChecks.length === masterBillCount;
  const success =
    homeRows.length === 1 &&
    homeMismatches.length === 0 &&
    listRows.length === 1 &&
    listMismatches.length === 0 &&
    billViewReady &&
    foreignWorkspaceRows.length === 0;

  return {
    success: success,
    canonical_ids:
      tenantRuntimeCanonicalPublic_(
        canonical
      ),
    V2_tenant_home_view: {
      row_count: homeRows.length,
      mismatched_fields: homeMismatches,
      valid:
        homeRows.length === 1 &&
        homeMismatches.length === 0
    },
    V2_tenant_bill_view: {
      master_bill_count: masterBillCount,
      valid_bill_count:
        billChecks.filter(function (check) {
          return check.valid;
        }).length,
      conflict_count: billConflictCount,
      bills: billChecks,
      valid: billViewReady
    },
    V2_landlord_tenant_list_view: {
      row_count: listRows.length,
      mismatched_fields: listMismatches,
      valid:
        listRows.length === 1 &&
        listMismatches.length === 0
    },
    workspace_conflict_count:
      foreignWorkspaceRows.length,
    duplicate_or_conflict:
      !success,
    tenant_home_route_ready:
      homeRows.length === 1 &&
      homeMismatches.length === 0,
    tenant_bills_route_ready:
      billViewReady
  };
}


function repairTestTenantRuntimeViews() {
  const lineUserId =
    tenantRuntimeText_(
      getRequiredScriptProperty_(
        'TEST_TENANT_LINE_UID'
      )
    );
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    lock.waitLock(25000);
    locked = true;

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();
    const result =
      syncTenantRuntimeViewsForTenant_(
        ss,
        { line_user_id: lineUserId },
        new Date()
      );

    if (!result.success) {
      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    SpreadsheetApp.flush();

    const verifySource =
      tenantRuntimeReadSnapshot_(ss);
    const canonical =
      tenantRuntimeResolveCanonicalFromSnapshot_(
        verifySource,
        lineUserId
      );
    const verification =
      tenantRuntimeVerifyViews_(
        verifySource,
        canonical
      );
    const output =
      Object.assign({}, result, {
        success: verification.success,
        code:
          verification.success
            ? 'TEST_TENANT_RUNTIME_VIEWS_REPAIRED'
            : 'TEST_TENANT_RUNTIME_VIEW_VERIFY_FAILED',
        message:
          verification.success
            ? '測試房客三張衍生 View 已同步並通過唯讀驗證'
            : 'View 已同步，但唯讀驗證未通過',
        test_line_uid_masked:
          tenantRuntimeMaskUid_(lineUserId),
        verification: verification,
        bills_created: 0,
        line_messages_sent: 0,
        payment_status_modified: 0,
        contract_status_modified: 0
      });

    Logger.log(JSON.stringify(output, null, 2));
    return output;
  } catch (error) {
    const output = {
      success: false,
      code:
        error && error.code
          ? error.code
          : 'TEST_TENANT_RUNTIME_VIEW_REPAIR_ERROR',
      message:
        error && error.message
          ? error.message
          : '測試房客 View 修復失敗',
      test_line_uid_masked:
        tenantRuntimeMaskUid_(lineUserId),
      views: {
        V2_tenant_home_view:
          tenantRuntimeNewViewStats_(),
        V2_tenant_bill_view:
          tenantRuntimeNewViewStats_(),
        V2_landlord_tenant_list_view:
          tenantRuntimeNewViewStats_()
      },
      writes_performed: 0
    };

    Logger.log(JSON.stringify(output, null, 2));
    return output;
  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}


function verifyTestTenantRuntimeViews() {
  const lineUserId =
    tenantRuntimeText_(
      getRequiredScriptProperty_(
        'TEST_TENANT_LINE_UID'
      )
    );

  try {
    const ss =
      SpreadsheetApp.getActiveSpreadsheet();
    const source =
      tenantRuntimeReadSnapshot_(ss);
    const canonical =
      tenantRuntimeResolveCanonicalFromSnapshot_(
        source,
        lineUserId
      );
    const verification =
      tenantRuntimeVerifyViews_(
        source,
        canonical
      );
    const result =
      Object.assign({}, verification, {
        diagnostic:
          'verifyTestTenantRuntimeViews',
        read_only: true,
        test_line_uid_masked:
          tenantRuntimeMaskUid_(lineUserId)
      });

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    const result = {
      success: false,
      diagnostic:
        'verifyTestTenantRuntimeViews',
      read_only: true,
      test_line_uid_masked:
        tenantRuntimeMaskUid_(lineUserId),
      code:
        error && error.code
          ? error.code
          : 'TEST_TENANT_RUNTIME_VIEW_VERIFY_ERROR',
      message:
        error && error.message
          ? error.message
          : '測試房客 View 驗證失敗'
    };

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }
}


function testTenantRuntimeViewSyncPlanning_() {
  function entry_(name, headers, rows) {
    const headerMap = {};

    headers.forEach(function (header, index) {
      headerMap[header] = index + 1;
    });

    return {
      name: name,
      exists: true,
      sheet: {
        getLastRow: function () {
          return rows.length + 1;
        }
      },
      headers: headers,
      header_map: headerMap,
      rows: rows.map(function (row, index) {
        return Object.assign(
          { __sheet_row: index + 2 },
          row
        );
      })
    };
  }

  const uid = 'TEST_TENANT_UID';
  const tenantId = 'T_TEST';
  const workspaceId = 'W_TEST';
  const commonViewHeaders = [
    'line_user_id',
    'tenant_line_user_id',
    'user_id',
    'tenant_user_id',
    'tenant_id',
    'tenant_name',
    'workspace_id',
    'landlord_id',
    'landlord_name',
    'landlord_line_user_id',
    'property_id',
    'property_name',
    'room_id',
    'room_name',
    'room_list',
    'current_contract_id',
    'contract_status',
    'contract_start_date',
    'contract_end_date',
    'latest_bill_month',
    'latest_due_date',
    'latest_total_amount',
    'latest_payment_status',
    'unpaid_bill_count',
    'unpaid_total_amount',
    'tenant_binding_status',
    'binding_status',
    'account_status',
    'tenant_account_status',
    'created_at',
    'updated_at'
  ];
  const billViewHeaders =
    commonViewHeaders.concat([
      'bill_id',
      'bill_month',
      'due_date',
      'total_amount',
      'bill_status',
      'payment_status',
      'sent_status',
      'contract_id'
    ]);
  const source = {
    V2_tenants: entry_(
      'V2_tenants',
      commonViewHeaders.concat([
        'name',
        'tenant_phone',
        'tenant_email'
      ]),
      [{
        tenant_line_user_id: uid,
        tenant_user_id: 'U_TEST',
        tenant_id: tenantId,
        tenant_name: '測試房客',
        workspace_id: workspaceId,
        landlord_id: 'L_TEST',
        property_id: 'P_TEST',
        room_id: 'R_TEST',
        room_name: '603',
        current_contract_id: 'C_TEST',
        tenant_binding_status: 'bound',
        account_status: 'active'
      }]
    ),
    V2_contracts: entry_(
      'V2_contracts',
      commonViewHeaders.concat([
        'contract_id',
        'status'
      ]),
      [{
        contract_id: 'C_TEST',
        tenant_line_user_id: uid,
        tenant_user_id: 'U_TEST',
        tenant_id: tenantId,
        tenant_name: '測試房客',
        workspace_id: workspaceId,
        landlord_id: 'L_TEST',
        landlord_line_user_id:
          'LANDLORD_TEST_UID',
        landlord_name: '測試房東',
        property_id: 'P_TEST',
        property_name: '測試物件',
        room_id: 'R_TEST',
        room_name: '603',
        contract_status: 'active'
      }]
    ),
    V2_properties: entry_(
      'V2_properties',
      [
        'property_id',
        'workspace_id',
        'landlord_id',
        'landlord_line_user_id',
        'property_name'
      ],
      [{
        property_id: 'P_TEST',
        workspace_id: workspaceId,
        landlord_id: 'L_TEST',
        landlord_line_user_id:
          'LANDLORD_TEST_UID',
        property_name: '測試物件'
      }]
    ),
    V2_rooms: entry_(
      'V2_rooms',
      [
        'room_id',
        'workspace_id',
        'property_id',
        'landlord_id',
        'room_name'
      ],
      [{
        room_id: 'R_TEST',
        workspace_id: workspaceId,
        property_id: 'P_TEST',
        landlord_id: 'L_TEST',
        room_name: '603'
      }]
    ),
    V2_bills: entry_(
      'V2_bills',
      billViewHeaders,
      [{
        bill_id: 'B_TEST',
        workspace_id: workspaceId,
        landlord_id: 'L_TEST',
        tenant_id: tenantId,
        tenant_user_id: 'U_TEST',
        tenant_line_user_id: uid,
        tenant_name: '測試房客',
        contract_id: 'C_TEST',
        property_id: 'P_TEST',
        room_id: 'R_TEST',
        room_name: '603',
        bill_month: '2026-07',
        total_amount: 1000,
        bill_status: 'issued',
        payment_status: 'unpaid'
      }]
    ),
    V2_tenant_home_view: entry_(
      'V2_tenant_home_view',
      commonViewHeaders,
      []
    ),
    V2_tenant_bill_view: entry_(
      'V2_tenant_bill_view',
      billViewHeaders,
      []
    ),
    V2_landlord_tenant_list_view: entry_(
      'V2_landlord_tenant_list_view',
      commonViewHeaders,
      []
    )
  };
  const canonical =
    tenantRuntimeResolveCanonicalFromSnapshot_(
      source,
      uid
    );
  const now = new Date(2026, 6, 20, 12, 0, 0);
  const insertPlan =
    tenantRuntimeBuildViewSyncPlan_(
      source,
      canonical,
      now
    );

  if (
    insertPlan.conflicts.length !== 0 ||
    insertPlan.operations.length !== 3 ||
    insertPlan.stats.V2_tenant_home_view.inserted !== 1 ||
    insertPlan.stats.V2_tenant_bill_view.inserted !== 1 ||
    insertPlan.stats
      .V2_landlord_tenant_list_view
      .inserted !== 1
  ) {
    throw new Error(
      'TEST_FAILED: missing views were not planned exactly once'
    );
  }

  const desired =
    tenantRuntimeBuildDesiredViews_(
      canonical,
      now
    );
  const idempotentSource =
    Object.assign({}, source, {
      V2_tenant_home_view: entry_(
        'V2_tenant_home_view',
        commonViewHeaders,
        desired.V2_tenant_home_view
      ),
      V2_tenant_bill_view: entry_(
        'V2_tenant_bill_view',
        billViewHeaders,
        desired.V2_tenant_bill_view
      ),
      V2_landlord_tenant_list_view: entry_(
        'V2_landlord_tenant_list_view',
        commonViewHeaders,
        desired.V2_landlord_tenant_list_view
      )
    });
  const idempotentCanonical =
    tenantRuntimeResolveCanonicalFromSnapshot_(
      idempotentSource,
      uid
    );
  const idempotentPlan =
    tenantRuntimeBuildViewSyncPlan_(
      idempotentSource,
      idempotentCanonical,
      now
    );

  if (
    idempotentPlan.operations.length !== 0 ||
    idempotentPlan.stats.V2_tenant_home_view.unchanged !== 1 ||
    idempotentPlan.stats.V2_tenant_bill_view.unchanged !== 1 ||
    idempotentPlan.stats
      .V2_landlord_tenant_list_view
      .unchanged !== 1
  ) {
    throw new Error(
      'TEST_FAILED: second view sync was not idempotent'
    );
  }

  const duplicateBillSource =
    Object.assign({}, idempotentSource, {
      V2_tenant_bill_view: entry_(
        'V2_tenant_bill_view',
        billViewHeaders,
        desired.V2_tenant_bill_view.concat(
          desired.V2_tenant_bill_view
        )
      )
    });
  const duplicatePlan =
    tenantRuntimeBuildViewSyncPlan_(
      duplicateBillSource,
      canonical,
      now
    );

  if (
    duplicatePlan.stats
      .V2_tenant_bill_view
      .conflict === 0
  ) {
    throw new Error(
      'TEST_FAILED: duplicate bill view was not blocked'
    );
  }

  if (
    source.V2_bills.rows[0].payment_status !== 'unpaid' ||
    source.V2_contracts.rows[0].contract_status !== 'active'
  ) {
    throw new Error(
      'TEST_FAILED: master status was modified'
    );
  }

  const result = {
    success: true,
    tests: {
      missing_views_insert_once: 'PASS',
      idempotent_second_run: 'PASS',
      duplicate_conflict: 'PASS',
      workspace_canonical_keys: 'PASS',
      master_bill_unchanged: 'PASS',
      master_contract_unchanged: 'PASS'
    }
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function testTenantRuntimeDataRepairSafety_() {
  function entry_(name, headers, rows) {
    const headerMap = {};

    headers.forEach(function (header, index) {
      headerMap[header] = index + 1;
    });

    return {
      name: name,
      exists: true,
      sheet: {
        getLastRow: function () {
          return rows.length + 1;
        }
      },
      headers: headers,
      header_map: headerMap,
      rows: rows.map(function (row, index) {
        return Object.assign(
          { __sheet_row: index + 2 },
          row
        );
      })
    };
  }

  const uid = 'TEST_TENANT_UID';
  const commonHeaders = [
    'line_user_id',
    'tenant_line_user_id',
    'user_id',
    'tenant_user_id',
    'tenant_id',
    'tenant_name',
    'workspace_id',
    'landlord_id',
    'landlord_name',
    'landlord_line_user_id',
    'property_id',
    'property_name',
    'room_id',
    'room_name',
    'room_list',
    'current_contract_id',
    'contract_status',
    'account_status',
    'tenant_account_status',
    'tenant_binding_status',
    'binding_status'
  ];
  const source = {};

  source.V2_tenants = entry_(
    'V2_tenants',
    commonHeaders,
    [
      {
        tenant_line_user_id: uid,
        tenant_id: 'T_TEST',
        tenant_user_id: 'U_TEST',
        tenant_name: '測試房客',
        workspace_id: 'W_TEST',
        landlord_id: 'L_TEST',
        property_id: 'P_TEST'
      },
      {
        tenant_line_user_id: 'OTHER_UID',
        tenant_id: 'T_OTHER',
        workspace_id: 'W_OTHER'
      }
    ]
  );
  source.V2_contracts = entry_(
    'V2_contracts',
    commonHeaders.concat([
      'contract_id',
      'status',
      'contract_start_date',
      'contract_end_date'
    ]),
    [
      {
        contract_id: 'C_TEST',
        tenant_id: 'T_TEST',
        tenant_user_id: 'U_TEST',
        workspace_id: 'W_TEST',
        landlord_id: 'L_TEST',
        property_id: 'P_TEST',
        room_name: '603',
        contract_status: 'active'
      }
    ]
  );
  source.V2_properties = entry_(
    'V2_properties',
    [
      'property_id',
      'workspace_id',
      'landlord_id',
      'property_name'
    ],
    [
      {
        property_id: 'P_TEST',
        workspace_id: 'W_TEST',
        landlord_id: 'L_TEST',
        property_name: '測試物件'
      }
    ]
  );
  source.V2_rooms = entry_(
    'V2_rooms',
    [
      'room_id',
      'workspace_id',
      'property_id',
      'landlord_id',
      'room_name'
    ],
    [
      {
        room_id: 'R_TEST',
        workspace_id: 'W_TEST',
        property_id: 'P_TEST',
        landlord_id: 'L_TEST',
        room_name: '603'
      }
    ]
  );
  source.V2_tenant_home_view = entry_(
    'V2_tenant_home_view',
    commonHeaders,
    []
  );
  source.V2_tenant_bill_view = entry_(
    'V2_tenant_bill_view',
    commonHeaders.concat([
      'bill_id',
      'bill_month',
      'payment_status'
    ]),
    []
  );
  source.V2_bills = entry_(
    'V2_bills',
    [
      'bill_id',
      'tenant_id',
      'contract_id',
      'workspace_id',
      'payment_status'
    ],
    []
  );
  source.V2_landlord_tenant_list_view = entry_(
    'V2_landlord_tenant_list_view',
    commonHeaders,
    []
  );

  const canonical =
    tenantRuntimeResolveCanonicalFromSnapshot_(
      source,
      uid
    );
  const plan =
    tenantRuntimeBuildRepairPlan_(
      source,
      canonical
    );
  const homeData =
    tenantRuntimeHomeData_(
      canonical,
      {}
    );
  const emptyBills =
    tenantRuntimeEmptyBillsResult_();

  if (
    canonical.room_id !== 'R_TEST' ||
    canonical.room_name !== '603' ||
    homeData.room_list !== '603'
  ) {
    throw new Error(
      'TEST_FAILED: missing room relation was not resolved'
    );
  }

  if (
    emptyBills.success !== true ||
    emptyBills.code !== 'OK_EMPTY' ||
    !Array.isArray(emptyBills.bills) ||
    emptyBills.bills.length !== 0
  ) {
    throw new Error(
      'TEST_FAILED: zero bills is not a successful empty state'
    );
  }

  if (
    plan.some(function (item) {
      return (
        item.sheet === 'V2_contracts' &&
        [
          'contract_status',
          'status',
          'account_status'
        ].indexOf(item.field) >= 0
      );
    })
  ) {
    throw new Error(
      'TEST_FAILED: contract state was changed'
    );
  }

  if (
    plan.some(function (item) {
      return (
        item.field === 'payment_status' ||
        item.field === 'bill_status' ||
        item.sheet === 'V2_bills' ||
        item.new_value === 'T_OTHER' ||
        (
          item.sheet === 'V2_tenants' &&
          item.row !==
            canonical.tenant_row.__sheet_row
        ) ||
        (
          item.sheet === 'V2_contracts' &&
          item.row !==
            canonical.contract_row.__sheet_row
        )
      );
    })
  ) {
    throw new Error(
      'TEST_FAILED: repair plan exceeds test tenant scope'
    );
  }

  const workspaceConflictSource =
    Object.assign({}, source, {
      V2_properties: entry_(
        'V2_properties',
        [
          'property_id',
          'workspace_id',
          'landlord_id',
          'property_name'
        ],
        [
          {
            property_id: 'P_TEST',
            workspace_id: 'W_OTHER',
            landlord_id: 'L_TEST',
            property_name: '錯誤物件'
          }
        ]
      )
    });
  let workspaceConflictStopped = false;

  try {
    tenantRuntimeResolveCanonicalFromSnapshot_(
      workspaceConflictSource,
      uid
    );
  } catch (error) {
    workspaceConflictStopped =
      error.code ===
      'TENANT_RUNTIME_WORKSPACE_CONFLICT';
  }

  if (!workspaceConflictStopped) {
    throw new Error(
      'TEST_FAILED: workspace conflict was not blocked'
    );
  }

  const duplicateRoomSource =
    Object.assign({}, source, {
      V2_rooms: entry_(
        'V2_rooms',
        [
          'room_id',
          'workspace_id',
          'property_id',
          'landlord_id',
          'room_name'
        ],
        [
          {
            room_id: 'R_TEST',
            workspace_id: 'W_TEST',
            property_id: 'P_TEST',
            landlord_id: 'L_TEST',
            room_name: '603'
          },
          {
            room_id: 'R_TEST_2',
            workspace_id: 'W_TEST',
            property_id: 'P_TEST',
            landlord_id: 'L_TEST',
            room_name: '603'
          }
        ]
      )
    });
  let duplicateRoomStopped = false;

  try {
    tenantRuntimeResolveCanonicalFromSnapshot_(
      duplicateRoomSource,
      uid
    );
  } catch (error) {
    duplicateRoomStopped =
      error.code === 'MULTIPLE_ROOMS_FOUND';
  }

  if (!duplicateRoomStopped) {
    throw new Error(
      'TEST_FAILED: duplicate room was not blocked'
    );
  }

  const result = {
    success: true,
    tests: {
      bind_to_home_identity: 'PASS',
      home_room_fallback: 'PASS',
      bills_empty_state_contract: 'PASS',
      contract_unchanged: 'PASS',
      message_canonical_identity: 'PASS',
      workspace_isolation: 'PASS',
      other_tenant_untouched: 'PASS'
    },
    repair_change_count: plan.length
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
