/**
 * V3 stage 6: landlord LINE setup wizard (landlord-line-setup.html).
 *
 * Only the Workspace owner can use it, and only for Workspaces listed in
 * CMWEBS_LINE_SETUP_WORKSPACES. Secrets pass straight to the Worker registry,
 * which encrypts them; nothing here stores, logs or returns them.
 */
const LINE_SETUP_ACTIONS_ = [
  'landlord_line_setup_status', 'landlord_line_setup_save', 'landlord_line_setup_verify',
  'landlord_line_setup_webhook', 'landlord_line_setup_webhook_restore', 'landlord_line_setup_provider_link', 'landlord_line_setup_activate',
  'landlord_line_setup_menu_status', 'landlord_line_setup_menu_publish', 'landlord_line_setup_menu_default',
  'landlord_line_setup_menu_restore', 'landlord_line_setup_audience', 'line_setup_provider_check', 'line_setup_menu_preview'
];
const LINE_SETUP_PALETTES_ = ['forest', 'ocean', 'terracotta', 'charcoal'];

const LINE_SETUP_MESSAGES_ = {
  LINE_SETUP_NOT_ENABLED: '這個管理團隊尚未開放設定自己的 LINE 官方帳號',
  LINE_SETUP_OWNER_REQUIRED: '只有房東本人可以設定 LINE 官方帳號',
  INVALID_LINE_SETUP: '頻道資料格式不正確，請重新複製貼上',
  LINE_CHANNEL_NOT_FOUND: '尚未儲存頻道資料',
  LINE_CHANNEL_CONFLICT: '這組頻道已被其他管理團隊使用',
  LINE_CHANNEL_INVALID_STATUS: '目前狀態不能執行這一步',
  LINE_CHANNEL_NOT_VERIFIED: '還有檢查項目沒有通過',
  LINE_LOGIN_SECRET_INVALID: 'LINE Login 頻道 ID 或 secret 不正確',
  LINE_LIFF_CREATE_FAILED: '無法在 LINE Login 頻道建立 LIFF，請稍後再試',
  LINE_LIFF_UNAVAILABLE: '暫時無法讀取 LIFF 設定，請稍後再試',
  LINE_WEBHOOK_REPLACE_CONFIRM_REQUIRED: '這個官方帳號已經設定其他 Webhook，請先確認是否取代',
  LINE_WEBHOOK_SET_FAILED: '無法設定 Webhook 網址，請稍後再試',
  LINE_TOKEN_INVALID: 'Messaging API 的 Channel access token 無效',
  LINE_ID_TOKEN_INVALID: 'LINE 登入已失效，請重新開啟連結',
  LINE_SETUP_CODE_INVALID: '連結已失效，請回到電腦重新產生',
  LINE_UNREACHABLE: '暫時連不到 LINE，請稍後再試',
  LINE_CHANNEL_RESERVED: '這是 CMWebs 原本的登入頻道，只有原本的管理團隊可以使用',
  LINE_WEBHOOK_PROTECTED: '這個官方帳號的 Webhook 正由 CMWebs 現有系統使用，不能在精靈中更換',
  LINE_RICH_MENU_NOT_PUBLISHED: '尚未發布圖文選單',
  LINE_RICH_MENU_FAILED: '圖文選單更新失敗，請稍後再試',
  LINE_RICH_MENU_IMAGE_INVALID: '選單圖片讀取失敗，請稍後再試',
  LINE_USER_NOT_FOUND: '請先把官方帳號加入好友',
  LINE_CHANNEL_UNAVAILABLE: '暫時無法處理，請稍後再試'
};

function lineSetupResult_(success, code, data) {
  return {
    success: success,
    code: code,
    message: success ? 'OK' : (LINE_SETUP_MESSAGES_[code] || LINE_SETUP_MESSAGES_.LINE_CHANNEL_UNAVAILABLE),
    data: data || null
  };
}

function lineSetupIsAction_(action) {
  return LINE_SETUP_ACTIONS_.indexOf(String(action || '')) >= 0;
}

