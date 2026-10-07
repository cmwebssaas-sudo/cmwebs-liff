# 維修／清潔工單原型（本機合成資料）

此原型用來驗證多家廠商、多工種優先順序、報價、施工回報與房東驗收的流程。它是隔離的本機開發工具，不是已接入 CMWebs 正式帳號的功能。

## 本機啟動

需求：Node.js 22 以上。在 repository 根目錄執行：

```sh
node _dev/vendor-work-orders/server.mjs --development
```

瀏覽器開啟 <http://127.0.0.1:8787>，使用畫面提供的合成測試身分，例如 `landlord_a`、`landlord_b`、`company_a_manager`、`company_a_worker`、`company_b_worker`、`individual_worker`。這些身分不是 LINE 登入，也不代表真實房東、公司或施工人員。完成後在執行伺服器的終端按 `Ctrl+C` 停止。

伺服器只綁定 `127.0.0.1`，不對區域網路或公網開放。原型不呼叫 LINE、Apps Script、Google Sheets、正式 API 或外部廠商，也不應放入真實個資、聯絡資料或工單附件。

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

## 尚未驗收／明確不在本原型範圍

正式或獨立 staging 部署、真實 LINE OA 登入／通知、LINE 對外發送、iOS／Android 實機鍵盤與媒體操作、真實廠商邀請及實際維修驗收均尚未執行。這裡的瀏覽器互動與測試只使用本機合成資料。預設 GitHub Pages 發布流程不包含 `_dev/`；不可把本機原型描述為已發布或已接入正式系統。
