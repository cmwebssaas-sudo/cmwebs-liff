/**
 * Phase 115 disposable staging Workspace-isolation smoke test.
 *
 * This module is intentionally excluded from every Production release tree.
 * It creates two isolated staging-only business fixtures through the existing
 * landlord onboarding and tenant-lease workflows, verifies the runtime read
 * and RBAC boundaries, then removes only rows carrying this fixture marker.
 *
 * It does not expose an HTTP route, accept caller-provided identities, enqueue
 * notifications, call LINE transport, or access a Production Spreadsheet.
 */

const STAGING_PHASE115_MARKER_ = 'PHASE115_DISPOSABLE';

// Phase 115.2 keeps opaque staging fixture IDs here between short manual
// executions. This is metadata only; it never contains credentials and is
// deliberately retained after cleanup as test evidence.
const STAGING_PHASE115_2_CHECKPOINT_KEY_ =
  'CMWEBS_PHASE115_2_ISOLATION_CHECKPOINT';
const STAGING_PHASE115_2_BILL_MONTH_ = '2026-07';

const STAGING_PHASE115_IDENTITIES_ = {
  A: {
    landlord_line_user_id: 'UISO115LANDLORDA0000000000000000',
    tenant_line_user_id: 'UISO115TENANTA0000000000000000000',
    landlord_name: 'PHASE115 Landlord A',
    workspace_name: 'PHASE115 Workspace A',
    property_name: 'PHASE115 Property A',
    room_name: 'PHASE115 Room A',
    tenant_name: 'PHASE115 Tenant A',
    landlord_phone: '0900115001',
    tenant_phone: '0900115011'
  },
  B: {
    landlord_line_user_id: 'UISO115LANDLORDB0000000000000000',
    tenant_line_user_id: 'UISO115TENANTB0000000000000000000',
    landlord_name: 'PHASE115 Landlord B',
    workspace_name: 'PHASE115 Workspace B',
    property_name: 'PHASE115 Property B',
    room_name: 'PHASE115 Room B',
    tenant_name: 'PHASE115 Tenant B',
    landlord_phone: '0900115002',
    tenant_phone: '0900115012'
  }
};

const STAGING_PHASE115_CLEANUP_SHEETS_ = [
  'V2_liff_access_logs',
  'V2_tenant_binding_logs',
  'V2_workspace_activity_logs',
  'V2_notification_logs',
  'V2_NOTIFICATION_QUEUE',
  'V2_tenant_messages',
  'V2_bills',
  'V2_tenant_bill_view',
  'V2_tenant_home_view',
  'V2_landlord_tenant_list_view',
  'V2_contracts',
  'V2_tenants',
  'V2_rooms',
  'V2_properties',
  'V2_property_owners',
  'V2_payment_accounts',
  'V2_workspace_members',
  'V2_landlords',
  'V2_users',
  'V2_workspaces'
];


/**
 * Creates, verifies and removes two disposable Workspaces in one execution.
 * This entrypoint is for manual staging execution only.
 */
function runStagingWorkspaceIsolationSmokeTest() {
  phase115RequireStaging_();

  const ss = runtimeSpreadsheet_();
  const result = {
    success: false,
    code: 'PHASE115_NOT_COMPLETED',
    environment: 'staging',
    fixture_ids: {},
    tests: [],
    notification_transport_called: false,
    cleanup: null
  };
  let fixtureA = null;
  let fixtureB = null;

  try {
    // A previous interrupted execution must not affect the next one.
    phase115CleanupRows_(ss, []);

    fixtureA = phase115CreateFixture_(
      STAGING_PHASE115_IDENTITIES_.A
    );
    fixtureB = phase115CreateFixture_(
      STAGING_PHASE115_IDENTITIES_.B
    );

    result.fixture_ids = {
      workspace_A: phase115PublicFixture_(fixtureA),
      workspace_B: phase115PublicFixture_(fixtureB)
    };
    result.tests = phase115RunIsolationMatrix_(fixtureA, fixtureB);
    result.success = result.tests.every(function (test) {
      return test.actual === 'PASS';
    });
    result.code = result.success
      ? 'PHASE115_ISOLATION_PASS'
      : 'PHASE115_ISOLATION_FAIL';
  } catch (error) {
    result.code = error && error.code
      ? String(error.code)
      : 'PHASE115_EXECUTION_ERROR';
    result.error = String(error && error.message || error || '');
  } finally {
    result.cleanup = phase115CleanupRows_(
      ss,
      [fixtureA, fixtureB].filter(function (fixture) {
        return Boolean(fixture);
      })
    );
    SpreadsheetApp.flush();
  }

  // Apps Script editor does not display manual-function return values. Log the
  // sanitized result so the staging run has durable, reviewable evidence.
  Logger.log('[PHASE115_RESULT] ' + JSON.stringify(result));
  return result;
}


/** Removes only Phase 115 fixture rows after an interrupted manual run. */
function cleanupStagingWorkspaceIsolationFixtures() {
  phase115RequireStaging_();
  const summary = phase115CleanupRows_(runtimeSpreadsheet_(), []);
  SpreadsheetApp.flush();
  const result = {
    success: true,
    code: 'PHASE115_FIXTURES_CLEANED',
    environment: 'staging',
    cleanup: summary
  };
  Logger.log('[PHASE115_CLEANUP] ' + JSON.stringify(result));
  return result;
}