function lineSetupWorkspaces_() {
  return String(PropertiesService.getScriptProperties().getProperty('CMWEBS_LINE_SETUP_WORKSPACES') || '')
    .split(',')
    .map(function (value) { return value.trim().toUpperCase(); })
    .filter(Boolean);
}

// Calls the Worker registry and returns { status, body } without throwing.
function lineSetupWorker_(fields) {
  try {
    const request = lineWorkerSignedRequest_('/internal/line-channels', fields);
    const response = UrlFetchApp.fetch(request.url, request);
    let body = {};
    try { body = JSON.parse(response.getContentText()) || {}; } catch (_) {}
    return { status: response.getResponseCode(), body: body };
  } catch (_) {
    return { status: 503, body: { success: false, code: 'LINE_CHANNEL_UNAVAILABLE' } };
  }
}

function lineSetupFromWorker_(answer) {
  if (answer.status === 200 && answer.body.success === true) return lineSetupResult_(true, 'OK', answer.body.data);
  return lineSetupResult_(false, String(answer.body.code || 'LINE_CHANNEL_UNAVAILABLE'));
}

function lineSetupOwner_(request) {
  const principal = resolveLandlordPrincipal_(request, { require_onboarding: true });
  if (!principal || principal.success !== true) return { denied: principal || lineRequestAuthRequired_() };
  const data = principal.data || {};
  const workspaceId = String(data.workspace_id || '').trim().toUpperCase();
  const channelDenied = lineRequestChannelDenied_(workspaceId);
  if (!workspaceId || channelDenied) return { denied: channelDenied || lineRequestAuthRequired_() };
  if (String(data.role || '').trim().toLowerCase() !== 'owner') return { denied: lineSetupResult_(false, 'LINE_SETUP_OWNER_REQUIRED') };
  if (lineSetupWorkspaces_().indexOf(workspaceId) < 0) return { denied: lineSetupResult_(false, 'LINE_SETUP_NOT_ENABLED') };
  return { access: data, workspace_id: workspaceId };
}

function lineSetupAudit_(access, action, result) {
  try {
    if (typeof workspaceRecordOperationActor_ === 'function') {
      workspaceRecordOperationActor_(access, action, { success: result.success === true, code: result.code }, {
        target_type: 'line_channel',
        target_id: access.workspace && access.workspace.workspace_id || ''
      });
    }
  } catch (_) {}
}

function lineSetupText_(value, pattern) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text.length <= 2048 && (!pattern || pattern.test(text)) ? text : '';
}

function lineSetupSave_(workspaceId, request) {
  const fields = {
    messaging_channel_id: lineSetupText_(request.messaging_channel_id, /^\d{10}$/),
    messaging_channel_secret: lineSetupText_(request.messaging_channel_secret, /^[A-Za-z0-9]+$/),
    messaging_access_token: lineSetupText_(request.messaging_access_token, /^[A-Za-z0-9+/=._-]+$/),
    line_login_channel_id: lineSetupText_(request.line_login_channel_id, /^\d{10}$/),
    line_login_channel_secret: lineSetupText_(request.line_login_channel_secret, /^[A-Za-z0-9]+$/)
  };
  if (Object.keys(fields).some(function (name) { return !fields[name]; }) ||
    fields.messaging_channel_id === fields.line_login_channel_id) return lineSetupResult_(false, 'INVALID_LINE_SETUP');
  const liff = lineSetupFromWorker_(lineSetupWorker_({
    action: 'prepare_liff',
    workspace_id: workspaceId,
    line_login_channel_id: fields.line_login_channel_id,
    line_login_channel_secret: fields.line_login_channel_secret
  }));
  if (!liff.success) return liff;
  return lineSetupFromWorker_(lineSetupWorker_({
    action: 'upsert',
    workspace_id: workspaceId,
    line_login_channel_id: fields.line_login_channel_id,
    liff_id: liff.data.liff_id,
    messaging_channel_id: fields.messaging_channel_id,
    secrets: {
      messaging_channel_secret: fields.messaging_channel_secret,
      messaging_access_token: fields.messaging_access_token,
      line_login_channel_secret: fields.line_login_channel_secret
    }
  }));
}

