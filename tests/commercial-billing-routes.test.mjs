import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('billing dispatcher rejects GET and uses only the actual POST body, for JSON and original iframe form',()=>{
 const context={console,jsonOutput_:body=>({text:JSON.stringify(body)}),ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})},runtimeSnapshotBegin_:()=>{},runtimeSnapshotFinish_:()=>{},bankReceiptIsAction_:()=>false,bankReceiptPostRequest_:()=>({handled:false}),resolveTenantRequestLineUserId_:()=>{throw new Error('GET must reject before identity');}};
 vm.createContext(context);vm.runInContext(readFileSync('apps-script/程式碼.js','utf8'),context);context.repairRouteRequestFromPostBody_=()=>({handled:false});context.htmlBridgeOutput_=(body,id)=>({body,id});const calls=[];context.platformCoreDispatchBilling_=(action,request)=>{calls.push({action,request});return {success:true};};
 for(const action of ['commercial_billing_init','commercial_billing','commercial_billing_retry_provisioning','commercial_billing_workspace_mode']){
  assert.equal(JSON.parse(context.doGet({parameter:{v2_action:action,landlord_session_token:'query-credential'}}).text).code,'POST_REQUIRED');
  const body={action,response_mode:'bridge',request_id:'request',landlord_session_token:'body-credential'};
  context.doPost({parameter:{landlord_session_token:'query-credential'},postData:{contents:JSON.stringify(body)}});assert.equal(calls.at(-1).request.landlord_session_token,'body-credential');
  context.doPost({parameter:{landlord_session_token:'query-credential'},postData:{contents:new URLSearchParams(body).toString()}});assert.equal(calls.at(-1).request.landlord_session_token,'body-credential');
 }
 assert.equal(calls.length,8);
});
