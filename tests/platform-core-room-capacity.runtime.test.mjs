import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import assert from "node:assert/strict";
const source = readFileSync(
  "apps-script/V3_PLATFORM_CORE_ROOM_CAPACITY.js",
  "utf8",
);
const access = { workspace: { workspace_id: "WS_A" } };
function setup(mode = "enforce") {
  let rows = [
    { workspace_id: "WS_A", room_id: "R1", account_status: "active" },
  ];
  let now = Date.now();
  const grant = {
    workspace_id: "WS_A",
    company_id: "com_a",
    product_id: "prd_a",
    enabled: true,
    max_rooms: 2,
    expires_at: new Date(now + 20000).toISOString(),
  };
  const ctx = {
    Date,
    Number,
    String,
    platformCoreText_: (v) => String(v || "").trim(),
    platformCoreReadWorkspaceLink_: () => ({
      workspace_id: "WS_A",
      mode,
      status: "LINKED",
      platform_company_id: "com_a",
      product_id: "prd_a",
    }),
    platformCoreGetWorkspaceAccess_: () => ({
      success: true,
      data: { mode, grant },
    }),
    workspaceGetObjectsWithRow_: () => rows,
  };
  vm.runInNewContext(source, ctx);
  return { ctx, grant, rows, ss: { getSheetByName: () => ({}) } };
}
test("counts whole canonical workspace including blank status, ignoring tenant occupancy and restricted views", () => {
  const s = setup();
  assert.equal(
    s.ctx.platformCoreCountActiveRooms_(
      [
        { workspace_id: "WS_A", account_status: "" },
        {
          workspace_id: "WS_A",
          account_status: "active",
          room_status: "occupied",
        },
        { workspace_id: "WS_A", account_status: "inactive" },
        { workspace_id: "WS_A", account_status: "archived" },
        { workspace_id: "WS_B", account_status: "active" },
      ],
      "WS_A",
    ),
    2,
  );
});
test("two contenders for final slot cannot both grow", () => {
  const s = setup();
  const p = s.ctx.platformCorePrepareRoomGrowth_(access);
  assert.equal(
    s.ctx.platformCoreAssertRoomGrowth_(s.ss, access, p, 1).success,
    true,
  );
  s.rows.push({
    workspace_id: "WS_A",
    room_id: "R2",
    account_status: "active",
  });
  assert.equal(
    s.ctx.platformCoreAssertRoomGrowth_(s.ss, access, p, 1).code,
    "ROOM_CAPACITY_REACHED",
  );
});
test("denied, zero quota and lock-wait expiry fail closed; existing edit stays available", () => {
  for (const change of [
    (g) => (g.enabled = false),
    (g) => (g.max_rooms = 0),
    (g) => (g.expires_at = "2000-01-01T00:00:00Z"),
    (g) => (g.workspace_id = "WS_OTHER"),
  ]) {
    const s = setup();
    change(s.grant);
    const p = s.ctx.platformCorePrepareRoomGrowth_(access);
    assert.equal(
      s.ctx.platformCoreAssertRoomGrowth_(s.ss, access, p, 1).success,
      false,
    );
    assert.equal(
      s.ctx.platformCoreAssertRoomGrowth_(s.ss, access, p, 0).success,
      true,
    );
  }
});
test("legacy and observe do not block growth even if Core is unavailable", () => {
  for (const mode of ["legacy", "observe"]) {
    const s = setup(mode);
    s.ctx.platformCoreGetWorkspaceAccess_ = () => ({
      success: false,
      data: { mode, grant: null },
    });
    assert.equal(
      s.ctx.platformCoreAssertRoomGrowth_(
        s.ss,
        access,
        s.ctx.platformCorePrepareRoomGrowth_(access),
        1,
      ).success,
      true,
    );
  }
});
test("mapping switch during lock wait cannot spend prior grant", () => {
  const s = setup();
  const p = s.ctx.platformCorePrepareRoomGrowth_(access);
  s.ctx.platformCoreReadWorkspaceLink_ = () => ({
    mode: "enforce",
    platform_company_id: "com_other",
    product_id: "prd_a",
  });
  assert.equal(
    s.ctx.platformCoreAssertRoomGrowth_(s.ss, access, p, 1).success,
    false,
  );
});
test("room entrypoints preflight before lock and guard before write; onboarding also guarded", () => {
  const room = readFileSync(
    "apps-script/V2_PROPERTY_ROOM_MANAGEMENT.js",
    "utf8",
  );
  for (const name of [
    "saveLandlordRoomByLineUid_",
    "setLandlordRoomAccountToggleByLineUid_",
  ]) {
    const slice = room.slice(room.indexOf("function " + name + "("));
    const next = slice.indexOf("\nfunction ", 10);
    const fn = next < 0 ? slice : slice.slice(0, next);
    assert.ok(
      fn.indexOf("propertyRoomPlatformCorePrepare_") <
        fn.indexOf("lock.waitLock"),
    );
    assert.ok(
      fn.indexOf("propertyRoomPlatformCoreAssert_") >
        fn.indexOf("lock.waitLock"),
    );
  }
  assert.match(
    readFileSync("apps-script/V2_LANDLORD_ONBOARDING.js", "utf8"),
    /platformCoreRejectUnpreparedGrowth_/,
  );
});
test("expiry is checked again after slow Sheet read inside lock", () => {
  const s = setup();
  const p = s.ctx.platformCorePrepareRoomGrowth_(access);
  s.ctx.workspaceGetObjectsWithRow_ = () => {
    s.grant.expires_at = "2000-01-01T00:00:00Z";
    return s.rows;
  };
  assert.equal(
    s.ctx.platformCoreAssertRoomGrowth_(s.ss, access, p, 1).code,
    "SUBSCRIPTION_UNAVAILABLE",
  );
});
test("missing module fallback rejects mapped growth and still allows existing edit", () => {
  const property = readFileSync(
    "apps-script/V2_PROPERTY_ROOM_MANAGEMENT.js",
    "utf8",
  );
  const chunk = property.slice(
    property.indexOf("function propertyRoomPlatformCorePrepare_("),
  );
  const ctx = { runtimeSpreadsheet_: () => ({ getSheetByName: () => ({}) }) };
  vm.runInNewContext(chunk, ctx);
  const p = ctx.propertyRoomPlatformCorePrepare_(access);
  assert.equal(
    ctx.propertyRoomPlatformCoreAssert_(ctx.runtimeSpreadsheet_(), access, p, 1)
      .success,
    false,
  );
  assert.equal(
    ctx.propertyRoomPlatformCoreAssert_(ctx.runtimeSpreadsheet_(), access, p, 0)
      .success,
    true,
  );
});
test("actual room reactivation fetches before lock, counts inside lock and releases on denial", () => {
  let held = false,
    fetches = 0,
    writes = 0;
  const rows = [
    { room_id: "R0", workspace_id: "WS_A", account_status: "active" },
    {
      room_id: "R1",
      workspace_id: "WS_A",
      account_status: "inactive",
      __row_number: 3,
    },
    {
      room_id: "R2",
      workspace_id: "WS_A",
      account_status: "inactive",
      __row_number: 4,
    },
  ];
  const ss = { getSheetByName: () => ({}) };
  const grant = {
    workspace_id: "WS_A",
    company_id: "com_a",
    product_id: "prd_a",
    enabled: true,
    max_rooms: 2,
    expires_at: new Date(Date.now() + 20000).toISOString(),
  };
  const ctx = {
    Date,
    Number,
    String,
    LockService: {
      getScriptLock: () => ({
        waitLock() {
          held = true;
        },
        releaseLock() {
          held = false;
        },
      }),
    },
    SpreadsheetApp: { flush() {} },
    runtimeSpreadsheet_: () => ss,
    workspaceResult_: (success, code, message, data) => ({
      success,
      code,
      message,
      data,
    }),
    workspaceLandlordResolveAccess_: () => ({
      success: true,
      workspace: { workspace_id: "WS_A" },
      membership: { role: "owner" },
    }),
    workspaceGetObjectsWithRow_: () => {
      assert.equal(held, true);
      return rows;
    },
    platformCoreText_: (v) => String(v || "").trim(),
    platformCoreReadWorkspaceLink_: () => ({
      mode: "enforce",
      platform_company_id: "com_a",
      product_id: "prd_a",
    }),
    platformCoreGetWorkspaceAccess_: () => {
      assert.equal(held, false);
      fetches++;
      return { success: true, data: { mode: "enforce", grant } };
    },
  };
  vm.runInNewContext(
    readFileSync("apps-script/V2_PROPERTY_ROOM_MANAGEMENT.js", "utf8") +
      "\n" +
      source,
    ctx,
  );
  ctx.propertyRoomEnsureSchema_ = () => {};
  ctx.propertyRoomRequireWrite_ = () => ({ success: true });
  ctx.propertyRoomFindWorkspaceTarget_ = (_s, _a, _key, id) =>
    rows.find((r) => r.room_id === id);
  ctx.propertyRoomActor_ = () => ({
    user_id: "usr_fixture",
    membership_id: "mem_fixture",
  });
  ctx.propertyRoomSetValues_ = (_sheet, row, values) => {
    assert.equal(held, true);
    rows.find((r) => r.__row_number === row).account_status =
      values.account_status;
    writes++;
  };
  ctx.propertyRoomAudit_ = () => {};
  assert.equal(
    ctx.setLandlordRoomAccountToggleByLineUid_("verified", "R1", true, "WS_A")
      .success,
    true,
  );
  assert.equal(
    ctx.setLandlordRoomAccountToggleByLineUid_("verified", "R2", true, "WS_A")
      .code,
    "ROOM_CAPACITY_REACHED",
  );
  assert.equal(held, false);
  assert.equal(fetches, 2);
  assert.equal(writes, 1);
});
