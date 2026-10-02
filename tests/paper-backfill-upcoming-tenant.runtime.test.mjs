import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function fixture(today = '2026-10-02') {
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [today + 'T12:00:00+08:00'])); }
  }
  const access = {
    line_user_id:'fixture-owner', user:{user_id:'U-owner'}, membership:{membership_id:'M1'},
    workspace:{workspace_id:'W1'}, principal:{landlord_name:'Fixture'}, principal_landlord_id:'L1'
  };
  const tenant = {tenant_id:'tenant-fixture', tenant_name:'Fixture tenant', workspace_id:'W1', account_status:'active', property_id:'P1', room_id:'R1', current_contract_id:'C-paper'};
  const room = {room_id:'R1', property_id:'P1', room_name:'501', workspace_id:'W1', account_status:'active', room_status:'vacant', current_contract_id:'C-paper', current_tenant_id:'tenant-fixture', rent_amount:19570, management_fee:0, deposit_amount:39140};
  const contract = {contract_id:'C-paper', tenant_id:'tenant-fixture', workspace_id:'W1', property_id:'P1', room_id:'R1', room_name:'501', start_date:'2026-10-15', end_date:'2028-10-14', contract_status:'upcoming', signing_mode:'paper_backfill', contract_origin:'paper_backfill', rent_amount:19570, management_fee:0, deposit_amount:39140};
  const data = {properties:[], property_id_map:{}, tenants:[tenant], rooms:[room], contracts:[contract], users:[], bills:[], tenant_view_rows:[]};
  const context = vm.createContext({Date:Clock, console,
    Utilities:{formatDate:date => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Taipei'}).format(new Date(date))},
    v2CanonicalBillIsOutstanding_:() => false,
    v2CanonicalBillIsVoided_:() => false
  });
  for (const name of ['V2_CONTRACT_RENEWAL_HISTORY', 'V2_API', 'V2_WORKSPACE_DASHBOARD_NATIVE', 'V2_PROPERTY_ROOM_MANAGEMENT', 'V2_LANDLORD_INITIATED_CONTRACTS', 'V2_CONTRACT_CHECKOUT']) {
    vm.runInContext(readFileSync(new URL('../apps-script/' + name + '.js', import.meta.url), 'utf8'), context);
  }
  return {context, access, tenant, room, contract, data,
    tenants:() => context.workspaceDashboardBuildTenantList_(access, data),
    roomView:() => context.propertyRoomBuildRoomView_(room,
      context.propertyRoomContractIsActive_(contract) ? {R1:contract} : {},
      {R1:data.contracts.slice().sort((a,b) => context.propertyRoomContractTimeValue_(b) - context.propertyRoomContractTimeValue_(a))[0]}, {},
      {'tenant-fixture':true}, tenant.account_status === 'active' ? {'tenant-fixture':true} : {},
      {contracts:Object.fromEntries(data.contracts.map(row => [row.contract_id,row])), tenants:{'tenant-fixture':tenant}})
  };
}

test('future paper tenant remains discoverable with canonical identity and lease dates without writes', () => {
  const f = fixture();
  const before = JSON.stringify(f.data);
  const result = f.tenants();
  assert.equal(result.length, 1, 'a saved future paper lease must not disappear from the tenant list');
  assert.equal(result[0].tenant_id, 'tenant-fixture');
  assert.equal(result[0].current_contract_id, 'C-paper');
  assert.equal(result[0].current_contract_status, 'upcoming');
  assert.equal(result[0].contract_start_date, '2026-10-15');
  assert.equal(result[0].contract_end_date, '2028-10-14');
  assert.equal(JSON.stringify(f.data), before);
});

test('checkout target validation accepts effective signed paper only after its start day', () => {
  for (const [day,allowed] of [['2026-10-14',false], ['2026-10-15',true], ['2028-10-15',true]]) {
    const f = fixture(day);
    const result = f.context.landlordContractCheckoutValidateTarget_(f.contract, f.room, [], {workspace_id:'W1', move_out_date:'2028-10-15'});
    assert.equal(result.success, allowed, day);
    assert.equal(f.contract.contract_status, 'upcoming');
  }
});

test('a later-dated cancelled electronic lease cannot shadow the pointed paper lease', () => {
  const f = fixture();
  f.data.contracts.push({...f.contract, contract_id:'C-cancelled', start_date:'2026-10-20', contract_status:'cancelled', contract_origin:'landlord_initiated', signing_mode:'new_tenant'});
  assert.equal(f.roomView().effective_status, 'upcoming');
  assert.equal(f.roomView().current_contract_id, 'C-paper');
});

