/**
 * CMWebs V2 notification templates (Phase 90 staging only).
 */

const V2_NOTIFICATION_TEMPLATES_ = {
  bill_created: {
    template_key: 'bill_created',
    title: '新帳單通知',
    body: [
      '您好 {{tenant_name}}',
      '',
      '{{month}} 月帳單：',
      'NT$ {{amount}}',
      '',
      '繳款期限：',
      '{{due_date}}'
    ].join('\n'),
    variables: [
      'tenant_name',
      'month',
      'amount',
      'due_date'
    ]
  },

  payment_due: {
    template_key: 'payment_due',
    title: '繳款期限提醒',
    body: [
      '您好 {{tenant_name}}',
      '',
      '{{month}} 月帳單將於今日到期。',
      '應繳金額：NT$ {{amount}}',
      '繳款期限：{{due_date}}'
    ].join('\n'),
    variables: [
      'tenant_name',
      'month',
      'amount',
      'due_date'
    ]
  },

  payment_overdue: {
    template_key: 'payment_overdue',
    title: '帳單逾期提醒',
    body: [
      '您好 {{tenant_name}}',
      '',
      '{{month}} 月帳單目前已逾期。',
      '未繳金額：NT$ {{amount}}',
      '原繳款期限：{{due_date}}'
    ].join('\n'),
    variables: [
      'tenant_name',
      'month',
      'amount',
      'due_date'
    ]
  },

  tenant_repair: {
    template_key: 'tenant_repair',
    title: '房客報修通知',
    body: [
      '房客：{{tenant_name}}',
      '房間：{{room_name}}',
      '標題：{{title}}',
      '',
      '{{body}}'
    ].join('\n'),
    variables: [
      'tenant_name',
      'room_name',
      'title',
      'body'
    ]
  },

  repair_completed: {
    template_key: 'repair_completed',
    title: '報修進度通知',
    body: [
      '您好 {{tenant_name}}',
      '',
      '報修單 {{ticket_id}}（{{title}}）{{status_label}}。',
      '房東備註：{{landlord_note}}'
    ].join('\n'),
    variables: [
      'tenant_name',
      'ticket_id',
      'status_label',
      'title',
      'landlord_note'
    ]
  },

  payment_confirmed: {
    template_key: 'payment_confirmed',
    title: '付款確認通知',
    body: [
      '您好 {{tenant_name}}',
      '',
      '{{month}} 月帳單已確認付款。',
      '付款金額：NT$ {{amount}}'
    ].join('\n'),
    variables: [
      'tenant_name',
      'month',
      'amount'
    ]
  },

  contract_expiring: {
    template_key: 'contract_expiring',
    title: '租約到期提醒',
    body: [
      '您好 {{tenant_name}}',
      '',
      '您的租約將於 {{end_date}} 到期。',
      '如需續租，請與房東聯絡。'
    ].join('\n'),
    variables: [
      'tenant_name',
      'end_date'
    ]
  },

  move_out_requested: {
    template_key: 'move_out_requested',
    title: '房客退租申請',
    body: [
      '房客：{{tenant_name}}',
      '房間：{{room_name}}',
      '預計退租日：{{move_out_date}}'
    ].join('\n'),
    variables: ['tenant_name', 'room_name', 'move_out_date']
  },

  inspection_scheduled: {
    template_key: 'inspection_scheduled',
    title: '退租驗屋安排',
    body: [
      '您好 {{tenant_name}}',
      '',
      '退租驗屋時間：{{inspection_at}}'
    ].join('\n'),
    variables: ['tenant_name', 'inspection_at']
  },

  deposit_settlement_ready: {
    template_key: 'deposit_settlement_ready',
    title: '押金結算完成',
    body: [
      '您好 {{tenant_name}}',
      '',
      '原押金：NT$ {{deposit_amount}}',
      '扣款合計：NT$ {{deduction_amount}}',
      '預計退款：NT$ {{refund_amount}}'
    ].join('\n'),
    variables: [
      'tenant_name',
      'deposit_amount',
      'deduction_amount',
      'refund_amount'
    ]
  },

  deposit_refunded: {
    template_key: 'deposit_refunded',
    title: '押金退款確認',
    body: [
      '您好 {{tenant_name}}',
      '',
      '押金退款金額：NT$ {{refund_amount}}',
      '退款方式：{{refund_method}}'
    ].join('\n'),
    variables: ['tenant_name', 'refund_amount', 'refund_method']
  },

  contract_terminated: {
    template_key: 'contract_terminated',
    title: '租約已終止',
    body: [
      '您好 {{tenant_name}}',
      '',
      '租約 {{contract_id}} 已完成退租終止。',
      '退租日期：{{move_out_date}}'
    ].join('\n'),
    variables: ['tenant_name', 'contract_id', 'move_out_date']
  }
};


function notificationTemplateRender_(templateKey, variables) {
  templateKey = notificationTemplateText_(templateKey).toLowerCase();
  variables = variables || {};

  const template = V2_NOTIFICATION_TEMPLATES_[templateKey];

  if (!template) {
    return {
      success: false,
      code: 'NOTIFICATION_TEMPLATE_NOT_FOUND',
      message: 'Notification template does not exist',
      template_key: templateKey,
      title: '',
      body: '',
      text: ''
    };
  }

  const missing = template.variables.filter(function (name) {
    return variables[name] === null || variables[name] === undefined;
  });

  if (missing.length > 0) {
    return {
      success: false,
      code: 'NOTIFICATION_TEMPLATE_VARIABLES_MISSING',
      message: 'Notification template variables are incomplete',
      template_key: templateKey,
      missing_variables: missing,
      title: '',
      body: '',
      text: ''
    };
  }

  const render = function (source) {
    return String(source || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      function (_, name) {
        return notificationTemplateText_(variables[name]);
      }
    );
  };

  const title = render(template.title);
  const body = render(template.body);

  return {
    success: true,
    code: 'OK',
    message: 'Notification template rendered',
    template_key: templateKey,
    title: title,
    body: body,
    text: title + '\n\n' + body
  };
}


function notificationTemplateText_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}
