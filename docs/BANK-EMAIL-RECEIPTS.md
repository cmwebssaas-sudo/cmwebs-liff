# 郵局 Email 入帳與房東確認銷帳

2026-10-09 HTML 原信解析修正：郵局原信包含註解中的舊帳號欄位，舊版 HTML
轉文字把隱藏欄位也留下，因此第二封真實通知被當成重複欄位而拒絕。
先移除 HTML 註解再解析；可見重複通知仍拒絕。合成重現 RED→GREEN，完整679/679
及 validate 通過；沒有更改配對、權限、通知或人工銷帳規則。正式Web App已更新v221（原URL），immutable60來源檔逐檔一致；v220保留作回退。
正式parser與補讀執行成功；有界回讀兩筆真實通知均matched/pending及sent，
兩筆report_id／payment_id空白。第二筆通知三個delivery為sent且各send_count=1。
手機收件／人工确认仍UNVERIFIED；未改前端、Schema、Properties或trigger。
建議模型／速度：gpt-5.6-terra／medium；隔離分支codex/postal-html-comments-20261009。

2026-10-09 已發布並啟用。使用者明確授權此標準流程的實作；建議模型
`gpt-5.6-terra`／`medium`。隔離分支 `codex/postal-payment-review-20261009`，
基底 `origin/main@6af4b28`。不修改 root WIP；正式 Web App v220／Pages 已發布，Gmail 唯讀收信已啟用。

## 房東看到的流程

收到入帳 Email → 擷取金額／入帳時間／轉出銀行及末五碼 → 配對未繳帳單。

- 配對成功：通知「收到入帳，待確認銷帳」，房東按一次「確認銷帳」。
- 無法配對／同額多張：通知「收到入帳，但無法配對」，房東選帳單確認，
  或標記「其他款項」。匹配金額必須與目前帳單完全相同。
- 首次依唯一金額配對；成功銷帳後才保存銀行＋轉出末五碼與房客／租約關聯。
  已知付款人必須同時符合金額，不能退回配到另一個房客。共用付款帳戶有歧義
  時交給房東選擇；新付款帳戶仍可由房東確認後學習。

郵件收取不改帳單的已繳狀態、不建立正式付款。明確確認後才建立 `BPR-`
付款回報並呼叫既有正式銷帳服務。帳單與付款正確寫入後才完成入帳紀錄及
付款人關聯；確定未提交的金額錯誤會釋放配對，未知結果保留待核對。
同一通知重寄、重按確認、逾時回讀不重複建立付款。不同通知但同額同分鐘
仍保存成不同入帳紀錄。

## 收信與授權邊界

程式使用 Gmail REST `users/me`，讀取的是安裝觸發器的 Google 帳戶信箱。
`mailbox_email` 必須與 Gmail profile 的主要地址相同；填入地址本身不授予
其他信箱的存取權。專用信箱、Apps Script 執行身份與授權方式須先確認。

允許郵局 `bsnsnotify@mail.post.gov.tw`（已觀察格式）或 `bsnotify@mail.post.gov.tw`
直寄，或設定的可信轉寄人。核對 Gmail
收到的外層寄件人及 `mx.google.com` 的 DMARC 結果。轉寄內文的 From 不作
來源驗證；轉寄紀錄明確顯示「請核對收款紀錄」。原信缺欄位、重複通知區塊、
錯誤時間、無法唯一定位收款帳戶都不猜配，記錄去識別化的掃描失敗計數。
無法辨識收款 Workspace 的信件無法通知特定房東，需管理者看 LAST_RUN。

收款帳戶設定必須唯一對應 `V2_workspace_payment_accounts` 的啟用帳戶，
並核對銀行帳號與郵件遮罩的前後碼。帳單保留既有 Workspace 權限規則：
顯式 Workspace 優先；舊帳單空白欄位只經既有 principals 的 landlord_id
相容，不修改原始帳單範圍或擴大跨 Workspace 存取。

新審核 route 僅接受 POST body：Email session／request_id，或 LINE provider
驗證的 ID token。每次重新核對 membership、Workspace 與 payment_write；
不接受裸 LINE UID 或 query credentials，不採用客戶端指定的金額／Workspace。
通知沿用現有團隊 payment_report 偏好與通知中心，關閉 LINE push 仍保存事件。
本工作沒有新增共用 OA 代發的 SaaS 功能。

## 2026-10-09 正式啟用證據

使用者明確同意 Gmail 唯讀權限並接續啟用。正確 Chrome saas profile、
Gmail／Drive／clasp 身份及正式 Spreadsheet 綁定已核對；新增 gmail.readonly
授權已接受，保留原六項 scopes。預設 Cloud project 宣告 Gmail v1 進階服務，
真實 REST 收信成功。實際信件、銀行帳號、收款映射與私人識別碼不提交 Git。

發布前 serving v219／editor HEAD 各59來源檔與 main6af4b28 一致。
完整授權後 HEAD 與 immutable v220 各60檔逐檔匹配候選。既有正式 Web App
URL 維持不變，其他四個部署保留，v219 作回退；未刪除版本。
PR241 合併為0e679069bf6a9c40307f398fd43d741b44290d3b，Pages build1271979520
為 built，46個公開檔案逐檔相符，cache tag20261009-postal-payment-review-v1。

migration 只新增兩張附加表，22／10欄位回讀相符；原15個 Script Properties
保留，收信配置 enabled=true。正式 parser 測試成功。
22:52 首次真實收信保存一筆 matched/pending 紀錄；report_id／payment_id 均空白。
唯一通知事件的三個成員 delivery 為 sent、各 send_count=1，失敗0。
這是通知中心及 LINE provider 接受證據，手機實際收件／閱讀仍 UNVERIFIED。

