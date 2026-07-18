# 架構與產品決策紀錄

## ADR-001：V2、V3、V4 邊界

- V2：內部房源正式使用
- V3：對外付費 SaaS
- V4：AI 上架、影片、社群與自媒體

原因：避免 SaaS 與 AI 功能拖延內部營運閉環。

## ADR-002：V2 保留 GitHub Pages + Apps Script + Sheets

V2 先完成可用與穩定，不因 V3 資料庫遷移延後內部上線。

## ADR-003：Workspace 是新多租戶邊界

`workspace_id` 是新架構主鍵；`landlord_id` 暫時保留相容。

## ADR-004：版本由 Git 管理

正式 repository 不再建立 `_FIXED`、`_WITH_*` 檔案。

## ADR-005：圖形化報表屬於 V2

報表是內部營運必要功能，不延後至 V3。

## ADR-006：通知偏好只控制 LINE Push

即使停用通知，事件仍保存於通知中心，避免營運資訊消失。

## ADR-007：自動催繳使用每小時 Dispatcher

原因：不同 Workspace 可有不同時區與發送時間。

## ADR-008：手機以文字保存

原因：Google Sheets 會移除電話前導 0。

## ADR-009：Codex 接手前先 Consolidation

Codex 第一個任務不是新增功能，而是建立唯一正式基準、測試與 release。