function lineSetupVerify_(workspaceId) {
  const current = lineSetupFromWorker_(lineSetupWorker_({ action: 'get', workspace_id: workspaceId }));
  if (!current.success) return current;
  if (current.data.status === 'draft') {
    const moved = lineSetupFromWorker_(lineSetupWorker_({ action: 'set_status', workspace_id: workspaceId, status: 'verifying' }));
    if (!moved.success) return moved;
  }
  return lineSetupFromWorker_(lineSetupWorker_({ action: 'verify', workspace_id: workspaceId }));
}

// A one-time link the landlord opens on their phone, inside their own LIFF.
function lineSetupProviderLink_(workspaceId) {
  const current = lineSetupFromWorker_(lineSetupWorker_({ action: 'get', workspace_id: workspaceId }));
  if (!current.success) return current;
  const code = Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('v3_line_setup_code:' + code, workspaceId, 600);
  return lineSetupResult_(true, 'OK', {
    url: 'https://liff.line.me/' + current.data.liff_id + '/landlord-line-setup.html?setup_code=' + code,
    expires_in: 600
  });
}

function lineSetupProviderCheck_(request) {
  const code = lineSetupText_(request.setup_code, /^[a-f0-9]{32}$/);
  const cache = CacheService.getScriptCache();
  const workspaceId = code ? cache.get('v3_line_setup_code:' + code) : '';
  if (!workspaceId) return lineSetupResult_(false, 'LINE_SETUP_CODE_INVALID');
  const idToken = lineSetupText_(request.id_token);
  if (!idToken) return lineSetupResult_(false, 'LINE_ID_TOKEN_INVALID');
  const result = lineSetupFromWorker_(lineSetupWorker_({ action: 'check_provider', workspace_id: workspaceId, id_token: idToken }));
  return result.success ? lineSetupResult_(true, 'OK', {
    provider_match: result.data.provider_match === true,
    channel_active: !!result.data.channel && result.data.channel.status === 'active'
  }) : result;
}

// The same link lets whoever opened it try a menu on their own LINE only.
function lineSetupMenuPreview_(request) {
  const code = lineSetupText_(request.setup_code, /^[a-f0-9]{32}$/);
  const workspaceId = code ? CacheService.getScriptCache().get('v3_line_setup_code:' + code) : '';
  if (!workspaceId) return lineSetupResult_(false, 'LINE_SETUP_CODE_INVALID');
  const idToken = lineSetupText_(request.id_token);
  const menu = String(request.menu || '');
  if (!idToken || ['landlord', 'tenant', 'none'].indexOf(menu) < 0) return lineSetupResult_(false, 'INVALID_LINE_SETUP');
  return lineSetupFromWorker_(lineSetupWorker_({ action: 'preview_menu', workspace_id: workspaceId, id_token: idToken, menu: menu }));
}

// Landlords and team members who open their landlord's own LIFF get the
// landlord menu; anyone else who opens a landlord page there loses it. Runs
// once per person every six hours. On the existing channel only the people of
// the Workspace that took it as its own (修改單 D) get the menu; nobody else
// on that channel is touched.
function lineMenuSyncLandlord_(lineUserId) {
  try {
    const scope = lineRequestChannelScope_();
    if (!scope) return;
    const viaExisting = !scope.workspace_id;
    const workspaceId = scope.workspace_id || lineLegacyHomeWorkspace_();
    const sub = String(lineUserId || '').trim();
    if (!workspaceId || !/^U[0-9a-f]{32}$/.test(sub)) return;
    const cache = CacheService.getScriptCache();
    const key = 'v3_line_menu:' + workspaceId + ':' + sub;
    if (cache.get(key)) return;
    const access = workspaceLandlordResolveAccess_(sub, { skip_schema_ensure: true, skip_legacy_context_creation: true });
    const member = !!access && access.success === true && access.workspace &&
      String(access.workspace.workspace_id || '').trim().toUpperCase() === workspaceId;
    if (viaExisting && !member) {
      cache.put(key, 'other', 21600);
      return;
    }
    const answer = lineSetupWorker_({ action: 'link_menu', workspace_id: workspaceId, line_user_id: sub, menu: member ? 'landlord' : 'none' });
    // Failures (not published, not a friend, LINE or Worker down) wait ten
    // minutes, so a landlord page never pays for the same failed call twice.
    if (answer.status === 200) cache.put(key, member ? 'landlord' : 'none', 21600);
    else cache.put(key, answer.body.code === 'LINE_RICH_MENU_NOT_PUBLISHED' ? 'unpublished' : 'failed', 600);
  } catch (_) {}
}

