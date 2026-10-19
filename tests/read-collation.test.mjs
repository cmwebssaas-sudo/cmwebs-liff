import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createReadCalculator} from '../cloudflare/read-api/src/read-calculator.js';
import {createReadServices,createReplicaRuntime} from '../cloudflare/read-api/src/read-runtime.js';
import {originalGas,access,fixture,plain,projectedDataset} from './fixtures/read-parity/runtime.mjs';
import {capacityDataset} from './fixtures/read-parity/capacity.mjs';

test('property reads reuse one request-local collator while preserving the entire native GAS response',()=>{
  const input=capacityDataset(),projected=projectedDataset(input);
  const expected=plain(originalGas(input).getLandlordPropertiesInitByLineUid_('SYNTHETIC_LINE1',true));
  assert.equal(expected.data.summary.room_count,500);assert.equal(expected.data.properties.length,20);
  const Native=Intl.Collator,nativeLocaleCompare=String.prototype.localeCompare;
  let constructions=0,localeCalls=0;
  Intl.Collator=new Proxy(Native,{construct(target,args,newTarget){
    constructions++;return Reflect.construct(target,args,newTarget);
  }});
  String.prototype.localeCompare=function(...args){localeCalls++;return Reflect.apply(nativeLocaleCompare,this,args);};
  try{
    const options={now:Date.parse(fixture.now)};
    const calculator=createReadCalculator(createReadServices(projected,access,options));
    assert.equal(constructions,0,'Unused runtimes should not initialize a sorter');
    assert.deepEqual(plain(calculator.getLandlordPropertiesInitByLineUid_('SYNTHETIC_LINE1',true)),expected);
    assert.equal(localeCalls,0,'Repeated comparisons must not rebuild native localeCompare configuration');
    assert.equal(constructions,1);
    assert.deepEqual(plain(calculator.getLandlordPropertiesInitByLineUid_('SYNTHETIC_LINE1',true)),expected);
    assert.equal(constructions,1,'Only the stateless sorter is reused');
    assert.deepEqual(plain(createReadCalculator(createReadServices(projected,access,options))
      .getLandlordPropertiesInitByLineUid_('SYNTHETIC_LINE1',true)),expected);
    assert.equal(constructions,2,'A different runtime must initialize its own sorter');
  }finally{Intl.Collator=Native;String.prototype.localeCompare=nativeLocaleCompare;}
});

test('Worker collation preserves native GAS normalization, numeric and Chinese ordering, ties and live coercions',()=>{
  const native=originalGas(),adapted=originalGas();
  assert.equal(typeof native.runtimePropertyRoomCompareText_,'undefined','The GAS oracle must retain native collation');
  const runtime=createReplicaRuntime({});
  assert.equal(typeof runtime.runtimePropertyRoomCompareText_,'function');
  adapted.runtimePropertyRoomCompareText_=runtime.runtimePropertyRoomCompareText_;
  const values=['','2','10','02','2-1','2-10','Ａ','A','a','é','e','一樓','二樓','十樓','房間2','房間10','台','臺','神','神','🙂','🏠',null,undefined,0,false,12n,Symbol('room')];
  for(const left of values)for(const right of values){
    assert.equal(adapted.propertyRoomCompareText_(left,right),native.propertyRoomCompareText_(left,right));
  }
  for(const [left,right,want] of [['2','10',-1],[' 2 ','10',-1],['A','a',0],['é','e',0],[null,'',0]]){
    assert.equal(Math.sign(adapted.propertyRoomCompareText_(left,right)),want);
  }
  const calls=[];let first='2';
  const left={toString(){calls.push('left');return first;}},right={toString(){calls.push('right');return '10';}};
  assert.equal(Math.sign(adapted.propertyRoomCompareText_(left,right)),-1);
  first='20';assert.equal(Math.sign(adapted.propertyRoomCompareText_(left,right)),1);
  assert.deepEqual(calls,['left','right','left','right'],'Every comparison converts current values once in source order');
  assert.throws(()=>adapted.propertyRoomCompareText_(left,{toString(){throw Error('synthetic coercion');}}),/synthetic coercion/);
  assert.deepEqual(calls,['left','right','left','right','left']);
});
