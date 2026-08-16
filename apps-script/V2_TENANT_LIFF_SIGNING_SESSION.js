// Native V2 tenant-contract LIFF authentication. No Drive, upload, or signing write path.
const V2_TENANT_LIFF_AUTH_ACTION_ = 'tenant_contract_auth_init';
const V2_TENANT_LIFF_AUTH_STATUS_ACTION_ = 'tenant_contract_auth_status';
const V2_TENANT_LIFF_AUTH_PURPOSE_ = 'tenant_contract_signing';
const V2_TENANT_LIFF_INVITE_AUTH_ACTION_ = 'tenant_contract_invite_auth_init';
const V2_TENANT_LIFF_INVITE_AUTH_STATUS_ACTION_ = 'tenant_contract_invite_auth_status';
const V2_TENANT_LIFF_INVITE_AUTH_PURPOSE_ = 'tenant_contract_invite_signing';
const V2_TENANT_LIFF_AUTH_TTL_SECONDS_ = 600;
const V2_TENANT_LIFF_EXCHANGE_TTL_SECONDS_ = 60;

function tenantLiffSigningIsAuthRequest_(body) {
  try { return JSON.parse(String(body || '')).action === V2_TENANT_LIFF_AUTH_ACTION_; } catch (_) { return false; }
}

function tenantLiffSigningHandleAuthPost_(body) {
  let request;
  try { request = JSON.parse(String(body || '')); } catch (_) { return tenantLiffSigningError_('INVALID_JSON'); }
  if (!request || request.action !== V2_TENANT_LIFF_AUTH_ACTION_) return tenantLiffSigningError_('INVALID_ACTION');
  const requestId = tenantLiffSigningText_(request.request_id);
  const pollSecret = tenantLiffSigningText_(request.poll_secret);
  if (!tenantLiffSigningText_(request.id_token)) return tenantLiffSigningError_('MISSING_ID_TOKEN');
  if (!/^[A-Za-z0-9_-]{22,}$/.test(requestId) || !/^[A-Za-z0-9_-]{43,}$/.test(pollSecret)) return tenantLiffSigningError_('INVALID_EXCHANGE_CREDENTIAL');
  let exchangeSecret;
  try { exchangeSecret = tenantLiffSigningSessionSecret_(); } catch (_) { return tenantLiffSigningError_('LIFF_SESSION_SECRET_NOT_CONFIGURED'); }
  const result = tenantLiffSigningAuthenticate_(request.id_token);
  CacheService.getScriptCache().put(tenantLiffSigningExchangeKey_(requestId), JSON.stringify({
    poll_hash: tenantLiffSigningHmacHex_(pollSecret, exchangeSecret), result: result
  }), V2_TENANT_LIFF_EXCHANGE_TTL_SECONDS_);
  return { success: true, code: 'EXCHANGE_ACCEPTED' };
}

function tenantLiffSigningIsInviteAuthRequest_(body) {
  try { return JSON.parse(String(body || '')).action === V2_TENANT_LIFF_INVITE_AUTH_ACTION_; } catch (_) { return false; }
}

function tenantLiffSigningHandleInviteAuthPost_(body) {
  let request;
  try { request = JSON.parse(String(body || '')); } catch (_) { return tenantLiffSigningError_('INVALID_JSON'); }
  if (!request || request.action !== V2_TENANT_LIFF_INVITE_AUTH_ACTION_) return tenantLiffSigningError_('INVALID_ACTION');
  const requestId = tenantLiffSigningText_(request.request_id);
  const pollSecret = tenantLiffSigningText_(request.poll_secret);
  if (!tenantLiffSigningText_(request.id_token)) return tenantLiffSigningError_('MISSING_ID_TOKEN');
  if (!/^[A-Za-z0-9_-]{22,}$/.test(requestId) || !/^[A-Za-z0-9_-]{43,}$/.test(pollSecret)) return tenantLiffSigningError_('INVALID_EXCHANGE_CREDENTIAL');
  let exchangeSecret;
  try { exchangeSecret = tenantLiffSigningSessionSecret_(); } catch (_) { return tenantLiffSigningError_('LIFF_SESSION_SECRET_NOT_CONFIGURED'); }
  const result = tenantLiffSigningInviteAuthenticate_(request.invite_id, request.confirmation_code, request.id_token, request.tenant_data || {});
  CacheService.getScriptCache().put(tenantLiffSigningInviteExchangeKey_(requestId), JSON.stringify({
    poll_hash: tenantLiffSigningHmacHex_(pollSecret, exchangeSecret), result: result
  }), V2_TENANT_LIFF_EXCHANGE_TTL_SECONDS_);
  return { success: true, code: 'EXCHANGE_ACCEPTED' };
}

