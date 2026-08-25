// Native Google Docs contract signing output.
// The configured document is a fixed template. It is always copied before any
// tenant data or signature is written; the original template remains untouched.
const V2_CONTRACT_DOCUMENT_TEMPLATE_PROPERTY_ =
  'CMWEBS_CONTRACT_TEMPLATE_DOCUMENT_ID';
const V2_CONTRACT_DOCUMENT_ROOT_PROPERTY_ =
  'CMWEBS_CONTRACT_SIGNING_DRIVE_ROOT_FOLDER_ID';
const V2_CONTRACT_DOCUMENT_SHEET_ =
  'V2_contract_signing_documents';
const V2_CONTRACT_DOCUMENT_HEADERS_ = [
  'document_record_id',
  'workspace_id',
  'tenant_id',
  'contract_id',
  'template_file_id',
  'signed_file_id',
  'signature_artifact_id',
  'status',
  'created_at',
  'updated_at',
  'signed_at'
];

function tenantContractDocumentText_(value) {
  return value === null || value === undefined
    ? ''
    : String(value).trim();
}

function tenantContractDocumentFirst_(row, names) {
  row = row || {};
  for (var index = 0; index < names.length; index += 1) {
    var value = tenantContractDocumentText_(row[names[index]]);
    if (value) return value;
  }
  return '';
}

function tenantContractDocumentReplacePlaceholders_(text, fields) {
  var result = String(text || '');
  Object.keys(fields || {}).forEach(function (key) {
    var value = fields[key] === null || fields[key] === undefined
      ? ''
      : String(fields[key]);
    result = result.split('{{' + key + '}}').join(value);
  });
  return result;
}

function tenantContractDocumentBuildPreviewText_(
  templateText,
  contract,
  tenant,
  now,
  context
) {
  contract = contract || {};
  var signed = tenantContractDocumentIsSubmitted_(contract);
  var signedAt = contract.tenant_signed_at ||
    contract.tenant_signing_submitted_at ||
    now ||
    new Date();
  var fields = tenantContractDocumentFields_(
    contract || {},
    tenant || {},
    context || {},
    signedAt
  );
  if (!signed) {
    fields.簽約時間 = '待完成';
    fields.簽約年 = '—';
    fields.簽約月 = '—';
    fields.簽約日 = '—';
  }
  var content = tenantContractDocumentReplacePlaceholders_(
    templateText,
    fields
  ).replace(/\{\{[^{}]+\}\}/g, '—');
  return signed
    ? tenantContractDocumentSignedEvidenceText_(content)
    : tenantContractDocumentPendingEvidenceText_(content);
}

function tenantContractDocumentIsSubmitted_(contract) {
  contract = contract || {};
  var status = tenantContractDocumentText_(
    contract.tenant_signing_submission_status
  ).toLowerCase();
  return ['submitted', 'approved'].indexOf(status) >= 0 ||
    Boolean(tenantContractDocumentText_(contract.tenant_signed_at));
}

function tenantContractDocumentSignedEvidenceText_(text) {
  return String(text || '')
    .split('簽署狀態：待房客完成線上簽署。')
    .join('簽署狀態：✅ 本合約已由承租人透過 CMWebs線上租管系統完成實名證件上傳，並勾選同意租賃條款。')
    .split('簽署狀態：待承租人簽署。')
    .join('簽署狀態：✅ 本合約已由承租人透過 CMWebs線上租管系統完成實名證件上傳，並勾選同意租賃條款。')
    .split('數位軌跡：簽署完成後由系統綁定承租人專屬 LINE UID 備查。')
    .join('數位軌跡：系統已綁定承租人專屬 LINE UID 備查。')
    .split('數位軌跡：系統於房客完成簽署後記錄。')
    .join('數位軌跡：系統已綁定承租人專屬 LINE UID 備查。')
    .replace(
      /乙方簽名（線上簽署）：[＿_－—\-\s]+（待簽署）/g,
      '乙方簽名（線上簽署）：✅ 親筆簽名圖片已回寫至簽署版 Google 文件'
    );
}

