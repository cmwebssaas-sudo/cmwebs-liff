import { appsScriptDate } from './apps-script-date.js';
// Request-local adapters for the generated GAS calculations. Identity is
// supplied by the server, never resolved from a reader's query parameters.
export function createReadServices(dataset, access, options = {}) {
  if (access?.success !== true || !access.workspace?.workspace_id || !access.membership || !access.user) {
    throw new Error('Verified Workspace access required');
  }
  return {...createReplicaRuntime(dataset,options),
    workspaceLandlordResolveAccess_:()=>access,
    contractRequestResolveLandlordIdentity_:()=>access.principal,
    lmResolveLandlord_:()=>access.principal};
}

// Read-only Sheet/services layer used while resolving provider-verified identity.
// It supplies no Workspace access or principal and cannot authorize a reader.
export function createReplicaRuntime(dataset,options={}) {
  const now = options.now ?? Date.now();
  const RequestDate=options.dateConstructor||appsScriptDate(now);
  const sheets = new Map(Object.entries(dataset).map(([name, sourceRows]) => {
    sourceRows=sourceRows.map(row=>{
      const dates=new Set(row.replica_date_fields?JSON.parse(row.replica_date_fields):[]);
      return Object.fromEntries(Object.entries(row).map(([key,value])=>[key,
        dates.has(key)?new RequestDate(value):Object.prototype.toString.call(value)==='[object Date]'?new RequestDate(value.getTime()):value]));
    });
    // Rehydrate only an already masked suffix for the existing mask formatter.
    // The full account is neither stored in D1 nor reconstructed here.
    const rows=name==='V2_payment_accounts' ? sourceRows.map(row=>Object.hasOwn(row,'bank_account_last5') ? {...row,bank_account:row.bank_account_last5} : row) : sourceRows;
    const headers = [...new Set(rows.flatMap(row => Object.keys(row)))].filter(key=>!key.startsWith('replica_'));
    const values = [headers, ...rows.map(row => headers.map(key => row[key] ?? ''))];
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
    return [name,sheet];
  }));
  const ss = {getSheetByName: name => sheets.get(name) || null};
  const requiredSheet = name => {const sheet=ss.getSheetByName(name); if(!sheet) throw new Error('Replica schema unavailable'); return sheet;};
  const localCache = new Map();
  const contexts = new Map();
  const cache = {get:key=>localCache.get(key)||null,put:(key,value)=>localCache.set(key,value)};
  const formatDate = (date, timeZone, pattern) => {
    const values = Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
      timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
    }).formatToParts(date).map(item=>[item.type,item.value]));
    return pattern.replace(/yyyy|MM|dd|HH|mm|ss/g, key => values[{yyyy:'year',MM:'month',dd:'day',HH:'hour',mm:'minute',ss:'second'}[key]]);
  };
  const noop = () => {};
  return {
    Date:RequestDate, Utilities:{formatDate, ...options.utilities},
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
