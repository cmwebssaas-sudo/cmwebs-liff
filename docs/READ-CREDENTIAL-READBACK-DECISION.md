# 單次合成試驗：憑證續期與身分讀回用途修訂

建議模型／速度：GPT-6.1 Sol／高；此處涉及既有授權與計數邊界，延續目前模型審查。
狀態：**待房東明確同意，尚未執行本修訂的 Google 操作。**

## 修訂原因

本地中繼資料顯示 publisher 既有 access token 的宣告期限已過，仍有既有
refresh grant。尚未向 Google 續期或驗證。原生頁面帳號、本地檔案雜湊與
到期時間，都不能證明續期所得 token 的實際持有人。

已批准的 [單次試驗決策](READ-TRIAL-MINIMUM-DECISION.md) 將 P4 明定為
原生準備、G 的身分格明定為原生讀回，故不能把 OAuth 網路操作改標籤算入。
本文件提出以下兩項用途修訂，須取得當次同意；不增加總額或 Scope。

## 唯一用途變更

| 子桶 | 修訂後用途 | 硬上限 |
| --- | --- | ---: |
| P caller | 一次 caller 綁頁／初始狀態讀回；不做瀏覽器清單 | 1 |
| P publisher | 一次 publisher 綁頁／初始狀態讀回、一次既有 grant 的 OAuth 續期回應，以及一次同 token 身分 GET | 3 |
| G 各窗口的 identity | 由原生身分讀回改為該 actor 同一 token 的一次 Google userinfo GET；caller／publisher 前後各一次 | 每窗1，共4 |

P 仍為4，但 actor 分配由2／2改為1／3；G仍為32；每個原生窗口其餘上限仍是4頁、2次控制／設定讀回、
1次配額。原生頁面擷取仍須確認目前帳號，並與該 token 的已驗證身分及原核准
actor 一致；不得用 API 身分取代完整原生窗口、來源、配額或新鮮度證據。

固定身分端點沿用既有 OAuth adapter：
`https://www.googleapis.com/oauth2/v2/userinfo?fields=email%2Cverified_email`。
必須回傳已驗證 Email，僅於私下記憶體比較核准 actor 的雜湊；token、Email、
原始回應不得進 repo、PR、commit 或公開紀錄。publisher 的 P 身分 GET 必須
在第一次 publisher 準備 IO（包括 A–E 的讀取、source PUT 與 grant）之前通過，
不得等到 handoff 後的 G 才驗明。P 身分回應不可重放為 G 證據；P/G 新分配合計最多
五次身分 GET（P publisher 一次、G 四次），均已明列且不另借格。原固定
E7 的 caller-userinfo 另一次完整保留，故全流程共六次 userinfo GET；E1 已在
固定96內，不增額、不刪除或重放該查核。
每個窗口使用該次實際憑證，
不得用較早一次身分回應重放。caller 維持原三個 Scopes；publisher 維持原既有
管理授權，回傳 Scope 必須符合原固定清單，不增加 grant、Scope 或帳號。

## 執行與失敗邊界

1. 兩個綁頁必須使用私下已知且可驗證的原生執行頁 reference／tab ID，
   不另外列出瀏覽器、搜尋帳號或猜測 tab ID。若不存在可用 reference、綁頁
   不唯一或初始頁不是預期 actor，STOP；不補做清單或第二次綁頁。
2. 所有網路讀取／續期，在 IO 前通過原 counter、claim、鎖、每分鐘槽位與
   durable debit。失敗與未知均照扣；續期最多一次，不補送、不另做免費查核。
3. pin 既有 publisher grant／client 的本地來源；續期不請求新 Scope、不覆寫
   既有登入檔、不持久保存新 token。檢查回應形狀、期限及既有 Scope；不符合
   即 STOP。續期成功本身不算身分證明，須再通過已分配的同 token 身分 GET。
4. publisher 與 caller 必須各自吻合原核准身分，publisher 不可代替 caller。
   原生頁面、token 身分或固定 actor 任一不符，保留 UNKNOWN 並 STOP。
   若需要額外登入、導覽、查詢或第二次續期而超出對應子桶，停止而不借桶。
5. 續期 publisher access token 只保留在受控程序記憶體，結束時丟棄；不撤銷
   原既有 publisher grant。caller 的原 I17 撤權／回退仍獨立保留。
5. 真正執行前，所有準備、前後各15項查核、四個完整原生窗口、原未知終態
   查核與 rollback 的實際接線，仍須完成測試／審查及准入；本文件不批准
   缺少證據時執行 RPC，也不代替本人新 caller 憑證操作。

## 全部保留的限制

累積上限160、歷史已花25、原 receipt／counter／epoch 均保留。固定96＋G32＋
P4＋T3＝135，加歷史25為160。不得退款、重設、另建零歷史 epoch、互借桶；
C2還原已在C9內，I17不得挪用。仍只准一次 wrapper→library compatibility，
不跑 qualified、authority 或 oracle；10次／分鐘、單一 in-flight、六分鐘
runtime／token 餘命、15秒簽章與900秒／台北日限制不變。

不新增費用、正式表存取、原表／library source Viewer、Scope 或服務。
同步／shadow 並行24小時、房源先行與後續穩定24小時、上線後七日觀察，以及
所有隱私、撤權、資料新鮮度、效能與真機門檻均保留；24小時 T0 尚未開始。

明確同意前仍採原 P/G 用途，新續期與 API 身分讀回維持 STOP。批准後以補充
決策雜湊綁定控制器，保留原決策與歷史 receipt，不覆寫成舊用途已批准新操作。
