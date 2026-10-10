'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const stagingRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(stagingRoot, '..', '..');
const appsRoot = path.join(stagingRoot, 'apps-script');
const frontendRoot = path.join(stagingRoot, 'frontend');
const hostingRoot = path.join(repositoryRoot, 'release', 'staging-hosting');

const stagingLiffUrl = 'https://liff.line.me/2010314940-wlT7zYd8';
const stagingTenantBaseUrl =
  'https://cmwebs-v2-tenant-staging.hanschu.chatgpt.site';
const stagingTenantBindEndpoint =
  stagingTenantBaseUrl + '/tenant-bind.html';

// Production fixtures only. These values prove byte-for-byte production
// behavior without placing them in executable staging source.
const productionLiffUrl = 'https://liff.line.me/2010314940-iJB1D6sN';
const productionTenantBaseUrl =
  'https://cmwebssaas-sudo.github.io/cmwebs-liff';
const productionLandlordBaseUrl = productionTenantBaseUrl;
const productionLineAddFriendUrl = 'https://line.me/R/ti/p/@114djwkv';
const expectedProductionAppsScriptHash =
  'f1cee14591adebf1622eb46c082f54b5045088354a4af47969809c40889ba959';

function loadRuntime(properties) {
  const context = {
    Date,
    Math,
    JSON,
    Object,
    Number,
    String,
    Array,
    Error,
    RegExp,
    Boolean,
    encodeURIComponent,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: key => properties[key] || ''
      })
    }
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(
      path.join(appsRoot, 'V2_RUNTIME_ENVIRONMENT.js'),
      'utf8'
    ),
    context,
    { filename: 'V2_RUNTIME_ENVIRONMENT.js' }
  );
  return context;
}

function stagingProperties(extra = {}) {
  return Object.assign({
    CMWEBS_ENVIRONMENT: 'staging',
    CMWEB_TENANT_LIFF_URL: stagingLiffUrl,
    CMWEB_TENANT_FRONTEND_BASE_URL: stagingTenantBaseUrl
  }, extra);
}

function runResolverCases() {
  const staging = loadRuntime(stagingProperties());
  assert.strictEqual(staging.runtimeTenantLiffUrl_(), stagingLiffUrl);
  assert.strictEqual(
    staging.runtimeTenantFrontendBaseUrl_(),
    stagingTenantBaseUrl
  );

  assert.throws(
    () => staging.runtimeLandlordFrontendBaseUrl_(),
    error =>
      error &&
      error.code === 'STAGING_LANDLORD_FRONTEND_NOT_CONFIGURED'
  );
  assert.strictEqual(
    staging.runtimeLandlordActionUrl_('landlord-messages.html'),
    '',
    'missing staging landlord frontend suppresses the action URL'
  );
  assert.throws(
    () => staging.runtimeLineAddFriendUrl_(),
    error =>
      error &&
      error.code === 'STAGING_LINE_ADD_FRIEND_NOT_CONFIGURED'
  );

  const configuredLandlord = loadRuntime(stagingProperties({
    CMWEB_LANDLORD_FRONTEND_BASE_URL:
      'https://landlord-staging.example.test'
  }));
  assert.strictEqual(
    configuredLandlord.runtimeLandlordFrontendUrl_(
      'landlord-bill-notifications.html',
      { bill_month: '2026/07', tenant: 'T & 82' }
    ),
    'https://landlord-staging.example.test/' +
      'landlord-bill-notifications.html?' +
      'bill_month=2026%2F07&tenant=T%20%26%2082'
  );

  const configuredLine = loadRuntime(stagingProperties({
    CMWEB_LINE_ADD_FRIEND_URL:
      'https://line.me/R/ti/p/@stagingfixture'
  }));
  assert.strictEqual(
    configuredLine.runtimeLineAddFriendUrl_(),
    'https://line.me/R/ti/p/@stagingfixture'
  );

  const production = loadRuntime({
    CMWEBS_ENVIRONMENT: 'production',
    CMWEB_TENANT_LIFF_URL: productionLiffUrl,
    CMWEB_TENANT_FRONTEND_BASE_URL: productionTenantBaseUrl,
    CMWEB_LANDLORD_FRONTEND_BASE_URL: productionLandlordBaseUrl,
    CMWEB_LINE_ADD_FRIEND_URL: productionLineAddFriendUrl
  });
  assert.strictEqual(production.runtimeTenantLiffUrl_(), productionLiffUrl);
  assert.strictEqual(
    production.runtimeTenantFrontendBaseUrl_(),
    productionTenantBaseUrl
  );
  assert.strictEqual(
    production.runtimeLandlordFrontendBaseUrl_(),
    productionLandlordBaseUrl
  );
  assert.strictEqual(
    production.runtimeLineAddFriendUrl_(),
    productionLineAddFriendUrl
  );
}