function tenantLiffSigningReadInviteExchange_(requestId, pollSecret) {
  const raw = CacheService.getScriptCache().get(tenantLiffSigningInviteExchangeKey_(requestId));
  if (!raw) return tenantLiffSigningError_('AUTH_EXCHANGE_NOT_FOUND');
  let entry;
  try { entry = JSON.parse(raw); } catch (_) { return tenantLiffSigningError_('AUTH_EXCHANGE_INVALID'); }
  let exchangeSecret;
  try { exchangeSecret = tenantLiffSigningSessionSecret_(); } catch (_) { return tenantLiffSigningError_('LIFF_SESSION_SECRET_NOT_CONFIGURED'); }
  if (!tenantLiffSigningConstantEquals_(entry.poll_hash, tenantLiffSigningHmacHex_(pollSecret, exchangeSecret))) return tenantLiffSigningError_('AUTH_EXCHANGE_DENIED');
  CacheService.getScriptCache().remove(tenantLiffSigningInviteExchangeKey_(requestId));
  return entry.result || tenantLiffSigningError_('AUTH_EXCHANGE_INVALID');
}

function tenantLiffSigningReadExchange_(requestId, pollSecret) {
  const raw = CacheService.getScriptCache().get(tenantLiffSigningExchangeKey_(requestId));
  if (!raw) return tenantLiffSigningError_('AUTH_EXCHANGE_NOT_FOUND');
  let entry; try { entry = JSON.parse(raw); } catch (_) { return tenantLiffSigningError_('AUTH_EXCHANGE_INVALID'); }
  let exchangeSecret;
  try { exchangeSecret = tenantLiffSigningSessionSecret_(); } catch (_) { return tenantLiffSigningError_('LIFF_SESSION_SECRET_NOT_CONFIGURED'); }
  if (!tenantLiffSigningConstantEquals_(entry.poll_hash, tenantLiffSigningHmacHex_(pollSecret, exchangeSecret))) return tenantLiffSigningError_('AUTH_EXCHANGE_DENIED');
  CacheService.getScriptCache().remove(tenantLiffSigningExchangeKey_(requestId));
  return entry.result || tenantLiffSigningError_('AUTH_EXCHANGE_INVALID');
}

function tenantLiffSigningAuthenticate_(idToken) {
  const verified = tenantLiffSigningVerifyIdTokenClaims_(idToken);
  if (!verified.success) return verified;
  const claims = verified.data;
  const principal = tenantLiffSigningResolvePrincipal_(claims.sub);
  if (!principal.success) return principal;
  const now = Math.floor(Date.now() / 1000);
  const nowIso = new Date().toISOString();
  const expiresAt = now + V2_TENANT_LIFF_AUTH_TTL_SECONDS_;
  const token = createTenantLiffSessionToken_({ version: 1, purpose: V2_TENANT_LIFF_AUTH_PURPOSE_, line_sub: claims.sub, user_id: principal.data.user_id, tenant_id: principal.data.tenant_id, workspace_id: principal.data.workspace_id, contract_id: principal.data.contract_id, issued_at: now, expires_at: expiresAt, jti: Utilities.getUuid() });
  return { success: true, code: 'OK', data: { tenant: principal.data.tenant, contract: principal.data.contract, signing_required: true, signing_status: principal.data.signing_status, artifact_requirements: principal.data.artifact_requirements, artifact_state: principal.data.artifact_state, session_token: token, session_expires_at: new Date(expiresAt * 1000).toISOString(), authenticated_at: nowIso } };
}

