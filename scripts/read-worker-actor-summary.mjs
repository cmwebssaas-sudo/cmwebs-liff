// Bounded numeric/enum parsing only. Raw job logs remain authoritative.
const suites=['capacity500','small'],routes=['home','actions','revenue','tenants','rooms','arrears','properties'];
const columns=['sample','full_ms','caller_d1_ms','entry_to_txn_ms','json_tail_ms','status'];
const scope='LOCAL_INSTRUMENTED_ACTOR_WINDOWS_NOT_SQL_CPU_TRANSPORT_OR_ACCEPTANCE';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
const num=v=>Number.isFinite(v)&&v>=0;
const count=v=>Number.isSafeInteger(v)&&v>=0&&v<=1000000;
const rowValid=(r,index)=>Array.isArray(r)&&r.length===6&&r[0]===index+1&&r.slice(1,5).every(v=>v===null||num(v))&&
 ['OK','MISSING','INVALID'].includes(r[5])&&(r[5]!=='OK'||r.slice(1,5).every(num)&&r[4]>=r[3])&&
 (r[5]!=='MISSING'||r[3]===null&&r[4]===null);
const percentile=(rows,col)=>rows.length===100&&rows.every(r=>num(r[col]))?rows.map(r=>r[col]).sort((a,b)=>a-b)[94]:null;
export function createActorSummary(){
 const states=new Map(suites.map(suite=>[suite,{rows:new Map(routes.map(r=>[r,[]])),meta:null,invalid:0}]));let invalid=0;
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
     const rows=state.rows.get(v.route);if(rows.length!==v.offset||!v.rows.every((r,i)=>rowValid(r,v.offset+i)))throw Error();
     rows.push(...v.rows);
    }else{
     if(!exact(v,['suite','v','outcome','columns','expected','retained','valid','invalid','dropped','output_dropped','status','scope'])||state.meta||
      v.v!==1||!['PASS','FAIL'].includes(v.outcome)||JSON.stringify(v.columns)!==JSON.stringify(columns)||v.expected!==700||
      !['retained','valid','invalid','dropped','output_dropped'].every(k=>count(v[k]))||v.retained>700||v.valid>v.retained||
      !['COMPLETE','PARTIAL','NOT_COLLECTED'].includes(v.status)||v.scope!==scope)throw Error();
     state.meta={outcome:v.outcome,retained:v.retained,valid:v.valid,invalid:v.invalid,dropped:v.dropped,output_dropped:v.output_dropped,status:v.status};
    }
   }catch{invalid++;if(state)state.invalid++;}
  },
  invalidRecords:()=>invalid,
  finish(){
   const out=[];
   for(const [suite,s]of states){
    const all=[...s.rows.values()].flat(),valid=all.filter(r=>r[5]==='OK').length,m=s.meta;
    const complete=m?.status==='COMPLETE'&&m.retained===700&&m.valid===700&&!m.invalid&&!m.dropped&&!m.output_dropped&&!s.invalid&&!invalid&&all.length===700&&valid===700;
    for(const [route,rows]of s.rows)if(rows.length){
     const slowest=rows.filter(r=>num(r[1])).slice().sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]??null;
     out.push({suite,route,samples:rows.length,status:complete?'COMPLETE':'PARTIAL',
      p95_ms:{full:percentile(rows,1),caller_d1:percentile(rows,2),entry_to_txn:rows.every(r=>r[5]==='OK')?percentile(rows,3):null,json_tail:rows.every(r=>r[5]==='OK')?percentile(rows,4):null},paired_slowest:slowest});
    }
    out.push({suite,status:complete?'COMPLETE':all.length||m||s.invalid?'PARTIAL':'NOT_COLLECTED',outcome:m?.outcome??null,
     retained:all.length,valid,invalid:s.invalid,producer_invalid:m?.invalid??null,producer_dropped:m?.dropped??null,output_dropped:m?.output_dropped??null,metadata_consistent:!!m&&m.retained===all.length&&m.valid===valid,
     expected:700,scope});
   }
   return out;
  }
 };
}
