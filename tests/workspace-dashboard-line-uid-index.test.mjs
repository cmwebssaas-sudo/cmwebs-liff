import assert from 'node:assert/strict';
import {test} from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {originalGas,access} from './fixtures/read-parity/runtime.mjs';
import {capacityDataset} from './fixtures/read-parity/capacity.mjs';

const source=readFileSync(new URL('../apps-script/V2_WORKSPACE_DASHBOARD_NATIVE.js',import.meta.url),'utf8');
function runtime(){const ctx=vm.createContext({Object});vm.runInContext(source,ctx);return ctx;}
const uid={direct:'U_SYNTHETIC_DIRECT_1234567890',tenant:'U_SYNTHETIC_TENANT_1234567890',
  user:'U_SYNTHETIC_USER_1234567890',view:'U_SYNTHETIC_VIEW_1234567890',
  contract:'U_SYNTHETIC_CONTRACT_1234567890',bill:'U_SYNTHETIC_BILL_1234567890'};
const empty=()=>({rooms:[],tenants:[],users:[],tenant_view_rows:[],contracts:[],bills:[]});
function lookup(ctx,data){return typeof ctx.workspaceDashboardLineUidLookup_==='function'?ctx.workspaceDashboardLineUidLookup_(data):null;}
function resolve(ctx,data,index,args=['t','user','c','']){return ctx.workspaceDashboardResolveTenantLineUid_(data,...args,index);}

test('repeated tenant identity resolution has bounded source-row reads for one snapshot',()=>{
  const ctx=runtime(),data=empty();let reads=0;
  for(let i=0;i<200;i++){
    data.tenants.push({tenant_id:'T'+i,tenant_line_user_id:uid.tenant});
    data.users.push({user_id:'USER'+i,line_user_id:uid.user});
    data.tenant_view_rows.push({tenant_id:'T'+i,tenant_line_user_id:uid.view});
    data.contracts.push({tenant_id:'T'+i,contract_id:'C'+i,tenant_line_user_id:uid.contract});
    data.bills.push({tenant_id:'T'+i,tenant_line_user_id:uid.bill});
  }
  for(const key of Object.keys(data))data[key]=new Proxy(data[key],{get(target,key,receiver){
    if(typeof key==='string'&&/^\d+$/.test(key))reads++;return Reflect.get(target,key,receiver);
  }});
  const index=lookup(ctx,data);
  for(let i=0;i<200;i++)assert.equal(resolve(ctx,data,index,['T'+i,'USER'+i,'C'+i,'']),uid.tenant);
  assert.ok(reads<=4000,'200 lookups must not rescan all200 rows in each of five sources; actual='+reads);
});
test('indexed binding preserves direct then tenant user view contract and bill priority',()=>{
  const ctx=runtime(),data={rooms:[],tenants:[{tenant_id:' T ',tenant_line_user_id:uid.tenant}],
    users:[{user_id:'user',line_user_id:uid.user}],tenant_view_rows:[{tenant_id:'t',tenant_line_user_id:uid.view}],
    contracts:[{tenant_id:'T',contract_id:'c',tenant_line_user_id:uid.contract}],
    bills:[{tenant_id:'t',tenant_line_user_id:uid.bill}]};
  assert.equal(resolve(ctx,data,lookup(ctx,data),['t','user','c',uid.direct]),uid.direct);
  for(const [list,field,want] of [['tenants','tenant_line_user_id',uid.tenant],['users','line_user_id',uid.user],
    ['tenant_view_rows','tenant_line_user_id',uid.view],['contracts','tenant_line_user_id',uid.contract],['bills','tenant_line_user_id',uid.bill]]){
    assert.equal(resolve(ctx,data,lookup(ctx,data)),want);data[list][0][field]='invalid';
  }
  assert.equal(resolve(ctx,data,lookup(ctx,data)),'');
});
test('contract tenant-or-contract matching preserves source order and exact contract ID casing',()=>{
  const ctx=runtime(),data=empty();data.contracts=[
    {tenant_id:'other',contract_id:'c',tenant_line_user_id:uid.contract},
    {tenant_id:' T ',contract_id:'else',tenant_line_user_id:uid.bill}];
  assert.equal(resolve(ctx,data,lookup(ctx,data)),uid.contract);
  assert.equal(resolve(ctx,data,lookup(ctx,data),['t','user','C','']),uid.bill);
});
test('duplicate and prototype-like identity keys retain first matching candidate and user case sensitivity',()=>{
  const ctx=runtime(),data=empty();data.tenants=[{tenant_id:' __proto__ ',line_user_id:uid.tenant},
    {tenant_id:'__PROTO__',tenant_line_user_id:uid.bill}];
  data.users=[{user_id:'constructor',line_user_id:uid.user}];
  assert.equal(resolve(ctx,data,lookup(ctx,data),['__proto__','constructor','','']),uid.tenant);
  data.tenants=[];
  assert.equal(resolve(ctx,data,lookup(ctx,data),['','Constructor','','']),'');
  assert.equal(resolve(ctx,data,lookup(ctx,data),['','constructor','','']),uid.user);
});
test('fresh lookup construction observes added rows without cross-request cached bindings',()=>{
  const ctx=runtime(),data=empty();data.tenants=[{tenant_id:'T',line_user_id:uid.tenant}];
  assert.equal(resolve(ctx,data,lookup(ctx,data)),uid.tenant);
  data.tenants.unshift({tenant_id:'t',line_user_id:uid.bill});
  assert.equal(resolve(ctx,data,lookup(ctx,data)),uid.bill);
});
test('non-scalar identity cells keep original conditional coercion behavior',()=>{
  const ctx=runtime(),data=empty();let coerced=0;
  data.contracts=[{tenant_id:'T',contract_id:{toString(){coerced++;throw new Error('SYNTHETIC_COERCION');}},tenant_line_user_id:uid.contract}];
  const index=lookup(ctx,data);assert.equal(index,null);assert.equal(coerced,0);
  assert.equal(resolve(ctx,data,index),uid.contract);assert.equal(coerced,0,'tenant match short-circuits contract ID coercion');
});
test('dynamic binding accessors retain original scans and observe later source mutations',()=>{
  const ctx=runtime(),data=empty();let reads=0;
  data.users=[{user_id:'old',line_user_id:uid.user}];
  data.tenants=[{tenant_id:'T',get tenant_line_user_id(){reads++;data.users[0].user_id='user';return 'invalid';}}];
  const index=lookup(ctx,data);assert.equal(index,null);assert.equal(reads,0);
  assert.equal(resolve(ctx,data,index),uid.user);assert.equal(reads,1);
});

