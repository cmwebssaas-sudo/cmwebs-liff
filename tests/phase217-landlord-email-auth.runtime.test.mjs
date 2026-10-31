import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
import { existsSync, readFileSync } from 'node:fs';

const moduleUrl = new URL('../apps-script/V2_LANDLORD_EMAIL_AUTH.js', import.meta.url);
const moduleExists = existsSync(moduleUrl);
const source = moduleExists ? readFileSync(moduleUrl, 'utf8') : '';
const guardedTest = moduleExists ? test : test.skip;

class Sheet {
  constructor(headers, rows = []) {
    this.headers = headers.slice();
    this.rows = rows.map((row) => row.slice());
  }

  getLastRow() {
    return this.rows.length + 1;
  }

  getLastColumn() {
    return this.headers.length;
  }

  getDataRange() {
    return {
      getValues: () => [this.headers.slice(), ...this.rows.map((row) => row.slice())]
    };
  }

  getRange(row, column, height = 1, width = 1) {
    const readMatrix = () => {
      if (row === 1) {
        return [this.headers.slice(column - 1, column - 1 + width)];
      }
      return this.rows
        .slice(row - 2, row - 2 + height)
        .map((item) => item.slice(column - 1, column - 1 + width));
    };
    const setCell = (targetRow, targetColumn, value) => {
      if (targetRow === 1) {
        this.headers[targetColumn - 1] = value;
        return;
      }
      const dataRow = this.rows[targetRow - 2];
      while (dataRow.length < targetColumn) dataRow.push('');
      dataRow[targetColumn - 1] = value;
    };
    return {
      getValues: readMatrix,
      getDisplayValues: readMatrix,
      setValue: (value) => setCell(row, column, value),
      setValues: (matrix) => {
        matrix.forEach((matrixRow, rowIndex) => {
          matrixRow.forEach((value, columnIndex) => {
            setCell(row + rowIndex, column + columnIndex, value);
          });
        });
      }
    };
  }

  appendRow(row) {
    this.rows.push(row.slice());
  }
}

const USER_HEADERS = [
  'user_id',
  'workspace_id',
  'landlord_id',
  'line_user_id',
  'email',
  'role',
  'status',
  'account_status',
  'active_workspace_id',
  'email_verified_at',
  'email_login_enabled',
  'updated_at'
];

const MEMBER_HEADERS = [
  'workspace_id',
  'user_id',
  'membership_id',
  'role',
  'member_status'
];

const CHALLENGE_HEADERS = [
  'challenge_id',
  'user_id',
  'email_hash',
  'code_hash',
  'issued_at',
  'expires_at',
  'attempt_count',
  'last_attempt_at',
  'consumed_at',
  'status',
  'request_id'
];

const SESSION_HEADERS = [
  'session_id',
  'session_token_hash',
  'user_id',
  'workspace_id',
  'role',
  'issued_at',
  'expires_at',
  'last_seen_at',
  'revoked_at',
  'status',
  'request_id'
];

function rowFor(headers, values) {
  return headers.map((header) => (values[header] === undefined ? '' : values[header]));
}

function rowObject(headers, row) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index]]));
}

