const V2_LANDLORD_EMAIL_AUTH_CHALLENGE_SHEET_ =
  'V2_landlord_email_login_challenges';
const V2_LANDLORD_EMAIL_AUTH_SESSION_SHEET_ =
  'V2_landlord_email_sessions';
const V2_LANDLORD_EMAIL_AUTH_USER_SHEET_ =
  'V2_users';
const V2_LANDLORD_EMAIL_AUTH_MEMBER_SHEET_ =
  'V2_workspace_members';
const V2_LANDLORD_EMAIL_AUTH_CHALLENGE_MIN_SECONDS_ = 60;
const V2_LANDLORD_EMAIL_AUTH_CHALLENGE_TTL_SECONDS_ = 15 * 60;
const V2_LANDLORD_EMAIL_AUTH_RATE_WINDOW_SECONDS_ = 15 * 60;
const V2_LANDLORD_EMAIL_AUTH_RATE_WINDOW_LIMIT_ = 5;
const V2_LANDLORD_EMAIL_AUTH_MAX_ATTEMPTS_ = 5;
const V2_LANDLORD_EMAIL_AUTH_SESSION_TTL_SECONDS_ = 12 * 60 * 60;

function requestLandlordEmailVerificationByLineUid_(
  lineUserId,
  email,
  requestId
) {
  const access =
    landlordEmailAuthResolveLineAccess_(
      lineUserId
    );
  if (!access.success) return access;

  const normalizedEmail =
    landlordEmailAuthNormalizeEmail_(
      email
    );
  if (!normalizedEmail) {
    return landlordEmailAuthError_(
      'INVALID_EMAIL',
      'Email 格式不正確'
    );
  }

  const currentEmail =
    landlordEmailAuthNormalizeEmail_(
      access.user.email
    );
  if (currentEmail && currentEmail !== normalizedEmail) {
    return landlordEmailAuthError_(
      'EMAIL_NOT_BOUND_TO_LINE_USER',
      'Email 與目前 LINE 房東帳號不一致'
    );
  }

  return landlordEmailAuthIssueChallenge_({
    user: access.user,
    email: normalizedEmail,
    requestId: requestId,
    purpose: 'verification'
  });
}

function verifyLandlordEmailVerificationCodeByLineUid_(
  lineUserId,
  challengeId,
  code,
  requestId
) {
  const access =
    landlordEmailAuthResolveLineAccess_(
      lineUserId
    );
  if (!access.success) return access;

  const verified =
    landlordEmailAuthVerifyChallenge_(
      challengeId,
      code,
      requestId,
      access.user.user_id
    );
  if (!verified.success) return verified;

  landlordEmailAuthUpdateUser_(
    access.user,
    {
      email_verified_at: landlordEmailAuthNowIso_(),
      email_login_enabled: true,
      updated_at: landlordEmailAuthNowIso_()
    }
  );

  return landlordEmailAuthResult_(
    true,
    'OK',
    'Email 驗證完成',
    {
      user_id: landlordEmailAuthText_(
        access.user.user_id
      ),
      email_verified_at: landlordEmailAuthNowIso_()
    }
  );
}

function requestLandlordEmailLogin_(
  email,
  requestId
) {
  const normalizedEmail =
    landlordEmailAuthNormalizeEmail_(
      email
    );
  if (!normalizedEmail) {
    return landlordEmailAuthGenericLoginFailure_();
  }

  const user =
    landlordEmailAuthFindActiveVerifiedLandlordByEmail_(
      normalizedEmail
    );
  if (!user) {
    return landlordEmailAuthGenericLoginFailure_();
  }

  return landlordEmailAuthIssueChallenge_({
    user: user,
    email: normalizedEmail,
    requestId: requestId,
    purpose: 'login'
  });
}

