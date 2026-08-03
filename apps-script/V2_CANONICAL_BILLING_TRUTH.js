/**
 * CMWebs V2 canonical billing truth.
 *
 * Read-only helpers shared by tenant and landlord billing projections. A bill
 * belongs to a tenant only through its canonical Workspace, tenant, and
 * contract identifiers; room number and name are display fields only.
 */

function v2CanonicalBillingText_(value) {
  return String(
    value === undefined || value === null
      ? ''
      : value
  ).trim();
}


function v2CanonicalBillingKey_(value) {
  return v2CanonicalBillingText_(value).toUpperCase();
}


function v2CanonicalBillPaymentStatus_(value) {
  const status = v2CanonicalBillingText_(value).toLowerCase();

  return [
    'paid',
    'settled',
    'confirmed',
    'complete',
    'completed',
    '已繳',
    '已繳清',
    '已付款'
  ].indexOf(status) >= 0
    ? 'paid'
    : 'unpaid';
}


function v2CanonicalBillIsVoided_(bill) {
  const status = v2CanonicalBillingText_(
    bill && bill.bill_status
  ).toLowerCase();

  return [
    'void',
    'voided',
    'cancelled',
    'canceled',
    'cancel',
    '作廢',
    '取消',
    '已取消'
  ].indexOf(status) >= 0;
}


function v2CanonicalBillIsOutstanding_(bill) {
  return (
    !v2CanonicalBillIsVoided_(bill) &&
    v2CanonicalBillPaymentStatus_(
      bill && bill.payment_status
    ) === 'unpaid'
  );
}


function v2CanonicalBillMonthKey_(value) {
  const text = v2CanonicalBillingText_(value);
  const match = text.match(/^(\d{4})[-\/](\d{1,2})/);

  if (match) {
    return match[1] + '-' + String(Number(match[2])).padStart(2, '0');
  }

  const compact = text.match(/^(\d{4})(\d{2})$/);

  return compact
    ? compact[1] + '-' + compact[2]
    : text;
}


function v2CanonicalBillsForTenantContract_(bills, identity) {
  const workspaceId = v2CanonicalBillingKey_(identity.workspace_id);
  const tenantId = v2CanonicalBillingKey_(identity.tenant_id);
  const contractId = v2CanonicalBillingKey_(identity.contract_id);

  if (!workspaceId || !tenantId || !contractId) {
    throw new Error('缺少 canonical billing identity');
  }

  return (bills || []).filter(function (bill) {
    return (
      v2CanonicalBillingKey_(bill.workspace_id) === workspaceId &&
      v2CanonicalBillingKey_(bill.tenant_id) === tenantId &&
      v2CanonicalBillingKey_(bill.contract_id) === contractId &&
      !v2CanonicalBillIsVoided_(bill)
    );
  });
}


function v2CanonicalNewestBillFirst_(left, right) {
  const monthCompare = v2CanonicalBillMonthKey_(right.bill_month)
    .localeCompare(v2CanonicalBillMonthKey_(left.bill_month));

  if (monthCompare !== 0) {
    return monthCompare;
  }

  return v2CanonicalBillingText_(right.due_date)
    .localeCompare(v2CanonicalBillingText_(left.due_date));
}


function v2CanonicalTenantBillingProjection_(bills, identity) {
  const canonicalBills = v2CanonicalBillsForTenantContract_(
    bills,
    identity
  ).sort(v2CanonicalNewestBillFirst_);
  const outstandingBills = canonicalBills.filter(
    v2CanonicalBillIsOutstanding_
  );
  const latestBill = outstandingBills[0] || canonicalBills[0] || null;

  return {
    bills: canonicalBills,
    outstanding_bills: outstandingBills,
    latest_bill: latestBill,
    unpaid_bill_count: outstandingBills.length,
    unpaid_total_amount: outstandingBills.reduce(function (total, bill) {
      return total + Number(bill.total_amount || 0);
    }, 0)
  };
}


/**
 * Read-only summary for an already-authorized collection of bills.  The
 * optional exclusion is deliberately an in-memory predicate: callers can
 * preview a cancellation without changing the bill object or its sheet row.
 */
function v2CanonicalOutstandingSummary_(bills, excludedBillIds) {
  const exclusions = {};

  (excludedBillIds || []).forEach(function (billId) {
    const key = v2CanonicalBillingKey_(billId);

    if (key) {
      exclusions[key] = true;
    }
  });

  const outstandingBills = (bills || []).filter(function (bill) {
    return (
      !exclusions[
        v2CanonicalBillingKey_(bill && bill.bill_id)
      ] &&
      v2CanonicalBillIsOutstanding_(bill)
    );
  });

  return {
    bills: outstandingBills,
    bill_ids: outstandingBills.map(function (bill) {
      return v2CanonicalBillingText_(bill.bill_id);
    }),
    unpaid_bill_count: outstandingBills.length,
    unpaid_total_amount: outstandingBills.reduce(function (total, bill) {
      return total + Number(bill.total_amount || 0);
    }, 0)
  };
}


function v2CanonicalBillsForWorkspace_(bills, workspaceId) {
  const expectedWorkspaceId = v2CanonicalBillingKey_(workspaceId);

  if (!expectedWorkspaceId) {
    throw new Error('缺少 Workspace billing identity');
  }

  return (bills || []).filter(function (bill) {
    return (
      v2CanonicalBillingKey_(bill && bill.workspace_id) ===
      expectedWorkspaceId
    );
  });
}


function v2CanonicalLatestActiveBillMonth_(bills) {
  return (bills || []).reduce(function (latest, bill) {
    if (v2CanonicalBillIsVoided_(bill)) {
      return latest;
    }

    const month = v2CanonicalBillMonthKey_(bill.bill_month);

    return month && month > latest
      ? month
      : latest;
  }, '');
}


function v2CanonicalWorkspaceCurrentMonthOutstandingSummary_(
  bills,
  excludedBillIds
) {
  const latestBillMonth = v2CanonicalLatestActiveBillMonth_(bills);
  const currentMonthBills = (bills || []).filter(function (bill) {
    return (
      v2CanonicalBillMonthKey_(bill.bill_month) ===
      latestBillMonth
    );
  });
  const summary = v2CanonicalOutstandingSummary_(
    currentMonthBills,
    excludedBillIds
  );

  summary.bill_month = latestBillMonth;

  return summary;
}
