# 維修／清潔工單原型（本機合成資料）

此原型用來驗證多家廠商、多工種優先順序、報價、施工回報與房東驗收的流程。它是隔離的本機開發工具，不是已接入 CMWebs 正式帳號的功能。

正式獨立工單服務的部署與驗收紀錄見 [雲端部署文件](../vendor-work-orders-cloud/README.md)。本目錄的 server 與 fixtures 仍僅供本機合成測試；共用 domain 規則由雲端 Worker 引用。

## 本機啟動

需求：Node.js 22 以上。在 repository 根目錄執行：

```sh
node _dev/vendor-work-orders/server.mjs --development
```

瀏覽器開啟 <http://127.0.0.1:8787>，使用畫面提供的合成測試身分，例如 `landlord_a`、`landlord_b`、`company_a_manager`、`company_a_worker`、`company_a_worker_2`、`company_a_contact`、`company_b_worker`、`individual_worker`。公司管理者可報價、拒絕邀請及接受固定價工作，並須指定公司內啟用的管理者／施工者；只有被指定的人員可開始施工、上傳附件及回報完工。公司窗口是唯讀角色，個人廠商可自行回覆並執行自己的派工。這些身分不是 LINE 登入，也不代表真實房東、公司或施工人員。完成後在執行伺服器的終端按 `Ctrl+C` 停止。

「其他工種」需填寫具體名稱（例如油漆、剪枝、除草）；順位、固定價約定與工單會依工種名稱精確配對，避免把不同工作誤配給同一廠商或價格約定。

填寫流程：建立工作先填工作標題、工種與必要區域；物件代號、詳細位置及作業說明放在選填區。建立後選擇廠商並詢價；沒有順位設定時預設手動指定。合作資料修改、公司成員、優先順位與固定價約定均按需展開。廠商報價先填主要費用與有效期限，材料、稅費及工期可在明細調整；收合不會刪除已填資料。

伺服器只綁定 `127.0.0.1`，不對區域網路或公網開放。原型不呼叫 LINE、Apps Script、Google Sheets、正式 API 或外部廠商，也不應放入真實個資、聯絡資料或工單附件。

LINE webhook 只提供隔離測試的簽章驗證與好友狀態記錄：啟動時若由程式注入
`lineWebhookConfig.channelSecret` 與 `providerId`，可使用 `POST /api/line/webhook`。
伺服器會先驗證原始 body 的 `x-line-signature`，再以事件 ID 去重；`follow` 不會
自動建立成員，`unfollow` 只停止推播資格。通知 adapter 預設關閉，只接受已核准
membership、仍在好友狀態且明確列入白名單的單一測試 subject；超時回傳
`unknown` 並沿用同一 retry key。這些是本機合成測試能力，不是 LINE 收件或正式
推播證據。

## 本機資料與重置

- 合成狀態保存於 `.codex-local/vendor-work-orders/state.json`；伺服器重新啟動會保留資料，但登入 session 需要重新建立。
- 私有附件保存於 `.codex-local/vendor-work-orders/attachments/`，不在靜態網站目錄下，只能透過有權限的本機 API 讀取。
- `.codex-local/vendor-work-orders/` 已由 Git 忽略。若要重新建立空白示範資料，先停止伺服器，並將上述**精確的兩個資料路徑**另行備份或移出，再重啟；不要清除整個 `.codex-local` 或 repository。若資料需要保留，不要重置。
- 此原型使用單一伺服器程序及本機 snapshot store；不要同時啟動多個程序共用同一資料檔，也不要把本機 store 當作正式資料庫。

## 本機驗證

```sh
npm run validate
node --test tests/vendor-work-orders-*.test.mjs
npm test
```

測試覆蓋與執行結果記錄於 [TEST-MATRIX.md](./TEST-MATRIX.md)。

介面使用繁體中文；既有示範廠商名稱、成員職責、登入身分、金額與系統提示以中文呈現。內部識別代號及已保存資料保持相容，不需清除本機資料。

## 尚未驗收／明確不在本原型範圍

正式或獨立 staging 部署、真實 LINE OA 登入／通知、LINE 對外發送、iOS／Android 實機鍵盤與媒體操作、真實廠商邀請及實際維修驗收均尚未執行。這裡的瀏覽器互動與測試只使用本機合成資料。預設 GitHub Pages 發布流程不包含 `_dev/`；不可把本機原型描述為已發布或已接入正式系統。
