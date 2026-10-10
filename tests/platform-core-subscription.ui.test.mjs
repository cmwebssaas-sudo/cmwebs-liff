import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import assert from "node:assert/strict";
const source = readFileSync("platform-core-subscription.js", "utf8");
function setup() {
  const window = {};
  vm.runInNewContext(source, { window, WeakMap, Number, String });
  const container = { textContent: "", setAttribute() {} };
  return { mount: window.CMWebsPlatformCoreSubscription.mount, container };
}
test("observe summary shows actual rooms when no quota is configured", async () => {
  const s = setup();
  await s.mount({
    container: s.container,
    request: async () => ({success:true, data:{mode:"observe",status:"NONE",rooms_used:21,rooms_max:null}}),
  });
  assert.match(s.container.textContent, /房間 21/);
  assert.match(s.container.textContent, /未設定房間上限/);
  assert.doesNotMatch(s.container.textContent, /21 \/ 0|超出/);
});
for (const [data, pattern] of [
  [{ mode: "legacy" }, /尚未連接訂閱/],
  [
    { mode: "enforce", status: "ACTIVE", rooms_used: 2, rooms_max: 0 },
    /2 \/ 0/,
  ],
  [
    { mode: "observe", status: "TRIAL", rooms_used: 0, rooms_max: 10 },
    /試用中/,
  ],
  [{ mode: "enforce", status: "EXPIRED" }, /已到期/],
  [
    { mode: "enforce", status: "ACTIVE", rooms_used: 3, rooms_max: 2 },
    /已超出房間上限/,
  ],
])
  test("safe subscription UI " + pattern, async () => {
    const s = setup();
    await s.mount({
      container: s.container,
      request: async () => ({ success: true, data }),
    });
    assert.match(s.container.textContent, pattern);
  });
test("unavailable and asynchronous failures remain isolated", async () => {
  for (const request of [
    async () => ({ success: false, message: "raw secret" }),
    async () => {
      throw new Error("raw secret");
    },
  ]) {
    const s = setup();
    await s.mount({ container: s.container, request });
    assert.match(s.container.textContent, /暫時無法讀取/);
    assert.doesNotMatch(s.container.textContent, /raw secret/);
  }
});
test("injected plan strings never become HTML", async () => {
  const s = setup();
  Object.defineProperty(s.container, "innerHTML", {
    set() {
      throw new Error("Unsafe HTML");
    },
  });
  await s.mount({
    container: s.container,
    request: async () => ({
      success: true,
      data: {
        status: "ACTIVE",
        plan_id: "<img onerror=alert(1)>",
        rooms_used: 1,
        rooms_max: 2,
      },
    }),
  });
  assert.match(s.container.textContent, /使用中/);
  assert.doesNotMatch(s.container.textContent, /img/);
});
