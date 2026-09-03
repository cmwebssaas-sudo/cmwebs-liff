import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dispatcherSource = readFileSync(new URL('../apps-script/程式碼.js', import.meta.url), 'utf8');

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractFunctionSource(source, functionName) {
  const match = new RegExp(
    `(?:async\\s+)?function\\s+${functionName}\\s*\\(`
  ).exec(source);

  assert.ok(match, `dispatcher must define ${functionName}`);

  const start = match.index;
  const bodyStart = source.indexOf('{', start);
  assert.notEqual(bodyStart, -1, `dispatcher ${functionName} must include a body`);

  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = '';
      }
      continue;
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }

    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error(`unterminated dispatcher function ${functionName}`);
}

const doGetSource = extractFunctionSource(dispatcherSource, 'doGet');
const doPostFullSource = extractFunctionSource(dispatcherSource, 'doPost');
const doPostEnd = doPostFullSource.indexOf('\n  } catch (err) {');

assert.notEqual(doPostEnd, -1, 'dispatcher must include the doPost dispatcher body');

const doPostSource = doPostFullSource.slice(0, doPostEnd);

function actionConditionPattern(action) {
  const directAction = `String\\(request\\.(?:action|v2_action)\\s*\\|\\|\\s*''\\)\\s*\\.\\s*trim\\(\\)\\s*===\\s*'${escapeRegExp(action)}'`;
  const localAction = `action\\s*===\\s*'${escapeRegExp(action)}'`;
  return `(?:${localAction}|${directAction})`;
}

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
  const actionPattern = new RegExp(actionConditionPattern(mapping.action), 'g');
  assert.equal(
    doPostSource.match(actionPattern)?.length || 0,
    1,
    `${mapping.action} must have exactly one explicit doPost action mapping`
  );

  assert.equal(
    doGetSource.includes(mapping.action),
    false,
    `${mapping.action} must not appear anywhere in doGet`
  );

  const bodyForwardingPattern = new RegExp(
    `${actionConditionPattern(mapping.action)}[\\s\\S]*?${escapeRegExp(mapping.handler)}\\s*\\([\\s\\S]*?${mapping.fields.map((field) => escapeRegExp(field)).join('[\\s\\S]*?')}[\\s\\S]*?\\)`,
    'm'
  );
  assert.match(
    doPostSource,
    bodyForwardingPattern,
    `${mapping.action} must forward the expected request body fields to ${mapping.handler}`
  );
}
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