test('actual tenant builder preserves binding after relationship identity coercion mutates a user key',()=>{
  for(const [list,field] of [['tenants','tenant_user_id'],['tenants','user_id'],['tenant_view_rows','tenant_user_id'],['tenant_view_rows','user_id'],['contracts','tenant_user_id']]){
    const ctx=originalGas(capacityDataset());
    const data=ctx.workspaceDashboardLoadData_(ctx.SpreadsheetApp.getActiveSpreadsheet(),access,{});
    const tenant=data.tenants[0],contract=data.contracts.find(row=>row.tenant_id===tenant.tenant_id);
    const user=data.users.find(row=>row.user_id===tenant.tenant_user_id);
    assert.ok(user&&contract,'actual source loader supplies the associated synthetic rows');
    const wanted=user.user_id;
    user.user_id='SYNTHETIC_OLD_KEY';user.line_user_id=uid.user;
    tenant.tenant_user_id='';tenant.user_id='';contract.tenant_user_id='';
    const view={tenant_id:tenant.tenant_id};data.tenant_view_rows=[view];
    const row=list==='tenants'?tenant:list==='contracts'?contract:view;
    row[field]={toString(){user.user_id=wanted;return wanted;}};
    const result=ctx.workspaceDashboardBuildTenantList_(access,data).find(row=>row.tenant_id===tenant.tenant_id);
    assert.ok(result,'actual builder must retain the operational synthetic tenant');
    assert.equal(result.tenant_line_user_id,uid.user,list+'.'+field);
    assert.equal(result.tenant_binding_status,'bound',list+'.'+field);
  }
});
test('non-scalar resolver arguments retain mutations before original matching scans',()=>{
  for(const position of [0,1,2,3]){
    const ctx=runtime(),data=empty();data.users=[{user_id:'old',line_user_id:uid.user}];
    const args=['t','user','c',''];
    const returnValue=args[position];
    args[position]={toString(){data.users[0].user_id='user';return returnValue;}};
    assert.equal(resolve(ctx,data,lookup(ctx,data),args),uid.user,'argument '+position);
  }
});