// Read-only check before a Workspace moves onto its own OA (修改單 D): how
// many bound tenants and team members are friends of the new OA, how many
// tenant LINE accounts are also bound in another Workspace, and the OA's
// monthly quota. Counts only; no LINE ID or name leaves this function.
// legacyRows: the Workspace registered the existing CMWebs Login channel
// (修改單 D), so tenant rows without workspace_id are its own.
function lineSetupAudienceIds_(workspaceId, legacyRows) {
  const lineOf = function (row) {
    return ['tenant_line_user_id', 'line_user_id', 'tenant_line_uid'].map(function (name) {
      return String(row[name] || '').trim();
    }).filter(function (value) { return /^U[0-9a-f]{32}$/.test(value); });
  };
  const inWorkspace = function (row) {
    const id = String(row.workspace_id || '').trim().toUpperCase();
    return id === workspaceId || (!id && !!legacyRows);
  };
  // Current tenants, read the same way tenant binding does; people who moved
  // out are counted apart and never checked.
  const current = function (row) {
    const status = String(row.account_status || row.tenant_account_status || row.status || 'active').trim().toLowerCase();
    return ['active', 'enabled', 'valid', 'current', '啟用', '有效'].indexOf(status) >= 0;
  };
  const tenants = {}, former = {}, elsewhere = {};
  getSheetObjects_(V2_SHEETS.tenants).forEach(function (row) {
    lineOf(row).forEach(function (id) { (!inWorkspace(row) ? elsewhere : current(row) ? tenants : former)[id] = true; });
  });
  const userLine = {};
  getSheetObjects_('V2_users').forEach(function (user) {
    const id = String(user.line_user_id || '').trim();
    if (/^U[0-9a-f]{32}$/.test(id)) userLine[String(user.user_id || '').trim()] = id;
  });
  const team = {};
  getSheetObjects_('V2_workspace_members').forEach(function (member) {
    const status = String(member.member_status || member.status || 'active').trim().toLowerCase();
    const id = userLine[String(member.user_id || '').trim()];
    if (inWorkspace(member) && status === 'active' && id) team[id] = true;
  });
  const tenantIds = Object.keys(tenants);
  return {
    tenants: tenantIds,
    former: Object.keys(former).filter(function (id) { return !tenants[id]; }).length,
    team: Object.keys(team),
    shared: tenantIds.filter(function (id) { return elsewhere[id]; }).length
  };
}

function lineSetupAudience_(workspaceId) {
  const current = lineSetupFromWorker_(lineSetupWorker_({ action: 'get', workspace_id: workspaceId }));
  if (!current.success) return current;
  const legacyChannelId = PropertiesService.getScriptProperties().getProperty('CMWEBS_LINE_LOGIN_CHANNEL_ID');
  const ids = lineSetupAudienceIds_(workspaceId, !!legacyChannelId && current.data.line_login_channel_id === legacyChannelId);
  const result = { tenants: { total: ids.tenants.length, friends: 0, not_friends: 0, unknown: 0 },
    team: { total: ids.team.length, friends: 0, not_friends: 0, unknown: 0 },
    former_tenants: ids.former, shared_with_other_workspaces: ids.shared, quota_type: '', quota_limit: null, quota_used: null };
  // Batches of 40; one empty batch still reads the quota.
  const batches = [];
  [['tenants', ids.tenants], ['team', ids.team]].forEach(function (group) {
    for (let start = 0; start < group[1].length; start += 40) batches.push([group[0], group[1].slice(start, start + 40)]);
  });
  if (!batches.length) batches.push(['tenants', []]);
  for (let i = 0; i < batches.length; i++) {
    const answer = lineSetupFromWorker_(lineSetupWorker_({
      action: 'audience_check', workspace_id: workspaceId, line_user_ids: batches[i][1]
    }));
    if (!answer.success) return answer;
    ['friends', 'not_friends', 'unknown'].forEach(function (name) { result[batches[i][0]][name] += answer.data[name]; });
    result.quota_type = answer.data.quota_type;
    result.quota_limit = answer.data.quota_limit;
    result.quota_used = answer.data.quota_used;
  }
  return lineSetupResult_(true, 'OK', result);
}

