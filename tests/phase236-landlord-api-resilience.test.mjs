import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, '..');
const apiSource = fs.readFileSync(
  path.join(rootDir, 'landlord-api.js'),
  'utf8'
);

function makeBridgeRuntime(request) {
  const context = {
    URL,
    Promise,
    Math,
    Date,
    console,
    setTimeout,
    clearTimeout,
    window: null
  };

  context.window = context;
  context.CMWebsLandlordAuth = {
    getRequestAuthParams() {
      return {
        response_mode: 'bridge',
        landlord_session_token: 'session-token'
      };
    },
    handleAuthFailure() {
      return false;
    },
    request
  };

  vm.createContext(context);
  vm.runInContext(apiSource, context);
  return context.CMWebsLandlordApi;
}

{
  let attempts = 0;
  const api = makeBridgeRuntime(async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error('API 載入逾時');
    }
    return { success: true, data: { tenants: [] } };
  });

  const first = api.request({
    action: 'landlord_tenants',
    params: {},
    retryDelayMs: 0
  });
  const duplicate = api.request({
    action: 'landlord_tenants',
    params: {},
    retryDelayMs: 0
  });
  const results = await Promise.all([first, duplicate]);

  assert.equal(attempts, 2, 'one in-flight read should retry once, not duplicate twice');
  assert.equal(results[0].success, true);
  assert.equal(results[1].success, true);
}

{
  let attempts = 0;
  const api = makeBridgeRuntime(async () => {
    attempts += 1;
    throw new Error('API 載入逾時');
  });

  await assert.rejects(
    api.request({
      action: 'landlord_bill_manual_settle',
      params: { bill_id: 'B1' },
      retryDelayMs: 0
    }),
    /API 載入逾時/
  );
  assert.equal(attempts, 1, 'write actions must never retry automatically');
}

{
  let appendedScript = null;
  const context = {
    URL,
    Promise,
    Math,
    Date,
    console,
    setTimeout,
    clearTimeout,
    window: null,
    document: {
      createElement(tagName) {
        assert.equal(tagName, 'script');
        return {
          charset: '',
          onerror: null,
          parentNode: null,
          src: ''
        };
      },
      body: {
        appendChild(script) {
          appendedScript = script;
          script.parentNode = this;
          queueMicrotask(() => script.onerror());
        },
        removeChild(script) {
          script.parentNode = null;
        }
      }
    }
  };

  context.window = context;
  vm.createContext(context);
  vm.runInContext(apiSource, context);

  await assert.rejects(
    context.CMWebsLandlordApi.request({
      apiUrl: 'https://example.test/exec',
      action: 'landlord_arrears',
      lineUserId: 'U1',
      maxAttempts: 1
    }),
    (error) => error && error.code === 'API_NETWORK_ERROR'
  );
  assert.equal(appendedScript.parentNode, null, 'network errors must clean up immediately');
}

const protectedPages = [
  'landlord-more.html',
  'landlord-tenants.html',
  'landlord-arrears.html',
  'landlord-settings.html',
  'landlord-billing.html'
];

for (const filename of protectedPages) {
  const source = fs.readFileSync(path.join(rootDir, filename), 'utf8');
  assert.match(
    source,
    /<script src="landlord-api\.js"><\/script>/,
    `${filename} must load the shared resilient landlord API client`
  );
  assert.match(
    source,
    /CMWebsLandlordApi\.request/,
    `${filename} must route API calls through the shared client`
  );
}

console.log('Phase 236 landlord API resilience tests passed.');
