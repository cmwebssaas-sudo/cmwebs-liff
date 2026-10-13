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
