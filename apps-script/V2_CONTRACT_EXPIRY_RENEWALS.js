// Standard, additive contract-expiry renewal preparation. Trigger installation
// is intentionally separate from this source change.
const V2_CONTRACT_EXPIRY_RENEWAL_DRAFT_STATUS_ = 'pending_landlord_review';
const V2_CONTRACT_EXPIRY_RENEWAL_PREPARE_DAYS_ = 60;
const V2_CONTRACT_EXPIRY_RENEWAL_REMINDER_DAYS_ = 30;
const V2_CONTRACT_EXPIRY_RENEWAL_TRIGGER_HOUR_ = 9;
const V2_CONTRACT_EXPIRY_RENEWAL_HEADERS_ = [
  'renewal_review_status',
  'renewal_review_prepared_at',
  'renewal_review_confirmed_at',
  'renewal_review_reminded_30d_at',
  'renewal_inquiry_status',
  'renewal_inquiry_sent_at',
  'renewal_inquiry_responded_at',
  'renewal_tenant_intent',
  'renewal_tenant_intent_at'
];

function contractExpiryRenewalRunDaily_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const contracts = ss.getSheetByName('V2_contracts');
  const rooms = ss.getSheetByName('V2_rooms');
  const properties = ss.getSheetByName('V2_properties');
  if (!contracts || !rooms || !properties) return { success: false, code: 'CONTRACT_EXPIRY_SCHEMA_NOT_READY' };
  const schema = contractExpiryRenewalEnsureSchema_(contracts);
  if (!schema.success) return schema;
  const rows = landlordInitiatedContractRows_(contracts);
  const today = new Date();
  const result = { prepared: [], reminded: [], skipped: [] };
  rows.filter(function(contract) {
    const days = contractExpiryRenewalDaysUntil_(contract.end_date || contract.contract_end_date, today);
    return landlordInitiatedContractText_(contract.contract_status).toLowerCase() === 'active' && days >= 0 && days <= V2_CONTRACT_EXPIRY_RENEWAL_PREPARE_DAYS_;
  }).forEach(function(previous) {
    const days = contractExpiryRenewalDaysUntil_(previous.end_date || previous.contract_end_date, today);
    const draft = rows.find(function(candidate) {
      return landlordInitiatedContractText_(candidate.workspace_id) === landlordInitiatedContractText_(previous.workspace_id) &&
        landlordInitiatedContractText_(candidate.previous_contract_id) === landlordInitiatedContractText_(previous.contract_id) &&
        ['pending_landlord_review', 'pending_tenant_signature', 'awaiting_tenant_signature', 'active'].indexOf(landlordInitiatedContractText_(candidate.contract_status)) >= 0;
    });
    if (!draft) {
      const prepared = contractExpiryRenewalPrepareDraft_(previous, rows, rooms, properties, today);
      if (prepared.success) result.prepared.push(prepared.data.contract_id);
      else result.skipped.push({ contract_id: previous.contract_id, code: prepared.code });
    } else if (days === V2_CONTRACT_EXPIRY_RENEWAL_REMINDER_DAYS_ && !landlordInitiatedContractText_(draft.renewal_review_reminded_30d_at)) {
      const notice = contractExpiryRenewalNotifyLandlord_(draft, previous, days, true);
      if (notice.success) {
        const now = new Date().toISOString();
        landlordInitiatedContractUpdate_(contracts, draft, { renewal_review_reminded_30d_at: now, updated_at: now });
        result.reminded.push(draft.contract_id);
      }
    }
  });
  return { success: true, code: 'OK', data: result };
}

// This is called explicitly during an authorized Apps Script release. It never
// removes or replaces an existing trigger, and is idempotent for this handler.
function installContractExpiryRenewalDailyTrigger() {
  return contractExpiryRenewalEnsureDailyTrigger_();
}

function contractExpiryRenewalEnsureDailyTrigger_() {
  if (typeof ScriptApp === 'undefined' || typeof ScriptApp.getProjectTriggers !== 'function') {
    return { success: false, code: 'CONTRACT_EXPIRY_TRIGGER_SERVICE_UNAVAILABLE' };
  }
  const existing = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return typeof trigger.getHandlerFunction === 'function' && trigger.getHandlerFunction() === 'contractExpiryRenewalRunDaily_';
  });
  if (existing.length) return { success: true, code: 'OK', data: { created: false, trigger_count: existing.length } };
  ScriptApp.newTrigger('contractExpiryRenewalRunDaily_').timeBased().everyDays(1).atHour(V2_CONTRACT_EXPIRY_RENEWAL_TRIGGER_HOUR_).create();
  return { success: true, code: 'OK', data: { created: true, trigger_count: 1 } };
}

function contractExpiryRenewalEnsureSchema_(contractSheet) {
  const headers = landlordInitiatedContractHeaders_(contractSheet);
  const missing = V2_CONTRACT_EXPIRY_RENEWAL_HEADERS_.filter(function(header) {
    return headers.indexOf(header) < 0;
  });
  if (!missing.length) return { success: true, code: 'OK' };
  if (!contractSheet || typeof contractSheet.getRange !== 'function') return { success: false, code: 'CONTRACT_EXPIRY_SCHEMA_NOT_READY' };
  const startColumn = Math.max(contractSheet.getLastColumn(), 1) + 1;
  contractSheet.getRange(1, startColumn, 1, missing.length).setValues([missing]);
  return { success: true, code: 'OK', data: { added_headers: missing } };
}

