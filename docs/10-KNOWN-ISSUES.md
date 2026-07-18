# 已知問題與技術債

## P0：Source of Truth 分裂

目前存在大量：

```text
*_FIXED
*_WITH_SETTINGS
*_WITH_TEAM_NOTIFICATIONS
complete-*
```

不能再以檔名表示版本。第一優先是對帳並建立唯一正式版。

## P0：GitHub、Apps Script 與交接候選可能不同步

- GitHub main 的可見頁面集較舊
- 最新 Apps Script 內容主要存在對話產生的候選檔
- 實際部署版本需由 Apps Script 專案匯出
- 本包不把候選檔宣稱為已部署正式版

## P0：完整回歸尚未完成

目前多數測試是：

- 語法
- 單一初始化
- 單一 Schema
- 人工頁面測試

尚未形成一套可重複執行的端到端測試。

## P0：房客綁定模組存在同名函式衝突

`V2_TENANT_BINDING.gs` 與電話同步修正版包含相同全域函式，不能同時部署。已移至 `unresolved-candidates/apps-script/V2_TENANT_BINDING/`，由 Gate 0 對帳後合併為唯一模組。

## P1：Google Sheets 容量與效能

已發生接近 1,000 萬儲存格的錯誤。部分模組會壓縮新表，但仍需：

- 工作表列／欄上限控制
- 封存歷史 log
- 避免全表掃描
- CacheService
- 索引表
- V3 正式資料庫遷移

## P1：Legacy `landlord_id`

Workspace 已建立，但許多舊欄位與查詢仍依賴 `landlord_id`。不可直接移除，需要：

- 資料 migration
- 所有 route 的 tenant-isolation 測試
- Workspace scoped repository layer

## P1：`test=1` 具有真實副作用

測試模式仍可能發送真實 LINE 與修改正式資料。需在未來建立真正的 staging／dry-run。

## P1：通知與發送可靠性

尚缺：

- 一般化 retry queue
- LINE quota 監控
- 失敗退避
- 同日摘要
- Email／SMS 備援

## P1：V2 缺少閉環模組

- 圖形化報表
- 完整報修工單
- 退租、點交與押金結算
- 備份、監控與內部操作 Runbook

## P2：租約文件

尚缺正式 PDF、電子簽名、附件、版本與歸檔。是否列為 V2 上線阻擋項目，應由內部實際營運方式決定。

## P2：環境設定分散

API URL、LIFF ID、測試 UID 仍硬編在多個 HTML。應在 consolidation 後集中生成。
