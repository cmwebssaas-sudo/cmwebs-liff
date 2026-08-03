// ==================================================
// CMWebs V2 Legacy Signed Contract Sync
// Make Scenario B signed-contract bridge (POST only)
// ==================================================

const V2_LEGACY_SIGNED_CONTRACT_SYNC_ACTION_ =
  'legacy_contract_signed_sync';

const V2_LEGACY_SIGNED_CONTRACT_SYNC_SECRET_PROPERTY_ =
  'CMWEBS_LEGACY_CONTRACT_SYNC_HMAC_SECRET';

const V2_LEGACY_SIGNED_CONTRACT_SYNC_MAX_AGE_SECONDS_ =
  300;

const V2_LEGACY_SIGNED_CONTRACT_SYNC_LEGACY_SHEET_ =
  '5.新租客合約資料';

const V2_LEGACY_SIGNED_CONTRACT_SYNC_CONTRACTS_SHEET_ =
  'V2_contracts';

const V2_LEGACY_SIGNED_CONTRACT_SYNC_FIELDS_ = [
  'legacy_contract_id',
  'legacy_signed_at',
  'legacy_signed_status',
  'legacy_signed_document_url',
  'legacy_signed_pdf_url',
  'legacy_identity_front_url',
  'legacy_identity_back_url',
  'legacy_signed_sync_at'
];


/**
 * doPost() uses this discriminator before handing the body to the LINE
 * webhook. The signature is intentionally outside the JSON body so the raw
 * body received by Apps Script is exactly the body covered by HMAC.
 */
function legacyContractSignedSyncIsRequest_(postBody) {
  try {
    const payload = JSON.parse(String(postBody || ''));
    return legacyContractSignedSyncText_(payload.action) ===
      V2_LEGACY_SIGNED_CONTRACT_SYNC_ACTION_;
  } catch (error) {
    return false;
  }
}


function handleLegacyContractSignedSyncPost_(postBody, signature) {
  let payload = null;

  try {
    payload = JSON.parse(String(postBody || ''));
  } catch (error) {
    return legacyContractSignedSyncResult_(
      false,
      'INVALID_JSON',
      '同步資料不是有效 JSON'
    );
  }

  if (
    legacyContractSignedSyncText_(payload.action) !==
    V2_LEGACY_SIGNED_CONTRACT_SYNC_ACTION_
  ) {
    return legacyContractSignedSyncResult_(
      false,
      'INVALID_ACTION',
      '不支援的同步動作'
    );
  }

  const authentication =
    legacyContractSignedSyncVerifyRequest_(
      postBody,
      payload,
      signature
    );

  if (!authentication.success) {
    return authentication;
  }

  return syncLegacySignedContractToV2_(payload);
}


/**
 * Synchronize only a completed V1 contract into an already-existing V2
 * contract. Payload identity and tenancy fields are never accepted.
 */
