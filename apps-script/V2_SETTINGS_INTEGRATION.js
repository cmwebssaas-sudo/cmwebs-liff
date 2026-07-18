/**
 * CMWebs V2 Workspace 設定整合層
 *
 * 將 V2_workspace_settings 的預設值提供給：
 * - 物件／房間建立
 * - 帳單與抄表
 * - 後續自動催繳
 *
 * 本模組只提供讀取與解析函式，不覆寫既有房間、租約或帳單。
 */

const V2_SETTINGS_INTEGRATION_SHEET_ =
  'V2_workspace_settings';

const V2_SETTINGS_INTEGRATION_DEFAULTS_ = {
  locale:
    'zh-TW',

  timezone:
    'Asia/Taipei',

  currency:
    'TWD',

  default_payment_day:
    10,

  default_electricity_fee_rate:
    3,

  summer_month_start:
    6,

  summer_month_end:
    9,

  summer_equipment_fee_rate:
    3.5,

  regular_equipment_fee_rate:
    2.5,

  default_management_fee:
    0,

  default_deposit_months:
    2,

  late_fee_type:
    'none',

  late_fee_value:
    0,

  late_fee_grace_days:
    0,

  auto_overdue_reminder:
    true,

  overdue_reminder_hour:
    10,

  overdue_reminder_days:
    [
      1,
      3,
      7
    ]
};


/**
 * 取得目前 Workspace 設定。
 *
 * accessOrWorkspaceId 可傳：
 * - workspaceLandlordResolveAccess_() 的 access
 * - workspace_id 字串
 */
function settingsIntegrationGetWorkspaceSettings_(
  ss,
  accessOrWorkspaceId
) {
  ss =
    ss ||
    SpreadsheetApp
      .getActiveSpreadsheet();

  const workspaceId =
    settingsIntegrationWorkspaceId_(
      accessOrWorkspaceId
    );

  const defaults =
    Object.assign(
      {},
      V2_SETTINGS_INTEGRATION_DEFAULTS_
    );

  if (!workspaceId) {
    return settingsIntegrationFinalize_(
      defaults,
      ''
    );
  }

  const sheet =
    ss.getSheetByName(
      V2_SETTINGS_INTEGRATION_SHEET_
    );

  if (!sheet) {
    return settingsIntegrationFinalize_(
      defaults,
      workspaceId
    );
  }

  const row =
    settingsIntegrationGetObjects_(
      sheet
    ).find(
      function (item) {
        return (
          settingsIntegrationText_(
            item.workspace_id
          ).toUpperCase() ===
          workspaceId
        );
      }
    ) ||
    {};

  const settings = {
    locale:
      settingsIntegrationText_(
        row.locale ||
        defaults.locale
      ),

    timezone:
      settingsIntegrationText_(
        row.timezone ||
        defaults.timezone
      ),

    currency:
      settingsIntegrationText_(
        row.currency ||
        defaults.currency
      ).toUpperCase(),

    default_payment_day:
      settingsIntegrationInteger_(
        row.default_payment_day,
        1,
        28,
        defaults.default_payment_day
      ),

    default_electricity_fee_rate:
      settingsIntegrationNumber_(
        row.default_electricity_fee_rate,
        0,
        100,
        defaults.default_electricity_fee_rate
      ),

    summer_month_start:
      settingsIntegrationInteger_(
        row.summer_month_start,
        1,
        12,
        defaults.summer_month_start
      ),

    summer_month_end:
      settingsIntegrationInteger_(
        row.summer_month_end,
        1,
        12,
        defaults.summer_month_end
      ),

    summer_equipment_fee_rate:
      settingsIntegrationNumber_(
        row.summer_equipment_fee_rate,
        0,
        100,
        defaults.summer_equipment_fee_rate
      ),

    regular_equipment_fee_rate:
      settingsIntegrationNumber_(
        row.regular_equipment_fee_rate,
        0,
        100,
        defaults.regular_equipment_fee_rate
      ),

    default_management_fee:
      settingsIntegrationNumber_(
        row.default_management_fee,
        0,
        1000000,
        defaults.default_management_fee
      ),

    default_deposit_months:
      settingsIntegrationNumber_(
        row.default_deposit_months,
        0,
        12,
        defaults.default_deposit_months
      ),

    late_fee_type:
      settingsIntegrationNormalizeLateFeeType_(
        row.late_fee_type ||
        defaults.late_fee_type
      ),

    late_fee_value:
      settingsIntegrationNumber_(
        row.late_fee_value,
        0,
        1000000,
        defaults.late_fee_value
      ),

    late_fee_grace_days:
      settingsIntegrationInteger_(
        row.late_fee_grace_days,
        0,
        60,
        defaults.late_fee_grace_days
      ),

    auto_overdue_reminder:
      settingsIntegrationBooleanDefault_(
        row.auto_overdue_reminder,
        defaults.auto_overdue_reminder
      ),

    overdue_reminder_hour:
      settingsIntegrationInteger_(
        row.overdue_reminder_hour,
        0,
        23,
        defaults.overdue_reminder_hour
      ),

    overdue_reminder_days:
      settingsIntegrationParseReminderDays_(
        row.overdue_reminder_days_json ||
        defaults.overdue_reminder_days
      )
  };

  return settingsIntegrationFinalize_(
    settings,
    workspaceId
  );
}


