import assert from 'node:assert/strict';
import {PerformanceObserver,performance} from 'node:perf_hooks';
import {getHeapStatistics,getHeapSpaceStatistics} from 'node:v8';
import {openSync,readSync,closeSync,constants} from 'node:fs';

const suites=new Set(['capacity500','small']);
const routes=new Set(['home','actions','revenue','tenants','rooms','arrears','properties']);
const sampleLimit=700,gcLimit=2048,lineLimit=4096;
const memoryColumns=['sample','phase','at_ms','rss_bytes','heap_total_bytes','heap_used_bytes','external_bytes','array_buffer_bytes'];
const columns=['sample','completed','start_ms','end_ms','full_ms','dispatch_ms','consume_ms',
  'node_cpu_user_us','node_cpu_system_us','node_elu_active_ms','node_elu_idle_ms','node_elu'];

const numeric=value=>Number.isFinite(value)&&value>=0?value:null;
function cgroupValue(name){
  if(process.platform!=='linux')return {bytes:null,unlimited:false};
  let fd;
  try{
    fd=openSync('/sys/fs/cgroup/'+name,constants.O_RDONLY|constants.O_NOFOLLOW);
    const buffer=Buffer.alloc(65),length=readSync(fd,buffer,0,65,null);
    if(length>64)return {bytes:null,unlimited:false};
    const text=buffer.subarray(0,length).toString('utf8').trim();
    if(text==='max')return {bytes:null,unlimited:true};
    if(!/^\d{1,16}$/.test(text)||!Number.isSafeInteger(Number(text)))return {bytes:null,unlimited:false};
    return {bytes:Number(text),unlimited:false};
  }catch{return {bytes:null,unlimited:false};}
  finally{if(fd!==undefined)closeSync(fd);}
}
function runtimeSample(row,phase){
  const at=performance.now(),heap=getHeapStatistics(),space=getHeapSpaceStatistics().find(v=>v.space_name==='new_space');
  const max=cgroupValue('memory.max'),high=cgroupValue('memory.high'),current=cgroupValue('memory.current');
  return {sample:row.sample,phase,at_ms:at,node_version:process.versions.node,
    heap_size_limit_bytes:numeric(heap.heap_size_limit),heap_total_bytes:numeric(heap.total_heap_size),
    heap_used_bytes:numeric(heap.used_heap_size),external_bytes:numeric(heap.external_memory),
    new_space_size_bytes:numeric(space?.space_size),new_space_used_bytes:numeric(space?.space_used_size),
    available_memory_bytes:numeric(typeof process.availableMemory==='function'?process.availableMemory():null),
    constrained_memory_bytes:numeric(typeof process.constrainedMemory==='function'?process.constrainedMemory():null),
    cgroup_max_bytes:max.bytes,cgroup_high_bytes:high.bytes,cgroup_current_bytes:current.bytes,
    cgroup_max_unlimited:max.unlimited,cgroup_high_unlimited:high.unlimited};
}