function syncLegacySignedContractToV2_(payload) {
  const validation =
    legacyContractSignedSyncValidatePayload_(payload);

  if (!validation.success) {
    return validation;
  }

  let lock = null;

  try {
    lock = LockService.getScriptLock();
    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const legacySheet = ss.getSheetByName(
      V2_LEGACY_SIGNED_CONTRACT_SYNC_LEGACY_SHEET_
    );
    const contractsSheet = ss.getSheetByName(
      V2_LEGACY_SIGNED_CONTRACT_SYNC_CONTRACTS_SHEET_
    );

    if (!legacySheet) {
      return legacyContractSignedSyncResult_(
        false,
        'LEGACY_CONTRACT_SHEET_NOT_FOUND',
        '找不到既有合約資料表'
      );
    }

    if (!contractsSheet) {
      return legacyContractSignedSyncResult_(
        false,
        'V2_CONTRACT_SHEET_NOT_FOUND',
        '找不到 V2 合約資料表'
      );
    }

    const legacyContract =
      legacyContractSignedSyncFindLegacyContract_(
        legacySheet,
        validation.data.payload.contract_id
      );

    if (!legacyContract) {
      return legacyContractSignedSyncResult_(
        false,
        'LEGACY_CONTRACT_NOT_FOUND',
        '查無對應的既有合約'
      );
    }

    const legacyLandlordId =
      legacyContractSignedSyncText_(
        legacyContract.landlord_id
      );
    const legacyTenantLineUid =
      legacyContractSignedSyncFirstValue_(
        legacyContract,
        [
          'tenant_line_uid',
          'uid'
        ]
      );

    if (!legacyLandlordId || !legacyTenantLineUid) {
      return legacyContractSignedSyncResult_(
        false,
        'LEGACY_CONTRACT_IDENTITY_INCOMPLETE',
        '既有合約缺少房東或房客身份資料'
      );
    }

    if (
      legacyTenantLineUid !==
      validation.data.payload.tenant_line_uid
    ) {
      return legacyContractSignedSyncResult_(
        false,
        'TENANT_LINE_UID_MISMATCH',
        '房客 LINE 身份與既有合約不符'
      );
    }

    const schema =
      legacyContractSignedSyncRequireContractHeaders_(
        contractsSheet
      );

    if (!schema.success) {
      return schema;
    }

    const v2Contract =
      legacyContractSignedSyncFindV2Contract_(
        contractsSheet,
        validation.data.payload.contract_id
      );

    if (!v2Contract) {
      return legacyContractSignedSyncResult_(
        false,
        'V2_CONTRACT_NOT_FOUND',
        '查無對應的 V2 合約；同步不會建立新合約'
      );
    }

    const contractLandlordId =
      legacyContractSignedSyncText_(
        v2Contract.landlord_id
      );
    const contractTenantLineUid =
      legacyContractSignedSyncText_(
        v2Contract.tenant_line_user_id
      );
    const contractLandlordLineUid =
      legacyContractSignedSyncText_(
        v2Contract.landlord_line_user_id
      );
    const contractWorkspaceId =
      legacyContractSignedSyncText_(
        v2Contract.workspace_id
      ).toUpperCase();

    if (
      !contractLandlordId ||
      !contractTenantLineUid ||
      !contractLandlordLineUid ||
      !contractWorkspaceId
    ) {
      return legacyContractSignedSyncResult_(
        false,
        'V2_CONTRACT_CONTEXT_INCOMPLETE',
        'V2 合約缺少 Workspace 或身份關聯'
      );
    }

    if (contractLandlordId !== legacyLandlordId) {
      return legacyContractSignedSyncResult_(
        false,
        'LANDLORD_MISMATCH',
        '既有合約與 V2 合約的房東不符'
      );
    }

    if (
      contractTenantLineUid !==
      validation.data.payload.tenant_line_uid
    ) {
      return legacyContractSignedSyncResult_(
        false,
        'V2_TENANT_LINE_UID_MISMATCH',
        '房客 LINE 身份與 V2 合約不符'
      );
    }

    const access =
      workspaceLandlordResolveAccess_(
        contractLandlordLineUid,
        {
          require_onboarding: true,
          skip_schema_ensure: true,
          skip_legacy_context_creation: true
        }
      );

    if (!access || access.success !== true) {
      return access || legacyContractSignedSyncResult_(
        false,
        'WORKSPACE_ACCESS_DENIED',
        '無法驗證合約 Workspace 存取權'
      );
    }

    const permission =
      workspaceLandlordCheckPolicy_(
        access,
        'contract_write'
      );

    if (!permission || permission.success !== true) {
      return permission || legacyContractSignedSyncResult_(
        false,
        'PERMISSION_DENIED',
        '目前 Workspace 沒有合約寫入權限'
      );
    }

    const accessWorkspaceId =
      legacyContractSignedSyncText_(
        access.workspace && access.workspace.workspace_id
      ).toUpperCase();
    const accessLandlordId =
      legacyContractSignedSyncText_(
        access.principal_landlord_id
      );

    if (
      accessWorkspaceId !== contractWorkspaceId ||
      accessLandlordId !== contractLandlordId
    ) {
      return legacyContractSignedSyncResult_(
        false,
        'WORKSPACE_MISMATCH',
        'V2 合約不屬於已驗證的 Workspace'
      );
    }

    const syncRecord =
      legacyContractSignedSyncBuildRecord_(
        validation.data.payload
      );

    if (
      legacyContractSignedSyncIsAlreadyApplied_(
        v2Contract,
        syncRecord
      )
    ) {
      return legacyContractSignedSyncResult_(
        true,
        'OK',
        '合約簽署資料已同步',
        {
          contract_id: validation.data.payload.contract_id,
          idempotent: true
        }
      );
    }

    if (
      legacyContractSignedSyncHasExistingMetadata_(
        v2Contract
      )
    ) {
      return legacyContractSignedSyncResult_(
        false,
        'LEGACY_SYNC_CONFLICT',
        '此合約已有不同的已簽署資料，拒絕覆寫'
      );
    }

    legacyContractSignedSyncUpdateObjectRow_(
      contractsSheet,
      v2Contract.__row_number,
      syncRecord
    );

    return legacyContractSignedSyncResult_(
      true,
      'OK',
      '合約簽署資料同步完成',
      {
        contract_id: validation.data.payload.contract_id,
        idempotent: false
      }
    );

  } catch (error) {
    return legacyContractSignedSyncResult_(
      false,
      'LEGACY_CONTRACT_SYNC_ERROR',
      '合約簽署同步處理失敗'
    );
  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (releaseError) {
        // Ignore a best-effort lock release failure.
      }
    }
  }
}


