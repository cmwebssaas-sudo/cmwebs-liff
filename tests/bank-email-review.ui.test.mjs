import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('landlord-payment-report-review.html','utf8');
const dispatcher=fs.readFileSync('apps-script/程式碼.js','utf8');
function functionSource(name){const start=html.indexOf('    function '+name+'(');assert.ok(start>=0,name);const tail=html.slice(start);const end=tail.search(/\n    (?:async )?function /);return end<0?tail.slice(0,tail.indexOf('</script>')):tail.slice(0,end);}
test('bank receipts show matched and unmatched actions without marking bills paid',()=>{
 const context={BANK_RECEIPT_ERROR:'',BANK_RECEIPT_DATA:{can_approve_payment:true,bills:[{bill_id:'bill-a',room_name:'合成房間',bill_month:'2026-10',total_amount:6432}],receipts:[{receipt_id:'receipt-a',status:'pending',match_bill_id:'bill-a',amount:6432,payer_bank:'合成銀行',payer_last5:'01234',payment_at:'2026-10-09T09:07:00+08:00'},{receipt_id:'receipt-b',status:'unmatched',amount:6432,payer_bank:'合成銀行',payer_last5:'01234'}]},safeHtml:v=>String(v??'').replace(/</g,'&lt;'),money:v=>'NT$ '+v,rawText:v=>String(v??'')};
 vm.runInNewContext(functionSource('bankReceiptPanel'),context);
 const output=context.bankReceiptPanel();assert.match(output,/確認銷帳/);assert.match(output,/配對有誤/);assert.match(output,/無法配對/);assert.match(output,/選擇帳單/);assert.match(output,/其他款項/);assert.doesNotMatch(output,/已繳清/);
 context.BANK_RECEIPT_DATA.can_approve_payment=false;assert.doesNotMatch(context.bankReceiptPanel(),/onclick=/);
});
test('new receipt actions reject GET and dispatch POST body credentials',()=>{
 assert.match(dispatcher,/bankReceiptIsAction_\(v2Action\)/);assert.match(dispatcher,/bankReceiptDispatch_\(bankRequest\.action, bankRequest\.request\)/);
});
test('bank confirmation timeout refreshes state without automatically resending writes',()=>{
 assert.match(html,/async function submitBankReceipt\(/);assert.match(html,/銷帳結果尚未確認/);assert.match(html,/loadBankReceipts\(/);
});
