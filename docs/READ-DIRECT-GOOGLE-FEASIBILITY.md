# C1／C3 Google 直接唯讀可行性試驗 — 合成範圍已核准

建議模型／速度：`GPT-6.1 Sol`／高（新的權威讀取與副本一致性需安全審查）。
2026-10-13 房東明確同意下列合成可行性試驗。狀態：**合成試驗已授權；Google 端
白名單投影 gate 尚未證明；原型未實作、未部署**。此決策不授予正式表存取或正式啟用。

本決策只核准合成環境的可行性試驗。它修改原計畫的資料取得方式，不放寬驗收。
Google Sheets 保持唯一正式資料；所有業務寫入仍由 Apps Script 執行。正式 Worker 讀取
維持未啟用，候選六個開關保持 off；三日同步、七日 shadow、效能、500 房與真機驗收
全部保留。

## 為何需要這個決策

- C1 已停止的 914 次分鐘觸發器實耗 2,892.886 秒，超過原定每日 900 秒；失敗全部保留。
  335 秒的 IDLE 核心延遲落在 Cache handle／getAll 區段。新手動樣本的 Script guard
  2–6 ms、Property handle 1–10 ms，沒有支持它們是大延遲根因；也未重現或解決長尾。
- C3 已核准每次向 GAS 取得不快取的權威確認。使用成功的 bulk reader 後，三次严格
  1,500 ms 請求仍全部逾時；另外標記為診斷的首標頭時間為
  2,547.023／2,660.057／2,726.958 ms。這是 33 列合成資料，不是正式效能驗收，
  也不構成所有未來 GAS 請求必然失敗的證明。
  10/13 去除 padding 的 HTML 合成診斷亦完成：三次診斷保留原簽章／nonce／權限驗證，
  每次一個成功 bulk，首標頭 2,937.959／2,264.110／2,893.820 ms；完整
  2,951.322／2,266.999／2,898.482 ms，三次严格 1,500 ms 均失敗。
  它使用本地 HTML envelope 適配，不能冒充原 canonical HTTP 的成功或正式提速。
  六個原生執行皆終態；第一次 strict 的平台耗時 212.683 秒也保留，沒有把它丟掉。
  原始 10 檔已還原，既有 v1–v6 保留。
- 目前沒有通過的修正，不能啟用正式 Worker 路徑。這個試驗檢查另一條可行路徑，
  不宣稱 Google API 一定較快，亦不宣稱現有架構已被證明無法改善。

## 比較的兩條路徑

| 路徑 | 本次能做什麼 | 尚未證明 |
| --- | --- | --- |
| 直接 Google API 合成試驗（建議） | Worker 每次直接讀 Google 最新權威欄位；評估 Worker 排程讀副本所需欄位 | 新存取設定、權限／JSON 對帳、配額、實際延遲與三日穩定性 |
| 維持目前 GAS 路徑 | 保留目前實作、失敗紀錄與未啟用的 Worker 路徑，繼續有界調查 | 目前仍缺符合 900 秒／日及頁面效能目標的修正 |

## 試驗範圍與執行次序

1. **先做 C3 權威唯讀原型。** 使用專用機器身分，只授予現有 C3 合成測試試算表的
   Reader 存取，不授予正式試算表、整個 Drive 或網域代理。OAuth 權限只允許 Sheets
   read-only；Google 管理 API、寫入方法與自報目的地皆拒絕。機器憑證只進 Worker
   Secrets，由房東本人完成新憑證輸入；不複製本機 clasp 的人員管理憑證到 Worker。
2. **先驗證 Google 端白名單投影能避開欄位變動競態。** 「先讀表頭、再按位置取值、
   事後拒絕」不足以保護隱私：兩次讀取間移動欄位可能已把銀行／驗證碼等值帶進
   Worker。僅用合成 canary 測試插入、移動、重新命名與讀取中變更欄位，必須證明
   回傳給 Worker 的位元組根本不含非白名單值，不能只證明最後回 401／503。
   取得這個安全機制的實際證據是先行／否決 gate；不假設 API 有未證明的條件讀取能力。
   未通過就保留 GAS，不取得正式表存取，也不繼續直接取值原型。
