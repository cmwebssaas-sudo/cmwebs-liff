import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const mod=await import('../scripts/read-accelerated-shadow.mjs').catch(()=>({}));
const day=86400000,start=Date.parse('2026-10-20T00:00:00.000Z'),epoch='synthetic-epoch',release='synthetic-release';
function fixture(page='rooms',window=0){
 const variants=page==='home'?['home','actions']:['default'];
 const sample_rows=Array.from({length:20},(_,i)=>({window,route:page,variant:variants[i%variants.length],headers_ms:100,elapsed_ms:200,auth_kind:i<10?'line':'email',observed_at:new Date(start+window*day+(1+(i%3)*8)*3600000+i*1000).toISOString(),receipt:randomUUID()}));
 const rows=variants.map(variant=>({window,route:page,variant,compared:sample_rows.filter(v=>v.variant===variant).length,errors:0,diffs:0,clock_diffs:2}));
 const attempt_rows=rows.map(r=>({window,route:page,variant:r.variant,attempts:r.compared,matched:r.compared,errors:0,missing:0}));
 return {started_at:new Date(start).toISOString(),exported_at:new Date(start+(window+1)*day).toISOString(),epoch,release,rows,attempt_rows,sample_rows};
}
function check(input=fixture(),options={}){assert.equal(typeof mod.evaluateAcceleratedShadow,'function');return mod.evaluateAcceleratedShadow(input,{now:Date.parse(input.exported_at),epoch,release,page:'rooms',...options});}
test('24h real paired channel/time coverage is a shadow candidate, never cutover authority',()=>{
 const r=check();assert.equal(r.shadowEligible,true);assert.equal(r.cutoverAuthorized,false);assert.equal(r.samples.total,20);assert.equal(r.samples.line,10);assert.equal(r.samples.email,10);assert.equal(r.samples.periods,3);assert.ok(r.requiredGates.includes('VERIFIED_REMOTE_EXPORT'));assert.ok(r.requiredGates.includes('C1_C3_RUNTIME_SAFETY_FRESHNESS'));assert.ok(r.requiredGates.includes('ROOMS_FIRST_THEN_24H_STABILITY'));assert.ok(r.requiredGates.includes('PERFORMANCE_DEVICE_ROLLBACK'));
});
test('incomplete day, stale cutoff, future cutoff and changed source cannot qualify',()=>{
 const input=fixture();for(const patch of [{exported_at:new Date(start+day-1).toISOString()},{release:'other'},{epoch:'other'},{exported_at:'invalid'}])assert.equal(check({...input,...patch}).shadowEligible,false);
 assert.equal(check(input,{now:start+day+300001}).shadowEligible,false);assert.equal(check(input,{now:start+day-1}).shadowEligible,false);
});
test('both verified channels and all three eight-hour periods are required',()=>{
 for(const edit of [r=>r.auth_kind='line',r=>r.auth_kind='unknown',r=>r.observed_at=new Date(start+1000).toISOString()]){const d=fixture();d.sample_rows.forEach(edit);assert.equal(check(d).shadowEligible,false);}
});
test('aggregate counts cannot stand in for twenty actual paired samples',()=>{
 const d=fixture();d.sample_rows.pop();assert.equal(check(d).shadowEligible,false);
 const n=fixture();n.rows[0].compared++;n.attempt_rows[0].matched++;n.attempt_rows[0].attempts++;assert.equal(check(n).shadowEligible,false);
});
test('receipt replay, noncanonical time, wrong window and invalid timings reject',()=>{
 for(const change of [(d)=>d.sample_rows[1].receipt=d.sample_rows[0].receipt,(d)=>d.sample_rows[0].observed_at='2026-10-20T08:00:00+08:00',(d)=>d.sample_rows[0].window=1,(d)=>d.sample_rows[0].headers_ms=201,(d)=>d.sample_rows[0].elapsed_ms=3001,(d)=>d.sample_rows[0].receipt='PRIVATE_TOKEN']){const d=fixture();change(d);const r=check(d);assert.equal(r.shadowEligible,false);assert.ok(!JSON.stringify(r).includes('PRIVATE_TOKEN'));}
});
test('home covers both sections with both channels without changing the twenty-per-page minimum',()=>{
 assert.equal(check(fixture('home'),{page:'home'}).shadowEligible,true);
 const d=fixture('home');d.rows=d.rows.filter(v=>v.variant==='home');d.attempt_rows=d.attempt_rows.filter(v=>v.variant==='home');d.sample_rows=d.sample_rows.filter(v=>v.variant==='home');assert.equal(check(d,{page:'home'}).shadowEligible,false);
});
test('current partial-window errors, differences, missing or pending reads block the candidate',()=>{
 for(const kind of ['errors','diffs','missing','pending']){const d=fixture();d.exported_at=new Date(start+day+1000).toISOString();if(kind==='errors'||kind==='diffs')d.rows.push({window:1,route:'rooms',variant:'default',compared:kind==='diffs'?1:0,errors:kind==='errors'?1:0,diffs:kind==='diffs'?1:0});d.attempt_rows.push({window:1,route:'rooms',variant:'default',attempts:1,matched:kind==='diffs'?1:0,errors:kind==='errors'?1:0,missing:kind==='missing'||kind==='errors'?1:0});if(kind==='diffs')d.sample_rows.push({...d.sample_rows[0],window:1,observed_at:new Date(start+day+500).toISOString(),receipt:randomUUID()});assert.equal(check(d).shadowEligible,false);}
});
test('a new complete good page window can qualify while prior failures remain visible',()=>{
 const d=fixture('rooms',1),prior=fixture();prior.rows[0].diffs=1;d.rows.push(...prior.rows);d.attempt_rows.push(...prior.attempt_rows);d.sample_rows.push(...prior.sample_rows);const r=check(d);assert.equal(r.shadowEligible,true);assert.equal(r.cutoverAuthorized,false);assert.ok(r.excludedIssueGroups.some(g=>g.window===0&&g.reasons.includes('FIELD_DIFFERENCES')));
});
test('other page defects stay visible and cannot become a blanket cutover approval',()=>{
 const d=fixture(),other=fixture('tenants');other.rows[0].diffs=1;d.rows.push(...other.rows);d.attempt_rows.push(...other.attempt_rows);d.sample_rows.push(...other.sample_rows);const r=check(d);assert.equal(r.shadowEligible,true);assert.equal(r.cutoverAuthorized,false);assert.ok(r.excludedIssueGroups.some(g=>g.route==='tenants'));assert.ok(r.requiredGates.includes('SHARED_FAILURE_REVIEW'));
});
test('malformed or extra private sample fields and invalid page are rejected without echoing values',()=>{
 const d=fixture();d.sample_rows[0].secret='PRIVATE_SECRET';const r=check(d);assert.equal(r.shadowEligible,false);assert.ok(!JSON.stringify(r).includes('PRIVATE_SECRET'));assert.equal(check(fixture(),{page:'unknown'}).shadowEligible,false);assert.equal(check({...fixture(),sample_rows:null}).shadowEligible,false);
});

