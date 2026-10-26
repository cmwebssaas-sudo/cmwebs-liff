import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const helper=await import('../scripts/read-worker-actor-summary.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const routes=['home','actions','revenue','tenants','rooms','arrears','properties'];
const columns=['sample','full_ms','caller_d1_ms','entry_to_before_txn_ms','awaited_txn_ms','entry_to_txn_ms','json_tail_ms','status'];
function frames(){
 const out=[];
 for(const route of routes)for(let offset=0;offset<100;offset+=10)
  out.push('# C6_D1_ACTOR_SAMPLES '+JSON.stringify({suite:'small',route,offset,rows:Array.from({length:10},(_,i)=>[offset+i+1,21,18,2,5,10,13,'OK'])}));
 out.push('# C6_D1_ACTOR_META '+JSON.stringify({suite:'small',v:2,outcome:'FAIL',columns,expected:700,retained:700,valid:700,invalid:0,dropped:0,output_dropped:0,status:'COMPLETE',scope:'LOCAL_INSTRUMENTED_ACTOR_WINDOWS_NOT_SQL_CPU_TRANSPORT_OR_ACCEPTANCE'}));
 return out;
}
test('bounded actor summary preserves paired route samples without inferring latency acceptance',()=>{
 assert.equal(typeof helper.createActorSummary,'function');const c=helper.createActorSummary();for(const line of frames())c.ingest(line);
 const out=c.finish(),small=out.filter(r=>r.suite==='small');
 assert.equal(small.length,8);const meta=small.at(-1);assert.equal(meta.status,'COMPLETE');assert.equal(meta.outcome,'FAIL');
 assert.equal(meta.retained,700);assert.equal(meta.valid,700);assert.equal(c.invalidRecords(),0);
 assert.deepEqual(small[0],{suite:'small',route:'home',samples:100,status:'COMPLETE',
  p95_ms:{full:21,caller_d1:18,entry_to_before_txn:2,awaited_txn:5,entry_to_txn:10,json_tail:13},
  paired_slowest:[1,21,18,2,5,10,13,'OK']});
 assert.equal(out.find(r=>r.suite==='capacity500').status,'NOT_COLLECTED');
});
test('v3 summary retains four same-row phase p95 values while accepting retained v2 frames',()=>{
 const old=helper.createActorSummary();for(const line of frames())old.ingest(line);
 assert.equal(old.finish().find(r=>r.suite==='small'&&r.route==='home').status,'COMPLETE');
 const c=helper.createActorSummary();
 const newColumns=['sample','full_ms','caller_d1_ms','entry_to_before_txn_ms','awaited_txn_ms','entry_to_txn_ms','json_tail_ms',
  'txn_admission_ms','txn_queries_ms','txn_bookmark_ms','txn_completion_ms','status'];
 for(const line of frames()){
  const value=JSON.parse(line.slice(line.indexOf('{')));
  if(value.rows)value.rows=value.rows.map(row=>[...row.slice(0,7),1,1,1,2,row[7]]);
  else {value.v=3;value.columns=newColumns;}
  c.ingest(line.slice(0,line.indexOf('{'))+JSON.stringify(value));
 }
 const home=c.finish().find(r=>r.suite==='small'&&r.route==='home');
 assert.equal(home.status,'COMPLETE');assert.equal(home.p95_ms.txn_admission,1);
 assert.equal(home.p95_ms.txn_queries,1);assert.equal(home.p95_ms.txn_bookmark,1);
 assert.equal(home.p95_ms.txn_completion,2);
 assert.deepEqual(home.paired_slowest,[1,21,18,2,5,10,13,1,1,1,2,'OK']);
});
test('v3 summary rejects missing phase columns, inconsistent windows and mixed schema',()=>{
 const newColumns=['sample','full_ms','caller_d1_ms','entry_to_before_txn_ms','awaited_txn_ms','entry_to_txn_ms','json_tail_ms',
  'txn_admission_ms','txn_queries_ms','txn_bookmark_ms','txn_completion_ms','status'];
 const base=frames().map(line=>{
  const prefix=line.slice(0,line.indexOf('{')),value=JSON.parse(line.slice(line.indexOf('{')));
  if(value.rows)value.rows=value.rows.map(row=>[...row.slice(0,7),1,1,1,2,row[7]]);
  else {value.v=3;value.columns=newColumns;}
  return prefix+JSON.stringify(value);
 });
 for(const change of ['missing-phase','bad-sum','bad-columns','mixed-version']){
  const log=base.slice(),at=change==='bad-columns'?log.length-1:0;
  const prefix=log[at].slice(0,log[at].indexOf('{')),value=JSON.parse(log[at].slice(log[at].indexOf('{')));
  if(change==='missing-phase')value.rows[0].splice(9,1);
  if(change==='bad-sum')value.rows[0][9]=3;
  if(change==='bad-columns')value.columns=value.columns.slice(0,-2).concat('status');
  if(change==='mixed-version')value.rows=value.rows.map(row=>[...row.slice(0,7),row[11]]);
  log[at]=prefix+JSON.stringify(value);
  const c=helper.createActorSummary();for(const line of log)c.ingest(line);
  assert.equal(c.finish().filter(r=>r.suite==='small').at(-1).status,'PARTIAL',change);
  assert(c.invalidRecords()>0,change);
 }
});
test('lost, duplicate, nonnumeric and private actor records cannot become complete evidence',()=>{
 assert.equal(typeof helper.createActorSummary,'function');
 for(const change of ['missing','duplicate','private','inconsistent','bad-meta','malformed','oversized']){
  const log=frames();if(change==='missing')log.splice(0,1);
  if(change==='duplicate')log.splice(1,0,log[0]);
  if(change==='private')log[0]=log[0].replace('[1,21,18,2,5,10,13,"OK"]','[1,21,18,"PRIVATE_MUST_NOT_PRINT",5,10,13,"OK"]');
  if(change==='inconsistent')log[0]=log[0].replace('[1,21,18,2,5,10,13,"OK"]','[1,21,18,2,9,10,13,"OK"]');
  if(change==='bad-meta')log[log.length-1]=log.at(-1).replace('"retained":700','"retained":699');
  if(change==='malformed')log.push('# C6_D1_ACTOR_SAMPLES {');
  if(change==='oversized')log.push('# C6_D1_ACTOR_META '+ 'x'.repeat(5000));
  const c=helper.createActorSummary();for(const line of log)c.ingest(line);
  const out=c.finish();assert.equal(out.filter(r=>r.suite==='small').at(-1).status,'PARTIAL');
  assert.doesNotMatch(JSON.stringify(out),/PRIVATE_MUST_NOT_PRINT/);
 }
});
test('native t.diagnostic transport and CI summary retain700 bounded actor samples beside an actual failed footer',()=>{
 assert.equal(typeof helper.createActorSummary,'function');
 const dir=mkdtempSync(join(tmpdir(),'cmwebs-actor-transport-'));
 try{
  const child=join(dir,'actor.test.mjs'),url=new URL('../cloudflare/read-api/test/read-actor-timing.mjs',import.meta.url).href;
  writeFileSync(child,`import {test} from 'node:test';import {createActorTiming} from ${JSON.stringify(url)};
   test('native actor frames',t=>{const c=createActorTiming('small',line=>t.diagnostic(line));
    for(const route of ${JSON.stringify(routes)})for(let i=0;i<100;i++)c.record(route,i,21,18,'{"v":3,"entry_to_before_txn_ms":2,"awaited_txn_ms":5,"entry_to_txn_ms":10,"json_tail_ms":13,"txn_admission_ms":1,"txn_queries_ms":1,"txn_bookmark_ms":1,"txn_completion_ms":2}');c.close('FAIL');});`);
  const run=spawnSync(process.execPath,['--test','--test-reporter=tap',child],{encoding:'utf8',timeout:10000,maxBuffer:1024*1024,env:{PATH:process.env.PATH||'/usr/bin:/bin',LANG:'C',TZ:'Asia/Taipei'}});
  assert.equal(run.status,0,run.stderr);const lines=run.stdout.split('\n').filter(l=>l.startsWith('# C6_D1_ACTOR_'));
  assert.equal(lines.length,71);assert(lines.every(l=>Buffer.byteLength(l.slice(2))<=4096));
  const c=helper.createActorSummary();for(const line of lines)c.ingest(line);
  assert.equal(c.finish().filter(r=>r.suite==='small').at(-1).retained,700);
  const log=join(dir,'worker.log');writeFileSync(log,run.stdout+'not ok 2 - original latency\n  ---\n  error: p95=90ms\n  ...\n1..2\n# tests 2\n# pass 1\n# fail 1\n');
  const summary=spawnSync(process.execPath,[new URL('../scripts/summarize-read-worker-ci.mjs',import.meta.url).pathname,log],{encoding:'utf8'});
  assert.equal(summary.status,0,summary.stderr);assert.match(summary.stdout,/C6_D1_ACTOR_AGGREGATE /);
  assert.match(summary.stdout,/"entry_to_before_txn":2/);assert.match(summary.stdout,/"awaited_txn":5/);
  assert.match(summary.stdout,/"txn_admission":1/);assert.match(summary.stdout,/"txn_bookmark":1/);
  assert.match(summary.stdout,/"entry_to_txn":10/);assert.match(summary.stdout,/# fail 1/);
  assert.match(summary.stdout,/"actor_records_invalid":0/);assert.match(summary.stdout,/"actor_aggregates_dropped":0/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
