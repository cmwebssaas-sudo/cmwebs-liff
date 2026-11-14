// V2.1 紙本續約簽署。
// 房客不線上簽時，房東下載待簽續約的 PDF 傳給房客，房客手簽後回傳照片或 PDF，
// 房東上傳後由與線上核准相同的 landlordInitiatedContractFinalizeApproval_ 讓續約生效。
// 只處理續約；新房客的紙本合約走 landlord_contract_paper_backfill。

const V2_CONTRACT_PAPER_SIGNING_ACTIONS_ = [
  'landlord_contract_paper_signing_document',
  'landlord_contract_paper_signing_upload'
];
const V2_CONTRACT_PAPER_SIGNING_SIGNABLE_STATUSES_ = ['pending_tenant_signature', 'awaiting_tenant_signature'];
const V2_CONTRACT_PAPER_SIGNING_MAX_FILES_ = 10;
const V2_CONTRACT_PAPER_SIGNING_REVIEW_NOTE_PREFIX_ = '紙本簽署：';

function contractPaperSigningText_(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function contractPaperSigningIsRequest_(body) {
  try {
    const request = typeof body === 'string' ? JSON.parse(body) : body;
    return V2_CONTRACT_PAPER_SIGNING_ACTIONS_.indexOf(contractPaperSigningText_(request && request.action)) >= 0;
  } catch (_) {
    return false;
  }
}

// LINE login on a phone: {action, session_token, input} with the landlord review session.
function contractPaperSigningHandlePost_(body) {
  let request;
  try { request = typeof body === 'string' ? JSON.parse(body) : body; }
  catch (_) { return landlordInitiatedContractError_('INVALID_JSON', '紙本簽署資料格式無效'); }
  if (!contractPaperSigningIsRequest_(request)) return landlordInitiatedContractError_('INVALID_ACTION', '紙本簽署操作無效');
  const access = landlordInitiatedContractAccessFromSession_(request.session_token || '', 'contract_write');
  if (!access || access.success !== true) return access || landlordInitiatedContractError_('WORKSPACE_ACCESS_DENIED', '房東權限無效');
  return contractPaperSigningByAccess_(access, request.action, request.input || request);
}

function contractPaperSigningByAccess_(access, action, input) {
  if (!landlordInitiatedContractAccessValid_(access)) return landlordInitiatedContractError_('WORKSPACE_ACCESS_DENIED', 'Workspace 權限無效');
  if (action === 'landlord_contract_paper_signing_document') return contractPaperSigningDocument_(access, input || {});
  if (action === 'landlord_contract_paper_signing_upload') return contractPaperSigningUpload_(access, input || {});
  return landlordInitiatedContractError_('INVALID_ACTION', '紙本簽署操作無效');
}

function contractPaperSigningFindContract_(schema, access, contractId) {
  const workspaceId = landlordInitiatedContractWorkspaceId_(access);
  const id = contractPaperSigningText_(contractId);
  if (!id) return null;
  return landlordInitiatedContractRows_(schema.data.contracts).find(function (row) {
    return contractPaperSigningText_(row.contract_id) === id && contractPaperSigningText_(row.workspace_id) === workspaceId;
  }) || null;
}

function contractPaperSigningCheckSignable_(contract) {
  if (!contract) return landlordInitiatedContractError_('CONTRACT_NOT_FOUND', '找不到這份合約');
  if (contractPaperSigningText_(contract.signing_mode).toLowerCase() !== 'renewal') {
    return landlordInitiatedContractError_('PAPER_SIGNING_RENEWAL_ONLY', '紙本簽署只用於續約；新房客請用「手動補登紙本合約」');
  }
  if (V2_CONTRACT_PAPER_SIGNING_SIGNABLE_STATUSES_.indexOf(contractPaperSigningText_(contract.contract_status).toLowerCase()) < 0) {
    return landlordInitiatedContractError_('CONTRACT_NOT_PAPER_SIGNABLE', '這份續約目前不是待房客簽署狀態');
  }
  if (contractPaperSigningText_(contract.tenant_signing_submission_status).toLowerCase() === 'submitted') {
    return landlordInitiatedContractError_('TENANT_ALREADY_SIGNED_ONLINE', '房客已經在線上簽署，請到合約審核按核准');
  }
  return null;
}

function contractPaperSigningLandlordId_(access) {
  return contractPaperSigningText_((access.principals && access.principals[0] && access.principals[0].landlord_id) || access.principal_landlord_id || access.landlord_id);
}

function contractPaperSigningExistingDocument_(access, contract, documentType, idempotencyKey) {
  if (typeof ldFindDocumentByIdempotency_ !== 'function' || typeof ldEnsureContractDocumentsSheet_ !== 'function') return null;
  return ldFindDocumentByIdempotency_(
    ldEnsureContractDocumentsSheet_(),
    contractPaperSigningLandlordId_(access),
    contractPaperSigningText_(contract.contract_id),
    contractPaperSigningText_(contract.tenant_id),
    documentType,
    idempotencyKey,
    landlordInitiatedContractWorkspaceId_(access)
  );
}

// 下載用文字：取這個版本存下的合約全文，只把線上簽署欄改成手簽欄。
// 存在表上的 contract_content 不改。
function contractPaperSigningPrintableText_(content) {
  return contractPaperSigningText_(content).split(/\r?\n/).reduce(function (lines, line) {
    const text = line.trim();
    if (/^【電子簽署證明】/.test(text) || /^簽署狀態：/.test(text) || /^簽署時間：/.test(text)) return lines;
    if (/乙方簽名（線上簽署）/.test(text)) {
      lines.push('乙方簽名：＿＿＿＿＿＿＿＿＿＿　　簽署日期：　　年　　月　　日');
      return lines;
    }
    lines.push(line.replace(/\s+$/, ''));
    return lines;
  }, []).join('\n');
}

function contractPaperSigningPdfBytes_(title, text) {
  const document = DocumentApp.create(title);
  const fileId = document.getId();
  try {
    const body = document.getBody();
    body.setMarginTop(48).setMarginBottom(48).setMarginLeft(56).setMarginRight(56);
    text.split('\n').forEach(function (line, index) {
      const paragraph = body.appendParagraph(line);
      paragraph.setFontSize(index === 0 ? 16 : 11);
      if (index === 0) paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setBold(true);
    });
    body.getChild(0).removeFromParent();
    document.saveAndClose();
    return DriveApp.getFileById(fileId).getAs('application/pdf').getBytes();
  } finally {
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (_) {}
  }
}

function contractPaperSigningDocument_(access, input) {
  const schema = landlordInitiatedContractSchema_(SpreadsheetApp.getActiveSpreadsheet());
  if (!schema.success) return schema;
  const contract = contractPaperSigningFindContract_(schema, access, input.contract_id);
  const blocked = contractPaperSigningCheckSignable_(contract);
  if (blocked) return blocked;
  const text = contractPaperSigningPrintableText_(contract.contract_content);
  if (!text) return landlordInitiatedContractError_('PAPER_CONTRACT_CONTENT_MISSING', '這份續約沒有合約全文，請重新產生續約');

  // 同一版本的全文只產生一次 PDF；再按一次回傳同一份檔案。
  const idempotencyKey = 'paper-unsigned:' + contract.contract_id + ':' + landlordInitiatedContractDigest_(text).slice(0, 16);
  const existing = contractPaperSigningExistingDocument_(access, contract, 'paper_unsigned_contract', idempotencyKey);
  const fileName = '續約合約_' + contractPaperSigningText_(contract.room_name || contract.room_id) + '_' + contractPaperSigningText_(contract.tenant_name) + '.pdf';
  if (existing && contractPaperSigningText_(existing.status || 'stored') === 'stored') {
    return { success: true, code: 'IDEMPOTENT', data: { document_id: contractPaperSigningText_(existing.document_id), file_name: contractPaperSigningText_(existing.file_name) } };
  }

  let bytes;
  try {
    bytes = contractPaperSigningPdfBytes_(fileName.replace(/\.pdf$/, ''), text);
  } catch (_) {
    return landlordInitiatedContractError_('PAPER_CONTRACT_PDF_FAILED', '合約 PDF 產生失敗，請稍後再試');
  }
  const stored = storeLandlordContractDocumentForAccess_(access, {
    document_type: 'paper_unsigned_contract',
    contract_id: contract.contract_id,
    tenant_id: contract.tenant_id,
    file_name: fileName,
    mime_type: 'application/pdf',
    file_bytes: bytes,
    idempotency_key: idempotencyKey,
    note: '紙本簽署用待簽合約',
    document_origin: 'generated'
  });
  if (!stored || stored.success !== true) return stored || landlordInitiatedContractError_('DOCUMENT_WRITE_FAILED', '合約 PDF 保存失敗');
  return { success: true, code: 'OK', data: { document_id: stored.data.document_id, file_name: stored.data.file_name } };
}

function contractPaperSigningNormalizeUpload_(input) {
  const contractId = contractPaperSigningText_(input.contract_id);
  const idempotencyKey = contractPaperSigningText_(input.idempotency_key);
  const signedAt = contractPaperSigningText_(input.paper_signed_at);
  const files = Array.isArray(input.files) ? input.files : [];
  if (!contractId) return landlordInitiatedContractError_('CONTRACT_ID_REQUIRED', '缺少合約編號');
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(idempotencyKey)) return landlordInitiatedContractError_('INVALID_IDEMPOTENCY_KEY', '缺少或不正確的上傳識別碼');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(signedAt) || Number.isNaN(new Date(signedAt + 'T00:00:00+08:00').getTime())) {
    return landlordInitiatedContractError_('INVALID_PAPER_SIGNED_DATE', '請選擇房客簽名的日期');
  }
  const todayTaipei = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  if (signedAt > todayTaipei) return landlordInitiatedContractError_('INVALID_PAPER_SIGNED_DATE', '簽名日期不能晚於今天');
  if (!files.length || files.length > V2_CONTRACT_PAPER_SIGNING_MAX_FILES_) {
    return landlordInitiatedContractError_('PAPER_FILES_REQUIRED', '請選擇 1 到 ' + V2_CONTRACT_PAPER_SIGNING_MAX_FILES_ + ' 個檔案');
  }
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index] || {};
    if (['image/jpeg', 'image/png', 'application/pdf'].indexOf(contractPaperSigningText_(file.mime_type).toLowerCase()) < 0) {
      return landlordInitiatedContractError_('INVALID_MIME_TYPE', '只支援 JPG、PNG、PDF');
    }
    if (!contractPaperSigningText_(file.base64)) return landlordInitiatedContractError_('INVALID_UPLOAD_PAYLOAD', '檔案內容是空的');
  }
  return { success: true, data: { contract_id: contractId, idempotency_key: idempotencyKey, paper_signed_at: signedAt, files: files } };
}