3. 通過投影 gate 後，每次使用已驗證 LINE／Email 身分直接讀五張既有權威表必要
   欄位：sessions、users、workspaces、workspace_members、landlords。日期、空值、行號
   與角色／principal 規則對帳既有 GAS。這改為信任固定 Google HTTPS API 回應，
   不偽裝成 GAS 簽章確認。
4. 不快取正向權限、session 狀態或來源列；可快取機器 OAuth access token，這不等於
   快取房東授權。權威結果仍須與 D1 當次權限一致。來源讀取失敗、超時、歧義、超量、
   schema 改變、撤銷、停權或不同權限均拒絕 Worker 讀取，接回既有 GAS fallback。
   兩分鐘寫後保護保留；這份權威確認仍不保證營運副本已同步。
5. 通過 C3 合成安全／效能測試後，才做 **C1 Worker 排程讀取原型**。它亦須先通過
   營運表白名單投影／欄位變更 canary gate。先給專用身分
   C1 合成表 Reader 存取，每分鐘僅用固定檔案的 Drive metadata 觀察變動；必要時以
   Sheets API 讀當次白名單欄位，重用既有列雜湊、分批、原子完成及 stale 拒絕規則。
   Drive 權限僅 metadata read-only。metadata 不確定不能宣稱副本最新，需完整白名單
   對帳或保持不可供讀取。每日 03:00 台北時間完整對帳保留。UTC 排程換算與實際執行
   都須讀回；metadata 只作變動提示，不以未變動的 metadata 更新 D1 的 freshness
   或假造完成的同步 run。當日對帳亦不能代替分鐘延遲／失敗後的安全供讀判斷。
   既有 pending／lease／未完成 snapshot／接收中新版本／20 表完成與 26 小時 guards
   須等效保留；auth fingerprint 一致、同瀏覽器寫後保護或 metadata 相同均不足以
   證明副本最新。「auth 未變，但 bill／room 改動尚未送達 D1，metadata 尚未反映」
   必须為拒絕供讀或 GAS fallback 的負向 case。
   GAS Cache 標記與既有推送仍保留作為回退，試驗不啟動兩套競爭排程。
6. 原型的 C1 與 C3 仍各用自己的 worktree／PR。先完成本機對帳、審查、有限手動測量
   與還原準備，再在測試環境開始一段全新的實際 72 小時。既有失敗日不併入新窗口。

## 配額與費用門檻

