var LD_CONTRACT_DOCUMENTS_SHEET_ = 'V2_contract_documents';
var LD_CONTRACT_DOCUMENTS_ROOT_FOLDER_PROPERTY_ =
  'CMWEBS_LANDLORD_CONTRACT_DOCUMENTS_DRIVE_ROOT_FOLDER_ID';
var LD_CONTRACT_DOCUMENT_MAX_BYTES_ = 8 * 1024 * 1024;
var LD_CONTRACT_DOCUMENT_TYPES_ = [
  'legacy_contract',
  'identity_front',
  'identity_back',
  'selfie',
  'checkout_start_meter',
  'checkout_end_meter'
];
var LD_CONTRACT_DOCUMENT_HEADERS_ = [
  'document_id',
  'workspace_id',
  'landlord_id',
  'landlord_line_user_id',
  'tenant_id',
  'contract_id',
  'document_type',
  'file_name',
  'mime_type',
  'byte_size',
  'sha256',
  'idempotency_key',
  'drive_file_id',
  'status',
  'created_at',
  'created_by_user_id',
  'note',
  'document_origin',
  'source_document_id'
];

function getLandlordContractDocumentsInitByLineUid_(
  landlordLineUserId,
  contractId,
  tenantId
) {
  var action = 'landlord_contract_documents_init';
  var safeContractId = ldText_(contractId);
  var safeTenantId = ldText_(tenantId);

  try {
    var landlord = lmResolveLandlord_(landlordLineUserId);

    if (!landlord) {
      return {
        success: false,
        code: 'LANDLORD_NOT_FOUND',
        message: '查無房東資料或尚未完成綁定',
        data: {
          landlord: null,
          contracts: [],
          documents: []
        }
      };
    }

    var landlordId = ldText_(landlord.landlord_id);
    var contracts = ldGetLandlordContracts_(
      landlord,
      safeContractId
    );
    var documents = ldGetContractDocuments_(
      landlord,
      safeContractId,
      safeTenantId
    );

    documents.sort(ldContractDocumentSort_);

    lmLogAccess_({
      lineUserId: landlordLineUserId,
      userId: landlord.landlord_user_id || '',
      role: 'landlord',
      action: action,
      targetId: landlordId,
      result: 'success',
      errorMessage: '',
      notes:
        'contract_count=' +
        contracts.length +
        ',doc_count=' +
        documents.length
    });

    return {
      success: true,
      code: 'OK',
      message: '查詢成功',
      data: {
        landlord: {
          landlord_id: landlordId,
          landlord_name: landlord.landlord_name || '',
          landlord_line_user_id: landlordLineUserId
        },
        contracts: contracts,
        documents: documents
      }
    };
  } catch (error) {
    lmLogAccess_({
      lineUserId: landlordLineUserId || '',
      userId: '',
      role: 'landlord',
      action: action,
      targetId: '',
      result: 'failed',
      errorMessage: error.message,
      notes: 'init error'
    });

    return {
      success: false,
      code: 'SYSTEM_ERROR',
      message: '系統錯誤：' + error.message,
      data: {
        landlord: null,
        contracts: [],
        documents: []
      }
    };
  }
}

