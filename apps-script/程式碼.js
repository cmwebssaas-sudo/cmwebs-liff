function getRequiredScriptProperty_(key) {
  const propertyKey = String(key || '').trim();
  if (!propertyKey) {
    throw new Error('Script Property key is required');
  }
  const value = PropertiesService
    .getScriptProperties()
    .getProperty(propertyKey);
  if (value === null || value === '') {
    throw new Error(
      'Missing required Script Property: ' + propertyKey
    );
  }
  return value;
}

// === 綠界金鑰設定區 ===
// 正式憑證只允許由 Script Properties 提供
const MERCHANT_ID =
  getRequiredScriptProperty_(
    'ECPAY_MERCHANT_ID'
  );
const HASH_KEY =
  getRequiredScriptProperty_(
    'ECPAY_HASH_KEY'
  );
const HASH_IV =
  getRequiredScriptProperty_(
    'ECPAY_HASH_IV'
  );
function doGet(e) {
  e = e || { parameter: {} };

  const v2Action = e.parameter.v2_action || '';
  const lineUserId = e.parameter.line_user_id || '';
  const callback = e.parameter.callback || '';
  const bridge = e.parameter.bridge || '';
  const requestId = e.parameter.request_id || '';

  // ==================================================
  // V2 LIFF API Routes
  // ==================================================

  // --------------------------------------------------
  // 房客首次登入／手機號碼綁定
  // --------------------------------------------------

  if (v2Action === 'tenant_binding_status') {
    const result =
      getTenantBindingStatusByLineUid_(
        lineUserId
      );

    if (bridge === '1') {
      return htmlBridgeOutput_(
        result,
        requestId
      );
    }

    return jsonOutput_(
      result,
      callback
    );
  }

  if (v2Action === 'tenant_bind_submit') {
    const phoneNumber =
      e.parameter.phone_number ||
      e.parameter.phone ||
      '';

    const result =
      bindTenantByLineUid_(
        lineUserId,
        phoneNumber
      );

    if (bridge === '1') {
      return htmlBridgeOutput_(
        result,
        requestId
      );
    }

    return jsonOutput_(
      result,
      callback
    );
  }

  // --------------------------------------------------
  // 房東註冊／Workspace 團隊管理入口
  // --------------------------------------------------

  if (v2Action === 'landlord_entry_status') {
    const result =
      getLandlordEntryStatusByLineUid_(
        lineUserId
      );

    if (bridge === '1') {
      return htmlBridgeOutput_(
        result,
        requestId
      );
    }

    return jsonOutput_(
      result,
      callback
    );
  }

  if (v2Action === 'landlord_register_submit') {
    const landlordName =
      e.parameter.landlord_name || '';

    const phone =
      e.parameter.phone ||
      e.parameter.landlord_phone ||
      '';

    const email =
      e.parameter.email ||
      e.parameter.landlord_email ||
      '';

    const workspaceName =
      e.parameter.workspace_name || '';

    const profileDisplayName =
      e.parameter.profile_display_name || '';

    const profilePictureUrl =
      e.parameter.profile_picture_url || '';

    const result =
      registerLandlordWorkspaceByLineUid_(
        lineUserId,
        landlordName,
        phone,
        email,
        workspaceName,
        profileDisplayName,
        profilePictureUrl
      );

    if (bridge === '1') {
      return htmlBridgeOutput_(
        result,
        requestId
      );
    }

    return jsonOutput_(
      result,
      callback
    );
  }

  if (v2Action === 'landlord_onboarding_init') {
    const result =
      getLandlordOnboardingInitByLineUid_(
        lineUserId
      );

    if (bridge === '1') {
      return htmlBridgeOutput_(
        result,
        requestId
      );
    }

    return jsonOutput_(
      result,
      callback
    );
  }

  if (v2Action === 'landlord_onboarding_save') {
    const step =
      e.parameter.step || '';

    const payload = {
      bank_code:
        e.parameter.bank_code || '',
      bank_name:
        e.parameter.bank_name || '',
      branch_name:
        e.parameter.branch_name || '',
      bank_account:
        e.parameter.bank_account || '',
      bank_account_name:
        e.parameter.bank_account_name || '',
      payment_note:
        e.parameter.payment_note || '',

      property_name:
        e.parameter.property_name || '',
      city:
        e.parameter.city || '',
      district:
        e.parameter.district || '',
      property_address:
        e.parameter.property_address || '',
      property_type:
        e.parameter.property_type || '',

      room_name:
        e.parameter.room_name || '',
      rent_amount:
        e.parameter.rent_amount || '',
      management_fee:
        e.parameter.management_fee || '',
      electricity_fee_rate:
        e.parameter.electricity_fee_rate || '',
      equipment_fee_rate:
        e.parameter.equipment_fee_rate || '',
      payment_day:
        e.parameter.payment_day || '',
      deposit_months:
        e.parameter.deposit_months || ''
    };

    const result =
      saveLandlordOnboardingStepByLineUid_(
        lineUserId,
        step,
        payload
      );

    if (bridge === '1') {
      return htmlBridgeOutput_(
        result,
        requestId
      );
    }

    return jsonOutput_(
      result,
      callback
    );
  }

  if (v2Action === 'landlord_onboarding_complete') {
    const result =
      completeLandlordOnboardingByLineUid_(
        lineUserId
      );

    if (bridge === '1') {
      return htmlBridgeOutput_(
        result,
        requestId
      );
    }

    return jsonOutput_(
      result,
      callback
    );
  }

  if (v2Action === 'landlord_team_init') {
    const result =
      getLandlordTeamInitByLineUid_(
        lineUserId
      );

    return bridge === '1'
      ? htmlBridgeOutput_(result, requestId)
      : jsonOutput_(result, callback);
  }

  if (v2Action === 'landlord_team_invite_create') {
    const result =
      createLandlordTeamInvitationByLineUid_(
        lineUserId,
        e.parameter.invite_name || '',
        e.parameter.invite_role || '',
        e.parameter.invite_phone || '',
        e.parameter.invite_email || '',
        e.parameter.expires_days || '',
        e.parameter.note || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(result, requestId)
      : jsonOutput_(result, callback);
  }

  if (v2Action === 'landlord_team_invite_cancel') {
    const result =
      cancelLandlordTeamInvitationByLineUid_(
        lineUserId,
        e.parameter.invitation_id || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(result, requestId)
      : jsonOutput_(result, callback);
  }

  if (v2Action === 'landlord_team_member_update') {
    const result =
      updateLandlordTeamMemberByLineUid_(
        lineUserId,
        e.parameter.membership_id || '',
        e.parameter.role || '',
        e.parameter.member_status || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(result, requestId)
      : jsonOutput_(result, callback);
  }

  if (v2Action === 'landlord_team_member_remove') {
    const result =
      removeLandlordTeamMemberByLineUid_(
        lineUserId,
        e.parameter.membership_id || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(result, requestId)
      : jsonOutput_(result, callback);
  }

  if (v2Action === 'landlord_invitation_init') {
    const result =
      getLandlordInvitationInit_(
        e.parameter.invite_token ||
        e.parameter.token ||
        '',
        lineUserId
      );

    return bridge === '1'
      ? htmlBridgeOutput_(result, requestId)
      : jsonOutput_(result, callback);
  }

  if (v2Action === 'landlord_invitation_accept') {
    const result =
      acceptLandlordInvitationByLineUid_(
        lineUserId,
        e.parameter.invite_token ||
        e.parameter.token ||
        '',
        e.parameter.display_name || '',
        e.parameter.phone || '',
        e.parameter.email || '',
        e.parameter.profile_display_name || '',
        e.parameter.profile_picture_url || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(result, requestId)
      : jsonOutput_(result, callback);
  }

  if (v2Action === 'landlord_workspace_activity_init') {
    const result =
      getLandlordWorkspaceActivityByLineUid_(
        lineUserId,
        e.parameter.limit || '',
        e.parameter.action_filter || ''
      );

    if (bridge === '1') {
      return htmlBridgeOutput_(
        result,
        requestId
      );
    }

    return jsonOutput_(
      result,
      callback
    );
  }

  if (v2Action === 'landlord_notifications_init') {
    const result =
      getLandlordNotificationsInitByLineUid_(
        lineUserId,
        e.parameter.status_filter || 'all',
        e.parameter.event_filter || 'all'
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_notification_mark_read') {
    const result =
      markLandlordNotificationReadByLineUid_(
        lineUserId,
        e.parameter.notification_id || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_notifications_mark_all_read') {
    const result =
      markAllLandlordNotificationsReadByLineUid_(
        lineUserId
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_settings_init') {
    const result =
      getLandlordSettingsInitByLineUid_(
        lineUserId
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_settings_save_profile') {
    const result =
      saveLandlordSettingsProfileByLineUid_(
        lineUserId,
        e.parameter.display_name || '',
        e.parameter.legal_name || '',
        e.parameter.phone || '',
        e.parameter.email || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_settings_save_workspace') {
    const result =
      saveLandlordSettingsWorkspaceByLineUid_(
        lineUserId,
        e.parameter.workspace_name || '',
        e.parameter.timezone || 'Asia/Taipei',
        e.parameter.currency || 'TWD',
        e.parameter.note || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_settings_save_payment') {
    const result =
      saveLandlordSettingsPaymentByLineUid_(
        lineUserId,
        e.parameter.bank_code || '',
        e.parameter.bank_name || '',
        e.parameter.branch_name || '',
        e.parameter.bank_account || '',
        e.parameter.bank_account_name || '',
        e.parameter.payment_note || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_settings_save_preferences') {
    const result =
      saveLandlordSettingsPreferencesByLineUid_(
        lineUserId,
        e.parameter.payload_json || '{}'
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_announcements_init') {
    const result =
      getLandlordAnnouncementsInitByLineUid_(
        lineUserId,
        e.parameter.history_filter || 'all'
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_announcement_send') {
    const result =
      sendLandlordAnnouncementByLineUid_(
        lineUserId,
        e.parameter.title || '',
        e.parameter.body || '',
        e.parameter.category || 'general',
        e.parameter.priority || 'normal',
        e.parameter.audience_type || 'all',
        e.parameter.property_id || '',
        e.parameter.tenant_ids_json || '[]'
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_announcement_retry') {
    const result =
      retryLandlordAnnouncementByLineUid_(
        lineUserId,
        e.parameter.announcement_id || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_tenant_checkins_init') {
    const result =
      getLandlordTenantCheckinsInitByLineUid_(
        lineUserId,
        e.parameter.property_id || '',
        e.parameter.status_filter || 'all'
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_tenant_checkin_save') {
    const result =
      saveLandlordTenantCheckinByLineUid_(
        lineUserId,
        e.parameter.contract_id || '',
        e.parameter.scheduled_checkin_date || '',
        e.parameter.checkin_status || 'pending',
        e.parameter.key_handover_status || 'pending',
        e.parameter.first_meter_reading || '',
        e.parameter.note || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_tenant_checkin_send_welcome') {
    const result =
      sendLandlordTenantCheckinWelcomeByLineUid_(
        lineUserId,
        e.parameter.contract_id || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_bill_notifications_init') {
    const result =
      getLandlordBillNotificationsInitByLineUid_(
        lineUserId,
        e.parameter.bill_month || '',
        e.parameter.property_id || '',
        e.parameter.status_filter || 'all'
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_bill_notifications_send') {
    const result =
      sendLandlordBillNotificationsByLineUid_(
        lineUserId,
        e.parameter.bill_ids_json || '[]'
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_billing_init') {
    const result =
      getLandlordBillingInitByLineUid_(
        lineUserId,
        e.parameter.bill_month || '',
        e.parameter.property_id || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_bills_generate') {
    const result =
      generateLandlordBillsByLineUid_(
        lineUserId,
        e.parameter.bill_month || '',
        e.parameter.items_json || '[]'
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_tenant_create_init') {
    const result =
      getLandlordTenantCreateInitByLineUid_(
        lineUserId,
        e.parameter.property_id || '',
        e.parameter.room_id || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_tenant_create') {
    const result =
      createLandlordTenantLeaseByLineUid_(
        lineUserId,
        e.parameter.tenant_name || '',
        e.parameter.tenant_phone || '',
        e.parameter.tenant_email || '',
        e.parameter.property_id || '',
        e.parameter.room_id || '',
        e.parameter.start_date || '',
        e.parameter.end_date || '',
        e.parameter.rent_amount || '',
        e.parameter.management_fee || '',
        e.parameter.deposit_months || '',
        e.parameter.deposit_amount || '',
        e.parameter.payment_day || '',
        e.parameter.electricity_fee_rate || '',
        e.parameter.equipment_fee_rate || '',
        e.parameter.note || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(
          result,
          requestId
        )
      : jsonOutput_(
          result,
          callback
        );
  }

  if (v2Action === 'landlord_properties_init') {
    const result =
      getLandlordPropertiesInitByLineUid_(
        lineUserId,
        e.parameter.include_archived || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(result, requestId)
      : jsonOutput_(result, callback);
  }

  if (v2Action === 'landlord_property_save') {
    const result =
      saveLandlordPropertyByLineUid_(
        lineUserId,
        e.parameter.property_id || '',
        e.parameter.property_name || '',
        e.parameter.city || '',
        e.parameter.district || '',
        e.parameter.property_address || '',
        e.parameter.property_type || '',
        e.parameter.payment_account_id || '',
        e.parameter.note || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(result, requestId)
      : jsonOutput_(result, callback);
  }

  if (v2Action === 'landlord_property_archive') {
    const result =
      archiveLandlordPropertyByLineUid_(
        lineUserId,
        e.parameter.property_id || '',
        e.parameter.archive_reason || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(result, requestId)
      : jsonOutput_(result, callback);
  }

  if (v2Action === 'landlord_room_save') {
    const result =
      saveLandlordRoomByLineUid_(
        lineUserId,
        e.parameter.room_id || '',
        e.parameter.property_id || '',
        e.parameter.room_name || '',
        e.parameter.rent_amount || '',
        e.parameter.management_fee || '',
        e.parameter.electricity_fee_rate || '',
        e.parameter.equipment_fee_rate || '',
        e.parameter.equipment_fee_rate_summer || '',
        e.parameter.equipment_fee_rate_regular || '',
        e.parameter.payment_day || '',
        e.parameter.deposit_months || '',
        e.parameter.deposit_amount || '',
        e.parameter.room_status || '',
        e.parameter.note || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(result, requestId)
      : jsonOutput_(result, callback);
  }

  if (v2Action === 'landlord_room_archive') {
    const result =
      archiveLandlordRoomByLineUid_(
        lineUserId,
        e.parameter.room_id || '',
        e.parameter.archive_reason || ''
      );

    return bridge === '1'
      ? htmlBridgeOutput_(result, requestId)
      : jsonOutput_(result, callback);
  }

  if (v2Action === 'landlord_workspace_create') {
    const result =
      createAdditionalLandlordWorkspaceByLineUid_(
        lineUserId,
        e.parameter.workspace_name || '',
        e.parameter.workspace_type || '',
        e.parameter.note || ''
      );

    if (bridge === '1') {
      return htmlBridgeOutput_(
        result,
        requestId
      );
    }

    return jsonOutput_(
      result,
      callback
    );
  }

  if (v2Action === 'landlord_workspace_context') {
    const result =
      getLandlordWorkspaceContextByLineUid_(
        lineUserId
      );

    if (bridge === '1') {
      return htmlBridgeOutput_(
        result,
        requestId
      );
    }

    return jsonOutput_(
      result,
      callback
    );
  }

  if (v2Action === 'landlord_workspace_switch') {
    const workspaceId =
      e.parameter.workspace_id || '';

    const result =
      setLandlordActiveWorkspaceByLineUid_(
        lineUserId,
        workspaceId
      );

    if (bridge === '1') {
      return htmlBridgeOutput_(
        result,
        requestId
      );
    }

    return jsonOutput_(
      result,
      callback
    );
  }

  if (v2Action === 'tenant_home') {
    const result = getTenantHomeByLineUid(lineUserId);

    if (bridge === '1') {
      return htmlBridgeOutput_(result, requestId);
    }

    return jsonOutput_(result, callback);
  }

if (v2Action === 'tenant_payment_report_init') {
  const result = getTenantPaymentReportInitByLineUid(lineUserId);

  if (bridge === '1') {
    return htmlBridgeOutput_(result, requestId);
  }

  return jsonOutput_(result, callback);
}

if (v2Action === 'tenant_payment_report_submit') {
  const billId = e.parameter.bill_id || '';
  const reportedLast5 = e.parameter.reported_last5 || '';
  const reportedPaidDate = e.parameter.reported_paid_date || '';
  const note = e.parameter.note || '';

  const result = submitTenantPaymentReportByLineUid_(
    lineUserId,
    billId,
    reportedLast5,
    reportedPaidDate,
    note
  );

  if (bridge === '1') {
    return htmlBridgeOutput_(result, requestId);
  }

  return jsonOutput_(result, callback);
}

if (v2Action === 'tenant_message_init') {
  const result = getTenantMessageInitByLineUid(lineUserId);

  if (bridge === '1') {
    return htmlBridgeOutput_(result, requestId);
  }

  return jsonOutput_(result, callback);
}

if (v2Action === 'tenant_message_submit') {
  const messageCategory = e.parameter.message_category || '';
  const messageTitle = e.parameter.message_title || '';
  const messageBody = e.parameter.message_body || '';
  const priority = e.parameter.priority || 'normal';
  const contactTime = e.parameter.contact_time || '';

  const result = submitTenantMessageByLineUid_(
    lineUserId,
    messageCategory,
    messageTitle,
    messageBody,
    priority,
    contactTime
  );

  if (bridge === '1') {
    return htmlBridgeOutput_(result, requestId);
  }

  return jsonOutput_(result, callback);
}


  if (v2Action === 'tenant_bills') {
    const result = getTenantBillsByLineUid(lineUserId);

    if (bridge === '1') {
      return htmlBridgeOutput_(result, requestId);
    }

    return jsonOutput_(result, callback);
  }

  if (v2Action === 'landlord_home') {
    const result = getWorkspaceLandlordHomeNativeByLineUid_(lineUserId);

    if (bridge === '1') {
      return htmlBridgeOutput_(result, requestId);
    }

    return jsonOutput_(result, callback);
  }

  if (v2Action === 'landlord_arrears') {
    const result = getWorkspaceLandlordArrearsNativeByLineUid_(lineUserId);

    if (bridge === '1') {
      return htmlBridgeOutput_(result, requestId);
    }

    return jsonOutput_(result, callback);
  }

  if (v2Action === 'landlord_tenants') {
  const result = getWorkspaceLandlordTenantsNativeByLineUid_(lineUserId);

  if (bridge === '1') {
    return htmlBridgeOutput_(result, requestId);
  }

  return jsonOutput_(result, callback);
}

if (v2Action === 'landlord_line_logs') {
  const tenantId = e.parameter.tenant_id || '';
  const tenantUserId = e.parameter.tenant_user_id || '';

  const result = getWorkspaceLandlordLineLogsByLineUid_(
    lineUserId,
    tenantId,
    tenantUserId
  );

  if (bridge === '1') {
    return htmlBridgeOutput_(result, requestId);
  }

  return jsonOutput_(result, callback);
}

if (v2Action === 'landlord_send_tenant_message') {
  const tenantId = String(
    e.parameter.tenant_id || ''
  ).trim();

  const tenantUserId = String(
    e.parameter.tenant_user_id || ''
  ).trim();

  const messageType = String(
    e.parameter.message_type || ''
  )
    .trim()
    .toLowerCase();

  const messageText = String(
    e.parameter.message_text || ''
  ).trim();

  const result = workspaceLandlordSendTenantMessageByLineUid_(
    lineUserId,
    tenantId,
    tenantUserId,
    messageType,
    messageText
  );

  if (bridge === '1') {
    return htmlBridgeOutput_(
      result,
      requestId
    );
  }

  return jsonOutput_(
    result,
    callback
  );
}

if (v2Action === 'landlord_messages_init') {
  const result = getWorkspaceLandlordMessagesInitByLineUid_(lineUserId);

  if (bridge === '1') {
    return htmlBridgeOutput_(result, requestId);
  }

  return jsonOutput_(result, callback);
}

if (v2Action === 'landlord_message_update') {
  const messageId = e.parameter.message_id || '';
  const status = e.parameter.status || '';
  const landlordReply = e.parameter.landlord_reply || '';

  const result = updateWorkspaceLandlordTenantMessageByLineUid_(
    lineUserId,
    messageId,
    status,
    landlordReply
  );

  if (bridge === '1') {
    return htmlBridgeOutput_(result, requestId);
  }

  return jsonOutput_(result, callback);
}

if (v2Action === 'landlord_payment_reports_init') {
  const result = getWorkspaceLandlordPaymentReportsInitByLineUid_(
    lineUserId
  );

  if (bridge === '1') {
    return htmlBridgeOutput_(
      result,
      requestId
    );
  }

  return jsonOutput_(
    result,
    callback
  );
}

if (v2Action === 'landlord_payment_report_update') {
  const reportId =
    e.parameter.report_id || '';

  const decision =
    e.parameter.decision || '';

  const rejectReason =
    e.parameter.reject_reason || '';

  const landlordNote =
    e.parameter.landlord_note || '';

  const result =
    updateWorkspaceLandlordPaymentReportByLineUid_(
      lineUserId,
      reportId,
      decision,
      rejectReason,
      landlordNote
    );

  if (bridge === '1') {
    return htmlBridgeOutput_(
      result,
      requestId
    );
  }

  return jsonOutput_(
    result,
    callback
  );
}

if (v2Action === 'landlord_payment_report_settle') {
  const reportId =
    String(
      e.parameter.report_id || ''
    ).trim();

  const landlordNote =
    String(
      e.parameter.landlord_note || ''
    ).trim();

  if (!reportId) {
    const result = {
      success: false,
      code: 'MISSING_REPORT_ID',
      message: '缺少付款回報 ID'
    };

    if (bridge === '1') {
      return htmlBridgeOutput_(
        result,
        requestId
      );
    }

    return jsonOutput_(
      result,
      callback
    );
  }

  const result =
    settleWorkspaceLandlordPaymentReportByLineUid_(
      lineUserId,
      reportId,
      landlordNote
    );

  if (bridge === '1') {
    return htmlBridgeOutput_(
      result,
      requestId
    );
  }

  return jsonOutput_(
    result,
    callback
  );
}

if (v2Action === 'landlord_bill_manual_settle') {
  const billId = String(
    e.parameter.bill_id || ''
  ).trim();

  const paymentDate = String(
    e.parameter.payment_date || ''
  ).trim();

  const paymentMethod = String(
    e.parameter.payment_method || ''
  )
    .trim()
    .toLowerCase();

  const paymentAmount = String(
    e.parameter.payment_amount || ''
  ).trim();

  const bankLast5 = String(
    e.parameter.bank_last5 || ''
  ).trim();

  const confirmationSource = String(
    e.parameter.confirmation_source || ''
  )
    .trim()
    .toLowerCase();

  const landlordNote = String(
    e.parameter.landlord_note || ''
  ).trim();

  const notifyTenant = String(
    e.parameter.notify_tenant || 'true'
  )
    .trim()
    .toLowerCase();

  const result =
    manualSettleWorkspaceLandlordBillByLineUid_(
      lineUserId,
      billId,
      paymentDate,
      paymentMethod,
      paymentAmount,
      bankLast5,
      confirmationSource,
      landlordNote,
      notifyTenant
    );

  if (bridge === '1') {
    return htmlBridgeOutput_(
      result,
      requestId
    );
  }

  return jsonOutput_(
    result,
    callback
  );
}

if (v2Action === 'landlord_bill_reopen') {
  const billId = String(
    e.parameter.bill_id || ''
  ).trim();

  const reversalReason = String(
    e.parameter.reversal_reason || ''
  ).trim();

  const notifyTenant = String(
    e.parameter.notify_tenant || 'true'
  )
    .trim()
    .toLowerCase();

  const result =
    reopenWorkspaceLandlordBillByLineUid_(
      lineUserId,
      billId,
      reversalReason,
      notifyTenant
    );

  if (bridge === '1') {
    return htmlBridgeOutput_(
      result,
      requestId
    );
  }

  return jsonOutput_(
    result,
    callback
  );
}

if (
  v2Action ===
  'landlord_paid_bills_init'
) {
  const result =
    getWorkspaceLandlordPaidBillsInitByLineUid_(
      lineUserId
    );

  if (bridge === '1') {
    return htmlBridgeOutput_(
      result,
      requestId
    );
  }

  return jsonOutput_(
    result,
    callback
  );
}

// ==================================================
// V2 Contract Request Routes
// 房客合約、續約、退租與房東審核
// ==================================================


// --------------------------------------------------
// 房客：讀取目前合約與申請紀錄
//
// v2_action=tenant_contract_init
// --------------------------------------------------

if (
  v2Action ===
  'tenant_contract_init'
) {
  const result =
    getTenantContractInitByLineUid_(
      lineUserId
    );

  if (bridge === '1') {
    return htmlBridgeOutput_(
      result,
      requestId
    );
  }

  return jsonOutput_(
    result,
    callback
  );
}


// --------------------------------------------------
// 房客：送出續約／解約申請
//
// v2_action=tenant_contract_request_submit
//
// request_type:
// - renewal
// - termination
//
// termination_type:
// - early_termination
// - non_renewal
// --------------------------------------------------

if (
  v2Action ===
  'tenant_contract_request_submit'
) {
  const requestData = {
    request_type:
      String(
        e.parameter.request_type ||
        ''
      )
        .trim()
        .toLowerCase(),

    requested_date:
      String(
        e.parameter.requested_date ||
        ''
      ).trim(),

    /*
     * 續約條件
     */
    requested_start_date:
      String(
        e.parameter.requested_start_date ||
        ''
      ).trim(),

    requested_term_months:
      String(
        e.parameter.requested_term_months ||
        ''
      ).trim(),

    requested_rent_amount:
      String(
        e.parameter.requested_rent_amount ||
        ''
      ).trim(),

    requested_management_fee:
      String(
        e.parameter.requested_management_fee ||
        ''
      ).trim(),

    preferred_end_date:
      String(
        e.parameter.preferred_end_date ||
        ''
      ).trim(),

    /*
     * 解約／退租條件
     */
    termination_type:
      String(
        e.parameter.termination_type ||
        ''
      )
        .trim()
        .toLowerCase(),

    move_out_date:
      String(
        e.parameter.move_out_date ||
        ''
      ).trim(),

    reason:
      String(
        e.parameter.reason ||
        ''
      ).trim(),

    note:
      String(
        e.parameter.note ||
        ''
      ).trim()
  };

  const result =
    submitTenantContractRequestByLineUid_(
      lineUserId,
      requestData
    );

  if (bridge === '1') {
    return htmlBridgeOutput_(
      result,
      requestId
    );
  }

  return jsonOutput_(
    result,
    callback
  );
}


// --------------------------------------------------
// 房客：查詢自己的申請紀錄
//
// v2_action=tenant_contract_requests
// --------------------------------------------------

if (
  v2Action ===
  'tenant_contract_requests'
) {
  const result =
    getTenantContractRequestsByLineUid_(
      lineUserId
    );

  if (bridge === '1') {
    return htmlBridgeOutput_(
      result,
      requestId
    );
  }

  return jsonOutput_(
    result,
    callback
  );
}


// --------------------------------------------------
// 房客：取消待處理申請
//
// v2_action=tenant_contract_request_cancel
// --------------------------------------------------

if (
  v2Action ===
  'tenant_contract_request_cancel'
) {
  const contractRequestId =
    String(
      e.parameter.request_id ||
      ''
    ).trim();

  const cancelReason =
    String(
      e.parameter.cancel_reason ||
      ''
    ).trim();

  const result =
    cancelTenantContractRequestByLineUid_(
      lineUserId,
      contractRequestId,
      cancelReason
    );

  if (bridge === '1') {
    return htmlBridgeOutput_(
      result,
      requestId
    );
  }

  return jsonOutput_(
    result,
    callback
  );
}


// --------------------------------------------------
// 房東：合約申請管理初始化
//
// v2_action=landlord_contract_requests_init
// --------------------------------------------------

if (
  v2Action ===
  'landlord_contract_requests_init'
) {
  const result =
    getWorkspaceLandlordContractRequestsInitByLineUid_(
      lineUserId
    );

  if (bridge === '1') {
    return htmlBridgeOutput_(
      result,
      requestId
    );
  }

  return jsonOutput_(
    result,
    callback
  );
}


// --------------------------------------------------
// 房東：核准、駁回、完成合約申請
//
// v2_action=landlord_contract_request_update
//
// status:
// - approved
// - rejected
// - completed
//
// 續約核准參數：
// - approved_start_date
// - approved_term_months
// - approved_rent_amount
// - approved_management_fee
// - approved_end_date
//
// 解約核准參數：
// - approved_move_out_date
// - penalty_status
// - penalty_amount
// - penalty_note
// --------------------------------------------------

if (
  v2Action ===
  'landlord_contract_request_update'
) {
  const contractRequestId =
    String(
      e.parameter.request_id ||
      ''
    ).trim();

  /*
   * 同時支援 status、decision、action。
   */
  const newStatus =
    String(
      e.parameter.status ||
      e.parameter.decision ||
      e.parameter.action ||
      ''
    )
      .trim()
      .toLowerCase();

  const landlordNote =
    String(
      e.parameter.landlord_note ||
      e.parameter.reject_reason ||
      ''
    ).trim();

  /*
   * 房東核准條件。
   *
   * 空白值會交由後端使用房客申請值
   * 或目前合約值作為預設。
   */
  const decisionData = {
    /*
     * 續約核准條件
     */
    approved_start_date:
      String(
        e.parameter.approved_start_date ||
        ''
      ).trim(),

    approved_term_months:
      String(
        e.parameter.approved_term_months ||
        ''
      ).trim(),

    approved_rent_amount:
      String(
        e.parameter.approved_rent_amount ||
        ''
      ).trim(),

    approved_management_fee:
      String(
        e.parameter.approved_management_fee ||
        ''
      ).trim(),

    approved_end_date:
      String(
        e.parameter.approved_end_date ||
        ''
      ).trim(),

    /*
     * 解約核准條件
     */
    approved_move_out_date:
      String(
        e.parameter.approved_move_out_date ||
        ''
      ).trim(),

    penalty_status:
      String(
        e.parameter.penalty_status ||
        ''
      )
        .trim()
        .toLowerCase(),

    penalty_amount:
      String(
        e.parameter.penalty_amount ||
        ''
      ).trim(),

    penalty_note:
      String(
        e.parameter.penalty_note ||
        ''
      ).trim()
  };

  const result =
    updateWorkspaceLandlordContractRequestByLineUid_(
      lineUserId,
      contractRequestId,
      newStatus,
      landlordNote,
      decisionData
    );

  if (bridge === '1') {
    return htmlBridgeOutput_(
      result,
      requestId
    );
  }

  return jsonOutput_(
    result,
    callback
  );
}


  if (v2Action) {
    const result = {
      success: false,
      code: 'UNKNOWN_V2_ACTION',
      message: '不支援的 V2 API 路由：' + v2Action
    };

    if (bridge === '1') {
      return htmlBridgeOutput_(
        result,
        requestId
      );
    }

    return jsonOutput_(
      result,
      callback
    );
  }



  // ==================================================
  // ECPay 綠界付款頁
  // 沒有 v2_action 時才會走這裡
  // ==================================================

  let rawAmount = e.parameter.amount || '50';
  let amount = Math.round(Number(rawAmount));

  if (!amount || amount <= 0) {
    amount = 50;
  }

  let desc = e.parameter.desc || 'CMWebs管理費';

  const now = new Date();

  const tradeDate = Utilities.formatDate(
    now,
    'Asia/Taipei',
    'yyyy/MM/dd HH:mm:ss'
  );

  const tradeNo =
    'CM' +
    Utilities.formatDate(now, 'Asia/Taipei', 'yyyyMMddHHmmss') +
    Math.floor(Math.random() * 999);

  const params = {
    MerchantID: MERCHANT_ID,
    MerchantTradeNo: tradeNo,
    MerchantTradeDate: tradeDate,
    PaymentType: 'aio',
    TotalAmount: amount.toString(),
    TradeDesc: 'CMWebs系統服務費',
    ItemName: 'CMWebs 智能租管服務費 (' + desc + ')',
    ReturnURL: 'https://hook.us2.make.com/f5af9sfxvhuvwub3ntwqe5iexhjrmjaa',
    ClientBackURL: 'https://line.me/R/ti/p/@114djwkv',
    CustomField1: desc,
    ChoosePayment: 'ALL',
    EncryptType: '1'
  };

  params.CheckMacValue = generateCheckMacValue(params, HASH_KEY, HASH_IV);

  let formHtml = `
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CMWebs 結帳確認</title>

        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background-color: #f4f7f6;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }

          .card {
            background: #ffffff;
            padding: 40px 30px;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
            text-align: center;
            max-width: 350px;
            width: 90%;
          }

          .title {
            color: #333333;
            font-size: 20px;
            margin-bottom: 10px;
            font-weight: bold;
          }

          .amount {
            color: #00c300;
            font-size: 32px;
            font-weight: bold;
            margin: 20px 0;
          }

          .btn {
            background-color: #00c300;
            color: #ffffff;
            border: none;
            padding: 15px 30px;
            font-size: 18px;
            border-radius: 8px;
            cursor: pointer;
            width: 100%;
            transition: background 0.3s;
            box-shadow: 0 4px 6px rgba(0, 195, 0, 0.3);
            font-weight: bold;
          }

          .btn:active {
            background-color: #009900;
            transform: translateY(2px);
          }

          .note {
            color: #888888;
            font-size: 13px;
            margin-top: 20px;
            line-height: 1.5;
          }
        </style>
      </head>

      <body>
        <div class="card">
          <div class="title">🏠 CMWebs 系統服務費</div>
          <div class="amount">NT$ ${amount}</div>

          <form id="ecpay-form" action="https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5" method="POST" target="_top">
  `;

  for (let key in params) {
    formHtml += `
            <input type="hidden" name="${escapeHtmlForInput_(key)}" value="${escapeHtmlForInput_(params[key])}">
    `;
  }

  formHtml += `
            <button type="submit" class="btn">前往綠界安全結帳</button>
          </form>

          <div class="note">
            點擊按鈕將跳轉至 ECPay 綠界科技進行安全付款
          </div>
        </div>
      </body>
    </html>
  `;

  return HtmlService.createHtmlOutput(formHtml);
}


// ==================================================
// 綠界 CheckMacValue SHA256
// ==================================================

function generateCheckMacValue(params, hashKey, hashIv) {
  const keys = Object.keys(params).sort();

  let str = 'HashKey=' + hashKey;

  for (let i = 0; i < keys.length; i++) {
    str += '&' + keys[i] + '=' + params[keys[i]];
  }

  str += '&HashIV=' + hashIv;

  str = encodeURIComponent(str).replace(/%20/g, '+');

  str = str
    .replace(/%2d/ig, '-')
    .replace(/%5f/ig, '_')
    .replace(/%2e/ig, '.')
    .replace(/%21/ig, '!')
    .replace(/%2a/ig, '*')
    .replace(/%28/ig, '(')
    .replace(/%29/ig, ')');

  str = str.toLowerCase();

  const rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    str,
    Utilities.Charset.UTF_8
  );

  let txtHash = '';

  for (let i = 0; i < rawHash.length; i++) {
    let hashVal = rawHash[i];

    if (hashVal < 0) {
      hashVal += 256;
    }

    if (hashVal.toString(16).length === 1) {
      txtHash += '0';
    }

    txtHash += hashVal.toString(16);
  }

  return txtHash.toUpperCase();
}


// ==================================================
// HTML Input Escape
// ==================================================

function escapeHtmlForInput_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * LINE Webhook 接收入口
 * LINE Developers Webhook URL 會用 POST 打到這裡
 */
function doPost(e) {
  try {
    e = e || {};

    const postBody =
      e.postData && e.postData.contents
        ? e.postData.contents
        : '';

    const result = handleLineWebhook_(postBody);

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    const errorResult = {
      success: false,
      code: 'DO_POST_ERROR',
      message: err && err.message ? err.message : String(err)
    };

    return ContentService
      .createTextOutput(JSON.stringify(errorResult))
      .setMimeType(ContentService.MimeType.JSON);
  }
}