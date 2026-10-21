// Test fixture header only; never imported by the production entry.
const entry='cmwebs_test_actor_entry_to_txn_ms',tail='cmwebs_test_actor_json_tail_ms';
export function actorTimingHeader(batches){
 const marked=batches.flatMap((batch,index)=>batch?.meta&&(Object.hasOwn(batch.meta,entry)||Object.hasOwn(batch.meta,tail))?[index]:[]);
 if(!marked.length)return null;
 const meta=batches.at(-1)?.meta,a=meta?.[entry],b=meta?.[tail];
 const valid=marked.length===1&&marked[0]===batches.length-1&&Number.isFinite(a)&&a>=0&&Number.isFinite(b)&&b>=a;
 return JSON.stringify({v:1,entry_to_txn_ms:valid?a:null,json_tail_ms:valid?b:null});
}
