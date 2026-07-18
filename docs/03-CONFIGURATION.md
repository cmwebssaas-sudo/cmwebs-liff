# 專案設定

## 公開端點

| 項目 | 值 |
|---|---|
| GitHub repository | `https://github.com/cmwebssaas-sudo/cmwebs-liff` |
| GitHub Pages base | `https://cmwebssaas-sudo.github.io/cmwebs-liff/` |
| Apps Script Web App | `https://script.google.com/macros/s/AKfycby5n2iXv0z5Y99dpBATTkKHaF56bnHNZRdMmVh5aZKU8ciGa_Nc0vJzXaO120LT81X6Og/exec` |
| Tenant LIFF ID | `2010314940-iJB1D6sN` |
| Tenant LIFF URL | `https://liff.line.me/2010314940-iJB1D6sN` |
| Landlord LIFF ID | `2010314940-EjX1qbb8` |
| Landlord LIFF URL | `https://liff.line.me/2010314940-EjX1qbb8` |
| Default timezone | `Asia/Taipei` |

## 測試 UID

| 身份 | LINE UID |
|---|---|
| 測試房東 | `Uf708ece75c9c985cfe1dbda48d123511` |
| 測試房客 | `U3615a7ed919c1a4a438a246c10784d70` |

## 高風險測試規則

`test=1` 只會替代 LINE UID，不代表 dry-run。

在 `test=1` 下仍可能：

- 寫入正式 Google Sheets
- 建立正式帳單
- 修改正式設定
- 發送真實 LINE
- 變更房客、租約、報到或公告狀態

測試發送時必須限制單一測試帳號。

## Secrets

以下內容不得提交 repository：

- LINE Channel Access Token
- LINE Channel Secret
- Google OAuth client secret
- 實際銀行完整帳號備份
- 第三方 API key
- 正式使用者個資匯出

Apps Script secrets 應使用 Script Properties。

## 待改善

目前多數 HTML 仍硬編：

- API URL
- LIFF ID
- 測試 UID

Production consolidation 後應建立單一環境設定生成流程，避免每頁分別修改。
