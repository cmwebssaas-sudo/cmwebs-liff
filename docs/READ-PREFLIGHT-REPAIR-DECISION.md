# C3：首次唯讀綁頁停止後的一次性就地修復草案

建議模型／速度：GPT-6.1 Sol／高，涉及既有停止與計次邊界。
狀態：**待房東決定；未授權、未實作、未執行修復或重新綁頁。**

## 已發生的事與責任

首次預查保留原25次歷史，建立原counter的首次claim。caller綁頁先扣一次，
接收分頁的本地變數未先宣告；控制器回報STOP。原工具是否已完成綁頁無法
由該回報還原，故保留 `P:caller-bind = UNKNOWN`，累積 **26／160**。
這是本地執行錯誤，不是房東登入錯誤，也不是已證明的Google拒絕。
沒有呼叫試驗RPC、續期、建立資源或更改遠端設定。

原控制器已確認停止並排空。現有批准禁止重用P、重開停止的普通IO或換綁
控制器／copied recovery；因此不能以程式修正之名自行恢復。

## 提請一次確認的最小例外

只對這次**尚未發出任何RPC／遠端變更的首次綁頁失敗**，允許一次有界修復：

1. **保留同一counter、claim、epoch、原expiresAt與台北日**，不延長窗口、
   不退款、不清除UNKNOWN、不另開counter或重新seed；累積上限仍160。
   原controller／copy／counter／checkpoint／stop紀錄均完整留存。
2. 允許製作、測試、審查一個**只適用本事件的canonical修復入口**及相符的
   新controller／recovery pins；這是對「原pins不更換」的當次例外。
   不直接手改ledger、registry或刪stop marker來救回普通IO。
   新入口必須核對原binding、完整原checkpoint及唯一既有P UNKNOWN、spent26、
   version1、nativePlan null、無RPC／C／I／其他遠端準備事件、原日與期限。
   唯一事件的counter路徑、epoch、binding、完整checkpoint hash、原controller／
   copy pins、原expiresAt已列於repo外私下manifest：
   `/private/tmp/cmwebs-c3-approved-preflight-20261016/repair-incident-manifest.json`。
   該manifest SHA-256：`2f231f4b4de097d932281735fac8337f0c59c36cd7bfcc5c892eda4827a8c2f1`。
   只接受這組固定值；任一不符即停止，不能套用到其他失敗或任意counter。
3. 只允許**一次caller唯讀重綁**，限定原已核准caller、本人已顯示的原URL與
   唯一 `getTab` 呼叫。先從原N研究額度扣一次並保存UNKNOWN，再進工具；
   它占用N最多8次中的1次，並占原N＋G32，不新增額度或P格。
   原P一次的UNKNOWN原封保留。不得自動改網址、換帳號、搜尋分頁或再試。
4. 綁頁完成後，只有新鮮工具狀態核對到原caller／目的頁、原scope已settled，
   且同日同期限時，才能由canonical入口保存一次性完成紀錄並恢復普通準備。
   caller／頁面證據必須來自該唯一getTab回傳；不足就STOP，不免費補做
   snapshot／AX／帳號讀取。不得把本地變數宣告成功、工具ACK或較早截圖
   當成本次身分／頁面證據。只允許處理本事件已固定的既有STOP；修復期間
   或之後任何新的owner stop／stop marker均優先否決，不能被修復完成紀錄
   覆蓋。原STOP歷史完整保留。
   未完成或不明就繼續STOP；保留新增扣額，沒有第二次修復／重綁。
5. 成功後才可繼續原尚未使用的publisher-bind，以及剩餘最多7次N預查。
   refresh／userinfo／A–E／handoff前，仍須完整接線、實際IO成本地圖及原
   相應准入條件；RPC前須實際before G及F15，並保留完整after成本；
   RPC後才做實際after G、F15與終態，不得提前當作已通過。四窗的完整
   身分／quota／來源證據及原所有門檻都保留。
   本例外不直接授權RPC，也不能將修復或P綁頁視為quota／效能驗收。
6. 修復入口須一次性、防replay、single-flight、UNKNOWN預扣、owned-lock／
   drain及copied cleanup測試與獨立審查通過，才可執行。
   新舊recovery不得各花一次來重複還原；原C2／I17全域仍各一次，H1、T3、
   每分鐘10次、六分鐘token/runtime、15秒簽章與900秒／台北日均保留。
7. 到期、跨日、失去原holder、來源／checkpoint不符或工具再次失敗，一律停止。
   不延長或重開本例外；原確有必要的獨立cleanup依原能力處理。
   此次沒有遠端變更，不能執行空白callback後宣稱已完成遠端回退。

新增範圍只有上述一次性控制器修復、相符pins及一次計次唯讀重綁；
沒有新增費用、Scope、Source Viewer、正式資料存取、授權對象或試驗RPC次數。
原24小時並行觀察、逐頁啟用、上線後七日觀察與實際效能／真機門檻不變。

## 風險、拒絕與回退

這會花掉原N研究額度的一次，剩餘空間更小；不是保證可完成試驗。
修復／授權／完整接線若趕不上原期限，本次普通IO仍停止，不自動換epoch。
若不同意，維持26／160與原STOP，保留所有程式、CI、counter／UNKNOWN及
原GAS回退；沒有本次新Google操作。若同意後仍失敗，不再重試本例外，
如實保留新扣額及未完成狀態。原正式開關off，T0未開始。
