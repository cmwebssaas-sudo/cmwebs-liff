/**
 * CMWebs V2 Tenant runtime read resolver.
 *
 * Production read ownership:
 * - canonical tenant identity resolution;
 * - tenant -> active contract -> property -> room -> landlord chain;
 * - Workspace isolation;
 * - deterministic landlord-link selection;
 * - Tenant Home read projection.
 *
 * This module must remain read-only. It contains no repair, migration,
 * rollback, derived-View synchronization, Sheet write or LINE push.
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
    runtimeSnapshotGetValues_(sheet);

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


function tenantRuntimeReadSnapshot_(ss, options) {
  options = options || {};
  const source = {};

  Object.keys(
    V2_TENANT_RUNTIME_DATA_SHEETS_
  ).forEach(function (key) {
    if (
      key === 'bills' &&
      options.include_bill_master === false
    ) {
      return;
    }

    if (
      key === 'landlordTenantListView' &&
      options.include_landlord_tenant_list_view === false
    ) {
      return;
    }

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


function tenantRuntimeSelectLandlordLink_(rows, canonical) {
  const expected = {
    workspace_id:
      tenantRuntimeUpper_(canonical.workspace_id),
    tenant_id:
      tenantRuntimeUpper_(canonical.tenant_id),
    tenant_user_id:
      tenantRuntimeUpper_(canonical.tenant_user_id),
    contract_id:
      tenantRuntimeUpper_(canonical.contract_id),
    room_id:
      tenantRuntimeUpper_(canonical.room_id),
    landlord_id:
      tenantRuntimeUpper_(canonical.landlord_id),
    line_user_id:
      tenantRuntimeText_(canonical.line_user_id)
  };
  const exact = [];
  const incomplete = [];
  const conflicts = [];

  (rows || []).forEach(function (row) {
    const actual = {
      workspace_id:
        tenantRuntimeUpper_(row.workspace_id),
      tenant_id:
        tenantRuntimeUpper_(row.tenant_id),
      tenant_user_id:
        tenantRuntimeUpper_(
          tenantRuntimeFirst_(
            row,
            ['tenant_user_id', 'user_id']
          )
        ),
      contract_id:
        tenantRuntimeUpper_(
          tenantRuntimeFirst_(
            row,
            ['contract_id', 'current_contract_id']
          )
        ),
      room_id:
        tenantRuntimeUpper_(row.room_id),
      landlord_id:
        tenantRuntimeUpper_(row.landlord_id)
    };
    const lineIds =
      tenantRuntimeUniqueValues_([
        row.tenant_line_user_id,
        row.tenant_line_uid
      ]);
    const related =
      actual.tenant_id === expected.tenant_id ||
      (
        actual.tenant_user_id &&
        actual.tenant_user_id ===
          expected.tenant_user_id
      ) ||
      (
        actual.contract_id &&
        actual.contract_id === expected.contract_id
      ) ||
      lineIds.indexOf(expected.line_user_id) >= 0;

    if (!related) {
      return;
    }

    const conflictingFields = [];

    Object.keys(actual).forEach(function (field) {
      if (
        actual[field] &&
        expected[field] &&
        actual[field] !== expected[field]
      ) {
        conflictingFields.push(field);
      }
    });

    if (
      lineIds.some(function (value) {
        return value !== expected.line_user_id;
      })
    ) {
      conflictingFields.push('tenant_line_uid');
    }

    const status =
      tenantRuntimeFirst_(
        row,
        [
          'relationship_status',
          'link_status',
          'status',
          'contract_status',
          'account_status'
        ]
      ).toLowerCase();
    const statusCompatible =
      !status ||
      [
        'active',
        'valid',
        'current',
        'enabled',
        'bound',
        '啟用',
        '有效'
      ].indexOf(status) >= 0;

    if (!statusCompatible) {
      conflictingFields.push('status');
    }

    if (conflictingFields.length > 0) {
      conflicts.push({
        row: row,
        fields:
          tenantRuntimeUniqueValues_(
            conflictingFields
          )
      });
      return;
    }

    const requiredFields = [
      'workspace_id',
      'tenant_id',
      'contract_id',
      'room_id',
      'landlord_id'
    ];
    const missingFields =
      requiredFields.filter(function (field) {
        return !actual[field];
      });
    const candidate = {
      row: row,
      missing_fields: missingFields,
      status: status
    };

    if (missingFields.length === 0) {
      exact.push(candidate);
    } else {
      incomplete.push(candidate);
    }
  });

  if (conflicts.length > 0) {
    throw tenantRuntimeError_(
      'CONFLICTING_TENANT_LANDLORD_LINKS',
      '房客與房東關聯 view 存在真實衝突'
    );
  }

  if (exact.length === 0) {
    if (incomplete.length > 0) {
      throw tenantRuntimeError_(
        'TENANT_LANDLORD_LINK_INCOMPLETE',
        '房客與房東關聯 view 缺少 canonical 欄位'
      );
    }

    return {
      row: null,
      diagnostics: {
        exact_count: 0,
        compatible_legacy_count: 0,
        equivalent_duplicate_count: 0,
        warning: 'TENANT_LANDLORD_LINK_NOT_FOUND'
      }
    };
  }

  const signatures = {};

  exact.forEach(function (candidate) {
    const row = candidate.row;
    const signature = JSON.stringify({
      workspace_id:
        tenantRuntimeUpper_(row.workspace_id),
      tenant_id:
        tenantRuntimeUpper_(row.tenant_id),
      tenant_user_id:
        tenantRuntimeUpper_(
          tenantRuntimeFirst_(
            row,
            ['tenant_user_id', 'user_id']
          )
        ),
      contract_id:
        tenantRuntimeUpper_(
          tenantRuntimeFirst_(
            row,
            ['contract_id', 'current_contract_id']
          )
        ),
      room_id:
        tenantRuntimeUpper_(row.room_id),
      landlord_id:
        tenantRuntimeUpper_(row.landlord_id),
      landlord_line_user_id:
        tenantRuntimeText_(
          tenantRuntimeFirst_(
            row,
            [
              'landlord_line_user_id',
              'landlord_line_uid'
            ]
          )
        ),
      status: candidate.status
    });

    signatures[signature] = true;
  });

  if (Object.keys(signatures).length > 1) {
    throw tenantRuntimeError_(
      'CONFLICTING_TENANT_LANDLORD_LINKS',
      '多筆完整房客與房東關聯的保護欄位不一致'
    );
  }

  exact.sort(function (left, right) {
    const leftTime =
      new Date(
        left.row.updated_at || 0
      ).getTime() || 0;
    const rightTime =
      new Date(
        right.row.updated_at || 0
      ).getTime() || 0;

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return (
      Number(left.row.__sheet_row || 0) -
      Number(right.row.__sheet_row || 0)
    );
  });

  return {
    row: exact[0].row,
    diagnostics: {
      exact_count: exact.length,
      compatible_legacy_count: incomplete.length,
      equivalent_duplicate_count:
        Math.max(0, exact.length - 1),
      warning:
        incomplete.length > 0
          ? 'COMPATIBLE_LEGACY_LINK_IGNORED'
          : (
              exact.length > 1
                ? 'EQUIVALENT_DUPLICATE_LINKS_COLLAPSED'
                : ''
            )
    }
  };
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
    room_id: roomId,
    landlord_id:
      tenantRuntimeRequireConsistentValue_(
        [
          tenant.landlord_id,
          contract.landlord_id,
          property.landlord_id
        ],
        'LANDLORD_ID_MISSING',
        'LANDLORD_ID_CONFLICT',
        'landlord_id'
      )
  };

  const landlordLinkRows =
    options.include_landlord_tenant_list_view === false
      ? []
      : tenantRuntimeRequireSheet_(
          source,
          V2_TENANT_RUNTIME_DATA_SHEETS_
            .landlordTenantListView
        ).rows;
  const landlordLinkSelection =
    tenantRuntimeSelectLandlordLink_(
      landlordLinkRows,
      seed
    );
  const landlordLink =
    landlordLinkSelection.row;

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
              'landlord_line_uid'
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

  canonical.landlord_link_diagnostics =
    landlordLinkSelection.diagnostics;

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

  const includeBillMaster =
    options.include_bill_master !== false;

  canonical.bill_rows = includeBillMaster
    ? tenantRuntimeRowsRelatedToTenant_(
        tenantRuntimeRequireSheet_(
          source,
          V2_TENANT_RUNTIME_DATA_SHEETS_.bills
        ).rows,
        canonical,
        { include_generic_line: false }
      )
    : [];

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
  lineUserId,
  options
) {
  try {
    options = options || {};
    const contextKey = [
      tenantRuntimeUpper_(lineUserId),
      tenantRuntimeUpper_(options.tenant_id),
      tenantRuntimeUpper_(options.contract_id),
      tenantRuntimeUpper_(options.workspace_id),
      options.include_bill_master === false
        ? 'NO_BILL_MASTER'
        : 'WITH_BILL_MASTER',
      options.include_landlord_tenant_list_view === false
        ? 'NO_LANDLORD_TENANT_LIST_VIEW'
        : 'WITH_LANDLORD_TENANT_LIST_VIEW'
    ].join('|');
    const cachedContext =
      runtimeSnapshotGetContext_(
        'tenant_runtime',
        contextKey
      );

    if (cachedContext) {
      runtimeSnapshotRecordAvoidedReads_(
        8 -
        (
          options.include_bill_master === false
            ? 1
            : 0
        ) -
        (
          options.include_landlord_tenant_list_view === false
            ? 1
            : 0
        )
      );

      return {
        success: true,
        code: 'OK',
        message: '房客 runtime 身份解析成功',
        data: cachedContext
      };
    }

    const ss =
      runtimeSpreadsheet_();
    const source =
      tenantRuntimeReadSnapshot_(
        ss,
        options
      );

    const canonical =
      tenantRuntimeResolveCanonicalFromSnapshot_(
        source,
        lineUserId,
        options
      );

    runtimeSnapshotSetContext_(
      'tenant_runtime',
      contextKey,
      canonical
    );

    return {
      success: true,
      code: 'OK',
      message: '房客 runtime 身份解析成功',
      data: canonical
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
