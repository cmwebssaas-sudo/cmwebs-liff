// ==================================================
// CMWebs V2 Paid Bill Management
// 房東已繳帳單統一管理
//
// 資料來源：
// - V2_bills
// - V2_payments
//
// 用途：
// - 顯示所有 V2 已繳帳單
// - 不限定付款回報或房東手動銷帳
// - 提供前端撤銷已繳／恢復欠款入口
// ==================================================

const PAID_BILL_MANAGEMENT_BILLS_SHEET =
  'V2_bills';

const PAID_BILL_MANAGEMENT_PAYMENTS_SHEET =
  'V2_payments';

const PAID_BILL_MANAGEMENT_LANDLORD_HOME_VIEW =
  'V2_landlord_home_view';

const PAID_BILL_MANAGEMENT_TENANT_LIST_VIEW =
  'V2_landlord_tenant_list_view';

const PAID_BILL_MANAGEMENT_LANDLORDS_SHEET =
  'V2_landlords';


// ==================================================
// 主查詢函式
// ==================================================

/**
 * 取得房東所有已繳帳單。
 *
 * 預計 Code.gs 路由：
 * v2_action=landlord_paid_bills_init
 *
 * @param {string} landlordLineUserId 房東 LINE UID
 * @return {Object}
 */
function getLandlordPaidBillsInitByLineUid_(
  landlordLineUserId
) {
  const action =
    'landlord_paid_bills_init';

  try {
    landlordLineUserId =
      paidBillManagementText_(
        landlordLineUserId
      );

    if (!landlordLineUserId) {
      return {
        success: false,
        code:
          'MISSING_LANDLORD_LINE_UID',
        message:
          '缺少房東 LINE UID',

        data: {
          landlord: null,
          summary: {
            paid_bill_count: 0,
            paid_total_amount: 0,
            payment_report_count: 0,
            manual_count: 0,
            legacy_count: 0,
            other_count: 0
          },
          paid_bills: []
        }
      };
    }

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const landlord =
      paidBillManagementResolveLandlord_(
        ss,
        landlordLineUserId
      );

    if (!landlord) {
      return {
        success: false,
        code:
          'LANDLORD_NOT_FOUND',
        message:
          '查無房東資料或尚未完成綁定',

        data: {
          landlord: null,
          summary: {
            paid_bill_count: 0,
            paid_total_amount: 0,
            payment_report_count: 0,
            manual_count: 0,
            legacy_count: 0,
            other_count: 0
          },
          paid_bills: []
        }
      };
    }

    const landlordId =
      paidBillManagementText_(
        landlord.landlord_id
      );

    if (!landlordId) {
      return {
        success: false,
        code:
          'MISSING_LANDLORD_ID',
        message:
          '房東資料缺少 landlord_id',

        data: {
          landlord:
            landlord,

          summary: {
            paid_bill_count: 0,
            paid_total_amount: 0,
            payment_report_count: 0,
            manual_count: 0,
            legacy_count: 0,
            other_count: 0
          },

          paid_bills: []
        }
      };
    }

    const billSheet =
      ss.getSheetByName(
        PAID_BILL_MANAGEMENT_BILLS_SHEET
      );

    if (!billSheet) {
      return {
        success: false,
        code:
          'BILL_SHEET_NOT_FOUND',
        message:
          '找不到 V2_bills',

        data: {
          landlord:
            landlord,

          summary: {
            paid_bill_count: 0,
            paid_total_amount: 0,
            payment_report_count: 0,
            manual_count: 0,
            legacy_count: 0,
            other_count: 0
          },

          paid_bills: []
        }
      };
    }

    const paymentSheet =
      ss.getSheetByName(
        PAID_BILL_MANAGEMENT_PAYMENTS_SHEET
      );

    const bills =
      paidBillManagementGetObjects_(
        billSheet
      );

    const payments =
      paidBillManagementGetObjects_(
        paymentSheet
      );

    /*
     * 建立付款索引：
     * 1. 依 payment_id
     * 2. 依 bill_id
     */
    const paymentById = {};
    const paymentsByBillId = {};

    payments.forEach(
      function (payment) {
        const paymentId =
          paidBillManagementText_(
            payment.payment_id
          );

        const billId =
          paidBillManagementText_(
            payment.bill_id
          );

        if (paymentId) {
          paymentById[paymentId] =
            payment;
        }

        if (billId) {
          if (
            !paymentsByBillId[
              billId
            ]
          ) {
            paymentsByBillId[
              billId
            ] = [];
          }

          paymentsByBillId[
            billId
          ].push(
            payment
          );
        }
      }
    );

    Object.keys(
      paymentsByBillId
    ).forEach(
      function (billId) {
        paymentsByBillId[
          billId
        ].sort(
          function (a, b) {
            return (
              paidBillManagementTimeValue_(
                b.updated_at ||
                b.created_at ||
                b.payment_date
              ) -
              paidBillManagementTimeValue_(
                a.updated_at ||
                a.created_at ||
                a.payment_date
              )
            );
          }
        );
      }
    );

    const tenantMap =
      paidBillManagementBuildTenantMap_(
        ss,
        landlordLineUserId
      );

    const paidBills =
      bills
        .filter(
          function (bill) {
            const rowLandlordId =
              paidBillManagementText_(
                bill.landlord_id
              );

            const paymentStatus =
              paidBillManagementText_(
                bill.payment_status
              ).toLowerCase();

            const isPaid =
              paymentStatus ===
                'paid' ||
              paymentStatus ===
                '已繳';

            return (
              rowLandlordId ===
                landlordId &&
              isPaid
            );
          }
        )
        .map(
          function (bill) {
            const billId =
              paidBillManagementText_(
                bill.bill_id
              );

            const billPaymentId =
              paidBillManagementText_(
                bill.payment_id
              );

            let payment = null;

            /*
             * 優先依 V2_bills.payment_id 找付款。
             */
            if (
              billPaymentId &&
              paymentById[
                billPaymentId
              ]
            ) {
              payment =
                paymentById[
                  billPaymentId
                ];
            }

            /*
             * payment_id 找不到時，
             * 依 bill_id 找最新有效付款。
             */
            if (!payment) {
              const candidates =
                paymentsByBillId[
                  billId
                ] || [];

              payment =
                candidates.find(
                  function (
                    candidate
                  ) {
                    return (
                      paidBillManagementIsActivePayment_(
                        candidate
                      )
                    );
                  }
                ) || null;
            }

            /*
             * 若找不到有效付款，但帳單仍為 paid，
             * 仍顯示帳單，避免已繳資料無法管理。
             */
            const tenantId =
              paidBillManagementText_(
                bill.tenant_id
              );

            const tenant =
              tenantMap[
                tenantId
              ] || {};

            const sourceType =
              paidBillManagementResolveSourceType_(
                bill,
                payment
              );

            const paymentAmount =
              payment
                ? paidBillManagementNumber_(
                    paidBillManagementFirstValue_(
                      payment,
                      [
                        'amount',
                        'payment_amount',
                        'reported_amount'
                      ]
                    )
                  )
                : paidBillManagementNumber_(
                    bill.total_amount
                  );

            const paymentDate =
              payment
                ? paidBillManagementFirstValue_(
                    payment,
                    [
                      'payment_date',
                      'paid_at',
                      'confirmed_at',
                      'created_at'
                    ]
                  )
                : (
                    bill.paid_at ||
                    bill.updated_at ||
                    ''
                  );

            return {
              bill_id:
                billId,

              bill_month:
                bill.bill_month || '',

              due_date:
                bill.due_date || '',

              landlord_id:
                bill.landlord_id || '',

              property_id:
                bill.property_id || '',

              room_id:
                bill.room_id || '',

              room_name:
                bill.room_name || '',

              contract_id:
                bill.contract_id || '',

              tenant_id:
                bill.tenant_id || '',

              tenant_user_id:
                bill.user_id || '',

              tenant_line_user_id:
                tenant
                  .tenant_line_user_id ||
                '',

              tenant_name:
                bill.tenant_name ||
                tenant.tenant_name ||
                '',

              total_amount:
                paidBillManagementNumber_(
                  bill.total_amount
                ),

              bill_status:
                bill.bill_status || '',

              payment_status:
                bill.payment_status || '',

              paid_at:
                bill.paid_at || '',

              payment_id:
                payment
                  ? (
                      payment.payment_id ||
                      billPaymentId
                    )
                  : billPaymentId,

              payment_amount:
                paymentAmount,

              payment_date:
                paymentDate,

              payment_method:
                payment
                  ? (
                      payment
                        .payment_method ||
                      ''
                    )
                  : '',

              bank_last5:
                payment
                  ? (
                      payment.bank_last5 ||
                      ''
                    )
                  : '',

              confirmation_source:
                payment
                  ? (
                      payment
                        .confirmation_source ||
                      ''
                    )
                  : '',

              payment_source:
                payment
                  ? (
                      payment.source ||
                      ''
                    )
                  : '',

              payment_source_ref_id:
                payment
                  ? (
                      payment
                        .source_ref_id ||
                      ''
                    )
                  : '',

              payment_record_status:
                payment
                  ? (
                      payment.status ||
                      ''
                    )
                  : '',

              payment_note:
                payment
                  ? (
                      payment.note ||
                      ''
                    )
                  : '',

              source_type:
                sourceType,

              source_label:
                paidBillManagementSourceLabel_(
                  sourceType
                ),

              has_payment_record:
                payment !== null,

              reversible:
                true,

              legacy_source:
                bill.legacy_source || '',

              legacy_ref:
                bill.legacy_ref || '',

              updated_at:
                bill.updated_at || ''
            };
          }
        );

    /*
     * 最新繳款排前面。
     */
    paidBills.sort(
      function (a, b) {
        const timeDifference =
          paidBillManagementTimeValue_(
            b.payment_date ||
            b.paid_at ||
            b.updated_at
          ) -
          paidBillManagementTimeValue_(
            a.payment_date ||
            a.paid_at ||
            a.updated_at
          );

        if (
          timeDifference !== 0
        ) {
          return timeDifference;
        }

        const monthCompare =
          paidBillManagementBillMonthKey_(
            b.bill_month
          ).localeCompare(
            paidBillManagementBillMonthKey_(
              a.bill_month
            )
          );

        if (
          monthCompare !== 0
        ) {
          return monthCompare;
        }

        return String(
          a.room_name || ''
        ).localeCompare(
          String(
            b.room_name || ''
          ),
          'zh-TW',
          {
            numeric: true
          }
        );
      }
    );

    const summary = {
      paid_bill_count:
        paidBills.length,

      paid_total_amount:
        paidBills.reduce(
          function (
            total,
            bill
          ) {
            return (
              total +
              paidBillManagementNumber_(
                bill.total_amount
              )
            );
          },
          0
        ),

      payment_report_count:
        paidBills.filter(
          function (bill) {
            return (
              bill.source_type ===
              'payment_report'
            );
          }
        ).length,

      manual_count:
        paidBills.filter(
          function (bill) {
            return (
              bill.source_type ===
              'manual'
            );
          }
        ).length,

      legacy_count:
        paidBills.filter(
          function (bill) {
            return (
              bill.source_type ===
              'legacy'
            );
          }
        ).length,

      other_count:
        paidBills.filter(
          function (bill) {
            return (
              bill.source_type ===
              'other'
            );
          }
        ).length,

      data_source:
        'V2_bills',

      updated_at:
        new Date()
    };

    try {
      if (
        typeof logLiffAccess_ ===
        'function'
      ) {
        logLiffAccess_({
          lineUserId:
            landlordLineUserId,

          userId:
            landlord.user_id || '',

          role:
            'landlord',

          action:
            action,

          targetId:
            landlordId,

          result:
            'success',

          errorMessage:
            '',

          notes:
            [
              'source=V2_bills',
              'paid_bill_count=' +
                paidBills.length
            ].join(', ')
        });
      }
    } catch (logError) {
      // 查詢紀錄失敗不影響主功能
    }

    return {
      success: true,
      code:
        'OK',
      message:
        '查詢成功',

      data: {
        landlord: {
          line_user_id:
            landlordLineUserId,

          user_id:
            landlord.user_id || '',

          landlord_id:
            landlordId,

          landlord_name:
            landlord.landlord_name ||
            '',

          room_count:
            paidBillManagementNumber_(
              landlord.room_count
            ),

          tenant_count:
            paidBillManagementNumber_(
              landlord.tenant_count
            ),

          account_status:
            landlord.account_status ||
            'active'
        },

        summary:
          summary,

        paid_bills:
          paidBills
      }
    };

  } catch (error) {
    try {
      if (
        typeof logLiffAccess_ ===
        'function'
      ) {
        logLiffAccess_({
          lineUserId:
            landlordLineUserId || '',

          userId:
            '',

          role:
            'landlord',

          action:
            action,

          targetId:
            '',

          result:
            'failed',

          errorMessage:
            error &&
            error.message
              ? error.message
              : String(error)
        });
      }
    } catch (logError) {
      // 忽略紀錄錯誤
    }

    return {
      success: false,
      code:
        'PAID_BILL_QUERY_ERROR',

      message:
        '已繳帳單查詢失敗：' +
        (
          error &&
          error.message
            ? error.message
            : String(error)
        ),

      data: {
        landlord: null,

        summary: {
          paid_bill_count: 0,
          paid_total_amount: 0,
          payment_report_count: 0,
          manual_count: 0,
          legacy_count: 0,
          other_count: 0
        },

        paid_bills: []
      }
    };
  }
}


