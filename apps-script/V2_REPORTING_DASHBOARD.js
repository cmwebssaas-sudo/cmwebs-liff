// CMWebs V2 landlord revenue dashboard.
// This module returns Workspace-scoped aggregates only; it never exposes raw
// bill, payment, tenant, LINE, or bank rows to the browser.

const V2_REPORTING_DASHBOARD_SHEETS_ = {
  properties: 'V2_properties',
  bills: 'V2_bills',
  payments: 'V2_payments'
};


function getLandlordRevenueDashboardByLineUid_(
  lineUserId,
  options
) {
  options = options || {};

  try {
    const access =
      workspaceLandlordResolveAccess_(
        lineUserId,
        { require_onboarding: true }
      );

    if (!access || access.success !== true) {
      return access || revenueDashboardResult_(
        false,
        'WORKSPACE_ACCESS_DENIED',
        '無法確認房東工作區權限'
      );
    }

    const ss = runtimeSpreadsheet_();
    const propertiesSheet = ss.getSheetByName(
      V2_REPORTING_DASHBOARD_SHEETS_.properties
    );
    const billsSheet = ss.getSheetByName(
      V2_REPORTING_DASHBOARD_SHEETS_.bills
    );

    if (!propertiesSheet || !billsSheet) {
      return revenueDashboardResult_(
        false,
        'REPORTING_SCHEMA_NOT_READY',
        '營收報表必要資料表尚未準備完成'
      );
    }

    const properties = workspaceGetObjectsWithRow_(
      propertiesSheet
    );
    const propertyIdMap = {};

    properties.forEach(function (property) {
      const propertyId = revenueDashboardText_(
        property.property_id
      );

      if (
        propertyId &&
        revenueDashboardRowMatchesAccess_(
          property,
          access,
          null
        )
      ) {
        propertyIdMap[propertyId] = true;
      }
    });

    const inScope = function (row) {
      return revenueDashboardRowMatchesAccess_(
        row,
        access,
        propertyIdMap
      );
    };

    const scopedProperties = properties.filter(inScope);
    const scopedBills = workspaceGetObjectsWithRow_(
      billsSheet
    ).filter(inScope);
    const paymentsSheet = ss.getSheetByName(
      V2_REPORTING_DASHBOARD_SHEETS_.payments
    );
    const scopedPayments = paymentsSheet
      ? workspaceGetObjectsWithRow_(paymentsSheet).filter(inScope)
      : [];

    const range = revenueDashboardResolveRange_(
      options,
      access
    );

    if (!range.success) {
      return range;
    }

    const data = revenueDashboardAggregate_(
      {
        properties: scopedProperties,
        bills: scopedBills,
        payments: scopedPayments
      },
      {
        workspace_id: revenueDashboardAccessWorkspaceId_(access),
        landlord_id: revenueDashboardAccessLandlordId_(access),
        from_month: range.data.from_month,
        to_month: range.data.to_month,
        property_id: revenueDashboardText_(options.property_id),
        as_of: range.data.as_of
      }
    );

    data.range = range.data;
    data.workspace_id = range.data.workspace_id;

    return revenueDashboardResult_(
      true,
      'OK',
      '營收儀表板資料載入成功',
      data
    );
  } catch (error) {
    return revenueDashboardResult_(
      false,
      'REPORTING_DASHBOARD_ERROR',
      '營收儀表板讀取錯誤：' + error.message
    );
  }
}


