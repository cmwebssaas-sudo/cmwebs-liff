// V2.1 landlord-initiated contract lifecycle.
// This module creates pending contract versions and one-time invitations only.
// Activation is performed by the native landlord signing-review path after
// mode-specific artifacts and Workspace authorization are revalidated.

const V2_LANDLORD_INITIATED_CONTRACT_INVITE_SHEET_ = 'V2_contract_invites';
const V2_LANDLORD_INITIATED_CONTRACT_INVITE_HEADERS_ = [
  'invite_id',
  'workspace_id',
  'contract_id',
  'room_id',
  'landlord_user_id',
  'landlord_membership_id',
  'claim_code_hash',
  'status',
  'expires_at',
  'claimed_at',
  'claimed_line_user_id',
  'cancelled_at',
  'created_at',
  'updated_at'
];
const V2_LANDLORD_INITIATED_CONTRACT_INVITE_TTL_MS_ = 24 * 60 * 60 * 1000;
const V2_LANDLORD_INITIATED_CONTRACT_LIFF_URL_ = 'https://liff.line.me/2010314940-iJB1D6sN';
const V2_LANDLORD_INITIATED_CONTRACT_EXCHANGE_TTL_SECONDS_ = 60;
const V2_LANDLORD_INITIATED_CONTRACT_EXCHANGE_RESERVATION_TTL_SECONDS_ = 600;
const V2_LANDLORD_INITIATED_CONTRACT_LOCK_ATTEMPTS_ = 3;
const V2_LANDLORD_INITIATED_CONTRACT_LOCK_WAIT_MS_ = 10000;

function landlordInitiatedContractWithScriptLock_(operation) {
  const lock = LockService.getScriptLock();
  let acquired = false;

  for (let attempt = 0; attempt < V2_LANDLORD_INITIATED_CONTRACT_LOCK_ATTEMPTS_; attempt += 1) {
    try {
      lock.waitLock(V2_LANDLORD_INITIATED_CONTRACT_LOCK_WAIT_MS_);
      acquired = true;
      break;
    } catch (_) {
      if (attempt === V2_LANDLORD_INITIATED_CONTRACT_LOCK_ATTEMPTS_ - 1) {
        return landlordInitiatedContractError_('CONTRACT_OPERATION_BUSY', '合約操作正在處理，請稍後再試');
      }
    }
  }

  try {
    return operation();
  } catch (error) {
    try {
      if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
        console.error('landlordInitiatedContract operation failed: ' + (error && error.message ? error.message : String(error)));
      }
    } catch (_) {}
    return landlordInitiatedContractError_('CONTRACT_OPERATION_FAILED', '合約資料寫入失敗，請重新整理後再試');
  } finally {
    if (acquired) {
      try { lock.releaseLock(); } catch (_) {}
    }
  }
}

function landlordInitiatedContractCreateNew_(access, input) {
  return landlordInitiatedContractWithScriptLock_(function() {
    return landlordInitiatedContractCreateNewUnlocked_(access, input);
  });
}

function landlordInitiatedContractCreateNewUnlocked_(access, input) {
  const schema = landlordInitiatedContractSchema_(SpreadsheetApp.getActiveSpreadsheet());
  if (!schema.success) return schema;
  if (!landlordInitiatedContractAccessValid_(access)) return landlordInitiatedContractError_('WORKSPACE_ACCESS_DENIED', 'Workspace 權限無效');
  const normalized = landlordInitiatedContractNormalizeInput_(input);
  if (!normalized.success) return normalized;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const room = landlordInitiatedContractFindScopedRow_(schema.data.rooms, access, 'room_id', normalized.data.room_id);
  if (!room) return landlordInitiatedContractError_('ROOM_NOT_FOUND', '找不到可出租房間');
  const property = landlordInitiatedContractFindScopedRow_(schema.data.properties, access, 'property_id', normalized.data.property_id || landlordInitiatedContractText_(room.property_id));
  if (!property) return landlordInitiatedContractError_('PROPERTY_NOT_FOUND', '找不到物件');
  if (landlordInitiatedContractText_(room.property_id) !== landlordInitiatedContractText_(property.property_id)) return landlordInitiatedContractError_('ROOM_PROPERTY_MISMATCH', '房間不屬於指定物件');
  if (landlordInitiatedContractText_(room.room_status || 'vacant').toLowerCase() === 'occupied') return landlordInitiatedContractError_('ROOM_ALREADY_OCCUPIED', '房間目前已有有效租約');
  if (landlordInitiatedContractText_(room.account_status || 'active').toLowerCase() === 'archived') return landlordInitiatedContractError_('ROOM_ARCHIVED', '房間已封存');

  const contracts = landlordInitiatedContractRows_(schema.data.contracts);
  if (landlordInitiatedContractHasOpenSibling_(contracts, access, normalized.data.room_id, '')) return landlordInitiatedContractError_('ROOM_ALREADY_RESERVED', '房間已有待處理合約');

  const now = new Date();
  const actor = landlordInitiatedContractActor_(access);
  const contractId = landlordInitiatedContractUuid_();
  const tenantId = 'tenant-' + landlordInitiatedContractUuid_();
  const tenantUserId = 'user-' + landlordInitiatedContractUuid_();
  const inviteId = landlordInitiatedContractUuid_();
  const confirmationCode = landlordInitiatedContractConfirmationCode_();
  const expiresAt = new Date(now.getTime() + V2_LANDLORD_INITIATED_CONTRACT_INVITE_TTL_MS_).toISOString();
  const landlordId = landlordInitiatedContractLandlordId_(access);
  const tenantName = normalized.data.tenant_name;
  const contract = landlordInitiatedContractContractObject_(access, actor, property, room, normalized.data, {
    contract_id: contractId,
    tenant_id: tenantId,
    tenant_user_id: tenantUserId,
    tenant_name: tenantName,
    tenant_phone: normalized.data.tenant_phone,
    tenant_email: normalized.data.tenant_email,
    contract_status: 'pending_tenant_signature',
    status: 'pending',
    account_status: 'pending',
    signing_mode: 'new_tenant',
    contract_origin: 'landlord_initiated',
    invite_id: inviteId,
    contract_content: landlordInitiatedContractBuildDocument_(access, property, room, normalized.data, tenantName),
    contract_version: 'fixed-google-doc-template-1',
    previous_contract_id: '',
    renewed_to_contract_id: '',
    tenant_signing_submission_status: 'pending',
    created_by_user_id: actor.user_id,
    created_by_membership_id: actor.membership_id,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    note: normalized.data.note
  });
  const tenantUser = {
    user_id: tenantUserId,
    workspace_id: landlordInitiatedContractWorkspaceId_(access),
    landlord_id: landlordId,
    line_user_id: '',
    role: 'tenant',
    status: 'pending',
    account_status: 'pending',
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };
  const tenant = {
    tenant_id: tenantId,
    tenant_user_id: tenantUserId,
    user_id: tenantUserId,
    workspace_id: landlordInitiatedContractWorkspaceId_(access),
    landlord_id: landlordId,
    tenant_line_user_id: '',
    line_user_id: '',
    tenant_name: tenantName,
    name: tenantName,
    tenant_phone: normalized.data.tenant_phone,
    phone: normalized.data.tenant_phone,
    tenant_email: normalized.data.tenant_email,
    email: normalized.data.tenant_email,
    property_id: property.property_id,
    property_name: property.property_name || room.property_name || '',
    room_id: room.room_id,
    room_name: room.room_name || '',
    current_contract_id: contractId,
    tenant_binding_status: 'pending_claim',
    binding_status: 'pending_claim',
    account_status: 'pending',
    tenant_account_status: 'pending',
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };
  const invite = {
    invite_id: inviteId,
    workspace_id: landlordInitiatedContractWorkspaceId_(access),
    contract_id: contractId,
    room_id: room.room_id,
    landlord_user_id: actor.user_id,
    landlord_membership_id: actor.membership_id,
    claim_code_hash: landlordInitiatedContractDigest_(confirmationCode),
    status: 'pending',
    expires_at: expiresAt,
    claimed_at: '',
    claimed_line_user_id: '',
    cancelled_at: '',
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };

  landlordInitiatedContractAppend_(schema.data.users, tenantUser);
  landlordInitiatedContractAppend_(schema.data.tenants, tenant);
  landlordInitiatedContractAppend_(schema.data.contracts, contract);
  landlordInitiatedContractAppend_(schema.data.invites, invite);

  return {
    success: true,
    code: 'OK',
    data: {
      contract: landlordInitiatedContractPublicContract_(contract, tenant, invite),
      invite: landlordInitiatedContractPublicInvite_(invite, confirmationCode)
    }
  };
}