function tenantLiffSigningInviteAuthenticate_(inviteId, confirmationCode, idToken, tenantData) {
  const verified = tenantLiffSigningVerifyIdTokenClaims_(idToken);
  if (!verified.success) return verified;
  if (typeof landlordInitiatedContractInviteClaim_ !== 'function') return tenantLiffSigningError_('LANDLORD_INITIATED_CONTRACT_MODULE_REQUIRED');
  const claimed = landlordInitiatedContractInviteClaim_(inviteId, confirmationCode, verified.data.sub, tenantData || {});
  if (!claimed || claimed.success !== true) return claimed || tenantLiffSigningError_('INVITE_CLAIM_FAILED');
  const contract = claimed.data.contract;
  const signingMode = tenantLiffSigningText_(contract.signing_mode).toLowerCase();
  if (signingMode !== 'new_tenant') return tenantLiffSigningError_('INVITE_SIGNING_MODE_INVALID');
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + V2_TENANT_LIFF_AUTH_TTL_SECONDS_;
  const token = createTenantLiffSessionToken_({
    version: 1,
    purpose: V2_TENANT_LIFF_INVITE_AUTH_PURPOSE_,
    line_sub: verified.data.sub,
    user_id: tenantLiffSigningText_(contract.tenant_user_id),
    tenant_id: tenantLiffSigningText_(contract.tenant_id),
    workspace_id: tenantLiffSigningText_(contract.workspace_id),
    contract_id: tenantLiffSigningText_(contract.contract_id),
    invite_id: tenantLiffSigningText_(inviteId),
    signing_mode: signingMode,
    issued_at: now,
    expires_at: expiresAt,
    jti: Utilities.getUuid()
  });
  const tenant = claimed.data.tenant || {};
  const contractView = tenantLiffSigningContractView_([contract], contract, signingMode, tenant);
  return {
    success: true,
    code: 'OK',
    data: {
      tenant: tenant,
      contract: contractView,
      signing_required: true,
      signing_status: tenantLiffSigningText_(contract.tenant_signing_submission_status) || 'pending',
      artifact_requirements: ['identity_front', 'identity_back', 'signature'],
      artifact_state: { identity_front: false, identity_back: false, signature: false },
      session_token: token,
      session_expires_at: new Date(expiresAt * 1000).toISOString(),
      authenticated_at: new Date().toISOString()
    }
  };
}

function tenantLiffSigningVerifyIdTokenClaims_(idToken) {
  const channelId = PropertiesService.getScriptProperties().getProperty('CMWEBS_LINE_LOGIN_CHANNEL_ID');
  if (!channelId) return tenantLiffSigningError_('LINE_LOGIN_CHANNEL_NOT_CONFIGURED');
  let response;
  try {
    response = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', { method: 'post', muteHttpExceptions: true, contentType: 'application/x-www-form-urlencoded', payload: { id_token: String(idToken), client_id: channelId } });
  } catch (_) { return tenantLiffSigningError_('LINE_TOKEN_VERIFY_FAILED'); }
  if (response.getResponseCode() !== 200) return tenantLiffSigningError_('LINE_TOKEN_VERIFY_FAILED');
  let claims;
  try { claims = JSON.parse(response.getContentText()); } catch (_) { return tenantLiffSigningError_('LINE_TOKEN_VERIFY_FAILED'); }
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== 'https://access.line.me' || claims.aud !== channelId || !tenantLiffSigningText_(claims.sub) || !Number.isFinite(Number(claims.exp)) || Number(claims.exp) <= now || !Number.isFinite(Number(claims.iat)) || Number(claims.iat) > now + 60 || now - Number(claims.iat) > 86400) return tenantLiffSigningError_('LINE_TOKEN_CLAIMS_INVALID');
  return { success: true, code: 'OK', data: claims };
}