function revenueDashboardAggregate_(
  dataset,
  options
) {
  dataset = dataset || {};
  options = options || {};

  const properties = Array.isArray(dataset.properties)
    ? dataset.properties
    : [];
  const bills = Array.isArray(dataset.bills)
    ? dataset.bills
    : [];
  const payments = Array.isArray(dataset.payments)
    ? dataset.payments
    : [];
  const propertyMap = {};
  const paymentTotals = {};
  const fromMonth = revenueDashboardNormalizeMonth_(
    options.from_month
  );
  const toMonth = revenueDashboardNormalizeMonth_(
    options.to_month || options.from_month
  );
  const propertyFilter = revenueDashboardText_(
    options.property_id
  );

  properties.forEach(function (property) {
    const propertyId = revenueDashboardText_(
      property.property_id
    );

    if (
      propertyId &&
      revenueDashboardRowMatchesScope_(
        property,
        options,
        null
      )
    ) {
      propertyMap[propertyId] = property;
    }
  });

  payments.forEach(function (payment) {
    const billId = revenueDashboardText_(payment.bill_id);
    const status = revenueDashboardStatus_(
      payment.status || payment.payment_status
    );
    const amount = revenueDashboardAmount_(
      payment.amount || payment.payment_amount || payment.reported_amount
    );

    if (
      !billId ||
      amount <= 0 ||
      !revenueDashboardRowMatchesScope_(
        payment,
        options,
        propertyMap
      ) ||
      !revenueDashboardPaymentIsConfirmed_(status)
    ) {
      return;
    }

    paymentTotals[billId] =
      (paymentTotals[billId] || 0) + amount;
  });

  const monthMap = {};
  const propertyTotals = {};

  bills.forEach(function (bill) {
    const propertyId = revenueDashboardText_(
      bill.property_id
    );
    const billId = revenueDashboardText_(bill.bill_id);
    const month = revenueDashboardBillMonth_(bill);
    const amount = revenueDashboardAmount_(
      bill.total_amount ||
      bill.bill_total_amount ||
      bill.amount ||
      bill.bill_amount
    );

    if (
      !billId ||
      !month ||
      !revenueDashboardRowMatchesScope_(
        bill,
        options,
        propertyMap
      ) ||
      !revenueDashboardMonthInRange_(month, fromMonth, toMonth) ||
      (propertyFilter && propertyFilter !== propertyId) ||
      !revenueDashboardBillIsIncluded_(bill) ||
      amount <= 0
    ) {
      return;
    }

    const property = propertyMap[propertyId] || {};
    const collected = revenueDashboardCollectedAmount_(
      bill,
      paymentTotals[billId] || 0,
      amount
    );

    if (!monthMap[month]) {
      monthMap[month] = revenueDashboardEmptyTotal_(month);
    }

    monthMap[month].receivable += amount;
    monthMap[month].collected += collected;

    if (!propertyTotals[propertyId]) {
      propertyTotals[propertyId] = revenueDashboardEmptyTotal_(
        propertyId
      );
      delete propertyTotals[propertyId].month;
      propertyTotals[propertyId].property_name =
        revenueDashboardText_(
          property.property_name || property.name
        ) || propertyId;
      propertyTotals[propertyId].property_id = propertyId;
    }

    propertyTotals[propertyId].receivable += amount;
    propertyTotals[propertyId].collected += collected;
  });

  const months = Object.keys(monthMap)
    .sort()
    .map(function (month) {
      return revenueDashboardFinalizeTotal_(monthMap[month]);
    });
  const propertyRows = Object.keys(propertyTotals)
    .sort()
    .map(function (propertyId) {
      return revenueDashboardFinalizeTotal_(
        propertyTotals[propertyId]
      );
    });
  const kpis = revenueDashboardFinalizeTotal_({
    receivable: months.reduce(function (sum, row) {
      return sum + row.receivable;
    }, 0),
    collected: months.reduce(function (sum, row) {
      return sum + row.collected;
    }, 0)
  });

  return {
    has_data: months.length > 0,
    kpis: {
      receivable: kpis.receivable,
      collected: kpis.collected,
      outstanding: kpis.outstanding,
      collection_rate: kpis.collection_rate
    },
    months: months,
    properties: propertyRows,
    updated_at: revenueDashboardNowIso_()
  };
}


