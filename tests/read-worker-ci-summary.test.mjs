import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const script=new URL('../scripts/summarize-read-worker-ci.mjs',import.meta.url);
function summarize(log){
  const dir=mkdtempSync(join(tmpdir(),'cmwebs-ci-summary-'));
  try{
    const path=join(dir,'worker.log');writeFileSync(path,log);
    return spawnSync(process.execPath,[script.pathname,path],{encoding:'utf8'});
  }finally{rmSync(dir,{recursive:true,force:true});}
}
const footer='1..33\n# tests 33\n# pass 31\n# fail 2\n# cancelled 0\n# skipped 0\n';

test('CI summary retains early failed case details after more than the provider log window',()=>{
  const result=summarize('not ok 4 - scoped 500 rooms\n  ---\n  error: fetch failed\n  stack: setup (fixture:27)\n  ...\n'
    +'# numeric observations '.repeat(16000)+'\nnot ok 10 - capacity latency\n  ---\n  error: home p95=64.115ms\n  ...\n'+footer);
  assert.equal(result.status,0,result.stderr);
  const tail=result.stdout.slice(-120000);
  assert.match(tail,/not ok 4 - scoped 500 rooms/);assert.match(tail,/fetch failed/);
  assert.match(tail,/not ok 4 - scoped 500 rooms\n  ---\n  error: fetch failed/);
  assert.match(tail,/home p95=64.115ms/);assert.match(tail,/# fail 2/);
  assert.match(tail,/"footer_seen":true/);
});
test('excess terminal markers cannot overflow the bounded summary',()=>{
  const result=summarize('1..'+'9'.repeat(70000)+'\n'+'1..33\n'.repeat(20000)+footer);
  assert.equal(result.status,0,result.stderr);assert.ok(Buffer.byteLength(result.stdout)<64000);
  assert.match(result.stdout,/"footer_lines_dropped":/);
});
test('interrupted CI logs never manufacture a terminal footer or a passing outcome',()=>{
  const result=summarize('ok 1 - first\nnot ok 2 - interrupted\n  ---\n  error: transport failed\n');
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/transport failed/);
  assert.match(result.stdout,/"footer_seen":false/);assert.match(result.stdout,/"incomplete_failure_blocks":1/);
  assert.doesNotMatch(result.stdout,/# pass|"outcome":"PASS"/);
});
test('summary reports overflowing failure details while retaining names and actual footer',()=>{
  const log=Array.from({length:80},(_,i)=>'not ok '+(i+1)+' - synthetic case '+i+'\n  ---\n  error: '+'漢'.repeat(900)+'\n  ...\n').join('')+footer;
  const result=summarize(log);assert.equal(result.status,0,result.stderr);
  assert.ok(Buffer.byteLength(result.stdout)<64000);
  assert.match(result.stdout,/synthetic case 0/);assert.match(result.stdout,/synthetic case 79/);
  const meta=JSON.parse(result.stdout.trim().split('\n').at(-1).replace(/^C6_CI_SUMMARY_META /,''));
  assert.ok(meta.detail_lines_dropped>0);assert.equal(meta.failed_cases,80);assert.equal(meta.footer_seen,true);
});
test('summary distinguishes a terminal passing footer without inventing missing assertions',()=>{
  const result=summarize('ok 1 - first\n1..1\n# tests 1\n# pass 1\n# fail 0\n# skipped 0\n');
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/# fail 0/);
  assert.match(result.stdout,/"failed_cases":0/);assert.match(result.stdout,/"footer_seen":true/);
});
test('unreadable CI input fails explicitly',()=>{
  const result=spawnSync(process.execPath,[script.pathname,'/private/tmp/cmwebs-ci-summary-missing.log'],{encoding:'utf8'});
  assert.notEqual(result.status,0);assert.equal(result.stdout,'');
});
test('omitted failure headers never attach their error details to another case',()=>{
  const result=summarize('not ok 1 - first\n  ---\n  error: FIRST_REASON\n  ...\n'
    +'not ok 2 - '+'x'.repeat(1200)+'\n  ---\n  error: SECOND_REASON\n  ...\n'
    +'not ok 3 - third\n  ---\n  error: THIRD_REASON\n  ...\n'+footer);
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/not ok 1 - first\n  ---\n  error: FIRST_REASON/);
  assert.match(result.stdout,/not ok 3 - third\n  ---\n  error: THIRD_REASON/);
  assert.doesNotMatch(result.stdout,/SECOND_REASON/);
  assert.match(result.stdout,/"failure_names_dropped":1/);
});
test('terminal evidence preserves original capacity distribution and safe fixture cause without rounding',()=>{
  const distribution='# C6_LOCAL_500_ROOM_DISTRIBUTION '+JSON.stringify({route:'actions',p95_full_ms:86.168234,max_ms:123.456789,over_50:6,ordered_ms:[6.111111,86.168234,123.456789]});
  const failure='# C6_D1_FIXTURE_FAILURE '+JSON.stringify({stage:'row_seed',seed_statements:2055,cause_code:'UND_ERR_SOCKET'});
  const result=summarize(failure+'\n'+distribution+'\n'+'# numeric observations '.repeat(16000)+'\n'+footer);
  assert.equal(result.status,0,result.stderr);
  const tail=result.stdout.slice(-120000);
  assert.ok(tail.includes(distribution));assert.ok(tail.includes(failure));
});