function tenantContractDocumentPendingEvidenceText_(text) {
  return String(text || '')
    .split('簽署狀態：✅ 本合約已由承租人透過 CMWebs線上租管系統完成實名證件上傳，並勾選同意租賃條款。')
    .join('簽署狀態：待房客完成線上簽署。')
    .split('數位軌跡：系統已綁定承租人專屬 LINE UID 備查。')
    .join('數位軌跡：簽署完成後由系統綁定承租人專屬 LINE UID 備查。');
}

function tenantContractDocumentSignatureImage_(contract, tenant) {
  contract = contract || {};
  tenant = tenant || {};
  if (!tenantContractDocumentIsSubmitted_(contract)) return null;

  var artifactId = tenantContractDocumentText_(
    contract.tenant_signature_artifact_id
  );
  if (!artifactId) return null;

  var workspaceId = tenantContractDocumentText_(contract.workspace_id);
  var tenantId = tenantContractDocumentFirst_(tenant, ['tenant_id']) ||
    tenantContractDocumentText_(contract.tenant_id);
  var contractId = tenantContractDocumentText_(contract.contract_id);
  if (!workspaceId || !tenantId || !contractId) return null;

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName('V2_contract_artifacts');
    var artifact = tenantContractDocumentRows_(sheet).find(function (row) {
      return tenantContractDocumentText_(row.artifact_id) === artifactId &&
        tenantContractDocumentText_(row.workspace_id) === workspaceId &&
        tenantContractDocumentText_(row.tenant_id) === tenantId &&
        tenantContractDocumentText_(row.contract_id) === contractId &&
        tenantContractDocumentText_(row.artifact_type) === 'signature' &&
        tenantContractDocumentText_(row.mime_type).toLowerCase() === 'image/png' &&
        tenantContractDocumentText_(row.status) === 'stored';
    });
    var driveFileId = artifact && tenantContractDocumentText_(artifact.drive_file_id);
    if (!driveFileId) return null;

    var blob = DriveApp.getFileById(driveFileId).getBlob();
    var mimeType = tenantContractDocumentText_(
      blob.getContentType() || artifact.mime_type
    ).toLowerCase();
    var bytes = blob.getBytes();
    if (
      mimeType !== 'image/png' ||
      !bytes ||
      !bytes.length ||
      bytes.length > 3 * 1024 * 1024
    ) {
      return null;
    }
    return {
      mime_type: 'image/png',
      base64: Utilities.base64Encode(bytes)
    };
  } catch (_) {
    return null;
  }
}

function tenantContractDocumentTemplateId_() {
  var id = tenantContractDocumentText_(
    PropertiesService.getScriptProperties().getProperty(
      V2_CONTRACT_DOCUMENT_TEMPLATE_PROPERTY_
    )
  );
  return /^[A-Za-z0-9_-]{20,}$/.test(id) ? id : '';
}

function tenantContractDocumentRootFolder_() {
  var id = tenantContractDocumentText_(
    PropertiesService.getScriptProperties().getProperty(
      V2_CONTRACT_DOCUMENT_ROOT_PROPERTY_
    )
  );
  if (!id) {
    return {
      success: false,
      code: 'CONTRACT_SIGNING_DRIVE_ROOT_NOT_CONFIGURED'
    };
  }
  try {
    return {
      success: true,
      data: DriveApp.getFolderById(id)
    };
  } catch (_) {
    return {
      success: false,
      code: 'CONTRACT_SIGNING_DRIVE_ROOT_UNAVAILABLE'
    };
  }
}

function tenantContractDocumentPreview_(contract, tenant) {
  var templateId = tenantContractDocumentTemplateId_();
  if (!templateId) {
    return {
      available: false,
      code: 'CONTRACT_TEMPLATE_NOT_CONFIGURED',
      message: '固定版型尚未設定，請聯絡房東確認。'
    };
  }
  try {
    var body = DocumentApp.openById(templateId).getBody();
    var context = tenantContractDocumentResolveContext_(
      SpreadsheetApp.getActiveSpreadsheet(),
      contract || {},
      tenant || {}
    );
    var previewTime = tenantContractDocumentIsSubmitted_(contract)
      ? contract.tenant_signed_at || contract.tenant_signing_submitted_at || new Date()
      : new Date();
    var content = tenantContractDocumentBuildPreviewText_(
      body.getText(),
      contract,
      tenant,
      previewTime,
      context
    );
    var signatureImage = tenantContractDocumentSignatureImage_(
      contract,
      tenant
    );
    return {
      available: true,
      source: 'fixed_google_doc_template',
      content: content,
      signature_image: signatureImage
    };
  } catch (_) {
    return {
      available: false,
      code: 'CONTRACT_TEMPLATE_UNAVAILABLE',
      message: '固定版型目前無法讀取，請聯絡房東確認。'
    };
  }
}

