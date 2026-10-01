import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

// Execute real page functions; only browser I/O and the API boundary are fixtures.
function pageRuntime(page, search = '?tenant_id=T-fixture') {
  const html = readFileSync(new URL('../' + page, import.meta.url), 'utf8');
  const nodes = new Map();
  const makeNode = (tag = 'div', attrs = '') => {
    const attributes = Object.fromEntries([...attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(m => [m[1], m[2] ?? '']));
    const node = {
      tagName: tag.toUpperCase(), attributes, value: attributes.value || '', files: [],
      checked: false, disabled: 'disabled' in attributes, readOnly: 'readonly' in attributes,
      hidden: 'hidden' in attributes, textContent: '', children: [], listeners: {},
      style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      getAttribute: key => attributes[key] ?? null,
      setAttribute(key, value) { attributes[key] = value; },
      submit() { document.onSubmit?.(this); },
      addEventListener(key, fn) { this.listeners[key] = fn; },
      appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
      removeChild(child) { this.children = this.children.filter(n => n !== child); },
      querySelector(selector) {
        const action = selector.match(/\[data-action="([^"]+)"\]/)?.[1];
        if (action) return this.actions?.[action] || null;
        return null;
      },
      querySelectorAll(selector) {
        const attr = selector.match(/^\[([\w-]+)\]$/)?.[1];
        return attr ? (this.subnodes || []).filter(n => n.getAttribute(attr) !== null) : [];
      }, focus() {}, scrollIntoView() {},
      set innerHTML(value) {
        for (const id of this.renderedIds || []) nodes.delete(id);
        this.renderedIds = [];
        this.markup = String(value); this.children = []; this.subnodes = [];
        for (const match of this.markup.matchAll(/<(input|select|button|div|section|form|span|p|a)\b([^>]*)>/g)) {
          const id = match[2].match(/\bid="([^"]+)"/)?.[1];
          const child = makeNode(match[1], match[2]);
          this.subnodes.push(child);
          if (id) { nodes.set(id, child); this.renderedIds.push(id); }
        }
        this.actions = {};
        for (const match of this.markup.matchAll(/data-action="([^"]+)"/g)) this.actions[match[1]] = makeNode('button');
      },
      get innerHTML() { return this.markup || ''; }
    };
    if (tag === 'iframe') node.contentWindow = {};
    return node;
  };
  const document = {
    getElementById: id => nodes.get(id) || null,
    createElement: tag => makeNode(tag), querySelectorAll: () => [], querySelector: () => null,
    body: makeNode('body'), documentElement: makeNode('html'), addEventListener() {}
  };
  document.body.innerHTML = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  const calls = [], notices = [], listeners = new Map();
  const context = vm.createContext({
    document, URL, URLSearchParams, console, Uint8Array, crypto: webcrypto,
    location: { href: 'https://fixture.invalid/' + page + search, search },
    navigator: {}, setTimeout: (fn, delay) => { if (delay === 500) queueMicrotask(fn); return 1; }, clearTimeout() {},
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    FileReader: class {
      readAsArrayBuffer(file) { this.result = Uint8Array.from([1, 2, 3]).buffer; this.onload(); }
      readAsDataURL(file) { this.result = 'data:' + file.type + ';base64,AQID'; this.onload(); }
    },
    fetch: async (url, options) => { calls.push({ url, ...options }); return { ok: true, json: async () => ({ success: true, data: {} }) }; },
    window: { innerHeight: 800, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name), visualViewport: null },
    liff: { getIDToken: () => null, login: () => { throw new Error('Unexpected LINE login'); } }
  });
  let script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(Boolean).join('\n');
  // Suppress automatic page startup, then invoke each user flow explicitly.
  script = script.replace(/\(async function (?:bootstrap|init)\(\)[\s\S]*?\}\)\(\);/g, '');
  script = script.replace(/document\.addEventListener\([\s\S]*?\n    \}\);/g, '');
  script = script.replace(/\n    loadPage\(\);\s*$/, '\n');
  vm.runInContext(script, context);
  vm.runInContext('showToast = function(message) { __notices.push(message); };', Object.assign(context, { __notices: notices }));
  return { context, nodes, calls, notices, listeners, run: code => vm.runInContext(code, context), set: (id, value) => { nodes.get(id).value = value; } };
}

function paperFixture() {
  const r = pageRuntime('landlord-tenant-create.html', '?mode=paper_backfill');
  r.run(`PAGE_DATA = { workspace: {}, can_create: true, rooms: [{room_id:'R-fixture',property_id:'P-fixture',rent_amount:9000}], properties: [], defaults: {start_date:'2026-10-01'} }; renderPaperBackfillPage();`);
  for (const [id, value] of Object.entries({roomId:'R-fixture', tenantName:'Fixture tenant', tenantPhone:'0912345678', startDate:'2026-10-01', endDate:'2027-09-30', rentAmount:'9000', depositAmount:'18000', paperSignedAt:'2026-10-01'})) r.set(id, value);
  r.nodes.get('paperContractFile').files = [{name:'paper.pdf',type:'application/pdf',size:3}];
  return r;
}

test('paper entry starts empty and rejects missing, negative and nonfinite readings; zero is valid', () => {
  const r = paperFixture();
  const input = r.nodes.get('firstMeterReading');
  assert.ok(input, 'paper entry must expose the required initial reading');
  assert.equal(input.value, '');
  assert.equal(input.getAttribute('type'), 'number');
  assert.equal(input.getAttribute('min'), '0');
  assert.equal(input.getAttribute('step'), '0.001');
  for (const value of ['', '-1', 'Infinity', 'NaN']) {
    r.set('firstMeterReading', value);
    assert.match(r.run('validatePaperBackfillForm()'), /初始電表/);
  }
  for (const value of ['0', '123.456']) { r.set('firstMeterReading', value); assert.equal(r.run('validatePaperBackfillForm()'), ''); }
});

