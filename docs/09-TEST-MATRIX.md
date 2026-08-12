# V2 回歸測試矩陣

## Gate 0：靜態驗證

- [ ] 所有 `.gs` 通過 JavaScript syntax check
- [ ] 所有 HTML inline script 通過 syntax check
- [ ] 無重複 top-level function
- [ ] 無重複 top-level const
- [ ] `Code.gs` 無重複 route
- [ ] route count 與 manifest 一致
- [ ] canonical 目錄無 `_FIXED`／`_WITH_` 版本檔
- [ ] 無密鑰與 token

## 身份與入口

- [ ] 未登入房東導向 LIFF 登入
- [ ] 登入後返回原頁
- [ ] 新房東註冊
- [ ] onboarding 暫存與完成
- [ ] 房客未綁定導向 bind
- [ ] `+886` 與 9 位手機正規化
- [ ] 不同 Workspace 不可互看

## Workspace 與團隊

- [ ] 建立 Workspace
- [ ] owner 成員建立
- [ ] 邀請與取消
- [ ] 接受邀請
- [ ] 角色與權限更新
- [ ] 移除成員
- [ ] Workspace 切換
- [ ] 操作稽核記錄操作者

## 物件、房間與房客

- [ ] 建立／修改／封存物件
- [ ] 建立／修改／封存房間
- [ ] Workspace 預設值正確帶入
- [ ] 輸入租金自動計算押金
- [ ] 夏月區間與跨年度判斷
- [ ] 建立房客
- [ ] 建立房客後首頁、房客清單與詳細頁一致

## 租約

- [ ] 新租約建立
- [ ] 房客端看到正確租約
- [ ] 續約申請
- [ ] 提前終止申請
- [ ] 房東核准／拒絕
- [ ] 取消申請
- [ ] 條款與違約金資料一致
- [ ] 團隊收到合約通知

## 帳單與付款

- [ ] `landlord_billing_init`
- [ ] 上期電表正確
- [ ] 批次建立帳單
- [ ] 新增與更新計數正確
- [ ] 房客帳單顯示正確
- [ ] 帳單通知只發測試帳號
- [ ] 房客付款回報
- [x] 201 已繳帳單的付款回報初始化不產生空白帳單（Phase 145 自動回歸測試；Production Version 102 唯讀 smoke test）
- [x] 已銷帳帳單的舊付款回報不再計入房東待審核統計（Phase 144 自動回歸測試；Production Version 102 唯讀 smoke test）
- [x] 房東首頁與付款回報審核頁的底部導覽樣式一致（Phase 144 自動回歸測試）
- [x] 房客付款回報入口經 `tenant-bind.html` 登入並保留帳單參數，避免 LINE 400（Phase 146 自動回歸測試；GitHub Pages merge `37e164e6`／workflow `31538875823`）
- [x] 四個房客功能頁移除公開 page-local UID，測試模式改由 `test=1` 交給後端解析，正式 LIFF profile 流程與 Phase 146 gateway 保留（Phase 147 靜態回歸測試；focused 與全套 Node 回歸均通過；GitHub Pages merge `0bbbe06e`／workflow `31601674513`／公開頁面讀取驗證 2026-08-12）
- [ ] 團隊收到付款通知
- [ ] 房東核准後帳單結清
- [ ] 手動結清與重開
- [ ] 已繳帳單頁一致

## 自動催繳

- [ ] Workspace schedules 正確
- [ ] preview 不發 LINE
- [ ] ScheduledNow 只列目前時段
- [ ] 正式執行只發應發階段
- [ ] 同階段不重複
- [ ] 錯過提醒日補最高階段
- [ ] 最終階段下一天轉人工
- [ ] trigger 只有一個
- [ ] LINE 失敗進入通知中心

## 訊息／報修

- [ ] 房客一般訊息
- [ ] 緊急訊息
- [ ] maintenance 成員收到通知
- [ ] 房東更新狀態
- [ ] 後續正式工單模組待開發

## 入住

- [ ] 報到資料載入
- [ ] 預定入住日
- [ ] 鑰匙交付
- [ ] 入住電表
- [ ] 完成／取消狀態
- [ ] 歡迎通知
- [ ] LINE 失敗通知

## 公告

- [ ] 全部房客
- [ ] 指定物件
- [ ] 指定房客
- [ ] 未綁定與衝突統計
- [ ] 單一測試房客發送
- [ ] 失敗重試
- [ ] 團隊看到公告結果

## 系統設定與通知中心

- [ ] 個人資料與手機前導 0
- [ ] Workspace 名稱、時區、幣別
- [ ] 收款帳號權限與遮罩
- [ ] 帳務預設
- [ ] 通知偏好
- [ ] 單筆已讀
- [ ] 全部已讀
- [ ] 類型與失敗篩選

## 非功能測試

- [ ] 手機 Safari／LINE WebView
- [ ] Android LINE WebView
- [ ] 頁面不被 bottom nav 遮擋
- [ ] API 逾時提示
- [ ] Google Sheets 容量
- [ ] 100／500／1,000 房客資料量測試
- [ ] LINE API 配額與錯誤
- [ ] Apps Script 執行時間
- [ ] 備份與還原演練