function uploadLandlordContractDocumentByLineUid_(
  landlordLineUserId,
  contractId,
  tenantId,
  documentType,
  fileName,
  mimeType,
  base64,
  idempotencyKey,
  note
) {
  var action = 'landlord_contract_document_upload';

  try {
    var landlord = lmResolveLandlord_(landlordLineUserId);

    if (!landlord) {
      return {
        success: false,
        code: 'LANDLORD_NOT_FOUND',
        message: '查無房東資料或尚未完成綁定'
      };
    }

    var normalizedType = ldText_(documentType).toLowerCase();
    if (LD_CONTRACT_DOCUMENT_TYPES_.indexOf(normalizedType) === -1) {
      return {
        success: false,
        code: 'INVALID_DOCUMENT_TYPE',
        message: '不支援的文件類型'
      };
    }

    var normalizedContractId = ldText_(contractId);
    var normalizedTenantId = ldText_(tenantId);
    var safeFileName = ldText_(fileName);
    var safeMimeType = ldText_(mimeType).toLowerCase();
    var safeBase64 = ldText_(base64);
    var safeIdempotencyKey = ldText_(idempotencyKey);
    var safeNote = ldText_(note);
    var ownerLandlordId = ldText_(landlord.landlord_id);
    var normalizedWorkspaceId = ldText_(landlord.workspace_id || '');

    if (!safeIdempotencyKey) {
      return {
        success: false,
        code: 'INVALID_IDEMPOTENCY_KEY',
        message: '缺少 idempotency_key'
      };
    }

    if (!safeFileName || !safeMimeType || !safeBase64) {
      return {
        success: false,
        code: 'INVALID_UPLOAD_PAYLOAD',
        message: '缺少必要上傳欄位'
      };
    }

    if (
      safeMimeType !== 'image/jpeg' &&
      safeMimeType !== 'image/png' &&
      safeMimeType !== 'application/pdf'
    ) {
      return {
        success: false,
        code: 'INVALID_MIME_TYPE',
        message: '僅支援 JPG、PNG、PDF'
      };
    }

    var fileBytes;
    try {
      fileBytes = Utilities.base64Decode(safeBase64);
    } catch (_) {
      return {
        success: false,
        code: 'INVALID_BASE64',
        message: '上傳內容不是合法 Base64'
      };
    }

    if (
      !fileBytes ||
      fileBytes.length <= 0 ||
      fileBytes.length > LD_CONTRACT_DOCUMENT_MAX_BYTES_
    ) {
      return {
        success: false,
        code: 'INVALID_FILE_SIZE',
        message: '檔案大小不合法（1~8MB）'
      };
    }

    if (normalizedContractId) {
      var contract = ldGetOwnedContractById_(landlord, normalizedContractId);

      if (!contract) {
        return {
          success: false,
          code: 'CONTRACT_NOT_FOUND',
          message: '租約不存在或不屬於此房東'
        };
      }

      if (!normalizedTenantId) {
        normalizedTenantId = ldText_(contract.tenant_id);
      }
    }

    var sha256 = ldComputeSha256Hex_(fileBytes);
    var safeFileExt =
      safeMimeType === 'application/pdf'
        ? '.pdf'
        : safeMimeType === 'image/png'
          ? '.png'
          : '.jpg';

    var docId = Utilities.getUuid();
    var lock = LockService.getScriptLock();

    lock.waitLock(10000);

    try {
      var sheet = ldEnsureContractDocumentsSheet_();
      var existing = ldFindDocumentByIdempotency_(
        sheet,
        ownerLandlordId,
        normalizedContractId,
        normalizedTenantId,
        normalizedType,
        safeIdempotencyKey
      );

      if (existing) {
        if (
          ldText_(existing.sha256) === sha256 &&
          ldText_(existing.mime_type).toLowerCase() === safeMimeType
        ) {
          return {
            success: true,
            code: 'IDEMPOTENT',
            message: '重複請求，已直接回傳既有資料',
            data: {
              document_id: existing.document_id || '',
              contract_id: existing.contract_id || '',
              tenant_id: existing.tenant_id || '',
              document_type: existing.document_type || normalizedType,
              file_name: existing.file_name || safeFileName,
              mime_type: existing.mime_type || safeMimeType,
              status: existing.status || 'stored',
              created_at: existing.created_at || '',
              idempotent: true
            }
          };
        }

        return {
          success: false,
          code: 'IDEMPOTENCY_CONFLICT',
          message: '相同 idempotency_key 已存在但檔案內容不同'
        };
      }

      var folder = ldGetContractDocumentFolder_();
      if (!folder.success) {
        return folder;
      }

      var blob = Utilities.newBlob(
        fileBytes,
        safeMimeType,
        safeFileName
      );
      var driveFile = folder.data.createFile(blob);
      driveFile.setSharing(
        DriveApp.Access.PRIVATE,
        DriveApp.Permission.NONE
      );

      var finalFileName = safeFileName;
      if (!/\.pdf$|\.png$|\.jpg$|\.jpeg$/i.test(finalFileName)) {
        finalFileName = finalFileName + safeFileExt;
      }

      var now = new Date().toISOString();
      var headers = ldGetHeaders_(sheet);
      var row = {
        document_id: docId,
        workspace_id: normalizedWorkspaceId,
        landlord_id: ownerLandlordId,
        landlord_line_user_id: landlordLineUserId,
        tenant_id: normalizedTenantId,
        contract_id: normalizedContractId,
        document_type: normalizedType,
        file_name: finalFileName,
        mime_type: safeMimeType,
        byte_size: fileBytes.length,
        sha256: sha256,
        idempotency_key: safeIdempotencyKey,
        drive_file_id: driveFile.getId(),
        status: 'stored',
        created_at: now,
        created_by_user_id: ldText_(landlord.landlord_user_id || ''),
        note: safeNote,
        document_origin: 'uploaded',
        source_document_id: ''
      };

      sheet.appendRow(
        headers.map(function (header) {
          var value = row[header];
          return value === undefined ? '' : value;
        })
      );

      return {
        success: true,
        code: 'OK',
        message: '上傳成功',
        data: {
          document_id: docId,
          contract_id: normalizedContractId,
          tenant_id: normalizedTenantId,
          document_type: normalizedType,
          file_name: finalFileName,
          mime_type: safeMimeType,
          byte_size: fileBytes.length,
          sha256: sha256,
          created_at: now,
          status: 'stored',
          idempotent: false
        }
      };
    } finally {
      try {
        lock.releaseLock();
      } catch (_) {}
    }
  } catch (error) {
    lmLogAccess_({
      lineUserId: landlordLineUserId || '',
      userId: '',
      role: 'landlord',
      action: action,
      targetId: '',
      result: 'failed',
      errorMessage: error.message,
      notes: 'upload error'
    });

    return {
      success: false,
      code: 'SYSTEM_ERROR',
      message: '系統錯誤：' + error.message
    };
  }
}