test('paper image files reuse the 8MB reader, reject PDF, and retain existing paper/ID support', async () => {
  const r = paperFixture();
  for (const id of ['initialMeterFile', 'selfieFile']) {
    assert.ok(r.nodes.get(id), id + ' must be optional');
    assert.equal(r.nodes.get(id).getAttribute('accept'), 'image/jpeg,image/png');
    r.nodes.get(id).files = [{name:'bad.pdf',type:'application/pdf',size:3}];
    await assert.rejects(r.run(`readPaperFile('${id}', false)`), /JPG|PNG/);
    r.nodes.get(id).files = [{name:'large.png',type:'image/png',size:8 * 1024 * 1024 + 1}];
    await assert.rejects(r.run(`readPaperFile('${id}', false)`), /8MB/);
    r.nodes.get(id).files = [{name:'meter.png',type:'image/png',size:8 * 1024 * 1024}];
    assert.equal((await r.run(`readPaperFile('${id}', false)`)).base64, 'AQID');
  }
  assert.equal((await r.run("readPaperFile('paperContractFile', true)")).mime_type, 'application/pdf');
});

test('paper submit carries zero, meter and selfie artifacts and success links to this tenant and contract', async () => {
  const r = paperFixture();
  assert.ok(r.nodes.get('firstMeterReading'), 'initial meter input must exist');
  r.set('firstMeterReading', '0');
  for (const id of ['initialMeterFile','selfieFile']) r.nodes.get(id).files = [{name:id+'.png',type:'image/png',size:3}];
  r.context.__payloads = [];
  r.run(`postLandlordPaperBackfill = async function(input) { __payloads.push(input); return {tenant:{tenant_id:'T-fixture'},contract:{contract_id:'C-fixture',tenant_id:'T-fixture'}}; };`);
  await r.run('submitPaperBackfill()');
  const payload = r.context.__payloads[0];
  assert.equal(payload.first_meter_reading, 0);
  assert.equal(payload.initial_meter_file.mime_type, 'image/png');
  assert.equal(payload.selfie_file.base64, 'AQID');
  const success = r.nodes.get('app').innerHTML;
  assert.match(success, /landlord-tenant-detail\.html\?tenant_id=T-fixture&amp;contract_id=C-fixture|landlord-tenant-detail\.html\?tenant_id=T-fixture&contract_id=C-fixture/);
  assert.match(success, /入住初始電表[\s\S]*?已保存，請從房客資料查看/);
});

function detailFixture() {
  const r = pageRuntime('landlord-tenant-detail.html');
  r.run(`CURRENT_TENANT = {tenant_id:'T-fixture'}; CURRENT_TENANT_CONTRACTS = [{contract_id:'C-old',tenant_id:'T-fixture',start_date:'2025-01-01',end_date:'2025-12-31'}, {contract_id:'C-current',tenant_id:'T-fixture',is_current:true,start_date:'2026-01-01',end_date:'2026-12-31'}];`);
  return r;
}

test('Taipei lease days stay consistent for timestamp history, meter and document selectors', async () => {
  const r = detailFixture();
  r.context.__contracts = [{contract_id:'C-current',tenant_id:'T-fixture',is_current:true,
    start_date:'2026-09-10T16:00:00.000Z',end_date:'2027-09-09T16:00:00.000Z',
    contract_start:'Fri Sep 11 2026 00:00:00 GMT+0800 (Taipei Standard Time)',
    contract_end:'Fri Sep 10 2027 00:00:00 GMT+0800 (Taipei Standard Time)'}];
  r.run('CURRENT_TENANT_CONTRACTS = __contracts;');
  r.nodes.get('app').innerHTML = r.run('tenantInitialMeterPanelHtml() + tenantDocumentPanelHtml()');
  await r.run('loadTenantInitialMeterContracts()');
  r.run('renderTenantDocumentContracts(__contracts)');
  assert.equal(r.run("formatDate('2026-09-11')"), '2026-09-11');
  assert.equal(r.run("formatDate('2026-09-10T16:00:00.000Z')"), '2026-09-11');
  assert.match(r.run('renderContractHistory(__contracts)'), /2026-09-11 ～ 2027-09-10/);
  assert.match(r.nodes.get('tenantInitialMeterContractSelect').innerHTML, /2026-09-11 ～ 2027-09-10/);
  assert.match(r.nodes.get('tenantDocumentContractSelect').children[0].textContent, /2026-09-11 ～ 2027-09-10/);
});

test('expired LINE identity does not send an exchange or redirect, and offers explicit recovery', async () => {
  const r = detailFixture();
  r.run("LANDLORD_AUTH = {getMode:()=> 'line',getRequestAuthParams:()=>({line_user_id:'untrusted-fixture'})};");
  r.context.liff.getIDToken = () => 'expired-fixture-id-token';
  r.context.liff.getDecodedIDToken = () => ({exp:Math.floor(Date.now()/1000)-1});
  r.run("jsonpRequest = async function() { return {success:false,code:'LINE_TOKEN_VERIFY_FAILED',message:'房東審核身分驗證失敗'}; };");
  r.nodes.get('app').innerHTML = r.run('tenantInitialMeterPanelHtml()');
  await r.run('loadTenantInitialMeterContracts()');
  assert.equal(r.calls.length, 0, 'known expired identity must never be submitted to the server');
  assert.match(r.nodes.get('tenantInitialMeterContent').innerHTML, /登入.*過期/);
  assert.ok(r.nodes.get('tenantInitialMeterRelogin'), 'manual recovery must not restart login by itself');
  assert.match(r.context.location.href, /landlord-tenant-detail/);
});

