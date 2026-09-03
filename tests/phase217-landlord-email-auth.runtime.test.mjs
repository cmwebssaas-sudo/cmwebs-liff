import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { existsSync, readFileSync } from 'node:fs';

const moduleUrl = new URL('../apps-script/V2_LANDLORD_EMAIL_AUTH.js', import.meta.url);
assert.equal(
  existsSync(moduleUrl),
  true,
  'landlord email auth module must exist before the Email OTP contract can be released'
);

const source = readFileSync(moduleUrl, 'utf8');

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

function createRuntime(overrides = {}) {
  const nowIso = overrides.nowIso || '2026-09-04T01:02:03.000Z';
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
      email_verified_at: '2026-09-01T00:00:00.000Z',
      email_login_enabled: 'true',
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
          if (key === 'CMWEBS_EMAIL_LOGIN_HASH_SECRET') return 'email-hash-secret';
          return null;
        }
      })
    },
    MailApp: {
      sendEmail: (message) => state.mailSends.push(message)
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
    workspaceNowIso_: () => state.nowIso,
    workspaceActivityAudit_: (event) => state.auditEvents.push(event)
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'V2_LANDLORD_EMAIL_AUTH.js' });
  return { api: context, sheets, state };
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

{
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
}

{
  const { api, sheets, state } = createRuntime();
  const request = api.requestLandlordEmailLogin_(' Owner@Example.com ', 'request-1');
  assert.equal(request.success, true, request.code);
  const challengeRows = sheets.V2_landlord_email_login_challenges.getDataRange().getValues().slice(1);
  assert.equal(challengeRows.length, 1);
  const challenge = Object.fromEntries(CHALLENGE_HEADERS.map((header, index) => [header, challengeRows[0][index]]));
  assert.equal(challenge.email_hash, crypto.createHash('sha256').update('email-hash-secret' + 'owner@example.com').digest('hex'));
  assert.notEqual(challenge.code_hash, '123456', 'challenge storage must never persist a raw OTP code');
  assert.equal(state.mailSends.length, 1, 'login request must send exactly one email');
}

{
  const { api, sheets } = createRuntime();
  const first = api.requestLandlordEmailLogin_('owner@example.com', 'request-2');
  assert.equal(first.success, true, first.code);
  const challengeId = sheets.V2_landlord_email_login_challenges.getDataRange().getValues()[1][0];
  const replay = api.verifyLandlordEmailLogin_(challengeId, '000000', 'request-3');
  assert.equal(replay.success, false, 'an incorrect code must fail verification');
  const consumed = api.verifyLandlordEmailLogin_(challengeId, '000000', 'request-4');
  assert.equal(consumed.success, false, 'a consumed or exhausted challenge must not be reusable');
}

{
  const { api, sheets, state } = createRuntime({ nowIso: '2026-09-04T01:02:03.000Z' });
  api.requestLandlordEmailLogin_('owner@example.com', 'request-5');
  state.nowIso = '2026-09-04T01:02:20.000Z';
  const blocked = api.requestLandlordEmailLogin_('owner@example.com', 'request-6');
  assert.equal(blocked.success, false, 'a resend inside 60 seconds must fail closed');
  sheets.V2_landlord_email_login_challenges.appendRow(rowFor(CHALLENGE_HEADERS, {
    challenge_id: 'challenge-old',
    user_id: 'user-1',
    email_hash: crypto.createHash('sha256').update('email-hash-secret' + 'owner@example.com').digest('hex'),
    code_hash: 'hash',
    issued_at: '2026-09-04T00:30:00.000Z',
    expires_at: '2026-09-04T00:45:00.000Z',
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
  sheets.V2_landlord_email_sessions.appendRow(rowFor(SESSION_HEADERS, {
    session_id: 'session-1',
    session_token_hash: crypto.createHash('sha256').update('opaque-session-token').digest('hex'),
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
  sheets.V2_landlord_email_sessions.appendRow(rowFor(SESSION_HEADERS, {
    session_id: 'session-2',
    session_token_hash: crypto.createHash('sha256').update('opaque-session-token-2').digest('hex'),
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

console.log('Phase 217 landlord email auth contract runtime RED tests passed.');
