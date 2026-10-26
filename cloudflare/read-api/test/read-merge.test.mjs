import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeReplicaRows } from '../src/read-dataset.js';

test('merge keeps keyless and repeated-ID rows and drops only the same Sheet row seen twice', () => {
  const rows = [
    { payment_id: 'P1', replica_source_row: 2 }, { payment_id: '', replica_source_row: 3 },
    { payment_id: 'P1', replica_source_row: 4 }, { payment_id: '', replica_source_row: 5 },
    { payment_id: '', replica_source_row: 3 }
  ];
  assert.deepEqual(mergeReplicaRows('payment_id', rows).map(row => row.replica_source_row), [2, 3, 4, 5]);
});
