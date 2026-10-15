import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtempSync,chmodSync,writeFileSync,readFileSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createAuthorityPreparationControl} from '../scripts/read-authority-preparation-control.mjs';
import {createAuthorityNativeCapture} from '../scripts/read-authority-native-capture.mjs';
const api=await import('../scripts/read-authority-native-producer.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const clock=Date.parse('2026-10-14T00:00:00Z');
const request=(patch={})=>Object.freeze({requestId:randomUUID(),actor:'caller',phase:'wrapper-before',page:1,url:'https://script.google.com/home/executions',method:'getAXState',disableDiffing:true,...patch});
function setup(patch={}){
 let now=clock;const calls=[];
 const caller={id:'synthetic-caller-tab',getAXState:async options=>{calls.push({actor:'caller',options});return 'SYNTHETIC_FULL_CALLER_AX';}};
 const publisher={id:'synthetic-publisher-tab',getAXState:async options=>{calls.push({actor:'publisher',options});return 'SYNTHETIC_FULL_PUBLISHER_AX';}};
 const input={tabs:{caller:{tab:caller,tabId:caller.id},publisher:{tab:publisher,tabId:publisher.id}},now:()=>now,...patch};
 assert.equal(typeof api.createAuthorityNativeProducer,'function');const producer=api.createAuthorityNativeProducer(input);
 return {producer,input,caller,publisher,calls,setNow:v=>{now=v;}};
}
test('producer invokes exactly one documented full AX call on the bound actor without emitting raw text',async()=>{
 const s=setup();assert.equal(s.calls.length,0);const r=request();const v=await s.producer.read(r);
 assert.deepEqual(v,{requestId:r.requestId,source:'cua.getAXState',capturedAt:clock,snapshot:'SYNTHETIC_FULL_CALLER_AX'});
 assert.deepEqual(s.calls,[{actor:'caller',options:{disableDiffing:true,emit:false}}]);assert.equal(s.producer.status(),'ready');assert(Object.isFrozen(v));
});
test('publisher and qualified phases select only the corresponding pinned handle',async()=>{
 const s=setup();await s.producer.read(request({actor:'publisher',phase:'qualified-after',page:2}));assert.equal(s.calls.length,1);assert.equal(s.calls[0].actor,'publisher');
});
test('changing input handles or methods cannot switch the pinned producer',async()=>{
 const s=setup();s.input.tabs.caller.tab=s.publisher;s.caller.getAXState=async()=>assert.fail('REPLACED_METHOD');await s.producer.read(request());assert.equal(s.calls[0].actor,'caller');
});
for(const [name,patch] of [['actor',{actor:'other'}],['phase',{phase:'authority'}],['page',{page:0}],['URL',{url:'https://private.invalid'}],['method',{method:'getScreenshot'}],['diff',{disableDiffing:false}],['nonce',{requestId:'synthetic-invalid'}],['extra',{query:'PRIVATE'}]])test('descriptor '+name+' is rejected before any UI call',async()=>{
 const s=setup();await assert.rejects(s.producer.read(request(patch)),/^Error: NATIVE_CAPTURE_STOPPED$/);assert.equal(s.calls.length,0);assert.equal(s.producer.status(),'stopped');
});
test('two actor bindings cannot share one tab or mismatch a handle ID',()=>{
 const tab={id:'synthetic-tab',getAXState:async()=>assert.fail('NO_UI')};
 for(const tabs of [{caller:{tab,tabId:tab.id},publisher:{tab,tabId:tab.id}},{caller:{tab,tabId:'other'},publisher:{tab:{...tab,id:'publisher'},tabId:'publisher'}}])assert.throws(()=>setup({tabs}),/NATIVE_CAPTURE_STOPPED/);
});
test('replayed nonce is denied without another read',async()=>{
 const s=setup(),r=request();await s.producer.read(r);await assert.rejects(s.producer.read(r),/NATIVE_CAPTURE_STOPPED/);assert.equal(s.calls.length,1);
});
test('UI failure stays stopped, consumes the original rejection and cannot retry with a new nonce',async()=>{
 const tab={id:'synthetic-failing',getAXState:async()=>{throw Error('PRIVATE_UI_FAILURE');}};
 const s=setup({tabs:{caller:{tab,tabId:tab.id},publisher:{tab:{id:'publisher',getAXState:async()=>assert.fail('NO_RETRY')},tabId:'publisher'}}});
 await assert.rejects(s.producer.read(request()),/^Error: NATIVE_CAPTURE_STOPPED$/);await assert.rejects(s.producer.read(request({actor:'publisher'})),/^Error: NATIVE_CAPTURE_STOPPED$/);
});
test('concurrent call or stop retains entered UI ownership until its promise settles',async()=>{
 for(const operation of ['concurrent','stop']){
  let enter,release,reads=0;const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});
  const tab={id:'caller',getAXState:async()=>{reads++;enter();await gate;return 'SYNTHETIC_AX';}};
  const s=setup({tabs:{caller:{tab,tabId:tab.id},publisher:{tab:{id:'publisher',getAXState:async()=>assert.fail('OVERLAP')},tabId:'publisher'}}});
  const pending=s.producer.read(request());void pending.catch(()=>{});await entered;assert.equal(s.producer.status(),'reading');
  if(operation==='stop')s.producer.stop();else await assert.rejects(s.producer.read(request({actor:'publisher'})),/NATIVE_CAPTURE_STOPPED/);
  let settled=false;pending.then(()=>{settled=true;},()=>{settled=true;});await new Promise(r=>setImmediate(r));assert.equal(settled,false);release();await assert.rejects(pending,/NATIVE_CAPTURE_STOPPED/);assert.equal(reads,1);
 }
});
test('invalid or backward local clock never creates a usable envelope',async()=>{
 const s=setup();s.setNow(1.5);await assert.rejects(s.producer.read(request()),/NATIVE_CAPTURE_STOPPED/);assert.equal(s.calls.length,0);
 let now=clock;const tab={id:'caller',getAXState:async()=>{now--;return 'AX';}};
 const b=setup({now:()=>now,tabs:{caller:{tab,tabId:tab.id},publisher:{tab:{id:'publisher',getAXState:async()=>''},tabId:'publisher'}}});await assert.rejects(b.producer.read(request()),/NATIVE_CAPTURE_STOPPED/);
});
test('non-string or oversized raw output stays unknown rather than emitting a proof',async()=>{
 for(const snapshot of [{private:'DATA'},'x'.repeat(4000001)]){
  const tab={id:'caller',getAXState:async()=>snapshot};const s=setup({tabs:{caller:{tab,tabId:tab.id},publisher:{tab:{id:'publisher',getAXState:async()=>''},tabId:'publisher'}}});await assert.rejects(s.producer.read(request()),/NATIVE_CAPTURE_STOPPED/);
 }
});