function createRuntime(overrides = {}) {
  const nowIso = overrides.nowIso || '2026-09-04T01:02:03.000Z';
  const nowIsoSequence = Array.isArray(overrides.nowIsoSequence) ? overrides.nowIsoSequence.slice() : null;
  const emailHashSecret = Object.prototype.hasOwnProperty.call(overrides, 'emailHashSecret')
    ? overrides.emailHashSecret
    : 'email-hash-secret';
  const users = [
    rowFor(USER_HEADERS, {
      user_id: 'user-1',
      workspace_id: 'WS-1',
      landlord_id: 'LANDLORD-1',
      line_user_id: 'line-1',
      email: 'owner@example.com',
      role: 'landlord',
      status: 'active',
      account_status: 'active',
      active_workspace_id: 'WS-1',
      email_verified_at: '',
      email_login_enabled: '',
      updated_at: '2026-09-01T00:00:00.000Z'
    }),
    rowFor(USER_HEADERS, {
      user_id: 'user-2',
      workspace_id: 'WS-2',
      landlord_id: 'LANDLORD-2',
      line_user_id: 'line-2',
      email: 'pending@example.com',
      role: 'landlord',
      status: 'active',
      account_status: 'active',
      active_workspace_id: 'WS-2',
      email_verified_at: '',
      email_login_enabled: '',
      updated_at: '2026-09-01T00:00:00.000Z'
    })
  ];
  const memberships = [
    rowFor(MEMBER_HEADERS, {
      workspace_id: 'WS-1',
      user_id: 'user-1',
      membership_id: 'member-1',
      role: 'owner',
      member_status: 'active'
    }),
    rowFor(MEMBER_HEADERS, {
      workspace_id: 'WS-2',
      user_id: 'user-2',
      membership_id: 'member-2',
      role: 'owner',
      member_status: 'active'
    })
  ];
  const sheets = {
    V2_users: new Sheet(USER_HEADERS, users),
    V2_workspace_members: new Sheet(MEMBER_HEADERS, memberships),
    V2_landlord_email_login_challenges: new Sheet(CHALLENGE_HEADERS, []),
    V2_landlord_email_sessions: new Sheet(SESSION_HEADERS, [])
  };
  const state = {
    nowIso,
    mailSends: [],
    auditEvents: [],
    accessWorkspaceId: overrides.accessWorkspaceId || 'WS-1',
    accessRole: overrides.accessRole || 'owner'
  };
  const context = {
    JSON,
    String,
    Number,
    Math,
    Date,
    RegExp,
    Error,
    Object,
    Array,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (name) => sheets[name] || null
      })
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      getUuid: (() => {
        let counter = 0;
        return () => 'uuid-' + (++counter);
      })(),
      computeDigest: (_algorithm, value) => [...crypto.createHash('sha256').update(String(value)).digest()].map((byte) => (byte > 127 ? byte - 256 : byte)),
      computeHmacSha256Signature: (value, key) => [...crypto.createHmac('sha256', String(key)).update(String(value)).digest()].map((byte) => (byte > 127 ? byte - 256 : byte)),
      base64EncodeWebSafe: (value) => Buffer.from(String(value)).toString('base64url'),
      base64DecodeWebSafe: (value) => Buffer.from(String(value), 'base64url'),
      newBlob: (value) => ({ getDataAsString: () => Buffer.from(value).toString() })
    },
    LockService: {
      getScriptLock: () => ({ waitLock() {}, releaseLock() {} })
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => {
          if (key === 'CMWEBS_EMAIL_LOGIN_HASH_SECRET') return emailHashSecret;
          return null;
        }
      })
    },
    MailApp: {
      sendEmail: (...args) => {
        if (overrides.sendEmailError) throw overrides.sendEmailError;
        state.mailSends.push(args.length === 1 ? args[0] : args);
      }
    },
    workspaceResult_: (success, code, message, data) => ({ success, code, message, data: data || null }),
    workspaceLandlordResolveAccess_: (lineUserId) => lineUserId === 'line-1'
      ? {
          success: true,
          user: { user_id: 'user-1', line_user_id: 'line-1', account_status: 'active' },
          workspace: { workspace_id: state.accessWorkspaceId },
          membership: { membership_id: 'member-1', role: state.accessRole, member_status: 'active' }
        }
      : { success: false, code: 'WORKSPACE_ACCESS_DENIED' },
    billingText_: (value) => String(value == null ? '' : value).trim(),
    workspaceAppendObject_: (sheet, record) => {
      sheet.appendRow(sheet.headers.map((header) => (record[header] === undefined ? '' : record[header])));
      return record;
    },
    workspaceNowIso_: () => nowIsoSequence && nowIsoSequence.length ? nowIsoSequence.shift() : state.nowIso,
    workspaceActivityAudit_: (event) => state.auditEvents.push(event)
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'V2_LANDLORD_EMAIL_AUTH.js' });
  return { api: context, sheets, state };
}

function sheetObjects(sheet) {
  return sheet.getDataRange().getValues().slice(1).map((row) => rowObject(sheet.headers, row));
}

function expectedEmailHash(email) {
  return crypto.createHmac('sha256', 'email-hash-secret').update('email:' + String(email).trim().toLowerCase()).digest('hex');
}

function expectedCodeHash(email, code) {
  return crypto.createHmac('sha256', 'email-hash-secret').update('code:' + expectedEmailHash(email) + ':' + String(code).trim()).digest('hex');
}

function expectedSessionTokenHash(token) {
  return crypto.createHmac('sha256', 'email-hash-secret').update('session:' + String(token).trim()).digest('hex');
}

function enableVerifiedEmailLogin(sheet, userId) {
  const userRowIndex = sheet.rows.findIndex((row) => row[sheet.headers.indexOf('user_id')] === userId);
  assert.notEqual(userRowIndex, -1, 'test fixture user must exist');
  const headerMap = Object.fromEntries(sheet.headers.map((header, index) => [header, index + 1]));
  sheet.getRange(userRowIndex + 2, headerMap.email_verified_at).setValue('2026-09-04T00:00:00.000Z');
  sheet.getRange(userRowIndex + 2, headerMap.email_login_enabled).setValue('true');
}

function extractOtpCode(delivery) {
  const parts = [];
  if (typeof delivery === 'string') {
    parts.push(delivery);
  } else if (Array.isArray(delivery)) {
    parts.push(...delivery.map((item) => String(item)));
  } else if (delivery && typeof delivery === 'object') {
    for (const value of Object.values(delivery)) {
      parts.push(String(value));
    }
  }
  const match = parts.join('\n').match(/\b(\d{6})\b/);
  assert.ok(match, 'Email OTP mail must expose a six-digit code to the recipient');
  return match[1];
}

