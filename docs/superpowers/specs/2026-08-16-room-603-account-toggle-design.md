# 603 房客帳號開關設計

## 目的

讓正式環境既有的 603 測試房客可以恢復登入與資料讀取，並由房東物件頁隨時停用或重新啟用，不修改帳約、租金、付款或帳單歷史。

## 最小變更

1. 將 603 的 V2 canonical tenant、contract、room 狀態與舊資料來源對齊一次。
2. 新增 `landlord_room_account_toggle`，只接受 `active`／`inactive`，並以現有 Workspace landlord write permission 驗證房間歸屬。
3. 開關只更新 `V2_rooms.account_status`；房間的 `room_status`、合約狀態、帳單與付款紀錄不因開關改變。
4. 房客 runtime 在解析房間時拒絕非 `active` 房間，房東物件頁顯示「房間帳號：啟用／停用」開關。
5. 操作寫入既有稽核紀錄，並同步更新 `updated_at` 與操作者欄位。

## 不在範圍

- 不刪除或重建 603 的租約、帳單、付款資料。
- 不修改 LINE UID、LINE OA 設定、Production token 或其他 Workspace。
- 不將 staging 資料複製到 Production。

## 驗收

- 603 `account_status=active` 時，房東物件頁可見且房客 runtime 不因房間帳號狀態拒絕。
- 切換為 `inactive` 後，房間不再通過房客 runtime，且可由同一個開關恢復。
- 既有合約與帳單欄位保持不變。
- `npm run validate` 與受影響測試通過。