test('upcoming room keeps the review warning when tenant-side room or contract pointers conflict', () => {
  for (const field of ['current_contract_id','room_id','property_id','workspace_id']) {
    const f = fixture();
    f.tenant[field] = 'foreign';
    assert.equal(f.roomView().has_upcoming_contract, false, field);
    assert.equal(f.roomView().effective_status, 'needs_review', field);
  }
});

function propertiesInit(f) {
  Object.assign(f.context, {
    propertyRoomRequireReadSchema_:() => {},
    workspaceLandlordResolveAccess_:() => ({...f.access, success:true}),
    runtimeSpreadsheet_:() => ({getSheetByName:name => ({name})}),
    propertyRoomGetWorkspaceProperties_:() => [{property_id:'P1', workspace_id:'W1', property_name:'Fixture', account_status:'active'}],
    propertyRoomGetWorkspaceRooms_:() => f.data.rooms,
    propertyRoomGetWorkspaceRows_:sheet => sheet.name === 'V2_contracts' ? f.data.contracts : (sheet.name === 'V2_tenants' ? f.data.tenants : []),
    propertyRoomGetRowsByRoomIds_:() => [],
    workspaceBuildWorkspaceView_:value => value,
    workspaceBuildUserView_:value => value,
    workspaceBuildMembershipView_:value => value,
    workspaceResult_:(success,code,message,data) => ({success,code,message,data})
  });
  const result = f.context.getLandlordPropertiesInitByLineUid_('fixture-owner', false);
  assert.equal(result.success, true, result.message);
  return result.data.properties[0].rooms[0];
}

test('actual properties init keeps scheduled-paper association and duplicate guards after the start day', () => {
  for (const day of ['2026-10-14','2026-10-15','2028-10-14']) {
    for (const mutate of [
      f => { f.tenant.current_contract_id = 'foreign'; },
      f => { f.tenant.room_id = 'foreign'; },
      f => { f.tenant.property_id = 'foreign'; },
      f => { f.contract.property_id = 'foreign'; },
      f => { f.room.current_contract_id = 'foreign'; },
      f => { f.data.contracts.push({...f.contract}); },
      f => { f.data.tenants.push({...f.tenant}); }
    ]) {
      const f = fixture(day);
      mutate(f);
      const view = propertiesInit(f);
      assert.equal(view.effective_status, 'needs_review', day + ' ' + mutate);
      assert.equal(view.has_active_contract, false);
      assert.equal(view.has_upcoming_contract, false);
    }
    const valid = fixture(day);
    assert.equal(propertiesInit(valid).effective_status, day < '2026-10-15' ? 'upcoming' : 'occupied');
  }
});

test('a dated paper lease keeps effective history and recovery after expiry without rewriting audit status', () => {
  for (const [day,status] of [['2026-10-02','upcoming'], ['2026-10-15','active'], ['2028-10-15','expired']]) {
    const f = fixture(day);
    const before = JSON.stringify(f.data);
    const result = f.tenants();
    assert.equal(result.length, 1, day);
    assert.equal(result[0].current_contract_status, status, day);
    assert.equal(result[0].contract_history[0].effective_contract_status, status, day);
    assert.equal(result[0].contract_history[0].contract_status, 'upcoming', 'original status remains available');
    assert.equal(JSON.stringify(f.data), before);
    if (status === 'expired') assert.equal(f.roomView().effective_status, 'needs_review');
  }
});

test('detail renewal/checkout controls follow effective paper status, not a stale stored upcoming label', () => {
  const c = pageFunctions('landlord-tenant-detail.html', ['renderContractHistory'], {
    rawText:value => String(value ?? ''), normalizedStatus:value => String(value ?? '').toLowerCase(),
    numberValue:(value,fallback) => Number(value) || fallback, safeHtml:value => String(value ?? ''),
    escapeHtml:value => String(value ?? ''), money:value => String(value ?? 0), formatDate:value => value,
    statusText:value => value
  });
  for (const status of ['active','expired']) {
    const html = c.renderContractHistory([{contract_id:'C-paper', is_current:true, contract_status:'upcoming', effective_contract_status:status}]);
    assert.match(html, /發起續約/);
    assert.match(html, /手動辦理退房/);
  }
  assert.doesNotMatch(c.renderContractHistory([{contract_id:'C-paper', is_current:true, contract_status:'upcoming', effective_contract_status:'upcoming'}]), /發起續約|手動辦理退房/);
});

