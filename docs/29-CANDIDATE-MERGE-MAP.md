# V2 Candidate Merge Map

- 分析日期：2026-07-19（Asia/Taipei）
- Production canonical：`apps-script/`
- Candidate Apps Script：`_handoff/cmwebs-codex-handoff-2026-07-18/candidate-overlay/apps-script`
- 依據：實際 content／function／dependency scan 與 `docs/28-CANDIDATE-GAP-REPORT.md`

本文件逐一記錄 Candidate 的 21 個 Apps Script modules。它是 dependency/merge map，不是 merge 指令；本輪不搬移任何 module。

## Reading rules

- `Depends on`：Candidate source實際呼叫或 runtime必須擁有的 module/function owner；包含 Candidate 自身缺少的Production owner。
- `Required Before`：進行該 module的任何獨立驗證前必須先具備的ownership/configuration。
- `Required After`：該 module就位後必須接續驗證的downstream consumer或flow。
- `Runtime Risk`：若有人把Candidate module單獨搬入Production或與現行module並存時的風險。
- `Estimated Merge Size`：Candidate相對Production的實際功能diff。括號內LOC只表示需review的source surface，不表示有這麼多新增行。
- `Estimated Test Scope`：若未來做rename/ownership normalization，至少需要的回歸範圍。

Merge size classification：

```text
No-op      byte-identical；0 functional delta
EOF-only   only trailing whitespace；0 functional delta
```

所有 Candidate modules均已存在於Production；不能把LOC誤當新增程式量。

## Module merge map