function tenantContractDocumentFields_(contract, tenant, context, now) {
  contract = contract || {};
  tenant = tenant || {};
  context = context || {};
  var property = context.property || {};
  var room = context.room || {};
  var landlord = context.landlord || {};
  var start = tenantContractDocumentDateParts_(
    tenantContractDocumentFirst_(contract, [
      'start_date',
      'contract_start_date',
      'lease_start_date'
    ])
  );
  var end = tenantContractDocumentDateParts_(
    tenantContractDocumentFirst_(contract, [
      'end_date',
      'contract_end_date',
      'lease_end_date'
    ])
  );
  var signed = tenantContractDocumentDateParts_(now || new Date());
  var rentAmount = tenantContractDocumentFirst_(contract, [
    'rent_amount',
    'monthly_rent',
    'rent'
  ]) || tenantContractDocumentFirst_(room, [
    'rent_amount',
    'monthly_rent',
    'rent'
  ]);
  var managementFee = tenantContractDocumentFirst_(contract, [
    'management_fee',
    'monthly_management_fee'
  ]) || tenantContractDocumentFirst_(room, [
    'management_fee',
    'monthly_management_fee'
  ]);
  var depositAmount = tenantContractDocumentFirst_(contract, [
    'deposit_amount',
    'deposit'
  ]) || tenantContractDocumentFirst_(room, [
    'deposit_amount',
    'deposit'
  ]);
  if (!depositAmount && rentAmount) {
    var depositMonths = Number(tenantContractDocumentFirst_(room, [
      'deposit_months',
      'default_deposit_months'
    ]) || 0);
    if (isFinite(depositMonths) && depositMonths > 0) {
      depositAmount = String(Number(rentAmount) * depositMonths);
    }
  }
  var tenantPhone = tenantContractDocumentFirst_(tenant, [
    'phone',
    'tenant_phone',
    'mobile'
  ]) || tenantContractDocumentFirst_(contract, [
    'tenant_phone',
    'phone',
    'mobile'
  ]);
  var tenantAddress = tenantContractDocumentFirst_(tenant, [
    'address',
    'tenant_address',
    'residential_address'
  ]) || tenantContractDocumentFirst_(contract, [
    'tenant_address',
    'address'
  ]);
  var landlordName = tenantContractDocumentFirst_(contract, [
    'landlord_name',
    'owner_name'
  ]) || tenantContractDocumentFirst_(landlord, [
    'landlord_name',
    'owner_name',
    'name'
  ]);
  var landlordPhone = tenantContractDocumentFirst_(contract, [
    'landlord_phone',
    'owner_phone'
  ]) || tenantContractDocumentFirst_(landlord, [
    'phone',
    'landlord_phone',
    'mobile'
  ]);
  var landlordAddress = tenantContractDocumentFirst_(contract, [
    'landlord_address',
    'owner_address'
  ]) || tenantContractDocumentFirst_(landlord, [
    'address',
    'landlord_address'
  ]);
  return {
    出租物件地址: tenantContractDocumentFirst_(contract, [
      'property_address',
      'address',
      'full_address'
    ]) || tenantContractDocumentFirst_(property, [
      'property_address',
      'address',
      'full_address'
    ]),
    房號: tenantContractDocumentFirst_(contract, [
      'room_name',
      'room_number',
      'room'
    ]) || tenantContractDocumentFirst_(room, [
      'room_name',
      'room_number',
      'name'
    ]),
    起租年: start.year,
    起租月: start.month,
    起租日: start.day,
    退租年: end.year,
    退租月: end.month,
    退租日: end.day,
    每月租金: rentAmount,
    每月管理費: managementFee,
    押金金額: depositAmount,
    違約金月數: tenantContractDocumentFirst_(contract, [
      'penalty_months',
      'breach_penalty_months'
    ]) || '1',
    甲方姓名: landlordName,
    甲方地址: landlordAddress,
    甲方電話: landlordPhone,
    乙方姓名: tenantContractDocumentFirst_(tenant, [
      'tenant_name',
      'name'
    ]) || tenantContractDocumentFirst_(contract, [
      'tenant_name'
    ]),
    乙方身分證字號: tenantContractDocumentFirst_(tenant, [
      'national_id',
      'id_number',
      'identity_number'
    ]) || tenantContractDocumentFirst_(contract, [
      'tenant_national_id',
      'national_id'
    ]),
    乙方地址: tenantAddress,
    乙方電話: tenantPhone,
    簽約時間: tenantContractDocumentFormatDateTime_(now || new Date()),
    保證人姓名: tenantContractDocumentFirst_(tenant, [
      'guarantor_name'
    ]) || tenantContractDocumentFirst_(contract, [
      'guarantor_name'
    ]),
    保證人電話: tenantContractDocumentFirst_(tenant, [
      'guarantor_phone'
    ]) || tenantContractDocumentFirst_(contract, [
      'guarantor_phone'
    ]),
    緊急聯絡人姓名: tenantContractDocumentFirst_(tenant, [
      'emergency_contact_name'
    ]) || tenantContractDocumentFirst_(contract, [
      'emergency_contact_name'
    ]),
    緊急聯絡人關係: tenantContractDocumentFirst_(tenant, [
      'emergency_contact_relationship',
      'emergency_contact_relation'
    ]) || tenantContractDocumentFirst_(contract, [
      'emergency_contact_relationship',
      'emergency_contact_relation'
    ]),
    緊急聯絡人電話: tenantContractDocumentFirst_(tenant, [
      'emergency_contact_phone'
    ]) || tenantContractDocumentFirst_(contract, [
      'emergency_contact_phone'
    ]),
    緊急聯絡人地址: tenantContractDocumentFirst_(tenant, [
      'emergency_contact_address'
    ]) || tenantContractDocumentFirst_(contract, [
      'emergency_contact_address'
    ]),
    簽約年: signed.year,
    簽約月: signed.month,
    簽約日: signed.day,
    備註: tenantContractDocumentFirst_(contract, [
      'note',
      'landlord_note'
    ])
  };
}

