(function(){
'use strict';
let token='';
let config=null;
let invitationId='';
function invitationFrom(url){const parsed=new URL(url,window.location.href);const direct=parsed.searchParams.get('repair_invitation_id');if(direct)return /^[A-Za-z0-9_-]{3,100}$/.test(direct)?direct:'';const state=parsed.searchParams.get('liff.state');if(state){try{return new URL(state,parsed).searchParams.get('repair_invitation_id')||'';}catch(_){}}return '';}
function bridge(action,params){
  if(!token)return Promise.reject(new Error('請先登入 LINE。'));
  const id='vendor_repair_'+Date.now()+'_'+Math.random().toString(36).slice(2);
  const frame=document.createElement('iframe');frame.name=id;frame.hidden=true;
  const form=document.createElement('form');form.method='POST';form.action=config.apiUrl;form.target=id;form.hidden=true;
  Object.entries({...params,action,v2_action:action,response_mode:'bridge',request_id:id,business_request_id:params.request_id||'',id_token:token,invitation_id:invitationId}).forEach(([key,value])=>{const input=document.createElement('input');input.type='hidden';input.name=key;input.value=value;form.appendChild(input);});
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{clean();reject(new Error('回應逾時，請讀回確認；不要重複送出。'));},60000);
    function clean(){clearTimeout(timer);window.removeEventListener('message',receive);frame.remove();form.remove();}
    function receive(event){let allowed=false;try{const url=new URL(event.origin);allowed=url.protocol==='https:'&&(url.origin===new URL(config.apiUrl).origin||/^n-[a-z0-9-]+-script\.googleusercontent\.com$/i.test(url.hostname));}catch(_){}
      const data=event.data||{};if(!allowed||event.source!==frame.contentWindow||data.source!=='CMWEBS_APPS_SCRIPT'||data.requestId!==id)return;
      clean();if(data.payload&&data.payload.success)resolve(data.payload.data);else{const error=new Error(data.payload&&data.payload.message||'身份驗證或工作權限不足。');error.code=data.payload&&data.payload.code;reject(error);}
    }
    window.addEventListener('message',receive);document.body.appendChild(frame);document.body.appendChild(form);form.submit();
  });
}
async function start(options){config=options;invitationId=invitationFrom(window.location.href);
  const shell=document.querySelector('.app-shell');shell.innerHTML='<main class="page" style="display:block;padding:16px 12px calc(90px + env(safe-area-inset-bottom))"><h1>工作邀請與施工回報</h1><section id="vendorRepair"><p role="status">正在驗證 LINE 工作身份…</p></section></main><nav class="bottom-nav" aria-label="工作登入"><button type="button" id="vendorLogin" style="min-height:44px">登入 LINE／重新登入</button></nav>';
  const box=document.getElementById('vendorRepair');
  document.getElementById('vendorLogin').onclick=()=>{if(window.liff.isLoggedIn())window.liff.logout();window.liff.login({redirectUri:window.location.href});};
  try{
  if(!invitationId)throw Error('缺少工作邀請，請向房東取得本次邀請。');
  await window.liff.init({liffId:config.liffId});
  invitationId=invitationFrom(window.location.href)||invitationId;
  if(!window.liff.isLoggedIn()){box.textContent='請按下方「登入 LINE」開啟工作邀請。';return;}
  token=window.liff.getIDToken()||'';if(!token)throw Error('無法取得 LINE 登入驗證，請重新登入。');
  const identity=await bridge('vendor_repair_identity_init',{});
  const identityBox=document.createElement('p');identityBox.textContent='你的合作身份：'+identity.line_user_id+'（請交給房東登記，才可操作邀請）';box.before(identityBox);
  window.CMWebsRepairDispatch.mount(box,{vendor:true,invitationId,request:bridge});
}catch(error){box.textContent=error.message;}}
window.CMWebsVendorEntry={isEntry:url=>!!invitationFrom(url),start};
})();
