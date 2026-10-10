const COMMERCIAL_MEMBER_PROVISIONING_SHEET_ = 'V3_platform_core_member_provisioning';
const COMMERCIAL_MEMBER_PROVISIONING_HEADERS_ = ['workspace_id', 'user_id', 'status', 'idempotency_key', 'attempted_at', 'last_error_code', 'created_at', 'updated_at', 'workspace_display_name'];
function platformCoreProvisionTransport_(access, operation, payload, key) {
    if (typeof platformCoreSendVerifiedHuman_ !== 'function')
        throw new Error('CORE_NOT_CONFIGURED');
    return platformCoreSendVerifiedHuman_(access, operation, payload, key, 'PROVISION');
}
function provisionCommercialWorkspaceMember_(access, idempotencyKey) {
    if (!access || !COMMERCIAL_VERIFIED_ACCESS_.has(access))
        return commercialRegistrationResult_(false, 'AUTH_REQUIRED', '請重新登入');
    const userId = workspaceText_(access.user.user_id), workspaceId = workspaceText_(access.workspace.workspace_id), roleMap = { owner: 'owner', admin: 'admin', manager: 'manager', accountant: 'member', maintenance: 'member', viewer: 'viewer' }, role = roleMap[access.membership.role];
    if (!userId || !workspaceId || !role || access.membership.member_status !== 'active')
        return commercialRegistrationResult_(false, 'AUTH_REQUIRED', '請重新登入');
    const key = idempotencyKey || 'provision_' + landlordEmailAuthHmacHex_(userId + ':' + workspaceId, landlordEmailAuthSecret_());
    let record;
    const lock = LockService.getScriptLock();
    try {
        const sheet = commercialRegistrationSheet_(COMMERCIAL_MEMBER_PROVISIONING_SHEET_, COMMERCIAL_MEMBER_PROVISIONING_HEADERS_);
        lock.waitLock(5000);
        const storedUser = workspaceGetObjectsWithRow_(runtimeSpreadsheet_().getSheetByName('V2_users')).find(function (u) { return u.user_id === userId; });
        const storedWorkspace = workspaceGetObjectsWithRow_(runtimeSpreadsheet_().getSheetByName('V2_workspaces')).find(function (w) { return w.workspace_id === workspaceId; });
        const storedMember = workspaceGetObjectsWithRow_(runtimeSpreadsheet_().getSheetByName('V2_workspace_members')).find(function (m) { return m.workspace_id === workspaceId && m.user_id === userId; });
        if (!storedUser || !storedWorkspace || !storedMember || storedUser.account_status !== 'active' || storedWorkspace.account_status !== 'active' || storedMember.member_status !== 'active' || storedMember.role !== access.membership.role || storedUser.active_workspace_id !== workspaceId) {
            return commercialRegistrationResult_(false, 'AUTH_REQUIRED', '工作區或成員權限已變更，請重新登入');
        }
        record = workspaceGetObjectsWithRow_(sheet).find(function (r) { return r.workspace_id === workspaceId && r.user_id === userId; });
        if (record && record.status === 'READY')
            return commercialRegistrationResult_(true, 'READY', '訂閱帳號已連線', { workspace_id: workspaceId });
        const now = landlordEmailAuthNowIso_();
        if (!record) {
            workspaceAppendObject_(sheet, { workspace_id: workspaceId, user_id: userId, status: 'PROVISIONING_PENDING', idempotency_key: key, attempted_at: now, last_error_code: '', created_at: now, updated_at: now, workspace_display_name: storedWorkspace.workspace_name || workspaceId });
            record = workspaceGetObjectsWithRow_(sheet).find(function (r) { return r.workspace_id === workspaceId && r.user_id === userId; });
        }
        else {
            const name=record.workspace_display_name || storedWorkspace.workspace_name || workspaceId;
            landlordEmailAuthUpdateRow_(sheet, record, { attempted_at: now, updated_at: now, workspace_display_name: name });
            record.workspace_display_name=name;
        }
    }
    catch (_) {
        return commercialRegistrationResult_(false, 'PROVISIONING_PENDING', '訂閱帳號等待連線，請稍後重試');
    }
    finally {
        try {
            lock.releaseLock();
        }
        catch (_) { }
    }
    let result;
    try {
        result = platformCoreProvisionTransport_(access, 'provision', { workspace_display_name: record.workspace_display_name, role: role }, record.idempotency_key);
        const product = PropertiesService.getScriptProperties().getProperty('CMWEBS_PLATFORM_CORE_PRODUCT_ID');
        if (!result || result.status !== 'READY' || result.product_id !== product || result.external_workspace_id !== workspaceId || !/^com_[A-Za-z0-9_-]+$/.test(String(result.company_id || '')) || !/^usr_[A-Za-z0-9_-]+$/.test(String(result.platform_user_id || '')))
            throw new Error('Invalid provision scope');
    }
    catch (_) {
        const retryLock = LockService.getScriptLock();
        try {
            retryLock.waitLock(5000);
            landlordEmailAuthUpdateRow_(commercialRegistrationSheet_(COMMERCIAL_MEMBER_PROVISIONING_SHEET_, COMMERCIAL_MEMBER_PROVISIONING_HEADERS_), record, { last_error_code: 'PROVISIONING_PENDING', updated_at: landlordEmailAuthNowIso_() });
        }
        finally {
            try {
                retryLock.releaseLock();
            }
            catch (_) { }
        }
        return commercialRegistrationResult_(false, 'PROVISIONING_PENDING', '訂閱帳號等待連線，請稍後重試');
    }
    const completeLock = LockService.getScriptLock();
    try {
        completeLock.waitLock(5000);
        const sheet = commercialRegistrationSheet_(COMMERCIAL_MEMBER_PROVISIONING_SHEET_, COMMERCIAL_MEMBER_PROVISIONING_HEADERS_), links = commercialRegistrationSheet_(PLATFORM_CORE_LINK_SHEET_, PLATFORM_CORE_LINK_HEADERS_), link = workspaceGetObjectsWithRow_(links).find(function (r) { return r.workspace_id === workspaceId; });
        if (link && link.status === 'LINKED' && (link.platform_company_id !== result.company_id || link.product_id !== result.product_id))
            throw new Error('Existing link conflict');
        const now = landlordEmailAuthNowIso_();
        if (link)
            landlordEmailAuthUpdateRow_(links, link, { platform_company_id: result.company_id, product_id: result.product_id, status: 'LINKED', linked_at: link.linked_at || now, updated_at: now });
        else
            workspaceAppendObject_(links, { workspace_id: workspaceId, platform_company_id: result.company_id, product_id: result.product_id, status: 'LINKED', mode: 'observe', linked_at: now, updated_at: now });
        landlordEmailAuthUpdateRow_(sheet, record, { status: 'READY', last_error_code: '', updated_at: now });
        SpreadsheetApp.flush();
        return commercialRegistrationResult_(true, 'READY', '訂閱帳號已連線', { workspace_id: workspaceId });
    }
    catch (_) {
        return commercialRegistrationResult_(false, 'PROVISIONING_PENDING', '訂閱帳號等待連線，請稍後重試');
    }
    finally {
        try {
            completeLock.releaseLock();
        }
        catch (_) { }
    }
}
function retryCommercialWorkspaceProvisioning_(verifiedAccess) { return provisionCommercialWorkspaceMember_(verifiedAccess); }
