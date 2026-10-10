'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const apps = path.join(root, 'apps-script');
const configRoot = path.join(root, 'config');

function testEnvironmentConfiguration() {
  const schema = JSON.parse(fs.readFileSync(
    path.join(configRoot, 'environment.schema.json'), 'utf8'
  ));
  const staging = JSON.parse(fs.readFileSync(
    path.join(configRoot, 'staging.example.json'), 'utf8'
  ));
  const production = JSON.parse(fs.readFileSync(
    path.join(configRoot, 'production.placeholder.json'), 'utf8'
  ));
  schema.required_runtime_keys.forEach(key => {
    assert.ok(Object.prototype.hasOwnProperty.call(staging, key));
    assert.ok(Object.prototype.hasOwnProperty.call(production, key));
  });
  schema.feature_flags.forEach(key => {
    assert.ok(Object.prototype.hasOwnProperty.call(staging, key));
    assert.ok(Object.prototype.hasOwnProperty.call(production, key));
  });
  assert.strictEqual(staging.CMWEBS_ENVIRONMENT, 'staging');
  assert.strictEqual(production.CMWEBS_ENVIRONMENT, 'production');
  assert.strictEqual(production.CMWEBS_FEATURE_ALLOW_TEST_IDENTITY, 'false');
  assert.ok(!JSON.stringify(production).match(/U[0-9a-f]{32}/i));
}

function testNoHardcodedEnvironmentCoupling() {
  const source = fs.readFileSync(
    path.join(apps, 'V2_RUNTIME_ENVIRONMENT.js'), 'utf8'
  );
  assert.doesNotMatch(source, /2010314940-/);
  assert.doesNotMatch(source, /chatgpt\.site/);
  assert.match(source, /CMWEBS_FEATURE_SECURITY_FAILURE_QUEUE/);
}

function testSecurityFailureBoundary() {
  const source = fs.readFileSync(
    path.join(apps, 'V2_SECURITY_FAILURE_QUEUE.js'), 'utf8'
  );
  assert.match(source, /V2_SECURITY_FAILURE_QUEUE/);
  assert.match(source, /runtimeRequireSchemaMigration_/);
  assert.doesNotMatch(source, /id_token|line_user_id|access_token/);
  assert.match(source, /SECURITY_FAILURE_QUEUE_NOT_CONFIGURED/);
}

function testEnvironmentCompletenessValidator() {
  const properties = JSON.parse(fs.readFileSync(
    path.join(configRoot, 'staging.example.json'), 'utf8'
  ));
  const context = {
    String,
    Object,
    Array,
    Error,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: key => properties[key] || ''
      })
    }
  };
  vm.createContext(context);
  ['V2_RUNTIME_ENVIRONMENT.js', 'V2_ENVIRONMENT_CONFIGURATION.js']
    .forEach(file => vm.runInContext(
      fs.readFileSync(path.join(apps, file), 'utf8'),
      context,
      { filename: file }
    ));
  const result = context.validateRuntimeEnvironmentConfiguration();
  assert.strictEqual(result.success, true);
  assert.deepStrictEqual(Array.from(result.missing_keys), []);
  assert.deepStrictEqual(Array.from(result.unconfigured_feature_keys), []);
}

function testSettlementMigrationBoundary() {
  const source = fs.readFileSync(
    path.join(apps, 'V2_SETTLEMENT_TRANSACTION.js'), 'utf8'
  );
  assert.match(source, /function migrateSettlementLedgerSchema\(\)/);
  assert.match(source, /runtimeRequireSchemaMigration_\(\)/);
  assert.match(source, /runtimeRequireFeature_\('MOVE_OUT_SETTLEMENT'\)/);
  assert.match(source, /duplicate_key_count/);
  assert.match(source, /rollback_protection_ready/);
}

function testCombinedMigrationBoundary() {
  const source = fs.readFileSync(
    path.join(apps, 'V2_SECURITY_HARDENING_MIGRATION.js'), 'utf8'
  );
  assert.match(source, /runtimeEnvironment_\(\) !== 'staging'/);
  assert.match(source, /runtimeRequireSchemaMigration_\(\)/);
  assert.match(source, /migrateSecurityFailureQueue\(\)/);
  assert.match(source, /migrateSettlementLedgerSchema\(\)/);
  assert.match(source, /validateSecurityHardeningReadiness/);
}

testEnvironmentConfiguration();
testNoHardcodedEnvironmentCoupling();
testSecurityFailureBoundary();
testEnvironmentCompletenessValidator();
testSettlementMigrationBoundary();
testCombinedMigrationBoundary();
console.log('Phase 95.2 production readiness closure tests: PASS');
