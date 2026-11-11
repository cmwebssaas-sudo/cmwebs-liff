/**
 * V3 stage 5: LINE webhooks for landlord-owned channels.
 *
 * The Worker checks LINE's signature with the channel's own secret, then
 * forwards the events here with the verified workspace_id, signed with the
 * registry secret. The existing channel's webhook keeps its own path
 * (handleLineWebhook_) and is not touched.
 */
function lineWorkerWebhookRejected_(code) {
  return { success: false, code: code || 'LINE_WEBHOOK_REJECTED', data: null };
}

function lineWorkerWebhookHandle_(request) {
  try {
    if (!request || Object.keys(request).sort().join(',') !== 'action,nonce,payload,signature,timestamp' ||
      request.action !== 'line_worker_webhook' ||
      typeof request.timestamp !== 'number' || !Number.isSafeInteger(request.timestamp) ||
      Math.abs(Date.now() - request.timestamp) > 300000 ||
      typeof request.nonce !== 'string' || !/^[0-9a-f-]{36}$/.test(request.nonce) ||
      typeof request.payload !== 'string' || request.payload.length > 1048576 ||
      typeof request.signature !== 'string' || !/^[a-f0-9]{64}$/.test(request.signature)) return lineWorkerWebhookRejected_();
    const secret = lineWorkerRouteConfig_().secret;
    if (!secret) return lineWorkerWebhookRejected_('LINE_WORKER_ROUTE_NOT_CONFIGURED');
    const mac = readAuthorizationMac_('cmwebs-line-webhook-v1',
      request.timestamp + '\n' + request.nonce + '\n' + request.payload, secret);
    if (!landlordEmailAuthConstantEquals_(request.signature, mac)) return lineWorkerWebhookRejected_();
    const payload = JSON.parse(request.payload);
    const workspaceId = String(payload && payload.workspace_id || '').trim().toUpperCase();
    if (!workspaceId || lineOwnChannelWorkspaces_().indexOf(workspaceId) < 0) {
      return lineWorkerWebhookRejected_('LINE_WEBHOOK_WORKSPACE_NOT_ENABLED');
    }
    if (!Array.isArray(payload.events)) return lineWorkerWebhookRejected_();
    const nonceKey = 'cmwebs:line-webhook:nonce:' + request.nonce;
    const cache = CacheService.getScriptCache();
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(250)) return lineWorkerWebhookRejected_('LINE_WEBHOOK_BUSY');
    try {
      if (cache.get(nonceKey)) return lineWorkerWebhookRejected_();
      cache.put(nonceKey, 'used', 600);
    } finally {
      lock.releaseLock();
    }
    const findTenant = lineWorkspaceTenantFinder_(workspaceId);
    const counts = { processed: 0, skipped: 0, errors: 0 };
    payload.events.forEach(function (event) {
      const result = processLineWebhookEvent_(event, findTenant);
      if (result && result.success === true && result.processed === true) counts.processed++;
      else if (result && result.skipped === true) counts.skipped++;
      else counts.errors++;
    });
    return { success: counts.errors === 0, code: counts.errors ? 'LINE_WEBHOOK_PARTIAL' : 'OK', data: counts };
  } catch (_) {
    return lineWorkerWebhookRejected_();
  }
}

// LINE user IDs repeat across channels under one provider, so a landlord
// channel's events only match tenants of its own Workspace.
function lineWorkspaceTenantFinder_(workspaceId) {
  return function (lineUserId) {
    const sub = String(lineUserId || '').trim();
    if (!sub) return null;
    return getSheetObjects_(V2_SHEETS.landlordTenantListView).find(function (row) {
      return String(row.tenant_line_user_id || '').trim() === sub &&
        String(row.workspace_id || '').trim().toUpperCase() === workspaceId;
    }) || null;
  };
}