// ==================================================
// 房東與房客資料
// ==================================================

function paidBillManagementResolveLandlord_(
  ss,
  landlordLineUserId
) {
  const candidateSheets = [
    PAID_BILL_MANAGEMENT_LANDLORD_HOME_VIEW,
    PAID_BILL_MANAGEMENT_TENANT_LIST_VIEW,
    PAID_BILL_MANAGEMENT_LANDLORDS_SHEET
  ];

  for (
    let sheetIndex = 0;
    sheetIndex < candidateSheets.length;
    sheetIndex++
  ) {
    const sheet =
      ss.getSheetByName(
        candidateSheets[
          sheetIndex
        ]
      );

    if (
      !sheet ||
      sheet.getLastRow() < 2
    ) {
      continue;
    }

    const rows =
      paidBillManagementGetObjects_(
        sheet
      );

    for (
      let index = 0;
      index < rows.length;
      index++
    ) {
      const row =
        rows[index];

      const rowLineUserId =
        paidBillManagementText_(
          row.line_user_id ||
          row.landlord_line_user_id
        );

      if (
        rowLineUserId !==
        landlordLineUserId
      ) {
        continue;
      }

      return {
        line_user_id:
          rowLineUserId,

        user_id:
          paidBillManagementText_(
            row.landlord_user_id ||
            row.user_id
          ),

        landlord_id:
          paidBillManagementText_(
            row.landlord_id
          ),

        landlord_name:
          paidBillManagementText_(
            row.landlord_name ||
            row.owner_name ||
            row.name
          ),

        room_count:
          paidBillManagementNumber_(
            row.room_count
          ),

        tenant_count:
          paidBillManagementNumber_(
            row.tenant_count
          ),

        account_status:
          paidBillManagementText_(
            row.account_status
          ) ||
          'active'
      };
    }
  }

  return null;
}


