// Native V2 private contract-artifact storage. This module never changes contract_status.
const V2_CONTRACT_ARTIFACT_UPLOAD_ACTION_ = 'tenant_contract_artifact_upload_submit';
const V2_CONTRACT_ARTIFACT_STATUS_ACTION_ = 'tenant_contract_artifact_upload_status';
const V2_CONTRACT_ARTIFACTS_SHEET_ = 'V2_contract_artifacts';
const V2_CONTRACT_ARTIFACT_ROOT_PROPERTY_ = 'CMWEBS_CONTRACT_SIGNING_DRIVE_ROOT_FOLDER_ID';
const V2_CONTRACT_ARTIFACT_EXCHANGE_TTL_SECONDS_ = 60;
const V2_CONTRACT_ARTIFACT_MAX_BYTES_ = 3 * 1024 * 1024;
const V2_CONTRACT_ARTIFACT_MAX_DIMENSION_ = 4096;
const V2_CONTRACT_ARTIFACT_MIN_DIMENSION_ = 32;
const V2_CONTRACT_ARTIFACT_HEADERS_ = ['artifact_id', 'workspace_id', 'tenant_id', 'contract_id', 'signing_mode', 'artifact_type', 'drive_file_id', 'mime_type', 'byte_size', 'sha256', 'idempotency_key', 'created_by_user_id', 'created_at', 'status'];

function tenantContractArtifactIsUploadRequest_(body) {
  try { return JSON.parse(String(body || '')).action === V2_CONTRACT_ARTIFACT_UPLOAD_ACTION_; } catch (_) { return false; }
}

function tenantContractArtifactHandleUploadPost_(body) {
  let request;
  try { request = JSON.parse(String(body || '')); } catch (_) { return tenantContractArtifactError_('INVALID_JSON'); }
  if (!request || request.action !== V2_CONTRACT_ARTIFACT_UPLOAD_ACTION_) return tenantContractArtifactError_('INVALID_ACTION');
  const requestId = tenantContractArtifactText_(request.request_id);
  const pollSecret = tenantContractArtifactText_(request.poll_secret);
  if (!/^[A-Za-z0-9_-]{22,}$/.test(requestId) || !/^[A-Za-z0-9_-]{43,}$/.test(pollSecret)) return tenantContractArtifactError_('INVALID_EXCHANGE_CREDENTIAL');
  let secret;
  try { secret = tenantLiffSigningSessionSecret_(); } catch (_) { return tenantContractArtifactError_('LIFF_SESSION_SECRET_NOT_CONFIGURED'); }
  const result = tenantContractArtifactStore_(request);
  CacheService.getScriptCache().put(tenantContractArtifactExchangeKey_(requestId), JSON.stringify({ poll_hash: tenantLiffSigningHmacHex_(pollSecret, secret), result: result }), V2_CONTRACT_ARTIFACT_EXCHANGE_TTL_SECONDS_);
  return { success: true, code: 'EXCHANGE_ACCEPTED' };
}

function tenantContractArtifactReadExchange_(requestId, pollSecret) {
  const raw = CacheService.getScriptCache().get(tenantContractArtifactExchangeKey_(requestId));
  if (!raw) return tenantContractArtifactError_('ARTIFACT_EXCHANGE_NOT_FOUND');
  let entry;
  try { entry = JSON.parse(raw); } catch (_) { return tenantContractArtifactError_('ARTIFACT_EXCHANGE_INVALID'); }
  let secret;
  try { secret = tenantLiffSigningSessionSecret_(); } catch (_) { return tenantContractArtifactError_('LIFF_SESSION_SECRET_NOT_CONFIGURED'); }
  if (!tenantLiffSigningConstantEquals_(entry.poll_hash, tenantLiffSigningHmacHex_(pollSecret, secret))) return tenantContractArtifactError_('ARTIFACT_EXCHANGE_DENIED');
  CacheService.getScriptCache().remove(tenantContractArtifactExchangeKey_(requestId));
  return entry.result || tenantContractArtifactError_('ARTIFACT_EXCHANGE_INVALID');
}