function revenueDashboardResolveRange_(
  options,
  access
) {
  options = options || {};
  const timezone = revenueDashboardAccessTimezone_(access);
  const currentMonth = revenueDashboardCurrentMonth_(timezone);
  let fromMonth = revenueDashboardNormalizeMonth_(
    options.from_month
  );
  let toMonth = revenueDashboardNormalizeMonth_(
    options.to_month
  );

  if (!fromMonth || !toMonth) {
    const range = revenueDashboardText_(
      options.range
    ).toLowerCase();
    const count = range === '1m' || range === 'month'
      ? 1
      : range === '3m'
        ? 3
        : 12;
    toMonth = currentMonth;
    fromMonth = revenueDashboardShiftMonth_(
      currentMonth,
      -(count - 1)
    );
  }

  if (
    !fromMonth ||
    !toMonth ||
    fromMonth > toMonth ||
    revenueDashboardMonthDistance_(fromMonth, toMonth) > 24
  ) {
    return revenueDashboardResult_(
      false,
      'INVALID_REPORTING_RANGE',
      '報表月份區間無效或超過 24 個月'
    );
  }

  return revenueDashboardResult_(
    true,
    'OK',
    '報表區間有效',
    {
      from_month: fromMonth,
      to_month: toMonth,
      as_of: revenueDashboardText_(options.as_of) || revenueDashboardToday_(timezone),
      workspace_id: revenueDashboardAccessWorkspaceId_(access)
    }
  );
}


function revenueDashboardRowMatchesAccess_(
  row,
  access,
  propertyIdMap
) {
  row = row || {};
  const workspaceId = revenueDashboardAccessWorkspaceId_(access);
  const landlordId = revenueDashboardAccessLandlordId_(access);
  const rowWorkspaceId = revenueDashboardText_(row.workspace_id);
  const rowLandlordId = revenueDashboardText_(row.landlord_id);
  const propertyId = revenueDashboardText_(row.property_id);

  if (rowWorkspaceId) {
    return rowWorkspaceId.toUpperCase() === workspaceId.toUpperCase();
  }

  if (
    rowLandlordId &&
    rowLandlordId.toUpperCase() !== landlordId.toUpperCase()
  ) {
    return false;
  }

  if (propertyIdMap && Object.keys(propertyIdMap).length > 0) {
    return Boolean(propertyId && propertyIdMap[propertyId]);
  }

  return Boolean(
    rowLandlordId &&
    rowLandlordId.toUpperCase() === landlordId.toUpperCase()
  );
}


function revenueDashboardRowMatchesScope_(
  row,
  options,
  propertyMap
) {
  row = row || {};
  options = options || {};

  const workspaceId = revenueDashboardText_(
    options.workspace_id
  ).toUpperCase();
  const landlordId = revenueDashboardText_(
    options.landlord_id
  ).toUpperCase();
  const rowWorkspaceId = revenueDashboardText_(
    row.workspace_id
  ).toUpperCase();
  const rowLandlordId = revenueDashboardText_(
    row.landlord_id
  ).toUpperCase();
  const propertyId = revenueDashboardText_(
    row.property_id
  );

  if (rowWorkspaceId) {
    return !workspaceId || rowWorkspaceId === workspaceId;
  }

  if (rowLandlordId) {
    return !landlordId || rowLandlordId === landlordId;
  }

  return Boolean(
    propertyMap &&
    propertyId &&
    propertyMap[propertyId]
  );
}


function revenueDashboardBillIsIncluded_(bill) {
  const status = revenueDashboardStatus_(
    bill.bill_status || bill.status
  );

  return [
    'voided',
    'void',
    'cancelled',
    'canceled',
    'draft',
    'deleted'
  ].indexOf(status) < 0;
}


function revenueDashboardPaymentIsConfirmed_(status) {
  return [
    'confirmed',
    'paid',
    'settled',
    'completed',
    'approved',
    'success'
  ].indexOf(status) >= 0;
}


function revenueDashboardCollectedAmount_(
  bill,
  paymentTotal,
  amount
) {
  if (paymentTotal > 0) {
    return Math.min(amount, paymentTotal);
  }

  const paymentStatus = revenueDashboardStatus_(
    bill.payment_status
  );
  const billStatus = revenueDashboardStatus_(
    bill.bill_status || bill.status
  );

  return (
    revenueDashboardPaymentIsConfirmed_(paymentStatus) ||
    ['paid', 'settled', 'confirmed', 'completed'].indexOf(billStatus) >= 0
  )
    ? amount
    : 0;
}