function settingsIntegrationFinalize_(
  settings,
  workspaceId
) {
  const summerMonths =
    settingsIntegrationBuildMonthRange_(
      settings.summer_month_start,
      settings.summer_month_end
    );

  return Object.assign(
    {},
    settings,
    {
      workspace_id:
        workspaceId,

      summer_months:
        summerMonths,

      summer_months_csv:
        summerMonths.join(
          ','
        ),

      summer_months_label:
        settingsIntegrationMonthsLabel_(
          summerMonths
        )
    }
  );
}


function settingsIntegrationBuildBillingDefaultsView_(
  settings
) {
  settings =
    settings ||
    settingsIntegrationFinalize_(
      Object.assign(
        {},
        V2_SETTINGS_INTEGRATION_DEFAULTS_
      ),
      ''
    );

  return {
    default_payment_day:
      settings.default_payment_day,

    default_electricity_fee_rate:
      settings.default_electricity_fee_rate,

    summer_equipment_fee_rate:
      settings.summer_equipment_fee_rate,

    regular_equipment_fee_rate:
      settings.regular_equipment_fee_rate,

    default_management_fee:
      settings.default_management_fee,

    default_deposit_months:
      settings.default_deposit_months,

    summer_month_start:
      settings.summer_month_start,

    summer_month_end:
      settings.summer_month_end,

    summer_months:
      settings.summer_months,

    summer_months_csv:
      settings.summer_months_csv,

    summer_months_label:
      settings.summer_months_label,

    currency:
      settings.currency,

    timezone:
      settings.timezone
  };
}


/**
 * 優先讀取房間／租約的 equipment_summer_months，
 * 沒有時才使用 Workspace 預設月份。
 */
function settingsIntegrationResolveSummerMonths_(
  sourceValue,
  settings
) {
  const parsed =
    settingsIntegrationParseMonths_(
      sourceValue
    );

  if (
    parsed.length >
    0
  ) {
    return parsed;
  }

  if (
    settings &&
    Array.isArray(
      settings.summer_months
    ) &&
    settings.summer_months.length >
    0
  ) {
    return settings.summer_months.slice();
  }

  return settingsIntegrationBuildMonthRange_(
    settings &&
    settings.summer_month_start,
    settings &&
    settings.summer_month_end
  );
}


function settingsIntegrationIsSummerMonth_(
  value,
  settingsOrMonths
) {
  const month =
    settingsIntegrationMonthNumber_(
      value
    );

  const months =
    Array.isArray(
      settingsOrMonths
    )
      ? settingsIntegrationParseMonths_(
          settingsOrMonths
        )
      : settingsIntegrationResolveSummerMonths_(
          '',
          settingsOrMonths ||
          V2_SETTINGS_INTEGRATION_DEFAULTS_
        );

  return (
    months.indexOf(
      month
    ) >=
    0
  );
}


