# V2 退租與押金結算規格

## 目標

完成租約生命週期閉環：

```text
退租申請
→ 點交
→ 欠款與費用結算
→ 押金扣除／退還
→ 房客確認
→ 租約封存
→ 房間恢復空房
```

## 建議資料表

```text
V2_move_out_cases
V2_move_out_charges
V2_deposit_settlements
V2_move_out_attachments
```

## 狀態

```text
requested
scheduled
inspection
calculating
awaiting_tenant_confirmation
refund_pending
completed
cancelled
disputed
```

## 必要資料

- 申請與預定退租日
- 實際點交日
- 退租電表
- 鑰匙歸還
- 房況與照片
- 未繳帳單
- 最後一期水電
- 清潔費
- 損壞扣款
- 違約金
- 其他費用
- 原押金
- 可退金額
- 退款銀行資料
- 房客確認或爭議
- 退款日期與交易末五碼

## 計算原則

```text
可退押金
= 原押金
- 未繳帳款
- 合法且經確認的扣款
- 違約金
```

每一筆扣款必須有：

- 類型
- 金額
- 說明
- 證據
- 建立人
- 房客確認狀態

## 完成動作

- 租約狀態改為 ended／archived
- 房間改為 vacant
- 清除 active tenant 關聯
- 保留歷史租約與帳單
- 通知房客與團隊
- 報表更新押金負債
