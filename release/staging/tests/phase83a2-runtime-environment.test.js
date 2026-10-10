'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const stagingRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(stagingRoot, '..', '..');
const appsRoot = path.join(stagingRoot, 'apps-script');
const frontendRoot = path.join(stagingRoot, 'frontend');

const stagingLiffUrl = 'https://liff.line.me/2010314940-wlT7zYd8';
const stagingLiffId = '2010314940-wlT7zYd8';
// Test fixture only: proves the production branch preserves configured input.
const productionLiffUrl = 'https://liff.line.me/2010314940-iJB1D6sN';
const productionLiffId = '2010314940-iJB1D6sN';
const deletedStagingIds = [
  '2010314940-JNHiyZMi',
  '2010314940-wIT7zYd8'
];

function loadRuntime(properties) {
  const context = {
    console,
    Date,
    Math,
    JSON,
    Object,
    Number,
    String,
    Array,
    Error,
    RegExp,
    encodeURIComponent,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: key => properties[key] || ''
      })
    }
  };

  vm.createContext(context);
  [
    'V2_RUNTIME_ENVIRONMENT.js',
    'V2_ANNOUNCEMENT_MANAGEMENT.js',
    'V2_BILL_NOTIFICATIONS.js',
    'V2_TENANT_CHECKIN_MANAGEMENT.js',
    'V2_TENANT_LEASE_ONBOARDING.js'
  ].forEach(file => {
    vm.runInContext(
      fs.readFileSync(path.join(appsRoot, file), 'utf8'),
      context,
      { filename: file }
    );
  });

  return context;
}

function stagingProperties() {
  return {
    CMWEBS_ENVIRONMENT: 'staging',
    CMWEB_TENANT_LIFF_URL: stagingLiffUrl,
    CMWEB_TENANT_FRONTEND_BASE_URL:
      'https://cmwebs-v2-tenant-staging.hanschu.chatgpt.site'
  };
}

function assertStagingLink(message, label) {
  assert.ok(message.includes(stagingLiffUrl), `${label} uses staging LIFF`);
  assert.ok(!message.includes(productionLiffId), `${label} excludes production LIFF`);
}

function runResolverCases() {
  {
    const context = loadRuntime(stagingProperties());
    assert.strictEqual(context.runtimeLiffUrl_(), stagingLiffUrl);

    const encoded = context.runtimeLiffUrl_({
      state: 'bind next&return',
      tenant_id: 'T/01',
      bill_id: 'B?01',
      contract_id: 'C#01',
      other: 'value=two'
    });

    assert.ok(encoded.startsWith(stagingLiffUrl + '?'));
    assert.ok(encoded.includes('state=bind%20next%26return'));
    assert.ok(encoded.includes('tenant_id=T%2F01'));
    assert.ok(encoded.includes('bill_id=B%3F01'));
    assert.ok(encoded.includes('contract_id=C%2301'));
    assert.ok(encoded.includes('other=value%3Dtwo'));
    assert.strictEqual((encoded.match(/\?/g) || []).length, 1);
  }

  {
    const context = loadRuntime({ CMWEBS_ENVIRONMENT: 'staging' });
    assert.throws(
      () => context.runtimeLiffUrl_(),
      error => error && error.code === 'STAGING_LIFF_NOT_CONFIGURED'
    );
  }

  {
    const context = loadRuntime({
      CMWEBS_ENVIRONMENT: 'staging',
      CMWEB_TENANT_LIFF_URL: 'https://example.invalid/not-liff'
    });
    assert.throws(
      () => context.runtimeLiffUrl_(),
      error => error && error.code === 'STAGING_LIFF_INVALID'
    );
  }

  {
    const context = loadRuntime({
      CMWEBS_ENVIRONMENT: 'production',
      CMWEB_TENANT_LIFF_URL: productionLiffUrl
    });
    assert.strictEqual(
      context.runtimeLiffUrl_(),
      productionLiffUrl,
      'production fixture preserves configured production URL exactly'
    );
    assert.notStrictEqual(context.runtimeLiffUrl_(), stagingLiffUrl);
  }
}

