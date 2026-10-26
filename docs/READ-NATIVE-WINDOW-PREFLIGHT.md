# 原生用量窗口：離線證據與執行前門檻

建議模型／速度：GPT-6.1 Sol／高。狀態：**原生 collector／160 可執行預算未通過，
RPC 維持 STOP**。本文件整理既有快照，不新增授權、請求或費用。

## 目前可驗證的證據

離線 `read-authority-native-snapshot.mjs` 只讀由可信操作流程提供的原生 AX 文字。
固定主畫面 URL、核對帳號 hash、六個獨立欄位、台北日期與毫秒秒數；不輸出
原始 Email、專案或函式名稱。輸入 `referenceAt` 是離線參考時間，不能當成
Google 簽署的 capture／quota timestamp。未識別 duration／type、非終態、
重複文字指紋及新增列提示都保留；重複列仍全部計入可見 duration 下界。

既有兩頁各 200 列，逐欄解析後均落在歷史參考時間的前 24 小時、仍有下一頁。
兩頁 `liveView=false`，也都仍含新增列提示。提示可能是舊訊息，因此不能斷言
關閉 live 後資料仍變動；也不能以 switch=0 證明 pagination 是一致快照。
原合計 duration 的離線重算與私下舊 receipt 一致；保留為**可見列下界**，
不是帳號配額用量或「Google quota exceeded」證明。原始快照、名稱、Email、
個別列及計算結果只留私下，不提交 repository／PR。

解析結果固定 `complete=false`、`quotaAccepted=false`、`trialAccepted=false`、
`perUserAttributionVerified=false`、`nativeExecutionIdsAvailable=false`。
最後一頁也不能自動變為通過。文字指紋不是 Google execution ID；不得用它
去除看似相同、其實可能是兩次執行的列。模組不產生 driver 的 native proof。

## 正式依據與推論界線