function tenantContractDocumentDateParts_(value) {
  var date = value instanceof Date ? value : new Date(value);
  if (!date || isNaN(date.getTime())) {
    return { year: '', month: '', day: '' };
  }
  return {
    year: Utilities.formatDate(date, 'Asia/Taipei', 'yyyy'),
    month: Utilities.formatDate(date, 'Asia/Taipei', 'M'),
    day: Utilities.formatDate(date, 'Asia/Taipei', 'd')
  };
}

function tenantContractDocumentFormatDateTime_(value) {
  var date = value instanceof Date ? value : new Date(value);
  if (!date || isNaN(date.getTime())) return '';
  return Utilities.formatDate(
    date,
    'Asia/Taipei',
    'yyyy/MM/dd HH:mm:ss'
  );
}

function tenantContractDocumentResolveContext_(ss, contract, tenant) {
  var result = {
    room: {},
    property: {},
    landlord: {}
  };
  var roomId = tenantContractDocumentFirst_(contract, [
    'room_id'
  ]);
  var propertyId = tenantContractDocumentFirst_(contract, [
    'property_id'
  ]);
  var landlordId = tenantContractDocumentFirst_(contract, [
    'landlord_id'
  ]);
  result.room = tenantContractDocumentFindRow_(
    ss.getSheetByName('V2_rooms'),
    'room_id',
    roomId
  );
  propertyId = propertyId || tenantContractDocumentFirst_(result.room, [
    'property_id'
  ]);
  result.property = tenantContractDocumentFindRow_(
    ss.getSheetByName('V2_properties'),
    'property_id',
    propertyId
  );
  result.landlord = tenantContractDocumentFindRow_(
    ss.getSheetByName('V2_landlords'),
    'landlord_id',
    landlordId
  );
  return result;
}