function tenantLiffSigningResolvePrincipal_(lineSub) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const users = tenantLiffSigningRows_(ss.getSheetByName('V2_users'));
  const user = users.find(function (row) { return tenantLiffSigningText_(row.line_user_id) === lineSub && tenantLiffSigningText_(row.role).toLowerCase() === 'tenant' && tenantLiffSigningText_(row.status || row.account_status || 'active').toLowerCase() === 'active'; });
  if (!user) return tenantLiffSigningError_('TENANT_USER_NOT_ACTIVE');
  const tenants = tenantLiffSigningRows_(ss.getSheetByName('V2_tenants'));
  const tenant = tenants.find(function (row) { return tenantLiffSigningText_(row.tenant_user_id || row.user_id) === tenantLiffSigningText_(user.user_id) && tenantLiffSigningText_(row.line_user_id || row.tenant_line_user_id) === lineSub && tenantLiffSigningText_(row.status || row.account_status || 'active').toLowerCase() === 'active'; });
  if (!tenant) return tenantLiffSigningError_('TENANT_MAPPING_NOT_FOUND');
  const workspaceId = tenantLiffSigningText_(tenant.workspace_id);
  if (!workspaceId) return tenantLiffSigningError_('WORKSPACE_MEMBERSHIP_INVALID');
  const contracts = tenantLiffSigningRows_(ss.getSheetByName('V2_contracts'));
  const contract = contracts.find(function (row) { return tenantLiffSigningText_(row.tenant_id) === tenantLiffSigningText_(tenant.tenant_id) && tenantLiffSigningText_(row.workspace_id) === workspaceId && ['pending_tenant_signature', 'awaiting_tenant_signature'].indexOf(tenantLiffSigningText_(row.contract_status)) >= 0; });
  if (!contract) return tenantLiffSigningError_('SIGNABLE_CONTRACT_NOT_FOUND');
  const signingMode = tenantLiffSigningText_(contract.signing_mode).toLowerCase();
  if (['new_tenant', 'renewal'].indexOf(signingMode) === -1) return tenantLiffSigningError_('SIGNING_MODE_NOT_READY');
  const artifactState = tenantLiffSigningArtifactState_(ss, contract, signingMode);
  return { success: true, data: { user_id: tenantLiffSigningText_(user.user_id), tenant_id: tenantLiffSigningText_(tenant.tenant_id), workspace_id: workspaceId, contract_id: tenantLiffSigningText_(contract.contract_id), tenant: { tenant_id: tenantLiffSigningText_(tenant.tenant_id), tenant_name: tenantLiffSigningText_(tenant.tenant_name || tenant.name), room_name: tenantLiffSigningText_(tenant.room_name) }, contract: tenantLiffSigningContractView_(contracts, contract, signingMode, tenant), signing_status: tenantLiffSigningText_(contract.tenant_signing_submission_status) || 'pending', artifact_requirements: signingMode === 'new_tenant' ? ['identity_front', 'identity_back', 'signature'] : ['signature'], artifact_state: artifactState } };
}

