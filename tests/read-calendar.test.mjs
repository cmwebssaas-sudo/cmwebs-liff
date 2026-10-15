import assert from 'node:assert/strict';
import {test} from 'node:test';
import {appsScriptDate} from '../cloudflare/read-api/src/apps-script-date.js';
import {createReplicaRuntime} from '../cloudflare/read-api/src/read-runtime.js';

test('date formatting reuses equal numeric inputs only within one request and a bounded result set',()=>{
  const Native=Intl.DateTimeFormat;let nativeFormats=0;
  Intl.DateTimeFormat=function(...args){
    const formatter=new Native(...args),format=formatter.format;
    Object.defineProperty(formatter,'format',{value:value=>{nativeFormats++;return format(value);}});
    return formatter;
  };
  try{
    const format=createReplicaRuntime({}).Utilities.formatDate;
    let instant=Date.parse('2026-09-30T16:00:00Z'),coercions=0;
    const value={valueOf(){coercions++;return instant;}};
    for(let i=0;i<250;i++)assert.equal(format(value,'Asia/Taipei','yyyy-MM-dd'),'2026-10-01');
    assert.equal(nativeFormats,1,'Repeated tenant dates must not repeat native Intl formatting');
    assert.equal(coercions,250,'A hit still reads the current input exactly once');
    instant+=86400000;assert.equal(format(value,'Asia/Taipei','yyyy-MM-dd'),'2026-10-02');
    assert.equal(nativeFormats,2);
    instant-=86400000;assert.equal(format(value,'Asia/Taipei','yyyy-MM-dd'),'2026-10-01');
    assert.equal(format(value,'UTC','yyyy-MM-dd'),'2026-09-30');
    assert.equal(format(value,'Asia/Taipei','yyyy/MM'),'2026/10');
    const beforeRequest=nativeFormats;
    assert.equal(createReplicaRuntime({}).Utilities.formatDate(value,'Asia/Taipei','yyyy-MM-dd'),'2026-10-01');
    assert.equal(nativeFormats,beforeRequest+1,'Another request cannot reuse the first result cache');

    const bounded=createReplicaRuntime({}).Utilities.formatDate,base=Date.parse('2026-01-01T00:00:00Z');
    for(let i=0;i<129;i++){
      const time=base+i*86400000;
      assert.equal(bounded(time,'UTC','yyyy-MM-dd'),new Date(time).toISOString().slice(0,10));
    }
    const beforeOverflow=nativeFormats;
    bounded(base+128*86400000,'UTC','yyyy-MM-dd');
    assert.equal(nativeFormats,beforeOverflow+1,'New results beyond128 retained entries remain uncached');
    bounded(base,'UTC','yyyy-MM-dd');
    assert.equal(nativeFormats,beforeOverflow+1,'Existing retained entries remain usable at the bound');
  }finally{Intl.DateTimeFormat=Native;}
});

test('replica Date preserves native GAS Taipei month/day boundaries and date inputs',()=>{
  const previousZone=process.env.TZ;
  process.env.TZ='Asia/Taipei';
  try {
    const Clock=appsScriptDate(Date.parse('2026-09-30T16:00:00Z'));
    const inputs=[[],['2026-10-01'],['2026/10/01'],['2026-10-01T00:00:00'],
      ['2026-10-01 00:00:00.12'],['2026-09-30T16:00:00Z'],['2026-10-01T00:00:00+08:00'],
      [2026,9,1],[2026,9,0,24,0,0],[2026,11,32],[NaN]];
    for(const args of inputs) {
      const expected=new Date(...(args.length?args:[Date.parse('2026-09-30T16:00:00Z')]));
      const actual=new Clock(...args);
      assert.equal(actual.getTime(),expected.getTime(),JSON.stringify(args));
      for(const field of ['getFullYear','getMonth','getDate','getDay','getHours','getMinutes','getSeconds']) {
        assert.equal(actual[field](),expected[field](),field+': '+JSON.stringify(args));
      }
      if(Number.isFinite(actual.getTime())) {
        assert.equal(actual.setHours(0,0,0,0),expected.setHours(0,0,0,0),'Taipei midnight normalization');
      }
    }
    assert.equal(new Clock().getDate(),1);
    assert.equal(new Clock().getMonth(),9);
    for(const value of ['2026-10-01','2026/10/01','2026-10-01T00:00:00','2026-10-01T00:00:00+08:00']) {
      assert.equal(Clock.parse(value),Date.parse(value),value);
    }
  } finally {
    if(previousZone===undefined)delete process.env.TZ;else process.env.TZ=previousZone;
  }
});

