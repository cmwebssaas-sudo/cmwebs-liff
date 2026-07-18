# 安全與 Secrets

## 不得提交

- LINE Channel Access Token
- LINE Channel Secret
- Google OAuth secrets
- 私鑰
- 完整銀行帳號資料匯出
- 房客身分證件
- 正式試算表備份
- 個資測試樣本

## Apps Script Properties

建議 key 名稱可提交，但值不可提交：

```text
LINE_CHANNEL_ACCESS_TOKEN
PAYMENT_REMINDER_SPREADSHEET_ID
ENVIRONMENT
```

## API 安全風險

現行 API 主要依 LINE UID 與 Workspace access，V3 前需強化：

- LIFF ID token server-side 驗證
- 防重放
- 請求簽章
- 速率限制
- tenant isolation
- 敏感欄位遮罩與加密
- 操作稽核不可修改

## 銀行帳號

- 無權限只回傳 masked account
- 前端不得把完整帳號放進 log
- V3 應使用加密儲存
- 匯出與客服查詢需權限與稽核

## 測試資料

測試 UID 可記錄在非秘密設定，但測試仍需限制：

- 單一測試房客
- 禁止批量公告
- 禁止大量催繳
- 禁止以 production data 做 destructive test

## 依賴

前端 CDN 依賴需 pin 版本並建立 CSP／供應鏈評估。V2 若使用 Chart.js，必須固定版本。
