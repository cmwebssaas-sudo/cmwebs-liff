/**
 * 檢查 603 帳單目前在 V2 的實際狀態
 */
function testInspectRoom603Bill() {
  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

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