test('actual builder falls back for pre-resolver status room and date side effects',()=>{
  for(const kind of ['status','room','date']){
    const ctx=originalGas(capacityDataset());
    const data=ctx.workspaceDashboardLoadData_(ctx.SpreadsheetApp.getActiveSpreadsheet(),access,{});
    const tenant=data.tenants[0],contract=data.contracts.find(row=>row.tenant_id===tenant.tenant_id);
    const user=data.users.find(row=>row.user_id===tenant.tenant_user_id),wanted=user.user_id;
    assert.ok(user&&contract);
    user.user_id='SYNTHETIC_OLD_KEY';user.line_user_id=uid.user;
    if(kind==='status')Object.defineProperty(tenant,'account_status',{get(){user.user_id=wanted;return 'active';},enumerable:true});
    if(kind==='room'){
      const room=data.rooms.find(row=>row.room_id===contract.room_id);
      Object.defineProperty(room,'account_status',{get(){user.user_id=wanted;return 'active';},enumerable:true});
    }
    if(kind==='date'){
      const other={...contract,contract_id:'SYNTHETIC_OLDER_CONTRACT',start_date:'2025-01-01',end_date:'2025-12-31',contract_status:'expired'};
      data.contracts.push(other);
      Object.defineProperty(other,'updated_at',{get(){user.user_id=wanted;return '2025-01-01';},enumerable:true});
    }
    const result=ctx.workspaceDashboardBuildTenantList_(access,data).find(row=>row.tenant_id===tenant.tenant_id);
    assert.ok(result,kind+' actual operational tenant');
    assert.equal(result.tenant_line_user_id,uid.user,kind);
    assert.equal(result.tenant_binding_status,'bound',kind);
  }
});

test('normal canonical loader snapshots remain eligible and decorated date cells fall back without coercion',()=>{
  const ctx=originalGas(capacityDataset());
  const data=ctx.workspaceDashboardLoadData_(ctx.SpreadsheetApp.getActiveSpreadsheet(),access,{});
  assert.ok(lookup(ctx,data),'actual500-room native scalar/date snapshot must use the bounded index');
  let reads=0;
  const date=new ctx.Date('2026-01-01');
  date.valueOf=()=>{reads++;data.users[0].user_id='changed';return 0;};
  data.contracts[0].updated_at=date;
  assert.equal(lookup(ctx,data),null);assert.equal(reads,0,'eligibility must not invoke custom date coercion');
});

