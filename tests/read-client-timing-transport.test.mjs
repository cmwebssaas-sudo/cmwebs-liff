import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const moduleUrl=new URL('../cloudflare/read-api/test/read-client-timing.mjs',import.meta.url).href;
test('native diagnostic transport retains complete JSON frames without raw console emission',()=>{
  const dir=mkdtempSync(join(tmpdir(),'cmwebs-client-transport-'));
  try{
    const child=join(dir,'transport.test.mjs');
    writeFileSync(child,`import {test} from 'node:test';
      import {createClientTiming} from ${JSON.stringify(moduleUrl)};
      test('structured synthetic telemetry',t=>{
        const saved=console.log;console.log=()=>{throw new Error('RAW_CONSOLE_FORBIDDEN');};
        try{
          const timing=createClientTiming('small',line=>t.diagnostic(line));
          for(const route of ['home','actions','revenue','tenants','rooms','arrears','properties'])
            for(let i=0;i<100;i++){
              const token=timing.begin(route,i),start=performance.now();
              timing.end(token,start,start,start);
            }
          timing.close('PASS');
        }finally{console.log=saved;}
      });`);
    const result=spawnSync(process.execPath,['--test','--test-reporter=tap',child],{encoding:'utf8',maxBuffer:1024*1024,timeout:10000,env:{PATH:process.env.PATH||'/usr/bin:/bin',LANG:'C',TZ:'Asia/Taipei'}});
    assert.equal(result.status,0,result.stderr+result.stdout.slice(-1200));
    const frames=result.stdout.split('\n').filter(line=>/^# C6_NODE_CLIENT_(SAMPLES|GC|META) /.test(line));
    const records=frames.map(line=>JSON.parse(line.replace(/^# C6_NODE_CLIENT_\w+ /,'')));
    const sampleChunks=records.filter(record=>record.route);
    assert.equal(sampleChunks.length,70);
    assert.equal(sampleChunks.reduce((n,record)=>n+record.rows.length,0),700);
    const meta=records.find(record=>record.columns);
    assert.equal(meta.completed_samples,700);assert.equal(meta.output_dropped,0);
    assert.doesNotMatch(result.stdout,/RAW_CONSOLE_FORBIDDEN/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

// Losing one before/after frame or collecting memory inside the wall interval
// must be observable to the operator, not silently complete evidence.
test('capacity client memory transport brackets real timers with bounded numeric snapshots',()=>{
  const dir=mkdtempSync(join(tmpdir(),'cmwebs-memory-transport-'));
  try{
    const child=join(dir,'memory.test.mjs');
    writeFileSync(child,`import {test} from 'node:test';
      import {createClientTiming} from ${JSON.stringify(moduleUrl)};
      test('capacity memory',t=>{
        const timing=createClientTiming('capacity500',line=>t.diagnostic(line));
        for(const route of ['home','actions','revenue','tenants','rooms','arrears','properties'])
          for(let i=0;i<100;i++){const token=timing.begin(route,i),start=performance.now();timing.end(token,start,start,start);}
        timing.close('PASS');
      });`);
    const result=spawnSync(process.execPath,['--test','--test-reporter=tap',child],{encoding:'utf8',maxBuffer:1024*1024,timeout:10000,env:{PATH:process.env.PATH||'/usr/bin:/bin',LANG:'C',TZ:'Asia/Taipei'}});
    assert.equal(result.status,0,result.stderr);
    const lines=result.stdout.split('\n');
    const memory=lines.filter(line=>line.startsWith('# C6_NODE_MEMORY_SAMPLES ')).flatMap(line=>JSON.parse(line.slice(line.indexOf('{'))).rows);
    assert.equal(memory.length,200,'all100 paired before/after property snapshots');
    const times=lines.filter(line=>line.startsWith('# C6_NODE_CLIENT_SAMPLES ')).map(line=>JSON.parse(line.slice(line.indexOf('{')))).filter(v=>v.route==='properties').flatMap(v=>v.rows);
    for(let i=0;i<100;i++){
      const before=memory[2*i],after=memory[2*i+1];
      assert.equal(before[0],i+1);assert.equal(before[1],0);assert.equal(after[0],i+1);assert.equal(after[1],1);
      assert(before.every(Number.isFinite)&&after.every(Number.isFinite));
      assert(before[2]<=times[i][2]);assert(after[2]>=times[i][3]);
    }
    const meta=JSON.parse(lines.find(line=>line.startsWith('# C6_NODE_MEMORY_META ')).slice('# C6_NODE_MEMORY_META '.length));
    assert.equal(meta.total,200);assert.equal(meta.retained,200);assert.equal(meta.dropped,0);
    assert.equal(meta.output_dropped,0);assert.equal(meta.scope,'NODE_CLIENT_MEMORY_NOT_WORKER_CAUSE_OR_ACCEPTANCE');
    for(const line of lines.filter(line=>line.startsWith('# C6_NODE_MEMORY_')))assert(Buffer.byteLength(line.slice(2))<=4096);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