function verifyLandlordEmailLogin_(
  challengeId,
  code,
  requestId
) {
  const verified =
    landlordEmailAuthVerifyChallenge_(
      challengeId,
      code,
      requestId,
      ''
    );
  if (!verified.success) return verified;

  const user =
    landlordEmailAuthFindUserById_(
      verified.data.user_id
    );
  if (!landlordEmailAuthUserCanLogin_(user)) {
    return landlordEmailAuthGenericLoginFailure_();
  }

  const access =
    landlordEmailAuthResolveUserAccess_(
      user
    );
  if (!access.success) return access;

  const token =
    landlordEmailAuthRandomToken_();
  const nowIso =
    landlordEmailAuthNowIso_();
  const expiresAt =
    landlordEmailAuthIsoAfterSeconds_(
      nowIso,
      V2_LANDLORD_EMAIL_AUTH_SESSION_TTL_SECONDS_
    );
  const sessionRecord = {
    session_id: landlordEmailAuthUuid_(),
    session_token_hash: landlordEmailAuthSessionTokenHash_(token),
    user_id: landlordEmailAuthText_(user.user_id),
    workspace_id: landlordEmailAuthWorkspaceId_(access),
    role: landlordEmailAuthRole_(access),
    issued_at: nowIso,
    expires_at: expiresAt,
    last_seen_at: nowIso,
    revoked_at: '',
    status: 'active',
    request_id: landlordEmailAuthText_(requestId)
  };

  landlordEmailAuthAppendObject_(
    landlordEmailAuthSessionSheet_(),
    sessionRecord
  );

  return landlordEmailAuthResult_(
    true,
    'OK',
    '登入驗證完成',
    {
      session_token: token,
      session_expires_at: expiresAt,
      user_id: sessionRecord.user_id,
      workspace_id: sessionRecord.workspace_id,
      role: sessionRecord.role
    }
  );
}

function getLandlordEmailSessionStatus_(
  sessionToken,
  requestId
) {
  return landlordEmailAuthResolveSession_(
    sessionToken,
    requestId,
    true
  );
}

function revokeLandlordEmailSession_(
  sessionToken,
  requestId
) {
  const resolved =
    landlordEmailAuthResolveSession_(
      sessionToken,
      requestId,
      false
    );
  const nowIso =
    landlordEmailAuthNowIso_();

  if (resolved.data && resolved.data.session) {
    landlordEmailAuthUpdateRow_(
      landlordEmailAuthSessionSheet_(),
      resolved.data.session,
      {
        revoked_at: nowIso,
        status: 'revoked',
        last_seen_at: nowIso
      }
    );
  }

  return landlordEmailAuthResult_(
    true,
    'OK',
    'Email session 已登出',
    null
  );
}

function resolveLandlordEmailSession_(
  sessionToken,
  requestId
) {
  return landlordEmailAuthResolveSession_(
    sessionToken,
    requestId,
    true
  );
}

function landlordEmailAuthIssueChallenge_(
  options
) {
  const sheet =
    landlordEmailAuthChallengeSheet_();
  const nowIso =
    landlordEmailAuthNowIso_();
  const emailHash =
    landlordEmailAuthEmailHash_(
      options.email
    );
  const rate =
    landlordEmailAuthCheckChallengeRate_(
      sheet,
      landlordEmailAuthText_(options.user.user_id),
      emailHash,
      nowIso
    );
  if (!rate.success) return rate;

  const otp =
    landlordEmailAuthOtp_();
  const record = {
    challenge_id: landlordEmailAuthUuid_(),
    user_id: landlordEmailAuthText_(options.user.user_id),
    email_hash: emailHash,
    code_hash: landlordEmailAuthCodeHash_(otp, emailHash),
    issued_at: nowIso,
    expires_at: landlordEmailAuthIsoAfterSeconds_(
      nowIso,
      V2_LANDLORD_EMAIL_AUTH_CHALLENGE_TTL_SECONDS_
    ),
    attempt_count: 0,
    last_attempt_at: '',
    consumed_at: '',
    status: 'issued',
    request_id: landlordEmailAuthText_(options.requestId)
  };

  try {
    landlordEmailAuthSendOtpEmail_(
      options.email,
      otp,
      options.purpose
    );
  } catch (error) {
    return landlordEmailAuthError_(
      'EMAIL_DELIVERY_FAILED',
      'Email 驗證碼寄送失敗'
    );
  }

  landlordEmailAuthAppendObject_(
    sheet,
    record
  );

  return landlordEmailAuthResult_(
    true,
    'OK',
    '驗證碼已寄出',
    {
      challenge_id: record.challenge_id,
      expires_at: record.expires_at
    }
  );
}