| Candidate Module | Depends on | Required Before | Required After | Runtime Risk | Estimated Merge Size | Estimated Test Scope |
|---|---|---|---|---|---|---|
| `Code.gs` | 所有first-level handler owners；特別是`V2_API`、binding、tenant onboarding、Workspace modules | 完整30-module Production set、manifest、secure config、唯一dispatcher policy | 68 routes／68 handlers／6 proxy targets／7 helpers；所有LIFF/HTML callers | **Critical** — 與`程式碼.js` byte-identical，並存會重複dispatcher／globals；Candidate本身缺runtime modules | No-op（1,997 LOC） | Route set、doGet/doPost、JSONP/bridge、webhook、handler coverage、credential gate |
| `V2_ANNOUNCEMENT_MANAGEMENT.gs` | `V2_WORKSPACES`、Workspace access、notifications、operation audit；LINE fetch path | Workspace scope、notification owner、LINE configuration、capacity safeguards | Announcement UI、send/retry、recipient snapshot、team result event | **Critical** — 大量Sheet操作、LINE發送、capacity repair；duplicate module不可載入 | No-op（4,817 LOC） | Send/retry、cell capacity diagnose/compact/resize、role recipients、LINE failure、audit |
| `V2_AUTO_PAYMENT_REMINDER.gs` | `V2_API` push/log helpers、settings integration、Workspace notifications、billing data | Workspace settings/timezone/hour/days、bills、notification owner、trigger inventory | Hourly dispatcher、final+1 manual handling、LINE/log、trigger dedup | **Critical** — Candidate缺`V2_API`；installer可能操作trigger與大量LINE | No-op（3,798 LOC） | Preview、active/timezone/hour/days、stage dedup、final+1、single trigger、controlled UID |
| `V2_BILLING_MANAGEMENT.gs` | Settings integration、Workspaces、access、notifications、audit | Workspace/room/contract defaults、property/room owner、permission chain | Bill notifications、auto reminder、landlord billing、tenant bills | **Critical** — 核心帳務寫入與通知；duplicate或partial dependency可產生錯帳 | No-op（4,655 LOC） | Previous meter null/0、default order、summer months、generation dedup、views、team event |
| `V2_BILL_NOTIFICATIONS.gs` | Workspaces、access、operation audit、LINE batch fetch | Generated bills、tenant/user LINE binding、role/Workspace checks | Landlord bill-notification UI、message logs、notification results | **High** — 可批次外送LINE；Candidate沒有新增行為 | No-op（2,837 LOC） | Recipient selection、batch result、unbound users、message log、no cross-Workspace send |
| `V2_CONTRACT_REQUESTS.gs` | `V2_API` push/log helpers、Workspace notifications、contracts/rooms data | Tenant/landlord identity、Workspace context、notification center | Tenant contract UI、landlord requests UI、team and tenant LINE events | **Critical** — Candidate缺LINE helper owner；狀態更新與外送需一致 | No-op（5,430 LOC） | Submit/cancel/update、permissions、room/contract status、team event、tenant push/failure log |
| `V2_LANDLORD_MANAGEMENT.gs` | `V2_API` helpers、`V2_PAYMENT_SETTLEMENT`、landlord views | Common sheet/LINE helpers、payment owner、identity data | Workspace access proxies、landlord dashboard/messages/payment reports | **High** — Candidate缺兩個dependency owner；單搬可能出現legacy function missing | No-op（1,329 LOC） | Landlord identity、dashboard data、message push/log、payment report compatibility |
| `V2_LANDLORD_ONBOARDING.gs` | `V2_API` helpers、`V2_WORKSPACES` | Workspace creation/context、payment-account schema decision、secure config | Landlord onboarding UI、properties/rooms、active Workspace | **High** — 會建立Workspace/owner/settings/payment data；Candidate缺common helper | No-op（2,785 LOC） | Multi-workspace onboarding、resume steps、payment masking、properties/rooms、permissions |
| `V2_PROPERTY_ROOM_MANAGEMENT.gs` | Settings integration、Workspaces、access、operation audit | Workspace/payment-account model、default settings、role permissions | Billing generation、property UI、room/contract workflows | **Critical** — 寫property/room與payment account；雙表schema仍待決策 | No-op（5,186 LOC） | CRUD/archive、deposit default、summer months、scope、audit、billing compatibility |
| `V2_SETTINGS_INTEGRATION.gs` | `V2_WORKSPACES` | Workspace context與settings Sheet | Property/room、billing、auto reminder | **High** — 是多個金流/帳務module的default resolver | No-op（1,048 LOC） | Default precedence、summer range、reminder settings、missing-setting fallback |
| `V2_SYSTEM_SETTINGS.gs` | Workspaces、access、audit；announcement/reminder integration hooks | Workspace identity、role model、secure Properties/payment-account policy | Settings integration、property/billing/reminder、announcement capacity controls | **Critical** — 設定影響帳務、催繳、通知與付款；不宜單獨覆蓋 | No-op（3,533 LOC） | Profile/workspace/payment/preferences、phone normalization、masking、trigger/capacity actions |
| `V2_TEAM_MANAGEMENT.gs` | `V2_WORKSPACES` | Workspace membership/role model、phone normalization policy | Invitations、accept/cancel/update/remove、notification recipient selection | **High** — 角色錯誤可造成跨Workspace權限提升 | No-op（1,738 LOC） | Role/permission matrix、invite lifecycle、duplicate phone、owner protection、Workspace isolation |
| `V2_TENANT_CHECKIN_MANAGEMENT.gs` | Workspaces、access、notifications、audit；LINE fetch path | Tenant/contract/room ownership、role checks、LINE config | Check-in UI、welcome message、team event、LINE failure | **Critical** — 多Sheet寫入與外送；Candidate沒有新增行為 | No-op（3,935 LOC） | Init/save/welcome、views、event persistence、controlled LINE、failure/audit |
| `V2_TENANT_MESSAGES.gs` | `V2_API` push/log helpers、Workspace notifications | Tenant identity/Workspace mapping、notification owner | Tenant message UI、landlord messages proxy/UI、team event | **High** — Candidate缺push/log helper；message scope與notification需一致 | No-op（1,139 LOC） | Init/submit/update、team event、tenant reply push/log、Workspace isolation |
| `V2_TENANT_PAYMENT_REPORTS.gs` | `V2_API` push helper、Workspace notifications | Tenant bills/views、payment-account masking、notification owner | Workspace payment-report proxy、settlement、paid-bills、tenant/team notification | **Critical** — Candidate缺helper及四個settlement owners；不能把submit當完整付款流 | No-op（1,268 LOC） | Init/submit/dedup、landlord update、team event、settlement handoff、cross-Workspace reject |
| `V2_WORKSPACES.gs` | `V2_API` common sheet/access helper | Common runtime helper、users/landlords/members/invitations data | Creation、switch、team、access、settings及全部domain modules | **Critical** — 基礎scope owner；Candidate缺`V2_API`，單搬會破壞全域授權鏈 | No-op（2,017 LOC） | Context/active Workspace、membership、invitation、activity、principal compatibility |
| `V2_WORKSPACE_CREATION.gs` | `V2_WORKSPACES` | Authenticated landlord、membership/role rules | Workspace switch、onboarding、settings/team | **High** — 寫入新Workspace與membership；需完整audit/permission | No-op（600 LOC） | Create、duplicate/limit、owner membership、active context、rollback |
| `V2_WORKSPACE_DASHBOARD_NATIVE.gs` | Workspaces、Workspace access、bills/contracts/properties/rooms/tenants | Workspace scope、native view/data owners | `landlord_home`／arrears／tenants routes與三個HTML頁 | **High** — 與Production功能相同；EOF-only merge無價值，並存會duplicate | EOF-only（2,530 LOC） | Home/arrears/tenants、role filtering、empty states、cross-Workspace switch |
| `V2_WORKSPACE_LANDLORD_ACCESS.gs` | `V2_API`、Workspaces、native dashboard、landlord/contract handlers、四個Production-only payment modules | 所有formal targets、role/permission policy、principal compatibility | `Code` landlord routes、logs/messages/payments/contracts與相關HTML | **Critical** — Candidate含proxy但缺targets；最容易產生「handler存在」假陽性 | No-op（1,892 LOC） | 6 proxy targets、role matrix、principal mapping、cross-Workspace read/write、masked bank data |
| `V2_WORKSPACE_NOTIFICATIONS.gs` | `V2_API` push/log、Workspaces、access、settings；announcement integration | Notification sheets/config、DocumentLock policy、LINE helper、role recipients | Billing/payment/contract/message/check-in/announcement event producers與notification UI | **Critical** — Candidate缺push/log owner；與event producers有bundle dependency | No-op（3,036 LOC） | All event types、preference-off persistence、DocumentLock、delivery/failure、mark read |
| `V2_WORKSPACE_OPERATION_AUDIT.gs` | Workspaces、Workspace access | Workspace/actor/permission context | Property、billing、payment、tenant、contract、announcement等所有writers | **High** — 不應在domain write之後才補；audit缺失會失去rollback evidence | No-op（1,304 LOC） | Actor/membership/workspace/target/result、failure path、query scope、retention |

