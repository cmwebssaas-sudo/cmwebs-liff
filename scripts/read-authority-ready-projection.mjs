// Build a self-contained browser callback from the already pinned legacy
// projector. Construction is local; it performs no browser or account access.
import {types} from 'node:util';
import {createHash} from 'node:crypto';
export function compileReadyAuthorityProjection(projector,expectedHash){
 const fail=()=>{throw Error('PROJECTION_SOURCE_UNVERIFIED');};
 if(typeof projector!=='function'||types.isProxy(projector)||typeof expectedHash!=='string'||!/^[a-f0-9]{64}$/.test(expectedHash))fail();
 const source=Function.prototype.toString.call(projector);
 if(source.length>32768||!/^(?:async )?function\b/.test(source)||createHash('sha256').update(source).digest('hex')!==expectedHash)fail();
 try{
  return Function('"use strict";return async function projectReadyAuthority(options){\n'+
   'let state;try{state=document.readyState;}catch{state="unknown";}\n'+
   'if(state!=="complete")return JSON.stringify({source:"rebalanced-readonly-grounding",urlMatched:false,accountVerified:false,fieldsRead:false,ready:state==="loading"?"LOADING":state==="interactive"?"INTERACTIVE":"UNKNOWN",section:"UNREAD",reason:"NOT_COMPLETE",phase:"READY",cryptoAvailable:false,encoderAvailable:false,controls:[]});\n'+
   'return ('+source+')(options);\n}')();
 }catch{fail();}
}
