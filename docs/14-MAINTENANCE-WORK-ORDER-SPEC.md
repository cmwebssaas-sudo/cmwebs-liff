# V2 報修工單規格

## 現況

已有：

- 房客訊息
- 報修分類
- 緊急程度
- maintenance 成員通知
- 房東訊息狀態更新

但尚未形成完整工單。

## 建議資料表

```text
V2_maintenance_tickets
V2_maintenance_ticket_updates
V2_maintenance_attachments
V2_vendors
```

## 工單狀態

```text
submitted
triaged
assigned
scheduled
in_progress
waiting_approval
completed
tenant_confirmed
cancelled
```

## 必要欄位

- ticket_id
- workspace_id
- property_id
- room_id
- tenant_id
- contract_id
- category
- title
- description
- priority
- status
- assigned_user_id
- vendor_id
- preferred_time
- scheduled_at
- estimated_cost
- approved_cost
- actual_cost
- cost_responsibility
- completed_at
- tenant_confirmed_at
- created_at／updated_at

## 流程

```text
房客提交
→ 團隊分類
→ 指派
→ 預約
→ 報價／核准
→ 處理
→ 完工照片
→ 房客確認
→ 費用歸屬／帳單追加
```

## V2 驗收

- 房客可提交並看到狀態
- 團隊可指派 maintenance 或 vendor
- 可更新時間、成本與處理紀錄
- 可上傳至少圖片連結／Drive attachment
- 完成後房客可確認
- 報表能統計待處理、完成時間與費用