function legacyContractSignedSyncVerifyRequest_(
  postBody,
  payload,
  signature
) {
  const timestamp = Number(payload.timestamp);
  const now = legacyContractSignedSyncNowEpochSeconds_();

  if (
    !Number.isInteger(timestamp) ||
    timestamp <= 0 ||
    Math.abs(now - timestamp) >
      V2_LEGACY_SIGNED_CONTRACT_SYNC_MAX_AGE_SECONDS_
  ) {
    return legacyContractSignedSyncResult_(
      false,
      'EXPIRED_TIMESTAMP',
      '同步請求時間已過期或格式不正確'
    );
  }

  const secret = PropertiesService
    .getScriptProperties()
    .getProperty(
      V2_LEGACY_SIGNED_CONTRACT_SYNC_SECRET_PROPERTY_
    );

  if (!secret) {
    return legacyContractSignedSyncResult_(
      false,
      'SYNC_SECRET_NOT_CONFIGURED',
      '尚未設定同步驗證密鑰'
    );
  }

  const expected =
    legacyContractSignedSyncComputeHmacHex_(
      postBody,
      secret
    );

  if (
    !legacyContractSignedSyncConstantTimeEquals_(
      expected,
      legacyContractSignedSyncText_(signature)
        .toLowerCase()
    )
  ) {
    return legacyContractSignedSyncResult_(
      false,
      'INVALID_SIGNATURE',
      '同步請求簽章不正確'
    );
  }

  return legacyContractSignedSyncResult_(
    true,
    'OK',
    '驗證成功'
  );
}


function legacyContractSignedSyncValidatePayload_(payload) {
  const normalized = {
    contract_id:
      legacyContractSignedSyncText_(
        payload.contract_id
      ),
    tenant_line_uid:
      legacyContractSignedSyncText_(
        payload.tenant_line_uid
      ),
    signed_at:
      legacyContractSignedSyncText_(
        payload.signed_at
      ),
    signed_document_url:
      legacyContractSignedSyncText_(
        payload.signed_document_url
      ),
    signed_pdf_url:
      legacyContractSignedSyncText_(
        payload.signed_pdf_url
      ),
    identity_front_url:
      legacyContractSignedSyncText_(
        payload.identity_front_url
      ),
    identity_back_url:
      legacyContractSignedSyncText_(
        payload.identity_back_url
      )
  };

  const required = Object.keys(normalized);

  for (let index = 0; index < required.length; index++) {
    if (!normalized[required[index]]) {
      return legacyContractSignedSyncResult_(
        false,
        'MISSING_SYNC_FIELD',
        '缺少必要同步欄位：' + required[index]
      );
    }
  }

  const urls = [
    'signed_document_url',
    'signed_pdf_url',
    'identity_front_url',
    'identity_back_url'
  ];

  for (let index = 0; index < urls.length; index++) {
    if (!legacyContractSignedSyncIsApprovedGoogleUrl_(normalized[urls[index]])) {
      return legacyContractSignedSyncResult_(
        false,
        'INVALID_SYNC_URL',
        '同步檔案網址必須為 Google Docs 或 Google Drive HTTPS 網址'
      );
    }
  }

  return legacyContractSignedSyncResult_(
    true,
    'OK',
    '資料格式正確',
    {
      payload: normalized
    }
  );
}


function legacyContractSignedSyncBuildRecord_(payload) {
  return {
    legacy_contract_id: payload.contract_id,
    signed_at: payload.signed_at,
    contract_status: 'signed',
    status: 'signed',
    legacy_signed_at: payload.signed_at,
    legacy_signed_status: 'signed',
    legacy_signed_document_url: payload.signed_document_url,
    legacy_signed_pdf_url: payload.signed_pdf_url,
    legacy_identity_front_url: payload.identity_front_url,
    legacy_identity_back_url: payload.identity_back_url,
    legacy_signed_sync_at:
      legacyContractSignedSyncNowIso_(),
    updated_at:
      legacyContractSignedSyncNowIso_()
  };
}


function legacyContractSignedSyncFindLegacyContract_(
  sheet,
  contractId
) {
  const matches = legacyContractSignedSyncGetObjects_(sheet)
    .filter(function (row) {
      return legacyContractSignedSyncText_(
        row.contract_id
      ) === contractId;
    });

  return matches.length === 1
    ? matches[0]
    : null;
}


