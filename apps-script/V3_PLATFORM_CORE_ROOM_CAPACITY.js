/** Capacity is canonical Workspace-wide, independent of lease/tenant status. */
function platformCoreCountActiveRooms_(rows, workspaceId) {
  return rows.filter(function (row) {
    return (
      platformCoreText_(row.workspace_id) === workspaceId &&
      ["", "active"].indexOf(
        platformCoreText_(row.account_status).toLowerCase(),
      ) >= 0
    );
  }).length;
}
function platformCoreCountWorkspaceRooms_(ss, workspaceId) {
  const sheet = ss.getSheetByName("V2_rooms");
  if (!sheet) throw new Error("ROOM_SCHEMA_REQUIRED");
  return platformCoreCountActiveRooms_(
    workspaceGetObjectsWithRow_(sheet),
    workspaceId,
  );
}
function platformCorePrepareRoomGrowth_(access) {
  // Synchronous network request MUST run before the caller acquires ScriptLock.
  const result = platformCoreGetWorkspaceAccess_(access);
  return {
    mode: (result.data && result.data.mode) || "enforce",
    grant: result.success && result.data ? result.data.grant : null,
  };
}
function platformCoreCapacityError_(code) {
  return {
    success: false,
    code: code,
    message:
      code === "ROOM_CAPACITY_REACHED"
        ? "已達方案房間數上限"
        : "暫時無法確認新增房間權限，請稍後重試",
  };
}
function platformCoreAssertRoomGrowth_(ss, access, prepared, delta) {
  if (delta === 0) return { success: true, code: "OK" };
  if (delta !== 1) return platformCoreCapacityError_("INVALID_ROOM_GROWTH");
  try {
    const workspaceId = platformCoreText_(access.workspace.workspace_id);
    const link = platformCoreReadWorkspaceLink_(workspaceId);
    const mode = link ? link.mode : "legacy";
    if (mode === "legacy" || mode === "observe")
      return { success: true, code: "OK" };
    const grant = prepared && prepared.grant;
    if (
      !prepared ||
      prepared.mode !== "enforce" ||
      !grant ||
      grant.workspace_id !== workspaceId ||
      grant.company_id !== link.platform_company_id ||
      grant.product_id !== link.product_id ||
      grant.enabled !== true ||
      !Number.isSafeInteger(grant.max_rooms) ||
      grant.max_rooms < 0 ||
      !Number.isFinite(Date.parse(grant.expires_at)) ||
      Date.parse(grant.expires_at) <= Date.now()
    )
      return platformCoreCapacityError_("SUBSCRIPTION_UNAVAILABLE");
    const used = platformCoreCountWorkspaceRooms_(ss, workspaceId);
    if (Date.parse(grant.expires_at) <= Date.now())
      return platformCoreCapacityError_("SUBSCRIPTION_UNAVAILABLE");
    if (used + 1 > grant.max_rooms)
      return platformCoreCapacityError_("ROOM_CAPACITY_REACHED");
    return { success: true, code: "OK" };
  } catch (_) {
    return platformCoreCapacityError_("SUBSCRIPTION_UNAVAILABLE");
  }
}
/** Onboarding runs under an existing lock: never fetch there. */
function platformCoreRejectUnpreparedGrowth_(workspaceId) {
  try {
    const link = platformCoreReadWorkspaceLink_(workspaceId);
    if (!link || link.mode === "legacy" || link.mode === "observe")
      return { success: true, code: "OK" };
  } catch (_) {}
  return {
    success: false,
    code: "SUBSCRIPTION_GROWTH_FLOW_REQUIRED",
    message: "請完成訂閱確認後，從房間管理新增或啟用房間",
  };
}
