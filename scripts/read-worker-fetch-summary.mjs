import {fetchRoutes,fetchColumns,fetchScope,validFetchRow} from '../cloudflare/read-api/test/read-fetch-timing.mjs';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
const count=v=>Number.isSafeInteger(v)&&v>=0&&v<=1000000;
const p95=values=>values.length===100?values.sort((a,b)=>a-b)[94]:null;
export function createFetchSummary(){
 const states=new Map(['capacity500','small'].map(suite=>[suite,{rows:new Map(fetchRoutes.map(r=>[r,[]])),meta:null,invalid:0}]));let invalid=0;
 return {
  ingest(line){
   const match=/^# C6_NODE_FETCH_(SAMPLES|META) (.*)$/.exec(line);if(!match)return;
   let state;
   try{
    if(Buffer.byteLength(line.slice(2))>4096)throw Error();
    const value=JSON.parse(match[2]);state=states.get(value?.suite);if(!state)throw Error();
    if(match[1]==='SAMPLES'){
     if(!exact(value,['suite','route','offset','rows'])||!fetchRoutes.includes(value.route)||state.meta||
      !Number.isInteger(value.offset)||value.offset<0||value.offset>=100||!Array.isArray(value.rows)||!value.rows.length||value.rows.length>10||value.offset+value.rows.length>100)throw Error();
     const rows=state.rows.get(value.route);if(rows.length!==value.offset||!value.rows.every((r,i)=>validFetchRow(r,value.offset+i)))throw Error();
     rows.push(...value.rows);
    }else{
     if(!exact(value,['suite','v','outcome','columns','expected','retained','valid','invalid','dropped','output_dropped','status','scope'])||state.meta||value.v!==1||
      !['PASS','FAIL'].includes(value.outcome)||JSON.stringify(value.columns)!==JSON.stringify(fetchColumns)||value.expected!==700||
      !['retained','valid','invalid','dropped','output_dropped'].every(k=>count(value[k]))||value.retained>700||value.valid>value.retained||
      !['COMPLETE','PARTIAL','NOT_COLLECTED'].includes(value.status)||value.scope!==fetchScope)throw Error();
     state.meta={outcome:value.outcome,retained:value.retained,valid:value.valid,invalid:value.invalid,dropped:value.dropped,output_dropped:value.output_dropped,status:value.status};
    }
   }catch{invalid++;if(state)state.invalid++;}
  },
  invalidRecords:()=>invalid,
  finish(){
   const output=[];
   for(const [suite,state]of states){
    const all=[...state.rows.values()].flat(),valid=all.filter(r=>r[9]==='OK').length,meta=state.meta;
    const complete=meta?.status==='COMPLETE'&&meta.retained===700&&meta.valid===700&&!meta.invalid&&!meta.dropped&&!meta.output_dropped&&!state.invalid&&!invalid&&all.length===700&&valid===700;
    for(const [route,rows]of state.rows)if(rows.length){
     const validRows=rows.filter(r=>r[9]==='OK');
     const windows={full:r=>r[3]-r[1],node_before:r=>r[4]-r[1],undici_await:r=>r[5]-r[4],node_after:r=>r[2]-r[5],body:r=>r[3]-r[2]};
     output.push({suite,route,samples:rows.length,status:complete?'COMPLETE':'PARTIAL',
      p95_ms:Object.fromEntries(Object.entries(windows).map(([key,select])=>[key,p95(validRows.map(select))])),
      paired_slowest:validRows.slice().sort((a,b)=>(b[3]-b[1])-(a[3]-a[1])||a[0]-b[0])[0]??null});
    }
    output.push({suite,status:complete?'COMPLETE':all.length||meta||state.invalid?'PARTIAL':'NOT_COLLECTED',outcome:meta?.outcome??null,
     retained:all.length,valid,invalid:state.invalid,producer_invalid:meta?.invalid??null,producer_dropped:meta?.dropped??null,output_dropped:meta?.output_dropped??null,
     metadata_consistent:!!meta&&meta.retained===all.length&&meta.valid===valid,expected:700,scope:fetchScope});
   }
   return output;
  }
 };
}
