# V2 回歸測試矩陣

## 2026-10-18 C6 request-local month parser

| Check | Evidence | Boundary |
| --- | --- | --- |
| Canonical parser, fresh arrays, mutation/coercion/error paths, per-request bounds and500-room integration | RED4/4 then GREEN4/4; incorrect sorted-array expectation retained then corrected to canonical8,7 | Original GAS parser body unchanged; short primitive strings only,64 keys, fresh returned arrays |
| Full unit / Worker / source and comparison |2257/2257;43/43; validate72/40/static/comparison179; independent review0P1/P2 | Local source evidence; exact-head CI still required |
| Original full-wall500-room p95 | Seven100-sample routes pass; properties17.355ms | HTTP/D1/full body, not CPU; earlier CI53.119ms failure retained; no Production or user-speed acceptance |


## 2026-10-16 C6 encoded writer restoration

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Prior exact9d745be CI38828519240 | Rental2247/2247 PASS; Worker42/43 FAIL | Five500-room groups51.871–69.328ms fail unchanged<50ms; logs truncated, footers/seven stages returned; prior local pass does not override |
| Restored encoded writer and unchanged dual decoder | RED→GREEN9/9; all65 D1 cases retained | Same null/absence/-0/deep/NUL/BLOB/JSONB/own-key/error semantics; only removed writer-specific mode/byte-saving expectations change |
| Validation/new full acceptance |72/40/static/comparison179 and diff PASS; new CI REQUIRED | Comparison read-a6bbc6244c79ed1087ce576ee1c2c46430b4325ac2762c60fb25a6561e3095e7; next normal PR CI covers full unit/Worker/capacity; no duplicate local full/Core/PG run |
| Actual release | NOT_ACCEPTED | Draft/off/blank/T0 not started; C1/C3/authority/performance/observation/device/rollback gates remain |

## 2026-10-16 C6 strict typed packed transport candidate

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Strict codec/legacy format/SQL NULL/JSON null/-0/own keys/deep/NUL/BLOB |Focused9/9; affected29/29;65 actual D1 probes; review clean |Unsafe promotion and JSONB-null RED retained then fixed; legacy errors and raw-null skip preserved |
| Full npm/validate/owned dependency cleanup |2252/2252 zero fail/cancel/skip;72/40/static/comparison179 PASS |633-path snapshot0ed8611fb681e31146b1fe2d5d76c4772d2180adf6476c24a8acf6ccdeefc084 at ac7fc474; fresh PG16.14/Core643c1b3 cleaned/stopped; later docs excluded |
| Original Worker/pretest dry-run |43/43 PASS;1400 samples retained; no owned group left |500-room p95 home22.390/actions20.855/revenue21.713/tenants27.732/rooms23.535/arrears28.446/properties37.468ms, strict<50; no threshold/process/sample change |
| Earlier failures/actual gates |Retained / NOT_ACCEPTED |Prior41/42 retained; new-head CI, remote authority/privacy/latency, approved24-hour observation, device/rollback/postlaunch remain; Draft/off/blank/T0 not started |


## 2026-10-16 C6 canonical room occupancy working candidate

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Actual500-room occupancy financial-projection trap | RED→GREEN; focused35/35, affected61/61 | Shared canonical status rules; expired/scheduled/association/privacy guards retained; no unused financial/season/display projection |
| Frozen-base complete response oracle and generated closure |27 responses/2614144 bytes exact including key order;249 declarations/236 functions match | Small/rich/500 fixtures; full management response unchanged; plain supported rows |
| Full npm / validation / independent review |2249/2249 zero skip;72backend/40endpoint/static/comparison179 PASS; no P1/P2 |632-path working snapshot04987a58c433475b4121ed658e1644310bed7aa05f3f7c5555d0ef61f6289104 at base ac7fc474; fresh owned Core/PG cleanup/stopped; later docs excluded |
| Original complete Worker/pretest dry-run |41/42 FAIL, zero cancel/skip;1400 samples retained |500-room p95 home54.548/actions43.875/revenue55.615/tenants78.945/rooms49.100/arrears57.852/properties69.828ms; strict<50ms unchanged; small seven groups PASS |
| CI/publication/actual gates |NOT_ACCEPTED | Local staged candidate only; no commit/push/merge/deploy/flags/epoch; C1/C3, performance, approved24-hour observation and device remain open |


## 2026-10-13 C6 fixture idle socket handling

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Head065f8027 CI38372089418 | Rental SUCCESS; Worker FAIL31/33, complete summary | Scoped500 seed2055 UND_ERR_SOCKET; tenants65.878ms/all100>=50; later loops not reached; small700PASS; exact cause/cure not proven |
| Native original/block6500ms/block+yield2055 controls | Baseline/yield pass; blocked ECONNRESET; overall2/3 retained | Negative expected onlyUND_ERR_SOCKET; no rerun to replace it; supports idle-loop mechanism, not exact Linux attribution |
| Actual post-migration starvation regression | RED1 native transport failure → GREEN1/1 zero skip | Original same values/seed batch; zero-case filter and wrong251 expectation failures retained; correct250 tenants/501 rooms |
| Full npm / Worker / validate / source review | 984/984 /34/34 /72/40/178 /PASS; zero skips |541-file working snapshot79cc8c1d at065f8027+two test changes; Core/fresh private PG stopped; bundle stable; later docs excluded |
| New Linux CI and actual release gates | NOT_ACCEPTED | One initializer event-loop turn only; no retry/split/explicit RPC/threshold/runtime/GAS change; Draft/off/blank |

## 2026-10-13 C6 safe transport cause evidence

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Head54d21341 CI38370308887 | Rental SUCCESS; Worker FAIL31/33; complete bounded summary, zero drops | Case4 seed fetch failed/cause UNKNOWN; case15 actions86.168ms/home31.132; later loops not reached; small700PASS; no rerun |
| Actual initializer cause/code/counters/privacy/getter/output and exact terminal distribution | RED retained → GREEN19/19; independent Node22 PASS | Fault doubles only; no actual Linux cause/cure claim; original errors/cleanup retained |
| Full npm / Worker / validate | 984/984 /33/33 /72/40/178; zero skips |541-file snapshotf166e8f2 at54d21341+four diagnostic changes; clean Core/fresh private PG stopped; later docs excluded; bundle unchanged |
| Summary total/line bounds and actual release | <64KB /4096 diagnostics; NOT_ACCEPTED | Original500/100/p95/parity remain; new-head Linux CI required; Draft/off/blank/real gates unchanged |

## 2026-10-13 C6 terminal diagnostic summary

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Cleanup head5002d8af CI38368334954 | Rental SUCCESS; Worker FAIL31/33, zero skips/cancel, actual footer56.928s | CodeReview tail120000 chars truncated; two failed identities/causes UNKNOWN; no rerun/fallback |
| Early failure after provider window, interrupted footer, Unicode/line/total bounds, missing input, omitted-header association | RED retained → GREEN7/7 | Actual CLI; dropped/incomplete information explicit; no invented success |
| Actual workflow pipeline with synthetic child exit42/0 | Workflow exit42/0; exact raw stdout/file; summary exit0 | Same shell body, no failed child masked; no measured Worker test rerun |
| Full npm / validate / independent review | 978/978 zero skips /72/40/178 /PASS |541-file snapshot178cbdea at5002d8af plus diagnostic files; clean Core643c1b3/fresh PG stopped; later docs excluded; initial metadata timeout retained |
| Linux/actual release gates | NOT_ACCEPTED | New-head CI required; source clients/Worker/GAS/gates unchanged; Draft/off/blank preserved |

## 2026-10-13 C6 fixture failure lifecycle

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Setup failure at database/migration/row seed/marker; success ownership; double failure | RED1 pass/5 fail → GREEN6/6 | Actual initializer executed; external build/D1/runtime fault doubles only |
| Actual Workerd row-seed fault2055 statements | Original dispose0/10s still open; fixed dispose1/Node exit0/1 test PASS | Controlled failure, not a reproduction of native fetch cause; initial controller check failure retained and later absence checked |
| Full Node22/macOS npm suite / Worker suite / validate | 971/971 zero skip /33/33 /72 backend,40 endpoints,178 source matches |539-file working snapshot9a8d7262; clean Core/fresh isolated PG; source pins stable; PG stopped |
| Original a51ff579 CI38319550201 | Worker CANCELLED after8 passes/1 setup failure; rental SUCCESS | No final test footer or timing diagnostic; underlying fetch failure/cancel cause UNKNOWN; no agent rerun/cancel |
| Publication and actual C1/C3/C5/C6 gates | NOT_ACCEPTED | New-head CI required; no merge/deploy/flags/epoch/device or formal-data change |

## 2026-10-13 C6 v6 packed D1 projection candidate

| Check | Result | Evidence boundary |
| --- | --- | --- |
| SQLNULL absent / own JSONnull / scalar / negative zero / date marker / own proto / column order / corrupt frames | Targeted RED original2 pass/new2 fail; GREEN4/4 | Shared decoder; input immutable; malformed frames fail closed |
| Actual packed SQL vs original columns, escaped identifier/Unicode/quotes/prototype | PASS actual workerd/D1 | Synthetic16 columns, same batch; no new production route |
| All seven original GAS JSON/literals,500 rooms/250 tenants/20 properties/scoped HTTP and authority-only suspension | PASS Worker33/33 | Primary-D1 policy real; LINE/Google transport/GAS service adapters synthetic |
| Original100-per-entry p95<50ms | PASS13.524/11.535/12.703/29.104/21.780/18.966/20.225ms | Fixed-access/full-table local benchmark; not scoped/provider/device latency |
| Unit / full npm / dry-run / validate / diff | 960/960 /965/965 /337.55KiB-gzip70.92 /PASS /PASS | Full537 working files pinned; clean Core643c1b3/fresh private PG16.14; no skips |
| Prior adf39b4/4c9950e CI and local69.198ms failures | Retained | No same-head rerun or inferred cause; new-head CI pending |
| Actual C1/C3/C5/C6 gates | NOT_ACCEPTED | No merge/deploy/epoch/flag switch; all original daily/time/device gates apply |

## 2026-10-14 C3 fixed actor metadata candidate

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Four fixed alias/actor/host/GET/mask requests; wait→credential→debit→life→fetch | RED0/40 then40/40 | Synthetic transport only; no existing guard bypass/new Scope |
| Same-epoch release-observer metadata ordering | PASS, four metadata+one RPC debit=5 | Durable actual local journal, fake API/native/role readbacks |
| Response status/redirect/URL/UTF-8/size/JSON/ACL page/file/tabs/grid | STOP negatives PASS | No retry/page/read values; local response validation, not Google datatype/privacy acceptance |
| Credential identity/Scopes/no caller refresh/life/Promise/one snapshot/single-flight | PASS | Trusted cached synchronous getter, no live OAuth/userinfo/refresh |
| Six focused files / independent review |286/286 /286/286, zero fail/cancel/skip; no P1/P2 | Reviewer additional six negative repros PASS; no source/account mutation |
| Full repository/Core regression |1224/1224, zero fail/cancel/skip | Node22.23.3 actual Core HTTP/four handlers; owned PG16.14 DB/role/PID/listener cleanup, errors0 |
| Validate/diff / previous9638088 exact CI | PASS /1178 rental+24 Worker | New adapter candidate CI not yet dispatched; older pending status historical |
| Actual Google prerequisites/budget/native/identity/Schema/privacy/latency | NOT_ACCEPTED/UNVERIFIED | Counter25/160 retained; no upload/access/client/token/publication/trial RPC |

Snapshot528 dc7c6199ee0961e3661776df4015e54782af565c51f0402128d8c8f997708360;
only later evidence-doc updates excluded. Explicit actor/host restriction is
required because Google Sheets GET accepts drive.file; fixed field mask plus
response allowlist guards metadata despite includeGridData being ignored with
a mask. This does not replace role/group/inherited/source-no-Viewer gates.

## 2026-10-14 C3 approved budget and independent cleanup candidate

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Human scope decision / retained preparation | APPROVED160, spent25 | Private approval/hash and same original proposal; earlier14/pending rows are historical |
| Same epoch/path/binding migration; no reseed/refund | RED126/140 then PASS; extra import>40 RED0/1 fixed; driver141/141 | Actual private files, synthetic clock/IO only; no actual trial journal created |
| Exclusive seventeen-unit cleanup; per-entry first compatibility stage | PASS | Ordinary reads cannot borrow reserve; authority/third/duplicate entry denied before RPC |
| Cleanup pending/expiry/minute/concurrency/error/history | PASS | Same lock and durable debit; unknown terminal remains; no replay or new RPC |
| Five focused files / full Core regression | Final PASS245/245 /1183/1183, zero fail/cancel/skip | Actual pinned Core HTTP/four handlers, owned PG16.14 DB/role/PID/listener teardown, errors0; pre-fix243/1181 retained |
| Independent review / fix pass / new exact-head CI | One P2 fixed RED0/2; final245/full1183; new CI PENDING | Durable stop intent before lock/slot; in-flight native accounting and pending retained; no re-review |
| Previous b7eecd9 exact CI | PASS1161 rental /24 Worker; two dry runs, no deploy | Run38448010978; rental footer retained with provider-tail truncation |
| Actual native UI preflight | PARTIAL_STOP;200/page,400 distinct records still within24h, more pages | One-page budget falsified; complete window/type/maturity/remaining quota UNKNOWN |
| Actual fixture/adapters/client/token/compatibility | NOT_STARTED / NOT_INTEGRATED |160 approval does not replace executable budget or complete native gate |

Final526-file snapshot 9bdfd466e6b7a2ed23c79f22ed6bfa028f0c596f74eddf1479c777a32ec1b6a1;
only later evidence-doc updates excluded. All original strict timings/72h/seven
real24h/500/Taipei/device gates remain unpassed.

## 2026-10-14 C3 native observer debit interface

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Native `(phase, control)` before/after wait/debit under existing epoch lock | RED118/126, eight failures; final driver126/126 | Durable private journal; no actual Google screen/IO |
| Spent IO error, swallowed debit failure, expired cap, unawaited wait | PASS; no illegal RPC or refund | Private errors excluded from journal; late rejection consumed |
| After-RPC native budget exhaustion | STOP, spent RPC/pending preserved; no fabricated completed runtime; reopen denied | Reworked old positive-proof collector counterexample; initial TypeError-masked test corrected |
| Focused / independent review | PASS198/198, zero fail/cancel/skip; no P1/P2 | Own Node22.23.3; reviewer Node26.5.0; adapters remain trusted code to integrate |
| Full repository/Core regression | PASS1166/1166, zero fail/cancel/skip | Actual pinned Core HTTP plus four handler fixtures; owned PG16.14, verified DB/role/PID/listener cleanup, errors0 |
| Validate / diff | PASS72 backend/40 endpoints/static cache / PASS | GAS/library/thin/Worker runtime bytes unchanged |
| Native UI/Scopes/actual trial | NOT_INTEGRATED / UNCHANGED / NOT_STARTED | Approved cap40, spent14 retained; no token/grant/resource/RPC;160 pending |

Full526-file snapshot
`36783b759cd028aa441ad932d7f498781c78632355df50597a91c052f11eb0ec`;
only later evidence-document updates excluded. Public method research confirms
the existing deployment-ID/qualified endpoint and that processes requires an
unapproved scope; no extra scope or account request was attempted. Full actual
native coverage, proof ordering, release receipts and independent cleanup remain
unpassed; source fixture and local green results do not replace those gates.

## 2026-10-14 C3 rolling slot readiness candidate

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Wait before a separate durable debit; preserve preparation/cap40 | RED104/116; final driver118/118 | Local private journal and fake clock; readiness neither spends nor resets quota |
| Fifteen-item pre-release observation / first sufficient expiring batch / retained epoch lock | PASS | Synthetic before-only observer; not four live observations or160 budget proof |
| Frozen clock, day/expiry, deleted journal, private pause error, exhausted total40 | STOP without RPC/refund; predicted expiry stops before sleep | Single wait≤60000ms, no IO retry; live native collector still absent |
| Unawaited observer wait / swallowed failure / expired capability | Fixed counterexample RED0/1 then PASS; no RPC while pending | First test clock was masked by an existing minute guard; corrected reproduction retained |
| Focused driver/entry/adapter | PASS190/190, zero fail/cancel/skip; independent review no P1/P2 | Same-callback concurrent readiness/debit also vetoes with spent10, zero RPC and stopped journal |
| Full repository/Core regression | PASS1158/1158, zero fail/cancel/skip | Pinned actual Core HTTP plus four handlers; owned PG16.14 with DB/role/PID/listener teardown, cleanup errors0 |
| Validate/diff | PASS | Runtime/library/GAS/Worker unchanged; no remote action or new credential |
| Actual trial/resources/budget approval | NOT_STARTED / UNCHANGED / PENDING | Original spent14/40; no grant/upload/RPC; owner160 scope decision pending |

Full526-file snapshot
`8a93c4282b61d55fab1cea5f6108ed82dad07b3266580d6c0fb1731a8da2e01a`;
only later evidence-document updates excluded. API/native observer ordering,
pre-debit wiring, fresh native proofs and independent cleanup reserve remain
integration gates; this readiness method alone authorizes no Google call.

## 2026-10-14 C3 trial request minting and preflight safety

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Mint canonical request after awaited release/native/credential checks | PASS; delayed signed-object path remains a characterized canonical denial | Synthetic VM runs unchanged original MAC/15-second prefix; no Google RPC |
| One-time primitive snapshot, cross-realm rejected Promise, token >360000ms before signer and dispatch | RED:98/103, five failures; final driver104/104 | Fake getters/VM Promise and isolated child; original rejection not printed; no live credential |
| Dispatch rechecks canonical15-second timestamp after getter delay | RED0/1, then PASS; expired factory sends zero RPC/debit | Independent final review: no remaining P1/P2; static request path/MAC/cap unchanged |
| Driver/entry/readonly adapter focused regression | PASS176/176, zero fail/cancel/skip | Local Node22.23.3; not native Google compatibility |
| Complete repository/Core regression | PASS1144/1144, zero fail/cancel/skip | Pinned Core643c1b3, actual owned loopback PG16.14; HTTP plus four handlers; DB/role/PID/listener teardown verified |
| Validate / diff | PASS72 backend/40 endpoints/static cache; diff PASS | Source validation; no deployment |
| Actual Google prerequisites / access preflight | Testing0 users, both APIs enabled; original container sharing STOP; spent14/40 retained | Prior authenticated readback; ACL request rejected before Drive IO, no refund; original caller/source ACL remains UNKNOWN |
| Revised unbound fixture/cumulative160 compatibility proposal | PROPOSED; existing40 remains effective | No new fixture/grant/client/token/RPC;160/cleanup reserve/native IO/rolling observer/OAuth callback still require reviewed implementation and owner scope decision |
| Actual C1/C3/C5/C6 acceptance | NOT_ACCEPTED / NOT_STARTED / NOT_STARTED / NOT_STARTED | Retain original timing failures; fresh72h, seven real days, authenticated500/Taipei/device gates not bypassed |

Full source snapshot526 files,
`cf745597c21c233266c26ea1b5e03acbeece25f8a8cbc572d6e34530b26a821f`;
only later evidence-document updates are excluded. Two private runner preparation
failures are retained: missing package/config inputs stopped before any DB; then
missing cluster checker stopped before application tests and closed the owned PG.
Final runner validates all four pinned inputs before PG startup. Decision and
rollback: [READ-TRIAL-ACCESS-DECISION.md](READ-TRIAL-ACCESS-DECISION.md).

## 2026-10-12 C2 read parity candidate

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Actual GAS vs whitelist → local D1 → six HTTP routes/both home sections | PASS: every field equal with rich private-field and real Date-cell fixtures | Synthetic local workerd; not production/phone |
| Each entry100 samples, HTTP/D1 p95 | PASS:4.833–6.371ms, all below50ms | Local response consumption included; not remote latency |
| Source order, scalar JSON, masked bank suffix, Date rehydration | PASS | Original source order including blank gaps; no private contract fields/raw account replicated |
| Actual home renderer counters/default detail | PASS | Explicit summary approved by owner; default remains full GAS |
| Source-derived optional bridge capability | PASS:503 when missing/unsupported; no false unbound result | C4 must retain GAS fallback; formal optional bridge tables currently absent |
| Affected GAS/calendar/query boundaries | 28/28 PASS | Includes `testReadReplicaProjection` and `testV2ReadSummaryProjection`; no Sheet writes |
| Unit / Worker / validate / diff-check | 863/863 /13/13 /PASS /PASS | Source evidence |
| Full repository suite | 863 pass /1 existing external Core fixture failure /4 skips | `PLATFORM_CORE_TEST_WORKTREE` unavailable; external PG acceptance not claimed |
| C1 actual three days / C3 formal auth / C2 publication | NOT_ACCEPTED (test timers STOPPED) /NOT_STARTED /NOT_STARTED | Production read paths stay closed; no gate skipped |

Source manifest, schema, review, release and rollback: `READ-API-PARITY.md`.

## 2026-10-12 R0 records and source reconciliation

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Fresh deployment/project fingerprint and immutable source export | PASS: serving v232, 68/68 byte matches; five deployments stable | Read-only authenticated CLI; no function execution or business data access |
| PR261/262 and Pages runs | PASS: merged revisions and successful workflows confirmed | No new merge or publication |
| Public source readback | PASS: 61/61 existing manifest assets match main 2a5779f | No authenticated/physical-device or speed proof |
| `npm test` | 822 pass / 1 fail / 4 skip | Sole failure: commercial roundtrip requires `PLATFORM_CORE_TEST_WORKTREE`; external Core/PG not configured |
| `npm run test:unit` | 822 pass / 0 fail / 0 skip | Local unit suite; not full cross-repo integration |
| `npm run validate`, export check, `git diff --check` | PASS | Static and source evidence |
| Cloud Apps Script functions and current-build authenticated/LINE/performance acceptance | NOT_RUN / HUMAN_REQUIRED | Documentation-only task |

Details, provenance, risk and rollback: [EXECUTION_RECORD.md](EXECUTION_RECORD.md).

## 2026-10-11 登入復驗與讀取效能（本機候選）

`tests/landlord-session-read-performance.runtime.test.mjs` 新增 18 項真實模組
runtime 回歸；最初 16 項在基底副本有 5 項失敗，再補兩項缺表 bridge 測試
先重現失敗；修補後全部通過。涵蓋單次 session 驗證、
Schema／metadata 零寫入、撤銷／過期／停權／角色／Workspace 變更、偽造欄位、
logout 持久化、訂閱摘要即時查 Core、房間數隔離、cache failure fallback、
寫入後世代重讀。完整 786 pass／0 fail／4 個外部 Core 條件式 skip；validate、
62 份 JS 合併語法與 diff-check 通過。獨立複查無新增阻擋問題，定向 52／52
通過。v229已發布；同帳號桌面復驗3.819–4.357秒，房間5.782–8.451秒。
首頁主資料8.508–9.347秒、摘要累計19.595–21.737秒，首輪曾逾時；整體效能
未通過。兩笔網路事件缺失樣本只記UI成功，排除於秒數。OTP速度、手機LINE與
多人負載未驗證；量測是請求到標頭，不等於完整畫面渲染。
操作次數與發布／回退見 [LANDLORD-READ-PERFORMANCE.md](LANDLORD-READ-PERFORMANCE.md)。

## 2026-10-10 郵局唯一金額自動銷帳

新增唯一金額（含無後五碼）自動銷帳、同額保留人工確認、同額後五碼輔助配對及
冪等／既有付款回讀案例；完整 699 項測試、`npm run validate`、`git diff --check`
通過。正式開關只在 `CMWEBS_BANK_EMAIL_INTAKE_CONFIG` 內保存，不新增 Schema 欄位。

## 2026-10-10 入帳通知辨識既有房客回報銷帳

V2.0正確性修復；建議gpt-5.6-terra／medium。隔離branch
codex/receipt-existing-payment-reconciliation-20261010，基底ed66d14，root WIP保留。
房客付款回報已銷帳時，原郵局入帳仍pending，UI找不到未繳帳單而誤顯無法配對。
後端唯讀投影核對原bill、confirmed report及payment ID、金額、付款日期、末五碼、
tenant、landlord及Workspace；一致顯示settled，歧義顯示paid_bill_review並移除
再次銷帳選項。確認route也拒絕將已繳清原帳單的通知改配其他帳單。
不新增付款、不修改原receipt／report／bill／payment、不學習payer、不重發通知。
新增四項測試，前三RED→GREEN；695項完整、validate、diff-check通過。
正確owner fresh HEAD60檔與既有main一致；只修改入帳模組。
Apps Script合成projection及正式唯讀測試：兩筆display_status均settled，
read_only:true。immutable223匯出60檔與候選逐位元一致；正式URL維持，rollback222。
前端tag20261010-receipt-existing-payment-v1，rollbacked66d14；Schema不變。
同步修正baseline舊count59／treehash未涵蓋已存在第60檔問題，記錄完整候選清單hash。
LINE手機顯示仍待使用者重新整理驗收。

## 2026-10-10 一般付款回報確認逾時修正

一般付款回報送出原等候30秒，逾時恢復讀取只等5秒；正式唯讀確認使用者
截圖所示回報已confirmed並有payment ID，不能把畫面逾時視為付款失敗。
本次為V2.0穩定性修復，隔離branch codex/payment-report-decision-timeout-20261010，
基底668168e，root WIP保留。寫入等候240秒、恢復／清單讀取60秒，最多三次
唯讀恢復、間隔5秒；提交與核對期間顯示進度。未確認結果持續禁止再次提交
及跨郵局卡片寫入，只有正式終態讀回才解除。此任務不新增付款或發送訊息。
三項新行為測試RED→GREEN及跨卡片防重複回歸；完整691項、validate及diff-check通過。
前端tag20261010-payment-report-decision-v1，Apps Script v221及Schema不變。
回退前端f614ed8；不需資料回退。手機實際銷帳操作仍待真機驗收。

## 2026-10-10 入帳銷帳等待與五項導覽修復

建議gpt-5.6-terra／medium；隔離分支codex/payment-review-submit-navigation-20261010，
基底f465493；root WIP保留。正式唯讀確認一筆settled、一筆pending；付款POST
執行163.613秒，超過前端120秒期限，早啟動的讀回33.065秒仍遇到未完成交易。
前端確認等候延長240秒、讀取60秒；只有選定卡片顯示處理中，其餘卡片不改樣式，
仍以單次提交guard防同時寫入。確認成功即使用已驗證回應更新該卡，後續清單更新
失敗不再改成銷帳未知。逾時最多三次唯讀核對、間隔5秒，不自動重送确认；
pending讀回不解除原交易不確定旗標。補上與首頁一致的房源入口及五欄導覽。
新增4項行為測試RED→GREEN，完整687/687、validate及diff-check通過。
只發布前端及cache tag20261010-payment-review-submit-v1；後端v221／Schema／
Properties／觸發器不變，不代點真實銷帳。回退前端f465493。
正式手機操作與逾時完成後回讀仍待驗收。

已知限制：郵局付款回報目前tenant_line_user_id留空，因此本次房客通知記錄failed／
未綁定；此記錄不能證明房客本身未綁定。房客通知接線需另外補齊正確身份來源，
本次前端修復沒有發送或補送房客訊息。

## 2026-10-10 入帳審核連結登入過期修復

使用者手機顯示 The access token expired；審核頁未捕捉 getProfile 過期，重新整理
只重複錯誤。改為顯示「重新登入 LINE」，保留 receipt_id／Workspace 等原查詢，
移除 OAuth code/state 等暫存參數；LINE內建瀏覽器重開既有LIFF入口，一般瀏覽器
清除過期LINE會話並回房東登入gateway，不在 sibling page 呼叫login。
網路錯誤仍正常報錯、Email登入不變；重複點擊只導航一次，不重新提交付款。
建議gpt-5.6-terra／medium；隔離分支codex/payment-review-expired-login-20261010，
基底80c2544，root WIP保留。新增4項恢復測試RED→GREEN，完整683/683、validate
及diff-check通過；隔離過期SDK頁面顯示重新登入。正式手機LINE重登與銷帳待驗收。
前端release tag20261010-payment-review-login-v1；只發布前端與cache標記，
Apps Script保持v221，無API／Schema／Properties／排程或業務寫入。
回退前端80c2544；原通知連結可沿用，不重送LINE。

2026-10-09 HTML 原信解析修正：郵局原信包含註解中的舊帳號欄位，舊版 HTML
轉文字把隱藏欄位也留下，因此第二封真實通知被當成重複欄位而拒絕。
先移除 HTML 註解再解析；可見重複通知仍拒絕。合成重現 RED→GREEN，完整679/679
及 validate 通過；沒有更改配對、權限、通知或人工銷帳規則。正式Web App已更新v221（原URL），immutable60來源檔逐檔一致；v220保留作回退。
正式parser與補讀執行成功；有界回讀兩筆真實通知均matched/pending及sent，
兩筆report_id／payment_id空白。第二筆通知三個delivery為sent且各send_count=1。
手機收件／人工确认仍UNVERIFIED；未改前端、Schema、Properties或trigger。
建議模型／速度：gpt-5.6-terra／medium；隔離分支codex/postal-html-comments-20261009。

2026-10-09 本機驗證：新增31/31、完整678/678、validate、diff-check通過；
Apps Script parser於本機VM與正式環境通過。真實銷帳仍需房東確認。

## 2026-10-09 郵局入帳通知（已發布並啟用）

- bank-email-receipts.runtime.test.mjs：ROC日期／前置0／重複通知欄位、唯一金額、
  同額歧義、已知付款人與共用帳戶、Workspace與legacy canonical policy、
  Gmail最新頁＋backlog／信箱身份／台北cutoff／cursor恢復、disabled gate。
- 通知在ScriptLock外，持久化投遞／固定LINE retry key／409及4xx／退避；
  Gmail失敗仍重試、terminal unbound不佔滿恢復窗口。
- 實際載入既有付款服務：一筆付款、報表尾端中斷恢復、原批准人保存、
  鎖內金額變動、確定失敗釋放claim；25未提交claim不遮擋後續已提交交易。
- 新route拒絕GET、裸UID、query credentials、過期session及membership變動。
- bank-email-review.ui.test.mjs：匹配／未匹配操作、只讀權限與逾時不自動重送。
- 既有POST dispatcher隔離fixture同步包含新的前置分派helpers；原Email登入、
  quick lease、property writes與read snapshot回歸保留。
- 390×844合成浏览器預覽：無橫向溢出、銀行按鈕至少44px；兩種確認操作完成。

- 正式 OAuth 唯讀同意、Gmail profile及真實收信成功；附加表22／10欄位一致。
- Web App v220／HEAD60檔、Pages46檔相符；完整678/678、validate通過。
- 一筆真實入帳matched/pending；report_id／payment_id空白，未銷帳。
- 通知中心三筆delivery sent且各send_count=1；LINE手機收件UNVERIFIED。
- 唯一每5分鐘收信trigger；22:54:41自然執行完成6.742秒。其後仍一筆pending、
  三筆sent且send_count=1，沒有重複通知／付款。原四個排程保留。
- 未登入審核連結正確到登入入口；authenticated review及指定真實銷帳UNVERIFIED。

## 2026-10-07 手機分享覆層／501待起租（候選未發布）

- `room-center-occupancy.test.mjs`：真實canonical函式的未来／起租當日／
  到期仍入住狀態、關聯衝突、重複記錄、外Workspace、非501通用行為；
  回應無私人ID／姓名／日期，資料前後相同；標籤與空房／已出租篩選一致。
- `room-share-gallery.test.mjs`：分享在照片內、aria-label、44px覆層，
  手機隱藏箭頭；手動複製狀態仍在card body；分享拒絕／取消回歸保留。
- RED先重現4項新需求失敗；GREEN全套646/646，validate及diff-check通過。
- 實際本機renderer：390×844無箭頭，鍵盤右方向切圖1/2→2/2；分享44×44；
  501示範待起租包含已出租、排除空房。1366×900仍有箭頭，無橫向溢出。
  公開照片正常載入。独立審查55項focused測試與validate通過。
- 既有鍵盤視窗測試在全套內通過；真機LINE/iPhone滑動／分享仍需人驗收。
  未寫正式資料／未發分享。前後端需成對另行授權發布，後端新增兩張scoped
  sheet讀取，需正式驗證載入延遲；rollback backend218/frontend bf17208。

## 2026-10-05 月帳單排程日期型別（本機修復，待發布）

- `monthly-bill-noon-schedule.test.mjs` 新增 RED→GREEN：Sheets Date 月份可選中待送帳單，台北午夜跨月正確；文字月份相容，已送／已繳／取消／其他月份／無效日期不送。
- 正式月底日期儲存為 Sheets 日期序號，`workspaceGetObjectsWithRow_` 使用 `getValues()` 保留 Date；旧 monthly normalizer 字串化 Date，候選為零。手動入口已有 Date 正規化。
- 使用者授權後，僅一次手動本月發送；正式 LINE 紀錄20筆 HTTP200，帳單20筆 `sent`／send_count=1，已繳1筆未送；正式頁待送0／成功20／失敗0。這是 provider 接受及保存證據，不等於房客已閱讀。
- 完整600/600、validate與diff-check通過。只修改 monthly normalizer，API／Schema／金額／trigger 不變。未在雲端執行可能發訊息的測試函式。

## 2026-10-05 月中到期但續住的未繳租金更正

- RED→GREEN：403／505型10月3日到期仍在住，init標記個別待確認、預覽7500但不寫入；未確認拒絕，確認後同一未繳bill ID租金726→7500。保存度數、付款／發送狀態，不改租約日期、不新增帳單。
- 到期確認只移除租期結束限制，仍保留入住月按日比例；已繳快照及過期金額拒絕，完成退租不能被確認旗標延長。
- 既有502／602、關閉603、跨Workspace／舊房客身份、夏月及折扣保護持續回歸。無API或Schema變更；正式更正限定授權403／505兩筆，其他帳單不批次重算。

## 2026-10-05 用電月份／到期在住確認／關閉房間／逾時核對（本機候選）

- RED→GREEN：六月收五月一般費率、七月收六月夏月、十月收九月夏月、十一月收十月一般；一月跨年、Workspace 自訂夏月與真實 settings integration 房間覆寫。
- init 不寫帳；明確未繳更正保留原 ID／折扣。已繳卡片顯示保存快照，不因新費率重新試算。
- 502／602 可單獨勾選；全選排除到期待核對，送出須房東确认仍在住。真實後端入口核對標準及無範圍舊房客，相同租約日期／狀態不變；未確認／完成退租仍拒絕。
- 603 型 inactive／closed／disabled／archived 房間讀取及寫入皆排除，不刪除歷史帳單或房間資料。
- 寫入等待時間 120 秒且不重送；失敗後唯讀核對原 bill ID、度數、期限、折扣、其他費用及備註；一致才回報已保存，不一致仍提示未確認。
- 本機完整測試 589/589、validate、diff-check 通過；正式 Apps Script／Pages 尚未發布，未代送真實帳單，未做手機真機驗收。

## 2026-10-05 帳單更正回復（本機，未發布）

- `billing-correction-recovery.test.mjs` RED→GREEN：輸入事件不解除 pending 提交鎖、過期金額顯示具體原因且只刷新、已保存但刷新失敗保持鎖定、Email 業務子錯誤、legacy JSONP 寫入逾時不重送。
- `phase219-landlord-auth-client.test.mjs` RED→GREEN：來源與 request correlation 驗證後保留業務拒絕 payload；原拒絕／權限語意不變。
- 完整 npm test 569/569、npm run validate、git diff --check 通過；既有後端原帳單 optimistic lock 回歸保留。沒有修改 Apps Script，未執行雲端寫入測試。
- 正式唯讀：202 B0000042 及 tenant bill/home projection 同為 9,350，discount=600；先成功、後四次失敗。具體失敗子錯誤未取得，不代送重現；候選正式發布／提交驗收尚未完成。

## 2026-10-05 舊租約工作區相容補修

- RED: 已通過 landlord_id 權限篩選但 workspace_id 空白的到期租約仍被 review resolver 排除。
- GREEN: 延用既有授權範圍，在唯讀副本帶入房間 Workspace 供電表查找；不修改租約資料、不開放自動出帳。跨 Workspace／退租／停用帳號測試仍通過。
- 正式唯讀來源核對：兩間舊房客 account_status=active，但 workspace_id／landlord_id 空白，因此不在原 billing tenantMap。唯讀延續只允許已授權房間及租約共同指向的唯一無範圍舊房客；duplicate／inactive／顯式外部 workspace 或 landlord 仍拒絕。
- 全套 563/563；502／602 正式登入清單驗收另記，不能以測試取代。
- 正式209登入唯讀：22張卡片，502／602到期待核對、同租約9月上期電表可見。桌面側欄雙欄與202／506未繳原帳單更正入口可見；沒有提交真實金額。真機及金融寫入驗收未做。

## 2026-10-05 抄表延續／桌面工作區／未繳原帳單更正（本機候選，未發布）

- [x] 502 expired／602 active 但結束日已過：仍連結同 Workspace 活躍房客時保留抄表 item，標記待核對；上期讀數保留，不自動續約、退租或新增帳單。
- [x] completed checkout、已結束合約、封存房間、inactive／跨 Workspace 房客、不同 current tenant／contract、未來或缺失日期均不復活。
- [x] 未繳原帳單只有明確 edit flag、bill ID、同租約房客及舊 total 相符才更正；保留 ID，折扣取代原總額，重複保存不重複扣款。已繳／錯誤 ID／金額已改拒絕寫入。
- [x] 卡片 renderer 保留讀數欄位，review 不可勾選；未繳已建帳單不預先勾選，明確保存確認。
- [x] 本機合成 browser 1440px 寬版側欄／雙欄、390px 單欄；兩尺寸無水平溢出。不是正式帳單或真機驗收。
- [x] `npm run validate`、Node 全套 560/560、focused 89/89、`git diff --check`。真實 Apps Script service 執行與正式部署未執行；runtime 測試使用正式計算入口及合成持久層。
- [ ] 202／506 實際折抵金額、正式原帳單更正與 502／602 正式顯示待核對：尚未修改 Production 資料。到期項目目前只供查看／試算，不保存新讀數，不等同房東已确认續住。
- [ ] 部署：先唯讀匯出對帳既有 Apps Script，再發布此後端版本（保留 Web App URL），最後更新 frontend cache／Pages。須新授權；rollback 前端至 `c8335c4`、後端至部署前核對版本，回退程式不會撤銷已保存帳單更正，故發布驗收不代送帳單。

## 2026-10-05 導覽／退房選擇與合約驗證狀態（Pages 已發布，登入待驗收）

- 使用者明確批准「將這次前端修正發布」；候選 35adf9c，正式 cache tag `20261005-landlord-navigation-review-v1`。僅發布已記錄前端修正，回退 b183c22，不部署 Apps Script 或更動業務資料。

- 九個既有桌面側欄核對八個既有入口，退房先開房客名單；營收頁補退房入口。沒有 contract_id 的退房網址顯示選擇指引，不建立 session、不寫資料；單筆退房仍從房客詳細資料帶入既有合約。
- 合約 auth／review／initiated status 沿用共用 JSONP，dispatcher 原本已支援 callback；不經 callApi 的 data unwrap。驗證失敗保留原始碼與訊息，缺失／確認過期 LINE 憑證才顯示手動重登入，不繞過伺服器 Workspace 與角色驗證。
- 本機重現側欄缺項／錯誤退房網址、cross-origin fetch 失敗與原始驗證錯誤遭遮蔽；根因不同於上一版資料讀取缺少 LINE ID。真實合約驗證最初失敗的 provider／網路原因尚未被正式登入證據確定，不能因本機測試宣稱所有合約已恢復。
- 後端／API route／Schema／正式資料無變更，Apps Script 測試函式不適用；rollback b183c22。登入後、退房頁讀取（不結案）與手機真機尚待驗收。
- `npm run validate`、`npm test` 545/545、diff-check 通過。新增 14 項包含九頁導覽可點擊路由、JSONP status 參數、驗證原始錯誤保留、無合約 ID 不發請求、缺失憑證碼、手動 OAuth 回跳參數清理。
- 發布證據：PR #212 合併 `867035609515ab0bd1dac8bfe934aa9963e148e9`；Pages run `37230018142` success，latest build built 且 commit 相同。39/39 修改 runtime 公開檔案逐位元組相同；候選 runtime 與 origin/main 相同，Apps Script diff 為空。root 408 筆 WIP、branch 與 HEAD 未變。此證據不代表登入後合約驗證或手機真機已通過。

## 2026-10-05 電腦版登入後缺少 LINE 身分修正

- 五頁實際 ensureLandlordAuthReady 與真實 shared auth 重現：無 Email token 的桌面被誤判 Email，LINE 初始化次數為 0；新增六項回歸 RED→GREEN。
- getMode 只依 Email session 判斷，沒有 token 則進 LINE 初始化；桌面 Email 表單偏好只在入口決定，不代表已登入。五頁同時測 Email session 不啟動 LINE、LINE redirect pending 不讀資料。
- 發布範圍沿用使用者登入修正授權；只有前端、cache 標記及測試文件，無 Apps Script／Schema／正式業務資料修改。回退 main c7b2530。
- 真實桌面 LINE OAuth 與登入後跨頁資料验收仍待確認，單元測試不等於此驗收。
- 發布完成：validate／531/531／diff-check 通過；PR #211 合併 b183c22，Pages run 37227859933 success，latest build built 且 commit 一致；39/39 修改 runtime 公開檔案逐位元組相同。root 408 筆 WIP、branch 與 HEAD 未變。

## 2026-10-05 電腦版 Email 入口手動 LINE 選擇（未發布）

- [x] phase244 實際 entry script 重現 mode=email + 已登入 LINE：按下 LINE 後不再回 Email，完成既有 home 導覽；RED→GREEN。
- [x] phase250 保留 mode=email 首次載入忽略舊 fallback intent，避免自動 LINE 循環。validate、525/525、diff-check 通過。
- [ ] 真實 LINE OAuth／正式登入後 browser 驗收及發布尚未進行；Apps Script 無修改。
- [x] 發布狀態更新：使用者批准後 PR #210／c7b2530 與 Pages run 37224933796 success；38/38 修改 runtime 公開檔案讀回一致。真實 LINE OAuth／登入後驗收仍未完成。

## 2026-10-05 摘要優先與營收入口（本機候選，未發布）

- [x] RED/GREEN：頂部估值／累計實收位於圖表與成本前；最高年度 100,000 在 2%／4% 下為 5,000,000／2,500,000；累計 180,000 不受空成本／badInput 影響。
- [x] 合成 390px browser DOM 核對摘要先估值後實收，圖表在成本與出售試算前。原有固定底導覽保留。
- [x] `npm run validate`、`npm test` 524/524、`git diff --check` 通過；browser 2%→4% 估值 10,400,000→5,200,000，合成累計 694,000 保持。手機摘要截圖已保存，不代表正式金額。
- [ ] 正式發布、登入後與手機真機驗收尚未進行；沒有 Apps Script 改動，無正式 Apps Script 測試函式呼叫。
- [x] 2026-10-05 已批准並完成正式發布：PR #209／5fb4b48，Pages run 37223696358 success，40/40 runtime 公開讀回一致。上述未發布勾選狀態已由此證據更新；登入後及手機真機驗收仍未完成。

## 2026-10-04 投入成本與互動報表（本機候選，未發布）

- [x] 預覽物件清單／範圍重新渲染與桌面側欄回歸 17/17；browser A／B／全部實收各 416,400／277,600／694,000，手機375px無外層溢出。桌面側欄／手機底導覽依1024px切換，不發起登入。

- [x] 投入成本公式 RED（缺少實作）→ GREEN；購入／裝修明確填寫、選填其他、零本金、空成本／零成本、負數／非有限數／overflow，不推造累計淨 ROI。
- [x] 實際 mount 事件：成本输入不重繪圖表；年／月明細與占比、圓餅旋轉、Enter、badInput、暫停控制；缺年曲線及無估值點既有回歸保留。
- [x] 審查發現暫停後重繪凍結起點；新增 RED/GREEN 回歸，改為 final static geometry。合成 browser 驗證 animation=none、opacity=1、transform=none、curve dashoffset=0；reduced-motion 不可由繼續按鈕覆寫，rotation transition=0s。
- [x] 桌面及 390px 同一頁試算；手機外層無水平溢出（375／375）。合成值與財務公式、點擊／鍵盤年度明細、月份旋轉核對，無 console error。
- [x] `npm test` 518/518、定向 15/15、`npm run validate`、`git diff --check` 通過；Apps Script 沒有修改，不呼叫正式測試函式。
- [ ] 本次前端擴充尚未正式發布／登入驗收／LINE 真機驗收。無業務寫入、API／Schema／Apps Script 變更。

## 2026-10-04 年度收益估值（本機候選，未發布）

- [x] `asset-income-valuation.test.mjs`：跨 Workspace／物件、付款確認、歷年與 as-of cutoff、本期 KPI 不變；四率公式、最高／平均、空／零／負／badInput 成本、缺年／無估值點、空資料與舊 backend fallback。
- [x] 桌面 Email 不初始化 LINE；沒有 Email token 的已登入 LINE 可使用原路徑；共用 auth/API 處理權限。
- [x] 合成 browser 核對 2% 預設、最高／平均／不完整年 opt-in、四率切換、成本錯誤與年份圓餅圖；桌面 1280px／手機預覽保留固定 shell。
- [ ] 正式發布、authenticated API／瀏覽器／LINE 真機尚未執行。沒有正式帳務寫入或 schema 變更。


## 2026-10-03 首頁前端正式發布（Pages完成，登入／真機待驗收）

- [x] fresh Pages來源main根目錄、built commit133549e與origin/main一致；回退目標記錄，root408筆WIP保留。
- [x] 新cache tag20261003-landlord-home-motion-loading-v1；503/503完整回歸、validate及diff-check通過。42個既有靜態標記／驗證／測試檔的未提交變更只有固定tag替換，Apps Script diff為空。
- [x] PR203合併074c225，Pages workflow37068482843 success，latest build built且commit一致；40個變更靜態檔加既有清單共43/43逐位元組相同。合併main與候選首頁三檔及release標記一致；root仍408筆WIP、原branch／HEAD未變。
- [x] 正式browser缺少已驗證session，直接首頁顯示「缺少 LINE User ID」；已交付明確Email登入入口，return_to新版首頁，未發送OTP或以示範登入替代。
- [ ] 正式登入後首頁／LINE實體手機驗收；本機手機預覽不等同此項。後端／API／Schema不變，沒有測試業務寫入或LINE發送。

## 2026-10-02 首頁載入／手機展示（本機候選，未發布）

- [x] `landlord-home-loading.test.mjs` 8項：原版6項RED（parser-blocking SDK、LINE lazy load、error／timeout／缺失SDK重試、待辦重建整頁）修正後全綠；另保留Email bridge與已載入SDK／登出LINE重導流程回歸。執行實際首頁inline與shared auth，不以mock登入函式代替。
- [x] 不再在HTML parser critical path下載第三方SDK；Email session不用LINE SDK。LINE仍依既有LIFF ID初始化、讀profile、登入重導；30秒載入失敗有提示，移除失敗script並允許手動重試，舊callback不影響新請求。
- [x] 待辦數量原本每次回應重寫整個app，現只更新3個badge與文字。合成browser驗證app direct-child mutations=0、chart node及focus相同、scrollTop 300→300；單次局部更新約0.6ms僅為本機觀察，不是正式API效能數字。
- [x] 手機預覽 `/mobile` RED404→GREEN：same-origin iframe採真實手機寬度，保留原responsive renderer；僅loopback可用，CSP仍禁止外部請求及form提交，私有檔案404／POST405。373px內容寬度=scrollWidth，金額不截斷，可捲動；手機預览不是另做一套Production頁面。
- [x] 全套503/503、validate與diff-check通過；既有progressive home→actions/report、request dedupe、錯誤隔離及失效權限清除舊資料回歸保留。
- [x] 2026-10-03 續作補齊獨立審查的兩項測試缺口：DOM替身由實際renderer輸出建立節點，斷言原節點保留且pending class清除；手機父頁CSP明確允許同源iframe。9項定向回歸通過。
- [ ] 正式API／LINE真機首屏時間及登入後驗收未測，不宣稱端到端快幾秒。沒有Apps Script變更或正式測試呼叫；沒有帳務緩存／業務列／Properties／LINE寫入。

## 2026-10-02 房東首頁動態設計（本機預覽，未發布）

- [x] `landlord-home-motion.test.mjs` 九項 RED/GREEN：播放／暫停不改金額、OS reduced-motion 不可被按鈕覆寫、偏好切換保留手動暫停、hidden/offscreen 停播、重繪清理舊控制項／observer、錯誤卸載清理；恢復播放／退出 reduced-motion 不重播已靜止的進場圖，實際整頁錯誤 renderer 卸載舊圖表。
- [x] 既有首頁 renderer／12 月合計／30-60-90 buckets／語意色及 progressive bootstrap 回歸保留；全套 494/494、`npm run validate`、inline syntax、`git diff --check` 通過。
- [x] 本機合成資料瀏覽器：桌面、390px、375px、844×390 橫向無水平溢出；金額完整，底部導覽固定。新動畫／明細控制項至少44px高。
- [x] 實際點擊暫停後圓環 animation-play-state=paused，線／柱顯示最終完整幾何；中央文字 transform=none。模擬系統 reduced-motion 後三圖 animation=none。
- [x] 審查後再次 browser 點擊恢復播放：circle orbit=running，line／bar animation-name 仍為 none，沒有回零重播；重新載入才開始新一輪進場。
- [x] Preview server 只監聽 loopback，allowlist 僅首頁與3個靜態素材；CSP 禁止外部請求，移除正式 SDK／auth／API scripts，直接使用合成 fixture 呼叫實際 renderer，沒有登入／業務 API 呼叫。預覽的業務連結不執行正式操作。
- [ ] 正式發布、登入驗收及手機真機驗收：未執行；這次使用者只核准本機設計預覽。

沒有新增圖表種類、API／Schema／業務寫入；只是既有首頁的視覺和動態。Apps Script 模組沒有修改，未呼叫正式測試函式。後續需單獨授權 frontend release；不可把本機 preview 當成 Production acceptance。

## 2026-10-02 房客租約摘要（v205／Pages已發布）

- [x] 5 項 RED/GREEN 實際 loadPage／renderer 回歸：目前租約的租金、零管理費、押金、台北租期與繳款日放在聯絡資料前；不使用帳單／房間預設或任意歷史版本。
- [x] 待起租與已到期仍顯示該版本條件；缺少／重複 current 指標不猜測。缺值顯示未提供、0 正常，費用說明 escape。
- [x] 文件回應補回租約時同步更新摘要／歷史區，不重繪或清除初始電表、選檔與文件表單；既有各版合約保留。
- [x] 3項實際native history與document projection RED/GREEN：canonical0優先舊alias、缺失／非法金額為null、只在canonical空白才用legacy值；整個fixture原始資料不變。Workspace／房東filter回歸仍通過，文件測試載入實際shared read helper而非stub。
- [x] 沒有current ID時即使歷史標記is_current也不冒充目前租約；原續約寫入／預設normalizer保留。
- [x] 全套 485/485、validate、diff-check 通過；桌面與 390px 手機實際 renderer 的合成資料預覽可讀、展開可用，CSP 禁止所有外部請求。不是正式登入／真機驗收。
- [x] Fresh serving v204及editor HEAD完整匯出，59檔與基線相同。
- [x] 原Web App immutable205完整59檔與c583d36相同，CLI deployment讀回205、URL與其他四個部署不變；保留v204 rollback，未刪版本。
- [x] PR201／657ec08、Pages workflow36985692299成功，41公開檔逐位元組相同；合併後485/485、validate、diff-check通過。
- [ ] 正式登入驗收與先前授權的 501 三欄保存：目前瀏覽器仍在 Email 登入入口。

Apps Script只改既有read response；無新增route／Schema／業務資料／Properties／trigger／LINE或版本刪除。前端 rollback 為 `cc01e81`，後端為v204。

## 2026-10-02 紙本補登房間金額／待起租房客（v204／Pages 已發布）

- [x] RED/GREEN：active／upcoming 補登的 canonical room rent、management（含 0）、deposit 同步；下游 view 失敗回復原金額與指標，冪等重送不建立第二份租約或發 LINE。
- [x] future 紙本租約保留 canonical 房客、起租日及歷史；房間為待起租，不是空房／已入住／待核對。臺北起租日當天起才按有效出租顯示，原狀態列不變。
- [x] 跨 Workspace、inactive tenant／archived room、錯誤 room／tenant current 指標、unsigned electronic／cancelled／未核對的 future active 不使用新 fallback；既有到期續約保留。
- [x] 實際 desktop／mobile renderer 顯示待起租日期和查看房客；無重複建客或封存入口。獨立房間金額編輯沿用舊 API，狀態由租約控制。
- [x] 審查後 RED/GREEN：較晚日期的取消舊租約不遮蔽 canonical 紙本；tenant-side Workspace／property／room／current 指標錯誤保留待核對，缺少／不一致 property 不進房客 fallback。
- [x] scheduled paper 起租日與到期後房客仍可查；history 原狀態不變、effective 狀態正確。實際詳細頁 renderer／點擊導航、續約建立與核准啟用、退房 target validation 在未起租拒絕，起租日／到期後保留既有入口及權限 guard。合成 Sheets 核准 fixture 確認僅明確核准才封存前版並更新房客／房間／views；未執行正式續約／退房。
- [x] 實際 properties init 在起租前、起租日及租期末日，tenant／contract／property 指標不符或重複 tenant／contract ID 仍為待核對；不得透過日期 active map 繞過完整關聯 guard。
- [x] 最後全套 477/477、`npm run validate`、58 個後端合併語法／49 個 inline scripts 及 `git diff --check` 通過。隔離桌面／手機畫面使用實際 renderer 與合成資料，禁止外部請求；不是正式登入／真機驗收。Cache tag `20261002-paper-backfill-room-tenant-v1` 已發布。
- [x] 獨立審查的 8 個 Important 發現均已 RED 重現並補修；最後 scoped follow-up 48/48、無已確認 Critical／Important／Minor。review 不涵蓋正式資料、登入／私有文件及部署驗收。
- [x] 使用者確認發布與 501 三欄範圍；Fresh serving／HEAD v203 與 main 的 59 檔相同，新 immutable204 與候選完全一致，既有 deployment CLI／Google UI 讀回204、URL及其他部署不變，rollback203保留。
- [x] PR #199／2143a27、Pages workflow36975283281成功，41個公開檔案逐位元組相同；合併後再次validate／477/477／diff-check通過。
- [ ] 501 既有 room 三欄定點同步及正式登入唯讀驗收尚未完成；瀏覽器停在 Email 登入入口。只在已驗證房東編輯入口存三欄並讀回；不在 read path 寫正式資料、不直接改 Sheets 繞過權限或重送補登。
- [ ] 實體手機／真實補登或初始電表寫入未驗收；不代填缺失讀數，不開原始證件或重算歷史帳單。

## 2026-10-02 電表驗證恢復／台北日期（v203／Pages 已發布；登入唯讀通過）

- [x] 最小化唯讀 metadata 確認失敗请求的 ID token 已過期；不保存 token／subject／秘密值，沒有讀私有原檔或寫业务資料。
- [x] RED/GREEN：過期 SDK token 不送 exchange、不自動跳轉；provider 拒絕保留明確手動恢復且不查電表／raw UID fallback。cached review session 到期重取；存檔失敗不自動重送，保留讀數／照片並清除已過期 session。
- [x] 外部瀏覽器重新登入保留 canonical tenant、所選 contract、電表錨點且剔除 OAuth code／state／liff.state；重複點擊一次登入。在 LIFF client 使用既有 LIFF 入口，不呼叫不支援的 logout／login。
- [x] 後端 allowlist 只有明確 `IdToken expired.` 映射 expired code，audience／malformed／不安全描述仍拒絕且不回顯，不建立身份或 session。
- [x] Taipei 午夜 Date／ISO offset／Google Date／date-only 正確；真正 history read model 和 frontend renderer 的文件／歷史／電表日期一致。租約原始列與金額不變，日期加減規則不變。
- [x] 新增 10 項具名回歸，定向 36/36、全套 441/441、validate、diff-check 通過。共享 cache tag `20261002-tenant-meter-session-dates-v1`；其餘頁只有 tag 更新。
- [x] 獨立審查兩項 Minor 測試盲點已補入：剩餘 20 秒 renew／31 秒沿用、malformed/null 400、非 400 expiry、200 錯誤 audience 都 fail-closed。follow-up 定向含 cache 39/39、validate／diff-check，無 Critical／Important／Minor。
- [x] 合併全域 58 個 Apps Script／49 個 inline scripts 語法通過；隔離 browser fixture 禁止任何外部請求，實際按鈕返回同房客／所選租約／電表錨點，日期正確、讀數／照片控制項可見。畫面證據 `/private/tmp/cmwebs-meter-session-proof.hpI9lm`；不代表正式／真機通過。
- [x] 使用者於最後永久刪除畫面確認精確97版批次；完整來源／checksum 備份、Google成功畫面及 CLI 刪除差集相符，保留引用／76／85／200／201／202，五個 deployment 不變，沒有業務資料刪除。
- [x] Fresh HEAD／serving v202 匯出一致，candidate `71b68df` 建立 immutable203，59 檔完全一致；既有 Web App deployment 讀回203、URL不變。新版後104版／96可用位置，rollback202。
- [x] PR #197／cc984fe、Pages workflow36936708163成功；17個公開檔案逐位元組相同，合併後再跑441/441／validate／diff-check通過。
- [x] 正式登入後唯讀：過期提示→既有房東LINE重新登入→同一canonical房客／選定租約／電表錨點；初始讀數、選填照片及儲存控制項載入。台北租期和原三份文件metadata／私有預覽入口可見，未開原檔。
- [ ] 真機／真實初始電表補填及照片交易未驗收；實際讀數／照片仍缺，不代填、不重算已出帳。

## 2026-10-02 房客 canonical ID 關聯修復（本地候選，未發布）

- [x] 登入後唯讀重現 506 詳細頁「0 份文件／無租約／無法補填初始電表」；沒有開啟原始身分證、重傳文件或改業務資料。測試以虛構 ID，不提交真人個資。
- [x] RED/GREEN：新增 6 項 regression；最初 4 項在舊程式失敗，審查另揭露申請 case-fold 錯連並以新增測試重現，再修為 canonical 解析後精確過濾。定向 29/29 通過。Native projection → 真正合約歷史及文件 metadata helper：小寫生成 ID、沒有 tenant master 時的合約 fallback、既有大寫 ID；跨 Workspace／房東／其他房客文件保持排除，資料快照不變。
- [x] 實際 `loadPage`：舊大寫網址先唯一解析伺服器原始 ID，文件及電表查詢均用 canonical ID，既有申請保留，三筆文件可預覽且電表欄位呈現；大小寫碰撞在任何私有文件／電表查詢前拒絕。
- [x] 全套 431/431、`npm run validate`、49 個 inline scripts、58 個 Apps Script 合併全域語法、`git diff --check` 通過。固定 cache tag 為 `20261002-tenant-canonical-id-v1`；其他頁只有機械式 tag 更新。
- [x] 獨立審查先揭露申請 case-fold 錯連，新增 RED/GREEN 後精確關聯；follow-up 29/29 與 diff-check 通過，無 Critical／Important／Minor，候選可進行下一階段發布 preflight。
- [ ] Apps Script 已滿 200 個版本，尚未 source push／建立新版／更新 deployment／Pages／PR。正式後端讀回 v201，v200 保留；此前只刪 v199 的授權不涵蓋其他版本。
- [ ] 正式候選發布後，需登入唯讀確認 506 原有租約、文件及電表欄位；本地測試不等於原檔已恢復或真機驗收。

## 2026-10-02 房客文件與初始電表查看修復

- [x] 真正執行 `loadPage` 的 RED/GREEN 重現：文件請求未完成時，電表原先沒有讀數／照片控制項；修正為獨立載入，文件失敗也不移除房客頁及電表表單。
- [x] 舊房客 `contract_history` 空白時，文件回應中的同房客租約仍能補載電表；多租約仍要求選擇，既有基準不可覆寫。
- [x] 歷史文件清單每筆私有文件都有 `document_id` 預覽入口，不只各類最新一筆；沿用既有已驗證下載權限，不公開 Drive ID 或檔案內容。
- [x] 房客頁上方有「查看／補傳合約與身分證」及「查看／補填入住電表」錨點；固定 shell／頁內捲動保留。
- [x] 定向 frontend runtime 23/23，全套 425/425，`npm run validate`、`git diff --check` 通過；共用靜態 cache tag 同步為 `20261002-tenant-evidence-discovery-v1`，其他頁僅更新 cache tag。
- [x] PR #193 合併為 `3e6affb`，Pages workflow `36913724284` 成功；17 個公開資產與合併来源逐位元組一致。v201 匯出 59 檔仍相同，正式 deployment 仍讀回 v201；Apps Script／API／Schema 無變更。
- [ ] 正式新版入口瀏覽器仍呈現 Email 登入頁；未核對真人 506 的文件 metadata／內容、實際讀數或登入後／手機畫面。不能把測試夾具當成既有文件已找回，不要求先重傳，也未代填／上傳或更動業務資料。

## 2026-10-01 初始電表發布恢復

- [x] 只對已核對的 v199 取得操作當下永久刪除確認並執行；59 檔備份逐位元組相同，CLI 核對 v199 不存在、v200 保留，沒有刪其他版本／部署。
- [x] 新 immutable v201 匯出 59 檔與 `99e4db5` 相同；既有正式 deployment 讀回 v201，URL 不變，另四個部署 HEAD／160／10／139 不變。
- [x] 再次執行全套 420/420、validate、全域 Apps Script／三頁 inline 語法及 diff-check 通過。
- [x] PR #191／`2c570ae` 合併，Pages workflow `36881380576` 成功；`npm run verify:production` 確認 17 個公開資產逐位元組一致，`--export` 核對 v201 通過，正確匿名 v2_action init GET 回傳 POST_REQUIRED。
- [ ] 真實 506 初始度數、私有照片／登入後操作及手機真機驗收未完成；無業務列、私有檔案、Properties／trigger／LINE 交易。

## 2026-10-01 初始電表候選發布阻擋與回退（歷史）

- [x] 候選 `b225185` 全套 420/420、validate、全域／前端語法、diff-check 與獨立審查通過；功能不因部署失敗而丟失。
- [x] 建立 Apps Script 新版本回傳 200-version cap；正式 deployment 仍為 v200，沒有宣稱新版已生效。
- [x] Editor HEAD 恢復 v200 並以 59 檔匯出比對；PR #189 回退前端，Pages workflow `36869725199` 成功。回退來源全套 313/313、validate／diff-check 通過。
- [x] `npm run verify:production` 已確認 17 個公開資產逐位元組回復原正式版本；沒有以被取消的 workflow 當作未發布證據。
- [ ] 只刪未部署引用的歷史 v199 需明確批准；未執行版本刪除、業務資料／私有文件／Properties／trigger／LINE 寫入。
- [ ] 新版完整發布與真人 506 初始讀數／照片／手機驗收尚未完成；不可將候選測試或使用者前次紙本成功回報當成本次驗收。

## 2026-10-01 紙本補登初始電表與資料查看修復

- [x] Phase 209 runtime 重現缺失讀數被接受、照片／自拍未保存、舊報到更新可覆寫基準後修復。缺失／負數／非有限／布林拒絕；真實零保存；租約 scoped 基準和文件一起回滾／冪等。
- [x] 既有租約只補初始電表，不改房客／租约／房間／使用者列；既有值不可覆寫，跨 Workspace、錯誤 tenant 與重複 checkin 拒絕。報到資料更新不得抹掉已補的基準。
- [x] 新 POST bridge 的實際 dispatcher 測試：read／contract_write、零度序列化、過期／缺失 session、query 憑證與 malformed input 拒絕；viewer 可讀不可寫。
- [x] 舊入住列 Workspace 空白且初始讀數為 0 時，讀取／補填先拒絕關聯衝突；不當作缺失追加第二個基準，不做欄位 migration。
- [x] Frontend runtime／DOM 18/18、Billing 實際 handler runtime 81/81、全套 420/420、validate、後端合併全域語法、三頁 inline scripts 與 diff-check 通過；獨立審查無 Critical／Important。共用固定 release cache tag 同步為 `20261001-paper-initial-meter-v1`。
- [x] 正式 backend v201 immutable export／deployment 核對；Pages 公開讀回另見上方發布恢復清單。
- [ ] 真人 506 實際讀數／私有照片補傳、登入後操作與手機真機為 HUMAN_REQUIRED／UNVERIFIED。發布本身不代填資料、不重算已出帳、不發 LINE。

## 2026-10-01 紙本轉換房客使用者查找修復（Version 200）

- [x] 正式唯讀核對僅讀 506 的合約／房客／邀請關聯 ID、狀態及對應使用者的角色／綁定狀態：帳號已存在且未綁定，ID 關聯一致；`V2_users` 無 `workspace_id`／`landlord_id` 欄，舊查找因此誤報不存在。未讀姓名、電話、Email、身分證、檔案內容或邀請 hash。
- [x] 正式全域 user schema 夾具先重現失敗，再驗證依已核對的 tenant user ID 沿用唯一既有帳號；不追加欄位或重建身份。拒絕錯誤角色、其他 active Workspace、LINE／binding 證據、重複 user ID 或其他房客參照，並測試原帳號回復與冪等重送。
- [x] Phase 209 真正執行補登 handler，先重現「找不到既有房客使用者資料」：具 pending 邀請的電子草稿缺少 `V2_users` 時，舊 guard 只接受 `legacy_pending`，錯誤阻擋電子轉紙本。
- [x] 空白／標準 `contract_origin`、保留／缺少 user ID 四種情境均能在原房客上補齊帳號，保留原合約與邀請稽核，不建立第二筆房客；重送為冪等結果，不發 LINE。
- [x] 跨 Workspace user ID、合約／房客 user ID 不一致、邀請已認領／有認領時間、邀請房間不一致、房客已綁定均在任何 Sheet／Drive 寫入前拒絕；邀請檢查不受帳號存在與否影響，正式全域既有帳號三種負向情境先重現繞過後修復。下游失敗會回復原房客／合約／邀請並移除本次新帳號／文件紀錄。
- [x] 21 項新增具名回歸及既有 Phase 209／215 通過；完整 `npm test` 313/313、`npm run validate`、`git diff --check` 通過。
- [x] 正式帳號、專案與既有 deployment 再次核對；本輪首次推送前 serving Version 198 及 editor HEAD 59 檔與前一正式來源相符。本次僅紙本補登模組改變。Version 200 唯讀匯出 59 檔與修正版 `3e5ba45` 逐位元組一致；同一正式 deployment 讀回為 Version 200，URL 不變，Version 198 保留回退。審查揭露的 Version 199 未服務且已被取代。
- [ ] 真實 506 紙本／身分證上傳、補登後綁定仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。沒有代送交易、改寫業務列、讀寫私有文件、變更 Properties／trigger 或送 LINE。

## 2026-09-30 506 Email session／舊格式邀請重發與取消

- [x] 房東桌面 Email session 可在有效且完成 onboarding、重新核對目前
  Workspace 與 `contract_write` 權限後，使用既有邀請重發／取消入口；房客簽署
  審核 session 驗證不放寬，身分或權限不符仍拒絕。
- [x] Phase 163 先重現 `LANDLORD_REVIEW_SESSION_INVALID`，再驗證 Email session
  可重發及取消，且無寫入權限時邀請與合約狀態維持原值。
- [x] 舊合約缺少 `contract_origin`／`invite_id` 時，只在邀請、合約、房間與
  Workspace 關聯相符且唯一有效邀請可確認時允許重發／取消；來源衝突、邀請不明確
  或跨 Workspace 合約均拒絕或只取消指定舊邀請，不誤改合約狀態。
- [x] Phase 163 定向測試、完整 `npm test`（282/282）、`npm run validate` 與
  `git diff --check` 通過。
- [x] 發布前唯讀核對正式 Web App deployment 指紋符合公開網站，當時服務 Version 196；
  59 個來源檔與當時 GitHub `main` 只在 Email session 權限修正有差異，
  與本次候選只在舊格式邀請關聯／取消範圍修正有差異。
- [x] PR #183 合併後，Version 197 唯讀匯出與 `main/apps-script/` 的 59 個檔案
  逐位元組一致；既有正式 Web App deployment 讀回服務 Version 197，Version 196
  保留回退。未修改 Sheets 業務資料列、Properties、Triggers 或發送 LINE；
  GitHub Pages 15 個公開檔案與合併來源逐位元組一致。
- [x] 2026-10-01 跨月重新執行時，Phase 162 夏月費率與 Phase 177 當前租約
  兩項測試的隱含「今日」假設被揭露；測試夾具固定於 2026-09-30，未改產品程式。
- [ ] 真人登入後對 506 邀請實際執行重發／取消的驗收尚未完成；本次部署驗證
  不代表已執行任何邀請交易。

## 2026-09-29 506 快速租約回找與桌面 Email 建立流程（本地候選，未發布）

- [x] 只讀核對正式資料：`V2_contracts` 的 506（`R000016`）有一筆
  `pending_tenant_signature` 合約；`V2_contract_invites` 有對應的 `pending`
  邀請且仍在有效期限內。未讀取房客姓名、電話、Email、確認碼雜湊或其他密鑰值。
- [x] 後端列表在正式表缺少 `contract_origin`／`invite_id` 表頭時，改以同 Workspace
  的邀請表 `contract_id` 關聯回找 pending 邀請，並回傳邀請連結；不做 Sheet
  表頭補建、資料列回填或其他正式資料寫入。
- [x] 桌面 Email session 的快速租約初始化與房東發起新租約改走已驗證的 POST
  bridge；伺服器先解析 Email session、Workspace 與角色權限，再呼叫既有 handler。
  無效 session 直接拒絕，不落回 LINE webhook；手機 LINE JSONP 路徑保留。
- [x] `landlord-desktop-quick-lease-bridge.test.mjs` 與 Phase 163 邀請回找測試
  已先失敗再通過；尚未宣稱真人登入、瀏覽器、LINE 或正式站驗收。
- [ ] 本候選尚未推送、合併或部署；正式 506 顯示與邀請連結仍需取得明確的
  Production 發布授權後，再做登入後瀏覽器驗收。

## 2026-09-29 簡易新租約的過期已出租房間提示（本地候選，未發布）

- [x] 後端初始化資料已有 `room_status` 與 `has_current_or_upcoming_contract`；
  租約已過期、房間仍標示 `occupied` 時，簡易新租約房號選單顯示
  「房況待核對，勿作空房」，不再以沒有當前租約推論為空房。
- [x] 仍標示 `occupied` 的房間在送出前由前端驗證攔下，提示先確認續約
  或完成退房；若另有當前／未來租約，選單會明示「已出租，已有租約」，
  不再暗示可以直接建立新房客租約。真正 `vacant` 的房間仍可通過驗證。
  `landlord-simple-lease-expired-occupancy.test.mjs` 已先失敗再通過。
- [x] `npm test` 267/267、`npm run validate` 與 `git diff --check` 通過；
  本次未修改 Apps Script，既有房況與建約回歸包含在完整測試內。
- [ ] 此為本地前端修正，不改 502 的正式房況、房客、租約或帳務資料；
  尚未推送、合併或部署，也未完成真人登入後的網站驗收。

## 2026-09-29 房東寫入登入循環／房況誤判（Version 193／PR #178 已發布）

- [x] `landlord-tenant-create.html` 與 `landlord-tenant-checkin.html` 的 LINE
  OAuth 返回路徑保留一次性 LINE 意圖；桌面已有 Email session 也不能把原生合約
  寫入流程攔回 Email 驗證碼頁。`landlord-tenant-create-line-return.test.mjs`
  已先重現失敗，再驗證局部修正。
- [x] 租約過期但房間仍關聯啟用房客時，物件頁標示「待核對」而非「空房」；不提供
  重複建立房客／編輯／封存入口。即使租約顯示已結束，只要仍關聯啟用房客也先待核對；
  無房客關聯的已結束租約才顯示空房。不改正式租約或房況資料。
  `landlord-room-expired-occupancy-review.test.mjs` 已先失敗再通過。
- [x] `landlord-room-write-guards.test.mjs` 先重現編輯 502 可能誤寫空房、封存
  未核對房客及物件封存 handler 未取得 Spreadsheet 的缺陷；現禁止待核對房間編輯／
  寫入／封存，後端重查啟用房客或缺失的房客關聯。另驗證唯讀角色及跨 Workspace
  房間不能寫入；正常有效租約的房間仍可更新租金／備註而維持已出租。
- [x] 桌面 Email session 的物件／房間儲存、封存與房間帳號切換五個既有 action
  改走受控 POST bridge；伺服器先驗證 Email session，再交給既有 Workspace／
  寫入權限 handler。`landlord-property-email-write-bridge.test.mjs` 覆蓋
  正確路由、參數及無效／缺少 session 時零寫入，並使用實際 session resolver 驗證撤銷、
  過期、停用、Workspace／角色變更；驗證每個寫入 handler 均綁定 session 的
  Workspace、缺少 Workspace 時拒絕、`enabled=false` 不遺失；已先重現失敗再修正。
  另以失敗用例驗證表單 bridge 不可從 URL query 繼承 session token；dispatcher
  現只解讀原始 POST body，既有 read-bridge 定向回歸仍通過。
- [ ] 正式 502 房間的實際占用仍需人工核對，不能宣稱資料已修復；Email 驗證碼路徑
  未變更，使用者回報其寄送失敗僅發生於重複回旋之後，不能把它當獨立根因。
- [x] `npm run validate`、265/265 Node 測試與獨立複審通過；PR #178 已合併，
  Apps Script 同一正式 deployment 更新至 Version 193，GitHub Pages merge commit
  `533c718` 建置完成，公開 15 個資產逐位元組讀回一致。Version 192 與前一個
  Pages commit `bccaab5` 保留為回滾目標；未改 Sheet 業務資料。
- [ ] 真人在 Chrome 與 LINE 完成登入、建立／報到及房況回歸驗收，仍為
  `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-27 房東 POST/read bridge 測試夾具修正（測試／文件限定）

- [x] 根因確認：舊測試只抽取 `doPost(e)`，漏載正式 dispatcher 在入口呼叫的
  `repairRouteRequestFromPostBody_` 及相依 helper，所以測試 VM 發生
  `ReferenceError` 後落入 fallback；正式 Apps Script dispatcher 並沒有此缺漏。
- [x] Bridge 測試改載正式 repair pre-dispatch helpers，並確認房東唯讀 action
  會放行至主 dispatcher、真正 repair action 仍由 repair handler 接手；snapshot
  測試則明確 stub 無關的 repair pre-dispatch，以專注驗證 request-local snapshot。
- [x] Focused regression `5/5`、完整 `npm test` `246/246`、`npm run validate`
  通過（59 backend files、38 endpoint references、static release-cache validator），
  `git diff --check` 通過。
- [x] 僅變更測試與文件；Apps Script、前端、API 行為及正式資料均未修改，故本次
  不需也不應觸發正式網站部署。這是測試品質修正，不宣稱修復了任何 Production
  runtime 故障；實際登入後 Email／LINE bridge 驗收仍為 `HUMAN_REQUIRED`。

## 2026-09-23 正式 Workspace 房間中心（已發布，Version 192）

- [x] 新增 `landlord_room_center_init` 唯讀路由，依登入房東的 Workspace
  scope 回傳全部房間；房間中心預設要求包含已封存房間，前端可再篩選。
- [x] 後端使用明確 allowlist projection，不回傳房客、租約、帳單、押金、
  付款帳戶、物件所有人或報修資料；桌面 Email 走既有 POST bridge，手機 LINE
  走既有 JSONP read path。
- [x] 房間中心加入正式站入口、搜尋與所有／啟用／空房／已出租／已封存篩選，
  不使用 staging Workspace 或測試房間資料。
- [x] `tests/room-center-production.test.mjs`、新 Apps Script 全檔
  `node --check` 通過。
- [x] Apps Script Version 192 已部署至原正式 Web App deployment slot，Version
  191 保留 rollback；GitHub Pages workflow `35799969425` 以 PR #175 merge
  commit `d01d2253` 成功發布，`landlord-rooms.html` HTTP 200。
- [x] 正式登入回讀確認目前正式 Workspace 顯示 22 間房；包含 101、201、202、
  203、301、302、303、305、306、401、402、403、405、406、501、502、503、
  505、506、601、602、603。頁面只顯示房間營運資料，沒有房客個資、租約或帳務。
- [x] 初版逾時根因已回歸覆蓋：房間頁必須把 `apiUrl: API_URL` 與
  `lineUserId: LINE_USER_ID` 傳給共用 API client；否則 JSONP 會回到 Pages 文件並
  造成 `Unexpected token '<'`。`tests/room-center-production.test.mjs` 已鎖定此契約。
- [x] `npm run verify:production -- --live` 通過，12 個公開資產與 checkout
  逐位元組一致；正式頁不使用 staging Workspace 或測試房間資料。
- [ ] 正式 Workspace 登入後全房間數量回讀與手機／桌面 UAT：
  `HUMAN_REQUIRED`／`UNVERIFIED`。rollback target 為 Pages 上一個 verified
  commit `dce1f02` 與 Apps Script Version 190；本功能只讀，不涉及 Sheets
  migration 或資料列寫入。

## 2026-09-18 作廢帳單成功提示（本地候選）

- [x] 作廢測試帳單成功後，欠款頁顯示獨立的「作廢成功」提示，包含帳單 ID。
- [x] 成功提示說明帳單已封存，重新整理後不會再列入欠款清單；提示不會被欠款清單重繪覆蓋，並可由房東關閉。
- [x] 成功提示使用 `role="status"` 與 `aria-live="polite"`，並由 `tests/test-bill-archive.test.mjs` 靜態回歸鎖定。
- [x] PR #171 merge commit `31515af` 已發布；Pages workflow `35344387333` 成功，公開欠款頁 HTTP 200 read-back 已確認提示節點與文字已服務。
- [ ] 仍需由已登入房東在手機／桌面實際作廢一次測試帳單並確認提示可見；狀態為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-18 一次性測試帳單作廢／封存正式發布

- [x] 已新增 `landlord_bill_test_archive_candidates` 唯讀候選查詢；主
  `landlord_arrears` 快速路徑維持只讀取物件與帳單，候選查詢才讀取房間狀態。
- [x] 已新增 `landlord_bill_test_archive`；後端重新驗證 Workspace、房間帳號
  已關閉、帳單未付款且無付款紀錄，沿用共用取消核心服務，不建立付款、不發送
  LINE、不刪除資料，並寫入 Workspace 操作稽核。
- [x] 已加入封存按鈕、冪等已封存回應、純函式／靜態回歸測試；本地 focused
  tests 通過，正式 Sheet、登入後欠款頁與一次性操作仍待 authenticated UAT。
- [x] PR #169 merge commit `257093b6b03838275342d67944ce6988edf57d3b` 已合併至
  `main`；Apps Script Version `190` 已更新既有正式 Web App，Version `189` 保留 rollback。
- [x] GitHub Pages workflow `35339276140` 的 build、deploy、status jobs 全部成功；公開
  `landlord-arrears.html` HTTP 200 read-back 已確認封存按鈕與兩個新 route 已發布。
- [x] Version 190 唯讀匯出 58 個檔案與候選 `apps-script/` 逐檔一致；本次未修改正式
  Google Sheets 業務資料列、Drive、Properties、Trigger 或 LINE。
- [ ] 登入後欠款頁的真實房東一次性操作、手機／LIFF UAT；狀態仍為
  `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-15 房間報修工單 Task 6 本地 release-boundary record

- [x] Implementation source candidate is
  `3b12c617216040974700fa6b3238db2e9652f310` (`3b12c61`), the verified Task 5
  code/UI commit. The separate Task 6 documentation/release-verification
  record is `73ad047ffde25ee636e197b37360b70e8fc8129f` (`73ad047`), a
  documentation-only child commit. Neither value is the fix-round commit for
  this correction; the documentation record remains local and has not been
  deployed, pushed, merged, or reconciled against live Apps Script or Google
  Sheets.
- [x] Focused repair-ticket command passed `26/26`: contract, runtime/RBAC,
  migration idempotency/preview, and tenant/landlord privacy UI tests.
- [x] `npm run validate` passed: `57` backend files parsed, `37` endpoint
  references matched, and static release-cache validation passed.
- [x] Required Apps Script syntax checks passed for the six specified files:
  `V2_REPAIR_TICKETS.js`, `V2_TENANT_MESSAGES.js`,
  `V2_LANDLORD_MANAGEMENT.js`, `V2_WORKSPACE_LANDLORD_ACCESS.js`,
  `V2_RUNTIME_SNAPSHOT.js`, and `程式碼.js`.
- [x] Historical baseline note (corrected 2026-09-27): the two failures recorded
  above were test-VM harness omissions, not dispatcher regressions. The isolated
  fixture correction and production-helper pass-through regression now pass;
  see the 2026-09-27 test-only entry above. No repair-ticket runtime change was
  needed or made.
- [x] Repair-ticket tests assert server-side Workspace/tenant filtering,
  allowlisted projections, POST-only bridge transport, append-only event
  history, source-message idempotency, and preview no-write behavior.
- [ ] Authenticated landlord Email session, authenticated tenant LIFF session,
  real Tenant A/B room-transfer privacy validation, actual bridge origin/live
  update feedback, and actual Apps Script preview plus backup/header/row-count
  reconciliation remain `HUMAN_REQUIRED` / `UNVERIFIED`.
- [x] No migration apply, deployment, Google Sheets change, LINE send, push,
  merge, or authenticated external-service action was performed. Local checks
  must not be reported as Production readiness.
- [x] Rollback boundary: revert or disable the repair API/UI caller (including
  the tenant route or optional room summary) and retain all append-only repair
  ticket/event rows plus legacy message rows. Do not delete or rewrite history.

## 2026-09-13 桌面房客詳細／合約 Email 唯讀 session 修正（已部署）

- [x] 房客詳細頁載入共用桌面 responsive shell，桌面寬度顯示側欄與桌面主內容，不再以手機底部導覽殼層呈現。
- [x] 原生簽署審核與房東發起合約的唯讀初始化改用共用 session resolver；有效 Email session 可讀取，合約寫入仍不接受 Email fallback。
- [x] 新增 Phase 259 靜態／runtime 回歸測試；完整 Node suite `131/131`、Apps Script 全檔語法、房客詳細頁 inline JS、static release-cache validator 與 `git diff --check` 通過。
- [x] merge commit `662e20ad1f350da1d8fd71a129c1faf7a16aa1e9` 已推送至 `main`；GitHub Pages workflow `34709094999` 成功，公開房客詳細與合約頁 read-back 已確認新程式已發布。
- [x] 正式 Apps Script 專案與候選來源唯讀比對僅有本次 3 個後端檔案差異；已更新前端實際使用的既有 Web App 至 Production Version `187`，原 Version `160` 保留為 rollback。
- [ ] `npm run validate` 未列為通過：乾淨 `main` 沒有 `package.json`；根目錄舊 validator 另以過期的 71 條 route 預期檢查 88 條 route，並誤判 `tenant_payment_account_cover` 首層 handler。此為既有檢查器基線限制，未以它冒充 release pass。
- [ ] 正式 Chrome／Email／LINE 真實點擊驗收；狀態仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-13 房東桌面 Email 詳細／合約讀取路由修正（已部署）

- [x] 房客詳細與帳款頁改由共用 `landlord-auth.js`／`landlord-api.js` 啟動；桌面 Email session
  會走已驗證的 hidden POST bridge，不再把受保護讀取誤送到 LINE LIFF。
- [x] 合約頁的原生簽署審核與房東發起合約兩個唯讀清單沿用既有 Email session token；桌面 Email
  仍對尚未支援的寫入操作保留 `DESKTOP_EMAIL_UNSUPPORTED` fail-closed 行為。
- [x] 新增 Phase 258 回歸測試；完整 Node suite `207/207`、`npm run validate`、static
  release-cache validator、`node --check` 與 `git diff --check` 通過。
- [x] 已合併至 `main`，merge commit `2b39136c016ee1592536c70f4ad69f41683fee6a`；GitHub Pages
  workflow `34706637008` 成功，公開房客詳細、帳款與合約頁 read-back 已確認新程式已發布。
- [ ] 已登入 Chrome 實際點擊房客詳細、帳款查看房客與合約清單；狀態仍為
  `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-12 房東退房欄位 iOS 自動放大修正（已部署）

- [x] 退房頁 `input`／`textarea`／`select` 明確使用 `16px`，避免 iOS 聚焦時自動放大並讓欄位跳離視窗。
- [x] 檔案欄位不再使用小於 `16px` 的字級；原有 `visualViewport` 鍵盤避讓與焦點捲動邏輯保留。
- [x] Phase 257 通過；完整 Node suite `206/206`、`npm run validate` 與 `git diff --check` 通過。
- [x] PR #161 已合併至 `main`，merge commit `d3ed41b7efda071978943f55167cadaa0b72b04a`。
- [x] GitHub Pages workflow `34700989635` 成功；公開退房頁 HTTP 200 read-back 已確認 `16px` 規則已發布，
  前一個已驗證提交 `c2cbf9238ecd1e7d79fe0911ffc96b4d98857544` 為 rollback target。
- [ ] 真實 iPhone／LINE LIFF 欄位操作；狀態為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-12 房東退房鍵盤遮罩修正（已部署）

- [x] 鍵盤開啟時退房頁收起不必要的底部安全間距，並以 visualViewport 可視範圍重新校正目前焦點欄位。
- [x] 手動退房的押金扣除說明、點交備註與完整電表欄位沿用同一套焦點可視化處理。
- [x] Phase 255 更新／Phase 256 通過；完整 Node suite 205/205、Apps Script syntax、
  inline JavaScript syntax、npm run validate、static release-cache validator 與
  git diff --check 通過。
- [x] PR #159 已合併至 `main`，merge commit `5d8eeb97dc5f8d505e355b75f28913fd36aecba1`。
- [x] GitHub Pages workflow `34697177348` 成功，公開退房頁 HTTP 200 read-back 已確認
  鍵盤可視性修正已發布；前一個已驗證提交 `fb80e0de398f2a910d927be3713049b2aa311232`
  為 rollback target。
- [ ] 真實 iPhone／LINE LIFF 欄位操作；狀態為 HUMAN_REQUIRED／UNVERIFIED。

## 2026-09-11 房東退房快速結案（已部署）

- [x] 快速結案不要求電表讀數或照片，使用房東輸入的手動應收金額與實際退款金額完成最終結算。
- [x] 伺服器驗證押金上限、押金扣除說明與冪等鍵；完整電表結算流程保留。
- [x] Phase 252／253／254 通過；完整 Node suite `203/203`、Apps Script syntax、static
  release-cache validator 與 `git diff --check` 通過。
- [x] PR #155 merge commit `6fa0bba63f4b0a07bd72b2d2bf8dfb061869dc92` 已合併；Apps Script
  Production Version 186 已部署至既有 Web App，Version 185 保留 rollback；必要的
  `runV2CheckoutSettlementProductionMigration` 已在已登入 Apps Script 編輯器執行完畢。
- [x] GitHub Pages workflow `34598441945` 成功；公開房東頁與退房頁 read-back HTTP 200，
  新 marker、快速結案欄位與「處理中，請勿重複按」均已確認。
- [ ] 真實房東帳號手機／Chrome／LIFF 退房操作與實際資料結果；狀態為
  `HUMAN_REQUIRED`／`UNVERIFIED`，未執行真實退房交易。

## 2026-09-18 快速結案同步退房帳務（已部署）

- [x] 快速結案將同一 Workspace／房客／房間／合約範圍內的未繳 `V2_bills` 更新為
  `payment_status=paid`，已繳帳單與其他合約帳單不受影響。
- [x] 同步帳單不改原始金額、不建立虛假 `V2_payments`；重送相同 idempotency key
  不重複處理，並回傳已同步帳單數量／ID。
- [x] PR #167 merge commit `4069e6fd0523a3c5f3d5caf307a5a76c4155c6a6`、GitHub Pages
  workflow `35326158352` 與 Apps Script immutable Version 189 已完成；Version 188 為 rollback。
- [ ] 正式房東登入、手機／LINE 退房操作與實際帳單結果；狀態為
  `HUMAN_REQUIRED`／`UNVERIFIED`，未執行真實退款或業務資料寫入。

## 2026-09-11 房東桌面版手機分享網址（已部署）

- [x] 「更多功能 → 開啟桌面版」開啟分享面板，不再直接導覽。
- [x] 面板顯示不含 session 的固定 Email 登入網址，支援複製與手機系統分享。
- [x] Phase 232／250／251 focused tests 通過；Email mode 仍在 LINE 初始化前分流。
- [x] PR #153 已合併；GitHub Pages workflow `34584013793` 成功，公開分享面板與 Email
  mode 入口 read-back HTTP 200，舊直接跳轉 anchor 已移除。
- [ ] 真實手機分享網址後在電腦開啟、Email OTP 登入與回到房東首頁；狀態為
  `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-11 房東桌面入口 Email mode 分流（本地候選）

- [x] 「更多功能 → 開啟桌面版」連結明確帶 `mode=email` 與安全 `return_to`。
- [x] `landlord-entry.html` 在 Email mode 先顯示 Email OTP，不初始化手機 LINE session。
- [x] 一般 LINE 入口與主動「使用 LINE 登入」分支維持原流程。
- [x] Phase 232 更新、Phase 250 新增回歸測試均通過。
- [ ] 推送、合併、GitHub Pages 發布與公開 read-back。
- [ ] 真實手機 LINE WebView 點擊桌面版、桌面 Email OTP 登入與返回首頁；狀態為
  `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-10 房東共用腳本快取版本修正（已部署）

- [x] 房東頁面的 `frontend-release.js`、`landlord-auth.js` 與 `landlord-api.js` 使用
  同一個固定 cache-busted marker `20260910-landlord-read-bridge-v2`。
- [x] `tests/phase249-landlord-shared-script-cache-bust.test.mjs` 通過，確認所有房東頁
  不會再以未版本化網址載入共用登入／API 腳本。
- [x] `npm run validate` 通過；`git diff --check` 通過。
- [x] 完整 Node suite `198/198` 通過；Phase 209 測試使用固定測試時間，避免日期漂移。
- [x] PR #150 merge commit `2cc882a33654e8d027cbce3514170c450374a9e1` 已合併；GitHub
  Pages workflow `34423919614` 成功，公開新 marker HTML／共用腳本 read-back 通過。
- [ ] 已登入 Chrome／手機重新登入後驗證首頁、圖表、房客、物件、合約、帳款及側欄
  Workspace／角色狀態；仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-10 房東桌面多頁 POST bridge 逾時修正（已部署）

- [x] `doPost` 對帳款、合約唯讀初始化、通知、付款回報、營收圖表、Workspace context
  與手動銷帳狀態查詢回傳 hidden iframe bridge response，並沿用 server-side principal
  verification。
- [x] 桌面帳款／合約頁允許唯讀初始化；人工銷帳、合約申請異動與其他寫入仍被
  `DESKTOP_EMAIL_UNSUPPORTED` 保護。
- [x] `landlord_bill_manual_settlement_status` 納入 request-local read snapshot 與
  shared read retry/dedupe action allowlist。
- [x] `tests/phase246-landlord-post-read-bridge.test.mjs` 通過；完整 Node `195/195`、
  Apps Script 全檔 syntax、static release-cache validator、`git diff --check` 通過。
- [x] PR #147 merge commit `f72cfee37013fe3952445d32ed41ceac757cf72c`；Apps Script
  Version 183 已部署至既有 Web App deployment，Version 182 保留 rollback；Pages
  workflow `34410925756` 成功。
- [ ] 已登入 Chrome／Email session 實際驗證總覽圖表、全部側欄頁面、Workspace／角色
  狀態；仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-09 桌面版首頁 API 逾時後續修正（已部署）

- [x] Read-only Web App actions skip repeated schema mutation checks；寫入路徑仍保留 schema protection。
- [x] Workspace row helper、Email auth rows、Workspace access resolution 共用單次 request snapshot/cache，避免同一個 Email bridge request 重複掃描相同資料。
- [x] `tests/phase243-landlord-request-cache.test.mjs` 通過。
- [x] 完整 Node suite `191/191` 通過；Apps Script syntax、static release-cache validator、`git diff --check` 通過。
- [x] Apps Script immutable Version 181 已部署到既有 Web App deployment；Version 180 保留為 rollback，Web App URL 不變。
- [x] 公開 `landlord-home.html` read-back HTTP 200，仍指向目前正式 API；未登入 read-back 未寫入資料。
- [ ] 已登入桌面版／手機 LIFF 首頁與房客頁實機驗收；仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-09 桌面版 landlord API 讀取逾時修正（已部署）

- [x] `landlord_home_bootstrap` 與 `landlord_tenants` 共用同一個 request-local
  Sheet snapshot，避免同一個 API request 重複掃描相同工作表。
- [x] `landlord-read-snapshot-regression.test.mjs` 通過；完整 Node suite
  `190/190` 通過；`git diff --check` 通過。
- [x] Apps Script immutable Version 180 已更新目前公開頁使用的既有 Web App
  deployment；Version 179 保留為 rollback，Web App URL 不變。
- [x] 公開 endpoint read-back HTTP 200；未登入測試未帶 session、未寫入資料。
- [ ] 已登入桌面版首頁／房客名單驗收；目前仍為 `HUMAN_REQUIRED`／`UNVERIFIED`。

## 2026-09-09 房東入口登入過期修正（已部署）

- [x] LIFF 初始化／getProfile 憑證過期顯示重新登入，不導向註冊。
- [x] 過期身份不繼續呼叫房東狀態 API；錯誤顯示不自動跳轉。
- [x] 外部瀏覽器按一次後 logout/login，LIFF 內按一次後重開 LIFF URL。
- [x] 重新登入立即禁用按鈕防連按；SDK 失敗可再操作。
- [x] OAuth code/state 不沿用；既有安全 return_to 保留。
- [x] 本機 `file://` 測試與未登入分支改用正式 GitHub Pages HTTPS 入口，不再把 file URL 傳給 LINE。
- [x] 一般網路失敗不登出，正常登入路徑不變。
- [x] 完整 Node `189/189`、Apps Script／前端 JavaScript syntax、靜態 release cache validator 與 `git diff --check` 通過。
- [x] PR #140 merge commit `17843ecae0094fbf15153bbca806a9aff347a0f7` 已合併至 `main`；Pages workflow `34338782441` 成功。
- [x] 公開 `landlord-entry.html`、`landlord-home.html`、`frontend-release.js`、`landlord-arrears.html`、房客入口頁均 HTTP 200；公開 marker 與 HTTPS 回跳函式 read-back 通過。
- [ ] iPhone LINE 與外部瀏覽器重新取得憑證、登入返回的實機驗收。

## 2026-09-09 手動銷帳逾時保護（version179 / PR138）

- [x] 狀態查核要求同 Workspace、正式已繳帳單、對應 confirmed 付款及相同金額。
- [x] 鎖忙碌、付款不符、越權或查詢失敗不得當成已銷帳。
- [x] 按鈕處理中連按只送一次；逾時後再按只查核，不再寫入付款。
- [x] 回復改成單次特定帳單查核，不再以欠款清單消失判定成功。
- [x] Node regression suite: 188/188（含 manual-settlement-status、phase147）。
- [x] 後端179版匯出56檔一致；Pages run34333318588成功，公開頁面與候選SHA相同。
- [x] 新狀態route未提供身份時回覆MISSING_ID，不暴露帳務資料。
- [ ] 正式手機 LIFF 銷帳成功／通知結果／实际耗時驗收。
- [ ] 正式 Apps Script 各階段耗時紀錄；不得用執行完成推論付款成功。

獨立 worktree 的 npm run validate 誤用上層 legacy package，不能視為候選
通過。顯式指定候選的 validator：88 unique routes、無重複宣告、語法及連結
通過；既有巢狀 tenant_payment_account_cover handler 未被舊檢查器辨識，
整體 exit 1。此限制不是新增狀態查核 route 的錯誤。

## Gate 0：靜態驗證

- [ ] 所有 `.gs` 通過 JavaScript syntax check
- [ ] 所有 HTML inline script 通過 syntax check
- [ ] 無重複 top-level function
- [ ] 無重複 top-level const
- [ ] `Code.gs` 無重複 route
- [ ] route count 與 manifest 一致
- [ ] canonical 目錄無 `_FIXED`／`_WITH_` 版本檔
- [ ] 無密鑰與 token

## 身份與入口

## 報修工單歷史與個資隔離（Phase 262 contract）

- [ ] 房客 A 建立報修後換租，房東仍可依 `workspace_id + room_id` 查到完整歷史，且原 `tenant_id_snapshot + lease_id_snapshot` 不被覆寫。
- [ ] 房客 B 的 response 在序列化前即完成 Workspace、房客與房間篩選；不得包含 A 的姓名、電話、Email、LINE ID、原始訊息、內部備註或附件 metadata。
- [ ] 房客 B 替換 `tenant_id`、`room_id` 或工單 ID 時，伺服器拒絕或回傳空集合，不洩漏其他房客資料。
- [ ] 工單狀態只使用 `open`、`in_progress`、`awaiting_confirmation`、`completed`、`closed`；每次更新均新增 append-only event 與 actor audit。
- [ ] 只接受 `tenant_repair_tickets_init`、`landlord_repair_tickets_init`、`landlord_repair_ticket_update` 三個 documented actions；未知 query-string action 必須拒絕。

## 報修工單 UI 與房客投影（Phase 265）

- [x] 房東訊息頁保留既有一般訊息清單與篩選，並以既有受驗證房東 POST bridge 讀取 `landlord_repair_tickets_init`；房間與工單狀態可篩選，按 `room_id` 分組顯示狀態、優先程度、原房客／租約快照、責任、費用與最新公開事件摘要。
- [x] 房東 repair 更新在按鈕 busy 時鎖定，僅以一次 `landlord_repair_ticket_update` POST bridge 提交 `ticket_id`、狀態與公開回覆；成功或失敗在頁面回饋，不會傳送 Workspace、房東、房客或租約識別作為 authority。
- [x] 房客頁只在 LIFF 已取得 `id_token` 後，以 controlled HTML POST bridge 呼叫 `tenant_repair_tickets_init`；repair renderer 只插入類型、標題、優先程度、狀態、建立／完成日期與公開摘要，絕不讀取或以 CSS 隱藏歷史原始訊息、房客／租約快照、內部備註、附件／儲存 ID、電話、Email 或 LINE identifier。
- [x] Tenant A／Tenant B 負向 fixture 驗證 Tenant B 的 repair payload 與 render output 不含 Tenant A 的姓名、電話、Email、LINE ID、原始訊息、私有附件檔名或租約 ID（`tests/phase265-repair-ticket-privacy.ui.test.mjs`）。
- [ ] `HUMAN_REQUIRED`：以真實已登入房東 Email session、房客 LIFF session 與換租 Tenant A/B fixture，在裝置／瀏覽器確認 bridge origin、讀寫回饋、房間篩選與跨房客畫面隔離；靜態測試不代表 authenticated Production acceptance。

- [ ] 未登入房東導向 LIFF 登入
- [ ] 登入後返回原頁
- [ ] 新房東註冊
- [ ] onboarding 暫存與完成
- [ ] 房客未綁定導向 bind
- [x] 房客直接開啟首頁時，LINE 登入回跳先經正式 `tenant-bind.html` Endpoint，再回到原頁，避免 deep URL 造成 LINE 400（Phase 167 靜態回歸測試；真機待驗證）
- [x] 房客綁定狀態查詢對 Apps Script 偶發慢回應採 30 秒逾時、一次重試，且不重試綁定寫入
  （`tests/tenant-binding-api-resilience.test.mjs`；尚未做真機或 Production 驗證）
- [x] 房東入口狀態查詢改用不依賴 JSONP callback 的 CORS JSON fetch，保留 25 秒逾時與錯誤提示
  （`tests/phase170-landlord-entry-status-fetch.test.mjs`；尚未做真機或 Production 驗證）
- [x] 房客詳細頁的房客清單與合約申請初始化改用不依賴 JSONP callback 的 CORS JSON fetch，保留 30 秒逾時與錯誤提示
  （`tests/phase171-landlord-tenant-detail-fetch.test.mjs`；尚未做真機或 Production 驗證）
- [x] 房東房客名單只為未綁定房客顯示「邀請綁定」；手機使用系統分享，桌機複製不含房客個資的 `tenant-bind.html` 連結（`tests/tenant-binding-invite-share.test.mjs`）
- [ ] `+886` 與 9 位手機正規化
- [ ] 不同 Workspace 不可互看

## Workspace 與團隊

- [ ] 建立 Workspace
- [ ] owner 成員建立
- [ ] 邀請與取消
- [ ] 接受邀請
- [ ] 角色與權限更新
- [ ] 移除成員
- [ ] Workspace 切換
- [ ] 操作稽核記錄操作者

## 物件、房間與房客

- [ ] 建立／修改／封存物件
- [ ] 建立／修改／封存房間
- [x] 房東可停用／重新啟用房間帳號，僅更新 `account_status` 且保留租約、帳單與付款紀錄（`tests/room-account-toggle.test.mjs`）
- [ ] Workspace 預設值正確帶入
- [ ] 輸入租金自動計算押金
- [ ] 夏月區間與跨年度判斷
- [ ] 建立房客
- [ ] 建立房客後首頁、房客清單與詳細頁一致

## 租約

- [x] 新租約建立：房東簡易流程以房號、租期、租金、押金建立待房客簽署的新租約，結束日由租期自動計算，費用預設由房間帶入（Phase 157／208；已完成本地邏輯與靜態回歸，LIFF 真機簽署仍 `HUMAN_REQUIRED`）
- [x] 新租約／紙本補登可由房東明確標記「簽約時已收首月租金＋管理費」；合約保存月份／金額快照，首月帳單以房客可見折抵明細抵銷租金與管理費，兩個月押金不併入月帳單折抵，文件查詢沿用 append-only 合約歷史鏈（Phase 224／225；本次修正待部署與手機／LIFF 真機 UAT）
- [ ] 房客端看到正確租約
- [ ] 續約申請
- [ ] 提前終止申請
- [ ] 房東核准／拒絕
- [ ] 取消申請
- [ ] 條款與違約金資料一致
- [ ] 團隊收到合約通知

## 帳單與付款

- [x] 月帳單5分鐘／每小時入口重疊：Script Properties 原子認領 dispatcher，短 ScriptLock 在通知前釋放，不持鎖呼叫通知模組；重疊入口跳過、錯誤 finally 釋放、10分鐘過期恢復（超過單次6分鐘限制）。真handler重入回歸 RED→GREEN；593/593通過。正式LINE收件仍未驗證。

- [ ] `landlord_billing_init`
- [ ] 上期電表正確
- [ ] 批次建立帳單
- [ ] 新增與更新計數正確
- [ ] 房客帳單顯示正確
- [x] 房東帳單分開保存內部備註與房客可見折抵說明；房客帳單與手動重發通知只顯示折抵金額及房客可見說明，不公開內部備註（Phase 223 自動回歸；正式／真機待驗證）
- [x] 已驗證房客的帳單只顯示其有效租約 Workspace 的預設、未封存收款帳號；跨 Workspace 與封存帳號不得外洩，且帳單明細顯示銀行、分行、帳號、戶名與付款備註（Phase 237 自動回歸；正式／LIFF 真機待驗證）
- [x] 房客「我的帳單」與付款回報首頁直接顯示同一份轉帳收款資訊；Workspace 預設帳號優先，其次是該已驗證房客、同 Workspace 的有效租約帳號，最後才是同 Workspace 的單一有效 `V2_landlords` 收款資料；舊租約缺少 `landlord_id` 時，只能由同 Workspace、同 `room_id`／`property_id` 的唯一有效房間與物件推導房東，房間與物件不得直接提供銀行欄位，跨 Workspace、不同房東及舊帳單資料不得作為備援，且回傳不含 Workspace／租約／稽核資料（Phase 238 擴充自動回歸；正式／LIFF 真機待驗證）
- [x] 房客簽約流程在送交簽署前顯示押金／首月租金合計與完整房東收款帳號；合約缺少專屬帳號時只回退到已驗證 Workspace 收款帳號，帳號以文字保留前導 0，缺少帳號時顯示勿匯款警示；銀行封面仍由房客「我的帳單」透過受保護路由查看（Phase 240；本地候選，Apps Script／Pages 部署與 LIFF 真機 UAT 待驗證）
- [x] 房東可在系統設定保存多組未封存收款帳號、逐組上傳存摺封面並明確啟用唯一一組；房客帳單、付款回報與簽約流程使用啟用帳號，銀行帳號前導 0 以文字保留（Phase 241；本地候選，Apps Script／Pages 部署與手機 UAT 待驗證）
- [x] 台北時間每月 5 日 12:00 起補發當月已建立、未繳且尚未發送的帳單；專屬每 5 分鐘檢查、原每小時 dispatcher 保留備援。成功沿用 `sent_status` 防重，不自動建立帳單。`monthly-bill-noon-schedule.test.mjs` 驗證 11:59 無 Sheets／LINE 存取、12:00／12:05 可進入處理、6 日漏發補送；592/592 通過。正式觸發器／實際 LINE 收件需分開核對。
- [x] 每月帳單成功發給房客後，房東／團隊通知中心記錄本月成功發送筆數；整組失敗／未送出會在摘要中揭露，LINE 批次結果不明不自動重發，失敗摘要只重試原失敗收件人，並沿用 `notify_bill_created` 偏好與 Workspace 隔離（Phase 231；本地候選，正式部署／房東 LINE UAT 待驗證）
- [x] 已建立未繳帳單可由房東明確按下「首月租金＋管理費已於簽約時收取，套用折抵」；只折抵首月固定費用、保留兩個月押金、水電、設備費與其他費用，並同步房東／房客明細（Phase 139／225／226；本次修正待部署與手機／LIFF 真機 UAT）
- [ ] 帳單通知只發測試帳號
- [x] 房客付款回報選單與送出的付款金額以 `V2_bills` 為準；同一 `bill_id` 的過期
  `V2_tenant_bill_view`（含尚未套用折抵的舊總額）不得覆蓋正式應繳總額，只有主表
  全域缺少該帳單且 view 精確匹配房客 LINE UID 時才相容回退；空白 LINE、跨
  Workspace 同 ID 與重複主表 ID 均 fail closed，不同 bill ID 的舊合約歷史帳單不
  阻擋目前帳單（Phase 140 自動回歸；PR #121／Apps Script Version 168 source exact
  match／公開 guard read-back 通過；Sheet-backed 與 LIFF 真機待驗證）
- [x] 201 已繳帳單的付款回報初始化不產生空白帳單（Phase 145 自動回歸測試；Production Version 102 唯讀 smoke test）
- [x] 已銷帳帳單的舊付款回報不再計入房東待審核統計（Phase 144 自動回歸測試；Production Version 102 唯讀 smoke test）
- [x] 房東首頁與付款回報審核頁的底部導覽樣式一致（Phase 144 自動回歸測試）
- [x] 房客付款回報入口經 `tenant-bind.html` 登入並保留帳單參數，避免 LINE 400（Phase 146 自動回歸測試；GitHub Pages merge `37e164e6`／workflow `31538875823`）
- [x] 四個房客功能頁移除公開 page-local UID，測試模式改由 `test=1` 交給後端解析，正式 LIFF profile 流程與 Phase 146 gateway 保留（Phase 147 靜態回歸測試；focused 與全套 Node 回歸均通過；GitHub Pages merge `0bbbe06e`／workflow `31601674513`／公開頁面讀取驗證 2026-08-12）
- [x] 付款回報確認與手動銷帳在寫入回應逾時後，以權威讀取結果確認是否已完成，且不重送寫入（Phase 147 自動回歸測試；尚未做真機或 Production 驗證）
- [ ] 團隊收到付款通知
- [ ] 房東核准後帳單結清
- [ ] 手動結清與重開
- [ ] 已繳帳單頁一致

## 自動催繳

- [ ] Workspace schedules 正確
- [ ] preview 不發 LINE
- [ ] ScheduledNow 只列目前時段
- [ ] 正式執行只發應發階段
- [ ] 同階段不重複
- [ ] 錯過提醒日補最高階段
- [ ] 最終階段下一天轉人工
- [ ] trigger 只有一個
- [x] 每月帳單通知與逾期催繳共用既有每小時 dispatcher，漏過 5 號可於後續小時補發，成功不重送（Phase 231；Apps Script Version 165 已部署，LINE／LIFF UAT 待驗證）
- [x] 月初帳單補發修正：停用全部逾期催繳 Workspace 時仍保留每小時 dispatcher；房東可按「手動發送本月帳單」補發當月既有未發送／失敗帳單，且不重發已成功帳單；中文 `已建立`／`已開立`／`開立` 狀態與 `issued` 一致（Phase 233；Apps Script Version 165 已部署，LINE／LIFF UAT 待驗證）
- [x] 月帳單手動發送遇到 JSONP 回應逾時不會自動重送寫入，而是重新讀取通知狀態並提示確認 `已發送`；快速續約 CTA 在 mobile action grid 保持綠底白字；手動銷帳 canonical V2 寫入完成後，V1／通知／稽核後續失敗以警示回傳、不誤導重複銷帳（Phase 234；local candidate，Production／LIFF UAT 待驗證）
- [x] 手動銷帳同步帳單檢視時，工作表中空白的 `__row_number` 儲存格不可覆寫系統的實際列號，避免 `Cannot convert "" to int` 而回滾銷帳（Phase 235；local candidate，Production／LIFF UAT 待驗證）
- [ ] LINE 失敗進入通知中心

## 訊息／報修

- [ ] 房客一般訊息
- [ ] 緊急訊息
- [ ] maintenance 成員收到通知
- [ ] 房東更新狀態
- [ ] 後續正式工單模組待開發

## 入住

- [ ] 報到資料載入
- [x] LIFF access token 過期時報到頁自動重新登入（Phase 149 自動回歸測試）
- [ ] 預定入住日
- [ ] 鑰匙交付
- [ ] 入住電表
- [ ] 完成／取消狀態
- [ ] 歡迎通知
- [ ] LINE 失敗通知

## 公告

- [ ] 全部房客
- [ ] 指定物件
- [ ] 指定房客
- [ ] 未綁定與衝突統計
- [ ] 單一測試房客發送
- [ ] 失敗重試
- [ ] 團隊看到公告結果

## 系統設定與通知中心

- [ ] 個人資料與手機前導 0
- [ ] Workspace 名稱、時區、幣別
- [ ] 收款帳號權限與遮罩
- [x] 收款帳號前導 0 保留、私有帳戶封面上傳與房客帳單預覽（Phase 239；PR #127／Apps Script Version 173／GitHub Pages workflow `34126765101`；Web App URL 不變；真實房東上傳、房客 LIFF 與手機 UAT 仍為 `HUMAN_REQUIRED`／`UNVERIFIED`）
- [x] Apps Script sandbox bridge、帳戶封面鎖定與手動銷帳逾時回歸（Phase 240；sandbox 回應僅以受限 Google origin 與 request nonce 接受；帳戶封面與手動銷帳分別在 8 秒回覆忙碌，手動銷帳完成帳務寫入後才釋放通知；Production／真機 UAT 仍為 `HUMAN_REQUIRED`／`UNVERIFIED`）
- [x] 手動銷帳與銀行帳戶封面上傳沿用頁面指定的 60 秒 bridge timeout，避免共享 auth client 將長操作截斷（Phase 236／239 follow-up；Production／真機 UAT 仍為 `HUMAN_REQUIRED`／`UNVERIFIED`）
- [ ] 帳務預設
- [ ] 通知偏好
- [ ] 單筆已讀
- [ ] 全部已讀
- [ ] 類型與失敗篩選

## 非功能測試

- [ ] 手機 Safari／LINE WebView
- [ ] Android LINE WebView
- [ ] 頁面不被 bottom nav 遮擋
- [x] 系統設定手機鍵盤開啟時隱藏固定 bottom nav，並將 Email／文字欄位捲動至可視區（Phase 233；真機 Safari／LINE WebView 待驗證）
- [ ] API 逾時提示
- [x] 房東桌面帳款、合約、物件、欠款與房客讀取 route 啟用 request-local snapshot，避免受保護 iframe bridge 重複掃描 Workspace schema（Phase 245 自動回歸測試；仍需真機／Production 驗證）
- [ ] Google Sheets 容量
- [ ] 100／500／1,000 房客資料量測試
- [ ] LINE API 配額與錯誤
- [ ] Apps Script 執行時間
- [ ] 備份與還原演練

## 2026-09-18 一次性測試帳單作廢／封存

- [x] 欠款頁只對已關閉房間帳號的未付款帳單顯示「作廢測試帳單」；啟用中房間不顯示。
- [x] 後端重新驗證 Workspace、房間狀態、未付款狀態與付款紀錄；不依賴 `test=1`。
- [x] 作廢只更新帳單狀態與內部備註，保留帳單／檢視歷史，不建立付款、不發送 LINE、不刪除資料。
- [x] Workspace 操作紀錄保存實際操作人、時間、帳單／房間目標與封存原因。
- [x] 已加入靜態與純函式回歸測試；正式 Sheet、登入後欠款頁與一次性測試帳單操作尚待 authenticated UAT。

## V2.1 本地候選：線上合約簽署與營收儀表板

- [x] 房東房客詳細頁可管理舊合約、身分證正反面與自拍照；已上傳項目鎖定避免重複上傳，電腦可拖放檔案並沿用格式／大小驗證，文件卡片以預覽為入口，預覽頁保留下載、列印與分享（`tests/tenant-detail-contract-documents.test.mjs`；正式站需另行發布驗證）
- [x] 房客簽署資料送出、房東 Workspace/RBAC 審核、核准啟用、拒絕後重送（Phase 129–133、138、140 focused tests；Production 尚未驗證）
- [x] 合約審核缺少必要附件時 fail closed、跨 Workspace 拒絕、重複決策 idempotent（Phase 138 runtime mock；Production Sheet schema 尚未驗證）
- [x] 營收儀表板聚合應收／實收／未收／收款率，並排除跨 Workspace 帳單（Phase 150 runtime test）
- [x] 營收儀表板提供 SVG 圖表、數值表格 fallback、空資料狀態與月份／物件 CSV（Phase 151 UI test）
- [x] 營收儀表板提供繳款狀態分布、遲繳比例與遲繳天數、入住率、合約到期分布（Phase 152 runtime + Phase 153 UI tests）
- [x] 房客與房東審核頁均讀取指定 Google Docs 固定版型；送出時複製固定版型、填入欄位、把文字簽名區替換為簽名圖片並回寫簽署紀錄（Phase 154–155、168 tests；Production template properties／真機尚待驗證）
- [x] 報表可解析 Google Sheets 的 Date 型態帳單月份；簽署 bootstrap 失敗時保留房客唯讀合約檢視（Phase 156 regression test）
- [x] 房東可發起新房出租／房客續約待簽合約，邀請欄位可在空白分頁安全初始化，且租金、管理費、押金與小數費率不失真（Phase 157–162 runtime／UI tests；Production schema header repair verified）
- [x] 到期 60 天內每日只準備一份 append-only 續約草稿，保留原合約；草稿待房東檢視、30 天僅提醒一次，房東確認後自動詢問房客，且房客清單顯示合約到期日／剩餘日數（Phase 178／202／203；Apps Script Version 147／Pages workflow `33567151637` 已部署，正式觸發器與 LINE 真機仍待驗證）
- [x] 房東合約申請頁顯示房客已送出的固定版型新租約、簽名預覽，且原生審核 API／房客文件 route 錯誤不再被靜默成空畫面（Phase 169；Production／LINE 真機待驗證）
- [x] 房東房客詳細頁提供明確的「查看完整合約與簽名」入口，並定位至合約申請頁的原生合約內容區（Phase 172；Production／LINE 真機待驗證）
- [x] 舊房客續約採 `V2_contracts` append-only 版本鏈，保留歷史合約、完整金額／付款快照、30 天到期不續約優惠、續約證件沿用與新簽名要求；房東／房客可讀取版本紀錄，指定房東版本可唯讀查看完整合約與簽名，並提供可重跑的 additive-only schema migration（Phase 174–176；Apps Script Version 130／GitHub Pages workflow `33098140787` 已發布；LINE 真機仍待驗證）
- [x] 正式 `landlord_tenants` Workspace 原生路由回傳同一份唯讀 `contract_history`，避免 603 原測試合約仍存在但房客詳細頁顯示「尚無可讀取的合約版本」；房東詳細頁可完成渲染並提供「查看完整合約與簽名」（Phase 177；Apps Script Version 131／GitHub Pages workflow `33099332347`／公開 603 smoke readback 已驗證；LINE 真機仍待驗證）
- [x] Production-facing landlord／tenant pages 全部指向目前正式 Apps Script deployment 114，避免沿用舊部署造成合約管理頁卡在載入中（Phase 165 endpoint regression test）
- [x] 房客首頁沒有有效租約時保留合約入口，讓待簽署房客可進入手機合約簽署頁（Phase 166 UI 回歸測試；Production 真機尚待驗證）
- [x] 房東首頁提供本月應收／已收／未收／收款率 KPI、近 12 個月三線圖、入住率環形圖與 30／60／90 天合約到期柱狀圖；KPI 採兩欄配置並取消金額省略，趨勢圖下方摘要使用顯示月份合計並保留數值與 aria-label（Phase 193；本地自動測試通過）
- [x] 房東首頁在取得身份後即與 bootstrap 並行啟動報表請求，bootstrap 完成後漸進渲染報表；唯讀 JSONP 逾時最多自動重試一次，script error 立即清理並拒絕，圖表失敗不覆蓋已載入首頁（Phase 193；本地自動測試通過）
- [x] 房東首頁 bootstrap 的付款／訊息唯讀資料共用 request-local snapshot，避免同一次首頁載入重複讀取 Google Sheet（Phase 197；本地回歸測試通過）
- [x] 房客清單由 `landlord_tenants` 回傳現行合約到期日；房卡明確顯示到期日與剩餘／逾期天數，並以有效、60 天內、30 天內、已到期分級顏色提示（Phase 194；本地 API／UI 回歸測試通過，公開頁與 LIFF 真機尚待驗證）
- [x] 合約 60 天內、30 天內或已到期的房客卡片提供「快速續約」，沿用現行合約／房客／房間／物件 context 進入 append-only 續約表單（Phase 194／226；本地回歸通過，正式頁與 LIFF 真機待驗證）
- [x] 房東可修改尚未發送的續約草稿日期，系統同步重建合約全文；已送出／已簽署版本拒絕覆寫，手動簽約日期錯誤改以取消未認領邀請後重建或新增更正續約版本（Phase 195；Apps Script Version 139／GitHub Pages workflow `33449180375` 已發布並完成公開 route/page readback，LINE 真機尚待驗證）
- [x] 到期續約改由房東先檢視草稿、可修改日期／金額／30 天優惠條款，再發送續約詢問；房客只能回覆同意或暫不續約，同意後房東才可發送正式簽署邀請，舊合約版本維持 append-only（Phase 196；正式 Apps Script Version 140 與 Pages workflow `33456765735` 已發布，LINE 真機仍待驗證）
- [x] 本地候選新增「直接續約簽署」單頁流程：現有／已到期／已完成合約可建立新版 append-only 合約、可勾選 30 天條款並立即產生邀請；房客續約邀請只要求簽名，房東核准後才封存舊版本（Phase 198 static；Phase 157／158 runtime；尚未部署或進行 LINE 真機 UAT）
- [x] 續約入口改由「房客名單 → 房客詳細資料 → 房客合約」進入；目前／已到期／可續約版本直接顯示「發起續約」，合約申請頁只保留既有草稿審查、邀請與簽署處理（Phase 199；正式部署於 PR #81／Pages workflow `33547890200`；尚未進行 LINE 真機 UAT）
- [x] 續約表單起始日自動帶入原合約結束日，結束日自動計算為起始日加一年減一天；從房間發起續約時保留原合約租金／押金／電費／設備耗損費等條件，新租約流程與其他續約欄位不受影響（Phase 174／200；正式 Apps Script Version 145／GitHub Pages workflow `33555883954` 已發布並完成公開 readback，LINE 真機尚待驗證）
- [x] 合約到期後若尚未建立續約草稿，仍保留啟用中的房客與房間於房東房客清單，並可從到期版本恢復手動續約入口；到期合約維持唯讀（Phase 201；正式 Apps Script Version 146，GitHub Pages 未變更，登入後 UAT 待驗證）
- [x] 房東確認續約後自動發送房客詢問；房客同意後自動建立新版簽署邀請並透過 LINE 發送，拒絕後建立 `tenant_declined` 待退房狀態；邀請與通知具冪等保護（Phase 202 runtime；Apps Script Version 147 已部署，LINE 真機／正式觸發器為 `UNVERIFIED`）
- [x] 房東可從房客詳細資料直接進入手動退房；退房完成後清除房間、房客與檢視指向，保留原合約日期／全文／帳務／簽名資料，且不發房客 LINE（Phase 202 runtime／203 UI；Apps Script Version 147／Pages workflow `33567151637` 已部署，登入後 UAT 為 `UNVERIFIED`）
- [x] 房東退房結算已正式部署：9/1 到退房日含當日計算、上月只帶入未繳電費／設備使用費、本期房租按日曆天數拆分、本期水電設備按電表差額計算、押金扣除／應補繳／押金應退與兩張私有電表照片（Phase 205／Phase 206／Phase 207；Apps Script Version 148、PR #92／Pages workflow `33648496168`；公開頁與正式 `V2_checkout_settlements` schema read-back 通過）
- [x] 房東退房「快速結案」與欄位遮罩修正已正式部署：不要求電表讀數／照片，以手動應收金額與實際退款金額作為最終結算；退房專用 shell 隱藏固定底部列並保留 focus 自動捲動（Phase 252 runtime／Phase 253 UI／Phase 254 docs／Phase 255 UI；快速結案 PR #155／Apps Script Version 186／Pages workflow `34598441945`，遮罩修正 PR #157／Pages workflow `34688134508`；真實手機／LIFF UAT 為 `HUMAN_REQUIRED`／`UNVERIFIED`）
- [x] 房東可從房客名單直接建立簡易新租約：填寫房號、租金、押金、起始日與租期月數，伺服器計算含首尾日結束日並補入房間／Workspace 預設費用，後續連接房客證件上傳與簽署（Phase 208；Apps Script Version 149、PR #94／Pages workflow `33656914943`；公開頁與 Production API guard read-back 通過）
- [x] 房東可補登已完成簽署的紙本合約：必填紙本合約檔案、身分證正反面可後補，直接建立 Workspace 內的有效／待開始租約；不建立合約申請、電子邀請、確認碼或 LINE 訊息，並以冪等鍵避免重複建檔（Phase 209；Apps Script Version 150／PR #96 已部署，Production migration read-back 通過）
- [x] 房東可從空房的物件／房間頁或房客詳細資料進入「手動補登紙本合約」，補登頁帶入既有房客／房間資料並提供紙本專用完成畫面，不誤顯示電子邀請內容（Phase 210；本地 UI static test 通過，手機／LIFF 尚待驗證）
- [x] 紙本合約補登的 API 路由、資料邊界、測試與部署狀態已記錄；PR #96、Apps Script Version 150 與 legacy Pages build `1190728482` 已部署，公開頁 read-back 通過；Drive 與 LINE 仍未執行（Phase 211；本地文件 test 通過）
- [x] 紙本合約補登的 Production migration 只在既有 `V2_contracts` 標題列尾端追加兩個冪等欄位，重跑不重複追加、缺少資料表會 fail closed，且不改任何資料列；Production header read-back 通過（Phase 212）
- [x] 紙本補登 migration 也會追加孤立合約復原所需的 `previous_contract_id`，重跑不重複追加且不改既有資料列；帳單抄表頁於 iOS 虛擬鍵盤開啟時會收起固定操作列／底部導覽並捲動焦點欄位；新建帳單依租約與帳單月的含首尾日重疊天數計算首月／末月租金，既有帳單維持原始快照（Phase 221／222；本地回歸通過，未部署／正式 LIFF UAT 待驗證）
- [x] 房客詳細資料會沿合約版本鏈補回房源建檔遺留的合約／身分證 HTTPS 文件連結；簡易新租約／紙本補登勾選「簽約時已收首月租金＋管理費」時，首月固定費用以可追溯折抵明細結清，兩個月押金維持合約資料，避免重複列帳（Phase 224／225；本次修正待部署與正式 LIFF UAT）
- [x] 已建立但未繳的本月帳單若對應合約已明確記錄簽約時收取首月租金＋管理費，房東正常送出帳務更新即可自動折抵首月固定費用；兩個月押金、已繳帳單、水電／設備／其他費用不受影響，房東與房客均可看到折抵明細（Phase 139／225／226；本次修正待部署與正式資料／LIFF UAT）
- [x] 既有帳單若只先折抵租金、管理費仍未繳，帳務頁仍顯示「首月租金＋管理費已於簽約時收取，套用折抵」補正入口；只有租金與管理費合計已折抵才隱藏入口（Phase 227；本地回歸通過，正式資料／LIFF UAT 待驗證）
- [x] 既有帳單若租金已先折抵而 `rent_amount` 已為 0，首月固定費用補正仍會補上管理費並結清剩餘金額；欠款頁以同 Workspace／房客／房號的房東名單身份覆寫過期帳單名稱（Phase 228；本地回歸與 Apps Script syntax check 通過，正式部署／資料／LIFF UAT 待驗證）
- [x] 202 折抵同步遇到同 Workspace 的 legacy duplicate `bill_id` 時，更新所有同 Workspace view rows；跨 Workspace collision 仍 fail closed；欠款身份在帳單 tenant_id 過期時改以房東名單的同房號／房號名稱解析（Phase 229；本地 131/131、Apps Script syntax、Version 161 source exact match、前端實際 deployment HTTP guard read-back 通過，手機／LIFF UAT 待驗證）
- [x] 202 清除金額操作具備每筆帳單的處理中／完成鎖定；寫入 API 不自動重送，成功後顯示明確完成提示，回應逾時只做一次唯讀讀取確認並告知是否已完成（Phase 230；本地 UI、validator、Apps Script syntax、完整 Node `132/132` 通過；PR #108／Pages workflow `33985625051` 已發布，公開帳務頁 HTTP 200 read-back，手機／LIFF UAT 待驗證）
- [x] 202 已先建立但尚未被房客認領的房東電子租約，可從物件／房間頁以 `supersede_contract_id` 轉成紙本補登；原電子合約與邀請保留並標記取消，新紙本合約以 `previous_contract_id` 連結，既有房客／使用者啟用且維持未綁定 LINE，完成頁提供房客登入入口（Phase 213；PR #98／Apps Script Version 151／Pages workflow `33691996413` 已部署，正式手機／LIFF 尚待驗證）
- [x] 房間若仍顯示「已出租／租約中」但有效合約找不到對應房客且沒有 LINE 綁定，物件／房間頁顯示「補登紙本並建立房客登入」資料修復入口；送出時保留並關閉孤兒合約、建立新的紙本租約與未綁定房客，並拒絕仍有房客或 LINE 綁定的合約（Phase 214；PR #100／Apps Script Version 152／Pages workflow `33694799930` 已部署，公開頁 read-back HTTP 200；手機／LIFF 尚待驗證）
- [x] 舊格式待啟用合約若已有未綁定的房客資料，物件／房間頁仍顯示「補登紙本並建立房客登入」入口；補登時沿用既有房客、不建立第二筆房客資料，關閉舊待簽合約並以 `previous_contract_id` 連結紙本租約。若既有房客列缺少對應 `V2_users` 列，只有同一個未綁定 legacy-pending 恢復分支會補建該房客帳號；已綁定或其他既有房客維持拒絕（Phase 215 runtime regression；Apps Script Version 156、Pages workflow `33886721735` 已部署；手機／LIFF 實際補登仍待驗證）
- [x] 紙本補登頁的房東驗證狀態改用不帶 LINE UID 的 JSONP 兼容通道，避免手機 LIFF 遇到 Apps Script 302 轉址時誤判為驗證連線失敗；續約狀態查詢共用同一通道（Phase 216；commit `884a066`、Pages workflow `33801519730` 已部署，手機／LIFF UAT 仍待驗證）
- [x] 房東桌面 Email OTP：六個 `landlord_email_*` action 只走 `doPost` JSON body + controlled bridge，`doGet` / JSONP 不承載 Email、OTP、challenge 或 session token；Email/session 使用 `CMWEBS_EMAIL_LOGIN_HASH_SECRET` HMAC 雜湊，`V2_users` 追加 `email_verified_at`／`email_login_enabled`，並新增 `V2_landlord_email_login_challenges`、`V2_landlord_email_sessions` additive/idempotent schema（Phase 217／218／219；Apps Script Version 157、Pages PR #102 已部署；實際 Email／session UAT 仍待驗證）
- [x] 房東第一期桌面響應式：`landlord-entry.html`、`landlord-home.html`、`landlord-tenants.html`、`landlord-properties.html`、`landlord-settings.html` 共用 `landlord-auth.js` 與 `landlord-responsive.css`；static tests 覆蓋 375／390／768／1024／1440 viewport contract、手機 bottom nav、1024+ desktop sidebar、focus ring 與 auth failure handling（Phase 219／220；Pages PR #102 已部署；實際 browser capture 尚為 `UNVERIFIED`）
- [x] 房東桌面完成候選：Email OTP 缺少 hash secret／MailApp 寄送失敗時 fail closed 且不寫入 challenge；`landlord-settings.html` 接入 shared responsive shell 與 authenticated `landlord_settings_init` POST bridge；Phase 217／219／220 全部回歸、全套 124 tests 與 Apps Script syntax 通過（`npm run validate` 解析到 dirty parent package，非本 worktree 證據；既有 static release-cache validator 因鎖定舊 20260822 marker 而 `UNVERIFIED`）
- [x] 房東後台「更多」頁提供醒目的「開啟桌面版」入口，連到 `landlord-entry.html` 的 Email 驗證碼登入，使用新分頁與 `noopener` 保護；Phase 232 static regression test 通過，PR #112／Pages workflow `34016014898` 已發布，`landlord-more.html` 與 `landlord-entry.html` 公開 read-back HTTP 200（瀏覽器真人點擊與 Email/session UAT 仍待驗證）
- [x] 房東後台「更多」頁新增「快速建立租約」入口，直接進入簡易新租約流程；選房間後帶入原房價，租金欄可修改並沿用既有簽署邀請（Phase 261；本地 UI 回歸通過，尚未部署／手機與正式資料 UAT 待驗證）
- [x] Email 登入／首次驗證的 hidden POST bridge 改用 60 秒逾時，避免 Apps Script MailApp 寄信或回應稍慢時被 25 秒前端逾時誤判；寄信設定失敗與橋接逾時顯示可區分的處理提示（Phase 242；本地回歸通過，正式 Email 寄送與手機／桌面 UAT 仍為 `HUMAN_REQUIRED` / `UNVERIFIED`）
- [ ] 正式 Email 寄送、已登入 LINE 房東首次 Email 驗證、已驗證房東桌面登入後的 authenticated operation、375／390／768／1024／1440 browser capture 與真機 UAT（候選未部署；全部仍為 `HUMAN_REQUIRED` / `UNVERIFIED`）
- [x] 房客續約與退租頁改為被動資訊／歷史檢視，不建立新的 `V2_contract_requests` 退租申請；既有歷史 route 保留相容讀取（Phase 203 UI；Pages workflow `33567151637` 已部署，LINE 真機為 `UNVERIFIED`）
- [ ] 已登入 LIFF／真機、Drive 私有照片上傳與 502／506 已登入正式退房交易 UAT（正式 Sheet schema 與欄位 read-back 已通過；其餘仍為 `HUMAN_REQUIRED` / `UNVERIFIED`）

## 2026-09-30 新約／續約補充條件本機候選

- [x] 簡易新租約提供選填的 500 字「補充約定／現場備註」；一般新約及續約由房東在本次版本輸入，直接 API 超長輸入由後端拒絕；舊 `note` 不預填，也不因續約複製而公開（`contract-conditions.test.mjs`）。
- [x] 條件標記於 `terms_snapshot_json` 並綁定本次 `contract_id`；歷史內部 `note`／`landlord_note` 與前版條件不進入房客合約（`contract-conditions.test.mjs`）。
- [x] 自動備妥的未送出續約草稿可在房東合約頁編輯選填補充約定；只預填同一草稿版本的約定，後端重新產生合約全文並拒絕超過 500 字或已送出的版本（`contract-conditions.test.mjs`、`phase158-landlord-initiated-contract-activation.runtime.test.mjs`）。
- [x] 固定 Google Docs 範本有 `{{備註}}` 時取代該位置；沒有時，房客預覽與簽署版皆插入簽名區之前；無法定位時拒絕含條件的新建／簽署版，不把條件附在簽名後；空白不追加（`contract-conditions.test.mjs`）。
- [ ] 正式範本排版、真實 Drive 複本、已登入房東／房客瀏覽器及 LINE 真機簽署驗收：`HUMAN_REQUIRED`／`UNVERIFIED`。此本機候選尚未發布；未改正式 Sheet、Properties、範本或業務資料。

## 2026-09-09 房東桌面版登入與操作頁本地候選

### 同日：現有系統首頁效能修復

- [x] `landlord-post-read-snapshot.test.mjs`: actual POST dispatcher with mocked
  services proves one physical read per sheet per request, fresh reads across
  requests, and uncached write actions.
- [x] `landlord-home-progressive.test.mjs`: core renders before secondary work;
  rapid refresh deduplication; secondary failure isolation; transient refresh
  retains current-page data with warning; auth failure clears it; section actions
  does not rescan dashboard; legacy response remains compatible.
- [x] Full Node suite 187/187. No billing, LINE push, email send or bank writes
  executed by these tests.
- [ ] Authenticated desktop/mobile latency and real-device acceptance remain
  UNVERIFIED. Browser click instrumentation timed out before dispatch.
- [ ] `npm run validate` is not a candidate check: npm resolved the parent's
  package. Explicit candidate-root legacy validator reports 87 vs expected 71
  routes and existing nested handler `tenant_payment_account_cover` not detected.


- [x] 桌面入口提供寬版登入 shell、Email／OTP 欄位標籤、錯誤／成功狀態與鍵盤 focus；寄送、重寄、驗證均有立即 busy／disabled／`aria-busy` 回饋、重複點擊保護與失敗復原（Phase 244；commits `11be3e4`–`964570a`）。
- [x] 房東欠款與合約申請頁接上共用桌面 shell、側欄、頁面內滾動與 modal stacking；手機 375／390／768 shell 與 bottom nav 保留（Phase 220；commits `d0dd3f0`–`0345db5`）。
- [x] Email bridge 保留業務 `request_id` 與 transport correlation id，bridge timeout 正規化為 `API_TIMEOUT`；原生簽署 session 不與房東 Email session 混用（Phase 219／220）。
- [x] 桌面 Email 對目前沒有既有 Apps Script dispatcher 支援的欠款／合約原生操作明確 fail closed，顯示可理解的未支援提示；不得假裝成功或逾時後重複寫入。手機 LINE／JSONP 路徑保持原狀（Phase 220）。
- [x] 本地自動驗證：`node --test tests/*.test.mjs` 185/185；Phase 192、219、220、244 focused 39/39；Apps Script／目標 HTML inline script syntax check 通過；`git diff --check` 通過。
- [ ] `npm run validate`：`UNVERIFIED`，本 worktree 沒有 tracked `package.json`／validate script，未借用 parent checkout 結果。
- [ ] `node scripts/validate-static-release-cache.js`：`UNVERIFIED`，基線 `frontend-release.js` marker 與 validator 期待值不一致；本候選未改 release marker。
- [ ] 真實桌面瀏覽器 Email 登入、欠款／合約頁 authenticated operation、手機 LIFF／LINE、375／390／768／1024／1440 viewport capture：`HUMAN_REQUIRED`／`UNVERIFIED`。
- [x] GitHub push 與 GitHub Pages publish 已完成：PR #134 merge commit `1b24ec2` 已合併至 `main`；Pages run `34313575139` 成功，公開 `landlord-entry.html`、`landlord-arrears.html`、`landlord-contract-requests.html`、`landlord-responsive.css` 與 `landlord-auth.js` 均 HTTP 200 並完成 marker read-back。Apps Script deployment 未執行，因本候選沒有 `apps-script/` 差異；rollback 為回復 `main` 至 merge 前 revision `341ca17`。

## 2026-10-01 506 紙本補登與桌面「更多」正式修復

- [x] 506 類型的待簽電子合約即使 `contract_origin` 空白，只要有邀請 ID，房間頁會顯示「補登紙本並建立房客登入」；提交仍須精確匹配同 Workspace 的待處理邀請，拒絕錯誤邀請、已認領房客及跨範圍資料（Phase 209／215 回歸）。原電子合約及邀請保留稽核並在紙本補登成功後關閉；不是直接刪列或提前清空房間。
- [x] 電腦版「更多」使用共用房東 Email session 與桌面 shell；有 session 的讀取走既有 POST bridge，無 session 回 Email 入口，不跳 LINE；手機 LINE 路徑保留（`landlord-more-desktop-auth.test.mjs`）。
- [x] 紙本補登表單在電腦版可用既有 Email session POST bridge 上傳已簽紙本與選填身分證；房客詳細資料的文件清單、預覽、後補身分證上傳也可用此 bridge。後端以 server-resolved 房東及 Workspace `read`／`contract_write` 權限處理，拒絕失效 session 與無效 payload（`landlord-desktop-quick-lease-bridge.test.mjs`）。
- [x] 「更多 → 文件總覽」沿用 Email session 讀取及預覽；桌面缺少 session 回 Email 入口，手機 LINE 驗證保留（`landlord-document-overview-auth.test.mjs`）。
- [x] Email bridge 使用實際 Workspace 權限建構及 policy，合法房東可寫入、唯讀成員拒絕；文件清單、下載、上傳及冪等查找都綁定已驗證 Workspace，拒絕同房東的另一 Workspace 或房客／租約不一致（`landlord-desktop-quick-lease-bridge.test.mjs`、`landlord-document-workspace-scope.test.mjs`）。
- [x] 本地 `npm test` 293/293、`npm run validate` 與 `git diff --check` 通過；此證據不等於正式網站發布或實際上傳驗收。
- [x] Apps Script immutable Version 198 唯讀匯出 59 檔與修正版逐位元組一致；既有正式 deployment 讀回為 198，網址不變。PR #185 合併為 `5a7d57a`，Pages workflow `36792021356` 成功；17 個公開檔案與來源逐位元組一致。
- [ ] 已登入房東瀏覽器／手機的 506 入口、紙本文件上傳與房客綁定驗收：`HUMAN_REQUIRED`／`UNVERIFIED`。此次發布未改正式房客、房間、合約、邀請、私有文件、Properties、trigger 或 LINE；沒有簽妥紙本檔案時不得代送補登。
## 2026-10-05 摘要數字翻滾（本機，未發布）

- [x] `asset-number-roll.test.mjs` 七項：逐位最終落點、下降與四捨五入、不變／暫停／缺值、物件 remount 接續、成本不重播、減少動態、暫停跨 remount。
- [x] `npm run validate`、完整 Node 552/552、`git diff --check`；未修改後端，Apps Script 模組測試不適用，未執行正式資料寫入。
- [x] 合成 browser 390px／1280px 無水平溢出；4% 後最終數字 5,200,000，示範物件 A 6,240,000／416,400；無障礙標籤只有最終金額。不是正式帳務核對。
- [ ] 正式發布與已登入／真機驗收尚未執行；保留既有固定 shell。發布時更新靜態 cache、核對 Pages 並保留 `8670356` rollback。

# 2026-10-04 出租／出售双算法候選

- `tests/asset-income-valuation.test.mjs`：售價自訂／估值 fallback、出售費完整性、貸款現金／獲利分離、累計營運支出缺失、零投入、虧損、非有限輸入及 overflow；實際 mount 輸入事件即時更新出售結果與成本水平線、保留其他收入圖、badInput 清除過期結果。
- Browser：本機合成桌面試算 840,000／42%、虧損 -1,160,000／-58%；390px 手機框可見出售欄位與缺值提示。非正式或真機驗收。
## 2026-10-07 房源入口與手動網址候選版（尚未發布）

- 手機核心十頁導覽保留房客入口，新增「房源」連結與五欄排列。
- `room-source-integration.test.mjs` 驗證 Workspace 隔離、exact listing ID、
  缺表時未綁定狀態，以及卡片僅接受已綁定的 HTTPS 連結。
- `room-website-save.test.mjs` 驗證 HTTPS／清除／非法網址／權限拒絕，租金不變。
- 房東自行填手動網址，不需先建立自動同步綁定；自動同步仍需後續核對。
- 網站端未提交修改保留原狀，不併入本次候選版。
- 部署前核對實際 Apps Script 部署；目前沒有發布證據。實際保存與重載驗收
  不由本機合成持久層測試替代，未代填真實房源網址。
# 房源導覽圖示一致性（2026-10-07）

- `tests/room-nav-icons.test.mjs`：十個整合頁的房源入口使用 SVG，不再依賴字型符號；房源頁五個 SVG 與首頁一致，房源建築圖示不同於首頁。
- 房源頁使用相同 23px 圖示、1.9 線寬與 5px 圖文間距。純前端修改，不變更 API、Schema 或房間資料。
- 正式发布及真實手機視覺驗收仍待執行；rollback 可還原本次 HTML 圖示變更，無資料回復操作。
# 房源照片圖卡（2026-10-07，已授權發布候選）

- `tests/room-photo-cards.test.mjs`：照片置頂、簡短標題／房號／月租、網址管理預設收合，未綁定或不安全照片不顯示，標題跳脫 HTML。
- 手機單欄、電腦多欄；沿用底部 SVG 導覽和單卡受保護網址儲存。不新增 API 或 Schema，不修改房間資料。
- 已綁定房源縮圖仍是唯一照片來源；網址不會自動抓圖。無照片及圖片載入失敗各有明確狀態。
- 使用者已授權前端發布；rollback 回復發布前 `a135399` 的 `landlord-rooms.html`，後端 216 不變，無資料回復操作。合併及 Pages／公開檔案核對仍為獨立發布驗收。
- 每張圖卡直接顯示「管理刊登房源」，不收進「管理」：開啟固定 `https://admin.z3house.com/` 統一登入入口；新分頁加 `noopener noreferrer`，不帶房間／Workspace／登入憑證。不是特定刊登編輯深連結，不改外部後台權限。
# 房源網址封面連動（2026-10-07，正式後端217）

`tests/room-website-cover.test.mjs` 執行真實後端及圖卡／儲存函式：網址保存
後鎖外取主圖、平行與重載快取、外站／admin／帳密／port 拒絕取圖、轉址／
網路失敗／缺圖不影響網址保存、清除與重新取圖、無 binding 圖卡顯示、
合法 src／UUID、授權房間唯讀投影，以及儲存後只換該卡保留其他草稿。
只有外部 UrlFetchApp／CacheService／Sheet 持久層採合成 fixture；不以此
宣稱正式保存、登入或手機真機驗收。

唯讀公開實測：使用者提供 z3House 房源照片集第一張可 GET 200 image/png；
HEAD 回404不能作圖片不存在的判定。沒有保存正式資料或更動 z3House。
回退前端為 0a65960、後端216。fresh serving216及editor HEAD與main各59檔
一致；推送後HEAD及immutable217與候選各59檔逐位元組一致，原API更新217。
本次候選完整 `npm test` 623/623、`npm run validate`、`git diff --check`
通過；使用者授權前後端發布。PR225合併379a82d，Pages37542783526成功，
46公開檔逐位元組一致。已登入正式房源頁唯讀重載101：既有網址的第一張
照片complete=true、natural1672x941。未重送保存，不改 Schema／trigger／
Properties／LINE／帳務。新保存交易及手機LINE真機待驗收。

## 2026-10-07 房源網址手機鍵盤避讓（本機候選）

網址 input 繼承 label13px，未處理 focus／viewport scroll，固定導覽在
縮小視窗內仍占68px。現在明確16px，手機輸入時隱藏底導覽，resize／scroll／
focus調整page捲動，優先保持網址及儲存按鈕可見，blur恢復導覽。不禁用縮放。
`room-website-keyboard.test.mjs` 三項先失敗再通過：縮小高度、桌面不捲動、
blur不捲動。完整626/626、validate、diff-check通過。
本機合成201圖卡，390×340實際DOM：input top225.95 bottom271.95，save
top279.95 bottom323.95，page bottom340，font16px、nav none；離開輸入後
nav block且網址草稿保留。未點保存，不寫正式資料。這不是LINE軟鍵盤真機
驗收。使用者已授權前端發布，候選1d12250重新626/626、validate及diff-check
通過。PR227合併6f54f67、Pages37576022956成功，46公開檔案逐位元組
核對一致。回退前端c84c01e；後端217不動。

## 2026-10-07 房源鍵盤捲動穩定修正（前端已發布）

`room-website-keyboard.test.mjs` 改以focus不搶原生捲動、resize穩定後只修
遮住input為契約，不以save可見強迫滑動；包含重複resize取消前一工作、
原生已揭露欄位不動、offsetTop交集、blur取消效果及桌面不动共七項。
focus原版scrollTop760對預期400先失敗，新版七項通過，完整630/630、
validate及diff-check通過。本機合成390×340 input277.95–323.95完整可見
並可輸入；未按save。使用者授權本次發布，候選2706b84重新630/630、
validate與diff-check通過；PR229合併17f6ae2，Pages37605820852成功，
46個公開檔案逐位元一致。LINE真機未驗收，回退47a26ac；本次無後端部署或資料寫入。

## 2026-10-07 房源鍵盤視窗上緣同步（前端已發布，真機待驗收）

LINE/iPhone錄影推翻上一版真機可用假設；新增大於shell高度的offsetTop、
resize結束後才pan、blur／桌面清零三項，均先RED後GREEN。
10項定向、633/633全套、validate、diff-check通過。隔離browser真實CSS與
函式配合合成viewport340/offset600，shell600–940、input675–699.5可見。
只證明受控座標模型，實際LINE值／軟鍵盤仍未驗證；未保存正式網址。
使用者授權發布候選b4a4973；發布前再次633/633、validate與diff-check通過。
PR233合併ab6bac6，Pages37610069412成功，46個公開檔案逐位元組一致。
正式入口20261007-room-keyboard-pan-v1；LINE真機重測尚未完成。
本次候選rollback6a64047，後端不動。

## 2026-10-07 手機分享覆層與入住狀態正式發布

後續小尺寸本機候選：32px圓形（30px content加2px邊框）、17px圖示，
44px透明觸控按鈕。尺寸回歸RED→GREEN、647/647、validate、diff-check通過。
390×844隔離browser量測並截圖。後續授權發布PR239／cbd363d，
Pages37637736799成功；正式已登入分頁亦量測32px外徑、17px圖示、44px觸控。
未保存或實際發送分享；首輪批次HTTP核對fetch failed，重跑46檔逐位元一致。

PR237合併b8a409e；Pages37628045514成功；46公開檔案逐位元一致。
Backend219 immutable59檔與候選一致，原部署URL不變；646/646合併後通過。
原登入分頁新版讀取22間，501「已出租・待起租」；正式390×844隱藏箭頭、
分享圖示44×44、公開照片載入成功。未保存業務資料或實際發送分享。
新分頁Failed to fetch未證明登入已修復；LINE/iPhone手指滑動及原生分享仍待驗收。

## 2026-10-07 房源分享與公開照片圖庫（前後端已發布）

新增 room-share-gallery.test.mjs，實際函式驗證原生分享、取消不複製、
失敗後剪貼簿／手動複製、公開網址限制、參數移除、中性標題與切換計數。
room-website-cover.test.mjs 增加照片順序／去重／安全篩選、cache／protected
save 及 authorized bound fallback。先觀察未實作的 RED，再實作 GREEN。
本機390×844圖卡三张合成圖片均載入，按箭頭1/3→2/3→3/3，末張右箭頭
停用，body寬390無橫向溢出，實際scroll-snap-type為x mandatory。
固定shell與鍵盤回歸保留。照片不寫Sheets，只由公開網站衍生。
使用者授權後Apps Script218已部署，59檔immutable與候選一致，URL不變；
其他四部署不變。PR235及Pages37616018575完成，46公開資產逐位元一致。
正式已登入101圖卡8張照片，分享顯示，下一張1/8→2/8且照片載入；
未寫正式網址、未實際發送分享。合併後642/642再通過。
手機LINE原生分享及手指滑動需真機驗收；browser尺寸測試不等於真機。
全套642/642、npm run validate、git diff --check通過。
獨立審查發現並修正分享私人網址／內部標題、清空手動網址後圖庫消失三項。
清空保存回應也在釋放write lock後使用已授權bound網址衍生圖庫，不必重載。
桌面1366×900兩欄525.5px，分享y766.32在原動作y824.32上方，無橫向溢出。
部署需先fresh export核對正式後端217基線，建立新immutable版本並保留Web
App URL，再合併前端及驗證Pages。回退到本次基底1a17369與已核對後端217；
本次無Schema migration，不需回退房源資料。未以本機測試宣稱正式生效。

## 原生報修派工 — 本地候選，2026-10-10

| 檢查 | 證據 | 邊界 |
|---|---|---|
| 自办、报价、固定價、指定施工者、完工/補修/超額核准/驗收 | `repair-dispatch-runtime.test.mjs` | 實際 Apps Script 函式 + 合成 Sheet/Drive adapter |
| live membership/Workspace、POST body、provider 身份、contact/worker/manager | `repair-dispatch-route.test.mjs` | session/provider 為受控外部邊界，不證明真實 LINE |
| stage actions、exact request 恢復、LIFF 入口分流、舊 save 按鈕 | `repair-dispatch-ui.test.mjs` | 實際 production function 執行 |
| 手機390px/桌面1280px 自办閉環 | `release/repair-dispatch-local-proof/result.json` / PNG | 真實 Chrome、共用 UI + 實際 workflow；合成資料 |
| 公司manager報價/指定worker施工/房東驗收 | 同上本地 browser QA | 必須成功產生證據後才記 PASS |
| 完整 regressions/validator/syntax/diff | release runbook 記錄 | 本地驗證；沒有 cloud run、migration、LINE send |
| 正式登入、Sheet migration、實際照片、真機 LINE/驗收 | NOT_RUN / HUMAN_REQUIRED | 本次未授權 Production 發布或真實業務寫入 |

## 2026-10-10 automatic settlement notification correctness

Synthetic bank receipt regressions cover completion notice wording, stable completion event ID, failed/partial retry without a second payment, pending receipt canonical commit recovery and refusal to announce unproven completion. Full suite729 tests; focused bank runtime42 tests; validate/diff-check. No real notification or financial test executed.

V3 Core subscription candidate: platform-core-subscription.runtime.test.mjs,
platform-core-room-capacity.runtime.test.mjs, platform-core-subscription.ui.test.mjs
and optional cross-repo platform-core-subscription.roundtrip.test.mjs. See
PLATFORM-CORE-SUBSCRIPTIONS.md for fixture versus PostgreSQL/live boundaries.

## 2026-10-11 landlord-home redesign and parallel reads

| Coverage | Evidence | Boundary |
| --- | --- | --- |
| Home, actions and 12-month report start together; hero still paints first; late counts update in place | `tests/landlord-home-progressive.test.mjs`, `tests/phase193-landlord-home-dashboard.test.mjs`, `tests/landlord-home-loading.test.mjs` | Real `loadPage`; network faked |
| Snapshot bound to hashed identity, 24-hour expiry, corrupt/blocked storage, cleared on logout and auth failure | `tests/landlord-home-redesign.test.mjs` | Real helpers and `landlord-auth.js`; memory storage |
| Income curve geometry, growth labels, reduced-motion and accessibility markers | `tests/landlord-home-redesign.test.mjs` | Synthetic rows |
| Desktop 1366px and phone 375px rendering, rolling digits, ring animation, curve scrubbing | `scripts/preview-landlord-home.mjs` in the local browser | Synthetic data; no login, LIFF or Production |
| Real login latency, LINE in-app browser, Production publication | NOT_RUN / HUMAN_REQUIRED | Not authorized in this change |

## 2026-10-11 inner-page snapshots and prefetch

| Coverage | Evidence | Boundary |
| --- | --- | --- |
| Same-identity painting, fresh replacement, notice lifecycle, token never stored | `tests/landlord-fast-navigation.test.mjs` | Real `landlord-api.js`; fake bridge and storage |
| Write and auth-failure invalidation, allowlist, ten-minute prefetch throttle, logout clearing | `tests/landlord-fast-navigation.test.mjs` | Same |
| Five inner pages wire snapshots, load the shared module and fetch the LINE SDK on demand | `tests/landlord-fast-navigation.test.mjs`, `tests/asset-income-valuation.test.mjs` | Source and VM checks |
| Real LIFF login, in-app navigation timing, Production publication | NOT_RUN / HUMAN_REQUIRED | Needs owner device after Pages publication |

## 2026-10-12 LIFF request compatibility candidate

| Coverage | Evidence | Boundary |
| --- | --- | --- |
| Provider credential validation, cache lifecycle, principal routing and controlled rejection | `tests/line-request-identity.test.mjs` | Real Apps Script functions and dispatcher; synthetic provider/cache adapters |
| 31 standalone JSONP transports and LINE entry GET carry the active credential | Same | Real page functions; synthetic browser I/O |
| Email bridge, native signing/meter exchanges, billing timeout and recovery | Existing auth, meter and billing runtime suites | Synthetic data; no real business write |
| Production LINE and desktop Email, post-release harmless write, physical navigation | HUMAN_REQUIRED | Must be recorded after staged publication; local tests do not satisfy this gate |

## 2026-10-12 C0 local Worker environment

| Coverage | Evidence | Boundary |
| --- | --- | --- |
| Health reads real D1; rejected methods and unknown route preserve fixture rows | `cloudflare/read-api/test/health.test.mjs` | Actual local workerd/Miniflare and disposable D1 |
| Missing/failing database gives sanitized 503 with no-store | Same | Real handler, controlled failing binding |
| Pinned dependency install, Worker tests and bundle dry-run | `read-worker` CI job; `npm run test:worker`; `npm run dry-run:worker` | No Cloudflare credentials or upload |
| Account, Paid plan and APAC D1 readiness | UNVERIFIED | Requires authenticated evidence; new costs/login/payment remain owner gates |

## 2026-10-12 C1 synchronization candidate

| Coverage | Evidence | Boundary |
| --- | --- | --- |
| Exact-byte signature, timestamp/nonce rejection, whitelist, row hash, 500-row acceptance and overflow | `cloudflare/read-api/test/sync.test.mjs` | Real local workerd and disposable D1; synthetic credentials/rows |
| Staged batches, atomic completion/deletion, conflicting manifests, stale source versions, unchanged rows, scalar types and revocation patch | Same | Local transaction tests; no remote quota or production proof |
| Generated schema parity, idle zero-read behavior, Sheet projection, failed/concurrent dirty markers and immediate Email revocation | `tests/read-replica-sync.test.mjs` | Actual Apps Script functions in Node VM with controlled Sheet/network adapters |
| Every dispatcher route explicitly classified, previously missed mutations queue their tables, real GET/POST envelopes preserved | Same | Real dispatcher and dirty-marker functions; synthetic successful responses |
| Apps Script affected test function | `testReadReplicaProjection()` executed by the VM suite | Pure projection test; not a production execution |
| Three consecutive days, separate test Sheet/D1, total daily execution below 15 minutes, Paid quota/APAC readback | NOT_ACCEPTED; failed test schedule STOPPED | Stopped20:30 Taipei; complete ended history has914 minute timers/2892.886s and3 failures. Daily900s target failed; corrected source needs a fresh actual72-hour gate |

## 2026-10-12 C3 authorization candidate

| Coverage | Evidence | Boundary |
| --- | --- | --- |
| Exact LINE protocol/provider claims, five-minute/expiry cache, Email HMAC, slow-lookup expiry and per-read revocation | `tests/read-identity.test.mjs` | Synthetic provider/session adapters; real crypto |
| Canonical context/permissions, inactive user/member/Workspace, Email eligibility/session scope, alias ambiguity and explicit principal scope | `tests/read-access.test.mjs` | Real generated and original GAS helpers |
| Immutable additive migrations and removal rejection | `tests/read-migration.test.mjs` | Actual generator in a disposable filesystem |
| Primary D1 identity/operational scope, delegated manager parity, both alias orders and foreign-parent legacy anchors | `cloudflare/read-api/test/read-access-d1.test.mjs` | Actual local workerd/D1; six original GAS routes compared |
| Signed GAS confirmation through actual POST dispatcher; nonce/digest/route binding, replay/forgery/expiry, unavailable authority and undelivered source-only revocation/access changes | `tests/read-authority.test.mjs`; integrated D1 HTTP test | Real GAS modules in VM, real Worker HMAC and local service bridge; no formal account |
| Source pending markers, incomplete/stale D1 snapshots, role changes, CORS, query tampering and sanitized HTTP errors | Integrated D1 HTTP test | Synthetic source and local D1 changes; no cross-request access cache |
| Formal GAS/Worker publication, binding presence, authenticated end-to-end latency and device acceptance | NOT_STARTED; isolated synthetic authority tested separately below | Preceding C1 actual gate, deployment readback and owner device required; all read flags remain off |

## 2026-10-12 C4 routing candidate

| Coverage | Evidence | Boundary |
| --- | --- | --- |
| off/shadow/on, absent/invalid flags, bearer headers, safe endpoint/query allowlist, non2xx/shape/network/body deadline fallback | `tests/read-routing.test.mjs` | Actual shared browser script in VM, synthetic fetch/GAS |
| Successful writes across API/bridge/legacy LINE JSONP, two-minute navigation/session guard, quota recovery, write/read races | Same | Actual Auth/LIFF modules and bridge message flow; numeric deadline only |
| Redacted bounded path-only comparisons, distinct Worker errors, headers vs full-response timing | Same | No compared values or dynamic keys in reports; remote C5 receiver not yet published |
| Actual six HTML page wrappers × LINE/Email and retained arrears desktop action restriction | `tests/read-routing-pages.test.mjs` | AST-extracted actual page functions; shared router dispatch proven |
| Affected54/54, unit897/897, validate72 files and release cache references | Local candidate | Full suite897 pass/1 known external Core fixture failure/4 skips |
| Actual Pages readback, authenticated/device routing/fallback and seven-day report coverage | NOT_STARTED | All flags off; C1 real72-hour observation continues, then preceding release gates |

## 2026-10-12 C5 shadow candidate

| Coverage | Evidence | Boundary |
| --- | --- | --- |
| Current LINE/Email/D1/GAS authority, exact CORS, strict/private/oversized metadata rejection | `cloudflare/read-api/test/shadow-report.test.mjs` | Actual local workerd/D1 and real synthetic GAS dispatcher |
| Receipt-backed actual reads, source-only access failures, route/section/release binding, replay, concurrent rate limits and atomic rollback | Same | No operational data writes; synthetic identities/keys |
| Actual browser router → read receipt → authenticated report → separate D1 clock storage | Same | GAS rendering retained; no comparison values in telemetry |
| ISO/60s exact route/section clock contract, source-row timestamps strict, delayed browser timer fallback | `tests/read-routing.test.mjs`; `tests/read-shadow.test.mjs` | Owner explicitly approved clock classification; no actual time gate implied |
| Entire-epoch errors, seven rolling full windows, missing/pending attempts, report boundary attribution and fixed AST contracts | Same; actual D1 export test | Synthetic clock cases exercise logic only |
| Unit902/902, Worker24/24 plus dry-run, validate72 backend files/40 endpoint references | Local candidate | Full902 pass/1 known external Core fixture failure/4 skips |
| Verified remote exports, seven real days, authenticated latency, Pages readback and phone/desktop acceptance | NOT_STARTED | All flags off; preceding C1 real72-hour gate continues independently |

## 2026-10-13 C6 v4 allocation follow-up

| Check | Actual evidence | Boundary |
| --- | --- | --- |
|V3 CI/local intermediate failures retained |2d1c1a8 CI29/31:500tenants55.647ms/small arrears68.719ms; later local arrears50.560 and tenants94.726ms | Original100 samples/p95<50ms; later loops not reached, no root-cause/rerun claim |
|Shared row decoding preserves stored types/SQL-null absence/JSON-null/own keys/input/error behavior | `tests/read-replica-rows.test.mjs`,2/2; real authenticated/scope Worker regressions pass | SQL/scope/auth checks unchanged; never caches source or access |
|Date-only/full formatter semantics and immutable source identity |Independent1105-case comparison/2 calendar cases; validate72/40/178; v4 cache synchronized | No date-value cache, original GAS unchanged; new real epoch required |
|Full source/Worker/capacity |Unit957/957;Worker31/31;full962/962 at1cab310 with clean isolated Core/PG and actual successful cleanup | All local500 entries100 samples/p95<50ms (tenants39.150); new CI and all real gates pending |

## 2026-10-13 C6 500-room local capacity preparation

| Check | Actual evidence | Boundary |
| --- | --- | --- |
|20 properties/500 owned rooms/250 occupied and250 vacant/500 bills across2 months; foreign decoy and all20 schema tables | `cloudflare/read-api/test/read-capacity.test.mjs`; every canonical entry JSON matches and independent monetary/count literals pass | Fixed access/all-table test loader, not actual C3/remote/Taipei qualification |
|100 samples/entry, original p95<50ms | Original tenants99.173ms FAIL retained; after request-local formatter reuse complete Worker31/31, tenants41.669ms and all seven entries pass | Local workerd/D1 only; new exact-head CI pending |
|Current mutable dates, timezone switches/coercion/errors and DST | `tests/read-calendar.test.mjs`,2/2; complete unit955/955,0 skipped | No date-value/positive-authority caching; existing provider/revocation Worker tests also pass |
|Source-sensitive comparison/release cache |178-source regeneration,20261013-read-capacity-v3 | New actual epoch required; none started, all flags off |

## 2026-10-12 C6 acceptance preparation

| Coverage | Evidence | Boundary |
| --- | --- | --- |
| Sequential flags, build/readback, real-day prerequisites and failure rollback | `READ-CUTOVER.md` | Documentation preparation; no flag/deployment change |
| Complete C1 days and verified C5 seven-day export | RUNNING / NOT_STARTED | Actual elapsed time and full daily evidence required |
| Authenticated LINE/Email latency including uncached GAS authority | NOT_STARTED | Local p95 calculation tests are not network acceptance |
| Each on page: phone LINE/desktop, fallback and120-second write guard | HUMAN_REQUIRED after actual release | S1 confirmation does not cover C6; do not solicit before publication |

| C6 unchanged comparison identity through flag/cache releases, included source/endpoint invalidation and stale manifest rejection | `tests/read-comparison.test.mjs`; router and actual D1 HTTP regressions | Real source-copy tests; no live acceptance |
| C6 per-page rolling qualification after earlier page is on, both home sections/unknown selectors, retained epoch errors | `tests/read-shadow.test.mjs` | Synthetic windows; initial all-page ledger still required |


C3 real workerd transport regression5/5: Google allowed/fakehost/third-hop
and LINE valid claims/302 rejection. Root cause is workerd redirect:error
construction; canonical manual+exact200 retains no-follow and1500ms. Complete
Worker24/24, Node identity+authority13/13, validate72 and independent review PASS.
Synthetic real Google signed Email confirmation and source-only revoke/role/
disable diagnostic denials verified; no remote D1/real LINE/device acceptance.
All strict1500ms samples timed out; latency acceptance NOT_ACCEPTED, flags off.

Private synthetic v2 service profiling: eight canonical modules/manifest
unchanged; VM and10-file exported-source checks PASS. Three real signed
diagnostics PASS with authorization2164–3306ms, five full Sheet reads and
zero shared cache hits. Range metadata914–1215ms, values455–564ms; remaining
time is not exclusively attributed. Original editor restored/exact10 readback;
v1/v2 retained, no formal/C1 change. This is33-row/15000ms diagnostic evidence,
not strict1500ms, remote D1,LINE/device,p95 or500-room acceptance.


C1 actual remote follow-up through2026-10-12 16:51 Taipei: four-page history,
694 minute timers/1938.259 platform seconds exceeds900s daily target before
end of day; one Drive timeout, earlier SYNC_BUSY retained. IDLE CacheService
path335171ms and successful canonical sync195407ms are observed boundaries,
not isolated CPU/network metrics. C1 actual runtime/correctness NOT_ACCEPTED;
no formal release or observation-clock reset.

Latest C1 rollback supersedes the RUNNING observation label: two owned test
timers stopped at20:30; full ended capture923 records/914 minute timers,
2892.886 platform seconds/three failures. Failed partial day is NOT_ACCEPTED;
fresh corrected source requires a new actual72-hour gate, flags remain off.

| Additional C3 diagnostic | Evidence | Boundary |
| --- | --- | --- |
| Fixed-project/no-redirect bulk transport and typed scalar/local-clock parity | Retained two403 failures; test dependency then actual three bulk/native pairs358/1331,239/863,218/823ms;166 cells/one Date/51 empties/zero mismatches each | One warm manual invocation; no Date-loader, authenticated latency, p95,500-room or device acceptance |
| Native SHA-256 and UTF-8 byte-count hypothesis | Independent eight fake safety cases; actual100 strings107ms/254ms/14580 bytes | Does not support replacing crypto or establish C1 daily-runtime/72h acceptance |
| Test editor rollback | Original10-file source exports exact after both diagnostics; immutablev1/v2 retained | Editor Sheets dependency removed; external default-project API disable not requested; formal/C1 source/Properties/data/timers/flags unchanged |

| C3 bulk reader candidate | Evidence | Boundary |
| --- | --- | --- |
| Typed grid, inherited Date format, blanks/formula ordinals and bounded sparse hydration | `tests/read-authority-grid.test.mjs`; independent review found input-only cap defect, regression RED→GREEN with total hydrated cap | Synthetic adapters; separate bounded native Date check below |
| Fresh canonical roles, delegated manager, foreign principal, one-ms expiry, changes during provider/hash waiting, forgery/replay and safe fresh-native fallback |49 new grid cases plus19 authority/access/identity cases; successful cases assert zero native full reads | Preserve canonical identity/hash-before-values ordering; no positive shared access cache; fallback is not latency acceptance |
| Reproducible calculator source and broader regression |933/933 local unit tests; generated manifest updates only authorization source hash | No signed remote candidate authority, formal release, LINE/device, strict latency or preceding-gate acceptance yet |
| Actual native Date parity and editor rollback |22:40 manual bulk576/native2918ms,166 cells/one native Date/51 empties/three synthetic millisecond boundaries/zero mismatches;22:41 original10-file restore andv1/v2 retention | One33-row manual invocation, not authenticated lazy-resolution/1500ms/p95/500-room/device acceptance; no new deployment or formal change |
| Private signed-candidate lifecycle/probe controls | Independent9 publisher/6 actual-probe/18 pure-gate fake checks; source swaps stop, fixed exception classifications, recorded-ID recovery; canonical68 repeated PASS | Fake controls do not establish remote latency or production readiness |
| Actual signed synthetic candidatev3 | Three strict1500ms failures retained; three diagnostic replies verified at3302.118/3187.969/2620.684ms; original10-file editor restored23:14:32 andv1/v2/v3 retained | NOT_ACCEPTED;33 rows/static fixture/no D1, real LINE/device, p95 or500 rooms; original harness lacks reader-choice telemetry, native fallback not excluded; formal flags off |
| Signed reader-choice lifecycle and bounded telemetry | Independent63 fake cases:7 harness/7 editor/9 publisher/6 probe/19 gates/15 telemetry; canonical signatures checked before capture is stored;20000-byte cap/cancel; source pins andv1–v3 retention | Synthetic controls only; nested timings must not be summed |
| Actual signed synthetic bulk diagnosticv4 | Three strict failures; three signed diagnostics each one successful bulk attempt/no native range.getValues/zero shared cache; auth1183/1394/1052ms contains bulk288/632/223ms; complete2967.576/2917.804/3002.265ms; original10-file restore23:33:42/v1–v4 retained | Strict latency NOT_ACCEPTED; runtime adapter read counters are not native IO;33 rows/no D1, real LINE/device, p95 or500-room acceptance; formal flags off |
| C6 refreshed bulk-source comparison/cache closure |178 source files, only authorization/manifest normalized hashes changed; cache20261012-read-cutover-v2 synchronized; unit954/954, Worker30/30, dry-run, validate and hash check PASS | Local Draft; all6off/endpointblank; actual shadow/cutover NOT_STARTED; fresh qualifying observations required |
| Refreshed C6 full suite external boundary |959 total/954 pass/one PLATFORM_CORE_TEST_WORKTREE-required failure/four external skips | Missing external Core/PG integration not counted as passing; no formal acceptance inferred |

| Owned synthetic HTML transportv5 | Independent93 fake controls/68 canonical regressions; three strict1500ms failures, three HTTP200 diagnostics rejected by lab body decoder, no telemetry; native six completed; original10 restored01:41:32/v1–v5 retained | NOT_ACCEPTED; lab extraction is not canonical HTTP acceptance; no p95/500-room/D1/LINE/device or formal release; body failure cause still unclassified |
| Single unsigned wrapper structure classification |16 independently reviewed fake controls; one actual unsigned `{}` POST, HTTP200/8130 UTF-8 bytes/one ordered marker pair/hex-escaped padding; no OAuth/credential/fixture IO or additional signed request | Only unsigned wrapper structure; no raw body retention/script execution, signature/access/latency or original three signed-body diagnosis acceptance |
| Owned unpadded HTML producer v6 |99 reviewed fake controls; three strict1500ms failures, three diagnostic envelopes verified with one successful bulk/no native getValues/zero shared cache; complete2951.322/2266.999/2898.482ms; native first strict212.683s retained; final original10/config check02:07:18/v1–v6 retained | Lab cryptographic/access validation, not canonical HTTP or strict latency acceptance;33 rows/no D1,p95,500-room,real LINE/device or formal cutover |

C1 read-only service diagnostic on2026-10-13: one manual invocation at00:23:53
Taipei, five paired calls,438ms measured region after the Script guard and
1.670s native platform
duration. Cache getAll21–48ms; Property get45–56ms. The actual helper's11 fake
lifecycle cases, actual function's4 VM cases and independent proof/timestamp
review passed. Original4 editor files and deployment configuration restored
at00:24:38; native trigger count remains0. This warm manual measurement neither
reproduces/resolves the earlier335s Cache stall nor passes daily/72-hour gates.

C1 separately reviewed single-pair diagnostic onOctober13: exactly3 independent
manual invocations, timed regions125/68/114ms (including fixed Script guard),
native platform871/921/550ms. Guard2–6ms and Property handle1–10ms did not
dominate these samples; no Property value/Sheet/sync/write/timer operation.
Actual-function VM6/6 and actual-helper fake lifecycle11/11 passed. Original4
files/deployment configuration restored00:38:58; native trigger count0. The
stopped IDLE log pairs86/99/984ms and109/180/1099ms (core/wrapper/platform)
do not replace complete failed history or isolate startup. No corrected-source
72-hour gate started and no daily-runtime/500-room claim is made.


## 2026-10-13 — Missing Core integration environment resolved locally

The existing full suites now execute at all six pinned candidate source heads:
C1 853/853, C2 868/868, C3 938/938, C4 951/951, C5 956/956, C6 959/959;
zero failures/cancellations/skips. Node26/macOS and fresh isolated PG16.14,
with original mandatory restricted HTTP/PG fixture and four synthetic Core
route-handler cases. Actual database/role cleanup and final stopped listener
verified. Exact heads and reproduction boundaries are in
`READ-REGRESSION-DEPENDENCIES.md`. Prior missing-environment results remain
historical; actual72h/daily-runtime/strict-latency/seven-day/device/cutover gates
are not accepted by these regressions.

## 2026-10-13 — C6 scoped500-room HTTP boundary

`cloudflare/read-api/test/read-access-d1.test.mjs` now covers500 owned rooms
through real HTTP/identity/authority policy and primary-D1 scope/relationship
queries. LINE/Google authority transports and GAS service adapters are synthetic.
Seven canonical JSON results, independent500/250/20/amount/252 literals,
foreign/private exclusion and authority-only suspension despite stale D1 pass.
A private in-memory SQL row-limit mutant fails100 versus500; product source stays
unchanged. This protects against scope/relationship batch truncation, not provider
or device latency. Worker32/32 and unchanged100-per-entry local p95<50ms pass.
Full963/963 at pinned uncommitted v5 working snapshot, zero skips, uses fresh
private PG16.14 and original Core HTTP/PG fixtures; see regression dependencies.
Earlier local/CI performance failures remain. All actual gates still apply.

## 2026-10-13 — C6 request-local LINE lookup candidate

Canonical GAS+generated Worker use request-local tenant-list identity maps.
New9/9 regressions cover bounded row reads, priority, case/duplicates/OR order,
fresh snapshot, unusual identity/accessor/query coercions and actual builder
relationship mutations; review-discovered RED7/9 retained. Routing/parity/shadow
32/32; affected GAS summary function runs without writes. Full993/993 zero skips,
fresh Core/PG cleanup verified; actual Node22/macOS Worker34/34 with unchanged
100-per-entry/p95<50ms and500-room canonical JSON/literals. Tested542-file
snapshot bda61e52a54caaab96ba401482bd4cccf9d6a100252561e35d771cb6fd38e571
at0306b8bd plus source/test/cache changes, later docs excluded. Validate/dry-run
pass. Prior Linux CI33/34 tenant65.595ms remains failure; new-head CI pending.
All real synchronization/day/authority/performance/device/cutover gates remain.

The first index candidate above was rejected by a second P2 (status accessor
stales a key). Corrected full-cell/room inert guard: actual status/room/date
RED9/10→GREEN, final index11/11 plus canonical parity16/16. Final full995/995,
Worker34/34 zero skips at snapshot143e099bef3eb28b18cfce4d30a03293af295ff94f9829ee3bd3bcb110001671;
fresh private PG cleanup/source pins pass. Original500-room per-route p95<50ms
passes; no assertion/sample/clock changes. Validate and341.38KiB bundle dry-run
pass; independent final review/Linux new-head CI and all actual gates pending.

Final third P2 Proxy-Date internal-slot guard: actual builder RED11/12→GREEN12/12;
regenerated canonical/source17/17 and independent source review PASS, zero skips.
Latest full996/996, actual Node22/macOS Worker34/34 at542-file snapshot
f08ebc140f017fb306355c767e74de10ebb8ac63e95a76e36e3f47418e433a19;
Core/PG cleanup and source/bundle pins verified. Original500-room per-route
p95<50ms/100 requests pass, tenant24.121ms. Prior995/993 candidates remain
rejected historical evidence. Validate/dry-run pass, Linux new-head CI pending;
all formal readback/day/authority/device/cutover gates unchanged.

## 2026-10-13 — C6 complete client diagnostic aggregation

New helper/CLI17/17 independent source PASS, zero skip: complete100 tenant rows,
missing/duplicates/invalid cells, malformed/oversized frames, empty chunks and
missing whole suites, unknown GC, secret-canary exclusion and64KB output bounds.
Actual previous complete local Worker log yields two COMPLETE100-row client/GC
aggregates, no invalid/missing/drops; this is parser proof, not Linux causality.
Final full1005/1005 zero skips at543-file snapshot
d1cfaca4ef48bd3ce09453551b13effe075000b369f3ad5548d617e37699e1b8,
fresh Core/PG cleanup verified. Validate72/40/178 passes. Runtime/bundle/nine
inputs unchanged, no repeated local Worker suite/dry-run. d9a9ce8 Linux33/34 FAIL
tenant62.458ms/26over50 remains; new-head CI diagnostics and all actual gates
pending. Node client medians/GC correlation cannot establish Worker CPU/cause.

## 2026-10-13 — Native client-frame/slow-route evidence

Native child TAP transport700 JSON rows and full summary20 cases independently
PASS21/21. Correct child ENV avoids inherited NODE_TEST_CONTEXT; valid RED raw
console forbidden retained. Route selection/hidden missing-route and malformed
sample-ID coercion REDs fixed. Full1009/1009 zero skips at544-file snapshot
939f02fc8bbdf06f2f1538dc1e633082c427fa248181eda49b3dd2765711470a;
fresh Core/PG cleanup verified. Actual Node22/macOS Worker34/34 yields two
COMPLETE client/GC aggregates,700 collected per suite, no invalid/missing/drops,
18008-byte summary. Original100/<50/JSON/policy assertions unchanged; bundle
and9inputs unchanged. Validate72/40/178 passes. 503b431 Linux remains33/34 FAIL
small actions61.592ms; all capacity p95 pass in that run only, incomplete
client-frame evidence cannot prove cause. New-head Linux and actual gates remain.

## 2026-10-13 — C1 bounded native timer control

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Actual diagnostic functions / editor lifecycle | VM16 /14 unique fake lifecycle PASS; review PASS after exact-manifest fix | Pure local guards; includes restore formatting drift and fresh-native0 before OAuth/PUT |
| Three one-shot native clock executions | COMPLETED, success and own trigger deletion; platform852/1000/1254ms, entry397/237/478ms | Script guard/list/delete only; no Cache/Properties/Sheet/sync. Installer2640ms, all diagnostic platform5746ms |
| Original4 source/manifest/deployment and native0 restored | Exact byte/config readback07:40:23; fresh unfiltered native0 at07:42:32.993 Taipei | Three temporary controls created/deleted; no version/formal release or data/secret write |
| Daily-runtime/72h/cold/500-room/causality gates | NOT_ACCEPTED / NOT_STARTED | Cleanup is measured; residual/logging/post-return not attributed to startup. Failed914/2892.886s and335s stall retained; no new observation window |

All original assertions and gates remain. Local source validation and PR checks
are tracked separately; this diagnostic is not a canonical sync fix.


## 2026-10-14 — C1 UTF-8 sizing regression

| Check | Result | Boundary |
| --- | --- | --- |
| Affected source / independent review | 17/17 PASS each; no P1/P2 | 501-row snapshot zero sizing Blob calls; Unicode, byte limits, signing/rejection |
| One full regression / validate | 857/857 PASS, no fail/cancel/skip; validate71/40/static PASS | Node22.23.3, pinned Core, disposable local PG16.14; cleanup verified |
| Temporary synthetic editor restored | Exact4/scopes/deployment retained, native unfiltered0 | Comparison cancelled before native execution; native equivalence UNVERIFIED |
| Formal acceptance | Daily-runtime NOT_ACCEPTED; corrected72h NOT_STARTED | No measured native speedup, formal deployment/flag change or observation restart |

See EXECUTION_RECORD.md for immutable source snapshot, limits and rollback.


## 2026-10-14 — C2 D1 internal versus batch timing

| Check | Result | Boundary |
| --- | --- | --- |
| Header/stage observation | RED missing header; actual parity GREEN1/1, all700 samples | Numeric test-only metadata; no extra SQL or body changes |
| Independent review | Static PASS, no P1/P2/minor; diff PASS | No repeated benchmark or full suite |
| Full root / Worker | 868/868 and13/13, no fail/cancel/skip; validate71/40/static PASS | Node22.23.3/macOS/Core/local PG cleanup; Worker pretest dry run |
| Full local Worker p95 | All seven groups100 each,2.117–2.954ms; zero>=50 | All samples retained; original index94/<50ms unchanged |
| Earlier C3 CI | Worker23/24 failed home191.197/arrears58.361ms | Cause UNRESOLVED; local pass is not CI reproduction or production acceptance |

No retries/warmup/exclusions. Stage p95 values cannot be subtracted to infer
network time; production Workspace-scoped loader/auth remains a separate gate.


C2 stack alignment on C1's6b90a4c: full872/872 and validate71/40/static PASS;
local Core/PG cleanup verified. Only inherited C1 UTF-8 source/tests changed
runtime. Worker/test bytes unchanged; prior13/13 retained without a repeat.
Documentation conflicts preserve both histories; no actual acceptance/rollout.

### 2026-10-14 — C2 supervisor observation

| Gate | Result | Evidence boundary |
| --- | --- | --- |
| Diagnostic review | Static P1/P2/minor0 | Node process CPU excludes workerd; ELU not CPU; no root-cause claim |
| Affected Worker |13/13,0 fail/cancel/skip; seven100-sample p952.473–3.570ms<50 | Existing p95/gates retained, no retries or excluded samples; exact-head CI pending |
| Root verification | Prior872/872 retained; all runtime/root-test bytes identical | New source change only Worker test; no redundant unchanged root rerun |
| C3 preceding Linux CI |38533367980 rental1702 PASS/Worker23 PASS1 FAIL | Rooms188.364ms>50,11/100>=50; cause UNRESOLVED; no formal or real acceptance |


## 2026-10-14 — One-time local OAuth candidate

| Case | Evidence | Boundary |
| --- | --- | --- |
| Fixed loopback, single epoch/state claim, S256, online three scopes, pinned actors, fixed token/userinfo endpoints, bounded/no-retry |40 OAuth cases, fake Google responses, real loopback | No real Google consent, Web PKCE, project isolation or credential gate |
| Receipt failure and close-claimed review defects | Four exact RED failures then fixes; late-token cleanup, expired getter, failure result redirect; focused326/326 | Independent review found P1/P2; fix regression verified, not re-reviewed |
| Full regression |1264/1264 Node22.23.3/macOS, actual pinned Core HTTP/four handlers/owned PG16.14 and verified cleanup; validate/diff | Same-head CI pending; no Apps Script source changed |
| Cleanup | Once-only independent revoke reserve, project-wide isolation precondition, ACK_UNVERIFIED/TOKEN_UNAVAILABLE receipts | Separate actual grant/access readback still required; unknown result never retry |
| Trial |25/160 retained, no actual new resource/client/grant/token/RPC | Full native window, executable160 budget, publication/restore and original real gates not passed |


## 2026-10-14 — Offline native snapshot analysis

| Case | Evidence | Boundary |
| --- | --- | --- |
| Fixed URL/account hash, independent columns, Taipei dates/decimal seconds, duplicate/unknown/nonterminal/notice preservation |14 cases; review bare-row omission RED0/2 then corrected | No raw identity/project/function output; fixed false acceptance markers, never driver proof |
| Historical native snapshots | Two200-row pages parsed offline; private duration comparison matches; next/live/notice retained | Historical reference not capture attestation; partial visible totals/fingerprints not exact per-user quota/native IDs |
| Full regression | Focused340/340/full1278/1278 Node22, actual pinned Core/owned PG16.14 verified cleanup; validate/diff | Initial Core preflight timeout retained; no tests skipped or account IO, same-head CI pending |
| Trial |25/160 retained; no new resource/access/credential/RPC | Complete native collector/executable160/write/publication/restore and original real gates pending |


## 2026-10-14 — Fixed grantee ID lookup preparation

| Case | Evidence | Boundary |
| --- | --- | --- |
| Optional normalized caller-hash alias, fixed publisher/v2 path/mask/strict opaque ID, no destination override | Eight new cases2/8 initially then48/48 full metadata; independent48/48/no P1/P2 | No configured Email retains four aliases; lookup gives no role/source-Viewer/grant proof |
| Regression | Full1286/1286 Node22 actual pinned Core/owned PG16.14 verified cleanup, validate/diff | Same-head CI pending; no Apps Script source changed/account calls |
| Rollback preparation | Prerecord grantee ID before future grant; B12/optimistic159/space1 | Actual v2/v3 match/grant/remove/unknown settlement unverified; spent25/160/17 retained, native budgetSTOP |


## 2026-10-14 — Fixed Reader and independent cleanup candidate

| Case | Evidence | Boundary |
| --- | --- | --- |
| Fixture/actor/hash/epoch binding, fresh original denial, new sole owner, fixed notifications-off Reader POST and readback | Initial0/17, corrected valid publisher mock, expanded23/23 | Fake Google only; actual import/unbound/source/library none and v2/v3 match not accepted |
| Durable stop/operation lock, admission-before-attempt, target preservation/fresh cleanup verification | Three RED then26/26; independent26/26 P1/P2; two exact RED then28/28 | Fixes regression verified, not independently re-reviewed; unknown terminal/rollbackComplete false preserved |
| Independent DELETE and owner-only readback | Receipt fault/expiry/cancellation/unknown outcome cases | Valid cached credential, no refresh/retry/notification; actual cleanup still required |
| Full regression |1314/1314 Node22 actual Core/owned PG16.14 teardown errors0, validate/diff | No Apps Script source changes, same-head CI pending |
| Budget/trial | B13/optimistic160/space0, approved160/spent25/cleanup17 unchanged | Native executable budget STOP; fixed import/publication/restore/orchestration and all original real gates pending |


## 2026-10-14 — Fixed XLSX import candidate

| Case | Evidence | Boundary |
| --- | --- | --- |
| Copied bytes/hash/size, trusted offline preflight, fixed multipart/publisher/debit/intent/new-ID/metadata readback | RED0/21 then21/21, expanded27/27 | Fake Google; receipt shape is not actual unbound/privacy/Schema proof |
| Fresh private fixture safety | Same pinned hash/20 tabs/28 entries/no formulas/macros/external relationships/links | Local ZIP/XML check only, no upload or values printed |
| Stop IO fault | Independent27/27 P1; corrected precise RED0/1 then28/28 local flag-before-persistence fix | First mock second-wait cancellation retained; fix not re-reviewed |
| Restart/concurrency/unknown create/metadata denial | Single POST, preserved target/unknown, no duplicate/copy/share/delete/refresh | Real Google import and gate wiring still unverified |
| Full regression |1342/1342 Node22 actual pinned Core/owned PG16.14 cleanup errors0, validate/diff | Same-head CI pending, no Apps Script source changes |
| Budget/trial | B13/optimistic160/space0, approved160/spent25/cleanup17 unchanged | Native executable budget STOP; publication/restore/collector/orchestration and original real gates pending |


## 2026-10-14 — Library publication/exact editor restore candidate

| Case | Evidence | Boundary |
| --- | --- | --- |
| Canonical library, pinned original ten-file backup, fixed stage/version/content/restore/inventory sequence |15 RED then15 GREEN; actor/path/restart/unknown cases | Fake Google; source receipt does not attest editor exclusivity/native/runtime |
| Stop persistence/unknown restore readback | Own two precise RED then17/17 | Independent C restore capabilities still unwired; no assumed refund/extra/I17 borrowing |
| Pre-admission readback reserve and JSON object field order | Independent21/21 two P2; exact RED0/2 then23/23 | Fixes regression verified without second review, source strings remain exact bytes |
| Full regression |1365/1365 Node22 actual pinned Core/owned PG16.14 cleanup errors0, validate/diff | Same-head CI pending; no Apps Script source changed |
| Trial | B13/C9/optimistic160/space0, spent25/I17 unchanged, publicationAccepted/rollbackComplete false | C restore control/thin/guard/native/budget/orchestration and all real gates pending, no actual publication/epoch/account IO |


## 2026-10-14 — Preparation controller / independent C restore

| Case | Evidence | Boundary |
| --- | --- | --- |
| Same counter legacy fingerprint/history, native flock, initial rolling wait, independent I17/C2 | Initial13 RED/13 GREEN, swallowed failure1 RED then19/19 | No real counter upgrade/Google/token/RPC/native readiness |
| Publication integration | Actual local synthetic ledger and fake Google:7 IO→spent32, unknown stage+restore3 IO→spent28 | Returned publicationAccepted/rollbackComplete false; original actual25 unchanged |
| Rollback/reseed, spawn nullable terminal, pending IO ownership, caught failure stops ordinary | Independent21/21 P1+three P2; six precise RED then27/27 | Early repro callback mistakes corrected; host normal spawn failure already terminated, fault injection explicit; no re-review |
| Durability | External checkpoint/path claim, checkpoint-first pair; torn/older pair STOP | Preserve checkpoint/counter/claims; actual repair/handoff integration pending, no reset/refund |
| Full regression |1392/1392 Node22 actual Core/owned PG16.14 cleanup0, validate/diff | First Core preflight timeout/no cluster retained, same-env clean status/r2 success; same-head CI pending |
| Real trial | Actual25/160/I17/C2 unchanged; optimistic160/no spare, native budget STOP | Thin/guard/native/handoff/full orchestration and all original real gates pending |


### Fixed thin publication and independent deployment cleanup candidate

15 RED→15 GREEN; receipt-target RED1fail/1pass→17; ready-receipt replay RED0/1→20.
Real local preparation ledger/fake Google success25→32 and malformedcreate25→31
with independent I2/Creserve retained→22. Reviewer20/20/P2 double-receipt-fault
refresh drops admitted DELETE; exact RED0/1→final23/23 via monotonic close/verify
admission, UNKNOWN preserved. One fix pass/no re-review/minor0.
Full1415/1415 Node22/macOS actual Core643c1b3/owned PG16.14 cleanup0, validate/diff
PASS. Real Google GCP/scopes/empty/ACL/guard, source/version/deployment, actual
counter handoff, complete native budget/window/quota/latency/device NOT_ACCEPTED.


### Compatibility cost compiler

20 missingfeature RED→20 GREEN; fixed127/C2 included/I17 protected in arithmetic,
eight phase×actor windows, unknown cost fail closed, all navigation categories,
extra-operation scope review, spent/no-refund/max160, duplicate/missing/invalid
counts and stage restrictions/order-independence. Independent review20/20 plus
pure null/freeze probes/no P1/P2/minor. Full1435/1435 Node22/macOS actual Core/
owned PG cleanup0, validate/diff PASS. Actualprivatecounter25/160 unchanged;
40 native unknowns/minimum160/total null/budgetFits false. Hypothetical160/168
not live evidence. No actual IO/admission/native/quota/whole rollback proof.


### Atomic native capture and durable raw evidence

| Case | Evidence | Boundary |
| --- | --- | --- |
| Atomic wait/debit/callback, failure stops ordinary, unawaited IO owns flock, escaped control | Four precise RED→31 controller GREEN | Existing low-level adapters not migrated; no actual native tool |
| Four phases/two actors, sequential200/full AX, nonce/clock/size, stop/unknown, private raw rehash/analysis |13 missingfeature RED→13; cap swap/raw corruption two RED→15 | Local synthetic text/fake producer, no Google attestation |
| Immutable completed receipt and permanent path claim | Independent46/46 two P2; three exact RED→49/49 (native18+control31) | One fix pass/no re-review/minor0; preserve torn/unknown/stop |
| Full regression |1457/1457 Node22/macOS actual Core643c1b3 HTTP/four handlers/owned PG16.14 stopped, cleanup0; validate72/40/cache PASS |548-source snapshot de3ee2d953f736a76b75ae275ab4d4b8831076bb2d4727a150a059dffa8b91f1; evidence docs later |
| Trial | Actual25/160 unchanged, no actual Google/native/token/RPC/counter upgrade | Native collector/coverage/quota, executable budget/same-ledger/recovery/orchestration and all original real gates NOT_ACCEPTED |


### CI local latency failure / diagnostic coverage

d8c4d90 CI rental1452/1452 pass; Worker23/24 failed home p95=63.854ms against
unchanged50ms. Original local24/24 p95 2.358–3.756ms, diagnostic local24/24
p95 2.367–2.988ms; separate D1/decode/route timings expose all routes before
failure. No retried CI, relaxed gate, excluded samples or actual deployment.
CI root cause remains UNRESOLVED; original real gates are still unaccepted.


### Atomic adapter and observer integration

Six routing RED (metadata fixture corrected old-source0/1) and six missing-cap
RED→251 related GREEN before review. Two P2/three reviewer stdin RED;12 error
body cancellation+Reader real-metadata method swap+three observer lifecycle
RED0/16, OAuth cleanup body0/1. One fix pass→412/412 (zero fail/cancel/skip), no
minor/re-review. Peer-lock fixture corrected and three old-source RED retained.
Full1468/1469 found old same-epoch observer interface; fixed and final1486/1486
Node22 actual Core/owned PG stopped cleanup0, snapshot550/49dfbc9a7b85a38bff21bbe90a905d8fe98a8f580e70763139d84f972c49b55e. Validate72/40/cache PASS.
Real counter25/160 unchanged, no actualGoogle/counter upgrade/native full quota/
handoff/orchestration proof; all real gates and proposed320 remain unaccepted.


### Single in-flight ownership and bound native producer

| Case | Evidence | Boundary |
| --- | --- | --- |
| Same-scope ordinary/C/I and runtime contention | Four precise RED→416 related GREEN | Original owner spans wait/debit/IO; rejected C/I unadmitted, once after settlement |
| Fixed producer handle/method pin, actor/phase/nonce/clock/bytes, stop/concurrency |17 missing-module RED→18 GREEN including actual synthetic Python flock25→26/fake AX | One full emitfalse call; actual CUA binding/bridge not executed |
| Callback race after debit before entry | Reviewer200/200 P2=1; author runtime/preparation two exact RED0/1 each→436 target GREEN | No refund; ordinary stop rechecked at callback; independent cleanup preserved; one fix pass/no re-review |
| Target command completeness | Initial292 passed but four adapter filenames did not exist; corrected explicit ten files436/436 zero fail/cancel/skip | Incomplete command retained; final target is436 |
| Full regression |1510/1510 Node22/macOS actual Core643c1b3/owned PG16.14 stopped cleanup0, validate72/40/cache PASS |552-source snapshot92a544005c20d0222c0645532b24a899878c60e1ccdf96610f8ddbbeaeaac13a; docs later |
| Real acceptance | Actualcounter25/160 unchanged/no preparation claim; no Google/browser/RPC/config | CUA/window/quota/freshness/budget320 approval/common ledger/handoff/recovery/orchestration and all original gates NOT_ACCEPTED |


### CUA local-module realm compatibility

Two exact no-process VM RED0/2→73 related GREEN, using actual source/explicit
builtin allowlist/real synthetic Python flock/private capture. Actual CUA module
probe first stopped before spawn/debit/UI; no-process import denied, failure
retained. Fixed PATH/allowed os.userInfo().uid then actual CUA local synthetic
probe PASS: fake callback1/spent26/peer denied/raw0600/coverage-quota-trial false.
Fresh reviewer73/73/P1=0/P2=0/minor=0. Full1512/1512 Node22.23.3 actual Core/
owned PG16.14 stopped cleanup0, validate72/40/cache PASS; snapshot553/
cc06be4ce14e6a3c99856a3ef439dc3d1a9b2245d25f5f32be1ee1e47d1f07ae.
Actual counter25/160 unchanged/no preparation claim; no real UI/Google/RPC.
Tool module co-location proof is not actual tab binding/native window/quota or
shared-ledger/orchestration acceptance; custom Python prefixes/UID changes untested.


### Canonical one-way phase handoff

| Case | Evidence | Boundary |
| --- | --- | --- |
| Runtime cannot seed legacy; exact C2/ready/noI/spent/day/expiry/idle transfer |17 missingfeatureRED→54 relatedGREEN;239 integration | No extra debit/IO or fresh epoch; C2 admission not remote restoration proof |
| Same counter/checkpoint/flock/history/rolling/ceilings; wrong binding/stale prep/escaped/duplicate/old bytes/unknown | Real synthetic Python scopes; CUA local27→28/history28/peer denied/acceptancefalse | Actual RPC/shared runtime state/recovery/orchestration not integrated |
| Clock rollback after handoff | Reviewer282/P2=1; runtime/preparation authorRED0/2→286 final | All kinds checked before debit; rejected I unused, recovered-clock cleanup still eligible; one fix pass/no re-review/minor0 |
| Full regression |1531/1531 Node22/macOS actual Core/owned PG16.14 stopped cleanup0; Python compile/validate72/40/cache PASS |554-source snapshot148d513421c8872ff56cb4d7266e655d5b3c0bb9a3c86992a5736dc9e0134d74; docs later |
| Rollback/real gates | Actual25/160 unchanged/no claim/no Google/nativeUI/RPC | V2 phase not downgraded; pin v2 cleanup controller before actual transfer.320 approval/native windows/quota/freshness/whole rollback/original gates NOT_ACCEPTED |


### Canonical compatibility runtime core

| Case | Evidence | Boundary |
| --- | --- | --- |
| R order/once/pending/debit-before-callback/same-scope finish/hash/native limits/rolling/I17/day/expiry | Initial26:13FAIL/13PASS, then80/267; exact stop-before-handoff0/1→268 | Shared canonical v3 only after first R; UNKNOWN never refunded, no token/result persisted |
| Pending ordinary denied; paid S/native settlement, expired independent I, escaped/replayed/rolled-back source state | Final31 runtime tests in272/272 seven-file target | Passive metadata or successful fake callback is not Google proof; old separate driver NOT_ACCEPTED |
| Partial stop write cleanup poisoning | Reviewer27/27 P2=1; actual request_stop fault-injected empty/partial RED1PASS/3FAIL→272 | Negative presence veto preserves bytes; validated checkpoint/claim still mandatory; C/I once and pending/native preserved, one fix pass/no re-review/minor0 |
| CUA module co-location after fix | Two synthetic Python-flock probes: fake RPC2/native200/pendingnull; partial RPC1/native100/pendingwrapper; both spent30 after cleanup | Real UI/Google0; no actual tab/window/quota/authority or acceptance proof |
| Full regression |1562/1562 Node22/macOS pinned Core/owned PG16.14 stopped cleanup0,18.564s; validate72/40/cache/compile/diff PASS |555-source snapshot92c1fc56c3e7a8e76b4fdae764d46c282de3084657d3c3f711223d910bc775ac; preflight git timeout retained, bounded same-runner retry, cause UNRESOLVED |
| Rollback/real gates | Actual25/160 unchanged/no claim/no Google/UI/RPC;320 UNAPPROVED | Pin v3-capable cleanup before actual R, never downgrade counter. Driver integration/recovery/full orchestration/original real gates NOT_ACCEPTED |


### Canonical compatibility driver integration

| Case | Evidence | Boundary |
| --- | --- | --- |
| Pure exact binding/epoch/expiry/order; canonical release/native/token/R/S/native-account/result/post-release/finish |32 initial RED→212; final45 new tests in317 eight-file target; metadata adapter ordinary/S integration | No separate ledger/import/seed or new authority budget; no actual trial acceptance |
| Signed canonical prefix | Generated GAS-entry VM exactRED0/1 empty request denied→two signed entries PASS | Cache/native/Sheets/LINE/token0; unchanged prefix, synchronous factory copied once, no live Google proof |
| Unknown/API/native/postrelease errors, stop/caught/unawaited/escaped/pins/scopes/cleanup/cancellation ownership | Real synthetic Python canonicalflock and fixed transport; pending/native/spend retained, peer denied until IO settles | Successful boolean alone never completes pending; no retry/refund/positive liveness from metadata |
| CUA typed bytes | First local fakeHTTP1/native100/pending retained; diagnostic instanceof false/types true; exact foreign-byte RED0/1→predicate fix | Final actual CUA LOCAL fakeHTTP2/spent38/native200/pendingnull+cleanup PASS; old failed state preserved, trialAcceptedfalse/realGoogleUI0 |
| Review | Independent386/386 eight files, P1/P2/minor0, validate/diff PASS | No author fix pass/re-review; reviewer did not repeat author CUA probe |
| Full regression |1607/1607 Node22/macOS actual pinned Core/owned PG16.14 stopped cleanup0,19.239s; validate72/40/cache PASS |556-source snapshot90b309bbd575f3603c255e5209590feede9202a03e7d1fef856df4e4218dfbfb; git preflight timeout retained, readonly Git guard+one bounded retry, cause UNRESOLVED |
| Actual gates | Actual25/160 unchanged/no claim;320 UNAPPROVED, no Google/UI/RPC | Full adapter CUA interoperability/orchestration/holder recovery/v3 rollback/native windows/quota/budget and all original gates NOT_ACCEPTED |


### Preparation adapters in the CUA realm

| Case | Evidence | Boundary |
| --- | --- | --- |
| Five no-process private initializations; six foreign-byte response operations; combined canonical prep |12 precise RED0/12→228 GREEN; final14 new cases in343 eleven-file target | UID/mode/symlink/size/hash/once/scopes/expiry unchanged; real file/debit/flock, fake endpoints/pins only |
| Genuine foreign Uint16 fixture and array-like response refused | Two negative preservation cases, no upload/acceptance | types.isUint8Array does not convert arbitrary views/objects; original byte/copy limits retained |
| Actual CUA LOCAL whole prep |6 adapters/28 fake HTTP/28 real Python peer denials/spent54/C2+I5/private0600 | realGoogleUI0/actualcounterfalse, trialAccepted/rollbackComplete false; not token phase handoff/live attestation |
| Actual CUA LOCAL fixed callback | Second full prep plus owned127.0.0.1:34763 callback/result HTTP2/listenerClosedtrue | Google/token responses synthetic; no owner input or real Google PKCE/consent proof |
| Review |230/230 (185+OAuth45), P1/P2/minor0; validate/diff PASS | Negative name filter did not exclude listener; all45 ran, correction recorded; author CUA/343 not reviewer evidence |
| Full regression |1621/1621 Node22/macOS actual Core/owned PG16.14 stopped cleanup0,39.205s; validate72/40/cache PASS |558-source snapshotf60081e5b1b845b14c2af59356b2b83aa99463482d645f0914bebde0ecf1e211; preflight timeout retained, diagnostic+private trace/one terminal retry, cause UNRESOLVED |
| Actual gates | Actual25/160 unchanged/no claim;320 unanswered | Full pinned orchestration/token phase handoff/holder recovery/v3 rollback/complete native quota/freshness/budget and all original real gates NOT_ACCEPTED |


### Same-controller credential phase lifecycle

| Case | Evidence | Boundary |
| --- | --- | --- |
| Same OAuth grant prep→runtime→cleanup | Exact prior captured-cap failure RED0/1→16 phase tests PASS; exchange/revoke once and no durable token | Same canonical epoch/counter, no new grant/refresh/reseed; ACK_UNVERIFIED is not native revoke proof |
| Generation/phase/caught/nested/overlap/unawaited/entered IO/expiry/partial stop | Original flock retained until owned terminal; ignored rejection RED0/1→handled denial | Trusted callback adapter only; stale work cannot borrow newer activation; C/I cleanup reserve unchanged |
| Whole six-adapter canonical driver integration | VM + actual CUA LOCAL: prep49→wrapper+qualified→I5 spent64/native200, peer denied30; loopbackHTTP2/listenerclosed | Injected Google28/RPC2, no actual UI/token/Google/counter; trialAccepted/rollbackComplete false |
| Review | Independent76/76, P1/P2=0, diff PASS | Minor deferred: facade transport-error S/native settlement→cleanup integration; no author review fix pass/re-review |
| Full regression |1638/1638 Node22/macOS pinned Core/owned PG16.14 stopped cleanup0,45.083s |560-source snapshote6f106470d00ef40ed40a8c38d6b233f9b1a1ddb2e2e1c36244d8092f58da259; preflight timeout at unpack_trees/diagnostic/one terminal retry, cause UNRESOLVED |
| Actual gates |Actual25/160 unchanged/no claim,320 unanswered |Trusted full orchestration/holder recovery/v3 rollback/native quota/budget/privacy/performance/C1/C5/500-Taipei/device NOT_ACCEPTED |


### Fixed trial orchestration and failure cleanup

| Case | Evidence | Boundary |
| --- | --- | --- |
| UNKNOWN transport→S/native settlement→I17; pure once/fixed entries/prep failure/ACK-lost handoff/stop/immutable refs | Exact old integration RED0/1 (cleanup0vs17)→VM orchestrator; final18 new cases in95 four-file target | No R replay/refund/new ledger; pending/native preserved; real native preparation/cleanup not yet implemented |
| Empty callback and unawaited restore | Two exact RED0/1→durable C2/I metadata check and owned restoration drain | New cleanup-inspect is passive/frozen/no debit/write, no Google absence or liveness attestation |
| Stale cleanup callback steals later slot | Fresh reviewer94/94 P2=1/minor0; exactRED0/1→per-callback ALS origin→95 | One author fix pass/no re-review; later slot retains own single authority; previously admitted C/I drains |
| CUA LOCAL after fix | Expected STOP/fakeRPC1/spent70/native100/accounted incomplete wrapper/pending retained/I17/listenerclosed | Five actual local adapter cleanup methods +12 explicitly synthetic native callbacks; actual GoogleUI/counter0/acceptancefalse |
| Full regression |1657/1657 Node22/macOS pinned Core/owned PG16.14 stopped cleanup0,52.242s |562-source snapshot9da5e5fed355be5f1b8c0b7e6080db2c096ac66b7477c81d8a6ba17b1376c78b; pre-review Git preflight failure retained, owned pattern-read diagnostics/root cause UNRESOLVED; corrected-source final terminal PASS |
| Actual gates |25/160 unchanged/no claim;320 unanswered |Concrete pinned GCP/guard/Testing/client/native cleanup/rollback/recovery/native quota/budget and all original real gates NOT_ACCEPTED |


### Independent cleanup runtime and original holder drain

| Case | Evidence | Boundary |
| --- | --- | --- |
| Private fixed source/dependency snapshot; copied bootstrap; inventory/hash/owner/mode/symlink/tamper; stale or absent claim/checkpoint | 19 rollback tests, real synthetic canonical Python controller |31 code files/Acorn8.15.0 license, no secret/counter copy or seed; trusted source boundary only |
| Original IO/child drain, partial stop ACK, peer holder, original lifecycle cleanup | Core/lifecycle captured handle settles; peer recovery NONE_CAPTURED cannot bypass flock |No file/PID liveness inference or remote termination proof |
| Existing thin and Reader recovery | Thin constructor shape RED0/1; reviewer Reader checksum P2 exact RED0/1→fixed per-kind format; remove/verify once, original registration/UNKNOWN runtime preserved |No grant/publish/RPC export; no record rewriting or replay |
| Review and author verification | Independent98/98, P2=1 fixed one author pass; rollback/orchestrator/preparation/phase89/89, no re-review/minors |Actual Google cleanup/credentials/native/device/performance and same-user file races declined |
| Actual CUA LOCAL |Copied bootstrap31 files, syntheticv3 pendingwrapper/spent29/I1 preserved |GoogleUI/RPC0, actualcounterfalse/trialAcceptedfalse/rollbackfalse |
| Full regression |1677/1677 Node22/macOS pinned Core/owned PG16.14 stopped cleanup0,52.911s |565-source snapshot05c6c9fc60b07124f7158c8d7d368b17ce9ef677ff9262d68f82d1cec23dc1fe; pre-PG Git timeout retained, explicit empty stdin same gates terminal retry; underlying cause UNRESOLVED |
| Actual gates |25/160/no claim unchanged;320 unanswered |Lifecycle receipt prerequisite integration, concrete native callbacks/quota/windows/budget and all original actual gates NOT_ACCEPTED |


### Recovery prerequisite at canonical dispatch

| Case | Evidence | Boundary |
| --- | --- | --- |
| Missing/immutable pin/options; wrong epoch/binding; source mutation in prep/release/after wrapper | Required descriptor RED0/1, async seam RED0/1, fixed same-counter copied constructors |Pure construction; no new scope/seed/refund; snapshot does not prove Google absence |
| Stop while checking; final lifecycle/canonical stop | Prep0vs1 RED; reviewer exact two final-stop REDs→sync veto before transport |R remains charged UNKNOWN/pending; all I17 still attempted, original IO drains |
| Signature/trial/token/native age after new await | Reviewer aged-signature and expiry REDs→paired async/sync hooks before final guards/signing |Corrected relative token fixture reproduced on preserved old candidate; no await after final checks; native proof bounds unchanged |
| Review/author |Independent63/63,P2=2/minor0; one author fix pass→114/114,49.110s |No re-review; VM dynamic import loader corrected without ambient process or expanded builtin whitelist |
| CUA LOCAL copied current source |FakeRPC1/native100/spent70/pendingwrapper/I17; artifact6/counter4 checks |All Google/native responses synthetic; actualcounter0/trialAcceptedfalse/rollbackfalse |
| Full regression |1692/1692 Node22/macOS pinned Core/owned PG16.14 stopped cleanup0,53.920s |565-source snapshotf2396261f814a6f493c43aad9a7723bb878f7bc28a8d5e481232d9bfad6d6274; no retry this batch; prior Git stall cause UNRESOLVED |
| Actual gates |25/160/no claim unchanged;320 unanswered |Concrete native preparation/cleanup/readback, full windows/quota/budget and original real gates NOT_ACCEPTED |


## 2026-10-14 — Three original publication cleanup readbacks

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Original source/versions/deployments I17 aliases | Affected57/57 PASS; independent56/56 plus one P2 author fix | Fixed admitted GETs, exact backup matching, no pagination/replay or UNKNOWN journal settlement |
| Copied canonical lifecycle | Synthetic UNKNOWN retained; spent36, original I3; journal unchanged | Actual local Python ledger/fake HTTP; copied control bound, no ordinary method or new scope |
| Cross-holder shared lock | Failure reproduced; corrected test PASS | Held through terminal GET; excludes other holder's stage/restore journal mutation |
| Full/validate | 1703/1703 PASS, zero fail/cancel/skip; validate72/40/static PASS | Node22.23.3, pinned Core/local PG16.14, cleanup verified; one full run |
| Owner budget / real acceptance | 320 declined; actual25/160 unchanged/no claim | Nine callbacks and native windows/quota/budget incomplete; no actual Google/production acceptance |

Original performance/72h/seven-day/device gates remain; do not infer cutover
readiness from local passes. See EXECUTION_RECORD.md and rollback plan.

### 2026-10-14 — C3 stack alignment

| Gate | Evidence | Boundary |
| --- | --- | --- |
| Source composition | Original7226076 authority/controllers unchanged; only inherited C1 UTF-8 source/tests and reviewed C2 test observer differ | Original history/rollback preserved; no formal runtime change |
| Full local | Node22/Core/ownedPG1707/1707; cleanup/listener stopped | 0 fail/cancel/skip; one complete run |
| Worker local |24/24; seven groups100 each, unchanged p951.769–3.132ms<50 | No retries/warmup/exclusions; exact-head Linux CI pending; original failedCI retained |
| Real gates | Counter25/160 unchanged/no claim;320 declined | Actual trial STOP; daily900s NOT_ACCEPTED; fresh72h/seven-day shadow/500/device NOT_STARTED or UNACCEPTED |

### 2026-10-14 — C3 composed Node observation

| Gate | Evidence | Boundary |
| --- | --- | --- |
| Source | Sole non-document delta from685d928 is C2 observer plus original0003 | All authority/runtime/root tests unchanged; static review reused |
| Local | Retained1707/1707 root; new Worker24/24;7×100 p951.774–2.804ms<50 | No retry/warmup/exclusion; exact composed Linux CI pending |
| Prior C3 CI |38533367980 rental1702 PASS/Worker23 PASS1 FAIL | Rooms188.364ms>50; cause UNRESOLVED, no production performance acceptance |
| Real gates | Actual25/160 unchanged/no claim,320 declined | Trial STOP; daily900s/fresh72h/seven-day/500/strict latency/device retained |

### 2026-10-14 — Original token rejection check

| Gate | Evidence | Boundary |
| --- | --- | --- |
| TDD | Missing method7 RED→GREEN; overlapping token erasure RED→GREEN | Original-token bearer identity, admission expiry, UNKNOWN preservation/no retry, body disposal under ownership |
| Review | Static P1/P2/minor0, no repeated review | Original-holder only;401 is token rejection at readback, not cause/grant-wide revocation |
| Affected/full |110/110 and1718/1718,0 fail/cancel/skip; Node22/Core/ownedPG stopped | Snapshot565 SHA542b61167239a310904db41397584477a6113b5f666d57ca1f452bc4615c90c2; validate72/40/static/diff PASS |
| Worker | Prior unchanged24/24/two dry runs CI38535147314 retained | Every Worker source/test byte unchanged; new-head CI pending, no local redundant benchmark |
| Real trial |25/160 unchanged/unclaimed;320 declined, no Google IO |8 native/guard callbacks/whole160 plan remain; all original real gates unaccepted |

### 2026-10-14 — Scoped-loader SDK costs

| Gate | Evidence | Boundary |
| --- | --- | --- |
| TDD/review | Missing observer RED1; static P1/P2/minor0 | SDK bind/session/batch/results retained, no extra request/sample/data in header |
| Existing canonical requests |7×one request,63 single statements each, one first-primary session/no batch | Actual scope/data loader; omits full HTTP replica/session/provider/GAS costs; not p95 |
| Full Worker |24/24,0 fail/cancel/skip; original100-sample p951.751–2.471ms<50 | No retry/warmup/exclusion/new gate; exact-head CI pending |
| Root | Prior1718/1718 retained, all runtime/root-test bytes match snapshot | Only2 Worker test files changed, no unchanged root rerun |
| Native/real gates |8 native/guard callbacks incomplete;25/160 unchanged/no claim,320 declined | No guessed UI/API substitute, no actual native/Google IO; all original gates retained |

## 2026-10-15 — Scoped D1 batching

| Area | Evidence | Acceptance boundary |
| --- | --- | --- |
| Scoped request cost | Existing seven exact GAS parity requests:63 statements,7 single+5 batch calls,one primary session; calls-cap RED→GREEN | Same queries/scope/projections; not full HTTP or production latency |
| Chunk/tail mapping |241 parents/legacy rooms/tenants/users, observer[3,7,10,80,8,8], source order/dedup/tail row and GAS rooms parity | Review P2 fixed after161-row fixture exposed73-only stage; no guessed85 remainder |
| Fail closed | Real D1 malformed JSON and missing operational table both503/data:null, no partial output | No retry/cache or diagnostic leak |
| Local regression | Node22/Core/ownedPG1718/1718,cleanup verified; final Worker26/26 and original7x100 p951.610–2.174ms<50 | Root retained after only Worker test changes; exact-head CI required |
| Real gates | Actual25/160 unchanged;900s/day,fresh72h,seven-day shadow,500-room/Taipei/latency/device/cutover remain unaccepted | No Google/native/formal changes |

## 2026-10-15 — C4 current-stack composition

| Area | Result | Boundary |
| --- | --- | --- |
| Routing/fallback/write protection |54 own non-document paths exact2ed69c7; new full1731/1731,zero fail/cancel/skip | Local composed source; no device/cutover claim |
| Inherited scoped loader/trial controls | Cloudflare/Apps Script/read fixtures exactC3 9b1af93; retain26/26/two dry runs fromCI38705761544 | No redundant local benchmark; new composed-head CI required |
| Local infrastructure | Node22/Core/ownedPG cleanup and closed listener verified | No shared/formal database |
| Real gates | Actual25/160 unchanged; daily900s/72h/seven-day/500/Taipei/device unaccepted | Endpoint blank/flags off |

## 2026-10-15 — Child input error handling

| Area | Evidence | Boundary |
| --- | --- | --- |
| Scoped child stdin error | Real-child EPIPE RED→GREEN; zero IO/spend25, sanitized failure, scope reuse after actual finalization | No premature terminal/debit/retry/cleanup grant |
| Stop input error | RED→GREEN; no acknowledgement or ordinary-IO reopening | Existing exact ACK/close checks retained |
| Complete regression | Node22/Core/ownedPG1720/1720,cleanup/listener verified | Prior C5 failure1735/1736 remains; C5 integration not accepted |
| Core prerequisite | Actual HEAD/copied actual index/same objects via private metadata view;321-path missing-worktree negative | Shared exclude read blocked; no shared source/metadata change; full blob audit not claimed |
| Worker/real gates | Retain unchanged9b1af93 Worker26/26/two dry runs; new-head CI required | OS flock continuity, actual160/900s/72h/seven-day/500/Taipei/device unaccepted |


2026-10-15 C4 child-input propagation: exact inherited C3 acbff8e controller/
tests, own routing/Worker/Apps Script unchanged; affected68/68 and validate72/40/
static cache/diff PASS. Retain previous full1731/1731 and Worker26/26 plus
C3 full1720/1720; this is not a fresh full-composed run. New-head CI pending;
Draft/off, actual25/160/native STOP and all real gates remain unaccepted.


2026-10-15 C5 current stack: C4 8922fcb merged; own65/66 source paths exact
old b424ccb, test-only observer preserves C3 batch/session plus C5 receipts.
Full1738/1738 with ownedPG cleanup; only Worker fixture changed afterward,
Worker initial26/31 RED→31/31 GREEN; static review0, validate72/40/static/diff
PASS. Exact-head CI required. Actual25/160/native STOP/off/blank;900s/72h/
seven-day/500/Taipei/device/cutover remain unaccepted, no real shadow started.


2026-10-15 current-stack composition: C5 8801187 merged into C6 96240d3;
packed fields retained alongside C3 staged80-statement batching. Calls-cap
RED1→GREEN3; full1791/1791 with Core/ownedPG cleanup, Worker36/36/bundle PASS;
static review0/validate72/40/cache/comparison178/diff PASS. Local500 fixture
seven100-sample p9511.781–23.237ms<50; not real identity/authority/remote/Taipei/
device acceptance. New comparison read-bce058f378ee92a21559b596ec408c183496a6ec2009def7b508daa333666870.
Exact-head CI pending; actual25/160/native STOP/off/blank and all real gates
remain unaccepted; fresh72h/seven-day NOT_STARTED. Only docs after tests/review.


2026-10-15 C6 request-local date output cache: bounded128 finite numeric/
primitive-zone/pattern tuples with fresh coercion; no Date/auth/cross-request
cache. TDD RED250 native formats vs1→calendar4/4 GREEN; actual250-tenant
calculation2252 format calls/5 native formats. Static review0, full1792/1792
with ownedPG cleanup, Worker36/36/bundle/validate72/40/cache/comparison178/diff
PASS. Snapshot d828cfed6056a6336bce45b50c072b8a5b2466627233be0403ae0c8e8eb5c8a0.
Prior Linux500 tenants58.708ms FAIL retained, new-head CI required. Local
fixture evidence is not real acceptance; actual25/160/native STOP/off/blank,
900s/72h/seven-day/Taipei/device gates unchanged. Only docs after review/tests.


2026-10-15 explicit tenant summary now skips250 discarded history constructions
for the synthetic250-tenant case. Actual-source TDD250→0; entire summary equals
full-response projection, default still returns all histories. Static review0,
full1793/1793 with Core/ownedPG cleanup, Worker36/36/bundle and validate72/40/
static cache/comparison178/diff PASS. Snapshot71b383069f6557f1e0c1782b378b8b88c8cdf6affc529bb8ca79c19ae28aa8f3.
Prior daf25c4 Linux tenants50.894ms FAIL retained; new-head CI required, no
real acceptance/epoch. New comparison read-f78e12a3f964adf8bd38451988ac76840ae0718c1d0bf328bf9e27ae8b7a52d8.
Actual25/160/native STOP/off/blank and all original900s/72h/seven-day/Taipei/
device gates remain; only docs after tests/review. Rollback source to daf25c4.


2026-10-15 C6 single room matrix: actual route32 rows/64→32 enumerations,
full GAS JSON unchanged; TDD duplicate-materialization RED→GREEN14/14, public
covers/request isolation preserved. Static review0; full1794/1794 with Core/PG
cleanup, Worker36/36/bundle, validate72/40/cache/comparison178/diff PASS.
Snapshot0531c3ac4ea1c76a006fb2c61f83f66b378536e692f15c3ac1f5c926ad7148c7.
Seven100-sample local500 fixture p9512.626–20.092ms<50; prior a043240 Linux
rooms52.967ms FAIL retained, new-head CI required. Original real gates unchanged;
actual25/160/native STOP, all flags off/endpoint blank, fresh72h/seven-day
NOT_STARTED. No formal changes; rollback source/comparison to a043240.


2026-10-15 C6 fixed collation: TDD499 repeated localeCompare calls→one explicit
request-local sorter; full500-room response equals native GAS VM,784 pairs plus
literal ordering/live coercions/ties/errors pass. Relevant12/12; module function
testLandlordPropertiesInit VM500/20 PASS; full1796/1796 with Core/ownedPG cleanup;
Worker36/36/bundle,static review0,validate72/40/cache/comparison178/diff PASS.
Snapshotf4bbd4807b1927b9b28f4ebef04f2070bf062e5c1d64d03eb308c72dff38fb71.
Seven100-sample local500 p9511.061–18.560ms<50; prior568344b Linux properties
53.391ms FAIL retained. New-head CI/native/real gates still required; actual
25/160/native STOP/off/blank; fresh72h/seven-day NOT_STARTED. Only docs after
tests/review. Rollback source/adapter/comparison to568344b.


## 2026-10-15 — Inherited preparation ownership verification

| Evidence | Result | Boundary |
| --- | --- | --- |
| Inherited controller/ledger/test | Exact C3 71cc636 bytes; related83/83 and complete1728/1728 retained | Original child lifetime, strict finish and durable-stop ownership only; no native acceptance |
| Order composition | Own runtime and fixtures unchanged; validate/diff required; exact-head CI pending | No repeated unchanged local Worker benchmark |
| Real gates |25/160 unchanged, trial STOP; all formal gates unaccepted | PR272 acceleration still pending, original observation gates retained |



## 2026-10-15 — Preparation lock lifetime and completion

| Area | Evidence | Boundary |
| --- | --- | --- |
| Canonical inherited FD | EOF/SIGKILL holds actual synthetic flock through entered IO; wrong inode rejected without claim/debit | Local POSIX evidence; not remote termination |
| Finish and stop | Three new real-child RED→GREEN; strict finish/exit, failed durable helper retains original ownership until ACK | No independent ordinary debit or recovery grant |
| Restricted realm | Original11 full failures retained; existing approved OS identity API restores compatibility; affected83/83 PASS | No ambient process or new builtin permissions |
| Complete regression | Final1728/1728,57.895s,Core/ownedPG cleanup verified; validate72/40/cache/diff PASS | Retain unchanged Worker26/26/two dry runs; new-head CI pending |
| Real gates |25/160 unchanged/unclaimed; native STOP; original gates unaccepted | Draft accelerated-observation PR272 pending owner scope confirmation |

### 2026-10-15 Strict scalar decoder and current comparison identity

| Area | Evidence | Boundary |
| --- | --- | --- |
| JSON semantics | Scalar5/5, including escapes, controls, malformed strings, whitespace, nested values, own keys and negative zero | No stored/frame/API shape change |
| Worker/D1 | One modified-source36/36; original7×100 samples all p95<50, local properties18.054ms | Exact prior CI51.233ms FAIL retained; new CI required |
| Source identity | Initial validate/full1804/1805 rejected stale comparison; existing generator updates only identity/source SHA | No off flag, endpoint or threshold change |
| Full regression | Final1805/1805,57.154s,Node22.23.3/actual Core/ownedPG; cleanup verified | Snapshotcaac7501df0bf22c62f0d2b92f9eed718be4208acff704f4c1e15206060b1bd8; only docs afterwards |
| Review/checks | Independent four-file review no finding; validate72/40/cache/comparison178/diff PASS | Native/provider/remote/device/daily900s and approved observation gates unaccepted |

Current owner schedule is merged PR272: parallel24h after technical gates,
rooms first, stable24h before later accepted pages, seven-day post-on. T0 has
not started; old72h/seven-day pre-on rows above are historical.

### 2026-10-15 Request-owned deferred Sheet matrices

- RED3=2fail/1pass, related24/24 PASS: request-owned unused frames0, used Sheets
  stable/once, getValues copies, default eager snapshots, invalid arrays denied.
- Complete actual500-room properties/GAS parity, full loaded payments retained,
  room rows once/all others at most once; no query/data/API scope reduction.
- Changed-source Worker36/36 PASS, all7×100 original local p95<50ms. Prior exact
  f2e90eb CI Worker35/36 properties51.147ms FAIL retained; no unchanged retry.
- Full1808/1808 PASS56.327s, actual Core/ownedPG cleanup verified; snapshot
  3a4157e6f5096609672b2e371ab2dfa6eca07af0b2696db942803ea2ff619b74, only docs
  afterwards. Independent review no finding; validate72/40/cache/comparison178
  PASS. New-head CI, real remote/device/900s/native and observation gates remain.


### 2026-10-15 C6 paired capacity-stage evidence

- Exact957707e CI38763560079 rental1803/1803 PASS, Worker35/36 FAIL properties
  p95=52.057ms>50;700 samples complete, both footers/annotations read, truncated
  logs. No unchanged retry or performance acceptance.
- Summary TDD20pass/2RED then affected23/23 PASS; actual changed Worker36/36
  PASS34.231s. Original7×100 requests/full body timer/50ms retained. Existing
  test-only Worker headers provide paired D1/decode/route/dispatch/consume and
  byte counts; parse/log work after timer. Terminal summary retains all7 bounded
  stage lines and original footer; zero stage overflow. This instrumentation
  can perturb later client GC, cannot prove causality, and changes no product.
- Review no actionable finding; validate72/40/cache/comparison178/diff PASS.
  Prior full1808 retained for unchanged product; not a new full rental run.
  ActualGoogle25/160 unchanged; T0NOT_STARTED/alloff, real gates remain.


### 2026-10-16 capacity measurement completion

- Exactbc8f6e7 CI: rental1805 PASS, Worker35/36 FAIL arrears50.814ms;600 samples,
  propertiesNOT_MEASURED. Both footers/annotations read; prior failure retained.
- Actual measurement-tail control regressions: early dual violation still700,
  non-finite p95 denied, below50 all700. NaN1RED/2PASS then affected26/26 PASS.
- Full Worker36/36 before final strict comparator; final actual capacity2/2
  PASS12.918s, original realD1/GAS/500-room checks and7x100 requests preserved.
  Review no issue, validate72/40/cache/comparison178/diff PASS. No new full rental
  run claimed; product/Apps Script/comparison/alloff unchanged. New exact CI
  remains separate from local evidence; all real acceptance gates retained.

## 2026-10-16 — C1 expired-run Sheet reads

| Check | Evidence | Boundary |
| --- | --- | --- |
| Slow send reaches/exceeds the four-minute deadline | Actual-module dirty/full regressions RED2/2 then GREEN; full leaves all15 unattempted tables dirty and both paths release lease | Synthetic clock/network/Sheets; blocking native IO cannot be interrupted |
| Affected module and independent review |19/19 PASS; no actionable findings | Projection Apps Script test function also runs in the VM; no Google execution |
| Complete local regression |859/859 PASS,zero fail/cancel/skip,actual pinned Core/owned PG16.14; cleanup verified | Not native900s/day, actual authority, freshness, performance or device acceptance |

No actual Google operations or observation restart. Existing failed execution
history retained; approved accelerated24h clock NOT_STARTED, switches off.

## C2 inherited C1 deadline guard — 2026-10-16

Recommended GPT-6.1 Sol/high. Inherited the reviewed C1 guard from489d339: after
the existing four-minute send deadline, do not read/hash another Sheet. Full
reconciliation still queues every unattempted table; completed matching dirty
generations clear and lease cleanup remains. Blocking native calls cannot be
interrupted and marker/lease IO may continue. Existing C2 projection/auth
changes preserved; no claim of fixing335s idle Cache or daily900s acceptance.

Affected24/24 PASS and shared incremental independent review found no actionable
issue. One full local874/874 PASS,2.614s,zero fail/cancel/skip,
Node22.23.3/actual pinned Core/owned PG16.14; database/role cleanup, stopped
cluster and closed listener verified. Tested494-file snapshot
6ecc7f9b5b48f2221d941a537d420b9fda23fa8388338b852c0229816218cb0e;
only docs afterwards. Validate71backend/40endpoints/staticcache/diff PASS. Worker
unchanged; no repeated capacity run. Exact-head CI must be read after push.

No actual Google/account/credential/Properties/trigger/Sheet/deployment IO.
Original25/160 remains unclaimed; native-IO amendment remains awaiting owner.
Approved parallel24h T0 NOT_STARTED/alloff; actual authority/privacy/freshness/
900s/day/performance/device gates remain unaccepted. Rollback this undeployed
inheritance to1b3c18c25cddea0d38014ba948c7fb03c83da124;
retain all original claims/checkpoints/pinned cleanup and history, never reset
or replay. Root WIP/privateS1/C5swap and pending C3 proposal preserved.

## C3 inherited C1 deadline guard — 2026-10-16

Recommended GPT-6.1 Sol/high. Inherited the reviewed C1 guard from489d339: after
the existing four-minute send deadline, do not read/hash another Sheet. Full
reconciliation still queues every unattempted table; completed matching dirty
generations clear and lease cleanup remains. Blocking native calls cannot be
interrupted and marker/lease IO may continue. Existing C3 projection/auth
changes preserved; no claim of fixing335s idle Cache or daily900s acceptance.

Affected24/24 PASS and shared incremental independent review found no actionable
issue. One full local1938/1938 PASS,59.387s,zero fail/cancel/skip,
Node22.23.3/actual pinned Core/owned PG16.14; database/role cleanup, stopped
cluster and closed listener verified. Tested577-file snapshot
858d3792e10d131ff86555dc657cee4fd0537e9c70c941eea90f601f81b7c8ad;
only docs afterwards. Validate72backend/40endpoints/staticcache/diff PASS. Worker
unchanged; no repeated capacity run. Exact-head CI must be read after push.

No actual Google/account/credential/Properties/trigger/Sheet/deployment IO.
Original25/160 remains unclaimed; native-IO amendment remains awaiting owner.
Approved parallel24h T0 NOT_STARTED/alloff; actual authority/privacy/freshness/
900s/day/performance/device gates remain unaccepted. Rollback this undeployed
inheritance to01e2cff1ef314c9812c0520aa7fc77dd96ac6e54;
retain all original claims/checkpoints/pinned cleanup and history, never reset
or replay. Root WIP/privateS1/C5swap and pending C3 proposal preserved.


## C3 approved native IO admission — 2026-10-16

Owner approved the presented native-IO amendment SHA
`3701527108376e07470bc920336fbbd0f78015cb1e55dbfe35090ee059130cb9`.
The new immutable selector keeps history25, limit160, fixed96, P4 and T3;
N research/navigation shares original G32. Old selectors retain their policy.

| Case | Evidence | Boundary |
| --- | --- | --- |
| Research before full observer | Original caller/publisher bind purposes plus at most8 pinned N reads; UNKNOWN pre-debit, ordinal replay/extra N/raw charge denied | No early refresh, ordinary mutation, RPC or trial acceptance |
| Complete remaining map | One native-ready record with four bounded windows and exact remaining N sequence; shared32, mandatory identity/quota/page preserved | Cost admission is not actual native proof |
| Page/target/deadline bounds | Bad console query and fifth-page plans reproduced RED then fixed; expiry preserves spent and independent cleanup | Original claim, same Taipei day, original max6h; no rebind/restart |
| Native observer integration | Before/after N forwarding retains all30 F and12 minimum G charges; one RPC only | Synthetic IO; actual completeness and cost upper bound UNKNOWN |
| UNKNOWN transport settlement | Independent review P2 reproduced RED; only runtime wrapper-after N gains settlement exception, canonical pending/day/expiry/map still required | No new ordinary N after STOP or holder loss; copied cleanup stays restricted |
| Ownership/recovery | Entered N retains original flock through stop/drain; peer denied, durable stop veto, copied target binding/expiry checked | Local scope settlement is not remote execution termination |

Pre-fix affected335/335 passed. After the review fix, frozen complete regression
**1960/1960 PASS**, zero fail/cancel/skip, using pinned actual Core and an owned
local PostgreSQL16.14 cluster; cluster shutdown verified. `npm run validate`
passed72 backend files/40 endpoint references/static cache checks; staged diff
check passed. No Apps Script source changed or cloud test function executed.
Independent increment review found one P2, fixed by the exact failing integration
regression; no deferred findings. Root WIP and private-file boundary preserved.

Actual Google counter remains25/160 unclaimed; no browser/account/refresh/RPC,
publication, Properties, triggers or formal data operations. Five native F
observers and complete G/terminal evidence remain unbound. Prioritize bounded
executions preflight and stop if attribution/quota/full source cannot be proved.
All real privacy/freshness/authority/900s/day/performance/device gates remain;
T0 NOT_STARTED and formal switches off. This supersedes the earlier pending
native-IO-approval status only; it does not supersede missing real acceptance.

## C3 approved single-incident binding repair — 2026-10-16

Recommended GPT-6.1 Sol/high for the canonical stop/debit boundary. The owner
approved the exact READ-PREFLIGHT-REPAIR-DECISION proposal; its original text
and hash are retained. The event-specific entry keeps the same claimed ledger,
epoch, original deadline/day, P UNKNOWN and STOP history, and permits only one
predebited N getTab. Fresh initial tool state, settled same-holder receipt and
matching actor/reference are mandatory before ordinary preparation resumes.

Fresh independent review found one P1: the frozen original stop helper only
ACKs an existing marker. A mandatory in-memory owner-stop bridge now writes
the new canonical veto first, retains the original holder in its closure, and
drains both captured scopes. All owner entrypoints must use that bridge; raw
saved original methods cannot intercept new requests. The final capture-race
regression and true frozen-controller bytes are covered by43 passing focused
tests; the public byte-pinned fixtures require no Git history/network in CI.
Prior transport-timeout and capture-race failures are retained, not erased.

Final frozen full suite:2003/2003 PASS,69.766s,zero fail/cancel/skip, actual
Platform Core and an owned disposable PostgreSQL16.14 cluster; cluster stopped
and original Core index/HEAD preserved. Validate72backend/40endpoint/cache
and diff check PASS. No Apps Script source change. Remote CI and the actual
one-time repair are still pending at this source snapshot; local tests do not
prove Google identity/quota, trial RPC,900s/day or latency acceptance.

Rollback keeps the original pinned copy/history and independent globally-once
C2/I17 cleanup. Never reset/refund/reseed/reopen the claim, erase STOP, or run an
empty callback as remote rollback proof. No remote mutation, credentials,
formal data, deployment, flag cutover or observation T0 in this increment.

### Final source CI and one-time execution outcome

Reviewed source872067f passed CI38784461317:rental1998/1998,Worker26/26,
and both deployment dry-runs. Terminal outputs/annotations and footers read;
rental log is truncated,Worker log complete. Local full2003/2003 is separate
actual Core/disposable-PG evidence. No further source change after that check.

The owner-approved single repair was attempted once. Its canonical predebit
raised spent26 to27/160,keeping original P and new N UNKNOWN. The tool did not
return verifiable caller/page state; completion was not asserted. The original
expiry/day/claim remain unchanged. State is stopped,repair in-flight/UNKNOWN,
new durable owner veto exists,and both retained holders acknowledged drain.
There is no second repair/rebind or ordinary continuation. No publisher bind,
refresh,trial RPC,remote setting/source/data change,formal deployment or
observation T0 occurred. Preserve both copies and original STOP/history;
no no-op callback was executed or claimed as remote rollback. The exact failed
underlying tool cause remains UNKNOWN rather than attributed to login/Google.

## C4 inherited C1 deadline guard — 2026-10-16

Recommended GPT-6.1 Sol/high. Inherited the reviewed C1 guard from489d339: after
the existing four-minute send deadline, do not read/hash another Sheet. Full
reconciliation still queues every unattempted table; completed matching dirty
generations clear and lease cleanup remains. Blocking native calls cannot be
interrupted and marker/lease IO may continue. Existing C4 projection/auth
changes preserved; no claim of fixing335s idle Cache or daily900s acceptance.

Affected24/24 PASS and shared incremental independent review found no actionable
issue. One full local1743/1743 PASS,54.368s,zero fail/cancel/skip,
Node22.23.3/actual pinned Core/owned PG16.14; database/role cleanup, stopped
cluster and closed listener verified. Tested568-file snapshot
b10ddd8df3a21bc58b8d72688a091d532eee9ad03f163d7eea97ca4f733d7320;
only docs afterwards. Validate72backend/40endpoints/staticcache/diff PASS. Worker
unchanged; no repeated local capacity run. Exact-head CI follows push.

No actual Google/account/credential/Properties/trigger/Sheet/deployment IO.
Original25/160 remains unclaimed; native-IO amendment remains awaiting owner.
Approved parallel24h T0 NOT_STARTED/alloff; actual authority/privacy/freshness/
900s/day/performance/device gates remain unaccepted. Rollback this undeployed
inheritance toff429e179676e6f774ea145d917fd1d6a5b6b2d3;
retain all original claims/checkpoints/pinned cleanup and history, never reset
or replay. Root WIP/privateS1/C5swap and pending C3 proposal preserved.

After upstream alignment, the32 inherited non-doc paths equal reviewed C3
source and all54 C4-specific non-doc paths are preserved (independent review).
One new full1951/1951 PASS,58.997s,Node22/actual Core/owned PG16.14; cleanup
verified. Tested579-file snapshot37a073c05aafac138e343f04dec8ac0f579ba56e6c0eb1098db9939f60aacf56.
Only docs changed afterwards, including restoration of separate labelled C1–C4
evidence/rollback records after a P2 union-merge finding. No remaining source
conflicts; validation72/40/cache/diff PASS. Approved credentials/source/metadata
helpers inherited as local preparation only; unapproved native-IO proposal is
absent. Real gates remain unaccepted/T0 NOT_STARTED/alloff/Google25 unchanged.
Rollback this upstream alignment to329823894c19efd6ca75928838560c1b525be95a
before any unclaimed trial; retain matching claimed runtime/cleanup if any.

## C4 inherited approved C3 native IO controls — 2026-10-16

Recommended GPT-6.1 Sol/high. Merged reviewed C3 b01e753 into the existing
C4 feature branch without changing C4 routing or formal flags. All10 non-doc
paths among the13-path C3 increment are byte-identical to C3. The two document
conflicts preserve complete, separately labelled C1–C4 evidence blocks. The
approved native-IO selector supersedes historical pending-approval text only;
actual five-F/full-G/native acceptance remains unproved.

Fresh Node22.23.3 authority regression1065/1065 PASS (30 test files,
62.984s,zero fail/cancel/skip); validate72backend/40endpoint/cache and staged
diff check PASS. No unchanged Worker capacity benchmark or cross-repository
PostgreSQL suite rerun; upstream full1960 result remains C3 evidence only.
Exact-head CI is pending after this push, not inferred from local checks.

No account/Google/Cloudflare/credential/data/deployment operation in this
integration; original counter/history/private S1/root/C5 swap untouched.
Formal flags remain inherited off; no observation T0. Rollback this unclaimed,
undeployed inheritance to918b4fbe99112f2099d84703f2ee2c61318f23e3;
retain any independently established original claim/pins/history/cleanup.

## C4 final C3 stopped-trial inheritance — 2026-10-16

Recommended GPT-6.1 Sol/high. Normal merge of final C3 6bb2a62 retains all
nine changed non-document files,including its three original-controller
fixtures,byte-for-byte. Existing C4 routing/fallback/write protection and
all other runtime source remain unchanged. Complete labelled historical
records survive both append-conflict resolutions.

Fresh validate72backend/40endpoint/cache and diff checks PASS. No large local
suite or benchmark rerun; reviewed C3 source872067f full2003/2003 and
CI38784461317(rental1998,Worker26,two dry-runs) remain attributable upstream
evidence only. Exact-current-head CI/footers will be read separately.

The actual trial remains27/160 STOPPED,repair in-flight/UNKNOWN,with a new
owner veto and both retained holders' drain acknowledgements. No verifiable
caller/page state,no second bind/repair/ordinary continuation or trial RPC;
original claim/pins/day/deadline/UNKNOWN and cleanup authority stay retained.
No Google/counter/realm/credential/formal operation in this stack integration.
Performance and real acceptance remain unmet;endpoint blank,allflags off and
T0 NOT_STARTED. Rollback this undeployed inheritance to5ad3ea5 while retaining
original stopped trial history and matching pinned cleanup;never reset/replay.

## C5 inherited C1 deadline guard — 2026-10-16

Recommended GPT-6.1 Sol/high. Inherited the reviewed C1 guard from489d339: after
the existing four-minute send deadline, do not read/hash another Sheet. Full
reconciliation still queues every unattempted table; completed matching dirty
generations clear and lease cleanup remains. Blocking native calls cannot be
interrupted and marker/lease IO may continue. Existing C5 projection/auth
changes preserved; no claim of fixing335s idle Cache or daily900s acceptance.

Affected24/24 PASS and shared incremental independent review found no actionable
issue. One full local1748/1748 PASS,60.167s,zero fail/cancel/skip,
Node22.23.3/actual pinned Core/owned PG16.14; database/role cleanup, stopped
cluster and closed listener verified. Tested581-file snapshot
81e2547a19b52a412b734be486ee8672dfb4d51e1e041a645edebfb78555eda6;
only docs afterwards. Validate72backend/40endpoints/staticcache/diff PASS. Worker
unchanged; no repeated local capacity run. Exact-head CI follows push.

No actual Google/account/credential/Properties/trigger/Sheet/deployment IO.
Original25/160 remains unclaimed; native-IO amendment remains awaiting owner.
Approved parallel24h T0 NOT_STARTED/alloff; actual authority/privacy/freshness/
900s/day/performance/device gates remain unaccepted. Rollback this undeployed
inheritance tod518fd3e019b9284fb3f15f2a0d577e642ef16c9;
retain all original claims/checkpoints/pinned cleanup and history, never reset
or replay. Root WIP/privateS1/C5swap and pending C3 proposal preserved.

After upstream alignment, all32 inherited non-doc paths equal the reviewed
parent; existing C5-specific source is preserved. One new full1956/1956
PASS,59.188s,Node22/actual Core/owned PG16.14; database/role cleanup,
stopped cluster and closed listener verified. Tested592-file snapshot
ccd47742df8c1f9e1adab28517b0a3743c79a90cb772b03d289c331a3ae40e3b.
Only docs afterwards. Separate labelled C1–C5 evidence and rollback records
restored after the reviewed union-merge finding; no pending native-IO proposal
inherited. Validate72/40/cache/diff PASS. Approved C3 controls and partial
source/metadata/credential adapters are local preparation only. Original25/160
unchanged/unclaimed; real gates unaccepted/T0 NOT_STARTED/alloff. No Google,
credential, Properties, trigger, source-data or deployment operation. Rollback
this undeployed upstream alignment to2059ebefd4a03d840b019c7ff4134c5d79ee2949; preserve any
original claim/history and matching pinned cleanup, never reset or replay.

## C5 inherited approved C3 native IO controls — 2026-10-16

Recommended GPT-6.1 Sol/high. Merged C4 parent5ad3ea5, inheriting the reviewed
C3 b01e753 controls in the existing C5 branch. All10 non-doc paths among the
13-path C3 increment are byte-identical to C3; C5 clock/shadow behavior and flags
are preserved. Both document conflicts retain whole, independently labelled
C1–C5 historical evidence blocks. Approved native-IO status supersedes the
historical pending wording only; real five-F/full-G/native gates remain open.

Fresh Node22.23.3 authority regression1065/1065 PASS (30 files,64.451s,
zero fail/cancel/skip); validate72backend/40endpoint/cache and staged diff PASS.
No unchanged Worker capacity or cross-repository PostgreSQL rerun; C3 full1960
is upstream evidence only. Exact-head CI readback remains pending after push.

No account/Google/Cloudflare/credential/data/deployment IO; no T0 or formal
flag change. Root/private S1/original counter/history untouched. Existing C5
swap bytes,size,mtime remain exact. Rollback this undeployed inheritance to
c526a4ec80685a696e6a4c5583c10c3cc39d2b3e; retain any original claimed
pins/history/UNKNOWN and matching cleanup, never reset or replay a purpose.

## C5 final C3 stopped-trial inheritance — 2026-10-16

Recommended GPT-6.1 Sol/high. Normal merge of the final C4 parent inherits
C3 6bb2a62's nine source/test/fixture paths byte-for-byte,including its three
frozen original-controller fixtures. Existing C5 authenticated shadow,receipt,
clock/privacy and rate-limit behavior plus every other runtime path are
unchanged. Complete historical sections survive both append-only conflicts.

Fresh validate72backend/40endpoint/cache and diff checks PASS. No large local
suite or benchmark rerun. C3 source872067f full2003/2003 with PG teardown and
CI38784461317(rental1998/Worker26/two dry-runs) are upstream evidence only;
this branch's current-head CI/footers remain a separate verification.

Actual trial27/160 is STOPPED,repair in-flight/UNKNOWN,with no verifiable
caller/page tool state. The new owner veto and both holders' drain ACKs do not
prove remote execution/rollback completion. No second bind/repair/ordinary
continuation or trial RPC;original claim/pins/expiry/day/UNKNOWN and cleanup
authority remain. No Google/counter/realm/credential/formal-data operation in
this integration. Endpoint blank,formal flags off,T0 NOT_STARTED and actual
performance/privacy/freshness/device acceptance still unmet. C5 swap bytes,
size and mtime retained. Rollback this undeployed inheritance toec78b65 while
preserving original stopped-trial history and matching pinned cleanup.

## C6 inherited C1 deadline guard — 2026-10-16

Recommended GPT-6.1 Sol/high. Inherited the reviewed C1 guard from489d339: after
the existing four-minute send deadline, do not read/hash another Sheet. Full
reconciliation still queues every unattempted table; completed matching dirty
generations clear and lease cleanup remains. Blocking native calls cannot be
interrupted and marker/lease IO may continue. Existing C6 projection/auth
changes preserved; no claim of fixing335s idle Cache or daily900s acceptance.

Affected24/24 PASS and shared incremental independent review found no actionable
issue. One full local1815/1815 PASS,67.047s,zero fail/cancel/skip,
Node22.23.3/actual pinned Core/owned PG16.14; database/role cleanup, stopped
cluster and closed listener verified. Tested598-file snapshot
da3130e5c483dd2231b56fd1a549996443b055df4b11a6666a46fca181480a01;
only docs afterwards. Validate72backend/40endpoints/staticcache/diff PASS. Worker
unchanged; no repeated local capacity run. Exact-head CI follows push.
C6 comparison identity regenerated with the existing generator: read-841ae9a6fd45932f15b8ef6bb1d0bae28cbc394b8845afa852422f6aa742260d. Only sync source hash changed among178 comparison sources; asset version, blank endpoint and alloff flags retained. Initial stale-identity validate failure retained, corrected before the full suite. Previous capacity failures and the latest prior-head CI pass remain historical; no causal/performance fix claimed.

No actual Google/account/credential/Properties/trigger/Sheet/deployment IO.
Original25/160 remains unclaimed; native-IO amendment remains awaiting owner.
Approved parallel24h T0 NOT_STARTED/alloff; actual authority/privacy/freshness/
900s/day/performance/device gates remain unaccepted. Rollback this undeployed
inheritance tobb859677844e72de4b4bd9f33348e06c8377f6a5;
retain all original claims/checkpoints/pinned cleanup and history, never reset
or replay. Root WIP/privateS1/C5swap and pending C3 proposal preserved.

After upstream alignment, all32 inherited non-doc paths equal the reviewed
parent; existing C6-specific source is preserved. One new full2023/2023
PASS,64.087s,Node22/actual Core/owned PG16.14; database/role cleanup,
stopped cluster and closed listener verified. Tested609-file snapshot
6133ac0c79037ba7cbfa41192c91cbd7e3d6a7bd5d57cf2e848113a1ef0c960e.
Only docs afterwards. Separate labelled C1–C6 evidence and rollback records
restored after the reviewed union-merge finding; no pending native-IO proposal
inherited. Validate72/40/cache/comparison178/diff PASS. Approved C3 controls and partial
source/metadata/credential adapters are local preparation only. Original25/160
unchanged/unclaimed; real gates unaccepted/T0 NOT_STARTED/alloff. No Google,
credential, Properties, trigger, source-data or deployment operation. Rollback
this undeployed upstream alignment to5241b2ecf1f1e16573c93d04ba11c46b34e81e5e; preserve any
original claim/history and matching pinned cleanup, never reset or replay.

## C6 inherited approved C3 native IO controls — 2026-10-16

Recommended GPT-6.1 Sol/high. Merged C5 parentec78b65 into the existing C6
feature branch, inheriting reviewed C3 b01e753. All10 non-doc files among the
13-path C3 increment equal C3 bytes. No other source path changed; existing
C6 acceptance/comparison behavior, endpoint,asset version and flags preserved.
Both document conflicts retain complete separately labelled C1–C6 historical
evidence; approved native-IO status supersedes historical pending wording only.

Fresh Node22.23.3 authority regression1065/1065 PASS (30 files,65.417s,
zero fail/cancel/skip). Validate72backend/40endpoint/cache/comparison178 and
staged diff PASS. No unchanged Worker capacity benchmark or cross-repository
PostgreSQL suite rerun; upstream full1960 remains C3 evidence only. Exact-head
CI readback pending after this push; no remote acceptance inferred.

No account/Google/Cloudflare/credential/data/deployment operation; no new
observation T0 or formal flag change. Root/private S1/C5 swap/original counter
and history untouched. Real authority/privacy/freshness/quota/900s/day/device
acceptance remains open. Rollback this undeployed inheritance to
 dd901e4c7d7ccf5557e016f8658deb5cd6461095; retain original claimed pins,
UNKNOWN/history and matching cleanup, never replace a spent claim or purpose.

## C6 single-statement freshness read — 2026-10-16 (reviewed candidate)

Recommended GPT-6.1 Sol/high. Consolidated only read-dataset checkReplica's
20 same-table sync_runs statements into one SQL with fixed table ordinals.
Each original latest-completed SELECT/ORDER BY/LIMIT1,its two bindings and
newer-receiving predicate remain intact. A flat20-term UNION was rejected by
actual D1; grouping5 inner branches under4 outer branches passes actual D1
with40 parameters and a SQL payload below20kB. No schema/auth/scope/dependent
parent/order/rowcap/cache change; source outside checkReplica is byte-exact.

TDD: actual D1 statement-count RED20!=1,then GREEN. A second RED exposed
error-precedence loss from checking all missing markers too early; traversing
every fixed ordinal retains the original earlier-table stale/error precedence
and still rejects missing/duplicate/wrong ordinals. Five new tests cover all20
tables across16 original-query-oracle cases each,including duplicate-version
ties in both insertion orders,receiving older/equal/newer,missing/invalid/null/
stale/future and exact clock boundaries,malformed result/ordinal failure,and
real D1 operational10000 accepted/10001 rejected. Existing500-room HTTP/GAS
parity,foreign/legacy/delegated privacy,nonce/authority,packed values and shadow
cases retained. Affected38/38 PASS,103.317s,zero fail/cancel/skip,Node22.23.3;
validate72backend/40endpoint/cache/comparison178 and diff check PASS.

Comparison identity regenerated by the existing generator:
read-ae3a60f8ba10927297da320919eb4bc0138b912bca7fd636081a765dfb41cbed.
Among178 normalized sources only read-dataset changed; release asset,blank
endpoint and every formal flag exactly preserved. No old capacity gate or
new timed diagnostic rerun here. Prior CI38779107637 and the separate authorized
700-sample diagnostic failures remain evidence; this increment does not claim
to repair the old fixture timer,which omits checkReplica entirely.

Independent fresh review found no P1/P2 or actionable minor; all505 frozen
non-document pins match and its independent actual-D13/3 checks passed.
Full-suite/Worker integration and the coordinated changed-source diagnostic
remain pending. Source/tests are saved for review in this isolated C6 branch;
no deployment,real Apps Script test,Google/formal/credential/counter operation.
C3/root/private caller and control pins untouched. Rollback this undeployed unclaimed increment to
C6 HEAD1fba7d259fe862a5983a8fed5b0b59e5858fb732 while retaining every original
claim/history/UNKNOWN and matching cleanup; no observation T0 or flags changed.

## C6 final retained authorized-path diagnostic — 2026-10-16

Recommended GPT-6.1 Sol/high. One changed-source synthetic diagnostic at
reviewed d88086d used the actual HTTP handler,primary-D1 scoped loader and
signed GAS authority modules. Seven complete original-GAS JSON parity checks
passed,followed by all700 original-order full-body samples;all707 responses
were200 with no response/transport/security error. The seven parity response
hashes also matched the previous diagnostic. No retry or sample exclusion.

| Entry | Prior diagnostic p95 ms | Changed-source p95 ms |
| --- | ---: | ---: |
| home | 26.391 | 29.061 |
| actions | 45.197 | 64.483 |
| revenue | 51.127 | 52.438 |
| tenants | 41.692 | 66.879 |
| rooms | 30.426 | 67.129 |
| arrears | 63.576 | 116.307 |
| properties | 32.558 | 86.907 |

Six of seven changed-source entries miss the unchanged p95<50ms boundary.
All maxima/outliers and raw results remain retained. These are two independent
local synthetic runs;no latency improvement or causal diagnosis is inferred.
The earlier failed fixture CI38779107637 and its700 samples remain unchanged;
its full-table fixture omits the authenticated authority/freshness loader and
was not rerun or substituted. Real production/device latency remains unaccepted.

Each of707 requests performed one first-primary D1 session and one signed
synthetic GAS authority request. All707 nonces were unique and all707 signed
responses,nonce-cache entries and authority logs were verified. Actual digest/
route/fingerprint/signature/dirty/freshness checks remained active;the original
handler and provider-cache lifecycle were retained without a new cache.
Per-request statements fell158 to139:8 single calls and6 batches with sizes
3,4,10,80,29,5. Total SDK calls remain14;there were never20 network round trips.

Runner and independent post-exit verifier both exited0. Miniflare disposed;
the separate verifier found no remaining owned process. Raw pre-exit state,
all7 parity+700 timed records,exit codes and independent cleanup receipt are
retained privately without rewriting the earlier cleanup warning/receipt.
No source/config/flags,commit/push,real credential or formal IO changed during
the diagnostic;it did not start observation T0 or establish acceptance.

Latest separate C3 trial outcome is27/160:stopped,repair in-flight/UNKNOWN,
with original claim/pins/day/deadline and P/N UNKNOWN retained. A new durable
owner veto and both retained-holder drain acknowledgements are recorded;no
verifiable caller/page tool state was returned. No second bind/repair,ordinary
continuation,publisher bind/refresh,trial RPC or remote rollback completion is
claimed. This final stop supersedes earlier25/26 snapshots only;no refund,
new claim,deadline change or no-op rollback proof is permitted. All formal
flags stay off and T0 NOT_STARTED.

The reviewed freshness source changes statement count only;full/Worker
integration and exact-current-head CI remain separate checks. No deployment
or cutover is claimed. Preserve all private evidence and original STOP history.

## C6 final C3 stopped-trial stack integration — 2026-10-16

Recommended GPT-6.1 Sol/high. After saving the complete retained diagnostic
record in3b09e8f,normal-merged final C5/C3 ancestry into this isolated C6 branch.
C3 6bb2a62's nine new source/test/fixture paths,including three frozen original
controller files,are byte-exact. The four reviewed d88086d freshness/test/
comparison/frontend pins remain unchanged;all other runtime paths are preserved.
All original documentation sections survive both append-only conflicts.

Fresh validate72backend/40endpoint/cache/comparison178 and diff checks PASS.
Comparison remains read-ae3a60f8ba10927297da320919eb4bc0138b912bca7fd636081a765dfb41cbed;
release asset,blank endpoint and all formal flags are unchanged. No large
local suite or benchmark rerun. C3 full2003/2003 and CI38784461317 remain
upstream evidence;freshness affected38/38 and independent3/3 remain attributable
prior candidate checks. Exact-current-head CI/footers await separate readback.

Retained authorized-path diagnostic:7 exact full-body parity checks plus700
HTTP200/zero-error timed responses,707 per-request signed-authority/unique-nonce/
primary-D1 checks,and139 statements with14 SDK calls. Six p95 values still
exceed50ms;all distributions/outliers and both cleanup histories are retained.
No performance improvement,causal fix or production acceptance is claimed.

The real trial remains27/160 STOPPED,repair in-flight/UNKNOWN,with no verifiable
caller/page tool state,new owner veto and both retained holders' drain ACKs.
No second repair/bind,ordinary continuation,refresh or RPC;original claim,
pins,day/deadline,UNKNOWN and matching cleanup are retained. No Google/counter/
realm/credential/formal-data operation or T0 in this integration. Keep formal
flags off. Rollback this undeployed final merge to3b09e8f without altering the
original stopped trial or replaying spent purposes;no remote rollback inferred.


## C6 Workspace scope indexes — 2026-10-16 (local candidate)

Recommended GPT-6.1 Sol/high for query-plan and privacy parity review. A private
single-observation profile at HEAD901172ca showed loadDataset18–21ms and
21937 D1 rows read per signed HTTP request,including14382 in one80-statement
batch. Decode1–3ms,calculation2–10ms and serialization0–2ms overlap with other
phases;these coarse instrumented observations are not p95 or CPU attribution.
Seven original-GAS parity checks and seven observations returned HTTP200 with
14 signed-authority/unique-nonce/primary-D1 checks. The initial64-shape observer
failure and the second runner's stale707-footer assertion(14!=707,exit1) remain
retained. Independent post-exit verification confirms complete14-record data,
source guard,disposal and no remaining owned process;it does not turn either
failed runner into acceptance. Query-plan capture is partial64shapes/20overflow.

Additive migration0005 adds19 nonunique Workspace expression indexes only.
The expression exactly matches the existing loader's
`upper(trim(COALESCE(json_extract("workspace_id",'$'),'')))`.
No runtime/auth/authority/query/binding/order/row-cap/cache or schema-field
change;0001–0004 bytes remain intact. No index on global users,sync_runs,
identity/parent fields or sort order. Existing sync tests now apply0005 too.

One actual-D1 test seeds the same500-owned-room/foreign-decoy database once,
compares the complete raw access/dataset JSON before/after applying0005,and
records unchanged138 statements/SQL/params/order,7singles+6batches and one
first-primary session. rows_read21886→5742(-73.764%);829427-byte JSON is exact,
SHA25686dd1a969d2c9a2349e7062cb93cb65e8289e796f6c8adf91a79ae991bd3648b.
This inspect path omits freshness,so138/13 differs intentionally from signed
HTTP139/14. Mixed/padded Workspace values,SQLNULL,JSONnull,empty/spaces and
foreign rows retain literal expected classifications. All19 indexes are
nonunique;38 direct/blank actual plans SEARCH through the matching index.

Focused actual-D1 RED21886==21886 becomes GREEN1/1. Affected49/49 pass includes
scoped500-room HTTP/GAS parity,foreign/legacy/delegated/role/revocation and
signed500-row sync insert/update/delete/type cases with new indexes. Parent
migration-preserves-prior-bytes/comparison guards2/2 pass. Fresh sanitized
Node22 Worker dry-run,validate72backend/40endpoint/cache/comparison179 and diff
checks pass. Comparison generator produces
read-935c6be0704ccc5b09e71143e016ceeee76b78f29f608456c25da77dd554bbdf;
only0005 is added among normalized comparison sources. Asset version,blank
endpoint and all formal flags remain unchanged. Fresh independent review found no actionable findings and independently
verified all499 frozen non-document pins,original migration bytes,full raw JSON,
SQL/parameters/order and38 plans. Exact-head CI remains pending;no huge local suite,
700-request diagnostic or unchanged capacity benchmark rerun for this increment.

Scan reduction is proven only on this local actual-D1 synthetic fixture.
Previous actual-handler six-of-seven p95 failures and901172ca CI38785667919
rental2083PASS/Worker40of41FAIL(properties53.742ms>50ms) remain evidence;
no latency cure or production acceptance is claimed. T0 NOT_STARTED,all flags
off. Actual C3 remains27/160 STOPPED with original claim/pins/day/deadline,
P/N UNKNOWN and matching cleanup. No Google/counter/realm/credential/formal-data
operation,second repair/rebind,refund,replay,deadline extension or deployment.

Risk: index storage and write-maintenance overhead;actual sync regression
passes but remote scale/storage has not been measured. Eventual in-plan release
still requires all actual gates,current target identity,migration inventory,
backup/readback and rollback preparation under the owner's batch authorization.
Undeployed increment rollback is C6 HEAD901172ca6b0b5b52425aec665b5a580e4d933cf3,
retaining evidence. For a future deployed rollback,use a separately reviewed
additive migration dropping only the19 `idx_read_scope_<table>` indexes named
in0005;preserve data and prior migrations. No remote rollback has occurred.


## C6 arrears binding lookup — 2026-10-16 (local candidate)

Recommended GPT-6.1 Sol/high. The arrears entry omitted the existing request-local
LINE-binding lookup and scanned every bill for every outstanding bill. Only this
entry now constructs the existing lookup once and passes its sixth resolver
argument;all other canonical functions remain byte-exact. Regenerated calculator
and manifests preserve each of248 declarations against the canonical source.
No new helper/cache,authorization,scope,SQL,row cap,sort or response-field change.

Actual arrears-entry TDD on500bills/252outstanding:original127000 source reads
fails the linear bound;candidate2000 passes with full JSON identical to the
five-argument original scan oracle. The candidate forced-scan oracle includes
new index initialization and reads128000;it is not mislabeled the old baseline.
Priority,duplicate-source-order,case,empty/fresh request and getter/decorated-Date/
Proxy-Date/identity-coercion mutations retain original behavior and side effects.
Initial wrong empty-result field name and two npm setup errors remain retained;
corrected RED26of27 preceded the sole production author pass,then GREEN27of27.

Affected42/42 and four actual Apps Script functions in local synthetic VM pass:
home,arrears,tenants and summary projection. Independent fresh review found no
actionable findings,verified all620frozen pins and248generated declarations.
One complete npm test with actual Core643c1b3 and disposable ownedPG16.14 passes
2103/2103,zero fail/cancel/skip,68.786s. Snapshot at baseHEADc062891b plus these
six uncommitted paths:cf62ee611f8be78baa65c4d5cd28f2a97601f4bc8ec2686b91d14638355e64da.
Later evidence-document appends are outside that exact tested snapshot.
Fixture DB/roles cleanup and stopped PG/listener verified;no formal DB used.
Fresh sanitized Worker dry-run passes. Parent actual-D1 HTTP/scoped regression10/10 passes,15.032s,including seven
500-room canonical JSON results,primary-D1 scope and delegated/legacy privacy.
Exact-new-head CI remains pending;no local capacity/700 rerun.

Comparison read-1a2b13ba65aa51c55ab651fe8f2a3d58f4a63927572066bdb1aee8193e878ed0
covers179sources;onlycanonical dashboard,generatedcalculator and source manifest
change among normalized inputs. Release asset,blank endpoint and sixoff flags
are preserved. This proves deterministic scan reduction,not a p95 or real
latency cure. Prior c062891b CI38788433199 rental2083PASS/Worker41of42FAIL
(arrears50.769/properties51.161ms) and actual-handler6of7p95failures remain.

No Google/browser/credential/counter/claim/epoch/realm or formal-data change,
merge/deployment/cutover. C3remains27/160STOP/UNKNOWN;the new private接續方案
is not approved by this code change. T0 NOT_STARTED. Rollback this undeployed
increment to c062891b01b25c23356611b044bb71fccd58066f,retaining all prior histories.
Before any later approved release,create a new GAS immutable version at the
original URL,retain prior serving version,deploy matchingWorker/Pages only after
all actual gates,read back bytes/bindings/flags and preserve per-surface rollback.

## 2026-10-16 — Bounded continuation cost compiler (local only)

Recommended model/speed: GPT-6.1 Sol / high. The owner-approved continuation
decision is selected explicitly, separately from the stopped original driver.
A pure offline compiler retains the historical27 and cumulative160 cap,
fixed96, P4, same-token G4, N24 (research8/control16), T3 and unused2. Every
listed low-level operation is one unit; missing/unknown costs deny credential/RPC
map eligibility. This is only a mapping condition: executionAuthorized and
externalPrerequisitesVerified remain false. The non-refundable360000ms upper
bound is not native runtime, available quota, or later daily-runtime acceptance.

One independent review found two P2 issues: accessor-based changing input could
produce inconsistent arithmetic, and synthetic-tabs used the wrong actor. Both
were reproduced RED and corrected in one pass: a bounded own-data snapshot
rejects accessors/proxies, and B:fixture-native retains the existing caller.
There were no P1 or separate minor findings. Focused new/existing budget tests
70/70; full root npm test2041/2041, zero fail/cancel/skip,67.323s using Node22,
pinned actual Core and a fresh owned PostgreSQL16.14 fixture. Its teardown and
closed listener were verified. Source snapshot (587 files before documentation
append):2cc04e9080aa35e3f920f7d0c2b1505f619c8680b1b76603ac7a40cec73c9fb6.
Validate72 backend/40 endpoint references, static cache and diff checks pass.
No Apps Script function, route, schema, Worker runtime or frontend changed;
there is no affected Apps Script test function for this offline-only increment.
Exact-head CI is pending until push.

The linked canonical journal/control, global cleanup/rate admission, pinned
independent recovery, one-RPC driver and actual UI map remain unfinished.
Readonly local counter verification still shows27/160, STOP, repair in-flight
UNKNOWN. No new segment/W0, Google IO, credentials, remote mutation or fee was
introduced. Original claim/deadline/copies and all unknown outcomes are retained.
Formal flags off/endpoint blank; accelerated rollout T0 not started. Actual C1
daily-runtime, C3 authority/privacy/freshness, performance, observation and device
gates remain unaccepted. Local compiler tests do not change those gates.

Deployment: none for this increment; retain the separate C3 draft PR. Rollback:
revert the offline compiler/test addition; it cannot revive the original trial
or erase future accounting. Any eventual continuation must first pass the
remaining control/recovery/wiring prerequisites under the approved decision.


## 2026-10-16 — Linked continuation control and compatibility driver (local only)

Recommended model/speed: GPT-6.1 Sol / high. V2 read-performance stability work.
The new controller adds exactly one linked segment under the original canonical
lock and epoch. The original27, raw history, STOP/UNKNOWN, deadline and copied
runtimes are retained. New ordinary events and original C2/I17 share cumulative
160 and the rolling10/minute guard; two units stay unused. Original restoration
and cleanup aliases are consumed once globally by the unchanged pinned ledger.
W0 is durable before IO, at most six hours within one Taipei day, without scope
reopening after finish, EOF or owner loss.

A persistent Node holder retains the inherited original fd through entered IO
and child termination. New owner stop vetoes admission immediately, publishes a
durable marker and drains the captured actual holder. Independent recovery uses
a separate fixed source graph and the retained owner handle; after actual drain
and a full60s cooldown it exposes only original C2/I17 under the original lock.
New journal corruption cannot initialize or restore ordinary authority. Recovery
still requires the original valid claim/checkpoint, source copy and credentials;
local callback completion is not remote rollback acceptance.

The separately selected driver consumes the existing scope, checks its original
epoch/binding, retains exact source/privacy15 and same-token identity2 before
and after, and dispatches only one signed wrapper compatibility RPC. Its durable
360000ms charge is never refunded and never called measured native runtime or
quota acceptance. A returned callback or UNKNOWN response cannot finish pending
postchecks. Source/owner faults stop admission. Bounded unknown-terminal reads
cannot retry the RPC or turn UNKNOWN into successful compatibility. Typed Google
ExecutionResponse envelopes retain the unique compatible:true result check.

Pre-review focused composition:105/105 PASS, zero fail/cancel/skip. The coherent
review and full-root results are recorded below. No Apps Script source,
route, schema, Worker/frontend runtime or deployment changed, so no Apps Script
test function is affected by this local control increment.

Actual launcher, source/recovery admission pins and Google UI/adapter cost map
remain unfinished. The offline policy or synthetic callbacks do not prove these
prerequisites. Actual counter remains27/160/stopped/repair in-flight; no new W0,
Google management IO, credentials, resources, fee or formal mutation occurred.
Formal flags remain off, endpoint blank and rollout T0 not started. Real C1/C3,
performance, accelerated observation and device acceptance gates remain open.

Deployment: none; retain the existing separate C3 draft. Software rollback is a
revert of these new local modules/tests. Eventual trial rollback must retain all
charges/UNKNOWN and use the pinned original restoration/revocation callbacks;
never delete markers, reset the original counter or create another segment.

Independent review: one P2, no other actionable P1/P2. A torn new STOP marker
could retain a fully drained descriptor and deadlock independent recovery. Two
real-process regressions reproduced it before correction. The single-use owner
now resolves/releases only after its actual entered IO and child drain; its
receipt distinguishes ordinaryScopeClosed from stopAcknowledged. Ambiguous STOP
bytes remain unchanged and negative, without manufacturing a successful ACK.
Recovery requires that captured actual scope closure, the full60s cooldown and
the original valid source/claim/checkpoint/lock; no marker grants C/I authority.
The durable single-use epoch claim still denies every ordinary scope reopening.

Post-correction coherent focused tests:107/107 PASS, zero fail/cancel/skip,21.412s. Full-root regression and validate remain pending.

Full-root npm test:2148/2148 PASS, zero failure/cancellation/skip,78.869s,
using Node22, actual pinned Core643c1b3 and a fresh owned PostgreSQL16.14 fixture.
Teardown/closed listener and absence of fixture databases/roles were verified.
Validate72backend/40endpoint/static-cache and staged diff checks PASS. Source
snapshot596files before this final evidence append:
07969d58846651b847b756f297db647913204ea88989f9d80eaab7a7e88b676d.
The unchanged entry's compatibility path was separately inspected locally:
18 selected top-level initializers have no calls; the wrapper delegates once,
and compatibility returns after caller/MAC validation without nested scripts.run,
Web App dispatch, trigger creation or external background work. Actual fixed
publication and launcher source/recovery guard wiring remain unverified.
### Bounded continuation actual preflight (2026-10-16)

- Private launcher16/16 local tests PASS, zero failures/cancellations/skips;
  source-before-import and browser-realm regressions reproduced before fixes.
- Actual single caller binding: UNKNOWN/STOP; cumulative28/160, no RPC or
  resource/configuration mutation. Original27 and both old UNKNOWN events retained.
- Captured owner drained/closed; no rebind/new segment or compatibility acceptance.
- Recovery checkpoint inspection pending terminal evidence; real upstream gates
  remain open and all formal read-path switches stay off.

## C4 bounded-control integration — 2026-10-16

Integrated C3 control/compiler/driver/recovery increment and its terminal trial
evidence through the existing ordered Draft stack. Eleven inherited source/test
paths match C3 byte-for-byte; no C4 runtime behavior changed. Documentation
conflicts were append-only work-order records and both sides were preserved.

Full npm test on merge 28a488bd4f23ae94aacb32a3db633e304ab19d84:
2161/2161 PASS, zero failure/cancellation/skip,78.192s, Node22,
pinned actual Core643c1b3 and a fresh owned PostgreSQL16.14 fixture. Each suite's
database/role cleanup was verified; final cluster stopped and listener closed.
Source catalog SHA256 f8fcb12ab1e42c6d262fe76de19457fcd13ab15e75f70b6d5b1d4f073d39a778.
Validate72backend/40endpoint/static-cache and diff checks PASS. C6 additionally
checks the179-source comparison identity. No unchanged capacity benchmark rerun;
the prior C6 properties51.208ms p95 failure remains an unmet gate.

Actual compatibility method ended at28/160 after the sole caller binding
UNKNOWN. Ordinary owner is drained/closed; original27 remains byte-identical.
No RPC or new credential/resource/configuration mutation occurred. The copied
independent recovery subsequently verified the original stopped checkpoint after
its full60s cooldown, with cActions/iActions empty and zero Google IO. This is
local recovery availability, not remote rollback acceptance. No rebind, repair,
refund or second segment is authorized. Original STOP/history/copies retained.

No main merge, deployment or cutover. Formal configuration remains default-off,
endpoint blank and T0 not started. Actual C1/C3, performance, accelerated
observation and device gates remain open. Rollback this undeployed integration
to 22d888706716f504295b66cfcf0d25fdc6a11fe0 while retaining all trial evidence.

## C5 bounded-control integration — 2026-10-16

Integrated C3 control/compiler/driver/recovery increment and its terminal trial
evidence through the existing ordered Draft stack. Eleven inherited source/test
paths match C3 byte-for-byte; no C5 runtime behavior changed. Documentation
conflicts were append-only work-order records and both sides were preserved.

Full npm test on merge 13050d54d9fa2246c67af8636b8ae97ecc5222a7:
2166/2166 PASS, zero failure/cancellation/skip,83.122s, Node22,
pinned actual Core643c1b3 and a fresh owned PostgreSQL16.14 fixture. Each suite's
database/role cleanup was verified; final cluster stopped and listener closed.
Source catalog SHA256 f8fcb12ab1e42c6d262fe76de19457fcd13ab15e75f70b6d5b1d4f073d39a778.
Validate72backend/40endpoint/static-cache and diff checks PASS. C6 additionally
checks the179-source comparison identity. No unchanged capacity benchmark rerun;
the prior C6 properties51.208ms p95 failure remains an unmet gate.

Actual compatibility method ended at28/160 after the sole caller binding
UNKNOWN. Ordinary owner is drained/closed; original27 remains byte-identical.
No RPC or new credential/resource/configuration mutation occurred. The copied
independent recovery subsequently verified the original stopped checkpoint after
its full60s cooldown, with cActions/iActions empty and zero Google IO. This is
local recovery availability, not remote rollback acceptance. No rebind, repair,
refund or second segment is authorized. Original STOP/history/copies retained.

No main merge, deployment or cutover. Formal configuration remains default-off,
endpoint blank and T0 not started. Actual C1/C3, performance, accelerated
observation and device gates remain open. Rollback this undeployed integration
to a2d6114b616132597d7c8d286e7465520c40df59 while retaining all trial evidence.

## C6 bounded-control integration — 2026-10-16

Integrated C3 control/compiler/driver/recovery increment and its terminal trial
evidence through the existing ordered Draft stack. Eleven inherited source/test
paths match C3 byte-for-byte; no C6 runtime behavior changed. Documentation
conflicts were append-only work-order records and both sides were preserved.

Full npm test on merge 3a901b6c8aa62839146ba61c6e9ed5aacbebce60:
2248/2248 PASS, zero failure/cancellation/skip,91.892s, Node22,
pinned actual Core643c1b3 and a fresh owned PostgreSQL16.14 fixture. Each suite's
database/role cleanup was verified; final cluster stopped and listener closed.
Source catalog SHA256 f8fcb12ab1e42c6d262fe76de19457fcd13ab15e75f70b6d5b1d4f073d39a778.
Validate72backend/40endpoint/static-cache and diff checks PASS. C6 additionally
checks the179-source comparison identity. No unchanged capacity benchmark rerun;
the prior C6 properties51.208ms p95 failure remains an unmet gate.

Actual compatibility method ended at28/160 after the sole caller binding
UNKNOWN. Ordinary owner is drained/closed; original27 remains byte-identical.
No RPC or new credential/resource/configuration mutation occurred. The copied
independent recovery subsequently verified the original stopped checkpoint after
its full60s cooldown, with cActions/iActions empty and zero Google IO. This is
local recovery availability, not remote rollback acceptance. No rebind, repair,
refund or second segment is authorized. Original STOP/history/copies retained.

No main merge, deployment or cutover. Formal configuration remains default-off,
endpoint blank and T0 not started. Actual C1/C3, performance, accelerated
observation and device gates remain open. Rollback this undeployed integration
to 3b59165c0c1ef8fa4531b128f8f42faeb8f3e6f4 while retaining all trial evidence.


### 2026-10-16 tenant landlord-summary-only calculation

Baseline affected6/6; final Node22 affected7/7 PASS after observed extra billing
aggregation RED. Small/rich/500-room full and summary landlord fields retain
canonical counts/current timestamp and tenant unpaid sums/history;24 complete
frozenfbdef67 responses(2060399bytes/keyorder) plus21 projected Worker calculator
responses match exactly, including foreign/private parity. Generated source and
comparison179 updated; validate PASS. No capacity benchmark/fullDB/fullsuite/CI
rerun or latency improvement claim; independent review and acceptance pending.


### 2026-10-16 properties request-local summary fold

Node22 baseline affected15/15; regression RED12 redundant status reads, final16/16
PASS. Sum only completed per-property room/vacant/occupied/maintenance counters;
small/rich/500-room both archived modes retain27 frozen504e7ee complete responses
(2989899bytes/key order) and27 projected calculator responses exactly. Canonical/
generated manifests/comparison179 synchronized; validate/diff checks PASS. No
benchmark/fullDB/Worker/fullsuite/CI rerun or p95 improvement claim; previous exact
CI properties51.647ms failure remains an unmet gate pending independent review.


### 2026-10-16 per-room seasonal equipment-rate reuse

Node22 baseline45/45; real builder22-combination seasonal fallback/rounding/month
matrix PASS before change. Call-count regression RED2000 vs1000, final affected
47/47 PASS, with one real resolver invocation per room/season and source rows
unchanged. Frozen d2 complete27 + projected27 responses retain2989899 identical
bytes/key order, including archived modes. Canonical/generated/comparison179,
validate and diff checks PASS. Three existing Date/month-helper sites and all
financial fallback semantics unchanged. No new benchmark/fullDB/fullsuite/Worker/
CI run or p95 improvement claim; saved exact d2 log50.432ms failure remains open,
with provider metadata still in_progress/null in that evidence snapshot.


### 2026-10-16 primitive numeric property conversion

Node22 baseline47/47; new finite/denormal/exponent/signed-zero/nonfinite and other
type/custom coercion parity PASS before change. Actual500-room helper regression
RED5770 numeric String calls vs0, then final affected49/49 PASS. Numeric -0 becomes
+0; string '-0' keeps -0 and other type coercions/exceptions retain the original
branch. Frozen cce1282 complete27 + projected27 responses preserve2989899 bytes/key
order exactly. Only six canonical fast-path lines added, with all other source
bytes unchanged; generated/comparison179, validate/diff checks PASS. No performance
benchmark/fullDB/fullsuite/Worker/CI run or acceptance improvement claim.


### 2026-10-16 standalone C3 candidate

- Single generated script: fixed caller/project/MAC, compatibility only, no
  library or row/cache/lock/network IO; authority/extra arguments denied.
- Existing publication adapter: five charged steps, immutable readback and
  independent close/absence; mode change cannot reset same-epoch registration.
- New17 RED→GREEN; affected116/116; complete2165/2165, zero skip, owned
  PostgreSQL cleaned/stopped; two independent reviews without findings.
- Retain earlier2159/2161 realm-child timeout run and focused2/2 diagnosis;
  the original timeout cause is unresolved. Real Google function/RPC execution
  NOT_RUN, counters31/160 unchanged, complete actual IO mapping still pending.
- No production route/Schema/runtime/flags changed; no Cloudflare speed or
  cutover acceptance is inferred from these local results.


### 2026-10-16 standalone linked accounting

Original27 + stopped continuation1 + diagnosis3 remain immutable and cumulative.
New55 RED→GREEN cases cover history/approval pins, strict integers, same-lock
UNKNOWN accounting, union10/minute, one RPC, lifecycle and globally unique
originalC2/I17 cleanup. Affected151/151; independent review0 findings; full
2220/2220 with actual Core/ownedPG, zero skip and cleanup/stop verified.
No actual new claim/Google/credential/resource operation; actual31/160 unchanged.
Standalone resource recovery/driver wiring and complete actual UI map remain
pending, so these tests do not authorize execution or production acceptance.

### 2026-10-16 standalone driver/source/recovery

New128 RED→GREEN cases cover exact standalone pins/strict data, the same15+15
checks/identity/one charged RPC, actual immutable/editor source packet comparison,
unchanged original six versions, separate frozen cleanup adapters, existing
journal prerequisites, admission-time drift, and the standalone trigger target.
Independent review P2 hook/race findings reproduced, fixed and re-reviewed.
Complete Node22/actual Core/ownedPG npm test2348/2348 PASS, zero fail/cancel/skip,
107.244s; database/roles cleaned and PostgreSQL stopped. Validate/diff checks PASS.
No actual Google operation/new claim/debit; current31/160 unchanged. Frozen local
recovery copy is not remote rollback proof. Full native observers/actual IO map
and all Google/runtime/performance/rollout/device gates remain pending.

### 2026-10-16 standalone script access lifecycle

New96 cases cover separate fixed script Reader grant/ACL/cleanup, standalone16 F
observations per phase, C2/I17/J2 reservations, damaged ordinary evidence, nonce/
high-water/claim/registry validation, cross-handle shared recovery lane, executable
scope elements and collision-free cleanup IDs. Review findings reproduced then
fixed and independently re-reviewed. Full Node22/actual Core/ownedPG2444/2444
PASS, zero fail/cancel/skip,149.524s; database/roles cleaned and PostgreSQL stopped.
Validate/diff PASS. Synthetic maximum run158 preserves unused2; actual complete
UI/navigation upper bound is still unverified. No Google/account operation or
new claim/debit; actual31/160 unchanged, no remote/production acceptance.

### 2026-10-16 closed standalone preflight continuation candidate

Focused standalone/continuation457/457 pass before the final fixed executions
opening descriptor. Coverage includes immutable closed two-selection history,
import33/all rate timestamps/original W0, pin/semantic drift, partial claims,
duplicate import/arbitrary chains, actual retained-holder exclusion and drain,
safe API/post-return failure categories, complete-map reserves and fresh
same-token identities, one RPC, original C2/I17 uniqueness and successor J2.
The final discovery/opening pair uses existing navigation20 and fixed ordering;
its affected budget/plan and private inert preparation checks are recorded in
the execution record. Synthetic callbacks do not prove current native selection,
Google access, real execution, remote cleanup or rollout acceptance.


Round1 P2 coverage adds one-way owned-slot transfer, branded/single-use admission,
retired legacy J function refs, active legacy route exclusion and maximum158
plus unused2 protection. Original C2/I17/drain remain usable on the shared lane.
Updated private preparation requires the handoff and verifies sources before
moving its slot; raw full owners/serialized capsules cannot create a claim.

### 2026-10-16 submitted OAuth consent accounting

Eleven new regression cases cover callback-before-admission denial; actual
submission debit ordering; real loopback303/pending200 while submit owns the
cap; separate token/userinfo ownership after settlement; duplicate submissions
and callbacks; cancel/failure with buffered input; skipped/cloned/repeated/late
submission callbacks; and preclaim denial while waiting for admission.
The unchanged privacy/PKCE/scope/identity/expiry/revocation cases now explicitly
submit first. Phase and cross-realm fixtures preserve three ordinary charges.
Node22.23.3 affected phase/preparation/control/realm122 cases passed; final OAuth
67/67 passed, zero fail/cancel/skip. Initial combined188/189 contained one new
test incorrectly using assert.rejects for an expected synchronous late-callback
throw; its assertion was corrected and final OAuth rerun passed. No runtime
change was needed for that test correction. Validate and diff checks pass.
Real Google form grounding/consent, RPC, cleanup and complete160-fit remain
unverified; prior stopped scope and frozen used runtime were not reopened.

### 2026-10-16 named staged resume accounting candidate

Node22 focused staged cases cover immutable42/full-history import and singleton
claims, no pre-IO W0, durable first UNKNOWN, same-day deadline/cutoff and no slide,
strict12/2/2 N partitions including after navigation, true batch-header aliases,
current-stage callback guard and exact future recovery caps, unknown/changed maps,
shared historical rate/single IO, no UNKNOWN replay, complete-map-only RPC and
all32 F. The full synthetic route debits once for360s, uses global C2/I17/J2 and
ends at158 with unused2. Damaged ordinary journal still permits independent J2
after actual captured drain/cooldown. Raw cap driver testing binds the immutable
null identity to the real inspected active deadline. Existing affected
continuation/standalone plan/budget/control/driver/recovery and header tests pass
349/349; these are synthetic/local checks, not actual form or Google readiness.


## 2026-10-18 selected-page connection successor (local)

| Scope | Evidence | Boundary |
| --- | --- | --- |
|46 import,47 first debit, inherited numeric window, immutable UNKNOWN history/selection, singleton denial, drift/expiry denial | readonly recovery regressions79/79 PASS | No actual claim or page read |
|N12 reservation, mandatory observations, unknown-map denial,32 release checks/360s RPC, independent damaged-journal J2 and first-I stop lane | Same79-case suite PASS; independent source review0P1/P2 | Full actual map, private launcher and exact-head CI remain separate |
|Source validation |72 backend/40 endpoint/static cache PASS | No release or formal-data change; approved actual window expired |

Full unit2605/2605 PASS, zero failures/cancellations/skips. Exact-head CI pending; no remote trial or formal acceptance.

## 2026-10-18 selected-page window-only increment

Regressions cover null clocks before first47, six-hour/Taipei-midnight cap,
unchanged46/history/selection/claim, exact approval and chronology, drift and
backward-time rejection, full driver checks, post-midnight independent J2 with
damaged ordinary journal, and insufficient cleanup time before claim.
Independent source review found no actionable P1/P2. Node24.19 supported-runtime rerun93/93 focused and2619/2619 full unit PASS,
zero fail/cancel/skip; validate72 backend/40 endpoints/static cache PASS.
Exact-head CI remains separate and pending before actual Google acceptance.

## User-tab repair local acceptance

Node24.19 readonly recovery112/112 and full unit2638/2638 PASS, zero failures,
cancellations or skips. Validate72 backend/40 endpoint/static cache and diff
checks PASS. Tests cover stopped47 import, three separate48/49/50 debits, no
pre-IO clock, first-prefix order/shape/replay, changed approval/history denial,
full32-check driver/one360-second RPC and post-expiry independent J2 despite
ordinary journal corruption. The original-I lane retains its own STOP target.
Independent public source review0 actionable P1/P2 and three separate focused
synthetic review cases PASS. Exact-head CI and actual user-tab mapping remain
separate gates; no new native IO has occurred.

## 2026-10-19 local wiring successor candidate

GPT-6.1 Sol/high. The explicitly approved successor imports the verified50
checkpoint, keeps every old UNKNOWN/claim/STOP and160 total, and starts its
new bounded same-Taipei-day window at first durable debit. Native allowance
is8 (publisher4/caller2/thin2);50+98+N8+C2+unused2 remains160. It never
replays the imported preparation prefix or reopens an old claim.

Three permanent singleton slots cover the new owner plus at most two local
predebit repairs. This implementation accepts only the actually verified50
checkpoint: a subsequent debit or remote step cannot be labelled local and
carried forward. Additional later checkpoints need separately tested proof
adapters before they could qualify under the approved scope; none is inferred.
An immutable successful checkpoint, exact stopped canonical registry/claim,
complete returned-IO trace and actual terminal drain are all required.

Sixteen targeted regressions pass, including real stop, original-C/I and
independent J2 after damaged ordinary journal/expiry; full suite/CI and
independent review follow. A synthetic chain fixture initially reused an old
binding and was correctly rejected; unique fixture bindings repaired that test.
Private stable ESM dispatch fixes a reproduced cross-cell callback binding
error; its verification is not Google authority or trial acceptance.
No new actual51, credential, grant, RPC, Production data/config/deployment, flag
or T0 is claimed. Full actual map, privacy/freshness/runtime/performance/device
and observation gates remain. Undeployed rollback returns to70722bd; all used
source copies and failed attempts remain immutable.

Final local verification: full2654/2654 PASS on supported Node24.19, zero
fail/cancel/skip; validate72 backend/40 endpoints/static cache and diff PASS.
Independent review identified an original C/I counter-tail loophole; RED
reproduced it and the ordinary constructor now rejects changed original spent
before child/claim. Both C and I negative regressions pass; independent review
reports no remaining P1/P2. The exact-head CI and private launcher remain
separate prerequisites; no actual new operation or launch is implied.

## Synthetic authority replacement accounting (2026-10-19)

`tests/read-authority-simple.test.mjs` covers separate main/browser ceilings,
protected recovery, predebit window and UNKNOWN persistence, shared rate and
single IO, bounded readonly retries, stage/native GCP mapping, original C/I,
real-owner drain, damaged-mirror recovery, source/history drift, full driver
pre/post checks, nonrefundable RPC charge, incomplete/unknown transport and
bounded terminal reads. Review regressions cover cleanup replay, falsey Promise
rejections, inaccessible C2 and dangling STOP markers. No live Google or
Production acceptance is implied; actual adapter closure and real cost mapping
remain prerequisites. See READ-SIMPLE-TRIAL-ACCOUNTING.md.


### 2026-10-19 C4 current-C3 composition

Routing/boundary/page17/17 and simple/staged controls45/45 PASS (Node24);
validate72backend/40endpoints/static cache and diff PASS. Inherited40 source/test
paths exact C3 source1624fd4; C4 runtime unchanged. Full composed regression is
recorded at C6 separately. Synthetic ordinary scope expired/stopped65/232; no
RPC/configuration/Production change and no trial/rollout acceptance.


### 2026-10-19 C5 current-C4/C3 composition

Routing/page/shadow18/18 (Node24), validate72backend/40endpoints/static cache
and diff PASS;40 inherited source/test paths exact upstream75a1011. C5 runtime
unchanged; full composed regression follows at C6. No new cloud trial, release
or observation acceptance; prior synthetic ordinary scope stopped65/232.


### 2026-10-19 C6 composed-stack verification

Current C5 source9138edb/C4 source75a1011/C3 source1624fd4 compose with C6:
Node24 unit2796/2796 and Worker43/43, zero fail/cancel/skip; Worker deployment
dry-run, validate72backend/40endpoints/static cache/comparison179 and diff PASS.
Independent integration review0P1/P2 verifies40 inherited paths and both conflict
histories, without claiming the later final counts or exact-head CI. New-head CI
is separate; no new external Core/PostgreSQL acceptance. Synthetic ordinary scope
expired/stopped65/232, no RPC/configuration/Production change; all live gates open.


### 2026-10-19 Accelerated-plan source alignment

Own four plan documents reviewed0P1/P2; inherited runtime matches C6 source
4a0e90b. Initial comparison-import failure due to absent local acorn is retained;
lockfile npm ci (ignore-scripts,37 packages) changes no dependency source. Fresh
validate72backend/40endpoints/static cache/comparison179 and diff PASS. C6 inherited
unit2796/2796 and Worker43/43 are attributable to that source, not a repeated run
here. Exact-head CI and every real acceptance remain separate; trial65 expired
STOP/no RPC, no reopen/deployment/flag/T0.

### 2026-10-19 one-time readonly-trial continuation controls

Synthetic real-ledger tests cover cumulative65 import (main53/browser12),
byte-identical predecessor events and artifacts, four remaining preparation
operations/zero restored retries, approval/policy/actor/path/history drift,
no duplicate successor, first-debit six-hour/midnight cap, drain ownership and
original C2 recovery after successor-mirror corruption. Focused initial13 cases
reported8 PASS/5 FAIL before support; the resulting15 boundary cases PASS,
zero fail/cancel/skip. Full-source unit/validate/review/CI are separate evidence;
no actual new claim/window, Google/browser/API request or Production change.


### 2026-10-19 C4 successor-control composition

Routing and simple/continuation focused56/56 PASS, zero fail/cancel/skip on Node24.
Validate72backend/40endpoints/static-cache and diff PASS. Seven inherited changed
paths from C3f2ff40a are integrated; routing runtime is unchanged. Current actual
trial66/232 is stopped/pendingnull after an unused local-stage admission error,
with no RPC, mutation, new observation T0 or live acceptance.


<!-- Historical C3 source records restored verbatim from1624fd4; these retain their original observation dates. -->

### 2026-10-15 Approved single-wrapper budget core

Supplemental owner decision replaces the old two-entry/eight-window cost model.
The immutable presented decision hash selects the approved one-entry/four-window
allocation without granting execution authority. Offline compiler plus durable
ledger/rollback tests122/122 PASS: exact160 full allocation, unique fixed aliases,
G4/2/1/1 per-window caps, P2 per actor, T3 pending-only settlement, C2 included inC9,
I17 independent, failed IO UNKNOWN/no refund, immutable original history/binding,
no bulk unlabeled debit, qualified/second RPC denied in supplemental mode, copied
cleanup retains the original policy and counter. Historical RED ledger70 had
48pass/22fail before implementation; final affected suite122pass/0fail.

This is local cost/control evidence only. Legacy records keep their existing
format; new strict policy is opt-in until mandatory orchestrator/adapter/native
wiring is complete and reviewed. No live trial or credential operation follows
from these tests. Actual25/160 remains unchanged. Full Node22/actual Core/owned PostgreSQL regression1765/1765 PASS,57.460s; cluster cleanup/listener stop verified.


### 2026-10-15 Fixed preparation purpose labels and one live file readback

Adapter/restricted-realm/copied-recovery231/231 PASS; RED57=48pass/9fail retained.
Strict real-child synthetic realm exercises all six preparation adapters with
unique approved aliases, original C2/I17, same lock and zero real Google calls.
Actual import receipt reuse tests: once only, exact four-field binding, frozen
object identity, JSON/copy rejection, time reversal and60s expiry. Failed/stale
reuse cannot refund or duplicate a strict alias. Existing ACL/file/permission/
UNKNOWN/cleanup tests remain. Independent incremental review no actionable
findings. Full Node22/actual Core/owned PostgreSQL1774/1774 PASS,62.790s,zero fail/cancel/skip; cleanup/listener stop verified. Validate72 backend/40 endpoints/static cache/diff PASS; actual25/160 untouched and
mandatory runtime/native integration still unaccepted.


### 2026-10-15 Mandatory single-wrapper runtime/observer wiring

Related185/185 PASS after one review P2 fix. Focused RED8=1pass/7fail retained;
intermediate129=128pass/1 obsolete two-entry expectation retained and corrected
for the actual four recovery checks. Require bound decision before observers;
legacy/missing/foreign policy cannot admit a new trial. Exact15 release aliases
each phase; missing/duplicate/foreign/unlabeled callbacks and incomplete native
identity/quota observations fail before RPC. Fifth page/wrong actor/qualified
phases reject before IO. One wrapper only, UNKNOWN/no retry, independent C2/I17,
stop/drain/escaped-cap/origin/recovery regressions remain. Four actual fake CUA
producer→capture→strict-driver reads prove phase/actor charge and lock ownership;
raw native analysis retains complete=false/quotaAccepted=false. Restricted VM
six real adapters use strict preparation, one wrapper and all17 cleanup actions.
Review P2 await-mutation test RED→GREEN fixes fixed actor/phase/page snapshots.
Full Node22/actual Core/owned PostgreSQL1790/1790 PASS,61.163s,zero fail/cancel/skip; cleanup/listener stop verified. Validate72 backend/40 endpoints/static cache/diff PASS; actual25/160 untouched, no live native or
Google acceptance.

### 2026-10-15 Fixed seven-source release transport

Seven approved F aliases now have fixed Apps Script GET adapters: original
project/editor/versions/deployments, pinned library7/thin1 content and thin
deployments. One phase-bound alias debit owns each response through body read
or cancellation. Exact cached publisher scopes, request/version pinning,
single-flight, post-admission expiry and immutable token/control snapshots apply.
Reject pagination, malformed/foreign/oversized/redirected response and retry;
return actual frozen bytes/metadata without synthesizing equality or acceptance.

New source tests34/34 PASS after actual RED0pass/34fail. Combined with canonical
driver91/91 PASS: fourteen real transport callbacks in fake Google responses use
the original F/S ledger and held lock across both phases; a paginated version
list stops before compatibility RPC. Independent incremental review found no
actionable issue. Full regression/validate results are recorded in the execution
record when complete. No live Google/credential/counter/native proof follows.

Full Node22.23.3/actual Core/owned PostgreSQL1826/1826 PASS,62.802s,zero
fail/cancel/skip; cluster cleanup/listener stop verified. Validate72 backend/40
endpoints/static cache/diff PASS. No Apps Script/Worker change, so no repeat of
unchanged native Apps Script or local Worker capacity runs. Source equality,
remaining native callbacks and full native-window/quota acceptance stay gated.

### 2026-10-15 Source equality facts and actual execution entrypoint

The seven-source verifier accepts only the original module-branded source
adapter with matching pinned project/version/publisher, not copied/proxy handles.
Snapshot expected pins and six original version descriptors before IO. Actual
responses determine editor/file/manifest hashes, original serving inventory,
baseline1–6 plus epoch-described7, parent binding and fixed thin deployment.
Guarded manifests retain the exact scopes/whitelist/runtime/logging/library
version/development mode. Thin F metadata now includes the actual Execution API
entrypoint/access in the same existing read; access is not inferred from manifest.

New verifier26RED→GREEN; actual-entrypoint mask1RED→GREEN. Combined124/124 PASS,
including three canonical equality tests: real source transport/verifier facts
merge with explicitly synthetic remaining release/native fields in the original
ledger; changed source bytes or actual deployed access prevents native/RPC.
Concurrent/duplicate/out-of-order phases, unbranded handles and pin/manifest/
version/deployment mismatch stop without retry. Independent review found no
actionable issue. Full regression is recorded in EXECUTION_RECORD when complete.
Partial source facts omit native/ACL/Sheets fields and fail full driver readback;
no current Google, credential, quota, full native window or live acceptance.

Full Node22.23.3/actual Core/owned PostgreSQL1859/1859 PASS,64.161s,zero
fail/cancel/skip; cleanup and stopped listener verified. Validate72 backend/40
endpoints/static cache/diff PASS. Only documentation changed after the tested
573-file snapshot; Apps Script/Worker bytes unchanged. Credential-purpose owner
approval is recorded separately and does not make new policy wiring executable.

### 2026-10-15 Credential-purpose decision binding

The approved credential-purpose selector is distinct from the retained original
single-wrapper selector. The compiler keeps160/history25/fixed96/G32/P4/T3 and
reserves caller1/publisher3. New P labels are caller-bind, publisher-bind,
publisher-refresh and publisher-userinfo, each once. Generic actor aliases,
replay/borrowing, refresh before bind, identity before refresh, A–E/handoff before
all four purposes, cross-selector claim/runtime downgrade fail closed. Failed
identity remains charged; independent C2/I17 still work. Runtime binding and
scoped observation capabilities carry the selected decision, and orchestrator
derives it from pinned recovery options. Old policy/cleanup remains compatible.

Policy core RED14=1pass/13fail, binding RED5=2pass/3fail retained; affected236/236
PASS plus new copied-credential-recovery1/1 PASS. The new copied test initially
passed the full receipt to a strict path/SHA loader and was rejected; corrected
test input only, without relaxing the loader. Copied I17 preserves new decision,
history25 and pending execution, exposing no ordinary/RPC authority. Incremental
review found no actionable issue. Full regression recorded when complete.
This is policy/control evidence; fixed actual renewal/identity/native callbacks
and real safety/quota/complete-window gates are still required before Google IO.

Full Node22.23.3/actual Core/owned PostgreSQL1879/1879 PASS,63.322s,zero
fail/cancel/skip; cluster cleanup/listener stop verified. Reviewed five source
pins unchanged. Validate72 backend/40 endpoints/static cache/diff PASS. This
implements the selected policy through the counter/runtime/recovery; actual
credential adapters and native release/window bindings remain incomplete.

### 2026-10-15 Existing-grant and same-token identity adapters

Publisher source is pinned by exact bytes, owner, mode0600 and no-follow regular
file read. An explicit single P refresh validates bounded response, original
ten scopes and finite lifetime, followed by paid verified publisher identity.
Only then is a synchronous cached credential available. No login-file write,
new grant, hidden renewal or original-publisher revocation occurs. Four G
identities use each actor's current token and independent window admission;
partial identity results never imply full native or quota acceptance.

Initial adapter RED25/25 failed before implementation; selector RED2/2 reproduced
the actual legacy-cap bypass before repair. Canonical/phase/orchestrator now
carry the selected policy; missing/historical/stale selectors refuse IO.
Facade RED3/3 reproduced missing propagation before repair. Affected190/190
PASS; independent review's P2 selector issue fixed and re-reviewed with no new
finding. Full Node22.23.3/actual Core/owned PostgreSQL1910/1910 PASS,62.686s,
zero fail/cancel/skip; cluster and listener stopped. Tested575-file snapshot
806b20541fbc7d8216d6c45ad2d371649be303f8d300ea921f9f18f803200fe9;
only documentation changed afterwards. Apps Script/Worker source unchanged.
Actual Google counter remains25/160 and unclaimed; no live refresh, userinfo,
browser, native capture or RPC. Native/ACL/Sheets/terminal assembly and all
runtime, quota, privacy, performance and real-device gates remain required.

### 2026-10-15 Fixed ACL and authorization-tab release evidence

Original module branding rejects copied/proxied/mismatched metadata adapters.
Both phases use exactly three fixed GETs and actual caller/publisher credentials.
New table is exact owner+Reader with the prior caller permission pin; original
container is same owner only. Public/domain/group/inherited/deleted/extra or
incomplete access denies, as do changed authorization tab IDs. No grid data,
header verification or full source/native proof is inferred from metadata.
Focused25RED-to-GREEN; related77/77, affected215/215 PASS. Canonical integration
verifies F/S debits, held flock/peer exclusion and original history. Independent
reviews found no actionable issue. Full1936/1936 PASS63.501s under Node22.23.3/
actual Core/owned PostgreSQL, zero fail/cancel/skip; database/listener stopped.
Snapshot52a8a374ae1eaf7fc2cdb35448fdddd769830bd6e4d121571301fd612abdd2de; only
docs afterwards. Validate72/40/cache/diff PASS. Actual Google25/160 unchanged
and unclaimed; native/parent-binding/quota/terminal and release gates remain.


### 2026-10-19 C5 successor-control composition

Routing/shadow/simple/successor focused61/61 PASS, zero fail/cancel/skip, Node24.
Validate72backend/40endpoints/static-cache and diff PASS. C4eb89753 supplies
C3f2ff40a controls and restored historical source evidence; C5 shadow/runtime
is unchanged. No actual observation, Production change or acceptance.


### 2026-10-19 C6 successor-control composition

Fresh composed Node24 unit2811/2811 PASS, zero fail/cancel/skip. Validation
72backend/40endpoints/static-cache/comparison179 and diff PASS. C5737dc9b brings
C3f2ff40a controls and restored historical evidence; C6 Worker/fullHTTP timing
runtime is unchanged. Unchanged local Worker/capacity tests were not repeated;
the next exact-head CI will run its normal Worker job. No actual trial,
provider latency, formal authenticated/device or observation acceptance.


### 2026-10-19 accelerated-plan successor composition

Fresh validate72backend/40endpoints/static-cache/comparison179 and diff PASS.
All non-document tracked content matches C6aa9c57c; own delta remains six
planning/evidence documents. Inherited C6 full unit2811/2811 is not a second
local run here; exact-head CI remains separate. No Google/Production or
observation acceptance, change of approved acceleration, quota or retry rule.

### 2026-10-19 exact local-admission repair controls

New12-case actual-ledger suite initially7 PASS/5 FAIL before support. Focused
new/previous simple/successor tests55/55 PASS, zero fail/cancel/skip. Covers66
import, unchanged13-event prefix/clocks, remaining3 preparation reads/zero
retries, singleton, each pin, policy/counter/time drift, repinned incomplete
parent, original C2 after expiry/corruption, and actual JS debit/stop/drain.
Validate72backend/40endpoint/static-cache and diff PASS. Full exact-head CI is
separate; these synthetic tests create no actual owner or external operation.


## 2026-10-20 — Same unused repair, separately approved first-debit clock

Recommended model/speed: GPT-6.1 Sol/high for authorization/accounting controls.
Added real-ledger cases for delayed first debit (inspect/wait leave clock null),
six-hour/Taipei-midnight caps, <=six-minute preclaim rejection and next-day
unused admission, shared cross-mode singleton, strict layered approval pins,
post-admission approval drift, no restored retries and independent original
recovery after expiry/damaged mirror. Original033 clock tests remain intact.
New/old repair suite RED15pass/8fail before support; focused simple/successor/
repair66/66 PASS, zero fail/cancel/skip. Full suite and exact-head provider CI
are separately recorded in EXECUTION_RECORD.md when terminal.
No test in this increment calls Google or creates an actual trial owner/claim.
All live safety/runtime/performance/device/observation gates remain open.

## 2026-10-20 — Bounded readonly diagnostic successor

Real disposable-ledger coverage imports68/15events/failures3 without modifying
predecessors; checks eight-read/preparation23 cap, two qualified failures then
STOP, no unclassified retry, strict approval/target proof, duplicate IDs,
singleton, clock admission/first debit/expiry and independent C2 recovery after
mirror corruption. Initial18 cases RED7pass/11fail before implementation.
Review caught that phase alone did not prove target guards; four strengthened
phase-veto cases failed against that implementation before the whitelist and
exact target proof were corrected. Final30-case results and complete-source
verification are recorded separately. Private DOM doubles/real local-holder
integration do not establish actual browser compatibility or C3 acceptance.

### 2026-10-20 C4 diagnostic-control composition

Controller/routing109/109 PASS, zero fail/cancel/skip; validate72backend/
40endpoints/cache and diff PASS. Inherited C3 a19e305 controls are byte-identical;
C4 runtime unchanged. Actual72/232 is stopped and settled, not an accepted trial.
No RPC/mutation/Production change; provider CI and all live acceptance stay gated.

### 2026-10-20 C5 diagnostic-control composition

Inherited C4/C3 controls retain their separate source and actual-trial gates.
Routing/shadow/controller targeted results are recorded in EXECUTION_RECORD;
actual72/232 stopped does not establish acceptance. No runtime flags changed.

### 2026-10-20 C6 diagnostic-control composition

C3/C4/C5 diagnostic-control composition changes no C6 runtime or acceptance
threshold. Targeted verification and CI remain distinct from actual acceptance;
actual72/232 stopped, flags off, no observation T0 or Production change.

### 2026-10-20 Accelerated plan diagnostic-control composition

Runtime/source matches C6; inherited119 affected tests are source evidence,
not new local or external acceptance. Actual72/232 remains stopped; all
approved observation and rollout gates and off switches remain unchanged.

### 2026-10-20 C5 verified sample metadata

Actual local HTTP/D1 shadow/export6/6 and full Worker32/32 PASS, including old
attempt migration to unknown, server-verified LINE/Email, forged channel denial,
opaque unique receipt/server time, and unchanged transactional/report behavior.
Root shadow/identity/routing23/23 and validate72/40/cache/diff PASS. Tests use
synthetic local data; no real24h/channel coverage or remote migration follows.

### 2026-10-20 C6 approved accelerated observation candidate

Operator module/CLI11/11 and full unit2875/2875 PASS, zero fail/cancel/skip.
Coverage includes latest complete24h/current partial, LINE10/Email10, three8h
periods, both home sections, receipt/count/time consistency, invalid/stale input
and sanitized CLI errors. Every result is cutoverAuthorized:false.
Actual local D1 export→evaluator integration1/1 PASS using explicitly synthetic
24h timestamps; preserving another-page differences and denying unknown kind.
This proves wiring, not real elapsed observation or export provenance.
Full Worker results and exact-head CI are recorded separately in execution
records. Apps Script/native, Core/PostgreSQL and actual provider/device gates
were not newly accepted. See READ-ACCELERATED-OBSERVATION.md.

Final complete local Worker45/45 plus bundle dry-run PASS, zero fail/cancel/
skip. Full composition review noP1/P2; comparison180 and source diff PASS.

### 2026-10-20 Accelerated plan evidence-tool composition

All558 tracked non-document paths match reviewed C6 4d0e67c exactly. Reuse
its local2875unit/45Worker/1D1 wiring evidence; no repeated suite claimed.
Fresh validate72/40/cache/comparison180 and diff PASS. Exact-head CI remains
separate; no real observation, actual Google or release acceptance follows.

### 2026-10-20 C6 bounded Node memory evidence

Actual CI39305302531 unit2875 PASS/Worker44of45 FAIL (properties50.602ms);
matching-source plan CI39305572107 PASS2875/45 does not override failure.
Real fixed-version local profiling did not reproduce Linux; not acceptance.
Three new test cases cover native200-record before/after transport, terminal
joining to original property timers and incomplete/invalid evidence rejection.
Original timers/100samples/50ms and all real release gates remain unchanged.
Final targeted checks and current-head CI are recorded separately.

Final affected26/26 PASS, zero fail/cancel/skip. Review's overlapping-pair
false-completeness case first failed, then passes with sequential pair/timer
checks. Independent final review noP1/P2; validate72/40/cache/comparison180
and diff PASS. Exact-head CI outcomes and diagnosis remain separate.

### C3 readonly continuity controller

`tests/read-authority-readonly-continuity.test.mjs` uses real disposable ledgers
and live holders: immutable72 import, bounded charged cross-day PREP, failed
NOT_READY without baseline credit, durable two-failure limit, missing proof hard
stop, trial clock on non-PREP debit, protected recovery UI, latest-only terminal
handoff and independent cleanup with damaged ordinary mirror. Existing simple
controller suites retain legacy behavior. No external Google call is implied.

### C3 approved three-step diagnostic successor

`tests/read-authority-readonly-successor.test.mjs` uses real disposable ledgers
and live holders. It verifies immutable76 import, exact approval and independent
checkpoint/terminal/source requirements, no stopped-owner reuse, three-step
order and target limits, retained unused UI declaration, no main/API bypass,
charged unproved failure, one-time import and latest-only cross-day handoff.
The fixture reproduces the four settled prior actions and the unused navigation
declaration, rather than testing only the earlier72 checkpoint. Actual browser
compatibility and rollout gates remain separate.


### Approved79 fixed-total source/accounting migration

The optional readonlyRebalance controller retains exact79 history and terminal
handoff, fixes139/77/16 buckets within232, removes only21 native aliases from
main charging and requires successful reviewed UI results before credit.
First6 PREP reads reserve future43 plus the retained unused declaration;
staged actual/recovery maps precede non-PREP work and complete actual map
precedes the only RPC. Future44 is rejected; complete25/43 is admitted under77.
Affected165/165 PASS including22 new tests, zero fail/cancel/skip. Validate72/40,
cache and diff PASS. Review's leftover56 limit reproduced RED in two boundary
cases and was fixed. Exact-head CI and frozen private/actual acceptance remain
open; no new Google IO, mutation/RPC, deployment, flag or T0 is implied.


### C3 approved loading/source continuity

`tests/read-authority-loading.test.mjs` uses real disposable83 ledgers and live
holders: preserved failed/UNKNOWN history, immutable origin/receipt, latest-only
source migration, five-step grounding and nine-step guarded waits, shared cap
and target attempts across holders/days, unverified result and wait timeout
hard stop, protected2/future40-or36 bounds, no RPC before complete actual map.
Legacy rebalanced/successor/continuity tests retain their earlier authorization
boundaries. Bare/full-unit outcomes, review and exact-head CI are recorded
separately. No Apps Script/native, Google or production result is implied.

Final loading increment25/25 and complete unit2844/2844 PASS (zero skip).
Two independent-review P2 vectors reproduced RED then passed after the stage
membership/counter and PREP-only wait fixes. Validate72/40/cache/diff PASS.
Bare pre-final2847 result retains1 missing Core/PG environment failure and4
skips; no external integration acceptance is claimed. Exact-source CI remains
separate from local/unit and actual browser acceptance.

### 2026-10-21 C6 effective-runtime context

Native transport coverage now checks bounded runtime snapshots before the
first/after the last properties timer, numeric/null-only heap/new-space and
fixed cgroup values, no small-fixture collection, and interrupted capture.
Duplicate-opening0,0,99 first failed (false COMPLETE); exact ordered endpoints,
total2 and no output drop are now required. Every extra candidate contributes
to total/dropped while retained context remains capped at2. Fixed Node22.23.3
transport/summary28/28 PASS, zero fail/cancel/skip; validate72/40/cache/
comparison180 and diff PASS. Independent review and exact new-head CI are
recorded separately; no repeated unchanged capacity run.

CI39478285754 remains FAILED (unit2947 PASS/Worker44of45, properties55.231ms,
32/100 over50). The one Darwin Node22 profile is NOT_REPRODUCED, not acceptance
or a CI replacement. Runtime context targets missing Linux heap/cgroup
evidence only; no causal fix, production runtime change or live gate pass.
Independent four-path source/evidence review noP1/P2; diff check independently
PASS. Provider CI must follow the new commit and does not replace older failure.

### 2026-10-21 Current C3/C6 accelerated composition

The composition preserves current C3 0bc666a and C6 04e2db0 source exactly,
including the14-file frozen C3 runtime and both complete documentation histories.
No duplicate unchanged local suite or profile is claimed. Validation, exact
source-union verification and independent review precede a new composition CI.
C3 component CI39483187602 PASS2844unit/26Worker; C6 CI39481266323 FAILED
Worker44/45 properties50.504ms with2880unit PASS. Earlier failed integration
CI39478285754 properties55.231ms is retained; no later green erases failure.
Actual88 HARD_STOP (main53/UI35), VERIFIED thin projection/ACCOUNT_SCAN,
fields unread, no mutation/RPC/clock. Further account/loading scope is pending.
No live/runtime/performance/observation gate is accepted by source composition.
Fresh all569 non-document path/mode union and14 frozen runtime checks PASS;
prior record lines/multiplicity and complete paragraphs retained. Validate
72/40/cache/comparison180 and source diff PASS; exact composition CI is separate.
Independent index-based569-path/14-runtime/6-history review noP1/P2; no duplicate
suite claimed. New composition provider outcome remains a separate gate.

- Account-label incident successor: `tests/read-authority-account-load.test.mjs`
  covers exact stopped-origin import, immutable old STOP, fixed four-step order,
  replay/approval/authority/terminal/source rejection, timeout and final failure.
  The last qualified NOT_READY/TECHNICAL cannot produce a CLEAN_PAUSE receipt.
  Together with loading tests: 38 cases pass locally; separate private adapter
  tests: 8 pass. These are local evidence, not Google execution or trial acceptance.


### Bounded readonly connection continuity

`tests/read-authority-connection.test.mjs` verifies exact stopped-origin import,
immutable historical STOPs, shared8/fault2 limits, main134/UI82/recovery16,
prepaid six-step order, minimum remaining-path denial, successful wait and
reviewed sole projection, protected future36, cross-day latest-only handoff,
owner-required CLEAN_PAUSE, replay/approval/source/authority rejection, and
ordinary ID-prefix settlement isolation. Affected76 cases pass locally,
zero fail/cancel/skip. External Google, full trial and rollout acceptance are
separate gates; no Apps Script function changed in this increment.

Connection increment final local verification: Node22 unit2873/2873 PASS,
private adapter15/15 PASS; no fail/cancel/skip. Latest-origin persistence-denied
admission preserves actual89 and creates no entry or debit. Interrupted/failed
local runs are retained in the execution record; exact-head CI and all actual
Google/runtime/rollout gates remain independent.


### Connection ID refresh preserves original browser/tab authority

`tests/read-authority-browser-selection.test.mjs` covers original-ID preference,
provisional unique Chrome selection only after contextual owner confirmation,
ambiguity/type/name/duplicate/accessor rejection, and exact providerTabId/URL
matching without opaque-ID fallback. Together with retained connection tests:
30/30 pass. Private eleven real-ledger cases retain91, used2/fault2, mandatory
six-step success at97, third-fault stop and all security/protected reserves.
Independent review has no P1/P2. New current-source CI and frozen/inert gates
remain separate; no Apps Script function or Production behavior changed.

Final current-source Node22 unit2887/2887 PASS with zero fail/cancel/skip.
Validate72/40/cache and diff-check PASS. Native restored-ID/original-tab
verification and all rollout gates remain unproven.


### 2026-10-21 C6 GC flags and legacy diagnostic compatibility

Real Node22 forced collection must retain its major/forced flag in bounded
TAP diagnostics, with no profiler or operational data. Summary vectors cover
external/forced and combined masks, unknown/null/negative/fractional/unknown-bit
flags, hostile strings, legacy three-column NOT_COLLECTED evidence, and both
directions of declared-column/row-width mismatch. Unknown is never zero.
First three new cases RED;31 affected cases GREEN before final negative-vector
strengthening. Full regression/independent review/new exact-head CI outcomes
are recorded separately. Existing strict50ms capacity failure and all100 raw
samples remain authoritative; GC flags are annotation, not causal or production
acceptance evidence. No unchanged capacity run or additional profile was added.

Final strengthened vectors and all existing root tests passed in fresh isolated
Core/PostgreSQL bare npm test2888/2888, zero fail/cancel/skip. Source670/Core/
teardown readbacks verified; independent increment review noP1/P2. No extra
capacity benchmark or profile was repeated locally.

### C3 discovery metadata and exact stopped-checkpoint successor

- Browser/tab discovery projects only documented own data fields. Optional metadata is ignored; accessors, proxies, duplicate IDs, ambiguous Chrome candidates, and provider-tab/URL mismatches fail closed.
- A separately approved exact stopped-checkpoint successor retains all earlier settled events, claims, source pins and STOP markers. Its six acquisition steps are individually charged, include a successful bounded load before one safe projection, and grant no new failure retry.
- The repair consumes the existing UI spare while retaining the historical unused declaration, 36 future UI primitives, and independent recovery reserves. Complete maps with 36 future primitives are accepted; 37 or reuse of the historical unused ID are rejected.
- Coverage: `tests/read-authority-browser-selection.test.mjs`, `tests/read-authority-discovery-repair.test.mjs`, and existing connection/loading/continuity tests. These are disposable local fixtures; passing them is not evidence of Google access, compatibility RPC, deployment, formal performance, or device acceptance.

### Shape-only metadata diagnostic

- The separately approved exact stopped-checkpoint diagnostic permits one prepaid browser-list inventory, retains preparation/loading/failure history and all future/recovery reserves, and grants no browser/tab/account identity credit.
- The pure helper returns only a fixed source, booleans and counts. Unknown metadata is not traversed, IDs/labels are not returned, and ordinary or revoked proxies/getters are not invoked.
- Tests cover sole-read success, failed-return settlement (including legacy rejection shapes), forbidden follow-up methods, second reads, proof failure, stale origin/approval/replay and unchanged old STOPs. No binding, tab access, DOM, write or RPC is allowed.
- Coverage: `tests/read-authority-browser-shape.test.mjs` and `tests/read-authority-metadata-diagnostic.test.mjs`. Disposable fixtures are not evidence of actual browser shape or successful compatibility/release acceptance.

### Explicit owner connection selection

- The approved successor retains the completed stopped diagnostic and all old charges. Unused main allowance moves to ordinary UI within the same aggregate ceiling; HTTP, future operations and independent recovery reservations remain intact.
- Discovery returns only documented Chrome candidate fields and pauses without a binding. A direct owner selection matching the exact candidate digest is required before the remaining acquisition steps, successful bounded wait and proved account/project snapshot.
- Coverage includes stale receipts/approval/history, missing or invalid owner selection, failure settlement at every step, malformed candidate rejection without pending IO, snapshot proof and offline budget accounting. Existing stopped entries cannot replay; no failure allowance resets.
- Coverage: `tests/read-authority-owner-connection.test.mjs` and `tests/read-authority-browser-selection.test.mjs`. Passing disposable fixtures does not establish a real browser binding, account authority, compatibility RPC or cutover acceptance.

Owner-selection timing regression: a delayed holder retains the closed candidate checkpoint as the approval time floor; stale choices remain rejected. No remote operations are added.


### 2026-10-22 C6 bounded local D1 actor observation

Recommended model/speed: GPT-6.1 Sol/high for cross-runtime timing diagnosis.
This is V2.0 stability test work, with no product route, API, Schema, Apps
Script, deployment, Properties, trigger, access or production-data change.

Accelerated composition4b7f87c CI39627922453 failed two unchanged strict50ms
local latency assertions (unit3085/3085, Worker43/45). Earlier successful
e9354d9 CI39625127928 remains historical; it does not replace this failure.
Identical non-document code and the available Node/D1 stage observations do
not establish SQL CPU, actor, scheduling, GC or transport as the cause.

The new test-only hook clones the pinned Miniflare local d1:db module in
memory; node_modules and product Worker source remain unchanged. A scoped
wrapper rejects overlap and restores the original getServices in outerfinally,
after fixture disposal even on failure. The module SHA and exact insertion
points fail closed; sourceURL is retained only on one comment line.

Two numeric spans are attached only to the last batch result metadata:
entry_to_txn_ms includes request parse/validation plus the awaited transaction
and bookmark; json_tail_ms is cumulative entry through serialization of the
last meta getter. Neither is pure SQL CPU, full response completion, network
or transport. Equal values do not prove zero serialization CPU; workerd
clock resolution and synchronous advancement remain unproven. Instrumentation
itself perturbs the path, so results cannot retroactively explain older runs.

Only the existing first small/capacity fixture cases use the hook. All original
100 requests per route, seven routes, request order, full-wall body-consumption
timer, p95 index94 and strict p95<50ms remain. No warmup/retry/replacement is
added. After the original end timestamp, a bounded collector pairs route and
sample with fullwall, caller D1 await and the two actor spans. A separate
versioned test-only header/protocol preserves the existing three server-timing
stages and x-cmwebs-test-d1's three keys. Absent/invalid/decreasing spans stay
null with explicit incomplete evidence, while subsequent samples still run.

At suite close, at most700 numeric/enum rows emit via native t.diagnostic in
frames<=4096bytes. The bounded CI summary validates sequence, counts, metadata
and missing/invalid/drop state, prints paired numeric aggregates and retains
the original failure/footer. Raw provider logs remain available. COMPLETE
means diagnostic coverage only; it never means latency or rollout acceptance.
No percentile subtraction or caller-minus-span transport attribution is valid.

Affected pure/native tests cover source pin/line terminators, last-meta and
getter semantics, hook restore/overlap, missing/malformed/negative/nonfinite
spans, sequence/duplicates,700-row transport/privacy and actual measurement-loop
execution proving collection follows body/full-wall end. New full regression,
independent review and exact-head CI outcomes must be recorded separately.
Apps Script tests are unaffected and no Google editor test was invoked.
Rollback is to revert this test-only change; no production rollback is needed.
All formal authority/privacy/revocation/freshness/performance/device/rollback
and approved24h+24h/seven-day rollout gates remain open.

The new-source local Worker run passed53/53 with both suites retaining700/700
valid actor pairs; actor summary invalid/drop counts0. Raw logs retain one
legacy long-diagnostic summary omission; no actor frame was omitted. This
Darwin result does not replace earlier Linux failures or prove their cause.
Initial bare Core/PG regression was2890/2893 with three failures in the old
measurement-tail harness: actorTiming was not provided to its VM context.
The harness now injects the real bounded collector and preserves missing
header evidence plus all700/NaN/strict-gate assertions; affected8cases pass.
The failed full run and verified owned-cluster cleanup remain retained.
Fresh full regression and exact-head CI are pending; no unchanged Worker
benchmark is repeated for this root-test-only harness repair.

Final repaired bare Core/PostgreSQL regression passed2893/2893, zero fail,
cancel or skip. All678 tracked source paths matched the pre/post snapshot;
Core321/index/ref and owned-cluster teardown were verified. Only this final
result documentation is appended after that snapshot; executable/test bytes
remain the tested bytes. New exact-head CI remains pending. Initial2890/2893
and earlier strict Linux failures remain evidence, not replaced outcomes.

### Classified original-tab inventory and ready-first successor

- A separately approved exact stopped-checkpoint successor preserves prior events, source pins, STOPs and the owner's selected connection. Four individually prepaid steps bind that connection, classify the original tab inventory, claim that tab and project its ready state/account/project guards once. It adds no discovery, standalone wait, retry, write or RPC.
- Classification stores only fixed enums, counts and booleans. Optional metadata is not traversed; getters/proxies, duplicate IDs, missing provider identity and URL/selection ambiguity fail closed. Invalid successful evidence settles as an unverified failed read, without pending IO or account credit.
- The projection checks complete load before URL/account/settings access and retains the pinned account/project/control checks. Partial preparation cannot produce a handoff. Successful binding releases only the explicitly superseded unused declaration; 36 future primitives fit while 37 and reuse of that declaration fail. Recovery reserves and failure history remain unchanged.
- Coverage: `tests/read-authority-inventory-budget.test.mjs`, `tests/read-authority-inventory-diagnostic.test.mjs`, `tests/read-authority-ready-projection.test.mjs`, and the existing owner-selection suite. Disposable fixtures and the isolated callback VM establish local behavior only; actual binding, compatibility, synchronization, performance, device and release gates remain separate.

### Exact stopped-checkpoint project-tab retarget successor

- A new explicitly approved nested successor imports the exact settled stopped
  inventory checkpoint into a distinct namespace. Prior events, holders, source
  chains, failure count, old STOPs and the unsuccessful diagnostic remain intact.
  Four individually mapped/prepaid reads use the selected connection, a single
  user-tab inventory, the deterministic exact-full-URL match, its claim and the
  same injected static ready-first projection. Success pauses for handoff only.
- The new pure selector requires both provider and opaque identifiers to be valid
  and globally unique, including unrelated rows. Multiple exact URL matches use
  ordinal provider-then-opaque ordering; zero matches, unsafe own-data shapes,
  getters/proxies, sparse arrays, symbols and excessive metadata fail closed.
  Unknown metadata values are never traversed, and retained diagnostics contain
  fixed enums/counts/booleans only. No raw row, account, URL, title or error text
  enters the journal or result report.
- Only this nested decision permits the revised aggregate allocation. Existing
  identities and their ceilings remain unchanged. The four-step success keeps
  the unsuccessful predecessor diagnostic unchanged; its new proof controls
  preparation completion and handoff. Thirty-six future UI primitives still fit;
  thirty-seven, superseded-operation reuse, partial handoff and stopped reentry
  are rejected. Main/HTTP and independent recovery reserves remain intact.
- Coverage: `read-authority-project-selector.test.mjs`,
  `read-authority-project-retarget-budget.test.mjs`,
  `read-authority-project-retarget-flow.test.mjs`, plus the predecessor inventory
  and owner-selection suites. Fixtures use disposable local journals and fake
  provider callbacks. They do not establish actual provider execution, source CI,
  trial/RPC acceptance or any release gate. The private entry must pin the exact
  approved URL, publisher hash, static callback, frozen origin registry and all
  source bytes before its separate inert/first-write/execution gates.

## 2026-10-23 C3 retained launch successor source candidate

| Check | Evidence boundary |
| --- | --- |
| Direct approval and exact frozen stopped-state/source/observer agreement; prefix and prior proof drift denied | Synthetic private fixtures only; missing returned receipt stays missing and UNKNOWN stays UNKNOWN |
| Unique four-read successor; each rejection settles false before HARD_STOP/drain; invalid results normalized | Real disposable local holder/ledger chain with synthetic provider boundary; no remote browser acceptance |
| Separate new proof, immutable predecessor proofs, decision-specific ceiling, future36/recovery protection | Local controller and compiler behavior; original decisions retain their ceilings |
| Deferred promise retained before entry, result/error captured, finally gate closure, delayed await and restart denied | Pure local launcher; no provider, canonical debit or production change |
| Source manifest reconciliation | All 15 included source fingerprints match; calculator/comparison artifacts remain unchanged |

Final local affected chain: 26 files, 636/636 PASS with zero fail/cancel/skip,
including 39 added cases. Node22 validate72 backend/40 endpoints/cache and
diff-check PASS. The test runner completed; its shell wrapper then failed assigning
the reserved zsh `status` variable. No test failure is hidden by that wrapper error.
Independent review, exact final-source CI and the complementary mandatory
Core/owned-PostgreSQL partition remain separate gates.
No Apps Script test function applies: no `.gs` module changed. No real Google or
production execution, rollout or performance acceptance is established here.

### Shared fixed-policy settlement review repair

The two approved project successors retain independent prefix dispatch, proof keys,
origin/history/receipt guards and ceilings while sharing one private settlement
implementation. Fresh pre-refactor representative behavior12/12 PASS; final three
covering files65/65 PASS, zero fail/cancel/skip, runner/wrapper exit0 under Node22.
Validate72 backend/40 endpoints/cache and diff-check PASS. No tests added or changed,
no new API/module/namespace or remote/canonical action; final full-source CI and
Core/owned-PostgreSQL evidence remain separate parent gates.


### C6 Node HTTP-client boundary diagnostics (2026-10-22)

Test-only CJS hook lifecycle covers response/error/receiver/argument identity,
unselected Promise identity, concurrent-token isolation, overlap refusal,
clock faults, late descendants and permanently incomplete detached calls.
Collector/summary checks cover paired same-clock windows, exact700 counts,
route/index sequence, duplicates, malformed/nonfinite/missing/multiple calls,
privacy and bounded output. The actual measurement-body harness proves token
allocation precedes the original wall timer and sample formatting follows body
consumption/end. Early gate failures still retain all700 requests and NaN
cannot pass the capacity gate. CI summaries preserve the original failing
footer beside complete or explicitly incomplete observation evidence.

A one-request literal-response functional experiment established forwarding
for this locked Miniflare/undici pair; it is not a latency sample. Fresh full
root/Core/PostgreSQL, complete Worker and exact-source CI results are pending.
The prior integration properties p95=51.325898ms failure remains unresolved.

Local new-source Worker verification passed59/59,0fail/cancel/skip, including
both original700-sample fixture runs. All1400 raw HTTP-client rows match the
existing client start/end/fullwall/dispatch/body and actor fullwall exactly;
both producer suites and16 summary aggregates report complete coverage, with
zero invalid/drop. Maximum route p95=18.670541ms on this Darwin run. This does
not replace the retained Linux failure or establish a cause. Fresh full root/
Core/PostgreSQL, exact-source CI and downstream integration remain pending.

Fresh bare root/Core/PostgreSQL regression passed2899/2899, zero fail,
cancel or skip. All683 source paths matched the before/after bytes/modes
snapshot; Core321 tracked blobs/index/ref and owned PostgreSQL teardown were
verified. Only this result documentation was appended afterward; executable
and test bytes remain those verified. New exact-head CI is still pending.

### C6 same-sample D1 query-duration evidence

The 500-room fixture now retains the existing test-only D1 `internal_ms`
header for every original measured response, alongside query and row counts.
Header parsing follows body consumption and the original full-wall end;
request count, ordering, p95 index and strict 50ms gate remain unchanged.
Seven bounded numeric vectors preserve all100 values per route before sorting.
CI marks missing, duplicate, malformed or dropped vectors incomplete without
changing the original test outcome. Emulator query-processing duration is not
SQL CPU, transport duration or Production acceptance.

The actual-loop regressions retain all700 samples after an early latency
failure, reject nonfinite p95, and verify the new ordered vectors. Boundary
tests and summary privacy/completeness tests passed33/33 under Node22.
Local Node22 Worker verification passed59/59; maximum capacity p95 was20.481ms.
An earlier Node26 run is retained separately and is not the designated Node22
verification. The prior Linux CI latency failures remain unresolved until new
exact-source CI supplies evidence; no Production change or rollout follows
from these local results. Rollback is reverting this test/log-only increment.

### C6 per-statement timing within the same batch

The synthetic Worker additionally exposes only the numeric durations already
returned by its original batch, in schema entry order. Capacity measurements
read them after the unchanged body/full-wall end, require the original query
count and summed duration, and retain all100 rows per route in ten-row frames.
No SQL, source values or identity enters these frames; no query is added.
CI validates exact numeric dimensions, unique route/offset slots, sums and
same-sample totals against the existing internal-duration vectors. Missing,
duplicate, malformed, mismatched or dropped frames cannot report COMPLETE.
All700 original samples and the strict50ms gate remain required. This is
diagnostic evidence only; individual elapsed durations are not CPU or causal
proof. The retained properties p95=50.131852ms CI failure remains unresolved.
Rollback reverts this undeployed test/log-only increment. New exact-source
verification is required before any acceptance claim.

### C6 source-row ordering indexes

Migration0007 adds six nonunique indexes for the existing room, contract and
bill ordering expressions: source order and Workspace plus source order.
The real scoped loader SQL/parameters and shared unscoped projection remain
unchanged. A genuine missing-index regression exercises direct, blank/legacy
and parent-exclusion queries. Independent order-only and compound stages
verify why both index forms are needed. Thirty-one actual plans eliminate
temporary ORDER BY trees; complete scoped dataset and property HTTP bytes,
foreign-scope exclusion, statement/batch counts and rows_read are preserved.
Literal edge cases retain numeric casts, SQL/JSON null, nonnumeric source
rows and row-key ties. Signed-sync tests and both original latency fixtures
apply the new migration, keeping all original samples and strict50ms gate.

Plan improvement is not latency acceptance. Fresh complete Worker and CI
verification remain required; prior51.868ms failure is retained. Indexes add
storage and sync-write work, which must remain within actual quota acceptance.
Before deployment, back up D1 and verify migration state. Rollback drops only
the six named0007 indexes and reverts their source/tests; it does not delete
replica rows, alter query semantics or remove0005 Workspace indexes.

Before the migration filename integration correction, designated Node22 local
Worker verification passed60/60, including signed sync, complete parity and
all original latency samples; maximum capacity p95 was19.842ms. The pre-rename
unit suite passed2898/2898, zero fail/cancel/skip, in171.790s. These Darwin
results do not replace the retained Linux CI39656752302 properties51.868ms
failure or any earlier failure and are not post-rename full-suite evidence.
The new migration uses0007 because existing0006_shadow_auth_kind.sql is
immutable; the functional baseline applies existing0004/0005/0006 first.
Comparison identity is regenerated for181 sources, so future observation
must use the new identity and start a fresh window. Asset version is unchanged,
endpoint remains blank and all six flags remain off. Post-rename functional/
affected checks and exact-source CI are recorded separately; exact CI remains
required. Core/PostgreSQL integrations are unchanged and were not repeated.

Post-rename designated Node22.23.3 checks passed36/36, zero fail/cancel/skip:
the new real-D1 functional case plus35 actor-timer-boundary/completion/CI-summary
cases, in4.378s. Functional evidence confirms six nonunique indexes,31 actual
plans without temporary sorts,28 scoped sorts remaining after order-only
indexes,500 owned rooms, complete data/HTTP bytes and unchanged queries.
Validation passed72backend/40endpoint/cache/comparison181; diff check passed.
Existing migrations and the candidate SQL SHA are byte-identical. No unchanged
benchmark/full-unit or external Core/PostgreSQL test was repeated after rename.
Exact committed-source CI and formal performance/quota gates remain pending.


### C6 internal Sheet matrix view — 2026-10-23 source candidate

Recommended GPT-6.1 Sol/high for the bounded correctness/performance continuation.
A private pure-functional prototype using actual projected 500 data, actual
createReadServices(...,true), fixed clock and canonical properties entry retained
exact 713,795 response bytes and unchanged source data. Internal complete-matrix
clones fell 9→0, row arrays 1575→0 and copied cells 20814→0. All seven entry results
were byte-identical; frozen internal arrays falsified writes by the three generated
snapshot consumers. This is deterministic allocation evidence only, with no timer.

New functional RED: owned properties consumers called the public cloning path 9
rather than 0; the foreign/default ownership case observed 4 rather than 2 calls.
The request-local WeakMap fix affects only owned Sheets in explicit deferred mode.
Targeted runtime/calendar/parity/collation/month tests pass 30/30 with zero failure,
cancel or skip. Public header/cell/range mutation isolation, default eager source
snapshots, foreign-request fallbacks, Date hydration/locality, null/absent blanks,
scalar zero/false, own/inherited __proto__ and masked account suffix remain covered.
Generated calculator, canonical GAS, schema, migrations, SQL, packages, transport,
fixture/timing loops, 100 samples, p95 index 94 and strict<50ms are unchanged.

The prior indexed source 62e386c CI 39832854033 Worker 59/60 failure remains:
properties p95=54.06686799999807ms,22/100>=50ms. No latency improvement or GC cause
is established by reducing copies. Formal acceptance/rollout/storage/sync/quota
and parent integration gates remain open. Rollback reverts this bounded runtime
change and regenerates comparison identity; no data or remote action is required.


The single designated Node 22.23.3/macOS new-source Worker run passed 60/60,
0 fail/cancel/skip, 45.715609834 s. Original capacity500 p95s (home/actions/revenue/
tenants/rooms/arrears/properties) were 13.300/11.740/13.092/19.040/14.171/15.948/
17.886ms; small p95s 1.803/1.638/1.665/1.996/1.722/1.465/2.080ms. Every route
retained 100 full-wall samples and 0 samples>=50ms. All 1400 client/actor/fetch
pairs matched exact clocks/arithmetic; actor/fetch each 700 COMPLETE per fixture,
invalid/drop/outputdrop0. No causal speed claim, new Linux result or prior-failure
replacement follows. No unchanged benchmark was repeated.

The 685 tracked paths were byte/mode-identical before/after the Worker run,
snapshot 279164ccc98e2b2122d183c9254a0afb675d6791b20918e1b97f1fb2bedf8f8e;
this result-only documentation append follows that snapshot. Validate 72 backend /
40 endpoints/static-cache/comparison 181 and diff check PASS. Final full-unit exact-
head CI, independent parent review and separate C6 integration remain pending;
no redundant local full-unit/Core/PostgreSQL run or external action was performed.


### 2026-10-23 reviewed source composition checks

- Ten focused C3 files cover owner selection, predecessor inventory, project
  retarget, retained launch, safe metadata selection, ready-first projection and
  launch-state retention:144/144 PASS, zero fail/cancel/skip under Node22.
- Eight focused C6 files cover the retained HTTP matrix, private internal
  snapshot ownership/public copy isolation, typed calendar values, asynchronous
  fetch attribution, original timer completion and bounded CI summaries, plus
  actual local D1 source-order query/index/HTTP equivalence:67/67 PASS, zero
  fail/cancel/skip. No local full unit/Worker capacity benchmark was repeated.
- Validate72 backend/40 endpoints/static cache/comparison181 and diff-check PASS.
  Exact source checks: C3 runtime27/27 against8f8d222; C6 Worker56/56 and
  comparison-source181/181 againstbca6764. Existing asset version, blank endpoint
  and six disabled flags remain unchanged; the generated comparison is current.
- Mechanical expected complete partitions are unit3207 (exact C3 baseline3057
  plus150 source registrations), Worker60 and complementary Core/PostgreSQL5.
  These are predictions; exact composed CI and Core/PostgreSQL evidence still
  precede acceptance. The retained C3 source Worker25/26 latency failure is
  not superseded by these local functional checks or the separate C6 CI pass.
- No changed Apps Script function, route or business schema requires a cloud
  test call. All actual provider, full-map, privacy, performance, device,
  rollback,24h+24h/seven-day gates remain separate and unaccepted here.

## 2026-10-23 C3 shared-object successor source candidate

| Check | Evidence boundary |
| --- | --- |
| Fresh direct approval, exact stopped prefix, returned receipt/audit and local bridge proofs; missing or changed pins rejected | Disposable synthetic holder/ledger history; historical UNKNOWN is preserved |
| Separate four-read namespace and account proof; success stops at binding-only CLEAN_PAUSE | Original proof remains unsuccessful; original decisions keep their ceilings |
| Each callback failure settles false before STOP/drain; pending clears and consumed entries cannot replay | Real local controller and ledger with synthetic provider callbacks |
| Future ordinary allowance and independent recovery reserves remain intact | Full operation-map and actual browser acceptance remain separate gates |
| Shared object gate, visible attempts and safe pending/returned/rejected classifications across later state mutations | Pure local mock boundary; raw provider rejection text is discarded |
| Deferred source promise retained before callback; terminal result/error, closure and once-only guard retained | Existing source launcher reused without changes |

Coverage: `read-authority-project-shared.test.mjs`,
`read-authority-retained-browser-bridge.test.mjs` and the affected predecessor
controller/plan/selector/holder suites. No Apps Script test function applies;
no `.gs` module, route, schema, calculator or benchmark changes. Independent
review, final composed-source CI, complementary Core/owned-PostgreSQL integration,
private immutable packaging, inert/first-write and separate prestart checks remain
required. Local results cannot establish provider, trial, device or release
acceptance. The initial overlapping RED run is limited evidence; a separate
fixed-source ledger admission RED and corresponding GREEN are retained.

Final local affected verification:28 files /709 tests PASS, zero fail/cancel/skip,
original runner and shell wrapper exit0 under Node22. Added47 cases across two
new test files; no existing test case removed or modified. Validate72 backend /
40 endpoints/cache and diff-check PASS. The source remains local and parent
review/composed-source CI/Core/private execution gates remain required.


## 2026-10-23 C6 properties stage-pair retention (local diagnostic candidate)

Recommended GPT-6.1 Sol/high for bounded diagnostic framing risk. The existing
capacity test now emits ten properties-only frames of ten original zero-based
`[sample,d1_ms,decode_ms,route_ms,body_bytes]` rows plus one count/column receipt
after all100 measurements and before any in-place sort. The measured loop is
byte-identical to base bca67640; all seven routes, full-wall100 samples, p95
index94, strict<50ms and original test outcome remain unchanged.

Summary frames have a separate32768-byte budget: ten3072-byte frame slots,
1024 bytes for validated raw metadata and1024 for the completeness receipt.
Exact route/keys/index order/shape, finite nonnegative times, safe integer body
bytes, unique offsets, exact100 counts and zero invalid/drop are required for
COMPLETE. Missing/corrupt/duplicate/oversized/out-of-order records are PARTIAL;
absent evidence is NOT_COLLECTED. These are coverage statuses, not performance
acceptance. Existing failure/footer/client/actor/fetch/stage/statement budgets
and metadata are unchanged; arbitrary strings are not reprinted.

Source-frozen RED: existing30 passed and all7 added summary contract tests
failed for the missing receipt. GREEN: summary37/37 and final focused summary/
timing/transport58/58, zero fail/cancel/skip; validate and diff check passed.
No Worker benchmark or full-unit/Core/PostgreSQL execution was performed here.
Apps Script tests NOT_RUN (unaffected). Parent review and one predetermined
composed CI diagnostic remain pending. The retained Linux properties failure
51.56710199999725ms /9of100>=50 is preserved; no causal/product fix or Production
acceptance is established. Rollback reverts this bounded diagnostic change.

## 2026-10-23 C3 publisher alignment 105 source candidate

| Check | Local synthetic boundary |
| --- | --- |
| Exact stopped102 prefix, pinned origin and three settled sidecar pairs | New namespace reports 105 = main53 + UI52; old49 events, UNKNOWN, STOP, failures and no-W0 remain intact |
| Changed, gapped, duplicated or dishonest sidecar proof | Denied before continuation callback or provider primitive |
| Six documented browser methods and two safe Google projections | Each UI call prepaid and settled; both verified pages yield CLEAN_PAUSE111 with a stable retained handle object |
| Failed methods, wrong profile/handle/URL/principal/controls/fieldsRead | Settled failure and drain; no uncharged replay or raw provider text in receipt |
| Future stage and repair allowance | Stage caps and future minima preserve ordinary UI96, main recovery21 and UI recovery16; two readonly incidents permit at most three prepaid repair calls each |
| Incomplete future map and RPC | Denied; actual provider map and trial acceptance remain unproved |

Coverage is `tests/read-authority-publisher-alignment.test.mjs` plus affected
predecessor suites. No Apps Script test function applies: `.gs`, routes, schema,
calculator, Worker and production deployment files are unchanged. Parent-owned
review, composed-source CI/Core, private packaging and actual prestart gates
remain separate from these synthetic tests.


## 2026-10-23 C6 local D1 actor transaction-window diagnostic

Recommended model/speed: gpt-6-sol/high for the bounded cross-file timing and
transport change. The pinned-hash, test-only Miniflare actor hook now observes
two timestamps immediately before and after the original awaited `#txn` call.
The v2 numeric header and paired actor rows add `entry_to_before_txn_ms` and
`awaited_txn_ms`; the existing `entry_to_txn_ms` and `json_tail_ms` spans remain.
The first span includes request JSON parsing; the awaited span includes actor
transaction acquisition/execution and any wait. Neither is SQL CPU or a
Production performance measurement. Invalid or inconsistent fields cannot be
COMPLETE. Each fixture still has seven routes x100 original samples; the
4096-byte frame and 8192-byte actor aggregate budgets are unchanged.

Node22 synthetic hook/header/collector/summary/native transport, original
timer-boundary, fetch-boundary, capacity completion and CI summary checks pass
59/59, zero fail/cancel/skip. Test-first RED was 5 pass/6 expected fail because
the two windows were absent; initial GREEN passed 11/11. `npm run validate`
passed 72 backend files, 40 endpoints, static cache and 181-source comparison;
`git diff --check` passed. No local benchmark or full suite was run. Original
full-wall timer, p95 index94 and strict<50ms gates are unchanged; the retained
Linux CI39969225950 latency failure and its unknown cause remain open. Parent
review and one composed exact-source CI are pending. Rollback reverts this
test-only diagnostic change; no runtime or data rollback is involved.

## 2026-10-23 C3 publisher projection compatibility repair

| Check | Local synthetic boundary |
| --- | --- |
| Shared decoder, target-specific labels | Nonempty Settings and Audience controls pass only their own exact whitelist; omitted target retains the Settings default; unknown target and cross-target labels stop |
| Projection shape and privacy | Malformed control tags, roles, booleans, extra fields and `fieldsRead:true` stop before verification; URL, account, ready, section and VERIFIED gates remain required |
| Publisher six-step flow | Nonempty legitimate controls on both targets reach CLEAN_PAUSE111; callback rejection, malformed projection and decoded verification rejection each settle and stop without replay |
| Failure evidence | Receipt retains only fixed target/stage/classification, callback and decode booleans, and a bounded count after valid decode; rejected raw values, URLs and error text are omitted |

Affected tests are `tests/read-authority-publisher-alignment.test.mjs` and the
legacy project flow suites using the same decoder. These local checks do not
classify the historical actual111 failure; its raw projection was not retained.
No `.gs`, route, schema, Worker or production source changed, so no Apps Script
test function applies. Fresh provider operations require a separate reviewed
diagnostic decision and the parent-owned exact-source gates.

## 2026-10-24 C3 conditional native visual successor source

| Check | Local synthetic boundary |
| --- | --- |
| Closed original 111 and complete later settled chain | A distinct PREP successor imports 17–20 charges once, preserves the stopped 55-event origin, and reports spent 128–131 without invented events or provider timestamps |
| Pinned approval, source and manual visual proof | A synchronous parent verifier is required before spawn and at guarded continuations; closed-menu, wrong URL, false proof and pin drift stop before ordinary work |
| Accounting and replay | Gap, duplicate nonce, pending state, changed origin, exhausted repair allowance reset and second owner stop; 296 total and at least 70 future UI calls remain protected |

Focused source tests use synthetic evidence in `tests/read-authority-publisher-alignment.test.mjs`; `npm run validate` checks the repository baseline. This source preparation does not establish actual browser identity, external provider acceptance or production readiness. No Apps Script test function applies because `.gs`, routes and schema are unchanged.

## 2026-10-24 C6 transaction callback three-cut diagnostic

Recommended model/speed: gpt-6-sol/high. The locked Miniflare actor's existing
transaction callback has three test-only clock reads at entry, after the same
`queries.map`, and after the same bookmark await. Existing C0/C4 points yield
four same-sample windows. The v3 header and 12-column bounded actor frames
retain 700 ordered rows per fixture and reject missing, nonnumeric, negative,
inconsistent or malformed phases. The summary still accepts retained v2 logs.
The full-wall timer, seven routes x100 samples, p95 index94 and strict <50ms
gate remain unchanged. These elapsed windows cannot identify workerd CPU,
SQLite, disk or scheduler cause; the three new clock reads perturb the measured
path. No benchmark or provider acceptance is claimed here.

## 2026-10-24 C6 scoped-group merge reduction candidate

Recommended model/speed: gpt-6-sol/high. The existing D1 loader's scoped table
path now skips its per-group deduplicate/sort pass and keeps the final per-table
last-row-wins merge. The separate user lookup retains its original group merge.
SQL, parameters, source fields, authorization, parent guards, fixture, routes,
GAS source, and timing gates are unchanged. This is V2 read-performance work.

A new exact-response case covers overlapping blank-Workspace room selections,
tied source-row ordering, an archived room, and a foreign-parent decoy. It
passed on the old source, so no behavioral RED is claimed. After the change,
Node22 focused scoped-loader/access/index/source-order tests passed 13/13,
zero fail/cancel/skip. Existing cases include all seven canonical route
responses at 500 owned rooms, delegated-manager masking/permissions, invalid
batch failure closure and scope boundaries. These are functional checks, not
the 100-sample capacity benchmark. The original strict p95 <50ms acceptance
and the retained composed CI failure remain open pending reviewed exact-source
measurement.

The source-identity guard initially rejected the changed Worker module. The
repository generator refreshed only its source manifest and central comparison
literal; the endpoint and route flags stayed unchanged. Node22 comparison
identity regression passed 1/1, `npm run validate` passed 72 backend parses,
40 endpoint references, static cache checks and 181-source identity; diff
check passed. A new real shadow observation epoch is required before rollout.
## 2026-10-24 C3 first publisher plan registration regression

| Check | Local synthetic boundary |
| --- | --- |
| Native successor first plan | A full fixed-key plan with every native UI alias and bounded recovery can register after the settled publisher bootstrap; no RPC, trial clock or provider call is credited. |
| Staged readiness | The view reports the inherited ledger's `trial_map_ready()` result: false at bootstrap and true after a valid main/UI/recovery stage map, while `planReady` remains false. |
| Later stages | A stage registered after the full plan must use exact planned main, ordinary UI and recovery descriptors; any new preparation reads must fit the unspent plan reservation. |
| Rejection | Missing native alias, duplicate registration, unmapped later stage and premature RPC are denied without new trial debit. |

The RED and GREEN source tests use `tests/read-authority-publisher-alignment.test.mjs` and local synthetic records only. This is controller correctness evidence, not actual provider, Core, production or release acceptance. No Apps Script function applies because no `.gs`, route or schema changes were made.

The follow-up regression checks that each ordinary main debit has exactly one
admitted publisher-stage descriptor. A synthetic native successor refuses an
unstaged P call before callback or debit, accepts an exact staged P call with
validated write cleanup, and refuses a later unstaged B write without another
debit. JS and Python UI parsers reject write methods outside the fixed alias
rule while accepting declared click/fill and readonly snapshot projection.
Legacy local fixture rows use those declared methods. These remain synthetic
source tests; no actual provider or canonical journal was exercised.

## 2026-10-24 C3 native publisher forward protocol correction

| Check | Local synthetic boundary |
| --- | --- |
| Full native successor journey | Real controller and Python ledger import the settled 128 bootstrap, register a complete plan, execute mapped fixed and native before calls, prepay one 360-second H, separately settle F/G after calls, and finish the RPC. |
| Stage rollover | A six-call baseline remains exact. The executed thin map uses seven UI primitives and the later freshness map uses fifteen; actual map count, future minima, protected recovery and combined limits still apply. Seven baseline calls and advancement with an unfinished prior row stop. |
| Conditional terminal path | Exact T descriptors are staged before H. Successful H may leave T unused; an unknown H is not replayed, permits its three staged terminal reads and retains independent I cleanup through the same real holder. |
| Existing refusal gates | Missing native alias, unstaged P/B, incomplete plan, duplicate owner and wrong UI write method retain their focused regression coverage. |

These are synthetic one-primitive callbacks through the local ledger. They do
not establish actual Google identity, privacy, callback destinations, source
equality, quota or compatibility. No Apps Script, API, Schema or Worker source
changed; cloud Apps Script functions are not applicable. Final composed-source
CI/Core review and actual prestart evidence remain separate gates.

## 2026-10-24 C3 exact SIMPLE credential-holder compatibility

`tests/read-authority-trial-credentials.test.mjs` constructs both existing
credential holders with the imported `SIMPLE_DECISION`. The publisher test uses
the synthetic pinned grant fixture and checks one charged refresh and one
charged same-token userinfo read. The native test checks distinct before/after
caller and publisher reads, with one charge and fetch per operation. Old or
mismatched controls stop before callback; arbitrary decisions, actor/scope
mismatch and stale expiry remain denied. The pre-fix focused run failed three
new cases at holder construction; the same file passed 31/31 after the narrow
allowlist change. No actual credential, Google operation or production acceptance
is established. No Apps Script function applies because no `.gs`, route or
schema changed. Exact composed-head CI/Core review remains pending.

## 2026-10-24 C3 mapped I cleanup navigation source regression

| Check | Local synthetic boundary |
| --- | --- |
| UI descriptor | Only an existing publisher `I:` alias at its fixed original-settings, original-triggers, thin-settings or oauth-audience target may use `navigate`; the main alias methods remain fixed. Wrong actor, target, key, preparation flag, unit count and undeclared write method are denied in JS and Python. |
| Same-owner ordering | After ordinary STOP and drain, a mapped, settled, successful readonly UI prelude may precede the same-key main cleanup action. Navigation alone does not mark the alias complete or prove restored remote state. A separate main read is still required. |
| Recovery guard | Ordinary-cap cleanup, an unmapped recovery row and a mapped UI write before its main action stop before the provider callback. The 16 UI recovery and 21 main cleanup limits remain independent. |

The focused test uses the real holder and Python ledger with a synthetic settled
128 bootstrap. It charges one UI navigation and one bounded main read on the
same owner, then checks the durable cleanup checkpoint. This is local source
evidence; it does not establish actual browser reachability, account binding,
remote restoration, or production acceptance. No Apps Script function applies
because no `.gs`, route or schema changed.

## 2026-10-24 C3 native PREP checkpoint and baseline grounding

| Check | Local synthetic boundary |
| --- | --- |
| Native clean resume | A real holder imports the settled 128 history, maps six baseline UI rows with fixed cleanup, charges original-settings navigate and evaluate, closes at PREP/CLEAN_PAUSE with a genuine `HANDOFF_CLOSED` receipt, and a new holder resumes at 130 without replay, W0, RPC or main debit. |
| Resume denial | Wrong or stale receipt/hash/count, fresh reentry, altered current registry, frozen origin, source chain, owner, pending, failed/unsettled PREP, STOP, TRIAL, W0 and RPC states all stop before a callback. |
| Grounding reallocation | The finite original-target map accepts baseline caps 6–9. A cap-nine real holder charges settings goto/project and extra original-triggers goto/project before clean pause at cursor four (spent 132), then a new holder charges the declared original-settings return goto to 133; W0 remains null and no A row has run. Partial and malformed shapes are checked separately; the existing generic seven-row baseline remains denied. Each actual extra row transfers one diagnostic future minimum, never more than three, within 73 remaining ordinary UI calls. |
| Resumed cleanup | An unmapped A debit stops a resumed holder before callback; its independently mapped readonly I cleanup still charges one UI recovery primitive under the separate 16 UI/21 main recovery ceilings. |

The inherited loading-layer thin-settings-to-audience rule now yields only to an
already registered native publisher baseline PUREPREP row for original settings
or original triggers while still in PREP with no W0. The fixed six loading steps
retain their checks. These tests use local synthetic callbacks and pinned fixture
data; actual browser, provider, canonical ledger, private parent resume gate,
source equality and production acceptance remain separate. No Apps Script test
function applies because no `.gs`, API route or Schema changed.

## 2026-10-24 — CI source checkout selection

Both rental acceptance jobs check out the immutable pull-request head SHA, with
the immutable push SHA as fallback. This keeps source-identity checks aligned
with the selected source on both supported event types. Local YAML parsing,
ref/event assertions, validation and diff checks are configuration checks;
reviewed source must still receive a complete CI run before acceptance.

## 2026-10-24 C3 zero-debit native PREP recovery source

The predebit recovery tests use an owned temporary fixture and the real
controller, inherited lock and Python ledger. A stopped 55-event PREP holder
with a registered nine-row baseline admits one separate recovery segment only
after exact origin/proof checks. The test verifies 128 spent once, unchanged
event, failure, imported-bookkeeping and STOP evidence, then closes a genuine
clean pause and resumes its new segment without a callback. The production
fixed hashes reject the synthetic fixture; a test-only module copy adapts
exactly four constants to synthetic hashes while leaving all function bodies
unchanged. Separate transaction tests interrupt after each archive, initial
target snapshot, receipt, claim, journal and registry phase and reject a second
scope. Real-controller handoff negatives corrupt an archive or receipt target
hash/owner and assert no new claim, registry write, or callback. New event, pending
IO, trial clock, RPC, mutation, altered stage and registry evidence are denied.

The retained short-cell driver has a separate synthetic test for a wait spanning
multiple cells, one callback, lost-owner refusal and sanitized error reporting.
These tests do not run CUA, reattach a browser, spend any actual metadata unit,
or establish the remaining stage map. No Apps Script function applies because
no `.gs`, API route or Schema changed.

## 2026-10-24 C3 predebit bootstrap and deferred Settings identity gate

The public predebit recovery branch alone accepts the exact three-row
`getBrowser → claimTab → evaluate` diagnostic map after the unchanged nine-row
baseline registration and before any baseline debit. The third diagnostic
evaluation proves only the current Audience URL, project, readiness and heading;
the journal remains `bootstrapIdentity: PENDING`. The only next ordinary calls
are the already mapped original-Settings goto, which must return
`AWAITING_NEXT_PROJECTION` with no field read, and its Settings grounding
evaluation. The latter must return the current exact principal, project, URL
and retained handle before the journal becomes `VERIFIED` and the remaining
baseline rows can proceed. A context result alone cannot release an A row.

The real controller/Python-ledger synthetic fixture checks 128→131 after three
charged diagnostic events, 133 after the two Settings preparation events,
UI 75→78→80, unchanged incident/repair highwaters, no W0/RPC, and genuine
pause/resume at both identity states. It also checks baseline-before-bootstrap,
reordered/duplicate diagnostics and context-only A refusal before callback;
wrong current context or principal leaves the debit and pending evidence in
HARD_STOP. Registration reserves nine baseline calls and the conditional
21 thin + 17 OAuth + 21 freshness + 2 terminal = 61 future minimum; spending
the diagnostic three does not reduce that minimum again. The full map, actual
callback/handle, complete cleanup and later A/H/RPC fit remain unproved. No
Apps Script function applies because no `.gs`, API route or Schema changed.

## 2026-10-24 C3 native preplan publisher P and original A registration

The predebit recovery branch has a dedicated `registerPublisherAReads` capability
that admits only two source-pinned main-read phases. After diagnostic three and
the first five settled baseline PREP rows, phase `initial` adds the exact two P
descriptors while preserving the already registered original-project A row.
The first A UI read starts W0; P refresh and userinfo, then the original-project
GET, consume ordinary main units. Its successfully settled, typed sanitized
project receipt binds phase `remaining` to the original script, Cloud slug and
container parent hashes. That second phase admits only the five remaining A
GETs, with the ACL target hash matching the charged project receipt. The
private adapter must verify actual URLs and callback mapping against its
separately pinned callback graph before submitting these public proofs; the
shared `sourceSha256` is the existing pinned public simple-control protocol
anchor in both phases and the charged project receipt;
initial P2 target attestation is deterministic mapping, with provider readback
only on the later charged call. An in-progress PREP
registration cannot pause; a later thin stage requires all P2/A6 calls and
baseline UI calls to have succeeded. Generic preplan stage and RPC gates stay
closed.

The real-controller/Python synthetic fixture uses the actual immutable baseline
ID shape `future-baseline-1` through `-9` and derives the two Settings identity
rows from registered descriptors. It proves phase ordering, byte-identical
original-project map, real charged settlement, receipt-to-ACL binding, exact
main 61/UI 87/combined 148, plan null until `completePlan`, and successful
full-plan reconciliation. Negative cases refuse malformed maps, source drift,
replay and detached ACL evidence before an uncharged callback. These tests do
not establish actual provider readback, private adapter binding, full composed
CI or deployment. No Apps Script function applies because no `.gs`, API route
or Schema changed.

The independent Task80 review fix binds `sourceSha256` to the unique pinned
public `read-authority-simple-control.mjs` sibling source in both readiness
phases and the charged project receipt. A different source already present in
the fixed inventory is rejected. Focused real-controller tests also refuse
identity/proof drift, early P/A and later-stage attempts, a malformed project
receipt, forged pending or failed synthetic checkpoints, and omitted or
relabelled registered descriptors in the full plan. Private callback graph
pinning and actual provider readbacks remain separate owner work.

## 2026-10-24 — bounded CI Worker resource observation

The existing `read-worker` job starts a passive Linux `/proc` observer beside
the unchanged `npm run test:worker 2>&1 | tee` command. The shell retains
`pipefail`, its test exit status, the complete raw Worker log, and the existing
always-run terminal summary. The observer records at most one sample every
500 ms for 600 seconds, up to 32 owned descendants per sample and 8 MiB of
JSONL in `RUNNER_TEMP`; it stops on shell exit and records its own terminal
status. No process environment, command line, unowned process, or arbitrary
process name is exported. PID plus process start tick guards CPU deltas from
PID reuse. CPU is retained in scheduler ticks, RSS in pages, and the mapped
current cgroup's quota/throttling in its original units; zero, missing and
invalid values are separate states. A bounded terminal line includes up to
eight owned-process CPU/RSS totals and first/last cgroup counters, with drops
explicit. An absent observer result is `UNAVAILABLE`, never a Worker PASS.
The self-observer is excluded from Node/workerd attribution.

Synthetic Linux proc/cgroup fixtures and abort/closed-file lifecycle tests
cover parsing, ownership, bounds, missing and invalid data, PID reuse, numeric
zero and final summary. These are source-level evidence checks; no real
Ubuntu CI/resource observation or Worker benchmark was run for this change.
The observer adds background process/I/O overhead, and sampled process totals
cannot identify a route hotspot, prove a latency cause, or establish Production
performance. Rollback reverts this observer/workflow-only commit; the original
Worker test and strict `<50 ms` gate remain the acceptance authority.

The separate always-run resource step now reads the capped JSONL after the
test and emits typed numeric frames into its own CI step log. It keeps first,
last, peak CPU-delta and peak RSS observations for each of the 48 most recent
Node/workerd identities, then prints them in sample order under a 59 KiB frame
budget. It reports invalid source records, earlier identities evicted, output
frames dropped, source drops and missing samples; an unreadable file is
`UNAVAILABLE`. This preserves late test processes beyond the terminal summary's
first-eight totals while leaving the original always-run Worker raw-log summary
in its own subsequent step. Synthetic readback with ten earlier identities and
late Node/workerd processes proves their PID/start-tick/CPU/RSS/wall/cgroup
values remain visible; malformed and over-limit records are explicitly partial.

Follow-up review found that the first/last/peak and 48-identity selection could
still discard a capacity process before later tests ended. The CI resource
readback now projects **every valid collected sample** in original order into
typed numeric/enum frames, including all Node/workerd rows and cgroup status;
it does not select identities or trim old frames. The producer's 1,201-sample,
32-process and 8 MiB limits remain. Each projected frame is capped at 10,240
bytes; fixed prefix plus 2,048 bytes metadata yields a derived output bound of
12,331,514 bytes. Invalid/missing/source-dropped records are counted and
cannot be called COMPLETE. Synthetic coverage retains five consecutive
workerd samples before 60 later identities and 240 frames beyond the former
59 KiB trim. This is a bounded diagnostic log, not route CPU attribution.

## 2026-10-24 C3 projection-settlement minimal fixture invariant

The focused absent/false projection-verification test initializes the
`predebit_recovery` mode explicitly in its `object.__new__` ledger fixture, as
the base-mode constructor does. Its four snapshot/evaluate and missing/false
cases continue to require `TRIAL_STOPPED` before pending clears or the event
settles. This repairs test setup only; no production source or acceptance
threshold changed.


## 2026-10-25 C3 OAuth local cancellation and independent cleanup

`read-authority-trial-oauth.test.mjs` now distinguishes synchronous local
`requestCancellation()` from explicit `cancel()` under independent cleanup.
Abandonment, credential expiry and waiting/claimed listener close, timeout or
failure stop ordinary admission and clear callback/verifier/credential views
without invoking cleanup. An issued late token remains in the original holder
for later cleanup; failed receipts remain failed across explicit cancellation.
A successful ready flow survives normal listener disposal, preserving the
existing preparation caller contract.

Concurrent cancels share pending admission. Admission denial without callback
entry does not claim a remote revoke, ACK or verification eligibility; a later
explicit attempt remains subject to the same capability/ledger with no refund
or inferred zero debit. Actual callback entry permanently consumes the one
factory dispatch, including provider, disposal or receipt failure. Bounded
active/cardinality and exact-result checks reject skipped, cloned, repeated,
late, rejected or detached cleanup callbacks and drain entered work. UNKNOWN
is written only inside the owned callback; ACK follows exact owned settlement.
A compromised journal cannot support a verified success claim, but does not
prevent the one real independently admitted revoke.

`verifyRevoked()` remains one-use, independently admitted, limited to this
holder's previously accepted token before its verified expiry and the exact
userinfo endpoint/401. Disposal settles before proof, and forged cleanup
results cannot authorize rejection proof. Issued but unverified tokens can be
revoked without fabricating identity proof. Original revoke ACK/UNKNOWN and
`revocationAccepted:false` / `rollbackComplete:false` remain unchanged.

Focused TDD: original-source RED 59 pass/22 fail; initial lifecycle GREEN81/81;
listener/error and verification-settlement RED0/7 then final OAuth89/89.
The affected phase-control expiry case now expects local stop followed by
explicit independent cleanup:17/17 with unchanged real Python ledger/flock
under a private owned filesystem seam. Its initial seam validation failure
(1 pass/9 fail/7 cancelled) is retained and does not count as a source failure
or ledger acceptance. OAuth registry construction temporarily substitutes
`os.homedir` and restores it immediately; actual HOME/CODEX_HOME are unchanged.
No provider, real credentials, actual namespace or actual budget was touched.

The unchanged preparation-realm caller suite, full unit/Worker/Core and exact
composed CI remain DEFERRED NOT WAIVED for parent qualification of the final
selected source. This bounded source prerequisite does not complete Task94's
real-holder/Python-ledger retained-forward integration or actual cleanup map.
No Apps Script test function applies: no `.gs`, route or Schema changed.
Actual admission remains false;296 accounting/history, rates/single-inflight,
cleanup reserves, one RPC, performance/device/freshness/24-hour gates remain.


## 2026-10-25 Local cleanup disposition observations

The existing thin/standalone publication, OAuth, sheet Reader and standalone
script Reader factories expose synchronous `cleanupDisposition()` with no
arguments. Arguments reject with the existing `TRIAL_STOPPED`. Every call
returns new detached deeply frozen own-data objects. Observation performs no
filesystem, clock, credential, capability, provider, event or debit operation;
it never refreshes, expires, clears, consumes, persists or authorizes state.

| Common field | Exact meaning / finite domain |
| --- | --- |
| `schemaVersion` | `1` |
| `resource` | `deployment`, `oauth-token`, `sheet-reader`, `script-reader` |
| `integrity` | `locally-uncontested` = no locally detected receipt/ownership/protocol failure; `compromised` = sticky known failure or ambiguous detached/duplicate cleanup callback. Neither is a fresh filesystem/canonical integrity proof. |
| `inFlight` | This factory instance has a publish/grant/OAuth method, cleanup method or cleanup callback still pending. False says nothing about another instance or canonical pending. |
| `resourceDisposition` | `not-dispatched` = no known resource attempt; `attempted-known` = retained owned deployment target, known Reader permission/owner pair, or previously received token; `attempted-unknown` = attempt known without that handle. No success, absence, admission or remote-settlement claim. |
| `actions` | Frozen `close`/`verify` for deployment; `remove`/`verify` for Readers; `revoke`/`verify` for OAuth. Each action has the fields below. |
| action `requested`, `entered` | Cumulative local method request versus cleanup capability callback invocation; existing persisted attempt latches also establish historical request/entry where applicable. Reader `NO_GRANT` consumes removal without callback entry. No callback entry never proves zero canonical spend. |
| action `pending`, `result` | Method still pending; result is `pending`, `not-observed`, `returned` or `rejected`. Result describes the latest locally settled invocation, including local/pre-admission rejection. |
| action `callbackPending`, `callbackResult` | Callback still pending, independently of the outer method; result is `pending`, `not-observed`, `returned` or `rejected`. Historical journal state alone never reconstructs callback settlement. |
| action `consumed` | Existing attempt latch, retained monotonically in this instance. OAuth verification consumes before admission; denied revoke callback does not consume. No new retry permission. |
| action `outcome` | Existing canonical factory journal value, preserved without reinterpretation; may disagree with retained latches after integrity failure. |

Deployment adds `createAttempted` (monotonic local/journal intent latch, which
can precede transport), `createOutcome`: `NOT_SENT`, `UNKNOWN`, `ACK_MATCHED`.
Close outcomes: `NOT_STARTED`, `UNKNOWN`, `ACK_UNVERIFIED`; verify outcomes:
`NOT_STARTED`, `UNKNOWN`, `ABSENT_AT_READBACK`. Stopped status never hides the
known owned deployment or UNKNOWN create. Inventory cannot adopt another ID.

Readers add `grantAttempted` (monotonic local/journal intent latch) and
`grantOutcome`: `NOT_SENT`, `UNKNOWN`, `ACK_MATCHED`, plus `READER_VERIFIED` for
the sheet profile only. Remove outcomes: `NOT_STARTED`, `UNKNOWN`,
`ACK_UNVERIFIED`, `NO_GRANT`; verify outcomes as deployment. A known owned
permission target can survive UNKNOWN grant. `verifyRemoved()` still rejects
`NO_GRANT`. Existing refresh reads merely annotate identity/attempt regression;
their canonical assignments and cleanup behavior are unchanged.

OAuth adds `exchangeAttempted` (transport dispatch latch), `tokenHeld`,
`tokenPreviouslyAccepted`, `acceptedTokenExpiresAt` (retained existing accepted
expiry or null), and `verificationTokenHeld`. Previously received but unaccepted
issued tokens can be revoked and never support verification. After cancellation,
ordinary credential access remains closed; accepted provenance/expiry survive.
Revoke outcomes: `NOT_NEEDED`, `TOKEN_UNAVAILABLE`, `UNKNOWN`, `ACK_UNVERIFIED`;
verify outcomes: `NOT_STARTED`, `UNKNOWN`, `REJECTED_AT_READBACK`. Revoke consumes
at callback entry; verification consumes before admission. Readback 401 only
proves rejection of the previously accepted token at that observation, never
causal/grant-wide revocation or rollback completion.

No raw token, account, permission/resource identifier, journal path, credential
reference, setter, callback or authority flag is exposed. Only nonsecret booleans,
small callback/method counters and finite result metadata are added; existing
accepted expiry is reused. No credential lifetime, journal schema, listener,
consent, PKCE, verification, revoke, canonical retry or cleanup rule changes.
Later orchestration must independently recheck owner, pending, settled events,
claim, registry, source and dependency state. Known compromise or in-flight work
cannot establish eligibility. Canonical scope failure still rejects finally.

| Verification | Evidence boundary |
| --- | --- |
| Initial factory-transition TDD | 12 RED (missing method) then 12 GREEN; source-only owned fixtures |
| Detached callbacks / verification denial | 6 focused assertion RED then GREEN; independent callback settlement remains visible |
| Checksum-valid ownership/attempt regression | 3 RED then GREEN; no new cleanup guard or IO |
| Ordinary stopped-status integrity error | 1 target Node22 RED then GREEN; sticky observed failure |
| Final affected module tests | Node22.23.3:215/215 PASS, zero fail/cancel/skip;26 added cases. Four changed factory test modules only, including existing synthetic preparation-ledger integration and adversarial OAuth cleanup tests |
| No-IO/privacy/immutability | Each factory profile covered with filesystem hooks forbidden, injected clock/credential/capability guards and detached immutable snapshot assertions |
| Apps Script / real provider / source acceptance | N/A for Apps Script; real provider, browser, runtime composition, CI, release and production acceptance unclaimed |

Rollback is a reviewed scoped source revert before use. Preserve old immutable
candidates, UNKNOWN attempts, stopped journals, canonical charges and history.


### Cleanup callback lifetime observation correction

Each cleanup invocation now retains its own nonsecret active marker, closed
when that invocation settles. A first callback entering after its own invocation
has settled latches the existing sticky `compromised` integrity value, including
when a later invocation is pending. The observation neither blocks nor invokes
callbacks and does not alter existing IO, throw, receipt or consumption behavior.
The snapshot schema and canonical authority boundary are unchanged.

Six focused late-entry regressions cover both publication profiles, both Reader
profiles and OAuth pre-entry rejection with/without a later pending revoke.
They assert preserved DELETE/throw behavior, original snapshot detachment and
sticky compromise after callback settlement. Target Node22.23.3 RED6 then GREEN6;
final affected four-module221/221 PASS (zero fail/cancel/skip), syntax7/7, validate
and diff-check PASS. Initial215/215 evidence remains historical.


### Publisher credential native OS ownership context

The existing credential module now exercises an owned synthetic profile in an
isolated imported-module subprocess with no global process. Native OS UID
permits the existing paid refresh and same-token identity sequence; mismatched,
unavailable, invalid or throwing UID denies before grant bytes or network.
The source remains byte-identical with unchanged metadata and charge labels;
no global shim, caller UID or credential bypass is introduced. Existing source
mode, no-follow, stable-file/hash, scope, identity, expiry and no-retry guards
remain covered. This local context regression is not provider, actual CUA
credential, CI, admission or release acceptance.

The subprocess fixture resolves native OS tmpdir to its canonical path before
removing global process, preserving owned directory700/file600 on macOS and
Linux. An owned native-temp override outside /private/tmp exercises all five
UID cases locally; this portability check is separate from Linux CI evidence.

### 2026-10-26 — canonical property summary consolidation (local candidate)

`tests/read-parity-engine.test.mjs` executes the canonical GAS property-view
helper on 500 materialized plain active room views across 20 properties. A
VM-local, restored Array observer measures callbacks, filtered-array allocations
and input-array reads: the original helper gives 2,000 / 80 / 500; the one-pass
candidate gives 500 / 0 / 500. This verifies exercised work reduction, without a
timing threshold or a capacity claim. Explicit full-view expectations preserve
strict account/effective status literals, unknown/blank/null/numeric/mixed-case
statuses, archived exclusion, duplicates, sparse/empty inputs, field/key order,
room/owner references and source order; inputs remain unchanged.

Affected canonical/read tests cover calculation parity, legacy write scope,
collation and route boundaries. The existing local Worker read-parity module
checks complete GAS/HTTP result identity through disposable D1, including its
unchanged small-fixture samples. The generated calculator and all 15 source
manifest hashes must match canonical GAS provenance. No cache, authority,
projection, fixture, timer or threshold changes accompany this consolidation.
The original capacity failure and strict `<50 ms` gate remain outstanding;
source consolidation does not establish latency improvement or full branch
acceptance. Independent review and the next already-required composed release
qualification remain required before integration/publication.

Task116 local evidence: 25 affected root tests and one Worker parity test pass;
`npm run validate` passes backend parsing/static-cache checks, then fails the
existing comparison-source identity check. Comparison identity/epoch and active
observations remain untouched. Qualification must regenerate the composed
identity and restart the affected real observation under its existing plan;
this candidate is not a green full-branch qualification.


Task116 source synchronization continuation closes the comparison/cache artifact
gap with future candidate tag `20261026-read-summary-v1`: mechanical shared
asset-query substitutions, matching validator/test literals, and regenerated
comparison identity from the unchanged generator. Endpoint remains blank and
all six routing flags remain `off`. T0 is NOT_STARTED: no real observation has
been restarted, reset or accepted. Eight affected comparison/cache test modules
and final validate check the synchronized candidate; the original canonical and
local Worker parity evidence remains carried forward on unchanged helper,
calculator and source-manifest bytes. Capacity/performance, real observation,
authenticated/device and release gates remain outstanding; no publication.

## 2026-10-26 read authority from synced D1 and sync heartbeat

- Worker: authority uses synced D1 rows only; tests cover suspended members,
  disabled users/workspaces, viewer/tenant roles, revoked and expired Email
  sessions, missing or stale (> 15 min) heartbeat, and the signed
  `/sync/heartbeat` endpoint (forgery, replay, invalid body, older version).
- Apps Script: idle and drained dirty runs post one signed heartbeat; failed
  and full runs do not; `installV2ReadReplicaTriggers` creates a 5-minute sync
  and a 03:00 Asia/Taipei reconciliation.
- Frontend: write guard is 7 minutes.
- Synthetic latency budget: enforced locally, reported only when `CI` is set.

## 2026-10-26 keyless and repeated-ID replica rows

First production full sync failed for `V2_users` (one repeated `user_id`),
`V2_payments` (legacy rows without `payment_id`) and
`V2_landlord_tenant_list_view` (one row without `tenant_id`). Sheets are not
modified. Keyless rows sync as `row:<sheet row>`, later copies of a repeated
ID as `<id>#row:<sheet row>`; the Worker accepts only keys that match the
row's own ID and Sheet row, and merges scoped reads by Sheet row plus ID so
every row is kept. Patches without a Sheet row still require a real ID.
Tests: Apps Script projection, Worker `/sync` acceptance and rejection, merge.

## 2026-10-27 iOS-style liquid glass bottom navigation

`landlord-glass-nav.js` + the `.bottom-nav.glass-ready` block in
`landlord-responsive.css` (phones only) on the 11 landlord pages that load the
shared stylesheet. The bar never scales; a lens slightly larger than its tab
(about 2px past the bar) follows the finger, stretches sideways while moving
and settles into a soft pill. Pages without the script keep the old bar.
Fixed shell (`.bottom-nav` absolute at bottom, safe-area padding) unchanged.
Tests: `tests/glass-bottom-nav.test.mjs`; checked in a 375px browser and on a
real iPhone (LINE/Safari) through iPhone Mirroring with the synthetic preview.

## 2026-10-27 Bright glass shell (redesign phase 2)

`landlord-glass-theme.css` (last stylesheet in `<head>`) and
`landlord-glass-shell.js` on the 11 main landlord pages: neutral light
background, floating navy desktop rail with hover tooltips and a workspace
card, sticky glass top bar, translucent cards, navy pill primary buttons,
press/hover motion via the `scale`/`translate` properties, and a one-time
staggered card entrance. Card and button rules use `:where()` so coloured
page heroes and button variants keep their own styles. Per-page layouts
are phase 3.

Tests: `tests/glass-shell-theme.test.mjs`; checked with the synthetic home
preview at 1440px and 375px and with the tenant-detail shell at 1440px.
Pages that need login were not rendered locally; check them in LINE and
the desktop browser after publishing.

## 2026-10-27 Bright glass phone layouts (redesign phase 3, batch 1)

Phones only (`max-width: 1023px`), styling only. Home (`landlord-home.css`):
light glass hero with green ring and amber unpaid chip, to-do items as a 2×2
grid of glass cards, quick functions as glass tiles. Shared
(`landlord-glass-theme.css`): navy titles, light glass versions of the
purple/blue/green page heroes (billing, properties, settings, tenants),
two-column stat grids, pill filters, search and `.btn` buttons, a single
scrolling filter row on rooms, tenant card finance strip and actions.

Tests: `tests/glass-shell-theme.test.mjs`; checked at 375px with synthetic
data for home, tenants, arrears, rooms, properties and more, and without
data for billing and settings. Desktop rules unchanged.

## 2026-10-27 Bright glass phone layouts (redesign phase 3, batch 2)

Phones only (`max-width: 1023px`), styling only, in
`landlord-glass-theme.css`. Tenant detail: glass circle back/refresh
buttons, light profile hero with round avatar, record links as stacked
pills, navy upload buttons, quick actions as a 2×2 grid of glass cards.
Contract requests: glass circle refresh button, round avatar, pill selects,
glass request cards, navy primary and translucent light buttons, rent and
fee comparisons spanning the card. Both pages keep two-column grids down
to 340px instead of collapsing to one column at 390px.

Tests: `tests/glass-shell-theme.test.mjs`; checked at 375px with synthetic
data for both pages. Desktop rules unchanged.

## 2026-10-27 Bright glass desktop layouts (redesign phase 4, batch 1)

Styling and desktop rail markup only. `landlord-glass-theme.css`: the
phone-only colour rules (light glass page heroes, navy primary actions,
pill filters/selects/search, glass circle header buttons, round avatars)
now apply at every width; layout rules stay phone-only. Desktop: stats in
one row, arrears cards two per row and room cards three per row from
1280px. Desktop rail: 退房, 帳款, 營收與資產 and 更多工具 get their own icons
on every main landlord page; billing's text-only rail gets icons and
tooltips, plus the glass desktop top bar. Entry (login) page unchanged.

Tests: `tests/glass-shell-theme.test.mjs`; checked at 1440px with synthetic
data for tenants, arrears, rooms, properties, more, billing, settings,
tenant detail, contract requests and home, and rechecked tenants,
properties, tenant detail and home at 375px.

## 2026-10-27 Glass bottom navigation matches the iOS tab bar

From the owner's recording of the native tab bar, shared with the Libenest,
No.88 and cmwebs.com docks: the lens is only ever wider than its tab, never
taller (`PRESS_SCALE = [1.06, 1]`; pressing spreads it to 1.14 and back, travel
stretches it sideways only), so it stays inside the bar. Pressing the first or
last tab tugs that end of `.bottom-nav-inner` out 7px by margin and lets it
spring back; the bar is never transformed. The lens has no backdrop filter
(WebKit draws a transformed backdrop as a square block) and held tabs no longer
open the iOS link preview (`-webkit-touch-callout: none`). Release
`20261028-glass-nav-native-v1`; read comparison identity regenerated. Tests: `tests/glass-bottom-nav.test.mjs` (5); checked
with the synthetic home preview at 390px: left end 12 → 5.5px and back, right
end and top unchanged, lens height ratio 1 while pressed and dragged.

## 2026-10-28 Email login entry and registration page fixes

LIFF SDK 2.31 (served from the rolling `edge/2` URL) now throws from
`liff.getIDToken()` before `liff.init()`. The Email entry page reads auth
params before any LIFF init, so it showed "房東入口載入失敗". The shared token
helpers in `landlord-auth.js` and `liff-request-auth.js` now treat that throw
as "no LINE token"; LINE pages still init LIFF before reading a token.
The entry page's desktop rail gets icons with tooltips. The registration page
loads the glass theme and gets a padded card, a pill Email/LINE switch and a
navy submit button; on wide screens the form stays centred and the scrollbar
sits at the window edge. Release `20261028-entry-register-fix-v1`; read
comparison identity regenerated.

Tests: `tests/liff-uninitialised-token.test.mjs` (4; the auth-params test
fails on the previous helper). Checked against the real LIFF SDK on a local
static server: `landlord-entry.html?mode=email` shows the Email login form;
`landlord-register.html` at desktop width and at 375px with no horizontal
scroll.

## 2026-10-28 Revenue and assets page joins the bright glass shell

`landlord-revenue-dashboard.html` had its own `av-desktop` sidebar and none
of the glass shell. It now uses the shared desktop rail (icons, Workspace
footer, logout), the sticky glass top bar with a refresh pill, the glass
theme and the glass bottom navigation. The valuation block, rate buttons,
selects and chart cards use the navy/glass colours. Desktop: KPIs three per
row, bar charts capped at 220px high, and the overdue-age and contract-expiry
cards side by side. The monthly chart's y-axis gutter is wider so labels such
as 224,000 are no longer clipped. Release `20261028-revenue-glass-v1`; read
comparison identity regenerated.

Tests: `tests/asset-income-valuation.test.mjs` (shell assertion updated),
`tests/glass-shell-theme.test.mjs` now covers this page; checked with
synthetic data at 1024px and 375px (no horizontal scroll).

## 2026-10-28 Six more landlord pages join the bright glass shell

`landlord-activity.html`, `landlord-announcements.html`,
`landlord-bill-notifications.html`, `landlord-notifications.html`,
`landlord-team.html` and `landlord-tenant-checkin.html` now use the shared
desktop rail (the matching item is current: 帳款 for bill notifications, 房客
for check-in, otherwise 更多工具), a Workspace footer, the sticky glass top bar
with the page title, Workspace name and a refresh pill (bill notifications
also keeps 帳單管理), the glass theme and the glass bottom navigation. The bill
notification send bar floats over the content column on desktop instead of
spanning the rail. Phone
headers are unchanged; on desktop the theme hides a page's own `.topbar`
beside the glass top bar. Release `20261028-glass-pages-v1`; read comparison
identity regenerated.

Tests: `tests/glass-more-pages.test.mjs` (new) checks each page's shell,
current rail item, top bar title and refresh action, the Workspace name fill
and the desktop-only header rule; `tests/glass-shell-theme.test.mjs` now
covers these pages. Checked with synthetic data at 1280px and 390px.
