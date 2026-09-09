import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync('apps-script/V2_MANUAL_SETTLEMENT.js', 'utf8');
const page = readFileSync('landlord-arrears.html', 'utf8');
const extract = (text, name) => {
  const start = text.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' must exist');
  let depth=0; const open=text.indexOf('{', start);
  for(let i=open;i<text.length;i++){ if(text[i]==='{')depth++; if(text[i]==='}')depth--; if(!depth)return text.slice(start,i+1); }
};
const bill = {bill_id:'B1',workspace_id:'W1',payment_status:'paid',payment_id:'P1',total_amount:100};
const payment = {payment_id:'P1',bill_id:'B1',workspace_id:'W1',status:'confirmed',amount:100};
let busy=false, allowed=true, released=0;
const c=vm.createContext({
  LockService:{getScriptLock:()=>({tryLock:()=>!busy,releaseLock:()=>released++})},
  runtimeSpreadsheet_:()=>({getSheetByName:name=>name}),
  workspaceLandlordResolveAccess_:()=>({success:allowed,workspace:{workspace_id:'W1'},code:'FORBIDDEN'}),
  workspaceLandlordCheckPolicy_:()=>({success:allowed}),
  billingBillMatchesAccessScope_:(b,a)=>b.workspace_id===a.workspace.workspace_id,
  v2CanonicalBillIsVoided_:b=>b.status==='void',
  manualSettlementFindRowByHeader_:(s,h,id)=>({object:h==='bill_id'?bill:payment}),
  MANUAL_SETTLEMENT_BILLS_SHEET:'V2_bills',MANUAL_SETTLEMENT_PAYMENTS_SHEET:'V2_payments',
  manualSettlementText_:v=>String(v||'').trim()
});
vm.runInContext(extract(source,'getManualSettlementStatusByLineUid_'),c);
assert.equal(c.getManualSettlementStatusByLineUid_('U1','B1').data.committed,true);
payment.status='void'; assert.equal(c.getManualSettlementStatusByLineUid_('U1','B1').data.committed,false);
payment.status='confirmed';payment.amount=99;assert.equal(c.getManualSettlementStatusByLineUid_('U1','B1').data.committed,false);
payment.amount=100;payment.bill_id='B2';assert.equal(c.getManualSettlementStatusByLineUid_('U1','B1').data.committed,false);
payment.bill_id='B1';busy=true;assert.equal(c.getManualSettlementStatusByLineUid_('U1','B1').data.committed,false);
busy=false;bill.workspace_id='W2';assert.equal(c.getManualSettlementStatusByLineUid_('U1','B1').success,false);
allowed=false;assert.equal(c.getManualSettlementStatusByLineUid_('U1','B1').success,false);
assert.ok(released>0);

let calls=0;
const client=vm.createContext({callApi:async(action,params,timeout)=>{
  calls++;assert.equal(action,'landlord_bill_manual_settlement_status');assert.equal(params.bill_id,'B1');
  assert.ok(timeout>=30000,'status must not reintroduce the observed 5s timeout');
  return {success:true,data:{bill_id:'B1',committed:true}};
}});
vm.runInContext('async '+extract(page,'recoverTimedOutManualSettlement'),client);
assert.equal(await client.recoverTimedOutManualSettlement('B1'),true);assert.equal(calls,1);
client.callApi=async()=>{calls++;throw new Error('timeout');};
assert.equal(await client.recoverTimedOutManualSettlement('B1'),false);assert.equal(calls,2,'uncertain reads must not fan out retries');
console.log('Authoritative settlement status and bounded recovery passed');

// A slow/lost write response must never cause a second financial mutation.
let writes = 0, checks = 0, releaseWrite;
const button = {disabled:false,textContent:''};
const fields = {paymentDate:'2026-09-09',paymentMethod:'bank_transfer',paymentAmount:'100',
  bankLast5:'',confirmationSource:'landlord_confirmed',landlordNote:''};
const alerts = [];
const ui = vm.createContext({
  ACTIVE_BILL_ID:'B1',
  document:{getElementById:id=>id==='submitSettlementBtn'?button:{value:fields[id]||'',checked:false}},
  findArrearByBillId:()=>({total_amount:100}),
  showAlert:message=>alerts.push(message),
  closeSettlementModal:()=>{},loadPage:()=>{},
  recoverTimedOutManualSettlement:async()=>{checks++;return false;},
  callApi:async()=>{writes++;await new Promise(resolve=>{releaseWrite=resolve;});throw Object.assign(new Error('timeout'),{code:'API_TIMEOUT'});}
});
vm.runInContext('let settlementInFlight_=false; const uncertainSettlementBills_=new Set();\nasync '+extract(page,'submitManualSettlement'),ui);
const first = ui.submitManualSettlement();
await ui.submitManualSettlement();
assert.equal(writes,1,'in-flight clicks must be ignored');
assert.equal(button.disabled,true);
releaseWrite();await first;
assert.equal(checks,1,'timeout checks once');
await ui.submitManualSettlement();
assert.equal(writes,1,'uncertain result must allow only a read-only check');
assert.equal(checks,2);
assert.match(button.textContent,/不重送/);
