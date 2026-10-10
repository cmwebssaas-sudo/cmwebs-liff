# CMWebs 原生報修與派工整合交付候選

日期2026-10-10；建議模型/速度 gpt-5.6-terra / medium。
工作包 WO-PARTNERS-01，使用者明確確認原生整合設計並要求實作。
Branch `codex/repair-dispatch-integration-20261010`，base `e7fd413`。

## 已接入的產品流程

原房東「房客訊息／報修」頁的每張報修卡片提供「安排處理／派工」；同一工單
ID 與原 Workspace。可自行處理、公司/個人合作對象與多人角色、工種/物件順位、
固定價或報價、指定施工者、完工說明與私有照片、追加費用核准、補修及驗收。
原房間歷史不改房客/租約快照，原房客讀取自己的公開進度；舊 status update
無法繞過派工驗收。費用只作工作紀錄，不新增付款、扣押金或修改租約/帳單。

廠商邀請從既有 `tenant-bind.html?repair_invitation_id=<opaque-id>` 進入。一般
房客綁定不受攔截；只有邀請分流到受限工作回覆。LINE provider 驗證後显示自己的
合作身份，由房東核對登記，轉寄連結不能單獨授權。用原 API/LIFF constants，
不建立第二套房東登入/Workspace。`vendor-repair.html` 僅為相容轉址入口。
LINE 參數於 liff.init 後重新讀取，符合
[LINE 開啟 LIFF 說明](https://developers.line.biz/en/docs/liff/opening-liff-app/)與
[LIFF login redirectUri 範圍](https://developers.line.biz/en/reference/liff)。
現行 Console endpoint、scope、真實 provider/手機回跳仍需發布前核對。

通知先以明確人工分享邀請運作，狀態 `manual_required`。未向真實廠商送 LINE，
也未設定自動順位通知/新排程。既有獨立 workorders Worker/D1/R2 不參與本次
房東身份或工單資料權威，保持原樣。

## 本地驗證

- 基線699/699通過。
- 完整 `npm test`：723/723 通過；本次 workflow、routes、UI regression 24/24 通過。
- `npm run validate`：61 backend files parse、38原 Web App references匹配、cache驗證通過。
- 實际 Apps Script 函式以 Node VM 的合成 Sheet/Drive/identity 邊界執行。
- 本機 Chrome390/1280以實際共用 UI＋同一 workflow 驗證自行處理、補價/補修/驗收；
  公司多人報價→指定施工者→完工→房東驗收也通過；browser errors 為0。
  PNG/JSON 全合成，不含真實房客、附件或帳務。
- 本地 browser QA helper 位於 `release/repair-dispatch-local-proof/verify-browser.mjs`，
  使用 `CMWEBS_BROWSER_MODULE_ROOT` 指向可用 Playwright package，無需正式API。

- 獨立只讀審查後修正：廠商照片上傳回應套用白名單、每次核對原 Workspace 啟用狀態、
  指定施工者降為 contact 時立即撤銷施工/完工/上傳能力；回歸及複查通過。
- `git diff --check` 通過；新模組 top-level 名稱無跨檔重複。

## 正式發布前的固定步驟

1. 另取得本候選正式發布範圍；fresh fetch main、核對變更與其他修復，不從 dirty root發布。
2. 原專案 serving/editor HEAD唯讀完整匯出、版本與Web App指紋核對；保留當時rollback。
3. 執行受影響及完整 regressions、validate、syntax、diff-check；更新 release cache tag
   及公開 manifest，不能沿用舊快取標籤直接發布改過的原入口。
4. operator確認原 Spreadsheet 身份後執行 additive `repairDispatchMigrate_()`，核對10表頭。
   不 backfill/重寫原報修或房客資料，保留 legacy訊息歷史。
5. 設置獨立私有 repair Drive root 的 property；只記錄key presence，不將值提交Git。
6. 建立immutable Apps Script新版、完整export與候選逐檔比較，維持現有正式Web App URL；
   原入口/shared scripts經正式流程發布Pages，逐檔公開讀回。
7. 原房東登入＋同Workspace/跨Workspace測試；真實合作測試成員從LINE邀請登入，
   驗證收到/報價/接單/照片/房東驗收及換房客隱私。不得以local/HTTP/provider接受取代真機。

## 回退與風險

正式環境本次尚未改動，當前 rollback 版本未即時核驗，不猜版本號。
候選回退為撤銷本分支來源變更；將來發布則原Web App指回當次備份immutable版本、
Pages恢復發布前revision，保留附加事件表、私有附件及已完成的驗收歷史。派工期間
不允許盲目改舊status來假裝回退已完成；若撤回UI，先凍結新派工並核對未結工單。
不因本次整合刪除舊獨立服務或迁移D1資料。

journal逐表掃描、完整快照與45000字元上限是目前容量邊界；達上限拒絕新增而不刪歷史。
人工分享不等於自動發送或LINE送達；真實file/provider/手機尚未驗收。

## Authorized production publication 2026-10-10

User explicitly requested Production deployment. Fresh main e7fd413; serving223 and editor HEAD each60 files byte-identical to main. Private rollback exports: /Users/hans/CMWebs/cmwebs-repair-production-pc6erl41. Candidate HEAD and immutable224 each61 files byte-identical; original manifest/scopes unchanged. Original Web App now224; other4 deployments unchanged. Owner editor initializeRepairDispatchStorage completed:10 headers and private folder ready. Only additive empty table, dedicated private folder and one folder property created; no business repair/partner/billing rows written. No new triggers or LINE sends. Shared frontend tag20261010-repair-dispatch-v1;724/724 tests and validate pass. Rollback same Web App223/editor HEAD backup223 and Pages e7fd413; preserve event table/private attachments. Real phone LIFF/upload/acceptance unverified. Pages readback follows.

Publication verified: PR249 merged7241f2e419099db349e65a22dac1cb3f7b5d1c46; Pages build status built; npm run verify:production confirms50 public files byte-identical. Anonymous GET returns AUTH_METHOD_REQUIRED; anonymous POST returns AUTH_REQUIRED. Existing LINE login flow was opened but did not establish an authenticated landlord page; real business dispatch/upload/acceptance and physical device remain UNVERIFIED. Storage execution proof is privately saved at the rollback export directory/storage-initialized.png. No production repair/partner/billing test rows were created.