// Test-client observations only: no Worker instrumentation, response values,
// identity, URL, environment or error text. Added client work can perturb timing;
// these observations never replace the original sample count or p95 assertion.
export function createClientTiming(suite,emitDiagnostic=line=>console.log(line)) {
  assert.ok(suites.has(suite));
  assert.equal(typeof emitDiagnostic,'function');
  const samples=[],gc=[],memory=[],runtime=[];let gcTotal=0,memoryTotal=0,runtimeTotal=0;
  const rememberMemory=(row,phase)=>{
    if(suite!=='capacity500'||row.route!=='properties')return;
    memoryTotal++;
    // Two effective-runtime observations only, both outside all wall timers.
    // No argv, environment dump, paths, host identity or response data.
    if(row.sample===1&&phase===0||row.sample===100&&phase===1){
      runtimeTotal++;
      if(runtime.length<2)runtime.push(runtimeSample(row,phase));
    }
    if(memory.length>=200)return;
    const at=performance.now(),m=process.memoryUsage();
    memory.push([row.sample,phase,at,m.rss,m.heapTotal,m.heapUsed,m.external,m.arrayBuffers]);
  };
  const collect=entries=>{
    gcTotal+=entries.length;
    for(const entry of entries)if(gc.length<gcLimit){
      const flags=entry.detail?.flags;
      // Node22's documented GC flags. Missing/unknown bits remain unknown,
      // never zero; flags describe the collection, not a proven cause.
      gc.push([entry.startTime,entry.duration,entry.detail?.kind??0,
        Number.isInteger(flags)&&flags>=0&&flags<=126&&(flags&~126)===0?flags:null]);
    }
  };
  const observer=new PerformanceObserver(list=>collect(list.getEntries()));
  observer.observe({entryTypes:['gc']});
  let closed=false;
  return {
    begin(route,index) {
      assert.ok(routes.has(route));assert.ok(Number.isInteger(index)&&index>=0&&index<100);
      assert.ok(samples.length<sampleLimit,'Client diagnostic sample bound');
      const row={route,sample:index+1,completed:false};samples.push(row);
      rememberMemory(row,0);
      return {row,cpu:process.cpuUsage(),elu:performance.eventLoopUtilization()};
    },
    end(token,start,dispatchAt,end) {
      const cpu=process.cpuUsage(token.cpu),elu=performance.eventLoopUtilization(token.elu);
      Object.assign(token.row,{completed:true,start_ms:start,end_ms:end,full_ms:end-start,
        dispatch_ms:dispatchAt-start,consume_ms:end-dispatchAt,
        node_cpu_user_us:cpu.user,node_cpu_system_us:cpu.system,
        node_elu_active_ms:elu.active,node_elu_idle_ms:elu.idle,node_elu:elu.utilization});
      rememberMemory(token.row,1);
    },
    close(outcome) {
      if(closed)return;closed=true;
      collect(observer.takeRecords());observer.disconnect();
      assert.ok(outcome==='PASS'||outcome==='FAIL');
      let outputDropped=0;
      const emit=(type,value)=>{
        const line='C6_NODE_CLIENT_'+type+' '+JSON.stringify({suite,...value});
        if(Buffer.byteLength(line,'utf8')>lineLimit){outputDropped++;return;}
        emitDiagnostic(line);
      };
      for(const route of routes){
        const rows=samples.filter(row=>row.route===route).map(row=>columns.map(key=>
          key==='completed'?(row.completed?1:0):(row[key]??null)));
        for(let offset=0;offset<rows.length;offset+=10)emit('SAMPLES',{route,offset,rows:rows.slice(offset,offset+10)});
      }
      for(let offset=0;offset<gc.length;offset+=20)emit('GC',{offset,rows:gc.slice(offset,offset+20)});
      emit('META',{outcome,columns,gc_columns:['start_ms','duration_ms','kind','flags'],sample_limit:sampleLimit,
        attempted_samples:samples.length,completed_samples:samples.filter(row=>row.completed).length,
        gc_limit:gcLimit,gc_total:gcTotal,gc_retained:gc.length,gc_dropped:gcTotal-gc.length,
        gc_overflow:gcTotal>gcLimit,output_dropped:outputDropped,line_limit_bytes:lineLimit,
        scope:'NODE_CLIENT_ONLY_NOT_ACCEPTANCE_OR_WORKER_CPU'});
      if(suite==='capacity500'){
        let dropped=0;
        const emitMemory=(type,value)=>{
          const line='C6_NODE_MEMORY_'+type+' '+JSON.stringify({suite,...value});
          if(Buffer.byteLength(line,'utf8')>lineLimit){dropped++;return;}
          emitDiagnostic(line);
        };
        for(let offset=0;offset<memory.length;offset+=10)emitMemory('SAMPLES',{offset,rows:memory.slice(offset,offset+10)});
        emitMemory('META',{columns:memoryColumns,total:memoryTotal,retained:memory.length,
          dropped:memoryTotal-memory.length,output_dropped:dropped,
          scope:'NODE_CLIENT_MEMORY_NOT_WORKER_CAUSE_OR_ACCEPTANCE'});
        let runtimeDropped=0;
        for(const sample of runtime){
          const line='C6_NODE_RUNTIME_SAMPLE '+JSON.stringify({suite,...sample});
          if(Buffer.byteLength(line,'utf8')>lineLimit){runtimeDropped++;continue;}
          emitDiagnostic(line);
        }
        const complete=runtimeTotal===2&&runtime.length===2&&!runtimeDropped&&
          runtime[0].sample===1&&runtime[0].phase===0&&runtime[1].sample===100&&runtime[1].phase===1&&
          runtime[0].at_ms<=runtime[1].at_ms;
        emitDiagnostic('C6_NODE_RUNTIME_META '+JSON.stringify({suite,expected:2,total:runtimeTotal,retained:runtime.length,
          dropped:runtimeTotal-runtime.length,output_dropped:runtimeDropped,status:complete?'COMPLETE':runtimeTotal?'PARTIAL':'NOT_COLLECTED',
          scope:'NODE_CLIENT_RUNTIME_NOT_WORKER_CAUSE_OR_ACCEPTANCE'}));
      }
    }
  };
}
