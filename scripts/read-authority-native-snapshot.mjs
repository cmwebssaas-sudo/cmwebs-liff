// Offline analysis of captured native accessibility text. This never emits a
// driver proof: visible project rows cannot establish per-user quota or freeze.
import {createHash} from 'node:crypto';
const stop=()=>{throw Error('NATIVE_SNAPSHOT_UNVERIFIED');};
const hash=s=>createHash('sha256').update(s).digest('hex');
const url='https://script.google.com/home/executions';
const header='row 專案 函式 類型 開始時間 持續時間 狀態';
function timestamp(s){
 const m=/^(\d{4})年(\d{1,2})月(\d{1,2})日\s+(凌晨|上午|中午|下午|晚上)(\d{1,2}):(\d{2}):(\d{2})$/.exec(s);
 if(!m)stop();const [y,month,d,h,min,sec]=[m[1],m[2],m[3],m[5],m[6],m[7]].map(Number);
 if(y<2020||y>2100||month<1||month>12||d<1||d>31||h<1||h>12||min>59||sec>59)stop();
 const hour=h%12+(['中午','下午','晚上'].includes(m[4])?12:0),local=Date.UTC(y,month-1,d,hour,min,sec),check=new Date(local);
 if(check.getUTCFullYear()!==y||check.getUTCMonth()!==month-1||check.getUTCDate()!==d)stop();
 return local-8*3600000;
}
function duration(s){
 const m=/^(\d+)(?:\.(\d{1,3}))? 秒$/.exec(s);if(!m)return null;
 const v=Number(m[1])*1000+Number((m[2]||'').padEnd(3,'0'));return Number.isSafeInteger(v)?v:null;
}
export function analyzeAuthorityNativeSnapshot(input){
 try{
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='expectedAccountHash,referenceAt,snapshot')stop();
  const {snapshot,referenceAt,expectedAccountHash}=input;
  if(typeof snapshot!=='string'||snapshot.length>2000000||snapshot.includes('\0')||!Number.isSafeInteger(referenceAt)||referenceAt<0||typeof expectedAccountHash!=='string'||!/^[a-f0-9]{64}$/.test(expectedAccountHash))stop();
  if(snapshot.split('\n')[0].match(/URL: "([^"]+)"/)?.[1]!==url)stop();
  const nodes=snapshot.split('\n').flatMap(line=>{const m=/^(\t*)(\d+) (.*)$/.exec(line);return m?[{depth:m[1].length,body:m[3]}]:[];});
  const identities=nodes.filter(n=>n.body.includes('Description: Google 帳戶：')).map(n=>n.body.match(/Google 帳戶：.*?\(([^()\s]+@[^()\s]+)\)/)?.[1]);
  if(identities.length!==1||typeof identities[0]!=='string'||hash(identities[0].trim().toLowerCase())!==expectedAccountHash||nodes.filter(n=>n.body===header).length!==1)stop();
  const live=nodes.filter(n=>/switch.*Description: 即時顯示執行作業。/.test(n.body)).map(n=>n.body.match(/Value: ([01])(?:$|,)/)?.[1]);
  const page=nodes.flatMap(n=>{const m=/^text 第\s+(\d+)\s+頁/.exec(n.body);return m?[Number(m[1])]:[];});
  const size=nodes.flatMap(n=>{const m=/^\(selected\) (50|100|200)$/.exec(n.body);return m?[Number(m[1])]:[];});
  const next=nodes.filter(n=>/^button(?: \(disabled\))? 前往下一頁$/.test(n.body));
  if(live.length!==1||live[0]===undefined||page.length!==1||page[0]<1||size.length!==1||next.length!==1)stop();
  const rows=[];
  for(let i=0;i<nodes.length;i++){
   const node=nodes[i];if(!/^row(?: |$)/.test(node.body)||node.body===header)continue;
   let end=i+1;while(end<nodes.length&&nodes[end].depth>node.depth)end++;
   const cells=[];
   for(let j=i+1;j<end;j++){
    const cell=nodes[j];if(cell.depth!==node.depth+1||!/^cell(?: |$)/.test(cell.body))continue;
    const values=[];const inline=cell.body.slice(4).trim();if(inline)values.push(inline);
    let k=j+1;while(k<end&&nodes[k].depth>cell.depth){if(nodes[k].body.startsWith('text '))values.push(nodes[k].body.slice(5));k++;}
    const unique=[...new Set(values)];if(unique.length!==1)stop();cells.push(unique[0]);
   }
   if(cells.length!==6)stop();const [project,fn,type,start,elapsed,status]=cells;
   const startMs=timestamp(start);if(startMs>referenceAt+1000)stop();
   rows.push({fingerprint:hash(JSON.stringify(cells)),startMs,durationMs:duration(elapsed),type,status});i=end-1;
  }
  if(rows.length>size[0])stop();
  const fingerprints=new Set(rows.map(r=>r.fingerprint)),known=['時間驅動','觸發條件','觸發器','編輯器','網頁應用程式','執行 API','附加元件'];
  let total=0,trigger=0;for(const r of rows){if(r.durationMs!==null){total+=r.durationMs;if(['時間驅動','觸發條件','觸發器'].includes(r.type))trigger+=r.durationMs;}}
  if(!Number.isSafeInteger(total)||!Number.isSafeInteger(trigger))stop();
  // Fingerprints identify visible text only; two real executions may collide.
  // Every visible row counts. Neither pagination end nor live=0 proves coverage.
  return Object.freeze({source:'google-native-ui-snapshot-analysis',referenceAt,accountMatched:true,
   visibleRows:rows.length,distinctRowFingerprints:fingerprints.size,duplicateFingerprintRows:rows.length-fingerprints.size,
   earliestStartMs:rows.length?Math.min(...rows.map(r=>r.startMs)):null,latestStartMs:rows.length?Math.max(...rows.map(r=>r.startMs)):null,
   recent24hRows:rows.filter(r=>r.startMs>=referenceAt-86400000&&r.startMs<=referenceAt).length,
   visibleDurationLowerBoundMs:total,visibleTriggerDurationLowerBoundMs:trigger,
   unknownDurationRows:rows.filter(r=>r.durationMs===null).length,unknownTypeRows:rows.filter(r=>!known.includes(r.type)).length,
   nonterminalRows:rows.filter(r=>!['已完成','失敗','已逾時','已取消'].includes(r.status)).length,
   pageIndex:page[0],selectedPageSize:size[0],nextPageAvailable:!next[0].body.includes('(disabled)'),liveView:live[0]==='1',
   newRowsNoticePresent:nodes.some(n=>/^text 執行項目表格的開頭新增了 \d+ 個新的執行項目/.test(n.body)),
   nativeExecutionIdsAvailable:false,perUserAttributionVerified:false,complete:false,quotaAccepted:false,trialAccepted:false});
 }catch(_){stop();}
}