function loadEmailAuthContract(api) {
  return {
    publicActions() {
      return [
        'landlord_email_verify_request',
        'landlord_email_verify_code',
        'landlord_email_login_request',
        'landlord_email_login_verify',
        'landlord_email_session_status',
        'landlord_email_session_revoke'
      ];
    },
    requestLandlordEmailVerificationByLineUid_: api.requestLandlordEmailVerificationByLineUid_,
    verifyLandlordEmailVerificationCodeByLineUid_: api.verifyLandlordEmailVerificationCodeByLineUid_,
    requestLandlordEmailLogin_: api.requestLandlordEmailLogin_,
    verifyLandlordEmailLogin_: api.verifyLandlordEmailLogin_,
    getLandlordEmailSessionStatus_: api.getLandlordEmailSessionStatus_,
    revokeLandlordEmailSession_: api.revokeLandlordEmailSession_,
    resolveLandlordEmailSession_: api.resolveLandlordEmailSession_
  };
}

test('Phase 217 requires the landlord Email auth runtime module', () => {
  assert.equal(
    moduleExists,
    true,
    'landlord email auth module must exist before the Email OTP contract can be released'
  );
});

guardedTest('Phase 217 exposes the fixed Email auth runtime surface', () => {
  const { api } = createRuntime();
  const emailAuth = loadEmailAuthContract(api);
  assert.equal(typeof emailAuth.requestLandlordEmailVerificationByLineUid_, 'function');
  assert.equal(typeof emailAuth.verifyLandlordEmailVerificationCodeByLineUid_, 'function');
  assert.equal(typeof emailAuth.requestLandlordEmailLogin_, 'function');
  assert.equal(typeof emailAuth.verifyLandlordEmailLogin_, 'function');
  assert.equal(typeof emailAuth.getLandlordEmailSessionStatus_, 'function');
  assert.equal(typeof emailAuth.revokeLandlordEmailSession_, 'function');
  assert.equal(typeof emailAuth.resolveLandlordEmailSession_, 'function');
  assert.deepEqual(emailAuth.publicActions(), [
    'landlord_email_verify_request',
    'landlord_email_verify_code',
    'landlord_email_login_request',
    'landlord_email_login_verify',
    'landlord_email_session_status',
    'landlord_email_session_revoke'
  ]);
});

guardedTest('Phase 217 normalizes verification Email and stores only challenge hashes', () => {
  const { api, sheets, state } = createRuntime();
  const result = api.requestLandlordEmailVerificationByLineUid_('line-1', ' Owner@Example.com ', 'verify-request-1');
  assert.equal(result.success, true, result.code);
  assert.equal(state.mailSends.length, 1, 'verification request must send exactly one Email');
  const challenges = sheetObjects(sheets.V2_landlord_email_login_challenges);
  assert.equal(challenges.length, 1);
  assert.equal(challenges[0].email_hash, expectedEmailHash('owner@example.com'));
  assert.equal(challenges[0].expires_at, '2026-09-04T01:12:03.000Z', 'Email OTP challenges must expire after 10 minutes');
  const code = extractOtpCode(state.mailSends[0]);
  assert.equal(challenges[0].code_hash, expectedCodeHash('owner@example.com', code), 'challenge storage must use a keyed HMAC code hash');
  assert.notEqual(challenges[0].code_hash, code, 'challenge storage must never persist a raw verification code');
  assert.match(String(state.mailSends[0].body), /10 分鐘/, 'Email OTP mail copy must tell users the code is valid for 10 minutes');
  assert.doesNotMatch(String(state.mailSends[0].body), /15 分鐘/, 'Email OTP mail copy must not describe a 15-minute challenge');
});

guardedTest('Phase 217 verifies Email codes through the verification handler contract', () => {
  const { api, sheets, state } = createRuntime({
    nowIsoSequence: [
      '2026-09-04T01:02:03.000Z',
      '2026-09-04T01:03:04.000Z',
      '2026-09-04T01:03:05.000Z',
      '2026-09-04T01:03:06.000Z',
      '2026-09-04T01:03:07.000Z'
    ]
  });
  const requested = api.requestLandlordEmailVerificationByLineUid_('line-1', 'owner@example.com', 'verify-request-2');
  assert.equal(requested.success, true, requested.code);
  const challenge = sheetObjects(sheets.V2_landlord_email_login_challenges)[0];
  const code = extractOtpCode(state.mailSends[0]);
  const verified = api.verifyLandlordEmailVerificationCodeByLineUid_('line-1', challenge.challenge_id, code, 'verify-request-3');
  assert.equal(verified.success, true, verified.code);
  const user = sheetObjects(sheets.V2_users).find((row) => row.user_id === 'user-1');
  assert.notEqual(String(user.email_verified_at || '').trim(), '', 'successful verification must persist email_verified_at');
  assert.equal(user.email_verified_at, verified.data.email_verified_at, 'persisted email_verified_at must match the returned timestamp');
  assert.equal(String(user.email_login_enabled), 'true', 'successful verification must enable Email login');
});