function phase115RequireStaging_() {
  if (runtimeEnvironment_() !== 'staging') {
    const error = new Error('Phase 115 is restricted to staging');
    error.code = 'STAGING_ENVIRONMENT_REQUIRED';
    throw error;
  }
}


function phase115CreateFixture_(identity) {
  const registration = registerStagingLandlordWorkspaceByLineUid_(
    '1',
    identity.landlord_line_user_id,
    identity.landlord_name,
    identity.landlord_phone,
    '',
    identity.workspace_name,
    identity.landlord_name,
    ''
  );
  phase115RequireSuccess_(registration, 'landlord registration');

  const registrationData = registration.data || {};
  const workspace = registrationData.active_workspace || {};
  const landlord = registrationData.landlord || {};
  const workspaceId = String(workspace.workspace_id || '').trim();
  const landlordId = String(landlord.landlord_id || '').trim();

  phase115Require_(workspaceId && landlordId, 'Fixture registration IDs missing');

  const payment = saveLandlordOnboardingStepByLineUid_(
    identity.landlord_line_user_id,
    'payment',
    {
      bank_code: '822',
      bank_name: 'Staging Test Bank',
      branch_name: 'Phase115',
      bank_account: identity === STAGING_PHASE115_IDENTITIES_.A
        ? '115000001'
        : '115000002',
      bank_account_name: identity.landlord_name,
      payment_note: STAGING_PHASE115_MARKER_
    }
  );
  phase115RequireSuccess_(payment, 'payment onboarding');

  const property = saveLandlordOnboardingStepByLineUid_(
    identity.landlord_line_user_id,
    'property',
    {
      property_name: identity.property_name,
      city: 'Staging',
      district: 'Phase115',
      property_address: STAGING_PHASE115_MARKER_ + ' ' + identity.property_name,
      property_type: 'apartment'
    }
  );
  phase115RequireSuccess_(property, 'property onboarding');

  const propertyId = String(
    property.data && property.data.property && property.data.property.property_id || ''
  ).trim();
  phase115Require_(propertyId, 'Fixture property ID missing');

  const room = saveLandlordOnboardingStepByLineUid_(
    identity.landlord_line_user_id,
    'room',
    {
      room_name: identity.room_name,
      rent_amount: 11500,
      management_fee: 0,
      water_fee: 0,
      electricity_fee_rate: 3.5,
      equipment_fee_rate: 0,
      payment_day: 10,
      deposit_months: 2
    }
  );
  phase115RequireSuccess_(room, 'room onboarding');

  const roomId = String(
    room.data && room.data.room && room.data.room.room_id || ''
  ).trim();
  phase115Require_(roomId, 'Fixture room ID missing');

  const completed = completeLandlordOnboardingByLineUid_(
    identity.landlord_line_user_id
  );
  phase115RequireSuccess_(completed, 'onboarding completion');

  const lease = createLandlordTenantLeaseByLineUid_(
    identity.landlord_line_user_id,
    identity.tenant_name,
    identity.tenant_phone,
    '',
    propertyId,
    roomId,
    '2026-01-01',
    '2027-12-31',
    11500,
    0,
    2,
    23000,
    10,
    3.5,
    0,
    STAGING_PHASE115_MARKER_
  );
  phase115RequireSuccess_(lease, 'tenant lease creation');

  const leaseData = lease.data || {};
  const tenant = leaseData.tenant || {};
  const contract = leaseData.contract || {};
  const tenantId = String(tenant.tenant_id || '').trim();
  const contractId = String(contract.contract_id || '').trim();
  phase115Require_(tenantId && contractId, 'Fixture tenant/contract IDs missing');

  const binding = bindTenantByLineUid_(
    identity.tenant_line_user_id,
    identity.tenant_phone
  );
  phase115RequireSuccess_(binding, 'tenant binding');

  return {
    workspace_id: workspaceId,
    landlord_id: landlordId,
    property_id: propertyId,
    room_id: roomId,
    tenant_id: tenantId,
    contract_id: contractId,
    landlord_line_user_id: identity.landlord_line_user_id,
    tenant_line_user_id: identity.tenant_line_user_id,
    tenant_phone: identity.tenant_phone,
    labels: {
      landlord_name: identity.landlord_name,
      workspace_name: identity.workspace_name,
      property_name: identity.property_name,
      room_name: identity.room_name,
      tenant_name: identity.tenant_name
    }
  };
}