test('meter re-login uses the LINE entry and keeps canonical tenant, selected lease and anchor without OAuth replay', async () => {
  for (const inClient of [false,true]) {
    const r = detailFixture();
    r.context.location.href = 'https://fixture.invalid/landlord-tenant-detail.html?tenant_id=T-fixture&code=private&state=private&liff.state=private';
    r.nodes.get('app').innerHTML = r.run('tenantInitialMeterPanelHtml()');
    r.set('tenantInitialMeterContractSelect','C-current');
    const actions = [], storage = new Map();
    r.context.sessionStorage = {setItem:(key,value)=>storage.set(key,value)};
    r.context.location.replace = url => actions.push(['replace',url]);
    r.context.liff.isInClient = () => inClient;
    r.context.liff.logout = () => actions.push(['logout']);
    r.context.liff.login = options => actions.push(['login',options.redirectUri]);
    await r.run('reloginTenantInitialMeter()');
    await r.run('reloginTenantInitialMeter()');
    assert.equal(actions.length, inClient ? 1 : 2, 'double click cannot start a second authentication');
    const target = new URL(actions.at(-1)[1]);
    assert.equal(target.hostname, inClient ? 'liff.line.me' : 'fixture.invalid');
    if (!inClient) assert.equal(target.pathname, '/landlord-entry.html');
    const returned = new URL(target.searchParams.get('return_to'), 'https://fixture.invalid/');
    assert.equal(returned.searchParams.get('tenant_id'),'T-fixture');
    assert.equal(returned.searchParams.get('contract_id'),'C-current');
    assert.equal(returned.hash,'#tenant-initial-meter');
    assert.equal(returned.searchParams.has('code'),false);
    assert.equal(returned.searchParams.has('state'),false);
    assert.equal(returned.searchParams.has('liff.state'),false);
    assert.equal(storage.get('cmwebs_landlord_line_fallback_intent'), '1');
  }
});

test('server denied auth exchange renders recovery once without identity fallback or meter calls', async () => {
  const r = detailFixture();
  r.run("LANDLORD_AUTH = {getMode:()=> 'line',getRequestAuthParams:()=>({line_user_id:'untrusted-fixture'})};");
  r.context.liff.getIDToken = () => 'fixture-id-token';
  const append = r.context.document.body.appendChild.bind(r.context.document.body);
  r.context.document.body.appendChild = node => {
    append(node);
    if (node.tagName === 'SCRIPT') {
      const url = new URL(node.src);
      r.context.window[url.searchParams.get('callback')]({success:false,code:'LINE_TOKEN_VERIFY_FAILED',message:'房東審核身分驗證失敗'});
    }
    return node;
  };
  r.nodes.get('app').innerHTML = r.run('tenantInitialMeterPanelHtml()');
  await r.run('loadTenantInitialMeterContracts()');
  assert.equal(r.calls.length,1);
  assert.equal(JSON.parse(r.calls[0].body).action,'landlord_contract_signing_review_auth_init');
  assert.ok(r.nodes.get('tenantInitialMeterRelogin'));
  assert.match(r.context.location.href, /landlord-tenant-detail/);
});

test('meter cached review session refreshes before expiry without reusing the stale credential', async () => {
  for (const remainingMs of [-1, 20000, 31000]) {
    const r = detailFixture();
    r.context.__remainingMs = remainingMs;
    r.run("LANDLORD_AUTH = {getMode:()=> 'line',getRequestAuthParams:()=>({})}; LANDLORD_REVIEW_SESSION_TOKEN='old-fixture'; LANDLORD_REVIEW_SESSION_EXPIRES_AT=Date.now()+__remainingMs;");
    r.context.liff.getIDToken = () => 'fresh-fixture-id-token';
    r.run("jsonpRequest = async function() { return {success:true,data:{session_token:'fresh-fixture',session_expires_at:new Date(Date.now()+600000).toISOString()}}; };");
    await r.run("requestTenantInitialMeterAction('landlord_tenant_initial_meter_init',{contract_id:'C-current',tenant_id:'T-fixture'})");
    const shouldRefresh = remainingMs < 30000;
    assert.equal(r.calls.length, shouldRefresh ? 2 : 1);
    assert.equal(JSON.parse(r.calls.at(-1).body).session_token, shouldRefresh ? 'fresh-fixture' : 'old-fixture');
  }
});

test('expired meter save never auto-replays and keeps unsaved reading and photo for manual recovery', async () => {
  const r = detailFixture();
  r.nodes.get('app').innerHTML = r.run('tenantInitialMeterPanelHtml()');
  r.context.__data = meterData();
  r.run("renderTenantInitialMeter(__data); LANDLORD_AUTH = {getMode:()=> 'line',getRequestAuthParams:()=>({})}; LANDLORD_REVIEW_SESSION_TOKEN='old-fixture';");
  r.set('tenantInitialMeterContractSelect','C-current');
  r.set('tenantInitialMeterReading','123.456');
  const file = {name:'meter.jpg',type:'image/jpeg',size:3};
  r.nodes.get('tenantInitialMeterFile').files = [file];
  r.context.fetch = async (_url,options) => {
    r.calls.push(options);
    return {ok:true,json:async()=>({success:false,code:'LANDLORD_REVIEW_SESSION_EXPIRED',message:'房東 session 無效'})};
  };
  await r.run('saveTenantInitialMeter()');
  assert.equal(r.calls.length,1);
  assert.equal(r.nodes.get('tenantInitialMeterReading').value,'123.456');
  assert.equal(r.nodes.get('tenantInitialMeterFile').files[0],file);
  assert.equal(r.run('LANDLORD_REVIEW_SESSION_TOKEN'),'');
  assert.ok(r.nodes.get('tenantInitialMeterRelogin'));
  assert.equal(r.nodes.get('tenantInitialMeterSave').disabled,false);
});
const meterData = (changes = {}) => ({contract_id:'C-current',tenant_id:'T-fixture',room_id:'R-fixture',first_meter_reading:'',has_initial_meter:false,can_fill:true,documents:[], ...changes});

