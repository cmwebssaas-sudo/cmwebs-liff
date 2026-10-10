import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import vm from "node:vm";
import { test } from "node:test";
import assert from "node:assert/strict";
const core = process.env.PLATFORM_CORE_TEST_WORKTREE;
const enabled =
  core && existsSync(resolve(core, "scripts/fixtures/product-access-http.ts"));
for (const scenario of ["active", "revoked", "wrong_workspace", "expired"])
  test(
    "actual Core HTTP -> Apps Script -> capacity " + scenario,
    { skip: !enabled },
    () => {
      const credential = "upc_sc_" + randomBytes(32).toString("base64url");
      let calls = 0;
      const headers = [
        "workspace_id",
        "platform_company_id",
        "product_id",
        "status",
        "mode",
        "linked_at",
        "updated_at",
      ];
      const sheet = {
        getDataRange: () => ({
          getValues: () => [
            headers,
            [
              "WS_FIXTURE",
              "com_fixture",
              "prd_fixture",
              "LINKED",
              "enforce",
              "",
              "",
            ],
          ],
        }),
      };
      const ss = {
        getSheetByName: (name) =>
          name === "V3_platform_core_workspace_links" ? sheet : {},
      };
      const properties = {
        CMWEBS_PLATFORM_CORE_ENVIRONMENT: "staging",
        CMWEBS_PLATFORM_CORE_BASE_URL: "https://core.example.test",
        CMWEBS_PLATFORM_CORE_PRODUCT_ID: "prd_fixture",
        CMWEBS_PLATFORM_CORE_SERVICE_TOKEN: credential,
      };
      const ctx = {
        Date,
        JSON,
        Number,
        String,
        Math,
        runtimeSpreadsheet_: () => ss,
        PropertiesService: {
          getScriptProperties: () => ({
            getProperty: (key) => properties[key],
          }),
        },
        workspaceGetObjectsWithRow_: () => [
          { workspace_id: "WS_FIXTURE", account_status: "active" },
        ],
        UrlFetchApp: {
          fetch(url, options) {
            calls++;
            const result = spawnSync(
              resolve(core, "apps/api/node_modules/.bin/tsx"),
              ["scripts/fixtures/product-access-http.ts"],
              {
                cwd: core,
                encoding: "utf8",
                input: JSON.stringify({
                  scenario,
                  credential,
                  authorization: options.headers.Authorization,
                  url: new URL(url).pathname,
                }),
                timeout: 20000,
              },
            );
            assert.equal(result.status, 0, "Core fixture bridge must succeed");
            const response = JSON.parse(result.stdout);
            return {
              getResponseCode: () => response.status,
              getContentText: () => response.body,
            };
          },
        },
      };
      vm.runInNewContext(
        readFileSync("apps-script/V3_PLATFORM_CORE_SUBSCRIPTIONS.js", "utf8") +
          "\n" +
          readFileSync("apps-script/V3_PLATFORM_CORE_ROOM_CAPACITY.js", "utf8"),
        ctx,
      );
      const access = { workspace: { workspace_id: "WS_FIXTURE" } };
      const prepared = ctx.platformCorePrepareRoomGrowth_(access);
      assert.equal(calls, 1);
      const result = ctx.platformCoreAssertRoomGrowth_(ss, access, prepared, 1);
      assert.equal(result.success, scenario === "active");
      assert.equal(calls, 1, "guard must not fetch while holding a lock");
      assert.equal(JSON.stringify(prepared).includes(credential), false);
    },
  );