function phase115RunIsolationMatrix_(fixtureA, fixtureB) {
  const tests = [];
  const accessA = workspaceLandlordResolveAccess_(
    fixtureA.landlord_line_user_id,
    { require_onboarding: true }
  );
  const accessB = workspaceLandlordResolveAccess_(
    fixtureB.landlord_line_user_id,
    { require_onboarding: true }
  );
  tests.push(phase115Test_('L-A workspace access', accessA.success === true));
  tests.push(phase115Test_('L-B workspace access', accessB.success === true));
  tests.push(phase115Test_(
    'L-A resolves only Workspace A',
    accessA.success === true && accessA.workspace.workspace_id === fixtureA.workspace_id
  ));
  tests.push(phase115Test_(
    'L-B resolves only Workspace B',
    accessB.success === true && accessB.workspace.workspace_id === fixtureB.workspace_id
  ));

  const propertiesA = getLandlordPropertiesInitByLineUid_(
    fixtureA.landlord_line_user_id,
    false
  );
  const tenantsA = getWorkspaceLandlordTenantsNativeByLineUid_(
    fixtureA.landlord_line_user_id
  );
  const propertyListA = propertiesA.data && propertiesA.data.properties || [];
  const tenantListA = tenantsA.data && tenantsA.data.tenants || [];
  tests.push(phase115Test_(
    'L-A reads Property A and not Property B',
    propertiesA.success === true &&
      phase115IncludesId_(propertyListA, 'property_id', fixtureA.property_id) &&
      !phase115IncludesId_(propertyListA, 'property_id', fixtureB.property_id)
  ));
  tests.push(phase115Test_(
    'L-A reads Tenant A and not Tenant B',
    tenantsA.success === true &&
      phase115IncludesId_(tenantListA, 'tenant_id', fixtureA.tenant_id) &&
      !phase115IncludesId_(tenantListA, 'tenant_id', fixtureB.tenant_id)
  ));

  const crossWorkspace = rbacAuthorizeRoute_(
    fixtureA.landlord_line_user_id,
    'landlord_home',
    { workspace_id: fixtureB.workspace_id }
  );
  tests.push(phase115Test_(
    'workspace_id substitution is denied',
    crossWorkspace.success === false && crossWorkspace.code === 'WORKSPACE_ACCESS_DENIED'
  ));

  const attemptedForeignSelection = getLandlordTenantCreateInitByLineUid_(
    fixtureA.landlord_line_user_id,
    fixtureB.property_id,
    fixtureB.room_id
  );
  const selectionData = attemptedForeignSelection.data || {};
  tests.push(phase115Test_(
    'property_id / room_id substitution exposes no Workspace B resource',
    attemptedForeignSelection.success === true &&
      !phase115IncludesId_(selectionData.properties || [], 'property_id', fixtureB.property_id) &&
      !phase115IncludesId_(selectionData.rooms || [], 'room_id', fixtureB.room_id)
  ));

  const canonicalA = resolveCanonicalTenantRuntimeByLineUid_(
    fixtureA.tenant_line_user_id,
    { include_bill_master: true }
  );
  const homeA = getTenantHomeByLineUid(fixtureA.tenant_line_user_id);
  const billsA = getTenantBillsRuntimePayloadByLineUid_(fixtureA.tenant_line_user_id);
  const contractA = getTenantContractInitByLineUid_(fixtureA.tenant_line_user_id);
  const messageA = getTenantMessageInitByLineUid(fixtureA.tenant_line_user_id);
  tests.push(phase115Test_(
    'T-A canonical identity resolves only Tenant A',
    canonicalA.success === true &&
      canonicalA.data.tenant_id === fixtureA.tenant_id &&
      canonicalA.data.workspace_id === fixtureA.workspace_id &&
      canonicalA.data.tenant_id !== fixtureB.tenant_id
  ));
  tests.push(phase115Test_('T-A home read', homeA.success === true));
  tests.push(phase115Test_('T-A bills read', billsA.success === true && Array.isArray(billsA.bills)));
  tests.push(phase115Test_('T-A contract read', contractA.success === true));
  tests.push(phase115Test_('T-A message read', messageA.success === true));

  const tenantToLandlord = rbacAuthorizeRoute_(
    fixtureA.tenant_line_user_id,
    'landlord_home',
    { workspace_id: fixtureA.workspace_id }
  );
  const landlordToTenant = getTenantHomeByLineUid(
    fixtureA.landlord_line_user_id
  );
  tests.push(phase115Test_(
    'tenant principal cannot use landlord route',
    tenantToLandlord.success === false
  ));
  tests.push(phase115Test_(
    'landlord principal cannot resolve tenant runtime',
    landlordToTenant.success === false
  ));

  [
    { event_type: 'bill_created', receiver_type: 'tenant', fixture: fixtureA },
    { event_type: 'tenant_repair', receiver_type: 'landlord', fixture: fixtureA },
    { event_type: 'contract_expiring', receiver_type: 'tenant', fixture: fixtureA }
  ].forEach(function (event) {
    const receiverId = event.receiver_type === 'tenant'
      ? event.fixture.tenant_id
      : event.fixture.landlord_id;
    const resolved = notificationResolveReceiver_({
      receiver_type: event.receiver_type,
      receiver_id: receiverId,
      workspace_id: event.fixture.workspace_id
    });
    const expectedLineUserId = event.receiver_type === 'tenant'
      ? event.fixture.tenant_line_user_id
      : event.fixture.landlord_line_user_id;
    tests.push(phase115Test_(
      'notification ' + event.event_type + ' resolves only Workspace A recipient',
      resolved.success === true &&
        resolved.workspace_id === fixtureA.workspace_id &&
        resolved.line_user_id === expectedLineUserId
    ));
  });

  return tests;
}


