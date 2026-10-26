// Create in a completed local prelude cell. Observe state before opening its gate.
// After a tool interruption, await state.promise; never invoke start again.
export function createAuthorityLaunchState(){
 const state={allowed:false,started:false,promise:null,result:null,error:null,start(entry){
  if(state.allowed!==true||state.started||state.promise!==null||typeof entry?.run!=='function')throw Error('LAUNCH_STOPPED');
  state.started=true;
  state.promise=Promise.resolve().then(()=>entry.run()).then(result=>{state.result=result;return result;},error=>{state.error=error;throw error;}).finally(()=>{state.allowed=false;});
  void state.promise.catch(()=>{}); // Keep rejection observed across tool cells; retain the original promise.
  return state.promise;
 }};
 return Object.seal(state);
}
