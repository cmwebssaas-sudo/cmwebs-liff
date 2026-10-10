/** V3 opt-in Core boundary. Reads never create Sheets or expose credentials. */
const PLATFORM_CORE_LINK_SHEET_ = "V3_platform_core_workspace_links";
const PLATFORM_CORE_LINK_HEADERS_ = [
  "workspace_id",
  "platform_company_id",
  "product_id",
  "status",
  "mode",
  "linked_at",
  "updated_at",
];
function platformCoreText_(value) {
  return String(value === undefined || value === null ? "" : value).trim();
}
function platformCoreIdentifier_(value) {
  const text = platformCoreText_(value);
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(text)
  )
    throw new Error("INVALID_IDENTIFIER");
  return text;
}
function platformCoreRows_(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (!values.length) return [];
  const headers = values[0].map(platformCoreText_);
  if (
    PLATFORM_CORE_LINK_HEADERS_.some(function (key) {
      return (
        headers.indexOf(key) < 0 ||
        headers.indexOf(key) !== headers.lastIndexOf(key)
      );
    })
  )
    throw new Error("INVALID_MAPPING_SCHEMA");
  return values
    .slice(1)
    .filter(function (row) {
      return row.some(function (v) {
        return platformCoreText_(v);
      });
    })
    .map(function (row) {
      const o = {};
      headers.forEach(function (key, i) {
        o[key] = row[i];
      });
      return o;
    });
}
function platformCoreReadWorkspaceLink_(workspaceId) {
  workspaceId = platformCoreIdentifier_(workspaceId);
  const rows = platformCoreRows_(
    runtimeSpreadsheet_().getSheetByName(PLATFORM_CORE_LINK_SHEET_),
  );
  const matches = rows.filter(function (row) {
    return platformCoreText_(row.workspace_id) === workspaceId;
  });
  if (!matches.length) return undefined;
  if (matches.length !== 1) throw new Error("AMBIGUOUS_MAPPING");
  const row = matches[0];
  const mode = platformCoreText_(row.mode),
    status = platformCoreText_(row.status);
  if (
    ["legacy", "observe", "enforce"].indexOf(mode) < 0 ||
    ["PENDING", "LINKED", "UNLINKED"].indexOf(status) < 0
  )
    throw new Error("INVALID_MAPPING");
  const company = platformCoreIdentifier_(row.platform_company_id),
    product = platformCoreIdentifier_(row.product_id);
  if (mode !== "legacy" && status !== "LINKED")
    throw new Error("WORKSPACE_NOT_LINKED");
  return {
    workspace_id: workspaceId,
    platform_company_id: company,
    product_id: product,
    status: status,
    mode: mode,
  };
}
function platformCoreConfig_(link) {
  const p = PropertiesService.getScriptProperties();
  const environment = p.getProperty("CMWEBS_PLATFORM_CORE_ENVIRONMENT");
  const base = platformCoreText_(
    p.getProperty("CMWEBS_PLATFORM_CORE_BASE_URL"),
  );
  const product = p.getProperty("CMWEBS_PLATFORM_CORE_PRODUCT_ID");
  const token = p.getProperty("CMWEBS_PLATFORM_CORE_SERVICE_TOKEN");
  // Explicit environment only. No URL credentials, query, fragment or redirect.
  if (
    ["staging", "production"].indexOf(environment) < 0 ||
    !/^https:\/\/[A-Za-z0-9.-]+(?::443)?\/?$/.test(base) ||
    product !== link.product_id ||
    !token ||
    /[\r\n]/.test(token)
  )
    throw new Error("CORE_NOT_CONFIGURED");
  return { base: base.replace(/\/$/, ""), token: token };
}
function platformCoreInstant_(input) {
  if (
    typeof input !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(input) ||
    !Number.isFinite(Date.parse(input))
  )
    throw new Error("INVALID_TIME");
  return Date.parse(input);
}
function platformCoreValidateSnapshot_(body, link, now) {
  if (
    !body ||
    typeof body !== "object" ||
    body.company_id !== link.platform_company_id ||
    body.product_id !== link.product_id ||
    body.external_company_id !== link.workspace_id
  )
    throw new Error("SCOPE_MISMATCH");
  platformCoreIdentifier_(body.request_id);
  const evaluated = platformCoreInstant_(body.evaluated_at),
    expiry = platformCoreInstant_(body.expires_at);
  if (
    evaluated > now ||
    now - evaluated > 30000 ||
    expiry <= now ||
    expiry <= evaluated ||
    expiry > evaluated + 30000
  )
    throw new Error("STALE_GRANT");
  if (
    !Array.isArray(body.subscriptions) ||
    body.subscriptions.length > 100 ||
    !Array.isArray(body.entitlements) ||
    body.entitlements.length > 1000
  )
    throw new Error("INVALID_RESOURCES");
  const ids = Object.create(null),
    active = [];
  body.subscriptions.forEach(function (s) {
    if (
      !s ||
      s.company_id !== link.platform_company_id ||
      s.product_id !== link.product_id
    )
      throw new Error("SUBSCRIPTION_SCOPE");
    [s.subscription_id, s.plan_id, s.plan_version_id].forEach(
      platformCoreIdentifier_,
    );
    if (ids[s.subscription_id]) throw new Error("DUPLICATE_SUBSCRIPTION");
    ids[s.subscription_id] = true;
    if (
      [
        "TRIAL",
        "ACTIVE",
        "PAST_DUE",
        "SUSPENDED",
        "CANCELLED",
        "EXPIRED",
      ].indexOf(s.status) < 0
    )
      throw new Error("SUBSCRIPTION_STATUS");
    const start = platformCoreInstant_(s.starts_at),
      end =
        s.ends_at === undefined ? Infinity : platformCoreInstant_(s.ends_at);
    if (end < start || (end === start && ["CANCELLED", "EXPIRED"].indexOf(s.status) < 0)) throw new Error("INVALID_INTERVAL");
    if (
      ["TRIAL", "ACTIVE"].indexOf(s.status) >= 0 &&
      start <= evaluated &&
      evaluated < end
    ) {
      if (expiry > end) throw new Error("GRANT_OUTLIVES_SUBSCRIPTION");
      active.push(s);
    }
  });
  if (active.length > 1) throw new Error("AMBIGUOUS_SUBSCRIPTION");
  const codes = Object.create(null);
  let enabled = false,
    max = null;
  body.entitlements.forEach(function (e) {
    if (
      !e ||
      typeof e.code !== "string" ||
      codes[e.code] ||
      !active.some(function (s) {
        return (
          s.subscription_id === e.subscription_id && s.plan_id === e.plan_id
        );
      })
    )
      throw new Error("INVALID_ENTITLEMENT");
    platformCoreIdentifier_(e.definition_id);
    codes[e.code] = true;
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(e.code))
      throw new Error("INVALID_CAPABILITY");
    if (
      (e.value_type === "BOOLEAN" && typeof e.value === "boolean") ||
      (e.value_type === "INTEGER" && Number.isSafeInteger(e.value)) ||
      (e.value_type === "DECIMAL" &&
        typeof e.value === "number" &&
        Number.isFinite(e.value)) ||
      (e.value_type === "ENUM" && typeof e.value === "string")
    ) {
    } else throw new Error("INVALID_ENTITLEMENT_VALUE");
    if (["plan", "subscription_override"].indexOf(e.source) < 0)
      throw new Error("INVALID_ENTITLEMENT_SOURCE");
    if (e.code === "rental.workspace.enabled") {
      if (e.value_type !== "BOOLEAN" || typeof e.value !== "boolean")
        throw new Error("INVALID_ENABLED");
      enabled = e.value;
    }
    if (e.code === "rental.rooms.max") {
      if (
        e.value_type !== "INTEGER" ||
        typeof e.value !== "number" ||
        !Number.isSafeInteger(e.value) ||
        e.value < 0
      )
        throw new Error("INVALID_CAPACITY");
      max = e.value;
    }
  });
  return {
    workspace_id: link.workspace_id,
    company_id: link.platform_company_id,
    product_id: link.product_id,
    enabled: enabled,
    max_rooms: max,
    evaluated_at: body.evaluated_at,
    expires_at: body.expires_at,
    subscription:
      active[0] || body.subscriptions[0]
        ? {
            status: (active[0] || body.subscriptions[0]).status,
            plan_id: (active[0] || body.subscriptions[0]).plan_id,
            ends_at: (active[0] || body.subscriptions[0]).ends_at || null,
          }
        : null,
  };
}
function platformCoreGetWorkspaceAccess_(access) {
  let mode = "enforce";
  try {
    const workspaceId = platformCoreIdentifier_(
      access && access.workspace && access.workspace.workspace_id,
    );
    const link = platformCoreReadWorkspaceLink_(workspaceId);
    mode = link ? link.mode : "legacy";
    if (mode === "legacy")
      return {
        success: true,
        code: "OK",
        data: { mode: "legacy", grant: null },
      };
    const config = platformCoreConfig_(link);
    const url =
      config.base +
      "/v1/service/companies/" +
      encodeURIComponent(link.platform_company_id) +
      "/products/" +
      encodeURIComponent(link.product_id) +
      "/access";
    const response = UrlFetchApp.fetch(url, {
      method: "get",
      headers: { Authorization: "Bearer " + config.token },
      followRedirects: false,
      muteHttpExceptions: true,
    });
    if (response.getResponseCode() !== 200) throw new Error("CORE_UNAVAILABLE");
    const text = response.getContentText();
    if (text.length > 512000) throw new Error("RESPONSE_TOO_LARGE");
    const grant = platformCoreValidateSnapshot_(
      JSON.parse(text),
      link,
      Date.now(),
    );
    return { success: true, code: "OK", data: { mode: mode, grant: grant } };
  } catch (_) {
    return {
      success: false,
      code: "SUBSCRIPTION_UNAVAILABLE",
      message: "暫時無法確認訂閱，請稍後重試",
      data: { mode: mode, grant: null },
    };
  }
}
function platformCoreResolveSubscriptionPrincipal_(request) {
  request = request || {};
  if (platformCoreText_(request.landlord_session_token))
    return resolveLandlordPrincipal_(request, {
      require_onboarding: true,
      skip_schema_ensure: true,
      skip_legacy_context_creation: true,
    });
  if (
    !platformCoreText_(request.id_token) ||
    typeof landlordContractSigningReviewAuthenticate_ !== "function"
  )
    return { success: false, code: "AUTH_REQUIRED", message: "請重新登入" };
  const authenticated = landlordContractSigningReviewAuthenticate_(
    request.id_token,
  );
  if (!authenticated || !authenticated.success)
    return { success: false, code: "AUTH_REQUIRED", message: "請重新登入" };
  const verified = verifyLandlordContractSigningReviewSessionToken_(
    authenticated.data.session_token,
  );
  if (!verified || !verified.success)
    return { success: false, code: "AUTH_REQUIRED", message: "請重新登入" };
  const claims = verified.data;
  const access = workspaceLandlordResolveAccess_(claims.line_sub, {
    require_onboarding: true,
    skip_schema_ensure: true,
    skip_legacy_context_creation: true,
  });
  if (!access || !access.success) return access;
  if (
    platformCoreText_(access.workspace.workspace_id) !== claims.workspace_id ||
    platformCoreText_(access.user.user_id) !== claims.user_id ||
    platformCoreText_(access.membership.membership_id) !== claims.membership_id
  )
    return { success: false, code: "AUTH_REQUIRED", message: "登入身份已變更" };
  return { success: true, data: access };
}
function getLandlordSubscriptionInitByPrincipal_(principal) {
  if (!principal || !principal.success || !principal.data)
    return { success: false, code: "AUTH_REQUIRED", message: "請重新登入" };
  const access = principal.data;
  const permission = workspaceLandlordCheckPolicy_(access, "read");
  if (!permission || !permission.success) return permission;
  const result = platformCoreGetWorkspaceAccess_(access);
  if (!result.success) return result;
  const grant = result.data.grant;
  let used = null;
  if (typeof platformCoreCountWorkspaceRooms_ === "function")
    used = platformCoreCountWorkspaceRooms_(
      runtimeSpreadsheet_(),
      access.workspace.workspace_id,
    );
  return {
    success: true,
    code: "OK",
    data: {
      mode: result.data.mode,
      status:
        grant && grant.subscription
          ? grant.subscription.status
          : result.data.mode === "legacy"
            ? "LEGACY"
            : "NONE",
      plan_id: grant && grant.subscription ? grant.subscription.plan_id : null,
      enabled: grant ? grant.enabled : null,
      rooms_used: used,
      rooms_max: grant ? grant.max_rooms : null,
      expires_at: grant ? grant.expires_at : null,
    },
  };
}
/** Editor-only audited provisioning; deliberately no HTTP action. */
function provisionPlatformCoreWorkspaceLink(options) {
  options = options || {};
  const workspaceId = platformCoreIdentifier_(options.workspace_id),
    company = platformCoreIdentifier_(options.platform_company_id),
    product = platformCoreIdentifier_(options.product_id);
  if (
    ["staging", "production"].indexOf(options.environment) < 0 ||
    options.environment !== PropertiesService.getScriptProperties().getProperty("CMWEBS_PLATFORM_CORE_ENVIRONMENT") ||
    ["legacy", "observe"].indexOf(options.mode) < 0 ||
    !platformCoreText_(options.reason) || platformCoreText_(options.reason).length > 200
  )
    throw new Error("PROVISIONING_SCOPE_REQUIRED");
  const editorEmail = platformCoreText_(Session.getEffectiveUser().getEmail());
  if (!editorEmail) throw new Error("EDITOR_IDENTITY_REQUIRED");
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = runtimeSpreadsheet_();
    const workspaces = ss.getSheetByName("V2_workspaces");
    if (
      !workspaces ||
      !workspaceGetObjectsWithRow_(workspaces).some(function (w) {
        return platformCoreText_(w.workspace_id) === workspaceId;
      })
    )
      throw new Error("WORKSPACE_NOT_FOUND");
    let sheet = ss.getSheetByName(PLATFORM_CORE_LINK_SHEET_);
    if (
      sheet &&
      platformCoreRows_(sheet).some(function (row) {
        return platformCoreText_(row.workspace_id) === workspaceId;
      })
    )
      throw new Error("LINK_ALREADY_EXISTS");
    // Record audit before binding, fail closed if audit facility is unavailable.
    if (typeof workspaceRecordOperationActor_ !== "function")
      throw new Error("AUDIT_MODULE_REQUIRED");
    const audited = workspaceRecordOperationActor_(
      {
        workspace: { workspace_id: workspaceId },
        user: { user_id: "EDITOR", name: "editor=" + editorEmail },
        membership: { role: "editor" },
      },
      "platform_core.workspace_link.provision",
      { success: true, code: "PROVISION_REQUESTED" },
      {
        target_type: "platform_core_link",
        target_id: workspaceId,
        secondary_target_id: company,
        detail: "product=" + product + "; mode=" + options.mode + "; reason=" + platformCoreText_(options.reason),
      },
    );
    if (!audited || !audited.success) throw new Error("AUDIT_FAILED");
    if (!sheet) {
      sheet = ss.insertSheet(PLATFORM_CORE_LINK_SHEET_);
      sheet.appendRow(PLATFORM_CORE_LINK_HEADERS_);
    }
    const now = new Date();
    sheet.appendRow([
      workspaceId,
      company,
      product,
      "LINKED",
      options.mode,
      now,
      now,
    ]);
    return { success: true, code: "OK" };
  } finally {
    lock.releaseLock();
  }
}