function contractExpiryRenewalPrepareDraft_(previous, rows, roomsSheet, propertiesSheet, today) {
  if (typeof contractRenewalHistoryBuildDefaults_ !== 'function' || typeof contractRenewalHistoryBuildVersionFields_ !== 'function') return { success: false, code: 'CONTRACT_RENEWAL_HISTORY_MODULE_REQUIRED' };
  const defaults = contractRenewalHistoryBuildDefaults_(previous);
  const input = landlordInitiatedContractNormalizeInput_(Object.assign({}, defaults, {
    property_id: previous.property_id, room_id: previous.room_id, payment_day: defaults.monthly_payment_day || previous.payment_day,
    tenant_name: previous.tenant_name || previous.name, tenant_phone: previous.tenant_phone || previous.phone,
    tenant_email: previous.tenant_email || previous.email, note: previous.note || '', identity_document_mode: 'carried_forward'
  }));
  if (!input.success) return input;
  const access = { success: true, workspace: { workspace_id: previous.workspace_id }, user: { user_id: previous.created_by_user_id || 'system', name: previous.landlord_name || '房東' }, membership: { membership_id: previous.created_by_membership_id || 'system' }, principals: [{ landlord_id: previous.landlord_id }] };
  const room = landlordInitiatedContractFindScopedRow_(roomsSheet, access, 'room_id', previous.room_id);
  const property = landlordInitiatedContractFindScopedRow_(propertiesSheet, access, 'property_id', previous.property_id);
  if (!room || !property) return { success: false, code: 'RENEWAL_TARGET_NOT_FOUND' };
  const now = new Date().toISOString();
  const contractId = landlordInitiatedContractUuid_();
  const version = contractRenewalHistoryBuildVersionFields_(previous, input.data, { contract_id: contractId, existing_rows: rows });
  const actor = landlordInitiatedContractActor_(access);
  const draft = landlordInitiatedContractContractObject_(access, actor, property, room, Object.assign({}, input.data, version), {
    contract_id: contractId, tenant_id: previous.tenant_id, tenant_user_id: previous.tenant_user_id || '', tenant_line_user_id: previous.tenant_line_user_id || '',
    tenant_name: previous.tenant_name || previous.name || '', tenant_phone: previous.tenant_phone || previous.phone || '', tenant_email: previous.tenant_email || previous.email || '',
    contract_status: V2_CONTRACT_EXPIRY_RENEWAL_DRAFT_STATUS_, status: V2_CONTRACT_EXPIRY_RENEWAL_DRAFT_STATUS_, account_status: 'pending', signing_mode: 'renewal', contract_origin: 'expiry_prepared_renewal',
    contract_content: landlordInitiatedContractBuildDocument_(access, property, room, input.data, previous.tenant_name || previous.name || ''),
    previous_contract_id: previous.contract_id, renewed_from_contract_id: previous.contract_id, contract_family_id: version.contract_family_id, renewal_sequence: version.renewal_sequence,
    renewal_review_status: 'pending', renewal_review_prepared_at: now, renewal_inquiry_status: 'pending', renewal_tenant_intent: 'pending', tenant_signing_submission_status: 'pending', created_at: now, updated_at: now
  });
  landlordInitiatedContractAppend_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('V2_contracts'), draft);
  contractExpiryRenewalNotifyLandlord_(draft, previous, contractExpiryRenewalDaysUntil_(previous.end_date || previous.contract_end_date, today), false);
  return { success: true, code: 'OK', data: { contract_id: contractId } };
}

function contractExpiryRenewalNotifyLandlord_(draft, previous, days, reminder) {
  if (typeof workspaceNotifyTeam_ !== 'function') return { success: false, code: 'WORKSPACE_NOTIFICATION_MODULE_REQUIRED' };
  return workspaceNotifyTeam_({ workspace_id: draft.workspace_id, landlord_id: draft.landlord_id, event_type: 'contract', title: reminder ? '續約合約尚待檢視' : '續約合約已準備好', body: (draft.room_name || previous.room_name || '房間') + ' 合約將於 ' + (previous.end_date || previous.contract_end_date || '') + ' 到期（剩餘 ' + days + ' 天），請先檢視草稿，再決定是否發送給房客。', target_type: 'contract', target_id: draft.contract_id, action_url: 'landlord-contract-requests.html', severity: reminder ? 'warning' : 'info', source: 'contract_expiry_renewal', fallback_line_user_id: draft.landlord_line_user_id });
}

function contractExpiryRenewalDaysUntil_(value, today) {
  const end = new Date(String(value || '').slice(0, 10) + 'T00:00:00');
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Number.isNaN(end.getTime()) ? -1 : Math.round((end.getTime() - base.getTime()) / 86400000);
}
