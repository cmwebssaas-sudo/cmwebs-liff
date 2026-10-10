/**
 * 檢查 603 帳單目前在 V2 的實際狀態
 */
function testInspectRoom603Bill() {
  const ss =
    runtimeSpreadsheet_();

  const billId =
    'BILL-202607-C000019';

  const billSheet =
    ss.getSheetByName(
      'V2_bills'
    );

  const paymentSheet =
    ss.getSheetByName(
      'V2_payments'
    );

  const reportSheet =
    ss.getSheetByName(
      'V2_payment_reports'
    );

  if (!billSheet) {
    throw new Error(
      '找不到 V2_bills'
    );
  }

  function getObjects(sheet) {
    if (
      !sheet ||
      sheet.getLastRow() < 2
    ) {
      return [];
    }

    const values =
      sheet
        .getDataRange()
        .getValues();

    const headers =
      values[0].map(function (value) {
        return String(
          value || ''
        ).trim();
      });

    return values
      .slice(1)
      .map(function (row, index) {
        const object = {
          _sheet_row:
            index + 2
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
      });
  }

  const bills =
    getObjects(
      billSheet
    );

  const payments =
    getObjects(
      paymentSheet
    );

  const reports =
    getObjects(
      reportSheet
    );

  const matchedBills =
    bills.filter(function (row) {
      return (
        String(
          row.bill_id || ''
        ).trim() === billId ||
        String(
          row.room_name || ''
        ).trim() === '603'
      );
    });

  const matchedPayments =
    payments.filter(function (row) {
      return (
        String(
          row.bill_id || ''
        ).trim() === billId
      );
    });

  const matchedReports =
    reports.filter(function (row) {
      return (
        String(
          row.bill_id || ''
        ).trim() === billId
      );
    });

  const result = {
    bill_id:
      billId,

    bills:
      matchedBills.map(function (row) {
        return {
          sheet_row:
            row._sheet_row,

          bill_id:
            row.bill_id || '',

          landlord_id:
            row.landlord_id || '',

          tenant_id:
            row.tenant_id || '',

          room_name:
            row.room_name || '',

          bill_month:
            row.bill_month || '',

          payment_status:
            row.payment_status || '',

          payment_id:
            row.payment_id || '',

          paid_at:
            row.paid_at || '',

          reopened_at:
            row.reopened_at || '',

          reopen_reason:
            row.reopen_reason || '',

          reversal_id:
            row.reversal_id || '',

          updated_at:
            row.updated_at || ''
        };
      }),

    payments:
      matchedPayments.map(function (row) {
        return {
          sheet_row:
            row._sheet_row,

          payment_id:
            row.payment_id || '',

          status:
            row.status || '',

          bill_id:
            row.bill_id || '',

          reversal_id:
            row.reversal_id || '',

          void_reason:
            row.void_reason || '',

          voided_at:
            row.voided_at || ''
        };
      }),

    reports:
      matchedReports.map(function (row) {
        return {
          sheet_row:
            row._sheet_row,

          report_id:
            row.report_id || '',

          status:
            row.status || '',

          matched_payment_id:
            row.matched_payment_id || '',

          reversal_id:
            row.reversal_id || '',

          void_reason:
            row.void_reason || ''
        };
      })
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


/**
 * 唯讀診斷 TEST_TENANT_LINE_UID 在 Tenant runtime read models 的一致性。
 *
 * 本函式不得呼叫任何 route/repair/migration handler，避免存取紀錄或
 * 其他隱性寫入。唯一允許的外部操作為 Script Property 讀取、
 * Spreadsheet 讀取與 Logger 輸出。
 */
function diagnoseTestTenantRuntimeData() {
  const testLineUserId =
    String(
      getRequiredScriptProperty_(
        'TEST_TENANT_LINE_UID'
      )
    ).trim();

  const ss =
    runtimeSpreadsheet_();

  const sheetNames = [
    'V2_tenants',
    'V2_contracts',
    'V2_tenant_home_view',
    'V2_tenant_bill_view',
    'V2_bills',
    'V2_landlord_tenant_list_view',
    'V2_rooms',
    'V2_properties'
  ];

  function text_(value) {
    return String(
      value === undefined ||
      value === null
        ? ''
        : value
    ).trim();
  }

  function upper_(value) {
    return text_(value).toUpperCase();
  }

  function first_(row, keys) {
    for (
      let index = 0;
      index < keys.length;
      index += 1
    ) {
      const value =
        text_(row[keys[index]]);

      if (value) {
        return value;
      }
    }

    return '';
  }

  function readSheet_(sheetName) {
    const sheet =
      ss.getSheetByName(sheetName);

    if (!sheet) {
      return {
        sheet_exists: false,
        total_row_count: 0,
        rows: []
      };
    }

    const values =
      sheet
        .getDataRange()
        .getValues();

    if (
      !values ||
      values.length < 2
    ) {
      return {
        sheet_exists: true,
        total_row_count: 0,
        rows: []
      };
    }

    const headers =
      values[0].map(text_);

    const rows =
      values
        .slice(1)
        .filter(function (row) {
          return row.some(function (cell) {
            return (
              cell !== '' &&
              cell !== null
            );
          });
        })
        .map(function (row, index) {
          const object = {
            __sheet_row:
              index + 2
          };

          headers.forEach(
            function (header, column) {
              if (header) {
                object[header] =
                  row[column];
              }
            }
          );

          return object;
        });

    return {
      sheet_exists: true,
      total_row_count:
        rows.length,
      rows: rows
    };
  }

  const source = {};

  sheetNames.forEach(
    function (sheetName) {
      source[sheetName] =
        readSheet_(sheetName);
    }
  );

  const ids = {
    tenant_id: {},
    user_id: {},
    contract_id: {},
    workspace_id: {},
    landlord_id: {},
    property_id: {},
    room_id: {}
  };

  function addId_(group, value) {
    const normalized =
      upper_(value);

    if (normalized) {
      ids[group][normalized] =
        text_(value);
    }
  }

  function hasId_(group, value) {
    const normalized =
      upper_(value);

    return Boolean(
      normalized &&
      ids[group][normalized]
    );
  }

  function directIdentityMatch_(row) {
    return [
      row.line_user_id,
      row.tenant_line_user_id,
      row.tenant_line_uid
    ].some(function (value) {
      return (
        text_(value) ===
        testLineUserId
      );
    });
  }

  function absorbIds_(row) {
    addId_(
      'tenant_id',
      first_(row, [
        'tenant_id'
      ])
    );

    addId_(
      'user_id',
      first_(row, [
        'tenant_user_id',
        'user_id'
      ])
    );

    addId_(
      'contract_id',
      first_(row, [
        'contract_id',
        'current_contract_id'
      ])
    );

    addId_(
      'workspace_id',
      row.workspace_id
    );

    addId_(
      'landlord_id',
      row.landlord_id
    );

    addId_(
      'property_id',
      row.property_id
    );

    addId_(
      'room_id',
      row.room_id
    );
  }

  function linkedMatch_(sheetName, row) {
    if (directIdentityMatch_(row)) {
      return true;
    }

    if (
      hasId_(
        'tenant_id',
        row.tenant_id
      ) ||
      hasId_(
        'user_id',
        first_(row, [
          'tenant_user_id',
          'user_id'
        ])
      ) ||
      hasId_(
        'contract_id',
        first_(row, [
          'contract_id',
          'current_contract_id'
        ])
      )
    ) {
      return true;
    }

    if (
      sheetName === 'V2_rooms'
    ) {
      return hasId_(
        'room_id',
        row.room_id
      );
    }

    if (
      sheetName === 'V2_properties'
    ) {
      return hasId_(
        'property_id',
        row.property_id
      );
    }

    return false;
  }

  const matched = {};
  const matchedRows = {};

  sheetNames.forEach(
    function (sheetName) {
      matched[sheetName] = [];
      matchedRows[sheetName] = {};
    }
  );

  function includeRow_(sheetName, row) {
    const rowNumber =
      String(row.__sheet_row);

    if (matchedRows[sheetName][rowNumber]) {
      return false;
    }

    matchedRows[sheetName][rowNumber] =
      true;
    matched[sheetName].push(row);
    absorbIds_(row);

    return true;
  }

  sheetNames.forEach(
    function (sheetName) {
      source[sheetName].rows.forEach(
        function (row) {
          if (directIdentityMatch_(row)) {
            includeRow_(
              sheetName,
              row
            );
          }
        }
      );
    }
  );

  for (
    let pass = 0;
    pass < sheetNames.length;
    pass += 1
  ) {
    let changed = false;

    sheetNames.forEach(
      function (sheetName) {
        source[sheetName].rows.forEach(
          function (row) {
            if (
              linkedMatch_(
                sheetName,
                row
              ) &&
              includeRow_(
                sheetName,
                row
              )
            ) {
              changed = true;
            }
          }
        );
      }
    );

    if (!changed) {
      break;
    }
  }

  function values_(group) {
    return Object.keys(ids[group])
      .sort()
      .map(function (key) {
        return ids[group][key];
      });
  }

  function summaryRow_(row) {
    return {
      sheet_row:
        row.__sheet_row,
      test_uid_match:
        directIdentityMatch_(row),
      tenant_id:
        first_(row, [
          'tenant_id'
        ]),
      tenant_user_id:
        first_(row, [
          'tenant_user_id',
          'user_id'
        ]),
      contract_id:
        first_(row, [
          'contract_id',
          'current_contract_id'
        ]),
      workspace_id:
        text_(row.workspace_id),
      landlord_id:
        text_(row.landlord_id),
      property_id:
        text_(row.property_id),
      room_id:
        text_(row.room_id),
      room_no:
        first_(row, [
          'room_no',
          'room_name',
          'room_number'
        ]),
      contract_status:
        first_(row, [
          'contract_status',
          'status'
        ]),
      account_status:
        first_(row, [
          'account_status',
          'tenant_account_status'
        ]),
      binding_status:
        first_(row, [
          'tenant_binding_status',
          'binding_status'
        ]),
      bill_id:
        text_(row.bill_id),
      bill_month:
        first_(row, [
          'bill_month',
          'billing_month'
        ]),
      bill_status:
        text_(row.bill_status),
      payment_status:
        text_(row.payment_status)
    };
  }

  function duplicateKeys_(
    rows,
    candidates
  ) {
    const counts = {};

    rows.forEach(function (row) {
      const key =
        upper_(
          first_(row, candidates)
        );

      if (key) {
        counts[key] =
          (counts[key] || 0) + 1;
      }
    });

    return Object.keys(counts)
      .filter(function (key) {
        return counts[key] > 1;
      })
      .sort()
      .map(function (key) {
        return {
          key: key,
          row_count:
            counts[key]
        };
      });
  }

  function distinctRowValues_(
    rows,
    candidates
  ) {
    const found = {};

    rows.forEach(function (row) {
      const value =
        first_(row, candidates);
      const key =
        upper_(value);

      if (key) {
        found[key] = value;
      }
    });

    return Object.keys(found)
      .sort()
      .map(function (key) {
        return found[key];
      });
  }

  const keyFields = {
    V2_tenants: [
      'tenant_id'
    ],
    V2_contracts: [
      'contract_id'
    ],
    V2_tenant_home_view: [
      'tenant_id'
    ],
    V2_tenant_bill_view: [
      'bill_id'
    ],
    V2_bills: [
      'bill_id'
    ],
    V2_landlord_tenant_list_view: [
      'tenant_id'
    ],
    V2_rooms: [
      'room_id'
    ],
    V2_properties: [
      'property_id'
    ]
  };

  const sheets = {};

  sheetNames.forEach(
    function (sheetName) {
      const rows =
        matched[sheetName];
      const sheetWorkspaceIds =
        distinctRowValues_(
          rows,
          [
            'workspace_id'
          ]
        );
      const sheetTenantIds =
        distinctRowValues_(
          rows,
          [
            'tenant_id'
          ]
        );

      sheets[sheetName] = {
        sheet_exists:
          source[sheetName]
            .sheet_exists,
        total_row_count:
          source[sheetName]
            .total_row_count,
        found:
          rows.length > 0,
        matched_row_count:
          rows.length,
        workspace_ids:
          sheetWorkspaceIds,
        workspace_id_consistent:
          sheetWorkspaceIds.length <= 1,
        tenant_ids:
          sheetTenantIds,
        tenant_id_consistent:
          sheetTenantIds.length <= 1,
        duplicate_keys:
          duplicateKeys_(
            rows,
            keyFields[sheetName]
          ),
        rows:
          rows.map(summaryRow_)
      };
    }
  );

  const missingRequiredRows = [];

  [
    'V2_tenants',
    'V2_contracts',
    'V2_tenant_home_view',
    'V2_landlord_tenant_list_view',
    'V2_rooms',
    'V2_properties'
  ].forEach(function (sheetName) {
    if (!source[sheetName].sheet_exists) {
      missingRequiredRows.push(
        'SHEET_MISSING:' +
        sheetName
      );
    } else if (
      matched[sheetName].length === 0
    ) {
      missingRequiredRows.push(
        'RELATED_ROW_MISSING:' +
        sheetName
      );
    }
  });

  const billCount =
    matched.V2_bills.length;
  const homeViewCount =
    matched.V2_tenant_home_view
      .length;
  const billViewCount =
    matched.V2_tenant_bill_view
      .length;

  if (
    billCount > 0 &&
    billViewCount === 0
  ) {
    missingRequiredRows.push(
      'RELATED_ROW_MISSING:' +
      'V2_tenant_bill_view'
    );
  }

  const conflicts = [];

  if (values_('tenant_id').length > 1) {
    conflicts.push(
      'MULTIPLE_TENANT_IDS'
    );
  }

  if (values_('workspace_id').length > 1) {
    conflicts.push(
      'MULTIPLE_WORKSPACE_IDS'
    );
  }

  sheetNames.forEach(
    function (sheetName) {
      if (
        sheets[sheetName]
          .duplicate_keys.length > 0
      ) {
        conflicts.push(
          'DUPLICATE_KEY:' +
          sheetName
        );
      }
    }
  );

  const result = {
    diagnostic:
      'diagnoseTestTenantRuntimeData',
    read_only: true,
    generated_at:
      new Date(),
    test_line_uid:
      testLineUserId,
    identifiers: {
      tenant_id:
        values_('tenant_id'),
      tenant_user_id:
        values_('user_id'),
      contract_id:
        values_('contract_id'),
      workspace_id:
        values_('workspace_id'),
      landlord_id:
        values_('landlord_id'),
      property_id:
        values_('property_id'),
      room_id:
        values_('room_id')
    },
    contract_statuses:
      matched.V2_contracts
        .map(function (row) {
          return first_(row, [
            'contract_status',
            'status'
          ]);
        })
        .filter(function (value) {
          return Boolean(value);
        }),
    counts: {
      bill_count:
        billCount,
      home_view_count:
        homeViewCount,
      bill_view_count:
        billViewCount
    },
    consistency: {
      workspace_id: {
        consistent:
          values_('workspace_id')
            .length <= 1,
        values:
          values_('workspace_id')
      },
      tenant_id: {
        consistent:
          values_('tenant_id')
            .length <= 1,
        values:
          values_('tenant_id')
      }
    },
    missing_required_rows:
      missingRequiredRows,
    duplicate_or_conflict_rows:
      conflicts,
    sheets: sheets
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


/**
 * 唯讀規劃 TEST_TENANT_LINE_UID 的 runtime data repair。
 *
 * 輸出刻意只保留：Sheet、row、欄位、舊值、新值。
 * 本函式只呼叫 snapshot / resolver / plan builders，不呼叫任何
 * setValue、setValues、appendRow、repair、migration 或 LINE helper。
 */
function planTestTenantRuntimeDataRepair() {
  const testLineUserId =
    String(
      getRequiredScriptProperty_(
        'TEST_TENANT_LINE_UID'
      )
    ).trim();

  const ss =
    runtimeSpreadsheet_();

  const source =
    tenantRuntimeReadSnapshot_(ss);

  /*
   * Planning-only reverse lookup：當 tenant / contract 都缺少 room_id
   * 與 room label 時，僅接受 V2_rooms 中唯一一筆以
   * current_contract_id 或 current_tenant_id 反向連回的房間。
   * 仍需符合已知 workspace_id 與 property_id；不以 property 單獨猜測。
   */
  const resolutionSource = {};

  Object.keys(source).forEach(function (sheetName) {
    const entry = source[sheetName];

    resolutionSource[sheetName] =
      Object.assign(
        {},
        entry,
        {
          rows: entry.rows.map(function (row) {
            return Object.assign({}, row);
          })
        }
      );
  });

  const tenantCandidates =
    resolutionSource.V2_tenants.rows
      .filter(function (row) {
        return tenantRuntimeLineMatches_(
          row,
          testLineUserId,
          true
        );
      });

  if (tenantCandidates.length === 1) {
    const tenant = tenantCandidates[0];
    const tenantId =
      tenantRuntimeText_(tenant.tenant_id);
    const contractCandidates =
      resolutionSource.V2_contracts.rows
        .filter(function (row) {
          return (
            tenantRuntimeUpper_(row.tenant_id) ===
              tenantRuntimeUpper_(tenantId) &&
            tenantRuntimeContractIsActive_(row)
          );
        });

    if (contractCandidates.length === 1) {
      const contract = contractCandidates[0];
      const existingRoomIds =
        tenantRuntimeUniqueValues_([
          tenant.room_id,
          contract.room_id
        ]);
      const existingRoomLabels =
        tenantRuntimeUniqueValues_([
          tenant.room_name,
          tenant.room_list,
          tenant.room_no,
          contract.room_name,
          contract.room_no
        ]);

      if (
        existingRoomIds.length === 0 &&
        existingRoomLabels.length === 0
      ) {
        const contractId =
          tenantRuntimeText_(
            contract.contract_id
          );
        const propertyIds =
          tenantRuntimeUniqueValues_([
            tenant.property_id,
            contract.property_id
          ]).map(tenantRuntimeUpper_);
        const workspaceIds =
          tenantRuntimeUniqueValues_([
            tenant.workspace_id,
            contract.workspace_id
          ]).map(tenantRuntimeUpper_);

        const reverseRoomCandidates =
          resolutionSource.V2_rooms.rows
            .filter(function (row) {
              const reverseMatch =
                (
                  contractId &&
                  tenantRuntimeUpper_(
                    row.current_contract_id
                  ) ===
                    tenantRuntimeUpper_(contractId)
                ) ||
                (
                  tenantId &&
                  tenantRuntimeUpper_(
                    row.current_tenant_id
                  ) ===
                    tenantRuntimeUpper_(tenantId)
                );

              if (!reverseMatch) {
                return false;
              }

              const propertyMatch =
                propertyIds.length === 0 ||
                propertyIds.indexOf(
                  tenantRuntimeUpper_(
                    row.property_id
                  )
                ) >= 0;
              const rowWorkspaceId =
                tenantRuntimeUpper_(
                  row.workspace_id
                );
              const workspaceMatch =
                workspaceIds.length === 0 ||
                !rowWorkspaceId ||
                workspaceIds.indexOf(
                  rowWorkspaceId
                ) >= 0;

              return (
                propertyMatch &&
                workspaceMatch
              );
            });

        if (reverseRoomCandidates.length > 1) {
          throw tenantRuntimeError_(
            'MULTIPLE_REVERSE_ROOM_LINKS',
            'V2_rooms 有多筆房間反向連到同一測試租約或房客'
          );
        }

        if (reverseRoomCandidates.length === 1) {
          const room = reverseRoomCandidates[0];

          contract.room_id =
            tenantRuntimeText_(room.room_id);
          contract.room_name =
            tenantRuntimeFirst_(
              room,
              [
                'room_name',
                'room_no',
                'room_number'
              ]
            );
        }
      }
    }
  }

  const canonical =
    tenantRuntimeResolveCanonicalFromSnapshot_(
      resolutionSource,
      testLineUserId
    );

  const plan =
    tenantRuntimeBuildRepairPlan_(
      source,
      canonical
    );

  /*
   * V2_rooms 是 relation source，不是 view。Planner 只在已經由
   * same workspace + property + unique room 驗證後，列出空白的
   * reverse-link 欄位；這些項目不會交給 repair function 寫入。
   */
  tenantRuntimePlanFields_(
    plan,
    source.V2_rooms,
    canonical.room_row.__sheet_row,
    {
      workspace_id:
        canonical.workspace_id,
      property_id:
        canonical.property_id,
      landlord_id:
        canonical.landlord_id,
      property_name:
        canonical.property_name,
      current_contract_id:
        canonical.contract_id,
      current_tenant_id:
        canonical.tenant_id,
      current_tenant_name:
        canonical.tenant_name,
      room_status:
        'occupied',
      account_status:
        'active'
    },
    'PLAN_ONLY'
  );

  const output =
    plan.map(function (item) {
      return {
        Sheet: item.sheet,
        row: item.row,
        field: item.field,
        old_value: item.old_value,
        new_value: item.new_value
      };
    });

  Logger.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );

  return output;
}


/**
 * Phase 42：唯讀比較 Tenant 五個 API 使用的主資料與衍生 View。
 *
 * 僅允許 Script Property 讀取、Spreadsheet 讀取與 Logger 輸出；
 * 不得呼叫 route、handler、repair、migration 或任何寫入 helper。
 */
function diagnoseTenantDataConsistency() {
  const testLineUid =
    String(
      getRequiredScriptProperty_(
        'TEST_TENANT_LINE_UID'
      )
    ).trim();
  const sheetNames = [
    'V2_users',
    'V2_tenants',
    'V2_contracts',
    'V2_bills',
    'V2_tenant_home_view',
    'V2_tenant_bill_view',
    'V2_landlord_tenant_list_view'
  ];
  const ss =
    runtimeSpreadsheet_();

  function text_(value) {
    return String(
      value === undefined ||
      value === null
        ? ''
        : value
    ).trim();
  }

  function upper_(value) {
    return text_(value).toUpperCase();
  }

  function first_(row, keys) {
    for (
      let index = 0;
      index < keys.length;
      index += 1
    ) {
      const value =
        text_(row[keys[index]]);

      if (value) {
        return value;
      }
    }

    return '';
  }

  function tenantLineUid_(
    sheetName,
    row
  ) {
    const tenantSpecific =
      first_(row, [
        'tenant_line_user_id',
        'tenant_line_uid'
      ]);

    if (tenantSpecific) {
      return tenantSpecific;
    }

    if (
      sheetName ===
      'V2_landlord_tenant_list_view'
    ) {
      return '';
    }

    return first_(row, [
      'line_user_id',
      'line_uid'
    ]);
  }

  function readSheet_(sheetName) {
    const sheet =
      ss.getSheetByName(sheetName);

    if (!sheet) {
      return {
        exists: false,
        rows: []
      };
    }

    const values =
      sheet
        .getDataRange()
        .getValues();

    if (
      !values ||
      values.length < 2
    ) {
      return {
        exists: true,
        rows: []
      };
    }

    const headers =
      values[0].map(text_);
    const rows = [];

    values
      .slice(1)
      .forEach(function (cells, index) {
        const hasData =
          cells.some(function (cell) {
            return (
              cell !== '' &&
              cell !== null
            );
          });

        if (!hasData) {
          return;
        }

        const row = {
          __sheet_row: index + 2
        };

        headers.forEach(
          function (header, column) {
            if (header) {
              row[header] =
                cells[column];
            }
          }
        );

        rows.push(row);
      });

    return {
      exists: true,
      rows: rows
    };
  }

  const source = {};

  sheetNames.forEach(
    function (sheetName) {
      source[sheetName] =
        readSheet_(sheetName);
    }
  );

  const ids = {
    line_uid: {},
    user_id: {},
    tenant_id: {},
    tenant_code: {},
    contract_id: {},
    bill_id: {}
  };

  function addId_(group, value) {
    const normalized = upper_(value);

    if (
      normalized &&
      !ids[group][normalized]
    ) {
      ids[group][normalized] =
        text_(value);
      return true;
    }

    return false;
  }

  function hasId_(group, value) {
    const normalized = upper_(value);

    return Boolean(
      normalized &&
      ids[group][normalized]
    );
  }

  addId_(
    'line_uid',
    testLineUid
  );

  function rowIds_(sheetName, row) {
    return {
      line_uid:
        tenantLineUid_(
          sheetName,
          row
        ),
      user_id:
        first_(row, [
          'tenant_user_id',
          'user_id'
        ]),
      tenant_id:
        first_(row, [
          'tenant_id'
        ]),
      tenant_code:
        first_(row, [
          'tenant_code',
          'tenant_no',
          'tenant_number'
        ]),
      contract_id:
        first_(row, [
          'contract_id',
          'current_contract_id'
        ]),
      bill_id:
        first_(row, [
          'bill_id'
        ])
    };
  }

  function absorb_(sheetName, row) {
    const values =
      rowIds_(sheetName, row);
    let changed = false;

    Object.keys(values)
      .forEach(function (group) {
        if (addId_(group, values[group])) {
          changed = true;
        }
      });

    return changed;
  }

  function isRelated_(sheetName, row) {
    const values =
      rowIds_(sheetName, row);

    return Object.keys(values)
      .some(function (group) {
        return hasId_(
          group,
          values[group]
        );
      });
  }

  const matched = {};
  const includedRows = {};

  sheetNames.forEach(
    function (sheetName) {
      matched[sheetName] = [];
      includedRows[sheetName] = {};
    }
  );

  function include_(sheetName, row) {
    const rowNumber =
      String(row.__sheet_row);

    if (
      includedRows[sheetName][rowNumber]
    ) {
      return false;
    }

    includedRows[sheetName][rowNumber] =
      true;
    matched[sheetName].push(row);
    absorb_(sheetName, row);
    return true;
  }

  sheetNames.forEach(
    function (sheetName) {
      source[sheetName].rows
        .forEach(function (row) {
          if (
            tenantLineUid_(
              sheetName,
              row
            ) === testLineUid
          ) {
            include_(sheetName, row);
          }
        });
    }
  );

  for (
    let pass = 0;
    pass < sheetNames.length;
    pass += 1
  ) {
    let changed = false;

    sheetNames.forEach(
      function (sheetName) {
        source[sheetName].rows
          .forEach(function (row) {
            if (
              isRelated_(
                sheetName,
                row
              ) &&
              include_(sheetName, row)
            ) {
              changed = true;
            }
          });
      }
    );

    if (!changed) {
      break;
    }
  }

  function diagnosticRow_(
    sheetName,
    row
  ) {
    return {
      sheet: sheetName,
      row: row.__sheet_row,
      workspace_id:
        text_(row.workspace_id),
      tenant_id:
        text_(row.tenant_id),
      contract_id:
        first_(row, [
          'contract_id',
          'current_contract_id'
        ]),
      bill_id:
        text_(row.bill_id),
      line_uid:
        tenantLineUid_(
          sheetName,
          row
        ),
      tenant_code:
        first_(row, [
          'tenant_code',
          'tenant_no',
          'tenant_number'
        ]),
      room_id:
        text_(row.room_id)
    };
  }

  const rows = [];

  sheetNames.forEach(
    function (sheetName) {
      matched[sheetName]
        .sort(function (a, b) {
          return (
            a.__sheet_row -
            b.__sheet_row
          );
        })
        .forEach(function (row) {
          rows.push(
            diagnosticRow_(
              sheetName,
              row
            )
          );
        });
    }
  );

  const mismatches = [];

  function addMismatch_(
    type,
    field,
    sheet,
    sheetRows,
    values,
    detail
  ) {
    mismatches.push({
      type: type,
      field: field || '',
      sheet: sheet || '',
      rows: sheetRows || [],
      values: values || [],
      detail: detail || ''
    });
  }

  sheetNames.forEach(
    function (sheetName) {
      if (!source[sheetName].exists) {
        addMismatch_(
          'MISSING_SHEET',
          '',
          sheetName,
          [],
          [],
          '找不到必要工作表'
        );
      } else if (
        matched[sheetName].length === 0
      ) {
        addMismatch_(
          'MISSING_RELATED_ROW',
          '',
          sheetName,
          [],
          [],
          '找不到測試房客相關資料'
        );
      }
    }
  );

  function rowKey_(sheetName, row) {
    if (sheetName === 'V2_users') {
      return first_(row, [
        'tenant_user_id',
        'user_id'
      ]) || tenantLineUid_(
        sheetName,
        row
      );
    }

    if (sheetName === 'V2_tenants') {
      return text_(row.tenant_id);
    }

    if (sheetName === 'V2_contracts') {
      return text_(row.contract_id);
    }

    if (
      sheetName === 'V2_bills' ||
      sheetName === 'V2_tenant_bill_view'
    ) {
      return text_(row.bill_id);
    }

    if (
      sheetName === 'V2_tenant_home_view'
    ) {
      const workspaceId =
        upper_(row.workspace_id);
      const tenantId =
        upper_(row.tenant_id);

      if (!workspaceId || !tenantId) {
        return '';
      }

      return (
        workspaceId +
        '|' +
        tenantId
      );
    }

    if (
      sheetName ===
      'V2_landlord_tenant_list_view'
    ) {
      const workspaceId =
        upper_(row.workspace_id);
      const tenantId =
        upper_(row.tenant_id);
      const contractId =
        upper_(row.contract_id);

      if (
        !workspaceId ||
        !tenantId ||
        !contractId
      ) {
        return '';
      }

      return (
        workspaceId +
        '|' +
        tenantId +
        '|' +
        contractId
      );
    }

    return '';
  }

  sheetNames.forEach(
    function (sheetName) {
      const grouped = {};

      matched[sheetName]
        .forEach(function (row) {
          const key =
            rowKey_(sheetName, row);

          if (!key) {
            addMismatch_(
              'MISSING_CANONICAL_KEY',
              '',
              sheetName,
              [row.__sheet_row],
              [],
              '相關列缺少 canonical key'
            );
            return;
          }

          grouped[key] =
            grouped[key] || [];
          grouped[key].push(
            row.__sheet_row
          );
        });

      Object.keys(grouped)
        .sort()
        .forEach(function (key) {
          if (grouped[key].length > 1) {
            addMismatch_(
              'DUPLICATE_ROW',
              'canonical_key',
              sheetName,
              grouped[key],
              [key],
              '同一 canonical key 有多筆資料'
            );
          }
        });
    }
  );

  function distinct_(field) {
    const values = {};

    rows.forEach(function (row) {
      const value = text_(row[field]);
      const key = upper_(value);

      if (key) {
        values[key] = value;
      }
    });

    return Object.keys(values)
      .sort()
      .map(function (key) {
        return values[key];
      });
  }

  [
    'workspace_id',
    'tenant_id',
    'contract_id'
  ].forEach(function (field) {
    const values = distinct_(field);

    if (values.length === 0) {
      addMismatch_(
        'MISSING_CANONICAL_VALUE',
        field,
        '',
        [],
        [],
        '所有相關列皆缺少 ' + field
      );
    } else if (values.length > 1) {
      addMismatch_(
        field.toUpperCase() +
          '_MISMATCH',
        field,
        '',
        rows
          .filter(function (row) {
            return Boolean(row[field]);
          })
          .map(function (row) {
            return (
              row.sheet +
              '!' +
              row.row
            );
          }),
        values,
        field + ' 不一致'
      );
    }
  });

  const lineUids =
    distinct_('line_uid');
  const unexpectedLineUids =
    lineUids.filter(function (value) {
      return value !== testLineUid;
    });

  if (lineUids.length === 0) {
    addMismatch_(
      'MISSING_CANONICAL_VALUE',
      'line_uid',
      '',
      [],
      [],
      '所有相關列皆缺少 tenant LINE UID'
    );
  } else if (
    unexpectedLineUids.length > 0
  ) {
    addMismatch_(
      'LINE_UID_MISMATCH',
      'line_uid',
      '',
      rows
        .filter(function (row) {
          return (
            row.line_uid &&
            row.line_uid !== testLineUid
          );
        })
        .map(function (row) {
          return (
            row.sheet +
            '!' +
            row.row
          );
        }),
      lineUids,
      '相關列包含不同 tenant LINE UID'
    );
  }

  [
    'bill_id',
    'room_id'
  ].forEach(function (field) {
    if (distinct_(field).length === 0) {
      addMismatch_(
        'MISSING_CANONICAL_VALUE',
        field,
        '',
        [],
        [],
        '所有相關列皆缺少 ' + field
      );
    }
  });

  const status =
    mismatches.length === 0
      ? 'PASS'
      : 'FAIL';
  const result = {
    diagnostic:
      'diagnoseTenantDataConsistency',
    read_only: true,
    test_tenant_line_uid:
      testLineUid,
    sheets_checked:
      sheetNames,
    rows: rows,
    checks: {
      missing_data:
        mismatches.filter(
          function (item) {
            return (
              item.type.indexOf(
                'MISSING_'
              ) === 0
            );
          }
        ),
      duplicate:
        mismatches.filter(
          function (item) {
            return (
              item.type ===
              'DUPLICATE_ROW'
            );
          }
        ),
      workspace_id:
        distinct_('workspace_id'),
      tenant_id:
        distinct_('tenant_id'),
      line_uid:
        lineUids,
      contract_id:
        distinct_('contract_id')
    },
    mismatches: mismatches,
    status: status
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
  Logger.log('RESULT: ' + status);

  return result;
}


/**
 * Phase 45：Tenant deployment contract 唯讀驗證。
 *
 * 只讀取 Script Properties、Sheets 與現有 pure resolver；
 * 不呼叫會寫入 access log 的正式 route handler，亦不輸出 LINE UID。
 */
function verifyTenantDeploymentReadOnly() {
  const testLineUid =
    String(
      getRequiredScriptProperty_(
        'TEST_TENANT_LINE_UID'
      )
    ).trim();
  const actions = [
    'tenant_home',
    'tenant_bills',
    'tenant_message_init'
  ];

  function text_(value) {
    return String(
      value === undefined ||
      value === null
        ? ''
        : value
    ).trim();
  }

  function first_(row, keys) {
    for (
      let index = 0;
      index < keys.length;
      index += 1
    ) {
      const value =
        text_(row[keys[index]]);

      if (value) {
        return value;
      }
    }

    return '';
  }

  function normalized_(value) {
    return text_(value).toUpperCase();
  }

  function canonicalLandlord_(identity) {
    const values = {};

    function add_(value) {
      const normalized =
        normalized_(value);

      if (normalized) {
        values[normalized] =
          text_(value);
      }
    }

    getSheetObjects_('V2_contracts')
      .filter(function (row) {
        return (
          normalized_(row.workspace_id) ===
            normalized_(identity.workspace_id) &&
          normalized_(row.tenant_id) ===
            normalized_(identity.tenant_id) &&
          normalized_(row.contract_id) ===
            normalized_(identity.contract_id)
        );
      })
      .forEach(function (row) {
        add_(row.landlord_id);
      });

    getSheetObjects_('V2_properties')
      .filter(function (row) {
        return (
          normalized_(row.workspace_id) ===
            normalized_(identity.workspace_id) &&
          normalized_(row.property_id) ===
            normalized_(identity.property_id)
        );
      })
      .forEach(function (row) {
        add_(row.landlord_id);
      });

    const distinct =
      Object.keys(values)
        .sort()
        .map(function (key) {
          return values[key];
        });

    return {
      value:
        distinct.length === 1
          ? distinct[0]
          : '',
      values: distinct,
      conflict:
        distinct.length > 1
    };
  }

  function readLandlordLinks_(identity) {
    const sheet =
      runtimeSpreadsheet_()
        .getSheetByName(
          'V2_landlord_tenant_list_view'
        );

    if (!sheet) {
      return {
        exists: false,
        candidates: []
      };
    }

    const values =
      sheet
        .getDataRange()
        .getValues();

    if (values.length < 2) {
      return {
        exists: true,
        candidates: []
      };
    }

    const headers =
      values[0].map(text_);
    const candidates = [];

    values
      .slice(1)
      .forEach(function (cells, index) {
        const row = {};

        headers.forEach(
          function (header, column) {
            if (header) {
              row[header] = cells[column];
            }
          }
        );

        const tenantId =
          text_(row.tenant_id);
        const contractId =
          first_(row, [
            'contract_id',
            'current_contract_id'
          ]);
        const tenantUserId =
          first_(row, [
            'tenant_user_id',
            'user_id'
          ]);
        const related =
          (
            tenantId &&
            normalized_(tenantId) ===
              normalized_(identity.tenant_id)
          ) ||
          (
            contractId &&
            normalized_(contractId) ===
              normalized_(identity.contract_id)
          ) ||
          (
            tenantUserId &&
            normalized_(tenantUserId) ===
              normalized_(identity.tenant_user_id)
          );

        if (!related) {
          return;
        }

        const workspaceId =
          text_(row.workspace_id);
        const roomId =
          text_(row.room_id);
        const landlordId =
          text_(row.landlord_id);
        const status =
          first_(row, [
            'link_status',
            'contract_status',
            'tenant_status',
            'account_status',
            'status'
          ]);

        candidates.push({
          row: index + 2,
          workspace_id: workspaceId,
          tenant_id: tenantId,
          contract_id: contractId,
          room_id: roomId,
          landlord_id: landlordId,
          status: status,
          updated_at:
            tenantBillsRuntimeJsonSafeValue_(
              row.updated_at || ''
            ),
          matches_canonical: {
            workspace_id:
              normalized_(workspaceId) ===
              normalized_(identity.workspace_id),
            tenant_id:
              normalized_(tenantId) ===
              normalized_(identity.tenant_id),
            contract_id:
              normalized_(contractId) ===
              normalized_(identity.contract_id),
            room_id:
              normalized_(roomId) ===
              normalized_(identity.room_id),
            landlord_id:
              normalized_(landlordId) ===
              normalized_(identity.landlord_id)
          },
          complete_canonical_key:
            Boolean(
              workspaceId &&
              tenantId &&
              contractId &&
              roomId &&
              landlordId
            )
        });
      });

    return {
      exists: true,
      candidates: candidates
    };
  }

  function jsonpProbe_(payload, name) {
    const callback =
      '__cmwebs_phase45_' + name;
    const output =
      jsonOutput_(payload, callback);
    const content =
      output.getContent();

    return {
      callback: callback,
      mime_type:
        String(output.getMimeType()),
      wrapped:
        content.indexOf(
          callback + '('
        ) === 0 &&
        content.slice(-2) === ');',
      json_stringify_success: true,
      content_length: content.length
    };
  }

  const testIdentityChecks = {};

  actions.forEach(function (action) {
    const resolved =
      resolveTenantRequestLineUserId_(
        {
          parameter: {
            test: '1'
          }
        },
        action,
        'PHASE45_FALLBACK_NOT_ALLOWED'
      );

    testIdentityChecks[action] =
      resolved === testLineUid;
  });

  let identity = null;
  let identityError = null;

  try {
    identity =
      tenantBillsRuntimeResolveIdentity_(
        testLineUid
      );
  } catch (error) {
    identityError = {
      code:
        error && error.code
          ? error.code
          : 'IDENTITY_ERROR',
      message:
        error && error.message
          ? error.message
          : 'identity resolution failed'
    };
  }

  const landlordResolution =
    identity
      ? canonicalLandlord_(identity)
      : {
          value: '',
          values: [],
          conflict: false
        };

  if (identity) {
    identity.landlord_id =
      landlordResolution.value;
  }

  const canonicalIdentity =
    identity
      ? {
          workspace_id:
            text_(identity.workspace_id),
          tenant_id:
            text_(identity.tenant_id),
          tenant_user_id:
            text_(identity.tenant_user_id),
          contract_id:
            text_(identity.contract_id),
          property_id:
            text_(identity.property_id),
          room_id:
            text_(identity.room_id),
          landlord_id:
            text_(landlordResolution.value)
        }
      : {};
  const landlordLinks =
    identity
      ? readLandlordLinks_(identity)
      : {
          exists: false,
          candidates: []
        };
  const runtimeIdentity =
    resolveCanonicalTenantRuntimeByLineUid_(
      testLineUid
    );
  const billsResult =
    getTenantBillsRuntimePayloadByLineUid_(
      testLineUid
    );
  const bills =
    billsResult &&
    Array.isArray(billsResult.bills)
      ? billsResult.bills
      : [];
  const sharedResolverSummary = {
    success:
      runtimeIdentity &&
      runtimeIdentity.success === true,
    code:
      runtimeIdentity &&
      runtimeIdentity.code
        ? runtimeIdentity.code
        : '',
    message:
      runtimeIdentity &&
      runtimeIdentity.message
        ? runtimeIdentity.message
        : ''
  };
  const billsSummary = {
    success:
      billsResult &&
      billsResult.success === true,
    ok:
      billsResult &&
      billsResult.ok === true,
    code:
      billsResult &&
      billsResult.code
        ? billsResult.code
        : '',
    has_top_level_bills:
      Boolean(
        billsResult &&
        Array.isArray(
          billsResult.bills
        )
      ),
    has_data_bills:
      Boolean(
        billsResult &&
        billsResult.data &&
        Array.isArray(
          billsResult.data.bills
        )
      ),
    count: bills.length,
    first_bill:
      bills.length > 0
        ? {
            bill_id:
              text_(bills[0].bill_id),
            bill_month:
              text_(bills[0].bill_month),
            bill_status:
              text_(bills[0].bill_status),
            payment_status:
              text_(bills[0].payment_status)
          }
        : null,
    json_stringify_success: false
  };

  try {
    JSON.stringify(billsResult);
    billsSummary.json_stringify_success = true;
  } catch (error) {
    billsSummary.json_stringify_error =
      error && error.message
        ? error.message
        : 'JSON stringify failed';
  }

  const homePayload =
    sharedResolverSummary.success
      ? {
          success: true,
          code: 'OK',
          data: {
            tenant_id:
              canonicalIdentity.tenant_id
          }
        }
      : {
          success: false,
          code:
            sharedResolverSummary.code,
          message:
            sharedResolverSummary.message,
          data: null
        };
  const messagePayload = {
    success:
      sharedResolverSummary.success,
    code:
      sharedResolverSummary.code,
    message:
      sharedResolverSummary.message,
    data: {
      tenant:
        sharedResolverSummary.success
          ? {
              tenant_id:
                canonicalIdentity.tenant_id
            }
          : null,
      messages: []
    }
  };
  const report = {
    diagnostic:
      'verifyTenantDeploymentReadOnly',
    read_only: true,
    test_identity_source:
      'TEST_TENANT_LINE_UID Script Property',
    test_identity_shared:
      testIdentityChecks,
    route_handlers_present: {
      tenant_home:
        typeof getTenantHomeByLineUid ===
        'function',
      tenant_bills:
        typeof getTenantBillsByLineUid ===
        'function',
      tenant_message_init:
        typeof getTenantMessageInitByLineUid ===
        'function'
    },
    canonical_identity:
      canonicalIdentity,
    canonical_landlord_resolution:
      landlordResolution,
    identity_error:
      identityError,
    landlord_links:
      landlordLinks,
    tenant_home: {
      shared_resolver:
        sharedResolverSummary,
      jsonp:
        jsonpProbe_(
          homePayload,
          'tenant_home'
        )
    },
    tenant_message: {
      shared_resolver:
        sharedResolverSummary,
      jsonp:
        jsonpProbe_(
          messagePayload,
          'tenant_message'
        )
    },
    tenant_bills: {
      payload: billsSummary,
      jsonp:
        jsonpProbe_(
          billsResult,
          'tenant_bills'
        )
    },
    writes_performed: 0,
    line_pushes_performed: 0
  };

  Logger.log(
    JSON.stringify(
      report,
      null,
      2
    )
  );

  return report;
}


function testTenantLandlordLinkDeterministicSelection() {
  const canonical = {
    workspace_id: 'W_TEST',
    tenant_id: 'T_TEST',
    tenant_user_id: 'USER_TEST',
    contract_id: 'C_TEST',
    room_id: 'R_TEST',
    landlord_id: 'L_TEST',
    line_user_id: 'TENANT_LINE_TEST'
  };
  const exact = {
    __sheet_row: 4,
    workspace_id: 'W_TEST',
    tenant_id: 'T_TEST',
    tenant_user_id: 'USER_TEST',
    current_contract_id: 'C_TEST',
    room_id: 'R_TEST',
    landlord_id: 'L_TEST',
    tenant_line_user_id: 'TENANT_LINE_TEST',
    landlord_line_user_id: 'LANDLORD_LINE_TEST',
    status: 'active',
    updated_at: '2026-07-20T12:00:00+08:00'
  };
  const legacy = {
    __sheet_row: 2,
    tenant_id: 'T_TEST'
  };
  const selected =
    tenantRuntimeSelectLandlordLink_(
      [legacy, exact],
      canonical
    );

  if (
    selected.row !== exact ||
    selected.diagnostics.exact_count !== 1 ||
    selected.diagnostics
      .compatible_legacy_count !== 1 ||
    selected.diagnostics.warning !==
      'COMPATIBLE_LEGACY_LINK_IGNORED'
  ) {
    throw new Error(
      'TEST_FAILED: exact link did not outrank compatible legacy link'
    );
  }

  const equivalent = Object.assign({}, exact, {
    __sheet_row: 5,
    updated_at: '2026-07-19T12:00:00+08:00'
  });
  const collapsed =
    tenantRuntimeSelectLandlordLink_(
      [equivalent, exact],
      canonical
    );

  if (
    collapsed.row !== exact ||
    collapsed.diagnostics
      .equivalent_duplicate_count !== 1 ||
    collapsed.diagnostics.warning !==
      'EQUIVALENT_DUPLICATE_LINKS_COLLAPSED'
  ) {
    throw new Error(
      'TEST_FAILED: equivalent duplicate links were not collapsed deterministically'
    );
  }

  function expectConflict_(row, expectedCode) {
    let actualCode = '';

    try {
      tenantRuntimeSelectLandlordLink_(
        [exact, row],
        canonical
      );
    } catch (error) {
      actualCode = error && error.code
        ? error.code
        : '';
    }

    if (actualCode !== expectedCode) {
      throw new Error(
        'TEST_FAILED: expected ' +
        expectedCode +
        ', received ' +
        (actualCode || 'NO_ERROR')
      );
    }
  }

  [
    ['workspace_id', 'W_OTHER'],
    ['tenant_id', 'T_OTHER'],
    ['current_contract_id', 'C_OTHER'],
    ['room_id', 'R_OTHER'],
    ['landlord_id', 'L_OTHER'],
    ['tenant_line_user_id', 'TENANT_LINE_OTHER']
  ].forEach(function (change) {
    const conflicting = Object.assign({}, exact);

    conflicting[change[0]] = change[1];
    if (change[0] === 'tenant_id') {
      conflicting.current_contract_id = 'C_TEST';
    }

    expectConflict_(
      conflicting,
      'CONFLICTING_TENANT_LANDLORD_LINKS'
    );
  });

  [
    ['landlord_line_user_id', 'LANDLORD_LINE_OTHER'],
    ['status', 'current']
  ].forEach(function (change) {
    const protectedConflict =
      Object.assign({}, exact, {
        __sheet_row: 6,
        updated_at: '2026-07-21T12:00:00+08:00'
      });

    protectedConflict[change[0]] = change[1];
    expectConflict_(
      protectedConflict,
      'CONFLICTING_TENANT_LANDLORD_LINKS'
    );
  });

  let incompleteCode = '';

  try {
    tenantRuntimeSelectLandlordLink_(
      [legacy],
      canonical
    );
  } catch (error) {
    incompleteCode = error && error.code
      ? error.code
      : '';
  }

  if (
    incompleteCode !==
      'TENANT_LANDLORD_LINK_INCOMPLETE'
  ) {
    throw new Error(
      'TEST_FAILED: incomplete-only link did not fail closed'
    );
  }

  const missing =
    tenantRuntimeSelectLandlordLink_(
      [],
      canonical
    );

  if (
    missing.row !== null ||
    missing.diagnostics.warning !==
      'TENANT_LANDLORD_LINK_NOT_FOUND'
  ) {
    throw new Error(
      'TEST_FAILED: missing-link behavior changed unexpectedly'
    );
  }

  const result = {
    success: true,
    tests: {
      exact_over_compatible_legacy: 'PASS',
      equivalent_duplicate_collapse: 'PASS',
      workspace_conflict_fail_closed: 'PASS',
      tenant_conflict_fail_closed: 'PASS',
      contract_conflict_fail_closed: 'PASS',
      room_conflict_fail_closed: 'PASS',
      landlord_conflict_fail_closed: 'PASS',
      tenant_uid_conflict_fail_closed: 'PASS',
      landlord_recipient_conflict_fail_closed:
        'PASS',
      status_conflict_fail_closed: 'PASS',
      incomplete_only_fail_closed: 'PASS',
      no_link_compatibility: 'PASS'
    },
    writes_performed: 0,
    line_pushes_performed: 0
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function testTenantReadRuntimeIsolationFixtures() {
  function entry_(name, headers, rows) {
    const headerMap = {};

    headers.forEach(function (header, index) {
      headerMap[header] = index + 1;
    });

    return {
      name: name,
      exists: true,
      sheet: null,
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

  const tenantLine = 'TENANT_LINE_TEST';
  const landlordLine = 'LANDLORD_LINE_TEST';
  const source = {
    V2_tenants: entry_(
      'V2_tenants',
      [
        'tenant_id',
        'tenant_user_id',
        'tenant_line_user_id',
        'workspace_id',
        'landlord_id',
        'property_id',
        'room_id',
        'account_status'
      ],
      [{
        tenant_id: 'T_TEST',
        tenant_user_id: 'USER_TEST',
        tenant_line_user_id: tenantLine,
        workspace_id: 'W_TEST',
        landlord_id: 'L_TEST',
        property_id: 'P_TEST',
        room_id: 'R_TEST',
        account_status: 'active'
      }]
    ),
    V2_contracts: entry_(
      'V2_contracts',
      [
        'contract_id',
        'tenant_id',
        'tenant_user_id',
        'workspace_id',
        'landlord_id',
        'landlord_line_user_id',
        'property_id',
        'room_id',
        'contract_status'
      ],
      [{
        contract_id: 'C_TEST',
        tenant_id: 'T_TEST',
        tenant_user_id: 'USER_TEST',
        workspace_id: 'W_TEST',
        landlord_id: 'L_TEST',
        landlord_line_user_id: landlordLine,
        property_id: 'P_TEST',
        room_id: 'R_TEST',
        contract_status: 'active'
      }]
    ),
    V2_properties: entry_(
      'V2_properties',
      [
        'property_id',
        'workspace_id',
        'landlord_id',
        'landlord_line_user_id'
      ],
      [{
        property_id: 'P_TEST',
        workspace_id: 'W_TEST',
        landlord_id: 'L_TEST',
        landlord_line_user_id: landlordLine
      }]
    ),
    V2_rooms: entry_(
      'V2_rooms',
      [
        'room_id',
        'workspace_id',
        'property_id',
        'room_no'
      ],
      [{
        room_id: 'R_TEST',
        workspace_id: 'W_TEST',
        property_id: 'P_TEST',
        room_no: '603'
      }]
    ),
    V2_tenant_home_view: entry_(
      'V2_tenant_home_view',
      [
        'tenant_id',
        'tenant_user_id',
        'tenant_line_user_id',
        'workspace_id',
        'contract_id',
        'room_id'
      ],
      [{
        tenant_id: 'T_TEST',
        tenant_user_id: 'USER_TEST',
        tenant_line_user_id: tenantLine,
        workspace_id: 'W_TEST',
        contract_id: 'C_TEST',
        room_id: 'R_TEST'
      }]
    ),
    V2_tenant_bill_view: entry_(
      'V2_tenant_bill_view',
      [
        'bill_id',
        'tenant_id',
        'tenant_user_id',
        'tenant_line_user_id',
        'workspace_id',
        'contract_id'
      ],
      [{
        bill_id: 'B_TEST',
        tenant_id: 'T_TEST',
        tenant_user_id: 'USER_TEST',
        tenant_line_user_id: tenantLine,
        workspace_id: 'W_TEST',
        contract_id: 'C_TEST'
      }]
    ),
    V2_bills: entry_(
      'V2_bills',
      [
        'bill_id',
        'tenant_id',
        'tenant_user_id',
        'workspace_id',
        'contract_id'
      ],
      [{
        bill_id: 'B_TEST',
        tenant_id: 'T_TEST',
        tenant_user_id: 'USER_TEST',
        workspace_id: 'W_TEST',
        contract_id: 'C_TEST'
      }]
    ),
    V2_landlord_tenant_list_view: entry_(
      'V2_landlord_tenant_list_view',
      [
        'tenant_id',
        'tenant_user_id',
        'tenant_line_user_id',
        'workspace_id',
        'landlord_id',
        'landlord_line_user_id',
        'current_contract_id',
        'room_id',
        'status'
      ],
      [{
        tenant_id: 'T_TEST',
        tenant_user_id: 'USER_TEST',
        tenant_line_user_id: tenantLine,
        workspace_id: 'W_TEST',
        landlord_id: 'L_TEST',
        landlord_line_user_id: landlordLine,
        current_contract_id: 'C_TEST',
        room_id: 'R_TEST',
        status: 'active'
      }]
    )
  };
  const canonical =
    tenantRuntimeResolveCanonicalFromSnapshot_(
      source,
      tenantLine
    );

  if (
    canonical.tenant_id !== 'T_TEST' ||
    canonical.contract_id !== 'C_TEST' ||
    canonical.workspace_id !== 'W_TEST' ||
    canonical.room_id !== 'R_TEST' ||
    canonical.landlord_id !== 'L_TEST'
  ) {
    throw new Error(
      'TEST_FAILED: tenant home canonical identity mismatch'
    );
  }

  const billIdentity = {
    line_user_id: canonical.line_user_id,
    tenant_user_id: canonical.tenant_user_id,
    tenant_id: canonical.tenant_id,
    workspace_id: canonical.workspace_id
  };
  const billRows = [
    source.V2_tenant_bill_view.rows[0],
    {
      bill_id: 'B_OTHER',
      tenant_id: 'T_TEST',
      tenant_user_id: 'USER_TEST',
      tenant_line_user_id: tenantLine,
      workspace_id: 'W_OTHER',
      contract_id: 'C_OTHER'
    }
  ];
  const billSelection =
    tenantBillsRuntimeIdentityRows_(
      billRows,
      billIdentity
    );

  if (
    billSelection.source !== 'line_user_id' ||
    billSelection.rows.length !== 1 ||
    billSelection.rows[0].bill_id !== 'B_TEST'
  ) {
    throw new Error(
      'TEST_FAILED: tenant bills identity escaped Workspace scope'
    );
  }

  const recipient =
    tenantMessageResolveLandlordRecipient_(
      canonical,
      Object.assign(
        {},
        canonical.landlord_tenant_link_row,
        {
          line_user_id: tenantLine
        }
      )
    );

  if (
    recipient.workspace_id !== 'W_TEST' ||
    recipient.landlord_id !== 'L_TEST' ||
    recipient.landlord_line_user_id !==
      landlordLine
  ) {
    throw new Error(
      'TEST_FAILED: validated landlord recipient mismatch'
    );
  }

  function expectRecipientFailure_(
    canonicalOverride,
    linkOverride,
    expectedCode
  ) {
    let code = '';

    try {
      tenantMessageResolveLandlordRecipient_(
        Object.assign(
          {},
          canonical,
          canonicalOverride || {}
        ),
        Object.assign(
          {},
          canonical.landlord_tenant_link_row,
          linkOverride || {}
        )
      );
    } catch (error) {
      code = error && error.code
        ? error.code
        : '';
    }

    if (code !== expectedCode) {
      throw new Error(
        'TEST_FAILED: expected recipient error ' +
        expectedCode +
        ', received ' +
        (code || 'NO_ERROR')
      );
    }
  }

  expectRecipientFailure_(
    {},
    { workspace_id: 'W_OTHER' },
    'TENANT_MESSAGE_WORKSPACE_CONFLICT'
  );
  expectRecipientFailure_(
    {},
    {
      landlord_line_user_id:
        'LANDLORD_LINE_OTHER'
    },
    'TENANT_MESSAGE_RECIPIENT_CONFLICT'
  );
  expectRecipientFailure_(
    { landlord_line_user_id: tenantLine },
    { landlord_line_user_id: tenantLine },
    'TENANT_MESSAGE_RECIPIENT_IS_TENANT'
  );

  const result = {
    success: true,
    tests: {
      tenant_home_identity: 'PASS',
      tenant_bills_identity: 'PASS',
      tenant_bills_workspace_isolation: 'PASS',
      tenant_message_ambiguous_line_ignored: 'PASS',
      tenant_message_workspace_isolation: 'PASS',
      tenant_message_recipient_conflict: 'PASS',
      tenant_message_recipient_not_tenant: 'PASS'
    },
    writes_performed: 0,
    line_pushes_performed: 0
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function testTenantRuntimeResolverSeparation() {
  const requiredReadFunctions = [
    'tenantRuntimeResolveCanonicalFromSnapshot_',
    'resolveCanonicalTenantRuntimeByLineUid_',
    'tenantRuntimeSelectLandlordLink_',
    'tenantRuntimeHomeData_'
  ];
  const missing =
    requiredReadFunctions.filter(function (name) {
      return typeof this[name] !== 'function';
    }, this);

  if (missing.length > 0) {
    throw new Error(
      'TEST_FAILED: missing resolver functions: ' +
      missing.join(', ')
    );
  }

  const landlordSelection =
    testTenantLandlordLinkDeterministicSelection();
  const runtimeIsolation =
    testTenantReadRuntimeIsolationFixtures();

  if (
    !landlordSelection ||
    landlordSelection.success !== true ||
    !runtimeIsolation ||
    runtimeIsolation.success !== true
  ) {
    throw new Error(
      'TEST_FAILED: resolver fixture suite failed'
    );
  }

  const result = {
    success: true,
    tests: {
      resolver_exports_present: 'PASS',
      deterministic_landlord_selection: 'PASS',
      home_identity_chain: 'PASS',
      bills_workspace_identity: 'PASS',
      message_recipient_isolation: 'PASS'
    },
    writes_performed: 0,
    line_pushes_performed: 0
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