function getLandlordContractDocumentDownloadByLineUid_(
  landlordLineUserId,
  documentId
) {
  var action = 'landlord_contract_document_download';

  try {
    var landlord = lmResolveLandlord_(landlordLineUserId);

    if (!landlord) {
      return {
        success: false,
        code: 'LANDLORD_NOT_FOUND',
        message: '查無房東資料或尚未完成綁定'
      };
    }

    var id = ldText_(documentId);
    if (!id) {
      return {
        success: false,
        code: 'INVALID_DOCUMENT_ID',
        message: '缺少 document_id'
      };
    }

    var sheet = ldEnsureContractDocumentsSheet_();
    var docs = lmSheetObjects_(sheet);
    var row = null;
    for (var i = 0; i < docs.length; i++) {
      if (ldText_(docs[i].document_id) === id) {
        row = docs[i];
        break;
      }
    }

    if (!row) {
      return {
        success: false,
        code: 'DOCUMENT_NOT_FOUND',
        message: '找不到文件紀錄'
      };
    }

    if (
      ldText_(row.landlord_line_user_id) !== landlordLineUserId &&
      ldText_(row.landlord_id) !== ldText_(landlord.landlord_id)
    ) {
      return {
        success: false,
        code: 'NOT_AUTHORIZED',
        message: '無權限存取此文件'
      };
    }

    var driveFileId = ldText_(row.drive_file_id);
    if (!driveFileId) {
      return {
        success: false,
        code: 'DOCUMENT_FILE_NOT_FOUND',
        message: '找不到對應檔案'
      };
    }

    var file = DriveApp.getFileById(driveFileId);
    var blob = file.getBlob();
    var bytes = blob.getBytes();

    if (!bytes || bytes.length <= 0) {
      return {
        success: false,
        code: 'DOCUMENT_FILE_EMPTY',
        message: '下載檔案為空'
      };
    }

    lmLogAccess_({
      lineUserId: landlordLineUserId,
      userId: landlord.landlord_user_id || '',
      role: 'landlord',
      action: action,
      targetId: id,
      result: 'success',
      errorMessage: '',
      notes: 'document_type=' + ldText_(row.document_type)
    });

    return {
      success: true,
      code: 'OK',
      message: '下載成功',
      data: {
        document: {
          document_id: ldText_(row.document_id),
          contract_id: ldText_(row.contract_id),
          tenant_id: ldText_(row.tenant_id),
          document_type: ldText_(row.document_type),
          file_name: ldText_(row.file_name),
          mime_type: ldText_(row.mime_type),
          byte_size: Number(row.byte_size || 0),
          created_at: ldText_(row.created_at),
          base64: Utilities.base64Encode(bytes)
        }
      }
    };
  } catch (error) {
    lmLogAccess_({
      lineUserId: landlordLineUserId || '',
      userId: '',
      role: 'landlord',
      action: action,
      targetId: ldText_(documentId),
      result: 'failed',
      errorMessage: error.message,
      notes: 'download error'
    });

    return {
      success: false,
      code: 'SYSTEM_ERROR',
      message: '系統錯誤：' + error.message
    };
  }
}