function revenueDashboardEmptyTotal_(key) {
  return {
    month: key,
    receivable: 0,
    collected: 0,
    outstanding: 0,
    collection_rate: null
  };
}


function revenueDashboardFinalizeTotal_(row) {
  const receivable = revenueDashboardAmount_(row.receivable);
  const collected = Math.min(
    receivable,
    revenueDashboardAmount_(row.collected)
  );

  return Object.assign({}, row, {
    receivable: receivable,
    collected: collected,
    outstanding: Math.max(0, receivable - collected),
    collection_rate: receivable > 0
      ? collected / receivable
      : null
  });
}


function revenueDashboardBillMonth_(bill) {
  return revenueDashboardNormalizeMonth_(
    bill.bill_month ||
    bill.month ||
    bill.due_date ||
    bill.created_at ||
    bill.updated_at
  );
}


function revenueDashboardNormalizeMonth_(value) {
  const text = revenueDashboardText_(value);
  const match = text.match(/^(\d{4})[-/](\d{1,2})/);

  if (!match) {
    return '';
  }

  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return '';
  }

  return match[1] + '-' + String(month).padStart(2, '0');
}


function revenueDashboardMonthInRange_(
  month,
  fromMonth,
  toMonth
) {
  return Boolean(
    month &&
    fromMonth &&
    toMonth &&
    month >= fromMonth &&
    month <= toMonth
  );
}


function revenueDashboardMonthDistance_(
  fromMonth,
  toMonth
) {
  const from = revenueDashboardMonthParts_(fromMonth);
  const to = revenueDashboardMonthParts_(toMonth);
  return (to.year - from.year) * 12 + (to.month - from.month);
}


function revenueDashboardShiftMonth_(month, delta) {
  const parts = revenueDashboardMonthParts_(month);
  const date = new Date(Date.UTC(parts.year, parts.month - 1 + delta, 1));
  return String(date.getUTCFullYear()) + '-' +
    String(date.getUTCMonth() + 1).padStart(2, '0');
}


function revenueDashboardMonthParts_(month) {
  return {
    year: Number(month.slice(0, 4)),
    month: Number(month.slice(5, 7))
  };
}


function revenueDashboardCurrentMonth_(timezone) {
  if (
    typeof Utilities !== 'undefined' &&
    Utilities.formatDate
  ) {
    return Utilities.formatDate(
      new Date(),
      timezone || 'Asia/Taipei',
      'yyyy-MM'
    );
  }

  const now = new Date();
  return String(now.getUTCFullYear()) + '-' +
    String(now.getUTCMonth() + 1).padStart(2, '0');
}


function revenueDashboardToday_(timezone) {
  if (
    typeof Utilities !== 'undefined' &&
    Utilities.formatDate
  ) {
    return Utilities.formatDate(
      new Date(),
      timezone || 'Asia/Taipei',
      'yyyy-MM-dd'
    );
  }

  return new Date().toISOString().slice(0, 10);
}


function revenueDashboardAccessWorkspaceId_(access) {
  return revenueDashboardText_(
    access &&
    access.workspace &&
    access.workspace.workspace_id
  );
}


function revenueDashboardAccessLandlordId_(access) {
  return revenueDashboardText_(
    access &&
    access.landlord &&
    access.landlord.landlord_id
  );
}


function revenueDashboardAccessTimezone_(access) {
  return revenueDashboardText_(
    access &&
    access.workspace &&
    access.workspace.timezone
  ) || 'Asia/Taipei';
}


function revenueDashboardAmount_(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}


function revenueDashboardStatus_(value) {
  return revenueDashboardText_(value).toLowerCase();
}


function revenueDashboardText_(value) {
  return value === undefined || value === null
    ? ''
    : String(value).trim();
}


function revenueDashboardNowIso_() {
  return new Date().toISOString();
}


function revenueDashboardResult_(
  success,
  code,
  message,
  data
) {
  return {
    success: Boolean(success),
    code: code || (success ? 'OK' : 'ERROR'),
    message: message || '',
    data: data === undefined ? null : data
  };
}