function detailLoadFixture(history = [{contract_id:'C-current',tenant_id:'T-fixture',is_current:true}]) {
  const r = detailFixture();
  r.context.__tenantResponse = {success:true,data:{tenants:[{
    tenant_id:'T-fixture',tenant_name:'Fixture tenant',room_list:'506',contract_history:history
  }]}};
  r.context.__meterResponse = meterData();
  let finishDocuments;
  r.context.__documentsResponse = new Promise(resolve => { finishDocuments = resolve; });
  r.run(`
    ensureLandlordAuthReady = async function() { return true; };
    fetchStatusJson = async function(action) {
      return action === 'landlord_tenants' ? __tenantResponse : {success:true,data:{requests:[]}};
    };
    jsonpRequest = async function(action) {
      if (action !== 'landlord_contract_documents_init') throw new Error('Unexpected document action');
      return __documentsResponse;
    };
    requestTenantInitialMeterAction = async function() { return __meterResponse; };
  `);
  return {r,finishDocuments};
}

function canonicalDetailFixture(tenants) {
  const r = pageRuntime('landlord-tenant-detail.html', '?tenant_id=TENANT-FIXTURE-UUID');
  r.context.__tenants = tenants;
  r.context.__reads = [];
  r.context.__requests = [{request_id:'REQ-fixture',tenant_id:'tenant-fixture-uuid',request_type:'new'}];
  r.context.__documents = ['legacy_contract', 'identity_front', 'identity_back'].map(type => ({
    document_id: 'D-' + type, contract_id: 'C-current', tenant_id: 'tenant-fixture-uuid',
    document_type: type, file_name: type + '.jpg'
  }));
  r.context.__meterResponse = meterData({tenant_id:'tenant-fixture-uuid'});
  r.run(`
    ensureLandlordAuthReady = async function() { return true; };
    fetchStatusJson = async function(action) {
      return {success:true,data:action === 'landlord_tenants' ? {tenants:__tenants} : {
        requests:__requests
      }};
    };
    jsonpRequest = async function(action,input) {
      __reads.push({action,input});
      return {success:true,data:{contracts:[{contract_id:'C-current',tenant_id:'tenant-fixture-uuid'}],documents:__documents}};
    };
    requestTenantInitialMeterAction = async function(action,input) {
      __reads.push({action,input}); return __meterResponse;
    };
  `);
  return r;
}

test('old uppercase tenant URL resolves the server canonical ID before document and meter reads', async () => {
  const r = canonicalDetailFixture([{
    tenant_id:'tenant-fixture-uuid',tenant_name:'Fixture tenant',room_list:'Fixture room',
    contract_history:[{contract_id:'C-current',tenant_id:'tenant-fixture-uuid',is_current:true}]
  }]);
  await r.run('loadPage()');
  assert.equal(r.run('TENANT_ID'), 'tenant-fixture-uuid');
  assert.equal(r.run('CURRENT_REQUESTS.length'), 1, 'existing lowercase requests remain visible through the old URL');
  assert.equal(r.context.__reads.length, 2);
  assert.ok(r.context.__reads.every(read => read.input.tenant_id === 'tenant-fixture-uuid'));
  assert.equal(r.nodes.get('tenantInitialMeterContractSelect').value, 'C-current');
  assert.ok(r.nodes.get('tenantInitialMeterReading'), 'canonical contract exposes the meter form');
  assert.equal(r.nodes.get('tenantDocumentsList').querySelectorAll('[data-tenant-document-preview-id]').length, 3);
});

test('case-colliding tenant IDs fail closed before private-document or meter requests', async () => {
  const r = canonicalDetailFixture([
    {tenant_id:'tenant-fixture-uuid',tenant_name:'First tenant',contract_history:[]},
    {tenant_id:'TENANT-FIXTURE-UUID',tenant_name:'Second tenant',contract_history:[]}
  ]);
  await r.run('loadPage()');
  assert.match(r.nodes.get('app').innerHTML, /房客識別資料不唯一/);
  assert.equal(r.context.__reads.length, 0);
  assert.equal(r.run('CURRENT_TENANT'), null);
});

test('canonical resolution keeps contract requests linked by exact stored identity', async () => {
  const r = canonicalDetailFixture([{tenant_id:'tenant-fixture-uuid',tenant_name:'Fixture tenant',contract_history:[]}]);
  r.context.__requests.push({request_id:'REQ-other-case',tenant_id:'TENANT-FIXTURE-UUID',request_type:'renewal'});
  await r.run('loadPage()');
  assert.deepEqual(Array.from(r.run('CURRENT_REQUESTS'), request => request.request_id), ['REQ-fixture']);
});

test('tenant detail exposes the meter form before a slow document list finishes', async () => {
  const {r,finishDocuments} = detailLoadFixture();
  const loading = r.run('loadPage()');
  try {
    // Flush the page promises, not a wall-clock/network delay.
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
    assert.ok(r.nodes.get('tenantInitialMeterReading'), 'slow private-document lookup must not block the meter form');
    assert.ok(r.nodes.get('tenantInitialMeterFile'), 'the independent meter request exposes its photo input');
    assert.match(r.nodes.get('app').innerHTML, /文件與身份驗證/);
  } finally {
    finishDocuments({success:true,data:{contracts:[],documents:[]}});
    await loading;
  }
});

