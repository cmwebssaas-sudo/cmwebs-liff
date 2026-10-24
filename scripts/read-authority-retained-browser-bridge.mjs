// Construct once in a completed local prelude. Later cells mutate this same
// sealed object; callbacks never capture reassignable outer REPL primitives.
export function createRetainedBrowserBridge(agent){
 if(typeof agent?.browsers?.get!=='function')throw Error('BRIDGE_ADMISSION_STOPPED');
 const state=Object.seal({allowed:false,attempts:0,launcher:null,outcomes:[]});
 const get=async id=>{
  const observation={attempt:++state.attempts,classification:'GATE_DENIED'};
  state.outcomes.push(observation);
  const launcher=state.launcher;
  if(id!=='6'||state.allowed!==true||!launcher||launcher.allowed!==true||launcher.started!==true||!launcher.promise||typeof launcher.promise.then!=='function')throw Error('INERT_OR_SCOPE_IO_BLOCKED');
  observation.classification='PROVIDER_PENDING';
  try{const value=await agent.browsers.get(id);observation.classification='PROVIDER_RETURNED';return value;}
  catch{observation.classification='PROVIDER_REJECTED';throw Error('BRIDGE_PROVIDER_REJECTED');}
 };
 return Object.freeze({state,api:Object.freeze({agent:Object.freeze({browsers:Object.freeze({get})})})});
}
