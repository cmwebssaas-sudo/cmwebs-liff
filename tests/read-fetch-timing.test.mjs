import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const timing=await import('../cloudflare/read-api/test/read-fetch-timing.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const summary=await import('../scripts/read-worker-fetch-summary.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const routes=['home','actions','revenue','tenants','rooms','arrears','properties'];
const window={status:'COMPLETE',calls:1,settled:1,errors:0,before_ms:11,after_ms:13};
function collect(suite='capacity500',change=()=>{}){
 assert.equal(typeof timing.createFetchTiming,'function');const lines=[],cap=timing.createFetchTiming(suite,line=>lines.push(line));
 for(const route of routes)for(let i=0;i<100;i++)cap.record(route,i,10,14,15,change(route,i)??window);
 cap.close('FAIL');cap.close('PASS');return lines;
}
test('same-clock pairs retain exactly700 original rows and bounded numeric frames',()=>{
 const lines=collect();assert.equal(lines.length,71);
 assert(lines.every(line=>Buffer.byteLength(line)<=4096));
 const meta=JSON.parse(lines.at(-1).slice(lines.at(-1).indexOf('{')));
 assert.equal(meta.status,'COMPLETE');assert.equal(meta.retained,700);assert.equal(meta.valid,700);assert.equal(meta.outcome,'FAIL');
 const row=JSON.parse(lines[0].slice(lines[0].indexOf('{'))).rows[0];
 assert.deepEqual(row,[1,10,14,15,11,13,1,1,0,'OK']);
});
test('missing malformed unfinished multiple calls and decreasing clocks never gain complete coverage or leak text',()=>{
 for(const bad of [null,{...window,status:'INCOMPLETE',settled:0,after_ms:null},{...window,calls:2},{...window,before_ms:16},
  {...window,after_ms:NaN},{...window,before_ms:'SYNTHETIC_SECRET'},{...window,extra:'SYNTHETIC_SECRET'}]){
  assert.equal(typeof timing.createFetchTiming,'function');const lines=[],cap=timing.createFetchTiming('small',line=>lines.push(line));
  cap.record('home',0,10,14,15,bad);cap.close('FAIL');
  const text=lines.join('\n');assert(!text.includes('SYNTHETIC_SECRET'));assert(!text.includes('"status":"COMPLETE"'));
 }
});
test('duplicate and out-of-order producer rows remain invalid and bounded',()=>{
 assert.equal(typeof timing.createFetchTiming,'function');const lines=[],cap=timing.createFetchTiming('small',line=>lines.push(line));
 cap.record('home',1,10,14,15,window);cap.record('home',1,10,14,15,window);
 cap.close('FAIL');const meta=JSON.parse(lines.at(-1).slice(lines.at(-1).indexOf('{')));
 assert.equal(meta.retained,1);assert.equal(meta.invalid,2);assert.equal(meta.status,'PARTIAL');
});
test('summary validates both exact700 suites and computes windows from each paired row without percentile subtraction',()=>{
 assert.equal(typeof summary.createFetchSummary,'function');const cap=summary.createFetchSummary();
 for(const line of [...collect(),...collect('small')])cap.ingest('# '+line);
 const values=cap.finish();assert.equal(values.length,16);assert.equal(cap.invalidRecords(),0);
 for(const value of values)assert.equal(value.status,'COMPLETE');
 const route=values.find(v=>v.route==='home');
 assert.deepEqual(route.p95_ms,{full:5,node_before:1,undici_await:2,node_after:1,body:1});
 assert.equal(values.at(-1).outcome,'FAIL','complete observation never replaces the original failing outcome');
});
test('summary missing duplicate malformed or contradictory frames remain incomplete without raw strings',()=>{
 assert.equal(typeof summary.createFetchSummary,'function');const original=collect();
 for(const lines of [original.slice(1),[original[0],...original],[...original,'C6_NODE_FETCH_SAMPLES {SYNTHETIC_SECRET}'],
  original.map((line,i)=>i===0?line.replace('"rows":[[1,10,14,15,11,13','"rows":[[1,10,14,15,17,13'):line)]){
  const cap=summary.createFetchSummary();for(const line of lines)cap.ingest('# '+line);
  const values=cap.finish();assert(!values.some(v=>v.status==='COMPLETE'));assert(!JSON.stringify(values).includes('SYNTHETIC_SECRET'));
 }
});
test('actual CI summary preserves paired fetch aggregates and original failing footer',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-fetch-summary-'));
 try{
  const path=join(dir,'worker.log');writeFileSync(path,[...collect(),...collect('small')].map(line=>'# '+line).join('\n')+'\n1..1\n# tests 1\n# fail 1\n');
  const result=spawnSync(process.execPath,[new URL('../scripts/summarize-read-worker-ci.mjs',import.meta.url).pathname,path],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout.split('\n').filter(line=>line.startsWith('# C6_NODE_FETCH_AGGREGATE ')).length,16);
  assert.match(result.stdout,/# fail 1/);assert.match(result.stdout,/"fetch_records_invalid":0/);
  assert.match(result.stdout,/"fetch_aggregates_dropped":0/);assert(!result.stdout.includes('C6_NODE_FETCH_SAMPLES'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