function ldGetLandlordContracts_(landlord, contractIdFilter) {
  var landlordId = ldText_(landlord.landlord_id);
  var sheet = runtimeSpreadsheet_().getSheetByName('V2_contracts');

  if (!sheet) {
    return [];
  }

  return lmSheetObjects_(sheet)
    .filter(function (row) {
      if (!row) {
        return false;
      }

      var rowLandlordId = ldText_(row.landlord_id || row.owner_landlord_id);
      if (!rowLandlordId || rowLandlordId !== landlordId) {
        return false;
      }

      if (contractIdFilter && ldText_(row.contract_id) !== contractIdFilter) {
        return false;
      }

      return true;
    })
    .map(function (row) {
      return {
        contract_id: ldText_(row.contract_id),
        tenant_id: ldText_(row.tenant_id),
        tenant_name: ldText_(row.tenant_name),
        room_id: ldText_(row.room_id),
        room_name: ldText_(row.room_name || row.room_name_text),
        contract_status: ldText_(row.contract_status),
        contract_start: ldText_(row.start_date || row.contract_start),
        contract_end: ldText_(row.end_date || row.contract_end),
        rent_amount: Number(row.rent_amount || 0),
        management_fee: Number(row.management_fee || 0),
        created_at: ldText_(row.created_at || row.created_time || '')
      };
    });
}

function ldGetContractDocuments_(landlord, contractIdFilter, tenantIdFilter) {
  var sheet = ldEnsureContractDocumentsSheet_();
  var rows = lmSheetObjects_(sheet);
  var landlordId = ldText_(landlord.landlord_id);

  return rows
    .filter(function (row) {
      if (!row) {
        return false;
      }

      if (ldText_(row.landlord_id) !== landlordId) {
        return false;
      }

      if (contractIdFilter && ldText_(row.contract_id) !== contractIdFilter) {
        return false;
      }

      if (tenantIdFilter && ldText_(row.tenant_id) !== tenantIdFilter) {
        return false;
      }

      return true;
    })
    .map(function (row) {
      return {
        document_id: ldText_(row.document_id),
        contract_id: ldText_(row.contract_id),
        tenant_id: ldText_(row.tenant_id),
        document_type: ldText_(row.document_type),
        file_name: ldText_(row.file_name),
        mime_type: ldText_(row.mime_type),
        byte_size: Number(row.byte_size || 0),
        created_at: ldText_(row.created_at || ''),
        status: ldText_(row.status || 'stored'),
        note: ldText_(row.note),
        document_origin: ldText_(row.document_origin || 'uploaded'),
        source_document_id: ldText_(row.source_document_id)
      };
    });
}