test('document failure keeps the tenant profile and independent meter form visible', async () => {
  const {r,finishDocuments} = detailLoadFixture();
  const loading = r.run('loadPage()');
  finishDocuments({success:false,code:'DOCUMENT_LOOKUP_FAILED',message:'Fixture document failure'});
  await loading;
  assert.ok(r.nodes.get('tenantInitialMeterReading'));
  assert.match(r.nodes.get('app').innerHTML, /Fixture tenant/);
  assert.match(r.nodes.get('tenantDocumentsState').textContent, /Fixture document failure/);
  assert.doesNotMatch(r.nodes.get('app').innerHTML, /房客資料讀取失敗/);
});

test('legacy tenant without history can load the meter after document contracts arrive', async () => {
  const {r,finishDocuments} = detailLoadFixture([]);
  const loading = r.run('loadPage()');
  finishDocuments({success:true,data:{contracts:[{contract_id:'C-current',tenant_id:'T-fixture'}],documents:[]}});
  await loading;
  assert.equal(r.nodes.get('tenantInitialMeterContractSelect').value, 'C-current');
  assert.ok(r.nodes.get('tenantInitialMeterReading'));
});

test('tenant profile offers direct in-page links to the meter and document sections', async () => {
  const {r,finishDocuments} = detailLoadFixture();
  const loading = r.run('loadPage()');
  finishDocuments({success:true,data:{contracts:[],documents:[]}});
  await loading;
  const markup = r.nodes.get('app').innerHTML;
  const profile = markup.slice(0, markup.indexOf('聯絡資料'));
  assert.match(profile, /href="#tenant-initial-meter"/);
  assert.match(profile, /href="#tenant-documents"/);
  assert.ok(r.nodes.get('tenant-initial-meter'));
  assert.ok(r.nodes.get('tenant-documents'));
});

test('tenant document list gives every stored historical file its own private preview', () => {
  const r = detailFixture();
  r.nodes.get('app').innerHTML = r.run('tenantDocumentPanelHtml()');
  r.context.__documents = [
    {document_id:'D-new-paper',document_type:'legacy_contract',file_name:'new.pdf',contract_id:'C-current'},
    {document_id:'D-old-paper',document_type:'legacy_contract',file_name:'old.pdf',contract_id:'C-old'},
    {document_id:'D-old-id',document_type:'identity_front',file_name:'id.jpg',contract_id:'C-old'}
  ];
  r.context.__previews = [];
  r.run('previewTenantDocument = function(id) { __previews.push(id); }; renderTenantDocumentList(__documents);');
  const buttons = r.nodes.get('tenantDocumentsList').querySelectorAll('[data-tenant-document-preview-id]');
  assert.equal(buttons.length, 3, 'the type upload tile cannot substitute for historical-file access');
  for (const button of buttons) button.listeners.click();
  assert.deepEqual(Array.from(r.context.__previews), ['D-new-paper','D-old-paper','D-old-id']);
  assert.doesNotMatch(r.nodes.get('tenantDocumentsList').innerHTML, /drive_file_id|base64/);
});

test('existing tenant meter section selects the current owned contract and displays its version context', async () => {
  const r = detailFixture();
  assert.equal(typeof r.context.tenantInitialMeterPanelHtml, 'function', 'tenant detail must offer the meter section');
  r.nodes.get('app').innerHTML = r.run('tenantInitialMeterPanelHtml()');
  r.context.__data = meterData();
  r.context.__inputs = [];
  r.run('requestTenantInitialMeterAction = async function(action,input) { __inputs.push({action,input}); return __data; };');
  await r.run('loadTenantInitialMeterContracts()');
  assert.equal(r.nodes.get('tenantInitialMeterContractSelect').value, 'C-current');
  assert.match(r.nodes.get('tenantInitialMeterContractSelect').innerHTML, /C-old[\s\S]*C-current/);
  assert.equal(r.context.__inputs[0].input.contract_id, 'C-current');
  assert.equal(r.context.__inputs[0].input.tenant_id, 'T-fixture');
  assert.equal(r.nodes.get('tenantInitialMeterReading').value, '');
  assert.match(r.nodes.get('tenantInitialMeterContent').innerHTML, /缺少/);
});

test('initial meter selector displays canonical, history and document-contract dates without losing field precedence', async () => {
  const r = detailFixture();
  r.nodes.get('app').innerHTML = r.run('tenantInitialMeterPanelHtml()');
  r.run(`CURRENT_TENANT_CONTRACTS = [
    {contract_id:'C-canonical',contract_start_date:'2026-04-01',contract_end_date:'2027-03-31'},
    {contract_id:'C-documents',contract_start:'2026-05-01',contract_end:'2027-04-30'},
    {contract_id:'C-history',start_date:'2026-06-01',end_date:'2027-05-31',contract_start_date:'2020-01-01',contract_end_date:'2020-12-31'}
  ];`);
  await r.run('loadTenantInitialMeterContracts()');
  const options = r.nodes.get('tenantInitialMeterContractSelect').innerHTML;
  assert.match(options, /C-canonical（2026-04-01 ～ 2027-03-31）/);
  assert.match(options, /C-documents（2026-05-01 ～ 2027-04-30）/);
  assert.match(options, /C-history（2026-06-01 ～ 2027-05-31）/);
  assert.doesNotMatch(options, /2020-01-01/);
});