test('actual detail renewal click navigates for effective active/expired and refuses future paper', () => {
  const contract = {contract_id:'C-paper', property_id:'P1', room_id:'R1', contract_status:'upcoming', effective_contract_status:'upcoming'};
  const toasts = [];
  const location = {href:''};
  const c = pageFunctions('landlord-tenant-detail.html', ['goTenantRenewal'], {
    CURRENT_TENANT_CONTRACTS:[contract], rawText:value => String(value ?? ''),
    normalizedStatus:value => String(value ?? '').toLowerCase(), showToast:value => toasts.push(value),
    URLSearchParams, location, TEST_MODE:false, window:{CMWEBS_RELEASE_VERSION:'fixture'}
  });
  c.goTenantRenewal('C-paper');
  assert.equal(location.href, '');
  assert.match(toasts[0], /不可發起續約/);
  for (const status of ['active','expired']) {
    contract.effective_contract_status = status;
    c.goTenantRenewal('C-paper');
    const url = new URL(location.href, 'https://fixture.invalid/');
    assert.equal(url.pathname, '/landlord-tenant-create.html');
    assert.equal(url.searchParams.get('mode'), 'renewal');
    assert.equal(url.searchParams.get('previous_contract_id'), 'C-paper');
    assert.equal(url.searchParams.get('property_id'), 'P1');
    assert.equal(url.searchParams.get('room_id'), 'R1');
    location.href = '';
  }
  assert.equal(toasts.length, 1);
  assert.equal(contract.contract_status, 'upcoming');
});

test('future paper room is reserved, not occupied/vacant/review-needed, and exposes its existing tenant', () => {
  const f = fixture();
  const before = JSON.stringify(f.data);
  const view = f.roomView();
  assert.equal(view.effective_status, 'upcoming');
  assert.equal(view.effective_status_label, '待起租');
  assert.equal(view.has_active_contract, false);
  assert.equal(view.has_upcoming_contract, true);
  assert.equal(view.current_contract_id, 'C-paper');
  assert.equal(view.current_tenant_id, 'tenant-fixture');
  assert.equal(view.contract_start_date, '2026-10-15');
  assert.equal(view.needs_occupancy_review, false);
  assert.equal(view.management_fee, 0);
  assert.equal(JSON.stringify(f.data), before, 'read models must not silently repair live rows');
});

test('paper upcoming lease becomes occupied on its start day without waiting for a status rewrite', () => {
  for (const day of ['2026-10-15', '2026-10-16']) {
    const f = fixture(day);
    assert.equal(f.roomView().effective_status, 'occupied', day);
    assert.equal(f.roomView().has_active_contract, true, day);
    assert.equal(f.tenants().length, 1, day);
    assert.equal(f.tenants()[0].current_contract_status, 'active', day);
    assert.equal(f.contract.contract_status, 'upcoming', 'effective status does not mutate stored audit data');
  }
});

test('Sheets Date and timestamp paper leases use Taipei calendar days at both boundaries', () => {
  for (const asDate of [false, true]) {
    for (const [day, expected] of [['2026-10-14','upcoming'], ['2026-10-15','active'], ['2028-10-14','active']]) {
      const f = fixture(day);
      f.contract.start_date = asDate ? new Date('2026-10-14T16:00:00Z') : '2026-10-14T16:00:00Z';
      f.contract.end_date = asDate ? new Date('2028-10-13T16:00:00Z') : '2028-10-13T16:00:00Z';
      assert.equal(f.tenants()[0]?.current_contract_status, expected, day + ' asDate=' + asDate);
      assert.equal(f.roomView().effective_status, expected === 'upcoming' ? 'upcoming' : 'occupied');
    }
  }
});

for (const [label, mutate] of [
  ['another Workspace', f => { f.contract.workspace_id = 'W2'; }],
  ['foreign tenant', f => { f.tenant.workspace_id = 'W2'; }],
  ['foreign room', f => { f.room.workspace_id = 'W2'; }],
  ['another contract property', f => { f.contract.property_id = 'P-other'; }],
  ['another tenant property', f => { f.tenant.property_id = 'P-other'; }],
  ['missing property association', f => { f.contract.property_id = ''; f.room.property_id = ''; f.tenant.property_id = ''; }],
  ['another room pointer', f => { f.room.current_contract_id = 'C-other'; }],
  ['another tenant pointer', f => { f.room.current_tenant_id = 'tenant-other'; }],
  ['another tenant contract pointer', f => { f.tenant.current_contract_id = 'C-other'; }],
  ['inactive tenant', f => { f.tenant.account_status = 'inactive'; }],
  ['archived room', f => { f.room.account_status = 'archived'; }],
  ['unsigned electronic draft', f => { f.contract.contract_origin = 'landlord_initiated'; f.contract.signing_mode = 'new_tenant'; }],
  ['cancelled contract', f => { f.contract.contract_status = 'cancelled'; }],
  ['unverified future active record', f => { f.contract.contract_status = 'active'; }]
]) {
  test('future tenant fallback refuses ' + label, () => {
    const f = fixture();
    mutate(f);
    assert.equal(f.tenants().length, 0);
  });
}