function runModuleCases() {
  const context = loadRuntime(stagingProperties());

  assertStagingLink(
    context.announcementBuildMessage_(
      '測試公告',
      '公告內容',
      'general',
      'normal',
      {
        tenant_name: 'Fixture Tenant',
        property_name: 'Fixture Property',
        room_list: 'Fixture Room'
      }
    ),
    'announcement message'
  );

  assertStagingLink(
    context.billNotificationBuildMessage_({
      tenant_name: 'Fixture Tenant',
      property_name: 'Fixture Property',
      room_name: 'Fixture Room',
      bill_month: '2026-07',
      due_date: '2026-07-31',
      rent_amount: 1000,
      management_fee: 0,
      electricity_amount: 0,
      equipment_amount: 0,
      other_amount: 0,
      discount_amount: 0,
      total_amount: 1000
    }),
    'bill notification message'
  );

  assertStagingLink(
    context.tenantCheckinBuildBindingInvitation_({
      tenant_name: 'Fixture Tenant',
      property_name: 'Fixture Property',
      room_name: 'Fixture Room'
    }),
    'tenant check-in binding invitation'
  );

  assertStagingLink(
    context.tenantCheckinBuildWelcomeMessage_({
      tenant_name: 'Fixture Tenant',
      property_name: 'Fixture Property',
      room_name: 'Fixture Room',
      contract_start_date: '2026-07-01',
      contract_end_date: '2027-06-30',
      scheduled_checkin_date: '2026-07-01',
      welcome_send_count: 0
    }),
    'tenant check-in welcome message'
  );

  assertStagingLink(
    context.tenantLeaseBuildInvitationMessage_(
      'Fixture Tenant',
      'Fixture Room',
      '0900000001'
    ),
    'lease onboarding invitation'
  );
}

function walkFiles(root, predicate) {
  const result = [];

  if (!fs.existsSync(root)) return result;

  fs.readdirSync(root, { withFileTypes: true }).forEach(entry => {
    if (entry.name === 'node_modules' || entry.name === '.git') return;
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      result.push(...walkFiles(fullPath, predicate));
    } else if (predicate(fullPath)) {
      result.push(fullPath);
    }
  });

  return result;
}

function runPayloadScan() {
  const executableFiles = [
    ...walkFiles(appsRoot, file => file.endsWith('.js')),
    ...walkFiles(frontendRoot, file => /\.(js|html|json)$/.test(file)),
    ...walkFiles(
      path.join(repositoryRoot, 'release', 'staging-hosting', 'app'),
      file => /\.(js|ts|tsx|html|json)$/.test(file)
    ),
    ...walkFiles(
      path.join(repositoryRoot, 'release', 'staging-hosting', 'public'),
      file => /\.(js|html|json)$/.test(file)
    ),
    ...walkFiles(
      path.join(repositoryRoot, 'release', 'staging-hosting', 'dist', 'client'),
      file => /\.(js|html|json)$/.test(file)
    )
  ];
  [
    path.join(stagingRoot, '.staging-resources.local.json'),
    path.join(repositoryRoot, 'release', 'staging-hosting', '.env.local')
  ].forEach(file => {
    if (fs.existsSync(file)) executableFiles.push(file);
  });

  const productionLiffHits = [];
  const deletedStagingHits = [];
  const malformedHostnameHits = [];
  const hardcodedUidHits = [];

  executableFiles.forEach(file => {
    const source = fs.readFileSync(file, 'utf8');
    const relative = path.relative(repositoryRoot, file);

    if (source.includes(productionLiffUrl) || source.includes(productionLiffId)) {
      productionLiffHits.push(relative);
    }
    if (deletedStagingIds.some(id => source.includes(id))) {
      deletedStagingHits.push(relative);
    }
    if (source.includes('hanschuh.chatgpt.site')) {
      malformedHostnameHits.push(relative);
    }
    if (/U[0-9a-f]{24,}/i.test(source)) {
      hardcodedUidHits.push(relative);
    }
  });

  assert.deepStrictEqual(productionLiffHits, []);
  assert.deepStrictEqual(deletedStagingHits, []);
  assert.deepStrictEqual(malformedHostnameHits, []);
  assert.deepStrictEqual(hardcodedUidHits, []);

  return {
    scannedFiles: executableFiles.length,
    productionLiffReferences: productionLiffHits.length,
    deletedStagingLiffReferences: deletedStagingHits.length,
    malformedHostnameReferences: malformedHostnameHits.length,
    hardcodedUidReferences: hardcodedUidHits.length
  };
}

runResolverCases();
runModuleCases();
const scan = runPayloadScan();
console.log('Phase 83A.2 environment isolation fixtures: PASS');
console.log('Phase 83A.2 payload scan: ' + JSON.stringify(scan));
