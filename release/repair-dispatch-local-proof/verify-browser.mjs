import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(process.env.CMWEBS_BROWSER_MODULE_ROOT?path.join(process.env.CMWEBS_BROWSER_MODULE_ROOT,'package.json'):path.join(root,'package.json'));
const {chromium}=require('playwright');
const repairTicketSource=readFileSync(root+'/apps-script/V2_REPAIR_TICKETS.js','utf8');
const dispatchSource=readFileSync(root+'/apps-script/V2_REPAIR_DISPATCH.js','utf8');
const test=readFileSync(root+'/tests/repair-dispatch-runtime.test.mjs','utf8');
const outer={vm,assert,repairTicketSource,dispatchSource};vm.runInNewContext(test.slice(test.indexOf('function createSheet('),test.indexOf('const owner='))+'\nglobalThis.r=createRuntime();',outer);
const r=outer.r, owner={kind:'landlord',workspace_id:'W1',actor_id:'OWNER',role:'owner'};
let calls=[];
const server=http.createServer(async(req,res)=>{
 if(req.url==='/api'){
 let text='';for await(const chunk of req)text+=chunk;const p=JSON.parse(text);calls.push(p);
 try{let data;const current=r.context.repairDispatchState_('W1',r.ticket.repair_ticket_id);const actor=p.vendor?{kind:'vendor',workspace_id:'W1',actor_id:p.actor||'V1',invitation_id:current.invitations[0].invitation_id}:owner;
 if(p.action==='vendor_repair_dispatch_init')data=r.context.repairDispatchVendorView_(current,r.ticket,actor);
 else if(p.action==='landlord_repair_dispatch_init')data={ticket:r.ticket,dispatch:r.context.repairDispatchState_('W1',r.ticket.repair_ticket_id),partners:r.context.repairDispatchPartners_('W1'),current_membership:{role:'owner'}};
 else if(p.action==='landlord_repair_partner_save')data=r.context.repairDispatchPartnerSave_(owner,p);
 else data=r.context.repairDispatchAct_(actor,{...p,ticket_id:r.ticket.repair_ticket_id});if(p.vendor && p.action.endsWith('_update'))data=r.context.repairDispatchVendorView_(data,r.ticket,actor);
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({success:true,data}));}catch(e){res.end(JSON.stringify({success:false,code:e.message,message:e.message}));}return;
 }
 if(req.url.startsWith('/preview')){
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/repair-dispatch.css"><style>body{margin:0;background:#f1f5f9;font-family:system-ui}#app{padding:12px}</style><p>合成報修資料 · 本機驗證，未呼叫正式 API</p><main id="app"></main><script src="/repair-dispatch.js"></script><script>CMWebsRepairDispatch.mount(document.getElementById('app'),{vendor:${req.url.includes('vendor')},invitationId:'${r.context.repairDispatchState_('W1',r.ticket.repair_ticket_id)?.invitations[0]?.invitation_id||''}',ticketId:'${r.ticket.repair_ticket_id}',role:'owner',request:async(action,params)=>{const result=await fetch('/api',{method:'POST',body:JSON.stringify({...params,action,vendor:${req.url.includes('vendor')},actor:'${req.url.includes('worker')?'V2':'V1'}'})}).then(r=>r.json());if(!result.success)throw Object.assign(new Error(result.message),{code:result.code});return result.data;}});</script></html>`);return;
 }
 if(['/repair-dispatch.js','/repair-dispatch.css'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('.js')?'application/javascript':'text/css');res.end(readFileSync(root+req.url));return;}
 res.statusCode=404;res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});let errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const out=root+'/release/repair-dispatch-local-proof';mkdirSync(out,{recursive:true});
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/preview');
 await page.locator('[data-operation="start"]').waitFor();
 await page.locator('[name="approved_amount"]').fill('1000');await page.locator('[data-operation="start"]').click();await page.locator('[data-operation="begin"]').waitFor();await page.locator('[data-operation="begin"]').click();await page.locator('[data-operation="finish"]').waitFor();
 await page.locator('[name="actual_amount"]').fill('1200');await page.locator('[name="note"]').fill('已完成設備更換');await page.locator('[data-operation="finish"]').click();await page.locator('[data-operation="approve_extra"]').waitFor();assert.equal(await page.locator('[data-operation="accept"]').count(),0);
 await page.screenshot({path:out+'/mobile-extra-approval.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
 await page.locator('[data-operation="approve_extra"]').click();await page.locator('[data-operation="accept"]').waitFor();await page.locator('[name="note"]').fill('請重新檢查接頭');await page.locator('[data-operation="rework"]').click();await page.locator('[data-operation="finish"]').waitFor();
 await page.locator('[name="actual_amount"]').fill('1200');await page.locator('[name="note"]').fill('接頭已複查');await page.locator('[data-operation="finish"]').click();await page.locator('[data-operation="accept"]').waitFor();await page.locator('[data-operation="accept"]').click();await page.getByText('已驗收結案',{exact:true}).waitFor();
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:out+'/desktop-completed.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
 const state=r.context.repairDispatchState_('W1',r.ticket.repair_ticket_id);assert.equal(state.stage,'completed');assert.equal(state.completions.length,2);assert.equal(state.approved_amount,1200);assert.deepEqual(errors,[]);
 // Exercise real shared UI and workflow for a company, quotation and assigned worker.
 r.ticket=r.context.repairTicketCreateFromMessage_({message_id:'M2',message_title:'合成廠商報修'}, {workspace_id:'W1',room_id:'R2',tenant_id:'T2',lease_id:'L2'});
 await page.goto('http://127.0.0.1:'+server.address().port+'/preview');await page.getByText('管理合作公司／個人',{exact:true}).waitFor();await page.getByText('管理合作公司／個人',{exact:true}).click();
 await page.locator('[name="partner_name"]').fill('合成維修公司');await page.locator('[name="members"]').fill('V1,manager\nV2,worker');await page.locator('[data-save-partner]').click();await page.getByText('已保存並讀回確認。',{exact:true}).waitFor();
 await page.locator('[name="mode"]').selectOption('vendor');await page.locator('[name="work_location"]').fill('合成作業位置');await page.locator('[data-operation="start"]').click();await page.locator('[data-operation="invite"]').waitFor();await page.locator('[data-operation="invite"]').click();await page.getByText('開啟廠商邀請',{exact:true}).waitFor();
 const vendorPage=await browser.newPage({viewport:{width:390,height:844}});vendorPage.on('dialog',d=>d.accept());vendorPage.on('pageerror',e=>errors.push(e.message));await vendorPage.goto('http://127.0.0.1:'+server.address().port+'/preview-vendor');await vendorPage.locator('[name="amount"]').fill('1500');await vendorPage.locator('[name="note"]').fill('材料與工資含稅');await vendorPage.locator('[data-operation="quote"]').click();await vendorPage.getByText('待核准報價',{exact:true}).waitFor();
 await page.reload();await page.locator('[data-quote]').waitFor();const quote=r.context.repairDispatchState_('W1',r.ticket.repair_ticket_id).quotes[0];await page.locator('[name="executor_'+quote.quote_id+'"]').selectOption('V2');await page.locator('[data-quote]').click();await page.getByText('已指派，待開工',{exact:true}).waitFor();
 await vendorPage.goto('http://127.0.0.1:'+server.address().port+'/preview-vendor-worker');await vendorPage.locator('[data-operation="begin"]').click();await vendorPage.locator('[data-operation="finish"]').waitFor();await vendorPage.locator('[name="actual_amount"]').fill('1500');await vendorPage.locator('[name="note"]').fill('設備已修復');await vendorPage.locator('[data-operation="finish"]').click();await vendorPage.getByText('待房東驗收',{exact:true}).waitFor();assert.equal(await vendorPage.locator('[data-operation="accept"]').count(),0);await vendorPage.screenshot({path:out+'/vendor-mobile-awaiting-acceptance.png',fullPage:true});
 await page.reload();await page.locator('[data-operation="accept"]').click();await page.getByText('已驗收結案',{exact:true}).waitFor();await page.screenshot({path:out+'/vendor-landlord-completed.png',fullPage:true});const companyState=r.context.repairDispatchState_('W1',r.ticket.repair_ticket_id);assert.equal(companyState.stage,'completed');assert.equal(companyState.assignment.executor_line_user_id,'V2');assert.equal(companyState.actual_amount,1500);assert.equal(await vendorPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await vendorPage.close();
 const result={company_stage:companyState.stage,company_executor:companyState.assignment.executor_line_user_id,scope:'Local real UI + real Apps Script workflow; synthetic data and mocked Sheet/identity boundaries',viewport_sizes:[390,1280],stage:state.stage,completions:state.completions.length,approved_amount:state.approved_amount,mutations:calls.filter(c=>c.action.endsWith('_update')).length,browser_errors:errors,production:'NOT_TOUCHED'};writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch(error){console.log('DEBUG',await page.locator('body').innerText());console.log('STATE',JSON.stringify(r.context.repairDispatchState_('W1',r.ticket.repair_ticket_id)));console.log('CALLS',JSON.stringify(calls));throw error;}finally{await browser.close();server.close();}
