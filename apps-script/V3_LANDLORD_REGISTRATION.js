/** Verified registration into the original rental Users/Workspaces. */
const COMMERCIAL_REGISTRATION_INTENT_SHEET_ = 'V3_landlord_registration_intents';
const COMMERCIAL_REGISTRATION_INTENT_HEADERS_ = ['identity_type', 'identity_key', 'input_json', 'user_id', 'workspace_id', 'landlord_id', 'membership_id', 'status', 'created_at', 'updated_at'];
const COMMERCIAL_VERIFIED_ACCESS_ = new WeakSet();
function commercialRegistrationResult_(success, code, message, data) { return workspaceResult_(success, code, message, data || null); }
function commercialRegistrationSheet_(name, headers) {
    const sheet = runtimeSpreadsheet_().getSheetByName(name);
    if (!sheet || headers.some(function (h) { return workspaceHeaderMap_(sheet)[h] === undefined; }))
        throw new Error('COMMERCIAL_SCHEMA_REQUIRED');
    return sheet;
}
/** Explicit editor migration; never called by an HTTP read. */
function initializeCommercialRentalSchema_() {
    if (!String(Session.getEffectiveUser().getEmail() || '').trim())
        throw new Error('EDITOR_IDENTITY_REQUIRED');
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
        workspaceEnsureSchema_();
        const ss = runtimeSpreadsheet_();
        workspaceEnsureSheet_(ss, COMMERCIAL_REGISTRATION_INTENT_SHEET_, COMMERCIAL_REGISTRATION_INTENT_HEADERS_);
        workspaceEnsureSheet_(ss, PLATFORM_CORE_LINK_SHEET_, PLATFORM_CORE_LINK_HEADERS_);
        workspaceEnsureSheet_(ss, COMMERCIAL_MEMBER_PROVISIONING_SHEET_, COMMERCIAL_MEMBER_PROVISIONING_HEADERS_);
        SpreadsheetApp.flush();
        return { success: true, code: 'SCHEMA_READY' };
    }
    finally {
        lock.releaseLock();
    }
}
function initializeCommercialRentalSchema() { return initializeCommercialRentalSchema_(); }
function commercialRegistrationNormalize_(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('INVALID_REGISTRATION');
    const name = workspaceText_(value.landlord_name), phone = workspaceNormalizeTaiwanPhone_(value.phone), email = landlordEmailAuthNormalizeEmail_(value.email), team = workspaceText_(value.workspace_name) || name + '的管理團隊';
    if (!name || name.length > 60 || !/^09\d{8}$/.test(phone) || !team || team.length > 80 || (workspaceText_(value.email) && !email) || value.terms_accepted !== true)
        throw new Error('INVALID_REGISTRATION');
    return { landlord_name: name, phone: phone, email: email, workspace_name: team, terms_accepted: true };
}
function requestCommercialEmailRegistration_(email, options) {
    options = options || {};
    email = landlordEmailAuthNormalizeEmail_(email);
    if (!email)
        return commercialRegistrationResult_(false, 'INVALID_EMAIL', '請輸入有效的 Email');
    let delivery, result;
    const lock = LockService.getScriptLock();
    try {
        commercialRegistrationSheet_(COMMERCIAL_REGISTRATION_INTENT_SHEET_, COMMERCIAL_REGISTRATION_INTENT_HEADERS_);
        lock.waitLock(5000);
        if (landlordEmailAuthRows_(landlordEmailAuthUserSheet_()).some(function (u) { return landlordEmailAuthNormalizeEmail_(u.email) === email; }))
            return commercialRegistrationResult_(true, 'ALREADY_REGISTERED', '此 Email 已有帳號，請回原登入頁使用 Email 或 LINE 登入', { route: 'login' });
        const registrationUser = 'reg_' + landlordEmailAuthEmailHash_(email), now = Date.parse(workspaceNowIso_());
        if (landlordEmailAuthRows_(landlordEmailAuthChallengeSheet_()).some(function (c) { return c.user_id === registrationUser && now - Date.parse(c.issued_at) < 60000; }))
            return commercialRegistrationResult_(false, 'RATE_LIMITED', '請稍候再重新寄送驗證碼');
        result = landlordEmailAuthIssueChallenge_({ user: { user_id: 'reg_' + landlordEmailAuthEmailHash_(email) }, email: email, requestId: options.request_id || '', purpose: 'registration', deferDelivery: function (to, code, purpose) { delivery = { to: to, code: code, purpose: purpose }; } });
    }
    catch (_) {
        return commercialRegistrationResult_(false, 'REGISTRATION_UNAVAILABLE', '暫時無法建立驗證，請稍後重試');
    }
    finally {
        try {
            lock.releaseLock();
        }
        catch (_) { }
    }
    if (delivery) {
        try {
            landlordEmailAuthSendOtpEmail_(delivery.to, delivery.code, delivery.purpose);
        }
        catch (_) {
            return commercialRegistrationResult_(false, 'EMAIL_DELIVERY_FAILED', '驗證信寄送失敗，請稍後重試');
        }
    }
    return result;
}
function verifyCommercialEmailRegistration_(challengeId, code, registrationInput, options) {
    options = options || {};
    let input, access;
    const lock = LockService.getScriptLock();
    try {
        input = commercialRegistrationNormalize_(registrationInput);
        if (!input.email)
            return commercialRegistrationResult_(false, 'INVALID_EMAIL', 'Email 必須完成驗證');
        commercialRegistrationSheet_(COMMERCIAL_REGISTRATION_INTENT_SHEET_, COMMERCIAL_REGISTRATION_INTENT_HEADERS_);
        lock.waitLock(5000);
        const verified = landlordEmailAuthVerifyChallenge_(challengeId, code, options.request_id || '', 'reg_' + landlordEmailAuthEmailHash_(input.email));
        if (!verified.success)
            return verified;
        if (landlordEmailAuthRows_(landlordEmailAuthUserSheet_()).some(function (u) { return landlordEmailAuthNormalizeEmail_(u.email) === input.email; }))
            return commercialRegistrationResult_(true, 'ALREADY_REGISTERED', '請回原登入頁登入', { route: 'login' });
        access = commercialRegistrationCreateLocked_('EMAIL', landlordEmailAuthEmailHash_(input.email), '', input);
    }
    catch (_) {
        return commercialRegistrationResult_(false, 'REGISTRATION_UNAVAILABLE', '帳號建立未完成，請重新驗證後重試');
    }
    finally {
        try {
            lock.releaseLock();
        }
        catch (_) { }
    }
    const session = landlordEmailAuthCreateSessionForAccess_(access.user, access, options.request_id || '');
    return commercialRegistrationFinish_(access, session.data);
}
function commercialRegistrationVerifyLineToken_(idToken) {
    const channel = PropertiesService.getScriptProperties().getProperty('CMWEBS_LINE_LOGIN_CHANNEL_ID');
    if (!channel || typeof idToken !== 'string' || !idToken || idToken.length > 8192)
        return commercialRegistrationResult_(false, 'AUTH_REQUIRED', '請先完成 LINE 登入');
    try {
        const response = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', { method: 'post', muteHttpExceptions: true, followRedirects: false, contentType: 'application/x-www-form-urlencoded', payload: { id_token: idToken, client_id: channel } });
        if (response.getResponseCode() !== 200)
            return commercialRegistrationResult_(false, 'AUTH_REQUIRED', 'LINE 驗證失敗，請重新登入');
        const claims = JSON.parse(response.getContentText()), now = Math.floor(Date.now() / 1000);
        if (claims.iss !== 'https://access.line.me' || claims.aud !== channel || !/^[A-Za-z0-9_-]{1,200}$/.test(String(claims.sub || '')) || !Number.isSafeInteger(claims.exp) || claims.exp <= now || !Number.isSafeInteger(claims.iat) || claims.iat > now + 60 || now - claims.iat > 86400)
            throw new Error('Invalid LINE claims');
        return { success: true, data: { line_user_id: claims.sub } };
    }
    catch (_) {
        return commercialRegistrationResult_(false, 'AUTH_REQUIRED', 'LINE 驗證失敗，請重新登入');
    }
}
function registerCommercialLandlordByVerifiedLine_(idToken, registrationInput, options) {
    options = options || {};
    const verified = commercialRegistrationVerifyLineToken_(idToken);
    if (!verified.success)
        return verified;
    let input, access;
    const lock = LockService.getScriptLock();
    try {
        input = commercialRegistrationNormalize_(registrationInput);
        commercialRegistrationSheet_(COMMERCIAL_REGISTRATION_INTENT_SHEET_, COMMERCIAL_REGISTRATION_INTENT_HEADERS_);
        lock.waitLock(5000);
        const existing = landlordEmailAuthRows_(landlordEmailAuthUserSheet_()).find(function (u) { return workspaceText_(u.line_user_id) === verified.data.line_user_id; });
        if (existing)
            return commercialRegistrationResult_(true, 'ALREADY_REGISTERED', '此 LINE 已有帳號，請回原登入頁', { route: 'login' });
        access = commercialRegistrationCreateLocked_('LINE', landlordEmailAuthHmacHex_('registration-line:' + verified.data.line_user_id, landlordEmailAuthSecret_()), verified.data.line_user_id, input);
    }
    catch (_) {
        return commercialRegistrationResult_(false, 'REGISTRATION_UNAVAILABLE', '帳號建立未完成，請重新登入後重試');
    }
    finally {
        try {
            lock.releaseLock();
        }
        catch (_) { }
    }
    return commercialRegistrationFinish_(access, {});
}
function commercialRegistrationCreateLocked_(type, identityKey, lineUserId, input) {
    const ss = runtimeSpreadsheet_(), intents = commercialRegistrationSheet_(COMMERCIAL_REGISTRATION_INTENT_SHEET_, COMMERCIAL_REGISTRATION_INTENT_HEADERS_), users = ss.getSheetByName('V2_users');
    const previous = workspaceGetObjectsWithRow_(intents).find(function (r) { return r.identity_type === type && r.identity_key === identityKey; });
    const now = workspaceNowIso_();
    let intent = previous;
    if (!intent) {
        if (workspaceGetObjectsWithRow_(users).some(function (u) { return workspaceNormalizeTaiwanPhone_(u.phone) === input.phone; }))
            throw new Error('Phone already registered');
        const unique = function (prefix) { return prefix + Utilities.getUuid().replace(/-/g, ''); };
        intent = { identity_type: type, identity_key: identityKey, input_json: JSON.stringify(input), user_id: unique('U'), workspace_id: unique('W'), landlord_id: unique('L'), membership_id: unique('WM'), status: 'CREATING', created_at: now, updated_at: now };
        workspaceAppendObject_(intents, intent);
        intent = workspaceGetObjectsWithRow_(intents).find(function (r) { return r.identity_type === type && r.identity_key === identityKey; });
    }
    // Keep reserved IDs and accepted terms across partial Sheet writes. New proof
    // may finish the same intent; it can never create a second Workspace.
    input = JSON.parse(intent.input_json);
    const put = function (name, idField, record) { const sheet = ss.getSheetByName(name); if (!sheet)
        throw new Error('Missing rental schema'); const row = workspaceGetObjectsWithRow_(sheet).find(function (r) { return r[idField] === record[idField]; }); if (!row)
        workspaceAppendObject_(sheet, record);
    else if (idField === 'user_id' && row.active_workspace_id !== intent.workspace_id)
        throw new Error('Registration identity conflict'); };
    const workspace = { workspace_id: intent.workspace_id, workspace_name: input.workspace_name, workspace_type: 'rental_management', account_status: 'active', onboarding_status: 'pending', created_by_user_id: intent.user_id, default_currency: 'TWD', timezone: 'Asia/Taipei', created_at: now, updated_at: now };
    const membership = Object.assign({ membership_id: intent.membership_id, workspace_id: intent.workspace_id, user_id: intent.user_id, role: 'owner', member_status: 'active', is_primary: true, joined_at: now, created_at: now, updated_at: now, display_name: input.landlord_name, line_user_id: lineUserId, phone: input.phone, email: input.email }, workspaceDefaultPermissions_('owner'));
    put('V2_workspaces', 'workspace_id', workspace);
    put('V2_workspace_members', 'membership_id', membership);
    put('V2_landlords', 'landlord_id', { landlord_id: intent.landlord_id, user_id: intent.user_id, landlord_user_id: intent.user_id, line_user_id: lineUserId, landlord_line_user_id: lineUserId, landlord_name: input.landlord_name, landlord_phone: input.phone, landlord_email: input.email, workspace_id: intent.workspace_id, account_status: 'active', onboarding_status: 'pending', created_at: now, updated_at: now });
    const product = PropertiesService.getScriptProperties().getProperty('CMWEBS_PLATFORM_CORE_PRODUCT_ID');
    if (!product)
        throw new Error('Product not configured');
    put(PLATFORM_CORE_LINK_SHEET_, 'workspace_id', { workspace_id: intent.workspace_id, platform_company_id: '', product_id: product, status: 'PROVISIONING_PENDING', mode: 'enforce', linked_at: '', updated_at: now });
    const user = { user_id: intent.user_id, role: 'landlord', name: input.landlord_name, phone: input.phone, email: input.email, line_user_id: lineUserId, account_status: 'active', active_workspace_id: intent.workspace_id, email_verified_at: type === 'EMAIL' ? now : '', email_login_enabled: type === 'EMAIL', created_at: now, updated_at: now };
    put('V2_users', 'user_id', user);
    landlordEmailAuthUpdateRow_(intents, intent, { status: 'READY', updated_at: now });
    SpreadsheetApp.flush();
    workspaceWriteActivityLog_({ workspace_id: workspace.workspace_id, user_id: user.user_id, membership_id: membership.membership_id, action: 'commercial_landlord_registered', target_type: 'workspace', target_id: workspace.workspace_id, result: 'success', detail: 'Verified ' + type + ' registration' });
    return commercialRegistrationTrustAccess_({ user: user, workspace: workspace, membership: membership });
}
function commercialRegistrationTrustAccess_(access) { if (access && access.user && access.workspace && access.membership)
    COMMERCIAL_VERIFIED_ACCESS_.add(access); return access; }
function commercialRegistrationFinish_(access, session) { const provision = provisionCommercialWorkspaceMember_(access); return commercialRegistrationResult_(true, 'REGISTERED', '帳號與工作區已建立', Object.assign({}, session, { route: 'subscription', user_id: access.user.user_id, workspace_id: access.workspace.workspace_id, workspace_name: access.workspace.workspace_name, provisioning_status: provision.success ? 'READY' : 'PROVISIONING_PENDING' })); }
