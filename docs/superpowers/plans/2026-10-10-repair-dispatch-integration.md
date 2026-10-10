# 原生報修派工實作計畫

> 在本 session 由主 agent 依 executing-plans 順序實作；使用者已指定按設計實作。

Goal: 在既有報修 ID、登入與 Spreadsheet 上提供可驗證的派工/報價/完工/驗收闭環。
Spec: ../specs/2026-10-10-repair-dispatch-integration-design.md

- [x] 新增失敗測試：原 Spreadsheet event journal、狀態閉環、版本/冪等、廠商权限与公开projection。
- [x] 新增 V2_REPAIR_DISPATCH.js：合作對象、workflow、operator migration、私有照片；不變更帳務。
- [x] 接入既有 dispatcher POST-only/principal 與 landlord/tenant repair projection，阻擋舊更新繞過驗收。
- [x] 既有報修頁派工/廠商設定與廠商受限回覆頁；保留 shell、cache、draft/timeout recovery。
- [x] 補齊行為測試、API/Schema/矩陣/rollback 記錄；完整回歸、validate、diff-check及安全review。

基線: origin/main e7fd413，699 tests pass，根目錄 WIP 保留；Production 未核驗、未更動。

本地完成驗證：723/723 tests、24/24 派工專用回歸、validate、diff-check、Chrome390/1280合成流程；只讀審查及修正後複查通過。正式部署/真實LINE與Drive驗收未執行。
