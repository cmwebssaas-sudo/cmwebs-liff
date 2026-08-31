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
- [x] 房客直接開啟首頁時，LINE 登入回跳先經正式 `tenant-bind.html` Endpoint，再回到原頁，避免 deep URL 造成 LINE 400（Phase 167 靜態回歸測試；真機待驗證）
- [x] 房客綁定狀態查詢對 Apps Script 偶發慢回應採 30 秒逾時、一次重試，且不重試綁定寫入
  （`tests/tenant-binding-api-resilience.test.mjs`；尚未做真機或 Production 驗證）
- [x] 房東入口狀態查詢改用不依賴 JSONP callback 的 CORS JSON fetch，保留 25 秒逾時與錯誤提示
  （`tests/phase170-landlord-entry-status-fetch.test.mjs`；尚未做真機或 Production 驗證）
- [x] 房客詳細頁的房客清單與合約申請初始化改用不依賴 JSONP callback 的 CORS JSON fetch，保留 30 秒逾時與錯誤提示
  （`tests/phase171-landlord-tenant-detail-fetch.test.mjs`；尚未做真機或 Production 驗證）
- [x] 房東房客名單只為未綁定房客顯示「邀請綁定」；手機使用系統分享，桌機複製不含房客個資的 `tenant-bind.html` 連結（`tests/tenant-binding-invite-share.test.mjs`）
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
- [x] 房東可停用／重新啟用房間帳號，僅更新 `account_status` 且保留租約、帳單與付款紀錄（`tests/room-account-toggle.test.mjs`）
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
- [x] 付款回報確認與手動銷帳在寫入回應逾時後，以權威讀取結果確認是否已完成，且不重送寫入（Phase 147 自動回歸測試；尚未做真機或 Production 驗證）
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
- [x] LIFF access token 過期時報到頁自動重新登入（Phase 149 自動回歸測試）
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

## V2.1 本地候選：線上合約簽署與營收儀表板

- [x] 房東房客詳細頁可管理舊合約、身分證正反面與自拍照；已上傳項目鎖定避免重複上傳，電腦可拖放檔案並沿用格式／大小驗證，文件卡片以預覽為入口，預覽頁保留下載、列印與分享（`tests/tenant-detail-contract-documents.test.mjs`；正式站需另行發布驗證）
- [x] 房客簽署資料送出、房東 Workspace/RBAC 審核、核准啟用、拒絕後重送（Phase 129–133、138、140 focused tests；Production 尚未驗證）
- [x] 合約審核缺少必要附件時 fail closed、跨 Workspace 拒絕、重複決策 idempotent（Phase 138 runtime mock；Production Sheet schema 尚未驗證）
- [x] 營收儀表板聚合應收／實收／未收／收款率，並排除跨 Workspace 帳單（Phase 150 runtime test）
- [x] 營收儀表板提供 SVG 圖表、數值表格 fallback、空資料狀態與月份／物件 CSV（Phase 151 UI test）
- [x] 營收儀表板提供繳款狀態分布、遲繳比例與遲繳天數、入住率、合約到期分布（Phase 152 runtime + Phase 153 UI tests）
- [x] 房客與房東審核頁均讀取指定 Google Docs 固定版型；送出時複製固定版型、填入欄位、把文字簽名區替換為簽名圖片並回寫簽署紀錄（Phase 154–155、168 tests；Production template properties／真機尚待驗證）
- [x] 報表可解析 Google Sheets 的 Date 型態帳單月份；簽署 bootstrap 失敗時保留房客唯讀合約檢視（Phase 156 regression test）
- [x] 房東可發起新房出租／房客續約待簽合約，邀請欄位可在空白分頁安全初始化，且租金、管理費、押金與小數費率不失真（Phase 157–162 runtime／UI tests；Production schema header repair verified）
- [x] 到期 60 天內每日只準備一份 append-only 續約草稿，保留原合約；草稿待房東檢視、30 天僅提醒一次，房東確認後才建立房客邀請，且房客清單顯示合約到期日／剩餘日數（Phase 178 runtime／UI tests；尚未部署或驗證正式觸發器）
- [x] 房東合約申請頁顯示房客已送出的固定版型新租約、簽名預覽，且原生審核 API／房客文件 route 錯誤不再被靜默成空畫面（Phase 169；Production／LINE 真機待驗證）
- [x] 房東房客詳細頁提供明確的「查看完整合約與簽名」入口，並定位至合約申請頁的原生合約內容區（Phase 172；Production／LINE 真機待驗證）
- [x] 舊房客續約採 `V2_contracts` append-only 版本鏈，保留歷史合約、完整金額／付款快照、30 天到期不續約優惠、續約證件沿用與新簽名要求；房東／房客可讀取版本紀錄，指定房東版本可唯讀查看完整合約與簽名，並提供可重跑的 additive-only schema migration（Phase 174–176；Apps Script Version 130／GitHub Pages workflow `33098140787` 已發布；LINE 真機仍待驗證）
- [x] 正式 `landlord_tenants` Workspace 原生路由回傳同一份唯讀 `contract_history`，避免 603 原測試合約仍存在但房客詳細頁顯示「尚無可讀取的合約版本」；房東詳細頁可完成渲染並提供「查看完整合約與簽名」（Phase 177；Apps Script Version 131／GitHub Pages workflow `33099332347`／公開 603 smoke readback 已驗證；LINE 真機仍待驗證）
- [x] Production-facing landlord／tenant pages 全部指向目前正式 Apps Script deployment 114，避免沿用舊部署造成合約管理頁卡在載入中（Phase 165 endpoint regression test）
- [x] 房客首頁沒有有效租約時保留合約入口，讓待簽署房客可進入手機合約簽署頁（Phase 166 UI 回歸測試；Production 真機尚待驗證）
- [x] 房東首頁提供本月應收／已收／未收／收款率 KPI、近 12 個月三線圖、入住率環形圖與 30／60／90 天合約到期柱狀圖；KPI 採兩欄配置並取消金額省略，趨勢圖下方摘要使用顯示月份合計並保留數值與 aria-label（Phase 193；本地自動測試通過）
- [x] 房東首頁在取得身份後即與 bootstrap 並行啟動報表請求，bootstrap 完成後漸進渲染報表；唯讀 JSONP 逾時最多自動重試一次，script error 立即清理並拒絕，圖表失敗不覆蓋已載入首頁（Phase 193；本地自動測試通過）
- [x] 房客清單由 `landlord_tenants` 回傳現行合約到期日；房卡明確顯示到期日與剩餘／逾期天數，並以有效、60 天內、30 天內、已到期分級顏色提示（Phase 194；本地 API／UI 回歸測試通過，公開頁與 LIFF 真機尚待驗證）
- [x] 房東可修改尚未發送的續約草稿日期，系統同步重建合約全文；已送出／已簽署版本拒絕覆寫，手動簽約日期錯誤改以取消未認領邀請後重建或新增更正續約版本（Phase 195；Apps Script Version 139／GitHub Pages workflow `33449180375` 已發布並完成公開 route/page readback，LINE 真機尚待驗證）
- [ ] Apps Script 實際 serving version、正式 Sheet schema、LIFF 真機與 GitHub Pages 發布後 UAT
