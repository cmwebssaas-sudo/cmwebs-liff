import {fixture as baseFixture,hash,compact,wrapped,clock} from './continuation-budget.mjs';
import {readFileSync,openSync,closeSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
export {hash,compact,wrapped,clock};
export function fixture(){
 const s=baseFixture(),past=join(s.home,'stopped53.json'),drain=join(s.home,'drain.json'),approval=join(s.home,'approved232.json');
 s.put(past,compact({state:'stopped',spent:3,events:[1,2,3].map(n=>({time:clock-70000+n,outcome:'UNKNOWN'})),finished:true,rpc:{beganAt:null,complete:false},chargedUpperBoundMs:0}));
 s.put(drain,compact({stopAcknowledged:true,ordinaryScopeClosed:true,ownedScope:{state:'SETTLED'}}));
 s.put(approval,compact({source:'direct-human-approval',recordedAt:'2026-10-19',ownerAnswer:'同意232次方案，繼續執行（建議）',decisionSha256:'eccdb919d865327e3b5922231b253266e9084afe33305e12a32e64501efa39b2',importedSpent:53,mainLimit:160,uiLimit:72,combinedLimit:232,executionStarted:false}));
 const pin=p=>({path:p,sha256:hash(readFileSync(p))});
 s.cfg={path:s.path,epoch:s.cfg.epoch,binding:'8'.repeat(64),decisionHash:'eccdb919d865327e3b5922231b253266e9084afe33305e12a32e64501efa39b2',approval:pin(approval),history:{journal:pin(past),drain:pin(drain),files:[]},baseline:s.cfg.baseline,original:s.cfg.original,legacyBudget:s.cfg.legacyBudget,sources:['read-authority-simple-budget.py','read-authority-simple-plan.mjs','read-authority-simple-control.mjs','read-authority-continuation-budget.py','read-authority-continuation-plan.mjs','read-authority-trial-budget-plan.mjs'].map(n=>pin(resolve('scripts',n))),now:clock,ownerNonce:'f'.repeat(64)};
 s.journal=()=>JSON.parse(readFileSync(s.path+'.simple.json'));return s;
}
export function session(s,patch={}){
 const fd=openSync(s.path+'.lock','r+'),child=spawn('python3',[resolve('scripts/read-authority-simple-budget.py')],{stdio:['pipe','pipe','pipe',fd],env:{...process.env,HOME:s.home}});let buffer='',ended=false;const rows=[],waiters=[];
 const push=x=>waiters.length?waiters.shift()(x):rows.push(x);
 child.stdout.on('data',v=>{buffer+=v;while(buffer.includes('\n')){const i=buffer.indexOf('\n');push(JSON.parse(buffer.slice(0,i)));buffer=buffer.slice(i+1);}});child.stderr.resume();child.on('close',()=>{ended=true;while(waiters.length)waiters.shift()({ok:false,code:'CLOSED'});});child.stdin.on('error',()=>{});
 const read=()=>rows.length?Promise.resolve(rows.shift()):ended?Promise.resolve({ok:false,code:'CLOSED'}):new Promise(r=>waiters.push(r));
 child.stdin.write(JSON.stringify({...s.cfg,...patch})+'\n');return {ready:read(),send:q=>{child.stdin.write(JSON.stringify(q)+'\n');return read();},close:async()=>{if(!ended){child.stdin.end();await new Promise(r=>child.once('close',r));}closeSync(fd);}};
}
export const ui=(n,extra={})=>({id:'ui-'+n,key:'N:preparation',actor:'publisher',target:'original-settings',operation:'snapshot',units:1,preparation:true,...extra});
export const good=r=>assert.equal(r.ok,true,JSON.stringify(r));
export async function debit(h,operation,now=clock,lane='ui'){let r=await h.send({op:'wait',lane,operation,now});good(r);now+=r.waitMs;r=await h.send({op:'debit',lane,operation,now});good(r);return r;}
export const settle=(h,id,success=true,now=clock)=>h.send({op:'settle',id,success,now});
