// V2.1 landlord-only checkout lifecycle.
// Checkout is an additive state transition on the original contract. It never
// rewrites the original term or contract document and never pushes the tenant.

const V2_CONTRACT_CHECKOUT_ALLOWED_PREDECESSOR_STATUSES_ = [
  'active',
  'expired',
  'approved',
  'completed'
];
const V2_CONTRACT_CHECKOUT_OPEN_SIBLING_STATUSES_ = [
  'active',
  'current',
  'pending_landlord_review',
  'pending_tenant_signature',
  'awaiting_tenant_signature'
];

function landlordContractCheckoutInitBySession_(sessionToken, contractId) {
  const access = landlordContractCheckoutAccessFromSession_(sessionToken, 'read');
  if (!access.success) return access;
  const schema = landlordInitiatedContractSchema_(SpreadsheetApp.getActiveSpreadsheet());
  if (!schema.success) return schema;
  const contract = landlordContractCheckoutFindContract_(schema.data.contracts, access, contractId);
  if (!contract) return landlordInitiatedContractError_('CONTRACT_NOT_FOUND', '找不到可辦理退房的合約');
  const room = landlordInitiatedContractFindScopedRow_(schema.data.rooms, access, 'room_id', contract.room_id);
  const tenant = landlordInitiatedContractFindScopedRow_(schema.data.tenants, access, 'tenant_id', contract.tenant_id);
  if (!room) return landlordInitiatedContractError_('ROOM_NOT_FOUND', '找不到合約所屬房間');
  const siblings = landlordContractCheckoutFindSiblings_(schema.data.contracts, access, contract);
  const originalEndDate = landlordContractCheckoutOriginalEndDate_(contract);
  const eligibility = landlordContractCheckoutValidateTarget_(contract, room, siblings, {
    workspace_id: landlordInitiatedContractWorkspaceId_(access),
    move_out_date: originalEndDate
  });
  return {
    success: true,
    code: 'OK',
    data: {
      contract: Object.assign({}, contract, { original_end_date: originalEndDate }),
      tenant: tenant || null,
      room: room,
      default_move_out_date: originalEndDate,
      eligibility: {
        can_checkout: eligibility.success === true,
        code: eligibility.success ? 'OK' : eligibility.code,
        message: eligibility.success ? '可以辦理退房' : eligibility.message
      }
    }
  };
}

function landlordContractCheckoutCompleteBySession_(sessionToken, input) {
  let result = landlordInitiatedContractWithScriptLock_(function() {
    const access = landlordContractCheckoutAccessFromSession_(sessionToken, 'contract_write');
    if (!access.success) return access;
    const schema = landlordInitiatedContractSchema_(SpreadsheetApp.getActiveSpreadsheet());
    if (!schema.success) return schema;
    return landlordContractCheckoutApplyUnlocked_(access, schema, input || {});
  });

  if (result && result.success === true && result.data && result.data.access) {
    if (result.data.idempotent !== true && typeof workspaceRecordOperationActor_ === 'function') {
      try {
        workspaceRecordOperationActor_(result.data.access, 'landlord_contract_checkout_complete', result, {
          target_type: 'contract',
          target_id: result.data.contract_id,
          secondary_target_id: result.data.tenant_id || '',
          detail: {
            move_out_date: result.data.move_out_date,
            checkout_source: result.data.checkout_source
          }
        });
      } catch (_) {}
    }
    delete result.data.access;
  }
  return result;
}