function tenantLiffSigningContractView_(contracts, contract, signingMode, tenant) {
  const previousId = tenantLiffSigningText_(contract.previous_contract_id || contract.renewed_from_contract_id);
  const previous = previousId ? contracts.find(function (row) { return tenantLiffSigningText_(row.contract_id) === previousId && tenantLiffSigningText_(row.tenant_id) === tenantLiffSigningText_(contract.tenant_id) && tenantLiffSigningText_(row.workspace_id) === tenantLiffSigningText_(contract.workspace_id); }) : null;
  const documentContract = Object.assign({}, contract, {
    landlord_name: contract.landlord_name || contract.owner_name,
    tenant_name: contract.tenant_name || (tenant && (tenant.tenant_name || tenant.name)),
    room_name: contract.room_name || (tenant && tenant.room_name)
  });
  const terms = tenantLiffSigningTermsDocument_(documentContract);
  return {
    contract_id: tenantLiffSigningText_(contract.contract_id),
    contract_status: tenantLiffSigningText_(contract.contract_status),
    signing_mode: signingMode,
    landlord_name: tenantLiffSigningText_(contract.landlord_name || contract.owner_name),
    tenant_name: tenantLiffSigningText_(contract.tenant_name || (tenant && (tenant.tenant_name || tenant.name))),
    property_name: tenantLiffSigningText_(contract.property_name),
    property_address: tenantLiffSigningText_(contract.property_address || contract.address),
    room_name: tenantLiffSigningText_(contract.room_name || (tenant && tenant.room_name)),
    bank_name: tenantLiffSigningText_(contract.bank_name || contract.landlord_bank_name),
    bank_account: tenantLiffSigningText_(contract.bank_account || contract.landlord_bank_account || contract.payment_account),
    bank_account_name: tenantLiffSigningText_(contract.bank_account_name || contract.account_name),
    start_date: contract.start_date || contract.contract_start_date || '',
    end_date: contract.end_date || contract.contract_end_date || '',
    rent_amount: contract.rent_amount || contract.monthly_rent || '',
    management_fee: contract.management_fee || contract.monthly_management_fee || '',
    deposit_amount: contract.deposit_amount || '',
    monthly_payment_day: contract.monthly_payment_day || contract.payment_day || '',
    landlord_note: tenantLiffSigningText_(contract.landlord_note || contract.signing_note || contract.renewal_landlord_note),
    tenant_signing_submission_status: tenantLiffSigningText_(contract.tenant_signing_submission_status) || 'pending',
    tenant_signed_at: contract.tenant_signed_at || '',
    tenant_signing_submitted_at: contract.tenant_signing_submitted_at || '',
    tenant_signing_reviewed_at: contract.tenant_signing_reviewed_at || '',
    tenant_signing_review_note: tenantLiffSigningText_(contract.tenant_signing_review_note),
    terms_document: terms,
    renewal_comparison: tenantLiffSigningRenewalComparison_(previous, contract, signingMode)
  };
}

function tenantLiffSigningTermsDocument_(contract) {
  const content = tenantLiffSigningText_(contract.contract_content || contract.contract_text || contract.contract_terms || contract.terms_text);
  if (content) {
    return {
      available: true,
      source: 'landlord_provided_contract',
      version: tenantLiffSigningText_(contract.contract_version) || 'landlord-provided',
      content: content
    };
  }
  const generated = tenantLiffSigningGenerateStandardContract_(contract);
  return generated
    ? { available: true, source: 'generated_standard_contract', version: 'v2.1-standard-1', content: generated }
    : { available: false, message: '完整合約必要欄位尚未提供，請聯絡房東確認。' };
}

