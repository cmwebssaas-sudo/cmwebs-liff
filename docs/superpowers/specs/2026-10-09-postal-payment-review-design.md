# 郵局入帳通知與房東確認銷帳

使用者於 2026-10-09 明確要求按本流程實作。建議 gpt-5.6-terra / medium。
此為標準化、明確授權的新增付款輔助工作項目；不宣稱為 V2 blocker，
也不授權 Production release、帳戶設定、Sheet migration 或 LINE 發送。

## 已確認的產品流程

1. 定期讀取指定 Gmail 的郵局入帳通知，保存金額、台北入帳時間、
   收款帳戶、付款銀行、轉出帳號後五碼、郵件及通知識別。
2. 以收款帳戶唯一解析 Workspace；首次以金額找唯一未繳帳單；已確認
   付款帳戶則同時比對 Workspace、銀行、後五碼、租約及金額。
3. 配對完整：通知房東「收到入帳，待確認銷帳」，提供確認與更改配對。
   配對不上：通知「收到入帳，但無法配對」，提供選帳單及其他款項。
4. 只有已驗證且有 payment_write 權限的房東明確確認才沿用既有正式
   付款回報銷帳服務；成功後記住付款帳戶關聯。未確認帳單維持未繳。
5. 同一通知重寄不建立第二筆；通知與確認可恢復；不丟棄不同通知但同額
   同分鐘的款項。未知、歧義或金額不符一律人工處理。

## 實作邊界

- 增加入帳紀錄及付款人關聯兩張 additive schema；顯式 migration。
- Gmail REST API 使用 gmail.readonly；設定只存在 Script Properties。
- 支援郵局直寄及設定的可信轉寄來源；手動轉寄標示來源供房東核對，
  不把轉寄內文視為已驗證的郵局原信。保留 Gmail message ID，不存整封信。
- 既有付款審核頁增加入帳區塊，保留原付款回報流程及 fixed mobile shell。
- 新 route 僅接收 POST body 的 Email session 或 provider-verified LINE ID token，
  忽略用戶提供的 Workspace、房東或金額，重新核對當前 membership。
- 明確設定及顯式 trigger installer 後才收信；預設停用，不在本次操作正式帳號。
- 本次交付包含來源、測試、設計、API/Schema/測試紀錄與 release/rollback runbook。

## 驗收

合成信件 → 擷取 → 配對 → 通知 → 房東確認 → 正式付款服務 → 記住帳戶；
另測同額歧義、跨 Workspace、代付、已繳、金額變更、並行/重試及逾時讀回。
真實收信、OAuth、觸發器、LINE 收件及實際帳单交易均另列 UNVERIFIED。
