const encoder=new TextEncoder();
const hex=buffer=>[...new Uint8Array(buffer)].map(value=>value.toString(16).padStart(2,'0')).join('');
function deny(code='AUTH_REQUIRED'){throw Object.assign(new Error(code),{code});}
export function readCredential(request) {
  const match=(request.headers.get('authorization')||'').match(/^(LIFF|Session) ([^\s]{1,8192})$/i);
  if(!match) deny();
  return {kind:match[1].toLowerCase(),token:match[2]};
}
export async function emailSessionHash(token,secret) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,encoder.encode('session:'+String(token).trim())));
}

export function createIdentityAuthenticator(options={}) {
  const cache=new Map(),clock=options.now||Date.now,fetcher=options.fetch||fetch;
  return async function authenticate(request,env,requestOptions={}) {
    const credential=readCredential(request),token=credential.token;
    let now=clock();
    if(credential.kind==='liff') {
      const channel=env.LINE_LOGIN_CHANNEL_ID;
      if(typeof channel!=='string'||!channel.trim()) deny('AUTH_UNAVAILABLE');
      const digest=hex(await crypto.subtle.digest('SHA-256',encoder.encode(token)));
      const key=channel+':'+digest;
      let entry=cache.get(key);
      if(entry?.expires<=now){cache.delete(key);entry=null;}
      if(!entry) {
        let response,claims;
        try {
          response=await fetcher('https://api.line.me/oauth2/v2.1/verify',{
            method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
            body:new URLSearchParams({id_token:token,client_id:channel}).toString(),
            // workerd rejects redirect:error. Manual plus the exact 200 check
            // below refuses redirects without forwarding the ID token.
            redirect:'manual',signal:AbortSignal.timeout(1500)
          });
          if(response.status!==200) deny();
          claims=await response.json();
        } catch(error) {deny(error.code==='AUTH_REQUIRED'?'AUTH_REQUIRED':'AUTH_UNAVAILABLE');}
        now=clock();
        if(!claims||claims.iss!=='https://access.line.me'||claims.aud!==channel||
          !Number.isSafeInteger(claims.exp)||!Number.isFinite(claims.exp*1000)||claims.exp*1000<=now||
          typeof claims.sub!=='string'||!claims.sub||claims.sub.trim()!==claims.sub||claims.sub.length>128) deny();
        entry={identity:{kind:'line',line_user_id:claims.sub},expires:Math.min(now+300000,claims.exp*1000)};
        if(cache.size>=256) cache.delete(cache.keys().next().value);
        cache.set(key,entry);
      }
      return {...entry.identity};
    }
    const secret=env.EMAIL_SESSION_HMAC_SECRET;
    const findSession=requestOptions.findSession||options.findSession;
    if(typeof secret!=='string'||secret.length<16||typeof findSession!=='function') deny('AUTH_UNAVAILABLE');
    let session;
    try{session=await findSession(await emailSessionHash(token,secret));}
    catch{deny('AUTH_UNAVAILABLE');}
    if(!session||Array.isArray(session)||!session.user_id||!session.workspace_id||!session.role) deny();
    if(String(session.status).trim().toLowerCase()!=='active'||String(session.revoked_at||'').trim()) deny('SESSION_REVOKED');
    now=clock();
    const expires=Date.parse(session.expires_at);
    if(!Number.isFinite(expires)||expires<=now) deny('SESSION_EXPIRED');
    return {kind:'email',user_id:String(session.user_id),session:{...session}};
  };
}