function phase115PublicFixture_(fixture) {
  return {
    workspace_id: fixture.workspace_id,
    landlord_id: fixture.landlord_id,
    tenant_id: fixture.tenant_id,
    contract_id: fixture.contract_id,
    property_id: fixture.property_id,
    room_id: fixture.room_id,
    bill_id: fixture.bill_id || '',
    bill_month: fixture.bill_month || '',
    labels: fixture.labels
  };
}


function phase115Test_(name, passed) {
  return {
    name: name,
    expected: 'PASS',
    actual: passed ? 'PASS' : 'FAIL'
  };
}


function phase115IncludesId_(rows, key, expectedId) {
  return (rows || []).some(function (row) {
    return String(row && row[key] || '').trim() === String(expectedId || '').trim();
  });
}


function phase115RequireSuccess_(result, step) {
  phase115Require_(
    result && result.success === true,
    step + ' failed: ' + String(result && result.code || 'UNKNOWN')
  );
}


function phase115Require_(condition, message) {
  if (condition) return;
  const error = new Error(message);
  error.code = 'PHASE115_FIXTURE_ERROR';
  throw error;
}


function phase115CleanupRows_(ss, fixtures) {
  const knownValues = phase115KnownValues_(fixtures || []);
  const deleted = {};

  STAGING_PHASE115_CLEANUP_SHEETS_.forEach(function (sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return;

    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(function (value) {
      return String(value || '').trim();
    });
    let count = 0;

    for (let index = values.length - 1; index >= 1; index -= 1) {
      const row = values[index];
      const matches = row.some(function (value) {
        const text = String(value === null || value === undefined ? '' : value);
        return knownValues.some(function (known) {
          return known && (text === known || text.indexOf(known) >= 0);
        });
      });
      if (matches) {
        sheet.deleteRow(index + 1);
        count += 1;
      }
    }
    if (count > 0) deleted[sheetName] = count;
  });

  return {
    marker: STAGING_PHASE115_MARKER_,
    deleted_rows_by_sheet: deleted,
    total_deleted_rows: Object.keys(deleted).reduce(function (sum, key) {
      return sum + deleted[key];
    }, 0)
  };
}


function phase115KnownValues_(fixtures) {
  const values = [
    STAGING_PHASE115_MARKER_
  ];

  Object.keys(STAGING_PHASE115_IDENTITIES_).forEach(function (key) {
    const identity = STAGING_PHASE115_IDENTITIES_[key];
    [
      identity.landlord_line_user_id,
      identity.tenant_line_user_id,
      identity.landlord_name,
      identity.workspace_name,
      identity.property_name,
      identity.room_name,
      identity.tenant_name,
      identity.landlord_phone,
      identity.tenant_phone
    ].forEach(function (value) {
      values.push(String(value || ''));
    });
  });

  (fixtures || []).forEach(function (fixture) {
    [
      fixture.workspace_id,
      fixture.landlord_id,
      fixture.tenant_id,
      fixture.contract_id,
      fixture.property_id,
      fixture.room_id
    ].forEach(function (value) {
      values.push(String(value || ''));
    });
  });

  return values.filter(function (value) {
    return value.length > 0;
  });
}


// ==================================================
// Phase 115.2 checkpointed staging-only entrypoints
// ==================================================

/** Read-only: returns the persisted Phase 115.2 fixture metadata. */
function readStagingWorkspaceIsolationCheckpoint() {
  phase115RequireStaging_();
  const checkpoint = phase1152LoadCheckpoint_();
  const result = {
    success: true,
    code: checkpoint ? 'PHASE115_2_CHECKPOINT_FOUND' : 'PHASE115_2_CHECKPOINT_EMPTY',
    environment: 'staging',
    checkpoint: checkpoint ? phase1152PublicCheckpoint_(checkpoint) : null
  };
  Logger.log('[PHASE115_2_CHECKPOINT] ' + JSON.stringify(result));
  return result;
}


/** Creates only Workspace A and saves its fixture metadata. */
function setupStagingWorkspaceIsolationFixtureA() {
  return phase1152SetupFixture_('A');
}


/** Creates only Workspace B and saves its fixture metadata. */
function setupStagingWorkspaceIsolationFixtureB() {
  return phase1152SetupFixture_('B');
}


function phase1152SetupFixture_(key) {
  phase115RequireStaging_();
  const normalizedKey = String(key || '').trim().toUpperCase();
  const identity = STAGING_PHASE115_IDENTITIES_[normalizedKey];
  phase115Require_(identity, 'Unknown Phase 115.2 fixture key');

  const checkpoint = phase1152PrepareFixtureRun_();
  checkpoint.fixtures = checkpoint.fixtures || {};

  if (checkpoint.fixtures[normalizedKey] && checkpoint.fixtures[normalizedKey].bill_id) {
    const existing = {
      success: true,
      code: 'PHASE115_2_FIXTURE_ALREADY_EXISTS',
      environment: 'staging',
      fixture: phase115PublicFixture_(checkpoint.fixtures[normalizedKey])
    };
    Logger.log('[PHASE115_2_SETUP_' + normalizedKey + '] ' + JSON.stringify(existing));
    return existing;
  }

  const fixture = phase115CreateFixture_(identity);
  const bill = phase1152CreateFixtureBill_(fixture);
  fixture.bill_id = bill.bill_id;
  fixture.bill_month = bill.bill_month;
  fixture.created_at = new Date().toISOString();

  checkpoint.fixtures[normalizedKey] = fixture;
  checkpoint.status = 'fixtures_ready';
  checkpoint.updated_at = new Date().toISOString();
  phase1152SaveCheckpoint_(checkpoint);

  const result = {
    success: true,
    code: 'PHASE115_2_FIXTURE_READY',
    environment: 'staging',
    fixture: phase115PublicFixture_(fixture)
  };
  Logger.log('[PHASE115_2_SETUP_' + normalizedKey + '] ' + JSON.stringify(result));
  return result;
}