function tenantContractDocumentFindRow_(sheet, key, value) {
  if (!sheet || !value || sheet.getLastRow() < 2) return {};
  var values = sheet.getDataRange().getValues();
  var headers = values.shift().map(tenantContractDocumentText_);
  var keyIndex = headers.indexOf(key);
  if (keyIndex < 0) return {};
  for (var index = 0; index < values.length; index += 1) {
    if (tenantContractDocumentText_(values[index][keyIndex]) === value) {
      var row = {};
      headers.forEach(function (header, column) {
        row[header] = values[index][column];
      });
      return row;
    }
  }
  return {};
}

function tenantContractDocumentResolveTenant_(ss, claims, contract) {
  var tenant = tenantContractDocumentFindRow_(
    ss.getSheetByName('V2_tenants'),
    'tenant_id',
    tenantContractDocumentText_(claims.tenant_id)
  );
  if (Object.keys(tenant).length) return tenant;
  return {
    tenant_id: claims.tenant_id,
    tenant_name: contract.tenant_name || '',
    phone: contract.tenant_phone || ''
  };
}

function tenantContractDocumentEnsureSchema_(ss) {
  var sheet = ss.getSheetByName(V2_CONTRACT_DOCUMENT_SHEET_);
  if (!sheet) sheet = ss.insertSheet(V2_CONTRACT_DOCUMENT_SHEET_);
  var headers = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn())
      .getDisplayValues()[0]
      .map(tenantContractDocumentText_)
    : [];
  if (!headers.length) {
    sheet.getRange(1, 1, 1, V2_CONTRACT_DOCUMENT_HEADERS_.length)
      .setValues([V2_CONTRACT_DOCUMENT_HEADERS_]);
  } else {
    var missing = V2_CONTRACT_DOCUMENT_HEADERS_.filter(function (header) {
      return headers.indexOf(header) < 0;
    });
    if (missing.length) {
      sheet.getRange(1, headers.length + 1, 1, missing.length)
        .setValues([missing]);
    }
  }
  return sheet;
}

function tenantContractDocumentEnsureContractColumns_(sheet, required) {
  if (!sheet) return;
  var headers = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn())
      .getDisplayValues()[0]
      .map(tenantContractDocumentText_)
    : [];
  var missing = (required || []).filter(function (header) {
    return headers.indexOf(header) < 0;
  });
  if (missing.length) {
    sheet.getRange(1, headers.length + 1, 1, missing.length)
      .setValues([missing]);
  }
}

function migrateV2ContractDocumentSigningSchema_(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  tenantContractDocumentEnsureSchema_(ss);
  tenantContractDocumentEnsureContractColumns_(
    ss.getSheetByName('V2_contracts'),
    ['tenant_signed_document_record_id']
  );
  return {
    success: true,
    code: 'OK',
    data: {
      sheet_name: V2_CONTRACT_DOCUMENT_SHEET_,
      headers: V2_CONTRACT_DOCUMENT_HEADERS_.slice()
    }
  };
}

function tenantContractDocumentRows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getDataRange().getValues();
  var headers = values.shift().map(tenantContractDocumentText_);
  return values.map(function (row, index) {
    var result = { _sheet_row: index + 2 };
    headers.forEach(function (header, column) {
      result[header] = row[column];
    });
    return result;
  });
}

function tenantContractDocumentFindExisting_(sheet, contract, signatureArtifactId) {
  var contractId = tenantContractDocumentText_(contract.contract_id);
  var tenantId = tenantContractDocumentText_(contract.tenant_id);
  var workspaceId = tenantContractDocumentText_(contract.workspace_id);
  return tenantContractDocumentRows_(sheet).find(function (row) {
    return tenantContractDocumentText_(row.contract_id) === contractId &&
      tenantContractDocumentText_(row.tenant_id) === tenantId &&
      tenantContractDocumentText_(row.workspace_id) === workspaceId &&
      tenantContractDocumentText_(row.signature_artifact_id) === signatureArtifactId &&
      tenantContractDocumentText_(row.status) === 'signed';
  }) || null;
}

