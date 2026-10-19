import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadServices} from '../cloudflare/read-api/src/read-runtime.js';
import {createReadCalculator} from '../cloudflare/read-api/src/read-calculator.js';
import {access,fixture,originalGas,projectedDataset,plain} from './fixtures/read-parity/runtime.mjs';
import {capacityDataset} from './fixtures/read-parity/capacity.mjs';
const now=Date.parse(fixture.now),oracle=originalGas();
const canonical=value=>Array.from(oracle.settingsIntegrationParseMonths_(value));
test('request-local month reuse preserves canonical parsing and gives each caller its own result',()=>{
 const services=createReadServices({},access,{now});assert.equal(typeof services.runtimeMemoizeMonths_,'function');let calls=0;
 const parse=services.runtimeMemoizeMonths_(value=>{calls++;return canonical(value);});
 for(const value of ['6,7,8,9','[1, 2, 2, 13, 0]','1.5，2 12 -1','',"'3',4",'bad']){const expected=canonical(value),first=parse(value);assert.deepEqual(first,expected);first.push(99);const second=parse(value);assert.deepEqual(second,expected);assert.notEqual(first,second);}
 assert.equal(calls,6,'six immutable string inputs need only six canonical parses');
});
test('mutable month arrays and coercible values retain fresh reads and canonical errors',()=>{
 const services=createReadServices({},access,{now});assert.equal(typeof services.runtimeMemoizeMonths_,'function');const parse=services.runtimeMemoizeMonths_(canonical);
 const array=[6,7];assert.deepEqual(parse(array),[6,7]);array[0]=8;assert.deepEqual(parse(array),[8,7]);
 let reads=0;const value={toString(){reads++;return reads===1?'1,2':'3,4';}};assert.deepEqual(parse(value),[1,2]);assert.deepEqual(parse(value),[3,4]);assert.equal(reads,2);
 const broken={toString(){throw Error('CANONICAL_COERCION_FAILURE');}};assert.throws(()=>parse(broken),/CANONICAL_COERCION_FAILURE/);assert.throws(()=>parse(broken),/CANONICAL_COERCION_FAILURE/);
});
test('month reuse has no cross-request cache and stays bounded for long or numerous input strings',()=>{
 const one=createReadServices({},access,{now}),two=createReadServices({},access,{now});assert.equal(typeof one.runtimeMemoizeMonths_,'function');let calls=0;const source=v=>{calls++;return canonical(v);},a=one.runtimeMemoizeMonths_(source),b=two.runtimeMemoizeMonths_(source);
 a('6,7');a('6,7');b('6,7');assert.equal(calls,2,'another request must parse its own input');
 const long=' '.repeat(257)+'1,2';a(long);a(long);assert.equal(calls,4,'long raw inputs bypass retention');
 for(let i=0;i<80;i++){const value='1,2'+' '.repeat(i);assert.deepEqual(a(value),[1,2]);}
 const before=calls;a('1,2'+' '.repeat(79));assert.equal(calls,before+1,'the bounded cache must not retain every distinct value');
});
test('generated calculator installs the local adapter while preserving the complete500-room property response',()=>{
 const input=capacityDataset(),projected=projectedDataset(input),services=createReadServices(projected,access,{now});assert.equal(typeof services.runtimeMemoizeMonths_,'function');const wrap=services.runtimeMemoizeMonths_;let installed=0;const calls=new Map();
 services.runtimeMemoizeMonths_=parse=>{installed++;return wrap(value=>{if(typeof value==='string')calls.set(value,(calls.get(value)||0)+1);return parse(value);});};
 const actual=createReadCalculator(services).getLandlordPropertiesInitByLineUid_('SYNTHETIC_LINE1',true),expected=plain(originalGas(input,access,{now}).getLandlordPropertiesInitByLineUid_('SYNTHETIC_LINE1',true));
 assert.deepEqual(plain(actual),expected);assert.equal(installed,1);assert.ok(calls.size>0);assert.ok([...calls.values()].every(n=>n===1),'the repeated primitive month settings are parsed once');
});
