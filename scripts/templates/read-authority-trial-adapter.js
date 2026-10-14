// Included inside the guarded library's private closure, not standalone GAS.
function readTrialContract_(){
  const properties=PropertiesService.getScriptProperties();
  const raw=properties.getProperty('C3_TRIAL_SHEET_CONTRACT');
  const epoch=properties.getProperty('C3_TRIAL_EPOCH');
  if(typeof raw!=='string'||raw.length>8192||typeof epoch!=='string'||!/^[-A-Za-z0-9_]{20,64}$/.test(epoch))throw new Error('TRIAL_UNAVAILABLE');
  const contract=JSON.parse(raw);
  if(!contract||Object.keys(contract).sort().join(',')!=='spreadsheet_id,tables,time_zone'||
    typeof contract.spreadsheet_id!=='string'||!/^[-A-Za-z0-9_]{1,200}$/.test(contract.spreadsheet_id)||
    typeof contract.time_zone!=='string'||!contract.time_zone||contract.time_zone.length>100||
    !Array.isArray(contract.tables)||contract.tables.length!==5)throw new Error('TRIAL_UNAVAILABLE');
  const tables=Object.create(null),ids=Object.create(null);
  contract.tables.forEach(function(table){
    if(!table||Object.keys(table).sort().join(',')!=='headers,name,sheet_id'||
      V2_READ_AUTHORIZATION_TABLES_.indexOf(table.name)<0||tables[table.name]||
      !Number.isSafeInteger(table.sheet_id)||table.sheet_id<0||ids[table.sheet_id]||
      !Array.isArray(table.headers)||!table.headers.length||table.headers.length>100||
      table.headers.some(function(value){return typeof value!=='string'||!value||value.length>256||value==='__row_number';})||
      new Set(table.headers).size!==table.headers.length)throw new Error('TRIAL_UNAVAILABLE');
    tables[table.name]={sheet_id:table.sheet_id,headers:table.headers.slice()};ids[table.sheet_id]=true;
  });
  if(V2_READ_AUTHORIZATION_TABLES_.some(function(name){return !tables[name];}))throw new Error('TRIAL_UNAVAILABLE');
  return {id:contract.spreadsheet_id,zone:contract.time_zone,tables:tables,epoch:epoch};
}

function readTrialTakeBudget_(contract){
  const lock=LockService.getScriptLock();if(!lock.tryLock(250))throw new Error('TRIAL_UNAVAILABLE');
  try {
    const key='cmwebs:c3-trial:budget:'+contract.epoch,cache=CacheService.getScriptCache(),now=Date.now();
    const raw=cache.get(key);if(typeof raw!=='string'||raw.length>2048)throw new Error('TRIAL_UNAVAILABLE');
    const budget=JSON.parse(raw);
    if(!budget||Object.keys(budget).sort().join(',')!=='expires_at,remaining,requests'||
      !Number.isSafeInteger(budget.remaining)||budget.remaining<6||budget.remaining>40||
      !Number.isSafeInteger(budget.expires_at)||budget.expires_at<=now||budget.expires_at>now+21600000||
      !Array.isArray(budget.requests)||budget.requests.length>10||
      budget.requests.some(function(value){return !Number.isSafeInteger(value)||value<0||value>now;}))throw new Error('TRIAL_UNAVAILABLE');
    const requests=budget.requests.filter(function(value){return value>now-60000;});
    if(requests.length>=10)throw new Error('TRIAL_UNAVAILABLE');
    // Conservative cost: five table ranges plus the metadata envelope. Never
    // initialize/reset/refund a missing, failed or exhausted budget here.
    const next=JSON.stringify({remaining:budget.remaining-6,expires_at:budget.expires_at,requests:requests.concat([now])});
    cache.put(key,next,
      Math.min(21600,Math.ceil((budget.expires_at-now)/1000)));
    if(cache.get(key)!==next)throw new Error('TRIAL_UNAVAILABLE');
  }finally{lock.releaseLock();}
}

function readTrialSpreadsheet_(contract){
  let loaded=false,snapshot=null;
  const handles=Object.create(null);
  function load(){
    if(loaded){if(!snapshot)throw new Error('TRIAL_UNAVAILABLE');return snapshot;}
    loaded=true;
    readTrialTakeBudget_(contract);
    const token=NativeScriptApp.getOAuthToken();
    if(typeof token!=='string'||!token||token.length>8192)throw new Error('TRIAL_UNAVAILABLE');
    const fields='spreadsheetId,properties(timeZone,defaultFormat(numberFormat(type))),sheets(properties(title,sheetId),data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue,effectiveFormat(numberFormat(type))))))';
    const query='includeGridData=true&fields='+encodeURIComponent(fields)+'&'+V2_READ_AUTHORIZATION_TABLES_.map(function(name){return 'ranges='+encodeURIComponent("'"+name+"'");}).join('&');
    const response=NativeUrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/'+contract.id+'?'+query,
      {method:'get',followRedirects:false,muteHttpExceptions:true,
        headers:{Authorization:'Bearer '+token,'Cache-Control':'no-cache, no-store',Pragma:'no-cache'}});
    if(response.getResponseCode()!==200)throw new Error('TRIAL_UNAVAILABLE');
    const text=response.getContentText();if(typeof text!=='string'||text.length>1000000)throw new Error('TRIAL_UNAVAILABLE');
    const document=JSON.parse(text);
    if(document.properties&&document.properties.timeZone!==contract.zone)throw new Error('TRIAL_UNAVAILABLE');
    const decoded=readAuthorizationGridSnapshot_(document,contract.id);
    V2_READ_AUTHORIZATION_TABLES_.forEach(function(name){
      if(decoded.sheet_ids[name]!==contract.tables[name].sheet_id||
        JSON.stringify(decoded.values[name][0])!==JSON.stringify(contract.tables[name].headers))throw new Error('TRIAL_UNAVAILABLE');
    });
    snapshot=decoded;return snapshot;
  }
  const spreadsheet=Object.freeze({getId:function(){return contract.id;},getSheetByName:function(name){
    if(!Object.prototype.hasOwnProperty.call(contract.tables,name))throw new Error('TRIAL_UNAVAILABLE');
    if(!handles[name])handles[name]=Object.freeze({getParent:function(){return spreadsheet;},getSheetId:function(){return contract.tables[name].sheet_id;},
      getDataRange:function(){return Object.freeze({getValues:function(){return load().values[name].map(function(row){return row.map(function(value){return Object.prototype.toString.call(value)==='[object Date]'?new Date(value.getTime()):value;});});}});}});
    return handles[name];
  }});
  return spreadsheet;
}
