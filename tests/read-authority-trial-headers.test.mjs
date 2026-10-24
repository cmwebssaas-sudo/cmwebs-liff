import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticHeaderReader,assertSyntheticHeaderReadback} from '../scripts/read-authority-trial-headers.mjs';
const now=1792111000000,hash='8'.repeat(64),sheet='SYNTHETIC_ONLY_SHEET_0123456789';
const names=['V2_users','V2_workspaces','V2_workspace_members','V2_landlord_email_sessions','V2_landlords'];
const scopes=['cloud-platform','drive.file','drive.metadata.readonly','logging.read','script.deployments','script.projects','script.webapp.deploy','service.management','userinfo.email','userinfo.profile'].map(x=>'https://www.googleapis.com/auth/'+x);
function setup(change={}){const calls=[],charges=[],tabs=names.map((name,i)=>({name,sheetId:i+10,headers:['id','workspace_id']}));
 const credential=()=>({accessToken:'fixture-only',accountHash:hash,scopes,expiresAt:now+3600000,refreshTokenPresent:true});
 const fetcher=async(url,opts)=>{calls.push({url,opts});return new Response(JSON.stringify({spreadsheetId:sheet,valueRanges:names.map(name=>({range:"'"+name+"'!A1:B1",majorDimension:'ROWS',values:[change.headers??['id','workspace_id']]}))}),{status:200});};
 const externalRead=async(io,alias)=>{charges.push(alias);return await io();};
 const {headers,...options}=change;
 return {calls,charges,tabs,args:{syntheticSheetId:sheet,publisherHash:hash,expiresAt:now+7200000,tabs,credential,fetcher,now:()=>now,externalRead,...options}};
}
test('one admitted batch GET reads exactly five first rows and forms the actual contract',async()=>{const s=setup();const r=createSyntheticHeaderReader(s.args);assert.equal(s.calls.length,0);const result=await r.read();assert.equal(s.calls.length,1);assert.deepEqual(s.charges,['B:auth-tabs-batch']);assert.equal(result.contract.spreadsheet_id,sheet);assert.deepEqual(result.contract.tables.map(t=>t.sheet_id),[10,11,12,13,14]);assert.equal(result.contract.time_zone,'Asia/Taipei');assert.equal(result.sheetContractHash.length,64);const c=s.calls[0],u=new URL(c.url);assert.equal(c.opts.method,'GET');assert.equal(c.opts.redirect,'manual');assert.equal(u.origin,'https://sheets.googleapis.com');assert.equal(u.pathname,'/v4/spreadsheets/'+sheet+'/values:batchGet');assert.deepEqual(u.searchParams.getAll('ranges'),names.map(n=>"'"+n+"'!1:1"));assert.equal(u.searchParams.get('majorDimension'),'ROWS');assert.equal(u.searchParams.get('valueRenderOption'),'UNFORMATTED_VALUE');assert.equal(u.searchParams.get('fields'),'spreadsheetId,valueRanges(range,majorDimension,values)');await assert.rejects(r.read());assert.equal(s.calls.length,1);});
test('mismatched header stops before a second read and cannot retry',async()=>{const s=setup({headers:['workspace_id','id']});const r=createSyntheticHeaderReader(s.args);await assert.rejects(r.read());assert.equal(s.calls.length,1);await assert.rejects(r.read());assert.equal(s.calls.length,1);});
test('foreign publisher never enters transport',async()=>{const s=setup({credential:()=>({accessToken:'fixture-only',accountHash:'a'.repeat(64),scopes,expiresAt:now+3600000,refreshTokenPresent:true})});await assert.rejects(createSyntheticHeaderReader(s.args).read());assert.equal(s.calls.length,0);});
test('unadmitted callback cannot issue a header request',async()=>{const s=setup({externalRead:async()=>{throw Error('DENIED');}});await assert.rejects(createSyntheticHeaderReader(s.args).read());assert.equal(s.calls.length,0);});
test('matching fabricated receipt without executing callback cannot establish headers',async()=>{const s=setup({externalRead:async()=>({values:[['id','workspace_id']]})});await assert.rejects(createSyntheticHeaderReader(s.args).read());assert.equal(s.calls.length,0);});
test('replacing completed callback receipt is rejected',async()=>{const s=setup({externalRead:async io=>({...await io()})});await assert.rejects(createSyntheticHeaderReader(s.args).read());assert.equal(s.calls.length,1);});
test('callback retained after admission returns cannot issue a late request',async()=>{let late;const s=setup({externalRead:async io=>{late=io;return {values:[['id','workspace_id']]};}});await assert.rejects(createSyntheticHeaderReader(s.args).read());await assert.rejects(late());assert.equal(s.calls.length,0);});
test('swallowed duplicate callback attempt invalidates the result',async()=>{const s=setup({externalRead:async io=>{const first=await io();await assert.rejects(io());return first;}});await assert.rejects(createSyntheticHeaderReader(s.args).read());assert.equal(s.calls.length,1);});
test('bad table graph is denied at construction',()=>{const s=setup();s.args.tabs[1].sheetId=10;assert.throws(()=>createSyntheticHeaderReader(s.args));assert.equal(s.calls.length,0);});
test('redirect and oversized responses are denied without continuing',async()=>{for(const response of [new Response(null,{status:302}),new Response(' '.repeat(65537),{status:200})]){const s=setup();s.args.fetcher=async()=>{s.calls.push(1);return response;};await assert.rejects(createSyntheticHeaderReader(s.args).read());assert.equal(s.calls.length,1);}});
test('release composition accepts only this source instance genuine completed readback',async()=>{const s=setup();const actual=await createSyntheticHeaderReader(s.args).read();assert.equal(assertSyntheticHeaderReadback(actual),actual);assert.throws(()=>assertSyntheticHeaderReadback(JSON.parse(JSON.stringify(actual))));});
for(const [name,edit] of [
 ['foreign spreadsheet',r=>{r.spreadsheetId='FOREIGN_SYNTHETIC_SHEET_0123456789';}],
 ['missing table',r=>{r.valueRanges.pop();}],
 ['additional table',r=>{r.valueRanges.push({...r.valueRanges[0]});}],
 ['reordered tables',r=>{[r.valueRanges[0],r.valueRanges[1]]=[r.valueRanges[1],r.valueRanges[0]];}],
 ['second row',r=>{r.valueRanges[0].values.push(['private','row']);}],
 ['wrong range row',r=>{r.valueRanges[0].range='V2_users!A2:B2';}],
 ['extra response field',r=>{r.secret='unexpected';}]
])test('batch rejects '+name+' without retry or genuine receipt',async()=>{
 const s=setup(),base=s.args.fetcher;s.args.fetcher=async(...a)=>{const r=await base(...a),value=await r.json();edit(value);return new Response(JSON.stringify(value),{status:200});};const reader=createSyntheticHeaderReader(s.args);await assert.rejects(reader.read());await assert.rejects(reader.read());assert.equal(s.calls.length,1);
});