function tenantContractArtifactStore_(request) {
  const session = tenantContractArtifactVerifySession_(request.session_token);
  if (!session.success) return session;
  const artifactType = tenantContractArtifactText_(request.artifact_type).toLowerCase();
  const idempotencyKey = tenantContractArtifactText_(request.idempotency_key);
  if (!/^[A-Za-z0-9_-]{22,}$/.test(idempotencyKey)) return tenantContractArtifactError_('INVALID_IDEMPOTENCY_KEY');
  const artifact = tenantContractArtifactValidatePayload_(request.file || {}, artifactType);
  if (!artifact.success) return artifact;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const authorization = tenantContractArtifactAuthorize_(session.data, artifactType);
    if (!authorization.success) return authorization;
    const sheet = tenantContractArtifactSchemaReady_(SpreadsheetApp.getActiveSpreadsheet());
    if (!sheet.success) return sheet;
    const existing = tenantContractArtifactFindIdempotency_(sheet.data, session.data.contract_id, idempotencyKey);
    if (existing) return tenantContractArtifactIdempotencyResult_(existing, artifact.data.sha256, artifactType);
    const root = tenantContractArtifactRootFolder_();
    if (!root.success) return root;
    let driveFile = null;
    try {
      driveFile = root.data.createFile(Utilities.newBlob(artifact.data.bytes, artifact.data.mime_type, tenantContractArtifactOpaqueFilename_(artifactType, artifact.data.mime_type)));
      driveFile.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
      const record = { artifact_id: Utilities.getUuid(), workspace_id: session.data.workspace_id, tenant_id: session.data.tenant_id, contract_id: session.data.contract_id, signing_mode: authorization.data.signing_mode, artifact_type: artifactType, drive_file_id: driveFile.getId(), mime_type: artifact.data.mime_type, byte_size: artifact.data.byte_size, sha256: artifact.data.sha256, idempotency_key: idempotencyKey, created_by_user_id: session.data.user_id, created_at: new Date().toISOString(), status: 'stored' };
      tenantContractArtifactAppend_(sheet.data, record);
      return { success: true, code: 'OK', data: tenantContractArtifactPublicResult_(record, false) };
    } catch (_) {
      if (driveFile) { try { driveFile.setTrashed(true); } catch (_) {} }
      return tenantContractArtifactError_('ARTIFACT_METADATA_WRITE_FAILED');
    }
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function tenantContractArtifactVerifySession_(token) {
  try {
    const verified = verifyTenantLiffSessionToken_(token);
    return verified.success ? verified : tenantContractArtifactError_(verified.code || 'SESSION_TOKEN_INVALID');
  } catch (_) { return tenantContractArtifactError_('SESSION_TOKEN_INVALID'); }
}

function tenantContractArtifactAuthorize_(claims, artifactType) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = tenantContractArtifactRows_(ss.getSheetByName('V2_contracts'));
  const contract = rows.find(function (row) { return tenantContractArtifactText_(row.contract_id) === claims.contract_id && tenantContractArtifactText_(row.tenant_id) === claims.tenant_id && tenantContractArtifactText_(row.workspace_id) === claims.workspace_id; });
  if (!contract) return tenantContractArtifactError_('CONTRACT_OWNERSHIP_INVALID');
  if (['pending_tenant_signature', 'awaiting_tenant_signature'].indexOf(tenantContractArtifactText_(contract.contract_status)) === -1) return tenantContractArtifactError_('CONTRACT_NOT_SIGNABLE');
  const signingMode = tenantContractArtifactText_(contract.signing_mode).toLowerCase();
  if (['new_tenant', 'renewal'].indexOf(signingMode) === -1) return tenantContractArtifactError_('SIGNING_MODE_NOT_READY');
  const allowed = signingMode === 'new_tenant' ? ['identity_front', 'identity_back', 'signature'] : ['signature'];
  if (allowed.indexOf(artifactType) === -1) return tenantContractArtifactError_('ARTIFACT_TYPE_NOT_ALLOWED');
  return { success: true, data: { signing_mode: signingMode } };
}