function paidBillManagementBuildTenantMap_(
  ss,
  landlordLineUserId
) {
  const map = {};

  const sheet =
    ss.getSheetByName(
      PAID_BILL_MANAGEMENT_TENANT_LIST_VIEW
    );

  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {
    return map;
  }

  const rows =
    paidBillManagementGetObjects_(
      sheet
    );

  rows.forEach(
    function (row) {
      const rowLandlordLineUserId =
        paidBillManagementText_(
          row.line_user_id ||
          row.landlord_line_user_id
        );

      if (
        rowLandlordLineUserId !==
        landlordLineUserId
      ) {
        return;
      }

      const tenantId =
        paidBillManagementText_(
          row.tenant_id
        );

      if (!tenantId) {
        return;
      }

      map[tenantId] = {
        tenant_id:
          tenantId,

        tenant_user_id:
          paidBillManagementText_(
            row.tenant_user_id ||
            row.user_id
          ),

        tenant_line_user_id:
          paidBillManagementText_(
            row.tenant_line_user_id
          ),

        tenant_name:
          paidBillManagementText_(
            row.tenant_name
          ),

        room_list:
          paidBillManagementText_(
            row.room_list
          )
      };
    }
  );

  return map;
}


// ==================================================
// 付款來源判斷
// ==================================================