function landlordEmailAuthVerifyChallenge_(
  challengeId,
  code,
  requestId,
  expectedUserId
) {
  const sheet =
    landlordEmailAuthChallengeSheet_();
  const challenge =
    landlordEmailAuthFindChallenge_(
      challengeId
    );
  const nowIso =
    landlordEmailAuthNowIso_();

  if (!challenge) {
    return landlordEmailAuthError_(
      'INVALID_CHALLENGE',
      '驗證碼無效或已過期'
    );
  }

  if (
    expectedUserId &&
    landlordEmailAuthText_(challenge.user_id) !==
      landlordEmailAuthText_(expectedUserId)
  ) {
    return landlordEmailAuthError_(
      'WORKSPACE_FORBIDDEN',
      '驗證碼不屬於目前房東'
    );
  }

  if (
    landlordEmailAuthText_(challenge.status).toLowerCase() !== 'issued' ||
    landlordEmailAuthText_(challenge.consumed_at)
  ) {
    return landlordEmailAuthError_(
      'CHALLENGE_CONSUMED',
      '驗證碼已使用'
    );
  }

  if (
    landlordEmailAuthTimestamp_(challenge.expires_at) <=
    landlordEmailAuthTimestamp_(nowIso)
  ) {
    landlordEmailAuthUpdateRow_(
      sheet,
      challenge,
      {
        status: 'expired',
        last_attempt_at: nowIso
      }
    );
    return landlordEmailAuthError_(
      'CHALLENGE_EXPIRED',
      '驗證碼已過期'
    );
  }

  const attempts =
    Number(challenge.attempt_count || 0);
  if (attempts >= V2_LANDLORD_EMAIL_AUTH_MAX_ATTEMPTS_) {
    landlordEmailAuthUpdateRow_(
      sheet,
      challenge,
      {
        status: 'locked',
        last_attempt_at: nowIso
      }
    );
    return landlordEmailAuthError_(
      'CHALLENGE_LOCKED',
      '驗證碼嘗試次數過多'
    );
  }

  const candidate =
    landlordEmailAuthCodeHash_(
      code,
      challenge.email_hash
    );
  if (
    !landlordEmailAuthConstantEquals_(
      candidate,
      challenge.code_hash
    )
  ) {
    const nextAttempts =
      attempts + 1;
    landlordEmailAuthUpdateRow_(
      sheet,
      challenge,
      {
        attempt_count: nextAttempts,
        last_attempt_at: nowIso,
        status:
          nextAttempts >= V2_LANDLORD_EMAIL_AUTH_MAX_ATTEMPTS_
            ? 'locked'
            : 'issued'
      }
    );
    return landlordEmailAuthError_(
      nextAttempts >= V2_LANDLORD_EMAIL_AUTH_MAX_ATTEMPTS_
        ? 'CHALLENGE_LOCKED'
        : 'INVALID_CODE',
      '驗證碼無效或已過期'
    );
  }

  landlordEmailAuthUpdateRow_(
    sheet,
    challenge,
    {
      consumed_at: nowIso,
      status: 'consumed',
      last_attempt_at: nowIso,
      attempt_count: attempts
    }
  );

  return landlordEmailAuthResult_(
    true,
    'OK',
    '驗證碼已確認',
    {
      challenge_id: landlordEmailAuthText_(challenge.challenge_id),
      user_id: landlordEmailAuthText_(challenge.user_id),
      email_hash: landlordEmailAuthText_(challenge.email_hash)
    }
  );
}

