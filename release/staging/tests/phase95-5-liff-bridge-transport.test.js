'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const backend = fs.readFileSync(
  path.join(root, 'apps-script', 'V2_API.js'),
  'utf8'
);
const bridge = fs.readFileSync(
  path.join(root, 'frontend', 'staging-secure-api.js'),
  'utf8'
);
const smoke = fs.readFileSync(
  path.join(root, 'frontend', 'staging-phase95-5-smoke.js'),
  'utf8'
);

function bridgeFixture() {
  const listeners = {};
  const created = [];
  const body = {
    appendChild(node) { node.parentNode = body; },
    removeChild(node) { node.parentNode = null; }
  };
  const document = {
    body,
    createElement(tag) {
      const node = {
        tag,
        children: [],
        appendChild(child) { this.children.push(child); child.parentNode = this; },
        removeChild(child) { this.children = this.children.filter(item => item !== child); },
        submit() {},
        parentNode: null
      };
      if (tag === 'iframe') node.contentWindow = {};
      created.push(node);
      return node;
    }
  };
  const window = {
    liff: { getIDToken: () => 'fixture-id-token' },
    addEventListener(type, callback) { listeners[type] = callback; },
    removeEventListener(type, callback) {
      if (listeners[type] === callback) delete listeners[type];
    }
  };
  const context = { window, document, URL, Promise, setTimeout, clearTimeout, Math, Date };
  vm.createContext(context);
  vm.runInContext(bridge, context);
  return { context, created, listeners };
}

async function testTransportValidation() {
  const fixture = bridgeFixture();
  let settled = false;
  const request = fixture.context.window.cmwebsSecureBridgeRequest({
    apiUrl: 'https://script.google.com/macros/s/staging/exec',
    action: 'tenant_home',
    timeoutMs: 5000
  }).then(value => { settled = true; return value; });

  const form = fixture.created.find(item => item.tag === 'form');
  const requestIdInput = form.children.find(item => item.name === 'request_id');
  assert.ok(requestIdInput && requestIdInput.value);

  fixture.listeners.message({
    origin: 'https://evil.example',
    source: {},
    data: {
      source: 'CMWEBS_APPS_SCRIPT',
      requestId: requestIdInput.value,
      payload: { success: true }
    }
  });
  await Promise.resolve();
  assert.strictEqual(settled, false);

  fixture.listeners.message({
    origin: 'https://n-fixture-script.googleusercontent.com',
    source: {},
    data: {
      source: 'CMWEBS_APPS_SCRIPT',
      requestId: 'wrong-request',
      payload: { success: true }
    }
  });
  await Promise.resolve();
  assert.strictEqual(settled, false);

  fixture.listeners.message({
    origin: 'https://n-fixture-script.googleusercontent.com',
    source: {},
    data: {
      source: 'CMWEBS_APPS_SCRIPT',
      requestId: requestIdInput.value,
      payload: { success: true, code: 'OK' }
    }
  });
  const result = await request;
  assert.strictEqual(result.success, true);
}

function testBackendTopWindowTarget() {
  assert.match(backend, /window\.top\.postMessage/);
  assert.doesNotMatch(backend, /window\.parent\.postMessage/);
  assert.match(backend, /runtimeTenantFrontendBaseUrl_\(\)/);
  assert.match(backend, /runtimeLandlordFrontendBaseUrl_\(\)/);
  assert.doesNotMatch(backend, /postMessage\([\s\S]{0,300},\s*['"]\*['"]\s*\)/);
}

function testSmokeRouteBoundary() {
  [
    'tenant_home',
    'tenant_bills',
    'tenant_contract_init',
    'landlord_home',
    'landlord_contracts_init',
    'landlord_billing_lifecycle_init'
  ].forEach(action => assert.ok(smoke.includes(action), action));
  assert.match(smoke, /cross-role denied/);
  assert.doesNotMatch(smoke, /line_user_id|line_uid|id_token/);
}

testBackendTopWindowTarget();
testSmokeRouteBoundary();
testTransportValidation().then(() => {
  console.log('Phase 95.5 LIFF bridge transport tests: PASS');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
