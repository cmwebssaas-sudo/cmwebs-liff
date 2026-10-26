// Bounded numeric/enum parsing only. Raw job logs remain authoritative.
const suites=['capacity500','small'],routes=['home','actions','revenue','tenants','rooms','arrears','properties'];
const columnsV2=['sample','full_ms','caller_d1_ms','entry_to_before_txn_ms','awaited_txn_ms','entry_to_txn_ms','json_tail_ms','status'];
const columnsV3=[...columnsV2.slice(0,-1),'txn_admission_ms','txn_queries_ms','txn_bookmark_ms','txn_completion_ms','status'];
const scope='LOCAL_INSTRUMENTED_ACTOR_WINDOWS_NOT_SQL_CPU_TRANSPORT_OR_ACCEPTANCE';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
const num=v=>Number.isFinite(v)&&v>=0;
const count=v=>Number.isSafeInteger(v)&&v>=0&&v<=1000000;
const rowValid=(r,index,version)=>{
 const status=version===3?11:7,values=r?.slice(1,status);
 return Array.isArray(r)&&r.length===status+1&&r[0]===index+1&&values.every(v=>v===null||num(v))&&
  ['OK','MISSING','INVALID'].includes(r[status])&&
  (r[status]!=='OK'||values.every(num)&&r[3]<=r[5]&&r[4]<=r[5]-r[3]+1e-6&&r[6]>=r[5]&&
   (version===2||Math.abs(r[7]+r[8]+r[9]+r[10]-r[4])<=1e-6))&&
  (r[status]!=='MISSING'||r.slice(3,status).every(v=>v===null));
};
const percentile=(rows,col)=>rows.length===100&&rows.every(r=>num(r[col]))?rows.map(r=>r[col]).sort((a,b)=>a-b)[94]:null;
export function createActorSummary(){
 const states=new Map(suites.map(suite=>[suite,{rows:new Map(routes.map(r=>[r,[]])),meta:null,invalid:0,version:null}]));let invalid=0;
 return {
  ingest(line){
   const match=/^# C6_D1_ACTOR_(SAMPLES|META) (.*)$/.exec(line);if(!match)return;
   let state;
   try{
    if(Buffer.byteLength(line.slice(2))>4096)throw Error();const v=JSON.parse(match[2]);
    state=states.get(v?.suite);if(!state)throw Error();
    if(match[1]==='SAMPLES'){
     if(!exact(v,['suite','route','offset','rows'])||!routes.includes(v.route)||!Number.isInteger(v.offset)||v.offset<0||v.offset>=100||
      !Array.isArray(v.rows)||!v.rows.length||v.rows.length>10||v.offset+v.rows.length>100||state.meta)throw Error();
     const version=v.rows[0]?.length===12?3:v.rows[0]?.length===8?2:null;
     if(!version||state.version&&state.version!==version)throw Error();
     const rows=state.rows.get(v.route);if(rows.length!==v.offset||!v.rows.every((r,i)=>rowValid(r,v.offset+i,version)))throw Error();
     state.version=version;
     rows.push(...v.rows);
    }else{
     if(!exact(v,['suite','v','outcome','columns','expected','retained','valid','invalid','dropped','output_dropped','status','scope'])||state.meta||
      ![2,3].includes(v.v)||state.version&&state.version!==v.v||!['PASS','FAIL'].includes(v.outcome)||
      JSON.stringify(v.columns)!==JSON.stringify(v.v===3?columnsV3:columnsV2)||v.expected!==700||
      !['retained','valid','invalid','dropped','output_dropped'].every(k=>count(v[k]))||v.retained>700||v.valid>v.retained||
      !['COMPLETE','PARTIAL','NOT_COLLECTED'].includes(v.status)||v.scope!==scope)throw Error();
     state.version=v.v;state.meta={v:v.v,outcome:v.outcome,retained:v.retained,valid:v.valid,invalid:v.invalid,dropped:v.dropped,output_dropped:v.output_dropped,status:v.status};
    }
   }catch{invalid++;if(state)state.invalid++;}
  },
  invalidRecords:()=>invalid,
  finish(){
   const out=[];
   for(const [suite,s]of states){
    const all=[...s.rows.values()].flat(),statusIndex=s.version===3?11:7,valid=all.filter(r=>r[statusIndex]==='OK').length,m=s.meta;
    const complete=m?.status==='COMPLETE'&&m.retained===700&&m.valid===700&&!m.invalid&&!m.dropped&&!m.output_dropped&&!s.invalid&&!invalid&&all.length===700&&valid===700;
    for(const [route,rows]of s.rows)if(rows.length){
     const slowest=rows.filter(r=>num(r[1])).slice().sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]??null;
     out.push({suite,route,samples:rows.length,status:complete?'COMPLETE':'PARTIAL',
      p95_ms:{full:percentile(rows,1),caller_d1:percentile(rows,2),
       entry_to_before_txn:rows.every(r=>r[statusIndex]==='OK')?percentile(rows,3):null,
       awaited_txn:rows.every(r=>r[statusIndex]==='OK')?percentile(rows,4):null,
       entry_to_txn:rows.every(r=>r[statusIndex]==='OK')?percentile(rows,5):null,
       json_tail:rows.every(r=>r[statusIndex]==='OK')?percentile(rows,6):null,
       ...(s.version===3?{
        txn_admission:rows.every(r=>r[statusIndex]==='OK')?percentile(rows,7):null,
        txn_queries:rows.every(r=>r[statusIndex]==='OK')?percentile(rows,8):null,
        txn_bookmark:rows.every(r=>r[statusIndex]==='OK')?percentile(rows,9):null,
        txn_completion:rows.every(r=>r[statusIndex]==='OK')?percentile(rows,10):null}: {})},paired_slowest:slowest});
    }
    out.push({suite,status:complete?'COMPLETE':all.length||m||s.invalid?'PARTIAL':'NOT_COLLECTED',outcome:m?.outcome??null,
     retained:all.length,valid,invalid:s.invalid,producer_invalid:m?.invalid??null,producer_dropped:m?.dropped??null,output_dropped:m?.output_dropped??null,metadata_consistent:!!m&&m.retained===all.length&&m.valid===valid,
     expected:700,scope});
   }
   return out;
  }
 };
}