function tenantContractArtifactValidatePayload_(file, artifactType) {
  const mimeType = tenantContractArtifactText_(file.mime_type).toLowerCase();
  const base64 = tenantContractArtifactText_(file.base64);
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) return tenantContractArtifactError_('INVALID_BASE64');
  let bytes;
  try { bytes = Utilities.base64Decode(base64); } catch (_) { return tenantContractArtifactError_('INVALID_BASE64'); }
  if (!bytes || bytes.length === 0 || bytes.length > V2_CONTRACT_ARTIFACT_MAX_BYTES_) return tenantContractArtifactError_('ARTIFACT_TOO_LARGE');
  const image = tenantContractArtifactInspectImage_(bytes);
  if (!image.success) return image;
  const allowedMimes = artifactType === 'signature' ? ['image/png'] : ['image/jpeg', 'image/png'];
  if (allowedMimes.indexOf(mimeType) === -1 || image.data.mime_type !== mimeType) return tenantContractArtifactError_('ARTIFACT_MIME_INVALID');
  if (image.data.width < V2_CONTRACT_ARTIFACT_MIN_DIMENSION_ || image.data.height < V2_CONTRACT_ARTIFACT_MIN_DIMENSION_ || image.data.width > V2_CONTRACT_ARTIFACT_MAX_DIMENSION_ || image.data.height > V2_CONTRACT_ARTIFACT_MAX_DIMENSION_) return tenantContractArtifactError_('ARTIFACT_DIMENSIONS_INVALID');
  if (artifactType === 'signature' && !tenantContractArtifactSignatureHasInk_(bytes, image.data)) return tenantContractArtifactError_('SIGNATURE_BLANK');
  return { success: true, data: { bytes: bytes, mime_type: mimeType, byte_size: bytes.length, sha256: tenantContractArtifactSha256_(bytes) } };
}

function tenantContractArtifactInspectImage_(bytes) {
  const b = function (i) { return (bytes[i] || 0) & 255; };
  if (bytes.length >= 24 && [137,80,78,71,13,10,26,10].every(function (v, i) { return b(i) === v; }) && String.fromCharCode(b(12),b(13),b(14),b(15)) === 'IHDR') {
    const width = ((b(16) << 24) | (b(17) << 16) | (b(18) << 8) | b(19)) >>> 0;
    const height = ((b(20) << 24) | (b(21) << 16) | (b(22) << 8) | b(23)) >>> 0;
    return width && height ? { success: true, data: { mime_type: 'image/png', width: width, height: height, png_idat_bytes: tenantContractArtifactPngIdatBytes_(bytes) } } : tenantContractArtifactError_('ARTIFACT_IMAGE_INVALID');
  }
  if (bytes.length >= 4 && b(0) === 255 && b(1) === 216 && b(2) === 255) {
    let i = 2;
    while (i + 9 < bytes.length) { if (b(i) !== 255) { i++; continue; } const marker = b(i + 1); const len = (b(i + 2) << 8) | b(i + 3); if (len < 2 || i + 2 + len > bytes.length) break; if ([192,193,194,195,197,198,199,201,202,203].indexOf(marker) !== -1) { const height = (b(i + 5) << 8) | b(i + 6); const width = (b(i + 7) << 8) | b(i + 8); return width && height ? { success: true, data: { mime_type: 'image/jpeg', width: width, height: height } } : tenantContractArtifactError_('ARTIFACT_IMAGE_INVALID'); } i += 2 + len; }
  }
  return tenantContractArtifactError_('ARTIFACT_MAGIC_BYTES_INVALID');
}

function tenantContractArtifactPngIdatBytes_(bytes) {
  let i = 8; let total = 0;
  while (i + 12 <= bytes.length) { const length = (((bytes[i] & 255) << 24) | ((bytes[i + 1] & 255) << 16) | ((bytes[i + 2] & 255) << 8) | (bytes[i + 3] & 255)) >>> 0; const type = String.fromCharCode((bytes[i + 4] || 0) & 255, (bytes[i + 5] || 0) & 255, (bytes[i + 6] || 0) & 255, (bytes[i + 7] || 0) & 255); if (length > bytes.length || i + 12 + length > bytes.length) return 0; if (type === 'IDAT') total += length; if (type === 'IEND') return total; i += length + 12; }
  return 0;
}

function tenantContractArtifactSignatureHasInk_(bytes, image) {
  // Canvas signatures are PNG only. A transparent/near-empty PNG has a tiny IDAT stream;
  // reject it conservatively without trusting client-provided stroke counts.
  return image.mime_type === 'image/png' && image.png_idat_bytes >= 96 && bytes.length >= 128;
}

function tenantContractArtifactRootFolder_() {
  const id = PropertiesService.getScriptProperties().getProperty(V2_CONTRACT_ARTIFACT_ROOT_PROPERTY_);
  if (!id) return tenantContractArtifactError_('CONTRACT_SIGNING_DRIVE_ROOT_NOT_CONFIGURED');
  try { return { success: true, data: DriveApp.getFolderById(id) }; } catch (_) { return tenantContractArtifactError_('CONTRACT_SIGNING_DRIVE_ROOT_UNAVAILABLE'); }
}