function paidBillManagementResolveSourceType_(
  bill,
  payment
) {
  const paymentId =
    paidBillManagementText_(
      payment
        ? payment.payment_id
        : bill.payment_id
    ).toUpperCase();

  const source =
    paidBillManagementText_(
      payment
        ? payment.source
        : ''
    ).toLowerCase();

  const sourceRefId =
    paidBillManagementText_(
      payment
        ? payment.source_ref_id
        : ''
    ).toUpperCase();

  const confirmationSource =
    paidBillManagementText_(
      payment
        ? payment.confirmation_source
        : ''
    ).toLowerCase();

  const legacySource =
    paidBillManagementText_(
      bill.legacy_source
    ).toLowerCase();

  if (
    paymentId.indexOf(
      'PAY-MANUAL-'
    ) === 0 ||
    source.indexOf(
      'manual'
    ) !== -1 ||
    source.indexOf(
      'landlord'
    ) !== -1 ||
    confirmationSource ===
      'private_message' ||
    confirmationSource ===
      'transfer_screenshot' ||
    confirmationSource ===
      'phone' ||
    confirmationSource ===
      'onsite_cash'
  ) {
    return 'manual';
  }

  if (
    sourceRefId.indexOf(
      'PR-'
    ) === 0 ||
    source.indexOf(
      'payment_report'
    ) !== -1 ||
    source.indexOf(
      'tenant_report'
    ) !== -1
  ) {
    return 'payment_report';
  }

  if (
    source.indexOf(
      'legacy'
    ) !== -1 ||
    source.indexOf(
      'v1'
    ) !== -1 ||
    legacySource
  ) {
    return 'legacy';
  }

  return 'other';
}


