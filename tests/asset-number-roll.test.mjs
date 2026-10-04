import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../assets/js/cmwebs-asset-valuation.js', import.meta.url), 'utf8'), context);
const render = (...args) => context.CMWebsAssetValuation.rollingMoney(...args);

test('rolling money exposes only final accessible amount and each reel lands on its target', () => {
  const html = render(129084800, null, true);
  assert.match(html, /aria-label="NT\$ 129,084,800"/);
  const reels = [...html.matchAll(/class="av-number-track"[^>]*>(.*?)<\/span>/g)];
  assert.equal(reels.length, 9);
  assert.equal(reels.map(reel => [...reel[1].matchAll(/<i>(\d)<\/i>/g)].at(-1)[1]).join(''), '129084800');
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('rate decrease rolls from previous digits to lower value without changing rounding', () => {
  const html = render(2500000.4, 5000000, true);
  assert.match(html, /aria-label="NT\$ 2,500,000"/);
  const reels = [...html.matchAll(/class="av-number-track"[^>]*>(.*?)<\/span>/g)];
  assert.equal(reels.length, 2, 'unchanged digits stay still');
  const first = [...reels[0][1].matchAll(/<i>(\d)<\/i>/g)].map(m => m[1]);
  assert.equal(first[0], '5');
  assert.equal(first.at(-1), '2');
  assert.equal(first[1], '4');
});

test('unchanged rounded amount, pause, zero and unavailable values do not manufacture animated income', () => {
  for (const [value, previous, enabled, expected] of [
    [180000, 180000, true, 'NT$ 180,000'], [180000, null, false, 'NT$ 180,000'],
    [0, 0, true, 'NT$ 0'], [null, 100, true, '—'], [Infinity, 100, true, '—']
  ]) {
    const html = render(value, previous, enabled);
    assert.ok(html.includes(expected));
    assert.doesNotMatch(html, /av-number-track/);
  }
});

function widget(reduced = false, previous) {
  const sandbox = vm.createContext({ matchMedia: () => ({ matches: reduced }) });
  vm.runInContext(readFileSync(new URL('../assets/js/cmwebs-asset-valuation.js', import.meta.url), 'utf8'), sandbox);
  const nodes = new Map();
  const node = () => ({ innerHTML:'', textContent:'', value:'', dataset:{}, handlers:{},
    insertAdjacentHTML(){}, setAttribute(){}, removeAttribute(){}, addEventListener(type, fn){this.handlers[type]=fn;} });
  const rate = Object.assign(node(), { dataset:{rate:'4'} });
  const host = { innerHTML:'', querySelector(key){if(!nodes.has(key))nodes.set(key,node());return nodes.get(key);},
    querySelectorAll(key){return key === '[data-rate]' ? [rate] : [];} };
  const state = sandbox.CMWebsAssetValuation.mount(host,[{year:2024,collected:100000,recorded_months:12,months:[]}],previous);
  return {nodes,rate,state};
}

test('widget reuses prior scoped display on remount instead of restarting each property at zero', () => {
  const {nodes,state} = widget(false,{gross:10000000,collected:200000,paused:false});
  const html = nodes.get('[data-overview]').innerHTML;
  const first = [...html.matchAll(/class="av-number-track"[^>]*>(.*?)<\/span>/g)][0];
  assert.equal([...first[1].matchAll(/<i>(\d)<\/i>/g)][0][1], '0');
  assert.equal(state.gross,5000000);
  assert.equal(state.collected,100000);
  assert.ok(!html.includes('<i>0</i><i>1</i><i>2</i><i>3</i><i>4</i><i>5</i><i>6</i><i>7</i><i>8</i><i>9</i><i>0</i>'), 'remount must not play a full initial lap');
});

test('widget does not rewrite unchanged summary during costs and pause/resume cannot replay old digits', () => {
  const {nodes,rate} = widget();
  const overview = nodes.get('[data-overview]');
  const initial = overview.innerHTML;
  nodes.get('[data-expense]').handlers.input();
  assert.equal(overview.innerHTML,initial);
  rate.handlers.click();
  assert.ok(overview.innerHTML.includes('NT$ 2,500,000'));
  const motion = nodes.get('[data-motion]');
  motion.handlers.click({currentTarget:motion});
  assert.doesNotMatch(overview.innerHTML,/av-number-track/);
  motion.handlers.click({currentTarget:motion});
  assert.doesNotMatch(overview.innerHTML,/av-number-track/);
  assert.ok(overview.innerHTML.includes('NT$ 100,000'));
});

test('reduced-motion widget does not create rolling tracks even after resuming', () => {
  const {nodes,rate} = widget(true);
  rate.handlers.click();
  const motion = nodes.get('[data-motion]');
  motion.handlers.click({currentTarget:motion}); motion.handlers.click({currentTarget:motion});
  assert.doesNotMatch(nodes.get('[data-overview]').innerHTML,/av-number-track/);
});

test('scoped remount preserves paused state and shows the final amount immediately', () => {
  const {nodes,state} = widget(false,{gross:10000000,collected:200000,paused:true});
  assert.equal(state.paused,true);
  assert.equal(nodes.get('[data-motion]').textContent,'繼續圖表動畫');
  assert.doesNotMatch(nodes.get('[data-overview]').innerHTML,/av-number-track/);
});