/**
 * Creates the requested fixture bill through the staging billing-lifecycle
 * business function. It only enqueues the bill_created event; it never calls
 * the notification worker or LINE transport.
 */
function phase1152CreateFixtureBill_(fixture) {
  phase115Require_(fixture && fixture.contract_id, 'Fixture contract is required');
  const result = generateContractMonthlyBillByLineUid_(
    fixture.landlord_line_user_id,
    fixture.contract_id,
    STAGING_PHASE115_2_BILL_MONTH_,
    {
      rent_amount: 11500,
      management_fee: 0,
      electricity_amount: 0,
      equipment_amount: 0,
      other_amount: 0,
      discount_amount: 0,
      payment_due_day: 10,
      notes: STAGING_PHASE115_MARKER_
    }
  );
  phase115RequireSuccess_(result, 'fixture bill creation');
  const bill = result.data && result.data.bill || {};
  const billId = String(bill.bill_id || '').trim();
  phase115Require_(billId, 'Fixture bill ID missing');
  return {
    bill_id: billId,
    bill_month: String(bill.bill_month || STAGING_PHASE115_2_BILL_MONTH_).trim()
  };
}


/** Short, read-only landlord A/B isolation matrix. */
function runStagingWorkspaceLandlordIsolationMatrix() {
  phase115RequireStaging_();
  const fixtures = phase1152RequireReadyFixtures_();
  const tests = [];
  ['A', 'B'].forEach(function (key) {
    const own = fixtures[key];
    const foreign = fixtures[key === 'A' ? 'B' : 'A'];
    const access = workspaceLandlordResolveCanonicalScopedAccess_(
      own.landlord_line_user_id,
      { require_onboarding: true }
    );
    const home = getLandlordHomeByLineUid(own.landlord_line_user_id);
    const contracts = getLandlordContractsByLineUid_(own.landlord_line_user_id, '');
    const billing = getLandlordBillingLifecycleByLineUid_(own.landlord_line_user_id, '', '');
    const properties = getLandlordPropertiesInitByLineUid_(own.landlord_line_user_id, false);
    const tenants = getWorkspaceLandlordTenantsNativeByLineUid_(own.landlord_line_user_id);
    const propertyRows = properties.data && properties.data.properties || [];
    const tenantRows = tenants.data && tenants.data.tenants || [];
    const contractRows = contracts.data && contracts.data.contracts || [];
    const billRows = billing.data && billing.data.bills || [];

    tests.push(phase1152Test_(
      'landlord_' + key + ' home resolves own workspace',
      'allow own workspace',
      access.success === true &&
        String(access.workspace && access.workspace.workspace_id || '') === own.workspace_id &&
        home.success === true
    ));
    tests.push(phase1152Test_(
      'landlord_' + key + ' contracts and billing include own fixture',
      'allow own contract and bill',
      contracts.success === true && billing.success === true &&
        phase115IncludesId_(contractRows, 'contract_id', own.contract_id) &&
        phase115IncludesId_(billRows, 'bill_id', own.bill_id)
    ));
    tests.push(phase1152Test_(
      'landlord_' + key + ' property and tenant list exclude foreign workspace',
      'foreign property and tenant absent',
      properties.success === true && tenants.success === true &&
        phase115IncludesId_(propertyRows, 'property_id', own.property_id) &&
        !phase115IncludesId_(propertyRows, 'property_id', foreign.property_id) &&
        phase115IncludesId_(tenantRows, 'tenant_id', own.tenant_id) &&
        !phase115IncludesId_(tenantRows, 'tenant_id', foreign.tenant_id)
    ));
    const workspaceSwap = rbacAuthorizeRoute_(
      own.landlord_line_user_id,
      'landlord_home',
      { workspace_id: foreign.workspace_id }
    );
    tests.push(phase1152Test_(
      'landlord_' + key + ' workspace_id substitution',
      'fail closed',
      workspaceSwap.success === false && workspaceSwap.code === 'WORKSPACE_ACCESS_DENIED'
    ));
    const foreignSelection = getLandlordTenantCreateInitByLineUid_(
      own.landlord_line_user_id,
      foreign.property_id,
      foreign.room_id
    );
    const selectionData = foreignSelection.data || {};
    tests.push(phase1152Test_(
      'landlord_' + key + ' property_id and room_id substitution',
      'foreign resources absent',
      foreignSelection.success === true &&
        !phase115IncludesId_(selectionData.properties || [], 'property_id', foreign.property_id) &&
        !phase115IncludesId_(selectionData.rooms || [], 'room_id', foreign.room_id)
    ));
    tests.push(phase1152Test_(
      'landlord_' + key + ' contract_id and bill_id are workspace-scoped',
      'foreign contract and bill absent',
      !phase115IncludesId_(contractRows, 'contract_id', foreign.contract_id) &&
        !phase115IncludesId_(billRows, 'bill_id', foreign.bill_id)
    ));
  });
  return phase1152RecordMatrix_('landlord_matrix', tests);
}


