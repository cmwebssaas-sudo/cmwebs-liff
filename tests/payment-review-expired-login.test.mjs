import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('landlord-payment-report-review.html','utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('async function initLine'));
function fixture(inClient=false,mode='line') {
 const calls=[],app={innerHTML:''},button={disabled:false,textContent:''};
 const auth={init(){return this;},getMode:()=>mode};
 const ctx={URL,URLSearchParams,console,setTimeout,clearTimeout,innerHeight:844,addEventListener(){},
 location:{href:'https://example.test/cmwebs-liff/landlord-payment-report-review.html?receipt_id=receipt-a&workspace_id=ws-a&code=private&state=private',replace:u=>calls.push(['replace',u])},
 document:{documentElement:{style:{setProperty(){}}},getElementById:id=>id==='app'?app:button},
 CMWebsLandlordAuth:auth,liff:{init:async()=>{},isLoggedIn:()=>true,isInClient:()=>inClient,getProfile:async()=>{throw Error('The access token expired');},logout:()=>calls.push(['logout']),login:()=>{throw Error('review sibling must not call login');}}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(script.replace(/\n    loadPage\(\);\s*$/,''),ctx);
 return {ctx,calls,app,button};
}
test('expired profile offers re-login instead of reload and preserves receipt through gateway',async()=>{
 const r=fixture();assert.equal(await r.ctx.initLine(),false);assert.match(r.app.innerHTML,/重新登入 LINE/);assert.doesNotMatch(r.app.innerHTML,/The access token expired/);
 await r.ctx.restartReviewLineLogin();await r.ctx.restartReviewLineLogin();assert.equal(r.calls.filter(c=>c[0]==='logout').length,1);
 const u=new URL(r.calls.find(c=>c[0]==='replace')[1]);assert.equal(u.pathname,'/cmwebs-liff/landlord-entry.html');const back=u.searchParams.get('return_to');assert.match(back,/receipt_id=receipt-a/);assert.match(back,/workspace_id=ws-a/);assert.doesNotMatch(back,/private|code=|state=/);
});
test('native LINE expiry reopens registered LIFF entry without logout or sibling login',async()=>{
 const r=fixture(true);assert.equal(await r.ctx.initLine(),false);await r.ctx.restartReviewLineLogin();assert.equal(r.calls.length,1);const u=new URL(r.calls[0][1]);assert.equal(u.origin,'https://liff.line.me');assert.equal(u.pathname,'/2010314940-EjX1qbb8');assert.match(u.searchParams.get('return_to'),/receipt_id=receipt-a/);
});
test('network failures remain errors and valid profile retains review access',async()=>{
 const r=fixture();r.ctx.liff.getProfile=async()=>{throw Error('network unavailable');};await assert.rejects(r.ctx.initLine(),/network unavailable/);assert.deepEqual(r.calls,[]);
 r.ctx.liff.getProfile=async()=>({userId:'synthetic-user'});assert.equal(await r.ctx.initLine(),true);
});
test('email review does not touch LINE authentication',async()=>{
 const r=fixture(false,'email');r.ctx.liff.init=async()=>{throw Error('email must not use LINE');};assert.equal(await r.ctx.initLine(),true);assert.deepEqual(r.calls,[]);
});