test('operator CLI uses actual current time and emits only a candidate; malformed input is sanitized',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-accelerated-shadow-')),path=join(dir,'export.json'),d=fixture(),shift=Date.now()-Date.parse(d.exported_at);
 d.started_at=new Date(Date.parse(d.started_at)+shift).toISOString();d.exported_at=new Date(Date.parse(d.exported_at)+shift).toISOString();d.sample_rows.forEach(row=>row.observed_at=new Date(Date.parse(row.observed_at)+shift).toISOString());
 const run=(args=[])=>spawnSync(process.execPath,['scripts/evaluate-read-accelerated.mjs',...args],{encoding:'utf8'});
 try{writeFileSync(path,JSON.stringify(d));let r=run([path,epoch,release,'rooms']);assert.equal(r.status,0,r.stderr);let result=JSON.parse(r.stdout);assert.equal(result.shadowEligible,true);assert.equal(result.cutoverAuthorized,false);
  d.sample_rows.pop();writeFileSync(path,JSON.stringify(d));r=run([path,epoch,release,'rooms']);assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).shadowEligible,false);
  writeFileSync(path,'{PRIVATE_SECRET');r=run([path,epoch,release,'rooms']);assert.equal(r.status,2);assert.equal(r.stdout,'');assert.ok(!r.stderr.includes('PRIVATE_SECRET'));
  r=run([]);assert.equal(r.status,2);assert.match(r.stderr,/Usage:/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