function paidBillManagementSourceLabel_(
  sourceType
) {
  const map = {
    payment_report:
      '房客付款回報',

    manual:
      '房東手動銷帳',

    legacy:
      'V1 同步',

    other:
      '其他付款'
  };

  return (
    map[sourceType] ||
    '其他付款'
  );
}


function paidBillManagementIsActivePayment_(
  payment
) {
  const status =
    paidBillManagementText_(
      payment.status
    ).toLowerCase();

  return [
    'void',
    'voided',
    'cancelled',
    'canceled',
    'rejected',
    'failed'
  ].indexOf(status) === -1;
}


// ==================================================
// 共用工具
// ==================================================

function paidBillManagementGetObjects_(
  sheet
) {
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
    values[0].map(
      function (header) {
        return paidBillManagementText_(
          header
        );
      }
    );

  return values
    .slice(1)
    .map(
      function (row, rowIndex) {
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


function paidBillManagementText_(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value).trim();
}


function paidBillManagementNumber_(
  value
) {
  if (
    value === null ||
    value === undefined ||
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


function paidBillManagementFirstValue_(
  object,
  keys
) {
  if (!object) {
    return '';
  }

  for (
    let index = 0;
    index < keys.length;
    index++
  ) {
    const value =
      object[
        keys[index]
      ];

    if (
      value !== undefined &&
      value !== null &&
      value !== ''
    ) {
      return value;
    }
  }

  return '';
}


function paidBillManagementTimeValue_(
  value
) {
  if (
    Object.prototype
      .toString
      .call(value) ===
      '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return value.getTime();
  }

  if (
    typeof value ===
      'number' &&
    isFinite(value)
  ) {
    /*
     * Google Sheets 日期序號。
     */
    if (
      value > 20000 &&
      value < 100000
    ) {
      return (
        Date.UTC(
          1899,
          11,
          30
        ) +
        value *
        86400000
      );
    }

    return value;
  }

  const text =
    paidBillManagementText_(
      value
    );

  if (!text) {
    return 0;
  }

  const parsed =
    new Date(text);

  return isNaN(
    parsed.getTime()
  )
    ? 0
    : parsed.getTime();
}


function paidBillManagementBillMonthKey_(
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
      'yyyy-MM'
    );
  }

  const text =
    paidBillManagementText_(
      value
    );

  const match =
    text.match(
      /(\d{4})\D*(\d{1,2})/
    );

  if (!match) {
    return '';
  }

  return (
    match[1] +
    '-' +
    String(
      Number(match[2])
    ).padStart(
      2,
      '0'
    )
  );
}


// ==================================================
// 測試
// ==================================================

/**
 * 測試已繳帳單管理後端。
 */
function testLandlordPaidBillsInit() {
  const landlordLineUserId =
    getRequiredScriptProperty_('TEST_LANDLORD_LINE_UID');

  const result =
    getLandlordPaidBillsInitByLineUid_(
      landlordLineUserId
    );

  const paidBills =
    result &&
    result.data &&
    Array.isArray(
      result.data.paid_bills
    )
      ? result.data.paid_bills
      : [];

  const room603 =
    paidBills.filter(
      function (bill) {
        return (
          paidBillManagementText_(
            bill.room_name
          ) === '603'
        );
      }
    );

  Logger.log(
    JSON.stringify(
      {
        success:
          result.success,

        code:
          result.code,

        paid_bill_count:
          paidBills.length,

        room_603_found:
          room603.length > 0,

        room_603:
          room603,

        summary:
          result &&
          result.data
            ? result.data.summary
            : {}
      },
      null,
      2
    )
  );

  return result;
}