function landlordInitiatedContractCreateRenewal_(access, input) {
  return landlordInitiatedContractWithScriptLock_(function() {
    return landlordInitiatedContractCreateRenewalUnlocked_(access, input);
  });
}

function landlordInitiatedContractCreateRenewalUnlocked_(access, input) {
  const schema = landlordInitiatedContractSchema_(SpreadsheetApp.getActiveSpreadsheet());
  if (!schema.success) return schema;
  if (!landlordInitiatedContractAccessValid_(access)) return landlordInitiatedContractError_('WORKSPACE_ACCESS_DENIED', 'Workspace 權限無效');
  const normalized = landlordInitiatedContractNormalizeInput_(input);
  if (!normalized.success) return normalized;
  const previousId = landlordInitiatedContractText_(input && input.previous_contract_id);
  if (!previousId) return landlordInitiatedContractError_('PREVIOUS_CONTRACT_REQUIRED', '續約必須指定前一份合約');

  const contracts = landlordInitiatedContractRows_(schema.data.contracts);
  const workspaceId = landlordInitiatedContractWorkspaceId_(access);
  const previous = contracts.find(function (row) {
    return landlordInitiatedContractText_(row.contract_id) === previousId &&
      landlordInitiatedContractText_(row.workspace_id) === workspaceId;
  });
  if (!previous) return landlordInitiatedContractError_('PREVIOUS_CONTRACT_NOT_FOUND', '找不到前一份合約');
  if (landlordInitiatedContractText_(previous.contract_status).toLowerCase() !== 'active') return landlordInitiatedContractError_('PREVIOUS_CONTRACT_NOT_ACTIVE', '只有有效合約可以續約');
  if (!landlordInitiatedContractText_(previous.tenant_id)) return landlordInitiatedContractError_('PREVIOUS_TENANT_NOT_READY', '前一份合約缺少房客資料');
  if (landlordInitiatedContractHasOpenSibling_(contracts, access, previous.room_id, previousId)) return landlordInitiatedContractError_('ROOM_ALREADY_RESERVED', '房間已有其他待處理合約');

  const room = landlordInitiatedContractFindScopedRow_(schema.data.rooms, access, 'room_id', previous.room_id);
  const property = landlordInitiatedContractFindScopedRow_(schema.data.properties, access, 'property_id', previous.property_id);
  if (!room || !property) return landlordInitiatedContractError_('RENEWAL_TARGET_NOT_FOUND', '續約房屋資料不存在');

  const now = new Date();
  const actor = landlordInitiatedContractActor_(access);
  const contractId = landlordInitiatedContractUuid_();
  const contract = landlordInitiatedContractContractObject_(access, actor, property, room, normalized.data, {
    contract_id: contractId,
    tenant_id: previous.tenant_id,
    tenant_user_id: previous.tenant_user_id || '',
    tenant_line_user_id: previous.tenant_line_user_id || '',
    tenant_name: previous.tenant_name || previous.name || '',
    tenant_phone: previous.tenant_phone || previous.phone || '',
    tenant_email: previous.tenant_email || previous.email || '',
    contract_status: 'pending_tenant_signature',
    status: 'pending',
    account_status: 'pending',
    signing_mode: 'renewal',
    contract_origin: 'landlord_initiated',
    invite_id: '',
    contract_content: landlordInitiatedContractBuildDocument_(access, property, room, normalized.data, previous.tenant_name || previous.name || ''),
    contract_version: 'fixed-google-doc-template-1',
    previous_contract_id: previousId,
    renewed_to_contract_id: '',
    tenant_signing_submission_status: 'pending',
    created_by_user_id: actor.user_id,
    created_by_membership_id: actor.membership_id,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    note: normalized.data.note
  });
  landlordInitiatedContractAppend_(schema.data.contracts, contract);
  return {
    success: true,
    code: 'OK',
    data: {
      contract: landlordInitiatedContractPublicContract_(contract, previous),
      invite: null
    }
  };
}

function landlordInitiatedContractListBySession_(sessionToken) {
  if (typeof tenantContractSigningReviewAccessFromSession_ !== 'function') return landlordInitiatedContractError_('LANDLORD_REVIEW_SESSION_MODULE_REQUIRED', '找不到房東 session 模組');
  const access = tenantContractSigningReviewAccessFromSession_(sessionToken, 'read');
  if (!access || access.success !== true) return access || landlordInitiatedContractError_('LANDLORD_REVIEW_SESSION_INVALID', '房東 session 無效');
  return landlordInitiatedContractListByAccess_(Object.assign({ success: true }, access.data || {}));
}

function landlordInitiatedContractListByAccess_(access) {
  if (!landlordInitiatedContractAccessValid_(access)) return landlordInitiatedContractError_('WORKSPACE_ACCESS_DENIED', 'Workspace 權限無效');
  const schema = landlordInitiatedContractSchema_(SpreadsheetApp.getActiveSpreadsheet());
  if (!schema.success) return schema;
  const workspaceId = landlordInitiatedContractWorkspaceId_(access);
  const contracts = landlordInitiatedContractRows_(schema.data.contracts).filter(function (row) {
    return landlordInitiatedContractText_(row.workspace_id) === workspaceId &&
      landlordInitiatedContractText_(row.contract_origin) === 'landlord_initiated' &&
      ['pending_tenant_signature', 'awaiting_tenant_signature'].indexOf(landlordInitiatedContractText_(row.contract_status)) >= 0;
  });
  const invites = landlordInitiatedContractRows_(schema.data.invites).filter(function (row) {
    return landlordInitiatedContractText_(row.workspace_id) === workspaceId;
  });
  return {
    success: true,
    code: 'OK',
    data: {
      items: contracts.map(function (contract) {
        const currentInviteId = landlordInitiatedContractText_(contract.invite_id);
        const invite = invites.find(function (row) {
          return landlordInitiatedContractText_(row.contract_id) === landlordInitiatedContractText_(contract.contract_id) &&
            landlordInitiatedContractText_(row.invite_id) === currentInviteId;
        });
        return landlordInitiatedContractPublicContract_(contract, {}, invite || {});
      })
    }
  };
}

function landlordInitiatedContractReissueBySession_(sessionToken, inviteId) {
  return landlordInitiatedContractWithScriptLock_(function() {
    return landlordInitiatedContractReissueBySessionUnlocked_(sessionToken, inviteId);
  });
}