/** Short, read-only tenant and selector-substitution matrix. */
function runStagingWorkspaceTenantIsolationMatrix() {
  phase115RequireStaging_();
  const fixtures = phase1152RequireReadyFixtures_();
  const tests = [];
  ['A', 'B'].forEach(function (key) {
    const own = fixtures[key];
    const foreign = fixtures[key === 'A' ? 'B' : 'A'];
    const canonical = resolveCanonicalTenantRuntimeByLineUid_(
      own.tenant_line_user_id,
      { include_bill_master: true }
    );
    const home = getTenantHomeByLineUid(own.tenant_line_user_id);
    const bills = getTenantBillsRuntimePayloadByLineUid_(own.tenant_line_user_id);
    const contract = getTenantContractInitByLineUid_(own.tenant_line_user_id);
    const messages = getTenantMessageInitByLineUid(own.tenant_line_user_id);
    const billRows = bills.bills || bills.data && bills.data.bills || [];

    tests.push(phase1152Test_(
      'tenant_' + key + ' canonical identity and home',
      'allow own tenant runtime',
      canonical.success === true && home.success === true &&
        String(canonical.data && canonical.data.tenant_id || '') === own.tenant_id &&
        String(canonical.data && canonical.data.workspace_id || '') === own.workspace_id
    ));
    tests.push(phase1152Test_(
      'tenant_' + key + ' bills, contract and messages',
      'allow own tenant resources',
      bills.success === true && contract.success === true && messages.success === true &&
        phase115IncludesId_(billRows, 'bill_id', own.bill_id) &&
        !phase115IncludesId_(billRows, 'bill_id', foreign.bill_id)
    ));
    const landlordRoute = rbacAuthorizeRoute_(
      own.tenant_line_user_id,
      'landlord_home',
      { workspace_id: own.workspace_id }
    );
    const landlordAsTenant = getTenantHomeByLineUid(own.landlord_line_user_id);
    tests.push(phase1152Test_(
      'tenant_' + key + ' cannot use landlord routes',
      'fail closed',
      landlordRoute.success === false && landlordAsTenant.success === false
    ));

    // Tenant routes derive identity from the verified LINE principal and do
    // not accept these selectors as an authority source. Their public home
    // payload intentionally omits workspace_id, so prove the identity chain
    // from the canonical resolver instead of treating a missing display field
    // as a security failure. A hostile selector is safe only when it has no
    // effect on the resolved tenant / workspace chain.
    [
      ['tenant_id', foreign.tenant_id],
      ['workspace_id', foreign.workspace_id],
      ['property_id', foreign.property_id],
      ['room_id', foreign.room_id],
      ['contract_id', foreign.contract_id]
    ].forEach(function (entry) {
      const selector = {};
      selector[entry[0]] = entry[1];
      const auth = rbacAuthorizeRoute_(own.tenant_line_user_id, 'tenant_home', selector);
      const stableHome = getTenantHomeByLineUid(own.tenant_line_user_id);
      const stableIdentity = resolveCanonicalTenantRuntimeByLineUid_(
        own.tenant_line_user_id,
        { include_bill_master: false }
      );
      tests.push(phase1152Test_(
        'tenant_' + key + ' ' + entry[0] + ' substitution cannot change identity',
        'selector ignored; authenticated tenant chain remains canonical',
        auth.success === true && stableHome.success === true &&
          stableIdentity.success === true &&
          String(stableIdentity.data && stableIdentity.data.tenant_id || '') === own.tenant_id &&
          String(stableIdentity.data && stableIdentity.data.workspace_id || '') === own.workspace_id
      ));
    });
  });
  return phase1152RecordMatrix_('tenant_matrix', tests);
}