function tenantContractDocumentAppend_(sheet, record) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0]
    .map(tenantContractDocumentText_);
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length)
    .setValues([headers.map(function (header) {
      return record[header] === undefined ? '' : record[header];
    })]);
}

function tenantContractDocumentMaterialize_(
  contract,
  tenant,
  signatureArtifactId,
  signatureDriveFileId
) {
  contract = contract || {};
  tenant = tenant || {};
  signatureArtifactId = tenantContractDocumentText_(signatureArtifactId);
  signatureDriveFileId = tenantContractDocumentText_(signatureDriveFileId);
  if (!signatureArtifactId) {
    return {
      success: false,
      code: 'SIGNATURE_ARTIFACT_MISSING'
    };
  }
  if (!signatureDriveFileId) {
    return {
      success: false,
      code: 'SIGNATURE_ARTIFACT_MISSING'
    };
  }
  var templateId = tenantContractDocumentTemplateId_();
  if (!templateId) {
    return {
      success: false,
      code: 'CONTRACT_TEMPLATE_NOT_CONFIGURED'
    };
  }
  var root = tenantContractDocumentRootFolder_();
  if (!root.success) return root;
  var sheet = tenantContractDocumentEnsureSchema_(
    SpreadsheetApp.getActiveSpreadsheet()
  );
  var existing = tenantContractDocumentFindExisting_(
    sheet,
    contract,
    signatureArtifactId
  );
  if (existing) {
    return {
      success: true,
      code: 'IDEMPOTENT',
      data: {
        document_record_id: existing.document_record_id,
        signed_file_id: existing.signed_file_id,
        status: existing.status,
        idempotent: true
      }
    };
  }
  var copy = null;
  try {
    var templateFile = DriveApp.getFileById(templateId);
    copy = templateFile.makeCopy(
      'CMWebs 合約簽署版 - ' +
        tenantContractDocumentText_(contract.contract_id),
      root.data
    );
    copy.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    var document = DocumentApp.openById(copy.getId());
    var body = document.getBody();
    var context = tenantContractDocumentResolveContext_(
      SpreadsheetApp.getActiveSpreadsheet(),
      contract,
      tenant
    );
    var fields = tenantContractDocumentFields_(
      contract,
      tenant,
      context,
      new Date()
    );
    var editableText = body.editAsText();
    Object.keys(fields).forEach(function (key) {
      editableText.replaceText(
        tenantContractDocumentPlaceholderPattern_(key),
        tenantContractDocumentRegexReplacement_(fields[key])
      );
    });
    var editableEvidence = body.editAsText();
    [
      '簽署狀態：待房客完成線上簽署。',
      '簽署狀態：待承租人簽署。'
    ].forEach(function (pendingText) {
      editableEvidence.replaceText(
        tenantContractDocumentRegexLiteral_(pendingText),
        '簽署狀態：✅ 本合約已由承租人透過 CMWebs線上租管系統完成實名證件上傳，並勾選同意租賃條款。'
      );
    });
    [
      '數位軌跡：簽署完成後由系統綁定承租人專屬 LINE UID 備查。',
      '數位軌跡：系統於房客完成簽署後記錄。'
    ].forEach(function (pendingText) {
      editableEvidence.replaceText(
        tenantContractDocumentRegexLiteral_(pendingText),
        '數位軌跡：系統已綁定承租人專屬 LINE UID 備查。'
      );
    });
    var signatureFile = DriveApp.getFileById(signatureDriveFileId);
    if (!tenantContractDocumentReplaceSignature_(body, signatureFile.getBlob())) {
      throw new Error('SIGNATURE_SLOT_NOT_FOUND');
    }
    document.saveAndClose();
    var now = new Date().toISOString();
    var record = {
      document_record_id: Utilities.getUuid(),
      workspace_id: tenantContractDocumentText_(contract.workspace_id),
      tenant_id: tenantContractDocumentText_(contract.tenant_id),
      contract_id: tenantContractDocumentText_(contract.contract_id),
      template_file_id: templateId,
      signed_file_id: copy.getId(),
      signature_artifact_id: signatureArtifactId,
      status: 'signed',
      created_at: now,
      updated_at: now,
      signed_at: now
    };
    tenantContractDocumentAppend_(sheet, record);
    return {
      success: true,
      code: 'OK',
      data: {
        document_record_id: record.document_record_id,
        status: record.status,
        idempotent: false
      }
    };
  } catch (error) {
    if (copy) {
      try { copy.setTrashed(true); } catch (_) {}
    }
    return {
      success: false,
      code: error && error.message === 'SIGNATURE_SLOT_NOT_FOUND'
        ? 'SIGNATURE_SLOT_NOT_FOUND'
        : 'CONTRACT_DOCUMENT_WRITE_FAILED'
    };
  }
}