function landlordInitiatedContractReissueBySessionUnlocked_(sessionToken, inviteId) {
  if (typeof tenantContractSigningReviewAccessFromSession_ !== 'function') return landlordInitiatedContractError_('LANDLORD_REVIEW_SESSION_MODULE_REQUIRED', '找不到房東 session 模組');
  const accessResult = tenantContractSigningReviewAccessFromSession_(sessionToken, 'contract_write');
  if (!accessResult || accessResult.success !== true) return accessResult || landlordInitiatedContractError_('LANDLORD_REVIEW_SESSION_INVALID', '房東 session 無效');
  const access = Object.assign({ success: true }, accessResult.data || {});
  if (!landlordInitiatedContractAccessValid_(access)) return landlordInitiatedContractError_('WORKSPACE_ACCESS_DENIED', 'Workspace 權限無效');
  const schema = landlordInitiatedContractSchema_(SpreadsheetApp.getActiveSpreadsheet());
  if (!schema.success) return schema;
  const workspaceId = landlordInitiatedContractWorkspaceId_(access);
  const normalizedInviteId = landlordInitiatedContractText_(inviteId);
  const invites = landlordInitiatedContractRows_(schema.data.invites);
  const oldInvite = invites.find(function(row) {
    return landlordInitiatedContractText_(row.invite_id) === normalizedInviteId && landlordInitiatedContractText_(row.workspace_id) === workspaceId;
  });
  if (!oldInvite) return landlordInitiatedContractError_('INVITE_NOT_FOUND', '找不到邀請');
  const contract = landlordInitiatedContractRows_(schema.data.contracts).find(function(row) {
    return landlordInitiatedContractText_(row.contract_id) === landlordInitiatedContractText_(oldInvite.contract_id) &&
      landlordInitiatedContractText_(row.workspace_id) === workspaceId &&
      landlordInitiatedContractText_(row.contract_origin) === 'landlord_initiated';
  });
  if (!contract) return landlordInitiatedContractError_('CONTRACT_NOT_FOUND', '找不到邀請合約');
  if (['pending_tenant_signature', 'awaiting_tenant_signature'].indexOf(landlordInitiatedContractText_(contract.contract_status)) < 0) return landlordInitiatedContractError_('CONTRACT_NOT_REISSUABLE', '目前合約狀態無法重新產生邀請');
  if (landlordInitiatedContractText_(contract.invite_id) !== normalizedInviteId) return landlordInitiatedContractError_('INVITE_STALE', '這個邀請已被新的邀請取代，請重新整理後再試');
  const oldStatus = landlordInitiatedContractText_(oldInvite.status).toLowerCase();
  if (oldStatus === 'claimed' || oldStatus === 'completed') return landlordInitiatedContractError_('INVITE_ALREADY_CLAIMED', '房客已使用此邀請，無法重新產生');
  if (oldStatus === 'cancelled') return landlordInitiatedContractError_('INVITE_STALE', '這個邀請已失效，請重新整理後再試');

  const now = new Date();
  const nowIso = now.toISOString();
  const confirmationCode = landlordInitiatedContractConfirmationCode_();
  const newInvite = {
    invite_id: landlordInitiatedContractUuid_(),
    workspace_id: workspaceId,
    contract_id: contract.contract_id,
    room_id: contract.room_id,
    landlord_user_id: oldInvite.landlord_user_id || landlordInitiatedContractText_(access.user && access.user.user_id),
    landlord_membership_id: oldInvite.landlord_membership_id || landlordInitiatedContractText_(access.membership && access.membership.membership_id),
    claim_code_hash: landlordInitiatedContractDigest_(confirmationCode),
    status: 'pending',
    expires_at: new Date(now.getTime() + V2_LANDLORD_INITIATED_CONTRACT_INVITE_TTL_MS_).toISOString(),
    claimed_at: '',
    claimed_line_user_id: '',
    cancelled_at: '',
    created_at: nowIso,
    updated_at: nowIso
  };
  landlordInitiatedContractUpdate_(schema.data.invites, oldInvite, { status: 'cancelled', cancelled_at: nowIso, updated_at: nowIso });
  landlordInitiatedContractAppend_(schema.data.invites, newInvite);
  landlordInitiatedContractUpdate_(schema.data.contracts, contract, { invite_id: newInvite.invite_id, updated_at: nowIso });
  contract.invite_id = newInvite.invite_id;
  contract.updated_at = nowIso;
  return {
    success: true,
    code: 'OK',
    data: {
      contract: landlordInitiatedContractPublicContract_(contract, {}, newInvite),
      invite: landlordInitiatedContractPublicInvite_(newInvite, confirmationCode)
    }
  };
}

function landlordInitiatedContractCancelBySession_(sessionToken, inviteId) {
  return landlordInitiatedContractWithScriptLock_(function() {
    return landlordInitiatedContractCancelBySessionUnlocked_(sessionToken, inviteId);
  });
}

function landlordInitiatedContractCancelBySessionUnlocked_(sessionToken, inviteId) {
  if (typeof tenantContractSigningReviewAccessFromSession_ !== 'function') return landlordInitiatedContractError_('LANDLORD_REVIEW_SESSION_MODULE_REQUIRED', '找不到房東 session 模組');
  const access = tenantContractSigningReviewAccessFromSession_(sessionToken, 'contract_write');
  if (!access || access.success !== true) return access || landlordInitiatedContractError_('LANDLORD_REVIEW_SESSION_INVALID', '房東 session 無效');
  const schema = landlordInitiatedContractSchema_(SpreadsheetApp.getActiveSpreadsheet());
  if (!schema.success) return schema;
  const workspaceId = landlordInitiatedContractWorkspaceId_(access.data);
  const invite = landlordInitiatedContractRows_(schema.data.invites).find(function (row) {
    return landlordInitiatedContractText_(row.invite_id) === landlordInitiatedContractText_(inviteId) && landlordInitiatedContractText_(row.workspace_id) === workspaceId;
  });
  if (!invite) return landlordInitiatedContractError_('INVITE_NOT_FOUND', '找不到邀請');
  if (landlordInitiatedContractText_(invite.status).toLowerCase() === 'cancelled') return { success: true, code: 'IDEMPOTENT', data: { invite_id: invite.invite_id, status: 'cancelled' } };
  if (landlordInitiatedContractText_(invite.status).toLowerCase() === 'claimed') return landlordInitiatedContractError_('INVITE_ALREADY_CLAIMED', '房客已開啟此邀請，無法直接取消');
  const contract = landlordInitiatedContractRows_(schema.data.contracts).find(function (row) { return landlordInitiatedContractText_(row.contract_id) === landlordInitiatedContractText_(invite.contract_id); });
  const now = new Date().toISOString();
  landlordInitiatedContractUpdate_(schema.data.invites, invite, { status: 'cancelled', cancelled_at: now, updated_at: now });
  if (contract) landlordInitiatedContractUpdate_(schema.data.contracts, contract, { contract_status: 'cancelled', status: 'cancelled', account_status: 'cancelled', updated_at: now });
  return { success: true, code: 'OK', data: { invite_id: invite.invite_id, status: 'cancelled' } };
}

function landlordInitiatedContractInviteClaim_(inviteId, confirmationCode, lineSub, tenantData) {
  return landlordInitiatedContractWithScriptLock_(function() {
    return landlordInitiatedContractInviteClaimUnlocked_(inviteId, confirmationCode, lineSub, tenantData);
  });
}

function landlordInitiatedContractInviteClaimUnlocked_(inviteId, confirmationCode, lineSub, tenantData) {
  const schema = landlordInitiatedContractSchema_(SpreadsheetApp.getActiveSpreadsheet());
  if (!schema.success) return schema;
  const normalizedInviteId = landlordInitiatedContractText_(inviteId);
  const normalizedLineSub = landlordInitiatedContractText_(lineSub);
  const normalizedCode = landlordInitiatedContractText_(confirmationCode);
  if (!normalizedInviteId || !normalizedLineSub || !/^\d{6}$/.test(normalizedCode)) return landlordInitiatedContractError_('INVITE_CLAIM_INVALID', '邀請認領資料無效');
  const invite = landlordInitiatedContractRows_(schema.data.invites).find(function (row) { return landlordInitiatedContractText_(row.invite_id) === normalizedInviteId; });
  if (!invite) return landlordInitiatedContractError_('INVITE_NOT_FOUND', '找不到邀請');
  if (landlordInitiatedContractText_(invite.status).toLowerCase() === 'claimed') return landlordInitiatedContractError_('INVITE_ALREADY_CLAIMED', '邀請已被認領');
  if (landlordInitiatedContractText_(invite.status).toLowerCase() === 'cancelled') return landlordInitiatedContractError_('INVITE_CANCELLED', '邀請已取消');
  if (landlordInitiatedContractDateValue_(invite.expires_at) <= new Date().getTime()) return landlordInitiatedContractError_('INVITE_EXPIRED', '邀請已過期');
  if (!landlordInitiatedContractConstantEquals_(landlordInitiatedContractText_(invite.claim_code_hash), landlordInitiatedContractDigest_(normalizedCode))) return landlordInitiatedContractError_('INVITE_CODE_INVALID', '確認碼錯誤');

  const contract = landlordInitiatedContractRows_(schema.data.contracts).find(function (row) {
    return landlordInitiatedContractText_(row.contract_id) === landlordInitiatedContractText_(invite.contract_id) && landlordInitiatedContractText_(row.workspace_id) === landlordInitiatedContractText_(invite.workspace_id);
  });
  if (!contract) return landlordInitiatedContractError_('CONTRACT_NOT_FOUND', '找不到邀請合約');
  const tenant = landlordInitiatedContractRows_(schema.data.tenants).find(function (row) { return landlordInitiatedContractText_(row.tenant_id) === landlordInitiatedContractText_(contract.tenant_id) && landlordInitiatedContractText_(row.workspace_id) === landlordInitiatedContractText_(invite.workspace_id); });
  const now = new Date().toISOString();
  const data = tenantData || {};
  const name = landlordInitiatedContractText_(data.tenant_name || data.name || (tenant && (tenant.tenant_name || tenant.name)));
  const phone = landlordInitiatedContractText_(data.tenant_phone || data.phone || (tenant && (tenant.tenant_phone || tenant.phone)));
  if (!name || !/^09\d{8}$/.test(landlordInitiatedContractNormalizePhone_(phone))) return landlordInitiatedContractError_('TENANT_DATA_REQUIRED', '房客姓名與台灣手機為必要資料');
  if (tenant) landlordInitiatedContractUpdate_(schema.data.tenants, tenant, {
    tenant_name: name, name: name, tenant_phone: landlordInitiatedContractNormalizePhone_(phone), phone: landlordInitiatedContractNormalizePhone_(phone),
    tenant_email: landlordInitiatedContractText_(data.tenant_email || data.email || tenant.tenant_email || tenant.email),
    tenant_line_user_id: normalizedLineSub, line_user_id: normalizedLineSub, updated_at: now
  });
  landlordInitiatedContractUpdate_(schema.data.invites, invite, { status: 'claimed', claimed_at: now, claimed_line_user_id: normalizedLineSub, updated_at: now });
  landlordInitiatedContractUpdate_(schema.data.contracts, contract, {
    tenant_name: name,
    tenant_phone: landlordInitiatedContractNormalizePhone_(phone),
    tenant_email: landlordInitiatedContractText_(data.tenant_email || data.email || contract.tenant_email),
    tenant_line_user_id: normalizedLineSub,
    contract_content: landlordInitiatedContractReplaceTenantName_(contract.contract_content, name),
    updated_at: now
  });
  const updatedContract = Object.assign({}, contract, {
    tenant_name: name,
    tenant_phone: landlordInitiatedContractNormalizePhone_(phone),
    tenant_email: landlordInitiatedContractText_(data.tenant_email || data.email || contract.tenant_email),
    tenant_line_user_id: normalizedLineSub,
    contract_content: landlordInitiatedContractReplaceTenantName_(contract.contract_content, name),
    updated_at: now
  });
  return {
    success: true,
    code: 'OK',
    data: {
      invite: { invite_id: invite.invite_id, contract_id: contract.contract_id, status: 'claimed', line_sub: normalizedLineSub },
      contract: updatedContract,
      tenant: tenant ? Object.assign({}, tenant, { tenant_name: name, tenant_phone: landlordInitiatedContractNormalizePhone_(phone), line_user_id: normalizedLineSub }) : null
    }
  };
}

