import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
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