test('existing zero is visible and immutable; only a same-reading photo upload is offered', async () => {
  const r = detailFixture();
  assert.equal(typeof r.context.renderTenantInitialMeter, 'function');
  r.nodes.get('app').innerHTML = r.run('tenantInitialMeterPanelHtml()');
  r.context.__data = meterData({first_meter_reading:0,has_initial_meter:true,can_fill:false});
  r.run('renderTenantInitialMeter(__data);');
  assert.equal(r.nodes.get('tenantInitialMeterReading').value, '0');
  assert.equal(r.nodes.get('tenantInitialMeterReading').readOnly, true);
  r.nodes.get('tenantInitialMeterReading').value = '99';
  r.context.__saves = [];
  r.run('requestTenantInitialMeterAction = async function(action,input) { __saves.push({action,input}); return __data; }; loadTenantDocuments = async function() {};');
  await r.run('saveTenantInitialMeter()');
  assert.equal(r.context.__saves.length, 0, 'cannot alter an existing reading');
  r.set('tenantInitialMeterReading', '0');
  r.nodes.get('tenantInitialMeterFile').files = [{name:'meter.jpg',type:'image/jpeg',size:3}];
  await r.run('saveTenantInitialMeter()');
  assert.equal(r.context.__saves[0].input.first_meter_reading, 0);
  assert.equal(r.context.__saves[0].input.initial_meter_file.base64, 'AQID');
});

test('email meter init/save use the auth bridge with input_json and never fetch or start LINE login', async () => {
  const r = detailFixture();
  assert.equal(typeof r.context.requestTenantInitialMeterAction, 'function');
  r.context.__bridge = [];
  r.context.__data = meterData();
  r.run(`LANDLORD_AUTH = {getMode:()=> 'email',getRequestAuthParams:()=>({landlord_session_token:'fixture-email'}),request:async function(action,params) { __bridge.push({action,params}); return {success:true,data:__data}; }};`);
  await r.run(`requestTenantInitialMeterAction('landlord_tenant_initial_meter_init',{contract_id:'C-current',tenant_id:'T-fixture'})`);
  await r.run(`requestTenantInitialMeterAction('landlord_tenant_initial_meter_save',{contract_id:'C-current',tenant_id:'T-fixture',first_meter_reading:0})`);
  assert.equal(r.context.__bridge[0].action, 'landlord_tenant_initial_meter_init');
  assert.deepEqual(JSON.parse(r.context.__bridge[0].params.input_json), {contract_id:'C-current',tenant_id:'T-fixture'});
  assert.equal(JSON.parse(r.context.__bridge[1].params.input_json).first_meter_reading, 0);
  assert.equal(r.calls.length, 0);
});

test('mobile meter init/save send verified session JSON input without raw LINE identity', async () => {
  const r = detailFixture();
  assert.equal(typeof r.context.requestTenantInitialMeterAction, 'function');
  r.run(`LANDLORD_AUTH = {getMode:()=> 'line',getRequestAuthParams:()=>({line_user_id:'untrusted-fixture'})}; LANDLORD_REVIEW_SESSION_TOKEN = 'verified-fixture';`);
  for (const action of ['landlord_tenant_initial_meter_init','landlord_tenant_initial_meter_save']) {
    await r.run(`requestTenantInitialMeterAction('${action}',{contract_id:'C-current',tenant_id:'T-fixture',first_meter_reading:0})`);
    const call = r.calls.at(-1), body = JSON.parse(call.body);
    assert.equal(call.method, 'POST');
    assert.equal(body.action, action);
    assert.equal(body.session_token, 'verified-fixture');
    assert.equal(body.input.first_meter_reading, 0);
    assert.equal(body.line_user_id, undefined);
  }
  r.run("LANDLORD_REVIEW_SESSION_TOKEN = ''; ");
  await assert.rejects(r.run(`requestTenantInitialMeterAction('landlord_tenant_initial_meter_init',{})`), /身分|憑證|登入/);
  assert.equal(r.calls.length, 2, 'missing verified identity must fail before meter I/O');
});

test('meter init failure and stale contract responses cannot leave a writable form', async () => {
  const r = detailFixture();
  assert.equal(typeof r.context.loadTenantInitialMeter, 'function');
  r.nodes.get('app').innerHTML = r.run('tenantInitialMeterPanelHtml()');
  r.context.__data = meterData({contract_id:'C-old'});
  r.run('requestTenantInitialMeterAction = async function() { return __data; };');
  r.set('tenantInitialMeterContractSelect', 'C-current');
  await r.run('loadTenantInitialMeter()');
  assert.equal(r.nodes.get('tenantInitialMeterSave'), undefined);
  assert.match(r.nodes.get('tenantInitialMeterContent').textContent, /不符|失敗/);
});

test('document overview labels, icons and filtering include checkin meter alongside existing document types', () => {
  const r = pageRuntime('landlord-contract-documents.html');
  r.context.__documents = [
    {document_id:'D-meter',document_type:'checkin_initial_meter',file_name:'meter.jpg',tenant_id:'T-fixture',contract_id:'C-current'},
    {document_id:'D-paper',document_type:'legacy_contract',document_origin:'paper_backfill',file_name:'paper.pdf'},
    {document_id:'D-selfie',document_type:'selfie',file_name:'selfie.png'}
  ];
  r.run('renderDocuments(__documents);');
  const cards = r.nodes.get('documentsList').children;
  assert.match(cards[0].innerHTML, /初始電表照片/);
  assert.match(cards[0].innerHTML, /<svg/);
  assert.match(cards[1].innerHTML, /紙本合約/);
  assert.match(cards[2].innerHTML, /自拍照/);
  assert.ok(r.nodes.get('documentTypeFilter'), 'overview should offer a type filter');
  r.set('documentTypeFilter', 'checkin_initial_meter');
  r.run('filterDocuments();');
  assert.equal(r.nodes.get('documentsList').children.length, 1);
  assert.match(r.nodes.get('documentsList').children[0].innerHTML, /meter.jpg/);
  const detail = detailFixture();
  assert.equal(detail.run("tenantDocumentTypeLabel('checkin_initial_meter')"), '初始電表照片');
  assert.notEqual(detail.run("tenantDocumentTypeIcon('checkin_initial_meter')"), detail.run("tenantDocumentTypeIcon('legacy_contract')"));
});

