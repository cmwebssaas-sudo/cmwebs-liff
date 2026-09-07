/* Private Workspace payment-account cover storage and tenant preview. */
const V2_PAYMENT_ACCOUNT_COVER_ROOT_PROPERTY_ =
  'CMWEBS_PAYMENT_ACCOUNT_COVER_DRIVE_ROOT_FOLDER_ID';
const V2_PAYMENT_ACCOUNT_COVER_MAX_BYTES_ =
  2 * 1024 * 1024;

function paymentAccountCoverText_(value) {
  return value === null || value === undefined
    ? ''
    : String(value).trim();
}

function paymentAccountCoverError_(code, message) {
  return {
    success: false,
    code: code,
    message:
      message ||
      '銀行帳戶封面處理失敗'
  };
}

function paymentAccountCoverValidatePayload_(request) {
  request = request || {};

  const mimeType =
    paymentAccountCoverText_(
      request.mime_type
    ).toLowerCase();
  const base64 =
    paymentAccountCoverText_(
      request.base64
    );

  if (
    !base64 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) ||
    base64.length % 4 !== 0
  ) {
    return paymentAccountCoverError_(
      'INVALID_BASE64',
      '帳戶封面內容無法讀取'
    );
  }

  let bytes;
  try {
    bytes = Utilities.base64Decode(base64);
  } catch (error) {
    return paymentAccountCoverError_(
      'INVALID_BASE64',
      '帳戶封面內容無法讀取'
    );
  }

  if (
    !bytes ||
    bytes.length === 0 ||
    bytes.length > V2_PAYMENT_ACCOUNT_COVER_MAX_BYTES_
  ) {
    return paymentAccountCoverError_(
      'PAYMENT_ACCOUNT_COVER_TOO_LARGE',
      '帳戶封面不可超過 2 MB'
    );
  }

  const image =
    typeof tenantContractArtifactInspectImage_ ===
      'function'
      ? tenantContractArtifactInspectImage_(bytes)
      : paymentAccountCoverInspectImage_(bytes);

  if (!image || image.success !== true) {
    return paymentAccountCoverError_(
      'PAYMENT_ACCOUNT_COVER_IMAGE_INVALID',
      '請上傳有效的 JPG 或 PNG 圖片'
    );
  }

  if (
    ['image/jpeg', 'image/png'].indexOf(
      mimeType
    ) === -1 ||
    !image.data ||
    image.data.mime_type !== mimeType
  ) {
    return paymentAccountCoverError_(
      'PAYMENT_ACCOUNT_COVER_MIME_INVALID',
      '帳戶封面只支援 JPG 或 PNG'
    );
  }

  const width =
    Number(image.data.width || 0);
  const height =
    Number(image.data.height || 0);

  if (
    (width && width < 32) ||
    (height && height < 32) ||
    width > 4096 ||
    height > 4096
  ) {
    return paymentAccountCoverError_(
      'PAYMENT_ACCOUNT_COVER_DIMENSIONS_INVALID',
      '帳戶封面尺寸不符合要求'
    );
  }

  return {
    success: true,
    data: {
      bytes: bytes,
      mime_type: mimeType,
      byte_size: bytes.length,
      sha256:
        paymentAccountCoverSha256_(bytes)
    }
  };
}

function paymentAccountCoverInspectImage_(bytes) {
  const byteAt = function (index) {
    return (bytes[index] || 0) & 255;
  };

  const pngSignature = [
    137, 80, 78, 71,
    13, 10, 26, 10
  ];

  if (
    bytes.length >= 24 &&
    pngSignature.every(function (value, index) {
      return byteAt(index) === value;
    }) &&
    String.fromCharCode(
      byteAt(12),
      byteAt(13),
      byteAt(14),
      byteAt(15)
    ) === 'IHDR'
  ) {
    const width =
      ((byteAt(16) << 24) |
        (byteAt(17) << 16) |
        (byteAt(18) << 8) |
        byteAt(19)) >>> 0;
    const height =
      ((byteAt(20) << 24) |
        (byteAt(21) << 16) |
        (byteAt(22) << 8) |
        byteAt(23)) >>> 0;

    return width && height
      ? {
          success: true,
          data: {
            mime_type: 'image/png',
            width: width,
            height: height
          }
        }
      : paymentAccountCoverError_(
          'PAYMENT_ACCOUNT_COVER_IMAGE_INVALID'
        );
  }

  if (
    bytes.length >= 3 &&
    byteAt(0) === 255 &&
    byteAt(1) === 216 &&
    byteAt(2) === 255
  ) {
    return {
      success: true,
      data: {
        mime_type: 'image/jpeg',
        width: 0,
        height: 0
      }
    };
  }

  return paymentAccountCoverError_(
    'PAYMENT_ACCOUNT_COVER_MAGIC_BYTES_INVALID'
  );
}

