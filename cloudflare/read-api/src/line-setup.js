// V3 stage 6: checks and LINE settings the landlord setup wizard asks for.
// Apps Script has already checked the caller is the Workspace owner. Results
// never include secrets or tokens.
export const LIFF_ENDPOINT_BASE = 'https://cmwebssaas-sudo.github.io/cmwebs-liff/';
export const liffEndpoint = liffId => LIFF_ENDPOINT_BASE + '?cmwebs_liff=' + liffId;
const api = 'https://api.line.me';

export function stop(code, status = 400) { throw Object.assign(new Error(code), { code, status }); }

export async function call(fetcher, method, url, { token, json, form, bytes, type } = {}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  let body;
  if (json !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) { headers['content-type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }
  if (bytes) { headers['content-type'] = type; body = bytes; }
  let response;
  try { response = await fetcher(url,{ method, headers, body, redirect:'manual', signal:AbortSignal.timeout(10000) }); }
  catch { stop('LINE_UNREACHABLE',502); }
  let data = null;
  try { data = await response.json(); } catch {}
  return { status:response.status, data:data || {} };
}

// LINE Login channels issue short-lived tokens with their own ID and secret;
// the LIFF server API accepts them.
async function loginToken(fetcher, channelId, channelSecret) {
  const result = await call(fetcher,'POST',api+'/v2/oauth/accessToken',
    { form:{ grant_type:'client_credentials', client_id:channelId, client_secret:channelSecret } });
  return result.status === 200 && typeof result.data.access_token === 'string' ? result.data.access_token : '';
}

async function liffApps(fetcher, token) {
  const result = await call(fetcher,'GET',api+'/liff/v1/apps',{ token });
  if (result.status === 404) return [];
  if (result.status !== 200) stop('LINE_LIFF_UNAVAILABLE',502);
  return Array.isArray(result.data.apps) ? result.data.apps : [];
}

// Reuses a LIFF app this wizard made on the channel, so running it again never
// adds another; any other app on the channel, CMWebs's own included, is left
// alone. A new app gets the site root first, then its own ID once LINE has
// assigned it.
// On the existing CMWebs Login channel (strict) a bare-root app may be one of
// the live production apps, so only an app already at its own ?cmwebs_liff=
// endpoint is reused; anything else gets a new app.
export async function prepareLiff(input, fetcher, { strict = false } = {}) {
  const token = await loginToken(fetcher,input.line_login_channel_id,input.line_login_channel_secret);
  if (!token) stop('LINE_LOGIN_SECRET_INVALID');
  let app = (await liffApps(fetcher,token)).find(item => (!strict && item?.view?.url === LIFF_ENDPOINT_BASE) ||
    (item?.liffId && item?.view?.url === liffEndpoint(item.liffId)));
  let liffId = app?.liffId;
  if (!liffId) {
    const created = await call(fetcher,'POST',api+'/liff/v1/apps',{ token,
      json:{ view:{ type:'full', url:LIFF_ENDPOINT_BASE }, description:'CMWebs', scope:['openid','profile'] } });
    if (created.status !== 200 || typeof created.data.liffId !== 'string') stop('LINE_LIFF_CREATE_FAILED',502);
    liffId = created.data.liffId;
  }
  if (!/^\d{10}-[A-Za-z0-9]{8}$/.test(liffId) || liffId.split('-')[0] !== input.line_login_channel_id) stop('LINE_LIFF_CREATE_FAILED',502);
  if (app?.view?.url !== liffEndpoint(liffId)) {
    const updated = await call(fetcher,'PUT',api+'/liff/v1/apps/'+liffId,{ token, json:{ view:{ type:'full', url:liffEndpoint(liffId) } } });
    if (updated.status !== 200) stop('LINE_LIFF_CREATE_FAILED',502);
  }
  return { liff_id:liffId };
}

export const webhookUrl = (origin, row) => origin + '/line/webhook/' + row.webhook_key;

async function webhookEndpoint(fetcher, token) {
  const result = await call(fetcher,'GET',api+'/v2/bot/channel/webhook/endpoint',{ token });
  if (result.status === 404) return { endpoint:'', active:false };
  if (result.status !== 200) stop('LINE_TOKEN_INVALID',400);
  return { endpoint:String(result.data.endpoint || ''), active:result.data.active === true };
}

// Read-only. Records the Official Account's user ID for webhook checks.
export async function verifyChannel(db, row, secrets, origin, fetcher) {
  const checks = { token:false, login:false, liff:false, webhook:false, provider:Boolean(row.provider_checked_at) };
  const token = secrets.messaging_access_token;
  const verified = await call(fetcher,'POST',api+'/v2/oauth/verify',{ form:{ access_token:token } });
  checks.token = verified.status === 200 && String(verified.data.client_id) === row.messaging_channel_id;
  let bot = null, webhook = { endpoint:'', active:false };
  if (checks.token) {
    const info = await call(fetcher,'GET',api+'/v2/bot/info',{ token });
    if (info.status === 200 && /^U[0-9a-f]{32}$/.test(info.data.userId || '')) {
      bot = { basic_id:String(info.data.basicId || ''), display_name:String(info.data.displayName || '') };
      if (row.bot_user_id !== info.data.userId) {
        await db.prepare('UPDATE line_channels SET bot_user_id=?,updated_at=? WHERE workspace_id=?')
          .bind(info.data.userId,new Date().toISOString(),row.workspace_id).run();
      }
    } else checks.token = false;
    if (checks.token) webhook = await webhookEndpoint(fetcher,token);
  }
  const loginAccess = await loginToken(fetcher,row.line_login_channel_id,secrets.line_login_channel_secret);
  checks.login = Boolean(loginAccess);
  if (loginAccess) {
    checks.liff = (await liffApps(fetcher,loginAccess)).some(app => app?.liffId === row.liff_id && app?.view?.url === liffEndpoint(row.liff_id));
  }
  const expected = webhookUrl(origin,row);
  checks.webhook = Boolean(row.webhook_verified_at) && webhook.endpoint === expected && webhook.active;
  return { checks, bot, webhook:{ current:webhook.endpoint, active:webhook.active, expected } };
}

// Points the channel's webhook at CMWebs and asks LINE to send a test event.
// The Worker answers the test only when the signature matches the saved
// secret, so a passing test also proves the channel secret.
export async function setWebhook(db, row, secrets, input, origin, fetcher) {
  if (row.status !== 'verifying') stop('LINE_CHANNEL_INVALID_STATUS',409);
  const token = secrets.messaging_access_token;
  const expected = webhookUrl(origin,row);
  const current = await webhookEndpoint(fetcher,token);
  // The existing channel's webhook goes straight to Apps Script; never take it over.
  if (/^https:\/\/script\.google\.com\/macros\/s\//.test(current.endpoint)) stop('LINE_WEBHOOK_PROTECTED',409);
  const replacing = current.endpoint && current.endpoint !== expected;
  if (replacing && input.replace_existing !== true) stop('LINE_WEBHOOK_REPLACE_CONFIRM_REQUIRED',409);
  const previous = row.previous_webhook_endpoint || (replacing ? current.endpoint : null);
  if (current.endpoint !== expected) {
    const set = await call(fetcher,'PUT',api+'/v2/bot/channel/webhook/endpoint',{ token, json:{ endpoint:expected } });
    if (set.status !== 200) stop('LINE_WEBHOOK_SET_FAILED',502);
  }
  await db.prepare('UPDATE line_channels SET previous_webhook_endpoint=?,webhook_verified_at=NULL,updated_at=? WHERE workspace_id=?')
    .bind(previous,new Date().toISOString(),row.workspace_id).run();
  const test = await call(fetcher,'POST',api+'/v2/bot/channel/webhook/test',{ token, json:{ endpoint:expected } });
  const passed = test.status === 200 && test.data.success === true;
  if (passed) {
    await db.prepare('UPDATE line_channels SET webhook_verified_at=?,updated_at=? WHERE workspace_id=?')
      .bind(new Date().toISOString(),new Date().toISOString(),row.workspace_id).run();
  }
  return { test:{ success:passed, reason:String(test.data.reason || ''), status_code:Number(test.data.statusCode) || 0 },
    active:current.active, previous_endpoint:previous || '' };
}

// Rollback: points the OA back at the URL CMWebs replaced. With none saved,
// the landlord turns webhooks off in the LINE console instead.
export async function restoreWebhook(db, row, secrets, fetcher) {
  const previous = row.previous_webhook_endpoint || '';
  if (previous) {
    const set = await call(fetcher,'PUT',api+'/v2/bot/channel/webhook/endpoint',{ token:secrets.messaging_access_token, json:{ endpoint:previous } });
    if (set.status !== 200) stop('LINE_WEBHOOK_SET_FAILED',502);
  }
  await db.prepare('UPDATE line_channels SET webhook_verified_at=NULL,updated_at=? WHERE workspace_id=?')
    .bind(new Date().toISOString(),row.workspace_id).run();
  return { restored:Boolean(previous), endpoint:previous };
}

// Returns the LINE user ID of an ID token issued by this channel's Login channel.
export async function idTokenUser(row, idToken, fetcher) {
  if (typeof idToken !== 'string' || !idToken || idToken.length > 8192) stop('INVALID_LINE_CHANNEL');
  const claims = await call(fetcher,'POST',api+'/oauth2/v2.1/verify',{ form:{ id_token:idToken, client_id:row.line_login_channel_id } });
  const sub = claims.status === 200 && claims.data.aud === row.line_login_channel_id ? String(claims.data.sub || '') : '';
  if (!/^U[0-9a-f]{32}$/.test(sub)) stop('LINE_ID_TOKEN_INVALID',401);
  return sub;
}

// User IDs match only under one provider. If the OA can see the profile of
// the person who just logged in through this channel's LIFF, the Login channel
// and the OA share a provider (and that person has added the OA).
export async function checkProvider(db, row, secrets, input, fetcher) {
  const sub = await idTokenUser(row,input.id_token,fetcher);
  const profile = await call(fetcher,'GET',api+'/v2/bot/profile/'+sub,{ token:secrets.messaging_access_token });
  if (profile.status === 404) return { provider_match:false };
  if (profile.status !== 200) stop('LINE_UNREACHABLE',502);
  await db.prepare('UPDATE line_channels SET provider_checked_at=?,updated_at=? WHERE workspace_id=?')
    .bind(new Date().toISOString(),new Date().toISOString(),row.workspace_id).run();
  return { provider_match:true };
}

// Read-only friend and quota check before a Workspace moves onto this OA.
// The profile API answers 404 for anyone who has not added the OA. Results
// are counts; no profile field leaves this function.
export async function audienceCheck(secrets, userIds, fetcher) {
  const token = secrets.messaging_access_token;
  const counts = { friends:0, not_friends:0, unknown:0 };
  for (let start = 0; start < userIds.length; start += 10) {
    const statuses = await Promise.all(userIds.slice(start,start+10).map(id =>
      call(fetcher,'GET',api+'/v2/bot/profile/'+id,{ token }).then(result => result.status,() => 0)));
    for (const status of statuses) {
      if (status === 401) stop('LINE_TOKEN_INVALID',409);
      counts[status === 200 ? 'friends' : status === 404 ? 'not_friends' : 'unknown'] += 1;
    }
  }
  const [quota,used] = await Promise.all([call(fetcher,'GET',api+'/v2/bot/message/quota',{ token }),
    call(fetcher,'GET',api+'/v2/bot/message/quota/consumption',{ token })]);
  return { ...counts,
    quota_type:quota.status === 200 ? String(quota.data.type || '') : '',
    quota_limit:quota.status === 200 && Number.isSafeInteger(quota.data.value) ? quota.data.value : null,
    quota_used:used.status === 200 && Number.isSafeInteger(used.data.totalUsage) ? used.data.totalUsage : null };
}
