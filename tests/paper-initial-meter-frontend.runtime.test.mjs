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
const meterData = (changes = {}) => ({contract_id:'C-current',tenant_id:'T-fixture',room_id:'R-fixture',first_meter_reading:'',has_initial_meter:false,can_fill:true,documents:[], ...changes});

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