function landlordContractCheckoutApplyUnlocked_(access, schema, input) {
  const normalizedInput = input || {};
  const contractId = landlordInitiatedContractText_(normalizedInput.contract_id);
  const idempotencyKey = landlordInitiatedContractText_(normalizedInput.idempotency_key);
  const moveOutDate = landlordInitiatedContractText_(normalizedInput.move_out_date);
  const note = landlordInitiatedContractText_(normalizedInput.note);
  if (!contractId || !idempotencyKey) return landlordInitiatedContractError_('CHECKOUT_INPUT_REQUIRED', '缺少合約或退房操作識別碼');
  if (idempotencyKey.length > 160) return landlordInitiatedContractError_('CHECKOUT_IDEMPOTENCY_KEY_INVALID', '退房操作識別碼無效');

  const contract = landlordContractCheckoutFindContract_(schema.data.contracts, access, contractId);
  if (!contract) return landlordInitiatedContractError_('CONTRACT_NOT_FOUND', '找不到可辦理退房的合約');
  const existingCheckoutStatus = landlordInitiatedContractText_(contract.checkout_status).toLowerCase();
  if (existingCheckoutStatus === 'completed') {
    if (landlordInitiatedContractText_(contract.checkout_idempotency_key) === idempotencyKey) {
      return landlordContractCheckoutResult_(access, contract, true);
    }
    return landlordInitiatedContractError_('CHECKOUT_ALREADY_COMPLETED', '此合約已完成退房');
  }

  const room = landlordInitiatedContractFindScopedRow_(schema.data.rooms, access, 'room_id', contract.room_id);
  const tenant = landlordInitiatedContractFindScopedRow_(schema.data.tenants, access, 'tenant_id', contract.tenant_id);
  if (!room) return landlordInitiatedContractError_('ROOM_NOT_FOUND', '找不到合約所屬房間');
  if (tenant && landlordInitiatedContractText_(tenant.current_contract_id) && landlordInitiatedContractText_(tenant.current_contract_id) !== contractId) {
    return landlordInitiatedContractError_('CHECKOUT_TENANT_POINTER_STALE', '房客目前已指向其他合約，無法直接退房');
  }
  const siblings = landlordContractCheckoutFindSiblings_(schema.data.contracts, access, contract);
  const validation = landlordContractCheckoutValidateTarget_(contract, room, siblings, {
    workspace_id: landlordInitiatedContractWorkspaceId_(access),
    move_out_date: moveOutDate
  });
  if (!validation.success) return validation;

  const nowIso = new Date().toISOString();
  const checkoutSource = landlordInitiatedContractText_(contract.checkout_source) || 'manual_landlord';
  landlordInitiatedContractUpdate_(schema.data.contracts, contract, {
    contract_status: 'terminated',
    status: 'terminated',
    account_status: 'inactive',
    terminated_at: nowIso,
    checkout_status: 'completed',
    checkout_source: checkoutSource,
    checkout_requested_at: landlordInitiatedContractText_(contract.checkout_requested_at) || nowIso,
    checkout_completed_at: nowIso,
    checkout_move_out_date: moveOutDate,
    checkout_note: note || landlordInitiatedContractText_(contract.checkout_note),
    checkout_idempotency_key: idempotencyKey,
    updated_at: nowIso
  });
  Object.assign(contract, {
    contract_status: 'terminated', status: 'terminated', account_status: 'inactive', terminated_at: nowIso,
    checkout_status: 'completed', checkout_source: checkoutSource,
    checkout_requested_at: landlordInitiatedContractText_(contract.checkout_requested_at) || nowIso,
    checkout_completed_at: nowIso, checkout_move_out_date: moveOutDate,
    checkout_note: note || landlordInitiatedContractText_(contract.checkout_note),
    checkout_idempotency_key: idempotencyKey, updated_at: nowIso
  });
  landlordInitiatedContractUpdate_(schema.data.rooms, room, {
    room_status: 'vacant', current_contract_id: '', current_tenant_id: '', current_tenant_name: '', updated_at: nowIso
  });
  if (tenant) landlordInitiatedContractUpdate_(schema.data.tenants, tenant, { current_contract_id: '', updated_at: nowIso });
  landlordContractCheckoutClearViews_(SpreadsheetApp.getActiveSpreadsheet(), contract, nowIso);
  return landlordContractCheckoutResult_(access, contract, false);
}

function landlordContractCheckoutResult_(access, contract, idempotent) {
  return {
    success: true,
    code: idempotent ? 'IDEMPOTENT' : 'OK',
    data: {
      access: access,
      contract_id: landlordInitiatedContractText_(contract.contract_id),
      tenant_id: landlordInitiatedContractText_(contract.tenant_id),
      checkout_status: landlordInitiatedContractText_(contract.checkout_status),
      checkout_source: landlordInitiatedContractText_(contract.checkout_source),
      move_out_date: landlordInitiatedContractText_(contract.checkout_move_out_date),
      idempotent: idempotent === true
    }
  };
}

