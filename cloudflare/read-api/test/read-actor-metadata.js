// Test fixture header only; never imported by the production entry.
const before='cmwebs_test_actor_entry_to_before_txn_ms',txn='cmwebs_test_actor_awaited_txn_ms',
 entry='cmwebs_test_actor_entry_to_txn_ms',tail='cmwebs_test_actor_json_tail_ms';
export function actorTimingHeader(batches){
 const marked=batches.flatMap((batch,index)=>batch?.meta&&[before,txn,entry,tail].some(key=>Object.hasOwn(batch.meta,key))?[index]:[]);
 if(!marked.length)return null;
 const meta=batches.at(-1)?.meta,p=meta?.[before],t=meta?.[txn],a=meta?.[entry],b=meta?.[tail];
 const valid=marked.length===1&&marked[0]===batches.length-1&&[p,t,a,b].every(v=>Number.isFinite(v)&&v>=0)&&
  p<=a&&t<=a-p+1e-6&&b>=a;
 return JSON.stringify({v:2,entry_to_before_txn_ms:valid?p:null,awaited_txn_ms:valid?t:null,
  entry_to_txn_ms:valid?a:null,json_tail_ms:valid?b:null});
}
