(function (window) {
  "use strict";
  const versions = new WeakMap();
  async function mount(options) {
    const container = options.container;
    if (!container) return;
    const version = (versions.get(container) || 0) + 1;
    versions.set(container, version);
    container.setAttribute("role", "status");
    container.setAttribute("aria-live", "polite");
    container.textContent = "正在讀取訂閱…";
    try {
      const result = await options.request("landlord_subscription_init", {});
      if (versions.get(container) !== version) return;
      if (!result || result.success !== true || !result.data)
        throw new Error("UNAVAILABLE");
      const data = result.data;
      if (data.mode === "legacy") {
        container.textContent = "尚未連接訂閱";
        return;
      }
      const labels = {
        TRIAL: "試用中",
        ACTIVE: "使用中",
        PAST_DUE: "付款待確認",
        SUSPENDED: "已暫停",
        CANCELLED: "已取消",
        EXPIRED: "已到期",
        NONE: "無有效訂閱",
      };
      let text = labels[data.status] || "訂閱狀態待確認";
      if (
        Number.isSafeInteger(data.rooms_used) &&
        data.rooms_used >= 0 &&
        Number.isSafeInteger(data.rooms_max) &&
        data.rooms_max >= 0
      ) {
        text += " · 房間 " + data.rooms_used + " / " + data.rooms_max;
        if (data.rooms_used > data.rooms_max) text += " · 已超出房間上限";
      } else if (
        data.mode === "observe" &&
        Number.isSafeInteger(data.rooms_used) && data.rooms_used >= 0 &&
        data.rooms_max === null
      ) {
        text += " · 房間 " + data.rooms_used + " · 未設定房間上限";
      }
      container.textContent = text;
    } catch (_) {
      if (versions.get(container) === version)
        container.textContent = "暫時無法讀取訂閱，請稍後重新整理";
    }
  }
  window.CMWebsPlatformCoreSubscription = { mount: mount };
})(window);
