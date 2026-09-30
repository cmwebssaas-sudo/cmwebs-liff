import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const page = readFileSync(new URL('../landlord-tenant-create.html', import.meta.url), 'utf8');
const detailPage = readFileSync(new URL('../landlord-tenant-detail.html', import.meta.url), 'utf8');
const dispatcher = readFileSync(new URL('../apps-script/程式碼.js', import.meta.url), 'utf8');
const initiated = readFileSync(new URL('../apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js', import.meta.url), 'utf8');

function extractFunction(source, name) {
  const match = new RegExp(`function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `${name} must exist`);
  const start = source.indexOf('{', match.index);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}' && --depth === 0) return source.slice(match.index, index + 1);
  }
  throw new Error(`${name} is not closed`);
}

function makeDispatcher() {
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
    landlordEmailAuthPostRequires_(request, fields) {
      return fields.every(field => String(request[field] ?? '').trim())
        ? null
        : { success: false, code: 'AUTH_REQUIRED' };
    },
    resolveLandlordPrincipal_(request) {
      return request.landlord_session_token === 'VALID'
        ? {
            success: true,
            data: {
              principal_line_user_id: 'SERVER_RESOLVED',
              user: { user_id: 'U1' },
              workspace: { workspace_id: 'W1' },
              membership: { membership_id: 'M1', role: 'owner' }
            }
          }
        : { success: false, code: 'SESSION_EXPIRED' };
    },
    workspaceLandlordCheckPolicy_() {
      return { success: true, code: 'OK' };
    },
    htmlBridgeOutput_(result, requestId) {
      return { transport: 'bridge', result, requestId };
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput(value) {
        return { transport: 'fallback', value, setMimeType() { return this; } };
      }
    },
    tenantLiffSigningIsAuthRequest_: () => false,
    tenantLiffSigningIsInviteAuthRequest_: () => false,
    landlordContractSigningReviewIsAuthRequest_: () => false,
    landlordContractSigningReviewIsExchangeRequest_: () => false,
    landlordPaperContractBackfillIsRequest_: () => false,
    landlordInitiatedContractIsRequest_: body => {
      const request = typeof body === 'string' ? JSON.parse(body) : body;
      return [
        'landlord_contract_initiated_init',
        'landlord_contract_initiate_new',
        'landlord_contract_initiate_renewal',
        'landlord_contract_initiate_renewal_direct'
      ].includes(request && request.action);
    },
    tenantContractArtifactIsUploadRequest_: () => false,
    tenantContractSigningIsSubmitRequest_: () => false,
    legacyContractSignedSyncIsRequest_: () => false,
    handleLineWebhook_: () => ({ success: false, code: 'WEBHOOK_FALLBACK' })
  };

  context.getLandlordTenantCreateInitByLineUid_ = (...args) => {
    calls.push({ action: 'landlord_tenant_create_init', args });
    return { success: true, code: 'OK', data: { action: 'landlord_tenant_create_init' } };
  };
  context.landlordInitiatedContractListByAccess_ = (...args) => {
    calls.push({ action: 'landlord_contract_initiated_init', args });
    return { success: true, code: 'OK', data: { action: 'landlord_contract_initiated_init' } };
  };
  context.landlordInitiatedContractCreateNew_ = (...args) => {
    calls.push({ action: 'landlord_contract_initiate_new', args });
    return { success: true, code: 'OK', data: { action: 'landlord_contract_initiate_new' } };
  };
  context.landlordInitiatedContractCreateRenewal_ = (...args) => {
    calls.push({ action: 'landlord_contract_initiate_renewal', args });
    return { success: true, code: 'OK', data: { action: 'landlord_contract_initiate_renewal' } };
  };
  context.landlordInitiatedContractCreateDirectRenewal_ = (...args) => {
    calls.push({ action: 'landlord_contract_initiate_renewal_direct', args });
    return { success: true, code: 'OK', data: { action: 'landlord_contract_initiate_renewal_direct' } };
  };
  context.landlordInitiatedContractError_ = (code, message) => ({ success: false, code, message });
  context.landlordPaperContractBackfillByAccess_ = (...args) => {
    calls.push({ action: 'landlord_contract_paper_backfill', args });
    return { success: true, code: 'OK', data: { mode: 'paper_backfill' } };
  };
  context.getLandlordContractDocumentsInitByLineUid_ = (...args) => {
    calls.push({ action: 'landlord_contract_documents_init', args });
    return { success: true, code: 'OK', data: { documents: [] } };
  };
  context.getLandlordContractDocumentDownloadByLineUid_ = (...args) => {
    calls.push({ action: 'landlord_contract_document_download', args });
    return { success: true, code: 'OK', data: { document: {} } };
  };
  context.uploadLandlordContractDocumentByLineUid_ = (...args) => {
    calls.push({ action: 'landlord_contract_document_upload', args });
    return { success: true, code: 'OK', data: { document_id: 'D1' } };
  };

  vm.createContext(context);
  vm.runInContext([
    'repairRouteIsAction_',
    'repairRouteDecodeFormBody_',
    'repairRouteQueryAction_',
    'repairRouteRequestFromPostBody_'
  ].map(name => extractFunction(dispatcher, name)).join('\n'), context);
  vm.runInContext(extractFunction(dispatcher, 'resolveLandlordQuickLeaseBridgeAccess_'), context);
  vm.runInContext(extractFunction(dispatcher, 'doPost'), context);
  return { context, calls };
}

function request(action, token = 'VALID') {
  return {
    action,
    response_mode: 'bridge',
    landlord_session_token: token,
    request_id: 'REQ',
    property_id: 'P1',
    room_id: 'R506',
    previous_contract_id: '',
    tenant_id: '',
    supersede_contract_id: '',
    start_date: '2026-09-11',
    end_date: '2027-09-09',
    rent_amount: '8500',
    management_fee: '500',
    deposit_amount: '18000'
  };
}

test('desktop Email quick-lease actions use the server-resolved principal', () => {
  for (const action of [
    'landlord_tenant_create_init',
    'landlord_contract_initiated_init',
    'landlord_contract_initiate_new'
  ]) {
    const { context, calls } = makeDispatcher();
    const response = context.doPost({ postData: { contents: JSON.stringify(request(action)) } });
    assert.equal(response.transport, 'bridge', `${action} must not fall through to LINE`);
    assert.equal(response.result.code, 'OK');
    assert.equal(response.requestId, 'REQ');
    assert.equal(calls.length, 1);
    if (action === 'landlord_tenant_create_init') {
      assert.equal(calls[0].args[0], 'SERVER_RESOLVED');
    } else if (action === 'landlord_contract_initiated_init') {
      assert.equal(calls[0].args[0].user.user_id, 'U1');
    } else {
      assert.equal(calls[0].args[0].user.user_id, 'U1');
      assert.equal(calls[0].args[1].room_id, 'R506');
    }
  }
});

test('desktop Email quick-lease bridge fails closed without a valid session', () => {
  const { context, calls } = makeDispatcher();
  const response = context.doPost({
    postData: { contents: JSON.stringify(request('landlord_contract_initiate_new', 'EXPIRED')) }
  });
  assert.equal(response.transport, 'bridge');
  assert.equal(response.result.code, 'SESSION_EXPIRED');
  assert.equal(calls.length, 0);
});

test('desktop quick-lease page loads the shared Email bridge and delegates authenticated actions', () => {
  assert.match(page, /landlord-auth\.js/);
  assert.match(page, /landlord-api\.js/);
  assert.match(page, /requestLandlordTenantCreateAction\(/);
  assert.match(page, /landlord_tenant_create_init/);
  assert.match(page, /landlord_contract_initiate_new/);
});

test('desktop Email paper backfill accepts only a scoped, authenticated JSON payload', () => {
  const input = { room_id: 'R506', paper_contract_file: { file_name: 'signed.pdf', base64: 'dGVzdA==' } };
  const valid = makeDispatcher();
  const response = valid.context.doPost({ postData: { contents: JSON.stringify({
    ...request('landlord_contract_paper_backfill'), input_json: JSON.stringify(input)
  }) } });
  assert.equal(response.transport, 'bridge');
  assert.equal(response.result.code, 'OK');
  assert.equal(valid.calls.length, 1);
  assert.equal(valid.calls[0].args[0].workspace.workspace_id, 'W1');
  assert.deepEqual(JSON.parse(JSON.stringify(valid.calls[0].args[1])), input);

  for (const invalid of [
    { ...request('landlord_contract_paper_backfill', 'EXPIRED'), input_json: JSON.stringify(input) },
    { ...request('landlord_contract_paper_backfill'), input_json: '{bad' }
  ]) {
    const attempt = makeDispatcher();
    const rejected = attempt.context.doPost({ postData: { contents: JSON.stringify(invalid) } });
    assert.equal(rejected.transport, 'bridge');
    assert.equal(rejected.result.success, false);
    assert.equal(attempt.calls.length, 0, 'invalid requests must not touch paper-contract data');
  }
});

test('desktop paper upload uses Email session bridge; mobile retains verified LINE session', () => {
  assert.match(page, /async function postLandlordPaperBackfill\(input\)[\s\S]*?desktopEmailSessionActive\(\)/);
  assert.match(page, /auth\.request\(\s*'landlord_contract_paper_backfill'/);
  assert.match(page, /input_json:\s*JSON\.stringify\(input\)/);
  assert.match(page, /if \(!LANDLORD_REVIEW_SESSION_TOKEN\) throw new Error\('房東審核身分驗證已失效/);
});

test('desktop Email identity-document read and upload use server-resolved landlord authority', () => {
  for (const action of [
    'landlord_contract_documents_init',
    'landlord_contract_document_download',
    'landlord_contract_document_upload'
  ]) {
    const { context, calls } = makeDispatcher();
    const response = context.doPost({ postData: { contents: JSON.stringify({
      ...request(action), tenant_id: 'T506', contract_id: 'C506',
      document_id: 'D506', document_type: 'identity_front',
      file_name: 'front.jpg', mime_type: 'image/jpeg', base64: 'dGVzdA==',
      idempotency_key: 'UPLOAD1', line_user_id: 'SPOOFED'
    }) } });
    assert.equal(response.transport, 'bridge');
    assert.equal(response.result.code, 'OK');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].args[0], 'SERVER_RESOLVED');
  }
  const { context, calls } = makeDispatcher();
  const denied = context.doPost({ postData: { contents: JSON.stringify(request('landlord_contract_document_upload', 'EXPIRED')) } });
  assert.equal(denied.transport, 'bridge');
  assert.equal(denied.result.success, false);
  assert.equal(calls.length, 0);
});

test('desktop tenant detail reads and uploads identity files through Email bridge', () => {
  assert.match(detailPage, /function jsonpRequest\(action, params\)\s*\{[\s\S]*?LANDLORD_AUTH\.request\(action/);
  assert.match(detailPage, /async function postJsonBody\(payload\)\s*\{[\s\S]*?LANDLORD_AUTH\.request\(\s*'landlord_contract_document_upload'/);
});

console.log('Desktop quick-lease Email bridge tests passed.');