function carryForwardLandlordContractDocumentsByLineUid_(
  landlordLineUserId,
  sourceContractId,
  targetContractId
) {
  var landlord = lmResolveLandlord_(landlordLineUserId);
  if (!landlord) {
    return {
      success: false,
      code: 'LANDLORD_NOT_FOUND',
      message: '查無房東資料或尚未完成綁定'
    };
  }

  var sourceId = ldText_(sourceContractId);
  var targetId = ldText_(targetContractId);
  if (!sourceId || !targetId || sourceId === targetId) {
    return {
      success: false,
      code: 'DOCUMENT_REFERENCE_INVALID',
      message: '合約文件引用來源或目標無效'
    };
  }

  var contractSheet = runtimeSpreadsheet_().getSheetByName('V2_contracts');
  var contractRows = contractSheet ? lmSheetObjects_(contractSheet) : [];
  var sourceContract = contractRows.find(function (row) {
    return ldText_(row.contract_id) === sourceId &&
      ldText_(row.landlord_id) === ldText_(landlord.landlord_id);
  });
  var targetContract = contractRows.find(function (row) {
    return ldText_(row.contract_id) === targetId &&
      ldText_(row.landlord_id) === ldText_(landlord.landlord_id);
  });
  if (!sourceContract || !targetContract ||
      ldText_(sourceContract.workspace_id) !== ldText_(landlord.workspace_id) ||
      ldText_(targetContract.workspace_id) !== ldText_(landlord.workspace_id) ||
      ldText_(sourceContract.tenant_id) !== ldText_(targetContract.tenant_id)) {
    return {
      success: false,
      code: 'DOCUMENT_REFERENCE_NOT_AUTHORIZED',
      message: '合約文件來源與目標不屬於同一房客與 Workspace'
    };
  }

  var sheet = ldEnsureContractDocumentsSheet_();
  var rows = lmSheetObjects_(sheet);
  var landlordId = ldText_(landlord.landlord_id);
  var sourceRows = rows.filter(function (row) {
    return ldText_(row.landlord_id) === landlordId &&
      ldText_(row.contract_id) === sourceId &&
      ['identity_front', 'identity_back', 'selfie'].indexOf(ldText_(row.document_type)) >= 0 &&
      ldText_(row.status || 'stored') === 'stored';
  });
  var headers = ldGetHeaders_(sheet);
  var created = [];
  var seenTypes = {};
  sourceRows.forEach(function (source) {
    var type = ldText_(source.document_type);
    if (seenTypes[type]) return;
    seenTypes[type] = true;
    var reference = {
      document_id: Utilities.getUuid(),
      workspace_id: ldText_(landlord.workspace_id),
      landlord_id: landlordId,
      landlord_line_user_id: landlordLineUserId,
      tenant_id: ldText_(source.tenant_id),
      contract_id: targetId,
      document_type: type,
      file_name: ldText_(source.file_name),
      mime_type: ldText_(source.mime_type),
      byte_size: Number(source.byte_size || 0),
      sha256: ldText_(source.sha256),
      idempotency_key: 'carried-forward:' + ldText_(source.document_id) + ':' + targetId,
      drive_file_id: ldText_(source.drive_file_id),
      status: 'stored',
      created_at: new Date().toISOString(),
      created_by_user_id: ldText_(landlord.landlord_user_id || ''),
      note: '沿用前一版本文件；來源文件：' + ldText_(source.document_id),
      document_origin: 'carried_forward',
      source_document_id: ldText_(source.document_id)
    };
    sheet.appendRow(headers.map(function (header) {
      return reference[header] === undefined ? '' : reference[header];
    }));
    created.push({
      document_id: reference.document_id,
      document_type: type,
      source_document_id: reference.source_document_id,
      drive_file_id: reference.drive_file_id
    });
  });

  return {
    success: true,
    code: 'OK',
    data: {
      source_contract_id: sourceId,
      target_contract_id: targetId,
      documents: created
    }
  };
}

