import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import assert from "node:assert/strict";
const source = readFileSync(
  "apps-script/V3_PLATFORM_CORE_SUBSCRIPTIONS.js",
  "utf8",
);
const headers = [
  "workspace_id",
  "platform_company_id",
  "product_id",
  "status",
  "mode",
  "linked_at",
  "updated_at",
];
export function fixture() {
  const now = Date.now();
  return {
    request_id: "req_fixture",
    company_id: "com_fixture",
    product_id: "prd_fixture",
    external_company_id: "WS_FIXTURE",
    evaluated_at: new Date(now - 1000).toISOString(),
    expires_at: new Date(now + 20000).toISOString(),
    subscriptions: [
      {
        subscription_id: "sub_fixture",
        company_id: "com_fixture",
        product_id: "prd_fixture",
        plan_id: "pln_fixture",
        plan_version_id: "plv_fixture",
        status: "ACTIVE",
        starts_at: "2026-01-01T00:00:00Z",
      },
    ],
    entitlements: [
      {
        subscription_id: "sub_fixture",
        plan_id: "pln_fixture",
        definition_id: "ent_enabled",
        code: "rental.workspace.enabled",
        value_type: "BOOLEAN",
        value: true,
        source: "plan",
      },
      {
        subscription_id: "sub_fixture",
        plan_id: "pln_fixture",
        definition_id: "ent_rooms",
        code: "rental.rooms.max",
        value_type: "INTEGER",
        value: 2,
        source: "plan",
      },
    ],
  };
}
function setup({
  mode = "enforce",
  missing = false,
  props = {},
  body = fixture(),
  status = 200,
  rows,
} = {}) {
  let calls = 0;
  const properties = {
    CMWEBS_PLATFORM_CORE_ENVIRONMENT: "staging",
    CMWEBS_PLATFORM_CORE_BASE_URL: "https://core.example.test",
    CMWEBS_PLATFORM_CORE_PRODUCT_ID: "prd_fixture",
    CMWEBS_PLATFORM_CORE_SERVICE_TOKEN: "fixture_secret",
    ...props,
  };
  const sheet = {
    getDataRange: () => ({
      getValues: () => [
        headers,
        ...(rows || [
          ["WS_FIXTURE", "com_fixture", "prd_fixture", "LINKED", mode, "", ""],
        ]),
      ],
    }),
  };
  const ctx = {
    Date,
    Math,
    JSON,
    Number,
    String,
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => properties[k] }),
    },
    runtimeSpreadsheet_: () => ({
      getSheetByName: () => (missing ? null : sheet),
      insertSheet: () => {
        throw new Error("read must not write");
      },
    }),
    UrlFetchApp: {
      fetch: (url, o) => {
        calls++;
        assert.equal(o.followRedirects, false);
        assert.equal(o.headers.Authorization, "Bearer fixture_secret");
        assert.ok(url.startsWith("https://core.example.test/v1/service/"));
        return {
          getResponseCode: () => status,
          getContentText: () => JSON.stringify(body),
        };
      },
    },
    resolveLandlordPrincipal_: () => ({
      success: true,
      data: { workspace: { workspace_id: "WS_FIXTURE" } },
    }),
    workspaceLandlordCheckPolicy_: () => ({ success: true }),
    workspaceLandlordResolveAccess_: (uid) => ({
      success: true,
      workspace: { workspace_id: "WS_FIXTURE" },
      user: { user_id: "usr_fixture" },
      membership: { role: "owner", membership_id: "mem_fixture" },
      principal_line_user_id: uid,
    }),
    landlordContractSigningReviewAuthenticate_: () => ({
      success: true,
      data: { session_token: "verified" },
    }),
    verifyLandlordContractSigningReviewSessionToken_: () => ({
      success: true,
      data: {
        line_sub: "verified_uid",
        workspace_id: "WS_FIXTURE",
        user_id: "usr_fixture",
        membership_id: "mem_fixture",
      },
    }),
  };
  vm.runInNewContext(source, ctx);
  return { ctx, calls: () => calls };
}
const access = { workspace: { workspace_id: "WS_FIXTURE" } };
test("missing mapping reads as legacy without creating schema or fetching", () => {
  const s = setup({ missing: true });
  assert.equal(
    s.ctx.platformCoreGetWorkspaceAccess_(access).data.mode,
    "legacy",
  );
  assert.equal(s.calls(), 0);
});
test("valid grant stays server-side and summary omits credentials", () => {
  const s = setup();
  const r = s.ctx.platformCoreGetWorkspaceAccess_(access);
  assert.equal(r.success, true);
  assert.equal(r.data.grant.max_rooms, 2);
  assert.equal(JSON.stringify(r).includes("fixture_secret"), false);
});
test("production observe reports no subscription without inventing a room quota", () => {
  const body = fixture();
  body.subscriptions = [];
  body.entitlements = [];
  const s = setup({mode:"observe", props:{CMWEBS_PLATFORM_CORE_ENVIRONMENT:"production"}, body});
  const r = s.ctx.platformCoreGetWorkspaceAccess_(access);
  assert.equal(r.success, true);
  assert.equal(r.data.mode, "observe");
  assert.equal(r.data.grant.enabled, false);
  assert.equal(r.data.grant.max_rooms, null);
});
test("raw UID cannot authenticate; email and verified LINE derive Workspace", () => {
  const s = setup();
  assert.equal(
    s.ctx.platformCoreResolveSubscriptionPrincipal_({ line_user_id: "spoof" })
      .success,
    false,
  );
  assert.equal(
    s.ctx.platformCoreResolveSubscriptionPrincipal_({
      landlord_session_token: "fixture",
    }).success,
    true,
  );
  assert.equal(
    s.ctx.platformCoreResolveSubscriptionPrincipal_({
      id_token: "fixture",
      line_user_id: "spoof",
    }).data.principal_line_user_id,
    "verified_uid",
  );
});
for (const change of [
  (b) => (b.company_id = "com_other"),
  (b) => (b.external_company_id = "WS_OTHER"),
  (b) => b.entitlements.push(b.entitlements[0]),
  (b) => (b.entitlements[1].value = -1),
  (b) => (b.entitlements[1].value = 0.5),
  (b) => (b.subscriptions[0].status = "PAST_DUE"),
  (b) => (b.subscriptions[0].starts_at = "2099-01-01T00:00:00Z"),
  (b) => (b.expires_at = "2000-01-01T00:00:00Z"),
  (b) =>
    b.subscriptions.push({
      ...b.subscriptions[0],
      subscription_id: "sub_other",
    }),
]) {
  test(
    "malformed or unauthorized access fails closed " + change.toString(),
    () => {
      const body = fixture();
      change(body);
      assert.equal(
        setup({ body }).ctx.platformCoreGetWorkspaceAccess_(access).success,
        false,
      );
    },
  );
}
test("observe failure remains visible without enabling enforcement", () => {
  const s = setup({ mode: "observe", status: 503 });
  const r = s.ctx.platformCoreGetWorkspaceAccess_(access);
  assert.equal(r.success, false);
  assert.equal(r.data.mode, "observe");
});
test("duplicate or malformed mappings fail closed", () => {
  const row = [
    "WS_FIXTURE",
    "com_fixture",
    "prd_fixture",
    "LINKED",
    "enforce",
    "",
    "",
  ];
  assert.equal(
    setup({ rows: [row, row] }).ctx.platformCoreGetWorkspaceAccess_(access)
      .success,
    false,
  );
  assert.equal(
    setup({ mode: "typo" }).ctx.platformCoreGetWorkspaceAccess_(access).success,
    false,
  );
});
test("missing configuration, non-HTTPS and redirected responses fail closed", () => {
  for (const opts of [
    { props: { CMWEBS_PLATFORM_CORE_SERVICE_TOKEN: "" } },
    { props: { CMWEBS_PLATFORM_CORE_BASE_URL: "http://core.example.test" } },
    { status: 302 },
  ])
    assert.equal(
      setup(opts).ctx.platformCoreGetWorkspaceAccess_(access).success,
      false,
    );
});
test("override source and zero room quota are valid; expired subscription grants nothing", () => {
  const body = fixture();
  body.entitlements[1].source = "subscription_override";
  body.entitlements[1].value = 0;
  assert.equal(
    setup({ body }).ctx.platformCoreGetWorkspaceAccess_(access).data.grant
      .max_rooms,
    0,
  );
  body.subscriptions[0].status = "EXPIRED";
  body.subscriptions[0].ends_at = body.evaluated_at;
  body.entitlements = [];
  const r = setup({ body }).ctx.platformCoreGetWorkspaceAccess_(access);
  assert.equal(r.success, true);
  assert.equal(r.data.grant.enabled, false);
  assert.equal(r.data.grant.subscription.status, "EXPIRED");
});
test("provider refusal or changed membership cannot authenticate", () => {
  const s = setup();
  s.ctx.landlordContractSigningReviewAuthenticate_ = () => ({ success: false });
  assert.equal(
    s.ctx.platformCoreResolveSubscriptionPrincipal_({ id_token: "fixture" })
      .success,
    false,
  );
  const other = setup();
  other.ctx.verifyLandlordContractSigningReviewSessionToken_ = () => ({
    success: true,
    data: {
      line_sub: "verified_uid",
      workspace_id: "WS_OTHER",
      user_id: "usr_fixture",
      membership_id: "mem_fixture",
    },
  });
  assert.equal(
    other.ctx.platformCoreResolveSubscriptionPrincipal_({ id_token: "fixture" })
      .success,
    false,
  );
});
for (const environment of ["staging", "production"]) test("editor provisioning requires canonical workspace and successful audit before additive binding " + environment, () => {
  const s = setup({ missing: true, props:{CMWEBS_PLATFORM_CORE_ENVIRONMENT:environment} });
  let appended = 0,
    audits = 0;
  const ss = {
    getSheetByName: (name) => (name === "V2_workspaces" ? {} : null),
    insertSheet: () => ({ appendRow: () => appended++ }),
  };
  s.ctx.runtimeSpreadsheet_ = () => ss;
  s.ctx.workspaceGetObjectsWithRow_ = () => [{ workspace_id: "WS_FIXTURE" }];
  s.ctx.Session = {getEffectiveUser:()=>({getEmail:()=>"operator@example.test"})};
  s.ctx.LockService = {
    getScriptLock: () => ({ waitLock() {}, releaseLock() {} }),
  };
  s.ctx.workspaceRecordOperationActor_ = () => {
    audits++;
    return { success: false };
  };
  const options = {
    environment,
    workspace_id: "WS_FIXTURE",
    platform_company_id: "com_fixture",
    product_id: "prd_fixture",
    mode: "observe",
    reason: "isolated test",
  };
  assert.throws(
    () => s.ctx.provisionPlatformCoreWorkspaceLink(options),
    /AUDIT_FAILED/,
  );
  assert.equal(appended, 0);
  assert.throws(
    () => s.ctx.provisionPlatformCoreWorkspaceLink({...options, environment:environment === "production" ? "staging" : "production"}),
    /PROVISIONING_SCOPE_REQUIRED/,
  );
  s.ctx.workspaceRecordOperationActor_ = (actor, action, result, meta) => {
    audits++;
    assert.match(actor.user.name,/operator@example.test/);
    assert.equal(meta.secondary_target_id,"com_fixture");
    assert.match(meta.detail,/product=prd_fixture; mode=observe; reason=isolated test/);
    return { success: true };
  };
  assert.equal(s.ctx.provisionPlatformCoreWorkspaceLink(options).success, true);
  assert.equal(audits, 2);
  assert.equal(appended, 2);
  assert.throws(
    () =>
      s.ctx.provisionPlatformCoreWorkspaceLink({ ...options, mode: "enforce" }),
    /PROVISIONING_SCOPE_REQUIRED/,
  );
});
test("dispatcher exposes only POST summary and no mapping-write action", () => {
  const dispatcher = readFileSync("apps-script/程式碼.js", "utf8");
  assert.match(
    dispatcher,
    /v2Action === 'landlord_subscription_init'[\s\S]*?POST_REQUIRED/,
  );
  assert.match(
    dispatcher,
    /action === 'landlord_subscription_init'[\s\S]*?platformCoreResolveSubscriptionPrincipal_\(request\)/,
  );
  assert.doesNotMatch(dispatcher, /provisionPlatformCoreWorkspaceLink/);
});