## Dependency observations

### Candidate modules directly depending on missing `V2_API`

至少下列 Candidate modules有跨模組呼叫指向Production `V2_API`：

```text
Code
V2_AUTO_PAYMENT_REMINDER
V2_CONTRACT_REQUESTS
V2_LANDLORD_MANAGEMENT
V2_LANDLORD_ONBOARDING
V2_TENANT_MESSAGES
V2_TENANT_PAYMENT_REPORTS
V2_WORKSPACES
V2_WORKSPACE_LANDLORD_ACCESS
V2_WORKSPACE_NOTIFICATIONS
```

此外其他modules可能透過Workspace notification／access間接依賴`V2_API`。因此只計「Candidate內有第一層function」會低估runtime gap。

### Candidate module with missing payment targets

`V2_WORKSPACE_LANDLORD_ACCESS.gs` 的 payment proxies需要：

```text
V2_PAYMENT_SETTLEMENT.js
V2_MANUAL_SETTLEMENT.js
V2_PAYMENT_REVERSAL.js
V2_PAID_BILL_MANAGEMENT.js
```

四者全部只存在Production。Proxy與formal target必須作一個validation bundle，不能各自宣告完成。

### Mutual event-layer dependencies

`V2_WORKSPACE_NOTIFICATIONS` 與announcement/settings/event producers有互相呼叫或integration hook。Apps Script global scope不應依靠檔名載入順序；`Required Before/After`表示ownership與測試順序，不表示runtime source ordering。

## Merge boundary decisions

| Boundary | Decision |
|---|---|
| Shared Candidate module | 不搬；Production已有相同內容。 |
| EOF-only dashboard module | 不搬；保留Production bytes，記錄provenance即可。 |
| Candidate-only module | 無。 |
| Candidate route | 無新增、修改或刪除。 |
| Candidate Sheet/trigger/LINE path | 無新增。 |
| Missing Candidate dependency | 以Production owner為canonical；不得從Candidate推定移除。 |
| Candidate HTML SAME pages | 不搬；保留repository。 |
| Candidate HTML conflicts | 人工決策與實機測試，不直接cherry-pick。 |
| Candidate overlay as a whole | 不可merge或deploy。 |

## Required review sequence

```text
Production snapshot/hash ownership
↓
V2_API + Workspace/access/audit foundation
↓
Domain modules and formal payment targets
↓
Proxy/handler/helper completeness
↓
Code route coverage
↓
Repository HTML dependency
↓
Workspace/LINE/payment/billing/mobile validation
```

## 本文件建立聲明

本輪只建立merge map；沒有修改任何Production／Candidate程式、HTML、Sheet、trigger、LINE設定、deployment或route，也沒有commit、push、deploy或clasp操作。
