import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('landlord-payment-report-review.html','utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('async function initLine'));
function fixture(){
 const buttons=['a','b'].map(id=>({disabled:false,textContent:'確認銷帳',closest:()=>cards[id]}));
 const cards={a:{dataset:{receiptId:'a'},setAttribute(){},querySelectorAll:()=>[buttons[0]]},b:{dataset:{receiptId:'b'},setAttribute(){},querySelectorAll:()=>[buttons[1]]}};
 const ctx={URL,URLSearchParams,console,setTimeout:fn=>{fn();return 1;},clearTimeout(){},innerHeight:844,addEventListener(){},location:{href:'https://example.test/review.html',search:''},document:{documentElement:{style:{setProperty(){}}},getElementById:()=>({}),querySelectorAll:()=>buttons}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(script.replace(/\n    loadPage\(\);\s*$/,''),ctx);
 vm.runInContext("BANK_RECEIPT_DATA={receipts:[{receipt_id:'a',status:'pending',match_bill_id:'bill-a'},{receipt_id:'b',status:'pending',match_bill_id:'bill-b'}]}",ctx);
 const messages=[];ctx.showToast=m=>messages.push(m);ctx.renderPage=()=>{};
 return {ctx,buttons,messages,state:()=>vm.runInContext('({busy:BANK_RECEIPT_BUSY,uncertain:BANK_RECEIPT_UNCERTAIN,data:BANK_RECEIPT_DATA})',ctx)};
}
test('only selected receipt shows processing and second click never submits a second payment',async()=>{
 const r=fixture();let finish;const calls=[];r.ctx.bankReceiptRequest=(action,input)=>{calls.push({action,input});if(action==='landlord_bank_receipt_confirm')return new Promise(resolve=>finish=resolve);return Promise.reject(Error('readback unavailable'));};
 const task=r.ctx.submitBankReceipt(r.buttons[0],'a','confirm');
 assert.equal(r.buttons[0].disabled,true);assert.equal(r.buttons[1].disabled,false);assert.match(r.buttons[0].textContent,/處理/);
 await r.ctx.submitBankReceipt(r.buttons[1],'b','confirm');assert.equal(calls.length,1);
 finish({success:true,data:{receipt_id:'a',status:'settled'}});await task;
 assert.equal(r.state().data.receipts[0].status,'settled');assert.equal(r.state().data.receipts[1].status,'pending');assert.equal(r.state().uncertain,'');assert.ok(r.messages.some(m=>m.includes('已確認銷帳')));
});
test('timeout polls read-only until completed without resending confirmation',async()=>{
 const r=fixture();let writes=0,reads=0;r.ctx.bankReceiptRequest=async action=>{if(action==='landlord_bank_receipt_confirm'){writes++;throw Object.assign(Error('timeout'),{code:'API_TIMEOUT'});}reads++;return {success:true,data:{receipts:[{receipt_id:'a',status:reads===1?'pending':'settled'},{receipt_id:'b',status:'pending',match_bill_id:'bill-b'}]}};};
 await r.ctx.submitBankReceipt(r.buttons[0],'a','confirm');assert.equal(writes,1);assert.equal(reads,2);assert.equal(r.state().data.receipts[0].status,'settled');assert.equal(r.state().data.receipts[1].status,'pending');
});
test('pending timeout remains guarded after readback and cannot be resubmitted',async()=>{
 const r=fixture();let writes=0;r.ctx.bankReceiptRequest=async action=>{if(action==='landlord_bank_receipt_confirm'){writes++;throw Object.assign(Error('timeout'),{code:'API_TIMEOUT'});}return {success:true,data:{receipts:[{receipt_id:'a',status:'pending'},{receipt_id:'b',status:'pending',match_bill_id:'bill-b'}]}};};
 await r.ctx.submitBankReceipt(r.buttons[0],'a','confirm');assert.equal(r.state().uncertain,'a');await r.ctx.submitBankReceipt(r.buttons[0],'a','confirm');assert.equal(writes,1);await r.ctx.submitBankReceipt(r.buttons[1],'b','confirm');assert.equal(writes,1,'another receipt must not erase an unresolved transaction');
});
test('review navigation includes the same five destinations as landlord home',()=>{
 const nav=html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)[0];const home=fs.readFileSync('landlord-home.html','utf8').match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)[0];const routes=s=>[...s.matchAll(/goPage\('([^']+)'\)/g)].map(m=>m[1]);assert.deepEqual(routes(nav),routes(home));
});