function landlordInitiatedContractInviteSessionContext_(claims) {
  const schema = landlordInitiatedContractSchema_(SpreadsheetApp.getActiveSpreadsheet());
  if (!schema.success) return schema;
  const inviteId = landlordInitiatedContractText_(claims && claims.invite_id);
  const workspaceId = landlordInitiatedContractText_(claims && claims.workspace_id);
  const contractId = landlordInitiatedContractText_(claims && claims.contract_id);
  const lineSub = landlordInitiatedContractText_(claims && claims.line_sub);
  const invite = landlordInitiatedContractRows_(schema.data.invites).find(function (row) {
    return landlordInitiatedContractText_(row.invite_id) === inviteId && landlordInitiatedContractText_(row.workspace_id) === workspaceId;
  });
  if (!invite) return landlordInitiatedContractError_('INVITE_NOT_FOUND', '找不到邀請');
  if (landlordInitiatedContractText_(invite.status).toLowerCase() !== 'claimed' || landlordInitiatedContractText_(invite.claimed_line_user_id) !== lineSub) return landlordInitiatedContractError_('INVITE_SESSION_INVALID', '邀請認領身分無效');
  const contract = landlordInitiatedContractRows_(schema.data.contracts).find(function (row) {
    return landlordInitiatedContractText_(row.contract_id) === contractId && landlordInitiatedContractText_(row.workspace_id) === workspaceId && landlordInitiatedContractText_(row.invite_id) === inviteId;
  });
  if (!contract) return landlordInitiatedContractError_('CONTRACT_NOT_FOUND', '找不到邀請合約');
  if (landlordInitiatedContractText_(contract.tenant_id) !== landlordInitiatedContractText_(claims.tenant_id) || landlordInitiatedContractText_(contract.tenant_user_id) !== landlordInitiatedContractText_(claims.user_id) || landlordInitiatedContractText_(contract.signing_mode).toLowerCase() !== 'new_tenant') return landlordInitiatedContractError_('INVITE_SESSION_INVALID', '邀請合約身分不一致');
  if (['pending_tenant_signature', 'awaiting_tenant_signature'].indexOf(landlordInitiatedContractText_(contract.contract_status)) < 0) return landlordInitiatedContractError_('CONTRACT_NOT_SIGNABLE', '合約目前不可簽署');
  return { success: true, code: 'OK', data: { invite: invite, contract: contract } };
}