function lineSetupActivate_(workspaceId) {
  const result = lineSetupFromWorker_(lineSetupWorker_({ action: 'set_status', workspace_id: workspaceId, status: 'active' }));
  if (result.success) {
    const cache = CacheService.getScriptCache();
    cache.remove('v3_line_login_channel:' + result.data.line_login_channel_id);
    cache.remove('v3_line_workspace_liff:' + workspaceId);
    cache.remove('v3_line_legacy_home');
  }
  return result;
}

function lineSetupHandle_(action, request) {
  try {
    if (action === 'line_setup_provider_check') return lineSetupProviderCheck_(request || {});
    if (action === 'line_setup_menu_preview') return lineSetupMenuPreview_(request || {});
    const owner = lineSetupOwner_(request || {});
    if (owner.denied) return owner.denied;
    let result;
    if (action === 'landlord_line_setup_status') {
      const answer = lineSetupWorker_({ action: 'get', workspace_id: owner.workspace_id });
      return answer.status === 404 ? lineSetupResult_(true, 'OK', null) : lineSetupFromWorker_(answer);
    }
    if (action === 'landlord_line_setup_save') result = lineSetupSave_(owner.workspace_id, request);
    else if (action === 'landlord_line_setup_verify') return lineSetupVerify_(owner.workspace_id);
    else if (action === 'landlord_line_setup_webhook') {
      result = lineSetupFromWorker_(lineSetupWorker_({
        action: 'set_webhook', workspace_id: owner.workspace_id, replace_existing: String(request.replace_existing) === 'true'
      }));
    } else if (action === 'landlord_line_setup_webhook_restore') {
      result = lineSetupFromWorker_(lineSetupWorker_({ action: 'restore_webhook', workspace_id: owner.workspace_id }));
    } else if (action === 'landlord_line_setup_provider_link') return lineSetupProviderLink_(owner.workspace_id);
    else if (action === 'landlord_line_setup_activate') result = lineSetupActivate_(owner.workspace_id);
    else if (action === 'landlord_line_setup_menu_status') {
      return lineSetupFromWorker_(lineSetupWorker_({ action: 'menu_status', workspace_id: owner.workspace_id }));
    } else if (action === 'landlord_line_setup_menu_publish') {
      const palette = String(request.palette || '');
      if (LINE_SETUP_PALETTES_.indexOf(palette) < 0) return lineSetupResult_(false, 'INVALID_LINE_SETUP');
      result = lineSetupFromWorker_(lineSetupWorker_({ action: 'publish_menus', workspace_id: owner.workspace_id, palette: palette }));
    } else if (action === 'landlord_line_setup_menu_default') {
      result = lineSetupFromWorker_(lineSetupWorker_({
        action: 'set_default_menu', workspace_id: owner.workspace_id, enabled: String(request.enabled) === 'true'
      }));
    } else if (action === 'landlord_line_setup_audience') {
      return lineSetupAudience_(owner.workspace_id);
    } else if (action === 'landlord_line_setup_menu_restore') {
      result = lineSetupFromWorker_(lineSetupWorker_({ action: 'restore_menus', workspace_id: owner.workspace_id }));
    }
    else return lineSetupResult_(false, 'INVALID_LINE_SETUP');
    lineSetupAudit_(owner.access, action, result);
    return result;
  } catch (_) {
    return lineSetupResult_(false, 'LINE_CHANNEL_UNAVAILABLE');
  }
}