test('replica formatDate keeps current date values, time zones, DST and invalid-input errors',()=>{
  const {formatDate}=createReplicaRuntime({}).Utilities;
  const pattern='yyyy-MM-dd HH:mm:ss';
  const date=new Date('2026-09-30T16:00:01Z');
  assert.equal(formatDate(date,'Asia/Taipei',pattern),'2026-10-01 00:00:01');
  assert.equal(formatDate(date,'UTC',pattern),'2026-09-30 16:00:01');
  assert.equal(formatDate(date,'Asia/Taipei','yyyy-MM-dd'),'2026-10-01');
  assert.equal(formatDate(date,'UTC','yyyy/MM'),'2026/09');
  assert.equal(formatDate(date,'Asia/Taipei','dd yyyy'),'01 2026');
  date.setUTCSeconds(59);
  assert.equal(formatDate(date,'Asia/Taipei',pattern),'2026-10-01 00:00:59');
  date.setTime(Date.parse('2026-10-01T16:00:00Z'));
  assert.equal(formatDate(date,'Asia/Taipei','yyyy-MM-dd'),'2026-10-02');
  date.setTime(Date.parse('2026-09-30T16:00:59Z'));
  assert.equal(formatDate(new Date('2026-03-08T09:59:59Z'),'America/Los_Angeles',pattern),'2026-03-08 01:59:59');
  assert.equal(formatDate(new Date('2026-03-08T10:00:00Z'),'America/Los_Angeles',pattern),'2026-03-08 03:00:00');
  assert.throws(()=>formatDate(date,'Invalid/Zone',pattern),RangeError);
  assert.throws(()=>formatDate(new Date(NaN),'Asia/Taipei',pattern),RangeError);
  let currentZone='UTC';
  const mutableZone={toString:()=>currentZone};
  assert.equal(formatDate(date,mutableZone,pattern),'2026-09-30 16:00:59');
  currentZone='Asia/Taipei';
  assert.equal(formatDate(date,mutableZone,pattern),'2026-10-01 00:00:59');
  assert.throws(()=>formatDate(date,Symbol('zone'),pattern),TypeError);
  let coercions=0;
  const numericDate={valueOf(){coercions++;return Date.parse('2026-09-30T16:00:01Z');}};
  assert.equal(formatDate(numericDate,'Asia/Taipei','yyyy-MM-dd'),'2026-10-01');
  assert.equal(coercions,1);
  const before=Date.now(),defaultDate=formatDate(undefined,'UTC','yyyy-MM-dd'),after=Date.now();
  assert.ok([new Date(before).toISOString().slice(0,10),new Date(after).toISOString().slice(0,10)].includes(defaultDate));
  assert.throws(()=>formatDate(undefined,'UTC',null),TypeError);
});

test('replica Sheet matrices preserve header order, typed dates, blanks and masked suffixes with fresh range arrays',()=>{
  const originalDate=new Date('2026-09-30T16:00:00Z');
  const data={V2_bills:[{bill_id:'B1',native_date:originalDate,typed_date:'2026-10-01T00:00:01+08:00',
    blank:null,zero:0,disabled:false,replica_date_fields:'["typed_date"]',replica_source_row:1},
    {bill_id:'B2',extra:'later',replica_source_row:2}],
    V2_payment_accounts:[{account_id:'A1',bank_account_last5:'12345',bank_account:'SYNTHETIC_PRIVATE_BANK'}],
    generic:[Object.fromEntries([['id','G1'],['__proto__','own']]),{id:'G2'}]};
  const runtime=createReplicaRuntime(data),ss=runtime.runtimeSpreadsheet_();
  const sheet=ss.getSheetByName('V2_bills'),values=sheet.getDataRange().getValues();
  assert.deepEqual(values[0],['bill_id','native_date','typed_date','blank','zero','disabled','extra']);
  assert.equal(values[1][1].getTime(),originalDate.getTime());
  assert.notEqual(values[1][1],originalDate);
  assert.equal(values[1][2].getTime(),Date.parse('2026-09-30T16:00:01Z'));
  assert.deepEqual(values[1].slice(3),['',0,false,'']);
  assert.deepEqual(values[2],['B2','','','','','','later']);
  values[0].shift();values[1][0]='mutated';
  assert.equal(sheet.getDataRange().getValues()[0][0],'bill_id');
  assert.equal(sheet.getRange(2,1,1,1).getValues()[0][0],'B1');
  const accounts=ss.getSheetByName('V2_payment_accounts').getDataRange().getValues();
  assert.deepEqual(accounts,[['account_id','bank_account_last5','bank_account'],['A1','12345','12345']]);
  assert.equal(data.V2_payment_accounts[0].bank_account,'SYNTHETIC_PRIVATE_BANK');
  assert.equal(data.V2_bills[0].native_date,originalDate);
  const generic=ss.getSheetByName('generic').getDataRange().getValues();
  assert.deepEqual(generic[0],['id','__proto__']);
  assert.equal(generic[1][1],'own');
  assert.equal(generic[2][1],Object.prototype);
});