function landlordInitiatedContractFinalizeApproval_(ss, access, contract, now) {
  if (!ss || !access || !contract) return landlordInitiatedContractError_('CONTRACT_FINALIZATION_INVALID', '缺少核准資料');
  const mode = landlordInitiatedContractText_(contract.signing_mode).toLowerCase();
  if (['new_tenant', 'renewal'].indexOf(mode) === -1) return landlordInitiatedContractError_('SIGNING_MODE_NOT_READY', '簽署模式無效');
  const schema = landlordInitiatedContractSchema_(ss);
  if (!schema.success) return schema;
  const workspaceId = landlordInitiatedContractWorkspaceId_(access);
  const contractId = landlordInitiatedContractText_(contract.contract_id);
  const room = landlordInitiatedContractRows_(schema.data.rooms).find(function (row) {
    return landlordInitiatedContractText_(row.room_id) === landlordInitiatedContractText_(contract.room_id) && landlordInitiatedContractText_(row.workspace_id) === workspaceId;
  });
  const tenant = landlordInitiatedContractRows_(schema.data.tenants).find(function (row) {
    return landlordInitiatedContractText_(row.tenant_id) === landlordInitiatedContractText_(contract.tenant_id) && landlordInitiatedContractText_(row.workspace_id) === workspaceId;
  });
  const user = landlordInitiatedContractRows_(schema.data.users).find(function (row) {
    return landlordInitiatedContractText_(row.user_id) === landlordInitiatedContractText_(contract.tenant_user_id) && landlordInitiatedContractText_(row.workspace_id) === workspaceId;
  });
  const views = landlordInitiatedContractFinalizationViews_(ss);
  if (!room || !tenant || !user || !views.success) return landlordInitiatedContractError_('CONTRACT_FINALIZATION_SCHEMA_NOT_READY', '合約啟用所需房間、房客或檢視資料尚未就緒');
  const contractHeaders = landlordInitiatedContractHeaders_(schema.data.contracts);
  const roomHeaders = landlordInitiatedContractHeaders_(schema.data.rooms);
  const tenantHeaders = landlordInitiatedContractHeaders_(schema.data.tenants);
  const userHeaders = landlordInitiatedContractHeaders_(schema.data.users);
  if (!landlordInitiatedContractHasAnyHeader_(userHeaders, ['status', 'account_status']) || !landlordInitiatedContractHasAnyHeader_(tenantHeaders, ['tenant_binding_status', 'binding_status']) || !landlordInitiatedContractHasAnyHeader_(tenantHeaders, ['account_status', 'tenant_account_status']) || !landlordInitiatedContractHasHeaders_(roomHeaders, ['room_status', 'current_contract_id', 'current_tenant_id']) || !landlordInitiatedContractHasHeaders_(contractHeaders, ['contract_status', 'status', 'account_status'])) {
    return landlordInitiatedContractError_('CONTRACT_FINALIZATION_SCHEMA_NOT_READY', '合約啟用欄位尚未就緒');
  }
  const viewHeadersReady = landlordInitiatedContractHasHeaders_(views.data.landlord.headers, ['tenant_id', 'workspace_id', 'current_contract_id', 'contract_status']) && landlordInitiatedContractHasHeaders_(views.data.tenant.headers, ['tenant_id', 'workspace_id', 'current_contract_id', 'contract_status']);
  if (!viewHeadersReady) return landlordInitiatedContractError_('CONTRACT_FINALIZATION_SCHEMA_NOT_READY', '房東與房客檢視欄位尚未就緒');
  const timestamp = now || new Date().toISOString();
  const commonContractUpdates = {
    contract_status: 'active', status: 'active', account_status: 'active',
    tenant_signing_submission_status: 'approved', updated_at: timestamp
  };
  if (mode === 'new_tenant') {
    const invite = landlordInitiatedContractRows_(schema.data.invites).find(function (row) {
      return landlordInitiatedContractText_(row.invite_id) === landlordInitiatedContractText_(contract.invite_id) && landlordInitiatedContractText_(row.contract_id) === contractId && landlordInitiatedContractText_(row.workspace_id) === workspaceId;
    });
    const lineSub = landlordInitiatedContractText_(contract.tenant_line_user_id || (invite && invite.claimed_line_user_id));
    if (!invite || landlordInitiatedContractText_(invite.status).toLowerCase() !== 'claimed' || !lineSub || landlordInitiatedContractText_(invite.claimed_line_user_id) !== lineSub) return landlordInitiatedContractError_('CONTRACT_FINALIZATION_TENANT_NOT_CLAIMED', '新房客尚未完成邀請認領');
    if (landlordInitiatedContractText_(tenant.tenant_user_id || tenant.user_id) !== landlordInitiatedContractText_(user.user_id)) return landlordInitiatedContractError_('CONTRACT_FINALIZATION_TENANT_MISMATCH', '房客與使用者資料不一致');
    landlordInitiatedContractUpdate_(schema.data.users, user, { line_user_id: lineSub, status: 'active', account_status: 'active', active_workspace_id: workspaceId, updated_at: timestamp });
    landlordInitiatedContractUpdate_(schema.data.tenants, tenant, { tenant_line_user_id: lineSub, line_user_id: lineSub, tenant_binding_status: 'bound', binding_status: 'bound', account_status: 'active', tenant_account_status: 'active', current_contract_id: contractId, bound_at: timestamp, updated_at: timestamp });
    landlordInitiatedContractUpdate_(schema.data.contracts, contract, Object.assign({}, commonContractUpdates, { tenant_line_user_id: lineSub }));
    landlordInitiatedContractUpdate_(schema.data.rooms, room, { room_status: 'occupied', current_contract_id: contractId, current_tenant_id: contract.tenant_id, current_tenant_name: contract.tenant_name, updated_at: timestamp });
    landlordInitiatedContractUpdate_(schema.data.invites, invite, { status: 'completed', updated_at: timestamp });
    landlordInitiatedContractUpsertViews_(views.data, contract, tenant, lineSub, timestamp, 'bound');
  } else {
    const previousId = landlordInitiatedContractText_(contract.previous_contract_id);
    const previous = landlordInitiatedContractRows_(schema.data.contracts).find(function (row) {
      return landlordInitiatedContractText_(row.contract_id) === previousId && landlordInitiatedContractText_(row.workspace_id) === workspaceId && landlordInitiatedContractText_(row.tenant_id) === landlordInitiatedContractText_(contract.tenant_id);
    });
    if (!previous || landlordInitiatedContractText_(previous.contract_status).toLowerCase() !== 'active') return landlordInitiatedContractError_('CONTRACT_FINALIZATION_PREVIOUS_NOT_ACTIVE', '前一份合約目前不是有效狀態');
    if (landlordInitiatedContractText_(previous.renewed_to_contract_id) && landlordInitiatedContractText_(previous.renewed_to_contract_id) !== contractId) return landlordInitiatedContractError_('CONTRACT_FINALIZATION_RENEWAL_CONFLICT', '前一份合約已有其他續約版本');
    const lineSub = landlordInitiatedContractText_(contract.tenant_line_user_id || tenant.tenant_line_user_id || tenant.line_user_id);
    landlordInitiatedContractUpdate_(schema.data.contracts, previous, { contract_status: 'renewed', status: 'archived', account_status: 'archived', renewed_to_contract_id: contractId, updated_at: timestamp });
    landlordInitiatedContractUpdate_(schema.data.contracts, contract, Object.assign({}, commonContractUpdates, { tenant_line_user_id: lineSub }));
    landlordInitiatedContractUpdate_(schema.data.tenants, tenant, { current_contract_id: contractId, updated_at: timestamp });
    landlordInitiatedContractUpdate_(schema.data.rooms, room, { room_status: 'occupied', current_contract_id: contractId, current_tenant_id: contract.tenant_id, current_tenant_name: contract.tenant_name, updated_at: timestamp });
    landlordInitiatedContractUpsertViews_(views.data, contract, tenant, lineSub, timestamp, 'bound');
  }
  return { success: true, code: 'OK', data: { mode: mode, contract_id: contractId, activated: true, now: timestamp } };
}

function landlordInitiatedContractFinalizationViews_(ss) {
  const landlord = ss && ss.getSheetByName('V2_landlord_tenant_list_view');
  const tenant = ss && ss.getSheetByName('V2_tenant_home_view');
  if (!landlord || !tenant) return { success: false, code: 'CONTRACT_FINALIZATION_SCHEMA_NOT_READY' };
  return { success: true, data: { landlord: { sheet: landlord, headers: landlordInitiatedContractHeaders_(landlord) }, tenant: { sheet: tenant, headers: landlordInitiatedContractHeaders_(tenant) } } };
}

function landlordInitiatedContractHasHeaders_(headers, required) {
  return (required || []).every(function (header) { return headers.indexOf(header) >= 0; });
}

function landlordInitiatedContractHasAnyHeader_(headers, candidates) {
  return (candidates || []).some(function (header) { return headers.indexOf(header) >= 0; });
}

function landlordInitiatedContractUpsertViews_(views, contract, tenant, lineSub, timestamp, bindingStatus) {
  const values = {
    tenant_id: contract.tenant_id,
    workspace_id: contract.workspace_id,
    tenant_user_id: contract.tenant_user_id || tenant.tenant_user_id || tenant.user_id,
    user_id: contract.tenant_user_id || tenant.tenant_user_id || tenant.user_id,
    tenant_line_user_id: lineSub,
    line_user_id: lineSub,
    tenant_name: contract.tenant_name || tenant.tenant_name || tenant.name,
    tenant_phone: contract.tenant_phone || tenant.tenant_phone || tenant.phone,
    tenant_email: contract.tenant_email || tenant.tenant_email || tenant.email,
    tenant_binding_status: bindingStatus,
    binding_status: bindingStatus,
    tenant_account_status: 'active',
    account_status: 'active',
    property_id: contract.property_id || tenant.property_id,
    property_name: contract.property_name || tenant.property_name,
    room_id: contract.room_id || tenant.room_id,
    room_name: contract.room_name || tenant.room_name,
    room_list: contract.room_name || tenant.room_name,
    current_contract_id: contract.contract_id,
    contract_status: 'active',
    contract_start_date: contract.start_date || contract.contract_start_date,
    contract_end_date: contract.end_date || contract.contract_end_date,
    updated_at: timestamp
  };
  landlordInitiatedContractUpsertView_(views.landlord.sheet, values);
  landlordInitiatedContractUpsertView_(views.tenant.sheet, values);
}

function landlordInitiatedContractUpsertView_(sheet, values) {
  const rows = landlordInitiatedContractRows_(sheet);
  const target = rows.find(function (row) {
    return landlordInitiatedContractText_(row.tenant_id) === landlordInitiatedContractText_(values.tenant_id) && landlordInitiatedContractText_(row.workspace_id) === landlordInitiatedContractText_(values.workspace_id);
  });
  if (target) landlordInitiatedContractUpdate_(sheet, target, values);
  else landlordInitiatedContractAppend_(sheet, values);
}

function landlordInitiatedContractIsRequest_(body) {
  let request = body;
  if (typeof body === 'string') {
    try { request = JSON.parse(body); } catch (_) { return false; }
  }
  return [
    'landlord_contract_initiated_init',
    'landlord_contract_initiate_new',
    'landlord_contract_initiate_renewal',
    'landlord_contract_invite_cancel',
    'landlord_contract_invite_reissue'
  ].indexOf(landlordInitiatedContractText_(request && request.action)) >= 0;
}