正式採用前必須量測讀取負載，不能把 500 房測試誤稱 500 位同時登入。Sheets 預設
每專案 300、每使用者每分鐘 60 次讀取；一個 service account 亦算一個使用者。
每次權威確認若有兩次 API 讀取，就會消耗兩次配額，超量須退回而非使用過期權限。
這可能限制規模，必須在報告中呈現。[Google Sheets limits](https://developers.google.com/workspace/sheets/api/limits?hl=en)

有限手動試驗至多 40 次 Google 讀取，包含表頭、值、metadata、重查與任何重試；
應用層至多每分鐘 10 次。開始前讀回實際專案
配額與已有用量。排程試驗另須核對既有 Workers Paid／D1 帳號剩餘用量，限制 CPU、
讀寫量與執行次數，遇到配額錯誤停止或有界退避，不無限重試。
標準 Google API 使用目前沒有額外費用，但官方說明較晚可能對超量計費；
Workers／D1 超額亦可能計費。本次同意不包括開通付費 Google 方案、增加配額或新增
任何費用；若需要就另詢問，不承諾整個帳號零增額。
[Drive limits](https://developers.google.com/workspace/drive/api/guides/limits?hl=en)、
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

## 必須保留的測試與判定

- LINE／Email、六種角色、跨 Workspace、偽造身分、過期／撤銷、停用 user／Workspace、
  成員停權或改角色；特別測「Google 來源已改，但撤銷同步完全未送達 D1」。
- 原始 GAS 與 Worker 的授權 fingerprint／六路由 JSON 對帳；日期／空值／排序／行號、
  多次讀取中變更表頭或資料、缺表、429／403、斷網、慢回應、錯誤 schema、超量都需測。
- 延遲記錄 Google 請求、Worker／D1 與完整使用者流程；保留每次失敗，不用 fallback
  成功冒充 Worker 提速。0.8／1.5 秒與原有超時仍保留，任何改目標須再請房東決定。
  GAS 與直接路徑的對照使用相同資料集、區域與超時，冷／暖樣本分列，不跨條件比較。
- C1 連續三日的變動／撤銷／新增／刪除／每日完整對帳與所有平台耗時；Google API、
  Worker CPU／D1 用量和任何剩餘 GAS 同步耗時分開報告。所有剩餘 GAS 同步工作仍須
  符合每日 900 秒，不能把 GAS 分鐘工作移成 Web App 呼叫後從帳務中隱藏。
- 只有完整 gate 通過才續既有 C5 七日／C6 逐頁與真機；本次試驗同意不是正式啟用同意。

## 回退與本次決策

停止新增的測試 Worker 排程、還原原 Worker／GAS 版本及試驗前的零 GAS 觸發器狀態，
不自動重裝已失敗的分鐘／每日排程。保留測試資料與
所有失敗證據。正式開關始終 off；如未來正式採用，也保持既有 GAS 讀取 fallback。
移除專用機器身分的測試表 Reader 授權與 Worker 機器 Secrets，不修改人員憑證。

房東已選：**同意上列合成可行性試驗**。同意只允許上述
分階段試驗與必要的測試資源設定；新增存取的實際授權／新憑證輸入仍由房東本人處理。
正式試算表的新機器存取、正式架構替換與任何新增費用，均須另行提出具體結果取得同意。

## 2026-10-13 先行投影研究與否決邊界

獨立審查已實際開啟 Google 官方文件及 Discovery；尚未呼叫帳號 API、建立資源、
取得新存取或輸入機器憑證。下列研究不能冒充實際 Google canary 通過：

- `DataFilter` 只支援 A1、grid 與 developer metadata，沒有「header cell 等於白名單
  名稱才返回值」的條件。JSON field mask 也不篩選資料儲存格內容。
  [DataFilter](https://developers.google.com/workspace/sheets/api/reference/rest/v4/DataFilter)、
  [field masks](https://developers.google.com/workspace/sheets/api/guides/field-masks)。
- Metadata 跟隨欄／列位置，但未契約保證 header rename 使其失效；Google 明示
  project-visible metadata 不應作安全機制。NamedRange 同樣獨立於 header 值，
  消失的名稱還可能解析成同名 sheet，不能據此視作白名單投影。
  [metadata](https://developers.google.com/workspace/sheets/api/guides/metadata)、
  [NamedRange](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets#NamedRange)、
  [名稱解析](https://developers.google.com/workspace/sheets/api/guides/concepts)。
- 兩個 ByDataFilter 讀取方法的 reference 及官方 Discovery 只列 `drive`、
  `drive.file`、`spreadsheets`，未列 `spreadsheets.readonly`。不能為實驗擴大 scope。
  [getByDataFilter](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/getByDataFilter)、
  [batchGetByDataFilter](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/batchGetByDataFilter)、
  [官方 Discovery](https://raw.githubusercontent.com/googleapis/discovery-artifact-manager/master/discoveries/sheets.v4.json)。
- Tables 的 `TableName[ColumnName]` 已有公式支援文件，但 REST `values.batchGet`
  記載的 range 是 A1／R1C1。REST 是否接受、rename 是否拒絕及原子解析契約均為
  **UNKNOWN**。只有取得可信原子契約後，才可能作安全候選；有限 canary 沒重現洩漏
  不足以宣稱正式 gate PASS。公式／IMPORTRANGE 更新延遲亦不能作最新撤銷權威。
  [table references](https://support.google.com/docs/answer/15637642)、
  [batchGet](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/batchGet)、
  [IMPORTRANGE](https://support.google.com/docs/answer/3093340)。

若有符合專用 Reader／readonly 與原子白名單契約的候選，先按上述 40 次／10 次每分鐘
預算做合成支援探查；不支援即停止，不退回 A1 或更大 scope。Canary 須包含 private
欄插入／移動、header-only rename、重複 header、range retarget／rename／同名 sheet、
強制 precheck 後變動及 ABA；在 HTTP body bytes 邊界檢查 nonwhite sentinel，僅保存
布林／長度／結果。任何 nonwhite bytes 均否決。來源撤銷且舊 view／D1 未更新的案例
另行拒絕；投影成功不替代最新權限判斷。

目前判定為 **NOT_PROVEN**；維持原 GAS、正式六開關 off。授權已收到，不能把
這項技術門檻誤記為等待房東批准，也不能在尚無安全候選時要求房東提供憑證。