function landlordEmailAuthResolveSession_(
  sessionToken,
  requestId,
  touch
) {
  const sheet =
    landlordEmailAuthSessionSheet_();
  const session =
    landlordEmailAuthFindSessionByToken_(
      sessionToken
    );
  const nowIso =
    landlordEmailAuthNowIso_();

  if (!session) {
    return landlordEmailAuthError_(
      'AUTH_REQUIRED',
      '請重新登入'
    );
  }

  if (
    landlordEmailAuthText_(session.status).toLowerCase() !== 'active' ||
    landlordEmailAuthText_(session.revoked_at)
  ) {
    return landlordEmailAuthResult_(
      false,
      'SESSION_REVOKED',
      'Email session 已失效',
      { session: session }
    );
  }

  if (
    landlordEmailAuthTimestamp_(session.expires_at) <=
    landlordEmailAuthTimestamp_(nowIso)
  ) {
    landlordEmailAuthUpdateRow_(
      sheet,
      session,
      {
        status: 'expired',
        last_seen_at: nowIso
      }
    );
    return landlordEmailAuthResult_(
      false,
      'SESSION_EXPIRED',
      'Email session 已過期',
      { session: session }
    );
  }

  const user =
    landlordEmailAuthFindUserById_(
      session.user_id
    );
  if (!landlordEmailAuthUserCanLogin_(user)) {
    return landlordEmailAuthResult_(
      false,
      'AUTH_REQUIRED',
      '請重新登入',
      { session: session }
    );
  }

  const access =
    landlordEmailAuthResolveUserAccess_(
      user
    );
  if (!access.success) {
    return landlordEmailAuthResult_(
      false,
      access.code || 'WORKSPACE_FORBIDDEN',
      access.message || 'Workspace 權限已變更',
      { session: session }
    );
  }

  if (
    landlordEmailAuthWorkspaceId_(access) !==
      landlordEmailAuthText_(session.workspace_id) ||
    landlordEmailAuthRole_(access) !==
      landlordEmailAuthText_(session.role)
  ) {
    return landlordEmailAuthResult_(
      false,
      'WORKSPACE_FORBIDDEN',
      'Email session 與目前 Workspace 不一致',
      { session: session }
    );
  }

  if (touch === true) {
    landlordEmailAuthUpdateRow_(
      sheet,
      session,
      {
        last_seen_at: nowIso,
        request_id: landlordEmailAuthText_(requestId)
      }
    );
  }

  return landlordEmailAuthResult_(
    true,
    'OK',
    'Email session 有效',
    {
      session: session,
      user: user,
      workspace: landlordEmailAuthWorkspace_(access),
      membership: landlordEmailAuthMembership_(access),
      user_id: landlordEmailAuthText_(user.user_id),
      workspace_id: landlordEmailAuthWorkspaceId_(access),
      role: landlordEmailAuthRole_(access)
    }
  );
}

function landlordEmailAuthResolveLineAccess_(
  lineUserId
) {
  lineUserId =
    landlordEmailAuthText_(
      lineUserId
    );
  if (!lineUserId) {
    return landlordEmailAuthError_(
      'AUTH_REQUIRED',
      '請先以 LINE 登入'
    );
  }

  if (typeof workspaceLandlordResolveAccess_ === 'function') {
    const access =
      workspaceLandlordResolveAccess_(
        lineUserId,
        {
          skip_schema_ensure: false,
          skip_legacy_context_creation: true
        }
      );
    if (!access || access.success !== true) {
      return landlordEmailAuthError_(
        (access && access.code) ||
          'WORKSPACE_FORBIDDEN',
        (access && access.message) ||
          'Workspace 權限不足'
      );
    }
    return landlordEmailAuthNormalizeAccess_(
      access
    );
  }

  const user =
    landlordEmailAuthRows_(
      landlordEmailAuthUserSheet_()
    ).find(function (row) {
      return landlordEmailAuthText_(row.line_user_id) === lineUserId;
    });
  if (!landlordEmailAuthUserIsActiveLandlord_(user)) {
    return landlordEmailAuthError_(
      'WORKSPACE_FORBIDDEN',
      'Workspace 權限不足'
    );
  }

  return landlordEmailAuthResolveUserAccess_(
    user
  );
}