安裝唯一 runBankEmailReceiptIntake 時間觸發器，每5分鐘；既有四個排程保留。
22:54:41 第一次自然排程已完成（6.742秒）。其後有界回讀仍只有一筆 pending
入帳、三筆 sent delivery 且各 send_count=1，沒有重複通知或付款。
正式審核連結在未登入 Chrome 導向登入入口；登入後頁面與房東人工確認／
真實銷帳尚未驗收。未代房東按確認，未新增付款人關聯。

## 設定與啟用 Runbook（本次步驟1–7已完成）

1. 取得正式發布授權；重新核對 serving source、HEAD、正式 Sheet Schema，
   保留當前部署版本及備份。先使用隔離試算表和合成 Email 驗證。
2. 確認 Google 執行身份及指定信箱；啟用其 Cloud project 的 Gmail API，
   經操作當下同意後授權新增的 `gmail.readonly` scope。保留原有 OAuth scopes。
3. 發布完整後端（含 `V2_BANK_EMAIL_RECEIPTS.js`、dispatcher、通知及付款服務），
   建立新 Apps Script Web App 版本且維持既有 URL；發布審核頁及既有 shared auth。
   前端發布需按既有流程更新 release cache tag。
4. 明確執行 `runBankEmailReceiptMigration()`；只增補兩張新表的欄位，
   不批次更改舊帳單或既有正式銀行帳號。核對欄位後才啟用。
5. 在 Script Properties 填入 `CMWEBS_BANK_EMAIL_INTAKE_CONFIG`，
   以下僅為佔位格式，真實資料不得提交 Git：

```json
{
  "enabled": true,
  "mailbox_email": "指定Google執行帳戶的主要Gmail地址",
  "start_after": "YYYY-MM-DD",
  "trusted_forwarders": ["經核對的轉寄人地址"],
  "accounts": [{
    "workspace_id": "現有Workspace ID",
    "payment_account_id": "現有收款帳戶ID",
    "receiver_mask": "郵局Email中的轉入帳號遮罩"
  }]
}
```

6. 郵局 APP 開啟 Email 入帳通知；如轉寄，設定到上述實際可讀信箱，
   並驗證直寄或可信外層寄件人的真實郵件標頭。不要只憑截圖推定格式驗收。
7. 先以隔離合成資料驗證，再執行一次 `runBankEmailReceiptIntake()` 核對已授權真實收信，
   再用 `installBankEmailReceiptTrigger()` 安裝每五分鐘觸發器；installer
   核對信箱與 Schema，重複執行不再安裝第二個相同 handler。
8. 正式驗收須另行授權一筆指定交易：真實收信 → 正確配對 → 通知中心／
   LINE 手機收到 → 房東確認 → V2_payments／V2_bills／回報及關聯保存。
   LINE API 接受或409只代表 provider 接受，不代表手機收到／已讀。

## 排程、通知與恢復

- 預設停用；台北啟用日以 epoch 秒查詢，另依信件內入帳時間限制歷史匯入。
  每輪掃最新25封及一頁25封 backlog，訊息ID去重；失效cursor清除後重起。
- 款項已保存但通知失敗時，下輪從持久化紀錄恢復，與 Gmail 成功與否獨立。
  `CMWEBS_BANK_EMAIL_INTAKE_LAST_RUN` 保存計數與失敗碼，不保存原信／密鑰。
- 銀行事件使用穩定 notification ID、逐成員 delivery ID，發送前持久化；
  LINE 從第一次就使用固定 UUID retry key，指數退避、最多8次且23小時截止。
  sent、關閉／未綁定、永久失敗都是 terminal；失敗仍留在通知中心。
- 確認回應逾時只做讀回，不自動重送；成功讀回後，房東可明確再次確認。
  恢復核對唯一付款、帳單、回報、原始批准人與时间；不新增付款、不把批准
  歸給查看頁面的人。讀回僅恢復已提交交易，不掃每筆已完成歷史反覆寫入。
- `BPR-` 在正式服務鎖內再次比較精確整數金額，阻擋解鎖後的金額變動。
  若不可確認原交易狀態，保留 claim，管理者以同一 receipt/report/payment
  關聯核對，禁止直接刪紀錄或猜測已繳。

## 回退

先把 config.enabled 設為 false，停止並移除指定收信 handler 的觸發器；
再按保留的版本還原 Web App／前端。保留兩張附加表及已完成付款，
不可用回退程式碼來刪掉財務交易。已確認款項如需更正，沿用既有受控沖正程序。
檢查通知中心及最後一次掃描結果，確保未處理款項仍可人工核對。

## 證據與未驗收項目

Node VM 覆蓋合成 Gmail API → 擷取／匹配 → 保存／通知；另實際載入
`V2_PAYMENT_SETTLEMENT.js` 驗證正式付款寫入、尾端失敗恢复、金額競態。
新增 route 實際驗證 GET／裸UID／query credentials／過期session／membership變動。
手機390×844合成預覽無橫向溢出，銀行按鈕高度至少44px；配對確認及手動選帳單
可完成合成狀態轉換。此預覽沒有登入、呼叫正式 API、讀真實信件或發 LINE。

Gmail／Drive connector、clasp 身份、真實轉寄標頭／格式、收款帳戶遮罩及 serving
source 已核對。附加 Schema migration 與正式環境 parser 測試已完成。
Apps Script Gmail OAuth／API、觸發器、Web App／Pages發布、LINE 手機收件
及正式銷帳仍 **UNVERIFIED／未執行**。

API 行為依據：[Gmail search timezone](https://developers.google.com/workspace/gmail/api/guides/filtering)、
[LINE request retry](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/)。
