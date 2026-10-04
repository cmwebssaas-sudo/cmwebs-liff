import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const html=readFileSync(new URL('../landlord-billing.html',import.meta.url),'utf8');
function runtime(response, refresh={success:true}) {
  const calls=[],toasts=[];
  let resolveWrite;
  const button={disabled:false,textContent:''};
  const context=vm.createContext({
    PAGE_DATA:{items:[{room_id:'R1',room_name:'202',existing_bill:{bill_id:'B1',total_amount:9950}}]},
    billingSaveInFlight:false,billingSaveNeedsRefresh:false,
    window:{confirm:()=>true},document:{getElementById:id=>id==='generateButton'?button:id==='total_0'?{textContent:'9350'}:null},
    validateSelected:()=>'',selectedIndexes:()=>[0],inputValue:id=>id==='discount_0'?'600':'',
    getSelectedMonth:()=> '2026-10',rawText:String,money:String,
    showToast:(message,error)=>toasts.push({message,error}),
    jsonpRequest:async action=> {calls.push(action); return new Promise(resolve=>{resolveWrite=()=>resolve(response);});},
    loadPage:async()=>{calls.push('read');return refresh;}
  });
  vm.runInContext(html.slice(html.indexOf('    function updateSelectionSummary()'),html.indexOf('    function validateSelected()')),context);
  vm.runInContext(html.slice(html.indexOf('    function formatBillingGenerationResult('),html.indexOf('    function renderLoading()')),context);
  return {context,button,calls,toasts,resolve:()=>resolveWrite()};
}
test('editing a field while saving cannot unlock submission or send a second write',async()=>{
  const r=runtime({success:true,data:{generated_count:1}});
  const first=r.context.generateBills();
  r.context.updateSelectionSummary();
  assert.equal(r.button.disabled,true);
  const second=r.context.generateBills();
  assert.equal(r.calls.length,1);
  r.resolve(); await Promise.all([first,second]);
});
test('stale correction exposes the actual rejection and reads latest bill without retrying writes',async()=>{
  const r=runtime({success:false,message:'帳單建立失敗',data:{generated_count:0,errors:[{room_id:'R1',message:'帳單金額已變動，請重新載入再更正'}]}});
  const save=r.context.generateBills();r.resolve();await save;
  assert.deepEqual(r.calls,['landlord_bills_generate','read']);
  assert.match(r.toasts.at(-1).message,/202.*帳單金額已變動/);
  assert.equal(r.button.disabled,false);
});
test('successful save followed by failed read remains locked until a fresh read succeeds',async()=>{
  const r=runtime({success:true,data:{generated_count:1}},{success:false});
  const save=r.context.generateBills();r.resolve();await save;
  assert.equal(r.button.disabled,true);
  await r.context.generateBills();
  assert.deepEqual(r.calls,['landlord_bills_generate','read']);
  assert.match(r.toasts.at(-1).message,/已儲存.*重新整理/);
});
test('Email bridge rejection retains nested bill errors for the same recovery flow',async()=>{
  const r=runtime(null);
  r.context.jsonpRequest=async()=>{const error=new Error('帳單建立失敗');error.response={success:false,data:{errors:[{room_id:'R1',message:'帳單金額已變動'}]}};throw error;};
  await r.context.generateBills();
  assert.match(r.toasts.at(-1).message,/帳單金額已變動/);
  assert.deepEqual(r.calls,['read']);
});
test('legacy JSONP timeout never automatically resubmits a billing write',async()=>{
  const timers=[],scripts=[];
  const context=vm.createContext({window:{},API_URL:'https://example.test/exec',LINE_USER_ID:'synthetic',
    setTimeout:callback=>{timers.push(callback);return timers.length;},clearTimeout:()=>{},
    document:{createElement:()=>({}),body:{appendChild:script=>scripts.push(script)}}});
  vm.runInContext(html.slice(html.indexOf('    function jsonpRequest('),html.indexOf('    async function initLine()')),context);
  const request=context.jsonpRequest('landlord_bills_generate',{items_json:'[]'});
  const rejection=assert.rejects(request,/逾時/);
  timers[0]();
  assert.equal(scripts.length,1,'a timed out write must not be retried');
  await rejection;
});

test('a timed-out correction confirms matching saved fields through read-only refresh',async()=>{
  const r=runtime(null);
  r.context.jsonpRequest=async()=>{throw new Error('API 載入逾時');};
  r.context.loadPage=async()=>({success:true,data:{items:[{room_id:'R1',existing_bill:{bill_id:'B1',previous_meter:0,current_meter_reading:0,other_amount:0,discount_amount:600,note:'',tenant_visible_note:'',due_date:'',total_amount:9350}}]}});
  await r.context.generateBills();
  assert.match(r.toasts.at(-1).message,/已核對.*保存/);
  assert.equal(r.toasts.at(-1).error,false);
});

test('a timed-out correction with mismatched saved discount is never called successful',async()=>{
  const r=runtime(null);
  r.context.jsonpRequest=async()=>{throw new Error('API 載入逾時');};
  r.context.loadPage=async()=>({success:true,data:{items:[{room_id:'R1',discount_amount:0,existing_bill:{bill_id:'B1',total_amount:9350}}]}});
  await r.context.generateBills();
  assert.equal(r.toasts.at(-1).error,true);
  assert.doesNotMatch(r.toasts.at(-1).message,/已核對.*保存/);
});

test('matching inputs without the expected recalculated total cannot confirm a timeout',async()=>{
  const r=runtime(null);
  r.context.jsonpRequest=async()=>{throw new Error('API 載入逾時');};
  r.context.loadPage=async()=>({success:true,data:{items:[{room_id:'R1',existing_bill:{bill_id:'B1',previous_meter:0,current_meter_reading:0,other_amount:0,discount_amount:600,note:'',tenant_visible_note:'',due_date:'',total_amount:9950}}]}});
  await r.context.generateBills();
  assert.equal(r.toasts.at(-1).error,true);
});
