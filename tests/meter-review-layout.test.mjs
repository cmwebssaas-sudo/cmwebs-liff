import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../landlord-billing.html',import.meta.url),'utf8');
test('review-only meter rooms cannot be bulk selected and display review warning',()=>{
  assert.match(html,/const needsReview = item\.needs_occupancy_review === true/);
  assert.match(html,/!paid && !needsReview/);
  assert.match(html,/paid \|\| needsReview \? 'disabled'/);
  assert.match(html,/合約到期待核對/);
  assert.match(html,/id="previous_\$\{index\}"/);
  assert.match(html,/id="current_\$\{index\}"/);
});
test('meter workspace has a wide desktop layout without changing mobile fixed shell',()=>{
  assert.match(html,/@media \(min-width: 1024px\)/);
  assert.match(html,/\.app-shell \{ max-width: none;/);
  assert.match(html,/\.meter-work-list \{ display: grid;/);
  assert.match(html,/grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(html,/class="app-shell desktop-ready"/);
  assert.match(html,/\.app-shell \.bottom-nav \{ display: none/);
});
test('real card renderer retains readings while review checkbox is disabled and unchecked',()=>{
  const context=vm.createContext({
    hasInitialRentCreditApplied:()=>false,initialRentCreditCompletedBillIds:new Set(),
    safeHtml:value=>String(value??''),money:value=>String(value??0),formatRate:value=>String(value??0),
    baseItem:(label,value)=>label+value,calculationItem:()=>''
  });
  vm.runInContext(html.slice(html.indexOf('    function billCard('),html.indexOf('    function baseItem(')),context);
  const rendered=context.billCard({room_name:'502',needs_occupancy_review:true,previous_meter:150,rent_amount:9000},0);
  const checkbox=rendered.match(/<input\s+id="selected_0"[\s\S]*?\/>/)[0];
  assert.match(checkbox,/disabled/);
  assert.doesNotMatch(checkbox,/\schecked\s/);
  assert.match(rendered,/合約到期待核對/);
  assert.match(rendered,/id="previous_0"[\s\S]*?value="150"/);
  assert.match(rendered,/id="current_0"/);
  const editable=context.billCard({room_name:'202',existing_bill:{bill_id:'B1',payment_status:'unpaid',total_amount:9250}},1);
  const editCheckbox=editable.match(/<input\s+id="selected_1"[\s\S]*?\/>/)[0];
  assert.doesNotMatch(editCheckbox,/disabled|\schecked\s/);
  assert.match(editable,/折扣是總額/);
  assert.match(html,/edit_existing_bill: Boolean\(item.existing_bill\)/);
  assert.match(html,/expected_total_amount: item.existing_bill/);
});