guardedTest('Phase 217 normalizes login Email and stores only hashed login challenge values', () => {
  const { api, sheets, state } = createRuntime();
  enableVerifiedEmailLogin(sheets.V2_users, 'user-1');
  const request = api.requestLandlordEmailLogin_(' Owner@Example.com ', 'login-request-1');
  assert.equal(request.success, true, request.code);
  assert.equal(state.mailSends.length, 1, 'login request must send exactly one Email');
  const challenge = sheetObjects(sheets.V2_landlord_email_login_challenges)[0];
  assert.equal(challenge.email_hash, expectedEmailHash('owner@example.com'));
  const code = extractOtpCode(state.mailSends[0]);
  assert.equal(challenge.code_hash, expectedCodeHash('owner@example.com', code), 'login challenge storage must use a keyed HMAC code hash');
  assert.notEqual(challenge.code_hash, code, 'challenge storage must never persist a raw login code');
});

guardedTest('Phase 217 fails closed when the Email hash secret is missing', () => {
  const { api, sheets, state } = createRuntime({ emailHashSecret: '' });
  enableVerifiedEmailLogin(sheets.V2_users, 'user-1');
  const result = api.requestLandlordEmailLogin_('owner@example.com', 'missing-secret');

  assert.equal(result.success, false);
  assert.equal(result.code, 'EMAIL_DELIVERY_FAILED');
  assert.equal(result.message, 'Email 驗證碼寄送失敗');
  assert.doesNotMatch(JSON.stringify(result), /CMWEBS_EMAIL_LOGIN_HASH_SECRET/);
  assert.equal(state.mailSends.length, 0);
  assert.equal(sheetObjects(sheets.V2_landlord_email_login_challenges).length, 0);
});

guardedTest('Phase 217 does not persist a challenge when MailApp delivery fails', () => {
  const { api, sheets, state } = createRuntime({
    sendEmailError: new Error('MailApp quota or authorization failure')
  });
  enableVerifiedEmailLogin(sheets.V2_users, 'user-1');
  const result = api.requestLandlordEmailLogin_('owner@example.com', 'mail-failure');

  assert.equal(result.success, false);
  assert.equal(result.code, 'EMAIL_DELIVERY_FAILED');
  assert.equal(result.message, 'Email 驗證碼寄送失敗');
  assert.equal(state.mailSends.length, 0);
  assert.equal(sheetObjects(sheets.V2_landlord_email_login_challenges).length, 0);
});

guardedTest('Phase 217 stores only a session-token hash when login verification issues a session', () => {
  const { api, sheets, state } = createRuntime();
  enableVerifiedEmailLogin(sheets.V2_users, 'user-1');
  const requested = api.requestLandlordEmailLogin_('owner@example.com', 'login-request-2');
  assert.equal(requested.success, true, requested.code);
  const challenge = sheetObjects(sheets.V2_landlord_email_login_challenges)[0];
  const code = extractOtpCode(state.mailSends[0]);
  const verified = api.verifyLandlordEmailLogin_(challenge.challenge_id, code, 'login-request-3');
  assert.equal(verified.success, true, verified.code);
  assert.ok(verified.data && verified.data.session_token, 'successful login verification must return an opaque session token for the client');
  const rawToken = verified.data.session_token;
  const sessions = sheetObjects(sheets.V2_landlord_email_sessions);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].session_token_hash, expectedSessionTokenHash(rawToken), 'session storage must use a keyed HMAC token hash');
  assert.notEqual(sessions[0].session_token_hash, rawToken, 'session storage must not persist the raw session token');
  assert.equal(
    sessions.some((row) => Object.values(row).some((value) => String(value) === String(rawToken))),
    false,
    'the raw session token must not appear in any persisted session cell'
  );
});