function legacyContractSignedSyncFindV2Contract_(
  sheet,
  contractId
) {
  const matches = legacyContractSignedSyncGetObjects_(sheet)
    .filter(function (row) {
      return (
        legacyContractSignedSyncText_(
          row.contract_id
        ) === contractId ||
        legacyContractSignedSyncText_(
          row.legacy_contract_id
        ) === contractId
      );
    });

  return matches.length === 1
    ? matches[0]
    : null;
}


function legacyContractSignedSyncRequireContractHeaders_(sheet) {
  const headers = legacyContractSignedSyncHeaders_(sheet);
  const missing = V2_LEGACY_SIGNED_CONTRACT_SYNC_FIELDS_
    .filter(function (header) {
      return headers.indexOf(header) === -1;
    });

  if (missing.length > 0) {
    return legacyContractSignedSyncResult_(
      false,
      'V2_CONTRACT_SYNC_SCHEMA_NOT_READY',
      'V2 合約同步欄位尚未就緒',
      {
        missing_fields: missing
      }
    );
  }

  return legacyContractSignedSyncResult_(
    true,
    'OK',
    'V2 合約同步欄位已就緒'
  );
}


function legacyContractSignedSyncUpdateObjectRow_(
  sheet,
  rowNumber,
  record
) {
  const headers = legacyContractSignedSyncHeaders_(sheet);
  const existing = sheet.getRange(
    rowNumber,
    1,
    1,
    headers.length
  ).getValues()[0];

  const row = headers.map(function (header, index) {
    return record[header] !== undefined
      ? record[header]
      : existing[index];
  });

  sheet.getRange(
    rowNumber,
    1,
    1,
    row.length
  ).setValues([row]);
}


function legacyContractSignedSyncGetObjects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) {
    return [];
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(legacyContractSignedSyncText_);

  return values.slice(1).map(function (row, index) {
    const object = {
      __row_number: index + 2
    };

    headers.forEach(function (header, column) {
      if (header) {
        object[header] = row[column];
      }
    });

    return object;
  });
}


function legacyContractSignedSyncHeaders_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) {
    return [];
  }

  return sheet.getRange(
    1,
    1,
    1,
    sheet.getLastColumn()
  ).getValues()[0].map(legacyContractSignedSyncText_);
}


function legacyContractSignedSyncIsAlreadyApplied_(
  contract,
  record
) {
  return V2_LEGACY_SIGNED_CONTRACT_SYNC_FIELDS_
    .every(function (field) {
      if (field === 'legacy_signed_sync_at') {
        return true;
      }

      return legacyContractSignedSyncText_(contract[field]) ===
        legacyContractSignedSyncText_(record[field]);
    }) &&
    legacyContractSignedSyncText_(contract.contract_status) ===
      'signed' &&
    legacyContractSignedSyncText_(contract.status) ===
      'signed' &&
    legacyContractSignedSyncText_(contract.signed_at) ===
      legacyContractSignedSyncText_(record.signed_at);
}


function legacyContractSignedSyncHasExistingMetadata_(contract) {
  return V2_LEGACY_SIGNED_CONTRACT_SYNC_FIELDS_
    .some(function (field) {
      return legacyContractSignedSyncText_(contract[field]);
    });
}


function legacyContractSignedSyncComputeHmacHex_(body, secret) {
  const bytes = Utilities.computeHmacSha256Signature(
    String(body || ''),
    String(secret || '')
  );

  return bytes.map(function (value) {
    const normalized = value < 0
      ? value + 256
      : value;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');
}


function legacyContractSignedSyncConstantTimeEquals_(left, right) {
  left = String(left || '');
  right = String(right || '');

  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index++) {
    difference |=
      (left.charCodeAt(index) || 0) ^
      (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}


function legacyContractSignedSyncFirstValue_(object, keys) {
  for (let index = 0; index < keys.length; index++) {
    const value = legacyContractSignedSyncText_(
      object && object[keys[index]]
    );
    if (value) {
      return value;
    }
  }

  return '';
}


function legacyContractSignedSyncIsApprovedGoogleUrl_(value) {
  return /^https:\/\/(?:drive|docs)\.google\.com\//i.test(
    legacyContractSignedSyncText_(value)
  );
}


function legacyContractSignedSyncNowEpochSeconds_() {
  return Math.floor(new Date().getTime() / 1000);
}


function legacyContractSignedSyncNowIso_() {
  return Utilities.formatDate(
    new Date(),
    'Asia/Taipei',
    "yyyy-MM-dd'T'HH:mm:ssXXX"
  );
}


function legacyContractSignedSyncText_(value) {
  return value === undefined || value === null
    ? ''
    : String(value).trim();
}


function legacyContractSignedSyncResult_(
  success,
  code,
  message,
  data
) {
  return {
    success: success === true,
    code: code,
    message: message,
    data: data || {}
  };
}
