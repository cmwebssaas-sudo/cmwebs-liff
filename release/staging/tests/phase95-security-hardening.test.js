'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const apps = path.join(root, 'apps-script');
const frontend = path.join(root, 'frontend');
const identitySource = fs.readFileSync(path.join(apps, 'V2_LINE_IDENTITY_SECURITY.js'), 'utf8');
const rbacSource = fs.readFileSync(path.join(apps, 'V2_RBAC.js'), 'utf8');
const dispatcherSource = fs.readFileSync(path.join(apps, '程式碼.js'), 'utf8');
const secureBridgeSource = fs.readFileSync(path.join(frontend, 'staging-secure-api.js'), 'utf8');

function identityContext(responsePayload, status = 200, options = {}) {
  let requestCount = 0;
  const queuedFailures = [];
  const FixtureDate = class extends Date {};
  FixtureDate.now = options.now || Date.now;
  const context = {
    Date: FixtureDate,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: key => {
          if (key === 'CMWEBS_LINE_LOGIN_CHANNEL_ID') return '2010314940';
          if (key === 'CMWEBS_LINE_VERIFY_TIMEOUT_MS') return '5000';
          if (key === 'CMWEBS_LINE_VERIFY_MAX_ATTEMPTS') {
            return String(options.maxAttempts || 2);
          }
          return '';
        }
      })
    },
    runtimeFeatureEnabled_: () => false,
    securityFailureQueueRecord_: failure => {
      queuedFailures.push(failure);
      return { success: true };
    },
    Utilities: { sleep: () => true },
    UrlFetchApp: {
      fetch(url, options) {
        assert.strictEqual(url, 'https://api.line.me/oauth2/v2.1/verify');
        assert.strictEqual(options.method, 'post');
        assert.ok(options.payload.id_token);
        const current = requestCount;
        requestCount += 1;
        if (Array.isArray(status) && status[current] === 'throw') {
          throw new Error('provider unavailable');
        }
        return {
          getResponseCode: () => Array.isArray(status)
            ? status[Math.min(current, status.length - 1)]
            : status,
          getContentText: () => JSON.stringify(responsePayload)
        };
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(identitySource, context);
  context.__requests = () => requestCount;
  context.__queuedFailures = queuedFailures;
  return context;
}

function testVerifiedIdentity() {
  const verifiedUid = 'U' + 'a'.repeat(32);
  const context = identityContext({
    sub: verifiedUid,
    aud: '2010314940',
    exp: Math.floor(Date.now() / 1000) + 3600
  });
  const result = context.securityResolveVerifiedLineIdentity_({
    __httpMethod: 'POST',
    parameter: {
      id_token: 'signed-fixture-token',
      line_user_id: 'U' + 'b'.repeat(32)
    }
  }, 'tenant_home');
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.line_user_id, verifiedUid);
  assert.strictEqual(result.source, 'line_id_token');

  const getResult = context.securityResolveVerifiedLineIdentity_({
    __httpMethod: 'GET', parameter: { id_token: 'signed-fixture-token' }
  }, 'tenant_home');
  assert.strictEqual(getResult.code, 'AUTH_POST_REQUIRED');

  const wrongAudience = identityContext({
    sub: verifiedUid,
    aud: 'other-channel',
    exp: Math.floor(Date.now() / 1000) + 3600
  }).securityResolveVerifiedLineIdentity_({
    __httpMethod: 'POST', parameter: { id_token: 'signed-fixture-token' }
  }, 'tenant_home');
  assert.strictEqual(wrongAudience.code, 'LINE_ID_TOKEN_INVALID');

  const transient = identityContext({
    sub: verifiedUid,
    aud: '2010314940',
    exp: Math.floor(Date.now() / 1000) + 3600
  }, [503, 200]);
  assert.strictEqual(transient.securityResolveVerifiedLineIdentity_({
    __httpMethod: 'POST', parameter: { id_token: 'signed-fixture-token' }
  }, 'tenant_home').success, true);
  assert.strictEqual(transient.__requests(), 2);
  assert.strictEqual(transient.__queuedFailures.length, 0);

  const exhausted = identityContext({}, [503, 503]);
  const exhaustedResult = exhausted.securityResolveVerifiedLineIdentity_({
    __httpMethod: 'POST', parameter: { id_token: 'signed-fixture-token' }
  }, 'tenant_home');
  assert.strictEqual(exhaustedResult.code, 'LINE_IDENTITY_PROVIDER_UNAVAILABLE');
  assert.strictEqual(exhausted.__requests(), 2);
  assert.strictEqual(exhausted.__queuedFailures.length, 1);
  assert.strictEqual(exhausted.__queuedFailures[0].attempt_count, 2);
  assert.ok(!JSON.stringify(exhausted.__queuedFailures).includes('signed-fixture-token'));

  let clock = 0;
  const timeout = identityContext({}, 200, {
    maxAttempts: 1,
    now: () => {
      clock += 6001;
      return clock;
    }
  });
  const timeoutResult = timeout.securityResolveVerifiedLineIdentity_({
    __httpMethod: 'POST', parameter: { id_token: 'signed-fixture-token' }
  }, 'tenant_home');
  assert.strictEqual(timeoutResult.code, 'LINE_IDENTITY_PROVIDER_TIMEOUT');
  assert.strictEqual(timeout.__queuedFailures.length, 1);
}

