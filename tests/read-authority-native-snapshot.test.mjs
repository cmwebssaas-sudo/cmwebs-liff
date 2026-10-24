import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const mod=await import('../scripts/read-authority-native-snapshot.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND'&&e.message.includes('read-authority-native-snapshot.mjs'))return {};throw e;});
const hash=v=>createHash('sha256').update(v).digest('hex'),referenceAt=Date.parse('2026-10-14T03:00:00+08:00');
function snapshot(rows=[['Synthetic project','syntheticFunction','時間驅動','2026年10月14日 凌晨2:30:00','1.234 秒','已完成']],tail='9 button 前往下一頁'){
 let id=100;const body=rows.map(cells=>'\t\t'+id+++' row '+cells.join(' ')+'\n'+cells.map(c=>'\t\t\t'+id+++' cell\n\t\t\t\t'+id+++' text '+c).join('\n')).join('\n');
 return 'Browser tab: 1, Title: "我的執行項目", URL: "https://script.google.com/home/executions".\n0 AXWebArea 我的執行項目\n\t1 button Description: Google 帳戶： Synthetic caller (caller@example.invalid)\n\t2 switch Description: 即時顯示執行作業。, Value: 0\n\t3 table\n\t\t4 row 專案 函式 類型 開始時間 持續時間 狀態\n'+body+'\n\t5 container 分頁\n\t\t6 text 第  1  頁 (共 多頁 頁)\n\t\t7 (selected) 200\n\t\t'+tail;
}
const input=(s=snapshot())=>({snapshot:s,referenceAt,expectedAccountHash:hash('caller@example.invalid')});
const analyze=v=>{assert.equal(typeof mod.analyzeAuthorityNativeSnapshot,'function');return mod.analyzeAuthorityNativeSnapshot(v);};
test('visible native rows remain partial analysis and never become quota or trial acceptance',()=>{
 const v=analyze(input());assert.equal(v.visibleRows,1);assert.equal(v.distinctRowFingerprints,1);assert.equal(v.visibleDurationLowerBoundMs,1234);assert.equal(v.visibleTriggerDurationLowerBoundMs,1234);assert.equal(v.recent24hRows,1);assert.equal(v.nextPageAvailable,true);assert.equal(v.pageIndex,1);assert.equal(v.selectedPageSize,200);assert.equal(v.liveView,false);assert.equal(v.complete,false);assert.equal(v.quotaAccepted,false);assert.equal(v.trialAccepted,false);assert.equal(v.nativeExecutionIdsAvailable,false);assert.equal(v.perUserAttributionVerified,false);assert(Object.isFrozen(v));assert(!JSON.stringify(v).includes('caller@example.invalid'));assert(!JSON.stringify(v).includes('syntheticFunction'));assert(!JSON.stringify(v).includes('Synthetic project'));
});
test('Taipei AM, noon and PM dates parse exactly; old rows and trigger/manual totals stay separate',()=>{
 const s=snapshot([['P','f','觸發條件','2026年10月13日 中午12:00:00','2 秒','已完成'],['P','g','編輯器','2026年10月13日 上午12:00:00','0.125 秒','已完成'],['P','h','時間驅動','2026年10月12日 晚上11:00:00','3.456 秒','已完成']]);
 const v=analyze(input(s));assert.equal(v.earliestStartMs,Date.parse('2026-10-12T23:00:00+08:00'));assert.equal(v.latestStartMs,Date.parse('2026-10-13T12:00:00+08:00'));assert.equal(v.recent24hRows,1);assert.equal(v.visibleDurationLowerBoundMs,5581);assert.equal(v.visibleTriggerDurationLowerBoundMs,5456);
});
test('duplicate visible fingerprints do not prove native execution identity or get silently deduplicated',()=>{
 const r=['P','f','時間驅動','2026年10月14日 凌晨2:00:00','1 秒','已完成'];const v=analyze(input(snapshot([r,r])));assert.equal(v.visibleRows,2);assert.equal(v.distinctRowFingerprints,1);assert.equal(v.duplicateFingerprintRows,1);assert.equal(v.visibleDurationLowerBoundMs,2000);assert.equal(v.complete,false);
});
test('unknown duration/type/running rows and new-row notice are preserved as unknown evidence',()=>{
 const s=snapshot([['P','f','UNKNOWN_TYPE','2026年10月14日 凌晨2:00:00','unknown','執行中']])+'\n\t99 text 執行項目表格的開頭新增了 1 個新的執行項目。';const v=analyze(input(s));assert.equal(v.unknownDurationRows,1);assert.equal(v.unknownTypeRows,1);assert.equal(v.nonterminalRows,1);assert.equal(v.newRowsNoticePresent,true);assert.equal(v.visibleDurationLowerBoundMs,0);assert.equal(v.quotaAccepted,false);
});
test('disabled next-page at native end still does not prove complete per-user account load',()=>{
 const v=analyze(input(snapshot(undefined,'9 button (disabled) 前往下一頁')));assert.equal(v.nextPageAvailable,false);assert.equal(v.complete,false);assert.equal(v.perUserAttributionVerified,false);
});
test('unnamed AX row preserves its six cells, durations and unknown nonterminal evidence',()=>{
 const s=snapshot([['P','f','UNKNOWN_TYPE','2026年10月14日 凌晨2:00:00','1.234 秒','執行中']]).replace(/(\t\t100 row) [^\n]+/,'$1');const v=analyze(input(s));assert.equal(v.visibleRows,1);assert.equal(v.visibleDurationLowerBoundMs,1234);assert.equal(v.unknownTypeRows,1);assert.equal(v.nonterminalRows,1);
});
test('unnamed AX row with missing cells refuses rather than disappearing',()=>{
 const s=snapshot().replace(/(\t\t100 row) [^\n]+/,'$1').replace(/\t\t\t\d+ cell\n\t\t\t\t\d+ text 已完成/,'');assert.throws(()=>analyze(input(s)),/^Error: NATIVE_SNAPSHOT_UNVERIFIED$/);
});
for(const [name,change] of [
 ['different account',v=>({...v,expectedAccountHash:'f'.repeat(64)})],
 ['other URL',v=>({...v,snapshot:v.snapshot.replace('https://script.google.com/home/executions','https://other.example.invalid/')})],
 ['invalid date',v=>({...v,snapshot:v.snapshot.replaceAll('2026年10月14日','2026年2月30日')})],
 ['missing column',v=>({...v,snapshot:v.snapshot.replace(/\t\t\t\d+ cell\n\t\t\t\t\d+ text 已完成/,'')})],
 ['missing live state',v=>({...v,snapshot:v.snapshot.replace('Value: 0','Value: unknown')})],
 ['extra input',v=>({...v,url:'https://other.example.invalid'})],
 ['unknown clock',v=>({...v,referenceAt:NaN})]
])test(name+' refuses without exposing snapshot content',()=>{assert.throws(()=>analyze(change(input())),/^Error: NATIVE_SNAPSHOT_UNVERIFIED$/);});