test('real Email auth client posts meter init/save in a hidden iframe with no credentials in the URL', async () => {
  const r = detailFixture();
  r.context.window.innerWidth = 1400;
  r.context.window.sessionStorage = {getItem: () => 'fixture-email-token'};
  const forms = [];
  r.context.document.onSubmit = form => {
    const fields = Object.fromEntries(form.children.map(input => [input.name,input.value]));
    forms.push({form,fields});
    const frame = r.context.document.body.children.find(n => n.tagName === 'IFRAME');
    assert.equal(frame.hidden, true);
    assert.equal(frame.style.display, 'none');
    r.listeners.get('message')({source:frame.contentWindow,origin:'https://script.google.com',data:{source:'CMWEBS_APPS_SCRIPT',requestId:fields.request_id,payload:{success:true,data:meterData()}}});
  };
  vm.runInContext(readFileSync(new URL('../landlord-auth.js', import.meta.url), 'utf8'), r.context);
  r.run(`LANDLORD_AUTH = window.CMWebsLandlordAuth.init({apiUrl: API_URL});`);
  for (const action of ['landlord_tenant_initial_meter_init','landlord_tenant_initial_meter_save']) await r.run(`requestTenantInitialMeterAction('${action}',{contract_id:'C-current',tenant_id:'T-fixture',first_meter_reading:0})`);
  assert.equal(forms.length, 2);
  assert.equal(forms[0].form.method, 'POST');
  assert.equal(new URL(forms[0].form.action).search, '');
  assert.equal(forms[0].fields.action, 'landlord_tenant_initial_meter_init');
  assert.equal(forms[1].fields.action, 'landlord_tenant_initial_meter_save');
  assert.equal(forms[1].fields.landlord_session_token, 'fixture-email-token');
  assert.equal(forms[1].fields.line_user_id, undefined);
  assert.equal(JSON.parse(forms[1].fields.input_json).first_meter_reading, 0);
  assert.equal(r.context.document.body.children.length, 0, 'bridge cleans its form and iframe');
});

test('mobile review exchange verifies ID token, polls by secret and sends meter POST with the issued session', async () => {
  const r = detailFixture();
  r.run(`LANDLORD_AUTH = {getMode:()=> 'line',getRequestAuthParams:()=>({line_user_id:'untrusted-fixture'})}; LINE_USER_ID='untrusted-fixture';`);
  r.context.liff.getIDToken = () => 'fixture-id-token';
  const scripts = [];
  const append = r.context.document.body.appendChild.bind(r.context.document.body);
  r.context.document.body.appendChild = node => {
    append(node);
    if (node.tagName !== 'SCRIPT') return node;
    const url = new URL(node.src); scripts.push(url);
    r.context.window[url.searchParams.get('callback')]({success:true,data:{session_token:'issued-fixture'}});
    return node;
  };
  await r.run(`requestTenantInitialMeterAction('landlord_tenant_initial_meter_init',{contract_id:'C-current',tenant_id:'T-fixture'})`);
  assert.equal(r.calls.length, 2);
  const auth = JSON.parse(r.calls[0].body), init = JSON.parse(r.calls[1].body);
  assert.equal(auth.action, 'landlord_contract_signing_review_auth_init');
  assert.equal(auth.id_token, 'fixture-id-token');
  assert.equal(auth.line_user_id, undefined);
  assert.equal(scripts[0].searchParams.get('v2_action'), 'landlord_contract_signing_review_auth_status');
  assert.equal(scripts[0].searchParams.get('request_id'), auth.request_id);
  assert.equal(scripts[0].searchParams.get('poll_secret'), auth.poll_secret);
  assert.equal(scripts[0].searchParams.has('line_user_id'), false);
  assert.equal(scripts[0].searchParams.has('id_token'), false);
  assert.equal(init.action, 'landlord_tenant_initial_meter_init');
  assert.equal(init.session_token, 'issued-fixture');
  assert.equal(init.input.contract_id, 'C-current');
});

test('missing meter save validates input and photos, preserves the form on denial and sends only selected lease data', async () => {
  const r = detailFixture();
  r.nodes.get('app').innerHTML = r.run('tenantInitialMeterPanelHtml()');
  r.context.__data = meterData();
  r.run('renderTenantInitialMeter(__data);');
  r.set('tenantInitialMeterContractSelect','C-current');
  r.context.__saves = [];
  r.run("requestTenantInitialMeterAction = async function(action,input) { __saves.push({action,input}); throw new Error('contract_write denied'); };");
  for (const value of ['', '-1', 'NaN', 'Infinity']) { r.set('tenantInitialMeterReading',value); await r.run('saveTenantInitialMeter()'); }
  assert.equal(r.context.__saves.length, 0);
  r.set('tenantInitialMeterReading','0');
  for (const file of [{name:'bad.pdf',type:'application/pdf',size:3},{name:'empty.png',type:'image/png',size:0},{name:'large.jpg',type:'image/jpeg',size:8 * 1024 * 1024 + 1}]) {
    r.nodes.get('tenantInitialMeterFile').files = [file]; await r.run('saveTenantInitialMeter()');
  }
  assert.equal(r.context.__saves.length, 0);
  r.nodes.get('tenantInitialMeterFile').files = [];
  await r.run('saveTenantInitialMeter()');
  const saved = r.context.__saves[0];
  assert.equal(saved.action, 'landlord_tenant_initial_meter_save');
  assert.deepEqual(JSON.parse(JSON.stringify(saved.input)), {contract_id:'C-current',tenant_id:'T-fixture',first_meter_reading:0});
  assert.equal(r.nodes.get('tenantInitialMeterSave').disabled, false);
  assert.equal(r.nodes.get('tenantInitialMeterReading').value, '0');
  assert.match(r.notices.at(-1), /contract_write denied/);
  assert.equal(r.nodes.get('tenantInitialMeterContractSelect').disabled, false);
});