function tenantLiffSigningGenerateStandardContract_(contract) {
  contract = contract || {};
  const required = [
    contract.start_date || contract.contract_start_date,
    contract.end_date || contract.contract_end_date,
    contract.rent_amount || contract.monthly_rent,
    contract.deposit_amount,
    contract.room_name
  ];
  if (required.some(function (value) { return !tenantLiffSigningText_(value); })) return '';
  const landlord = tenantLiffSigningText_(contract.landlord_name || contract.owner_name) || '出租人';
  const tenant = tenantLiffSigningText_(contract.tenant_name) || '承租人';
  const property = tenantLiffSigningText_(contract.property_name) || '租賃物件';
  const address = tenantLiffSigningText_(contract.property_address || contract.address) || '未提供';
  const room = tenantLiffSigningText_(contract.room_name);
  const start = tenantLiffSigningText_(contract.start_date || contract.contract_start_date);
  const end = tenantLiffSigningText_(contract.end_date || contract.contract_end_date);
  const rent = tenantLiffSigningMoney_(contract.rent_amount || contract.monthly_rent);
  const managementFee = tenantLiffSigningMoney_(contract.management_fee || contract.monthly_management_fee);
  const deposit = tenantLiffSigningMoney_(contract.deposit_amount);
  const paymentDay = tenantLiffSigningText_(contract.monthly_payment_day || contract.payment_day) || '未提供';
  const bankName = tenantLiffSigningText_(contract.bank_name || contract.landlord_bank_name) || '未提供';
  const bankAccount = tenantLiffSigningText_(contract.bank_account || contract.landlord_bank_account || contract.payment_account) || '未提供';
  const bankAccountName = tenantLiffSigningText_(contract.bank_account_name || contract.account_name) || landlord;
  const note = tenantLiffSigningText_(contract.landlord_note || contract.signing_note || contract.renewal_landlord_note) || '無';
  return [
    '租賃契約書',
    '文件版本：CMWebs V2.1 標準格式',
    '',
    '第一條　當事人',
    '出租人：' + landlord,
    '承租人：' + tenant,
    '',
    '第二條　租賃標的',
    '租賃物件：' + property,
    '地址：' + address,
    '房號：' + room,
    '',
    '第三條　租賃期間',
    '自 ' + start + ' 起至 ' + end + ' 止。',
    '',
    '第四條　租金與押金',
    '每月租金：新臺幣 ' + rent + ' 元。',
    '每月管理費：新臺幣 ' + managementFee + ' 元。',
    '押金：新臺幣 ' + deposit + ' 元。',
    '',
    '第五條　付款方式',
    '承租人應於每月 ' + paymentDay + ' 日前完成當期租金及應付費用，並依房東提供的收款方式付款。',
    '收款銀行：' + bankName + '；帳號：' + bankAccount + '；戶名：' + bankAccountName + '。',
    '',
    '第六條　使用與修繕',
    '承租人應以善良管理人之注意使用租賃標的，不得違法、轉租或為影響建物及他人安全之使用。一般耗損以外之損壞，應依責任歸屬負擔修復或賠償。',
    '',
    '第七條　費用與設備',
    '水電、網路、公共費用及其他使用相關費用，依房東公告之計費方式及雙方確認的帳單負擔。設備交付與返還狀況以點交紀錄為準。',
    '',
    '第八條　提前終止',
    '任一方需提前終止租約時，應依租約及相關法令提前通知，並完成費用結清、物品返還及房屋點交。違約責任依雙方確認之約定及適用法令處理。',
    '',
    '第九條　返還與點交',
    '租期屆滿或租約終止時，承租人應返還租賃標的、鑰匙及設備，並恢復合理使用狀態；押金於費用及損害責任確認後依約結算。',
    '',
    '第十條　爭議處理',
    '本契約未約定事項依中華民國相關法令及誠信原則處理；如有爭議，雙方應先協商，協商不成時依管轄法院及適用法令處理。',
    '',
    '第十一條　補充約定',
    note,
    '',
    '第十二條　簽署確認',
    '雙方已閱讀本契約全部條款及重要條件，並以線上簽名及送交紀錄確認本次簽署意旨。合約是否生效仍以房東審核完成及系統狀態為準。'
  ].join('\n');
}

function tenantLiffSigningMoney_(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number).toLocaleString('en-US') : '0';
}

function tenantLiffSigningRenewalComparison_(previous, contract, signingMode) {
  if (signingMode !== 'renewal') return { available: false, items: [] };
  if (!previous) return { available: false, message: '續約前一份合約關聯尚未提供。', items: [] };
  const fields = [
    ['租期', 'start_date', 'end_date'],
    ['月租', 'rent_amount', 'monthly_rent'],
    ['管理費', 'management_fee', 'monthly_management_fee'],
    ['押金', 'deposit_amount', 'deposit_amount'],
    ['繳款日', 'monthly_payment_day', 'payment_day']
  ];
  const items = fields.map(function (field) {
    const oldValue = field[0] === '租期' ? tenantLiffSigningText_(previous.start_date || previous.contract_start_date) + ' → ' + tenantLiffSigningText_(previous.end_date || previous.contract_end_date) : tenantLiffSigningText_(previous[field[1]] || previous[field[2]]);
    const newValue = field[0] === '租期' ? tenantLiffSigningText_(contract.start_date || contract.contract_start_date) + ' → ' + tenantLiffSigningText_(contract.end_date || contract.contract_end_date) : tenantLiffSigningText_(contract[field[1]] || contract[field[2]]);
    return { label: field[0], old_value: oldValue, new_value: newValue, changed: oldValue !== newValue };
  });
  return { available: true, items: items };
}