function settingsIntegrationSummerMonthsCsv_(
  settingsOrMonths
) {
  const months =
    Array.isArray(
      settingsOrMonths
    )
      ? settingsIntegrationParseMonths_(
          settingsOrMonths
        )
      : settingsIntegrationResolveSummerMonths_(
          '',
          settingsOrMonths ||
          V2_SETTINGS_INTEGRATION_DEFAULTS_
        );

  return months.join(
    ','
  );
}


function settingsIntegrationSummerMonthsLabel_(
  settingsOrMonths
) {
  const months =
    Array.isArray(
      settingsOrMonths
    )
      ? settingsIntegrationParseMonths_(
          settingsOrMonths
        )
      : settingsIntegrationResolveSummerMonths_(
          '',
          settingsOrMonths ||
          V2_SETTINGS_INTEGRATION_DEFAULTS_
        );

  return settingsIntegrationMonthsLabel_(
    months
  );
}


function settingsIntegrationBuildMonthRange_(
  startValue,
  endValue
) {
  const start =
    settingsIntegrationInteger_(
      startValue,
      1,
      12,
      6
    );

  const end =
    settingsIntegrationInteger_(
      endValue,
      1,
      12,
      9
    );

  const months = [];
  let current =
    start;

  for (
    let index = 0;
    index < 12;
    index += 1
  ) {
    months.push(
      current
    );

    if (
      current ===
      end
    ) {
      break;
    }

    current =
      current ===
        12
        ? 1
        : current + 1;
  }

  return months;
}