function landlordEmailAuthResolveUserAccess_(
  user
) {
  user = user || {};

  if (
    user.line_user_id &&
    typeof workspaceLandlordResolveAccess_ === 'function'
  ) {
    const access =
      workspaceLandlordResolveAccess_(
        user.line_user_id,
        {
          skip_schema_ensure: false,
          skip_legacy_context_creation: true
        }
      );
    if (access && access.success === true) {
      return landlordEmailAuthNormalizeAccess_(
        access
      );
    }
  }

  if (!landlordEmailAuthUserIsActiveLandlord_(user)) {
    return landlordEmailAuthError_(
      'AUTH_REQUIRED',
      '請重新登入'
    );
  }

  const workspaceId =
    landlordEmailAuthText_(
      user.active_workspace_id ||
        user.workspace_id
    );
  const membership =
    landlordEmailAuthRows_(
      landlordEmailAuthMemberSheet_()
    ).find(function (row) {
      return (
        landlordEmailAuthText_(row.user_id) ===
          landlordEmailAuthText_(user.user_id) &&
        landlordEmailAuthText_(row.workspace_id) === workspaceId &&
        landlordEmailAuthActiveStatus_(row.member_status || 'active')
      );
    });
  if (!workspaceId || !membership) {
    return landlordEmailAuthError_(
      'WORKSPACE_FORBIDDEN',
      'Workspace 權限不足'
    );
  }

  return landlordEmailAuthResult_(
    true,
    'OK',
    '',
    {
      user: user,
      workspace: {
        workspace_id: workspaceId,
        account_status: 'active'
      },
      membership: membership
    }
  );
}

function landlordEmailAuthNormalizeAccess_(
  access
) {
  const data = {
    user: access.user || access.data && access.data.user || {},
    workspace: access.workspace || access.data && access.data.workspace || {},
    membership: access.membership || access.data && access.data.membership || {}
  };
  const result =
    landlordEmailAuthResult_(
      true,
      'OK',
      '',
      data
    );
  result.user = data.user;
  result.workspace = data.workspace;
  result.membership = data.membership;
  return result;
}

function landlordEmailAuthFindActiveVerifiedLandlordByEmail_(
  email
) {
  const normalizedEmail =
    landlordEmailAuthNormalizeEmail_(
      email
    );
  return landlordEmailAuthRows_(
    landlordEmailAuthUserSheet_()
  ).find(function (row) {
    return (
      landlordEmailAuthNormalizeEmail_(row.email) === normalizedEmail &&
      landlordEmailAuthUserCanLogin_(row)
    );
  }) || null;
}

function landlordEmailAuthUserCanLogin_(
  user
) {
  return (
    landlordEmailAuthUserIsActiveLandlord_(user) &&
    Boolean(landlordEmailAuthNormalizeEmail_(user.email)) &&
    Boolean(landlordEmailAuthText_(user.email_verified_at)) &&
    landlordEmailAuthAcceptedBoolean_(user.email_login_enabled)
  );
}

function landlordEmailAuthUserIsActiveLandlord_(
  user
) {
  if (!user) return false;
  return (
    landlordEmailAuthText_(user.role || 'landlord').toLowerCase() ===
      'landlord' &&
    landlordEmailAuthActiveStatus_(
      user.account_status ||
        user.status ||
        'active'
    )
  );
}

function landlordEmailAuthFindUserById_(
  userId
) {
  userId =
    landlordEmailAuthText_(
      userId
    );
  return landlordEmailAuthRows_(
    landlordEmailAuthUserSheet_()
  ).find(function (row) {
    return landlordEmailAuthText_(row.user_id) === userId;
  }) || null;
}

function landlordEmailAuthFindChallenge_(
  challengeId
) {
  challengeId =
    landlordEmailAuthText_(
      challengeId
    );
  return landlordEmailAuthRows_(
    landlordEmailAuthChallengeSheet_()
  ).find(function (row) {
    return landlordEmailAuthText_(row.challenge_id) === challengeId;
  }) || null;
}

function landlordEmailAuthFindSessionByToken_(
  sessionToken
) {
  const tokenHash =
    landlordEmailAuthSessionTokenHash_(
      sessionToken
    );
  return landlordEmailAuthRows_(
    landlordEmailAuthSessionSheet_()
  ).find(function (row) {
    return landlordEmailAuthConstantEquals_(
      landlordEmailAuthText_(row.session_token_hash),
      tokenHash
    );
  }) || null;
}