function tenantLiffSigningArtifactState_(ss, contract, signingMode) {
  const rows = tenantLiffSigningRows_(ss.getSheetByName('V2_contract_artifacts'));
  const required = signingMode === 'new_tenant' ? ['identity_front', 'identity_back', 'signature'] : ['signature'];
  const stored = {};
  rows.forEach(function (row) {
    if (tenantLiffSigningText_(row.contract_id) === tenantLiffSigningText_(contract.contract_id) && tenantLiffSigningText_(row.workspace_id) === tenantLiffSigningText_(contract.workspace_id) && tenantLiffSigningText_(row.tenant_id) === tenantLiffSigningText_(contract.tenant_id) && tenantLiffSigningText_(row.status) === 'stored') stored[tenantLiffSigningText_(row.artifact_type)] = true;
  });
  return required.reduce(function (result, type) { result[type] = stored[type] === true; return result; }, {});
}

function createTenantLiffSessionToken_(claims) { const payload = Utilities.base64EncodeWebSafe(JSON.stringify(claims)).replace(/=+$/g, ''); return payload + '.' + tenantLiffSigningHmacHex_(payload, tenantLiffSigningSessionSecret_()); }
function verifyTenantLiffSessionToken_(token) { const parts = String(token || '').split('.'); if (parts.length !== 2 || !tenantLiffSigningConstantEquals_(parts[1], tenantLiffSigningHmacHex_(parts[0], tenantLiffSigningSessionSecret_()))) return tenantLiffSigningError_('SESSION_TOKEN_INVALID'); let claims; try { claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()); } catch (_) { return tenantLiffSigningError_('SESSION_TOKEN_INVALID'); } if (Number(claims.expires_at) <= Math.floor(Date.now()/1000)) return tenantLiffSigningError_('SESSION_TOKEN_EXPIRED'); if (claims.purpose === V2_TENANT_LIFF_INVITE_AUTH_PURPOSE_) { if (typeof landlordInitiatedContractInviteSessionContext_ !== 'function') return tenantLiffSigningError_('LANDLORD_INITIATED_CONTRACT_MODULE_REQUIRED'); const inviteContext = landlordInitiatedContractInviteSessionContext_(claims); if (!inviteContext || inviteContext.success !== true) return tenantLiffSigningError_((inviteContext && inviteContext.code) || 'INVITE_SESSION_INVALID'); return { success: true, data: claims }; } if (claims.purpose !== V2_TENANT_LIFF_AUTH_PURPOSE_) return tenantLiffSigningError_('SESSION_TOKEN_INVALID'); const principal = tenantLiffSigningResolvePrincipal_(claims.line_sub); if (!principal.success || principal.data.user_id !== claims.user_id || principal.data.tenant_id !== claims.tenant_id || principal.data.workspace_id !== claims.workspace_id || principal.data.contract_id !== claims.contract_id) return tenantLiffSigningError_('SESSION_PRINCIPAL_INVALID'); return { success: true, data: claims }; }
function tenantLiffSigningSessionSecret_() { const secret = PropertiesService.getScriptProperties().getProperty('CMWEBS_LIFF_SESSION_HMAC_SECRET'); if (!secret) throw new Error('CMWEBS_LIFF_SESSION_HMAC_SECRET is not configured'); return secret; }
function tenantLiffSigningHmacHex_(value, key) { return Utilities.computeHmacSha256Signature(String(value), String(key)).map(function (b) { return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2); }).join(''); }
function tenantLiffSigningRows_(sheet) { if (!sheet || sheet.getLastRow() < 2) return []; const values = sheet.getDataRange().getValues(); const headers = values.shift().map(tenantLiffSigningText_); return values.map(function (row, index) { const obj = { _sheet_row: index + 2 }; headers.forEach(function (h, i) { obj[h] = row[i]; }); return obj; }); }
function tenantLiffSigningExchangeKey_(id) { return 'tenant_liff_auth:' + String(id || ''); }
function tenantLiffSigningInviteExchangeKey_(id) { return 'tenant_liff_invite_auth:' + String(id || ''); }
function tenantLiffSigningText_(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function tenantLiffSigningConstantEquals_(a, b) { a = String(a || ''); b = String(b || ''); let d = a.length ^ b.length; for (let i=0; i<Math.max(a.length,b.length); i++) d |= (a.charCodeAt(i)||0) ^ (b.charCodeAt(i)||0); return d === 0; }
function tenantLiffSigningError_(code) { return { success: false, code: code, message: '房客簽署身分驗證失敗' }; }