test('capacity stage evidence survives full distributions and verbose client samples beside the failed gate',()=>{
  const routes=['home','actions','revenue','tenants','rooms','arrears','properties'];
  const stages=routes.map(route=>'# C6_LOCAL_500_ROOM_STAGES '+JSON.stringify({route,samples:100,p95_ms:52.057,
    stage_p95_ms:{d1:24.123,decode:4.567,route:5.678},slowest:[{index:21,wall_ms:54.415,
      dispatch_ms:33.421,consume_ms:20.994,d1:23.234,decode:4.321,route:5.123,body_bytes:12345}]}));
  const distributions=routes.map(route=>'# C6_LOCAL_500_ROOM_DISTRIBUTION '+JSON.stringify({route,ordered_ms:Array(100).fill(52.05654700000014)}));
  const result=summarize(distributions.join('\n')+'\n'+stages.join('\n')+'\n'+'# numeric observations '.repeat(16000)+'\n'
    +'not ok 18 - capacity\n  ---\n  error: properties p95=52.057ms\n  ...\n'+footer);
  assert.equal(result.status,0,result.stderr);
  for(const line of stages)assert.ok(result.stdout.includes(line),'retain '+JSON.parse(line.slice(line.indexOf('{'))).route);
  assert.match(result.stdout,/properties p95=52.057ms/);assert.match(result.stdout,/# fail 2/);
  assert.match(result.stdout,/"stage_lines_dropped":0/);
});

test('excess stage lines are explicitly bounded without losing the original footer',()=>{
  const line='# C6_LOCAL_500_ROOM_STAGES '+JSON.stringify({route:'properties',samples:100,p95_ms:52.057,slowest:Array(2).fill({index:1,wall_ms:55,d1:25,decode:5,route:5})});
  const result=summarize((line+'\n').repeat(10000)+footer);
  assert.equal(result.status,0,result.stderr);assert(Buffer.byteLength(result.stdout)<64000);
  const meta=JSON.parse(result.stdout.trim().split('\n').at(-1).replace(/^C6_CI_SUMMARY_META /,''));
  assert(meta.stage_lines_dropped>0);assert.equal(meta.footer_seen,true);
});

const clientColumns=['sample','completed','start_ms','end_ms','full_ms','dispatch_ms','consume_ms',
  'node_cpu_user_us','node_cpu_system_us','node_elu_active_ms','node_elu_idle_ms','node_elu'];
function clientLog({missing=false,duplicate=false,invalid=false,omitGc=false}={}){
  const rows=Array.from({length:100},(_,i)=>{
    const full=i<10?80:40,start=(i+1)*100;
    return [i+1,1,start,start+full,full,full-5,5,1000,200,2,full-2,2/full];
  });
  if(invalid)rows[0][5]='SYNTHETIC_SECRET_MUST_NOT_PRINT';
  const lines=[];
  for(let offset=0;offset<(missing?90:100);offset+=10)lines.push('# C6_NODE_CLIENT_SAMPLES '+JSON.stringify({suite:'capacity500',route:'tenants',offset,rows:rows.slice(offset,offset+10)}));
  if(duplicate)lines.push(lines[0]);
  if(!omitGc)lines.push('# C6_NODE_CLIENT_GC '+JSON.stringify({suite:'capacity500',offset:0,rows:[[110,3,1]]}));
  lines.push('# C6_NODE_CLIENT_META '+JSON.stringify({suite:'capacity500',outcome:'FAIL',columns:clientColumns,
    gc_columns:['start_ms','duration_ms','kind'],attempted_samples:100,completed_samples:100,
    gc_total:1,gc_retained:1,gc_dropped:0,gc_overflow:false,output_dropped:0,
    token:'SYNTHETIC_META_SECRET_MUST_NOT_PRINT'}));
  return lines.join('\n')+'\n';
}
function aggregate(result){
  const lines=result.stdout.split('\n').filter(line=>line.startsWith('# C6_NODE_CLIENT_AGGREGATE '));
  assert.equal(lines.length,1,'client evidence needs one bounded aggregate');
  return JSON.parse(lines[0].replace(/^# C6_NODE_CLIENT_AGGREGATE /,''));
}
test('terminal summary retains complete client timing aggregates after verbose output without exposing raw rows',()=>{
  const result=summarize(clientLog()+'# numeric observations '.repeat(16000)+'\n'+footer);
  assert.equal(result.status,0,result.stderr);const data=aggregate(result);
  assert.equal(data.sample_status,'COMPLETE');assert.equal(data.samples,100);assert.equal(data.gc_status,'COMPLETE');
  assert.equal(data.over_50.count,10);assert.equal(data.below_50.count,90);
  assert.equal(data.over_50.median_dispatch_ms,75);assert.equal(data.over_50.median_consume_ms,5);
  assert.equal(data.over_50.median_node_cpu_ms,1.2);assert.equal(data.over_50.median_node_elu_idle_ms,78);
  assert.equal(data.over_50.samples_with_node_gc_overlap,1);
  assert.equal(data.scope,'NODE_CLIENT_ONLY_NOT_WORKER_CAUSE_OR_ACCEPTANCE');
  assert.doesNotMatch(result.stdout,/SYNTHETIC_META_SECRET|C6_NODE_CLIENT_SAMPLES/);
  assert.ok(Buffer.byteLength(result.stdout)<64000);
});
test('missing client chunks cannot be reported as a complete sample or zero-GC proof',()=>{
  const result=summarize(clientLog({missing:true})+footer);const data=aggregate(result);
  assert.equal(data.sample_status,'INCOMPLETE');assert.equal(data.samples,90);assert.equal(data.over_50,null);
});
test('duplicate client chunks retain an explicit incomplete status instead of overwriting evidence',()=>{
  const result=summarize(clientLog({duplicate:true})+footer);const data=aggregate(result);
  assert.equal(data.sample_status,'INCOMPLETE');assert.ok(data.invalid_records>0);assert.equal(data.over_50,null);
});
test('malformed client values never enter terminal diagnostics and cannot manufacture a complete aggregate',()=>{
  const result=summarize(clientLog({invalid:true})+footer);const data=aggregate(result);
  assert.equal(data.sample_status,'INCOMPLETE');assert.ok(data.invalid_records>0);
  assert.doesNotMatch(result.stdout,/SYNTHETIC_SECRET_MUST_NOT_PRINT|SYNTHETIC_META_SECRET_MUST_NOT_PRINT/);
});
test('complete client samples with missing GC records preserve unknown GC attribution',()=>{
  const result=summarize(clientLog({omitGc:true})+footer);const data=aggregate(result);
  assert.equal(data.sample_status,'COMPLETE');assert.equal(data.gc_status,'INCOMPLETE');
  assert.equal(data.over_50.count,10);assert.equal(data.over_50.samples_with_node_gc_overlap,null);
});

function flaggedClientLog(rows){
  const lines=clientLog().trim().split('\n');
  return lines.map(line=>{
    if(line.startsWith('# C6_NODE_CLIENT_GC '))return '# C6_NODE_CLIENT_GC '+JSON.stringify({suite:'capacity500',offset:0,rows});
    if(line.startsWith('# C6_NODE_CLIENT_META ')){
      const meta=JSON.parse(line.slice(line.indexOf('{')));meta.gc_columns=['start_ms','duration_ms','kind','flags'];
      meta.gc_total=rows.length;meta.gc_retained=rows.length;
      return '# C6_NODE_CLIENT_META '+JSON.stringify(meta);
    }
    return line;
  }).join('\n')+'\n';
}
test('GC flags annotate overlapping slow requests without treating absent flags as zero',()=>{
  const result=summarize(flaggedClientLog([[110,3,4,32],[120,3,4,4],[1110,3,1,0]])+footer),data=aggregate(result);
  assert.equal(data.gc_status,'COMPLETE');assert.equal(data.gc_flags_status,'COMPLETE');
  assert.equal(data.over_50.samples_with_node_gc_external_flag,1);
  assert.equal(data.over_50.samples_with_node_gc_forced_flag,1);
  assert.equal(data.below_50.samples_with_node_gc_external_flag,0);
  const legacy=aggregate(summarize(clientLog()+footer));
  assert.equal(legacy.gc_status,'COMPLETE');assert.equal(legacy.gc_flags_status,'NOT_COLLECTED');
  assert.equal(legacy.over_50.samples_with_node_gc_external_flag,null);
  const combined=aggregate(summarize(flaggedClientLog([[110,3,4,126]])+footer));
  assert.equal(combined.gc_flags_status,'COMPLETE');
  assert.equal(combined.over_50.samples_with_node_gc_forced_flag,1);
  assert.equal(combined.over_50.samples_with_node_gc_external_flag,1);
});
test('unknown or malformed GC flags cannot manufacture complete attribution or leak values',()=>{
  for(const flag of [null,1,128,-1,0.5,'GC_FLAG_SECRET']){
    const result=summarize(flaggedClientLog([[110,3,4,flag]])+footer),data=aggregate(result);
    assert.equal(data.gc_flags_status,'INCOMPLETE');
    assert.equal(data.over_50?.samples_with_node_gc_external_flag??null,null);
    assert.doesNotMatch(result.stdout,/GC_FLAG_SECRET/);
  }
  const mixed=aggregate(summarize(flaggedClientLog([[110,3,4]])+footer));
  assert.equal(mixed.gc_status,'INCOMPLETE');assert.equal(mixed.gc_flags_status,'INCOMPLETE');
  const mismatched=aggregate(summarize(flaggedClientLog([[110,3,4,32]]).replace('"kind","flags"','"kind"')+footer));
  assert.equal(mismatched.gc_status,'INCOMPLETE');assert.equal(mismatched.gc_flags_status,'INCOMPLETE');
});

test('malformed recognized client JSON cannot be ignored while reporting complete evidence',()=>{
  const result=summarize(clientLog()+'# C6_NODE_CLIENT_GC {SYNTHETIC_MALFORMED_SECRET}\n'+footer);
  const data=aggregate(result);assert.equal(data.sample_status,'INCOMPLETE');assert.equal(data.gc_status,'INCOMPLETE');
  assert.ok(data.invalid_records>0);assert.doesNotMatch(result.stdout,/SYNTHETIC_MALFORMED_SECRET/);
});
test('oversized recognized client records cannot be ignored while reporting complete evidence',()=>{
  const result=summarize(clientLog()+'# C6_NODE_CLIENT_SAMPLES '+JSON.stringify({suite:'capacity500',route:'tenants',payload:'SYNTHETIC_OVERSIZED_SECRET'.repeat(300)})+'\n'+footer);
  const data=aggregate(result);assert.equal(data.sample_status,'INCOMPLETE');assert.ok(data.invalid_records>0);
  assert.doesNotMatch(result.stdout,/SYNTHETIC_OVERSIZED_SECRET/);
});

test('empty recognized client chunks are malformed instead of silently complete evidence',()=>{
  for(const kind of ['SAMPLES','GC']){
    const extra={suite:'capacity500',offset:0,rows:[]};if(kind==='SAMPLES')extra.route='tenants';
    const result=summarize(clientLog()+'# C6_NODE_CLIENT_'+kind+' '+JSON.stringify(extra)+'\n'+footer);
    const data=aggregate(result);assert.equal(kind==='SAMPLES'?data.sample_status:data.gc_status,'INCOMPLETE');
    assert.ok(data.invalid_records>0);
  }
});
test('entirely missing client suites are explicitly reported even when no aggregate exists',()=>{
  for(const [log,want] of [[clientLog(),['small']],['',['capacity500','small']]]){
    const result=summarize(log+footer);
    const meta=JSON.parse(result.stdout.trim().split('\n').at(-1).replace(/^C6_CI_SUMMARY_META /,''));
    assert.deepEqual(meta.client_suites_missing,want);assert.equal(meta.scope,'LOG_EVIDENCE_ONLY_NOT_TEST_OUTCOME');
  }
});

function multiRouteClientLog({missingRoute=false}={}){
  const lines=clientLog().trim().split('\n');
  const meta=JSON.parse(lines.pop().replace(/^# C6_NODE_CLIENT_META /,''));
  const actionLines=[];
  for(const line of lines.filter(line=>line.startsWith('# C6_NODE_CLIENT_SAMPLES '))){
    const data=JSON.parse(line.replace(/^# C6_NODE_CLIENT_SAMPLES /,''));data.route='actions';
    data.rows=data.rows.map(row=>{const copy=row.slice();copy[2]+=20000;copy[3]=copy[2]+120;
      copy[4]=120;copy[5]=100;copy[6]=20;copy[10]=118;copy[11]=2/120;return copy;});
    actionLines.push('# C6_NODE_CLIENT_SAMPLES '+JSON.stringify(data));
  }
  meta.attempted_samples=200;meta.completed_samples=200;
  return [...lines,...(missingRoute?[]:actionLines),'# C6_NODE_CLIENT_META '+JSON.stringify(meta)].join('\n')+'\n';
}
test('bounded aggregate selects the actually slowest complete route instead of assuming tenants',()=>{
  const result=summarize(multiRouteClientLog()+footer),data=aggregate(result);
  assert.equal(data.route,'actions');assert.equal(data.selection,'HIGHEST_COMPLETE_P95');
  assert.equal(data.sample_status,'COMPLETE');assert.equal(data.samples,100);assert.equal(data.collected_samples,200);
  assert.equal(data.over_50.count,100);assert.equal(data.over_50.median_dispatch_ms,100);
  assert.equal(data.over_50.median_consume_ms,20);assert.equal(data.over_50.samples_with_node_gc_overlap,0);
});
test('a complete selected route cannot hide absent sample frames counted by suite metadata',()=>{
  const result=summarize(multiRouteClientLog({missingRoute:true})+footer),data=aggregate(result);
  assert.equal(data.sample_status,'INCOMPLETE');assert.equal(data.collected_samples,100);
  assert.equal(data.over_50,null);
});

test('non-numeric sample identifiers are rejected without invoking coercion or losing terminal evidence',()=>{
  const lines=clientLog().trim().split('\n');
  const data=JSON.parse(lines[0].replace(/^# C6_NODE_CLIENT_SAMPLES /,''));
  data.rows[0][0]={toString:'SYNTHETIC_IDENTIFIER_SECRET'};
  lines[0]='# C6_NODE_CLIENT_SAMPLES '+JSON.stringify(data);
  const result=summarize(lines.join('\n')+'\n'+footer);
  assert.equal(result.status,0,result.stderr);assert.equal(aggregate(result).sample_status,'INCOMPLETE');
  assert.match(result.stdout,/# fail 2/);assert.doesNotMatch(result.stdout,/SYNTHETIC_IDENTIFIER_SECRET/);
});

function memoryLog({bad=false}={}){
 const lines=[];
 for(let offset=0;offset<200;offset+=10){
  const rows=Array.from({length:10},(_,i)=>{const n=offset+i,sample=Math.floor(n/2)+1,phase=n%2,delta=sample<=10?30:10;
   return [sample,phase,sample*100+(phase?90:-1),1000+phase*delta,2000,1500+phase*delta,500+phase*delta,300+phase*delta];});
  if(bad&&offset===0)rows[1][3]='MEMORY_SECRET_MUST_NOT_PRINT';
  lines.push('# C6_NODE_MEMORY_SAMPLES '+JSON.stringify({suite:'capacity500',offset,rows}));
 }
 lines.push('# C6_NODE_MEMORY_META '+JSON.stringify({suite:'capacity500',total:200,retained:200,dropped:0,output_dropped:0,columns:['sample','phase','at_ms','rss_bytes','heap_total_bytes','heap_used_bytes','external_bytes','array_buffer_bytes'],secret:'MEMORY_META_SECRET_MUST_NOT_PRINT'}));
 return lines.join('\n')+'\n';
}
test('terminal memory evidence joins complete property snapshots to original over/below50 samples',()=>{
 const result=summarize(clientLog().replaceAll('"route":"tenants"','"route":"properties"')+memoryLog()+footer);
 const data=aggregate(result);
 assert.equal(data.memory_status,'COMPLETE');
 assert.equal(data.memory_over_50.count,10);assert.equal(data.memory_below_50.count,90);
 assert.equal(data.memory_over_50.median_external_delta_bytes,30);
 assert.equal(data.memory_below_50.median_array_buffer_delta_bytes,10);
 assert.equal(data.memory_over_50.median_heap_used_delta_bytes,30);
 assert.doesNotMatch(result.stdout,/MEMORY_META_SECRET|C6_NODE_MEMORY_SAMPLES/);
});
test('invalid or missing memory snapshots cannot manufacture complete evidence or expose arbitrary values',()=>{
 const original=memoryLog(),first=original.split('\n')[0];
 const inside=original.split('\n').map((line,i)=>{if(i!==0)return line;const data=JSON.parse(line.slice(line.indexOf('{')));data.rows[0][2]=101;return '# C6_NODE_MEMORY_SAMPLES '+JSON.stringify(data);}).join('\n');
 const overlapping=original.split('\n').map(line=>{if(!line.startsWith('# C6_NODE_MEMORY_SAMPLES '))return line;const data=JSON.parse(line.slice(line.indexOf('{')));for(const row of data.rows)row[2]=row[1]?50000:0;return '# C6_NODE_MEMORY_SAMPLES '+JSON.stringify(data);}).join('\n');
 for(const memory of [overlapping,memoryLog({bad:true}),original.split('\n').filter((_,i)=>i!==0).join('\n'),original+first+'\n',inside,original.split('\n').filter(line=>!line.startsWith('# C6_NODE_MEMORY_META ')).join('\n')]){
  const result=summarize(clientLog().replaceAll('"route":"tenants"','"route":"properties"')+memory+footer);
  const data=aggregate(result);assert.equal(data.memory_status,'INCOMPLETE');
  assert.equal(data.memory_over_50,null);assert.equal(data.memory_below_50,null);
  assert.doesNotMatch(result.stdout,/MEMORY_SECRET|MEMORY_META_SECRET/);
 }
});

test('all seven original capacity query-duration vectors survive noisy failed CI logs in sample order',()=>{
 const routes=['home','actions','revenue','tenants','rooms','arrears','properties'];
 const vectors=routes.map(route=>'# C6_LOCAL_500_ROOM_D1_INTERNAL '+JSON.stringify({route,ordered_internal_ms:Array.from({length:100},(_,i)=>i+0.125)}));
 const result=summarize(vectors.join('\n')+'\n'+'# noisy observations '.repeat(16000)+'\n'+footer);
 assert.equal(result.status,0,result.stderr);for(const line of vectors)assert(result.stdout.includes(line));
 const meta=JSON.parse(result.stdout.trim().split('\n').at(-1).replace(/^C6_CI_SUMMARY_META /,''));
 assert.equal(meta.d1_internal_vectors_retained,7);assert.equal(meta.d1_internal_vectors_invalid,0);assert.equal(meta.d1_internal_vectors_status,'COMPLETE');assert.match(result.stdout,/# fail 2/);
});
test('malformed duplicate or private D1 duration vectors cannot become complete or leak strings',()=>{
 const good='# C6_LOCAL_500_ROOM_D1_INTERNAL '+JSON.stringify({route:'home',ordered_internal_ms:Array(100).fill(1.25)});
 for(const bad of [good,good.replace('"home"','"PRIVATE_MUST_NOT_PRINT"'),good.replace('[1.25,','["PRIVATE_MUST_NOT_PRINT",'),good.replace('1.25,','-1,'),good.replace('1.25,',''),good.replace('}',',"private":"PRIVATE_MUST_NOT_PRINT"}')]){
  const result=summarize(good+'\n'+bad+'\n'+footer);assert.equal(result.status,0,result.stderr);
  const meta=JSON.parse(result.stdout.trim().split('\n').at(-1).replace(/^C6_CI_SUMMARY_META /,''));
  assert.equal(meta.d1_internal_vectors_status,'PARTIAL');assert(meta.d1_internal_vectors_invalid>0);assert.doesNotMatch(result.stdout,/PRIVATE_MUST_NOT_PRINT/);assert.match(result.stdout,/# fail 2/);
 }
});

function statementEvidence(){
 const routes=['home','actions','revenue','tenants','rooms','arrears','properties'];
 const totals=routes.map(route=>'# C6_LOCAL_500_ROOM_D1_INTERNAL '+JSON.stringify({route,ordered_internal_ms:Array(100).fill(1)}));
 const frames=routes.flatMap(route=>Array.from({length:10},(_,chunk)=>'# C6_LOCAL_500_ROOM_D1_STATEMENTS '+JSON.stringify({route,offset:chunk*10,
  rows:Array.from({length:10},(_,i)=>[1,(chunk*10+i)/1000,1-(chunk*10+i)/1000,...Array(18).fill(0)])})));
 return {totals,frames};
}
test('all original statement timings survive CI in route sample and statement order',()=>{
 const {totals,frames}=statementEvidence();const result=summarize([...frames,...totals,footer].join('\n'));
 assert.equal(result.status,0,result.stderr);for(const frame of frames)assert(result.stdout.includes(frame));
 const meta=JSON.parse(result.stdout.trim().split('\n').at(-1).replace(/^C6_CI_SUMMARY_META /,''));
 assert.equal(meta.d1_statement_frames_retained,70);assert.equal(meta.d1_statement_samples_retained,700);
 assert.equal(meta.d1_statement_width,20);assert.equal(meta.d1_statement_frames_invalid,0);assert.equal(meta.d1_statement_frames_dropped,0);
 assert.equal(meta.d1_statement_status,'COMPLETE');assert.match(result.stdout,/# fail 2/);
});
test('statement evidence requires numeric shape unique slots correct sums and original totals',()=>{
 const {totals,frames}=statementEvidence(),one=frames[0];
 for(const bad of [one,one.replace('"home"','"PRIVATE_MUST_NOT_PRINT"'),one.replace('"offset":0','"offset":1'),
  one.replace('[1,0,1,','[1,"PRIVATE_MUST_NOT_PRINT",1,'),one.replace('[1,0,1,','[1,-1,2,'),
  one.replace('[1,0,1,','[1,0,2,'),one.replace('[1,0,1,','[1,1,'),one.replace('}',',"private":"PRIVATE_MUST_NOT_PRINT"}')]){
  const result=summarize([...totals,one,bad,footer].join('\n'));assert.equal(result.status,0,result.stderr);
  const meta=JSON.parse(result.stdout.trim().split('\n').at(-1).replace(/^C6_CI_SUMMARY_META /,''));
  assert.equal(meta.d1_statement_status,'PARTIAL');assert(meta.d1_statement_frames_invalid>0);
  assert.doesNotMatch(result.stdout,/PRIVATE_MUST_NOT_PRINT/);assert.match(result.stdout,/# fail 2/);
 }
 for(const log of [[...frames,footer],[...frames,...totals.slice(1),footer]]){
  const result=summarize(log.join('\n'));assert.equal(result.status,0,result.stderr);
  const meta=JSON.parse(result.stdout.trim().split('\n').at(-1).replace(/^C6_CI_SUMMARY_META /,''));
  assert.equal(meta.d1_statement_status,'PARTIAL');assert(meta.d1_statement_frames_invalid>0);
 }
 // A valid row sum still cannot substitute for its original sample total.
 const changed=one.replace('[1,0,1,','[2,0,2,');
 const mismatch=summarize([...totals,changed,footer].join('\n'));
 assert.equal(mismatch.status,0,mismatch.stderr);
 const meta=JSON.parse(mismatch.stdout.trim().split('\n').at(-1).replace(/^C6_CI_SUMMARY_META /,''));
 assert.equal(meta.d1_statement_status,'PARTIAL');assert.equal(meta.d1_statement_frames_retained,0);assert.equal(meta.d1_statement_frames_invalid,1);
});


const propertyStagePrefix='# C6_LOCAL_500_ROOM_PROPERTIES_STAGES ';
const propertyMetaPrefix='# C6_LOCAL_500_ROOM_PROPERTIES_META ';
const propertyReceiptPrefix='# C6_LOCAL_500_ROOM_PROPERTIES_RECEIPT ';
const propertyColumns=['sample','d1_ms','decode_ms','route_ms','body_bytes'];
function propertyEvidence({large=false}={}){
 const rows=Array.from({length:100},(_,i)=>[i,large?1.2345678901234567e+100:i+0.125,
  large?1.2345678901234567e+100:100-i+0.25,large?1.2345678901234567e+100:i*2+0.5,
  large?Number.MAX_SAFE_INTEGER:713795+i]);
 const frames=Array.from({length:10},(_,i)=>propertyStagePrefix+JSON.stringify({route:'properties',offset:i*10,rows:rows.slice(i*10,i*10+10)}));
 const meta=propertyMetaPrefix+JSON.stringify({route:'properties',columns:propertyColumns,total:100,retained:100,
  frames:10,invalid:0,dropped:0,output_dropped:0});
 return {rows,frames,meta};
}
function propertyReceipt(result){
 assert.equal(result.status,0,result.stderr);
 const lines=result.stdout.split('\n').filter(line=>line.startsWith(propertyReceiptPrefix));
 assert.equal(lines.length,1,'properties evidence always needs one explicit completeness receipt');
 return JSON.parse(lines[0].slice(propertyReceiptPrefix.length));
}
function summaryMeta(result){return JSON.parse(result.stdout.trim().split('\n').at(-1).slice('C6_CI_SUMMARY_META '.length));}
function retainedPropertyRows(result){return result.stdout.split('\n').filter(line=>line.startsWith(propertyStagePrefix))
 .flatMap(line=>JSON.parse(line.slice(propertyStagePrefix.length)).rows);}

test('properties stage receipt preserves all100 original row identities after old diagnostic and stage budgets fill',()=>{
 const {rows,frames,meta}=propertyEvidence();
 const oldStage='# C6_LOCAL_500_ROOM_STAGES '+JSON.stringify({route:'home',samples:100,slowest:[{index:0,wall_ms:55}]});
 const noise=('# C6_LOCAL_500_ROOM_DISTRIBUTION '+JSON.stringify({route:'home',ordered_ms:Array(100).fill(51.56710199999725)})+'\n').repeat(20)
  +(oldStage+'\n').repeat(100);
 const failure='not ok 60 - properties capacity\n  ---\n  error: properties p95=51.567ms;9of100>=50\n  ...\n';
 const result=summarize(noise+[...frames,meta,failure,footer].join('\n')),receipt=propertyReceipt(result);
 assert.equal(receipt.status,'COMPLETE');assert.equal(receipt.frames_retained,10);assert.equal(receipt.samples_retained,100);
 assert.equal(receipt.invalid_records,0);assert.equal(receipt.output_dropped,0);
 assert.equal(receipt.scope,'STAGE_PAIR_COVERAGE_NOT_CAUSE_OR_ACCEPTANCE');
 assert.deepEqual(retainedPropertyRows(result),rows);
 assert(result.stdout.includes(meta));
 const old=summaryMeta(result);assert(old.diagnostic_lines_dropped>0);assert(old.stage_lines_dropped>0);
 assert.match(result.stdout,/properties p95=51.567ms;9of100>=50/);assert.match(result.stdout,/# fail 2/);
 assert.equal(old.failed_cases,1);assert.equal(old.footer_seen,true);
});
test('missing properties frames metadata and all uncollected evidence remain explicitly incomplete',()=>{
 const {frames,meta}=propertyEvidence();
 for(const log of [[...frames.slice(1),meta],[...frames], [meta]]){
  const result=summarize([...log,footer].join('\n')),receipt=propertyReceipt(result);
  assert.equal(receipt.status,'PARTIAL');assert(receipt.samples_retained<100||!receipt.metadata_valid);
 }
 const absent=propertyReceipt(summarize(footer));assert.equal(absent.status,'NOT_COLLECTED');
 assert.equal(absent.samples_retained,0);assert.equal(absent.metadata_valid,false);
});
test('invalid duplicate out-of-order and oversized properties frames fail closed without leaking arbitrary payloads',()=>{
 const {frames,meta}=propertyEvidence(),first=JSON.parse(frames[0].slice(propertyStagePrefix.length));
 const variants=[
  frames[0],propertyStagePrefix+'{PRIVATE_STAGE_SECRET}',
  propertyStagePrefix+JSON.stringify({...first,route:'PRIVATE_STAGE_SECRET'}),
  propertyStagePrefix+JSON.stringify({...first,offset:1}),
  propertyStagePrefix+JSON.stringify({...first,extra:'PRIVATE_STAGE_SECRET'}),
  propertyStagePrefix+JSON.stringify({...first,rows:[]}),
  propertyStagePrefix+' '.repeat(3100)+JSON.stringify(first)
 ];
 for(const value of ['PRIVATE_STAGE_SECRET',-1,null,{},Number.MAX_VALUE]){
  const rows=first.rows.map(row=>row.slice());rows[0][4]=value;
  variants.push(propertyStagePrefix+JSON.stringify({...first,rows}));
 }
 for(const [column,value] of [[0,1],[0,'0'],[1,-1],[2,null],[3,'PRIVATE_STAGE_SECRET'],[3,{}],[4,1.5]]){
  const rows=first.rows.map(row=>row.slice());rows[0][column]=value;
  variants.push(propertyStagePrefix+JSON.stringify({...first,rows}));
 }
 const extraWidth=first.rows.map(row=>[...row,0]);variants.push(propertyStagePrefix+JSON.stringify({...first,rows:extraWidth}));
 const reordered=first.rows.slice().reverse();variants.push(propertyStagePrefix+JSON.stringify({...first,rows:reordered}));
 variants.push(frames[0].replace('0.125','1e999'));
 for(const [i,bad] of variants.entries()){
  const input=i===0?[...frames,meta,bad]:[bad,...frames.slice(1),meta];
  const result=summarize([...input,footer].join('\n')),receipt=propertyReceipt(result);
  assert.equal(receipt.status,'PARTIAL');assert(receipt.invalid_records>0||receipt.output_dropped>0);
  assert.doesNotMatch(result.stdout,/PRIVATE_STAGE_SECRET/);assert.match(result.stdout,/# fail 2/);
 }
 const order=propertyReceipt(summarize([...frames.slice(1),frames[0],meta,footer].join('\n')));
 assert.equal(order.status,'PARTIAL');assert(order.invalid_records>0);
});
test('properties metadata requires exact complete counts unique receipt and zero invalid or dropped rows',()=>{
 const {frames,meta}=propertyEvidence(),value=JSON.parse(meta.slice(propertyMetaPrefix.length));
 const badMeta=[propertyMetaPrefix+'{PRIVATE_META_SECRET}',meta,
  propertyMetaPrefix+JSON.stringify({...value,route:'home'}),
  propertyMetaPrefix+JSON.stringify({...value,columns:propertyColumns.slice().reverse()}),
  propertyMetaPrefix+JSON.stringify({...value,extra:'PRIVATE_META_SECRET'}),
  propertyMetaPrefix+' '.repeat(2100)+JSON.stringify(value)];
 for(const field of ['total','retained','frames','invalid','dropped','output_dropped'])
  for(const bad of [-1,null,'100',0.5,field==='frames'?9:field==='total'||field==='retained'?99:1])
   badMeta.push(propertyMetaPrefix+JSON.stringify({...value,[field]:bad}));
 for(const [i,bad] of badMeta.entries()){
  const input=i===1?[...frames,meta,bad]:[...frames,bad];
  const result=summarize([...input,footer].join('\n')),receipt=propertyReceipt(result);
  assert.equal(receipt.status,'PARTIAL');assert(receipt.invalid_records>0||receipt.output_dropped>0);
  assert.doesNotMatch(result.stdout,/PRIVATE_META_SECRET/);assert.match(result.stdout,/# fail 2/);
 }
 // Invalid producer counts alone must fail even without a preceding valid receipt.
 for(const field of ['total','retained','frames','invalid','dropped','output_dropped']){
  const bad={...value,[field]:field==='total'||field==='retained'?99:field==='frames'?9:1};
  const result=summarize([...frames,propertyMetaPrefix+JSON.stringify(bad),footer].join('\n'));
  assert.equal(propertyReceipt(result).status,'PARTIAL');
 }
});
test('ten maximum-budget properties frames plus raw metadata and receipt fit the independent32768bytes',()=>{
 const {rows,frames,meta}=propertyEvidence({large:true});
 // Whitespace pads raw frames to the exact inclusive frame budget without changing row values.
 const padded=frames.map(line=>line+' '.repeat(3072-Buffer.byteLength(line+'\n')));
 assert(padded.every(line=>Buffer.byteLength(line+'\n')===3072));
 const result=summarize([...padded,meta,footer].join('\n')),receipt=propertyReceipt(result);
 assert.equal(receipt.status,'COMPLETE');assert.deepEqual(retainedPropertyRows(result),rows);
 const output=result.stdout.split('\n').filter(line=>line.startsWith('# C6_LOCAL_500_ROOM_PROPERTIES_'));
 assert.equal(output.length,12);assert(Buffer.byteLength(output.join('\n')+'\n')<=32768);
 const overflow=summarize([...padded,meta,padded[0]+' ',footer].join('\n'));
 assert.equal(propertyReceipt(overflow).status,'PARTIAL');assert(propertyReceipt(overflow).output_dropped>0);
});
test('new properties evidence leaves existing statement actor fetch and failure metadata unchanged',()=>{
 const {frames,meta}=propertyEvidence(),{totals,frames:statements}=statementEvidence();
 const old=[...totals,...statements,clientLog(),footer].join('\n');
 const before=summarize(old),after=summarize([...frames,meta,old].join('\n'));
 assert.equal(propertyReceipt(after).status,'COMPLETE');assert.deepEqual(summaryMeta(after),summaryMeta(before));
 for(const prefix of ['# C6_D1_ACTOR_AGGREGATE ','# C6_NODE_FETCH_AGGREGATE ','# C6_NODE_CLIENT_AGGREGATE ',
  '# C6_LOCAL_500_ROOM_D1_STATEMENTS ','# C6_LOCAL_500_ROOM_D1_INTERNAL '])
  assert.deepEqual(after.stdout.split('\n').filter(line=>line.startsWith(prefix)),before.stdout.split('\n').filter(line=>line.startsWith(prefix)));
});

test('actual capacity tail emits original properties stage pairs before wall sorting and retains the strict failing gate',async()=>{
 const source=readFileSync(new URL('../cloudflare/read-api/test/read-capacity.test.mjs',import.meta.url),'utf8');
 const start=source.indexOf('  const timings='),end=source.indexOf("  timingOutcome='PASS';",start);
 assert(start>=0&&end>start);
 const routes=['home','actions','revenue','tenants','rooms','arrears','properties'],logs=[];
 let route,index,tick=0;const counts=Object.fromEntries(routes.map(r=>[r,0]));
 const result=runInNewContext('(async()=>{'+source.slice(start,end)+'})()',{
  process:{env:{}},assert,schema:{synthetic:{}},cases:routes.map(route=>({route})),paths:Object.fromEntries(routes.map(r=>[r,'/'+r])),
  fetchCapture:{begin:()=>({}),run:(_,fn)=>fn(),sample:()=>null},fetchTiming:{record:()=>{}},actorTiming:{record:()=>{}},
  clientTiming:{begin:(r,i)=>{route=r;index=i;counts[r]++;},end:()=>{}},
  performance:{now:()=>{const phase=tick++%3;return phase===0?0:phase===1?10:route==='properties'?59+index/100:20;}},
  mf:{dispatchFetch:async()=>({status:200,arrayBuffer:async()=>new ArrayBuffer(100+index),headers:{get:name=>
   name==='server-timing'?`d1;dur=${(index+0.125).toFixed(3)}, decode;dur=${(100-index+0.25).toFixed(3)}, route;dur=${(index*2+0.5).toFixed(3)}`:
   name==='x-cmwebs-test-d1-statements'?'[0.5]':name==='x-cmwebs-test-d1'?'{"internal_ms":0.5,"queries":1,"rows_read":1}':null}})},
  console:{log:line=>logs.push(line)}
 });
 await assert.rejects(result,error=>error.name==='AssertionError'&&/properties500-room/.test(error.message));
 assert.deepEqual(Object.values(counts),Array(7).fill(100));
 const summary=summarize(logs.map(line=>'# '+line).join('\n')+'\n'+footer);
 assert.equal(propertyReceipt(summary).status,'COMPLETE');
 assert.deepEqual(retainedPropertyRows(summary),Array.from({length:100},(_,i)=>[i,i+0.125,100-i+0.25,i*2+0.5,100+i]));
 assert.equal(logs.filter(line=>line.startsWith('C6_LOCAL_500_ROOM_PROPERTIES_STAGES ')).length,10);
});
