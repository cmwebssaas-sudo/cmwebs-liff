// Test fixture header only; never imported by the production entry.
const before='cmwebs_test_actor_entry_to_before_txn_ms',txn='cmwebs_test_actor_awaited_txn_ms',
 entry='cmwebs_test_actor_entry_to_txn_ms',tail='cmwebs_test_actor_json_tail_ms';
const phases=['cmwebs_test_actor_txn_admission_ms','cmwebs_test_actor_txn_queries_ms',
 'cmwebs_test_actor_txn_bookmark_ms','cmwebs_test_actor_txn_completion_ms'];
export function actorTimingHeader(batches){
 const marked=batches.flatMap((batch,index)=>batch?.meta&&[before,txn,entry,tail,...phases].some(key=>Object.hasOwn(batch.meta,key))?[index]:[]);
 if(!marked.length)return null;
 const meta=batches.at(-1)?.meta,p=meta?.[before],t=meta?.[txn],a=meta?.[entry],b=meta?.[tail];
 const valid=marked.length===1&&marked[0]===batches.length-1&&[p,t,a,b].every(v=>Number.isFinite(v)&&v>=0)&&
  p<=a&&t<=a-p+1e-6&&b>=a;
 if(phases.some(key=>Object.hasOwn(meta??{},key))){
  const values=phases.map(key=>meta?.[key]);
  const complete=valid&&values.every(v=>Number.isFinite(v)&&v>=0)&&
   Math.abs(values.reduce((sum,v)=>sum+v,0)-t)<=1e-6;
  return JSON.stringify({v:3,entry_to_before_txn_ms:complete?p:null,awaited_txn_ms:complete?t:null,
   entry_to_txn_ms:complete?a:null,json_tail_ms:complete?b:null,
   txn_admission_ms:complete?values[0]:null,txn_queries_ms:complete?values[1]:null,
   txn_bookmark_ms:complete?values[2]:null,txn_completion_ms:complete?values[3]:null});
 }
 return JSON.stringify({v:2,entry_to_before_txn_ms:valid?p:null,awaited_txn_ms:valid?t:null,
  entry_to_txn_ms:valid?a:null,json_tail_ms:valid?b:null});
}