function tenantContractArtifactSchemaReady_(ss) {
  const sheet = ss.getSheetByName(V2_CONTRACT_ARTIFACTS_SHEET_);
  if (!sheet || sheet.getLastColumn() < V2_CONTRACT_ARTIFACT_HEADERS_.length) return tenantContractArtifactError_('CONTRACT_ARTIFACT_SCHEMA_NOT_READY');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(tenantContractArtifactText_);
  return V2_CONTRACT_ARTIFACT_HEADERS_.every(function (header) { return headers.indexOf(header) !== -1; }) ? { success: true, data: sheet } : tenantContractArtifactError_('CONTRACT_ARTIFACT_SCHEMA_NOT_READY');
}

function migrateV2ContractArtifactSchema_(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  const contracts = ss.getSheetByName('V2_contracts');
  if (!contracts) throw new Error('V2_contracts is required');
  tenantContractArtifactEnsureHeaders_(contracts, ['signing_mode']);
  let artifacts = ss.getSheetByName(V2_CONTRACT_ARTIFACTS_SHEET_);
  if (!artifacts) artifacts = ss.insertSheet(V2_CONTRACT_ARTIFACTS_SHEET_);
  tenantContractArtifactEnsureHeaders_(artifacts, V2_CONTRACT_ARTIFACT_HEADERS_);
  return { success: true, code: 'OK', data: { sheet: V2_CONTRACT_ARTIFACTS_SHEET_, headers: V2_CONTRACT_ARTIFACT_HEADERS_.slice() } };
}

function tenantContractArtifactEnsureHeaders_(sheet, required) {
  if (sheet.getLastColumn() === 0) { sheet.getRange(1, 1, 1, required.length).setValues([required]); return; }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(tenantContractArtifactText_);
  const missing = required.filter(function (header) { return headers.indexOf(header) === -1; });
  if (missing.length) sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
}

function tenantContractArtifactRows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues(); const headers = values.shift().map(tenantContractArtifactText_);
  return values.map(function (row) { const result = {}; headers.forEach(function (header, index) { result[header] = row[index]; }); return result; });
}
function tenantContractArtifactFindIdempotency_(sheet, contractId, key) { return tenantContractArtifactRows_(sheet).find(function (row) { return tenantContractArtifactText_(row.contract_id) === contractId && tenantContractArtifactText_(row.idempotency_key) === key; }); }
function tenantContractArtifactIdempotencyResult_(row, sha256, artifactType) { return tenantContractArtifactText_(row.sha256) === sha256 && tenantContractArtifactText_(row.artifact_type) === artifactType ? { success: true, code: 'IDEMPOTENT', data: tenantContractArtifactPublicResult_(row, true) } : tenantContractArtifactError_('IDEMPOTENCY_CONFLICT'); }
function tenantContractArtifactAppend_(sheet, record) { const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(tenantContractArtifactText_); sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([headers.map(function (header) { return record[header] === undefined ? '' : record[header]; })]); }
function tenantContractArtifactPublicResult_(record, idempotent) { return { artifact_id: tenantContractArtifactText_(record.artifact_id), contract_id: tenantContractArtifactText_(record.contract_id), artifact_type: tenantContractArtifactText_(record.artifact_type), sha256: tenantContractArtifactText_(record.sha256), byte_size: Number(record.byte_size || 0), status: tenantContractArtifactText_(record.status), idempotent: idempotent === true }; }
function tenantContractArtifactOpaqueFilename_(type, mime) { return 'artifact_' + Utilities.getUuid() + (mime === 'image/jpeg' ? '.jpg' : '.png'); }
function tenantContractArtifactSha256_(bytes) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes).map(function (b) { return ('0' + ((b < 0 ? b + 256 : b) & 255).toString(16)).slice(-2); }).join(''); }
function tenantContractArtifactExchangeKey_(requestId) { return 'tenant_contract_artifact:' + String(requestId || ''); }
function tenantContractArtifactText_(value) { return value === null || value === undefined ? '' : String(value).trim(); }
function tenantContractArtifactError_(code) { return { success: false, code: code, message: '合約附件上傳失敗' }; }