guardedTest('Phase 217 rejects consumed challenges, sixth failed attempts, resend floods, expired sessions, revoked sessions, and Workspace mismatches', () => {
  {
    const { api, sheets } = createRuntime();
    enableVerifiedEmailLogin(sheets.V2_users, 'user-1');
    const first = api.requestLandlordEmailLogin_('owner@example.com', 'request-2');
    assert.equal(first.success, true, first.code);
    const challengeId = sheetObjects(sheets.V2_landlord_email_login_challenges)[0].challenge_id;
    const wrongAttempt = api.verifyLandlordEmailLogin_(challengeId, '000000', 'request-3');
    assert.equal(wrongAttempt.success, false, 'an incorrect code must fail verification');
    const consumed = api.verifyLandlordEmailLogin_(challengeId, '000000', 'request-4');
    assert.equal(consumed.success, false, 'a consumed or exhausted challenge must not be reusable');
  }

  {
    const { api, sheets, state } = createRuntime({ nowIso: '2026-09-04T01:02:03.000Z' });
    enableVerifiedEmailLogin(sheets.V2_users, 'user-1');
    api.requestLandlordEmailLogin_('owner@example.com', 'request-5');
    state.nowIso = '2026-09-04T01:02:20.000Z';
    const blocked = api.requestLandlordEmailLogin_('owner@example.com', 'request-6');
    assert.equal(blocked.success, false, 'a resend inside 60 seconds must fail closed');
    sheets.V2_landlord_email_login_challenges.appendRow(rowFor(CHALLENGE_HEADERS, {
      challenge_id: 'challenge-old',
      user_id: 'user-1',
      email_hash: expectedEmailHash('owner@example.com'),
      code_hash: 'hash',
      issued_at: '2026-09-04T00:30:00.000Z',
      expires_at: '2026-09-04T00:40:00.000Z',
      attempt_count: 5,
      last_attempt_at: '2026-09-04T00:44:00.000Z',
      consumed_at: '',
      status: 'issued',
      request_id: 'request-old'
    }));
    const sixthAttempt = api.verifyLandlordEmailLogin_('challenge-old', '111111', 'request-7');
    assert.equal(sixthAttempt.success, false, 'the sixth failed attempt must lock the challenge');
  }

  {
    const { api, sheets } = createRuntime();
    enableVerifiedEmailLogin(sheets.V2_users, 'user-1');
    sheets.V2_landlord_email_sessions.appendRow(rowFor(SESSION_HEADERS, {
      session_id: 'session-1',
      session_token_hash: expectedSessionTokenHash('opaque-session-token'),
      user_id: 'user-1',
      workspace_id: 'WS-1',
      role: 'owner',
      issued_at: '2026-09-04T00:00:00.000Z',
      expires_at: '2026-09-04T00:10:00.000Z',
      last_seen_at: '2026-09-04T00:00:00.000Z',
      revoked_at: '',
      status: 'active',
      request_id: 'request-session-1'
    }));
    const expired = api.getLandlordEmailSessionStatus_('opaque-session-token', 'request-8');
    assert.equal(expired.code, 'SESSION_EXPIRED');
  }

  {
    const { api, sheets } = createRuntime({ accessWorkspaceId: 'WS-2' });
    enableVerifiedEmailLogin(sheets.V2_users, 'user-1');
    sheets.V2_landlord_email_sessions.appendRow(rowFor(SESSION_HEADERS, {
      session_id: 'session-2',
      session_token_hash: expectedSessionTokenHash('opaque-session-token-2'),
      user_id: 'user-1',
      workspace_id: 'WS-1',
      role: 'owner',
      issued_at: '2026-09-04T00:00:00.000Z',
      expires_at: '2026-09-04T02:00:00.000Z',
      last_seen_at: '2026-09-04T00:00:00.000Z',
      revoked_at: '',
      status: 'active',
      request_id: 'request-session-2'
    }));
    const mismatch = api.resolveLandlordEmailSession_('opaque-session-token-2', 'request-9');
    assert.equal(mismatch.code, 'WORKSPACE_FORBIDDEN');
    const revoked = api.revokeLandlordEmailSession_('opaque-session-token-2', 'request-10');
    assert.equal(revoked.success, true, revoked.code);
  }
});

guardedTest('Phase 217 rejects desktop login for active landlords without verified enabled Email', () => {
  const { api, sheets, state } = createRuntime();
  const unknown = api.requestLandlordEmailLogin_('missing@example.com', 'login-denied-0');
  const request = api.requestLandlordEmailLogin_('pending@example.com', 'login-denied-1');
  assert.equal(request.success, false, 'unverified disabled Email login request must fail');
  assert.equal(request.code, unknown.code, 'request failure must use the generic non-enumerating code');
  assert.equal(request.message, unknown.message, 'request failure must use the generic non-enumerating message');
  assert.equal(state.mailSends.length, 0, 'unverified disabled Email login request must not send OTP mail');

  sheets.V2_landlord_email_login_challenges.appendRow(rowFor(CHALLENGE_HEADERS, {
    challenge_id: 'challenge-disabled',
    user_id: 'user-2',
    email_hash: expectedEmailHash('pending@example.com'),
    code_hash: expectedCodeHash('pending@example.com', '123456'),
    issued_at: '2026-09-04T01:00:00.000Z',
    expires_at: '2026-09-04T01:10:00.000Z',
    attempt_count: 0,
    last_attempt_at: '',
    consumed_at: '',
    status: 'issued',
    request_id: 'login-denied-challenge'
  }));

  const verified = api.verifyLandlordEmailLogin_('challenge-disabled', '123456', 'login-denied-2');
  assert.equal(verified.success, false, 'unverified disabled Email login verification must fail');
  assert.equal(verified.code, unknown.code, 'verification failure must use the generic non-enumerating code');
  assert.equal(verified.message, unknown.message, 'verification failure must use the generic non-enumerating message');
  assert.equal(sheetObjects(sheets.V2_landlord_email_sessions).length, 0, 'unverified disabled Email login must not issue a session');
});