test('successful missing-meter save reloads immutable zero and prevents repeated concurrent saves', async () => {
  const r = detailFixture();
  r.nodes.get('app').innerHTML = r.run('tenantInitialMeterPanelHtml()');
  r.context.__data = meterData(); r.context.__updated = meterData({has_initial_meter:true,first_meter_reading:0,can_fill:false});
  r.run('renderTenantInitialMeter(__data);');
  r.set('tenantInitialMeterContractSelect','C-current'); r.set('tenantInitialMeterReading','0');
  let finish;
  r.context.__wait = new Promise(resolve => { finish = resolve; });
  r.context.__actions = [];
  r.run(`requestTenantInitialMeterAction = async function(action,input) { __actions.push({action,input}); if (action === 'landlord_tenant_initial_meter_save') { await __wait; return {}; } return __updated; }; loadTenantDocuments = async function() {};`);
  const pending = r.run('saveTenantInitialMeter()');
  await r.run('saveTenantInitialMeter()');
  assert.equal(r.context.__actions.length, 1);
  assert.equal(r.nodes.get('tenantInitialMeterContractSelect').disabled, true);
  finish(); await pending;
  assert.deepEqual(r.context.__actions.map(x=>x.action), ['landlord_tenant_initial_meter_save','landlord_tenant_initial_meter_init']);
  assert.equal(r.nodes.get('tenantInitialMeterReading').value, '0');
  assert.equal(r.nodes.get('tenantInitialMeterReading').readOnly, true);
});

test('a late response from the prior contract cannot replace the selected lease', async () => {
  const r = detailFixture();
  r.nodes.get('app').innerHTML = r.run('tenantInitialMeterPanelHtml()');
  let finish;
  r.context.__wait = new Promise(resolve => { finish = resolve; });
  r.context.__old = meterData({contract_id:'C-old',first_meter_reading:10,has_initial_meter:true,can_fill:false});
  r.context.__current = meterData({first_meter_reading:20,has_initial_meter:true,can_fill:false});
  r.run("requestTenantInitialMeterAction = async function(action,input) { if (input.contract_id==='C-old') { await __wait; return __old; } return __current; };");
  r.set('tenantInitialMeterContractSelect','C-old'); const old = r.run('loadTenantInitialMeter()');
  r.set('tenantInitialMeterContractSelect','C-current'); await r.run('loadTenantInitialMeter()');
  finish(); await old;
  assert.equal(r.nodes.get('tenantInitialMeterReading').value, '20');
  assert.match(r.nodes.get('tenantInitialMeterContent').innerHTML, /C-current/);
});

test('stored meter photos render a private preview action with the document ID and suppress another upload', () => {
  const r = detailFixture();
  r.nodes.get('app').innerHTML = r.run('tenantInitialMeterPanelHtml()');
  r.context.__data = meterData({first_meter_reading:123.456,has_initial_meter:true,can_fill:false,documents:[{document_id:'D-private',document_type:'checkin_initial_meter',file_name:'meter.png',created_at:'2026-10-01'}]});
  r.context.__preview = [];
  r.run('previewTenantDocument = function(id) { __preview.push(id); }; renderTenantInitialMeter(__data);');
  const content = r.nodes.get('tenantInitialMeterContent');
  assert.match(content.innerHTML, /初始電表照片 · meter.png/);
  assert.match(content.innerHTML, /123.456/);
  assert.equal(r.nodes.get('tenantInitialMeterSave'), undefined);
  content.querySelectorAll('[data-initial-meter-document]')[0].listeners.click();
  assert.equal(r.context.__preview[0], 'D-private');
});

test('ambiguous leases require an explicit choice and an unauthorized requested contract is ignored', async () => {
  const r = detailFixture();
  r.nodes.get('app').innerHTML = r.run('tenantInitialMeterPanelHtml()');
  r.run("CURRENT_TENANT_CONTRACTS[1].is_current = false; URL_PARAMS.set('contract_id','C-foreign');");
  r.context.__calls = [];
  r.run('requestTenantInitialMeterAction = async function(action,input) { __calls.push(input); return {}; };');
  await r.run('loadTenantInitialMeterContracts()');
  assert.equal(r.nodes.get('tenantInitialMeterContractSelect').value, '');
  assert.equal(r.context.__calls.length, 0);
  assert.match(r.nodes.get('tenantInitialMeterContent').textContent, /請選擇/);
});

test('read-only missing-meter state has no write control and backend errors cannot become success', async () => {
  const r = detailFixture();
  r.nodes.get('app').innerHTML = r.run('tenantInitialMeterPanelHtml()');
  r.context.__data = meterData({can_fill:false});
  r.run('renderTenantInitialMeter(__data);');
  assert.equal(r.nodes.get('tenantInitialMeterSave'), undefined);
  r.run(`LANDLORD_AUTH = {getRequestAuthParams:()=>({landlord_session_token:'fixture-email'}), request:async()=>({success:false,message:'Permission denied'})};`);
  await assert.rejects(r.run("requestTenantInitialMeterAction('landlord_tenant_initial_meter_save',{})"), /Permission denied/);
  assert.equal(r.calls.length, 0);
});
