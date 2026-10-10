/**
 * STAGING ONLY: one-time schema bootstrap for tenant binding.
 *
 * This function is intentionally not called by doGet, a route handler or the
 * binding runtime. Run it manually before a staging release. Production must
 * never include this module.
 */
function prepareStagingTenantBindingSchema_() {
  const ss = runtimeSpreadsheet_();
  const requirements = {
    V2_tenant_bill_view: [
      'tenant_line_user_id'
    ],
    V2_bills: [
      'tenant_line_user_id'
    ],
    V2_payment_reports: [
      'tenant_line_user_id'
    ],
    V2_tenant_messages: [
      'tenant_line_user_id'
    ]
  };
  const result = {
    environment: 'staging',
    created_sheets: [],
    added_headers: [],
    canonicalized_log_headers: []
  };

  Object.keys(requirements).forEach(function (sheetName) {
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      result.created_sheets.push(sheetName);
    }

    requirements[sheetName].forEach(function (header) {
      const before = sheet.getLastColumn();
      tenantBindingEnsureHeader_(sheet, header);

      if (sheet.getLastColumn() > before) {
        result.added_headers.push(sheetName + '.' + header);
      }
    });
  });

  stagingTenantBindingSetCanonicalHeader_(
    ss,
    V2_TENANT_BINDING_SHEETS_.bindingLogs,
    [
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
    ],
    result
  );
  stagingTenantBindingSetCanonicalHeader_(
    ss,
    'V2_liff_access_logs',
    [
      'log_id',
      'created_at',
      'line_user_id',
      'user_id',
      'role',
      'action',
      'target_id',
      'result',
      'error_message',
      'user_agent',
      'ip_hint',
      'notes'
    ],
    result
  );

  return result;
}


function stagingTenantBindingSetCanonicalHeader_(
  ss,
  sheetName,
  headers,
  result
) {
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    result.created_sheets.push(sheetName);
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  result.canonicalized_log_headers.push(sheetName);
}
