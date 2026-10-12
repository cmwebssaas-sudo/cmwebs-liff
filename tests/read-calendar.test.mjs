import assert from 'node:assert/strict';
import {test} from 'node:test';
import {appsScriptDate} from '../cloudflare/read-api/src/apps-script-date.js';
import {createReplicaRuntime} from '../cloudflare/read-api/src/read-runtime.js';

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
});
