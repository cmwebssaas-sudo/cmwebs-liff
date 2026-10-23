import assert from 'node:assert/strict';
const routes=['home','actions','revenue','tenants','rooms','arrears','properties'];
const columns=['sample','full_ms','caller_d1_ms','entry_to_before_txn_ms','awaited_txn_ms','entry_to_txn_ms','json_tail_ms',
 'txn_admission_ms','txn_queries_ms','txn_bookmark_ms','txn_completion_ms','status'];
const numeric=v=>Number.isFinite(v)&&v>=0;
function parse(header){
 if(header===null)return {values:Array(8).fill(null),status:'MISSING'};
 try{
  if(typeof header!=='string'||header.length>512)throw Error();
  const v=JSON.parse(header);
  if(!v||Object.keys(v).sort().join(',')!==
   'awaited_txn_ms,entry_to_before_txn_ms,entry_to_txn_ms,json_tail_ms,txn_admission_ms,txn_bookmark_ms,txn_completion_ms,txn_queries_ms,v'||v.v!==3||
   ![v.entry_to_before_txn_ms,v.awaited_txn_ms,v.entry_to_txn_ms,v.json_tail_ms,
    v.txn_admission_ms,v.txn_queries_ms,v.txn_bookmark_ms,v.txn_completion_ms].every(numeric)||
   v.entry_to_before_txn_ms>v.entry_to_txn_ms||v.awaited_txn_ms>v.entry_to_txn_ms-v.entry_to_before_txn_ms+1e-6||
   v.json_tail_ms<v.entry_to_txn_ms||Math.abs(v.txn_admission_ms+v.txn_queries_ms+
    v.txn_bookmark_ms+v.txn_completion_ms-v.awaited_txn_ms)>1e-6)throw Error();
  return {values:[v.entry_to_before_txn_ms,v.awaited_txn_ms,v.entry_to_txn_ms,v.json_tail_ms,
   v.txn_admission_ms,v.txn_queries_ms,v.txn_bookmark_ms,v.txn_completion_ms],status:'OK'};
 }catch{return {values:Array(8).fill(null),status:'INVALID'};}
}
// Called after the original full-wall end. No clocks, requests, raw payloads or
// new samples; header validation/formatting never enters the measured interval.
export function createActorTiming(suite,emit){
 assert(['small','capacity500'].includes(suite));assert.equal(typeof emit,'function');
 const samples=[],seen=new Set();let invalid=0,dropped=0,closed=false,previous=-1;
 return {
  record(route,index,fullMs,d1Ms,header){
   if(closed){invalid++;return;}
   const r=routes.indexOf(route),position=r*100+index;
   if(r<0||!Number.isInteger(index)||index<0||index>=100||seen.has(position)){invalid++;return;}
   if(samples.length>=700){dropped++;return;}
   if(position!==previous+1)invalid++;previous=position;seen.add(position);
   const p=parse(header),valid=numeric(fullMs)&&numeric(d1Ms);
   samples.push({route,row:[index+1,numeric(fullMs)?fullMs:null,numeric(d1Ms)?d1Ms:null,...p.values,valid?p.status:'INVALID']});
  },
  close(outcome){
   if(closed)return;closed=true;assert(['PASS','FAIL'].includes(outcome));let outputDropped=0;
   const frame=(type,value)=>'C6_D1_ACTOR_'+type+' '+JSON.stringify({suite,...value});
   const output=line=>{if(Buffer.byteLength(line)>4096){outputDropped++;return;}emit(line);};
   for(const route of routes){
    const rows=samples.filter(s=>s.route===route).map(s=>s.row);let offset=0;
    while(offset<rows.length){
     let count=Math.min(10,rows.length-offset),line;
     while(count>0){line=frame('SAMPLES',{route,offset,rows:rows.slice(offset,offset+count)});if(Buffer.byteLength(line)<=4096)break;count--;}
     if(!count){outputDropped++;offset++;continue;}output(line);offset+=count;
    }
   }
   const ok=samples.filter(s=>s.row[11]==='OK').length;
   output(frame('META',{v:3,outcome,columns,expected:700,retained:samples.length,valid:ok,
    invalid,dropped,output_dropped:outputDropped,status:samples.length===700&&ok===700&&!invalid&&!dropped&&!outputDropped?'COMPLETE':samples.length?'PARTIAL':'NOT_COLLECTED',
    scope:'LOCAL_INSTRUMENTED_ACTOR_WINDOWS_NOT_SQL_CPU_TRANSPORT_OR_ACCEPTANCE'}));
  }
 };
}