function landlordEmailAuthCheckChallengeRate_(
  sheet,
  userId,
  emailHash,
  nowIso
) {
  const now =
    landlordEmailAuthTimestamp_(
      nowIso
    );
  const activeChallenges =
    landlordEmailAuthRows_(
      sheet
    ).filter(function (row) {
      return (
        landlordEmailAuthText_(row.user_id) === userId &&
        landlordEmailAuthText_(row.email_hash) === emailHash &&
        landlordEmailAuthText_(row.status).toLowerCase() === 'issued' &&
        !landlordEmailAuthText_(row.consumed_at)
      );
    });

  const recentActive =
    activeChallenges.some(function (row) {
      const issuedAt =
        landlordEmailAuthTimestamp_(row.issued_at);
      return (
        issuedAt > 0 &&
        now - issuedAt < V2_LANDLORD_EMAIL_AUTH_CHALLENGE_MIN_SECONDS_ * 1000
      );
    });
  if (recentActive) {
    return landlordEmailAuthError_(
      'RATE_LIMITED',
      '請稍候再重新寄送驗證碼'
    );
  }

  const windowStart =
    now - V2_LANDLORD_EMAIL_AUTH_RATE_WINDOW_SECONDS_ * 1000;
  const windowCount =
    landlordEmailAuthRows_(
      sheet
    ).filter(function (row) {
      const issuedAt =
        landlordEmailAuthTimestamp_(row.issued_at);
      return (
        landlordEmailAuthText_(row.user_id) === userId &&
        landlordEmailAuthText_(row.email_hash) === emailHash &&
        issuedAt >= windowStart
      );
    }).length;

  if (windowCount >= V2_LANDLORD_EMAIL_AUTH_RATE_WINDOW_LIMIT_) {
    return landlordEmailAuthError_(
      'RATE_LIMITED',
      '請稍候再重新寄送驗證碼'
    );
  }

  return landlordEmailAuthResult_(
    true,
    'OK',
    '',
    null
  );
}

function landlordEmailAuthSendOtpEmail_(
  email,
  otp,
  purpose
) {
  const subject =
    purpose === 'login'
      ? 'CMWebs 房東登入驗證碼'
      : 'CMWebs 房東 Email 驗證碼';
  const body =
    '您的 CMWebs 驗證碼是：' + otp + '\n' +
    '驗證碼 15 分鐘內有效。若不是您本人操作，請忽略此信。';
  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: body,
    name: 'CMWebs'
  });
}

function landlordEmailAuthChallengeSheet_() {
  return landlordEmailAuthRequiredSheet_(
    V2_LANDLORD_EMAIL_AUTH_CHALLENGE_SHEET_
  );
}

function landlordEmailAuthSessionSheet_() {
  return landlordEmailAuthRequiredSheet_(
    V2_LANDLORD_EMAIL_AUTH_SESSION_SHEET_
  );
}

function landlordEmailAuthUserSheet_() {
  return landlordEmailAuthRequiredSheet_(
    V2_LANDLORD_EMAIL_AUTH_USER_SHEET_
  );
}

function landlordEmailAuthMemberSheet_() {
  return landlordEmailAuthRequiredSheet_(
    V2_LANDLORD_EMAIL_AUTH_MEMBER_SHEET_
  );
}

function landlordEmailAuthRequiredSheet_(
  sheetName
) {
  if (typeof workspaceEnsureSchema_ === 'function') {
    workspaceEnsureSchema_();
  }
  const ss =
    typeof runtimeSpreadsheet_ === 'function'
      ? runtimeSpreadsheet_()
      : SpreadsheetApp.getActiveSpreadsheet();
  const sheet =
    ss && ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Missing sheet: ' + sheetName);
  }
  return sheet;
}

function landlordEmailAuthRows_(
  sheet
) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values =
    sheet.getDataRange().getValues();
  const headers =
    values[0].map(landlordEmailAuthText_);
  return values.slice(1).map(function (row, index) {
    const object = {
      __row_number: index + 2
    };
    headers.forEach(function (header, column) {
      if (header) object[header] = row[column];
    });
    return object;
  });
}

