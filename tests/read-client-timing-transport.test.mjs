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
