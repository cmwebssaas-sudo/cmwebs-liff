# 原生報修與派工整合

2026-10-10；建議模型/速度 gpt-5.6-terra / medium。使用者已確認聊天設計並要求按設計實作。
範圍 WO-PARTNERS-01：已明確授權的標準合作廠商流程接入原租管核心；不建立第二套房東、Workspace、房源、租約或工單權威。

## 身份與持久化

原 `V2_repair_tickets.repair_ticket_id` 是唯一工單 ID。派工使用附加 `V2_repair_dispatch_events`，每個事件一列保存完整派工狀態、版本、actor、request_id 及請求 digest；狀態與稽核同列提交。既有報修狀態是相容 projection，派工詳細階段另存，避免破壞五種既有 status。
合作對象亦在同一原 Spreadsheet 的附加事件中保存，包含公司/個人、多人角色、工種/物件優先順位及固定價。原型 D1/Worker 不參與房東或業務資料權威。
所有寫入短 ScriptLock 內重新授權、核對 Workspace/版本/冪等。讀取不建立新表；另備 operator-only additive migration。

## 操作與閉環

房東從原 `landlord-messages.html` 選報修進入派工：自行處理或合作對象 → 邀請/報價 → 核准派工 → 開工 → 完工說明/私有照片 → 驗收/補修。固定價是邀請當下的價格快照。額外費用未核准不得結案；已結案不能覆寫。
沒有合作對象仍可自行處理。合作對象可停用；每次廠商操作重新核对啟用狀態與成員角色。對外頁只提供廠商工作回覆，不建立房東帳號/Workspace。
邀請使用 opaque invitation ID，不是 bearer 授權；每次回覆由現有 LINE provider verifier 驗證身份，再核對房東登記的公司成員及受派施工者。轉寄連結不能取得其他公司/工單權限。
房客只讀自己工單的公開進度，不能取得廠商報價、成員 UID、原房客私有資料或完工照片；房東保留房間歷史。

## 通知與附件

本次提供明確人工分享邀請，保存 `manual_required` 事件；沒有 LINE provider 送達證據不標 sent。不改 OA/channel/webhook/trigger，不向真實廠商發送訊息。自動順位發送須依 BYO OA 的後續已驗證 adapter 啟用，不能宣稱本次已啟用。
完工照片以 Drive PRIVATE 保存；獨立 repair root property 缺失即拒絕，不借用身份證/合約資料夾。下載每次重新驗證工單權限。檔案限制 JPEG/PNG、magic bytes、3 MiB；保存的是 file ID，公開 view 不含 Drive URL。

## 驗證與交付

測試覆蓋自辦及公司多人、報價/固定價、補價/補修、停用與跨 Workspace、重複/異內容冪等、stale version、事件提交失敗、公開 projection、POST-only/provider auth、附件權限與格式、UI 實際操作。
執行 npm test、npm run validate、Apps Script mocks、inline JS syntax、diff-check。僅本地候選；不 push/merge/deploy/migrate 正式表、不修改 Properties/LINE，也不觸發財務寫入。部署前必須 fresh export/版本核對、schema preview、設定私有資料夾及真機驗收。