function rbacContext(role, permissions, options = {}) {
  const context = {
    workspaceLandlordResolveAccess_: lineUserId => {
      if (
        options.landlordLineUserId &&
        lineUserId !== options.landlordLineUserId
      ) {
        return {
          success: false,
          code: 'REGISTRATION_REQUIRED',
          message: 'not a landlord identity'
        };
      }
      return {
        success: true,
        workspace: { workspace_id: 'W95' },
        membership: { role },
        permissions: permissions || {}
      };
    },
    workspaceLandlordCheckPolicy_: (access, policy) => ({
      success: policy === 'message_write'
        ? ['owner', 'admin', 'manager', 'maintenance'].includes(role)
        : policy === 'payment_write'
          ? Boolean(access.permissions.can_approve_payment)
          : Boolean(access.permissions.can_edit_contract)
    })
  };
  vm.createContext(context);
  vm.runInContext(rbacSource, context);
  return context;
}

function testRbacCoverage() {
  const routes = [...dispatcherSource.matchAll(
    /v2Action\s*===\s*['"](landlord_[^'"]+)['"]/g
  )].map(match => match[1]);
  const policies = [...rbacSource.matchAll(/^\s*(landlord_[a-z0-9_]+):/gm)]
    .map(match => match[1]);
  assert.deepStrictEqual(routes.filter(route => !policies.includes(route)), []);
  assert.deepStrictEqual(policies.filter(route => !routes.includes(route)), []);

  const viewer = rbacContext('viewer', {});
  assert.strictEqual(viewer.rbacAuthorizeRoute_('Uviewer', 'landlord_home').success, true);
  assert.strictEqual(
    viewer.rbacAuthorizeRoute_('Uviewer', 'landlord_bill_payment_confirm').code,
    'PERMISSION_DENIED'
  );

  const manager = rbacContext('manager', {
    can_approve_payment: true,
    can_edit_contract: true,
    can_terminate_contract: true
  });
  assert.strictEqual(
    manager.rbacAuthorizeRoute_('Umanager', 'landlord_contract_update').success,
    true
  );
  assert.strictEqual(
    manager.rbacAuthorizeRoute_('Umanager', 'landlord_deposit_refund_confirm').success,
    true
  );

  const maintenance = rbacContext('maintenance', {});
  assert.strictEqual(
    maintenance.rbacAuthorizeRoute_('Umaintenance', 'landlord_repair_update').success,
    true
  );
  assert.strictEqual(
    maintenance.rbacAuthorizeRoute_('Umaintenance', 'landlord_contract_update').success,
    false
  );
  assert.strictEqual(
    manager.rbacAuthorizeRoute_(
      'Umanager',
      'landlord_contract_update',
      { workspace_id: 'WOTHER' }
    ).code,
    'WORKSPACE_ACCESS_DENIED'
  );
  assert.strictEqual(
    manager.rbacAuthorizeRoute_('Umanager', 'landlord_unmapped_route').code,
    'RBAC_POLICY_MISSING'
  );

  const dualRole = rbacContext(
    'owner',
    {},
    { landlordLineUserId: 'Ulandlord' }
  );
  assert.strictEqual(
    dualRole.rbacAuthorizeRoute_('Ulandlord', 'tenant_home').code,
    'CROSS_ROLE_DENIED'
  );
  assert.strictEqual(
    dualRole.rbacAuthorizeRoute_('Utenant', 'tenant_home').success,
    true
  );
}

function testFrontendTokenTransport() {
  assert.match(secureBridgeSource, /form\.method\s*=\s*'POST'/);
  assert.match(secureBridgeSource, /liff\.getIDToken\(\)/);
  assert.match(secureBridgeSource, /hidden\(form, 'id_token', idToken\)/);
  assert.match(secureBridgeSource, /isAppsScriptBridgeOrigin\(event\.origin\)/);
  assert.match(secureBridgeSource, /script\\\.googleusercontent\\\.com/);
  assert.doesNotMatch(secureBridgeSource, /event\.source\s*!==\s*frame\.contentWindow/);
  assert.doesNotMatch(secureBridgeSource, /line_user_id/);
  [
    'tenant-bind.html', 'tenant-home.html', 'tenant-bills.html',
    'tenant-message.html', 'tenant-contract.html', 'tenant-payment-report.html'
  ].forEach(name => {
    const source = fs.readFileSync(path.join(frontend, name), 'utf8');
    assert.match(source, /src="staging-secure-api\.js"/);
    assert.match(source, /return window\.cmwebsSecureBridgeRequest/);
    assert.doesNotMatch(source, /line_user_id|line_uid/);
  });
}

function testDispatcherBoundary() {
  assert.match(dispatcherSource, /securityResolveVerifiedLineIdentity_\(e, v2Action\)/);
  assert.match(dispatcherSource, /rbacAuthorizeRoute_\(lineUserId, v2Action, e\.parameter\)/);
  assert.match(dispatcherSource, /lineUserId = verifiedIdentity\.line_user_id/);
  assert.doesNotMatch(
    dispatcherSource.slice(0, dispatcherSource.indexOf('// V2 LIFF API Routes')),
    /e\.parameter\.line_user_id/
  );
}

testVerifiedIdentity();
testRbacCoverage();
testFrontendTokenTransport();
testDispatcherBoundary();
console.log('Phase 95.1 security hardening tests: PASS');