test('producer and private capture use the actual synthetic flock ledger before the only AX read',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-producer-ledger-'));chmodSync(dir,0o700);
 const budget=join(dir,'budget.json'),epoch='SYNTHETIC_PRODUCER_'+randomUUID(),hash=v=>createHash('sha256').update(v).digest('hex');let now=clock,reads=0;
 const raw=JSON.stringify({limit:160,spent:25,kind:'preparation-management-reads',proposal_sha256:'b'.repeat(64),approval_sha256:'a'.repeat(64),prior_limit:40});writeFileSync(budget,raw,{mode:0o600});
 const options={path:budget,epoch,approvalHash:'a'.repeat(64),proposalHash:'b'.repeat(64),legacySha256:hash(raw),importedReads:25,expiresAt:clock+21600000,now:()=>now,pause:async ms=>{now+=ms;}};
 const control=createAuthorityPreparationControl(options),other=createAuthorityPreparationControl(options);
 const snapshot='URL: "https://script.google.com/home/executions"\n1 button Description: Google 帳戶：caller (caller@example.invalid)\n2 row 專案 函式 類型 開始時間 持續時間 狀態\n3 switch Value: 0, Description: 即時顯示執行作業。\n4 text 第 1 頁\n5 (selected) 200\n6 button (disabled) 前往下一頁';
 const tab={id:'caller',getAXState:async state=>{reads++;assert.deepEqual(state,{disableDiffing:true,emit:false});assert.equal(JSON.parse(readFileSync(budget)).spent,26);await assert.rejects(other.withPreparation(async()=>{}),/TRIAL_STOPPED/);return snapshot;}};
 const s=setup({now:()=>now,tabs:{caller:{tab,tabId:tab.id},publisher:{tab:{id:'publisher',getAXState:async()=>assert.fail('NO_EXTRA_UI')},tabId:'publisher'}}});
 await control.withPreparation(async cap=>{
  const capture=createAuthorityNativeCapture({path:join(dir,'native.json'),epoch,callerHash:hash('caller@example.invalid'),publisherHash:hash('publisher@example.invalid'),maxReads:1,expiresAt:clock+21600000,control:cap,nativeRead:s.producer.read,now:()=>now});
  const result=await capture.capture({actor:'caller',phase:'wrapper-before',page:1});assert.equal(result.analysis.accountMatched,true);assert.equal(result.analysis.complete,false);assert.equal(result.analysis.quotaAccepted,false);assert.equal(result.analysis.trialAccepted,false);
 });
 assert.equal(reads,1);assert.equal(JSON.parse(readFileSync(budget)).spent,26);assert.equal(lstatSync(join(dir,'native.json.page-001.ax.txt')).mode&0o777,0o600);
});
