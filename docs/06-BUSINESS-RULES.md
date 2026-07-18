# 核心商業規則

## 身份與手機

- 台灣手機標準格式：`09xxxxxxxx`
- `+8869xxxxxxxx`、`8869xxxxxxxx` 必須正規化為 `09xxxxxxxx`
- Google Sheets 手機欄位必須使用文字格式
- 讀到 9 位且以 9 開頭時，補回前導 0
- 不得只依手機號碼授予跨 Workspace 權限

## Workspace 與角色

角色：

```text
owner
admin
manager
accountant
maintenance
viewer
```

基本原則：

- owner／admin 可修改 Workspace 設定
- accountant 可處理付款與收款帳號（依權限欄位）
- maintenance 接收報修／房客訊息
- viewer 僅檢視
- 自訂權限欄位可擴充角色
- 所有查詢與寫入必須限制目前 Workspace

## 房間與帳務預設

新增房間未填值時，使用 Workspace 設定：

- `default_payment_day`
- `default_management_fee`
- `default_deposit_months`
- `default_electricity_fee_rate`
- `summer_equipment_fee_rate`
- `regular_equipment_fee_rate`
- `summer_month_start`
- `summer_month_end`

計費值優先順序：

```text
房間
→ 租約
→ Workspace 設定
```

既有資料不得因 Workspace 預設變更而被批次覆寫。

## 押金

- 新增房間的預設押金金額＝月租 × 預設押金月數
- 使用者手動修改後，不再由租金輸入自動覆蓋
- 退租時押金是負債，需要獨立結算，不可當作當月租金收入

## 夏月與耗損費

- 夏月月份不可硬編 6–9 月
- 支援跨年度區間，例如 11–2 月
- 新房間可保存當下的 `equipment_summer_months`
- 帳單月份決定夏月或一般月份費率

## 付款

現行 V2：

```text
銀行轉帳
→ 房客提交回報與末五碼
→ 房東／會計核准
→ 帳單結清
```

- 支援手動結清與重新開啟
- 尚未支援部分付款、溢繳、退款與自動銀行對帳

## 自動催繳

- 每小時 Dispatcher
- 每個 Workspace 可設定：
  - 啟用狀態
  - timezone
  - 發送小時
  - 提醒天數
- 錯過提醒日時，只補送目前應進入的最高階段
- 同一 `bill_id + stage` 成功後不重複
- 歷史最高成功階段可防止設定改動後降階重送
- 最終階段完成後的下一天轉人工處理

## 團隊通知

事件與預設收件人：

| 事件 | 收件角色 |
|---|---|
| 付款回報 | owner、admin、manager、accountant、`can_approve_payment` |
| 合約事件 | owner、admin、manager、`can_edit_contract`、`can_terminate_contract` |
| 房客訊息／報修 | owner、admin、manager、maintenance |
| 帳單建立 | owner、admin、manager、accountant |
| 催繳 | owner、admin、manager、accountant |
| 入住 | owner、admin、manager |
| 公告結果 | owner、admin、manager |
| LINE 異常 | owner、admin、manager |

通知偏好關閉時：

- 保存事件
- 建立通知中心紀錄
- 不發送 LINE

## 測試模式

`test=1` 使用固定測試 LINE UID，但仍執行真實寫入與 LINE 發送。任何測試頁都不得將其描述為完全安全的 dry-run。