function landlordContractCheckoutValidateTarget_(contract, room, siblings, input) {
  const target = contract || {};
  const targetWorkspaceId = landlordInitiatedContractText_(target.workspace_id);
  const inputWorkspaceId = landlordInitiatedContractText_(input && input.workspace_id);
  if (!targetWorkspaceId || (inputWorkspaceId && inputWorkspaceId !== targetWorkspaceId)) return landlordInitiatedContractError_('WORKSPACE_ACCESS_DENIED', '退房合約不屬於目前 Workspace');
  if (!room || landlordInitiatedContractText_(room.workspace_id) !== targetWorkspaceId || landlordInitiatedContractText_(room.room_id) !== landlordInitiatedContractText_(target.room_id)) return landlordInitiatedContractError_('CHECKOUT_ROOM_SCOPE_INVALID', '房間不屬於目前合約');
  if (landlordInitiatedContractText_(room.current_contract_id) !== landlordInitiatedContractText_(target.contract_id)) return landlordInitiatedContractError_('CHECKOUT_ROOM_POINTER_STALE', '房間目前未指向此合約');
  const status = landlordInitiatedContractText_(target.contract_status || target.status).toLowerCase();
  if (V2_CONTRACT_CHECKOUT_ALLOWED_PREDECESSOR_STATUSES_.indexOf(status) < 0) return landlordInitiatedContractError_('CHECKOUT_STATUS_NOT_ALLOWED', '此合約狀態不可辦理退房');
  const moveOutDate = landlordInitiatedContractText_(input && input.move_out_date);
  const startDate = landlordInitiatedContractText_(target.start_date || target.contract_start_date);
  if (!landlordInitiatedContractIsIsoDate_(moveOutDate) || !landlordInitiatedContractIsIsoDate_(startDate) || moveOutDate < startDate) return landlordInitiatedContractError_('CHECKOUT_MOVE_OUT_DATE_INVALID', '退房日期無效或早於租約起始日');
  const openSibling = (Array.isArray(siblings) ? siblings : []).find(function(sibling) {
    if (landlordInitiatedContractText_(sibling.workspace_id) !== targetWorkspaceId || landlordInitiatedContractText_(sibling.room_id) !== landlordInitiatedContractText_(target.room_id) || landlordInitiatedContractText_(sibling.contract_id) === landlordInitiatedContractText_(target.contract_id)) return false;
    const siblingStatus = landlordInitiatedContractText_(sibling.contract_status || sibling.status).toLowerCase();
    if (siblingStatus === 'pending_landlord_review' && landlordInitiatedContractText_(sibling.signing_mode).toLowerCase() === 'renewal' && landlordInitiatedContractText_(sibling.renewal_tenant_intent).toLowerCase() === 'declined') return false;
    return V2_CONTRACT_CHECKOUT_OPEN_SIBLING_STATUSES_.indexOf(siblingStatus) >= 0;
  });
  if (openSibling) return landlordInitiatedContractError_('CHECKOUT_NEWER_CONTRACT_EXISTS', '房間已有較新的有效或簽署中合約');
  return { success: true, code: 'OK' };
}

function landlordContractCheckoutAccessFromSession_(sessionToken, policy) {
  if (typeof tenantContractSigningReviewAccessFromSession_ !== 'function') return landlordInitiatedContractError_('LANDLORD_REVIEW_SESSION_MODULE_REQUIRED', '找不到房東 session 模組');
  const accessResult = tenantContractSigningReviewAccessFromSession_(sessionToken, policy);
  if (!accessResult || accessResult.success !== true) return accessResult || landlordInitiatedContractError_('LANDLORD_REVIEW_SESSION_INVALID', '房東 session 無效');
  const access = Object.assign({ success: true }, accessResult.data || {});
  if (!landlordInitiatedContractAccessValid_(access)) return landlordInitiatedContractError_('WORKSPACE_ACCESS_DENIED', 'Workspace 權限無效');
  return access;
}

function landlordContractCheckoutFindContract_(sheet, access, contractId) {
  return landlordContractCheckoutRows_(sheet).find(function(row) {
    return landlordInitiatedContractText_(row.contract_id) === landlordInitiatedContractText_(contractId) && landlordInitiatedContractText_(row.workspace_id) === landlordInitiatedContractWorkspaceId_(access);
  }) || null;
}

function landlordContractCheckoutFindSiblings_(sheet, access, contract) {
  const workspaceId = landlordInitiatedContractWorkspaceId_(access);
  return landlordContractCheckoutRows_(sheet).filter(function(row) {
    return landlordInitiatedContractText_(row.workspace_id) === workspaceId && landlordInitiatedContractText_(row.room_id) === landlordInitiatedContractText_(contract.room_id) && landlordInitiatedContractText_(row.contract_id) !== landlordInitiatedContractText_(contract.contract_id);
  });
}

function landlordContractCheckoutOriginalEndDate_(contract) {
  return landlordInitiatedContractText_(contract && (contract.end_date || contract.contract_end_date));
}

function landlordContractCheckoutClearViews_(ss, contract, timestamp) {
  if (typeof landlordInitiatedContractFinalizationViews_ !== 'function') return;
  const views = landlordInitiatedContractFinalizationViews_(ss);
  if (!views || views.success !== true) return;
  [views.data.landlord.sheet, views.data.tenant.sheet].forEach(function(sheet) {
    const row = landlordContractCheckoutRows_(sheet).find(function(item) {
      return landlordInitiatedContractText_(item.tenant_id) === landlordInitiatedContractText_(contract.tenant_id) && landlordInitiatedContractText_(item.workspace_id) === landlordInitiatedContractText_(contract.workspace_id);
    });
    if (row) landlordInitiatedContractUpdate_(sheet, row, { current_contract_id: '', contract_status: 'terminated', updated_at: timestamp });
  });
}

function landlordContractCheckoutRows_(sheet) {
  return typeof landlordInitiatedContractRows_ === 'function' ? landlordInitiatedContractRows_(sheet) : [];
}
