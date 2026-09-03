import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dispatcherSource = readFileSync(new URL('../apps-script/程式碼.js', import.meta.url), 'utf8');

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const doGetStart = dispatcherSource.indexOf('function doGet(e) {');
const doPostStart = dispatcherSource.indexOf('function doPost(e) {');
const doPostEnd = dispatcherSource.indexOf('\n  } catch (err) {', doPostStart);

assert.notEqual(doGetStart, -1, 'dispatcher must define doGet');
assert.notEqual(doPostStart, -1, 'dispatcher must define doPost');
assert.notEqual(doPostEnd, -1, 'dispatcher must include the doPost dispatcher body');

const doGetSource = dispatcherSource.slice(doGetStart, doPostStart);
const doPostSource = dispatcherSource.slice(doPostStart, doPostEnd);

const actionMappings = [
  {
    action: 'landlord_email_verify_request',
    handler: 'requestLandlordEmailVerificationByLineUid_',
    fields: [
      "request.line_user_id || ''",
      "request.email || ''",
      "request.request_id || ''"
    ]
  },
  {
    action: 'landlord_email_verify_code',
    handler: 'verifyLandlordEmailVerificationCodeByLineUid_',
    fields: [
      "request.line_user_id || ''",
      "request.challenge_id || ''",
      "request.code || ''",
      "request.request_id || ''"
    ]
  },
  {
    action: 'landlord_email_login_request',
    handler: 'requestLandlordEmailLogin_',
    fields: [
      "request.email || ''",
      "request.request_id || ''"
    ]
  },
  {
    action: 'landlord_email_login_verify',
    handler: 'verifyLandlordEmailLogin_',
    fields: [
      "request.challenge_id || ''",
      "request.code || ''",
      "request.request_id || ''"
    ]
  },
  {
    action: 'landlord_email_session_status',
    handler: 'getLandlordEmailSessionStatus_',
    fields: [
      "request.landlord_session_token || ''",
      "request.request_id || ''"
    ]
  },
  {
    action: 'landlord_email_session_revoke',
    handler: 'revokeLandlordEmailSession_',
    fields: [
      "request.landlord_session_token || ''",
      "request.request_id || ''"
    ]
  }
];

for (const mapping of actionMappings) {
  const actionPattern = new RegExp(`action\\s*===\\s*'${escapeRegExp(mapping.action)}'`, 'g');
  assert.equal(
    doPostSource.match(actionPattern)?.length || 0,
    1,
    `${mapping.action} must have exactly one explicit doPost action mapping`
  );

  assert.equal(
    new RegExp(`v2Action\\s*===\\s*'${escapeRegExp(mapping.action)}'`).test(doGetSource),
    false,
    `${mapping.action} must not be exposed through doGet`
  );

  const bodyForwardingPattern = new RegExp(
    `action\\s*===\\s*'${escapeRegExp(mapping.action)}'[\\s\\S]*?${escapeRegExp(mapping.handler)}\\s*\\([\\s\\S]*?${mapping.fields.map((field) => escapeRegExp(field)).join('[\\s\\S]*?')}[\\s\\S]*?\\)`,
    'm'
  );
  assert.match(
    doPostSource,
    bodyForwardingPattern,
    `${mapping.action} must forward the expected request body fields to ${mapping.handler}`
  );
}

assert.match(
  doPostSource,
  /const action = String\(request\.(?:action|v2_action) \|\| ''\)\.trim\(\)/,
  'doPost must normalize the Email auth action from the POST body before dispatch'
);
assert.doesNotMatch(
  dispatcherSource,
  /e\.parameter\.(?:email|otp|code|challenge_id|session_token|landlord_session_token)/,
  'Email auth secrets must never be read from GET parameters'
);
assert.doesNotMatch(
  doPostSource,
  /request\.(?:workspace_id|role)\s*\|\|/,
  'desktop Email auth POST bodies must not override server-resolved workspace_id or role'
);