test('actual builder rejects Proxy-wrapped date cells without invoking their traps during eligibility',()=>{
  const ctx=originalGas(capacityDataset());
  const data=ctx.workspaceDashboardLoadData_(ctx.SpreadsheetApp.getActiveSpreadsheet(),access,{});
  const tenant=data.tenants[0],contract=data.contracts.find(row=>row.tenant_id===tenant.tenant_id);
  const user=data.users.find(row=>row.user_id===tenant.tenant_user_id),wanted=user.user_id;
  user.user_id='SYNTHETIC_OLD_KEY';user.line_user_id=uid.user;
  const date=new ctx.Date('2026-01-01');let reads=0;
  contract.start_date=new Proxy(date,{get(target,key){
    if(key==='getTime')return ()=>{reads++;user.user_id=wanted;return ctx.Date.prototype.getTime.call(target);};
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
  const older=vm.runInContext('({})',ctx);
  Object.assign(older,contract,{contract_id:'SYNTHETIC_OLDER_CONTRACT',start_date:'2025-01-01',end_date:'2025-12-31',contract_status:'expired'});
  data.contracts.push(older);
  const index=lookup(ctx,data);
  assert.equal(reads,0,'native slot validation must not invoke source method traps');
  const result=ctx.workspaceDashboardBuildTenantList_(access,data).find(row=>row.tenant_id===tenant.tenant_id);
  assert.ok(reads>0,'actual builder reaches the original date read');
  assert.equal(result.tenant_line_user_id,uid.user);
  assert.equal(result.tenant_binding_status,'bound');
  assert.equal(index,null,'a Date proxy must not be indexed');
});

// Exercise the actual arrears entry and resolver; only replace the outer IO /
// authorization executor to inject its already-scoped request snapshot. The
// oracle keeps the unmodified resolver's original five-argument scan path.
function arrearsEntry(prepare=()=>{},scan=false){
  const ctx=originalGas(capacityDataset());
  const data=ctx.workspaceDashboardLoadData_(ctx.SpreadsheetApp.getActiveSpreadsheet(),access,{mode:'arrears'});
  const state=prepare(ctx,data)||{};
  if(scan){
    const resolver=ctx.workspaceDashboardResolveTenantLineUid_;
    ctx.workspaceDashboardResolveTenantLineUid_=(...args)=>resolver(...args.slice(0,5));
  }
  ctx.workspaceDashboardExecute_=(line,action,build)=>{
    assert.equal(line,'SYNTHETIC_LINE1');assert.equal(action,'landlord_arrears');
    return build(ctx.SpreadsheetApp.getActiveSpreadsheet(),access,data);
  };
  const result=ctx.getWorkspaceLandlordArrearsNativeByLineUid_('SYNTHETIC_LINE1');
  return {json:JSON.stringify(result),result,data,state};
}
function billRow(ctx,fields){
  return Object.assign(vm.runInContext('({})',ctx),{bill_id:'B',tenant_id:'t',bill_status:'issued',payment_status:'unpaid',
    bill_month:'2026-10',due_date:'2026-10-10',total_amount:100,room_name:'1',tenant_line_user_id:''},fields);
}

test('actual arrears entry resolves 500 inert bills with linear source reads and exact scan-oracle JSON',t=>{
  function countReads(ctx,data){
    const state={reads:0};
    assert.equal(data.bills.length,500);
    for(const name of ['rooms','contracts','tenants','users','tenant_view_rows'])assert.equal(data[name].length,0);
    data.bills=new Proxy(data.bills,{get(target,key,receiver){
      if(typeof key==='string'&&/^\d+$/.test(key))state.reads++;
      return Reflect.get(target,key,receiver);
    }});
    return state;
  }
  const oracle=arrearsEntry(countReads,true),actual=arrearsEntry(countReads);
  assert.equal(actual.json,oracle.json,'complete original-order result, including every field, must remain exact');
  assert.equal(actual.result.data.arrears.length,252);
  t.diagnostic(JSON.stringify({bills:500,outstanding:252,scan_reads:oracle.state.reads,actual_reads:actual.state.reads,linear_limit:6000}));
  assert.ok(actual.state.reads<=6000,'actual arrears entry must avoid 252 full scans of 500 bills; reads='+actual.state.reads);
});

for(const reverse of [false,true])test('actual arrears preserves duplicate bill binding source order, reversed='+reverse,()=>{
  const prepare=(ctx,data)=>{
    const donors=[billRow(ctx,{bill_id:'DONOR1',tenant_id:' T ',bill_status:'cancelled',tenant_line_user_id:uid.bill}),
      billRow(ctx,{bill_id:'DONOR2',tenant_id:'t',payment_status:'paid',tenant_line_user_id:uid.contract})];
    if(reverse)donors.reverse();
    data.bills=[...donors,billRow(ctx,{bill_id:'OUTSTANDING',tenant_id:' t ',tenant_line_user_id:'invalid'})];
    assert.ok(lookup(ctx,data),'ordinary arrears snapshot must be eligible');
  };
  const actual=arrearsEntry(prepare),oracle=arrearsEntry(prepare,true);
  assert.equal(actual.json,oracle.json);
  assert.equal(actual.result.data.arrears.length,1);
  assert.equal(actual.result.data.arrears[0].tenant_line_user_id,reverse?uid.contract:uid.bill);
});

for(const [kind,want] of [['direct',uid.direct],['tenant',uid.tenant],['user',uid.user],['view',uid.view],['contract',uid.contract],['bill',uid.bill]]){
  test('actual arrears keeps '+kind+' binding priority with full scan-oracle equality',()=>{
    const prepare=(ctx,data)=>{
      const priorities=['direct','tenant','user','view','contract','bill'],start=priorities.indexOf(kind);
      const value=key=>priorities.indexOf(key)>=start?uid[key]:'invalid';
      data.tenants=[billRow(ctx,{tenant_id:' T ',tenant_line_user_id:value('tenant')})];
      data.users=[billRow(ctx,{user_id:'user',line_user_id:value('user')})];
      data.tenant_view_rows=[billRow(ctx,{tenant_id:'t',tenant_line_user_id:value('view')})];
      data.contracts=[billRow(ctx,{tenant_id:'other',contract_id:'c',contract_status:'expired',tenant_line_user_id:value('contract')})];
      data.bills=[billRow(ctx,{bill_id:'DONOR',tenant_id:'T',bill_status:'cancelled',tenant_line_user_id:value('bill')}),
        billRow(ctx,{tenant_id:'t',tenant_user_id:'user',contract_id:'c',tenant_line_user_id:value('direct')})];
      assert.ok(lookup(ctx,data));
    };
    const actual=arrearsEntry(prepare),oracle=arrearsEntry(prepare,true);
    assert.equal(actual.json,oracle.json);assert.equal(actual.result.data.arrears[0].tenant_line_user_id,want);
  });
}

test('actual arrears keeps empty defaults, exact user/contract case and prototype-like tenant IDs',()=>{
  for(const [tenant,user,contract,want] of [['','','',''],['','USER','C',''],['','user','c',uid.user],['__proto__','','',uid.bill]]){
    const prepare=(ctx,data)=>{
      data.users=[billRow(ctx,{user_id:'user',line_user_id:uid.user})];
      data.contracts=[billRow(ctx,{tenant_id:'other',contract_id:'c',contract_status:'expired',tenant_line_user_id:uid.contract})];
      data.bills=[billRow(ctx,{bill_status:'cancelled',tenant_id:' __PROTO__ ',tenant_line_user_id:uid.bill}),
        billRow(ctx,{tenant_id:tenant,tenant_user_id:user,contract_id:contract})];
    };
    const actual=arrearsEntry(prepare);assert.equal(actual.json,arrearsEntry(prepare,true).json);
    assert.equal(actual.result.data.arrears[0].tenant_line_user_id,want);
  }
  const prepare=(_ctx,data)=>{data.bills=[];};
  const actual=arrearsEntry(prepare);assert.equal(actual.json,arrearsEntry(prepare,true).json);
  assert.equal(actual.result.data.arrears.length,0);assert.equal(actual.result.data.summary.unpaid_total_amount,0);
});

for(const kind of ['getter','decorated-date','proxy-date','identity-coercion']){
  test('actual arrears retains '+kind+' source mutation through scan fallback',()=>{
    const prepare=(ctx,data)=>{
      const state={reads:0},donor=billRow(ctx,{bill_id:'DONOR',tenant_id:'old',bill_status:'cancelled',tenant_line_user_id:uid.bill});
      const bill=billRow(ctx,{tenant_id:'t'});
      const mutate=()=>{state.reads++;donor.tenant_id='t';};
      if(kind==='getter')Object.defineProperty(bill,'due_date',{get(){mutate();return '2026-10-10';},enumerable:true});
      if(kind==='decorated-date'){
        const date=new ctx.Date('2026-10-10');date.getTime=()=>{mutate();return ctx.Date.prototype.getTime.call(date);};bill.due_date=date;
      }
      if(kind==='proxy-date'){
        const date=new ctx.Date('2026-10-10');bill.due_date=new Proxy(date,{get(target,key){
          if(key==='getTime')return ()=>{mutate();return ctx.Date.prototype.getTime.call(target);};
          const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
        }});
      }
      if(kind==='identity-coercion')bill.tenant_id={toString(){mutate();return 't';}};
      data.bills=[donor,bill];return state;
    };
    const actual=arrearsEntry(prepare),oracle=arrearsEntry(prepare,true);
    assert.equal(actual.json,oracle.json);assert.equal(actual.state.reads,oracle.state.reads);
    assert.ok(actual.state.reads>0);assert.equal(actual.result.data.arrears[0].tenant_line_user_id,uid.bill);
  });
}

test('actual arrears resolves fresh same-tenant bill bindings independently per request',()=>{
  for(const wanted of [uid.bill,uid.contract]){
    const prepare=(ctx,data)=>{data.bills=[billRow(ctx,{bill_status:'cancelled',tenant_line_user_id:wanted}),billRow(ctx,{})];};
    const actual=arrearsEntry(prepare);assert.equal(actual.json,arrearsEntry(prepare,true).json);
    assert.equal(actual.result.data.arrears[0].tenant_line_user_id,wanted);
  }
});
