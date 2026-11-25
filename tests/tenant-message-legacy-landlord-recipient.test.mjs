import fs from 'node:fs'; import vm from 'node:vm';
const root = new URL('..', import.meta.url).pathname;
import assert from 'node:assert/strict';
const LANDLORD_UID='U'+'a'.repeat(32), TENANT_UID='U'+'b'.repeat(32), OTHER_TENANT_UID='U'+'c'.repeat(32);
const contractsH=["contract_id","tenant_id","user_id","room_id","property_id","landlord_id","property_code","room_name","tenant_name","contract_status","start_date","end_date","billing_start_day","rent_amount","management_fee","deposit_amount","penalty_months","payment_due_day","electricity_fee","equipment_fee","auto_renew_enabled","created_at","updated_at","legacy_source","legacy_ref","notes","workspace_id","landlord_line_user_id"];
const tenantsH=["tenant_id","user_id","tenant_name","phone","email","id_number_last4","emergency_contact","emergency_phone","binding_status","move_in_status","account_status","created_at","updated_at","legacy_source","legacy_ref","notes","tenant_user_id","workspace_id","landlord_id","landlord_line_user_id","tenant_line_user_id","line_user_id"];
const sheets = {
 V2_tenants:[tenantsH,["T000004","U000006","Legacy Tenant","0903","","","","","bound","checked_in","active","","","","","","","","","",TENANT_UID,TENANT_UID]],
 V2_contracts:[contractsH,["C000018","T000004","U000006","R000018","P000001","L000001","no88","602","Legacy Tenant","active","2023-10-01","2026/9/30","1","24000","500","48000","2","10","3","3.5","","","","","","","W000001",""]],
 V2_rooms:[["room_id","property_id","room_name","room_status","workspace_id","landlord_id","property_name","account_status"],["R000018","P000001","602","occupied","W000001","L000001","no88","active"]],
 V2_properties:[["property_id","landlord_id","property_name","status","workspace_id","landlord_line_user_id"],["P000001","L000001","no88","active","W000001",""]],
 V2_tenant_home_view:[["line_user_id","user_id","tenant_id","tenant_name","room_list"],["#REF!","#REF!","#REF!","#REF!","#REF!"]],
 V2_tenant_bill_view:[["line_user_id","tenant_id","bill_id","bill_month","payment_status"]],
 V2_bills:[["bill_id","tenant_id","contract_id","landlord_id","workspace_id","room_id","bill_month","due_date","total_amount","payment_status","bill_status"],["B0000079","T000004","C000018","L000001","W000001","R000018","2026-11","2026-11-10","25593","unpaid","issued"]],
 V2_landlord_tenant_list_view:[["line_user_id","user_id","landlord_id","landlord_name","tenant_line_user_id","tenant_user_id","tenant_id","tenant_name","tenant_binding_status","room_list"],["#REF!"],[LANDLORD_UID,"U000002","L000001","L",OTHER_TENANT_UID,"U000025","T000021","Other Tenant","bound","302"]],
 V2_landlords:[["landlord_id","user_id","line_user_id","landlord_name","workspace_id","status","account_status"],["L000001","U000002",LANDLORD_UID,"L","W000001","active","active"]],
 V2_tenant_messages:[["message_id","created_at","updated_at","landlord_id","landlord_line_user_id","tenant_id","tenant_user_id","tenant_line_user_id","tenant_name","room_id","room_name","message_category","message_title","message_body","priority","preferred_contact_time","status"]],
};
function mkSheet(name){const d=sheets[name]; if(!d) return null; return {getName:()=>name,getLastRow:()=>d.length,getLastColumn:()=>Math.max(...d.map(r=>r.length)),getDataRange(){return this.getRange(1,1,d.length,this.getLastColumn())},getRange(r,c,nr,nc){return{getValues:()=>d.slice(r-1,r-1+(nr||1)).map(row=>{const o=[];for(let i=0;i<(nc||1);i++)o.push(row[c-1+i]??'');return o}),getDisplayValues(){return this.getValues()},setValues(){},setValue(){}}},appendRow(r){d.push(r)},getFrozenRows:()=>1}}
const ss={getSheetByName:mkSheet,getId:()=>'x'};
const ctx={console,Date,Math,JSON,String,Number,Boolean,Object,Array,Error,RegExp,
 SpreadsheetApp:{openById:()=>ss,getActiveSpreadsheet:()=>ss,flush(){}},
 Utilities:{formatDate:(d,tz,f)=>new Date(d).toISOString().slice(0,10),getUuid:()=>'u'},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>''})},
 LockService:{getScriptLock:()=>({waitLock(){},tryLock:()=>true,releaseLock(){}}),getDocumentLock:()=>({waitLock(){},tryLock:()=>true,releaseLock(){}})},
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){},removeAll(){}})},
 Session:{getScriptTimeZone:()=>'Asia/Taipei'}, UrlFetchApp:{fetch:()=>({getResponseCode:()=>200,getContentText:()=>'{}'})}};
vm.createContext(ctx);
for (const f of fs.readdirSync(root+'/apps-script').filter(f=>f.endsWith('.js'))) { try{vm.runInContext(fs.readFileSync(root+'/apps-script/'+f,'utf8'),ctx,{filename:f})}catch(e){} }
ctx.runtimeSpreadsheet_=()=>ss; ctx.getSpreadsheet_=()=>ss;
// 舊系統建檔的房客：租約、物業都沒有房東 LINE UID，也不在已停更的 list view
const init = vm.runInContext(`getTenantMessageInitByLineUid("${TENANT_UID}")`, ctx);
assert.equal(init.success, true, init.code + ' ' + init.message);
assert.equal(init.data.tenant.landlord_line_user_id, LANDLORD_UID);
ctx.UrlFetchApp.fetch = () => ({ getResponseCode: () => 200, getContentText: () => '{}' });
const submit = vm.runInContext(`submitTenantMessageByLineUid_("${TENANT_UID}","general","t","b","normal","")`, ctx);
assert.equal(submit.success, true, submit.code + ' ' + submit.message);
assert.equal(sheets.V2_tenant_messages[1][4], LANDLORD_UID);
assert.equal(sheets.V2_tenant_messages[1][5], 'T000004');
// 房東表沒有此房東時仍應明確失敗，不可亂指定收件人
sheets.V2_landlords.splice(1);
const missing = vm.runInContext(`getTenantMessageInitByLineUid("${TENANT_UID}")`, ctx);
assert.equal(missing.code, 'TENANT_MESSAGE_RECIPIENT_MISSING');
console.log('ok tenant-message legacy landlord recipient');