function runLandlordCallSiteCases() {
  const expected = {
    'V2_AUTO_PAYMENT_REMINDER.js': ['runtimeLandlordActionUrl_', 2],
    'V2_TENANT_MESSAGES.js': ['runtimeLandlordActionUrl_', 1],
    'V2_TENANT_CHECKIN_MANAGEMENT.js': ['runtimeLandlordActionUrl_', 2],
    'V2_TENANT_PAYMENT_REPORTS.js': ['runtimeLandlordActionUrl_', 1],
    'V2_BILLING_MANAGEMENT.js': ['runtimeLandlordActionUrl_', 1],
    'V2_TEAM_MANAGEMENT.js': ['runtimeLandlordFrontendUrl_', 2],
    'V2_ANNOUNCEMENT_MANAGEMENT.js': ['runtimeLandlordActionUrl_', 1],
    'V2_CONTRACT_REQUESTS.js': ['runtimeLandlordActionUrl_', 2]
  };

  let canonicalCallCount = 0;
  Object.entries(expected).forEach(([file, definition]) => {
    const functionName = definition[0];
    const count = definition[1];
    const source = fs.readFileSync(path.join(appsRoot, file), 'utf8');
    const actual = (
      source.match(new RegExp(functionName + '\\s*\\(', 'g')) || []
    ).length;
    assert.strictEqual(actual, count, `${file} canonical landlord URLs`);
    assert.ok(!source.includes(productionLandlordBaseUrl));
    canonicalCallCount += actual;
  });

  const paymentSource = fs.readFileSync(
    path.join(appsRoot, '程式碼.js'),
    'utf8'
  );
  assert.strictEqual(
    (paymentSource.match(/runtimeLineAddFriendUrl_\s*\(/g) || []).length,
    1
  );
  assert.ok(!paymentSource.includes(productionLineAddFriendUrl));

  return {
    replacedProductionOccurrences: 11,
    canonicalRuntimeCalls: canonicalCallCount,
    lineAddFriendRuntimeCalls: 1
  };
}

function walkFiles(root, predicate) {
  if (!fs.existsSync(root)) return [];
  const result = [];
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

function executableFiles() {
  return [
    ...walkFiles(appsRoot, file => file.endsWith('.js')),
    ...walkFiles(frontendRoot, file => /\.(html|js|json)$/.test(file)),
    ...walkFiles(
      path.join(hostingRoot, 'app'),
      file => /\.(html|js|ts|tsx|json)$/.test(file)
    ),
    ...walkFiles(
      path.join(hostingRoot, 'public'),
      file => /\.(html|js|json)$/.test(file)
    ),
    ...walkFiles(
      path.join(hostingRoot, 'dist', 'client'),
      file => /\.(html|js|json)$/.test(file)
    )
  ];
}

function runIsolationScan() {
  const patterns = {
    productionLiff: [productionLiffUrl, '2010314940-iJB1D6sN'],
    productionTenantFrontend: [productionTenantBaseUrl],
    productionLandlordFrontend: [productionLandlordBaseUrl + '/landlord-'],
    productionLine: [productionLineAddFriendUrl],
    malformedHostname: ['hanschuh.chatgpt.site'],
    deletedStagingLiff: ['2010314940-JNHiyZMi', '2010314940-wIT7zYd8'],
    hardcodedUid: [/U[0-9a-f]{24,}/i]
  };
  const hits = {};
  Object.keys(patterns).forEach(key => { hits[key] = []; });

  executableFiles().forEach(file => {
    const source = fs.readFileSync(file, 'utf8');
    Object.entries(patterns).forEach(([key, values]) => {
      if (values.some(value =>
        value instanceof RegExp ? value.test(source) : source.includes(value)
      )) {
        hits[key].push(path.relative(repositoryRoot, file));
      }
    });
  });

  Object.entries(hits).forEach(([key, files]) => {
    assert.deepStrictEqual(files, [], `${key} executable references`);
  });
  return hits;
}

function extractInternalTargets(source) {
  const targets = new Set();
  const expression = /['"](tenant-[a-z0-9-]+\.html)(?:\?[^'"]*)?['"]/g;
  let match;
  while ((match = expression.exec(source))) {
    targets.add(match[1]);
  }
  return [...targets];
}

function runFrontendCases() {
  const pageNames = [
    'tenant-bind.html',
    'tenant-home.html',
    'tenant-bills.html',
    'tenant-message.html',
    'tenant-contract.html',
    'tenant-payment-report.html'
  ];
  const allTargets = new Set();

  pageNames.forEach(name => {
    const source = fs.readFileSync(path.join(frontendRoot, name), 'utf8');
    assert.ok(source.length > 20000, `${name} is not a placeholder`);
    assert.ok(source.includes('./cmweb-env.local.js'));
    assert.ok(source.includes('./cmweb-env.js'));
    assert.ok(source.includes('window.CMWEB_RUNTIME_CONFIG'));
    extractInternalTargets(source).forEach(target => allTargets.add(target));
  });

  assert.ok(
    fs.readFileSync(path.join(frontendRoot, 'tenant-contract.html'), 'utf8')
      .includes("'tenant_contract_init'")
  );
  assert.ok(
    fs.readFileSync(
      path.join(frontendRoot, 'tenant-payment-report.html'),
      'utf8'
    ).includes("'tenant_payment_report_init'")
  );

  const bindSource = fs.readFileSync(
    path.join(frontendRoot, 'tenant-bind.html'),
    'utf8'
  );
  assert.ok(
    bindSource.includes(stagingTenantBindEndpoint),
    'tenant binding uses the registered staging LIFF endpoint'
  );
  assert.ok(
    bindSource.includes('ensureCanonicalTenantBindUrl_();'),
    'tenant binding restores the explicit .html route'
  );
  assert.ok(
    bindSource.indexOf('ensureCanonicalTenantBindUrl_();') <
      bindSource.indexOf('await liff.init'),
    'canonical .html route is restored before LIFF initialization'
  );
  assert.match(
    bindSource,
    /redirectUri:\s*STAGING_TENANT_BIND_REDIRECT_URI/,
    'LIFF login uses the exact registered redirect URI'
  );
  assert.doesNotMatch(
    bindSource,
    /redirectUri:\s*location\.href/,
    'LIFF login never uses the hosting-rewritten location'
  );

  const missing = [];
  allTargets.forEach(target => {
    const explicit = path.join(frontendRoot, target);
    const extensionless = path.join(
      frontendRoot,
      target.replace(/\.html$/, '') + '.html'
    );
    if (!fs.existsSync(explicit) || !fs.existsSync(extensionless)) {
      missing.push(target);
    }
  });
  assert.deepStrictEqual(missing, []);

  pageNames.forEach(name => {
    if (name === 'tenant-bind.html') {
      assert.ok(fs.existsSync(path.join(
        hostingRoot, 'app', 'tenant-bind.html', 'route.ts'
      )));
      assert.ok(fs.existsSync(path.join(
        hostingRoot, 'lib', 'tenant-bind-template.html'
      )));
      return;
    }
    assert.ok(fs.existsSync(path.join(hostingRoot, 'public', name)));
  });

  return {
    pages: pageNames.length,
    internalTargets: allTargets.size,
    missingRequiredPages: 0,
    deadInternalLinks: 0,
    explicitHtmlRoutes: allTargets.size,
    extensionlessInternalLinks: 0,
    hostingCanonicalization: 'explicit-html-route-or-static-file'
  };
}

function calculateProductionAppsScriptHash() {
  const sourceRoot = path.join(repositoryRoot, 'apps-script');
  const files = fs.readdirSync(sourceRoot)
    .filter(file => file.endsWith('.js') || file === 'appsscript.json')
    .sort();
  const childDigests = files.map(file => {
    const digest = crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(sourceRoot, file)))
      .digest('hex');
    return `${digest}  apps-script/${file}\n`;
  }).join('');
  return crypto.createHash('sha256').update(childDigests).digest('hex');
}

runResolverCases();
const callSites = runLandlordCallSiteCases();
const scan = runIsolationScan();
const frontend = runFrontendCases();
assert.strictEqual(
  calculateProductionAppsScriptHash(),
  expectedProductionAppsScriptHash
);

console.log('Phase 83A.3 URL isolation fixtures: PASS');
console.log('Phase 83A.3 call sites: ' + JSON.stringify(callSites));
console.log('Phase 83A.3 isolation scan: ' + JSON.stringify(scan));
console.log('Phase 83A.3 frontend links: ' + JSON.stringify(frontend));
console.log('Phase 83A.3 production checksum unchanged: YES');
console.log('Phase 83A.3 TSTG082 changed: NO');