function settingsIntegrationParseMonths_(
  value
) {
  let values =
    value;

  if (
    !Array.isArray(
      values
    )
  ) {
    const text =
      settingsIntegrationText_(
        value
      );

    if (!text) {
      return [];
    }

    values =
      text
        .replace(
          /[\[\]"']/g,
          ''
        )
        .split(
          /[,，\s]+/
        );
  }

  const seen = {};

  return values
    .map(
      function (item) {
        return Math.round(
          Number(
            item
          )
        );
      }
    )
    .filter(
      function (month) {
        if (
          !Number.isFinite(
            month
          ) ||
          month <
          1 ||
          month >
          12 ||
          seen[
            month
          ]
        ) {
          return false;
        }

        seen[
          month
        ] = true;

        return true;
      }
    );
}


function settingsIntegrationMonthsLabel_(
  months
) {
  months =
    settingsIntegrationParseMonths_(
      months
    );

  if (
    months.length ===
    0
  ) {
    return '夏月';
  }

  if (
    months.length ===
    1
  ) {
    return (
      months[0] +
      ' 月'
    );
  }

  const continuous =
    months.every(
      function (month, index) {
        if (
          index ===
          0
        ) {
          return true;
        }

        const previous =
          months[
            index - 1
          ];

        return (
          month ===
          (
            previous ===
              12
              ? 1
              : previous + 1
          )
        );
      }
    );

  if (continuous) {
    return (
      months[0] +
      '–' +
      months[
        months.length - 1
      ] +
      ' 月'
    );
  }

  return (
    months.join(
      '、'
    ) +
    ' 月'
  );
}


function settingsIntegrationMonthNumber_(
  value
) {
  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {
    return (
      value.getMonth() +
      1
    );
  }

  if (
    typeof value ===
    'number' &&
    Number.isFinite(
      value
    ) &&
    value >=
    1 &&
    value <=
    12
  ) {
    return Math.round(
      value
    );
  }

  const text =
    settingsIntegrationText_(
      value
    );

  const billMonthMatch =
    text.match(
      /^\d{4}[-\/](\d{1,2})/
    );

  if (
    billMonthMatch
  ) {
    return Number(
      billMonthMatch[1]
    );
  }

  const parsed =
    new Date(
      text
    );

  return Number.isNaN(
    parsed.getTime()
  )
    ? new Date().getMonth() + 1
    : parsed.getMonth() + 1;
}


function settingsIntegrationWorkspaceId_(
  accessOrWorkspaceId
) {
  if (
    accessOrWorkspaceId &&
    typeof accessOrWorkspaceId ===
      'object'
  ) {
    return settingsIntegrationText_(
      accessOrWorkspaceId.workspace &&
      accessOrWorkspaceId.workspace
        .workspace_id ||
      accessOrWorkspaceId.workspace_id
    ).toUpperCase();
  }

  return settingsIntegrationText_(
    accessOrWorkspaceId
  ).toUpperCase();
}


function settingsIntegrationGetObjects_(
  sheet
) {
  if (
    typeof workspaceGetObjectsWithRow_ ===
    'function'
  ) {
    return workspaceGetObjectsWithRow_(
      sheet
    );
  }

  if (
    !sheet ||
    sheet.getLastRow() <
    2
  ) {
    return [];
  }

  const values =
    sheet
      .getDataRange()
      .getValues();

  const headers =
    values[0].map(
      settingsIntegrationText_
    );

  return values
    .slice(
      1
    )
    .map(
      function (row, index) {
        const object = {
          __row_number:
            index + 2
        };

        headers.forEach(
          function (header, columnIndex) {
            object[
              header
            ] =
              row[
                columnIndex
              ];
          }
        );

        return object;
      }
    );
}


function settingsIntegrationParseReminderDays_(
  value
) {
  let values =
    value;

  if (
    !Array.isArray(
      values
    )
  ) {
    const text =
      settingsIntegrationText_(
        value
      );

    if (!text) {
      values = [
        1,
        3,
        7
      ];

    } else {
      try {
        values =
          JSON.parse(
            text
          );
      } catch (error) {
        values =
          text.split(
            /[,，\s]+/
          );
      }
    }
  }

  const seen = {};

  return (
    Array.isArray(
      values
    )
      ? values
      : []
  )
    .map(
      function (item) {
        return Math.round(
          Number(
            item
          )
        );
      }
    )
    .filter(
      function (day) {
        if (
          !Number.isFinite(
            day
          ) ||
          day <
          0 ||
          day >
          365 ||
          seen[
            day
          ]
        ) {
          return false;
        }

        seen[
          day
        ] = true;

        return true;
      }
    )
    .sort(
      function (a, b) {
        return a - b;
      }
    );
}


function settingsIntegrationNormalizeLateFeeType_(
  value
) {
  const type =
    settingsIntegrationText_(
      value
    ).toLowerCase();

  return [
    'none',
    'fixed',
    'percent'
  ].indexOf(
    type
  ) >=
  0
    ? type
    : 'none';
}


function settingsIntegrationBooleanDefault_(
  value,
  fallback
) {
  if (
    value ===
      '' ||
    value ===
      null ||
    value ===
      undefined
  ) {
    return fallback;
  }

  if (
    value ===
    true
  ) {
    return true;
  }

  return [
    '1',
    'true',
    'yes',
    'y',
    'on',
    'enabled',
    'active'
  ].indexOf(
    settingsIntegrationText_(
      value
    ).toLowerCase()
  ) >=
  0;
}


function settingsIntegrationInteger_(
  value,
  min,
  max,
  fallback
) {
  const number =
    Math.round(
      Number(
        value
      )
    );

  if (
    !Number.isFinite(
      number
    ) ||
    number <
    min ||
    number >
    max
  ) {
    return fallback;
  }

  return number;
}


function settingsIntegrationNumber_(
  value,
  min,
  max,
  fallback
) {
  const number =
    Number(
      settingsIntegrationText_(
        value
      ).replace(
        /,/g,
        ''
      )
    );

  if (
    !Number.isFinite(
      number
    ) ||
    number <
    min ||
    number >
    max
  ) {
    return fallback;
  }

  return number;
}


function settingsIntegrationText_(
  value
) {
  return value ===
      undefined ||
    value ===
      null
    ? ''
    : String(
        value
      ).trim();
}


function testWorkspaceSettingsIntegration() {
  const result =
    settingsIntegrationGetWorkspaceSettings_(
      SpreadsheetApp
        .getActiveSpreadsheet(),
      'W000001'
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
