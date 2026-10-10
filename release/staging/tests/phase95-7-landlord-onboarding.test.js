const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const onboarding = fs.readFileSync(
  path.join(root, 'apps-script', 'V2_LANDLORD_ONBOARDING.js'),
  'utf8'
);
const rbac = fs.readFileSync(
  path.join(root, 'apps-script', 'V2_RBAC.js'),
  'utf8'
);
const workspaces = fs.readFileSync(
  path.join(root, 'apps-script', 'V2_WORKSPACES.js'),
  'utf8'
);
const frontend = fs.readFileSync(
  path.join(root, '..', 'staging-hosting', 'lib', 'landlord-onboarding-template.html'),
  'utf8'
);

assert.match(onboarding, /ALREADY_COMPLETED/);
assert.ok(
  onboarding.indexOf("'ALREADY_COMPLETED'") <
  onboarding.indexOf("'onboarding_status',\n      'completed'")
);
assert.match(onboarding, /onboardingValidateCompletionRelations_/);
assert.match(onboarding, /WORKSPACE_PROFILE_INCOMPLETE/);
assert.match(onboarding, /WORKSPACE_RELATION_MISMATCH/);
assert.match(onboarding, /LANDLORD_RELATION_MISMATCH/);
assert.match(onboarding, /PROPERTY_RELATION_MISMATCH/);
assert.match(onboarding, /ROOM_RELATION_MISMATCH/);
assert.match(onboarding, /ONBOARDING_INCOMPLETE/);
assert.match(onboarding, /payload\.water_fee/);
assert.match(onboarding, /water_fee:\s*waterFee/);
assert.match(onboarding, /room\.water_fee/);
const onboardingInit = onboarding.slice(
  onboarding.indexOf('function getLandlordOnboardingInitByLineUid_'),
  onboarding.indexOf('function saveLandlordOnboardingStepByLineUid_')
);
assert.doesNotMatch(onboardingInit, /onboardingEnsureSchema_\s*\(/);
assert.match(onboardingInit, /skipSchemaEnsure\s*:\s*true/);
assert.strictEqual(
  (onboarding.match(/skipSchemaEnsure\s*:\s*true/g) || []).length,
  3,
  'init, save and complete must each avoid a duplicate workspace schema ensure'
);
assert.match(
  workspaces,
  /function getLandlordWorkspaceContextByLineUid_\(lineUserId, options\)/
);
assert.match(
  workspaces,
  /if \(options\.skipSchemaEnsure !== true\) \{\s*workspaceEnsureSchema_\(\);\s*\}/
);
assert.match(
  workspaces,
  /Recover that staging-only partial/
);
assert.match(
  workspaces,
  /workspaceText_\(row\.line_user_id\) === lineUserId/
);
assert.doesNotMatch(
  workspaces,
  /workspaceText_\(row\.role\)\.toLowerCase\(\) === 'landlord'/
);
assert.match(
  workspaces,
  /Recovered partial staging landlord registration/
);

assert.match(rbac, /landlord_onboarding_init:\s*'workspace_read'/);
assert.match(rbac, /landlord_onboarding_save:\s*'settings_write'/);
assert.match(rbac, /landlord_onboarding_complete:\s*'settings_write'/);
assert.match(rbac, /requestedWorkspaceId\s*!==\s*workspaceId/);
assert.match(rbac, /WORKSPACE_ACCESS_DENIED/);

assert.match(frontend, /liff\.init\(\{liffId:LIFF_ID\}\)/);
assert.match(frontend, /cmwebsSecureBridgeRequest/);
assert.match(frontend, /landlord_onboarding_init/);
assert.match(frontend, /landlord_onboarding_save/);
assert.match(frontend, /landlord_onboarding_complete/);
assert.doesNotMatch(frontend, /line_user_id|line_uid/);
assert.doesNotMatch(frontend, /cmwebssaas-sudo\.github\.io/);

console.log('Phase 95.7 landlord onboarding staging validation: PASS');