guardedTest('Phase 217 accepts Email challenges before 10 minutes and rejects them after 10 minutes', () => {
  {
    const { api, sheets, state } = createRuntime({ nowIso: '2026-09-04T01:00:00.000Z' });
    enableVerifiedEmailLogin(sheets.V2_users, 'user-1');
    const requested = api.requestLandlordEmailLogin_('owner@example.com', 'ttl-request-1');
    assert.equal(requested.success, true, requested.code);
    const challenge = sheetObjects(sheets.V2_landlord_email_login_challenges)[0];
    assert.equal(challenge.expires_at, '2026-09-04T01:10:00.000Z');
    const code = extractOtpCode(state.mailSends[0]);
    state.nowIso = '2026-09-04T01:09:59.000Z';
    const accepted = api.verifyLandlordEmailLogin_(challenge.challenge_id, code, 'ttl-verify-1');
    assert.equal(accepted.success, true, accepted.code);
  }

  {
    const { api, sheets, state } = createRuntime({ nowIso: '2026-09-04T01:00:00.000Z' });
    enableVerifiedEmailLogin(sheets.V2_users, 'user-1');
    const requested = api.requestLandlordEmailLogin_('owner@example.com', 'ttl-request-2');
    assert.equal(requested.success, true, requested.code);
    const challenge = sheetObjects(sheets.V2_landlord_email_login_challenges)[0];
    const code = extractOtpCode(state.mailSends[0]);
    state.nowIso = '2026-09-04T01:10:01.000Z';
    const expired = api.verifyLandlordEmailLogin_(challenge.challenge_id, code, 'ttl-verify-2');
    assert.equal(expired.success, false, 'Email challenge must fail after the 10-minute TTL');
    assert.equal(expired.code, 'CHALLENGE_EXPIRED');
  }
});

// Slow logins are diagnosed from the execution log: one line per call with
// the step names and milliseconds, never the Email, the code or the token.
function captureTimingLog(api) {
  const lines = [];
  api.console = { log: (line) => lines.push(String(line)) };
  return lines;
}

guardedTest('Email login timing logs each step without the Email, code or token', () => {
  const { api, sheets, state } = createRuntime();
  enableVerifiedEmailLogin(sheets.V2_users, 'user-1');
  const lines = captureTimingLog(api);

  const requested = api.requestLandlordEmailLogin_('owner@example.com', 'timing-request');
  assert.equal(requested.success, true, requested.code);
  const challenge = sheetObjects(sheets.V2_landlord_email_login_challenges)[0];
  const code = extractOtpCode(state.mailSends[0]);
  const verified = api.verifyLandlordEmailLogin_(challenge.challenge_id, code, 'timing-verify');
  assert.equal(verified.success, true, verified.code);

  assert.equal(lines.length, 2);
  assert.match(lines[0], /^EMAIL_LOGIN_TIMING login_request OK total=\d+ms find_user=\d+ms rate_check=\d+ms send_mail=\d+ms save_challenge=\d+ms$/);
  assert.match(lines[1], /^EMAIL_LOGIN_TIMING login_verify OK total=\d+ms find_challenge=\d+ms check_code=\d+ms find_user=\d+ms resolve_access=\d+ms create_session=\d+ms$/);
  const logged = lines.join('\n');
  for (const secret of ['owner@example.com', code, challenge.challenge_id, verified.data.session_token]) {
    assert.equal(logged.includes(secret), false, 'timing log must not contain ' + secret);
  }
});

guardedTest('Email login timing records failures with their code', () => {
  const { api, sheets } = createRuntime({ sendEmailError: new Error('Service invoked too many times') });
  const lines = captureTimingLog(api);
  assert.equal(api.requestLandlordEmailLogin_('nobody@example.com', 'timing-unknown').code, 'AUTH_REQUIRED');
  enableVerifiedEmailLogin(sheets.V2_users, 'user-1');
  assert.equal(api.requestLandlordEmailLogin_('owner@example.com', 'timing-mail-failure').code, 'EMAIL_DELIVERY_FAILED');
  assert.equal(api.verifyLandlordEmailLogin_('missing-challenge', '123456', 'timing-bad').success, false);

  assert.match(lines[0], /^EMAIL_LOGIN_TIMING login_request AUTH_REQUIRED total=\d+ms find_user=\d+ms$/);
  assert.match(lines[1], /^EMAIL_LOGIN_TIMING login_request EMAIL_DELIVERY_FAILED total=\d+ms find_user=\d+ms rate_check=\d+ms$/);
  assert.match(lines[2], /^EMAIL_LOGIN_TIMING login_verify INVALID_CHALLENGE total=\d+ms find_challenge=\d+ms check_code=\d+ms$/);
  assert.doesNotMatch(lines.join('\n'), /example\.com|too many times/);
});