function landlordInitiatedContractHandlePost_(body) {
  let request = body;
  if (typeof body === 'string') {
    try { request = JSON.parse(body); } catch (_) { return landlordInitiatedContractError_('INVALID_JSON', '請求格式無效'); }
  }
  if (!request || !landlordInitiatedContractIsRequest_(request)) return landlordInitiatedContractError_('INVALID_ACTION', '不支援的合約邀請操作');
  const requestId = landlordInitiatedContractText_(request.request_id);
  const pollSecret = landlordInitiatedContractText_(request.poll_secret);
  const hasExchangeCredentials = requestId || pollSecret;
  if (hasExchangeCredentials) {
    if (!/^[A-Za-z0-9_-]{22,}$/.test(requestId) || !/^[A-Za-z0-9_-]{43,}$/.test(pollSecret)) return landlordInitiatedContractError_('INVALID_EXCHANGE_CREDENTIAL', '合約操作交換憑證無效');
    const key = landlordInitiatedContractExchangeKey_(request.action, requestId);
    const cache = CacheService.getScriptCache();
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(5000);
      if (cache.get(key)) return landlordInitiatedContractError_('LANDLORD_INITIATED_CONTRACT_EXCHANGE_CONFLICT', '相同合約操作正在處理');
      cache.put(key, JSON.stringify({ poll_hash: landlordInitiatedContractHmacHex_(pollSecret, landlordInitiatedContractExchangeSecret_()), pending: true }), V2_LANDLORD_INITIATED_CONTRACT_EXCHANGE_RESERVATION_TTL_SECONDS_);
    } catch (_) {
      return landlordInitiatedContractError_('LANDLORD_INITIATED_CONTRACT_EXCHANGE_CREATE_FAILED', '合約操作交換建立失敗');
    } finally {
      try { lock.releaseLock(); } catch (_) {}
    }
    const result = landlordInitiatedContractHandlePostDirect_(request);
    try {
      lock.waitLock(5000);
      const raw = cache.get(key);
      if (!raw) return landlordInitiatedContractError_('LANDLORD_INITIATED_CONTRACT_EXCHANGE_RESERVATION_MISSING', '合約操作交換已失效');
      const reservation = JSON.parse(raw);
      if (reservation.pending !== true || !landlordInitiatedContractConstantEquals_(reservation.poll_hash, landlordInitiatedContractHmacHex_(pollSecret, landlordInitiatedContractExchangeSecret_()))) return landlordInitiatedContractError_('LANDLORD_INITIATED_CONTRACT_EXCHANGE_RESERVATION_INVALID', '合約操作交換無效');
      cache.put(key, JSON.stringify({ poll_hash: reservation.poll_hash, result: result }), V2_LANDLORD_INITIATED_CONTRACT_EXCHANGE_TTL_SECONDS_);
      return { success: true, code: 'EXCHANGE_ACCEPTED' };
    } catch (_) {
      return landlordInitiatedContractError_('LANDLORD_INITIATED_CONTRACT_EXCHANGE_CREATE_FAILED', '合約操作交換建立失敗');
    } finally {
      try { lock.releaseLock(); } catch (_) {}
    }
  }
  return landlordInitiatedContractHandlePostDirect_(request);
}

function landlordInitiatedContractHandlePostDirect_(request) {
  const action = landlordInitiatedContractText_(request.action);
  if (action === 'landlord_contract_initiated_init') return landlordInitiatedContractListBySession_(request.session_token);
  if (action === 'landlord_contract_invite_cancel') return landlordInitiatedContractCancelBySession_(request.session_token, request.invite_id);
  if (action === 'landlord_contract_invite_reissue') return landlordInitiatedContractReissueBySession_(request.session_token, request.invite_id);
  const access = landlordInitiatedContractAccessFromSession_(request.session_token, 'contract_write');
  if (!access.success) return access;
  const input = request.input && typeof request.input === 'object' ? request.input : request;
  if (action === 'landlord_contract_initiate_new') return landlordInitiatedContractCreateNew_(access, input);
  if (action === 'landlord_contract_initiate_renewal') return landlordInitiatedContractCreateRenewal_(access, input);
  return landlordInitiatedContractError_('INVALID_ACTION', '不支援的合約邀請操作');
}

function landlordInitiatedContractReadExchange_(action, requestId, pollSecret) {
  const normalizedAction = landlordInitiatedContractText_(action);
  const key = landlordInitiatedContractExchangeKey_(normalizedAction, requestId);
  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const raw = cache.get(key);
    if (!raw) return landlordInitiatedContractError_('LANDLORD_INITIATED_CONTRACT_EXCHANGE_NOT_FOUND', '合約操作結果不存在或已讀取');
    const entry = JSON.parse(raw);
    if (!landlordInitiatedContractConstantEquals_(entry.poll_hash, landlordInitiatedContractHmacHex_(pollSecret, landlordInitiatedContractExchangeSecret_()))) return landlordInitiatedContractError_('LANDLORD_INITIATED_CONTRACT_EXCHANGE_DENIED', '合約操作結果驗證失敗');
    if (entry.pending === true) return landlordInitiatedContractError_('LANDLORD_INITIATED_CONTRACT_EXCHANGE_PENDING', '合約操作仍在處理');
    cache.remove(key);
    return entry.result || landlordInitiatedContractError_('LANDLORD_INITIATED_CONTRACT_EXCHANGE_INVALID', '合約操作結果無效');
  } catch (_) {
    return landlordInitiatedContractError_('LANDLORD_INITIATED_CONTRACT_EXCHANGE_READ_FAILED', '合約操作結果讀取失敗');
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function landlordInitiatedContractExchangeKey_(action, requestId) { return 'landlord_initiated_contract:' + landlordInitiatedContractText_(action) + ':' + landlordInitiatedContractText_(requestId); }
function landlordInitiatedContractExchangeSecret_() {
  if (typeof tenantLiffSigningSessionSecret_ === 'function') return tenantLiffSigningSessionSecret_();
  const secret = PropertiesService.getScriptProperties().getProperty('CMWEBS_LIFF_SESSION_HMAC_SECRET');
  if (!secret) throw new Error('CMWEBS_LIFF_SESSION_HMAC_SECRET is not configured');
  return secret;
}
function landlordInitiatedContractHmacHex_(value, key) { return Utilities.computeHmacSha256Signature(String(value), String(key)).map(function (byte) { return ('0' + (byte < 0 ? byte + 256 : byte).toString(16)).slice(-2); }).join(''); }

function landlordInitiatedContractAccessFromSession_(sessionToken, policy) {
  if (typeof verifyLandlordContractSigningReviewSessionToken_ !== 'function') return landlordInitiatedContractError_('LANDLORD_REVIEW_SESSION_MODULE_REQUIRED', '找不到房東 session 模組');
  const session = verifyLandlordContractSigningReviewSessionToken_(sessionToken);
  if (!session || session.success !== true || !session.data) return landlordInitiatedContractError_((session && session.code) || 'LANDLORD_REVIEW_SESSION_INVALID', '房東 session 無效');
  if (typeof workspaceLandlordResolveAccess_ !== 'function' || typeof workspaceLandlordCheckPolicy_ !== 'function') return landlordInitiatedContractError_('WORKSPACE_ACCESS_MODULE_REQUIRED', '找不到 Workspace 權限模組');
  const access = workspaceLandlordResolveAccess_(session.data.line_sub, { skip_schema_ensure: true, skip_legacy_context_creation: true });
  if (!access || access.success !== true) return landlordInitiatedContractError_((access && access.code) || 'WORKSPACE_ACCESS_DENIED', 'Workspace 權限無效');
  const permission = workspaceLandlordCheckPolicy_(access, policy);
  if (!permission || permission.success !== true) return landlordInitiatedContractError_((permission && permission.code) || 'WORKSPACE_PERMISSION_DENIED', '沒有合約操作權限');
  if (landlordInitiatedContractText_(access.user && access.user.user_id) !== landlordInitiatedContractText_(session.data.user_id) || landlordInitiatedContractText_(access.membership && access.membership.membership_id) !== landlordInitiatedContractText_(session.data.membership_id) || landlordInitiatedContractWorkspaceId_(access) !== landlordInitiatedContractText_(session.data.workspace_id)) return landlordInitiatedContractError_('LANDLORD_REVIEW_SESSION_PRINCIPAL_INVALID', '房東 session 與目前 Workspace 不一致');
  return access;
}

function landlordInitiatedContractSchema_(ss) {
  if (!ss || typeof ss.getSheetByName !== 'function') return landlordInitiatedContractError_('CONTRACT_INVITE_SCHEMA_NOT_READY', '合約資料表尚未就緒');
  const inviteSheet = landlordInitiatedContractEnsureInviteSheet_(ss);
  if (!inviteSheet.success) return inviteSheet;
  const sheets = {
    properties: ss.getSheetByName('V2_properties'),
    rooms: ss.getSheetByName('V2_rooms'),
    users: ss.getSheetByName('V2_users'),
    tenants: ss.getSheetByName('V2_tenants'),
    contracts: ss.getSheetByName('V2_contracts'),
    invites: inviteSheet.data
  };
  const required = ['properties', 'rooms', 'users', 'tenants', 'contracts'].filter(function (key) { return !sheets[key]; });
  if (required.length) return landlordInitiatedContractError_('CONTRACT_INVITE_SCHEMA_NOT_READY', '缺少合約邀請資料表');
  const missing = V2_LANDLORD_INITIATED_CONTRACT_INVITE_HEADERS_.filter(function (header) { return landlordInitiatedContractHeaders_(sheets.invites).indexOf(header) < 0; });
  if (missing.length) return landlordInitiatedContractError_('CONTRACT_INVITE_SCHEMA_NOT_READY', '合約邀請欄位尚未就緒');
  return { success: true, code: 'OK', data: sheets };
}

function landlordInitiatedContractEnsureInviteSheet_(ss) {
  let sheet = ss.getSheetByName(V2_LANDLORD_INITIATED_CONTRACT_INVITE_SHEET_);
  if (!sheet) {
    if (typeof ss.insertSheet !== 'function') return landlordInitiatedContractError_('CONTRACT_INVITE_SCHEMA_NOT_READY', '缺少合約邀請資料表');
    try {
      sheet = ss.insertSheet(V2_LANDLORD_INITIATED_CONTRACT_INVITE_SHEET_);
    } catch (_) {
      return landlordInitiatedContractError_('CONTRACT_INVITE_SCHEMA_NOT_READY', '合約邀請資料表建立失敗');
    }
  }

  const existing = landlordInitiatedContractHeaders_(sheet);
  const hasExistingHeader = existing.some(function (header) { return Boolean(header); });
  if (!hasExistingHeader) {
    sheet.getRange(1, 1, 1, V2_LANDLORD_INITIATED_CONTRACT_INVITE_HEADERS_.length).setValues([V2_LANDLORD_INITIATED_CONTRACT_INVITE_HEADERS_.slice()]);
  } else {
    const missing = V2_LANDLORD_INITIATED_CONTRACT_INVITE_HEADERS_.filter(function (header) { return existing.indexOf(header) < 0; });
    if (missing.length) {
      const startColumn = Math.max(sheet.getLastColumn(), 1) + 1;
      sheet.getRange(1, startColumn, 1, missing.length).setValues([missing]);
    }
  }

  return { success: true, code: 'OK', data: sheet };
}

function landlordInitiatedContractNormalizeInput_(input) {
  input = input || {};
  const result = {
    property_id: landlordInitiatedContractText_(input.property_id),
    room_id: landlordInitiatedContractText_(input.room_id),
    start_date: landlordInitiatedContractText_(input.start_date),
    end_date: landlordInitiatedContractText_(input.end_date),
    rent_amount: landlordInitiatedContractNumber_(input.rent_amount),
    management_fee: landlordInitiatedContractNumber_(input.management_fee),
    deposit_months: landlordInitiatedContractNumber_(input.deposit_months),
    deposit_amount: landlordInitiatedContractNumber_(input.deposit_amount),
    payment_day: Math.round(landlordInitiatedContractNumber_(input.payment_day || input.monthly_payment_day)),
    electricity_fee_rate: landlordInitiatedContractNumber_(input.electricity_fee_rate),
    equipment_fee_rate: landlordInitiatedContractNumber_(input.equipment_fee_rate),
    tenant_name: landlordInitiatedContractText_(input.tenant_name || input.name),
    tenant_phone: landlordInitiatedContractNormalizePhone_(input.tenant_phone || input.phone),
    tenant_email: landlordInitiatedContractText_(input.tenant_email || input.email),
    note: landlordInitiatedContractText_(input.note)
  };
  if ((!result.room_id && !landlordInitiatedContractText_(input.previous_contract_id)) || !result.start_date || !result.end_date || !result.rent_amount || !result.deposit_amount || !result.payment_day) return landlordInitiatedContractError_('CONTRACT_INITIATION_INVALID', '租期、房間、租金、押金與付款日為必要資料');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(result.end_date) || result.end_date < result.start_date) return landlordInitiatedContractError_('CONTRACT_INITIATION_INVALID', '租期日期無效');
  if (result.tenant_phone && !/^09\d{8}$/.test(result.tenant_phone)) return landlordInitiatedContractError_('CONTRACT_INITIATION_INVALID', '房客手機格式無效');
  if (result.tenant_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.tenant_email)) return landlordInitiatedContractError_('CONTRACT_INITIATION_INVALID', '房客 Email 格式無效');
  return { success: true, code: 'OK', data: result };
}