[Google dashboard 文件](https://developers.google.com/apps-script/guides/dashboard)
描述 My Executions 同時包含有 owner/editor/viewer 存取權的專案及代本人執行。
因此，**不能把有權看到的列直接視為全部由這個帳號執行**。
[Google quota 文件](https://developers.google.com/apps-script/guides/services/quotas)
的 trigger runtime 是 per-user，consumer 90 分鐘、Workspace 6 小時，重設規則
為首請求後 24 小時；成熟 Workspace 還有付款累積及 60 天條件。
完整窗口、帳號種類、執行歸屬與剩餘 quota 仍須實際證據，不以所有權、付費
badge、台北午夜或部分 duration 推論。

[processes.list 文件](https://developers.google.com/apps-script/api/reference/rest/v1/processes/list)
有 by/on-behalf-of-user 的語意，但要求 `script.processes` Scope。目前既有
管理憑證十個 Scope 和已批准 caller 三個 Scope 都不含它。沒有申請或呼叫此
API，也不以既有 token、試探拒絕或自動刷新擴權。本地試驗仍走已批准原生
觀測設計；若將來要改為 API 路徑，須另做具體範圍修訂及房東決定。

## 後續 collector 的完成條件

1. 真正操作只能透過已批准的原生瀏覽器工具；每個新導航／設定／分頁讀回先
   等 rolling slot 再 durable debit，未知結果保留，無退款或自動重跑。
2. 分別讀回 caller／publisher 身分、完整 all-project 窗口、日期／種類／終態。
   本人執行歸屬，或完整涵蓋本人執行的保守上界，以及一致排序／分頁／時間
   界線要另證；未能證明就 STOP。完整且涵蓋本人的上界可保守查核 headroom，
   但不能改稱精確 per-user 用量；部分列既不是完整上界也不能接受 quota。
3. 六分钟尾段與來源新鮮度門檻保持；等待耗掉新鮮度或跨台北日即 STOP。
   原生用量放在 release observer 的最後，不能拿舊 snapshot 當新 proof。
4. 全部四次 before/after observation、控制設定、身份讀回與分頁成本先納入
   同一 160 上限，保留已花 25 與獨立 cleanup 17。舊 G=8 的一頁假設已否決；
   F/A–I 明細及未分配零單位不能因此變成足夠。不能先跑第一個 RPC 再看額度。
5. 匯入／Reader／Testing／client／library publication 與 exact restore 的 adapters
   及 orchestration 仍須完成。所有 strict performance、900 秒／日、三日同步、
   七個實際 24 小時 shadow、500 房及真機門檻照原計畫保留。

這些條件完成後才安排需要房東本人的新憑證操作。當前只完成可核對的離線
診斷，沒有新建表、grant、client、token、Properties、trigger、部署或試驗 RPC。


## 離線可執行預算的計算邊界

`read-authority-trial-budget-plan.mjs` 固定保留127未來 A/B/C/D/E/F/H/I 操作，
I17獨立、C2已包含C9。G要求八個窗口（wrapper／qualified各before／after，
每次caller／publisher）的頁數、控制setup、身分、quota、未知終態查詢成本
逐項明示；null保持未知，不預填0。額外管理讀回也要計數與審查。

目前只是數值compiler，不能驗證Google一致分頁／帳號歸屬／完整上界或配額。
原六欄counter25/160新鮮讀回後，八窗口×五成本類別共40項UNKNOWN；
minimum160不表示total160，實際total為null且budgetFits false。
一頁／其他成本0是假設示例160；publisher每次3頁是假設168，不是目前頁數
證據。歷史兩頁否決歷史一頁假設，不得固定成未來每次一定3頁或使用舊用量
證明現在窗口。任何budgetFits true也只有算術，executionAuthorized仍false。

這項本地20案例／完整1435已通過、review無P1/P2；原生collector／完整執行
預算仍未通過。沒有新導航、counter升級、資源／憑證／RPC或scope變更。


## 原生讀取候選的原子准入與不可重認領紀錄

`read-authority-native-capture.mjs` 透過控制器 externalRead，在 rolling wait、
durable debit 後才進入唯一 callback，鎖保持至 entered IO settled；即使 caller
未 await，也不能提前釋放。四 phase×兩 actor、200列 sequential page、nonce、
full AX envelope與本地時間／大小檢查皆固定。它仍是注入 producer 的本地
候選，尚無實際 bound-tab CUA broker；導航、綁 tab、設定、身分及 quota 成本
必須另列，不能隱藏在這一讀取中。nonce及時間是可信 producer／本地 clock
主張，不是 Google 簽發證明。

callback前寫入 immutable intent／UNKNOWN；原文私下0600、目錄0700保存。
external completed receipt先保存 capturedAt、raw SHA及 analysis digest，才更新
mutable journal；resume重 hash／重 derive，torn pair STOP。永久 path→epoch
claim阻止 journal遺失後換 epoch 重跑；unknown／stop及舊 claims不能刪除。
摘要不含原文名稱或 Email，頁面文字只作資料，不 eval／當指令。

native18／control31共49測試與完整1457通過；review兩個P2由三個精確RED後
一次修正，無minor／二次review。當前實際25/160未變，沒有新導航或 account
IO。complete／quotaAccepted／trialAccepted／perUserAttributionVerified／
nativeExecutionIdsAvailable仍false，部分列與最後一頁都不能作完整quota proof。
完整實際窗口、quota／freshness、160可執行budget、same-ledger／recovery／
全程orchestration及所有原計畫門檻仍待完成；低階adapters也尚未改用原子准入。


## 原子 API 接線與 runtime observer，實際准入仍未完成

六個準備 adapters 已固定 externalRead，完整 response body／decode 與錯誤
status／超額 body 的取消皆留在 callback ownership內；OAuth撤權回應的
處置也在獨立cleanup內等待settlement，HTTP200仍只有ACK_UNVERIFIED。
Reader 的五次metadata使用constructor固定的frozen cap，不能換輸入方法
绕過准入。runtime release/native observers新增短期atomic cap，先等待／
debit再IO；漏await或吞掉失敗拒絕RPC，entered IO結束前不放epoch lock。

兩個P2由精確RED後一次修正，相關412／完整1486通過，無minor或二次review。
原token getter在本地先固定／驗證，再於callback重查expiry，沒有refresh、
redirect、重試或退款。C2與I17仍獨立，未知／spent／stop不清除。

目前實際25/160未升級；READ-NATIVE-BUDGET-DECISION.md的320尚待批准。
真正CUA producer、完整窗口／quota、新鮮度、guard／GCP／Testing／client、
same-ledger handoff／可信recovery／全程orchestration及原始real gates皆未
通過。這輪不代表Production／新憑證／RPC可用，不開始實際Google操作。


## 已綁定頁面 producer 的本地候選

`read-authority-native-producer.mjs` 固定 constructor 提供的兩個不同 tab handle
與 getAXState 方法，一次 full AX／emitfalse；不選 tab、導航、改設定、截圖、
存檔、扣額或認定 quota。它只在 atomic capture callback 內由可信 orchestration
使用。nonce／本地clock／method echo 不提供 Google attestation；真實 CUA
runtime 接線、tab binding及完整窗口仍須驗證並各別計數，目前未執行。

單一 admission ownership 防同一 scope 的 ordinary/C/I 或 runtime observer
重疊；callback 入口重查 ordinary stop，已扣額保留、獨立cleanup不被停用。
18 producer測試含真實合成Python flock/fake AX；相關436／完整1510通過。
原始 complete／quotaAccepted／trialAccepted 等判定仍 false；實際25/160
未變，320提案未批准，same-ledger handoff/recovery/orchestration與原門檻不變。


## 實際工具執行環境的純本地接線

CUA runtime 本地模組／Python flock／producer／capture可同處執行；fake tab
測試讀1次，合成扣额25→26先於callback、peer拒絕、raw0600，全部acceptance
false。首probe因ambient process缺失在spawn前STOP，私下失敗紀錄保留；
固定PythonPATH與允許os.userInfo().uid修正，沒有匯入被禁止的node:process。
兩精確RED／相關73／完整1512／review無P1/P2/minor通過。

此證據限於純本地工具realm相容性，不是實際tab binding、原生Google頁面讀取、
完整一致窗口或quota驗收。actual25/160、未批准320、shared ledger／handoff／
recovery／orchestration及原 real gates不變；未測自訂Python位置或身分切換。