guardedTest('Email login still works when the runtime has no console', () => {
  const { api, sheets } = createRuntime();
  enableVerifiedEmailLogin(sheets.V2_users, 'user-1');
  api.console = undefined;
  assert.equal(api.requestLandlordEmailLogin_('owner@example.com', 'timing-no-console').success, true);
});

// The execution log shows no console output for this project, so the same
// timing is also kept in a small sheet that can be read back.
class TimingSheet {
  constructor(rows = []) { this.rows = rows.map((row) => row.slice()); }
  appendRow(row) { this.rows.push(row.slice()); }
  getLastRow() { return this.rows.length; }
  deleteRows(start, count) { this.rows.splice(start - 1, count); }
}

function withTimingSheet(api, sheets, { existing, failWith } = {}) {
  if (existing) sheets.V2_email_login_timing = existing;
  api.SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
      getSheetByName: (name) => {
        if (failWith && name === 'V2_email_login_timing') throw failWith;
        return sheets[name] || null;
      },
      insertSheet: (name) => (sheets[name] = new TimingSheet())
    })
  };
}

guardedTest('Email login timing rows are saved to a sheet without the Email, code or token', () => {
  const { api, sheets, state } = createRuntime();
  enableVerifiedEmailLogin(sheets.V2_users, 'user-1');
  withTimingSheet(api, sheets);
  captureTimingLog(api);

  api.V2_REQUEST_RUNTIME_SNAPSHOT_STATE_ = { started_at: Date.now() - 5000 };
  const requested = api.requestLandlordEmailLogin_('owner@example.com', 'sheet-request');
  assert.equal(requested.success, true, requested.code);
  const challenge = sheetObjects(sheets.V2_landlord_email_login_challenges)[0];
  const code = extractOtpCode(state.mailSends[0]);
  api.V2_REQUEST_RUNTIME_SNAPSHOT_STATE_ = undefined;
  const verified = api.verifyLandlordEmailLogin_(challenge.challenge_id, code, 'sheet-verify');
  assert.equal(verified.success, true, verified.code);

  const rows = sheets.V2_email_login_timing.rows;
  assert.deepEqual([...rows[0]], ['logged_at', 'flow', 'code', 'total_ms', 'request_ms', 'steps']);
  assert.equal(rows.length, 3);
  assert.match(rows[1][0], /^\d{4}-\d\d-\d\dT/);
  assert.deepEqual([...rows[1].slice(1, 3)], ['login_request', 'OK']);
  assert.equal(typeof rows[1][3], 'number');
  assert.ok(rows[1][4] >= 5000, 'request_ms counts from the start of the web request');
  assert.match(rows[1][5], /^find_user=\d+ms rate_check=\d+ms send_mail=\d+ms save_challenge=\d+ms$/);
  assert.deepEqual([...rows[2].slice(1, 3)], ['login_verify', 'OK']);
  assert.equal(rows[2][4], '', 'no request start outside a web request');
  assert.match(rows[2][5], /^find_challenge=\d+ms check_code=\d+ms find_user=\d+ms resolve_access=\d+ms create_session=\d+ms$/);

  const saved = JSON.stringify(rows);
  for (const secret of ['owner@example.com', code, challenge.challenge_id, verified.data.session_token, 'user-1']) {
    assert.equal(saved.includes(secret), false, 'timing sheet must not contain ' + secret);
  }
});

guardedTest('Email login timing sheet keeps only the newest rows', () => {
  const { api, sheets } = createRuntime();
  const old = [['logged_at', 'flow', 'code', 'total_ms', 'request_ms', 'steps']];
  for (let i = 0; i < 400; i++) old.push(['old-' + i, 'login_request', 'OK', 1, '', '']);
  withTimingSheet(api, sheets, { existing: new TimingSheet(old) });
  captureTimingLog(api);

  api.requestLandlordEmailLogin_('nobody@example.com', 'sheet-trim');
  const rows = sheets.V2_email_login_timing.rows;
  assert.equal(rows.length, 301, 'header plus the newest 300 rows');
  assert.equal(rows[0][0], 'logged_at');
  assert.equal(rows[1][0], 'old-101', 'the oldest 101 rows were removed');
  assert.equal(rows[300][2], 'AUTH_REQUIRED');
});

