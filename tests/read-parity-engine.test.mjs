import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { originalGas, dataset, access, cases, fixture, plain, richDataset, projectedDataset } from './fixtures/read-parity/runtime.mjs';
import { parse } from '../cloudflare/read-api/node_modules/acorn/dist/acorn.mjs';
import { createReadCalculator } from '../cloudflare/read-api/src/read-calculator.js';
import { createReadServices } from '../cloudflare/read-api/src/read-runtime.js';

test('Worker calculator uses a reproducible, read-only selection of the current GAS source', async () => {
  const { createReadCalculator } = await import('../cloudflare/read-api/src/read-calculator.js');
  assert.equal(typeof createReadCalculator, 'function');
  const manifest = JSON.parse(readFileSync('cloudflare/read-api/read-source-manifest.json','utf8'));
  assert.ok(manifest.functions.includes('revenueDashboardAggregate_'));
  for (const [file, digest] of Object.entries(manifest.sources)) {
    assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), digest, file);
  }
  const generated = readFileSync('cloudflare/read-api/src/read-calculator.js','utf8');
  assert.doesNotMatch(generated, /\.setValues?\(|\.appendRow\(|\.insertSheet\(|\.deleteRows?\(|\.setPropert(?:y|ies)\(/);
  assert.doesNotMatch(generated, /\beval\(|\bnew Function\(/);
});

test('all six readers and both home sections preserve the full GAS calculation before storage projection', () => {
  const before=JSON.stringify(dataset);
  const gas=originalGas();
  const worker=createReadCalculator(createReadServices(dataset,access,{now:Date.parse(fixture.now)}));
  for(const item of cases) {
    const expected=plain(gas[item.fn](...item.args));
    assert.equal(expected.success,true,item.route+': '+expected.message);
    assert.deepEqual(plain(worker[item.fn](...item.args)),expected,item.route);
  }
  assert.equal(JSON.stringify(dataset),before,'readers must not mutate the fixture');
});

test('actual GAS action projection demonstrates why raw contract rows cannot enter the replica', () => {
  const c = vm.createContext({});
  vm.runInContext(readFileSync('apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js','utf8'), c);
  const result = c.landlordInitiatedContractPublicContract_({contract_id:'SYNTHETIC_C1',
    workspace_id:'SYNTHETIC_W1', contract_status:'pending_tenant_signature',
    identity_document_url:'https://synthetic.invalid/private-document',
    contract_file_url:'https://synthetic.invalid/private-contract-file'}, {}, {});
  assert.equal(result.identity_document_url, 'https://synthetic.invalid/private-document');
  assert.equal(result.contract_file_url, 'https://synthetic.invalid/private-contract-file');
  const schema = JSON.parse(readFileSync('cloudflare/read-api/schema.json','utf8'));
  assert.ok(!schema.V2_contracts.fields.includes('identity_document_url'));
  assert.ok(!schema.V2_contracts.fields.includes('contract_file_url'));
});

test('explicit summaries preserve rich-source monetary results and the actual home renderer counters', () => {
  const input=richDataset(), before=JSON.stringify(input);
  const gas=originalGas(input);
  const projected=projectedDataset(input);
  const worker=createReadCalculator(createReadServices(projected,access,{now:Date.parse(fixture.now)}));
  const html=readFileSync('landlord-home.html','utf8');
  const wanted=new Set(['numberValue','findSummaryNumber','countPendingPaymentReports','countPendingLandlordInitiatedContracts','buildActionSummary']);
  const declarations=[];
  for(const [,script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    const ast=parse(script,{ecmaVersion:'latest'});
    for(const node of ast.body) if(node.type==='FunctionDeclaration'&&wanted.has(node.id.name)) declarations.push(script.slice(node.start,node.end));
  }
  assert.equal(declarations.length,wanted.size,'test must use the real frontend consumer functions');
  const renderer=vm.createContext({});
  vm.runInContext(declarations.join('\n'),renderer);
  const full=plain(gas.getWorkspaceLandlordHomeBootstrapByLineUid_('SYNTHETIC_LINE1','actions'));
  const summary=plain(gas.getWorkspaceLandlordHomeBootstrapByLineUid_('SYNTHETIC_LINE1','actions','summary'));
  const counters=result=>plain(renderer.buildActionSummary(result.data.contract_requests,result.data.payment_reports,result.data.messages,result.data.landlord_initiated_contracts));
  assert.deepEqual(counters(summary),counters(full));
  assert.match(JSON.stringify(full),/SYNTHETIC_PRIVATE|synthetic.invalid\/private/,'full default must keep its existing detail');
  assert.doesNotMatch(JSON.stringify(summary),/SYNTHETIC_PRIVATE|synthetic.invalid\/private/);
  assert.doesNotMatch(JSON.stringify(projected),/SYNTHETIC_PRIVATE|synthetic.invalid\/private|000000012345/);
  for(const item of cases) assert.deepEqual(plain(worker[item.fn](...item.args)),plain(gas[item.fn](...item.args)),item.route+' rich source parity');
  const fullTenants=plain(gas.getWorkspaceLandlordTenantsNativeByLineUid_('SYNTHETIC_LINE1'));
  assert.ok(fullTenants.data.tenants.some(row=>Array.isArray(row.contract_history)&&row.contract_history.length));
  const summaryTenants=plain(gas.getWorkspaceLandlordTenantsNativeByLineUid_('SYNTHETIC_LINE1','summary'));
  assert.ok(summaryTenants.data.tenants.every(row=>!Object.hasOwn(row,'contract_history')));
  assert.equal(JSON.stringify(input),before,'summary calls must not alter default source rows');
});

test('affected Apps Script summary test executes without Sheet writes',()=>{
  assert.equal(originalGas().testV2ReadSummaryProjection().code,'READ_SUMMARY_TEST_PASSED');
});
