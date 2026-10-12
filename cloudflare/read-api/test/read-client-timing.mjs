import assert from 'node:assert/strict';
import {PerformanceObserver,performance} from 'node:perf_hooks';

const suites=new Set(['capacity500','small']);
const routes=new Set(['home','actions','revenue','tenants','rooms','arrears','properties']);
const sampleLimit=700,gcLimit=2048,lineLimit=4096;
const columns=['sample','completed','start_ms','end_ms','full_ms','dispatch_ms','consume_ms',
  'node_cpu_user_us','node_cpu_system_us','node_elu_active_ms','node_elu_idle_ms','node_elu'];

// Test-client observations only: no Worker instrumentation, response values,
// identity, URL, environment or error text. Added client work can perturb timing;
// these observations never replace the original sample count or p95 assertion.
export function createClientTiming(suite) {
  assert.ok(suites.has(suite));
  const samples=[],gc=[];let gcTotal=0;
  const collect=entries=>{
    gcTotal+=entries.length;
    for(const entry of entries)if(gc.length<gcLimit)gc.push([entry.startTime,entry.duration,entry.detail?.kind??0]);
  };
  const observer=new PerformanceObserver(list=>collect(list.getEntries()));
  observer.observe({entryTypes:['gc']});
  let closed=false;
  return {
    begin(route,index) {
      assert.ok(routes.has(route));assert.ok(Number.isInteger(index)&&index>=0&&index<100);
      assert.ok(samples.length<sampleLimit,'Client diagnostic sample bound');
      const row={route,sample:index+1,completed:false};samples.push(row);
      return {row,cpu:process.cpuUsage(),elu:performance.eventLoopUtilization()};
    },
    end(token,start,dispatchAt,end) {
      const cpu=process.cpuUsage(token.cpu),elu=performance.eventLoopUtilization(token.elu);
      Object.assign(token.row,{completed:true,start_ms:start,end_ms:end,full_ms:end-start,
        dispatch_ms:dispatchAt-start,consume_ms:end-dispatchAt,
        node_cpu_user_us:cpu.user,node_cpu_system_us:cpu.system,
        node_elu_active_ms:elu.active,node_elu_idle_ms:elu.idle,node_elu:elu.utilization});
    },
    close(outcome) {
      if(closed)return;closed=true;
      collect(observer.takeRecords());observer.disconnect();
      assert.ok(outcome==='PASS'||outcome==='FAIL');
      let outputDropped=0;
      const emit=(type,value)=>{
        const line='C6_NODE_CLIENT_'+type+' '+JSON.stringify({suite,...value});
        if(Buffer.byteLength(line,'utf8')>lineLimit){outputDropped++;return;}
        console.log(line);
      };
      for(const route of routes){
        const rows=samples.filter(row=>row.route===route).map(row=>columns.map(key=>
          key==='completed'?(row.completed?1:0):(row[key]??null)));
        for(let offset=0;offset<rows.length;offset+=10)emit('SAMPLES',{route,offset,rows:rows.slice(offset,offset+10)});
      }
      for(let offset=0;offset<gc.length;offset+=20)emit('GC',{offset,rows:gc.slice(offset,offset+20)});
      emit('META',{outcome,columns,gc_columns:['start_ms','duration_ms','kind'],sample_limit:sampleLimit,
        attempted_samples:samples.length,completed_samples:samples.filter(row=>row.completed).length,
        gc_limit:gcLimit,gc_total:gcTotal,gc_retained:gc.length,gc_dropped:gcTotal-gc.length,
        gc_overflow:gcTotal>gcLimit,output_dropped:outputDropped,line_limit_bytes:lineLimit,
        scope:'NODE_CLIENT_ONLY_NOT_ACCEPTANCE_OR_WORKER_CPU'});
    }
  };
}