guardedTest('Email login still works when the timing sheet cannot be written', () => {
  const { api, sheets } = createRuntime();
  enableVerifiedEmailLogin(sheets.V2_users, 'user-1');
  withTimingSheet(api, sheets, { failWith: new Error('Service Spreadsheets timed out') });
  const lines = captureTimingLog(api);
  assert.equal(api.requestLandlordEmailLogin_('owner@example.com', 'sheet-failure').success, true);
  assert.equal(lines.length, 1, 'the execution-log line is still written');
});

// The real access lookup runs its own schema check unless told to skip it, which
// the default stub does not, so a test that counts checks must mimic that.
function countSchemaChecks(api) {
  const counter = { checks: 0, accessCalls: [] };
  api.workspaceEnsureSchema_ = () => { counter.checks += 1; return true; };
  const resolveAccess = api.workspaceLandlordResolveAccess_;
  api.workspaceLandlordResolveAccess_ = (lineUserId, options) => {
    counter.accessCalls.push(options);
    if (!options || options.skip_schema_ensure !== true) api.workspaceEnsureSchema_();
    return resolveAccess(lineUserId, options);
  };
  return counter;
}

// The schema check reads the headers of every workspace sheet. Running it on
// each sheet access made every Email login step take seconds.
guardedTest('Email login checks the sheet schema once per execution', () => {
  const { api, sheets, state } = createRuntime();
  enableVerifiedEmailLogin(sheets.V2_users, 'user-1');
  const counter = countSchemaChecks(api);

  const requested = api.requestLandlordEmailLogin_('owner@example.com', 'schema-request');
  assert.equal(requested.success, true, requested.code);
  assert.equal(counter.checks, 1, 'a login request reads two sheets but checks once');

  const challenge = sheetObjects(sheets.V2_landlord_email_login_challenges)[0];
  const verified = api.verifyLandlordEmailLogin_(challenge.challenge_id, extractOtpCode(state.mailSends[0]), 'schema-verify');
  assert.equal(verified.success, true, verified.code);
  assert.equal(counter.checks, 1, 'the code check reuses the same execution');
  assert.ok(counter.accessCalls.length >= 1, 'the code check reaches the access lookup');
  assert.equal(counter.accessCalls[0].skip_legacy_context_creation, true);
});

guardedTest('A LINE Email access lookup checks the schema once for the whole request', () => {
  const { api } = createRuntime();
  const counter = countSchemaChecks(api);
  const requested = api.requestLandlordEmailVerificationByLineUid_('line-1', 'owner@example.com', 'schema-line');
  assert.equal(requested.success, true, requested.code);
  assert.equal(counter.accessCalls.length >= 1, true, 'the LINE path reaches the access lookup');
  assert.equal(counter.checks, 1, 'the lookup and later sheet reads share one check');
});

guardedTest('A failed schema check stops the LINE Email access lookup', () => {
  const { api } = createRuntime();
  const counter = countSchemaChecks(api);
  api.workspaceEnsureSchema_ = () => { throw new Error('Service Spreadsheets timed out'); };
  assert.throws(
    () => api.requestLandlordEmailVerificationByLineUid_('line-1', 'owner@example.com', 'schema-line-fail'),
    /timed out/
  );
  assert.equal(counter.accessCalls.length, 0, 'access is not read without a passed check');
});

guardedTest('Each execution runs its own Email login schema check', () => {
  for (const run of [1, 2]) {
    const { api } = createRuntime();
    let checks = 0;
    api.workspaceEnsureSchema_ = () => { checks += 1; return true; };
    api.requestLandlordEmailLogin_('nobody@example.com', 'schema-fresh-' + run);
    assert.ok(checks >= 1, 'a new execution starts unchecked');
  }
});

guardedTest('A failed Email login schema check runs again on the next sheet access', () => {
  const { api } = createRuntime();
  let checks = 0;
  api.workspaceEnsureSchema_ = () => {
    checks += 1;
    if (checks === 1) throw new Error('Service Spreadsheets timed out');
    return true;
  };
  assert.throws(() => api.requestLandlordEmailLogin_('owner@example.com', 'schema-fail'), /timed out/);
  assert.equal(api.requestLandlordEmailLogin_('owner@example.com', 'schema-retry').code, 'AUTH_REQUIRED');
  assert.equal(checks, 2);
});

guardedTest('A missing Email login sheet still fails after the schema check passed', () => {
  const { api, sheets } = createRuntime();
  api.workspaceEnsureSchema_ = () => true;
  api.requestLandlordEmailLogin_('nobody@example.com', 'schema-first');
  delete sheets.V2_users;
  assert.throws(() => api.requestLandlordEmailLogin_('nobody@example.com', 'schema-second'), /Missing sheet: V2_users/);
});