/** Creates three pending staging queue jobs and verifies their A-only receiver resolution. */
function runStagingWorkspaceNotificationIsolationMatrix() {
  phase115RequireStaging_();
  const fixtures = phase1152RequireReadyFixtures_();
  const fixtureA = fixtures.A;
  const fixtureB = fixtures.B;
  const events = [
    {
      event_type: 'bill_created',
      receiver_type: 'tenant',
      receiver_id: fixtureA.tenant_id,
      actor_type: 'system',
      actor_id: 'phase115_2_fixture',
      resource_type: 'bill',
      resource_id: fixtureA.bill_id,
      variables: {
        tenant_name: fixtureA.labels.tenant_name,
        month: fixtureA.bill_month,
        amount: '11,500',
        due_date: '2026-07-10'
      }
    },
    {
      event_type: 'tenant_repair',
      receiver_type: 'landlord',
      receiver_id: fixtureA.landlord_id,
      actor_type: 'tenant',
      actor_id: fixtureA.tenant_id,
      resource_type: 'repair_ticket',
      resource_id: STAGING_PHASE115_MARKER_ + ':repair:' + fixtureA.tenant_id,
      variables: {
        tenant_name: fixtureA.labels.tenant_name,
        room_name: fixtureA.labels.room_name,
        title: 'Phase 115.2 repair isolation check',
        body: 'Staging-only disposable notification fixture.'
      }
    },
    {
      event_type: 'contract_expiring',
      receiver_type: 'tenant',
      receiver_id: fixtureA.tenant_id,
      actor_type: 'system',
      actor_id: 'phase115_2_contract_worker',
      resource_type: 'contract',
      resource_id: fixtureA.contract_id,
      variables: {
        tenant_name: fixtureA.labels.tenant_name,
        end_date: '2027-12-31'
      }
    }
  ];
  const tests = [];
  events.forEach(function (event) {
    const resolved = notificationResolveReceiver_({
      receiver_type: event.receiver_type,
      receiver_id: event.receiver_id,
      workspace_id: fixtureA.workspace_id
    });
    const expectedLineUserId = event.receiver_type === 'tenant'
      ? fixtureA.tenant_line_user_id
      : fixtureA.landlord_line_user_id;
    const queued = notificationQueueEnqueue_({
      receiver: {
        receiver_type: event.receiver_type,
        receiver_id: event.receiver_id,
        workspace_id: fixtureA.workspace_id
      },
      event_type: event.event_type,
      event_id: STAGING_PHASE115_MARKER_ + ':' + event.event_type + ':' + fixtureA.workspace_id,
      actor_type: event.actor_type,
      actor_id: event.actor_id,
      resource_type: event.resource_type,
      resource_id: event.resource_id,
      template_key: event.event_type,
      variables: event.variables,
      source: 'phase115_2_isolation_test',
      reference_id: STAGING_PHASE115_MARKER_ + ':' + event.event_type + ':' + fixtureA.workspace_id,
      metadata: {
        phase_marker: STAGING_PHASE115_MARKER_,
        fixture_workspace_id: fixtureA.workspace_id
      }
    });
    const queuedJob = queued.success && queued.data
      ? notificationQueueRows_(notificationQueueEnsureSheet_()).filter(function (row) {
          return String(row.id || '') === String(queued.data.queue_id || '');
        })[0]
      : null;
    let payload = {};
    try {
      payload = JSON.parse(String(queuedJob && queuedJob.payload || '{}'));
    } catch (error) {
      payload = {};
    }
    const envelopeMatches =
      payload.event_id === STAGING_PHASE115_MARKER_ + ':' + event.event_type + ':' + fixtureA.workspace_id &&
      payload.workspace_id === fixtureA.workspace_id &&
      payload.actor_type === event.actor_type &&
      payload.actor_id === event.actor_id &&
      payload.resource_type === event.resource_type &&
      payload.resource_id === event.resource_id &&
      payload.receiver_type === event.receiver_type &&
      payload.receiver_id === event.receiver_id;
    tests.push(phase1152Test_(
      'notification ' + event.event_type + ' resolves and queues only Workspace A recipient',
      'Workspace A recipient and complete canonical envelope; never Workspace B',
      resolved.success === true && queued.success === true &&
        envelopeMatches === true &&
        resolved.workspace_id === fixtureA.workspace_id &&
        resolved.line_user_id === expectedLineUserId &&
        resolved.line_user_id !== fixtureB.tenant_line_user_id &&
        resolved.line_user_id !== fixtureB.landlord_line_user_id
    ));
  });
  return phase1152RecordMatrix_('notification_matrix', tests);
}


/** Deletes Phase 115.2 business rows while retaining checkpoint metadata. */
function cleanupStagingWorkspaceIsolationCheckpointFixtures() {
  phase115RequireStaging_();
  const checkpoint = phase1152LoadCheckpoint_();
  const fixtures = checkpoint && checkpoint.fixtures || {};
  const summary = phase115CleanupRows_(
    runtimeSpreadsheet_(),
    Object.keys(fixtures).map(function (key) { return fixtures[key]; })
  );
  SpreadsheetApp.flush();
  const verified = phase1152VerifyNoFixtureRows_(Object.keys(fixtures).map(function (key) {
    return fixtures[key];
  }));
  if (checkpoint) {
    checkpoint.status = 'cleaned';
    checkpoint.cleaned_at = new Date().toISOString();
    checkpoint.cleanup = summary;
    checkpoint.cleanup_verified = verified;
    checkpoint.updated_at = new Date().toISOString();
    phase1152SaveCheckpoint_(checkpoint);
  }
  const result = {
    success: verified === true,
    code: verified ? 'PHASE115_2_FIXTURES_CLEANED' : 'PHASE115_2_CLEANUP_INCOMPLETE',
    environment: 'staging',
    cleanup: summary,
    cleanup_verified: verified,
    checkpoint: checkpoint ? phase1152PublicCheckpoint_(checkpoint) : null
  };
  Logger.log('[PHASE115_2_CLEANUP] ' + JSON.stringify(result));
  return result;
}


