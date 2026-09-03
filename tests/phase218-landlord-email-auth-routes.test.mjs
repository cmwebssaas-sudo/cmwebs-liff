import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dispatcherSource = readFileSync(new URL('../apps-script/程式碼.js', import.meta.url), 'utf8');

const postOnlyActions = [
  'landlord_email_verify_request',
  'landlord_email_verify_code',
  'landlord_email_login_request',
  'landlord_email_login_verify',
  'landlord_email_session_status',
  'landlord_email_session_revoke'
];

for (const action of postOnlyActions) {
  assert.equal(
    dispatcherSource.includes(`'${action}'`),
    true,
    `${action} must be registered in the dispatcher contract`
  );

  const getBranchPattern = new RegExp(`v2Action\\s*===\\s*'${action}'`);
  assert.equal(
    getBranchPattern.test(dispatcherSource),
    false,
    `${action} must not be exposed through doGet`
  );
}

assert.match(
  dispatcherSource,
  /landlordEmailAuthIsRequest_\(postBody\)/,
  'dispatcher must detect Email auth POST requests exactly once'
);
assert.match(
  dispatcherSource,
  /landlordEmailAuthHandlePost_\(postBody\)/,
  'dispatcher must hand Email auth POST requests to a dedicated POST handler'
);
assert.equal(
  dispatcherSource.match(/landlordEmailAuthIsRequest_\(postBody\)/g)?.length || 0,
  1,
  'Email auth POST detection must be wired exactly once'
);
assert.equal(
  dispatcherSource.match(/landlordEmailAuthHandlePost_\(postBody\)/g)?.length || 0,
  1,
  'Email auth POST dispatch must be wired exactly once'
);

assert.doesNotMatch(
  dispatcherSource,
  /e\.parameter\.(?:email|otp|code|challenge_id|session_token|landlord_session_token)/,
  'Email auth secrets must never be read from GET parameters'
);
assert.doesNotMatch(
  dispatcherSource,
  /request\.(?:workspace_id|role)\s*\|\|/,
  'desktop Email auth POST bodies must not override server-resolved workspace_id or role'
);

console.log('Phase 218 landlord email auth dispatcher RED tests passed.');