function landlordInitiatedContractContractObject_(access, actor, property, room, input, extra) {
  const base = {
    contract_id: '', workspace_id: landlordInitiatedContractWorkspaceId_(access), landlord_id: landlordInitiatedContractLandlordId_(access), landlord_line_user_id: landlordInitiatedContractText_(access.line_user_id || access.principal_line_user_id), landlord_name: actor.name,
    tenant_id: '', tenant_user_id: '', tenant_line_user_id: '', tenant_name: '', tenant_phone: '', tenant_email: '',
    property_id: property.property_id || '', property_name: property.property_name || room.property_name || '', property_address: property.property_address || property.address || '', room_id: room.room_id || '', room_name: room.room_name || '',
    start_date: input.start_date, contract_start_date: input.start_date, end_date: input.end_date, contract_end_date: input.end_date,
    rent_amount: input.rent_amount, monthly_rent: input.rent_amount, management_fee: input.management_fee, monthly_management_fee: input.management_fee, deposit_months: input.deposit_months, deposit_amount: input.deposit_amount, payment_day: input.payment_day, monthly_payment_day: input.payment_day, electricity_fee_rate: input.electricity_fee_rate, equipment_fee_rate: input.equipment_fee_rate,
    contract_status: 'pending_tenant_signature', status: 'pending', account_status: 'pending', signing_mode: '', contract_origin: 'landlord_initiated', invite_id: '', contract_content: '', contract_version: 'fixed-google-doc-template-1', previous_contract_id: '', renewed_to_contract_id: '', tenant_signing_submission_status: 'pending',
    created_by_user_id: actor.user_id, created_by_membership_id: actor.membership_id, created_at: '', updated_at: '', note: input.note
  };
  return Object.assign(base, extra || {});
}

function landlordInitiatedContractBuildDocument_(access, property, room, input, tenantName) {
  if (typeof tenantContractDocumentPreview_ === 'function') {
    const fixedPreview =
      tenantContractDocumentPreview_(
        {
          landlord_name:
            landlordInitiatedContractText_(
              access.user && access.user.name
            ),
          tenant_name: tenantName || '',
          tenant_phone: input.tenant_phone || '',
          property_id: property.property_id || '',
          property_name:
            property.property_name ||
            room.property_name ||
            '',
          property_address:
            property.property_address ||
            property.address ||
            '',
          room_id: room.room_id || '',
          room_name: room.room_name || '',
          start_date: input.start_date,
          end_date: input.end_date,
          rent_amount: input.rent_amount,
          management_fee: input.management_fee,
          deposit_amount: input.deposit_amount
        },
        {
          tenant_name: tenantName || '',
          phone: input.tenant_phone || ''
        }
      );

    if (fixedPreview && fixedPreview.available === true) {
      return landlordInitiatedContractText_(
        fixedPreview.content
      );
    }

    return '';
  }


  const money = function (value) { return landlordInitiatedContractNumber_(value).toLocaleString('en-US'); };
  const landlord = landlordInitiatedContractText_(access.user && access.user.name) || '出租人';
  return [
    '租賃契約書',
    '文件版本：CMWebs V2.1 標準格式',
    '',
    '第一條　當事人',
    '出租人：' + landlord,
    '承租人：' + (tenantName || '待房客填寫'),
    '',
    '第二條　租賃標的',
    '租賃物件：' + landlordInitiatedContractText_(property.property_name || ''),
    '地址：' + landlordInitiatedContractText_(property.property_address || property.address || '未提供'),
    '房號：' + landlordInitiatedContractText_(room.room_name || ''),
    '',
    '第三條　租賃期間',
    '自 ' + input.start_date + ' 起至 ' + input.end_date + ' 止。',
    '',
    '第四條　租金與押金',
    '每月租金：新臺幣 ' + money(input.rent_amount) + ' 元。',
    '每月管理費：新臺幣 ' + money(input.management_fee) + ' 元。',
    '押金月數：' + input.deposit_months + ' 個月。',
    '押金：新臺幣 ' + money(input.deposit_amount) + ' 元。',
    '',
    '第五條　付款方式',
    '承租人應於每月 ' + input.payment_day + ' 日前完成當期租金及應付費用。',
    '',
    '第六條　使用與修繕',
    '承租人應以善良管理人之注意使用租賃標的，不得違法、轉租或為影響建物及他人安全之使用。',
    '',
    '第七條　費用與設備',
    '每度電費：新臺幣 ' + money(input.electricity_fee_rate) + ' 元。',
    '設備耗損費／度：新臺幣 ' + money(input.equipment_fee_rate) + ' 元。',
    '水電、網路、公共費用及其他使用相關費用，依雙方確認的帳單負擔。',
    '',
    '第八條　提前終止',
    '任一方需提前終止租約時，應依租約及相關法令提前通知。',
    '',
    '第九條　返還與點交',
    '租期屆滿或租約終止時，承租人應返還租賃標的、鑰匙及設備。',
    '',
    '第十條　爭議處理',
    '本契約未約定事項依中華民國相關法令及誠信原則處理。',
    '',
    '第十一條　補充約定',
    input.note || '無',
    '',
    '第十二條　簽署確認',
    '雙方已閱讀本契約全部條款及重要條件，並以線上簽名及送交紀錄確認本次簽署意旨。合約是否生效仍以房東審核完成及系統狀態為準。'
  ].join('\n');
}