function pageFunctions(page, names, globals) {
  const source = readFileSync(new URL('../' + page, import.meta.url), 'utf8');
  const context = vm.createContext(globals);
  for (const name of names) {
    const syncStart = source.indexOf('    function ' + name + '(');
    const asyncStart = source.indexOf('    async function ' + name + '(');
    const start = syncStart >= 0 ? syncStart : asyncStart;
    assert.ok(start >= 0, name);
    const following = source.slice(start + 1).search(/\n    (?:async )?function /);
    assert.ok(following >= 0, 'next function after ' + name);
    const next = start + 1 + following;
    vm.runInContext(source.slice(start, next), context);
  }
  return context;
}

test('room desktop/mobile renderers link the reserved tenant and do not offer duplicate creation or archive', () => {
  const c = pageFunctions('landlord-properties.html', ['renderRoomTableRow', 'roomCard'], {
    safeHtml:value => String(value ?? ''), money:value => String(value ?? 0), roomFinance:() => ''
  });
  const room = {room_id:'R1', room_name:'501', account_status:'active', effective_status:'upcoming', effective_status_label:'待起租', has_upcoming_contract:true, has_active_contract:false, current_tenant_id:'tenant-fixture', contract_start_date:'2026-10-15'};
  for (const render of [c.renderRoomTableRow, c.roomCard]) {
    const html = render(room, {property_id:'P1'}, true);
    assert.match(html, /查看房客/);
    assert.match(html, /2026-10-15/);
    assert.match(html, /tenant-fixture/);
    assert.doesNotMatch(html, /建立房客|手動補登紙本合約/);
    assert.doesNotMatch(html, /onclick="openArchiveEditor\('room'/);
  }
});

test('reserved room financial editing preserves its stored status and zero management fee', async () => {
  const room = fixture().roomView();
  const inputs = {roomPropertyId:'P1', roomName:'501', roomRent:'19570', roomManagementFee:'0', roomDepositAmount:'39140', roomStatus:'upcoming'};
  let sent;
  const button = {};
  const c = pageFunctions('landlord-properties.html', ['saveRoom'], {
    getRoom:() => room, inputValue:key => inputs[key] || '',
    document:{getElementById:() => button}, showToast:() => {}, closeEditor:() => {}, loadPage:async () => {},
    jsonpRequest:async (route, values) => { sent = {route, values}; return {success:true}; }
  });
  await c.saveRoom('R1');
  assert.equal(sent.route, 'landlord_room_save');
  assert.equal(sent.values.room_status, 'vacant', 'derived upcoming is not a writable room enum');
  assert.equal(sent.values.rent_amount, '19570');
  assert.equal(sent.values.management_fee, '0');
  assert.equal(sent.values.deposit_amount, '39140');
  assert.equal(sent.values.contract_id, undefined, 'editing room defaults does not rewrite the lease');
});

test('reserved room archive editor refuses direct invocation as well as hiding the button', () => {
  let message = '';
  const c = pageFunctions('landlord-properties.html', ['openArchiveEditor'], {
    getRoom:() => fixture().roomView(), showToast:text => { message = text; },
    document:{getElementById:() => { throw new Error('archive form must not be opened'); }}
  });
  c.openArchiveEditor('room','R1','501');
  assert.match(message, /待起租租約，不能封存/);
});

test('tenant desktop/mobile renderers explicitly label future lease and its start date', () => {
  const c = pageFunctions('landlord-tenants.html', ['renderTenantCard', 'renderTenantRow'], {
    rawText:value => String(value ?? ''), safeHtml:value => String(value ?? ''), money:value => String(value ?? 0),
    numberValue:value => Number(value || 0), normalizeStatus:value => String(value ?? ''),
    statusBadgeClass:() => 'badge', statusLabel:value => String(value ?? ''), formatContractExpiry:() => null,
    CONTRACT_SUMMARY_BY_TENANT:{}
  });
  const tenant = {tenant_id:'tenant-fixture', tenant_name:'Fixture', room_list:'501', current_contract_status:'upcoming', contract_start_date:'2026-10-15'};
  for (const render of [c.renderTenantCard, c.renderTenantRow]) {
    const html = render(tenant);
    assert.match(html, /待起租/);
    assert.match(html, /2026-10-15/);
  }
});
