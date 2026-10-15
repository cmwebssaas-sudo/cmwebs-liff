// Fixed adapter for already-bound CUA tabs. No tab selection/navigation/identity
// attestation, budget admission, file output or acceptance proof is provided.
// Trusted orchestration calls this only inside atomic native-capture admission.
const stopped=()=>{throw Error('NATIVE_CAPTURE_STOPPED');};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const phases=['wrapper-before','wrapper-after','qualified-before','qualified-after'];
const actors=['caller','publisher'];
const timestamp=v=>Number.isSafeInteger(v)&&v>=0;
export function createAuthorityNativeProducer(input) {
  try {
    if(!exact(input,['tabs','now'])||!exact(input.tabs,actors)||typeof input.now!=='function')stopped();
    const handles={},now=input.now;
    for(const actor of actors) {
      const binding=input.tabs[actor];
      if(!exact(binding,['tab','tabId'])||!binding.tab||typeof binding.tab!=='object'||Array.isArray(binding.tab)||typeof binding.tabId!=='string'||binding.tabId.length<1||binding.tabId.length>200)stopped();
      const tab=binding.tab,tabId=binding.tabId,read=tab.getAXState;
      if(tab.id!==tabId||typeof read!=='function')stopped();
      handles[actor]=Object.freeze({tab,tabId,read});
    }
    if(handles.caller.tabId===handles.publisher.tabId||handles.caller.tab===handles.publisher.tab)stopped();
    let busy=false,stopRequested=false;const seen=new Set();
    return Object.freeze({
      status:()=>stopRequested?'stopped':busy?'reading':'ready',
      stop:()=>{stopRequested=true;return Object.freeze({stopRequested:true});},
      read:async descriptor=>{
        try {
          if(stopRequested||busy||!exact(descriptor,['requestId','actor','phase','page','url','method','disableDiffing'])||!Object.isFrozen(descriptor))stopped();
          const r={...descriptor};
          if(typeof r.requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(r.requestId)||seen.has(r.requestId)||!actors.includes(r.actor)||!phases.includes(r.phase)||!Number.isSafeInteger(r.page)||r.page<1||r.page>141||r.url!=='https://script.google.com/home/executions'||r.method!=='getAXState'||r.disableDiffing!==true)stopped();
          const handle=handles[r.actor],start=now();
          if(!timestamp(start)||handle.tab.id!==handle.tabId)stopped();
          seen.add(r.requestId);busy=true;
          // Only this documented CUA call occurs. Raw text is returned to the
          // private capture sink; default tool emission stays disabled.
          const snapshot=await handle.read.call(handle.tab,{disableDiffing:true,emit:false});
          const capturedAt=now();
          if(stopRequested||!timestamp(capturedAt)||capturedAt<start||typeof snapshot!=='string'||new TextEncoder().encode(snapshot).byteLength>4000000)stopped();
          return Object.freeze({requestId:r.requestId,source:'cua.getAXState',capturedAt,snapshot});
        } catch(_) {stopRequested=true;stopped();}
        finally {busy=false;}
      }
    });
  } catch(_) {stopped();}
}
