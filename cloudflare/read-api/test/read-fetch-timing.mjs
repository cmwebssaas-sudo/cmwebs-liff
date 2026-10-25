import assert from 'node:assert/strict';
export const fetchRoutes=['home','actions','revenue','tenants','rooms','arrears','properties'];
export const fetchColumns=['sample','start_ms','dispatch_ms','end_ms','undici_before_ms','undici_after_ms','calls','settled','errors','status'];
export const fetchScope='NODE_UNDICI_AWAIT_NOT_FETCH4_CPU_TRANSPORT_OR_ACCEPTANCE';
const num=v=>Number.isFinite(v)&&v>=0;
const count=v=>Number.isSafeInteger(v)&&v>=0&&v<=1000000;
const fetchWindowKeys='after_ms,before_ms,calls,errors,settled,status';
const exact=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===fetchWindowKeys;
export function validFetchRow(row,index){
 return Array.isArray(row)&&row.length===10&&row[0]===index+1&&row.slice(1,6).every(v=>v===null||num(v))&&
  row.slice(6,9).every(v=>v===null||count(v))&&['OK','MISSING','INVALID','INCOMPLETE'].includes(row[9])&&
  (row[9]!=='OK'||row.slice(1,6).every(num)&&row[1]<=row[4]&&row[4]<=row[5]&&row[5]<=row[2]&&row[2]<=row[3]&&row[6]===1&&row[7]===1&&row[8]===0);
}
// Called only after original body/full-wall end. Missing diagnostics never
// become zero; raw headers, arguments, payloads and errors are never retained.
export function createFetchTiming(suite,emit){
 assert(['small','capacity500'].includes(suite));assert.equal(typeof emit,'function');
 const rows=[],seen=new Set();let invalid=0,dropped=0,previous=-1,closed=false;
 return {
  record(route,index,start,dispatch,end,window){
   if(closed){invalid++;return;}
   const r=fetchRoutes.indexOf(route),position=r*100+index;
   if(r<0||!Number.isInteger(index)||index<0||index>=100||seen.has(position)){invalid++;return;}
   if(rows.length>=700){dropped++;return;}
   if(position!==previous+1)invalid++;previous=position;seen.add(position);
   const shape=exact(window);
   const values=[index+1,...[start,dispatch,end,window?.before_ms,window?.after_ms].map(v=>num(v)?v:null),
    ...[window?.calls,window?.settled,window?.errors].map(v=>count(v)?v:null)];
   let status=window===null||window===undefined?'MISSING':shape&&window.status==='INCOMPLETE'?'INCOMPLETE':'INVALID';
   if(shape&&window.status==='COMPLETE'&&validFetchRow([...values,'OK'],index))status='OK';
   rows.push({route,row:[...values,status]});
  },
  close(outcome){
   if(closed)return;closed=true;assert(['PASS','FAIL'].includes(outcome));let outputDropped=0;
   const output=(type,value)=>{
    const line='C6_NODE_FETCH_'+type+' '+JSON.stringify({suite,...value});
    if(Buffer.byteLength(line)>4096){outputDropped++;return;}emit(line);
   };
   for(const route of fetchRoutes){
    const selected=rows.filter(r=>r.route===route).map(r=>r.row);
    for(let offset=0;offset<selected.length;offset+=10)output('SAMPLES',{route,offset,rows:selected.slice(offset,offset+10)});
   }
   const valid=rows.filter(r=>r.row[9]==='OK').length;
   output('META',{v:1,outcome,columns:fetchColumns,expected:700,retained:rows.length,valid,invalid,dropped,output_dropped:outputDropped,
    status:rows.length===700&&valid===700&&!invalid&&!dropped&&!outputDropped?'COMPLETE':rows.length?'PARTIAL':'NOT_COLLECTED',scope:fetchScope});
  }
 };
}
