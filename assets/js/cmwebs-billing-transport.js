(function(window){
  'use strict';
  function create(options){
    const auth=options.auth;let current=null,lineReady=false;
    function error(code){const result=new Error(code||'SERVICE_UNAVAILABLE');result.code=code||'SERVICE_UNAVAILABLE';return result;}
    async function proof(){
      if(auth.getMode()==='email')return {};
      if(!lineReady){if(!window.liff)throw error('AUTHENTICATION_REQUIRED');await window.liff.init({liffId:options.liffId});if(!window.liff.isLoggedIn()){window.liff.login({redirectUri:window.location.href});throw error('AUTHENTICATION_REQUIRED');}lineReady=true;}
      const token=window.liff.getIDToken();if(!token)throw error('AUTHENTICATION_REQUIRED');return {id_token:token};
    }
    async function post(action,params){
      const result=await auth.requestProtected(action,Object.assign({},params,await proof()),{timeoutMs:60000});
      if(result&&result.code==='AUTHENTICATION_REQUIRED')auth.handleAuthFailure(Object.assign({},result,{code:'AUTH_REQUIRED'}));
      if(!result||result.success!==true)throw error(result&&result.code);
      return result.data;
    }
    async function initialize(){current=await post('commercial_billing_init',{});return current;}
    async function bound(){if(!current)await initialize();return {workspace_id:current.workspace_id,csrf_token:current.csrf_token};}
    return {
      initialize,
      async request(operation,payload,key){try{return await post('commercial_billing',Object.assign(await bound(),{operation:operation,payload_json:JSON.stringify(payload),...(key?{idempotency_key:key}:{})}));}catch(e){return {error:{code:e.code||'SERVICE_UNAVAILABLE'}};}},
      async linkLine(){if(auth.getMode()!=='email')throw error('AUTHENTICATION_REQUIRED');if(!window.liff)throw error('AUTHENTICATION_REQUIRED');await window.liff.init({liffId:options.liffId});if(!window.liff.isLoggedIn()){window.liff.login({redirectUri:window.location.href});throw error('AUTHENTICATION_REQUIRED');}return post('commercial_billing_link_line',Object.assign(await bound(),{link_confirmed:true,link_id_token:window.liff.getIDToken()}));},
      async retryProvisioning(){return post('commercial_billing_retry_provisioning',await bound());},
      async applyMode(body,key){return post('commercial_billing_workspace_mode',Object.assign(await bound(),{target_workspace_id:body.external_workspace_id,mode:body.mode,reason:body.reason,idempotency_key:key}));}
    };
  }
  window.CMWebsRentalBilling={create:create};
})(window);