function ldGetOwnedContractById_(landlord, contractId) {
  var landlordId = ldText_(landlord.landlord_id);
  var sheet = runtimeSpreadsheet_().getSheetByName('V2_contracts');

  if (!sheet) {
    return null;
  }

  var rows = lmSheetObjects_(sheet);

  for (var i = 0; i < rows.length; i++) {
    if (
      ldText_(rows[i].contract_id) === contractId &&
      ldText_(rows[i].landlord_id || rows[i].owner_landlord_id) === landlordId
    ) {
      return rows[i];
    }
  }

  return null;
}

function ldFindDocumentByIdempotency_(
  sheet,
  landlordId,
  contractId,
  tenantId,
  documentType,
  idempotencyKey
) {
  var rows = lmSheetObjects_(sheet);

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];

    if (ldText_(row.landlord_id) !== landlordId) {
      continue;
    }

    if (ldText_(row.idempotency_key) !== idempotencyKey) {
      continue;
    }

    if (contractId && ldText_(row.contract_id) !== contractId) {
      continue;
    }

    if (tenantId && ldText_(row.tenant_id) !== tenantId) {
      continue;
    }

    if (ldText_(row.document_type) !== documentType) {
      continue;
    }

    return row;
  }

  return null;
}

function ldEnsureContractDocumentsSheet_() {
  var ss = runtimeSpreadsheet_();
  var sheet = ss.getSheetByName(LD_CONTRACT_DOCUMENTS_SHEET_);

  if (!sheet) {
    sheet = ss.insertSheet(LD_CONTRACT_DOCUMENTS_SHEET_);
    sheet
      .getRange(1, 1, 1, LD_CONTRACT_DOCUMENT_HEADERS_.length)
      .setValues([LD_CONTRACT_DOCUMENT_HEADERS_]);
    return sheet;
  }

  var existingHeaders = sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getDisplayValues()[0]
    .map(ldText_);

  LD_CONTRACT_DOCUMENT_HEADERS_.forEach(function (header) {
    if (existingHeaders.indexOf(header) === -1) {
      sheet
        .getRange(1, sheet.getLastColumn() + 1)
        .setValue(header);
      existingHeaders.push(header);
    }
  });

  return sheet;
}

function ldGetHeaders_(sheet) {
  return sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0]
    .map(ldText_);
}

function ldGetContractDocumentFolder_() {
  try {
    var folderId = PropertiesService
      .getScriptProperties()
      .getProperty(LD_CONTRACT_DOCUMENTS_ROOT_FOLDER_PROPERTY_);

    if (!folderId) {
      return {
        success: false,
        code: 'CONTRACT_DOCUMENT_DRIVE_ROOT_NOT_CONFIGURED',
        message: '尚未設定文件根目錄設定值'
      };
    }

    var folder = DriveApp.getFolderById(folderId);
    return {
      success: true,
      data: folder
    };
  } catch (_) {
    return {
      success: false,
      code: 'CONTRACT_DOCUMENT_DRIVE_ROOT_INVALID',
      message: '文件根目錄設定值無法存取'
    };
  }
}

function ldContractDocumentSort_(a, b) {
  return ldDateNumber_(b.created_at) - ldDateNumber_(a.created_at);
}

function ldComputeSha256Hex_(bytes) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    bytes
  )
    .map(function (item) {
      var b = item;
      if (b < 0) {
        b += 256;
      }

      return ('0' + b.toString(16)).slice(-2);
    })
    .join('');
}

function ldText_(value) {
  return value === null || value === undefined
    ? ''
    : String(value).trim();
}

function ldDateNumber_(value) {
  var time = new Date(value).getTime();
  return isNaN(time) ? 0 : time;
}

function testEnsureLandlordContractDocumentsSheet_() {
  var sheet = ldEnsureContractDocumentsSheet_();
  return {
    success: true,
    sheet: sheet.getName(),
    headers: ldGetHeaders_(sheet)
  };
}
