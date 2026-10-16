const columns=['sample','completed','start_ms','end_ms','full_ms','dispatch_ms','consume_ms',
  'node_cpu_user_us','node_cpu_system_us','node_elu_active_ms','node_elu_idle_ms','node_elu'];
const gcColumns=['start_ms','duration_ms','kind'];
const routes=['home','actions','revenue','tenants','rooms','arrears','properties'];
const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1e12;
const integer=(value,max)=>number(value)&&Number.isInteger(value)&&value<=max;
const same=(a,b)=>Array.isArray(a)&&JSON.stringify(a)===JSON.stringify(b);
const median=values=>{if(!values.length)return null;const sorted=values.slice().sort((a,b)=>a-b);
  const middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};

// Only bounded numeric observations from the synthetic Node client. Never emit
// input rows, arbitrary metadata fields, response values, URLs or identities.
export function createClientSummary(){
  const states=new Map();
  let unknownInvalid=0;
  function state(suite){
    if(!states.has(suite))states.set(suite,{rows:new Map(),gc:new Map(),invalid:0,gcInvalid:0,meta:null,metaInvalid:0});
    return states.get(suite);
  }
  function ingest(line){
    const match=/^# C6_NODE_CLIENT_(SAMPLES|GC|META) (.*)$/.exec(line);
    if(!match)return null;
    // TAP adds the fixed "# " prefix to the producer's4096-byte message.
    if(Buffer.byteLength(line.slice(2))>4096){unknownInvalid++;return null;}
    let data;try{data=JSON.parse(match[2]);}catch{unknownInvalid++;return null;}
    if(!data||!['capacity500','small'].includes(data.suite)){unknownInvalid++;return null;}
    const s=state(data.suite);
    if(match[1]==='SAMPLES'){
      if(!routes.includes(data.route)){unknownInvalid++;return null;}
      if(!integer(data.offset,90)||data.offset%10||!Array.isArray(data.rows)||data.rows.length===0||data.rows.length>10){s.invalid++;return null;}
      for(const [index,row] of data.rows.entries()){
        if(!Array.isArray(row)||row.length!==columns.length||!row.every(number)||
          row[0]!==data.offset+index+1||row[1]!==1||row[3]<row[2]||
          Math.abs(row[3]-row[2]-row[4])>0.01||Math.abs(row[5]+row[6]-row[4])>0.01||
          !integer(row[7],1e12)||!integer(row[8],1e12)||row[11]>1){
          s.invalid++;continue;
        }
        const key=data.route+'/'+row[0];
        if(s.rows.has(key)){s.invalid++;continue;}
        s.rows.set(key,{route:data.route,row:row.slice()});
      }
    }else if(match[1]==='GC'){
      if(!integer(data.offset,2047)||data.offset%20||!Array.isArray(data.rows)||data.rows.length===0||data.rows.length>20){s.gcInvalid++;return null;}
      for(const [index,row] of data.rows.entries()){
        const key=data.offset+index;
        if(key>=2048||!Array.isArray(row)||row.length!==3||!row.every(number)||!integer(row[2],32)||s.gc.has(key)){
          s.gcInvalid++;continue;
        }
        s.gc.set(key,row.slice());
      }
    }else{
      if(s.meta||!same(data.columns,columns)||!same(data.gc_columns,gcColumns)||
        !['PASS','FAIL'].includes(data.outcome)||!integer(data.attempted_samples,700)||
        !integer(data.completed_samples,700)||data.completed_samples>data.attempted_samples||
        !integer(data.gc_total,1e9)||!integer(data.gc_retained,2048)||!integer(data.gc_dropped,1e9)||
        data.gc_retained+data.gc_dropped!==data.gc_total||typeof data.gc_overflow!=='boolean'||
        !integer(data.output_dropped,1e9)){
        s.metaInvalid++;return null;
      }
      // Copy only known fields and static string/column values. Extra caller
      // fields cannot enter the retained META line or the aggregate.
      s.meta={suite:data.suite,outcome:data.outcome,columns,gc_columns:gcColumns,
        attempted_samples:data.attempted_samples,completed_samples:data.completed_samples,
        gc_total:data.gc_total,gc_retained:data.gc_retained,gc_dropped:data.gc_dropped,
        gc_overflow:data.gc_overflow,output_dropped:data.output_dropped};
      for(const [key,limit] of [['sample_limit',700],['gc_limit',2048],['line_limit_bytes',4096]]){
        if(Object.hasOwn(data,key)&&integer(data[key],limit))s.meta[key]=data[key];
      }
      s.meta.scope='NODE_CLIENT_ONLY_NOT_ACCEPTANCE_OR_WORKER_CPU';
      return '# C6_NODE_CLIENT_META '+JSON.stringify(s.meta);
    }
    return null;
  }
  function finish(){
    const results=[];
    for(const [suite,s] of states){
      const groups=routes.map(route=>({route,rows:[...s.rows.values()].filter(item=>item.route===route).map(item=>item.row)}));
      const full=groups.filter(group=>group.rows.length===100);
      const p95=group=>group.rows.map(row=>row[4]).sort((a,b)=>a-b)[94];
      const selected=full.length?full.reduce((best,group)=>p95(group)>p95(best)?group:best):
        groups.reduce((best,group)=>group.rows.length>best.rows.length?group:best,groups[3]);
      const complete=unknownInvalid===0&&selected.rows.length===100&&s.invalid===0&&s.metaInvalid===0&&s.meta&&
        s.meta.completed_samples===s.meta.attempted_samples&&s.rows.size===s.meta.completed_samples&&s.meta.output_dropped===0;
      const gcComplete=Boolean(unknownInvalid===0&&s.meta&&s.gcInvalid===0&&s.metaInvalid===0&&s.gc.size===s.meta.gc_retained&&
        s.meta.gc_dropped===0&&!s.meta.gc_overflow&&s.meta.output_dropped===0&&
        Array.from({length:s.meta.gc_retained},(_,i)=>i).every(i=>s.gc.has(i)));
      function group(rows){
        const value={count:rows.length};
        for(const [key,index] of [['median_full_ms',4],['median_dispatch_ms',5],['median_consume_ms',6],['median_node_elu_active_ms',9],['median_node_elu_idle_ms',10]])value[key]=median(rows.map(row=>row[index]));
        value.median_node_cpu_ms=median(rows.map(row=>(row[7]+row[8])/1000));
        value.samples_with_node_gc_overlap=gcComplete?rows.filter(row=>[...s.gc.values()].some(gc=>Math.min(row[3],gc[0]+gc[1])>Math.max(row[2],gc[0]))).length:null;
        return value;
      }
      const rows=selected.rows;
      results.push({suite,route:selected.route,selection:full.length?'HIGHEST_COMPLETE_P95':'NO_COMPLETE_ROUTE',
        sample_status:complete?'COMPLETE':'INCOMPLETE',samples:rows.length,collected_samples:s.rows.size,
        gc_status:gcComplete?'COMPLETE':'INCOMPLETE',invalid_records:unknownInvalid+s.invalid+s.gcInvalid+s.metaInvalid,
        over_50:complete?group(rows.filter(row=>row[4]>=50)):null,
        below_50:complete?group(rows.filter(row=>row[4]<50)):null,
        scope:'NODE_CLIENT_ONLY_NOT_WORKER_CAUSE_OR_ACCEPTANCE'});
    }
    return results;
  }
  return {ingest,finish,
    missingSuites:()=>['capacity500','small'].filter(suite=>!states.get(suite)?.meta),
    invalidRecords:()=>unknownInvalid+[...states.values()].reduce((n,s)=>n+s.invalid+s.gcInvalid+s.metaInvalid,0)};
}