function paymentAccountCoverSha256_(bytes) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    bytes
  )
    .map(function (byte) {
      const value =
        (byte < 0 ? byte + 256 : byte) & 255;
      return (
        '0' + value.toString(16)
      ).slice(-2);
    })
    .join('');
}

function paymentAccountCoverRootFolder_() {
  const id =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        V2_PAYMENT_ACCOUNT_COVER_ROOT_PROPERTY_
      );

  if (!id) {
    return paymentAccountCoverError_(
      'PAYMENT_ACCOUNT_COVER_ROOT_NOT_CONFIGURED',
      '尚未設定帳戶封面儲存位置'
    );
  }

  try {
    return {
      success: true,
      data: DriveApp.getFolderById(id)
    };
  } catch (error) {
    return paymentAccountCoverError_(
      'PAYMENT_ACCOUNT_COVER_ROOT_UNAVAILABLE',
      '帳戶封面儲存位置目前無法使用'
    );
  }
}

function paymentAccountCoverSafeFileName_(value) {
  const name =
    paymentAccountCoverText_(value)
      .replace(/[\\/:*?"<>|]/g, '_')
      .slice(0, 120);

  return name || '銀行帳戶封面';
}

function paymentAccountCoverExtension_(mimeType) {
  return mimeType === 'image/jpeg'
    ? '.jpg'
    : '.png';
}

function uploadLandlordPaymentAccountCover_(
  principal,
  request
) {
  const access =
    principal && principal.data
      ? principal.data
      : principal || {};

  if (
    !access.workspace ||
    !access.membership ||
    !access.user
  ) {
    return paymentAccountCoverError_(
      'AUTH_REQUIRED',
      '請先登入管理後台'
    );
  }

  const permissions =
    systemSettingsBuildPermissions_(
      access
    );

  if (!permissions.can_edit_payment) {
    return paymentAccountCoverError_(
      'PERMISSION_DENIED',
      '目前角色沒有編輯收款帳號的權限'
    );
  }

  const payload =
    paymentAccountCoverValidatePayload_(
      request
    );

  if (!payload.success) {
    return payload;
  }

  systemSettingsEnsureSchema_();

  const ss = runtimeSpreadsheet_();
  const workspaceId =
    paymentAccountCoverText_(
      access.workspace.workspace_id
    ).toUpperCase();
  const paymentSheet =
    ss.getSheetByName(
      V2_SYSTEM_SETTINGS_SHEETS_
        .paymentAccounts
    );
  const payment =
    systemSettingsFindDefaultPaymentAccount_(
      ss,
      workspaceId
    );

  if (!payment || !payment.__row_number) {
    return paymentAccountCoverError_(
      'PAYMENT_ACCOUNT_REQUIRED',
      '請先儲存完整的收款帳號，再上傳帳戶封面'
    );
  }

  const root =
    paymentAccountCoverRootFolder_();

  if (!root.success) {
    return root;
  }

  const lock =
    LockService.getScriptLock();
  let locked = false;
  let driveFile = null;

  try {
    lock.waitLock(25000);
    locked = true;

    const originalName =
      paymentAccountCoverSafeFileName_(
        request && request.file_name
      );
    const opaqueName =
      'payment_account_cover_' +
      Utilities.getUuid() +
      paymentAccountCoverExtension_(
        payload.data.mime_type
      );

    driveFile = root.data.createFile(
      Utilities.newBlob(
        payload.data.bytes,
        payload.data.mime_type,
        opaqueName
      )
    );
    driveFile.setSharing(
      DriveApp.Access.PRIVATE,
      DriveApp.Permission.NONE
    );

    const now = new Date();

    systemSettingsSetRowValues_(
      paymentSheet,
      payment.__row_number,
      {
        bank_account_cover_file_id:
          driveFile.getId(),
        bank_account_cover_file_name:
          originalName,
        bank_account_cover_mime_type:
          payload.data.mime_type,
        bank_account_cover_byte_size:
          payload.data.byte_size,
        bank_account_cover_sha256:
          payload.data.sha256,
        bank_account_cover_updated_at:
          now
      }
    );

    const oldFileId =
      paymentAccountCoverText_(
        payment.bank_account_cover_file_id
      );

    if (
      oldFileId &&
      oldFileId !== driveFile.getId() &&
      DriveApp.getFileById
    ) {
      try {
        DriveApp
          .getFileById(oldFileId)
          .setTrashed(true);
      } catch (error) {}
    }

    return {
      success: true,
      code: 'OK',
      message: '銀行帳戶封面已更新',
      data: {
        available: true,
        file_name: originalName,
        mime_type: payload.data.mime_type,
        byte_size: payload.data.byte_size,
        updated_at: now.toISOString()
      }
    };
  } catch (error) {
    if (driveFile) {
      try {
        driveFile.setTrashed(true);
      } catch (trashError) {}
    }

    return paymentAccountCoverError_(
      'PAYMENT_ACCOUNT_COVER_WRITE_FAILED',
      '銀行帳戶封面儲存失敗：' +
        (error && error.message
          ? error.message
          : '未知錯誤')
    );
  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}

function getTenantPaymentAccountCoverByLineUid_(
  lineUserId
) {
  try {
    const identity =
      tenantBillsRuntimeResolveIdentity_(
        lineUserId
      );
    const workspaceId =
      tenantBillsRuntimeUpper_(
        identity.workspace_id
      );
    const payment =
      tenantBillsRuntimePaymentAccountRows_()
        .filter(function (item) {
          return (
            tenantBillsRuntimeUpper_(
              item.workspace_id
            ) === workspaceId &&
            tenantBillsRuntimeText_(
              item.account_status || 'active'
            ).toLowerCase() !== 'archived'
          );
        })
        .find(function (item) {
          return [
            'true',
            '1',
            'yes',
            'y',
            '是'
          ].indexOf(
            tenantBillsRuntimeText_(
              item.is_default
            ).toLowerCase()
          ) >= 0;
        }) ||
      null;
    const fileId =
      tenantBillsRuntimeText_(
        payment &&
          payment.bank_account_cover_file_id
      );

    if (!fileId) {
      return paymentAccountCoverError_(
        'PAYMENT_ACCOUNT_COVER_NOT_CONFIGURED',
        '房東尚未上傳銀行帳戶封面'
      );
    }

    const file =
      DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const bytes = blob.getBytes();

    if (
      !bytes ||
      bytes.length === 0 ||
      bytes.length > V2_PAYMENT_ACCOUNT_COVER_MAX_BYTES_
    ) {
      return paymentAccountCoverError_(
        'PAYMENT_ACCOUNT_COVER_UNAVAILABLE',
        '銀行帳戶封面目前無法讀取'
      );
    }

    const mimeType =
      tenantBillsRuntimeText_(
        payment.bank_account_cover_mime_type
      ) ||
      blob.getContentType();

    if (
      ['image/jpeg', 'image/png'].indexOf(
        mimeType.toLowerCase()
      ) === -1
    ) {
      return paymentAccountCoverError_(
        'PAYMENT_ACCOUNT_COVER_UNAVAILABLE',
        '銀行帳戶封面目前無法讀取'
      );
    }

    return {
      success: true,
      code: 'OK',
      message: '銀行帳戶封面讀取成功',
      data: {
        file_name:
          tenantBillsRuntimeText_(
            payment.bank_account_cover_file_name
          ),
        mime_type: mimeType,
        data_url:
          'data:' +
          mimeType +
          ';base64,' +
          Utilities.base64Encode(bytes)
      }
    };
  } catch (error) {
    return paymentAccountCoverError_(
      'PAYMENT_ACCOUNT_COVER_UNAVAILABLE',
      '銀行帳戶封面目前無法讀取'
    );
  }
}