function landlordInitiatedContractReplaceTenantName_(content, tenantName) {
  return landlordInitiatedContractText_(content)
    .replace(/承租人：[^\n]*/, '承租人：' + tenantName)
    .replace(/乙方[：:]\s*(?:—|待房客填寫)/, '乙方：' + tenantName);
}

function landlordInitiatedContractPublicContract_(contract, tenant, invite) {
  const currentInvite = invite || {};
  const inviteId = landlordInitiatedContractText_(contract.invite_id || currentInvite.invite_id || (tenant && tenant.invite_id));
  const inviteStatus = landlordInitiatedContractText_(currentInvite.status || (tenant && tenant.status));
  return Object.assign({}, contract, {
    tenant_binding_status: landlordInitiatedContractText_(contract.tenant_binding_status || (tenant && tenant.tenant_binding_status)),
    contract_status: landlordInitiatedContractText_(contract.contract_status),
    signing_mode: landlordInitiatedContractText_(contract.signing_mode),
    contract_content: landlordInitiatedContractText_(contract.contract_content),
    invite_id: inviteId,
    invite_url: inviteId ? V2_LANDLORD_INITIATED_CONTRACT_LIFF_URL_ + '?invite_id=' + encodeURIComponent(inviteId) : '',
    invite_status: inviteStatus,
    invite_expires_at: currentInvite.expires_at || (tenant && tenant.expires_at) || ''
  });
}

function landlordInitiatedContractPublicInvite_(invite, confirmationCode) {
  const inviteId = landlordInitiatedContractText_(invite.invite_id);
  return {
    invite_id: inviteId,
    url: V2_LANDLORD_INITIATED_CONTRACT_LIFF_URL_ + '?invite_id=' + encodeURIComponent(inviteId),
    confirmation_code: String(confirmationCode || ''),
    expires_at: invite.expires_at || '',
    status: invite.status || 'pending'
  };
}

function landlordInitiatedContractHasOpenSibling_(contracts, access, roomId, excludedContractId) {
  const workspaceId = landlordInitiatedContractWorkspaceId_(access);
  const now = new Date().getTime();
  return contracts.some(function (row) {
    const status = landlordInitiatedContractText_(row.contract_status).toLowerCase();
    if (landlordInitiatedContractText_(row.workspace_id) !== workspaceId || landlordInitiatedContractText_(row.room_id) !== landlordInitiatedContractText_(roomId) || landlordInitiatedContractText_(row.contract_id) === landlordInitiatedContractText_(excludedContractId)) return false;
    if (status === 'active') return true;
    if (['pending_tenant_signature', 'awaiting_tenant_signature'].indexOf(status) === -1) return false;
    const inviteExpiry = landlordInitiatedContractDateValue_(row.invite_expires_at);
    return !inviteExpiry || inviteExpiry > now;
  });
}

function landlordInitiatedContractFindScopedRow_(sheet, access, idHeader, idValue) {
  const workspaceId = landlordInitiatedContractWorkspaceId_(access);
  const landlordIds = (access.principals || []).map(function (item) { return landlordInitiatedContractText_(item.landlord_id); }).filter(Boolean);
  return landlordInitiatedContractRows_(sheet).find(function (row) {
    if (landlordInitiatedContractText_(row[idHeader]) !== landlordInitiatedContractText_(idValue)) return false;
    const rowWorkspace = landlordInitiatedContractText_(row.workspace_id);
    return rowWorkspace === workspaceId || (!rowWorkspace && landlordIds.indexOf(landlordInitiatedContractText_(row.landlord_id)) >= 0);
  }) || null;
}

function landlordInitiatedContractAccessValid_(access) {
  return Boolean(access && access.success === true && landlordInitiatedContractWorkspaceId_(access) && access.user && access.membership);
}

function landlordInitiatedContractActor_(access) {
  return {
    user_id: landlordInitiatedContractText_(access.user && access.user.user_id),
    membership_id: landlordInitiatedContractText_(access.membership && access.membership.membership_id),
    name: landlordInitiatedContractText_((access.user && access.user.name) || (access.membership && access.membership.display_name)) || '房東'
  };
}

function landlordInitiatedContractWorkspaceId_(access) { return landlordInitiatedContractText_(access && access.workspace && access.workspace.workspace_id); }
function landlordInitiatedContractLandlordId_(access) { return landlordInitiatedContractText_((access && access.principals && access.principals[0] && access.principals[0].landlord_id) || (access && access.user && access.user.landlord_id)); }
function landlordInitiatedContractUuid_() { return String(Utilities.getUuid()); }
function landlordInitiatedContractConfirmationCode_() { return String(Math.floor(Math.random() * 1000000)).padStart(6, '0'); }
function landlordInitiatedContractDigest_(value) { return landlordInitiatedContractHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value))); }
function landlordInitiatedContractHex_(bytes) { return (bytes || []).map(function (byte) { return ('0' + (byte < 0 ? byte + 256 : byte).toString(16)).slice(-2); }).join(''); }
function landlordInitiatedContractConstantEquals_(left, right) { left = String(left || ''); right = String(right || ''); let difference = left.length ^ right.length; for (let index = 0; index < Math.max(left.length, right.length); index += 1) difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0); return difference === 0; }
function landlordInitiatedContractText_(value) { return value === undefined || value === null ? '' : String(value).trim(); }
function landlordInitiatedContractNumber_(value) { const number = Number(landlordInitiatedContractText_(value).replace(/,/g, '')); return Number.isFinite(number) ? number : 0; }
function landlordInitiatedContractNormalizePhone_(value) { let digits = landlordInitiatedContractText_(value).replace(/\D/g, ''); if (digits.indexOf('8860') === 0 && digits.length === 13) digits = '0' + digits.slice(4); else if (digits.length === 9 && digits.charAt(0) === '9') digits = '0' + digits; return digits; }
function landlordInitiatedContractDateValue_(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 0 : date.getTime(); }
function landlordInitiatedContractHeaders_(sheet) {
  if (!sheet || typeof sheet.getRange !== 'function' || typeof sheet.getLastColumn !== 'function') return [];
  const lastColumn = Number(sheet.getLastColumn()) || 0;
  if (lastColumn < 1) return [];
  return sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(landlordInitiatedContractText_);
}
function landlordInitiatedContractRows_(sheet) { if (!sheet || sheet.getLastRow() < 2) return []; const values = sheet.getDataRange().getValues(); const headers = values.shift().map(landlordInitiatedContractText_); return values.map(function (row, index) { const result = { _sheet_row: index + 2 }; headers.forEach(function (header, column) { result[header] = row[column]; }); return result; }); }
function landlordInitiatedContractAppend_(sheet, object) { const headers = landlordInitiatedContractHeaders_(sheet); sheet.appendRow(headers.map(function (header) { return object[header] === undefined ? '' : object[header]; })); }
function landlordInitiatedContractUpdate_(sheet, row, updates) { const headers = landlordInitiatedContractHeaders_(sheet); Object.keys(updates || {}).forEach(function (header) { const column = headers.indexOf(header); if (column >= 0) sheet.getRange(row._sheet_row, column + 1).setValue(updates[header]); }); }
function landlordInitiatedContractError_(code, message) { return { success: false, code: code, message: message || '房東發起合約失敗', data: null }; }
