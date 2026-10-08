# LINE 工單實作進度

2026-10-08：計畫 `superpowers/plans/2026-10-08-vendor-line-test.md` 已獲核准，由主代理直接實作。

任務 1 進行中：新增 `line-binding.mjs` 純轉移核心與兩項測試，先確認缺少模組而失敗，再確認測試通過。邀請 token 僅保存雜湊，24 小時到期；申請不直接授權，需房東核准；撤銷、重放、跨工作區及非房東操作拒絕。

待完成：新資料表的舊 snapshot 相容處理、交易 API／冪等、介面，以及後續 LINE 登入、通知與獨立 staging。核心尚未接入 server 或 live store，不能對外使用。既有本機資料未遷移；沒有 webhook、秘密或發送設定變更。

驗證：新核心測試 2/2；`npm run validate` 通過；`git diff --check` 通過。這些不是 LINE 收件或完整工單綁定證據。