function landlordEmailAuthAppendObject_(
  sheet,
  record
) {
  if (typeof workspaceAppendObject_ === 'function') {
    workspaceAppendObject_(sheet, record);
    return;
  }
  const headers =
    landlordEmailAuthHeaders_(
      sheet
    );
  sheet.appendRow(headers.map(function (header) {
    return record[header] === undefined
      ? ''
      : record[header];
  }));
}

function landlordEmailAuthUpdateUser_(
  user,
  updates
) {
  const persistedUser =
    landlordEmailAuthFindUserById_(
      user && user.user_id
    );
  if (!persistedUser) {
    throw new Error('Missing V2_users row for Email auth update');
  }
  landlordEmailAuthUpdateRow_(
    landlordEmailAuthUserSheet_(),
    persistedUser,
    updates
  );
}

function landlordEmailAuthUpdateRow_(
  sheet,
  row,
  updates
) {
  const headers =
    landlordEmailAuthHeaders_(
      sheet
    );
  Object.keys(updates).forEach(function (header) {
    let index =
      headers.indexOf(header);
    if (index === -1) {
      const column =
        sheet.getLastColumn() + 1;
      sheet.getRange(1, column).setValue(header);
      headers.push(header);
      index = headers.length - 1;
    }
    sheet.getRange(row.__row_number, index + 1).setValue(updates[header]);
  });
}

function landlordEmailAuthHeaders_(
  sheet
) {
  if (!sheet || sheet.getLastColumn() < 1) return [];
  return sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(landlordEmailAuthText_);
}

function landlordEmailAuthNormalizeEmail_(
  email
) {
  const text =
    landlordEmailAuthText_(
      email
    ).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
    ? text
    : '';
}

function landlordEmailAuthEmailHash_(
  email
) {
  return landlordEmailAuthSha256Hex_(
    landlordEmailAuthSecret_() +
      landlordEmailAuthNormalizeEmail_(email)
  );
}

function landlordEmailAuthCodeHash_(
  code,
  emailHash
) {
  return landlordEmailAuthSha256Hex_(
    landlordEmailAuthSecret_() + ':' +
      landlordEmailAuthText_(emailHash) + ':' +
      landlordEmailAuthText_(code)
  );
}

function landlordEmailAuthSessionTokenHash_(
  sessionToken
) {
  return landlordEmailAuthSha256Hex_(
    landlordEmailAuthText_(sessionToken)
  );
}

function landlordEmailAuthSecret_() {
  if (typeof getRequiredScriptProperty_ === 'function') {
    return getRequiredScriptProperty_(
      'CMWEBS_EMAIL_LOGIN_HASH_SECRET'
    );
  }
  const value =
    PropertiesService
      .getScriptProperties()
      .getProperty('CMWEBS_EMAIL_LOGIN_HASH_SECRET');
  if (value === null || value === '') {
    throw new Error(
      'Missing required Script Property: CMWEBS_EMAIL_LOGIN_HASH_SECRET'
    );
  }
  return value;
}

function landlordEmailAuthSha256Hex_(
  value
) {
  return landlordEmailAuthHex_(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(value)
    )
  );
}

function landlordEmailAuthHex_(
  bytes
) {
  return bytes.map(function (byte) {
    return ('0' + ((byte < 0 ? byte + 256 : byte) & 255).toString(16)).slice(-2);
  }).join('');
}

function landlordEmailAuthConstantEquals_(
  left,
  right
) {
  left =
    landlordEmailAuthText_(
      left
    );
  right =
    landlordEmailAuthText_(
      right
    );
  const max =
    Math.max(left.length, right.length);
  let diff =
    left.length ^ right.length;
  for (let index = 0; index < max; index += 1) {
    diff |=
      (left.charCodeAt(index) || 0) ^
      (right.charCodeAt(index) || 0);
  }
  return diff === 0;
}

function landlordEmailAuthOtp_() {
  const bytes =
    landlordEmailAuthRandomBytes_(4);
  const number =
    (
      (
        bytes[0] * 16777216 +
        bytes[1] * 65536 +
        bytes[2] * 256 +
        bytes[3]
      ) % 1000000
    );
  return String(number).padStart(6, '0');
}

