import { appsScriptDate } from './apps-script-date.js';
// Request-local adapters for the generated GAS calculations. Identity is
// supplied by the server, never resolved from a reader's query parameters.
export function createReadServices(dataset, access, options = {}, deferSheetValues = false) {
  if (access?.success !== true || !access.workspace?.workspace_id || !access.membership || !access.user) {
    throw new Error('Verified Workspace access required');
  }
  return {...createReplicaRuntime(dataset,options,deferSheetValues),
    workspaceLandlordResolveAccess_:()=>access,
    contractRequestResolveLandlordIdentity_:()=>access.principal,
    lmResolveLandlord_:()=>access.principal};
}

// Read-only Sheet/services layer used while resolving provider-verified identity.
// It supplies no Workspace access or principal and cannot authorize a reader.
export function createReplicaRuntime(dataset,options={},deferSheetValues=false) {
  const now = options.now ?? Date.now();
  const RequestDate=options.dateConstructor||appsScriptDate(now);
  const inheritedDefaults={};
  const sourceTables=new Map(Object.entries(dataset)),sheets=new Map();
  function buildSheet(name,sourceRows) {
    const maskedAccounts=name==='V2_payment_accounts';
    const headerSet=new Set();
    for(const row of sourceRows) {
      for(const key of Object.keys(row))headerSet.add(key);
      if(maskedAccounts&&Object.hasOwn(row,'bank_account_last5'))headerSet.add('bank_account');
    }
    const headers=[...headerSet].filter(key=>!key.startsWith('replica_'));
    // Rehydrate only an already masked suffix for the existing mask formatter.
    // The full account is neither stored in D1 nor reconstructed here.
    // Build the existing Sheet matrix directly instead of cloning every scalar
    // into another row object first. Dates remain freshly hydrated per request.
    const values=[headers,...sourceRows.map(row=>{
      const dates=new Set(row.replica_date_fields?JSON.parse(row.replica_date_fields):[]);
      return headers.map(key=>{
        const sourceKey=maskedAccounts&&key==='bank_account'&&Object.hasOwn(row,'bank_account_last5')?'bank_account_last5':key;
        const own=Object.hasOwn(row,sourceKey);
        let value=own?row[sourceKey]:inheritedDefaults[sourceKey];
        if(own&&dates.has(sourceKey))value=new RequestDate(value);
        else if(value!==null&&typeof value==='object'&&Object.prototype.toString.call(value)==='[object Date]')value=new RequestDate(value.getTime());
        return value??'';
      });
    })];
    const sheet = {
      getName: () => name, getSheetId: () => name,
      getLastRow: () => values.length, getLastColumn: () => headers.length,
      // Native getValues() returns a fresh matrix. Some existing readers shift
      // its header; sharing the adapter's stored matrix would corrupt later reads.
      getDataRange: () => ({getValues: () => values.map(row=>row.slice())}),
      getRange: (row, column, height = 1, width = 1) => ({
        getValues: () => values.slice(row-1,row-1+height).map(item=>item.slice(column-1,column-1+width))
      })
    };
    return sheet;
  }
  function getSheetByName(name) {
    if(sheets.has(name))return sheets.get(name);
    if(!sourceTables.has(name))return null;
    const sheet=buildSheet(name,sourceTables.get(name));
    sheets.set(name,sheet);sourceTables.delete(name);return sheet;
  }
  if(deferSheetValues===true) {
    // Only the HTTP reader opts in, after obtaining its own complete scoped D1
    // dataset. No caller can mutate those private rows during the synchronous
    // calculation. Keep default eager snapshot semantics for other callers.
    for(const rows of sourceTables.values()) {
      if(!Array.isArray(rows))throw new Error('Replica schema unavailable');
      for(const row of rows)if(row==null)throw new Error('Replica row unavailable');
    }
  } else for(const name of sourceTables.keys())getSheetByName(name);
  const ss = {getSheetByName};
  const requiredSheet = name => {const sheet=ss.getSheetByName(name); if(!sheet) throw new Error('Replica schema unavailable'); return sheet;};
  const localCache = new Map();
  const contexts = new Map();
  const cache = {get:key=>localCache.get(key)||null,put:(key,value)=>localCache.set(key,value)};
  // Only fixed Intl configuration is reused, never strings or comparison
  // results. This runtime belongs to one request and initializes lazily.
  let propertyRoomTextCompare;
  const runtimePropertyRoomCompareText_ = (left,right) => {
    if(!propertyRoomTextCompare)propertyRoomTextCompare=new Intl.Collator('zh-Hant',{numeric:true,sensitivity:'base'}).compare;
    return propertyRoomTextCompare(left,right);
  };
  // Cache only the canonical parser's immutable, short string inputs. The
  // wrapper belongs to one calculator/request; arrays and coercible objects
  // retain their fresh reads. Never share a returned array with another caller.
  const runtimeMemoizeMonths_ = parse => {
    const values = new Map();
    return value => {
      if(typeof value!=='string'||value.length>256)return parse(value);
      if(values.has(value))return values.get(value).slice();
      const parsed=parse(value);
      if(values.size<64)values.set(value,parsed.slice());
      return parsed;
    };
  };
  // Reuse request-local formatters; Date objects and authorization are never
  // cached. Non-string zones
  // retain Intl's coercion on every call, including mutable objects and errors.
  const dateFormatters = new Map();
  const timeFormatters = new Map();
  // Cache at most128 output strings for this runtime/request. The key uses the
  // freshly coerced numeric instant, primitive zone and primitive pattern, so
  // mutable inputs still take effect. Undefined/current-time calls bypass it.
  const formattedDates = new Map();
  const formatFields={yyyy:'year',MM:'month',dd:'day',HH:'hour',mm:'minute',ss:'second'};
  const formatDate = (date, timeZone, pattern) => {
    // Date-only GAS patterns need no clock parts. Keep year/month/day together
    // to preserve Intl's two-digit widths; any clock token uses the full format.
    const dateOnly=typeof pattern==='string'&&!/HH|mm|ss/.test(pattern);
    const formatters=dateOnly?dateFormatters:timeFormatters;
    let entry=typeof timeZone==='string'?formatters.get(timeZone):undefined;
    if(!entry) {
      const formatter=new Intl.DateTimeFormat('en-GB',{
        timeZone,year:'numeric',month:'2-digit',day:'2-digit',
        ...(dateOnly?{}:{hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})
      });
      let layout=null;
      if(dateOnly) {
        // Derive only a formatter layout, never a source date/result. Normal
        // numeric dates can use format() without allocating a parts object for
        // every field on every call. Other layouts fall back to formatToParts.
        const parts=formatter.formatToParts(946728000000);
        const fields=parts.filter(part=>part.type!=='literal').map(part=>part.type);
        if(fields.length===3&&new Set(fields).size===3&&fields.every(field=>['year','month','day'].includes(field))) {
          const expression=parts.map(part=>part.type==='literal'?part.value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'):'([0-9]+)').join('');
          layout={fields,expression:new RegExp('^'+expression+'$')};
        }
      }
      entry={formatter,layout};
      if(typeof timeZone==='string')formatters.set(timeZone,entry);
    }
    const values={};
    // Match Intl's single numeric coercion even if an unusual formatted layout
    // needs the parts fallback; do not invoke a caller's valueOf twice.
    const timeValue=date===undefined?undefined:+date;
    const resultKey=typeof timeZone==='string'&&typeof pattern==='string'&&Number.isFinite(timeValue)
      ?JSON.stringify([timeValue,timeZone,pattern]):null;
    if(resultKey!==null&&formattedDates.has(resultKey))return formattedDates.get(resultKey);
    const match=date===undefined?null:entry.layout?.expression.exec(entry.formatter.format(timeValue));
    if(match)entry.layout.fields.forEach((field,index)=>{values[field]=match[index+1];});
    else for(const item of entry.formatter.formatToParts(timeValue))values[item.type]=item.value;
    const result=pattern.replace(/yyyy|MM|dd|HH|mm|ss/g, key => values[formatFields[key]]);
    if(resultKey!==null&&formattedDates.size<128)formattedDates.set(resultKey,result);
    return result;
  };
  const noop = () => {};
  return {
    Date:RequestDate, Utilities:{formatDate, ...options.utilities},runtimePropertyRoomCompareText_,runtimeMemoizeMonths_,
    SpreadsheetApp:{getActiveSpreadsheet:()=>ss}, CacheService:{getScriptCache:()=>cache},
    UrlFetchApp:{fetchAll: requests => requests.map(request => {
      // URLs have already passed the existing z3House public-page allowlist.
      // Network retrieval happens asynchronously before entering the calculator.
      const resource=options.publicResources?.[request.url];
      return {getResponseCode:()=>resource?.status??503,getContentText:()=>resource?.body??''};
    })}, Logger:{log:noop},
    runtimeSpreadsheet_:()=>ss, runtimeSnapshotGetValues_:sheet=>sheet.getDataRange().getValues(),
    runtimeSnapshotGetContext_:(name,key)=>contexts.get(name+':'+key)||null,
    runtimeSnapshotSetContext_:(name,key,value)=>contexts.set(name+':'+key,value),
    workspaceLandlordLog_:noop,contractRequestLogAccess_:noop,lmLogAccess_:noop,
    ensureV2ContractRequestsSheet_:()=>requiredSheet('V2_contract_requests'),
    lmEnsurePaymentReportSheet_:()=>requiredSheet('V2_payment_reports'),
    lmEnsureTenantMessageSheet_:()=>requiredSheet('V2_tenant_messages'),
    landlordInitiatedContractSchema_:()=>({success:true,code:'OK',data:{
      properties:requiredSheet('V2_properties'),rooms:requiredSheet('V2_rooms'),users:requiredSheet('V2_users'),
      tenants:requiredSheet('V2_tenants'),contracts:requiredSheet('V2_contracts'),invites:requiredSheet('V2_contract_invites')
    }})
  };
}
