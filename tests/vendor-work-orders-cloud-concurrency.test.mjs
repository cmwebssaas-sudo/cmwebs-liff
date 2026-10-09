import test from 'node:test';
import assert from 'node:assert/strict';
import { sqliteD1 } from './helpers/vendor-d1.mjs';
import { createD1StateStore } from '../_dev/vendor-work-orders-cloud/src/d1-state-store.mjs';

test('independent cloud stores reject a stale snapshot without erasing the winning write', async () => {
  const db = sqliteD1();
  const a = createD1StateStore({ db }), b = createD1StateStore({ db });
  const first = await a.read(), second = await b.read();
  first.partners.push({ id: 'one', active: true });
  second.partners.push({ id: 'two', active: true });
  await a.write(first);
  await assert.rejects(b.write(second), { code: 'VERSION_CONFLICT' });
  assert.deepEqual((await b.read()).partners.map(row => row.id), ['one']);
});