function landlordEmailAuthRandomToken_() {
  return landlordEmailAuthBase64Url_(
    landlordEmailAuthRandomBytes_(32)
  );
}

function landlordEmailAuthRandomBytes_(
  length
) {
  if (
    typeof Utilities !== 'undefined' &&
    Utilities.getUuid
  ) {
    const bytes = [];
    while (bytes.length < length) {
      const digest =
        Utilities.computeDigest(
          Utilities.DigestAlgorithm.SHA_256,
          Utilities.getUuid() + ':' + landlordEmailAuthNowIso_() + ':' + bytes.length
        );
      digest.forEach(function (byte) {
        if (bytes.length < length) bytes.push((byte < 0 ? byte + 256 : byte) & 255);
      });
    }
    return bytes;
  }
  const fallback = [];
  while (fallback.length < length) {
    fallback.push(Math.floor(Math.random() * 256));
  }
  return fallback;
}

function landlordEmailAuthBase64Url_(
  bytes
) {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let output = '';
  let buffer = 0;
  let bits = 0;
  bytes.forEach(function (byte) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      output += chars[(buffer >> bits) & 63];
    }
  });
  if (bits > 0) {
    output += chars[(buffer << (6 - bits)) & 63];
  }
  return output;
}

function landlordEmailAuthUuid_() {
  return (
    typeof Utilities !== 'undefined' &&
    Utilities.getUuid
  )
    ? Utilities.getUuid()
    : 'uuid-' + String(new Date().getTime()) + '-' + String(Math.floor(Math.random() * 1000000));
}

function landlordEmailAuthNowIso_() {
  if (typeof workspaceNowIso_ === 'function') {
    return workspaceNowIso_();
  }
  return new Date().toISOString();
}

function landlordEmailAuthIsoAfterSeconds_(
  iso,
  seconds
) {
  return new Date(
    landlordEmailAuthTimestamp_(iso) +
      seconds * 1000
  ).toISOString();
}

function landlordEmailAuthTimestamp_(
  value
) {
  const time =
    new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function landlordEmailAuthWorkspace_(
  access
) {
  return access.workspace || access.data && access.data.workspace || {};
}

function landlordEmailAuthMembership_(
  access
) {
  return access.membership || access.data && access.data.membership || {};
}

function landlordEmailAuthWorkspaceId_(
  access
) {
  return landlordEmailAuthText_(
    landlordEmailAuthWorkspace_(access).workspace_id
  );
}

function landlordEmailAuthRole_(
  access
) {
  return landlordEmailAuthText_(
    landlordEmailAuthMembership_(access).role
  );
}

function landlordEmailAuthActiveStatus_(
  status
) {
  return [
    'active',
    'enabled',
    'valid',
    'current',
    '啟用',
    '有效'
  ].indexOf(landlordEmailAuthText_(status).toLowerCase()) >= 0;
}

function landlordEmailAuthAcceptedBoolean_(
  value
) {
  if (value === true || value === 1) return true;
  return [
    'true',
    '1',
    'yes',
    'y',
    'enabled',
    'active',
    '是',
    '啟用'
  ].indexOf(landlordEmailAuthText_(value).toLowerCase()) >= 0;
}

function landlordEmailAuthGenericLoginFailure_() {
  return landlordEmailAuthError_(
    'AUTH_REQUIRED',
    '請重新確認 Email 或驗證狀態'
  );
}

function landlordEmailAuthError_(
  code,
  message
) {
  return landlordEmailAuthResult_(
    false,
    code,
    message || 'Email 驗證失敗',
    null
  );
}

function landlordEmailAuthResult_(
  success,
  code,
  message,
  data
) {
  if (typeof workspaceResult_ === 'function') {
    return workspaceResult_(
      success,
      code,
      message,
      data
    );
  }
  return {
    success: success === true,
    code: code || '',
    message: message || '',
    data: data === undefined ? null : data
  };
}

function landlordEmailAuthText_(
  value
) {
  if (typeof workspaceText_ === 'function') {
    return workspaceText_(value);
  }
  return String(value == null ? '' : value).trim();
}