function phase1152RecordMatrix_(name, tests) {
  const checkpoint = phase1152LoadCheckpoint_() || phase1152NewCheckpoint_();
  checkpoint.matrices = checkpoint.matrices || {};
  checkpoint.matrices[name] = {
    executed_at: new Date().toISOString(),
    success: tests.every(function (test) { return test.actual === 'PASS'; }),
    tests: tests
  };
  checkpoint.status = checkpoint.matrices[name].success ? 'matrix_running' : 'matrix_failed';
  checkpoint.updated_at = new Date().toISOString();
  phase1152SaveCheckpoint_(checkpoint);
  const result = {
    success: checkpoint.matrices[name].success,
    code: checkpoint.matrices[name].success ? 'PHASE115_2_MATRIX_PASS' : 'PHASE115_2_MATRIX_FAIL',
    environment: 'staging',
    matrix: name,
    tests: tests,
    checkpoint: phase1152PublicCheckpoint_(checkpoint)
  };
  Logger.log('[PHASE115_2_' + name.toUpperCase() + '] ' + JSON.stringify(result));
  return result;
}


function phase1152RequireReadyFixtures_() {
  const checkpoint = phase1152LoadCheckpoint_();
  const fixtures = checkpoint && checkpoint.fixtures || {};
  phase115Require_(fixtures.A && fixtures.B && fixtures.A.bill_id && fixtures.B.bill_id,
    'Both Phase 115.2 fixture checkpoints are required');
  return fixtures;
}


function phase1152NewCheckpoint_() {
  return {
    version: 1,
    environment: 'staging',
    marker: STAGING_PHASE115_MARKER_,
    run_id: 'PHASE115_2_' + String(new Date().getTime()),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'new',
    fixtures: {},
    matrices: {}
  };
}


/** Starts a fresh fixture run after a verified cleanup while retaining history. */
function phase1152PrepareFixtureRun_() {
  const checkpoint = phase1152LoadCheckpoint_() || phase1152NewCheckpoint_();
  if (checkpoint.status !== 'cleaned') return checkpoint;

  const history = Array.isArray(checkpoint.history) ? checkpoint.history : [];
  history.push({
    run_id: checkpoint.run_id || '',
    cleaned_at: checkpoint.cleaned_at || '',
    fixtures: checkpoint.fixtures || {},
    matrices: checkpoint.matrices || {},
    cleanup_verified: checkpoint.cleanup_verified === true
  });
  checkpoint.history = history.slice(-5);
  checkpoint.run_id = 'PHASE115_2_' + String(new Date().getTime());
  checkpoint.fixtures = {};
  checkpoint.matrices = {};
  checkpoint.status = 'new';
  checkpoint.cleaned_at = '';
  checkpoint.cleanup = {};
  checkpoint.cleanup_verified = false;
  checkpoint.updated_at = new Date().toISOString();
  phase1152SaveCheckpoint_(checkpoint);
  return checkpoint;
}


function phase1152LoadCheckpoint_() {
  const raw = PropertiesService.getScriptProperties().getProperty(
    STAGING_PHASE115_2_CHECKPOINT_KEY_
  );
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && parsed.environment === 'staging' ? parsed : null;
  } catch (error) {
    const failure = new Error('Phase 115.2 checkpoint is invalid');
    failure.code = 'PHASE115_2_CHECKPOINT_INVALID';
    throw failure;
  }
}


function phase1152SaveCheckpoint_(checkpoint) {
  PropertiesService.getScriptProperties().setProperty(
    STAGING_PHASE115_2_CHECKPOINT_KEY_,
    JSON.stringify(checkpoint)
  );
}


function phase1152PublicCheckpoint_(checkpoint) {
  const publicFixtures = {};
  Object.keys(checkpoint.fixtures || {}).forEach(function (key) {
    publicFixtures[key] = phase115PublicFixture_(checkpoint.fixtures[key]);
  });
  return {
    version: checkpoint.version,
    environment: checkpoint.environment,
    marker: checkpoint.marker,
    status: checkpoint.status,
    created_at: checkpoint.created_at,
    updated_at: checkpoint.updated_at,
    cleaned_at: checkpoint.cleaned_at || '',
    fixtures: publicFixtures,
    matrices: checkpoint.matrices || {},
    cleanup_verified: checkpoint.cleanup_verified === true
  };
}


function phase1152Test_(name, expected, passed) {
  return {
    name: name,
    expected: expected,
    actual: passed ? 'PASS' : 'FAIL'
  };
}


function phase1152VerifyNoFixtureRows_(fixtures) {
  const knownValues = phase115KnownValues_(fixtures || []);
  const ss = runtimeSpreadsheet_();
  return STAGING_PHASE115_CLEANUP_SHEETS_.every(function (sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return true;
    const values = sheet.getDataRange().getValues();
    return values.slice(1).every(function (row) {
      return !row.some(function (value) {
        const text = String(value === null || value === undefined ? '' : value);
        return knownValues.some(function (known) {
          return known && (text === known || text.indexOf(known) >= 0);
        });
      });
    });
  });
}