function tenantContractDocumentPlaceholderPattern_(key) {
  var escaped = String(key);
  [
    '\\', '.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']'
  ].forEach(function (character) {
    escaped = escaped.split(character).join('\\' + character);
  });
  return '\\{\\{' + escaped + '\\}\\}';
}

function tenantContractDocumentRegexLiteral_(value) {
  var escaped = String(value || '');
  [
    '\\', '.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']'
  ].forEach(function (character) {
    escaped = escaped.split(character).join('\\' + character);
  });
  return escaped;
}

function tenantContractDocumentRegexReplacement_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/\$/g, '\\$');
}

function tenantContractDocumentReplaceSignature_(body, blob) {
  var image = tenantContractDocumentFindInlineImage_(body);
  if (image) {
    var width = image.getWidth();
    var height = image.getHeight();
    var parent = image.getParent();
    var index = parent.getChildIndex(image);
    image.removeFromParent();
    var inserted = parent.insertInlineImage(index, blob);
    if (width > 0) inserted.setWidth(width);
    if (height > 0) inserted.setHeight(height);
    return true;
  }
  return tenantContractDocumentReplaceTextSignatureSlot_(body, blob);
}

function tenantContractDocumentReplaceTextSignatureSlot_(body, blob) {
  var range = body.findText(
    tenantContractDocumentRegexLiteral_('乙方簽名（線上簽署）')
  );
  if (!range) return false;
  var element = range.getElement();
  var text = element.asText ? element.asText() : element;
  var parent = text.getParent();
  if (!parent || !parent.insertInlineImage || !parent.getChildIndex) {
    return false;
  }
  text.setText('乙方簽名（線上簽署）：');
  var inserted = parent.insertInlineImage(
    parent.getChildIndex(text) + 1,
    blob
  );
  tenantContractDocumentResizeSignature_(inserted);
  return true;
}

function tenantContractDocumentResizeSignature_(image) {
  if (!image || !image.getWidth || !image.setWidth) return;
  var width = image.getWidth();
  var height = image.getHeight ? image.getHeight() : 0;
  var maxWidth = 220;
  if (width > maxWidth && height > 0 && image.setHeight) {
    image.setWidth(maxWidth);
    image.setHeight(Math.round(height * maxWidth / width));
  }
}

function tenantContractDocumentFindInlineImage_(element) {
  var images = [];
  tenantContractDocumentCollectInlineImages_(element, images);
  var designated = images.find(function (image) {
    var labels = [];
    try {
      if (image.getAltDescription) labels.push(image.getAltDescription());
    } catch (_) {}
    try {
      if (image.getAltTitle) labels.push(image.getAltTitle());
    } catch (_) {}
    return labels.some(function (label) {
      return String(label || '').trim().toLowerCase() === 'sign';
    });
  });
  return designated || (images.length === 1 ? images[0] : null);
}

function tenantContractDocumentCollectInlineImages_(element, images) {
  if (!element) return;
  if (element.getType &&
      element.getType() === DocumentApp.ElementType.INLINE_IMAGE) {
    images.push(element.asInlineImage());
    return;
  }
  if (!element.getNumChildren) return;
  for (var index = 0; index < element.getNumChildren(); index += 1) {
    tenantContractDocumentCollectInlineImages_(
      element.getChild(index),
      images
    );
  }
}