function contractPaperSigningUpload_(access, input) {
  const normalized = contractPaperSigningNormalizeUpload_(input);
  if (!normalized.success) return normalized;
  const request = normalized.data;
  const schema = landlordInitiatedContractSchema_(SpreadsheetApp.getActiveSpreadsheet());
  if (!schema.success) return schema;
  const contract = contractPaperSigningFindContract_(schema, access, request.contract_id);
  if (!contract) return landlordInitiatedContractError_('CONTRACT_NOT_FOUND', '找不到這份合約');

  // 已用同一次上傳完成時（例如網路慢、按了兩次）直接回報完成。
  const firstKey = 'paper-signed:' + request.idempotency_key + ':1';
  if (contractPaperSigningText_(contract.contract_status).toLowerCase() === 'active' &&
    contractPaperSigningExistingDocument_(access, contract, 'paper_signed_contract', firstKey)) {
    return { success: true, code: 'IDEMPOTENT', data: { contract_id: contract.contract_id, contract_status: 'active', idempotent: true } };
  }
  const blocked = contractPaperSigningCheckSignable_(contract);
  if (blocked) return blocked;

  // 檔案寫入 Drive 較慢，在鎖外完成；生效失敗時再移除這次新存的檔案。
  const created = [];
  const rollback = function () {
    created.forEach(function (documentId) {
      try { removeLandlordContractDocumentForBackfill_(documentId); } catch (_) {}
    });
  };
  for (let index = 0; index < request.files.length; index += 1) {
    const file = request.files[index];
    const stored = storeLandlordContractDocumentForAccess_(access, {
      document_type: 'paper_signed_contract',
      contract_id: contract.contract_id,
      tenant_id: contract.tenant_id,
      file_name: contractPaperSigningText_(file.file_name) || ('signed-contract-' + (index + 1)),
      mime_type: contractPaperSigningText_(file.mime_type).toLowerCase(),
      base64: file.base64,
      idempotency_key: 'paper-signed:' + request.idempotency_key + ':' + (index + 1),
      note: '房客手簽合約 第 ' + (index + 1) + '／' + request.files.length + ' 個檔案',
      document_origin: 'paper_signing'
    });
    if (!stored || stored.success !== true) {
      rollback();
      return stored || landlordInitiatedContractError_('DOCUMENT_WRITE_FAILED', '檔案保存失敗');
    }
    if (!stored.data.idempotent) created.push(stored.data.document_id);
  }

  const result = landlordInitiatedContractWithScriptLock_(function () {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const freshSchema = landlordInitiatedContractSchema_(ss);
    if (!freshSchema.success) return freshSchema;
    const fresh = contractPaperSigningFindContract_(freshSchema, access, request.contract_id);
    const stillBlocked = contractPaperSigningCheckSignable_(fresh);
    if (stillBlocked) return stillBlocked;
    const nowIso = new Date().toISOString();
    const finalized = landlordInitiatedContractFinalizeApproval_(ss, access, fresh, nowIso);
    if (!finalized || finalized.success !== true) return finalized || landlordInitiatedContractError_('CONTRACT_FINALIZATION_FAILED', '續約生效失敗');
    landlordInitiatedContractUpdate_(freshSchema.data.contracts, fresh, {
      signed_at: request.paper_signed_at,
      tenant_signed_at: request.paper_signed_at,
      tenant_signing_submitted_at: nowIso,
      tenant_signing_reviewed_at: nowIso,
      tenant_signing_reviewed_by_user_id: contractPaperSigningText_(access.user && access.user.user_id),
      tenant_signing_reviewed_by_membership_id: contractPaperSigningText_(access.membership && access.membership.membership_id),
      tenant_signing_review_note: V2_CONTRACT_PAPER_SIGNING_REVIEW_NOTE_PREFIX_ + '房東上傳房客手簽合約（' + request.files.length + ' 個檔案）',
      updated_at: nowIso
    });
    // 線上邀請不再需要；房客之後點舊連結會看到「邀請已取消」。
    const invite = landlordInitiatedContractRows_(freshSchema.data.invites).find(function (row) {
      return contractPaperSigningText_(row.invite_id) === contractPaperSigningText_(fresh.invite_id) &&
        contractPaperSigningText_(row.contract_id) === contractPaperSigningText_(fresh.contract_id) &&
        contractPaperSigningText_(row.workspace_id) === landlordInitiatedContractWorkspaceId_(access);
    });
    if (invite && contractPaperSigningText_(invite.status).toLowerCase() === 'pending') {
      landlordInitiatedContractUpdate_(freshSchema.data.invites, invite, { status: 'cancelled', cancelled_at: nowIso, updated_at: nowIso });
    }
    return { success: true, code: 'OK', data: { contract_id: fresh.contract_id, contract_status: 'active', documents: request.files.length, idempotent: false } };
  });
  if (!result || result.success !== true) rollback();
  return result;
}
