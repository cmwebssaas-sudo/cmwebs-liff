import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dispatcherSource = readFileSync(
  new URL('../apps-script/程式碼.js', import.meta.url),
  'utf8'
);

const actions = [
  'landlord_arrears',
  'landlord_billing_init',
  'landlord_contract_requests_init',
  'landlord_bill_manual_settlement_status',
  'landlord_notifications_init',
  'landlord_payment_reports_init',
  'landlord_revenue_dashboard_init',
  'landlord_workspace_context'
];

function extractFunctionSource(source, functionName) {
  const match = new RegExp(`function\\s+${functionName}\\s*\\(`).exec(source);
  assert.ok(match, `${functionName} must exist`);

  const bodyStart = source.indexOf('{', match.index);
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

    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(match.index, index + 1);
    }
  }

  throw new Error(`unterminated ${functionName}`);
}

function createDispatcherContext() {
  const calls = [];
  const context = {
    JSON,
    String,
    Object,
    Error,
    Number,
    Math,
    Date,
    runtimeSnapshotBegin_() {},
    runtimeSnapshotFinish_() {},
    landlordEmailAuthPostRequires_() {
      return null;
    },
    resolveLandlordPrincipal_() {
      return {
        success: true,
        data: {
          principal_line_user_id: 'line-fixture'
        }
      };
    },
    htmlBridgeOutput_(result, requestId) {
      return {
        transport: 'bridge',
        action: result.data.action,
        requestId
      };
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput(value) {
        return {
          transport: 'fallback',
          value,
          setMimeType() {
            return this;
          }
        };
      }
    },
      tenantLiffSigningIsAuthRequest_: () => false,
      tenantLiffSigningIsInviteAuthRequest_: () => false,
      landlordContractSigningReviewIsAuthRequest_: () => false,
      landlordContractSigningReviewIsExchangeRequest_: () => false,
      landlordPaperContractBackfillIsRequest_: () => false,
      landlordInitiatedContractIsRequest_: () => false,
      tenantContractArtifactIsUploadRequest_: () => false,
      tenantContractSigningIsSubmitRequest_: () => false,
      legacyContractSignedSyncIsRequest_: () => false,
      handleLineWebhook_: () => ({ success: true, code: 'WEBHOOK_FALLBACK' })
  };

  actions.forEach((action) => {
    context[
      action === 'landlord_arrears'
        ? 'getWorkspaceLandlordArrearsNativeByLineUid_'
        : action === 'landlord_billing_init'
          ? 'getLandlordBillingInitByLineUid_'
          : action === 'landlord_contract_requests_init'
            ? 'getWorkspaceLandlordContractRequestsInitByLineUid_'
            : action === 'landlord_bill_manual_settlement_status'
              ? 'getManualSettlementStatusByLineUid_'
              : action === 'landlord_notifications_init'
              ? 'getLandlordNotificationsInitByLineUid_'
              : action === 'landlord_payment_reports_init'
                ? 'getWorkspaceLandlordPaymentReportsInitByLineUid_'
                : action === 'landlord_revenue_dashboard_init'
                  ? 'getLandlordRevenueDashboardByLineUid_'
                  : 'getLandlordWorkspaceContextByLineUid_'
    ] = (...args) => {
      calls.push({ action, args });
      return { success: true, data: { action } };
    };
  });

  vm.createContext(context);
  vm.runInContext(
    dispatcherSource.slice(dispatcherSource.indexOf('function doPost(e)')),
    context
  );

  return { context, calls };
}

test('desktop landlord read actions return the iframe bridge response', () => {
  for (const action of actions) {
    const { context, calls } = createDispatcherContext();
    const request = {
      action,
      response_mode: 'bridge',
      landlord_session_token: 'session-fixture',
      request_id: `request-${action}`,
      bill_month: '2026-09',
      property_id: 'property-fixture',
      status_filter: 'unread',
      event_filter: 'payment_report',
      range: '12m'
    };

    const response = context.doPost({
      postData: { contents: JSON.stringify(request) }
    });

    assert.equal(
      response.transport,
      'bridge',
      `${action} must resolve through htmlBridgeOutput_ for desktop Email`
    );
    assert.equal(response.action, action);
    assert.equal(response.requestId, request.request_id);
    assert.equal(calls.length, 1, `${action} must invoke one protected read handler`);
  }
});

test('the doPost bridge branch is present for every desktop read action', () => {
  const doPostSource = extractFunctionSource(dispatcherSource, 'doPost');

  for (const action of actions) {
    assert.match(
      doPostSource,
      new RegExp(`useBridge\\s*&&\\s*action\\s*===\\s*'${action}'`),
      `${action} must have an explicit bridge dispatch`
    );
  }
});

function assertDesktopEmailActionSource(path, readAction, writeAction) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const assertSource = extractFunctionSource(
    source,
    'assertDesktopEmailActionSupported'
  );
  const context = {
    Error,
    isEmailAuthSession: () => true,
    desktopEmailUnsupportedError: () => {
      const error = new Error('desktop action unsupported');
      error.code = 'DESKTOP_EMAIL_UNSUPPORTED';
      return error;
    }
  };

  vm.createContext(context);
  vm.runInContext(`this.assertAction = ${assertSource}`, context);

  assert.doesNotThrow(
    () => context.assertAction(readAction),
    `${path} must allow the desktop read action ${readAction}`
  );
  assert.throws(
    () => context.assertAction(writeAction),
    (error) => error && error.code === 'DESKTOP_EMAIL_UNSUPPORTED',
    `${path} must keep the desktop write action ${writeAction} protected`
  );
}

test('desktop pages allow read-only bridge actions while keeping writes protected', () => {
  assertDesktopEmailActionSource(
    '../landlord-arrears.html',
    'landlord_arrears',
    'landlord_bill_manual_settle'
  );
  assertDesktopEmailActionSource(
    '../landlord-contract-requests.html',
    'landlord_contract_requests_init',
    'landlord_contract_request_update'
  );
});
