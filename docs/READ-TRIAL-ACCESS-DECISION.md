# 合成試驗存取與讀取額度決策

建議模型／速度：GPT-6.1 Sol／高，依 Google 身分、發布及回退邊界。
狀態：**房東已於 2026-10-14 批准新合成表與累積 160 次第一階段。
實際已花 25 次全部保留；完整原生查核與可執行預算尚未通過，未送試驗 RPC。**

## 現況與需要決定的變更

原 C3 合成指令碼的 parent 是原合成表。Google 明列表格 Viewer 可查看
綁定的指令碼，兩者共用 ACL，因此不能同時授原表 Reader 又禁止原 library
source Viewer。[Google bound-script 規則](https://developers.google.com/apps-script/guides/bound#access_to_bound_scripts)
尚未授予该 Reader，也沒有實際無 source Viewer 的 RPC 成功／失敗結果。

已建的獨立薄指令碼與未連帳單 Cloud 專案保留；OAuth 為外部 Testing，
Apps Script／Sheets API 已啟用。唯一指定呼叫者與所有 ID 保存在私下資料。
原 Source、serving、default GCP、Properties 及正式開關未改。

原 scope 問題提出時已花 14 次：原始準備 12，加管理 OAuth Scope 查核與一次
目的地防護拒絕的 ACL 查核。後續原生唯讀預查再花 11，現累積 **25／160**。
全部保留，拒絕或未完成讀回不退款；不得將問題中的 14 當成目前已花次數。原完整 gate 的兩次 authority、兩次同源 native oracle
和兩個 compatibility 探查，光執行至少 30，尚未含設定與前後讀回。
本次第一階段只允許 compatibility，不會送出那些 authority／oracle。
既有管理 OAuth 雖沒有 Sheets Scope，Google Sheets API 仍接受其既有
`drive.file`。因此不能用缺少 Sheets Scope 當隔離證明；本試驗依職責禁止
管理 token 用於 Sheets，固定由專用 caller 做 Sheets metadata GET，不新增 Scope。

房東批准依原 gate 順序執行的第一階段：

1. 以原發布者既有 `drive.file` 匯入本地的完整 20-tab 合成 XLSX，建立一份
   **全新且未綁原指令碼的表**；禁止 Drive copy 原表。只複製合成 fixture，
   不匯入原始碼、正式資料、巨集或外部資料連結。唯讀契約仍限原五張授權表。
   建立 intent 與 fixture hash 先保存；未知建立結果不重建。
   本地 XLSX 實際20張，含合成列表 view；先前19張描述已更正。ZIP preflight
   證明沒有巨集、公式、外部連結或外部 relationship；沒有上傳或印出資料值。
   這不替代 Google 匯入後的 metadata／型別核對，五張授權表契約與額度不變。
2. 唯一指定帳號只獲新表 Reader、同一試驗專案的 Testing 使用者及原入口的
   caller 白名單。原表／original C3／library source 存取必須為 none；有群組、
   domain、公開分享或不完整 ACL 而無法證明 none，就停止。原來源 ACL 尚未證明。
3. **累積上限改為 160**，保留實際已花 25 與原提案 hash／歷史。此次明確
   scope 決定已批准上限；不退款、不另開零額度 epoch/journal、不重 seed。
   每分鐘 10 次、單一 in-flight、900 秒／台北日與六分鐘 runtime 預留不變。
4. 首先只送兩個 `compatibility`：固定 wrapper 及 qualified library 入口各一次。
   正確 Google caller、三個原 Scope、無 original source Viewer，必須實際讀回。
   結果只能為固定布林，不讀列、不動 nonce／dirty／lease，不初始化 authority
   cache budget。任何非預期結果即停止；不重試 RPC，不發 `authority`。

此階段驗證 Google 入口的第一個否決條件。完整 C3 授權、來源新鮮度、Google
白名單／型別、跨路徑共享狀態及效能 gate 繼續列為未通過。原 0.8／1.5 秒、
500 房、真機、C1 新的三日同步、C5 七個實際 24 小時 shadow 都保留。
後续依序完成原 gate；本階段成功不允許正式採用或切開關。

## 準備順序與 Scope

先完成本地控制器、固定目的地 adapters、完整原生用量 observer 與回退審查。
舊目的地防護仍只接受 OAuth／Script；Drive/caller Sheets 的新唯讀 metadata
adapters 本地候選限定四個 alias，固定檔案／路徑／GET、actor／既有完整 Scopes，
不得輸入 URL／query／method、redirect／retry／pagination。它們不會繞過舊
guard，尚未接入實際管理工具；待本地完整測試、審查及可執行預算通過才可使用。
匯入與 Reader grant／remove adapters 已完成本地候選測試及一次審查修正，
仍未實際接線；發布／精確還原等 adapters 尚未完成，不得擴權。一次性 OAuth callback
已完成本地候選測試與一次審查修正；實際接線及新憑證操作尚未開始。

再逐項做下表準備。原 10 檔／manifest／serving／v1–v6/default GCP/零觸發器
先私下備份及核對；暫存 library source 建不可變版後，**先 exact 還原 editor
並讀回**，才安排新憑證。原 secret 保留在原 Properties，薄入口不複製 secret。
只配置試驗 caller／script／contract／epoch；不更改原測試表綁定，不跑 oracle。

薄入口使用已建的新 standard GCP，原 C3 保持 default。兩份 manifest 固定
原三 Scopes、V8、台北時區、NONE logging；只有薄入口 API executable。API
`ANYONE` 仍搭配 Testing 一人及兩層實際身分／project guard。

管理端新檔案建立、分享／ACL metadata 使用既有 Drive Scope；Sheets metadata
只由新呼叫者的 `spreadsheets.readonly` 憑證讀取，限 spreadsheet／timezone／
tab ID metadata，不要求 `includeGridData` 或值。field mask 有效時 Google 會忽略
`includeGridData` 旗標，所以 privacy 由固定 metadata mask 加回應欄位白名單
雙重限制，不將一個 false 旗標當保障。原始資料型別與白名單須留待
後續實際 gate；本階段配置的 headers 來自已 pin 的 fixture。

房東本人建立這個專案的 Web OAuth client，輸入新 client secret、完成登入、
三 Scope consent 及短效 access token；不存 refresh token。呼叫端採一次性
state、PKCE S256、`access_type=online`，只接
`http://127.0.0.1:34763/oauth/callback`；listener 只綁 loopback，port 被占用即停止，
不猜其他 URI。callback 不記錄
code/token。Scope、caller/client/project 不符或回傳 refresh token 就停止。
這些憑證操作要在上述發布／還原與 adapters 審查完成後才安排。
callback 本地40案例／相關326案例與完整1264案例通過；審查發現的 receipt IO
阻斷撤權及 claimed listener 關閉後繼續授權，已以回歸修正（未再審查）。
Google 撤權影響同專案所有 client 的 grant／token，實際隔離專案須先讀回；
HTTP200 只記 ACK_UNVERIFIED，另做撤權驗證。Web client 的 PKCE server
支援尚未由實際試驗確認，失敗即 STOP，不改為無 PKCE。完整原生窗口、
160 可執行預算與發布／精確還原等門檻未完成前，不得請房東操作。

scope 已批准，尚不能執行 RPC。以下本地準備須逐項驗證、審查及讀回後，
才會安排新憑證：累積 160 的已批准 receipt 匯入（私下準備 counter 已保留 25／160，
尚未初始化實際 trial journal）、保留 I 的
17 單位 cleanup 硬額度、原生導航／管理 IO 的先扣款、十五項 observer 先等
rolling slot 的控制、固定目的地 adapters 與一次性 OAuth callback。
同步 signer、跨 realm Promise 拒絕與六分鐘 token 餘命的控制器修正，另列
本地測試證據；不視為 Google 身分、原生用量或可存取性的證明。
本地控制器新增先等待 rolling slot、再另行扣款的能力；沒有批准 receipt 時
仍使用原40上限。批准路徑須保留累積歷史，且不得動用獨立 cleanup 預留。
十五項合成 pre-release 案例不是四次實際完整 observation、native用量新鮮度
或實際160額度接線的證明。實際 adapter 的順序、每次 native／管理 IO先扣款與獨立
cleanup硬額度仍待完成，不能因這項本地能力開始取憑證或呼叫 Google。
原生 `readNative(phase, control)` 的鎖內等待／扣款接口也已加入本地控制器；
尚未連結 Google UI collector，不能以本地 proof fixture 代替實際完整用量。

## 逐項保守額度

每個 API response 或新的原生管理／設定讀回保守算一單位；內部原生用量
dashboard 也列入導航成本。列出的是這個操作方法，不推斷 Google 未觀測的
其他流程免費。任何需要更多請求的實作先改清單、重新審查；不能先執行。

| 階段 | 固定操作 | 單位 |
|---|---|---:|
| 已花 | 持續保留的準備、拒絕與原生預查紀錄 | 25 |
| A | 原 project／editor／versions／deployments／v1 content 五個 GET；原 Cloud／triggers／試驗 Properties 備份三個原生讀回；原 container ACL 一個 GET | 9 |
| B | Drive multipart 匯入一個 POST、檔案 metadata GET；原 ACL 新鮮否決查核、新 ACL baseline／固定 caller permission ID 查詢／Reader create／ACL read 五個請求；native 新表與五張 auth tab ID 六個導航讀回 | 13 |
| C | library source PUT／version POST／固定版 content GET／原 editor restore PUT／content GET／versions GET／deployments GET；原試驗 Properties 寫入及讀回 | 9 |
| D | 薄 project／空白 source 備份兩 GET；新 GCP 連結；source PUT／version POST／固定版 content GET／deployment POST／deployments GET；薄 Properties 寫入及讀回 | 10 |
| E | Testing 一人寫入／讀回；本人 client 建立／讀回；一次性 OAuth 回應／token exchange／userinfo 身分核對 | 7 |
| F | 每個 RPC 前後各一次完整 release observation，共四次；每次下列十五項 | 60 |
| G | 兩個 RPC 各一次 before／after 原生用量，兩帳號各一頁完整 rolling 24h／台北日資料 | 8 |
| H | wrapper／qualified 各一個 compatibility RPC，無內部讀表 | 2 |
| I | 新 deployment 關閉／讀回 2、新 Reader 移除／ACL 2、原與薄兩個 project 的 guard settings 各復原／讀回共 4、Testing 移除／讀回 2、短 token revoke／失效核對 2；原 editor／versions／deployments／project 四個 GET及零 triggers 原生讀回 1 | 17 |
| 樂觀下界 | 若 G 每帳號一頁成立；實際已否決此假設，不能執行 | **160** |
| 未分配空間 | 上述下界已餘 0，不能覆蓋未核定分頁／額外導航；沒有額外 RPC／重試建立 | **0** |
| 總上限 | 所有已花及新增操作累計 | **160** |

F 的每次十五項固定為：原 project/editor/versions/deployments、固定 library
content、固定薄 content/deployments、新表 ACL、原表 ACL 九個 GET；原 settings、
triggers、薄 settings、OAuth audience、OAuth client 五個原生讀回；caller
Sheets metadata 一個 GET。版本內容、guard／contract hash、Scope、角色、
Testing 名單與身份一律逐項核對，沒有預填 true 或用本地結果替代。

G 的每帳號一頁假設已在原生預查中否決：關閉 live view、移除預設存取權
篩選並選 200 筆後，前兩頁共 400 個相異紀錄仍均在最近 24 小時內，且仍有
下一頁。完整 all-account window／account type／maturity／remaining quota 均未
證明；不以部分 duration 或所有權推算 Google 配額。上表舊 G=8 僅為樂觀下界，
160 已批准不會使它成為可執行預算。先完成完整窗口及導航成本的本地 collector
設計與審查，若不能在 160 內保留 I 的 17，即維持 STOP，不先建表或取憑證。

若有下一頁、欄位缺失、
異步活躍執行或 duration/身份/時間不明，停止，不把第一頁當完整用量。
未知終態只核對原執行，限定可用終態額度耗盡後保留 pending，不送下一個 RPC。
I 的 17 單位不供終態查詢或任何探查使用。即使原生終態仍未知，也必須能用
這份獨立 cleanup 額度關閉新入口、Reader、Testing 與 token；撤權後仍保留
pending 與未知狀態，不宣稱既有執行已終止或整體回退完成。
兩帳號完整 all-project 用量及 consumer／已證明成熟 Workspace 額度分開核對。

每次 IO 前持有同一 epoch lock、fsync debit；失敗不退款。每分鐘 10 需要等待時
保留 lock，等待每次不超過 60 秒。十五項 observer 必須從實際已花 ledger
先計算下一個 slot、等到可用才 debit；不能先撞第十一個 debit 再 catch／重試。
等待跨台北日、expiry 或來源／權限有變就停止；最新 native usage 放在最後再核對。
原請求 15 秒規則保留：所有 awaited 查核／憑證完成後，以同步無 IO signer
才產生 canonical timestamp／nonce／MAC，簽完重查用量時間、token、日期及額度。
不延長簽章有效期，不使用 refresh。token 剩餘壽命必須容納六分鐘原生尾段。
回退額度先預留；不能把它用於探查。到台北日／expiry／不確定狀態即停止。

## 回退與房東決定

停止新呼叫，使用限定額度核對已發出的原生執行終態；原生未知時保留 pending，
持續拒絕新呼叫，但不阻擋獨立撤權 cleanup。關閉新 API executable、新表移除該 Reader、Testing 名單回零、撤销短
token，復原試驗 guard keys 的原值及存在狀態。私下 0600 備份可還原值，公開
只留 hash。原 10 檔／manifest／serving／v1–v6／default GCP／零 triggers 讀回。
保留新資料、版本、失敗、建立 intent 和所有已花 ledger；不刪正式資料或重設。
Client 可留在已無 caller access 的試驗專案供稽核，不依賴刪憑證作回退。

房東已明確同意上述**新無原指令碼綁定的合成表及累積 160 次第一階段**。
批准紀錄及 hash 私下保存，不公開帳號／ID／token。原生預查未通過與本地
成功均不代表 Google 入口、可執行預算或任何正式 gate 通過。其他可獨立
準備工作持續進行；不得新建零額度 epoch 或忽略後續 11 次預查花費。

官方方法來源：[Drive multipart/create](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create)、
[ACL scopes/pagination](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list)、
[API executable/scopes/native runtime](https://developers.google.com/apps-script/api/how-tos/execute)、
[online OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)。


## 2026-10-14 離線原生證據核對

新離線 parser 核對既有兩頁各200列、六個欄位、台北日期及 duration；私下重算
一致，沒有新 account IO 或扣款。兩頁都有下一頁、live 關閉及新增列提示。
提示可能是舊訊息，不據此宣稱 live-off 仍變動或快照一致。文字指紋不是原生
執行 ID，也不把 owner/editor/viewer 可見列當成精確 per-user 用量。
parser 永久輸出未驗收，不產生 RPC proof。原生完整窗口、歸屬或保守涵蓋上界、
分頁一致性與160可執行預算仍待完成；見 READ-NATIVE-WINDOW-PREFLIGHT.md。
已批准160／實際25與17回退硬額度不變；尚不安排新憑證或試驗RPC。


## 2026-10-14 Reader 回退目標的事前查詢

Reader grant 的回應若遺失，不能假設沒有建立權限，也不能重發 POST。先在
grant 前以固定指定 Email 查詢 grantee permission ID，私下持久保存 ID／綁定
hash／intent，才可能在 unknown grant result 時有明確撤權目標；不能等到
unknown 後才發現需要額外 ACL discovery。B 加一個 GET，樂觀下界更新159、
僅餘1；G 一頁假設仍已否決，**可執行160預算仍未通過**，不開始實際查詢。
累積160／已花25／獨立17不變，沒有擴張 Scope 或額度。

本地 metadata 候選新增 optional `callerEmail`，核對小寫 Email SHA256 必等於
既有 callerHash。未提供時仍只有原四個操作；提供且正確才有第五個固定
`caller-permission-id` GET。發布者既有十個 Scope、等待／先扣款／壽命查核、
4096-byte／UTF8／JSON、單一 in-flight、不 redirect／retry／refresh 保留。
回應只接受 kind／opaque ID，不回傳 Email／role，也不證明 source none。
實際管理工具尚未接入，不繞過舊 Script/OAuth 目的地 guard。

[Google v2 getIdForEmail](https://developers.google.com/workspace/drive/api/reference/rest/v2/permissions/getIdForEmail)
接受既有 drive.file／drive.metadata.readonly，回傳 grantee ID；
[v3 Permission](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions)
將 ID 定義為 grantee 識別碼，須以 opaque 字串保存，不作數字化。
此為跨版本目標準備的文件依據，不代替實際互通驗收。
[permissions.create](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/create)
預設會送通知 Email，未來固定 Reader adapter 必設 `sendNotificationEmail=false`；
同一檔案權限並行修改不受支援，所以 grant／remove 要由同一 intent/controller
協調。未知 grant 不能當成終態；即使撤權當下讀回無 Reader，仍不得据此宣稱
未知請求已終止或整體回退完成。完整 actor／原表 none／新表唯一 owner baseline、
新建 fixture receipt／固定 ID 綁定、grant intent、一次性 delete／獨立 ACL readback
及未知狀態處理仍要完成。這輪只準備讀取 ID，不執行任何 grant／delete／通知。


## 2026-10-14 固定 Reader 寫入候選

本地 reader adapter 依新建 fixture 的 trusted import-readback receipt 綁定 epoch、
新表 ID、fixture／publisher hash；這些輸入不是 Google 或 unbound 證明。實際
import／原生窗口／Scope／可執行預算仍須先完成，候選不允許提前操作 Google。

grant 一次流程：事前查指定 ID、原表 owner-only 否決查核、新表 owned/untrashed/
非 shared-drive metadata、新表 owner-only baseline。caller ID 不得等於 owner；
兩份 owner 必須同一 publisher。固定 POST 只有 user／reader／指定 Email，通知
明確 off；將 ID 與 grant intent 先私下 fsync，再發送。確認 reply ID／Email／role
及新表恰為 owner+指定 Reader，才標 Reader verified。原表／library none 的完整
實際證明仍由後續 release observer 完成，不能將局部 Container ACL 當作全部。

原 A 的 ACL 備份不重用為 grant 前的新鮮權限證據；B 再加一個原 ACL GET。
B 更新13，樂觀下界160／餘0；一頁 native 假設仍已否決，可執行預算維持 STOP。
原累積160／已花25／cleanup17不變，沒有實際 grant／delete／通知。

journal／registry／跨 instance operation lock 及獨立不可逆 stop intent 私下保存，
不因重啟／換路徑而重送 grant。remove 等待自己的本地 grant settle；其他 instance
仍持 lock 時，留下停止 intent 後拒絕並行 write，不猜測 stale lock 的存活狀態或
刪 lock 重啟。未知遠端 grant 終態仍未知，不能因本地 Promise 已 settle 而接受。

已知目標 DELETE 與另外一次完整 ACL GET 使用 remove-reader／verify-reader-removed
兩個獨立 cleanup action，callback 受 controller admission／durable debit 控制。
過期 epoch 可撤權，但 publisher token 仍須有效且為可信 cached getter，不刷新。
receipt IO故障不能阻断已知目標撤權。回退仍留已花／pending／unknown；無 Reader
只表示當下讀回，`rollbackComplete` 一律 false，不代替整體關閉及未知請求核對。


## 2026-10-14 固定 XLSX 匯入候選

本地 importer 只接受 trusted offline preflight 的 hash／size／20-tab／無
unsafeFeatures receipt，複製並固定 bytes，驗 ZIP signature／5MiB 上限；
不把 receipt shape 當 ZIP/XML 或 Google unbound／型別／隱私證明。私下原 XLSX
已重新離線核對同 hash、20 tab／28 entry、無 formula／macro／external link 或
relationship，沒有上傳或印出資料值。實際接線須使用這份已核對 artifact。

固定 multipart create 只有 synthetic name／Sheets MIME metadata 與完整 XLSX
media；不設 parents、不 copy 原表、不 share 或 delete。publisher 既有十個 Scope
及可信 cached getter，先等／扣款／再查壽命，私下 fsync intent 後才 POST。
已知合法新 ID 即使嚴格 reply 拒絕仍保存；原 ID 否決，未知不重建。一次固定
file GET 查 owned／untrashed／Sheets／非 shared drive，才產 Reader-compatible
readback receipt。registry／operation lock 防跨 instance 或重啟覆寫／重送；
stop persistence 前先設本地不可逆旗標，IO 故障仍取消當前操作。

[Google upload/import 文件](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
列明 multipart metadata/media、建立時以目標 Workspace MIME 轉換及 XLSX →
Sheets；同頁亦說明 pre-generated ID 不支援 Workspace conversion，不能以此
猜測 unknown 建立可安全重送。[files.create Scope](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create)
接受既有 drive.file。本地一次 POST+一次 GET 已含於 B13，樂觀160／餘0、
實際25／cleanup17不變。未知建立仍未知，保留新資料供稽核，不刪除或重試。
實際原生完整窗口／可執行預算／publication／exact restore／orchestration 及
所有既有 real gates 仍未通過；沒有實際 create／grant／credential／epoch／RPC。


## 2026-10-14 固定 library 發布／精確還原候選

本地候選以既有 builder 產 canonical library／manifest，不接受任意 source；
原10檔逐位元 source／六版本／projected serving config 的私下 backup receipt
綁 publisher／project／epoch／hash。固定7個 C API：library PUT、version POST、
固定版 GET、原 editor PUT／GET、versions／deployments GET。Response JSON
object 欄位順序不影響 hash，source 字串仍逐位元比較；未知寫入／version 不
重試、不猜號碼，局部讀回永不代表整體 publication／rollback 通過。

C 表內原 editor restore PUT 與 content GET 的**兩個已列單位**須各自獨立保留、
先 admission／debit 再 IO，ordinary stop／expiry 後仍能使用。這不增加160上限、
不借 I17、不新增額外讀回。候選要求 restoreOriginalEditor(action,io) capability；
**實際控制器尚未接線／驗證，不能以 fake callback 當已保留額度**。
STOP persistence／receipt IO 故障不阻擋已知 backup 還原；PUT callback 未被
admit 前不得先用讀回單位。PUT 已嘗試而回應未知則另讀回，但未知終態保留。

[Google updateContent](https://developers.google.com/apps-script/api/reference/rest/v1/projects/updateContent)
會取代所有現有檔案並改 HEAD，供 editor／trigger／development mode 使用；
候選不假設未證明的 CAS，實際 stage 前須原生驗證獨占合成 editor 窗口、
零 triggers／無活躍執行及備份。[version create](https://developers.google.com/apps-script/api/reference/rest/v1/projects.versions/create)
建立 immutable snapshot；[getContent](https://developers.google.com/apps-script/api/reference/rest/v1/projects/getContent)
可指定固定 version。這些 API 的文件及本地測試不代表實際 publisher／library／
serving／default GCP／Scope／privacy 已通過，十五項 release observation 均保留。

本地23案例及完整1365案例通過，審查兩個 P2 以 RED→GREEN 修正（未再審查）。
C9／B13／樂觀160／餘0、實際25／I17不變；原生完整窗口／可執行預算、
C restore capability、薄部署／guard／完整 orchestration 未完成前不取憑證。
沒有實際 editor／version／deployment／Properties／trigger／GCP 或試驗 RPC。


## 2026-10-14 準備控制器與 C 還原能力候選

本地 scope 透過 Python native flock 重用既有 `.lock` inode，不刪除或以檔案存在
猜測程序存活。鎖持有至已進入的 IO settle；callback 返還後 capability 失效，
未等待／吞掉的失敗皆否決，失敗立刻停止 ordinary，仍保留 C／I cleanup。
原 counter 六欄、approval／proposal／exact legacy hash／已花歷史皆保留，初始
舊請求以當下時間保守占 rolling window，先等再扣款。ordinary ceiling 為160
减尚未用 I17/C2；C兩個已列 restore action 各一次先 debit，readback 不得早於
restore admission；成功 C 不阻斷後續 versions/deployments 核對。

外部 checkpoint 及永久 path claim 防 same-path legacy／舊 upgraded counter
回退或換 phase重 seed；checkpoint 先保存再保存 counter，torn pair STOP而非
重建舊 ready。Null checkpoint 只標識未 admit 的初始升級。不得回退／刪除
counter、checkpoint、claim 或 unknown 紀錄；實際接線／修復／同 ledger handoff
尚須完成，候選不授權 Google 或 RPC。

[Python flock](https://docs.python.org/3/library/fcntl.html)提供共用 native 排他鎖；
[Node child-process](https://nodejs.org/api/child_process.html) 的 killed 只表示送過
signal，不能代表已終止。候選依 failed-spawn／exit／close 終態與已進入的
callback settlement 才清理自己的 child，不重啟未知 handle或刪 lock。

27本地案例／完整1392通過；四項審查問題由六個 RED案例修正，未再審查。
實際counter仍25／160，沒有升級或新增claim／account IO。I17/C2及樂觀160／
餘0保留；原生完整窗口、可執行budget、薄部署／guard／觀測、同 ledger handoff／
完整 orchestration 與所有 real gates 未通過前，不取新憑證或送試驗RPC。


## 2026-10-14 薄入口發布／獨立關閉候選

固定 libraryv7／thinv1，兩專案不得相同；exact 空白原 source 私下備份，canonical
wrapper／manifest 內建。五個 D API 與兩個 I cleanup 沿用既有清單，不新增額度。
唯一 API ANYONE entrypoint／config／完整單頁 inventory、publisher 十 scopes
及目的地皆固定，無 redirect／retry／refresh。backup receipt 不證明實際 GCP、
Testing、guard、scope、既有版本／部署為空；這些仍須原生 gate。

已知新 ID 先保存才嚴格驗 reply；同程序 receipt fault 保留關閉目標，程序遺失
且 ID 未保存仍 UNKNOWN，不猜測或重建。外部 publish-intent 防 ready-receipt
回退重送。I close／verify 各 once、admission 後記 attempted／debit；雙 receipt
失敗時 monotonic callback-admitted flags 防舊讀回抹除 DELETE 狀態。即使讀回
absence，未知 create／DELETE 不消除，whole rollback／trial acceptance 永遠 false。

23 案例及 local 實際 flock ledger／fake Google 整合、完整1415通過；review 一個
P2 exact RED 後一次修正，無 minor／re-review。薄 editor source 還原不在 D5/I2，
候選保留 synthetic wrapper／關閉 executable，不冒稱完整 rollback；额外 IO
必須先列明審查。crashed lock 不能憑存在／timeout 刪除，actual handoff 必須證明
holder 終止及可信 recovery。實際25／160／I17／C2不變，無 counter 升級或 Google
mutation；G8否決、native／guard／GCP／same-ledger／完整預算／orchestration
及原始實際驗收門檻保留，未通過前不取新憑證或 RPC。


## 2026-10-14 完整 compatibility 成本計算候選

[`read-authority-trial-budget-plan.mjs`](../scripts/read-authority-trial-budget-plan.mjs)
將已批准 A9/B13/C9/D10/E7/F60/H2/I17 固定為127未來操作；C2已在C9，
I17仍獨立，不重複加還原成本。八個 phase×actor 原生窗口逐项 pages／setup／
identity／quota／settlement 讀回計費，額外管理操作全部列入且標示待範圍審查。
null不當0；缺項／重複／負數／小數／history refund／非160上限／authority
stage拒絕。輸入僅原六欄counter、spent≥25，適用所有階段未開始前完整規劃，
不抵扣已完成階段或接受升級後counter。輸出不含私下hash，深freeze。

budgetFits只表示數值計畫總額可放入160，executionAuthorized固定false，
不證明實際來源／actor／approval／quota／新鮮度／完整窗口，也不取憑證或IO。
實際privatecounter25/160已新鮮讀回且原bytes未變；40原生成本仍UNKNOWN，
minimum160／actual total null／budgetFits false。假設一頁且其他導航皆0才
恰好160，假設publisher各窗口3頁則168；歷史頁數不得當目前或未來必然頁數。

20 RED→GREEN／independent review無P1/P2/minor／完整1435通過。仍需原生
collector、guard／GCP、完整可執行budget、same-ledger handoff／lock recovery／
orchestration及全部原始實際gate，才安排本人新憑證；counter／I17／C2不變。


## 2026-10-14 原子原生擷取候選與實際接線界線

新 externalRead 在共用 native flock內完成等待→持久扣款→entered callback，
失敗即停止 ordinary，獨立C/I仍保留。原生capture在IO前保存intent／UNKNOWN，
raw只留私下；external完成receipt綁時間、raw hash與分析digest，永久path claim
防遺失journal換epoch重 seed，torn pair STOP／no retry或退款。

Native18＋controller31／完整1457與validate通過，review兩個P2已由三個精確
RED案例一次修正。實際counter25/160六欄／I17／C2不變，無新Google IO或升級。
實際CUA producer／bound-tab broker尚未接線；一個getAXState的准入不能包含
未列導航／設定／綁tab。nonce及本地clock不是Google attestation，全部native
coverage／per-user／quota／trial acceptance仍false。既有低階wait/debit adapters
未遷移，same-ledger／handoff／recovery／160可執行預算／完整orchestration及
原始效能、900秒／日、三日同步、七日shadow、500／台北／真機門檻仍保留。
未通過前不取新憑證或試驗RPC，不以這輪local green當Production readiness。


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


## 單一 in-flight 與固定 producer 候選

準備控制器 ordinary／C／I 共用 admission owner，從等待、持久扣額到 entered
callback 結束前皆不放行第二筆。runtime observer 同樣單一 atomic read，失敗
後拒絕 ordinary；在扣額後、排入 callback 前收到拒絕也於實際入口重查停止。
已扣額不退回；未准入的 C/I 待第一筆 settlement 後仍可獨立執行一次，沒有
自動排隊或重做未知 remote IO。舊 split methods 在 atomic ownership 期間拒絕。

固定 producer 只接受已綁定且不同的 caller／publisher tab，固定 getAXState
方法；一次 full AX、emitfalse，無導航／綁定／screenshot／fallback／扣額。
nonce、frozen descriptor、本地 clock／raw4MiB 僅是受信任本地邊界，不是 Google
attestation。停止／未知／併發後永久拒絕新呼叫，已進入的 UI promise 仍等待。

四 overlap RED、17 producer RED、review P2 runtime race 與準備同類 race 各
精確 RED 後一次修正；最後相關436／完整1510及validate通過，minor0／無二次
review。producer 整合只用了合成 Python ledger、fake tab與私下raw；真正 CUA
binding／co-location／bridge、完整窗口／一致性／quota／新鮮度仍未執行或證明。
實際counter25/160不變；320修訂尚待批准。common ledger／handoff／可信 recovery／
完整orchestration及原始 real gates 保留；不開始新憑證、Google操作或RPC。


## CUA 本地模組執行環境實測

真正 CUA 執行環境可載入本地模組，但沒有 ambient process，node:process
也被禁用；第一次合成 scope 在 spawn／扣额／頁面呼叫前停止，fake25原狀
保留。控制器改用固定非敏感 Python PATH與LANG/TZ，capture改用允許的
os.userInfo().uid；原0700/0600、symlink、同使用者與大小檢查保留。未繞過
工具限制或提取隱藏瀏覽器資料。兩個精確 no-process realm RED→相關73／
完整1512與validate通過，review73／無P1/P2/minor。

修正後真正 CUA runtime 的純本地 control→producer→capture合成接線成功：
Python flock、fake callback1、先扣25→26、peer拒絕、raw0600，所有coverage／
quota／trial acceptance仍false。這證明模組可同處執行，不證明真實tab binding
或Google窗口／quota／新鮮度。實際counter25/160與未批准320不變；同帳本交接／
可信recovery／完整orchestration及原 real gates仍必須完成。未有實際UI或Google
呼叫，不取新憑證、不發布RPC；自訂Python prefix／特殊UID環境未驗證。


## 同一 canonical ledger 的單向 phase seam

準備 scope 可做一次本地 handoff；runtime scope 只能以相同 path／epoch／binding／
checkpoint／native flock重新開啟已交接帳本，不能建 legacy或从receipt重 seed。
要求 ready、C2准入完成、I尚未用、exact spent、same day／unexpired、無 pending／
entered IO；本地轉換不耗 Google額度。v2固定runtimeBinding／time／spent／event
prefix hash，驗證原historical calls／events／UNKNOWN／C2/noI。rolling10/minute、
I17及已用C2共用，不換有效期限或退回已花次數。舊prep普通讀取拒絕；C/I在同
帳本仍各once。receipt trialAccepted固定false，C2 admission不是實際editor還原
或Google身分／ACL／readback證明。

17 RED、真實合成Python／CUA本地phase交接後，review一個P2（handoff後時鐘
回退的cleanup先扣款再驗證）由runtime／stale-prep兩精確RED一次修正；最後
286／完整1531與validate通過，minor0／無二次review。所有kind在任何寫入前
檢查handoff.time，錯誤時不耗I，恢復clock後可獨立cleanup。實際counter25/160
六欄／hash／no claim不變，320仍未批准；未做真正UI／Google／RPC。

這是phase seam候選，runtime driver RPC／共同執行狀態／可信holder recovery／
全程orchestration仍未接入或驗收。v2不能降回v1；若真正交接後需source回退，
須保留相容的v2 cleanup controller直到清理讀回完成，不重置counter或claims。
實際相容rollback也須先備妥／驗證；原900/day／fresh72h／七實際24h／效能／
500／台北／真機等門檻不變。未通過前不取新憑證或送試驗RPC。


## 同帳本 compatibility runtime 核心候選

R 的 wrapper→qualified 各一次、UNKNOWN/pending/native totals，現在進同一
canonical counter／checkpoint／flock／epoch／calls；第一個R才轉v3。准入保留
rolling10/minute／I17／day／expiry／六分鐘reserve，native<=540000、proof<=60秒、
token>360秒且不超epoch。扣額與UNKNOWN先於callback；native account一次且單調
<=900000，完成只准同active scope成功callback且已account／無stop。pending時
普通操作拒絕，S只准已付額pending讀回／settlement；不准新entry或重試／退款。

review27/27找到P2：停止marker寫到一半會連C/I與native settlement都封死。
實際request_stop合成fault injection留下空白／partial，精確RED1PASS/3FAIL；
一次修正成任何marker存在只作negative veto，不授權、不repair、不重seed。
canonical counter／claim／checkpoint仍獨立必驗，partial重送ACK拒絕，C/I仍各once，
UNKNOWN/pending與native metadata保留。final target272／完整1562與validate通過，
無二次review／minor0。完整回歸第一次在PG／tests前git status逾時，原因未明；
保留失敗，一次同pin runner重試才通過，未重試測試或改門檻。

修正後CUA LOCAL synthetic完整兩入口／partial-stop兩probe通過，真UI／Google0、
trialAcceptedfalse；不是正式tab binding／完整window／quota／RPC證明。實際25/160
不變且no claim，320未批准；舊separate driver仍NOT_ACCEPTED，固定transport／
release／native／caller／token／response verifier接線、trusted holder recovery、
全程orchestration及真實rollback尚待完成。v3不可降回v2：真R前必須pin／驗證相容
cleanup code，回退application source時保留它直到cleanup讀回，不還原帳本／history。
原三日／七實際24h／900day／六分鐘／效能／500／台北／真機門檻全部保留。


## Canonical compatibility driver 本地整合

新driver只使用既有canonical control，沒有第二帳本／receipt重seed。固定pin
binding、epoch／expiry／次序在observer前比對；保留原source／ACL／restore／caller／
scope／project／native完整窗口與quota驗證器。短效observer只有atomic externalRead：
before走ordinary、pending after走S，吞錯／忘await／並行／逸出拒絕且先settle已進IO。
固定兩入口、只compatibility；同步signer在rolling R准入後mint，原簽名validation
prefix與MAC保持，真正送出前再核對proof／token／timestamp。未知transport仍以S
收集native／account再拒絕，pending／UNKNOWN／額度不清除或退款；成功布林還須
post-release與same-scope finish。partial stop ACK失敗也不封死獨立核驗cleanup。

初32 RED；首212有124PASS/1FAIL/87cancel，定位為fixture把輪詢wait算入execution，
及clone tee留下未消費body；改成獨立100ms native timing／fresh Response後212通過。
GAS-entry VM精確RED空request被拒，再接原同步簽名prefix，兩入口成功、cache與
native／Sheets／LINE／token0。CUA LOCAL probe的fake HTTP又證明realm Uint8Array
instanceof不通；精確foreign-byte RED後以types.isUint8Array保留真正bytes判定。
最終317、review386（P1/P2/minor0）、完整1607與validate通過。Git preflight再逾時，
保留原因未明失敗；唯讀Git guard保留所有HEAD／diff／byte pins，一次有界重試。

修正後真正CUA LOCAL core→driver→固定transport合成兩入口／cleanup成功，fakeHTTP2、
spent38、native200、pendingnull；原失敗pending保留，realUI／Google0、trialAcceptedfalse。
這不是actual Google／身分／coverage驗收。舊separate driver只作regression，actual
不得採用。其他prep adapters仍有process UID／instanceof realm依賴，完整CUA互通、
orchestration／holder recovery／pin相容v3 cleanup rollback／實際window／quota／freshness
與可執行額度尚待完成，不能因本地整合成功就開始新credential或RPC。
實際25/160不變且no claim，320未批准；原所有真實門檻保持，不合併或切正式開關。


## Preparation adapters 的 CUA 互通

五個private adapters的UID改為允許的os.userInfo().uid，原0700／0600／symlink／
大小／checksum／claim／once／expiry照舊。六個response reader及import fixture
使用types.isUint8Array接受真正跨realm bytes，保留byte limit、copy、ZIP／hash／
preflight契約；不把array-like或Uint16轉成已驗證資料，不改Scope／目的地／API。

12精確RED後相關228、最終343通過；14新case涵蓋no-process／foreign bytes／負向
型別與六adapter同canonical Pythonflock準備／清理。真正CUA LOCAL全prep：fakeHTTP28／
peer拒絕28、spent54、C2/I5、private0600；第二probe加owned固定loopback callback與
result HTTP2、listener關閉。Google／token／資料／ACL pins全合成，trialAccepted及
rollbackComplete仍false，realGoogleUI／actualcounter0。這不是Google PKCE／登入驗收。

review230（185+OAuth45）P1/P2/minor0；review的負向filter沒有排除listener，實際45
全部執行已記錄，不宣稱zero localHTTP。完整1621／validate通過，PG stopped／cleanup0。
Git preflight唯讀flags下仍逾時，診斷正常退出0.006982秒；失敗原因未明，保留trace與
一次有界terminal retry，未重試測試或改門檻。無author fix pass／二次review。

CUA模組與本地callback互通不替代prep→runtime token交接、pinned全程orchestration、
trusted holder recovery、相容v3 cleanup rollback、真正window／quota／freshness或
可執行額度。原claim／checkpoint／UNKNOWN與trusted fixture邊界維持；真實25/160
不變且no claim，320未批准。未通過前不取新owner憑證、不送RPC或切正式開關。


## 同控制器的憑證階段生命週期候選

read-authority-phase-control.mjs以AsyncLocalStorage隔離每次activation，提供stable
atomic facade給同一組adapters。準備capturedcap不能在結束後直接用；新facade
只在可信orchestrator的當前prep／runtime／cleanup回呼轉接既有canonicalcap。
舊asyncgeneration不得借新cap，錯phase／吞錯使本phase停止；返回後拒新操作，
已進入IO與已owned的獨立C/I/S必須drain到terminal才釋放flock。handoff前使用
preparation cleanup；之後綁原runtimeBinding。cleanup仍驗證同checkpoint/claim，
不猜holder活性、不重seed／另存counter／退款／換epoch或grant。既有過期C/I
保留清理權限，不延長ordinary/R/S或token生命；rawcallbacks維持trusted boundary。

原OAuthcap過期撤權精確RED0/1已修，ignored rejection另RED0/1後handled denial；
16phasecase、review76與完整1638通過。P1/P2=0，minor deferred：以後隨可信
orchestration補transport失敗跨facade的S/native結算→cleanup整體case。
六adapters加canonicaldriver在VM及真正CUA LOCAL成功：同一次合成grant、兩次
signed compatibility、native200ms、五I，spent25→49→64；fakeHTTP28/RPC2、peer
拒30。CUAownedloopback callback/result2次並close。trialAccepted／rollbackComplete
及actualcounterTouched皆false；這不是Googlecaller/source privacy或真撤權驗收。

實際25/160／no claim維持，320尚未批准。正式開關未因本地候選切換；本階段
沒有GoogleUI／管理呼叫／新credential／RPC／正式變更。pinned全程orchestration／
可信holder recovery／相容v3 rollback／真正windows／quota／freshness／可執行額度
仍待驗證，原效能、三日同步、七日shadow、500/Taipei及真機門檻不改。


## 固定全程生命週期與 UNKNOWN 撤權候選

read-authority-trial-orchestrator.mjs把可信prepare、精確handoff、兩次固定compatibility
及17個獨立cleanupalias接入同一canonical控制器。constructor無IO；prepare只獲
atomic read/C/I，不能自行handoff／RPC。driver pins及函式引用在handoff前snapshot。
任何prepare／RPC失敗停止下一次呼叫，但仍嘗試原editor還原及所有獨立撤權。
未知handoff ACK只由既有checkpoint的phase admission決定；runtime回呼未進入才
可嘗試prep cleanup，不reseed／repair／降版或重複已admitted操作。

新增scoped cleanup-inspect只讀同ledger的version/C/I動作metadata，freeze且不
扣款或寫入；每alias必須有canonical動作紀錄才可CALLBACK_RETURNED。這不是
Googleabsence／identity／holder liveness。原還原及cleanup已owned IO必須drain，
callback結束後不接受新操作；錯alias、重複或未await均使流程停止而保留後續撤權。
review發現同phase舊callback可借later slot；exactRED0/1後加入每prepare／runtime／
restore／slot的AsyncLocalStorage origin及accepting邊界，一次author fix pass，
95相關／1657完整通過，無re-review或minor。舊transport整合minor本輪已補足。

VM及真正CUA LOCAL的UNKNOWN合成流程native100／spent70、pendingwrapper及未知
保留、I17全部執行、ownedlistener關閉。五個cleanup使用既有fixedadapter方法，
另外十二個native/guard回呼仍明確為synthetic IO；所有native pins/token/Google
response合成，trialAccepted／rollbackComplete永遠false，實際counter與GoogleUI0。
可信callback接口不替代實際pinned native準備／撤權／fresh readback與完整budget。

actual25/160／no claim／320未批准維持；本輪無新credential／Google操作／RPC／
正式變更。相容v3 rollback artifact、可信holder recovery、完整nativewindows／quota／
source privacy／效能及三日同步、七日shadow、500/Taipei／真機皆保留，不因local
lifecycle通過就合併、發布或開正式switch。


## 獨立回退程式快照與原持有者 drain 候選

read-authority-trial-rollback.mjs 保存固定31個程式／套件檔案，含相容 v3
控制器與 Acorn8.15.0 license；私下0700／0600獨占寫入、fsync及外部manifest
SHA pin。啟動與每次操作都核對完整目錄、來源／相依套件雜湊及owner/mode；
不複製counter、credential或私下backup，也不覆寫未知／部分artifact。

copied bootstrap只提供cleanup／metadata／settlement；須用原counter、claim、
checkpoint及既有adapter registration/journal，canonical flock仍決定admission。
Reader保留既有insertion-order checksum，publication/thin保留canonical JSON；
不改寫紀錄來配合回復。review P2實際合成grant→UNKNOWN→recovery RED0/1後修正，
remove／verify一次、拒絕重播並保留pending/native/spend。原scope／run handle
的stopAndDrain等待owned IO、child及cleanup terminal；新物件的NONE_CAPTURED
不證明其他holder已停止，所有receipt都不宣稱remote termination。

獨立review98／author target89／完整1677全部通過；review的一項P2已一次author
TDD修正，無re-review／minor。真正CUA LOCAL的copied runtime保留合成v3 pending，
GoogleUI／RPC0，actualcounterfalse／trialAcceptedfalse／rollbackfalse。
初次full停在Core Git preflight、未啟動PG/tests；保留診斷、同來源／門檻、Git
明確空stdin的一次terminal retry通過；卡住的底層原因仍UNRESOLVED。

actual25/160／no claim／320未批准維持。此可信source/callback邊界不是同使用者
OS sandbox。固定生命週期尚須在真實R前強制rollback receipt；具體native準備、
撤權與fresh讀回、quota/windows/budget及所有既有實際驗收仍待完成，不因候選
通過而合併、發布、開switch或安排新credential。


## 固定生命週期強制回退核對與送出前時效

固定orchestrator必須持有immutable獨立快照pin及原canonical recovery options；
在原preparation scope載入copied modules，依同epoch永久registry核對claim／
checkpoint並重建cleanup control，準備後／handoff前再核對。constructor純粹，
沒有新scope、counter或grant。真實IO前，driver的prepareDispatch先await核對，
再驗native／trial／token並mint簽章；assertDispatch同步否決停止、原stop marker、
快照或counter失效，最後再驗時效且不再await就呼叫transport。

審查兩項P2已一次author TDD修正：原await讓stop後仍RPC及已驗時效過期；新增
stop、16,001ms簽章、trial／token／native expiry回歸。token fixture曾在admission前
就過期，改相對當次讀取時間並在保留的舊候選重現，再對修正GREEN。獨立63／
author114／完整1692通過，無re-review／minor。真正CUA LOCAL使用copied current
source保留UNKNOWN pending/native/spend及I17；GoogleUI/RPC0、actualcounterfalse。

已admitted的R即使未送transport也保留charged UNKNOWN，不refund或replay；
readiness失敗仍嘗試原獨立cleanup及native settlement。這些local readiness不等於
Google撤權／remote termination／holder liveness。actual25/160／no claim與未批准
320維持；具體native準備／撤權／fresh讀回、windows/quota/budget及所有原驗收仍
NOT_ACCEPTED，不合併、發布、開switch或安排新credential。


## 2026-10-14 — Original publication readback callbacks and fixed 160 decision

Recommended GPT-6.1 Sol/high for source retention, canonical cleanup and unknown
outcomes. Existing publication adapter now implements exactly three I17 GET
aliases: read-original-editor, read-original-versions and read-original-deployments.
It reuses the original ten-file source pin, six retained version records and
serving deployment inventory. Only the attempted library version7 with this
epoch's description is allowed as an extra version; observing it never rewrites
an UNKNOWN acknowledgement or publication journal. Page tokens/mismatches stop;
no additional page, retry, source mutation or credential refresh is performed.

Each GET enters canonical cleanup admission/debit before credentials/IO. Ordinary
stop/expiry does not remove independent cleanup, but token lifetime is checked
inside the admitted callback. The same operation lock used by publication and
restore is held through terminal response. Copied publication exposes
readOriginal(action) bound to its original cleanup control, active epoch and
existing registration; no caller-provided replacement control or ordinary
publish method. Source snapshot remains31 files, policy/ledger formats unchanged.

Initial affected tests56/56 and one independent review56/56 PASS. Review found
one P2: an instance-local read flag did not exclude a second holder's journal
write. Cross-holder canonical regression reproduced failure before the shared
lock fix, then one author pass57/57 PASS. The first added fixture fixed its
clock and could not pass conservative initial rolling admission; its owned
Node process was deliberately terminated, then a mutable clock/rejection gate
corrected the fixture. No real IO, remaining fixture holder or test retry was
claimed as success. No re-review or minor findings.

One full regression1703/1703, zero fail/cancel/skip, Node22.23.3/macOS with pinned
Core and disposable local PG16.14. Final PG stop, database/role cleanup and
closed listener verified; 54.247s. Same bounded runner/empty-stdin Git guards,
no full-suite retry. Source565 snapshot SHA256:
`6aa6213415e16e136af8b5eddec14d31d675741d9c764259363191693a7ffc59`.
Validate72 backend/40 endpoints/static release and diff checks PASS.

The copied canonical test stages synthetic source/version, restores it, creates
an UNKNOWN fake RPC, then spends only the original three I aliases. Synthetic
spent36/pending/journal retained. This is local fake HTTP with the actual
canonical Python ledger; Google/UI/RPC and actual-counter modification0.
The actual counter was freshly read at25/160, original bytes and no-claim state
unchanged. Of twelve previously synthetic native/guard callbacks, these three
now have fixed HTTP implementations; nine and native preparation/window/quota
verification remain incomplete. No real Google readback/rollback acceptance.

Owner has declined320: retain160 and continue independent local work. The
budget decision now records that final ruling rather than pending approval.
A complete real trial cannot currently be demonstrated within160; do not grant,
create credentials, publish, send RPC or borrow independent cleanup units.
Original latency,900s/day, fresh72h, actual seven-day shadow,500-room/Taipei and
device/cutover gates remain. Root WIP preserved; no formal deployment/flags.

Rollback keeps prior source commit, serving deployment and authoritative data.
Use retained source/runtime and original canonical claim/checkpoint; preserve
spent/pending/UNKNOWN. New readback methods do not claim holder termination or
overall rollback completion. This batch remains Draft and unmerged.
